// Package events is a small in-process publish/subscribe broker used to push
// live updates to dashboard clients (Server-Sent Events).
package events

import "sync"

// Event is one message delivered to subscribers.
type Event struct {
	Type string
	Data any
}

// Broker fans events out to subscribers. Slow subscribers lose events
// instead of blocking publishers; the dashboard resynchronises through the
// REST API, so a dropped event is harmless.
type Broker struct {
	mu   sync.RWMutex
	subs map[chan Event]struct{}
}

// NewBroker creates a broker.
func NewBroker() *Broker { return &Broker{subs: map[chan Event]struct{}{}} }

// Subscribe registers a subscriber. Call the returned function to
// unsubscribe; the channel is closed afterwards.
func (b *Broker) Subscribe() (<-chan Event, func()) {
	ch := make(chan Event, 256)
	b.mu.Lock()
	b.subs[ch] = struct{}{}
	b.mu.Unlock()
	var once sync.Once
	return ch, func() {
		once.Do(func() {
			b.mu.Lock()
			delete(b.subs, ch)
			b.mu.Unlock()
			close(ch)
		})
	}
}

// Publish delivers an event to every subscriber without blocking.
func (b *Broker) Publish(typ string, data any) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for ch := range b.subs {
		select {
		case ch <- Event{Type: typ, Data: data}:
		default:
		}
	}
}

// Subscribers returns the number of connected subscribers.
func (b *Broker) Subscribers() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.subs)
}
