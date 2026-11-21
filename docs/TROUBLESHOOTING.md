# Troubleshooting

First stop: the **Live Traffic** page. Every request is listed with its
result. For more detail set `logging.level: debug` (or
`CACHENCARRY_LOGGING_LEVEL=debug`) and restart.

| Result | Meaning |
|---|---|
| `HIT` | served from the cache |
| `MISS` | downloaded from upstream for this request |
| `COALESCED` | joined a download another client had started |
| `REVALIDATED` | upstream confirmed the cached index is current |
| `STALE` | upstream unreachable; an expired index was served |
| `NOTFOUND` | upstream does not have the file |
| `ERROR` | upstream or internal failure |
| `DENIED` | refused (client address, method, path, disabled module) |

## A client gets "403 client address not allowed"

The client's address is outside `security.allowed_clients`. Add its network.
Behind a reverse proxy, set `server.trusted_proxies` so the real client
address is used.

## The dashboard says "management access is not allowed from this address"

Same for `security.admin_allowed`.

## Everything is a 502 "upstream fetch failed"

- The Cache & Carry host cannot reach the mirror: check DNS and outgoing HTTPS
  from the host or container (`curl -I https://deb.debian.org/debian/`).
- The message mentions "upstream address is not allowed": the mirror resolves
  to a private address. For a mirror in your own network set
  `security.allow_private_upstreams: true`.
- Use "Test connectivity" on the Cache Modules page.

## "404 unknown or disabled module or repository"

The URL does not match a configured repository, or the module is switched
off. The URL scheme is `/<module>/<repository>/<path>`; names are listed on
the Repositories page.

## apt: "Hash Sum mismatch" or "File has unexpected size"

The index changed upstream between two files of one update. Debian and Ubuntu
avoid this with by-hash indexes, which Cache & Carry treats as immutable. For
repositories without by-hash, lower the metadata TTL for the `apt` module
(Policies page) or run `apt update` again after the TTL.

## apt or pacman is no faster the second time

Check `X-Cache`:

```sh
curl -sI http://cachencarry.lan:8080/apt/debian/dists/trixie/InRelease | grep -i x-cache
```

If it is always `MISS`: the object is probably being evicted (Storage page:
limits, "eviction" report) or the clients use different repository names or
paths for the same mirror.

## The disk is full / the cache does not shrink

- Set `storage.max_size` and/or `storage.min_free_space`. Eviction removes
  least recently used objects.
- Pinned objects are never removed. If the Storage page shows "limits
  exceeded, only pinned objects left", unpin something.
- Downloads in progress live in `temp/` and are not counted until they are
  complete.
- "Run cleanup now" on the Storage page runs eviction and garbage collection
  immediately.

## The service does not start

```sh
journalctl -u cachencarry -n 50        # native
docker compose logs --tail 50       # Docker
cachencarry check-config               # validates the configuration
```

- `permission denied` on `/var/lib/cachencarry`: wrong owner. Native:
  `chown -R cachencarry:cachencarry /var/lib/cachencarry`. Docker bind mount:
  `chown -R 65532:65532 <dir>`. Proxmox LXC bind mount: see the UID mapping
  section in [DEPLOYMENT.md](../DEPLOYMENT.md#bind-mounting-a-host-directory-instead).
- `Failed to set up mount namespacing` in an LXC container: see
  [systemd hardening in LXC](../DEPLOYMENT.md#systemd-hardening-in-lxc).
- `database schema version … is newer than this release`: the data directory
  was used by a newer Cache & Carry. Upgrade the binary.
- `database integrity check failed`: restore the database from a backup, or
  move it away to start with an empty index
  ([Backup and restore](../DEPLOYMENT.md#backup-and-restore)).
- `listen … address already in use`: change `server.port`.

## Forgotten administrator password

```sh
echo 'new-long-password' | sudo -u cachencarry cachencarry reset-password -user admin
```

## "Too many login attempts"

Ten failed logins per address lock that address out for five minutes.

## The dashboard does not update live

Live updates use Server-Sent Events. A reverse proxy in front must not buffer
`/api/v1/events` (nginx: `proxy_buffering off;`). The pages still refresh
periodically without it.

## Docker container shows one client for the whole LAN

Rootless Docker and the userland proxy hide client addresses. See
[DEPLOYMENT.md](../DEPLOYMENT.md#docker-compose).
