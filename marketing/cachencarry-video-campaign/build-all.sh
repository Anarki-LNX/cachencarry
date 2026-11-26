#!/bin/bash
# Renders all seven videos plus the clean version, normalizes them and writes final/.
set -eu
cd "$(dirname "$0")"
r() { ./render.sh "$1" "out/$1.mp4"; ./finish.sh "project/out/$1.mp4" "final/$2.mp4" "${3:--14}"; }
r Presentation cachencarry_presentation_16x9
r PresentationClean cachencarry_presentation_16x9_clean
r Tutorial cachencarry_installation_tutorial -15
r Short01 cachencarry_short_01_problem
r Short02 cachencarry_short_02_hit_vs_miss
r Short03 cachencarry_short_03_speed
r Short04 cachencarry_short_04_shared_download
r Short05 cachencarry_short_05_open_source
./stills.sh
