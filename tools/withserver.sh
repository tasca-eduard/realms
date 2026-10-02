#!/usr/bin/env bash
# Runs a command against a temporary game server.
#
# Usage: bash tools/withserver.sh <dir> <port> <command...>
#   Starts Vite in <dir> (the project, or a work copy of it) on <port>, waits until it answers,
#   runs <command...> in <dir> with PORT=<port> set, then stops the server. Exits with the
#   command's status (2: bad arguments, 3: the port is already taken, 4: the server never answered).
#
# Examples (from the project folder):
#   bash tools/withserver.sh . 5190 node tools/test-all.mjs reach3 spawns3 normals3
#   bash tools/withserver.sh . 5190 node tools/shot.mjs "shot&play&realm=aqua" shots/reef.png 2500
#
# Pick a free port: on this machine 5173 and 5174 belong to another app and the lead's server runs on 5175;
# work copies use ports above 5180 (docs/workflow/parallel-work.md).
# WITHSERVER_LOG=<file> keeps Vite's own output (default: thrown away).
# WITHSERVER_WAIT=<seconds> is how long to wait for the server (default 30).

set -u

usage="usage: bash tools/withserver.sh <dir> <port> <command...>"
if [ "$#" -lt 3 ]; then
  echo "withserver: $usage" >&2
  exit 2
fi
dir="${1:?$usage}"
port="${2:?$usage}"
shift 2
case "$port" in
  '' | *[!0-9]*)
    echo "withserver: the port must be a number, not '$port'" >&2
    exit 2
    ;;
esac

log="${WITHSERVER_LOG:-/dev/null}"
wait_s="${WITHSERVER_WAIT:-30}"

cd "${dir:?}" 2> /dev/null || { echo "withserver: no folder '$dir'" >&2; exit 2; }
vite="node_modules/vite/bin/vite.js"
if [ ! -f "$vite" ]; then
  echo "withserver: '$dir' has no $vite (run npm install there, or point at the project)" >&2
  exit 2
fi

url="http://localhost:${port:?}/"
answers() { curl -s -o /dev/null --max-time 2 "$url"; }

# Something already on the port would be checked instead of this folder's game: refuse.
if answers; then
  echo "withserver: port $port already answers (another server?); pick a free port" >&2
  exit 3
fi

node "$vite" --port "$port" --strictPort > "$log" 2>&1 &
pid=$!
stop() {
  if [ -n "${pid:-}" ]; then
    kill "$pid" 2> /dev/null
    wait "$pid" 2> /dev/null
    pid=""
  fi
}
trap stop EXIT
trap 'stop; exit 130' INT TERM

up=0
tries=$(( wait_s * 2 ))
i=0
while [ "$i" -lt "$tries" ]; do
  if answers; then up=1; break; fi
  if ! kill -0 "$pid" 2> /dev/null; then break; fi
  sleep 0.5
  i=$(( i + 1 ))
done
if [ "$up" -ne 1 ]; then
  echo "withserver: the server on port $port never answered (set WITHSERVER_LOG=<file> to see why)" >&2
  exit 4
fi

PORT="$port" "$@"
status=$?
stop
exit "$status"
