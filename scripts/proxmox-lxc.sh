#!/usr/bin/env bash
# Cache & Carry on Proxmox VE: create a ready LXC container with one command.
#
# Run on the Proxmox VE host as root:
#
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/Anarki-LNX/cachencarry/main/scripts/proxmox-lxc.sh)"
#
# Update an existing container to the latest release:
#
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/Anarki-LNX/cachencarry/main/scripts/proxmox-lxc.sh)" -- update 130
#
# What it does: downloads the official Debian 13 template (pveam) and the
# Cache & Carry release for the host architecture (amd64 or arm64), checks the
# release against SHA256SUMS, creates an unprivileged container without
# nesting, installs the binary with the release's own scripts/install.sh
# (systemd unit with sandboxing, service user, config in /etc/cachencarry) and
# prints the web address and the setup token for the first login.
#
# Settings (environment variables, all optional):
#   CC_CTID           container ID                      next free ID
#   CC_HOSTNAME       host name                         cachencarry
#   CC_STORAGE        storage for disks                 local-lvm, local-zfs or the first one that fits
#   CC_TEMPLATE_STORAGE storage for the template        local
#   CC_DISK           root disk in GB                   4
#   CC_CACHE_GB       separate cache volume in GB       100 (0 = cache on the root disk)
#   CC_CACHE_BACKUP   include the cache volume in vzdump backups (0 or 1)   0
#   CC_CORES / CC_RAM / CC_SWAP   CPU cores, RAM and swap in MB             2 / 1024 / 512
#   CC_BRIDGE         network bridge                    vmbr0
#   CC_IP             dhcp or an address like 192.168.1.20/24             dhcp
#   CC_GW             gateway (needed with a static CC_IP)
#   CC_VLAN           VLAN tag                          none
#   CC_VERSION        release to install, e.g. 0.2.1    latest
#   CC_YES            1 = do not ask before creating
set -Eeuo pipefail

# pct exec hands the host's locale to the container, where for example
# en_US.UTF-8 is not generated and perl, apt and debconf warn about it.
# C.UTF-8 exists everywhere, on the host and in the Debian template.
export LANG=C.UTF-8 LC_ALL=C.UTF-8
unset LANGUAGE

REPO="Anarki-LNX/cachencarry"
GITHUB="https://github.com/${REPO}"

if [ -t 1 ]; then B=$'\e[1m'; G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; N=$'\e[0m'; else B=""; G=""; Y=""; R=""; N=""; fi
info() { echo "${B}::${N} $*"; }
ok()   { echo "${G}ok${N} $*"; }
warn() { echo "${Y}warning:${N} $*" >&2; }
die()  { echo "${R}error:${N} $*" >&2; exit 1; }

WORK=""
CREATED=""
cleanup() {
    local rc=$?
    [ -n "$WORK" ] && rm -rf "$WORK"
    if [ "$rc" -ne 0 ] && [ -n "$CREATED" ]; then
        echo >&2
        warn "setup of container $CREATED did not finish."
        if [ -t 0 ]; then
            read -r -p "Delete the unfinished container $CREATED? [y/N] " a
            if [ "$a" = y ] || [ "$a" = Y ]; then
                pct stop "$CREATED" >/dev/null 2>&1 || true
                pct destroy "$CREATED" --purge 1 && ok "container $CREATED deleted"
                exit "$rc"
            fi
        fi
        warn "the container was kept. Look inside with: pct enter $CREATED"
        warn "remove it with: pct stop $CREATED && pct destroy $CREATED --purge 1"
    fi
    exit "$rc"
}
trap cleanup EXIT

need_host() {
    [ "$(id -u)" -eq 0 ] || die "run as root on the Proxmox VE host"
    command -v pct >/dev/null && command -v pveversion >/dev/null && command -v pveam >/dev/null \
        || die "pct, pveam and pveversion not found. This script runs on a Proxmox VE host."
    ARCH="$(dpkg --print-architecture)"
    case "$ARCH" in
        amd64|arm64) ;;
        *) die "architecture $ARCH is not supported (amd64 or arm64)" ;;
    esac
    local v
    v="$(pveversion | sed -n 's#^pve-manager/\([0-9]*\).*#\1#p')"
    [ -n "$v" ] && [ "$v" -lt 8 ] && die "Proxmox VE $v is too old, version 8 or newer is needed"
    [ "${v:-9}" -lt 9 ] && warn "tested on Proxmox VE 9. Version $v should work but was not tested."
    WORK="$(mktemp -d -p /var/tmp cachencarry-pve.XXXXXX)"
}

# Latest release version without the leading v, or CC_VERSION.
release_version() {
    if [ -n "${CC_VERSION:-}" ] && [ "${CC_VERSION}" != latest ]; then
        echo "${CC_VERSION#v}"
        return
    fi
    local tag
    tag="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
        | sed -n 's/^[[:space:]]*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
    [ -n "$tag" ] || die "could not read the latest release from GitHub"
    echo "${tag#v}"
}

# Downloads the release tarball for ARCH into WORK and checks it.
fetch_release() {
    local ver="$1" name="cachencarry-$1-linux-${ARCH}.tar.gz"
    local base="${GITHUB}/releases/download/v${ver}"
    info "downloading Cache & Carry ${ver} (${ARCH})"
    curl -fsSL -o "$WORK/$name" "$base/$name" || die "download failed: $base/$name"
    curl -fsSL -o "$WORK/SHA256SUMS" "$base/SHA256SUMS" || die "download failed: $base/SHA256SUMS"
    (cd "$WORK" && grep " ${name}\$" SHA256SUMS | sha256sum -c --status) \
        || die "checksum of $name does not match SHA256SUMS"
    ok "checksum verified"
    TARBALL="$WORK/$name"
}

# Copies the checked tarball into the container and runs the release's installer.
install_into() {
    local ct="$1" ver="$2"
    pct push "$ct" "$TARBALL" "/root/cachencarry.tar.gz"
    pct exec "$ct" -- bash -euo pipefail -c "
        rm -rf /opt/cachencarry-release && mkdir -p /opt/cachencarry-release
        tar xzf /root/cachencarry.tar.gz -C /opt/cachencarry-release --strip-components=1
        rm -f /root/cachencarry.tar.gz
        /opt/cachencarry-release/scripts/install.sh /opt/cachencarry-release/bin/cachencarry
        rm -rf /opt/cachencarry-release"
    ok "Cache & Carry ${ver} installed"
}

ct_ip() {
    pct exec "$1" -- sh -c "hostname -I 2>/dev/null | awk '{print \$1}'" 2>/dev/null || true
}

cmd_install() {
    need_host
    local ctid="${CC_CTID:-$(pvesh get /cluster/nextid)}"
    local hostname="${CC_HOSTNAME:-cachencarry}" disk="${CC_DISK:-4}" cache="${CC_CACHE_GB:-100}"
    local cores="${CC_CORES:-2}" ram="${CC_RAM:-1024}" swap="${CC_SWAP:-512}"
    local bridge="${CC_BRIDGE:-vmbr0}" ip="${CC_IP:-dhcp}" tstore="${CC_TEMPLATE_STORAGE:-local}"
    local storage="${CC_STORAGE:-}"

    pct status "$ctid" >/dev/null 2>&1 && die "container ID $ctid is already in use. Set CC_CTID to a free ID."
    if [ -z "$storage" ]; then
        local avail
        avail="$(pvesm status -content rootdir 2>/dev/null | awk 'NR>1 && $3=="active" {print $1}')"
        for s in local-lvm local-zfs $avail; do
            if echo "$avail" | grep -qx "$s"; then storage="$s"; break; fi
        done
        [ -n "$storage" ] || die "no active storage for containers found. Set CC_STORAGE."
    fi
    local net="name=eth0,bridge=${bridge},ip=${ip}"
    if [ "$ip" != dhcp ]; then
        [ -n "${CC_GW:-}" ] || die "a static CC_IP needs CC_GW (gateway)"
        net="${net},gw=${CC_GW}"
    fi
    [ -n "${CC_VLAN:-}" ] && net="${net},tag=${CC_VLAN}"

    local ver
    ver="$(release_version)"

    info "looking for the Debian 13 template (${ARCH})"
    pveam update >/dev/null || warn "pveam update failed, using the known template list"
    local tmpl
    tmpl="$(pveam available --section system | awk '{print $2}' \
        | grep -E "^debian-13-standard_.*_${ARCH}\.tar\.zst$" | sort -V | tail -n 1)"
    [ -n "$tmpl" ] || die "no Debian 13 template for ${ARCH} found in 'pveam available'"

    echo
    echo "${B}Cache & Carry ${ver} on Proxmox VE${N}"
    echo "  container  ${ctid} (${hostname}), unprivileged, no nesting"
    echo "  template   ${tmpl}"
    echo "  resources  ${cores} cores, ${ram} MB RAM, ${disk} GB root disk on ${storage}"
    if [ "$cache" -gt 0 ]; then
        echo "  cache      ${cache} GB volume at /var/lib/cachencarry (vzdump backup: $([ "${CC_CACHE_BACKUP:-0}" = 1 ] && echo yes || echo no))"
    else
        echo "  cache      on the root disk"
    fi
    echo "  network    ${net}"
    echo
    if [ "${CC_YES:-0}" != 1 ] && [ -t 0 ]; then
        read -r -p "Create this container? [Y/n] " a
        case "$a" in n|N|no) echo "nothing changed"; exit 0 ;; esac
    fi

    fetch_release "$ver"

    if ! pveam list "$tstore" 2>/dev/null | grep -q "/${tmpl}[[:space:]]"; then
        info "downloading template ${tmpl} to ${tstore}"
        pveam download "$tstore" "$tmpl" >/dev/null
    fi

    info "creating container ${ctid}"
    local args=(--hostname "$hostname" --ostype debian --unprivileged 1
        --cores "$cores" --memory "$ram" --swap "$swap"
        --rootfs "${storage}:${disk}" --net0 "$net" --onboot 1
        --tags cachencarry --timezone host
        --description "Cache & Carry LAN package cache. ${GITHUB}")
    [ "$cache" -gt 0 ] && args+=(--mp0 "${storage}:${cache},mp=/var/lib/cachencarry,backup=${CC_CACHE_BACKUP:-0}")
    pct create "$ctid" "${tstore}:vztmpl/${tmpl}" "${args[@]}" >/dev/null
    CREATED="$ctid"
    pct start "$ctid"

    info "waiting for the network in the container"
    local i
    for i in $(seq 1 60); do
        pct exec "$ctid" -- getent hosts deb.debian.org >/dev/null 2>&1 && break
        [ "$i" -eq 60 ] && die "the container has no network or DNS after 60 seconds"
        sleep 1
    done

    info "updating Debian in the container"
    pct exec "$ctid" -- bash -ec "export DEBIAN_FRONTEND=noninteractive
        apt-get update -qq && apt-get -y -qq -o Dpkg::Options::=--force-confold dist-upgrade >/dev/null
        apt-get install -y -qq ca-certificates >/dev/null"

    install_into "$ctid" "$ver"

    local token="" addr
    for i in $(seq 1 30); do
        token="$(pct exec "$ctid" -- su -s /bin/sh cachencarry -c '/usr/local/bin/cachencarry setup-token' 2>/dev/null || true)"
        [ -n "$token" ] && break
        sleep 1
    done
    addr="$(ct_ip "$ctid")"
    pct set "$ctid" --description "Cache & Carry LAN package cache. Web interface: http://${addr:-IP}:8080/ . ${GITHUB}" >/dev/null || true
    CREATED=""

    echo
    echo "${G}${B}Cache & Carry is running in container ${ctid}.${N}"
    echo
    echo "  Web interface   http://${addr:-<container IP>}:8080/"
    if [ -n "$token" ]; then
        echo "  Setup token     ${token}"
    else
        echo "  Setup token     pct exec ${ctid} -- su -s /bin/sh cachencarry -c '/usr/local/bin/cachencarry setup-token'"
    fi
    echo
    echo "  Open the web interface, enter the setup token and choose the admin password."
    echo "  Then point your clients at the cache, see ${GITHUB}/blob/main/docs/CLIENTS.md"
    echo
    echo "  Logs            pct exec ${ctid} -- journalctl -u cachencarry -f"
    echo "  Shell           pct enter ${ctid}"
    echo "  Update later    run this script again with: update ${ctid}"
}

cmd_update() {
    need_host
    local ctid="${1:-${CC_CTID:-}}"
    [ -n "$ctid" ] || die "usage: proxmox-lxc.sh update <container ID>"
    pct status "$ctid" 2>/dev/null | grep -q running || die "container $ctid does not exist or is not running"
    local cur
    cur="$(pct exec "$ctid" -- /usr/local/bin/cachencarry version 2>/dev/null | awk '{print $2}')" \
        || die "Cache & Carry is not installed in container $ctid"
    local ver
    ver="$(release_version)"
    if [ "$cur" = "$ver" ] && [ "${CC_FORCE:-0}" != 1 ]; then
        ok "container $ctid already runs Cache & Carry $cur. Set CC_FORCE=1 to reinstall."
        exit 0
    fi
    info "updating container $ctid from $cur to $ver"
    fetch_release "$ver"
    local bak
    bak="/var/lib/cachencarry/metadata-before-${ver}-$(date +%Y%m%d%H%M%S).db"
    pct exec "$ctid" -- su -s /bin/sh cachencarry -c "/usr/local/bin/cachencarry backup -out $bak" >/dev/null \
        && ok "metadata database saved to $bak" \
        || warn "could not save the metadata database, continuing"
    install_into "$ctid" "$ver"
    ok "container $ctid now runs: $(pct exec "$ctid" -- /usr/local/bin/cachencarry version)"
}

case "${1:-install}" in
    install) shift || true; cmd_install "$@" ;;
    update)  shift; cmd_update "$@" ;;
    -h|--help|help) echo "usage: proxmox-lxc.sh [install | update <container ID>]. Settings: see the comments at the top of the script or ${GITHUB}/blob/main/DEPLOYMENT.md" ;;
    *) die "unknown command '$1' (install, update or help)" ;;
esac
