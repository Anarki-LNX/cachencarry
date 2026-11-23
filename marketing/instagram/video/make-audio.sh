#!/bin/sh
# Synthesizes the soundtrack with FFmpeg only: a soft electronic pad, airy
# whooshes on scene changes and low impacts on the big moments. Nothing is
# sampled from third parties, so there are no licence questions.
# Times are in seconds and follow the scene table in src/theme.ts.
set -eu
OUT="$(dirname "$0")/public/audio/bed.m4a"
D=34
W="3.0 7.5 10.0 15.0 20.5 24.0 27.5 30.0"
H="0.1 7.6 30.1"
woosh=$(for t in $W; do printf 'exp(-pow((t-%s)/0.300,2))+' "$t"; done)0
hit=$(for t in $H; do printf 'exp(-(t-%s)*4)*gte(t,%s)*lt(t,%s+1.800)+' "$t" "$t" "$t"; done)0
mkdir -p "$(dirname "$OUT")"
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "sine=f=110:d=$D" -f lavfi -i "sine=f=164.81:d=$D" -f lavfi -i "sine=f=220:d=$D" \
  -f lavfi -i "sine=f=261.63:d=$D" -f lavfi -i "sine=f=329.63:d=$D" -f lavfi -i "sine=f=493.88:d=$D" \
  -f lavfi -i "anoisesrc=d=$D:c=pink:a=0.500:seed=7" -f lavfi -i "sine=f=55:d=$D" \
  -filter_complex "
  [0]volume=0.300[a0];[1]volume=0.160[a1];[2]volume=0.200,tremolo=f=0.180:d=0.500[a2];
  [3]volume=0.130,tremolo=f=0.230:d=0.600[a3];[4]volume=0.110,tremolo=f=0.310:d=0.700[a4];[5]volume=0.045,tremolo=f=0.130:d=0.800[a5];
  [a0][a1][a2][a3][a4][a5]amix=inputs=6:normalize=0,lowpass=f=1800,aecho=0.800:0.700:90|180:0.350|0.250,afade=t=in:d=1.500,afade=t=out:st=$((D-3)):d=3[pad];
  [6]highpass=f=900,lowpass=f=6000,volume='0.550*($woosh)':eval=frame[woosh];
  [7]volume='0.900*($hit)':eval=frame[sub];
  [pad][woosh][sub]amix=inputs=3:normalize=0,alimiter=limit=0.850,aformat=channel_layouts=stereo[out]" \
  -map "[out]" -c:a aac -b:a 192k "$OUT"
echo "wrote $OUT"
