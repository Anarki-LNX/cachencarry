# Client configuration

Replace `cachencarry.lan:8080` with the address of your Cache & Carry server. The
dashboard (Cache Modules) shows the snippet for every repository.

Clients talk plain HTTP to the cache; Cache & Carry talks HTTPS to the mirrors.
Package signatures are verified by the client exactly as before.

## Debian

`/etc/apt/sources.list.d/debian.sources`:

```
Types: deb
URIs: http://cachencarry.lan:8080/apt/debian
Suites: trixie trixie-updates
Components: main contrib non-free-firmware
Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg

Types: deb
URIs: http://cachencarry.lan:8080/apt/debian-security
Suites: trixie-security
Components: main contrib non-free-firmware
Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg
```

Classic one-line format (`/etc/apt/sources.list`):

```
deb http://cachencarry.lan:8080/apt/debian trixie main contrib non-free-firmware
deb http://cachencarry.lan:8080/apt/debian-security trixie-security main contrib non-free-firmware
```

Then run `apt update`.

## Ubuntu

`/etc/apt/sources.list.d/ubuntu.sources`:

```
Types: deb
URIs: http://cachencarry.lan:8080/apt/ubuntu
Suites: noble noble-updates noble-backports
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg

Types: deb
URIs: http://cachencarry.lan:8080/apt/ubuntu-security
Suites: noble-security
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg
```

## Proxmox VE hosts

A Proxmox host is a Debian system: point its Debian sources at
`/apt/debian` and `/apt/debian-security` as above. For the Proxmox
repositories add repositories to Cache & Carry (dashboard or configuration file):

| Name | Upstream |
|---|---|
| `proxmox` | `http://download.proxmox.com/debian/pve` |
| `proxmox-ceph` | `http://download.proxmox.com/debian/ceph-squid` |

and use `http://cachencarry.lan:8080/apt/proxmox` and `/apt/proxmox-ceph` in
`/etc/apt/sources.list.d/proxmox.sources` and `ceph.sources`. Tested on
Proxmox VE 9.2 with the no-subscription repository. The enterprise repository
needs credentials, which Cache & Carry does not forward; leave it pointing at
Proxmox directly.

If Cache & Carry runs in a container on that same host, the host can only update
while the container is running. Keep copies of the original source files so
the change is easy to undo.

## Docker's APT repositories

Add `docker-debian` (`https://download.docker.com/linux/debian`) or
`docker-ubuntu` (`https://download.docker.com/linux/ubuntu`) and use
`http://cachencarry.lan:8080/apt/docker-debian` in `docker.list` /
`docker.sources`. This caches the Docker packages, not container images.

## Other APT repositories

Add a repository in the dashboard (Repositories, Add): module `apt`, a name
such as `docker`, and the upstream base URL (the directory that contains
`dists/`), for example `https://download.docker.com/linux/debian`. Then use
`http://cachencarry.lan:8080/apt/docker` wherever the original URL was.

## Arch Linux

Put the cache first in `/etc/pacman.d/mirrorlist` and keep a real mirror
below it as a fallback:

```ini
Server = http://cachencarry.lan:8080/pacman/archlinux/$repo/os/$arch
Server = https://geo.mirror.pkgbuild.com/$repo/os/$arch
```

Then run `pacman -Syu`.

## CachyOS

CachyOS uses its own repositories in addition to the Arch ones. Put the cache
first in each mirrorlist and keep the existing entries below it:

`/etc/pacman.d/cachyos-mirrorlist`
```ini
Server = http://cachencarry.lan:8080/pacman/cachyos/$arch/$repo
```

`/etc/pacman.d/cachyos-v3-mirrorlist` (and `-v4` accordingly)
```ini
Server = http://cachencarry.lan:8080/pacman/cachyos/$arch_v3/$repo
```

`/etc/pacman.d/mirrorlist`
```ini
Server = http://cachencarry.lan:8080/pacman/archlinux/$repo/os/$arch
```

These URLs were tested with real CachyOS clients (`pacman -Syyu` and package
downloads). `NOTFOUND` for `core.db.sig`, `extra.db.sig` and
`multilib.db.sig` is normal: Arch does not sign its databases, pacman asks
anyway. Tools that regenerate the mirrorlists (`cachyos-rate-mirrors`) remove
the cache line; add it again afterwards. Repositories with their own `Server`
line in `/etc/pacman.conf` (for example `gnome-unstable`) need that line
changed separately.

## Checking that it works

```sh
curl -sI http://cachencarry.lan:8080/apt/debian/dists/trixie/InRelease | grep -i x-cache
```

`X-Cache: MISS` on the first request, `HIT` afterwards. The Live Traffic page
shows every request with its result.
