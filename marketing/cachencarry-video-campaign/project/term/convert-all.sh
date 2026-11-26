#!/bin/bash
# Converts every recording in ../assets/recordings/casts to src/casts/<name>.json.
# Secrets are masked here: term/masks/<name>.txt holds one regex per line.
set -eu
cd "$(dirname "$0")/.."
mkdir -p src/casts
for c in ../assets/recordings/casts/*.cast; do
  n=$(basename "$c" .cast)
  args=()
  if [ -f "term/masks/$n.txt" ]; then
    while IFS= read -r m; do [ -n "$m" ] && args+=(--mask "$m"); done < "term/masks/$n.txt"
  fi
  node term/cast2json.mjs "$c" "src/casts/$n.json" "${args[@]}"
done
