// Package proxy is the HTTP caching engine shared by all path-based
// adapters. It resolves a request to an adapter and repository, serves it
// from the shared storage when possible and otherwise through the download
// manager, and accounts every request in the statistics.
package proxy

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Anarki-LNX/unicache/internal/adapters"
	"github.com/Anarki-LNX/unicache/internal/core"
	"github.com/Anarki-LNX/unicache/internal/download"
	"github.com/Anarki-LNX/unicache/internal/security"
	"github.com/Anarki-LNX/unicache/internal/stats"
	"github.com/Anarki-LNX/unicache/internal/storage"
)

// Options configure the proxy handler.
type Options struct {
	Store   *storage.Store
	DL      *download.Manager
	Modules *core.Modules
	Stats   *stats.Collector
	Clients *security.ACL // who may use the cache
	Trusted *security.ACL // reverse proxies whose X-Forwarded-For is honoured
	Logger  *slog.Logger

	Policy          Policy
	ClientRateLimit int64 // bytes per second per response, 0 = unlimited
}

// Policy holds the cache policy settings that can be changed at runtime.
type Policy struct {
	// MetadataTTL is how long mutable objects are served without
	// revalidation.
	MetadataTTL time.Duration `json:"metadata_ttl"`
	// ModuleTTL overrides MetadataTTL per module.
	ModuleTTL map[string]time.Duration `json:"module_ttl"`
	// NegativeTTL is how long an upstream 404 is remembered.
	NegativeTTL time.Duration `json:"negative_ttl"`
	// ServeStaleOnError serves expired copies when the upstream is down.
	ServeStaleOnError bool `json:"serve_stale_on_error"`
}

// Handler serves /<module>/<repository>/<path>.
type Handler struct {
	o      Options
	log    *slog.Logger
	neg    negCache
	policy atomic.Pointer[Policy]
}

// Policy returns the active cache policy.
func (h *Handler) Policy() Policy { return *h.policy.Load() }

// SetPolicy replaces the active cache policy.
func (h *Handler) SetPolicy(p Policy) { h.policy.Store(&p) }

// New creates the proxy handler.
func New(o Options) *Handler {
	if o.Logger == nil {
		o.Logger = slog.Default()
	}
	h := &Handler{o: o, log: o.Logger, neg: negCache{m: map[string]time.Time{}}}
	h.SetPolicy(o.Policy)
	return h
}

// negCache remembers recent upstream 404s in memory.
type negCache struct {
	mu sync.Mutex
	m  map[string]time.Time
}

func (n *negCache) hit(key string) bool {
	n.mu.Lock()
	defer n.mu.Unlock()
	exp, ok := n.m[key]
	if ok && time.Now().After(exp) {
		delete(n.m, key)
		return false
	}
	return ok
}

func (n *negCache) add(key string, ttl time.Duration) {
	if ttl <= 0 {
		return
	}
	n.mu.Lock()
	defer n.mu.Unlock()
	if len(n.m) >= 20000 {
		n.m = map[string]time.Time{} // crude but bounded
	}
	n.m[key] = time.Now().Add(ttl)
}

// outcome is what serve reports back for accounting.
type outcome struct {
	result stats.Result
	source string
}

func (h *Handler) ServeHTTP(rw http.ResponseWriter, r *http.Request) {
	start := time.Now()
	// Cached content comes from third parties and is served from the same
	// origin as the management interface. Make sure a browser never treats
	// it as an active document of this origin: no MIME sniffing, and a
	// sandboxed, script-less context if someone opens it directly.
	rw.Header().Set("X-Content-Type-Options", "nosniff")
	rw.Header().Set("Content-Security-Policy", "sandbox; default-src 'none'")
	w := newCountingWriter(rw, h.o.Stats, h.o.ClientRateLimit, r.Context())
	client := security.ClientIP(r, h.o.Trusted)
	rec := stats.Record{Time: start, Client: client.String(), Method: r.Method, Partial: r.Header.Get("Range") != ""}

	finish := func(o outcome) {
		rec.Result, rec.Source = o.result, o.source
		rec.Status, rec.Bytes = w.status(), w.bytes
		rec.DurationMS = time.Since(start).Milliseconds()
		if rec.Module != "" && h.o.Stats != nil {
			h.o.Stats.Record(rec)
		}
		h.log.Debug("request", "client", rec.Client, "module", rec.Module, "repo", rec.Repo, "path", rec.Path,
			"result", rec.Result, "status", rec.Status, "bytes", rec.Bytes, "ms", rec.DurationMS)
	}

	if !client.IsValid() || !h.o.Clients.Allows(client) {
		http.Error(w, "client address not allowed", http.StatusForbidden)
		finish(outcome{result: stats.Denied})
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		finish(outcome{result: stats.Denied})
		return
	}
	parts := strings.SplitN(strings.TrimPrefix(r.URL.Path, "/"), "/", 3)
	if len(parts) < 3 {
		http.NotFound(w, r)
		finish(outcome{result: stats.Denied})
		return
	}
	adapter, repo, ok := h.o.Modules.Resolve(parts[0], parts[1])
	if !ok {
		http.Error(w, "unknown or disabled module or repository", http.StatusNotFound)
		finish(outcome{result: stats.Denied})
		return
	}
	rec.Module, rec.Repo = repo.Module, repo.Name
	objPath, err := security.CleanPath(parts[2])
	if err != nil {
		http.Error(w, "invalid path: "+err.Error(), http.StatusBadRequest)
		finish(outcome{result: stats.Denied})
		return
	}
	rec.Path = objPath
	if rp, ok := adapter.(adapters.RequestPolicy); ok {
		if reason := rp.AllowRequest(r); reason != "" {
			http.Error(w, reason, http.StatusForbidden)
			finish(outcome{result: stats.Denied})
			return
		}
	}
	class := adapter.Classify(objPath)
	if class.Kind == adapters.Reject {
		http.NotFound(w, r)
		finish(outcome{result: stats.Denied})
		return
	}
	// Account the request even when the handler aborts the connection
	// (panic with http.ErrAbortHandler after a failed stream).
	defer func() { finish(w.out) }()
	w.out = h.serve(w, r, adapter, repo, objPath, class)
}

func (h *Handler) ttl(module string, class adapters.Class) time.Duration {
	if class.TTL > 0 {
		return class.TTL
	}
	p := h.policy.Load()
	if t, ok := p.ModuleTTL[module]; ok && t > 0 {
		return t
	}
	return p.MetadataTTL
}

// upstreamURLs builds the candidate URLs for an object. Each path segment
// is escaped again, and the client's query string is never forwarded.
func upstreamURLs(bases []string, objPath string) []string {
	segs := strings.Split(objPath, "/")
	for i, s := range segs {
		segs[i] = url.PathEscape(s)
	}
	esc := strings.Join(segs, "/")
	out := make([]string, len(bases))
	for i, b := range bases {
		out[i] = strings.TrimRight(b, "/") + "/" + esc
	}
	return out
}

func (h *Handler) serve(w *countingWriter, r *http.Request, a adapters.Adapter, repo *core.Repo, objPath string, class adapters.Class) outcome {
	ctx := r.Context()
	key := storage.Key{Module: repo.Module, Repo: repo.Name, Path: objPath}
	ttl := h.ttl(repo.Module, class)

	for attempt := 0; attempt < 3; attempt++ {
		entry, err := h.o.Store.Lookup(ctx, key)
		if err != nil && !errors.Is(err, storage.ErrNotFound) {
			if ctx.Err() != nil {
				return outcome{result: stats.Error}
			}
			h.log.Error("cache lookup failed", "key", key.String(), "err", err)
			http.Error(w, "cache metadata unavailable", http.StatusInternalServerError)
			return outcome{result: stats.Error}
		}
		if entry != nil && entry.Fresh(time.Now()) {
			if h.serveEntry(w, r, entry, "HIT") {
				return outcome{result: stats.Hit, source: "cache"}
			}
			entry = nil // blob vanished (evicted concurrently); download again
		}
		if entry == nil && h.neg.hit(key.String()) {
			w.Header().Set("X-Cache", "NEGATIVE")
			http.NotFound(w, r)
			return outcome{result: stats.NotFound, source: "cache"}
		}

		req := download.Request{
			Key:     key.String(),
			Module:  repo.Module,
			URLs:    upstreamURLs(repo.Upstreams, objPath),
			Publish: h.publisher(a, key, class, ttl),
		}
		if entry != nil { // stale: revalidate with the stored validators
			req.IfNoneMatch = entry.ETag
			if entry.ETag == "" {
				req.IfModifiedSince = entry.LastModified
			}
		}
		flight, joined := h.o.DL.Do(req, func() bool {
			e, err := h.o.Store.Lookup(context.Background(), key)
			return err == nil && e.Fresh(time.Now())
		})
		if flight == nil {
			continue // became fresh in the meantime; serve from cache
		}
		out, retry := h.follow(w, r, flight, joined, entry, key, class, ttl)
		flight.Leave()
		if !retry {
			return out
		}
	}
	http.Error(w, "object changed repeatedly while serving", http.StatusServiceUnavailable)
	return outcome{result: stats.Error}
}

// publisher returns the function a flight calls once the body is complete.
func (h *Handler) publisher(a adapters.Adapter, key storage.Key, class adapters.Class, ttl time.Duration) func(*storage.Writer, *download.Response) (any, error) {
	return func(w *storage.Writer, resp *download.Response) (any, error) {
		meta := storage.Meta{
			ContentType:  contentType(class, resp.Header),
			ETag:         resp.Header.Get("ETag"),
			LastModified: resp.Header.Get("Last-Modified"),
			UpstreamURL:  resp.URL,
			Immutable:    class.Kind == adapters.Immutable,
			TTL:          ttl,
		}
		if rp, ok := a.(adapters.ResponsePolicy); ok {
			pttl, cacheable := rp.Cacheable(resp.Header, ttl)
			if !cacheable {
				w.Abort()
				return nil, nil
			}
			meta.TTL = pttl
		}
		e, err := h.o.Store.Publish(context.Background(), w, key, meta)
		if err != nil {
			return nil, err
		}
		return e, nil
	}
}

func contentType(class adapters.Class, h http.Header) string {
	if class.ContentType != "" {
		return class.ContentType
	}
	if ct := h.Get("Content-Type"); ct != "" {
		return ct
	}
	return "application/octet-stream"
}

// follow serves a client from a flight. retry=true asks the caller to start
// over (the cache state changed underneath us).
func (h *Handler) follow(w *countingWriter, r *http.Request, f *download.Flight, joined bool, stale *storage.Entry,
	key storage.Key, class adapters.Class, ttl time.Duration) (out outcome, retry bool) {
	ctx := r.Context()
	resp, err := f.Header(ctx)
	if err != nil {
		if ctx.Err() != nil {
			return outcome{result: stats.Error, source: "upstream"}, false
		}
		if stale != nil && h.policy.Load().ServeStaleOnError && h.serveEntry(w, r, stale, "STALE") {
			h.log.Warn("upstream unavailable, serving stale copy", "key", key.String(), "err", err)
			return outcome{result: stats.Stale, source: "cache"}, false
		}
		status := http.StatusBadGateway
		if errors.Is(err, download.ErrTooLarge) {
			status = http.StatusRequestEntityTooLarge
		}
		http.Error(w, "upstream fetch failed: "+err.Error(), status)
		return outcome{result: stats.Error, source: "upstream"}, false
	}

	switch {
	case resp.Status == http.StatusNotModified:
		if stale == nil {
			// We joined someone else's revalidation without having a copy
			// ourselves; look again.
			return outcome{}, true
		}
		if err := h.o.Store.Revalidated(stale, ttl); err != nil {
			h.log.Warn("cannot record revalidation", "key", key.String(), "err", err)
		}
		if h.serveEntry(w, r, stale, "REVALIDATED") {
			return outcome{result: stats.Revalidated, source: "cache"}, false
		}
		return outcome{}, true

	case resp.Status == http.StatusOK:
		result := stats.Miss
		if joined {
			result = stats.Coalesced
		}
		return h.stream(w, r, f, resp, class, result), false

	case resp.Status == http.StatusNotFound:
		h.neg.add(key.String(), h.policy.Load().NegativeTTL)
		if stale != nil {
			// The upstream dropped the file; stop offering our copy.
			if err := h.o.Store.DeleteEntry(context.Background(), stale.ID); err != nil && !errors.Is(err, storage.ErrNotFound) {
				h.log.Warn("cannot drop removed object", "key", key.String(), "err", err)
			}
		}
		http.NotFound(w, r)
		return outcome{result: stats.NotFound, source: "upstream"}, false

	default:
		if stale != nil && h.policy.Load().ServeStaleOnError && resp.Status >= 500 && h.serveEntry(w, r, stale, "STALE") {
			return outcome{result: stats.Stale, source: "cache"}, false
		}
		http.Error(w, fmt.Sprintf("upstream answered %d", resp.Status), resp.Status)
		return outcome{result: stats.Error, source: "upstream"}, false
	}
}

// stream sends an in-flight download to the client while it is running.
func (h *Handler) stream(w *countingWriter, r *http.Request, f *download.Flight, resp *download.Response,
	class adapters.Class, result stats.Result) outcome {
	ctx := r.Context()
	out := outcome{result: result, source: "upstream"}
	body, err := f.Reader(ctx)
	if err != nil {
		// The flight already finished and its temp file is gone; the
		// object is in the cache now (or the download failed).
		if v, werr := f.Wait(ctx); werr == nil {
			if e, ok := v.(*storage.Entry); ok && e != nil && h.serveEntry(w, r, e, string(result)) {
				return out
			}
		}
		http.Error(w, "upstream fetch failed", http.StatusBadGateway)
		return outcome{result: stats.Error, source: "upstream"}
	}
	defer body.Close()

	if r.Header.Get("Range") != "" {
		// Ranges need the complete object: wait for the download, then
		// answer from the blob. If the object could not be stored, fall
		// through and send the full body (a server may ignore Range).
		v, werr := f.Wait(ctx)
		if werr != nil {
			if ctx.Err() == nil {
				http.Error(w, "upstream fetch failed: "+werr.Error(), http.StatusBadGateway)
			}
			return outcome{result: stats.Error, source: "upstream"}
		}
		if e, ok := v.(*storage.Entry); ok && e != nil {
			if h.serveEntry(w, r, e, string(result)) {
				return out
			}
		}
	}

	hd := w.Header()
	hd.Set("Content-Type", contentType(class, resp.Header))
	if resp.ContentLength >= 0 {
		hd.Set("Content-Length", fmt.Sprint(resp.ContentLength))
	}
	for _, name := range []string{"ETag", "Last-Modified"} {
		if v := resp.Header.Get(name); v != "" {
			hd.Set(name, v)
		}
	}
	hd.Set("X-Cache", string(result))
	w.WriteHeader(http.StatusOK)
	if r.Method == http.MethodHead {
		return out
	}
	w.out = out
	if _, err := io.Copy(w, body); err != nil {
		if ctx.Err() == nil {
			h.log.Warn("stream to client aborted", "key", f.Key, "err", err)
		}
		// The response is incomplete. Abort the connection so the client
		// can tell (a clean end of a chunked response would look like a
		// complete file).
		panic(http.ErrAbortHandler)
	}
	return out
}

// serveEntry answers from the cache. It returns false when the blob is not
// available any more and nothing has been written to the client.
func (h *Handler) serveEntry(w *countingWriter, r *http.Request, e *storage.Entry, label string) bool {
	f, err := h.o.Store.Open(e)
	if err != nil {
		if !errors.Is(err, storage.ErrNotFound) {
			h.log.Error("cannot open cached object", "key", e.Key.String(), "err", err)
		}
		return false
	}
	defer f.Close()
	hd := w.Header()
	ct := e.ContentType
	if ct == "" {
		ct = "application/octet-stream"
	}
	hd.Set("Content-Type", ct)
	etag := e.ETag
	if etag == "" {
		etag = `"sha256-` + e.BlobHash + `"`
	}
	hd.Set("ETag", etag)
	hd.Set("X-Cache", label)
	var mod time.Time
	if e.LastModified != "" {
		if t, err := http.ParseTime(e.LastModified); err == nil {
			mod = t
		}
	}
	h.o.Store.Touch(e)
	// ServeContent implements Range, If-Range, If-None-Match,
	// If-Modified-Since, 206, 304 and 416.
	http.ServeContent(w, r, "", mod, f)
	return true
}
