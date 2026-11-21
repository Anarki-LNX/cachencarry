# Roadmap

Priorities, in this order: reliability, simple deployment, shared storage
where it makes sense, unified monitoring, homelab experience, extensibility,
and only then more protocols. A feature moves to "done" when it has tests and
has been run against the real client.

## v0.1 (this release): core MVP

- [x] Shared content-addressed storage (dedup, GC, LRU eviction, pinning,
      verification, crash recovery)
- [x] Download manager (coalescing, streaming, resume, failover, limits)
- [x] APT and Pacman adapters, generic HTTP adapter (experimental)
- [x] Management API, authentication, audit log, live events
- [x] Web dashboard with setup wizard
- [x] Docker Compose and systemd deployment, install scripts
- [x] Unit and end-to-end tests, race detector clean

## v0.2: harden what exists

- [x] Verify the Proxmox LXC guide on a real host (native install done, Docker-in-LXC still open)
- [ ] Run install/upgrade/uninstall on clean Debian 13 and Ubuntu LTS in CI
- [ ] Published container image (GHCR) and release tarballs with checksums
- [ ] Test with Manjaro and Linux Mint clients
- [ ] Load test on a 2-core / 2 GB machine; document numbers
- [ ] Prometheus `/metrics` endpoint
- [ ] Optional prefetch of updates for packages already in the cache
- [ ] Cache the storage accounting queries for very large caches
- [x] German translation of the dashboard with a language switch
- [x] Operational settings editable in the dashboard
- [x] Tested with real CachyOS, Ubuntu, Debian 12 and Proxmox clients

## v0.3: OCI pull-through

- [ ] OCI Distribution pull-through for Docker Hub, GHCR, Quay and custom
      registries in one instance
- [ ] Upstream token authentication (anonymous pulls first)
- [ ] Tags are mutable (revalidated), digests immutable; layers stored as
      blobs in the shared store
- [ ] Tested with Docker and Podman
- [ ] Evaluate what Harbor integration could add for people who already run it

## v0.4: language registries

- [ ] npm (metadata rewriting, scoped packages, tarballs)
- [ ] PyPI (PEP 503 / PEP 691 simple API, wheels and sdists)
- [ ] RPM / DNF (repodata revalidation, mirrorlist handling)
- [ ] Maven (releases immutable, snapshots and `maven-metadata.xml` mutable)

## v0.5: integrations

- [ ] LanCache: deploy and configure it from Cache & Carry, parse its access logs
      into the statistics, show its disk usage. Its nginx slice cache stays
      separate from the content-addressed store; unified means management and
      monitoring.
- [ ] Windows: documentation and monitoring for Delivery Optimization.
      No WSUS replacement is planned.

## Later

- [ ] Multiple storage volumes
- [ ] Role-based access control (read-only role)
- [ ] Private upstream repositories with per-repository credentials and
      strict isolation
- [ ] PostgreSQL as an optional metadata backend
- [ ] Native packages (`.deb`, AUR)
- [ ] Third-party adapters without rebuilding the binary

## Not planned

- TLS interception / SSL-Bump as a caching mechanism
- Hosted repositories and publishing workflows
- A commercial edition with withheld features
