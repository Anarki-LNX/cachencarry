#!/usr/bin/env bash
# Manual deploy of the website to the VPS: build, check, upload, switch atomically, verify.
#
#   website/deploy/deploy.sh --yes [--no-build] [--host H] [--port P] [--user U] [--dir D] [--keep N]
#
# Only the owner runs this, after approving the publication. It refuses to run without --yes.
# Defaults (override with flags or CACHENCARRY_WEB_DEPLOY_* variables):
#   host vps (an alias in ~/.ssh/config, which also sets the port) · port from ssh config · user anarki · dir /opt/cachencarry-web · owner cachencarry-web
#   url https://cachencarry.loopout.tech · keep 5 builds
#
# Upload: rsync over SSH into <dir>/.incoming-<id>/ as the web-root owner (sudo -n -u, no password
# prompt), hard-linking unchanged files from the current build. Switch: deploy/remote-switch.sh
# renames a new symlink over <dir>/current. Verify: https://…/build.json must show this build;
# if it does not within a minute, the previous build is switched back automatically.
set -Eeuo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
site=$(cd "$here/.." && pwd)

HOST=${CACHENCARRY_WEB_DEPLOY_HOST:-vps}
PORT=${CACHENCARRY_WEB_DEPLOY_PORT:-}  # empty: the port from ~/.ssh/config
USER_=${CACHENCARRY_WEB_DEPLOY_USER:-anarki}
DIR=${CACHENCARRY_WEB_DEPLOY_DIR:-/opt/cachencarry-web}
OWNER=${CACHENCARRY_WEB_DEPLOY_OWNER:-cachencarry-web}
URL=${CACHENCARRY_WEB_DEPLOY_URL:-https://cachencarry.loopout.tech}
KEEP=${CACHENCARRY_WEB_DEPLOY_KEEP:-5}
YES=0
BUILD=1

usage() { sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; }
while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes) YES=1 ;;
    --no-build) BUILD=0 ;;
    --host) HOST=${2:?}; shift ;;
    --port) PORT=${2:?}; shift ;;
    --user) USER_=${2:?}; shift ;;
    --dir) DIR=${2:?}; shift ;;
    --keep) KEEP=${2:?}; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown option: $1" >&2; usage; exit 2 ;;
  esac
  shift
done

if [[ $YES -ne 1 ]]; then
  echo "deploy.sh publishes the website to $USER_@$HOST:$DIR ($URL)."
  echo "Refusing to run without --yes."
  exit 2
fi
[[ ( -z "$PORT" || "$PORT" =~ ^[0-9]+$ ) && "$KEEP" =~ ^[0-9]+$ && "$DIR" == /* && "$DIR" != *..* ]] || { echo "bad port, keep or dir" >&2; exit 2; }
for tool in rsync ssh curl node; do command -v "$tool" >/dev/null || { echo "missing: $tool" >&2; exit 2; }; done

PORTOPT=(); [[ -n "$PORT" ]] && PORTOPT=(-p "$PORT")
SSH=(ssh "${PORTOPT[@]}" -o BatchMode=yes -o ConnectTimeout=15 "$USER_@$HOST")
remote() { "${SSH[@]}" "sudo -n -u $(printf %q "$OWNER") bash -s -- $(printf '%q ' "$@")" < "$here/remote-switch.sh"; }

cd "$site"
if [[ $BUILD -eq 1 ]]; then
  echo "== build"
  nice -n 19 npm run build
fi
[[ -f dist/index.html && -f dist/build.json ]] || { echo "dist/ is not a complete build (run without --no-build)" >&2; exit 1; }
echo "== security check"
nice -n 19 node scripts/check-security.mjs

built=$(node -e 'const b=require("./dist/build.json");process.stdout.write(b.builtAt)')
commit=$(node -e 'const b=require("./dist/build.json");process.stdout.write(String(b.commit).slice(0,7))')
id="$(date -u +%Y%m%dT%H%M%SZ)-$commit-manual"

echo "== upload $id"
"${SSH[@]}" "sudo -n -u $(printf %q "$OWNER") mkdir -p $(printf %q "$DIR/.incoming-$id")"
rsync -rlt --perms --chmod=D755,F644 --delete --omit-dir-times \
  --link-dest="$DIR/current/" \
  --rsync-path="sudo -n -u $(printf %q "$OWNER") rsync" \
  -e "ssh ${PORT:+-p $PORT} -o BatchMode=yes -o ConnectTimeout=15" \
  dist/ "$USER_@$HOST:$DIR/.incoming-$id/"

echo "== switch"
remote activate "$DIR" "$id" "$KEEP"

echo "== verify $URL/build.json"
for _ in 1 2 3 4 5 6; do
  live=$(curl -fsS --max-time 10 "$URL/build.json" 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).builtAt)}catch{}})' || true)
  if [[ "$live" == "$built" ]]; then
    echo "live: $id"
    exit 0
  fi
  sleep 10
done
echo "The site does not show this build. Switching back to the previous one." >&2
remote rollback "$DIR"
exit 1
