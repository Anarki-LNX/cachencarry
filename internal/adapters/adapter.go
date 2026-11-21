// Package adapters defines the protocol adapter interface and the registry
// of built-in adapters.
//
// An adapter owns everything that is specific to one ecosystem: how request
// paths map to cache keys, which objects are immutable, how long mutable
// metadata may be reused, which responses may be cached at all, and how
// clients are configured. It never touches storage, downloads or statistics
// directly; the shared core (package proxy) does that for every adapter in
// the same way.
package adapters

import (
	"net/http"
	"sort"
	"time"
)

// Kind classifies an object for caching purposes.
type Kind int

const (
	// Mutable objects (repository indexes) are revalidated upstream once
	// their TTL has passed.
	Mutable Kind = iota
	// Immutable objects (packages, by-hash indexes) never change under
	// the same name and are served from the cache without revalidation.
	Immutable
	// Reject marks paths the adapter refuses to serve.
	Reject
)

// Class is the caching decision for one request path.
type Class struct {
	Kind Kind
	// TTL overrides the configured metadata TTL for this object when > 0.
	TTL time.Duration
	// ContentType overrides the upstream Content-Type when not empty.
	ContentType string
}

// Maturity tells users how far an adapter can be trusted.
type Maturity string

const (
	Stable       Maturity = "stable"       // implemented and covered by tests
	Experimental Maturity = "experimental" // implemented, limited testing
)

// Info describes an adapter for the UI and documentation.
type Info struct {
	Name        string   `json:"name"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Maturity    Maturity `json:"maturity"`
	// RepoHint explains what an upstream URL must point to.
	RepoHint string `json:"repo_hint"`
}

// Adapter is implemented by every protocol adapter.
type Adapter interface {
	Info() Info
	// Classify decides how the object at path (already validated, no
	// leading slash) is cached.
	Classify(path string) Class
	// ClientConfig returns a ready-to-paste client configuration snippet
	// for a repository reachable at baseURL (e.g.
	// http://cachencarry.lan:8080/apt/debian).
	ClientConfig(baseURL, repo string) string
}

// ResponsePolicy is an optional interface. Adapters that proxy arbitrary
// HTTP content implement it to decide per response whether it may be stored.
type ResponsePolicy interface {
	// Cacheable inspects the upstream response headers. ttl is only used
	// for mutable objects; ok=false streams the response without storing.
	Cacheable(h http.Header, defaultTTL time.Duration) (ttl time.Duration, ok bool)
}

// RequestPolicy is an optional interface for adapters that must reject
// certain client requests (for example requests carrying credentials).
type RequestPolicy interface {
	// AllowRequest returns a non-empty reason when the request is refused.
	AllowRequest(r *http.Request) (reason string)
}

// Registry holds the available adapters by name.
type Registry struct {
	byName map[string]Adapter
}

// NewRegistry returns a registry with the given adapters.
func NewRegistry(list ...Adapter) *Registry {
	r := &Registry{byName: map[string]Adapter{}}
	for _, a := range list {
		r.byName[a.Info().Name] = a
	}
	return r
}

// Builtin returns the registry of adapters shipped with Cache & Carry.
func Builtin() *Registry {
	return NewRegistry(APT{}, Pacman{}, Generic{})
}

// Get returns the adapter with the given name.
func (r *Registry) Get(name string) (Adapter, bool) {
	a, ok := r.byName[name]
	return a, ok
}

// Names returns all adapter names in alphabetical order.
func (r *Registry) Names() []string {
	out := make([]string, 0, len(r.byName))
	for n := range r.byName {
		out = append(out, n)
	}
	sort.Strings(out)
	return out
}
