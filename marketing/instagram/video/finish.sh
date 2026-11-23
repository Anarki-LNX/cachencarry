#!/bin/sh
# Turns the Remotion render into the files for Instagram:
#   instagram-reel-final.mp4    1080x1920, 30 fps, H.264 High, limited colour range, AAC, loudness -16 LUFS
#   instagram-reel-preview.mp4  540x960 quick preview
#   instagram-thumbnail.png     cover image (frame of the closing scene)
set -eu
cd "$(dirname "$0")/.."
RAW=video/out/render.mp4
[ -f "$RAW" ] || { echo "render first: npm run render"; exit 1; }
ffmpeg -hide_banner -loglevel error -y -i "$RAW" \
  -vf "scale=in_range=full:out_range=tv,format=yuv420p" -c:v libx264 -preset slow -crf 18 -profile:v high -level 4.1 \
  -r 30 -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11" -c:a aac -b:a 192k -ar 48000 -movflags +faststart instagram-reel-final.mp4
ffmpeg -hide_banner -loglevel error -y -i instagram-reel-final.mp4 -vf scale=540:960 -c:v libx264 -preset fast -crf 26 \
  -c:a aac -b:a 128k -movflags +faststart instagram-reel-preview.mp4
ffmpeg -hide_banner -loglevel error -y -ss 33.2 -i "$RAW" -frames:v 1 -update 1 instagram-thumbnail.png
echo "done"
