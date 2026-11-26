#!/bin/bash
# Starts a throwaway Cache & Carry instance with neutral demo data for video
# recording. Nothing here touches a real installation.
#   ./demo.sh start   build, start on 127.0.0.1:18086 and create base traffic
#   ./demo.sh stop
set -eu
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
WORK="${DEMO_WORK:-${TMPDIR:-/tmp}/cachencarry-demo}"
PORT=18086
B="http://127.0.0.1:$PORT"
req() { curl -s -o /dev/null -H "X-Forwarded-For: $1" "$B/$2"; }
# Current package file names from the local pacman databases (no root needed).
pkg() { LC_ALL=C pacman -Si "$1" | awk -F': ' '/^Repository/{r=$2} /^Version/{v=$2} /^Architecture/{a=$2} END{print r"/os/x86_64/'"$1"'-"v"-"a".pkg.tar.zst"}'; }

case "${1:-}" in
start)
  mkdir -p "$WORK/data"
  (cd "$ROOT" && nice -n 19 go build -p 8 -tags ui -ldflags "-X main.version=$(git -C "$ROOT" describe --tags --abbrev=0 | sed 's/^v//')" -o "$WORK/cachencarry-demo" ./cmd/cachencarry)
  CACHENCARRY_STORAGE_PATH="$WORK/data" CACHENCARRY_STORAGE_MAX_SIZE=40GB CACHENCARRY_STORAGE_MIN_FREE_SPACE=0 \
  CACHENCARRY_SECURITY_ADMIN_PASSWORD=demo-instance-pw CACHENCARRY_SERVER_PORT=$PORT CACHENCARRY_SERVER_LISTEN=127.0.0.1 \
  CACHENCARRY_SERVER_TRUSTED_PROXIES=127.0.0.0/8 nohup "$WORK/cachencarry-demo" serve > "$WORK/server.log" 2>&1 &
  sleep 1.5
  A=pacman/archlinux
  for c in 10.0.10.11 10.0.10.12 10.0.10.14; do
    req $c $A/core/os/x86_64/core.db; req $c $A/extra/os/x86_64/extra.db
    for p in mesa python docker cmake nodejs; do req $c "$A/$(pkg $p)"; done
  done
  D=apt/debian
  for c in 10.0.10.21 10.0.10.23; do
    for p in dists/trixie/InRelease dists/trixie/main/binary-amd64/Packages.xz pool/main/h/hello/hello_2.10-5_amd64.deb; do req $c $D/$p; done
  done
  req 10.0.10.22 apt/ubuntu/dists/noble/InRelease
  echo "demo instance running at $B (user admin, password demo-instance-pw)"
  ;;
stop)
  pkill -x cachencarry-dem || true
  ;;
pkg)
  pkg "$2"
  ;;
*)
  echo "usage: $0 start|stop|pkg NAME"; exit 1 ;;
esac
