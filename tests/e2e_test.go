// Package tests contains end-to-end tests that run a complete UniCache
// instance against local mock upstream repositories. No Internet access is
// needed.
package tests

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Anarki-LNX/unicache/internal/app"
	"github.com/Anarki-LNX/unicache/internal/config"
	"github.com/Anarki-LNX/unicache/internal/stats"
	"github.com/Anarki-LNX/unicache/internal/testutil"
)

// upstream is a mock mirror that counts requests per path.
type upstream struct {
	*httptest.Server
	mu    sync.Mutex
	files map[string]*file
	hits  map[string]int
	cond  map[string]int // conditional requests answered with 304
	down  atomic.Bool
	gate  chan struct{} // when non-nil, bodies wait here after the first chunk
}

type file struct {
	data []byte
	etag string
	mod  time.Time
}

func newUpstream(t *testing.T) *upstream {
	u := &upstream{files: map[string]*file{}, hits: map[string]int{}, cond: map[string]int{}}
	u.Server = httptest.NewServer(http.HandlerFunc(u.serve))
	t.Cleanup(u.Close)
	return u
}

func (u *upstream) put(path string, data []byte) {
	u.mu.Lock()
	defer u.mu.Unlock()
	v := 1
	if old := u.files[path]; old != nil {
		fmt.Sscanf(old.etag, `"v%d"`, &v)
		v++
	}
	u.files[path] = &file{data: data, etag: fmt.Sprintf(`"v%d"`, v), mod: time.Now().Add(time.Duration(v) * time.Second).UTC().Truncate(time.Second)}
}

func (u *upstream) remove(path string) { u.mu.Lock(); delete(u.files, path); u.mu.Unlock() }

func (u *upstream) count(path string) int { u.mu.Lock(); defer u.mu.Unlock(); return u.hits[path] }

func (u *upstream) notModified(path string) int {
	u.mu.Lock()
	defer u.mu.Unlock()
	return u.cond[path]
}

func (u *upstream) serve(w http.ResponseWriter, r *http.Request) {
	if u.down.Load() {
		http.Error(w, "mirror down", http.StatusServiceUnavailable)
		return
	}
	u.mu.Lock()
	u.hits[r.URL.Path]++
	f := u.files[r.URL.Path]
	gate := u.gate
	u.mu.Unlock()
	if f == nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("ETag", f.etag)
	w.Header().Set("Last-Modified", f.mod.Format(http.TimeFormat))
	if r.Header.Get("If-None-Match") == f.etag {
		u.mu.Lock()
		u.cond[r.URL.Path]++
		u.mu.Unlock()
		w.WriteHeader(http.StatusNotModified)
		return
	}
	w.Header().Set("Content-Length", strconv.Itoa(len(f.data)))
	if gate != nil && len(f.data) > 16 {
		w.Write(f.data[:16])
		w.(http.Flusher).Flush()
		<-gate
		w.Write(f.data[16:])
		return
	}
	w.Write(f.data)
}

type instance struct {
	*app.App
	srv *httptest.Server
	cfg *config.Config
}

func (i *instance) url(p string) string { return i.srv.URL + p }

// start runs a UniCache instance whose apt/debian and pacman/arch
// repositories point at the given mock upstreams.
func start(t *testing.T, mut func(*config.Config), ups ...*upstream) *instance {
	t.Helper()
	cfg := config.Default()
	cfg.Storage.Path = t.TempDir()
	cfg.Database.Path = filepath.Join(cfg.Storage.Path, "metadata.db")
	cfg.Storage.MinFreeSpace = "0"
	cfg.Security.AllowPrivateUpstreams = true // the mock mirrors live on 127.0.0.1
	cfg.Security.AdminPassword = "correct horse battery"
	cfg.Download.RetryBackoff = config.Duration(time.Millisecond)
	cfg.Download.Retries = 1
	cfg.Cache.MetadataTTL = config.Duration(time.Hour)
	var urls []string
	for _, u := range ups {
		urls = append(urls, u.URL)
	}
	if len(urls) == 0 {
		urls = []string{"http://127.0.0.1:1"} // nothing listens here
	}
	cfg.Modules = map[string]config.Module{
		"apt":     {Enabled: true, Repositories: []config.Repository{{Name: "debian", Upstreams: urls}}},
		"pacman":  {Enabled: true, Repositories: []config.Repository{{Name: "arch", Upstreams: urls}}},
		"generic": {Enabled: true, Repositories: []config.Repository{{Name: "files", Upstreams: urls}}},
	}
	if mut != nil {
		mut(cfg)
	}
	if err := cfg.Validate(); err != nil {
		t.Fatal(err)
	}
	a, err := app.New(context.Background(), cfg, app.Options{Version: "test", Logger: testutil.Logger(), NoSync: true,
		EvictDebounce: 20 * time.Millisecond})
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer(a.Handler())
	t.Cleanup(func() { srv.Close(); a.Close() })
	current = &instance{App: a, srv: srv, cfg: cfg}
	return current
}

// current is the instance started last (tests in this package do not run
// in parallel).
var current *instance

// settle waits until no download is in flight. A client has received its
// last byte slightly before the object is published; a request sent in that
// window is (correctly) coalesced instead of being a cache hit, which would
// make the assertions below timing dependent.
func settle() {
	if current == nil {
		return
	}
	for i := 0; i < 2000 && len(current.DL.Active()) > 0; i++ {
		time.Sleep(time.Millisecond)
	}
}

func get(t *testing.T, url string, hdr ...string) (*http.Response, []byte) {
	t.Helper()
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	for i := 0; i+1 < len(hdr); i += 2 {
		req.Header.Set(hdr[i], hdr[i+1])
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET %s: %v", url, err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("GET %s: read body: %v", url, err)
	}
	settle()
	return resp, body
}

func randBytes(n int) []byte { b := make([]byte, n); rand.Read(b); return b }

func expect(t *testing.T, resp *http.Response, body []byte, status int, xcache string, want []byte) {
	t.Helper()
	if resp.StatusCode != status {
		t.Fatalf("status = %d, want %d (body %q)", resp.StatusCode, status, truncate(body))
	}
	if got := resp.Header.Get("X-Cache"); xcache != "" && got != xcache {
		t.Fatalf("X-Cache = %q, want %q", got, xcache)
	}
	if want != nil && !bytes.Equal(body, want) {
		t.Fatalf("body mismatch: got %d bytes, want %d", len(body), len(want))
	}
}

func truncate(b []byte) string {
	if len(b) > 120 {
		return string(b[:120]) + "…"
	}
	return string(b)
}

// TestTwoClientsOneUpstreamDownload is the milestone demonstration: several
// clients request the same uncached package at the same time and the mirror
// sees a single download. A later client is served from the cache.
func TestTwoClientsOneUpstreamDownload(t *testing.T) {
	up := newUpstream(t)
	deb := randBytes(1 << 20)
	const p = "/pool/main/h/hello/hello_2.10-3_amd64.deb"
	up.put(p, deb)
	up.gate = make(chan struct{})
	uc := start(t, nil, up)

	const clients = 8
	var wg sync.WaitGroup
	results := make(chan string, clients)
	for i := 0; i < clients; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			resp, body := get(t, uc.url("/apt/debian"+p))
			if resp.StatusCode != 200 || !bytes.Equal(body, deb) {
				t.Errorf("client got status %d, %d bytes", resp.StatusCode, len(body))
			}
			results <- resp.Header.Get("X-Cache")
		}()
	}
	// Wait until all clients are attached to the one flight, then let the
	// mirror finish.
	deadline := time.Now().Add(5 * time.Second)
	for {
		dl := uc.DL.Active()
		if len(dl) == 1 && dl[0].Clients == clients {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("clients did not coalesce: %+v", dl)
		}
		time.Sleep(2 * time.Millisecond)
	}
	close(up.gate)
	wg.Wait()
	close(results)
	miss, coalesced := 0, 0
	for r := range results {
		switch r {
		case "MISS":
			miss++
		case "COALESCED":
			coalesced++
		}
	}
	if up.count(p) != 1 {
		t.Fatalf("mirror served the package %d times, want exactly 1", up.count(p))
	}
	if miss != 1 || coalesced != clients-1 {
		t.Fatalf("miss=%d coalesced=%d, want 1 and %d", miss, coalesced, clients-1)
	}
	resp, body := get(t, uc.url("/apt/debian"+p))
	expect(t, resp, body, 200, "HIT", deb)
	if up.count(p) != 1 {
		t.Fatal("cache hit contacted the mirror")
	}
	if ct := resp.Header.Get("Content-Type"); ct != "application/vnd.debian.binary-package" {
		t.Errorf("Content-Type = %q", ct)
	}

	// Statistics are measured, not estimated.
	all, per := uc.Stats.Totals()
	if all.Misses != 1 || all.Hits != clients || all.BytesUpstream != int64(len(deb)) ||
		all.BytesOrigin != int64(len(deb)) || all.BytesCache != int64(clients*len(deb)) {
		t.Fatalf("totals = %+v", all)
	}
	if per["apt"] != all {
		t.Fatalf("per-module totals differ: %+v", per)
	}
}

func TestAPTMetadataRevalidation(t *testing.T) {
	up := newUpstream(t)
	const p = "/dists/trixie/InRelease"
	up.put(p, []byte("signed release v1"))
	uc := start(t, func(c *config.Config) { c.Cache.MetadataTTL = config.Duration(time.Second) }, up)

	resp, body := get(t, uc.url("/apt/debian"+p))
	expect(t, resp, body, 200, "MISS", []byte("signed release v1"))
	etag, lm := resp.Header.Get("ETag"), resp.Header.Get("Last-Modified")
	if etag != `"v1"` || lm == "" {
		t.Fatalf("validators not passed through: ETag=%q Last-Modified=%q", etag, lm)
	}
	resp, body = get(t, uc.url("/apt/debian"+p))
	expect(t, resp, body, 200, "HIT", []byte("signed release v1"))
	if up.count(p) != 1 {
		t.Fatal("fresh metadata was revalidated")
	}
	// apt's own conditional request is answered locally.
	resp, body = get(t, uc.url("/apt/debian"+p), "If-None-Match", etag)
	expect(t, resp, body, 304, "HIT", nil)
	resp, _ = get(t, uc.url("/apt/debian"+p), "If-Modified-Since", lm)
	if resp.StatusCode != 304 {
		t.Fatalf("If-Modified-Since: status %d, want 304", resp.StatusCode)
	}

	time.Sleep(2100 * time.Millisecond) // TTL passes
	resp, body = get(t, uc.url("/apt/debian"+p))
	expect(t, resp, body, 200, "REVALIDATED", []byte("signed release v1"))
	if up.notModified(p) != 1 {
		t.Fatalf("expected one conditional upstream request, got %d", up.notModified(p))
	}
	resp, _ = get(t, uc.url("/apt/debian"+p))
	if resp.Header.Get("X-Cache") != "HIT" {
		t.Fatal("revalidation did not renew freshness")
	}

	up.put(p, []byte("signed release v2 with new packages"))
	time.Sleep(2100 * time.Millisecond)
	resp, body = get(t, uc.url("/apt/debian"+p))
	expect(t, resp, body, 200, "MISS", []byte("signed release v2 with new packages"))
	if resp.Header.Get("ETag") != `"v2"` {
		t.Fatalf("stale ETag %q after update", resp.Header.Get("ETag"))
	}
}

func TestImmutablePackagesAreNeverRevalidated(t *testing.T) {
	up := newUpstream(t)
	paths := []string{
		"/pool/main/a/a_1_all.deb",
		"/dists/trixie/main/binary-amd64/by-hash/SHA256/0123abcd",
	}
	uc := start(t, func(c *config.Config) { c.Cache.MetadataTTL = 0 }, up)
	for _, p := range paths {
		up.put(p, []byte("content of "+p))
		get(t, uc.url("/apt/debian"+p))
		for i := 0; i < 3; i++ {
			resp, body := get(t, uc.url("/apt/debian"+p))
			expect(t, resp, body, 200, "HIT", []byte("content of "+p))
		}
		if up.count(p) != 1 {
			t.Errorf("%s fetched %d times", p, up.count(p))
		}
	}
	// With TTL 0, mutable metadata is revalidated on every use.
	const rel = "/dists/trixie/Release"
	up.put(rel, []byte("release"))
	get(t, uc.url("/apt/debian"+rel))
	resp, _ := get(t, uc.url("/apt/debian"+rel))
	if resp.Header.Get("X-Cache") != "REVALIDATED" {
		t.Fatalf("X-Cache = %q, want REVALIDATED", resp.Header.Get("X-Cache"))
	}
}

func TestPacmanRepository(t *testing.T) {
	up := newUpstream(t)
	pkg := randBytes(200_000)
	const pkgPath = "/core/os/x86_64/linux-6.12.1.arch1-1-x86_64.pkg.tar.zst"
	const dbPath = "/core/os/x86_64/core.db"
	up.put(pkgPath, pkg)
	up.put(pkgPath+".sig", []byte("detached signature"))
	up.put(dbPath, []byte("database v1"))
	uc := start(t, func(c *config.Config) { c.Cache.MetadataTTL = 0 }, up)

	resp, body := get(t, uc.url("/pacman/arch"+pkgPath))
	expect(t, resp, body, 200, "MISS", pkg)
	resp, body = get(t, uc.url("/pacman/arch"+pkgPath))
	expect(t, resp, body, 200, "HIT", pkg)
	resp, body = get(t, uc.url("/pacman/arch"+pkgPath+".sig"))
	expect(t, resp, body, 200, "MISS", []byte("detached signature"))
	resp, body = get(t, uc.url("/pacman/arch"+pkgPath+".sig"))
	expect(t, resp, body, 200, "HIT", []byte("detached signature")) // signatures pass through unmodified

	// The sync database is mutable: pacman's If-Modified-Since works and a
	// new database is picked up.
	resp, _ = get(t, uc.url("/pacman/arch"+dbPath))
	lm := resp.Header.Get("Last-Modified")
	resp, _ = get(t, uc.url("/pacman/arch"+dbPath), "If-Modified-Since", lm)
	if resp.StatusCode != 304 {
		t.Fatalf("db If-Modified-Since: status %d, want 304", resp.StatusCode)
	}
	up.put(dbPath, []byte("database v2"))
	resp, body = get(t, uc.url("/pacman/arch"+dbPath), "If-Modified-Since", lm)
	expect(t, resp, body, 200, "MISS", []byte("database v2"))
	if up.count(pkgPath) != 1 {
		t.Fatal("package downloaded more than once")
	}
}

func TestRangeRequests(t *testing.T) {
	up := newUpstream(t)
	data := randBytes(100_000)
	const p = "/pool/r/range.deb"
	up.put(p, data)
	uc := start(t, nil, up)

	// A range request for an uncached object: the complete object is
	// fetched once and the requested part is returned.
	resp, body := get(t, uc.url("/apt/debian"+p), "Range", "bytes=1000-1999")
	expect(t, resp, body, 206, "MISS", data[1000:2000])
	if cr := resp.Header.Get("Content-Range"); cr != "bytes 1000-1999/100000" {
		t.Fatalf("Content-Range = %q", cr)
	}
	cases := []struct {
		rng    string
		status int
		want   []byte
	}{
		{"bytes=0-0", 206, data[:1]},
		{"bytes=99990-", 206, data[99990:]},
		{"bytes=-10", 206, data[99990:]},
		{"bytes=50000-50009", 206, data[50000:50010]},
		{"bytes=200000-", 416, nil},
	}
	for _, c := range cases {
		resp, body := get(t, uc.url("/apt/debian"+p), "Range", c.rng)
		if resp.StatusCode != c.status || (c.want != nil && !bytes.Equal(body, c.want)) {
			t.Errorf("Range %s: status %d, %d bytes", c.rng, resp.StatusCode, len(body))
		}
	}
	// If-Range with a stale validator returns the full object.
	resp, body = get(t, uc.url("/apt/debian"+p), "Range", "bytes=0-9", "If-Range", `"other"`)
	expect(t, resp, body, 200, "HIT", data)
	if up.count(p) != 1 {
		t.Fatalf("upstream contacted %d times", up.count(p))
	}
	// Bandwidth accounting counts the bytes really sent, not object sizes.
	all, _ := uc.Stats.Totals()
	wantCache := int64(1 + 10 + 10 + 10 + len(data))
	if all.BytesCache != wantCache || all.BytesOrigin != 1000 {
		t.Fatalf("bytes_cache=%d (want %d) bytes_origin=%d (want 1000)", all.BytesCache, wantCache, all.BytesOrigin)
	}
}

func TestHeadRequest(t *testing.T) {
	up := newUpstream(t)
	data := randBytes(5000)
	up.put("/pool/h.deb", data)
	uc := start(t, nil, up)
	for _, want := range []string{"MISS", "HIT"} {
		resp, err := http.Head(uc.url("/apt/debian/pool/h.deb"))
		if err != nil {
			t.Fatal(err)
		}
		resp.Body.Close()
		if resp.StatusCode != 200 || resp.ContentLength != 5000 || resp.Header.Get("X-Cache") != want {
			t.Fatalf("HEAD: status %d, length %d, X-Cache %q (want %s)", resp.StatusCode, resp.ContentLength, resp.Header.Get("X-Cache"), want)
		}
		settle() // let the flight publish before the second HEAD
	}
}

func TestNotFoundAndNegativeCache(t *testing.T) {
	up := newUpstream(t)
	uc := start(t, nil, up)
	const p = "/pool/missing.deb"
	resp, _ := get(t, uc.url("/apt/debian"+p))
	if resp.StatusCode != 404 {
		t.Fatalf("status %d", resp.StatusCode)
	}
	resp, _ = get(t, uc.url("/apt/debian"+p))
	if resp.StatusCode != 404 || resp.Header.Get("X-Cache") != "NEGATIVE" {
		t.Fatalf("second request: status %d, X-Cache %q", resp.StatusCode, resp.Header.Get("X-Cache"))
	}
	if up.count(p) != 1 {
		t.Fatalf("404 not remembered: %d upstream requests", up.count(p))
	}
}

func TestStaleServedWhenUpstreamIsDown(t *testing.T) {
	up := newUpstream(t)
	const idx, pkg = "/dists/trixie/InRelease", "/pool/cached.deb"
	up.put(idx, []byte("release"))
	up.put(pkg, []byte("package"))
	uc := start(t, func(c *config.Config) { c.Cache.MetadataTTL = 0 }, up)
	get(t, uc.url("/apt/debian"+idx))
	get(t, uc.url("/apt/debian"+pkg))
	up.down.Store(true)

	resp, body := get(t, uc.url("/apt/debian"+idx))
	expect(t, resp, body, 200, "STALE", []byte("release"))
	resp, body = get(t, uc.url("/apt/debian"+pkg))
	expect(t, resp, body, 200, "HIT", []byte("package")) // packages need no upstream at all
	resp, _ = get(t, uc.url("/apt/debian/pool/never-seen.deb"))
	if resp.StatusCode != http.StatusBadGateway {
		t.Fatalf("uncached object with upstream down: status %d, want 502", resp.StatusCode)
	}
}

func TestStaleDisabled(t *testing.T) {
	up := newUpstream(t)
	up.put("/dists/x/InRelease", []byte("release"))
	uc := start(t, func(c *config.Config) { c.Cache.MetadataTTL = 0; c.Cache.ServeStaleOnError = false }, up)
	get(t, uc.url("/apt/debian/dists/x/InRelease"))
	up.down.Store(true)
	resp, _ := get(t, uc.url("/apt/debian/dists/x/InRelease"))
	if resp.StatusCode != http.StatusBadGateway {
		t.Fatalf("status %d, want 502", resp.StatusCode)
	}
}

func TestRemovedUpstreamFileIsDropped(t *testing.T) {
	up := newUpstream(t)
	up.put("/dists/x/Packages.gz", []byte("index"))
	uc := start(t, func(c *config.Config) { c.Cache.MetadataTTL = 0; c.Cache.NegativeTTL = 0 }, up)
	get(t, uc.url("/apt/debian/dists/x/Packages.gz"))
	up.remove("/dists/x/Packages.gz")
	for i := 0; i < 2; i++ {
		resp, _ := get(t, uc.url("/apt/debian/dists/x/Packages.gz"))
		if resp.StatusCode != 404 {
			t.Fatalf("request %d: status %d, want 404", i, resp.StatusCode)
		}
	}
}

func TestMirrorFailoverEndToEnd(t *testing.T) {
	bad, good := newUpstream(t), newUpstream(t)
	bad.down.Store(true)
	good.put("/pool/f.deb", []byte("from the second mirror"))
	uc := start(t, nil, bad, good)
	resp, body := get(t, uc.url("/apt/debian/pool/f.deb"))
	expect(t, resp, body, 200, "MISS", []byte("from the second mirror"))
}

func TestDeduplicationAcrossAdapters(t *testing.T) {
	up := newUpstream(t)
	data := randBytes(50_000)
	up.put("/pool/same.deb", data)
	up.put("/extra/os/x86_64/same-1-1-any.pkg.tar.zst", data)
	uc := start(t, nil, up)
	get(t, uc.url("/apt/debian/pool/same.deb"))
	get(t, uc.url("/pacman/arch/extra/os/x86_64/same-1-1-any.pkg.tar.zst"))
	u, err := uc.Store.Usage(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if u.BlobCount != 1 || u.EntryCount != 2 || u.DedupSaved != int64(len(data)) {
		t.Fatalf("usage = blobs %d, entries %d, dedup %d", u.BlobCount, u.EntryCount, u.DedupSaved)
	}
}

func TestRequestValidationAndAccessControl(t *testing.T) {
	up := newUpstream(t)
	up.put("/pool/ok.deb", []byte("ok"))
	up.put("/secret", []byte("outside the repository"))
	uc := start(t, nil, up)

	raw := func(method, path string) int {
		// Use a raw request line: http.NewRequest would normalise "..".
		conn, err := net.Dial("tcp", strings.TrimPrefix(uc.srv.URL, "http://"))
		if err != nil {
			t.Fatal(err)
		}
		defer conn.Close()
		fmt.Fprintf(conn, "%s %s HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n", method, path)
		buf, _ := io.ReadAll(conn)
		var code int
		fmt.Sscanf(string(buf), "HTTP/1.1 %d", &code)
		return code
	}
	for path, want := range map[string]int{
		"/apt/debian/pool/ok.deb":               200,
		"/apt/debian/../../secret":              400,
		"/apt/debian/pool/../../secret":         400,
		"/apt/debian/pool/%2e%2e/%2e%2e/secret": 400,
		"/apt/debian//pool/ok.deb":              400,
		"/apt/debian/pool/a%00b":                400,
		"/apt/debian/pool/a%5Cb":                400,
		"/apt/unknown-repo/pool/ok.deb":         404,
		"/apt/debian":                           404,
		"/apt/debian/":                          400,
	} {
		if got := raw("GET", path); got != want {
			t.Errorf("GET %s: status %d, want %d", path, got, want)
		}
	}
	for _, m := range []string{"POST", "PUT", "DELETE", "CONNECT"} {
		if got := raw(m, "/apt/debian/pool/ok.deb"); got != 405 && got != 400 {
			t.Errorf("%s: status %d, want 405", m, got)
		}
	}
	if up.count("/secret") != 0 {
		t.Fatal("path traversal reached the upstream")
	}

	// The query string is never forwarded upstream.
	get(t, uc.url("/apt/debian/pool/ok.deb?x=/secret"))

	// Disabled module.
	if err := uc.Modules.SetEnabled(context.Background(), "apt", false); err != nil {
		t.Fatal(err)
	}
	if got := raw("GET", "/apt/debian/pool/ok.deb"); got != 404 {
		t.Errorf("disabled module: status %d, want 404", got)
	}
}

func TestClientACL(t *testing.T) {
	up := newUpstream(t)
	up.put("/pool/ok.deb", []byte("ok"))
	uc := start(t, func(c *config.Config) {
		c.Security.AllowedClients = []string{"10.9.9.0/24"} // not us
		c.Security.AdminAllowed = []string{"10.9.9.0/24"}
	}, up)
	resp, _ := get(t, uc.url("/apt/debian/pool/ok.deb"))
	if resp.StatusCode != 403 {
		t.Fatalf("cache: status %d, want 403", resp.StatusCode)
	}
	resp, _ = get(t, uc.url("/api/v1/session"))
	if resp.StatusCode != 403 {
		t.Fatalf("api: status %d, want 403", resp.StatusCode)
	}
	resp, _ = get(t, uc.url("/api/v1/health")) // health stays reachable
	if resp.StatusCode != 200 {
		t.Fatalf("health: status %d", resp.StatusCode)
	}
	// X-Forwarded-For from an untrusted peer must not grant access.
	resp, _ = get(t, uc.url("/apt/debian/pool/ok.deb"), "X-Forwarded-For", "10.9.9.5")
	if resp.StatusCode != 403 {
		t.Fatalf("spoofed X-Forwarded-For accepted: status %d", resp.StatusCode)
	}
	if up.count("/pool/ok.deb") != 0 {
		t.Fatal("denied client caused an upstream request")
	}
}

func TestSSRFProtectionBlocksPrivateUpstreams(t *testing.T) {
	up := newUpstream(t) // listens on 127.0.0.1
	up.put("/pool/ok.deb", []byte("internal service data"))
	uc := start(t, func(c *config.Config) { c.Security.AllowPrivateUpstreams = false }, up)
	resp, body := get(t, uc.url("/apt/debian/pool/ok.deb"))
	if resp.StatusCode != http.StatusBadGateway || bytes.Contains(body, []byte("internal service data")) {
		t.Fatalf("status %d, body %q", resp.StatusCode, truncate(body))
	}
	if up.count("/pool/ok.deb") != 0 {
		t.Fatal("connection to a loopback upstream was made")
	}
}

func TestSSRFProtectionAppliesToRedirects(t *testing.T) {
	internal := newUpstream(t)
	internal.put("/admin", []byte("internal admin page"))
	// "Public" mirror that redirects to an internal address. Since both
	// mocks are on loopback, allow only the first hop via a custom check:
	// here we verify the redirect target is re-validated by pointing the
	// redirect at a link-local address, which must be refused even when
	// private upstreams are forbidden.
	redirector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, internal.URL+"/admin", http.StatusFound)
	}))
	defer redirector.Close()
	uc := start(t, func(c *config.Config) {
		c.Security.AllowPrivateUpstreams = false
		c.Modules["apt"] = config.Module{Enabled: true, Repositories: []config.Repository{{Name: "debian", Upstreams: []string{redirector.URL}}}}
	})
	resp, body := get(t, uc.url("/apt/debian/pool/x.deb"))
	if resp.StatusCode != http.StatusBadGateway || bytes.Contains(body, []byte("internal admin page")) {
		t.Fatalf("status %d, body %q", resp.StatusCode, truncate(body))
	}
	if internal.count("/admin") != 0 {
		t.Fatal("redirect to an internal address was followed")
	}
}

func TestGenericAdapterHonoursCacheHeaders(t *testing.T) {
	var hits atomic.Int32
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		if r.Header.Get("Authorization") != "" || r.Header.Get("Cookie") != "" {
			t.Error("client credentials were forwarded upstream")
		}
		switch r.URL.Path {
		case "/public":
			w.Header().Set("Cache-Control", "public, max-age=3600")
		case "/private":
			w.Header().Set("Cache-Control", "private, max-age=3600")
		case "/nostore":
			w.Header().Set("Cache-Control", "no-store")
		case "/cookie":
			w.Header().Set("Set-Cookie", "id=1")
			w.Header().Set("Cache-Control", "max-age=3600")
		case "/vary":
			w.Header().Set("Vary", "User-Agent")
			w.Header().Set("Cache-Control", "max-age=3600")
		}
		fmt.Fprint(w, "body of ", r.URL.Path)
	}))
	defer up.Close()
	uc := start(t, func(c *config.Config) {
		c.Modules["generic"] = config.Module{Enabled: true, Repositories: []config.Repository{{Name: "files", Upstreams: []string{up.URL}}}}
	})
	for path, cacheable := range map[string]bool{"/public": true, "/private": false, "/nostore": false, "/cookie": false, "/vary": false} {
		before := hits.Load()
		for i := 0; i < 2; i++ {
			resp, body := get(t, uc.url("/generic/files"+path))
			if resp.StatusCode != 200 || string(body) != "body of "+path {
				t.Fatalf("%s: status %d body %q", path, resp.StatusCode, body)
			}
			time.Sleep(50 * time.Millisecond)
		}
		got := hits.Load() - before
		if cacheable && got != 1 {
			t.Errorf("%s: %d upstream requests, want 1 (cacheable)", path, got)
		}
		if !cacheable && got != 2 {
			t.Errorf("%s: %d upstream requests, want 2 (must not be cached)", path, got)
		}
	}
	before := hits.Load()
	resp, _ := get(t, uc.url("/generic/files/public"), "Authorization", "Bearer secret")
	if resp.StatusCode != 403 {
		t.Fatalf("authenticated request: status %d, want 403", resp.StatusCode)
	}
	resp, _ = get(t, uc.url("/generic/files/public"), "Cookie", "session=abc")
	if resp.StatusCode != 403 || hits.Load() != before {
		t.Fatalf("request with cookie: status %d", resp.StatusCode)
	}
}

func TestInterruptedUpstreamAbortsClientAndCachesNothing(t *testing.T) {
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Chunked response (no Content-Length) that dies half way: the
		// most dangerous case, because a clean end would look complete.
		w.Write(bytes.Repeat([]byte("x"), 10000))
		w.(http.Flusher).Flush()
		panic(http.ErrAbortHandler)
	}))
	defer up.Close()
	uc := start(t, func(c *config.Config) {
		c.Download.Resume = false
		c.Modules["apt"] = config.Module{Enabled: true, Repositories: []config.Repository{{Name: "debian", Upstreams: []string{up.URL}}}}
	})
	resp, err := http.Get(uc.url("/apt/debian/pool/broken.deb"))
	if err == nil {
		_, err = io.ReadAll(resp.Body)
		resp.Body.Close()
	}
	if err == nil {
		t.Fatal("client received a truncated file as if it were complete")
	}
	time.Sleep(50 * time.Millisecond)
	u, _ := uc.Store.Usage(context.Background())
	if u.BlobCount != 0 || u.EntryCount != 0 {
		t.Fatalf("truncated object was cached: %+v", u)
	}
	if d, _ := os.ReadDir(filepath.Join(uc.cfg.Storage.Path, "temp")); len(d) != 0 {
		t.Fatalf("%d temp files left", len(d))
	}
}

func TestRestartKeepsCache(t *testing.T) {
	up := newUpstream(t)
	data := randBytes(30_000)
	up.put("/pool/persist.deb", data)
	dir := t.TempDir()
	mut := func(c *config.Config) {
		c.Storage.Path = dir
		c.Database.Path = filepath.Join(dir, "metadata.db")
	}
	first := start(t, mut, up)
	get(t, first.url("/apt/debian/pool/persist.deb"))
	get(t, first.url("/apt/debian/pool/persist.deb"))
	first.srv.Close()
	if err := first.Close(); err != nil {
		t.Fatal(err)
	}

	second := start(t, mut, up)
	resp, body := get(t, second.url("/apt/debian/pool/persist.deb"))
	expect(t, resp, body, 200, "HIT", data)
	if up.count("/pool/persist.deb") != 1 {
		t.Fatal("object downloaded again after restart")
	}
	all, _ := second.Stats.Totals()
	if all.Misses != 1 || all.Hits != 2 {
		t.Fatalf("statistics not persisted across restart: %+v", all)
	}
}

// --- management API ---------------------------------------------------

type apiClient struct {
	t    *testing.T
	base string
	c    *http.Client
	csrf string
}

func newAPIClient(t *testing.T, base string) *apiClient {
	jar, _ := cookiejar.New(nil)
	return &apiClient{t: t, base: base, c: &http.Client{Jar: jar}}
}

func (a *apiClient) do(method, path string, body any, out any) int {
	a.t.Helper()
	var rd io.Reader
	if body != nil {
		if s, ok := body.(string); ok {
			rd = strings.NewReader(s)
		} else {
			b, _ := json.Marshal(body)
			rd = bytes.NewReader(b)
		}
	}
	req, _ := http.NewRequest(method, a.base+path, rd)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if a.csrf != "" {
		req.Header.Set("X-CSRF-Token", a.csrf)
	}
	resp, err := a.c.Do(req)
	if err != nil {
		a.t.Fatal(err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if out != nil {
		if err := json.Unmarshal(raw, out); err != nil {
			a.t.Fatalf("%s %s: invalid JSON %q", method, path, truncate(raw))
		}
	}
	return resp.StatusCode
}

func (a *apiClient) login(user, pw string) int {
	var out struct {
		CSRF string `json:"csrf"`
	}
	code := a.do("POST", "/api/v1/login", map[string]string{"username": user, "password": pw}, &out)
	a.csrf = out.CSRF
	return code
}

func TestAPIAuthenticationAndCSRF(t *testing.T) {
	uc := start(t, nil, newUpstream(t))
	anon := newAPIClient(t, uc.srv.URL)
	for _, p := range []string{"/api/v1/system", "/api/v1/stats", "/api/v1/storage", "/api/v1/storage/blobs",
		"/api/v1/clients", "/api/v1/requests", "/api/v1/downloads", "/api/v1/repositories", "/api/v1/policies",
		"/api/v1/modules", "/api/v1/events", "/api/v1/settings", "/api/v1/audit"} {
		if code := anon.do("GET", p, nil, nil); code != 401 {
			t.Errorf("unauthenticated GET %s: status %d, want 401", p, code)
		}
	}
	if code := anon.do("POST", "/api/v1/modules/apt/disable", nil, nil); code != 401 {
		t.Errorf("unauthenticated POST: status %d", code)
	}
	if code := anon.login("admin", "wrong password!"); code != 401 {
		t.Fatalf("wrong password: status %d", code)
	}
	if code := anon.login("nobody", "correct horse battery"); code != 401 {
		t.Fatalf("unknown user: status %d", code)
	}

	c := newAPIClient(t, uc.srv.URL)
	if code := c.login("admin", "correct horse battery"); code != 200 || c.csrf == "" {
		t.Fatalf("login: status %d", code)
	}
	if code := c.do("GET", "/api/v1/system", nil, nil); code != 200 {
		t.Fatalf("authenticated GET: status %d", code)
	}
	// State-changing request without the CSRF header is refused.
	token := c.csrf
	c.csrf = ""
	if code := c.do("POST", "/api/v1/modules/apt/disable", nil, nil); code != 403 {
		t.Fatalf("missing CSRF token: status %d, want 403", code)
	}
	c.csrf = "forged"
	if code := c.do("POST", "/api/v1/modules/apt/disable", nil, nil); code != 403 {
		t.Fatalf("forged CSRF token: status %d, want 403", code)
	}
	if !uc.Modules.Enabled("apt") {
		t.Fatal("module was disabled without a valid CSRF token")
	}
	c.csrf = token
	if code := c.do("POST", "/api/v1/modules/apt/disable", nil, nil); code != 200 || uc.Modules.Enabled("apt") {
		t.Fatalf("disable: status %d", code)
	}
	if code := c.do("POST", "/api/v1/modules/nope/enable", nil, nil); code != 404 {
		t.Fatalf("unknown module: status %d", code)
	}
	// Session cookie is HttpOnly + SameSite=Strict and not stored in clear.
	var raw string
	uc.DB.R.QueryRow(`SELECT token_hash FROM sessions LIMIT 1`).Scan(&raw)
	for _, ck := range c.c.Jar.Cookies(mustURL(uc.srv.URL)) {
		if ck.Value == raw {
			t.Fatal("session token stored unhashed")
		}
	}
	// Logout invalidates the session.
	if code := c.do("POST", "/api/v1/logout", nil, nil); code != 200 {
		t.Fatalf("logout: status %d", code)
	}
	if code := c.do("GET", "/api/v1/system", nil, nil); code != 401 {
		t.Fatalf("after logout: status %d, want 401", code)
	}
	// Audit trail exists and contains no password.
	var n int
	uc.DB.R.QueryRow(`SELECT COUNT(*) FROM audit_log WHERE action IN ('login','login_failed','module_disabled')`).Scan(&n)
	if n < 4 {
		t.Fatalf("only %d audit records", n)
	}
	uc.DB.R.QueryRow(`SELECT COUNT(*) FROM audit_log WHERE detail LIKE '%horse%' OR detail LIKE '%wrong password%'`).Scan(&n)
	if n != 0 {
		t.Fatal("a password leaked into the audit log")
	}
}

func TestAPILoginRateLimit(t *testing.T) {
	uc := start(t, nil, newUpstream(t))
	c := newAPIClient(t, uc.srv.URL)
	last := 0
	for i := 0; i < 12; i++ {
		last = c.login("admin", "guess number "+strconv.Itoa(i))
	}
	if last != 429 {
		t.Fatalf("12th failed login: status %d, want 429", last)
	}
	if code := c.login("admin", "correct horse battery"); code != 429 {
		t.Fatalf("login during lockout: status %d, want 429", code)
	}
}

func TestAPISetupWizard(t *testing.T) {
	uc := start(t, func(c *config.Config) { c.Security.AdminPassword = "" }, newUpstream(t))
	c := newAPIClient(t, uc.srv.URL)
	var sess struct {
		SetupRequired bool `json:"setup_required"`
		TokenRequired bool `json:"setup_token_required"`
	}
	c.do("GET", "/api/v1/session", nil, &sess)
	if !sess.SetupRequired || !sess.TokenRequired {
		t.Fatalf("session = %+v", sess)
	}
	tokenFile := filepath.Join(uc.cfg.Storage.Path, "setup-token")
	raw, err := os.ReadFile(tokenFile)
	if err != nil {
		t.Fatal(err)
	}
	if st, _ := os.Stat(tokenFile); st.Mode().Perm() != 0o600 {
		t.Fatalf("setup token file mode %v", st.Mode().Perm())
	}
	token := strings.TrimSpace(string(raw))
	body := func(tok, pw string) map[string]string {
		return map[string]string{"username": "owner", "password": pw, "token": tok}
	}
	if code := c.do("POST", "/api/v1/setup", body("wrong", "a long enough password"), nil); code != 403 {
		t.Fatalf("wrong token: status %d", code)
	}
	if code := c.do("POST", "/api/v1/setup", body(token, "short"), nil); code != 400 {
		t.Fatalf("weak password: status %d", code)
	}
	var out struct {
		CSRF string `json:"csrf"`
	}
	if code := c.do("POST", "/api/v1/setup", body(token, "a long enough password"), &out); code != 200 || out.CSRF == "" {
		t.Fatalf("setup: status %d", code)
	}
	if code := c.do("GET", "/api/v1/system", nil, nil); code != 200 {
		t.Fatalf("not logged in after setup: %d", code)
	}
	// Setup cannot be repeated to take over the installation.
	other := newAPIClient(t, uc.srv.URL)
	if code := other.do("POST", "/api/v1/setup", map[string]string{"username": "evil", "password": "another long password", "token": token}, nil); code != 400 {
		t.Fatalf("second setup: status %d, want 400", code)
	}
}

func TestAPIRepositoriesAndValidation(t *testing.T) {
	up := newUpstream(t)
	up.put("/pool/x.deb", []byte("x"))
	uc := start(t, nil, up)
	c := newAPIClient(t, uc.srv.URL)
	c.login("admin", "correct horse battery")

	bad := []any{
		`{"module":"apt","name":"new","upstreams":["ftp://mirror.example/debian"]}`,
		`{"module":"apt","name":"new","upstreams":["file:///etc/passwd"]}`,
		`{"module":"apt","name":"new","upstreams":["http://user:pw@mirror.example/"]}`,
		`{"module":"apt","name":"new","upstreams":["http://mirror.example/?a=b"]}`,
		`{"module":"apt","name":"new","upstreams":[]}`,
		`{"module":"apt","name":"../evil","upstreams":["http://mirror.example"]}`,
		`{"module":"apt","name":"UPPER","upstreams":["http://mirror.example"]}`,
		`{"module":"nope","name":"new","upstreams":["http://mirror.example"]}`,
		`{"module":"apt","name":"new","upstreams":["http://mirror.example"],"extra":1}`,
		`{"module":"apt","name":"new"`,
		`[]`,
	}
	for _, b := range bad {
		if code := c.do("POST", "/api/v1/repositories", b, nil); code != 400 {
			t.Errorf("POST %v: status %d, want 400", b, code)
		}
	}
	var repo struct {
		ID int64 `json:"id"`
	}
	create := map[string]any{"module": "apt", "name": "mirror2", "upstreams": []string{up.URL}}
	if code := c.do("POST", "/api/v1/repositories", create, &repo); code != 201 || repo.ID == 0 {
		t.Fatalf("create: status %d", code)
	}
	if code := c.do("POST", "/api/v1/repositories", create, nil); code != 409 {
		t.Fatalf("duplicate: status %d, want 409", code)
	}
	resp, body := get(t, uc.url("/apt/mirror2/pool/x.deb"))
	expect(t, resp, body, 200, "MISS", []byte("x"))

	// Oversized bodies are rejected.
	huge := `{"module":"apt","name":"big","upstreams":["http://m.example/` + strings.Repeat("a", 200_000) + `"]}`
	if code := c.do("POST", "/api/v1/repositories", huge, nil); code != 400 {
		t.Errorf("oversized body: status %d, want 400", code)
	}

	// Deleting the repository releases its cached objects.
	var del struct {
		Released int64 `json:"entries_released"`
	}
	if code := c.do("DELETE", fmt.Sprintf("/api/v1/repositories/%d", repo.ID), nil, &del); code != 200 || del.Released != 1 {
		t.Fatalf("delete: status %d, released %d", code, del.Released)
	}
	if code := c.do("DELETE", fmt.Sprintf("/api/v1/repositories/%d", repo.ID), nil, nil); code != 404 {
		t.Fatalf("second delete: status %d", code)
	}
	resp, _ = get(t, uc.url("/apt/mirror2/pool/x.deb"))
	if resp.StatusCode != 404 {
		t.Fatalf("deleted repository still served: %d", resp.StatusCode)
	}
	var gc struct {
		GC struct {
			BlobsRemoved int64 `json:"blobs_removed"`
		} `json:"gc"`
	}
	if code := c.do("POST", "/api/v1/storage/gc", nil, &gc); code != 200 || gc.GC.BlobsRemoved != 1 {
		t.Fatalf("gc: status %d, removed %d", code, gc.GC.BlobsRemoved)
	}
}

func TestAPIStatsStorageAndPolicies(t *testing.T) {
	up := newUpstream(t)
	data := randBytes(10_000)
	up.put("/pool/s.deb", data)
	uc := start(t, nil, up)
	get(t, uc.url("/apt/debian/pool/s.deb"))
	get(t, uc.url("/apt/debian/pool/s.deb"))
	c := newAPIClient(t, uc.srv.URL)
	c.login("admin", "correct horse battery")

	var st struct {
		Totals     stats.Counters `json:"totals"`
		HitRatio   float64        `json:"hit_ratio"`
		BytesSaved int64          `json:"bytes_saved"`
		Storage    struct {
			BlobCount int64 `json:"blob_count"`
			BlobBytes int64 `json:"blob_bytes"`
		} `json:"storage"`
	}
	if code := c.do("GET", "/api/v1/stats", nil, &st); code != 200 {
		t.Fatal(code)
	}
	if st.Totals.Hits != 1 || st.Totals.Misses != 1 || st.HitRatio != 0.5 || st.BytesSaved != 10_000 ||
		st.Storage.BlobCount != 1 || st.Storage.BlobBytes != 10_000 {
		t.Fatalf("stats = %+v", st)
	}
	var reqs struct {
		Requests []stats.Record `json:"requests"`
	}
	c.do("GET", "/api/v1/requests?status=hit", nil, &reqs)
	if len(reqs.Requests) != 1 || reqs.Requests[0].Result != stats.Hit || reqs.Requests[0].Bytes != 10_000 ||
		reqs.Requests[0].Client != "127.0.0.1" || reqs.Requests[0].Path != "pool/s.deb" {
		t.Fatalf("requests = %+v", reqs.Requests)
	}
	var hist struct {
		Points []stats.HistoryPoint `json:"points"`
	}
	c.do("GET", "/api/v1/stats/history?range=1h", nil, &hist)
	if len(hist.Points) == 0 || hist.Points[len(hist.Points)-1].BytesUpstream != 10_000 {
		t.Fatalf("history = %+v", hist.Points)
	}
	var ents struct {
		Entries []struct {
			ID   int64  `json:"id"`
			Hash string `json:"hash"`
		} `json:"entries"`
		Total int64 `json:"total"`
	}
	c.do("GET", "/api/v1/storage/blobs", nil, &ents)
	if ents.Total != 1 || len(ents.Entries[0].Hash) != 64 {
		t.Fatalf("entries = %+v", ents)
	}
	id := ents.Entries[0].ID
	if code := c.do("POST", fmt.Sprintf("/api/v1/storage/entries/%d/pin", id), nil, nil); code != 200 {
		t.Fatalf("pin: %d", code)
	}
	if code := c.do("POST", "/api/v1/storage/entries/99999/pin", nil, nil); code != 404 {
		t.Fatalf("pin unknown: %d", code)
	}
	if code := c.do("POST", "/api/v1/storage/entries/abc/pin", nil, nil); code != 400 {
		t.Fatalf("pin invalid id: %d", code)
	}
	var ver struct {
		Checked int64 `json:"checked"`
		Corrupt int64 `json:"corrupt"`
	}
	if code := c.do("POST", "/api/v1/storage/verify", nil, &ver); code != 200 || ver.Checked != 1 || ver.Corrupt != 0 {
		t.Fatalf("verify: %d %+v", code, ver)
	}

	// Policies: validation and live effect.
	for _, b := range []string{
		`{"metadata_ttl_seconds":-1,"negative_ttl_seconds":0,"serve_stale_on_error":true,"module_ttl_seconds":{}}`,
		`{"metadata_ttl_seconds":60,"negative_ttl_seconds":99999,"serve_stale_on_error":true,"module_ttl_seconds":{}}`,
		`{"metadata_ttl_seconds":60,"negative_ttl_seconds":0,"serve_stale_on_error":true,"module_ttl_seconds":{"nope":5}}`,
	} {
		if code := c.do("PUT", "/api/v1/policies", b, nil); code != 400 {
			t.Errorf("PUT policies %s: status %d, want 400", b, code)
		}
	}
	ok := `{"metadata_ttl_seconds":120,"negative_ttl_seconds":5,"serve_stale_on_error":false,"module_ttl_seconds":{"pacman":30}}`
	if code := c.do("PUT", "/api/v1/policies", ok, nil); code != 200 {
		t.Fatalf("PUT policies: %d", code)
	}
	p := uc.Proxy.Policy()
	if p.MetadataTTL != 2*time.Minute || p.ModuleTTL["pacman"] != 30*time.Second || p.ServeStaleOnError {
		t.Fatalf("policy not applied: %+v", p)
	}
	var mods struct {
		Modules []struct {
			Info struct {
				Name string `json:"name"`
			} `json:"info"`
			Enabled      bool `json:"enabled"`
			Repositories []struct {
				ClientConfig string `json:"client_config"`
			} `json:"repositories"`
		} `json:"modules"`
	}
	c.do("GET", "/api/v1/modules", nil, &mods)
	if len(mods.Modules) != 3 || mods.Modules[0].Info.Name != "apt" ||
		!strings.Contains(mods.Modules[0].Repositories[0].ClientConfig, uc.srv.URL+"/apt/debian") {
		t.Fatalf("modules = %+v", mods)
	}
	var test struct {
		Results []struct {
			OK bool `json:"ok"`
		} `json:"results"`
	}
	if code := c.do("POST", "/api/v1/modules/apt/test", nil, &test); code != 200 || len(test.Results) != 1 || !test.Results[0].OK {
		t.Fatalf("module test: %d %+v", code, test)
	}
}

func TestSSEStreamDeliversRequests(t *testing.T) {
	up := newUpstream(t)
	up.put("/pool/e.deb", []byte("event"))
	uc := start(t, nil, up)
	c := newAPIClient(t, uc.srv.URL)
	c.login("admin", "correct horse battery")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, "GET", uc.url("/api/v1/events"), nil)
	resp, err := c.c.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if ct := resp.Header.Get("Content-Type"); ct != "text/event-stream" {
		t.Fatalf("Content-Type %q", ct)
	}
	got := make(chan string, 1)
	go func() {
		buf := make([]byte, 0, 8192)
		tmp := make([]byte, 1024)
		for {
			n, err := resp.Body.Read(tmp)
			buf = append(buf, tmp[:n]...)
			if i := bytes.Index(buf, []byte("event: request\n")); i >= 0 && bytes.Contains(buf[i:], []byte("\n\n")) {
				got <- string(buf[i:])
				return
			}
			if err != nil {
				return
			}
		}
	}()
	time.Sleep(100 * time.Millisecond)
	get(t, uc.url("/apt/debian/pool/e.deb"))
	select {
	case ev := <-got:
		if !strings.Contains(ev, `"result":"MISS"`) || !strings.Contains(ev, `"path":"pool/e.deb"`) {
			t.Fatalf("unexpected event %q", ev)
		}
	case <-ctx.Done():
		t.Fatal("no request event received over SSE")
	}
}

// TestStorageLimitIsEnforcedAutomatically: downloading more than max_size
// allows triggers eviction on its own (no waiting for the periodic job), the
// least recently used packages go first, and an evicted package is simply
// fetched again.
func TestStorageLimitIsEnforcedAutomatically(t *testing.T) {
	up := newUpstream(t)
	for i := 0; i < 6; i++ {
		up.put(fmt.Sprintf("/pool/p%d.deb", i), randBytes(10_000))
	}
	uc := start(t, func(c *config.Config) { c.Storage.MaxSize = 35_000 }, up)
	for i := 0; i < 3; i++ {
		get(t, uc.url(fmt.Sprintf("/apt/debian/pool/p%d.deb", i)))
	}
	// Make the LRU order unambiguous (access times have 1 s resolution).
	uc.DB.W.Exec(`UPDATE entries SET last_access = last_access - 1000 + id`)
	for i := 3; i < 6; i++ {
		get(t, uc.url(fmt.Sprintf("/apt/debian/pool/p%d.deb", i)))
	}
	deadline := time.Now().Add(10 * time.Second)
	for {
		u, err := uc.Store.Usage(context.Background())
		if err != nil {
			t.Fatal(err)
		}
		if u.BlobBytes <= 35_000 {
			if u.BlobBytes != 30_000 {
				t.Fatalf("evicted too much: %d bytes left", u.BlobBytes)
			}
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("limit not enforced: %d bytes stored, limit 35000", u.BlobBytes)
		}
		time.Sleep(10 * time.Millisecond)
	}
	resp, _ := get(t, uc.url("/apt/debian/pool/p5.deb"))
	if resp.Header.Get("X-Cache") != "HIT" {
		t.Fatal("most recently used object was evicted")
	}
	resp, body := get(t, uc.url("/apt/debian/pool/p0.deb"))
	if resp.StatusCode != 200 || resp.Header.Get("X-Cache") != "MISS" || len(body) != 10_000 {
		t.Fatalf("evicted object: status %d, X-Cache %q", resp.StatusCode, resp.Header.Get("X-Cache"))
	}
}

// TestCachedContentCannotAttackTheDashboard: a (malicious or compromised)
// upstream serving HTML must not get script execution in the origin of the
// management interface.
func TestCachedContentCannotAttackTheDashboard(t *testing.T) {
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		w.Header().Set("Cache-Control", "max-age=3600")
		fmt.Fprint(w, "<script>fetch('/api/v1/session')</script>")
	}))
	defer up.Close()
	uc := start(t, func(c *config.Config) {
		c.Modules["generic"] = config.Module{Enabled: true, Repositories: []config.Repository{{Name: "files", Upstreams: []string{up.URL}}}}
		c.Modules["apt"] = config.Module{Enabled: true, Repositories: []config.Repository{{Name: "debian", Upstreams: []string{up.URL}}}}
	})
	for _, path := range []string{"/generic/files/evil.html", "/generic/files/evil.html", "/apt/debian/dists/x/evil.html", "/apt/debian/missing/../x"} {
		resp, _ := get(t, uc.url(path))
		if csp := resp.Header.Get("Content-Security-Policy"); !strings.Contains(csp, "sandbox") {
			t.Errorf("%s (X-Cache %q): Content-Security-Policy = %q, want sandbox", path, resp.Header.Get("X-Cache"), csp)
		}
		if resp.Header.Get("X-Content-Type-Options") != "nosniff" {
			t.Errorf("%s: nosniff missing", path)
		}
	}
	// The dashboard itself is not sandboxed but has a strict policy.
	resp, _ := get(t, uc.url("/"))
	if csp := resp.Header.Get("Content-Security-Policy"); !strings.Contains(csp, "default-src 'self'") || strings.Contains(csp, "sandbox") {
		t.Errorf("dashboard CSP = %q", csp)
	}
}
