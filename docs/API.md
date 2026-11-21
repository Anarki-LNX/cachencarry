# Management API

Base path `/api/v1`. JSON in and out. Errors are `{"error": "message"}` with a
4xx or 5xx status.

## Access and authentication

- Only addresses in `security.admin_allowed` reach the API
  (`/api/v1/health` is open for health checks).
- `POST /login` sets the session cookie `unicache_session` (HttpOnly,
  SameSite=Strict) and returns a CSRF token.
- Every `POST`, `PUT` and `DELETE` (except `/login` and `/setup`) must send
  that token in the header `X-CSRF-Token`.
- Bodies must be `Content-Type: application/json`, at most 64 KiB, without
  unknown fields.
- Rate limits per client address: 10 login or setup attempts per 5 minutes,
  600 API requests per minute. Exceeding them returns 429.

```sh
B=http://unicache.lan:8080/api/v1
CSRF=$(curl -s -c jar -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"…"}' $B/login | jq -r .csrf)
curl -s -b jar $B/stats | jq .totals
curl -s -b jar -X POST -H "X-CSRF-Token: $CSRF" $B/modules/generic/enable
```

## Endpoints

### Session

| Method | Path | Description |
|---|---|---|
| GET | `/health` | `{"status":"ok"}`; 503 when the database is unavailable. Also at `/healthz` |
| GET | `/session` | `setup_required`, `setup_token_required`, `authenticated`, `version`, and for a session `user`, `csrf` |
| POST | `/setup` | `{username, password, token}`: create the first administrator (only while none exists) |
| POST | `/login` | `{username, password}` → `{authenticated, user, csrf}` |
| POST | `/logout` | end the session |
| POST | `/account/password` | `{current, new}`; ends all sessions of the user |

### Monitoring

| Method | Path | Description |
|---|---|---|
| GET | `/system` | version, uptime, memory, health checks, last maintenance reports |
| GET | `/stats` | lifetime counters (total and per module), hit ratio, bytes saved, storage usage, active downloads and clients, throughput of the last 120 s |
| GET | `/stats/history?range=1h\|6h\|24h\|7d\|30d&module=` | time buckets of the counters |
| GET | `/requests?module=&client=&status=&limit=` | recent requests, newest first |
| GET | `/clients` | known clients with request, hit and byte counts |
| GET | `/downloads` | upstream downloads in progress |
| DELETE | `/downloads/{id}` | cancel a download |
| GET | `/events` | Server-Sent Events: `request` (one per finished request) and `tick` (every second: throughput, totals, active downloads) |
| GET | `/audit?limit=` | audit log, newest first |

Counters: `hits`, `misses`, `revalidated`, `errors`, `bytes_cache` (sent to
clients without an upstream transfer, i.e. bandwidth saved), `bytes_origin`
(sent to clients while downloading), `bytes_upstream` (received from
upstream). `hits` includes coalesced and stale responses.

### Modules and repositories

| Method | Path | Description |
|---|---|---|
| GET | `/modules` | adapters with state, repositories, client configuration snippets, counters, usage, last error |
| POST | `/modules/{name}/enable`, `/modules/{name}/disable` | switch a module |
| POST | `/modules/{name}/test` | check that every upstream is reachable |
| GET | `/repositories?module=` | list repositories |
| POST | `/repositories` | `{module, name, upstreams: [url]}` → 201; 400 invalid; 409 exists |
| PUT | `/repositories/{id}` | `{upstreams?, enabled?}` |
| DELETE | `/repositories/{id}` | remove the repository and release its cached objects |

Repository names: 1 to 63 characters of `a-z 0-9 . _ -`, starting with a
letter or digit. Upstreams: absolute `http`/`https` URLs without credentials,
query or fragment; at most 16.

### Storage

| Method | Path | Description |
|---|---|---|
| GET | `/storage` (alias `/storage/stats`) | usage (blobs, entries, dedup savings, disk, limits, per module) and maintenance reports |
| GET | `/storage/blobs?module=&repo=&q=&pinned=1&sort=recent\|size\|hits&limit=&offset=` | cached objects |
| POST | `/storage/entries/{id}/pin`, `/unpin` | protect an object from eviction |
| DELETE | `/storage/entries/{id}` | remove an object from the cache |
| POST | `/storage/gc` | run eviction and garbage collection now |
| POST | `/storage/verify` | verify the next batch of blobs now |

### Policies and settings

| Method | Path | Description |
|---|---|---|
| GET | `/policies` | runtime cache policy |
| PUT | `/policies` | `{metadata_ttl_seconds, negative_ttl_seconds, serve_stale_on_error, module_ttl_seconds: {module: seconds}}`; applied immediately and persisted |
| GET | `/settings` | effective configuration without secrets; `runtime` holds the editable part as `{values, defaults, overridden}` |
| PUT | `/settings/runtime` | `{max_size, min_free_space, upstream_rate_limit, client_rate_limit, max_concurrent, max_object_size, log_level}`; applied immediately and persisted |
| DELETE | `/settings/runtime` | drop the saved values and return to the configuration file |

The exact response shapes are defined by the handlers in
[`internal/api`](../internal/api) and exercised by the API tests in
[`tests/e2e_test.go`](../tests/e2e_test.go). The API is versioned; fields may
be added within v1 but not removed or changed.
