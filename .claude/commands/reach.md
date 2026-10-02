---
description: Run a realm's world checks (reach, escapes, traps, spawns, normals and its mounts' reach) and report
argument-hint: "<realm>  (castle | forest | aqua, or 1 | 2 | 3; none: all three)"
allowed-tools: Bash(bash tools/withserver.sh:*), Bash(curl:*), Read
---

Run the world checks for `$ARGUMENTS` (none: all three realms). They read the map, so they take seconds each.

1. The checks by realm (names in `tools/test-all.mjs`):
   - `castle` (1): `reach spawns normals reachstag`
   - `forest` (2): `reach2 spawns2 normals2 reachstag2 arenastag seastair`
   - `aqua` (3): `reach3 spawns3 normals3 reachserpent`
2. Run them in one go (a free port above 5180; never 5173-5175):
   `bash tools/withserver.sh . 5190 node tools/test-all.mjs <names>`
3. Judge each report (details in `docs/testing/testing.md`, "The standing checks"):
   - reach: `unreachable: []`, `escapes: []`, `trapCount: 0`. `early` lists what the story keeps shut before
     progress: only gates, cages, the tyrant and the like belong there.
   - the mounts' reach: `reachstag`/`reachstag2` want `escapes: 0` and `unexpected: []`; `reachserpent`,
     `arenastag` and `seastair` compute `ok: true` (read the fields behind a false one against the description).
   - spawns: `bad: []`. normals: `bad: 0`.
   - Any `[pageerror]` or `[script error]` fails the check.
4. Report one line per check (pass, or what is wrong with its coordinates). For an escape or a trap, offer to trace
   it: `window.__reach(true).route(x, z)` in a page script gives the path the flood took to it.
