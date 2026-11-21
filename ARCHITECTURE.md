# Architecture

UniCache is a modular monolith: one Go process, one SQLite database, one
storage directory. There are no microservices and no external dependencies at
runtime.

```
                        ┌────────────────────────── unicache ──────────────────────────┐
 client ── HTTP ──────▶ │ router ─┬─ /api/…  ─▶ api (sessions, CSRF, audit, SSE)        │
                        │         ├─ /<module>/<repo>/<path> ─▶ proxy                   │
                        │         └─ everything else ─▶ embedded web UI                 │
                        │                                                              │
                        │  proxy ──▶ adapters (APT, Pacman, Generic): classify a path  │
                        │    │                                                         │
                        │    ├─▶ storage  ── cas (blobs/, temp/) + SQLite metadata     │
                        │    ├─▶ download ── coalescing, streaming, resume, failover ──┼─▶ upstream mirrors
                        │    └─▶ stats    ── counters, request log, live rates ─▶ events (SSE)
                        └──────────────────────────────────────────────────────────────┘
```

## Packages

| Package | Responsibility |
|---|---|
| `cmd/unicache` | CLI: `serve`, `check-config`, `healthcheck`, `reset-password`, `backup`, `setup-token` |
| `internal/app` | Wires everything together, HTTP server, background jobs, shutdown |
| `internal/config` | YAML configuration, environment overrides, validation, schema version |
| `internal/database` | SQLite (WAL), embedded migrations, backup, integrity check |
| `internal/storage/cas` | Bytes on disk: temp files, hashing, atomic rename, verify, walk |
| `internal/storage` | The storage API: entries, references, GC, eviction, verify, recovery |
| `internal/download` | Download manager: flights, coalescing, tail readers, resume, limits |
| `internal/adapters` | Adapter interface and the built-in adapters |
| `internal/proxy` | The caching engine shared by all path-based adapters |
| `internal/core` | Runtime registry of enabled modules and repositories |
| `internal/stats`, `internal/events` | Measured statistics and the SSE broker |
| `internal/security` | ACLs, client IP, SSRF-safe upstream client, auth, sessions, rate limits |
| `internal/api` | Management REST API |
| `web` | React dashboard, embedded into the binary with the `ui` build tag |

**Rule:** adapters never touch files or the database. They only answer
questions ("is this path immutable?", "may this response be stored?"). Storage,
downloads, statistics and security are implemented once, in the core.

## Storage engine

```
/var/lib/unicache/
  blobs/ab/cd/abcd…ef     completed objects, named by SHA-256
  temp/dl-123456          downloads in progress
  metadata.db             SQLite (entries, blobs, repositories, users, statistics)
  setup-token             one-time token, only until the first administrator exists
```

- **Blob**: file content, identified by its SHA-256. Stored once.
- **Entry**: `(module, repository, path)` → blob hash, plus content type,
  ETag, Last-Modified, upstream URL, immutability, expiry, pin flag, access
  statistics. Repository identity is part of the key: two repositories never
  share an entry, but they share the blob if the content is identical.
- **Reference**: a blob is referenced while at least one entry points to it.
  References are derived from the entries table (indexed), not kept as a
  counter that could drift.

### Publication is atomic

1. Data is written to `temp/` and hashed on the way.
2. `Seal`: fsync and close (the slow part, done without any lock).
3. Under the shared *gate*: if `blobs/…/<hash>` already exists with the right
   size, the temp file is dropped (deduplication); otherwise it is renamed
   into place. Then one transaction inserts the blob row and upserts the
   entry.

A file under `blobs/` is therefore always complete. A partially downloaded
file can never be observed as a cache entry.

### Garbage collection cannot race with publication

Between the rename and the database commit a blob exists that nothing
references yet. The *gate* (`sync.RWMutex`) closes that window: publishers
hold it shared for the rename + transaction (milliseconds), the collector
holds it exclusively while it re-checks and deletes a batch of at most 200
blobs. Candidates are selected without the gate and the decision is repeated
inside it (`DELETE … WHERE NOT EXISTS (reference)`). Downloads never hold the
gate. `TestGCDoesNotRaceWithPublish` hammers exactly this window.

Readers are unaffected by deletion: an open file descriptor stays valid after
the file is unlinked. A lookup that finds an entry whose blob has just been
evicted simply falls back to a download.

### Eviction, expiry, pinning

- `storage.max_size` and `storage.min_free_space` are enforced by removing
  the least recently used, unpinned entries and collecting released blobs.
- It runs periodically (`gc_interval`) and, debounced, right after new data
  was published, so a burst of downloads cannot fill the disk between runs.
- Access times are buffered in memory and written in batches; eviction flushes
  them first.
- `cache.immutable_max_age` optionally removes packages nobody asked for.
- Pinned entries are never evicted. If only pinned data is left and the limit
  is still exceeded, the report says so (`unsatisfied`) and the dashboard
  warns.

### Integrity and crash recovery

- Background verification re-hashes blobs (oldest check first). A blob whose
  content no longer matches its name is purged together with its entries, so
  the next request downloads it again.
- At startup `temp/` is emptied (no download can be running), then a recovery
  pass reconciles disk and database: blob files without a row are deleted
  (crash between rename and commit), rows whose file is missing or has the
  wrong size are dropped with their entries.
- SQLite runs in WAL mode with `synchronous=NORMAL`: a power loss can lose
  the last transactions but cannot corrupt the database. The worst case is an
  orphan blob, which recovery removes.
- A database from a newer release, or one that fails the integrity check, is
  refused at startup with a clear message.

## Download manager

Every upstream transfer is a **flight**, keyed by `module/repo/path`.

- `Manager.Do` returns the running flight for a key or starts one. A
  *precheck* (cache lookup) runs under the manager lock before a new flight is
  created. Because a flight publishes its result *before* leaving the flight
  table, "not in the table and not in the cache" reliably means "must be
  downloaded". Without this, a request arriving exactly when a flight ends
  could start a second download.
- The flight writes to a temp file and wakes its followers on every chunk.
  Each client reads the growing file with `ReadAt` (**tail reader**), so the
  first client and every later one are streamed from the first byte; nobody
  waits for the complete object.
- The flight keeps its own descriptor of the temp file until the last client
  has left, so late readers work even if the object was not stored.
- Flights run on a context that is independent of client requests: a client
  that disconnects does not abort a download others are waiting for. A queued
  flight that nobody waits for any more is abandoned before it starts.
- Concurrency is bounded (`download.max_concurrent`).
- **Retries / failover**: connection errors, 5xx, 429 and 404 try the next
  mirror; rounds are repeated with exponential backoff. A 404 from every
  mirror is a final answer, not an outage.
- **Resume**: if the body breaks, the rest is requested with `Range` and
  `If-Range` (strong ETag or Last-Modified). Only a `206` whose
  `Content-Range` continues at the exact offset is accepted. Anything else
  fails the flight: once bytes have been sent to clients, different content
  can never be glued on.
- **Completeness**: a body shorter than `Content-Length` is an error. A
  failed flight publishes nothing, and the client connection is aborted so a
  truncated chunked response cannot look complete.
- Limits: idle timeout, maximum object size (declared or streamed), shared
  upstream rate limit, per-response client rate limit.

## HTTP semantics of the proxy

| Situation | Behaviour | `X-Cache` |
|---|---|---|
| Entry fresh (immutable, or TTL not passed) | served from disk | `HIT` |
| No entry, this request starts the download | streamed while downloading | `MISS` |
| No entry, another request already downloads it | streamed from the same flight | `COALESCED` |
| Entry expired, upstream answers 304 | served from disk, lifetime extended | `REVALIDATED` |
| Entry expired, upstream has new content | new version streamed and stored | `MISS` |
| Entry expired, upstream unreachable or 5xx | old copy served (configurable) | `STALE` |
| Upstream 404 | 404, remembered briefly; an existing entry is dropped | `NEGATIVE` on repeats |

- Cached objects are served with `http.ServeContent`: `Range`, `If-Range`,
  `If-None-Match`, `If-Modified-Since`, `206`, `304` and `416` behave as on a
  static file server. The upstream's `ETag` and `Last-Modified` are passed on.
- A `Range` request for an uncached object waits for the complete download
  and is then answered from the blob.
- A `HEAD` for an uncached object triggers the download (it warms the cache).
- Upstream requests use `Accept-Encoding: identity`; stored bytes are exactly
  what the origin publishes.
- The client's query string, cookies and credentials are never forwarded.

## Statistics are measured

Byte counters come from the writer that sends data to a client and from the
download manager as data arrives. "Bandwidth saved" is the number of body
bytes actually delivered without an upstream transfer for that request;
partial and aborted transfers count with what was really sent. Counters are
kept in memory, flushed to SQLite every ten seconds (per-minute buckets and
lifetime totals) and survive restarts.

## Configuration layers

1. Built-in defaults, 2. the YAML file, 3. `UNICACHE_*` environment
variables. On top of that, two groups live in the database and are changed in
the web interface: modules/repositories/policies, and the *operational
settings* (cache size, free-space rule, rate limits, download concurrency,
maximum object size, log level). Operational settings are applied to the
running components without a restart: storage limits are an atomic value read
by eviction, the download concurrency is a resizable semaphore, rate limiters
are swapped atomically. Settings that define the security boundary (listen
address, TLS, client and admin networks, private upstreams, data directory)
are intentionally file-only.

## Extending UniCache

A path-based adapter is one small type (see [ADAPTERS.md](ADAPTERS.md)).
Protocols that are not "GET a path below a base URL" (OCI with its token
authentication and digests, for example) need their own handler on top of the
same storage and download APIs; that is the plan for the OCI adapter.
