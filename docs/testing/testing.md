# How the game is checked

There are no unit tests. Every check drives the real game in headless Microsoft Edge: a script runs in the page,
moves the knight, presses keys, reads the game's state and leaves a report. You read each report against the check's
description, which is its pass condition. Screenshots back up anything about looks.

- [The checks](checks.md): all 91 checks in `npm test`, by realm and area, one line each.
- [Testing shortcuts](shortcuts.md): URL flags (`?play`, `&at=`, `&god`, `&realm=`...), debug keys, `__reach()` in
  the console, one-line screenshot commands.
- [The docs index](../README.md); the code map in [architecture](../code/architecture.md); the user's
  [design rules](../design/design-rules.md), which several checks enforce (fair fights, no way out of the world,
  the economy); working in copies in [parallel work](../workflow/parallel-work.md).

## At a glance

```
npx tsc --noEmit -p .                                          # type-check (npm run typecheck); always first
npm run dev                                                    # a dev server: read its port from Vite's output
PORT=5175 node tools/shot.mjs "shot&play&realm=aqua&at=37,66" shots/v.png 2500   # one screenshot
PORT=5175 npm test -- reach3 spawns3 normals3                  # some checks, against that server
bash tools/withserver.sh . 5190 node tools/test-all.mjs reach3 spawns3     # the same with a temporary server
bash tools/withserver.sh . 5190 node tools/test-all.mjs > shots/suite.txt 2>&1   # the whole suite (in the background)
PORT=5175 node tools/shot.mjs "shot&play&realm=aqua" shots/map.png 1500 1280x1280 tools/mapview.js   # the overhead map
```

**Ports.** On this machine 5173 and 5174 belong to another app, and the lead's own server usually runs on 5175
(`npm run dev` asks for 5173 and takes the next free port: read it from Vite's output). `tools/shot.mjs` and the suite
default to 5173, so always pass `PORT=<port>`; without it they talk to the other app and report
`[shot] __ready never set`. `tools/withserver.sh` sets `PORT` itself. Work copies take ports above 5180 (see
[parallel work](../workflow/parallel-work.md)); 5190 is used for temporary servers in these docs.

Everything needs Microsoft Edge installed (`tools/shot.mjs` drives it through `playwright-core`, channel `msedge`).
`shots/` is git-ignored: screenshots and logs go there.

## The pieces

### tools/shot.mjs: one headless run

```
node tools/shot.mjs [query] [out.png] [waitMs] [WxH] [script.js]
```

| Argument | Default | Meaning |
|---|---|---|
| `query` | `shot` | Appended to `http://localhost:<PORT>/?`. `shot&play` skips the title; see [shortcuts](shortcuts.md). |
| `out.png` | `shots/shot.png` | Where the screenshot goes (taken at the end). |
| `waitMs` | `2500` | How long to wait after the script before the screenshot and the report. |
| `WxH` | `1280x720` | The viewport. `1280x1280` for the overhead map, `844x390` for a phone held sideways. |
| `script.js` | none | A file evaluated in the page once the game is ready (drives the game, sets a report). |

| Variable | Meaning |
|---|---|
| `PORT=<n>` | The server's port (default 5173, which is another app on this machine: always set it). |
| `MOBILE=1` | A phone: touch, `isMobile`, device scale 2; the page is tapped once before the script. |
| `PROFILE=<dir>` | Keep browser storage in `<dir>` between runs (saving and loading over two sessions). |
| `AFTER=<a.js,b.js>` | Scripts for the page after a reload, each run once the reloaded game is ready. |
| `AFTER_WAIT=<ms>` | The wait after each `AFTER` script (default 3000). |

What it does, in order: launches Edge headless with the GPU on (`--use-angle=d3d11`); opens the page; waits up to
20 s for `window.__ready` (set in `src/main.ts` once the game has started); with `MOBILE`, taps the middle of the
screen; evaluates the script; waits `waitMs`; runs the `AFTER` scripts; takes the screenshot; calls
`window.__report()` if the page has one; prints the last 40 log lines and `saved <out.png>`.

The lines it prints:

| Line | Meaning |
|---|---|
| `[report] {...}` | The JSON from `window.__report()`, called at the very end. This is what a check is judged on. |
| `[script] ...` | The value the script evaluated to, if it wasn't `undefined`. |
| `[pageerror] ...` | An uncaught error in the page: the game threw, or code in the script's timers or un-awaited async parts did. Always a failure, whatever the report says. |
| `[script error] ...` | The script itself threw while it was evaluated (or an awaited async part rejected); for `AFTER` scripts, the file name comes first. |
| `[report error] ...` | `window.__report()` threw. |
| `[shot] __ready never set` | The game didn't start within 20 s (a build error, a crash at load, a server that isn't this project). |
| `[404] <url>` | A request the server refused (a missing asset). |
| `[log]`, `[warning]`, `[error]` ... | The page's console. |

A script whose last statement is an `async` block, `(async () => { ... })();`, evaluates to a promise, and
Playwright waits for it: the whole block runs before `waitMs` starts. A script that ends with
`window.__report = () => out;` returns at once, and `waitMs` must cover everything it does. Both kinds are in
`tests/`; when you add up how long a check takes, count both.

### tools/test-all.mjs: the suite

A list of 91 checks; for each, it runs `tools/shot.mjs` with the check's query, wait, script, size and variables,
saves `shots/test-<name>.png`, and prints:

```
reach3    the Sunken Reef: everything reachable, no way out of the world, nowhere to be stranded (traps: 0)
          [report] {"done":{"reachable":...,"unreachable":[],"escapes":[],"traps":[],"trapCount":0},"early":[...]}
```

The first line is the check's name and description; under it only the `[report]`, `[pageerror]` and
`[script error]` lines. `FAILED: ...` means `shot.mjs` itself crashed (no server on the port: every check
fails this way; Edge missing; a browser crash). Every check without a report usually means the wrong `PORT`.
The other log lines are dropped: when a report is missing or odd, run the same check through `tools/shot.mjs` by
hand (the same query, wait, size, script and variables as its entry) to see them all.

Each entry is `[name, query, waitMs, script, description, env?, size?]`; `env` holds `MOBILE` or `AFTER` and
`AFTER_WAIT`. The suite takes the names to run as arguments: `PORT=5175 node tools/test-all.mjs bats economy` (or
`PORT=5175 npm test -- bats economy`); with none it runs all 91.

**How long.** The waits add up to about 31 minutes. Each check also spends 3 to 4 s starting Edge and building
the realm, and awaited scripts add their own time: a full run is about 40 to 45 minutes on a quiet machine, longer
under load. Single checks take seconds (the static ones: `reach`, `spawns`, `normals`, `economy1/2/3`) to two and
a half minutes (the bots).

**Checks across a reload** (↻ in [the checks](checks.md)): part 1 does its work, writes what it found to
`sessionStorage` (it survives the reload; `localStorage` holds the save) and reloads the page, or crosses a
border, which reloads it. Then each `AFTER` script runs once the new page is ready, reads `sessionStorage`, adds its
own findings and sets `window.__report`. See `tests/kip1.js` and `tests/kip2.js`.<a id="reloads-after"></a> The
runner waits for `window.__ready` before each `AFTER` script, but a page that never reloaded is still ready, so
part 2 then runs on the same page and proves nothing about reloads: part 1 must reload. (Today
`tests/costumedrop1.js` doesn't.)

## Writing a check script

A script is plain JavaScript evaluated in the page after the game is ready. `window.__game` is the game (`g`).

```js
// What this checks, in a sentence or two: the pass condition, as the suite's description will say it.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
window.__report = () => out; // first, so a script that throws halfway still reports what it got
(async () => {
  p.place(37, 66, g);                       // teleport (x, z)
  g.cam.focus.set(p.x, p.y, p.z);           // and bring the camera along at once
  await wait(500);
  out.before = { hp: p.hp, coins: p.coins };
  // ... drive the game ...
  out.ok = out.before.hp === 5;             // for a long check: one field that says pass or fail
})();
```

Things scripts use (read the code for the rest; `tests/` has an example of almost everything):

- **The game**: `g.player` (`p.x`, `p.z`, `p.hp`, `p.maxHp`, `p.state`, `p.effects`, `p.air`, `p.dives`,
  `p.swordLevel`, `p.place(x, z, g)`, `p.cureAll()`), `g.enemies` (`e.type`, `e.alive`, `e.home`,
  `e.takeHit(...)`, `e.despawn(g)`), `g.npcs` and `g.npc(id)`, `g.realm` (the map's data: objects, regions,
  `w`, `d`), `g.grid` (`groundAt(x, z)`, `isDeep(x, z)`, `water`, colliders), `g.save.data` (flags, quests,
  coins) and `g.writeSave()`, `g.state` (`play`, `dead`, `story`, `victory`), `g.paused`, `g.ui.dialogOpen`,
  `g.audio`, `g.cam`. The real names live in `src/game/game.ts`, `player.ts`, `enemies.ts` and `save.ts`.
- **The diving suit** (realm 3): `g.save.data.flags.costume = true; p.dives = true;`
- **No damage**: `&god` in the query, or `g.godMode = true` (switch it off for a check that wants hurt).
- **A stronger knight**: `p.swordLevel = 5`, `p.maxHp = p.hp = 99` (the bots read `&lvl=N` from the query).
- **The camera**: `g.cam.zoom` is 1 for the game's view; 0.7 shows more, 1.6 is a close-up (explore mode's wheel
  keeps it between 0.3 and 1; a script may set more). `&lines=200` in the query zooms the pixel grid in.
- **Waiting**: `await wait(ms)` between steps. Prefer waiting for a condition with a deadline to a fixed time when
  the step depends on the game's speed (see [flaky checks](#flaky-checks)).
- **Saves**: each run is a fresh browser, so a fresh save. A script that saves and later checks in the same page can
  clear it with `localStorage.removeItem('realms-save')` at the end, as the bots do.

**Driving it like a player** (the bots do this: `tests/bossbot.js`, `tests/tidebot.js`):

- Keys: `window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }))`, then `'keyup'`.
  `KeyW` `KeyA` `KeyS` `KeyD` (or the arrow keys) move in screen directions; to walk a world direction, project it
  on `g.cam.groundRight` and `g.cam.groundUp` (`steer` in `tests/bossbot.js`). `Space` jumps, `KeyE` interacts,
  `KeyQ` drinks a flask, `KeyF` is the special, `Escape` pauses. Bindings: `src/engine/input.ts`.
- Mouse: attack is the left button, guard the right. Press on the canvas
  (`document.querySelector('#view canvas').dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX, clientY, bubbles: true }))`)
  and release on the window (`window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }))`). A guard tap of
  60 to 70 ms rolls, a hold blocks. Aim with a `mousemove` on the canvas at a screen point; `g.cam.toScreen(v, s)`
  gives a world point's screen position (`aimAt` in `tests/bossbot.js`). A `mousemove` without `buttons` set
  releases a held attack or guard.
- Any key (the story, death, the victory screen):
  `window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse' }))`.
- A gamepad: replace `navigator.getGamepads` with a fake pad and flip its buttons (`tests/pad.js`). Touch: run with
  `MOBILE=1` (`tests/mobileflow.js`).

**Adding it to the suite**: an entry in `TESTS` in `tools/test-all.mjs` (only the agent or person who owns that
file edits it). Write the description as the pass condition, plainly enough that someone reading the report can
judge it without opening the script; a long check also computes `ok`.

## The standing checks

These guard the user's rules for every realm. Run the realm's set after any change to its land, people or numbers.

**Reach** (`reach`, `reach2`, `reach3`). `window.__reach(progress = true, climb = 1.5, serpent = false)`
(`src/game/reach.ts`) floods the map from the start the way the knight moves: walking, stepping and jumping up to
`climb` metres (under the sea 1.7 m, only where the floor is 2.5 m deep or more), dropping down, running jumps over
gaps of two cells, no deep water without the suit, no solid colliders. It returns `unreachable` (things he can't get
to: `{what, x, z}`), `escapes` (cells where he'd leave the world), `traps` and `trapCount` (cells he can reach but
not get back to the start from: places to be stranded), `reachable` (a cell count), and `route(x, z)` and
`reached(x, z)` for tracing. `progress = true` assumes the story done (bridges down, walls broken, cages open);
`false` checks before it, and the check reports what that keeps shut as `early`. **Pass**: `unreachable: []`,
`escapes: []`, `trapCount: 0`; `early` should only hold what the story means to keep shut (gates, cages, the
tyrant). To trace an escape: `__reach(true).route(x, z)` in the console or a script gives the path the flood took.
The mounts have their own: `reachstag` and `reachstag2` (`climb` 2.75, the Thornstag's second leap),
`reachserpent` (the Tide Serpent, `serpent = true`), `seastair` and `arenastag`.

**Spawns** (`spawns`, `spawns2`, `spawns3`): every foe, villager, critter and the horse is pushed out of colliders
from its start spot; anything moved more than 5 cm, in deep water (but divers and sea creatures), out of the water
(sea creatures), or within 1.2 m of a fire on the ground is listed. Known exceptions are built in (caged captives,
perched owls, bats, the smith at his forge, sitters on their stools). **Pass**: `bad: []`.

**Normals** (`normals`, `normals2`, `normals3`): no vertex in the scene with a zero or not-a-number normal or
position. One NaN pixel, smeared by the bloom, blackens a square of the screen. **Pass**: `bad: 0`.

**Economy** (`economy`, `economy1`, `economy2`, `economy3`): a realm's chests, quests and trial pay for what it sells
with a modest surplus, not twice over, and its foes take as many blows with the sword the knight brings as realm 1's
did with a new one (`foeHp`: Whisperwood 1.6, the Reef 2.25). Run them after changing a price, a chest, a reward or
a foe's health.

**Bots and fairness**. The user's rule for every boss: room for the boss's style, every attack shown before it lands
(marks that fill for 1.2 s or more, aim lines fixed well before), one attack at a time, nothing that holds the knight
still under other attacks. Two kinds of check prove it:

- Fairness (`wardenfair`, `tidefair`; `inkbot` and `salvagerbot` check it too): the arena's room and walls, every
  telegraph's length, one attack at a time from a log of the fight; a bot that only steps out of the way, a quarter
  second after each warning, is hardly hit, and one that stands still is.
- Balance (`bossbot`, `tidebot`, `salvagerbot`, `inkbot`): a player-like bot (real keys and aimed clicks, dodging
  what it can see coming a quarter second late) fights at the expected sword level (`&lvl=N`) and must win inside a
  time window, losing at most so many hearts. The report's `fight` holds `won`, `seconds`, `heartsLost` and what hit
  it; `fair`, `balanced` or `ok` sum it up.

Run them after any change to a boss, its arena, its crew or the sword levels; run a bot two or three times and look
at the spread before tuning (one run is one sample).

**Sound** (`seasound`): the headless browser is muted, so nobody has heard the game during development. The check
reads what the game hands the audio and the audio graph itself, place by place in the Sunken Reef: each place's
track and ambience, the surf by the water, creaking planks, the inn's shanty, echoes in caves and the temple, the
lighthouse's hum, Brassbelly's fight music, no splashes on the sea floor. Run it after changing realm 3's sound,
regions or places.

## What to run after a change

| You changed | Run |
|---|---|
| Anything | `npx tsc --noEmit -p .` first; then load the realm once (`PORT=<port> node tools/shot.mjs "shot&play&realm=<id>" shots/x.png 2500`): no `[pageerror]`. |
| Land, props, colliders, water, a place moved | The realm's `reach`, `spawns`, `normals`; its mount reach (`reachstag`/`reachstag2`, `reachserpent`, `seastair`, `arenastag`); the overhead map and before/after screenshots; checks that visit the place (`treasures2`, `corners2`, `secrets2`/`secrets3`, `rides`...). |
| Foes, villagers, critters placed | `spawns`; the realm's foe check (`foes`, `foes2`, `seafoes`); `economy*` if health or coins changed. |
| Prices, chests, rewards, foe health | `economy`, `economy1`, `economy2`, `economy3`; the shops (`wares`, `wares1`, `folk`, `reef`). |
| A boss or mini-boss, its arena or crew | Its fight check and its bots: `boss`; `warden`, `wardenfair`, `bossbot`, `hold`; `tidelord`, `tidefair`, `tidebot`, `palace`; `costume`, `salvagerbot`; `inkbot`. |
| The knight's moves, input, the HUD or menus | `controls`, `moves`, `menus`, `talk`, `pad`, `phone`, `pause`, `fly`. |
| Saving, quests, story flags | The ↻ checks of that realm (`migrate`, `sister`, `hold`, `kip`, `serpent`, `palace`, `costumedrop`) and `review`. |
| Borders and travel | `travel`, `border`, `menutravel`, `worldmap`, `seastair`, `stairleap`, `stairmenu`. |
| Under the sea: physics, air, the suit, the serpent | `sea`, `costume`, `serpentswim`, `serpentmoves`, `serpentledge`, `rides`, `reachserpent`. |
| Meshes, models, geometry helpers | `normals*`, `rigs`; screenshots. |
| Lights | `lights`, `soak`. |
| Sound | `seasound`, `pause` (no music burst). |
| Frame rate | `tests/tour.js`, `tests/tour2.js` (not in the suite; see [the checks](checks.md#not-in-the-suite)). |
| A whole group of work, before calling it done | The full suite. |

## The overhead map

`tools/mapview.js` draws the current realm from above over the page, one square per metre:

```
PORT=5175 node tools/shot.mjs "shot&play&realm=aqua" shots/map-aqua.png 1500 1280x1280 tools/mapview.js
PORT=5175 node tools/shot.mjs "shot&play&realm=aqua&crop=25,55,60,80" shots/map-village.png 1500 1280x1280 tools/mapview.js
```

Ground is coloured by type and shaded by height; water light blue where shallow, dark blue where deep (a sea's floor
darker the deeper it is); decks brown; black is a drop out of the world. Trees and rocks are dark green dots, box
colliders brown. Moonfires are blue, chests gold, shards cyan, people white, foes red (at their posts), snares
orange, vines green lines, lore stones and signs violet. The numbers along the edges are map coordinates (every 20 m;
every 5 m in a crop of 60 m or less). `&crop=x0,z0,x1,z1` draws only that part, bigger. The report gives the scale
(`cell`, pixels a metre) and the number of trees.

Use it to plan where things go and to review a realm against the design rules: even sprinkles, empty stretches,
crowding, paths. `tools/emptymap.js` (same command, that script) colours every reachable cell by its distance to the
nearest thing with a purpose (green near, red far) and reports the empty patches over 13 m, biggest first.

## Flaky checks

The game steps its world by the frame's real time, but never more than 0.05 s a frame (`src/game/game.ts`, the
frame loop). On a loaded machine (several servers, a suite and screenshots at once, a build, many agents) frames
take longer than that, and the game runs slower than the clock the script waits on. Checks that compare game events
with wall-clock waits, or that depend on chance, can then fail without anything being wrong. They are marked † in
[the checks](checks.md):

- **The bots** (`bossbot`, `tidebot`, `salvagerbot`, `inkbot`; and `wardenfair`, `tidefair`): they react on timers,
  so on slow frames they dodge late and lose more hearts, and fights run longer in seconds; the boss's choices are
  random too. A fight a little outside its window is noise; a clear loss or many more hearts is not.
- **`pad`**: each faked button press lasts 90 ms and the game reads the pad once a frame; a frame longer than that
  misses the press, so a tap count is off or a talk doesn't end.
- **`costume`** (air): it waits 3 s of clock and wants 2.5 to 3.5 s of air drained (and 2.4 to 3.4 m run while
  breathless); slow frames drain less.
- **`foes`**: the brute's blow dazes only 35% of the time (`dazeChance` in `src/config.ts`); in its 9 s at the brute
  the knight may not be dazed at all. `foes2` and `seafoes` are live encounters with the same kind of luck.
- **`lights`**: the biggest change in a lamp's light in one frame stays small; a long frame makes a bigger step.

**Rerun before believing a failure**: run the check alone with nothing else busy,
`bash tools/withserver.sh . 5190 node tools/test-all.mjs pad costume`. A check that passes alone and failed under
load was timing; one that fails the same way twice is real. For a bot, run it two or three times and compare
`seconds` and `heartsLost`.

## Long runs: the suite in the background

The full suite takes about 40 to 45 minutes. Never sit in a wait loop for it, and never block the chat:

1. Start it in the background on its own server and port, so nobody else's server is used or reloaded (in Claude
   Code, the Bash tool with `run_in_background`):

   ```
   bash tools/withserver.sh . 5190 node tools/test-all.mjs > shots/suite.txt 2>&1
   ```

2. Keep doing read-only work. Every few minutes post a one-line status, from the log:

   ```
   grep -c '^[^ ]' shots/suite.txt                          # checks started, of 91
   grep -n -E 'FAILED|pageerror|script error' shots/suite.txt   # anything gone wrong so far
   tail -n 2 shots/suite.txt                                # the check running now
   ```

   e.g. "Suite: 41 of 91, no errors so far, now on `wardenfair`."
3. **Don't edit `src/` while it runs** (nor `tests/` or `tools/`): Vite reloads the page when a source file changes,
   in the middle of whatever check is running, and spoils it; a changed test changes what later checks do. Work in a
   copy if you must change code (see [parallel work](../workflow/parallel-work.md)).
4. When it finishes, read every report against its description, list the failures by name, rerun those alone, then
   report.

Two suites in one folder write the same `shots/test-<name>.png` files; run a second one in a copy, on another port.

## Screenshots

Before and after shots from the game's camera prove a change to how a place looks (the user's rule: a change must
be plainly visible from the camera). The details (spots, zoom, under the sea, phone sizes, judging the shots) are in
the `realms-screenshots` skill, `.claude/skills/realms-screenshots/SKILL.md`. Read every PNG you take; a shot nobody
looked at proves nothing.
