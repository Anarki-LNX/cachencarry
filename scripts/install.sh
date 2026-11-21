#!/bin/sh
# UniCache native installer for Debian, Ubuntu and other systemd distributions.
#
#   sudo ./scripts/install.sh [path/to/unicache-binary]
#
# Installs or upgrades the binary and the systemd unit. An existing
# configuration in /etc/unicache and the data in /var/lib/unicache are never
# touched. Run again with a newer binary to upgrade.
set -eu

BIN_SRC="${1:-}"
PREFIX="${PREFIX:-/usr/local}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"

[ "$(id -u)" -eq 0 ] || { echo "error: run as root (sudo $0)" >&2; exit 1; }
command -v systemctl >/dev/null 2>&1 || { echo "error: systemd is required" >&2; exit 1; }

if [ -z "$BIN_SRC" ]; then
    for c in "$HERE/bin/unicache" "$HERE/unicache"; do
        [ -x "$c" ] && BIN_SRC="$c" && break
    done
fi
[ -n "$BIN_SRC" ] && [ -x "$BIN_SRC" ] || {
    echo "error: unicache binary not found. Build it with 'make build' or pass its path." >&2
    exit 1
}

if ! getent group unicache >/dev/null; then
    groupadd --system unicache
fi
if ! getent passwd unicache >/dev/null; then
    useradd --system --gid unicache --home-dir /var/lib/unicache --no-create-home \
        --shell /usr/sbin/nologin --comment "UniCache" unicache
fi

install -d -m 0750 -o unicache -g unicache /var/lib/unicache /var/log/unicache
install -d -m 0750 -o root -g unicache /etc/unicache

UPGRADE=no
[ -x "$PREFIX/bin/unicache" ] && UPGRADE=yes
# Install to a temporary name and rename: the running service keeps its old
# binary until it is restarted, and a failed copy never leaves a half file.
install -m 0755 "$BIN_SRC" "$PREFIX/bin/unicache.new"
mv -f "$PREFIX/bin/unicache.new" "$PREFIX/bin/unicache"

if [ ! -e /etc/unicache/config.yaml ]; then
    install -m 0640 -o root -g unicache "$HERE/configs/config.example.yaml" /etc/unicache/config.yaml
    echo "installed default configuration: /etc/unicache/config.yaml"
else
    echo "keeping existing configuration:  /etc/unicache/config.yaml"
fi
# Always refresh the reference copy so new options are easy to discover.
install -m 0640 -o root -g unicache "$HERE/configs/config.example.yaml" /etc/unicache/config.example.yaml

"$PREFIX/bin/unicache" check-config -config /etc/unicache/config.yaml >/dev/null || {
    echo "error: /etc/unicache/config.yaml is not valid for this version (see message above)." >&2
    echo "       The service was not restarted. Fix the file and run: systemctl restart unicache" >&2
    exit 1
}

sed "s#/usr/local/bin/unicache#$PREFIX/bin/unicache#" "$HERE/deployments/systemd/unicache.service" \
    > /etc/systemd/system/unicache.service
chmod 0644 /etc/systemd/system/unicache.service
systemctl daemon-reload
systemctl enable unicache >/dev/null 2>&1

if [ "$UPGRADE" = yes ]; then
    systemctl restart unicache
    echo "UniCache upgraded to: $("$PREFIX/bin/unicache" version)"
else
    systemctl start unicache
    echo "UniCache installed:   $("$PREFIX/bin/unicache" version)"
fi

PORT="$(sed -n 's/^[[:space:]]*port:[[:space:]]*\([0-9][0-9]*\).*/\1/p' /etc/unicache/config.yaml | head -n 1)"
echo
echo "  Web interface:  http://$(hostname -I 2>/dev/null | awk '{print $1}'):${PORT:-8080}/"
if [ -e /var/lib/unicache/setup-token ] || [ "$UPGRADE" = no ]; then
    echo "  First login:    open the web interface and enter the setup token shown by"
    echo "                    sudo -u unicache $PREFIX/bin/unicache setup-token"
fi
echo "  Status / logs:  systemctl status unicache    journalctl -u unicache -f"
