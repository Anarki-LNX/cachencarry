#!/usr/bin/env bash

# Copyright (c) 2021-2026 community-scripts ORG
# Author: Anarki-LNX
# License: MIT | https://github.com/community-scripts/DevScripts/raw/main/LICENSE
# Source: https://github.com/Anarki-LNX/cachencarry

source /dev/stdin <<<"$FUNCTIONS_FILE_PATH"
color
verb_ip6
catch_errors
setting_up_container
network_check
update_os

fetch_and_deploy_gh_release "cachencarry" "Anarki-LNX/cachencarry" "prebuild" "latest" "/opt/cachencarry" "cachencarry-*-linux-$(arch_resolve "amd64" "arm64").tar.gz"

msg_info "Installing Cache & Carry"
$STD /opt/cachencarry/scripts/install.sh /opt/cachencarry/bin/cachencarry
msg_ok "Installed Cache & Carry"

motd_ssh
customize
cleanup_lxc
