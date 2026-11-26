# Deploying cachencarry.loopout.tech

State 2026-11-26. Nothing below has been done yet: no DNS record, no server change, no
deploy. The setup is the same as for netsluice.loopout.tech: static files under
`/opt/cachencarry-web`, served read-only by the existing Caddy of the wetter-crinitz
server, swapped atomically by `deploy/deploy.sh`.

The site never proxies anything. No Cache & Carry server, no admin port and no home
network is reachable through it.

## Needs the owner

Each step changes something public or on the shared VPS:

1. Approving the content (both languages) and publishing at all.
2. DNS record `cachencarry.loopout.tech`.
3. Server setup: user, directory, volume line, Caddy block, Caddy restart. The restart
   briefly interrupts **all** sites on the VPS, agree on the time as for loopout.tech.
4. First deploy and pushing `website/` to GitHub.

## 0. Before you start (desktop)

```sh
cd website
nice -n 19 npm ci
nice -n 19 npm run check
nice -n 19 npm run build
nice -n 19 npm run check:security     # must say 0 failure(s)
nice -n 19 npm audit --omit=dev
```

## 1. DNS (IONOS, domain loopout.tech)

| Type | Host          | Value                              |
| ---- | ------------- | ---------------------------------- |
| A    | `cachencarry` | the same address as `loopout.tech` |

No AAAA record, like the other sites on this VPS. Check:
`dig +short cachencarry.loopout.tech A` shows the same address as `dig +short loopout.tech A`.

## 2. Server: user and web root

```sh
ssh vps
sudo useradd --system --home-dir /opt/cachencarry-web --no-create-home --shell /usr/sbin/nologin cachencarry-web
sudo install -d -o cachencarry-web -g cachencarry-web -m 755 /opt/cachencarry-web /opt/cachencarry-web/releases
```

`deploy.sh` runs `sudo -n -u cachencarry-web` on the server, as for NetSluice (your
`anarki` user has passwordless sudo there). Test:
`ssh vps 'sudo -n -u cachencarry-web true && echo ok'`.

## 3. Caddy (repository wetter-crinitz)

1. `docker-compose.yml`, service `caddy`, under `volumes:`:
   ```yaml
   # Cache & Carry website (static files, /opt/cachencarry-web/current → releases/<id>), read-only
   - /opt/cachencarry-web:/srv/cachencarry:ro
   ```
2. `server/caddy/Caddyfile`: append the whole content of
   [`deploy/caddy/cachencarry.loopout.tech.caddy`](deploy/caddy/cachencarry.loopout.tech.caddy).
3. Validate:
   ```sh
   docker run --rm -v "$PWD/server/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2.11-alpine caddy validate --config /etc/caddy/Caddyfile
   ```
4. Commit, push, then on the VPS (the volume is new, so the container must be recreated):
   ```sh
   cd /opt/wetter-crinitz && git pull --ff-only && docker compose up -d caddy
   ```

Caddy fetches the certificate on the first request once DNS points to the VPS.

## 4. First deploy

```sh
cd website
deploy/deploy.sh --yes
```

It builds, runs the security check, uploads into `.incoming-<id>/`, switches the
`current` symlink in one step and waits until `https://cachencarry.loopout.tech/build.json`
shows the new build. If it does not within a minute it switches back by itself.

Defaults: host `vps` (your SSH alias, which also sets port and user), directory
`/opt/cachencarry-web`, owner `cachencarry-web`, 5 builds kept. Override with flags
(`--host`, `--port`, `--user`, `--dir`, `--keep`) or `CACHENCARRY_WEB_DEPLOY_*` variables.

## 5. Check

```sh
curl -sI https://cachencarry.loopout.tech/de/ | head -1                      # HTTP/2 200
curl -sI https://cachencarry.loopout.tech/de/ | grep -i content-security    # the CSP from the Caddy block
curl -s https://cachencarry.loopout.tech/build.json                          # commit and time of this build
curl -s -o /dev/null -w '%{http_code}\n' https://cachencarry.loopout.tech/nope/   # 404
```

In a browser: language choice at `/`, both languages, the DE/EN switch, copy buttons,
the screenshot lightbox, the PayPal button. Then submit
`https://cachencarry.loopout.tech/sitemap-index.xml` in Google Search Console and Bing.

Optional afterwards: link the new site from `README.md` of the repository and from the
project page on loopout.tech.

## Updates and rollback

- **Update:** commit, then `deploy/deploy.sh --yes`. No Caddy restart.
- **Rollback:** `deploy/rollback.sh --yes` switches back to the previous build,
  `deploy/rollback.sh --yes --to <id>` to a specific one (`--status` lists them).
- **Backup:** not needed. The site is built completely from the repository.
