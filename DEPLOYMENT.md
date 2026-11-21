# Deployment

Three supported ways to run UniCache. All use the same binary, the same
configuration format and the same data layout.

| Method | Verified for v0.1 |
|---|---|
| [Docker Compose](#docker-compose) | image built and run with the Compose hardening options; `docker compose up` itself could not be run on the development machine |
| [Native with systemd](#native-installation-debian-ubuntu) | install, upgrade and uninstall scripts run in a clean Debian 13 container; the unit was not run under a real systemd |
| [Proxmox LXC](#proxmox-lxc) | native install tested on Proxmox VE 9.2 in an unprivileged Debian 13 container without nesting; Docker-in-LXC and host bind mounts not tested |

Details: [TODO.md](TODO.md).

## Requirements

| | Minimum | Comfortable |
|---|---|---|
| CPU | 1 core | 2 cores |
| RAM | 256 MB | 1 GB |
| Disk | what you want to cache, plus 10 % free | SSD or HDD both work |
| Network | reachable from the clients on one TCP port (default 8080) | 1 Gbit/s |

UniCache streams files and never loads them into memory. Memory use is
dominated by the SQLite page cache and the number of parallel transfers.

Outgoing: HTTP/HTTPS to the configured mirrors. Incoming: the one listen port,
from your LAN only. **Do not expose it to the Internet.**

## Docker Compose

```sh
git clone https://github.com/Anarki-LNX/unicache.git
cd unicache
cp .env.example .env
```

Edit `.env`:

```sh
UNICACHE_ADMIN_PASSWORD=choose-a-long-password   # first start only, min. 10 characters
UNICACHE_DATA_DIR=/srv/unicache                  # optional bind mount (default: named volume)
UNICACHE_MAX_SIZE=500GB                          # optional
```

For a bind mount the directory must be writable for the container user
(UID/GID 65532):

```sh
sudo mkdir -p /srv/unicache && sudo chown 65532:65532 /srv/unicache
```

Start:

```sh
docker compose up -d --build
docker compose ps          # STATUS should become "healthy"
docker compose logs -f
```

Open `http://<host>:8080` and log in as `admin`. If you left the password
empty, the setup wizard asks for a one-time token:

```sh
docker compose exec unicache unicache setup-token
```

The container runs as an unprivileged user with a read-only root filesystem,
all capabilities dropped and `no-new-privileges`. It needs neither host
networking nor privileged mode.

**Optional configuration file:** copy `configs/config.example.yaml` to
`configs/config.yaml` and edit it; it is mounted read-only to `/etc/unicache`.
Environment variables win over the file.

**Client addresses.** With the default bridge network, clients normally appear
with their real LAN address. With rootless Docker or the userland proxy they
all appear as the bridge gateway (172.x), which is inside the default allowed
range, but the Clients page then shows one client. If per-client statistics or
a stricter `allowed_clients` matter, use the native installation.

### Upgrade

```sh
git pull
docker compose up -d --build
```

The database schema is migrated automatically at start. Your `.env`,
`configs/config.yaml` and the data volume are not touched.

## Native installation (Debian, Ubuntu)

Build (on any machine with Go ≥ 1.27 and Node.js ≥ 20; the binary is static
and can be copied to the target):

```sh
make build            # bin/unicache
# or release tarballs for amd64 and arm64:
make dist
```

Install on the target, from the repository or an unpacked release tarball:

```sh
sudo ./scripts/install.sh            # or: sudo ./scripts/install.sh /path/to/unicache
```

The script:
- creates the system user and group `unicache`;
- installs `/usr/local/bin/unicache`;
- creates `/etc/unicache/config.yaml` from the example **only if it does not
  exist**, and always refreshes `/etc/unicache/config.example.yaml`;
- creates `/var/lib/unicache` (data) and `/var/log/unicache`;
- validates the configuration, installs the hardened systemd unit, enables
  and starts it.

First login:

```sh
sudo -u unicache unicache setup-token       # paste into the web setup wizard
```

or set the password before the first start in `/etc/unicache/unicache.env`
(mode `0640`, owner `root:unicache`):

```sh
UNICACHE_SECURITY_ADMIN_PASSWORD=choose-a-long-password
```

Day to day:

```sh
systemctl status unicache
journalctl -u unicache -f
sudoedit /etc/unicache/config.yaml && sudo unicache check-config && sudo systemctl restart unicache
```

**Cache on another disk:** set `storage.path` (for example `/mnt/cache`), give
the directory to the service user and allow it in the unit:

```sh
sudo install -d -o unicache -g unicache -m 0750 /mnt/cache
sudo systemctl edit unicache
#   [Service]
#   ReadWritePaths=/mnt/cache
sudo systemctl restart unicache
```

**Logs** go to the journal. To also write a file, set
`logging.file: /var/log/unicache/unicache.log` (use logrotate with
`copytruncate` if you do).

### Upgrade

Build or download the new binary and run the installer again:

```sh
sudo ./scripts/install.sh /path/to/new/unicache
```

It replaces the binary atomically, keeps your configuration, checks it against
the new version **before** restarting, and restarts the service. If the check
fails the old process keeps running.

### Removal

```sh
sudo ./scripts/uninstall.sh            # keeps /etc/unicache and /var/lib/unicache
sudo ./scripts/uninstall.sh --purge    # removes everything including the cache
```

### Other distributions

The binary is static and has no library dependencies; the unit file and
install script only need systemd and the usual `useradd`/`install` tools, so
Arch Linux, CachyOS, Fedora and openSUSE should work the same way. That has
not been tested.

## Proxmox LXC

> The native installation below was tested on Proxmox VE 9.2 with an
> unprivileged Debian 13.6 container, **without nesting**, and the cache on a
> separate `mp0` volume: the hardened systemd unit started unchanged and
> survived a container reboot. The Docker-in-LXC and host bind mount variants
> are written from documentation and were not tested.

**Recommended: native installation inside an unprivileged Debian 13
container.** UniCache needs no special kernel features, capabilities or
devices, so the default unprivileged container is enough. Docker inside the
container is possible but adds a layer with nothing gained.

### Create the container

| Setting | Value |
|---|---|
| Template | Debian 13 (trixie) standard |
| Unprivileged | yes |
| Nesting | not needed for the native install (needed for Docker) |
| Cores / RAM | 2 / 1024 MB (512 MB works for small networks) |
| Root disk | 4 GB is enough for the system |
| Cache | a separate mount point, sized for your cache |
| Network | static IP or DHCP reservation in your LAN |

Example on the Proxmox host (adapt storage names, ID and addresses):

```sh
pveam update && pveam download local debian-13-standard_13.6-1_amd64.tar.zst
pct create 120 local:vztmpl/debian-13-standard_13.6-1_amd64.tar.zst \
  --hostname unicache --unprivileged 1 --cores 2 --memory 1024 --swap 512 \
  --rootfs local-lvm:4 --mp0 local-lvm:200,mp=/var/lib/unicache \
  --net0 name=eth0,bridge=vmbr0,ip=192.168.1.20/24,gw=192.168.1.1 \
  --onboot 1
pct start 120
```

A volume created with `--mp0 <storage>:<size>` is owned by the container, so
permissions inside just work.

### Install

Build on another machine (`make dist`), copy the tarball into the container,
then:

```sh
pct enter 120
apt update && apt install -y ca-certificates
tar xzf unicache-*-linux-amd64.tar.gz && cd unicache-*-linux-amd64
./scripts/install.sh
sudo -u unicache unicache setup-token    # or: su -s /bin/sh unicache -c 'unicache setup-token'
```

### Bind-mounting a host directory instead

If the cache should live in a directory of the Proxmox host
(`--mp0 /tank/unicache,mp=/var/lib/unicache`), UID mapping matters: in an
unprivileged container, UID *n* inside is UID *100000 + n* on the host. Find
the IDs of the service user inside the container and give the host directory
to the mapped IDs:

```sh
pct exec 120 -- id unicache            # e.g. uid=999 gid=989
chown -R 100999:100989 /tank/unicache  # on the Proxmox host: 100000 + uid/gid
```

If you bind-mount before installing, create the user first or re-run the
`chown` afterwards. Symptoms of a wrong mapping: the service fails at start
with "permission denied" on `/var/lib/unicache`.

### systemd hardening in LXC

The unit's sandboxing options (`ProtectSystem`, `PrivateTmp`, …) rely on mount
namespaces. On Proxmox VE 9.2 they worked in an unprivileged container without
nesting (Proxmox prints "Systemd 257 detected. You may need to enable
nesting" when creating the container; UniCache did not need it). On other
versions some of them can fail with an error such as
`Failed to set up mount namespacing`. If the service
does not start for that reason, either enable nesting for the container
(`pct set 120 --features nesting=1`) or relax the unit:

```sh
systemctl edit unicache
#   [Service]
#   ProtectSystem=full
#   PrivateTmp=no
#   PrivateDevices=no
#   ProtectKernelTunables=no
#   ProtectKernelModules=no
#   ProtectControlGroups=no
#   RestrictNamespaces=no
systemctl restart unicache
```

The process still runs as an unprivileged user inside an unprivileged
container.

### Docker inside LXC (alternative)

Requires `nesting=1` (and, depending on the Proxmox and Docker versions,
`keyctl=1`) on the container:

```sh
pct set 120 --features nesting=1,keyctl=1
```

Then install Docker inside the container and follow the Docker Compose
section. Notes:
- Use a named volume or a directory inside the container for the data. For a
  host bind mount two mappings stack: container user 65532 → container UID
  65532 → host UID 165532.
- Storage drivers: on ZFS-backed containers Docker may fall back to the slow
  `vfs` driver unless `fuse-overlayfs` is set up. This affects image layers,
  not the cache volume.
- Whether Docker works in a given unprivileged container depends on the host
  configuration (AppArmor, kernel, Proxmox version). It is not guaranteed and
  was not tested here.

### Firewall

Allow TCP 8080 (or your port) from the LAN to the container. If you use the
Proxmox firewall on the container, add an inbound rule for it; outbound
HTTP/HTTPS must be allowed. Nothing else is needed.

### Limitations of unprivileged LXC

- Free-space reporting reflects the mount point's quota (what the container
  sees), which is what you want for `min_free_space`.
- Privileged ports (< 1024) are not available to the service user; keep a
  high port or put a reverse proxy in front.

## TLS

Either set `server.tls_cert` and `server.tls_key` (clients then need
`https://` URLs and must trust the certificate), or keep UniCache on HTTP and
put a TLS reverse proxy in front of the dashboard. In the second case set
`server.trusted_proxies` to the proxy's address and `security.secure_cookies:
true`.

## Backup and restore

What matters is the metadata database; the blobs can always be downloaded
again.

```sh
# consistent online copy of the database
sudo -u unicache unicache backup -out /var/backups/unicache-$(date +%F).db
# Docker
docker compose exec unicache unicache backup -out /var/lib/unicache/backup.db
```

A full backup is the database copy plus the `blobs/` directory (any file
copy tool; blobs are never modified after they are written). Copy the database
first: blobs that are newer than the database copy are removed as orphans by
the recovery pass after a restore.

Restore: stop the service, put the database copy at
`<storage.path>/metadata.db` (remove `metadata.db-wal` and `-shm`), restore
`blobs/` if you have it, start the service. Entries whose blob is missing are
dropped automatically and downloaded again on demand.

**Lost or corrupt database:** move it away and start again. UniCache starts
with an empty index; the old blobs are then unreferenced and removed by the
recovery pass. Repositories and users have to be set up again (repositories
from the configuration file are re-seeded).

## Forgotten password

```sh
sudo systemctl stop unicache
echo 'new-long-password' | sudo -u unicache unicache reset-password -user admin
sudo systemctl start unicache
```
