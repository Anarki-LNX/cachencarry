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
- Dashboard: `npm run lint` and `npm run build` pass. Checked in a browser
  against the live backend with real traffic: login, Dashboard, Cache
  Modules, Live Traffic (including a live update), Clients, Storage, System
  Health, enabling a module (a CSRF-protected write), light and dark theme,
  phone-width layout. Numbers matched the requests that were sent.
- Container: `docker build` succeeds (about 15 MB). The image was run with
  the same hardening as in `docker-compose.yml` (read-only root filesystem,
  all capabilities dropped, `no-new-privileges`, UID 65532, named volume):
  healthy after a few seconds, cache MISS then HIT, cache still there after a
  container restart, `setup-token` and `version` subcommands work.
- `make dist`: static amd64 and arm64 tarballs with checksums.
- `scripts/install.sh` / `uninstall.sh` from the release tarball in a clean
  Debian 13 container (with a stub in place of `systemctl`): user, directories
  and permissions created; the service starts as the `unicache` user and
  passes its health check; a second run keeps an edited configuration; an
  invalid configuration stops the upgrade before the restart; uninstall keeps
  data, `--purge` removes everything.
- `unicache check-config` against `configs/config.example.yaml`.

## Not verified yet

- **`docker compose up` itself.** The development machine's Docker daemon
  cannot create bridge networks ("operation not supported"), so Compose could
  not start the stack there. The image and its runtime options were tested
  with `docker run --network host` instead (see above); the Compose file's
  port publishing and bridge networking are untested.
- **The systemd unit under a real systemd**, including its sandboxing
  options, on Debian/Ubuntu and inside a Proxmox LXC.
- **Proxmox LXC** (native and Docker-in-LXC): not tested at all.
- Dashboard pages not opened in the browser check: Repositories, Downloads,
  Statistics, Policies, Settings, and the setup wizard. They build and lint,
  and their API endpoints are covered by the backend tests.
- CachyOS, Ubuntu, Manjaro, Linux Mint clients; TLS listener; reverse proxy
  setups; the GitHub Actions workflow.
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
