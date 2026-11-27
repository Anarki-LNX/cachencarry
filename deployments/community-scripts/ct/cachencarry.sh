#!/usr/bin/env bash
_CS_DEFAULT_URL="https://raw.githubusercontent.com/community-scripts/DevScripts/main"
_cs_boot="${COMMUNITY_SCRIPTS_CORE_DIR:-$(dirname "${BASH_SOURCE[0]}")/../../core}/core/build.func"
source "$_cs_boot" 2>/dev/null || source <(curl -fsSL "${COMMUNITY_SCRIPTS_CORE_URL:-https://raw.githubusercontent.com/community-scripts/core/main}/core/build.func")
# Copyright (c) 2021-2026 community-scripts ORG
# Author: Anarki-LNX
# License: MIT | https://github.com/community-scripts/DevScripts/raw/main/LICENSE
# Source: https://github.com/Anarki-LNX/cachencarry

APP="Cache-and-Carry"
var_tags="${var_tags:-caching;proxy}"
var_cpu="${var_cpu:-2}"
var_ram="${var_ram:-1024}"
var_disk="${var_disk:-20}"
var_os="${var_os:-debian}"
var_version="${var_version:-13}"
var_arm64="${var_arm64:-yes}"
var_unprivileged="${var_unprivileged:-1}"
#var_testurl="${var_testurl:-https://github.com/community-scripts/DevScripts/issues/XXXX}"

header_info "$APP"
variables
color
catch_errors

function update_script() {
  header_info
  check_container_storage
  check_container_resources

  if [[ ! -x /usr/local/bin/cachencarry ]]; then
    msg_error "No Cache & Carry Installation Found!"
    exit
  fi

  if check_for_gh_release "cachencarry" "Anarki-LNX/cachencarry"; then
    msg_info "Backing up Cache & Carry database"
    rm -f /var/lib/cachencarry/metadata-before-update.db
    $STD su -s /bin/sh cachencarry -c "/usr/local/bin/cachencarry backup -out /var/lib/cachencarry/metadata-before-update.db"
    msg_ok "Backed up Cache & Carry database"

    CLEAN_INSTALL=1 fetch_and_deploy_gh_release "cachencarry" "Anarki-LNX/cachencarry" "prebuild" "latest" "/opt/cachencarry" "cachencarry-*-linux-$(arch_resolve "amd64" "arm64").tar.gz"

    msg_info "Updating Cache & Carry"
    $STD /opt/cachencarry/scripts/install.sh /opt/cachencarry/bin/cachencarry
    msg_ok "Updated Cache & Carry"
    msg_ok "Updated successfully!"
  fi
  exit
}

start
build_container
description

msg_ok "Completed Successfully!\n"
echo -e "${CREATING}${GN}Cache & Carry setup has been successfully initialized!${CL}"
echo -e "${INFO}${YW}Access it using the following URL:${CL}"
echo -e "${TAB}${GATEWAY}${BGN}http://${IP}:8080${CL}"
echo -e "${INFO}${YW}Setup token for the first login:${CL}"
echo -e "${TAB}${BGN}$(pct exec "$CTID" -- cat /var/lib/cachencarry/setup-token 2>/dev/null)${CL}"
