# TODO and verification status

Honest record of what was actually executed for v0.1 and what was not.

## Verified (executed)

- `go vet ./...`, `gofmt`: clean.
- `go test ./...` and `go test -race -count=1 ./...`: all packages pass
  (CAS, storage, download manager, statistics, config, adapters, security,
  database, end-to-end suite against mock mirrors).
- Real `apt` (Debian 13 container): `apt-get update` and package download
  through the cache with signature verification on; a second client was
  served 100 % from the cache; upstream bytes equalled saved bytes exactly.
- Real `pacman` (Arch Linux container, `SigLevel = Required`): database sync
  and package download; second client served from the cache.
- `docker build` of the image succeeds (15.5 MB image).
- `unicache check-config` against `configs/config.example.yaml`.

## Not verified yet

- **Docker Compose run.** The image builds, but `docker compose up` could not
  be executed on the development machine (its Docker daemon cannot create
  bridge networks: "operation not supported", IPv4 forwarding disabled). The
  container start, health check, read-only root filesystem and volume
  permissions are therefore untested.
- **Web dashboard.** Built by a separate work step; its final lint/build
  result and its behaviour against the live backend were not reviewed before
  this record was written. Treat it as unreviewed.
- **Native install script** (`scripts/install.sh`, systemd unit): only
  syntax-checked, never run on a clean Debian/Ubuntu system.
- **Proxmox LXC** (native and Docker-in-LXC): not tested at all.
- CachyOS, Ubuntu, Manjaro, Linux Mint clients; TLS listener; reverse proxy
  setups; `make dist`; the GitHub Actions workflow.
- Performance and memory under load on small hardware.

## Not implemented

- OCI / Docker / Podman, npm, PyPI, RPM, Maven adapters.
- LanCache and Windows update integrations.
- Multiple storage volumes, RBAC, private upstream repositories, PostgreSQL,
  Prometheus metrics, prefetching, native packages.

## Known weaknesses

- Storage accounting queries scan the tables on every dashboard refresh;
  fine for homelab sizes, should be cached for very large caches.
- A `HEAD` or `Range` request for an uncached object downloads the whole
  object first.
- Temp files of running downloads are not counted against `max_size`.
- Client access control is by IP address only.
