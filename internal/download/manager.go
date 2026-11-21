// Package download implements the central download manager.
//
// Every upstream transfer in UniCache goes through Manager.Do. Requests for
// the same key are coalesced into one Flight: only one upstream download
// runs, and every interested client follows the growing temporary file, so
// nobody waits for the complete object before receiving the first byte.
package download

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Anarki-LNX/unicache/internal/storage"
)

// ErrTooLarge is returned when an object exceeds the configured maximum size.
var ErrTooLarge = errors.New("download: object exceeds maximum size")

// ErrCancelled is returned when a flight was cancelled by an administrator
// or by shutdown.
var ErrCancelled = errors.New("download: cancelled")

// Response describes the upstream answer of a flight.
type Response struct {
	Status        int // 200, 304 or the upstream error status (404, 403, …)
	Header        http.Header
	URL           string // upstream URL that answered
	ContentLength int64  // -1 when unknown
}

// Request describes one object to fetch.
type Request struct {
	// Key identifies the object for coalescing (module/repo/path).
	Key string
	// Module is used for statistics only.
	Module string
	// URLs are the upstream candidates, tried in order.
	URLs []string
	// IfNoneMatch / IfModifiedSince turn the request into a revalidation.
	// The upstream may then answer 304 and no body is transferred.
	IfNoneMatch     string
	IfModifiedSince string
	// Publish is called once the complete body has been received. It must
	// either publish or abort the writer. Its return value is handed to
	// everyone waiting on the flight.
	Publish func(w *storage.Writer, resp *Response) (any, error)
}

// Options configure a Manager.
type Options struct {
	Client        *http.Client
	Store         *storage.Store
	MaxConcurrent int
	Retries       int
	RetryBackoff  time.Duration
	IdleTimeout   time.Duration
	MaxObjectSize int64
	Resume        bool
	UserAgent     string
	RateLimit     int64 // upstream bytes per second, 0 = unlimited
	Logger        *slog.Logger
	// OnUpstreamBytes is called for every chunk received from upstream.
	OnUpstreamBytes func(module string, n int64)
	// OnChange is called when a flight starts or ends (for live updates).
	OnChange func()
}

// Manager coalesces and runs upstream downloads.
type Manager struct {
	opts    Options
	log     *slog.Logger
	sem     chan struct{}
	limiter *Limiter

	baseCtx context.Context
	cancel  context.CancelFunc
	wg      sync.WaitGroup

	mu      sync.Mutex
	flights map[string]*Flight
	nextID  int64
}

// NewManager creates a download manager.
func NewManager(opts Options) *Manager {
	if opts.MaxConcurrent < 1 {
		opts.MaxConcurrent = 8
	}
	if opts.RetryBackoff <= 0 {
		opts.RetryBackoff = 500 * time.Millisecond
	}
	if opts.Logger == nil {
		opts.Logger = slog.Default()
	}
	ctx, cancel := context.WithCancel(context.Background())
	return &Manager{
		opts:    opts,
		log:     opts.Logger,
		sem:     make(chan struct{}, opts.MaxConcurrent),
		limiter: NewLimiter(opts.RateLimit),
		baseCtx: ctx,
		cancel:  cancel,
		flights: map[string]*Flight{},
	}
}

// Close cancels all running flights and waits for them to finish.
func (m *Manager) Close() {
	m.cancel()
	m.wg.Wait()
}

// Do returns the flight for req.Key, starting one if none is running.
//
// precheck (optional) is evaluated under the manager lock right before a new
// flight would be created; if it returns true no flight is started and Do
// returns nil. Callers use it to re-check the cache: a flight publishes its
// result before it leaves the flight table, so "not in the table" together
// with "not in the cache" reliably means the object must be downloaded.
// Without it, a request racing with the end of a flight could start a
// second download of the same object.
func (m *Manager) Do(req Request, precheck func() bool) (f *Flight, joined bool) {
	m.mu.Lock()
	if f = m.flights[req.Key]; f != nil {
		f.clients.Add(1)
		m.mu.Unlock()
		return f, true
	}
	if precheck != nil && precheck() {
		m.mu.Unlock()
		return nil, false
	}
	m.nextID++
	ctx, cancel := context.WithCancel(m.baseCtx)
	f = &Flight{
		ID:          m.nextID,
		Key:         req.Key,
		Module:      req.Module,
		Started:     time.Now(),
		req:         req,
		cancel:      cancel,
		headerReady: make(chan struct{}),
		done:        make(chan struct{}),
		notify:      make(chan struct{}),
		total:       -1,
	}
	f.clients.Store(1)
	m.flights[req.Key] = f
	m.wg.Add(1)
	m.mu.Unlock()

	go func() {
		defer m.wg.Done()
		defer cancel()
		m.run(ctx, f)
	}()
	m.changed()
	return f, false
}

func (m *Manager) changed() {
	if m.opts.OnChange != nil {
		m.opts.OnChange()
	}
}

// Cancel aborts the flight with the given ID.
func (m *Manager) Cancel(id int64) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, f := range m.flights {
		if f.ID == id {
			f.cancel()
			return true
		}
	}
	return false
}

// Snapshot describes a running flight for the API.
type Snapshot struct {
	ID       int64     `json:"id"`
	Key      string    `json:"key"`
	Module   string    `json:"module"`
	URL      string    `json:"url"`
	Total    int64     `json:"total"` // -1 unknown
	Received int64     `json:"received"`
	Clients  int64     `json:"clients"`
	Started  time.Time `json:"started"`
	State    string    `json:"state"` // queued, connecting, downloading, publishing
}

// Active lists the running flights.
func (m *Manager) Active() []Snapshot {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]Snapshot, 0, len(m.flights))
	for _, f := range m.flights {
		f.mu.Lock()
		out = append(out, Snapshot{
			ID: f.ID, Key: f.Key, Module: f.Module, URL: f.url, Total: f.total,
			Received: f.written, Clients: f.clients.Load(), Started: f.Started, State: f.state,
		})
		f.mu.Unlock()
	}
	return out
}

// Flight is one coalesced upstream download.
type Flight struct {
	ID      int64
	Key     string
	Module  string
	Started time.Time

	req     Request
	cancel  context.CancelFunc
	clients atomic.Int64

	headerReady chan struct{} // closed once resp or err is set
	done        chan struct{} // closed once the flight finished completely

	mu       sync.Mutex
	resp     *Response
	err      error
	value    any
	state    string
	url      string
	file     *os.File // the growing temp file, shared by all readers
	finished bool     // run() completed
	total    int64
	written  int64
	bodyDone bool
	notify   chan struct{} // closed and replaced on every progress step
}

// Header waits until the upstream status is known. A non-nil error means the
// download failed before any response could be used.
func (f *Flight) Header(ctx context.Context) (*Response, error) {
	select {
	case <-f.headerReady:
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.resp == nil {
		return nil, f.err
	}
	return f.resp, nil
}

// Wait blocks until the flight has finished (including publication) and
// returns the value produced by Request.Publish.
func (f *Flight) Wait(ctx context.Context) (any, error) {
	select {
	case <-f.done:
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.value, f.err
}

// Leave tells the flight that one client (every caller of Manager.Do is
// one) stopped using it. The received data stays readable until the last
// client has left, even if the object was not stored in the cache.
func (f *Flight) Leave() {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.clients.Add(-1) <= 0 && f.finished {
		f.closeFileLocked()
	}
}

func (f *Flight) closeFileLocked() {
	if f.file != nil {
		f.file.Close()
		f.file = nil
	}
}

// Reader returns a reader that follows the body while it is downloaded. It
// may only be used after Header returned status 200 and before Leave.
func (f *Flight) Reader(ctx context.Context) (io.ReadCloser, error) {
	f.mu.Lock()
	file := f.file
	f.mu.Unlock()
	if file == nil {
		return nil, errors.New("download: flight has no body")
	}
	return &tailReader{f: f, file: file, ctx: ctx}, nil
}

type tailReader struct {
	f    *Flight
	file *os.File
	ctx  context.Context
	off  int64
}

func (t *tailReader) Read(p []byte) (int, error) {
	for {
		t.f.mu.Lock()
		written, bodyDone, err, ch := t.f.written, t.f.bodyDone, t.f.err, t.f.notify
		t.f.mu.Unlock()
		if t.off < written {
			if max := written - t.off; int64(len(p)) > max {
				p = p[:max]
			}
			n, rerr := t.file.ReadAt(p, t.off)
			t.off += int64(n)
			if n > 0 {
				return n, nil
			}
			if rerr != nil && rerr != io.EOF {
				return 0, rerr
			}
			continue
		}
		if bodyDone {
			return 0, io.EOF
		}
		if err != nil {
			return 0, err
		}
		select {
		case <-ch:
		case <-t.ctx.Done():
			return 0, t.ctx.Err()
		}
	}
}

// Close is a no-op: the file belongs to the flight (see Flight.Leave).
func (t *tailReader) Close() error { return nil }

// progress wakes every tail reader.
func (f *Flight) progressLocked() {
	close(f.notify)
	f.notify = make(chan struct{})
}

func (f *Flight) setState(s string) {
	f.mu.Lock()
	f.state = s
	f.mu.Unlock()
}

// StatusError is a final non-success upstream status.
type StatusError struct {
	Status int
	URL    string
}

func (e *StatusError) Error() string {
	return fmt.Sprintf("upstream %s answered %d %s", e.URL, e.Status, http.StatusText(e.Status))
}

// run executes the flight and always completes it.
func (m *Manager) run(ctx context.Context, f *Flight) {
	f.setState("queued")
	var value any
	var err error
	select {
	case m.sem <- struct{}{}:
		if f.clients.Load() <= 0 {
			// Every client gave up while the flight was queued: do not
			// spend bandwidth on something nobody is waiting for.
			err = ErrCancelled
		} else {
			value, err = m.fetch(ctx, f)
		}
		<-m.sem
	case <-ctx.Done():
		err = ErrCancelled
	}
	if err != nil && ctx.Err() != nil {
		err = ErrCancelled
	}

	// Order matters: the result is published by fetch before the flight is
	// removed from the table (see Do), and done is closed last.
	m.mu.Lock()
	delete(m.flights, f.Key)
	m.mu.Unlock()

	f.mu.Lock()
	f.value, f.err = value, err
	headerWasSet := f.resp != nil
	f.finished = true
	if f.clients.Load() <= 0 {
		f.closeFileLocked()
	}
	f.progressLocked()
	f.mu.Unlock()
	if !headerWasSet {
		close(f.headerReady)
	}
	close(f.done)
	if err != nil && !errors.Is(err, ErrCancelled) {
		m.log.Warn("download failed", "key", f.Key, "err", err)
	}
	m.changed()
}

// setResponse publishes the upstream response to waiting clients.
func (f *Flight) setResponse(r *Response) {
	f.mu.Lock()
	f.resp = r
	f.mu.Unlock()
	close(f.headerReady)
}

func retryable(status int) bool {
	return status >= 500 || status == http.StatusTooManyRequests || status == http.StatusRequestTimeout
}

// fetch tries the upstream candidates until one delivers a final answer.
func (m *Manager) fetch(ctx context.Context, f *Flight) (any, error) {
	req := f.req
	if len(req.URLs) == 0 {
		return nil, errors.New("download: no upstream configured")
	}
	var lastErr error
	backoff := m.opts.RetryBackoff
	for round := 0; round <= m.opts.Retries; round++ {
		if round > 0 {
			select {
			case <-time.After(backoff):
				backoff *= 2
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}
		notFound := 0
		for _, u := range req.URLs {
			f.mu.Lock()
			f.state, f.url = "connecting", u
			f.mu.Unlock()
			value, final, err := m.attempt(ctx, f, u)
			if final {
				return value, err
			}
			lastErr = err
			var se *StatusError
			if errors.As(err, &se) && (se.Status == http.StatusNotFound || se.Status == http.StatusGone) {
				notFound++
			}
			if ctx.Err() != nil {
				return nil, ctx.Err()
			}
		}
		// Every mirror says the object does not exist: that is an answer,
		// not an outage, so do not keep retrying.
		if notFound == len(req.URLs) {
			resp := &Response{Status: http.StatusNotFound, Header: http.Header{}, ContentLength: -1}
			f.setResponse(resp)
			return nil, nil
		}
	}
	return nil, fmt.Errorf("all upstreams failed: %w", lastErr)
}

// attempt performs one upstream request. final reports whether the outcome
// is definitive (success, or a failure after the response was already handed
// to clients); otherwise the caller may try another mirror.
func (m *Manager) attempt(ctx context.Context, f *Flight, url string) (value any, final bool, err error) {
	hreq, err := m.newRequest(ctx, url)
	if err != nil {
		return nil, true, err
	}
	if f.req.IfNoneMatch != "" {
		hreq.Header.Set("If-None-Match", f.req.IfNoneMatch)
	}
	if f.req.IfModifiedSince != "" {
		hreq.Header.Set("If-Modified-Since", f.req.IfModifiedSince)
	}
	resp, err := m.opts.Client.Do(hreq)
	if err != nil {
		return nil, false, err
	}
	defer resp.Body.Close()

	switch {
	case resp.StatusCode == http.StatusNotModified:
		if f.req.IfNoneMatch == "" && f.req.IfModifiedSince == "" {
			return nil, false, fmt.Errorf("upstream %s sent 304 to an unconditional request", url)
		}
		f.setResponse(&Response{Status: 304, Header: resp.Header.Clone(), URL: url, ContentLength: -1})
		return nil, true, nil
	case resp.StatusCode == http.StatusOK:
		// handled below
	case resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone || retryable(resp.StatusCode):
		io.Copy(io.Discard, io.LimitReader(resp.Body, 64<<10))
		return nil, false, &StatusError{Status: resp.StatusCode, URL: url}
	default:
		// Other statuses (401, 403, 451, unexpected 2xx/3xx) are final and
		// reported to the client without a body. They are never cached.
		io.Copy(io.Discard, io.LimitReader(resp.Body, 64<<10))
		status := resp.StatusCode
		if status < 400 {
			status = http.StatusBadGateway
		}
		f.setResponse(&Response{Status: status, Header: http.Header{}, URL: url, ContentLength: -1})
		return nil, true, nil
	}

	if m.opts.MaxObjectSize > 0 && resp.ContentLength > m.opts.MaxObjectSize {
		return nil, true, ErrTooLarge
	}
	w, err := m.opts.Store.NewWriter()
	if err != nil {
		return nil, true, err
	}
	// The flight keeps its own descriptor of the temp file. It stays valid
	// after the file is renamed into the store or unlinked, so clients can
	// finish reading no matter what happens to the object afterwards.
	file, err := os.Open(w.TempPath())
	if err != nil {
		w.Abort()
		return nil, true, fmt.Errorf("download: open in-flight data: %w", err)
	}
	meta := &Response{Status: 200, Header: resp.Header.Clone(), URL: url, ContentLength: resp.ContentLength}
	f.mu.Lock()
	f.file, f.total, f.state = file, resp.ContentLength, "downloading"
	f.mu.Unlock()
	f.setResponse(meta)

	// From here on clients are already receiving data, so every outcome is
	// final: we cannot silently switch to different content.
	if err := m.receive(ctx, f, w, resp, url); err != nil {
		w.Abort()
		return nil, true, err
	}
	if meta.ContentLength >= 0 && w.Size() != meta.ContentLength {
		w.Abort()
		return nil, true, fmt.Errorf("upstream %s: got %d bytes, expected %d", url, w.Size(), meta.ContentLength)
	}
	f.mu.Lock()
	f.bodyDone, f.state = true, "publishing"
	f.progressLocked()
	f.mu.Unlock()
	if f.req.Publish == nil {
		w.Abort()
		return nil, true, nil
	}
	value, err = f.req.Publish(w, meta)
	return value, true, err
}

func (m *Manager) newRequest(ctx context.Context, url string) (*http.Request, error) {
	hreq, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	// Stored bytes must be exactly what the origin publishes, so never let
	// a transfer encoding change them.
	hreq.Header.Set("Accept-Encoding", "identity")
	if m.opts.UserAgent != "" {
		hreq.Header.Set("User-Agent", m.opts.UserAgent)
	}
	return hreq, nil
}

// receive copies the body into w, resuming with Range requests when the
// connection breaks and the upstream supports it.
func (m *Manager) receive(ctx context.Context, f *Flight, w *storage.Writer, resp *http.Response, url string) error {
	validator := strongValidator(resp.Header)
	body := resp.Body
	resumes := 0
	for {
		err := m.copyBody(ctx, f, w, body)
		if err == nil {
			return nil
		}
		if ctx.Err() != nil || errors.Is(err, ErrTooLarge) || isLocalWriteError(err) {
			return err
		}
		if !m.opts.Resume || validator == "" || resumes >= m.opts.Retries {
			return fmt.Errorf("transfer interrupted after %d bytes: %w", w.Size(), err)
		}
		resumes++
		m.log.Info("resuming interrupted download", "key", f.Key, "offset", w.Size(), "attempt", resumes, "cause", err)
		select {
		case <-time.After(m.opts.RetryBackoff * time.Duration(1<<(resumes-1))):
		case <-ctx.Done():
			return ctx.Err()
		}
		rresp, rerr := m.resume(ctx, url, w.Size(), validator, resp.ContentLength)
		if rerr != nil {
			// A failed resume attempt counts against the retry budget;
			// keep trying until it is used up.
			body = errBody{rerr}
			continue
		}
		defer rresp.Body.Close()
		body = rresp.Body
	}
}

// errBody is a body that fails immediately; it lets a failed resume attempt
// flow through the normal retry loop.
type errBody struct{ err error }

func (e errBody) Read([]byte) (int, error) { return 0, e.err }
func (e errBody) Close() error             { return nil }

type localWriteError struct{ err error }

func (e *localWriteError) Error() string { return "write cache file: " + e.err.Error() }
func (e *localWriteError) Unwrap() error { return e.err }

func isLocalWriteError(err error) bool {
	var lw *localWriteError
	return errors.As(err, &lw)
}

// strongValidator returns the validator usable for If-Range: a strong ETag,
// or else the Last-Modified date.
func strongValidator(h http.Header) string {
	if et := h.Get("ETag"); et != "" && !strings.HasPrefix(et, "W/") {
		return et
	}
	return h.Get("Last-Modified")
}

// resume requests the remainder of the object. It only succeeds if the
// upstream confirms (206 + matching Content-Range) that it continues the
// very same representation.
func (m *Manager) resume(ctx context.Context, url string, offset int64, validator string, total int64) (*http.Response, error) {
	hreq, err := m.newRequest(ctx, url)
	if err != nil {
		return nil, err
	}
	hreq.Header.Set("Range", "bytes="+strconv.FormatInt(offset, 10)+"-")
	hreq.Header.Set("If-Range", validator)
	resp, err := m.opts.Client.Do(hreq)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusPartialContent {
		resp.Body.Close()
		return nil, fmt.Errorf("upstream does not resume (status %d)", resp.StatusCode)
	}
	start, _, rtotal, ok := parseContentRange(resp.Header.Get("Content-Range"))
	if !ok || start != offset || (total >= 0 && rtotal >= 0 && rtotal != total) {
		resp.Body.Close()
		return nil, fmt.Errorf("upstream sent unexpected Content-Range %q", resp.Header.Get("Content-Range"))
	}
	return resp, nil
}

// parseContentRange parses "bytes start-end/total"; total is -1 for "*".
func parseContentRange(v string) (start, end, total int64, ok bool) {
	rest, found := strings.CutPrefix(v, "bytes ")
	if !found {
		return 0, 0, 0, false
	}
	rng, tot, found := strings.Cut(rest, "/")
	if !found {
		return 0, 0, 0, false
	}
	s, e, found := strings.Cut(rng, "-")
	if !found {
		return 0, 0, 0, false
	}
	var err1, err2, err3 error
	start, err1 = strconv.ParseInt(strings.TrimSpace(s), 10, 64)
	end, err2 = strconv.ParseInt(strings.TrimSpace(e), 10, 64)
	total = -1
	if strings.TrimSpace(tot) != "*" {
		total, err3 = strconv.ParseInt(strings.TrimSpace(tot), 10, 64)
	}
	if err1 != nil || err2 != nil || err3 != nil || start < 0 || end < start {
		return 0, 0, 0, false
	}
	return start, end, total, true
}

// copyBody streams body into w with idle timeout, size limit and rate limit.
func (m *Manager) copyBody(ctx context.Context, f *Flight, w *storage.Writer, body io.Reader) error {
	buf := make([]byte, 128<<10)
	var idle *time.Timer
	idleCtx, idleCancel := context.WithCancelCause(ctx)
	defer idleCancel(nil)
	if m.opts.IdleTimeout > 0 {
		idle = time.AfterFunc(m.opts.IdleTimeout, func() {
			idleCancel(errors.New("upstream stalled (idle timeout)"))
		})
		defer idle.Stop()
		// Unblock the pending Read when the idle timer fires.
		if c, ok := body.(io.Closer); ok {
			stop := context.AfterFunc(idleCtx, func() { c.Close() })
			defer stop()
		}
	}
	for {
		n, rerr := body.Read(buf)
		if n > 0 {
			if idle != nil {
				idle.Reset(m.opts.IdleTimeout)
			}
			if m.opts.MaxObjectSize > 0 && w.Size()+int64(n) > m.opts.MaxObjectSize {
				return ErrTooLarge
			}
			if _, werr := w.Write(buf[:n]); werr != nil {
				return &localWriteError{werr}
			}
			f.mu.Lock()
			f.written = w.Size()
			f.progressLocked()
			f.mu.Unlock()
			if m.opts.OnUpstreamBytes != nil {
				m.opts.OnUpstreamBytes(f.Module, int64(n))
			}
			if err := m.limiter.Wait(ctx, n); err != nil {
				return err
			}
		}
		if rerr == io.EOF {
			return nil
		}
		if rerr != nil {
			if cause := context.Cause(idleCtx); cause != nil && ctx.Err() == nil {
				return cause
			}
			return rerr
		}
	}
}
