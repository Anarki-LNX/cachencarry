#!/bin/sh
# Removes the Cache & Carry service and binary.
#
#   sudo ./scripts/uninstall.sh           keep configuration and cache
#   sudo ./scripts/uninstall.sh --purge   also delete /etc/cachencarry,
#                                         /var/lib/cachencarry, /var/log/cachencarry
#                                         and the service account
set -eu
PREFIX="${PREFIX:-/usr/local}"
[ "$(id -u)" -eq 0 ] || { echo "error: run as root" >&2; exit 1; }

if command -v systemctl >/dev/null 2>&1; then
    systemctl disable --now cachencarry >/dev/null 2>&1 || true
    rm -f /etc/systemd/system/cachencarry.service
    systemctl daemon-reload
fi
rm -f "$PREFIX/bin/cachencarry"

if [ "${1:-}" = "--purge" ]; then
    rm -rf /etc/cachencarry /var/lib/cachencarry /var/log/cachencarry
    if getent passwd cachencarry >/dev/null; then userdel cachencarry >/dev/null 2>&1 || true; fi
    if getent group cachencarry >/dev/null; then groupdel cachencarry >/dev/null 2>&1 || true; fi
    echo "Cache & Carry removed including configuration and cached data."
else
    echo "Cache & Carry removed. Configuration (/etc/cachencarry) and cache (/var/lib/cachencarry) were kept."
    echo "Run with --purge to delete them as well."
fi
