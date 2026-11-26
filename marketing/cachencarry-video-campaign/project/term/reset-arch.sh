#!/bin/bash
# Fresh Arch Linux demo machines (host network, nothing else shared).
#   term/reset-arch.sh N [mirror-mode]   mirror-mode: internet (default) or relay
set -eu
n=$1; mode=${2:-internet}
for i in $(seq 1 "$n"); do
  docker rm -f ccdemo-pc$i >/dev/null 2>&1 || true
  docker run -d --name ccdemo-pc$i --hostname arch-pc$i --network host archlinux:latest sleep infinity >/dev/null
  # The container image hides progress bars; a desktop install shows them. Signature checks stay as shipped.
  docker exec ccdemo-pc$i sed -i "s/^NoProgressBar/#NoProgressBar/; s/^#Color/Color/" /etc/pacman.conf
  if [ "$mode" = relay ]; then
    # Exactly the client setup from docs/CLIENTS.md: the cache first, a real mirror below.
    docker exec ccdemo-pc$i bash -c "printf 'Server = http://127.0.0.1:181$((10 + i))/pacman/archlinux/\$repo/os/\$arch\nServer = https://geo.mirror.pkgbuild.com/\$repo/os/\$arch\n' > /etc/pacman.d/mirrorlist"
  fi
done
