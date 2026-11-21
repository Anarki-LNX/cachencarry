# Cache & Carry

**The universal cache for homelabs, self-hosting and small networks.**

Cache & Carry is a single, small server that keeps the packages your machines
download, so the second computer in your network gets them from the LAN
instead of the Internet. One binary, one storage directory, one dashboard.

```
 Debian server ─┐                       ┌─ deb.debian.org
 Ubuntu laptop ─┤   ┌──────────────┐    ├─ archive.ubuntu.com
 Arch desktop  ─┼──▶│   Cache & Carry   │───▶├─ geo.mirror.pkgbuild.com
 CachyOS PC    ─┘   │ one cache    │    └─ mirror.cachyos.org
                    │ one dashboard│
                    └──────────────┘
```

> **Project status: early (v0.1, MVP).** The core and the APT and Pacman
> adapters are implemented and tested, including with real `apt` and `pacman`
> clients. Everything else is on the [roadmap](ROADMAP.md). The table below
> and [TODO.md](TODO.md) say exactly what is tested and what is not.

## What it does

| Feature | Status |
|---|---|
| **Shared content-addressed storage**: SHA-256, deduplication across repositories and adapters, atomic publication, reference tracking, garbage collection, LRU eviction, pinning, integrity verification, crash recovery | implemented, tested |
| **Request coalescing**: ten clients asking for the same uncached file cause one upstream download, and all of them are streamed while it runs | implemented, tested |
| **Resume** of interrupted upstream downloads (Range + If-Range), mirror failover, retries with backoff | implemented, tested |
| **APT** (Debian, Ubuntu and derivatives) | implemented, tested with real `apt` on Debian 13 |
| **Pacman** (Arch Linux, CachyOS and derivatives) | implemented, tested with real `pacman` on Arch Linux |
| **Generic HTTP** cache for configured hosts, honouring `Cache-Control` | experimental, tested against mock servers |
| **Web dashboard** with live traffic (Server-Sent Events) | implemented |
| **Management REST API** with sessions, CSRF protection, rate limiting, audit log | implemented, tested |
| Docker Compose deployment, native systemd deployment | implemented (see TODO.md for what was verified) |
| OCI / Docker / Podman, npm, PyPI, RPM, Maven | **planned**, not implemented |
| Game caching (LanCache integration), Windows updates | **planned**, not implemented |

## What it is not

- **Not an enterprise artifact repository.** No hosted or private
  repositories, no publishing, no fine-grained RBAC. Use Nexus, Artifactory or
  Pulp for that.
- **Not a transparent or forward proxy.** Cache & Carry never intercepts TLS and
  only talks to upstreams an administrator configured. Clients are pointed at
  it explicitly (one line in `sources.list` or `mirrorlist`).
- **Not a trust anchor.** Repository signatures pass through byte for byte.
  `apt` and `pacman` keep verifying them against their own keyrings exactly as
  before.

[COMPETITIVE_ANALYSIS.md](COMPETITIVE_ANALYSIS.md) explains how it relates to
apt-cacher-ng, pacoloco, Nexus, Pulp, Harbor, LanCache and others.

## Quick start (Docker Compose)

```sh
git clone https://github.com/Anarki-LNX/cachencarry.git
cd cachencarry
cp .env.example .env          # set CACHENCARRY_ADMIN_PASSWORD (min. 10 characters)
docker compose up -d --build
```

Open `http://<host>:8080`, log in as `admin`, and point a client at the cache:

```
# Debian 13: /etc/apt/sources.list.d/debian.sources
Types: deb
URIs: http://<host>:8080/apt/debian
Suites: trixie trixie-updates
Components: main contrib non-free-firmware
Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg
```

```ini
# Arch Linux: first line of /etc/pacman.d/mirrorlist
Server = http://<host>:8080/pacman/archlinux/$repo/os/$arch
```

The dashboard shows a ready-to-paste snippet for every repository. More
examples (Ubuntu, CachyOS, security repositories) are in
[docs/CLIENTS.md](docs/CLIENTS.md).

## Quick start (native, Debian/Ubuntu, also inside a Proxmox LXC)

```sh
# building needs Go >= 1.27 and Node.js >= 20
make build
sudo ./scripts/install.sh
su -s /bin/sh cachencarry -c '/usr/local/bin/cachencarry setup-token'     # enter this in the web setup wizard
```

Configuration lives in `/etc/cachencarry/config.yaml`, data in
`/var/lib/cachencarry`. Full instructions, upgrades, backups and the Proxmox LXC
guide are in [DEPLOYMENT.md](DEPLOYMENT.md).

## How it works, in one paragraph

Every object is downloaded once into a temporary file, hashed with SHA-256
while it streams to the waiting clients, fsynced, and atomically renamed to
`blobs/ab/cd/<sha256>`. A metadata database (SQLite) maps
`(module, repository, path)` to that blob together with the upstream's
validators. Packages are immutable and served from disk; repository indexes
are revalidated with conditional requests after a short TTL. Identical content
is stored once, no matter how many repositories or adapters reference it.
Details are in [ARCHITECTURE.md](ARCHITECTURE.md).

## Documentation

| Document | Content |
|---|---|
| [DEPLOYMENT.md](DEPLOYMENT.md) | Docker, native systemd, Proxmox LXC, upgrades, backup |
| [docs/CLIENTS.md](docs/CLIENTS.md) | Client configuration for every adapter |
| [ADAPTERS.md](ADAPTERS.md) | What each adapter caches and how; writing a new adapter |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Storage engine, download manager, concurrency model |
| [SECURITY.md](SECURITY.md) | Threat model, defaults, reporting vulnerabilities |
| [docs/API.md](docs/API.md) | REST API reference |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common problems |
| [ROADMAP.md](ROADMAP.md), [TODO.md](TODO.md) | What comes next, what is unfinished or unverified |
| [COMPETITIVE_ANALYSIS.md](COMPETITIVE_ANALYSIS.md) | Related projects and where Cache & Carry fits |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development setup and rules |

## Building and testing

```sh
make test     # unit + end-to-end tests against local mock mirrors (no Internet)
make race     # the same with the race detector
make build    # frontend + single static binary in bin/cachencarry
make docker   # container image
```

## License

[Apache License 2.0](LICENSE). Third-party components and their licenses are
listed in [NOTICE.md](NOTICE.md).
