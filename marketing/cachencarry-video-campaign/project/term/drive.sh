#!/bin/bash
# Plays a terminal scene for asciinema: shows a prompt, types each command
# visibly and then really runs it. Every line of output on screen comes from
# the real command; only the typing is paced by this script.
#   drive.sh SCENE_FILE
# Scene file syntax (one per line):
#   prompt <text>        prompt shown before each command (ANSI allowed)
#   exec <prefix>        how commands run, e.g. "docker exec -it client1 bash -lc"
#   quote 2              quote the command twice (prefix runs a remote shell, e.g. ssh ... bash -lc)
#   $ <command>          type and run the command
#   show <command>       type the command, then run <run> given on the next "run" line
#   run <command>        actually executed for the preceding "show" (e.g. secrets kept off screen)
#   wait <seconds>       pause
#   clear                clear the screen
#   $ cmd <<'EOF'        a here-document: following lines "> text" are typed after
#   > text               the shell's continuation prompt, "> EOF" ends it, then the
#   > EOF                whole command runs
set -u
PROMPT='$ '
EXEC=''
SHOWN=''
type_out() {
  local s="$1" i ch
  for ((i = 0; i < ${#s}; i++)); do
    ch="${s:i:1}"
    printf '%s' "$ch"
    case "$ch" in
      ' ') sleep 0.0$((5 + RANDOM % 5)) ;;
      *) sleep 0.0$((3 + RANDOM % 4)) ;;
    esac
  done
}
QUOTE=1
run_cmd() {
  if [ -n "$EXEC" ]; then
    local q
    q="$(printf '%q' "$1")"
    [ "$QUOTE" = 2 ] && q="$(printf '%q' "$q")"
    eval "$EXEC $q" < /dev/tty
  else
    bash -c "$1" < /dev/tty
  fi
}
HEREDOC=''
while IFS= read -r line || [ -n "$line" ]; do
  if [ -n "$HEREDOC" ]; then
    body="${line#> }"
    printf '> '; sleep 0.15; type_out "$body"; sleep 0.1; printf '\r\n'
    HEREDOC="$HEREDOC"$'\n'"$body"
    if [ "$body" = "EOF" ]; then run_cmd "$HEREDOC"; HEREDOC=''; sleep 0.6; fi
    continue
  fi
  case "$line" in
    '$ '*"<<'EOF'")
      HEREDOC="${line#\$ }"
      printf '%s' "$PROMPT"; sleep 0.5; type_out "$HEREDOC"; sleep 0.3; printf '\r\n' ;;
    'prompt '*) PROMPT="$(printf '%b' "${line#prompt }")" ;;
    'exec '*) EXEC="${line#exec }" ;;
    'quote '*) QUOTE="${line#quote }" ;;
    'wait '*) sleep "${line#wait }" ;;
    clear) printf '\033[H\033[2J' ;;
    '$ '*)
      cmd="${line#\$ }"
      printf '%s' "$PROMPT"; sleep 0.5; type_out "$cmd"; sleep 0.35; printf '\r\n'
      run_cmd "$cmd"
      sleep 0.6 ;;
    'show '*)
      SHOWN="${line#show }"
      printf '%s' "$PROMPT"; sleep 0.5; type_out "$SHOWN"; sleep 0.35; printf '\r\n' ;;
    'run '*)
      run_cmd "${line#run }"
      sleep 0.6 ;;
    'end') printf '%s' "$PROMPT"; sleep 1.2 ;;
    ''|'#'*) ;;
  esac
done < "$1"
