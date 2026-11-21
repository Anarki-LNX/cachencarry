// Package security centralises the security-critical logic of Cache & Carry:
// client access control, SSRF protection for upstream connections, password
// hashing, sessions and rate limiting.
package security

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/netip"
	"strings"
	"syscall"
	"time"
)

// ACL is a list of allowed client networks.
type ACL struct {
	nets []netip.Prefix
}

// NewACL parses CIDR strings into an ACL.
func NewACL(cidrs []string) (*ACL, error) {
	a := &ACL{}
	for _, c := range cidrs {
		p, err := netip.ParsePrefix(strings.TrimSpace(c))
		if err != nil {
			return nil, fmt.Errorf("invalid CIDR %q: %w", c, err)
		}
		a.nets = append(a.nets, p.Masked())
	}
	return a, nil
}

// Allows reports whether addr is inside one of the allowed networks. An
// empty ACL allows nobody.
func (a *ACL) Allows(addr netip.Addr) bool {
	addr = addr.Unmap().WithZone("")
	for _, p := range a.nets {
		if p.Contains(addr) {
			return true
		}
	}
	return false
}

// ClientIP determines the client address of a request. X-Forwarded-For is
// only honoured when the direct peer is a trusted proxy; the right-most
// address that is not itself a trusted proxy is used, so clients cannot
// spoof their address by sending the header themselves.
func ClientIP(r *http.Request, trusted *ACL) netip.Addr {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	peer, err := netip.ParseAddr(host)
	if err != nil {
		return netip.Addr{}
	}
	peer = peer.Unmap().WithZone("")
	if trusted == nil || !trusted.Allows(peer) {
		return peer
	}
	xff := strings.Join(r.Header.Values("X-Forwarded-For"), ",")
	parts := strings.Split(xff, ",")
	for i := len(parts) - 1; i >= 0; i-- {
		ip, err := netip.ParseAddr(strings.TrimSpace(parts[i]))
		if err != nil {
			break
		}
		ip = ip.Unmap().WithZone("")
		if !trusted.Allows(ip) {
			return ip
		}
	}
	return peer
}

// ErrForbiddenUpstream is returned when an upstream resolves to an address
// Cache & Carry refuses to connect to.
var ErrForbiddenUpstream = errors.New("upstream address is not allowed (private, loopback or link-local); set security.allow_private_upstreams to permit LAN mirrors")

var cgnat = netip.MustParsePrefix("100.64.0.0/10")

// PublicAddr reports whether ip is a globally routable unicast address.
func PublicAddr(ip netip.Addr) bool {
	ip = ip.Unmap()
	return ip.IsValid() && ip.IsGlobalUnicast() && !ip.IsPrivate() && !ip.IsLoopback() &&
		!ip.IsLinkLocalUnicast() && !ip.IsUnspecified() && !cgnat.Contains(ip)
}

// UpstreamDialer returns a dialer for upstream connections. Unless
// allowPrivate is set, the check runs on the address the socket actually
// connects to (after DNS resolution and for every redirect hop), which also
// defeats DNS rebinding.
func UpstreamDialer(allowPrivate bool, timeout time.Duration) *net.Dialer {
	d := &net.Dialer{Timeout: timeout, KeepAlive: 30 * time.Second}
	if !allowPrivate {
		d.Control = func(network, address string, _ syscall.RawConn) error {
			ap, err := netip.ParseAddrPort(address)
			if err != nil {
				return fmt.Errorf("upstream dial: %w", err)
			}
			if !PublicAddr(ap.Addr()) {
				return ErrForbiddenUpstream
			}
			return nil
		}
	}
	return d
}

// UpstreamClient builds the HTTP client used for all upstream requests.
// Certificate validation is always on; there is deliberately no option to
// disable it.
func UpstreamClient(allowPrivate bool, connectTimeout, headerTimeout time.Duration) *http.Client {
	d := UpstreamDialer(allowPrivate, connectTimeout)
	tr := &http.Transport{
		Proxy:                 nil, // never route upstream traffic through an ambient proxy
		DialContext:           d.DialContext,
		ForceAttemptHTTP2:     true,
		TLSHandshakeTimeout:   connectTimeout,
		ResponseHeaderTimeout: headerTimeout,
		MaxIdleConns:          64,
		MaxIdleConnsPerHost:   8,
		IdleConnTimeout:       90 * time.Second,
		DisableCompression:    true, // store bytes exactly as published
	}
	return &http.Client{
		Transport: tr,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return errors.New("too many redirects")
			}
			if req.URL.Scheme != "http" && req.URL.Scheme != "https" {
				return fmt.Errorf("redirect to unsupported scheme %q", req.URL.Scheme)
			}
			if len(via) > 0 && via[0].URL.Scheme == "https" && req.URL.Scheme == "http" {
				return errors.New("refusing redirect from https to http")
			}
			return nil
		},
	}
}

// CleanPath validates an object path (relative, without leading slash)
// taken from a request URL. It rejects anything that could escape the
// repository root or smuggle a different URL to the upstream. Paths are not
// normalised: a path is either canonical or refused, so one object can never
// be cached under two different keys.
func CleanPath(p string) (string, error) {
	if p == "" {
		return "", errors.New("empty path")
	}
	if len(p) > 2048 {
		return "", errors.New("path too long")
	}
	for _, seg := range strings.Split(p, "/") {
		switch seg {
		case "", ".", "..":
			return "", errors.New("path contains an invalid segment")
		}
	}
	for i := 0; i < len(p); i++ {
		if c := p[i]; c < 0x20 || c == 0x7f || c == '\\' {
			return "", errors.New("path contains an invalid character")
		}
	}
	return p, nil
}
