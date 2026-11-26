#!/bin/bash
# Normalizes loudness (two-pass EBU R128) and copies a rendered video to final/.
#   ./finish.sh project/out/raw.mp4 final/name.mp4 [target LUFS, default -14]
set -eu
in=$1; out=$2; target=${3:--14}
mkdir -p "$(dirname "$out")"
stats=$(nice -n 19 ffmpeg -hide_banner -nostats -i "$in" -af "loudnorm=I=$target:TP=-1.5:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$stats" | sed -n "s/.*\"$1\" : \"\([^\"]*\)\".*/\1/p"; }
nice -n 19 ffmpeg -hide_banner -loglevel error -y -i "$in" -c:v copy \
  -af "loudnorm=I=$target:TP=-1.5:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true,aresample=48000" \
  -c:a aac -b:a 256k -movflags +faststart "$out"
echo "$out: $(ffmpeg -hide_banner -nostats -i "$out" -af ebur128=peak=true -f null - 2>&1 | grep -E '^\s+I:' | tail -1 | xargs)"
