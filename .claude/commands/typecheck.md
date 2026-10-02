---
description: Type-check the game (tsc --noEmit) and report the errors by file
allowed-tools: Bash(npx tsc:*)
---

Type-check the project: run `npx tsc --noEmit -p .` in the project folder (it checks `src/` only; tests and tools
are plain JavaScript run in the page or by node).

- No output and exit status 0: say "Type-check clean." and stop.
- Otherwise list the errors grouped by file, as `path:line: message`, the first 30 if there are more (and say how
  many there are in all). If you pipe the output, read tsc's status from `${PIPESTATUS[0]}`, not `$?`.
- Don't fix anything unless asked; if the errors are in files changed in this session, say which change caused them.
