#!/bin/bash
# Renders one composition with the PC-load limits of this project
# (at most 8 processes, lowest CPU and IO priority, temp files in work/).
#   ./render.sh COMPOSITION OUTPUT [extra remotion args]
set -eu
cd "$(dirname "$0")/project"
# Short path on disk (Chromium socket paths are limited; /tmp is RAM here).
mkdir -p "$HOME/.cache/ccvt"
export TMPDIR="$HOME/.cache/ccvt"
comp=$1; out=$2; shift 2
nice -n 19 ionice -c3 npx remotion render src/index.ts "$comp" "$out" \
  --browser-executable=/usr/bin/chromium --concurrency=4 --codec=h264 --crf=17 \
  --audio-codec=aac --audio-bitrate=256k --log=error "$@"
