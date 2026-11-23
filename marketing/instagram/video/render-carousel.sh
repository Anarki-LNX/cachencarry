#!/bin/sh
# Renders the Instagram carousel slides (1080 x 1350) into ../carousel/.
# Needs the recordings in public/footage (npm run capture).
set -eu
cd "$(dirname "$0")"
OUT=../carousel
mkdir -p "$OUT"
for n in 1 2 3 4 5 6 7 8; do
  npx remotion still src/index.ts Carousel "$OUT/slide-$n.png" --props="{\"slide\":$n}" \
    --browser-executable=/usr/bin/chromium --log=error >/dev/null
  echo "slide $n"
done
