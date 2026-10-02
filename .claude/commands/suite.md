---
description: Run the realms test suite (or the named checks) on a temporary server in the background, then report what failed
argument-hint: "[check names...]  (none: all 90; e.g. reach3 spawns3 normals3)"
allowed-tools: Bash(bash tools/withserver.sh:*), Bash(grep:*), Bash(tail:*), Bash(curl:*), Read
---

Run these checks of the game: `$ARGUMENTS` (empty means the whole suite, all 90 in `tools/test-all.mjs`).
How checks work: `docs/testing/testing.md`; the list: `docs/testing/checks.md`.

1. Every name must be a check in `tools/test-all.mjs` (the first item of each `TESTS` entry). If one isn't, say so
   and stop.
2. Pick a free port: 5190, or the next one up if `curl -s -o /dev/null --max-time 2 http://localhost:5190/` answers.
   Never 5173-5175 (another app, and the lead's server).
3. Start it **in the background** (Bash with `run_in_background`), writing to a log in `shots/`:

   `bash tools/withserver.sh . <port> node tools/test-all.mjs $ARGUMENTS > shots/suite.txt 2>&1`

   Say how long it will take: the whole suite about 40 to 45 minutes; one check a few seconds to two and a half
   minutes (the bots); add the waits of the named checks in `tools/test-all.mjs` plus 4 s each.
4. While it runs: **do not edit `src/`, `tests/` or `tools/`** (Vite would reload the page mid-check). Don't sit in a
   wait loop. For a long run, post a one-line status every few minutes:
   `grep -c '^[^ ]' shots/suite.txt` (checks started), `grep -n -E 'FAILED|pageerror|script error' shots/suite.txt`,
   `tail -n 2 shots/suite.txt` (the one running), e.g. "Suite: 41 of 90, no errors so far, now on `wardenfair`."
5. When it ends, read `shots/suite.txt` whole. For every check, judge its `[report]` against the description printed
   above it: it passes only if the report shows what the description says. A `[pageerror]`, a `[script error]`, a
   `FAILED:` line or a missing report is a failure. Every check failing at once usually means the server never came
   up (the wrapper's message is at the top of the log).
6. Rerun each failure once, alone, the same way (in the background if it is a bot). The checks marked † in
   `docs/testing/checks.md` depend on timing or chance (the bots, `pad`, `costume`, `foes`, `foes2`, `seafoes`,
   `lights`): one that passes alone was timing; one that fails the same way twice is real.
7. Report briefly: how many ran and passed; each real failure as `name: what the report shows` against `what the
   description wants`; the flaky ones and their reruns. Offer to add real failures to the board's backlog
   (`node tools/board.mjs new backlog <slug> "<title>"`).
