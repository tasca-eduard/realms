#!/usr/bin/env bash
# Makes work copies of the project for agents working in parallel (see docs/workflow/parallel-work.md).
#
# Usage: bash tools/copies/make-copy.sh [--base <dir> | --from <dir>] <copy> [<copy>...]
#   --base <dir>  first make <dir>, the untouched starting copy (the merge base), from the project as it is now,
#                 then each work copy from it
#   --from <dir>  make the work copies from an existing base (taken earlier: the project may have moved on since)
#   neither       each work copy straight from the project (no merge base kept: only for copies that won't be
#                 merged back, such as a snapshot for long bot runs)
#   PROJECT=<dir> the project to copy (default: two folders up from this script)
#
# A copy is the project without node_modules, .git, shots, shots-*, dist and .vite-cache (tar with excludes). A work
# copy then gets node_modules as a junction to the project's (nothing installed twice) and `cacheDir: '.vite-cache'`
# in its own vite.config.ts, so its dev server never writes into the project's Vite cache. A base copy gets neither:
# it's only ever read, by tools/copies/merge-copy.cjs.
#
# Nothing is ever deleted: a folder that already exists and isn't empty is refused. To remove a copy later, remove
# its node_modules junction first on its own (`cmd //c rmdir <copy>\node_modules`, which leaves the project's
# node_modules alone), then the folder.
set -euo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
project=$(cd "${PROJECT:-$here/../..}" && pwd)
base=""
from=""
copies=()
while [ $# -gt 0 ]; do
  case "$1" in
    --base) base="${2:?--base needs a folder}"; shift 2 ;;
    --from) from="${2:?--from needs a folder}"; shift 2 ;;
    -h|--help) sed -n '2,19p' "$0"; exit 0 ;;
    -*) echo "Unknown option: $1" >&2; exit 2 ;;
    *) copies+=("$1"); shift ;;
  esac
done
if [ -n "$base" ] && [ -n "$from" ]; then echo "Give --base or --from, not both." >&2; exit 2; fi
if [ ${#copies[@]} -eq 0 ] && [ -z "$base" ]; then sed -n '2,19p' "$0" >&2; exit 2; fi
if [ ! -f "${project:?}/package.json" ] || [ ! -d "$project/node_modules" ]; then
  echo "No project with node_modules at $project (run npm install there first)." >&2; exit 1
fi

# An empty or new folder, or stop: nothing here is ever deleted.
fresh() {
  local dir="${1:?}"
  if [ -e "$dir" ] && [ -n "$(ls -A "$dir" 2>/dev/null)" ]; then
    echo "$dir already exists and isn't empty: pick another name or clear it by hand." >&2; exit 1
  fi
  mkdir -p "$dir"
}

# Copies <from> into <to> without the installs, caches, builds and screenshots.
pack() {
  local src="${1:?}" dst="${2:?}"
  (cd "$src" && tar --exclude=./node_modules --exclude=./.git --exclude=./shots --exclude='./shots-*' \
    --exclude=./dist --exclude=./.vite-cache --exclude=./.merge-tmp -cf - .) | (cd "$dst" && tar -xf -)
}

# Makes <copy> a work copy: node_modules linked to the project's, its own Vite cache folder.
prepare() {
  local dir="${1:?}"
  if command -v powershell.exe > /dev/null && command -v cygpath > /dev/null; then
    local link target
    link=$(cygpath -w "$dir/node_modules")
    target=$(cygpath -w "$project/node_modules")
    powershell.exe -NoProfile -NonInteractive -Command \
      "New-Item -ItemType Junction -Path '${link:?}' -Target '${target:?}' | Out-Null"
  else
    ln -s "$project/node_modules" "$dir/node_modules"
  fi
  if [ ! -f "$dir/node_modules/vite/bin/vite.js" ]; then echo "The node_modules link in $dir doesn't work." >&2; exit 1; fi
  # The cacheDir line goes under `export default defineConfig({`, in the file's own line endings.
  node -e '
    const fs = require("fs"), p = process.argv[1];
    let s = fs.readFileSync(p, "utf8");
    if (!s.includes("cacheDir")) {
      const eol = s.includes("\r\n") ? "\r\n" : "\n";
      s = s.replace(/defineConfig\(\{\r?\n/, (m) => m + "  cacheDir: \x27.vite-cache\x27," + eol);
      fs.writeFileSync(p, s);
    }
    if (!fs.readFileSync(p, "utf8").includes("cacheDir")) { console.error("No cacheDir line in " + p); process.exit(1); }
  ' "$dir/vite.config.ts"
}

source_dir="$project"
if [ -n "$base" ]; then
  fresh "$base"
  pack "$project" "$base"
  echo "base   $base (from $project)"
  source_dir="$base"
elif [ -n "$from" ]; then
  if [ ! -f "${from:?}/package.json" ]; then echo "No base copy at $from" >&2; exit 1; fi
  source_dir="$from"
fi
for c in "${copies[@]}"; do
  fresh "$c"
  pack "${source_dir:?}" "$c"
  prepare "$c"
  echo "copy   $c (from $source_dir)"
done
if [ -z "$base" ] && [ -z "$from" ] && [ ${#copies[@]} -gt 0 ]; then
  echo "Note: no base copy kept. To merge these back later you need one taken at the same moment (--base)." >&2
fi
echo "Start a copy's server in its folder: node node_modules/vite/bin/vite.js --port <PORT> --strictPort"
