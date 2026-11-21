# Client configuration

Replace `unicache.lan:8080` with the address of your UniCache server. The
dashboard (Cache Modules) shows the snippet for every repository.

Clients talk plain HTTP to the cache; UniCache talks HTTPS to the mirrors.
Package signatures are verified by the client exactly as before.

## Debian

`/etc/apt/sources.list.d/debian.sources`:

```
Types: deb
URIs: http://unicache.lan:8080/apt/debian
Suites: trixie trixie-updates
Components: main contrib non-free-firmware
Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg

Types: deb
URIs: http://unicache.lan:8080/apt/debian-security
Suites: trixie-security
Components: main contrib non-free-firmware
Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg
```

Classic one-line format (`/etc/apt/sources.list`):

```
deb http://unicache.lan:8080/apt/debian trixie main contrib non-free-firmware
deb http://unicache.lan:8080/apt/debian-security trixie-security main contrib non-free-firmware
```

Then run `apt update`.

## Ubuntu

`/etc/apt/sources.list.d/ubuntu.sources`:

```
Types: deb
URIs: http://unicache.lan:8080/apt/ubuntu
Suites: noble noble-updates noble-backports
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg

Types: deb
URIs: http://unicache.lan:8080/apt/ubuntu-security
Suites: noble-security
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg
```

## Proxmox VE hosts

A Proxmox host is a Debian system: point its Debian sources at
`/apt/debian` and `/apt/debian-security` as above. For the Proxmox
repositories themselves add a repository in the dashboard (module `apt`,
name `proxmox`, upstream `http://download.proxmox.com/debian/pve`) and use
`http://unicache.lan:8080/apt/proxmox` in the PVE source entry. Not tested
with the enterprise repository, which needs credentials (UniCache does not
forward credentials).

## Other APT repositories

Add a repository in the dashboard (Repositories, Add): module `apt`, a name
such as `docker`, and the upstream base URL (the directory that contains
`dists/`), for example `https://download.docker.com/linux/debian`. Then use
`http://unicache.lan:8080/apt/docker` wherever the original URL was.

## Arch Linux

Put the cache first in `/etc/pacman.d/mirrorlist` and keep a real mirror
below it as a fallback:

```ini
Server = http://unicache.lan:8080/pacman/archlinux/$repo/os/$arch
Server = https://geo.mirror.pkgbuild.com/$repo/os/$arch
```

Then run `pacman -Syu`.

## CachyOS

CachyOS uses its own repositories in addition to the Arch ones. Put the cache
first in each mirrorlist and keep the existing entries below it:

`/etc/pacman.d/cachyos-mirrorlist`
```ini
Server = http://unicache.lan:8080/pacman/cachyos/$arch/$repo
```

`/etc/pacman.d/cachyos-v3-mirrorlist` (and `-v4` accordingly)
```ini
Server = http://unicache.lan:8080/pacman/cachyos/$arch_v3/$repo
```

`/etc/pacman.d/mirrorlist`
```ini
Server = http://unicache.lan:8080/pacman/archlinux/$repo/os/$arch
```

The CachyOS layout was taken from the public mirror structure and has not yet
been run with a real CachyOS client. If a path is wrong, pacman falls back to
the next mirror; check Live Traffic in the dashboard for `NOTFOUND` entries.

## Checking that it works

```sh
curl -sI http://unicache.lan:8080/apt/debian/dists/trixie/InRelease | grep -i x-cache
```

`X-Cache: MISS` on the first request, `HIT` afterwards. The Live Traffic page
shows every request with its result.
