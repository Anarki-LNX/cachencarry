package adapters

import (
	"fmt"
	"net/http"
	"path"
	"strconv"
	"strings"
	"time"
)

// APT serves Debian-style repositories (Debian, Ubuntu, Linux Mint, …).
//
// Cache & Carry never modifies repository files. InRelease/Release signatures are
// passed through byte for byte, so apt keeps verifying them exactly as it
// would against the original mirror.
type APT struct{}

func (APT) Info() Info {
	return Info{
		Name:        "apt",
		Title:       "APT (Debian / Ubuntu)",
		Description: "Caches .deb packages and repository indexes for Debian, Ubuntu and derivatives.",
		Maturity:    Stable,
		RepoHint:    "Base URL of the archive, the directory that contains dists/ and pool/ (e.g. https://deb.debian.org/debian).",
	}
}

func (APT) Classify(p string) Class {
	switch {
	case strings.Contains("/"+p, "/by-hash/"):
		// Acquire-By-Hash: the file name is the content hash.
		return Class{Kind: Immutable}
	case strings.HasPrefix(p, "pool/") || strings.Contains(p, "/pool/"):
		// A pool file name contains package name, version and
		// architecture; archives never replace it with different content.
		return Class{Kind: Immutable, ContentType: aptContentType(p)}
	default:
		// dists/…: Release, InRelease, Packages, Sources, Contents, …
		return Class{Kind: Mutable}
	}
}

func aptContentType(p string) string {
	switch path.Ext(p) {
	case ".deb", ".udeb", ".ddeb":
		return "application/vnd.debian.binary-package"
	}
	return ""
}

func (APT) ClientConfig(baseURL, repo string) string {
	switch {
	case strings.Contains(repo, "ubuntu"):
		return fmt.Sprintf("# /etc/apt/sources.list.d/ubuntu.sources (deb822)\nTypes: deb\nURIs: %s\nSuites: noble noble-updates\nComponents: main restricted universe multiverse\nSigned-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n", baseURL)
	case strings.Contains(repo, "security"):
		return fmt.Sprintf("# /etc/apt/sources.list.d/debian.sources (deb822)\nTypes: deb\nURIs: %s\nSuites: trixie-security\nComponents: main contrib non-free-firmware\nSigned-By: /usr/share/keyrings/debian-archive-keyring.gpg\n", baseURL)
	default:
		return fmt.Sprintf("# /etc/apt/sources.list.d/debian.sources (deb822)\nTypes: deb\nURIs: %s\nSuites: trixie trixie-updates\nComponents: main contrib non-free-firmware\nSigned-By: /usr/share/keyrings/debian-archive-keyring.gpg\n", baseURL)
	}
}

// Pacman serves Arch-style repositories (Arch Linux, CachyOS, Manjaro, …).
//
// Package and database signatures are passed through unchanged; pacman's
// SigLevel verification keeps working as with any other mirror.
type Pacman struct{}

func (Pacman) Info() Info {
	return Info{
		Name:        "pacman",
		Title:       "Pacman (Arch Linux / CachyOS)",
		Description: "Caches packages and sync databases for Arch Linux based distributions.",
		Maturity:    Stable,
		RepoHint:    "Mirror base URL up to (not including) the $repo/os/$arch part (e.g. https://geo.mirror.pkgbuild.com).",
	}
}

func (Pacman) Classify(p string) Class {
	base := path.Base(p)
	name := strings.TrimSuffix(base, ".sig")
	switch {
	case isPacmanDB(name):
		// Sync databases (and their signatures) are replaced in place.
		return Class{Kind: Mutable}
	case strings.Contains(name, ".pkg.tar"):
		// Package file names carry name, version, release and arch.
		return Class{Kind: Immutable}
	default:
		return Class{Kind: Mutable}
	}
}

func isPacmanDB(name string) bool {
	for _, suffix := range []string{".db", ".files", ".db.tar.gz", ".db.tar.xz", ".db.tar.zst", ".files.tar.gz", ".files.tar.xz", ".files.tar.zst", ".links.tar.gz"} {
		if strings.HasSuffix(name, suffix) {
			return true
		}
	}
	return false
}

func (Pacman) ClientConfig(baseURL, repo string) string {
	if strings.Contains(repo, "cachyos") {
		return fmt.Sprintf("# /etc/pacman.d/cachyos-mirrorlist (first line; keep the others as fallback)\nServer = %s/$arch/$repo\n", baseURL)
	}
	return fmt.Sprintf("# /etc/pacman.d/mirrorlist (first line; keep the others as fallback)\nServer = %s/$repo/os/$arch\n", baseURL)
}

// Generic is a plain HTTP caching endpoint for configured upstream hosts. It
// honours the upstream's HTTP caching headers. It is not a forward proxy:
// only upstreams an administrator configured can be reached.
type Generic struct{}

func (Generic) Info() Info {
	return Info{
		Name:        "generic",
		Title:       "Generic HTTP",
		Description: "Caches static files from configured HTTP(S) servers, honouring their Cache-Control headers.",
		Maturity:    Experimental,
		RepoHint:    "Base URL of a static file server. Responses are cached only when their HTTP headers allow it.",
	}
}

func (Generic) Classify(string) Class { return Class{Kind: Mutable} }

func (Generic) ClientConfig(baseURL, _ string) string {
	return fmt.Sprintf("# Replace the original base URL with:\n%s/<path>\n", baseURL)
}

// AllowRequest refuses requests that carry credentials: the generic adapter
// has no notion of per-user authorization, so it must never fetch or store
// content on behalf of an authenticated user.
func (Generic) AllowRequest(r *http.Request) string {
	if r.Header.Get("Authorization") != "" || r.Header.Get("Cookie") != "" {
		return "authenticated requests are not proxied by the generic adapter"
	}
	return ""
}

// Cacheable implements the shared-cache rules of RFC 9111 that matter here.
func (Generic) Cacheable(h http.Header, defaultTTL time.Duration) (time.Duration, bool) {
	if h.Get("Set-Cookie") != "" {
		return 0, false
	}
	for _, v := range h.Values("Vary") {
		for _, f := range strings.Split(v, ",") {
			f = strings.ToLower(strings.TrimSpace(f))
			if f != "" && f != "accept-encoding" {
				return 0, false // response depends on request headers we do not key on
			}
		}
	}
	ttl := defaultTTL
	haveAge := false
	for _, v := range h.Values("Cache-Control") {
		for _, d := range strings.Split(v, ",") {
			name, val, _ := strings.Cut(strings.TrimSpace(d), "=")
			switch strings.ToLower(name) {
			case "no-store", "private":
				return 0, false
			case "no-cache":
				ttl, haveAge = 0, true // store, but revalidate on every use
			case "s-maxage", "max-age":
				n, err := strconv.ParseInt(strings.Trim(val, `"`), 10, 64)
				if err != nil || n < 0 {
					continue
				}
				if strings.EqualFold(name, "s-maxage") || !haveAge {
					ttl, haveAge = time.Duration(n)*time.Second, true
				}
			}
		}
	}
	if !haveAge {
		if exp := h.Get("Expires"); exp != "" {
			if t, err := http.ParseTime(exp); err == nil {
				if ttl = time.Until(t); ttl < 0 {
					ttl = 0
				}
			} else {
				ttl = 0 // invalid Expires means "already expired"
			}
		}
	}
	if ttl > 0 {
		if age, err := strconv.ParseInt(h.Get("Age"), 10, 64); err == nil && age > 0 {
			if ttl -= time.Duration(age) * time.Second; ttl < 0 {
				ttl = 0
			}
		}
	}
	// Without any validator a stale copy could never be revalidated.
	if ttl == 0 && h.Get("ETag") == "" && h.Get("Last-Modified") == "" {
		return 0, false
	}
	return ttl, true
}
