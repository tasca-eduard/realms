---
description: Show what is in progress and to do on the board, and any checks or servers running now
allowed-tools: Bash(node tools/board.mjs), Bash(node tools/board.mjs todo:*), Bash(grep:*), Bash(tail:*), Bash(ls:*), Read
---

Give the current state of the work, short.

1. The board: run `node tools/board.mjs todo` (the to-do list in the user's format: done crossed out, the current
   task marked, the next ones) and `node tools/board.mjs` (counts per folder and titles). If the tool is missing,
   read the files in `board/in-progress/` and `board/todo/` (and `board/blocked/`: what waits on the user).
2. Running checks: any background tasks of this session running `tools/test-all.mjs` or `tools/shot.mjs` (name the
   task and its log). For a suite log in `shots/` (`ls -t shots/*.txt | head -3`), give its progress:
   `grep -c '^[^ ]' <log>` checks started, `grep -c -E 'FAILED|pageerror|script error' <log>` errors so far, and the
   check running now (`tail -n 2 <log>`).
3. Reply with the to-do list as `node tools/board.mjs todo` printed it, then one line per running check or suite,
   then anything blocked on the user. Change nothing.
