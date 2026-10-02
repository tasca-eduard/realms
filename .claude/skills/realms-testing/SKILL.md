---
name: realms-testing
description: How to check a change to the Eight Realms game (F:\dev\realms) - which of the 90 headless checks to run for which kind of change, how to run them on a temporary server (in the background when long), how to read their reports, and which ones are flaky. Use after changing anything in src/ or tests/, before calling a task done, when a check fails, or when asked to run the suite or "test" or "verify" the game.
---

# Checking a change to Eight Realms

Every check drives the real game in headless Edge (`tools/shot.mjs`), and `tools/test-all.mjs` runs the 90 of them.
A check passes only when its report shows what its description says. Full guide: `docs/testing/testing.md`; every
check by realm and area: `docs/testing/checks.md`.

## Steps

1. **Type-check**: `npx tsc --noEmit -p .` (no output = clean). Fix errors first.
2. **Load the realm once** and look for errors (a free port above 5180; 5173 and 5174 belong to another app, the
   lead's server is on 5175):
   `bash tools/withserver.sh . 5190 node tools/shot.mjs "shot&play&realm=<castle|forest|aqua>" shots/load.png 2500`
   Any `[pageerror]` or `[shot] __ready never set` is a failure: fix it before running checks.
3. **Pick the checks** for the change (names as in `tools/test-all.mjs`; realm 1 has no suffix, realm 2 ends in 2,
   realm 3 in 3):

   | Changed | Run |
   |---|---|
   | Land, props, colliders, water, a place moved | `reach*`, `spawns*`, `normals*` of the realm; its mount reach (`reachstag`, `reachstag2`, `reachserpent`, `seastair`, `arenastag`); checks that visit the place; before/after screenshots (skill `realms-screenshots`) |
   | Foes, people, critters placed | `spawns*`; `foes`, `foes2` or `seafoes`; `economy*` if health or coins changed |
   | Prices, chests, rewards, foe health | `economy`, `economy1`, `economy2`, `economy3`; `wares`, `wares1`, `folk`, `reef` |
   | A boss or mini-boss | `boss`; `warden wardenfair bossbot hold`; `tidelord tidefair tidebot palace`; `costume salvagerbot`; `inkbot` |
   | Moves, input, HUD, menus | `controls moves menus talk pad phone pause fly` |
   | Saving, quests, story flags | the realm's reload checks (`migrate sister hold kip serpent palace costumedrop`), `review` |
   | Borders, travel | `travel border menutravel worldmap seastair stairleap stairmenu` |
   | Under the sea, air, the serpent | `sea costume serpentswim serpentmoves serpentledge rides reachserpent` |
   | Models and geometry | `normals*`, `rigs` |
   | Lights / sound | `lights soak` / `seasound pause` |
   | A whole group of work | the full suite |

4. **Run them** on a temporary server: `bash tools/withserver.sh . 5190 node tools/test-all.mjs <names>`.
   A few quick checks can run in the foreground. Anything over two minutes (the bots, many checks, the full suite:
   about 40 to 45 minutes) runs **in the background** (`run_in_background`), logged to `shots/suite.txt`; post a short
   status line every few minutes (`grep -c '^[^ ]' shots/suite.txt` checks started, `grep -n -E 'FAILED|pageerror|script error' shots/suite.txt`).
   Never block the chat in a wait loop.
5. **While a run is going, don't edit `src/`, `tests/` or `tools/`**: Vite reloads the page mid-check and spoils it.
   Do read-only work, or work in a copy (`docs/workflow/parallel-work.md`).
6. **Read every report** against the description printed above it. Failures: a field not as described, a
   `[pageerror]` (always, whatever the report says), a `[script error]`, `FAILED:` (the run crashed; all of them
   failing means no server on the port), a missing `[report]`. Many long checks compute `ok`; when it is false, find
   the field that made it so. To see a check's full log, run it through `tools/shot.mjs` by hand with the same
   query, wait, size and script as its entry.
7. **Rerun failures alone** before believing them. Flaky by timing or chance (the game steps at most 0.05 s a frame,
   so on a loaded machine it runs slower than the scripts' clocks): the bots (`bossbot`, `tidebot`, `salvagerbot`,
   `inkbot`, `wardenfair`, `tidefair`), `pad` (90 ms button presses), `costume` (air drained over 3 s of clock), `foes`
   (the brute dazes 35% of the time), `foes2`, `seafoes`, `lights`. Passes alone: timing. Fails the same way twice:
   real. Run a bot two or three times and compare `seconds` and `heartsLost`.
8. **Record it**: in the task's Done entry on the board, which checks ran and what they showed (numbers for bots and
   economy). A real failure you don't fix goes to the backlog: `node tools/board.mjs new backlog <slug> "<title>"`.

## Reading the standing checks

- reach: `unreachable: []`, `escapes: []`, `trapCount: 0`; `early` only what the story means to keep shut.
  `window.__reach(true).route(x, z)` traces how the flood got somewhere.
- spawns: `bad: []`. normals: `bad: 0`.
- bots: `fight.won`, `seconds` inside the window, `heartsLost` under the limit; fairness: every telegraph 1.2 s or
  more, one attack at a time, the dodging bot hardly hit and the still one hit.
- seasound: the browser is muted; the check reads the audio graph, place by place.

## Writing a new check

A script in `tests/` evaluated in the page: `const g = window.__game`; set `window.__report = () => out` first; drive
the game with `p.place(x, z, g)`, real key and mouse events (`tests/bossbot.js`), waits; end with an `ok` field for a
long check. A check across a reload writes to `sessionStorage`, calls `location.reload()`, and its second part goes
in `AFTER`. Details and the input recipes: `docs/testing/testing.md`, "Writing a check script". Adding it to
`tools/test-all.mjs` is that file's owner's job: give them the entry (name, query, wait, script, description).
