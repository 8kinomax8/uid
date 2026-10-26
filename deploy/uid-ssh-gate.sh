#!/usr/bin/env bash
# Forced command for the GitHub DEV deploy key. Never eval SSH_ORIGINAL_COMMAND.
set -euo pipefail
private=/private/uid-dev
command=${SSH_ORIGINAL_COMMAND:-}
[[ -n "$command" && "$command" != *[[:cntrl:]]* && "$command" != *\'* && "$command" != *\"* && "$command" != *\\* ]] || exit 126
IFS=' ' read -r -a words <<< "$command"
count=${#words[@]}
if [[ "$count" -ge 4 && ${words[0]} == /usr/bin/bash && ${words[1]} == "$private/bin/uid-publish.sh" && ${words[2]} == "$private/server.env" ]]; then
 case "${words[3]}" in
  check) [[ "$count" == 4 ]] || exit 126;;
  prepare|rollback) [[ "$count" == 5 && ${words[4]} =~ ^[0-9]+-[0-9]+$ ]] || exit 126;;
  publish) [[ "$count" == 7 && ${words[4]} =~ ^[0-9]+-[0-9]+$ && ${words[5]} =~ ^[a-f0-9]{40,64}$ && ${words[6]} =~ ^[01]$ ]] || exit 126;;
  *) exit 126;;
 esac
 exec /usr/bin/bash "${words[@]:1}"
fi
# rsync arguments contain only generated flags and an explicit private staging path.
# --protect-args/-s is deliberately absent: it hides the destination in the protocol.
if [[ "$count" -ge 5 && ( ${words[0]} == rsync || ${words[0]} == /usr/bin/rsync ) && ${words[1]} == --server ]]; then
 last=$((count-1)); dot=$((count-2))
 [[ ${words[$dot]} == . ]] || exit 126
 [[ ${words[$last]} =~ ^/private/uid-dev/incoming/[0-9]+-[0-9]+/(dist/|manifest.tsv)$ ]] || exit 126
 for ((i=2; i<dot; i++)); do
  flag=${words[$i]}
  [[ "$flag" =~ ^-[logDdptvrzei]+(\.[a-zA-Z.]+)?$ || "$flag" == --log-format=X || "$flag" == --dirs || "$flag" == --msgs2stderr || "$flag" == --chmod=Du=rwx,Dgo=,Fu=rw,Fgo= ]] || exit 126
 done
 exec /usr/bin/rsync "${words[@]:1}"
fi
exit 126
