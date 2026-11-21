# Adapters

An adapter teaches UniCache one ecosystem. Clients reach a repository at

```
http://<unicache>:8080/<module>/<repository>/<path as on the mirror>
```

| Module | Status | Tested with |
|---|---|---|
| `apt` | implemented, tested | unit tests, mock-mirror end-to-end tests, real `apt` on Debian 13 (update + download, signature verification on) |
| `pacman` | implemented, tested | unit tests, mock-mirror end-to-end tests, real `pacman` on Arch Linux (`SigLevel = Required`) |
| `generic` | experimental | unit tests, mock-server end-to-end tests |
| OCI, npm, PyPI, RPM, Maven | planned | not implemented |
| LanCache (games), Windows | planned as integrations | not implemented |

Client configuration for each module is in [docs/CLIENTS.md](docs/CLIENTS.md).

## apt

Upstream: the archive base URL, the directory containing `dists/` and `pool/`.

| Path | Treated as | Why |
|---|---|---|
| `pool/…` | immutable | file names carry package, version and architecture |
| `…/by-hash/…` | immutable | the name is the content hash (Acquire-By-Hash) |
| everything else (`dists/…`: `InRelease`, `Release`, `Release.gpg`, `Packages*`, `Sources*`, `Contents*`, `Translation*`) | mutable | revalidated after `metadata_ttl` |

Notes:
- Nothing is modified. `InRelease` and `Release.gpg` are byte-identical to the
  mirror, so apt verifies them with its own keyring.
- Debian and Ubuntu publish indexes by hash, and apt fetches them that way.
  This is what prevents "Hash Sum mismatch" errors when an index changes
  between `InRelease` and `Packages`: the by-hash file named in the signed
  `InRelease` is immutable. Repositories without by-hash can show that error
  for up to `metadata_ttl`; lower the TTL for the module if you use one.
- Not tested: Linux Mint, third-party repositories, `apt` over HTTPS to the
  cache, `debian-installer` netboot files.

## pacman

Upstream: the mirror base URL up to, not including, `$repo/os/$arch`.

| Path | Treated as |
|---|---|
| `*.pkg.tar.*` and their `.sig` | immutable |
| `*.db`, `*.files`, `*.db.tar.*`, `*.files.tar.*` and their `.sig` | mutable |
| everything else | mutable |

Notes:
- Signatures pass through unchanged; `SigLevel` keeps working.
- Several upstreams act as failover mirrors (tried in order, also when one
  mirror answers 404 because it has not synced yet).
- Keep at least one real mirror below the cache line in `mirrorlist` so
  updates still work when the cache is down.
- Not tested: Manjaro, pacman's parallel downloads at high concurrency against
  slow mirrors, `pacman -Fy` (files databases are large but work the same way).

## generic (experimental)

A plain HTTP cache for static files from configured servers. It is **not** a
forward proxy.

- Responses are stored only if the upstream allows a shared cache to do so:
  not `no-store`, not `private`, no `Set-Cookie`, no `Vary` other than
  `Accept-Encoding`. `s-maxage`, `max-age`, `Expires` and `Age` determine the
  lifetime; without them `metadata_ttl` applies; `no-cache` means "store, but
  revalidate every time".
- Requests carrying `Authorization` or `Cookie` are refused with 403.
- Disabled by default.

## Writing an adapter

A path-based adapter implements three methods
([`internal/adapters/adapter.go`](internal/adapters/adapter.go)):

```go
type Adapter interface {
    Info() Info                                // name, title, description, maturity
    Classify(path string) Class                // Immutable, Mutable or Reject (+ TTL, content type)
    ClientConfig(baseURL, repo string) string  // snippet shown in the dashboard
}
```

Optional interfaces:
- `ResponsePolicy`: decide per upstream response whether it may be stored
  (see the generic adapter).
- `RequestPolicy`: refuse client requests (for example ones with credentials).

Register it in `adapters.Builtin()`. Storage, deduplication, coalescing,
streaming, resume, eviction, statistics, access control and the dashboard then
work without further code. An adapter must never open files or talk to the
database.

Rules for a new adapter:
1. Classify conservatively: when in doubt, mutable. A wrongly immutable
   object is served stale forever.
2. Never rewrite signed content.
3. Add classification unit tests and an end-to-end test with a mock upstream
   (`tests/e2e_test.go` has helpers).
4. Mark it `Experimental` until it has been run against the real client.
5. Document client configuration and what was and was not tested.

Protocols that need more than "GET a path" (OCI: `/v2/` at the host root,
bearer-token authentication, digests versus tags) will get their own handler
on top of `storage` and `download`; the interface for that will be defined
together with the OCI adapter.
