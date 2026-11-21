package download

import (
	"context"
	"sync"
	"time"
)

// Limiter is a simple shared token bucket for byte rates. A nil or zero-rate
// limiter never blocks.
type Limiter struct {
	rate float64 // bytes per second

	mu     sync.Mutex
	tokens float64
	last   time.Time
}

// NewLimiter returns a limiter allowing bytesPerSecond; 0 disables limiting.
func NewLimiter(bytesPerSecond int64) *Limiter {
	if bytesPerSecond <= 0 {
		return nil
	}
	return &Limiter{rate: float64(bytesPerSecond), tokens: float64(bytesPerSecond), last: time.Now()}
}

// Wait blocks until n bytes may pass or ctx is done.
func (l *Limiter) Wait(ctx context.Context, n int) error {
	if l == nil || n <= 0 {
		return nil
	}
	l.mu.Lock()
	now := time.Now()
	l.tokens += now.Sub(l.last).Seconds() * l.rate
	if l.tokens > l.rate { // burst: at most one second worth
		l.tokens = l.rate
	}
	l.last = now
	l.tokens -= float64(n)
	var wait time.Duration
	if l.tokens < 0 {
		wait = time.Duration(-l.tokens / l.rate * float64(time.Second))
	}
	l.mu.Unlock()
	if wait <= 0 {
		return nil
	}
	t := time.NewTimer(wait)
	defer t.Stop()
	select {
	case <-t.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
