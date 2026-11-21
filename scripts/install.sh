#!/bin/sh
# Cache & Carry native installer for Debian, Ubuntu and other systemd distributions.
#
#   sudo ./scripts/install.sh [path/to/cachencarry-binary]
#
# Installs or upgrades the binary and the systemd unit. An existing
# configuration in /etc/cachencarry and the data in /var/lib/cachencarry are never
# touched. Run again with a newer binary to upgrade.
set -eu

BIN_SRC="${1:-}"
PREFIX="${PREFIX:-/usr/local}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"

[ "$(id -u)" -eq 0 ] || { echo "error: run as root (sudo $0)" >&2; exit 1; }
command -v systemctl >/dev/null 2>&1 || { echo "error: systemd is required" >&2; exit 1; }

if [ -z "$BIN_SRC" ]; then
    for c in "$HERE/bin/cachencarry" "$HERE/cachencarry"; do
        [ -x "$c" ] && BIN_SRC="$c" && break
    done
fi
[ -n "$BIN_SRC" ] && [ -x "$BIN_SRC" ] || {
    echo "error: cachencarry binary not found. Build it with 'make build' or pass its path." >&2
    exit 1
}

if ! getent group cachencarry >/dev/null; then
    groupadd --system cachencarry
fi
if ! getent passwd cachencarry >/dev/null; then
    useradd --system --gid cachencarry --home-dir /var/lib/cachencarry --no-create-home \
        --shell /usr/sbin/nologin --comment "Cache & Carry" cachencarry
fi

install -d -m 0750 -o cachencarry -g cachencarry /var/lib/cachencarry /var/log/cachencarry
install -d -m 0750 -o root -g cachencarry /etc/cachencarry

UPGRADE=no
[ -x "$PREFIX/bin/cachencarry" ] && UPGRADE=yes
# Install to a temporary name and rename: the running service keeps its old
# binary until it is restarted, and a failed copy never leaves a half file.
install -m 0755 "$BIN_SRC" "$PREFIX/bin/cachencarry.new"
mv -f "$PREFIX/bin/cachencarry.new" "$PREFIX/bin/cachencarry"

if [ ! -e /etc/cachencarry/config.yaml ]; then
    install -m 0640 -o root -g cachencarry "$HERE/configs/config.example.yaml" /etc/cachencarry/config.yaml
    echo "installed default configuration: /etc/cachencarry/config.yaml"
else
    echo "keeping existing configuration:  /etc/cachencarry/config.yaml"
fi
# Always refresh the reference copy so new options are easy to discover.
install -m 0640 -o root -g cachencarry "$HERE/configs/config.example.yaml" /etc/cachencarry/config.example.yaml

"$PREFIX/bin/cachencarry" check-config -config /etc/cachencarry/config.yaml >/dev/null || {
    echo "error: /etc/cachencarry/config.yaml is not valid for this version (see message above)." >&2
    echo "       The service was not restarted. Fix the file and run: systemctl restart cachencarry" >&2
    exit 1
}

sed "s#/usr/local/bin/cachencarry#$PREFIX/bin/cachencarry#" "$HERE/deployments/systemd/cachencarry.service" \
    > /etc/systemd/system/cachencarry.service
chmod 0644 /etc/systemd/system/cachencarry.service
systemctl daemon-reload
systemctl enable cachencarry >/dev/null 2>&1

if [ "$UPGRADE" = yes ]; then
    systemctl restart cachencarry
    echo "Cache & Carry upgraded to: $("$PREFIX/bin/cachencarry" version)"
else
    systemctl start cachencarry
    echo "Cache & Carry installed:   $("$PREFIX/bin/cachencarry" version)"
fi

PORT="$(sed -n 's/^[[:space:]]*port:[[:space:]]*\([0-9][0-9]*\).*/\1/p' /etc/cachencarry/config.yaml | head -n 1)"
echo
echo "  Web interface:  http://$(hostname -I 2>/dev/null | awk '{print $1}'):${PORT:-8080}/"
if [ -e /var/lib/cachencarry/setup-token ] || [ "$UPGRADE" = no ]; then
    echo "  First login:    open the web interface and enter the setup token shown by"
    echo "                    su -s /bin/sh cachencarry -c '$PREFIX/bin/cachencarry setup-token'"
fi
echo "  Status / logs:  systemctl status cachencarry    journalctl -u cachencarry -f"
