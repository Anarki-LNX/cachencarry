#!/bin/bash
# Renders thumbnails and Shorts covers to thumbnails/.
set -eu
cd "$(dirname "$0")/project"
mkdir -p "$HOME/.cache/ccvt"; export TMPDIR="$HOME/.cache/ccvt"
st() { nice -n 19 ionice -c3 npx remotion still src/index.ts "$1" "../thumbnails/$2" --browser-executable=/usr/bin/chromium --log=error; }
st ThumbMain cachencarry_presentation_thumbnail.png
st ThumbTutorial cachencarry_tutorial_thumbnail.png
st ThumbInstall cachencarry_install_thumbnail_de.png
st ThumbInstallEn cachencarry_install_thumbnail_en.png
for i in 1 2 3 4 5 6; do st Cover$i cachencarry_short_0${i}_cover.png; done
