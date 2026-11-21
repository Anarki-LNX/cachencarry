# Competitive analysis

Checked on 2026-11-21 against the projects' own documentation and
repositories (links below). Where something could not be confirmed from an
official source it is marked **unverified** instead of guessed.

## Summary

| Project | Scope | Pacman | APT | OCI | Content-addressed dedup | Runtime dependencies | Dashboard |
|---|---|---|---|---|---|---|---|
| **UniCache** (v0.1) | LAN pull-through cache | yes | yes | planned | yes (SHA-256, across adapters) | none (single binary, SQLite embedded) | yes |
| Sonatype Nexus CE | artifact repository manager | no | yes | yes | unverified | JVM; PostgreSQL recommended | yes |
| Pulp | repository management and sync | no | yes | yes | yes (SHA-256 artifacts) | PostgreSQL + API, content and worker services | unverified |
| Harbor | OCI registry | no | no | yes | n/a (registry blobs) | PostgreSQL, Redis, several containers | yes |
| LanCache | game and update download cache | no | no | no | no (URL + 1 MB slice keys) | DNS takeover, nginx | no |
| Roxxy | caching HTTPS forward proxy | no | yes | yes | unverified | none (single binary), client CA required | yes |
| pkgly | package registry (hosted, proxy, virtual) | no | yes | yes | unverified | PostgreSQL | yes |
| apt-cacher-ng | APT caching proxy | via manual setup | yes | no | no | none | report page |
| pacoloco | Pacman cache | yes | no | no | not documented | none | no (Prometheus metrics) |

None of the surveyed tools lists Pacman together with APT and OCI.

## The projects

### Sonatype Nexus Repository Community Edition
- Proxy formats include APT, Docker/OCI, Maven, npm, PyPI, Yum, Go, Helm,
  NuGet, Cargo and many more; Pacman is not listed
  ([formats](https://help.sonatype.com/en/formats.html)).
- The free edition is limited to 40,000 components and 100,000 requests per
  day; above that, adding new components is paused
  ([CE onboarding](https://help.sonatype.com/en/ce-onboarding.html)).
- Java based; the smallest reference profile is 4 vCPU / 16 GiB, PostgreSQL
  recommended
  ([system requirements](https://help.sonatype.com/en/sonatype-nexus-repository-system-requirements.html)).
- **Strengths:** widest format coverage, mature UI, hosted repositories.
- **Weaknesses for a homelab:** heavy, hard usage caps, no Pacman.
- Unverified: whether identical content is deduplicated across repositories.

### Pulp
- Plugins for Debian, RPM, Container, Python, npm, Maven, Ansible, Gem, Rust
  and others; no Pacman plugin is listed ([pulpproject.org](https://pulpproject.org/)).
- Download policies `immediate`, `on_demand` and `streamed`
  ([on-demand downloading](https://pulpproject.org/pulpcore/docs/user/learn/on-demand-downloading/)).
- Artifacts are stored by SHA-256, so storage is content-addressed and
  deduplicated ([storage model](https://github.com/pulp/pulpcore/blob/main/pulpcore/app/models/storage.py)).
- Needs PostgreSQL and separate API, content and worker services
  ([architecture](https://pulpproject.org/pulpcore/docs/admin/learn/architecture/)).
- **Strengths:** real deduplication, repository versioning, sync and publish
  workflows.
- **Weaknesses for a homelab:** repository-management model rather than a
  transparent pull-through cache; multi-service deployment; no Pacman.

### Harbor
- Apache-2.0, CNCF graduated; a registry for container images and OCI
  artifacts ([repository](https://github.com/goharbor/harbor)).
- Proxy-cache projects for Docker Hub, GHCR, Quay, ECR, GCR, ACR and others
  ([proxy cache](https://goharbor.io/docs/main/administration/configure-proxy-cache/)).
- Minimum 2 CPU / 4 GB / 40 GB; bundles PostgreSQL, Redis and Distribution
  ([prerequisites](https://goharbor.io/docs/main/install-config/installation-prereqs/)).
- **Strengths:** several upstream registries in one instance, UI, RBAC,
  scanning.
- **Weaknesses for a homelab:** OCI only, multi-container stack.

### LanCache
- `lancache-dns` must be the clients' DNS server and redirects CDN host names
  to the cache ([docs](https://lancache.net/docs/)).
- Covers the services in the uklans cache-domains list (Steam, Epic,
  Battle.net, Riot, Windows Update, …)
  ([monolithic](https://lancache.net/docs/containers/monolithic/)).
- HTTPS is not cached; port 443 is passed through
  ([FAQ](https://lancache.net/docs/faq/)).
- nginx cache keyed by URL and 1 MB slice, not content-addressed
  ([cache key](https://github.com/lancachenet/monolithic/blob/master/overlay/etc/nginx/sites-available/cache.conf.d/root/30_cache_key.conf)).
- No management UI is documented; access logs and nginx `stub_status`.
- **Strengths:** zero client configuration, the established solution for
  game downloads.
- **Weaknesses:** HTTP only, DNS takeover, no dashboard, not meant for
  package repositories.

### Roxxy
- Best match found: [Delphos-Labs/roxxy](https://github.com/Delphos-Labs/roxxy),
  "Caching HTTPS proxy and airgap artifact tooling" (Go, Apache-2.0). This is
  the only repository of that name matching the description; it is assumed,
  not confirmed, to be the project meant.
- A forward proxy (`HTTP_PROXY`) with TLS interception: every client must
  install its CA certificate (listed as a limitation in its README).
- Covers Docker registries, APT, APK, npm, PyPI and Go modules; no Pacman.
  Built-in UI, airgap tooling.
- Very young (first tags in late 2026).
- **Strengths:** single binary, UI, airgap mode, no per-client repository
  configuration beyond the proxy setting.
- **Weaknesses:** TLS interception with a private CA on every client.
- Unverified: content addressing and deduplication.

### pkgly
- [kshcherban/pkgly](https://github.com/kshcherban/pkgly): Rust backend,
  Vue UI, MIT; hosted, proxy and virtual repositories for Debian, Python,
  Maven, Docker/OCI, Helm, Go, npm, NuGet, RubyGems, Composer, Cargo; no
  Pacman. Requires PostgreSQL.
- **Strengths:** full registry with hosted repositories, ACLs, SSO.
- **Weaknesses for this use case:** a registry manager with a database
  server, early stage, not a LAN cache.
- Unverified: per-format proxy details and deduplication.

### Single-ecosystem caches
- **apt-cacher-ng**: proven APT caching proxy
  ([manual](https://www.unix-ag.uni-kl.de/~bloch/acng/html/index.html)).
  HTTPS repositories need remapping workarounds; maintenance is driven from a
  report page.
- **pacoloco**: Go, MIT, Pacman only; prefetching, multiple repositories,
  Prometheus metrics, no UI ([repository](https://github.com/anatol/pacoloco)).
- **Distribution (registry) pull-through mode**: one upstream registry per
  instance ([mirror recipe](https://distribution.github.io/distribution/recipes/mirror/)).

### Windows
- **Delivery Optimization** already does peer-to-peer distribution between
  Windows machines in the same LAN, enabled by default
  ([docs](https://learn.microsoft.com/en-us/windows/deployment/do/waas-delivery-optimization)).
- **Microsoft Connected Cache** is offered for ISPs and for
  Enterprise/Education tenants, managed through Azure and requiring
  Enterprise/Education licensing
  ([prerequisites](https://learn.microsoft.com/en-us/windows/deployment/do/mcc-ent-prerequisites)).
  It is not available to Home/Pro homelab users.

## What this means for UniCache

**Build ourselves** (clear advantage from one core):
- The storage engine, download manager, statistics and dashboard.
- APT and Pacman adapters (simple "GET a path" protocols, no mature
  single tool covers both).
- An OCI pull-through adapter: registries are content-addressed by SHA-256
  already, so layers fit the storage engine naturally, and one instance can
  serve several upstream registries.
- Later npm, PyPI, RPM, Maven: metadata needs URL rewriting, which is
  adapter-specific work, not core work.

**Integrate instead of rebuild:**
- **Games:** LanCache. Its DNS + nginx design solves a different problem
  (unmodifiable clients, proprietary CDNs). UniCache should deploy and
  configure it, read its logs for statistics and show its disk usage. Its
  cache cannot share the content-addressed store (slice-keyed nginx cache);
  the unified part is management and monitoring, and the documentation must
  say so.
- **Windows:** documentation and monitoring for Delivery Optimization
  first. No WSUS replacement is promised.

**Realistic differentiation:**
1. One small binary without a database server, JVM or container stack.
2. Pacman and APT (and later OCI) behind one dashboard and one storage quota.
3. Content-addressed deduplication across adapters with visible savings.
4. No TLS interception and no client CA: explicit, protocol-specific
   endpoints that keep package signature verification untouched.
5. Statistics that are measured, not estimated.

**Where others are better, and will stay better:** format breadth (Nexus),
repository lifecycle management (Pulp), registry features such as RBAC and
scanning (Harbor), zero-configuration game caching (LanCache).
