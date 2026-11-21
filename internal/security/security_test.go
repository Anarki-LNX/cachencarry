package security

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"strings"
	"testing"
	"time"

	"github.com/Anarki-LNX/cachencarry/internal/database"
)

func TestPublicAddr(t *testing.T) {
	blocked := []string{"127.0.0.1", "10.0.0.5", "172.16.3.1", "192.168.1.1", "169.254.169.254", "100.64.0.1",
		"0.0.0.0", "::1", "fe80::1", "fc00::1", "fd12:3456::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "224.0.0.1", "ff02::1", "::"}
	for _, s := range blocked {
		if PublicAddr(netip.MustParseAddr(s)) {
			t.Errorf("%s must not be treated as public", s)
		}
	}
	for _, s := range []string{"1.1.1.1", "151.101.2.132", "2a04:4e42::644", "100.128.0.1"} {
		if !PublicAddr(netip.MustParseAddr(s)) {
			t.Errorf("%s must be treated as public", s)
		}
	}
}

func TestUpstreamClientRefusesInternalTargets(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("internal")) }))
	defer srv.Close()
	strict := UpstreamClient(false, 2*time.Second, 2*time.Second)
	if _, err := strict.Get(srv.URL); !errors.Is(err, ErrForbiddenUpstream) {
		t.Fatalf("loopback upstream: err = %v, want ErrForbiddenUpstream", err)
	}
	// "localhost" resolves to loopback: the check runs after DNS resolution.
	if _, err := strict.Get(strings.Replace(srv.URL, "127.0.0.1", "localhost", 1)); !errors.Is(err, ErrForbiddenUpstream) {
		t.Fatalf("localhost upstream: err = %v, want ErrForbiddenUpstream", err)
	}
	if _, err := strict.Get("http://169.254.169.254/latest/meta-data/"); !errors.Is(err, ErrForbiddenUpstream) {
		t.Fatalf("metadata service: err = %v", err)
	}
	lan := UpstreamClient(true, 2*time.Second, 2*time.Second)
	resp, err := lan.Get(srv.URL)
	if err != nil {
		t.Fatalf("allow_private_upstreams: %v", err)
	}
	resp.Body.Close()
}

func TestUpstreamClientRedirectRules(t *testing.T) {
	c := UpstreamClient(true, 2*time.Second, 2*time.Second)
	for _, target := range []string{"file:///etc/passwd", "gopher://x/", "ftp://x/"} {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Location", target)
			w.WriteHeader(http.StatusFound)
		}))
		if resp, err := c.Get(srv.URL); err == nil {
			resp.Body.Close()
			t.Errorf("redirect to %s was followed", target)
		}
		srv.Close()
	}
	var loop *httptest.Server
	loop = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, loop.URL+"/again", http.StatusFound)
	}))
	defer loop.Close()
	if resp, err := c.Get(loop.URL); err == nil {
		resp.Body.Close()
		t.Error("redirect loop was not stopped")
	}
}

func TestCleanPath(t *testing.T) {
	for _, p := range []string{"pool/main/a/a_1.0-1_amd64.deb", "dists/trixie/InRelease", "a", "x/y+z~1:2.deb", "a/..b/c", "a/b..", "a/.hidden"} {
		if got, err := CleanPath(p); err != nil || got != p {
			t.Errorf("CleanPath(%q) = %q, %v", p, got, err)
		}
	}
	for _, p := range []string{"", "/", "/abs", "..", "../x", "a/../b", "a/./b", "a//b", "a/", "a\\b", "a\x00b", "a\nb", "a/..", strings.Repeat("a", 3000)} {
		if _, err := CleanPath(p); err == nil {
			t.Errorf("CleanPath(%q) accepted", p)
		}
	}
}

func TestACLAndClientIP(t *testing.T) {
	acl, err := NewACL([]string{"192.168.1.0/24", "fd00::/8"})
	if err != nil {
		t.Fatal(err)
	}
	for addr, want := range map[string]bool{"192.168.1.77": true, "192.168.2.1": false, "::ffff:192.168.1.5": true, "fd00::5": true, "2001:db8::1": false} {
		if got := acl.Allows(netip.MustParseAddr(addr)); got != want {
			t.Errorf("Allows(%s) = %v", addr, got)
		}
	}
	if _, err := NewACL([]string{"nonsense"}); err == nil {
		t.Error("invalid CIDR accepted")
	}
	empty, _ := NewACL(nil)
	if empty.Allows(netip.MustParseAddr("127.0.0.1")) {
		t.Error("empty ACL must allow nobody")
	}

	trusted, _ := NewACL([]string{"10.0.0.1/32"})
	req := func(remote, xff string) *http.Request {
		r := httptest.NewRequest("GET", "/", nil)
		r.RemoteAddr = remote
		if xff != "" {
			r.Header.Set("X-Forwarded-For", xff)
		}
		return r
	}
	cases := []struct{ remote, xff, want string }{
		{"203.0.113.9:1234", "", "203.0.113.9"},
		{"203.0.113.9:1234", "192.168.1.5", "203.0.113.9"},        // untrusted peer: header ignored
		{"10.0.0.1:1234", "192.168.1.5", "192.168.1.5"},           // trusted proxy
		{"10.0.0.1:1234", "6.6.6.6, 192.168.1.5", "192.168.1.5"},  // client-supplied prefix ignored
		{"10.0.0.1:1234", "192.168.1.5, 10.0.0.1", "192.168.1.5"}, // skip trusted hops
		{"10.0.0.1:1234", "garbage", "10.0.0.1"},
		{"[::ffff:192.168.1.9]:99", "", "192.168.1.9"},
	}
	for _, c := range cases {
		if got := ClientIP(req(c.remote, c.xff), trusted).String(); got != c.want {
			t.Errorf("ClientIP(%s, %q) = %s, want %s", c.remote, c.xff, got, c.want)
		}
	}
}

func TestAuthLifecycle(t *testing.T) {
	ctx := context.Background()
	db, err := database.Open(ctx, t.TempDir()+"/m.db")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	a := NewAuth(db, time.Hour)
	if has, _ := a.HasUsers(ctx); has {
		t.Fatal("fresh database has users")
	}
	if err := a.CreateFirstUser(ctx, "admin", "short"); err == nil {
		t.Fatal("weak password accepted")
	}
	if err := a.CreateFirstUser(ctx, "admin", "a sufficiently long one"); err != nil {
		t.Fatal(err)
	}
	if err := a.CreateFirstUser(ctx, "second", "another long password"); err == nil {
		t.Fatal("setup could be repeated")
	}
	var stored string
	db.R.QueryRow(`SELECT password_hash FROM users`).Scan(&stored)
	if !strings.HasPrefix(stored, "$2") || strings.Contains(stored, "sufficiently") {
		t.Fatalf("password not hashed with bcrypt: %q", stored)
	}
	if _, _, err := a.Login(ctx, "admin", "wrong"); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("err = %v", err)
	}
	token, s, err := a.Login(ctx, "admin", "a sufficiently long one")
	if err != nil || len(token) < 40 || s.CSRF == "" {
		t.Fatalf("login: %v", err)
	}
	got, err := a.Session(ctx, token)
	if err != nil || got.Username != "admin" || !got.CSRFMatches(s.CSRF) || got.CSRFMatches("x") {
		t.Fatalf("session: %+v, %v", got, err)
	}
	if _, err := a.Session(ctx, token+"x"); !errors.Is(err, ErrNoSession) {
		t.Fatal("forged token accepted")
	}
	// Expired sessions are refused.
	db.W.Exec(`UPDATE sessions SET expires_at = 1`)
	if _, err := a.Session(ctx, token); !errors.Is(err, ErrNoSession) {
		t.Fatal("expired session accepted")
	}
	if err := a.PurgeExpired(ctx); err != nil {
		t.Fatal(err)
	}
	// Changing the password ends every session.
	t1, _, _ := a.Login(ctx, "admin", "a sufficiently long one")
	if err := a.SetPassword(ctx, s.UserID, "the replacement password"); err != nil {
		t.Fatal(err)
	}
	if _, err := a.Session(ctx, t1); !errors.Is(err, ErrNoSession) {
		t.Fatal("session survived a password change")
	}
	if _, _, err := a.Login(ctx, "admin", "the replacement password"); err != nil {
		t.Fatal(err)
	}
}

func TestRateLimiter(t *testing.T) {
	l := NewRateLimiter(3, 50*time.Millisecond)
	for i := 0; i < 3; i++ {
		if !l.Allow("a") {
			t.Fatalf("event %d refused", i)
		}
	}
	if l.Allow("a") {
		t.Fatal("limit not enforced")
	}
	if !l.Allow("b") {
		t.Fatal("keys are not independent")
	}
	time.Sleep(60 * time.Millisecond)
	if !l.Allow("a") {
		t.Fatal("window did not reset")
	}
}
