**Project Name:** Cache & Carry, a self-hosted package cache for your LAN

**Repo/Website Link:**

* Website: https://cachencarry.loopout.tech (animated explanation of how it works, real screenshots of the dashboard and all install commands)
* GitHub: https://github.com/Anarki-LNX/cachencarry

**Description:**

Every Linux box in my homelab downloaded the same updates from the Internet, again and again. Cache & Carry sits in your network and keeps every package your machines download. The first machine fetches an update from the mirror, every other machine gets it from the cache at LAN speed.

* **APT and Pacman:** Debian, Ubuntu, Proxmox VE, Docker's APT repos, Arch Linux and CachyOS behind one address. Tested with real clients on all of them.
* **One download for everyone:** if several machines ask for the same file at the same time, there is only one upstream download and all of them are streamed from it while it runs.
* **Package signatures stay intact:** no TLS interception, nothing to install on the clients, apt and pacman verify everything as usual. You only change one mirror line.
* **Live dashboard** in English and German: hit ratio, live traffic, clients, storage, running downloads. Cache size, bandwidth limits and policies can be changed while it runs.
* **Content-addressed storage** (SHA-256) with eviction, pinning, integrity checks and crash recovery.
* **Small:** one static Go binary with an embedded SQLite database. No database server, no Java, no Kubernetes. 2 cores and 1 GB RAM are plenty.

Example from my network: an 8.6 MiB package index took 959 ms from the Internet and 9 ms from the cache. Just one measurement, your numbers will differ.

Honest status: early release (v0.2.3). APT and Pacman are done and tested. Plain HTTP file servers are experimental. Container registries, npm, PyPI and RPM are on the roadmap, not built yet. The arm64 build has not run on real hardware yet. If you have a Pi lying around, I would love feedback.

**Deployment:** three ways, all with the same version (one release tag builds everything):

1. **Proxmox VE, one command** on the host. It creates an unprivileged Debian 13 LXC without nesting, checks the release against SHA256SUMS, installs it as a systemd service and prints the address and the setup token:

```
bash -c "$(curl -fsSL https://raw.githubusercontent.com/Anarki-LNX/cachencarry/main/scripts/proxmox-lxc.sh)"
```

Updating later: the same command with `-- update <CTID>`. Please read the script before you run it, it is about 300 lines of plain bash.

2. **Docker:** image on ghcr.io for amd64 and arm64 (distroless, about 16 MB), plus a hardened docker-compose.yml in the repo:

```
docker run -d -p 8080:8080 -v cachencarry-data:/var/lib/cachencarry ghcr.io/anarki-lnx/cachencarry:latest
```

3. **Debian or Ubuntu package** from the GitHub release:

```
tar xzf cachencarry-*-linux-amd64.tar.gz
cd cachencarry-*-linux-amd64
sudo ./scripts/install.sh
```

Then point a client at it, for example Arch Linux, first line of `/etc/pacman.d/mirrorlist`:

```
Server = http://<cache>:8080/pacman/archlinux/$repo/os/$arch
```

Full guide in DEPLOYMENT.md, client setup in docs/CLIENTS.md.

**AI Involvement:** A lot, and I want to be upfront about it. Most of the code, tests and docs were written with an AI coding assistant (Claude) under my direction. I defined what it should do, made the design decisions, reviewed the changes and tested everything on my own hardware: real Arch, CachyOS, Debian, Ubuntu and Proxmox clients, plus a test suite with the race detector and a Docker Compose run in CI. The project video uses a synthetic German voice (Piper TTS).

License: Apache 2.0. Feedback, bug reports and ideas for the next package formats are very welcome.
