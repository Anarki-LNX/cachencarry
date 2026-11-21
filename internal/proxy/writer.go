package proxy

import (
	"context"
	"io"
	"net/http"

	"github.com/Anarki-LNX/cachencarry/internal/download"
	"github.com/Anarki-LNX/cachencarry/internal/stats"
)

// countingWriter measures what is really sent to a client: the status code
// and the number of body bytes. It optionally throttles the response.
type countingWriter struct {
	http.ResponseWriter
	stats   *stats.Collector
	limiter *download.Limiter
	ctx     context.Context
	code    int
	bytes   int64
	out     outcome // what the request turned out to be, for accounting
}

func newCountingWriter(w http.ResponseWriter, s *stats.Collector, rate int64, ctx context.Context) *countingWriter {
	return &countingWriter{ResponseWriter: w, stats: s, limiter: download.NewLimiter(rate), ctx: ctx}
}

func (c *countingWriter) status() int {
	if c.code == 0 {
		return http.StatusOK
	}
	return c.code
}

func (c *countingWriter) WriteHeader(code int) {
	if c.code == 0 {
		c.code = code
	}
	c.ResponseWriter.WriteHeader(code)
}

func (c *countingWriter) account(n int64) {
	if n <= 0 {
		return
	}
	// Error pages and 304s are not payload.
	if code := c.status(); code == http.StatusOK || code == http.StatusPartialContent {
		c.bytes += n
		if c.stats != nil {
			c.stats.AddClientBytes(n)
		}
	}
}

func (c *countingWriter) Write(p []byte) (int, error) {
	if c.code == 0 {
		c.code = http.StatusOK
	}
	if c.limiter == nil {
		n, err := c.ResponseWriter.Write(p)
		c.account(int64(n))
		return n, err
	}
	// Throttled: hand out the data in small pieces.
	written := 0
	for len(p) > 0 {
		chunk := p
		if len(chunk) > 32<<10 {
			chunk = chunk[:32<<10]
		}
		if err := c.limiter.Wait(c.ctx, len(chunk)); err != nil {
			return written, err
		}
		n, err := c.ResponseWriter.Write(chunk)
		written += n
		c.account(int64(n))
		if err != nil {
			return written, err
		}
		p = p[n:]
	}
	return written, nil
}

// ReadFrom keeps the kernel fast path (sendfile) for cached files when the
// response is not throttled.
func (c *countingWriter) ReadFrom(r io.Reader) (int64, error) {
	if c.code == 0 {
		c.code = http.StatusOK
	}
	if rf, ok := c.ResponseWriter.(io.ReaderFrom); ok && c.limiter == nil {
		n, err := rf.ReadFrom(r)
		c.account(n)
		return n, err
	}
	// io.Copy would call ReadFrom again; hide it.
	return io.Copy(struct{ io.Writer }{c}, r)
}

func (c *countingWriter) Flush() {
	if f, ok := c.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func (c *countingWriter) Unwrap() http.ResponseWriter { return c.ResponseWriter }
