package download_test

import (
	"bytes"
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Anarki-LNX/unicache/internal/download"
	"github.com/Anarki-LNX/unicache/internal/storage"
	"github.com/Anarki-LNX/unicache/internal/testutil"
)

func randBytes(n int) []byte {
	b := make([]byte, n)
	rand.Read(b)
	return b
}

type env struct {
	store *storage.Store
	mgr   *download.Manager
}

func newEnv(t *testing.T, mut func(*download.Options)) *env {
	t.Helper()
	s, _ := testutil.Store(t, storage.Options{})
	o := download.Options{
		Client: &http.Client{}, Store: s, MaxConcurrent: 4, Retries: 2,
		RetryBackoff: time.Millisecond, IdleTimeout: 5 * time.Second, Resume: true, Logger: testutil.Logger(),
	}
	if mut != nil {
		mut(&o)
	}
	m := download.NewManager(o)
	t.Cleanup(m.Close)
	return &env{store: s, mgr: m}
}

// publish stores the object under key and returns the entry as the flight value.
func (e *env) publish(key string) func(*storage.Writer, *download.Response) (any, error) {
	return func(w *storage.Writer, r *download.Response) (any, error) {
		return e.store.Publish(context.Background(), w, storage.Key{Module: "t", Repo: "r", Path: key},
			storage.Meta{Immutable: true, ETag: r.Header.Get("ETag")})
	}
}

func (e *env) req(key string, urls ...string) download.Request {
	return download.Request{Key: "t/r/" + key, Module: "t", URLs: urls, Publish: e.publish(key)}
}

func tempFiles(t *testing.T, s *storage.Store) int {
	t.Helper()
	d, err := os.ReadDir(filepath.Join(s.Root(), "temp"))
	if err != nil {
		t.Fatal(err)
	}
	return len(d)
}

var ctx = context.Background()

// TestSingleflight is the core guarantee: many simultaneous requests for an
// uncached object cause exactly one upstream download, and every client
// receives the complete, correct content.
func TestSingleflight(t *testing.T) {
	data := randBytes(2 << 20)
	var hits atomic.Int64
	release := make(chan struct{})
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		w.Header().Set("Content-Length", strconv.Itoa(len(data)))
		w.Write(data[:1024])
		w.(http.Flusher).Flush()
		<-release // hold the transfer open until all clients have joined
		w.Write(data[1024:])
	}))
	defer up.Close()
	e := newEnv(t, nil)

	const clients = 10
	var wg sync.WaitGroup
	var joinedN atomic.Int64
	ready := make(chan struct{}, clients)
	for i := 0; i < clients; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			f, joined := e.mgr.Do(e.req("big.bin", up.URL+"/big.bin"), nil)
			if joined {
				joinedN.Add(1)
			}
			resp, err := f.Header(ctx)
			if err != nil || resp.Status != 200 {
				t.Errorf("header: %v %v", resp, err)
				ready <- struct{}{}
				return
			}
			body, err := f.Reader(ctx)
			if err != nil {
				t.Error(err)
				ready <- struct{}{}
				return
			}
			defer body.Close()
			// Streaming: the first bytes arrive while upstream is still
			// holding back the rest of the file.
			first := make([]byte, 1024)
			if _, err := io.ReadFull(body, first); err != nil || !bytes.Equal(first, data[:1024]) {
				t.Errorf("first bytes not streamed: %v", err)
			}
			ready <- struct{}{}
			rest, err := io.ReadAll(body)
			if err != nil || !bytes.Equal(rest, data[1024:]) {
				t.Errorf("client got wrong content (err %v, %d bytes)", err, len(rest))
			}
			if _, err := f.Wait(ctx); err != nil {
				t.Errorf("wait: %v", err)
			}
		}()
	}
	for i := 0; i < clients; i++ {
		<-ready // every client has received data before the download finished
	}
	close(release)
	wg.Wait()
	if n := hits.Load(); n != 1 {
		t.Fatalf("upstream was contacted %d times, want exactly 1", n)
	}
	if n := joinedN.Load(); n != clients-1 {
		_ = n
		t.Fatalf("%d clients joined the flight, want %d", n, clients-1)
	}
	ent, err := e.store.Lookup(ctx, storage.Key{Module: "t", Repo: "r", Path: "big.bin"})
	if err != nil || ent.Size != int64(len(data)) {
		t.Fatalf("object not published: %v", err)
	}
	if n := tempFiles(t, e.store); n != 0 {
		t.Fatalf("%d temp files left", n)
	}
	if len(e.mgr.Active()) != 0 {
		t.Fatal("flight still registered")
	}
}

// TestPrecheckClosesTheLateArrivalRace: a request arriving after a flight
// ended must not start a second download when the object is cached by then.
func TestPrecheckClosesTheLateArrivalRace(t *testing.T) {
	var hits atomic.Int64
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		w.Write([]byte("payload"))
	}))
	defer up.Close()
	e := newEnv(t, nil)
	cached := func() bool {
		_, err := e.store.Lookup(ctx, storage.Key{Module: "t", Repo: "r", Path: "o"})
		return err == nil
	}
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if cached() {
				return
			}
			f, _ := e.mgr.Do(e.req("o", up.URL+"/o"), cached)
			if f == nil {
				return // precheck found it in the cache
			}
			if _, err := f.Wait(ctx); err != nil {
				t.Error(err)
			}
		}()
		if i%10 == 0 {
			time.Sleep(time.Millisecond)
		}
	}
	wg.Wait()
	if n := hits.Load(); n != 1 {
		t.Fatalf("upstream contacted %d times, want 1", n)
	}
}

// flaky serves data but cuts the connection after cut bytes on the first
// `failures` requests. It supports Range/If-Range like a real mirror.
type flaky struct {
	data     []byte
	etag     string
	cut      int
	failures int32
	requests atomic.Int32
	ranges   atomic.Int32
	noRange  bool
}

func (f *flaky) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	n := f.requests.Add(1)
	start := 0
	if rg := r.Header.Get("Range"); rg != "" && !f.noRange && r.Header.Get("If-Range") == f.etag {
		fmt.Sscanf(rg, "bytes=%d-", &start)
		f.ranges.Add(1)
		w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, len(f.data)-1, len(f.data)))
		w.Header().Set("Content-Length", strconv.Itoa(len(f.data)-start))
		w.Header().Set("ETag", f.etag)
		w.WriteHeader(http.StatusPartialContent)
	} else {
		w.Header().Set("Content-Length", strconv.Itoa(len(f.data)))
		w.Header().Set("ETag", f.etag)
	}
	if n <= f.failures {
		end := start + f.cut
		if end > len(f.data) {
			end = len(f.data)
		}
		w.Write(f.data[start:end])
		w.(http.Flusher).Flush()
		panic(http.ErrAbortHandler) // drop the connection mid-body
	}
	w.Write(f.data[start:])
}

func TestResumeAfterInterruptedTransfer(t *testing.T) {
	fl := &flaky{data: randBytes(300_000), etag: `"v1"`, cut: 100_000, failures: 2}
	up := httptest.NewServer(fl)
	defer up.Close()
	e := newEnv(t, nil)
	f, _ := e.mgr.Do(e.req("f", up.URL+"/f"), nil)
	if _, err := f.Header(ctx); err != nil {
		t.Fatal(err)
	}
	body, err := f.Reader(ctx)
	if err != nil {
		t.Fatal(err)
	}
	got, err := io.ReadAll(body)
	body.Close()
	if err != nil || !bytes.Equal(got, fl.data) {
		t.Fatalf("resumed stream is wrong: err %v, %d of %d bytes", err, len(got), len(fl.data))
	}
	v, err := f.Wait(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if fl.ranges.Load() != 2 || fl.requests.Load() != 3 {
		t.Fatalf("requests=%d ranges=%d, want 3 and 2", fl.requests.Load(), fl.ranges.Load())
	}
	// The stored blob is hash-identical to the original despite two breaks.
	ent := v.(*storage.Entry)
	file, _ := e.store.Open(ent)
	stored, _ := io.ReadAll(file)
	file.Close()
	if !bytes.Equal(stored, fl.data) {
		t.Fatal("stored object differs from upstream content")
	}
}

func TestInterruptedTransferWithoutResumeFailsAndPublishesNothing(t *testing.T) {
	fl := &flaky{data: randBytes(200_000), etag: `"v1"`, cut: 50_000, failures: 99, noRange: true}
	up := httptest.NewServer(fl)
	defer up.Close()
	e := newEnv(t, nil)
	f, _ := e.mgr.Do(e.req("f", up.URL+"/f"), nil)
	if _, err := f.Header(ctx); err != nil {
		t.Fatal(err)
	}
	body, _ := f.Reader(ctx)
	_, rerr := io.ReadAll(body)
	body.Close()
	if rerr == nil {
		t.Fatal("client was not told about the truncated transfer")
	}
	if _, err := f.Wait(ctx); err == nil {
		t.Fatal("flight reported success for a truncated object")
	}
	if _, err := e.store.Lookup(ctx, storage.Key{Module: "t", Repo: "r", Path: "f"}); !errors.Is(err, storage.ErrNotFound) {
		t.Fatal("partial object was published")
	}
	if n := tempFiles(t, e.store); n != 0 {
		t.Fatalf("%d temp files left", n)
	}
}

func TestResumeRejectedWhenContentChanged(t *testing.T) {
	data := randBytes(100_000)
	var n atomic.Int32
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if n.Add(1) == 1 {
			w.Header().Set("ETag", `"old"`)
			w.Header().Set("Content-Length", strconv.Itoa(len(data)))
			w.Write(data[:10_000])
			w.(http.Flusher).Flush()
			panic(http.ErrAbortHandler)
		}
		// The file changed upstream: If-Range does not match, a full 200
		// with different content comes back. It must not be glued on.
		w.Header().Set("ETag", `"new"`)
		w.Write(bytes.Repeat([]byte("N"), len(data)))
	}))
	defer up.Close()
	e := newEnv(t, nil)
	f, _ := e.mgr.Do(e.req("f", up.URL+"/f"), nil)
	if _, err := f.Wait(ctx); err == nil {
		t.Fatal("mixed old/new content was accepted")
	}
	if _, err := e.store.Lookup(ctx, storage.Key{Module: "t", Repo: "r", Path: "f"}); !errors.Is(err, storage.ErrNotFound) {
		t.Fatal("corrupt object was published")
	}
}

func TestShortBodyIsNotPublished(t *testing.T) {
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Length", "1000")
		w.Write([]byte("only a little"))
	}))
	defer up.Close()
	e := newEnv(t, func(o *download.Options) { o.Resume = false; o.Retries = 0 })
	f, _ := e.mgr.Do(e.req("f", up.URL+"/f"), nil)
	if _, err := f.Wait(ctx); err == nil {
		t.Fatal("short body accepted")
	}
	if _, err := e.store.Lookup(ctx, storage.Key{Module: "t", Repo: "r", Path: "f"}); !errors.Is(err, storage.ErrNotFound) {
		t.Fatal("short object was published")
	}
}

func TestMirrorFailover(t *testing.T) {
	dead := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "boom", http.StatusServiceUnavailable)
	}))
	defer dead.Close()
	behind := httptest.NewServer(http.NotFoundHandler()) // mirror that has not synced yet
	defer behind.Close()
	good := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("from the good mirror"))
	}))
	defer good.Close()
	e := newEnv(t, nil)
	f, _ := e.mgr.Do(e.req("f", dead.URL+"/f", behind.URL+"/f", good.URL+"/f"), nil)
	resp, err := f.Header(ctx)
	if err != nil || resp.Status != 200 || !strings.HasPrefix(resp.URL, good.URL) {
		t.Fatalf("resp = %+v, err %v", resp, err)
	}
	if _, err := f.Wait(ctx); err != nil {
		t.Fatal(err)
	}
}

func TestNotFoundOnAllMirrorsIsFinal(t *testing.T) {
	var hits atomic.Int32
	h := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { hits.Add(1); http.NotFound(w, r) })
	a, b := httptest.NewServer(h), httptest.NewServer(h)
	defer a.Close()
	defer b.Close()
	e := newEnv(t, nil)
	f, _ := e.mgr.Do(e.req("f", a.URL+"/f", b.URL+"/f"), nil)
	resp, err := f.Header(ctx)
	if err != nil || resp.Status != 404 {
		t.Fatalf("resp = %+v, err %v", resp, err)
	}
	if hits.Load() != 2 {
		t.Fatalf("%d upstream requests, want 2 (no retries for a definitive 404)", hits.Load())
	}
}

func TestServerErrorRetriesThenFails(t *testing.T) {
	var hits atomic.Int32
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		http.Error(w, "down", http.StatusBadGateway)
	}))
	defer up.Close()
	e := newEnv(t, nil) // Retries = 2
	f, _ := e.mgr.Do(e.req("f", up.URL+"/f"), nil)
	if _, err := f.Header(ctx); err == nil {
		t.Fatal("expected an error")
	}
	if hits.Load() != 3 {
		t.Fatalf("%d attempts, want 3", hits.Load())
	}
}

func TestRevalidationNotModified(t *testing.T) {
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("If-None-Match") == `"v1"` {
			w.WriteHeader(http.StatusNotModified)
			return
		}
		w.Write([]byte("body"))
	}))
	defer up.Close()
	e := newEnv(t, nil)
	req := e.req("f", up.URL+"/f")
	req.IfNoneMatch = `"v1"`
	published := false
	req.Publish = func(w *storage.Writer, r *download.Response) (any, error) {
		published = true
		w.Abort()
		return nil, nil
	}
	f, _ := e.mgr.Do(req, nil)
	resp, err := f.Header(ctx)
	if err != nil || resp.Status != 304 {
		t.Fatalf("resp = %+v, err %v", resp, err)
	}
	f.Wait(ctx)
	if published {
		t.Fatal("publish called for a 304")
	}
}

func TestMaxObjectSize(t *testing.T) {
	declared := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write(make([]byte, 5000))
	}))
	defer declared.Close()
	chunked := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for i := 0; i < 50; i++ { // no Content-Length
			w.Write(make([]byte, 100))
			w.(http.Flusher).Flush()
		}
	}))
	defer chunked.Close()
	e := newEnv(t, func(o *download.Options) { o.MaxObjectSize = 1000 })
	for name, u := range map[string]string{"declared": declared.URL, "chunked": chunked.URL} {
		f, _ := e.mgr.Do(e.req(name, u+"/f"), nil)
		if _, err := f.Wait(ctx); !errors.Is(err, download.ErrTooLarge) {
			t.Errorf("%s: err = %v, want ErrTooLarge", name, err)
		}
	}
	if n := tempFiles(t, e.store); n != 0 {
		t.Fatalf("%d temp files left", n)
	}
}

func TestCancelAndIdleTimeout(t *testing.T) {
	block := make(chan struct{})
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Length", "100000")
		w.Write([]byte("start"))
		w.(http.Flusher).Flush()
		select {
		case <-block:
		case <-r.Context().Done():
		}
	}))
	defer up.Close()
	defer close(block)

	e := newEnv(t, nil)
	f, _ := e.mgr.Do(e.req("cancel", up.URL+"/f"), nil)
	if _, err := f.Header(ctx); err != nil {
		t.Fatal(err)
	}
	if !e.mgr.Cancel(f.ID) {
		t.Fatal("cancel did not find the flight")
	}
	if _, err := f.Wait(ctx); !errors.Is(err, download.ErrCancelled) {
		t.Fatalf("err = %v, want ErrCancelled", err)
	}

	stalled := newEnv(t, func(o *download.Options) { o.IdleTimeout = 50 * time.Millisecond; o.Resume = false })
	f2, _ := stalled.mgr.Do(stalled.req("stall", up.URL+"/f"), nil)
	start := time.Now()
	if _, err := f2.Wait(ctx); err == nil || !strings.Contains(err.Error(), "stalled") {
		t.Fatalf("err = %v, want idle timeout", err)
	}
	if time.Since(start) > 3*time.Second {
		t.Fatal("idle timeout took too long")
	}
	if n := tempFiles(t, stalled.store); n != 0 {
		t.Fatalf("%d temp files left", n)
	}
}

func TestBoundedConcurrency(t *testing.T) {
	var cur, peak atomic.Int32
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := cur.Add(1)
		for {
			p := peak.Load()
			if n <= p || peak.CompareAndSwap(p, n) {
				break
			}
		}
		time.Sleep(20 * time.Millisecond)
		cur.Add(-1)
		w.Write([]byte(r.URL.Path))
	}))
	defer up.Close()
	e := newEnv(t, func(o *download.Options) { o.MaxConcurrent = 3 })
	var wg sync.WaitGroup
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			f, _ := e.mgr.Do(e.req(fmt.Sprint("o", i), fmt.Sprint(up.URL, "/o", i)), nil)
			if _, err := f.Wait(ctx); err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	if p := peak.Load(); p > 3 {
		t.Fatalf("peak upstream concurrency %d exceeds limit 3", p)
	}
}

func TestUpstreamBytesAreCounted(t *testing.T) {
	data := randBytes(70_000)
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write(data) }))
	defer up.Close()
	var counted atomic.Int64
	e := newEnv(t, func(o *download.Options) {
		o.OnUpstreamBytes = func(module string, n int64) { counted.Add(n) }
	})
	f, _ := e.mgr.Do(e.req("f", up.URL+"/f"), nil)
	if _, err := f.Wait(ctx); err != nil {
		t.Fatal(err)
	}
	if counted.Load() != int64(len(data)) {
		t.Fatalf("counted %d upstream bytes, want %d", counted.Load(), len(data))
	}
}

func TestLimiter(t *testing.T) {
	l := download.NewLimiter(100_000) // 100 kB/s, 1 s burst
	start := time.Now()
	for i := 0; i < 15; i++ {
		if err := l.Wait(ctx, 10_000); err != nil {
			t.Fatal(err)
		}
	}
	// 150 kB at 100 kB/s with a 100 kB burst needs roughly 0.5 s.
	if d := time.Since(start); d < 300*time.Millisecond || d > 2*time.Second {
		t.Fatalf("150 kB took %v", d)
	}
	cctx, cancel := context.WithCancel(ctx)
	cancel()
	if err := l.Wait(cctx, 1_000_000); err == nil {
		t.Fatal("cancelled wait returned nil")
	}
	if err := download.NewLimiter(0).Wait(ctx, 1<<30); err != nil {
		t.Fatal("unlimited limiter blocked")
	}
}

// TestQueuedFlightWithoutClientsIsAbandoned: when every client disconnects
// while its download is still waiting for a free slot, the download is not
// started at all.
func TestQueuedFlightWithoutClientsIsAbandoned(t *testing.T) {
	release := make(chan struct{})
	var hits atomic.Int32
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		if r.URL.Path == "/slow" {
			<-release
		}
		w.Write([]byte("data"))
	}))
	defer up.Close()
	e := newEnv(t, func(o *download.Options) { o.MaxConcurrent = 1 })
	slow, _ := e.mgr.Do(e.req("slow", up.URL+"/slow"), nil)
	for hits.Load() == 0 {
		time.Sleep(time.Millisecond)
	}
	queued, _ := e.mgr.Do(e.req("queued", up.URL+"/queued"), nil)
	kept, _ := e.mgr.Do(e.req("kept", up.URL+"/kept"), nil)
	queued.Leave() // its only client goes away
	close(release)
	if _, err := slow.Wait(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := queued.Wait(ctx); !errors.Is(err, download.ErrCancelled) {
		t.Fatalf("abandoned flight: err = %v, want ErrCancelled", err)
	}
	if _, err := kept.Wait(ctx); err != nil {
		t.Fatal(err)
	}
	if hits.Load() != 2 {
		t.Fatalf("%d upstream requests, want 2 (the abandoned one must not start)", hits.Load())
	}
}

// TestLateReaderOfUncachedObject: a client that only gets to read after the
// flight finished still receives the body, even when the object was not
// stored (regression test).
func TestLateReaderOfUncachedObject(t *testing.T) {
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("not stored")) }))
	defer up.Close()
	e := newEnv(t, nil)
	req := e.req("f", up.URL+"/f")
	req.Publish = func(w *storage.Writer, r *download.Response) (any, error) { w.Abort(); return nil, nil }
	f, _ := e.mgr.Do(req, nil)
	if _, err := f.Wait(ctx); err != nil { // completely finished, temp file unlinked
		t.Fatal(err)
	}
	body, err := f.Reader(ctx)
	if err != nil {
		t.Fatal(err)
	}
	got, err := io.ReadAll(body)
	if err != nil || string(got) != "not stored" {
		t.Fatalf("late reader got %q, %v", got, err)
	}
	f.Leave()
	if _, err := f.Reader(ctx); err == nil {
		t.Fatal("reader after the last client left must fail")
	}
}
