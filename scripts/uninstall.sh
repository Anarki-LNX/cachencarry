#!/bin/sh
# Removes the UniCache service and binary.
#
#   sudo ./scripts/uninstall.sh           keep configuration and cache
#   sudo ./scripts/uninstall.sh --purge   also delete /etc/unicache,
#                                         /var/lib/unicache, /var/log/unicache
#                                         and the service account
set -eu
PREFIX="${PREFIX:-/usr/local}"
[ "$(id -u)" -eq 0 ] || { echo "error: run as root" >&2; exit 1; }

if command -v systemctl >/dev/null 2>&1; then
    systemctl disable --now unicache >/dev/null 2>&1 || true
    rm -f /etc/systemd/system/unicache.service
    systemctl daemon-reload
fi
rm -f "$PREFIX/bin/unicache"

if [ "${1:-}" = "--purge" ]; then
    rm -rf /etc/unicache /var/lib/unicache /var/log/unicache
    if getent passwd unicache >/dev/null; then userdel unicache >/dev/null 2>&1 || true; fi
    if getent group unicache >/dev/null; then groupdel unicache >/dev/null 2>&1 || true; fi
    echo "UniCache removed including configuration and cached data."
else
    echo "UniCache removed. Configuration (/etc/unicache) and cache (/var/lib/unicache) were kept."
    echo "Run with --purge to delete them as well."
fi
