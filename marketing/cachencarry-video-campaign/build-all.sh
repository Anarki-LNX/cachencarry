#!/bin/bash
# Renders the German versions (German text, German voice, no burned-in subtitles),
# normalizes them to -14 LUFS and writes final/de/.
set -eu
cd "$(dirname "$0")"
mkdir -p final/de
# Voice check first: dictionary, text separation, audio files. Stops on errors.
tools/venv/bin/python pipeline/voice_qa.py
r() { ./render.sh "$1" "out/$1.mp4"; ./finish.sh "project/out/$1.mp4" "final/de/$2_de.mp4" -14; }
ALL="Presentation:cachencarry_presentation Tutorial:cachencarry_installation_tutorial Short01:cachencarry_short_01_problem Short02:cachencarry_short_02_hit_vs_miss Short03:cachencarry_short_03_speed Short04:cachencarry_short_04_shared_download Short05:cachencarry_short_05_open_source Short06:cachencarry_short_06_install"
for pair in ${ONLY:-$ALL}; do r "${pair%%:*}" "${pair#*:}"; done
./stills.sh
