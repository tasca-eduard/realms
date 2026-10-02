# Eight Realms: instructions for Claude Code

An isometric action game in the browser (desktop and phone): Vite + TypeScript + Three.js, every model, prop and
sound made in code. A remake of the 2D prototype *Eight Realms* (`C:\Users\Ed\Downloads\eight-realms-source\eight-realms\src`):
realm 1 the Moonlit Keep (`castle`), realm 2 Whisperwood (`forest`), realm 3 the Sunken Reef (`aqua`) are built;
realm 4, the Scorched Dunes, is a draft plan on the board. Realms 2 to 8 are the prototype's realms in its order,
translated the way realm 1 was; realms connect through real places (a thorn road, a sea stair), never a plain portal.

**Start here:** the board (`board/README.md`) for what is being done and what is next, then `docs/README.md`, the
index of every doc and tool. The user's rules below always apply.

## Run it

```
npm install
npm run dev
```

- **Ports 5173 and 5174 are taken by another app on this machine.** `vite.config.ts` asks for 5173 without
  `--strictPort`, so Vite takes the next free port (5175 or later): read it from Vite's output. `tools/shot.mjs` and
  the suite default to 5173 (the other app), so always pass `PORT=<port>`; without it they report
  `[shot] __ready never set`. For a fixed port: `node node_modules/vite/bin/vite.js --port 5180 --strictPort`.
  `bash tools/withserver.sh <dir> <port> <command...>` starts a server in a folder (the project or a work copy), runs
  the command there with `PORT` set, and stops it.
- **URL shortcuts** (full list: `docs/testing/shortcuts.md`): `?play` skips the title and story;
  `&realm=castle|forest|aqua`; `&at=x,z` starts at a map position; `&god` no damage; `&dawn` the ending light;
  `&lines=200` zooms in; `?play&viewer&anim=attack0&t=0.2` every model in one pose; `?debug` turns on keys
  (G god mode, V explore mode, T teleport to the mouse, 1 to 9 the realm's debug spots (as many as it has: 8, 9, 8), N/B next or previous realm).
- **In the game:** the pause menu (Esc) travels to another realm (its travel list, or a click on a visited realm's
  island on the world map) and has explore mode (fly over everything, mouse wheel zooms out).
- **In the page:** `window.__game` is the game; `window.__reach()` floods the map the way the knight moves and lists
  what he can't reach and where he could leave the world.
- **One screenshot:** `PORT=5175 node tools/shot.mjs "shot&play&realm=aqua&at=60,50" shots/x.png 3000 1280x720 [script.js]`
  (prints the script's `window.__report()` as `[report] {...}` and any `[pageerror]`). The overhead map:
  `PORT=5175 node tools/shot.mjs "shot&play&realm=aqua" shots/map.png 1500 1280x1280 tools/mapview.js`.
  Look at the PNGs (Read them); `shots/` is not kept.

## Check it

- **Type-check:** `npx tsc --noEmit -p .` (no output means clean). When you pipe it (`... | tail -20`), `$?` is `tail`'s:
  read `${PIPESTATUS[0]}` for tsc's.
- **The suite:** `PORT=<port> npm test` runs the 90 scripted checks in `tools/test-all.mjs` in headless Edge, about 40
  to 45 minutes: always in the background. `PORT=<port> npm test -- talk pad` runs only those. Each check prints its
  description and its `[report]`: read every report; a check passes only when the report shows what the description
  says. How checks work and the table of all of them: `docs/testing/testing.md`, `docs/testing/checks.md`.
- `npm run build` type-checks and builds `dist/`.

## The code in one screen

```
src/config.ts   every tuning number: PLAYER, FOES, EFFECTS, HAZARDS, AIR, VIEW
src/engine/     renderer (pixel pipeline, outlines, bloom, fog, mist, the sea look, fog of war), iso camera, input,
                light pool, particles, Geo (triangle builder), Rig (merged skinned characters), materials
src/world/      Grid (heights, ground types, water, decks, colliders), terrain and water meshes, Builder and props,
                realm.ts (RealmData: what a realm's map provides), realm1/2/3.ts and their parts, outskirts, seastair
src/game/       Game (state, load, frame loop, events, saving), realms.ts (the RealmDef registry), Player, Enemy and
                the foe modules, combat, mounts, objects, hazards, story/ (one RealmStory per realm), quests, save, wares
src/ui/         HUD, dialogs, menus, touch controls, the world map
src/audio/      synthesized effects and ambience, sample-based music (tracks per realm)
tools/          shot.mjs (headless screenshots), test-all.mjs (the suite), mapview.js (overhead map)
tests/          scripts shot.mjs runs in the page: they drive the game and return a report
```

A realm loads like this: `REALMS[id].build(builder)` paints the grid and places props and returns `RealmData`; `Game`
turns its lists into objects, foes and people; `story.apply(g)` restores the story from the save. In depth:
`docs/code/architecture.md`; the file list: `docs/code/layout.md`.

## Conventions

- **Match the surrounding code**: its naming, idiom and comment density. Never reformat or reorder code; keep each
  edit small and in place (work from parallel copies is merged back 3-way, and local edits merge cleanly).
- **Comments are plain English sentences** about the game world and the why ("Foes and arrows hold still while you
  read, talk or watch a cutscene."), asides in brackets. Not "TODO", not code in prose. `docs/code/style.md`.
- **British spelling** in comments, docs and the game's words: colour, armour, metre, grey, centre, travelled
  (names that touch Three.js keep theirs: `color`).
- **Numbers in `src/config.ts`** (and a realm's own in its `RealmDef`/`RealmData`: `foeHp`, `physics`, its light).
- **Saves must keep working.** A realm's foes are saved as indexes into its enemy list: never remove or reorder
  spawns (retire one with `off: true`); keep ids of chests, moonfires, shards, walls and quests. A save from any
  earlier build must load with nothing lost (`tests/migrate1.js`).
- **Line endings: keep each file's own.** `core.autocrlf` is true: files git checked out are CRLF in the working tree
  (about 80: most of `src/engine`, `src/ui`, the older `src/game` and `src/world` files, `BOARD.md`, `README.md`),
  files made since are LF. The Edit tool keeps them; a scripted edit (sed, a node script) must write back the ending it
  read. A flipped file differs on every line and breaks 3-way merges.
- **New realm content** goes in its own module (`src/world/<part>.ts` exporting `build<Part>(b, grid, under)` that
  returns `{ enemies, objects, npcs, regions }`, plus a class in `src/game/story/` if it has story), hooked in with a
  few lines. How to build a realm: `docs/design/realm-building.md`.

## The user's rules (always)

- **No commits, no pushes.** Only the user commits. Never run a git command that changes anything (add, commit,
  stash, checkout or restore of files, reset, merge). Reading (`status`, `diff`, `log`, `ls-files`) is fine.
- **The board.** Every task and every problem found goes on the board (`board/README.md` says how): new work and
  found problems into the backlog, the current work in progress, finished work to done with the date and what was
  checked. When asked to review, or when you find a flaw, add it to the board rather than only mentioning it.
- **After every task, post the whole to-do list in chat**: every task of the current plan, done ones crossed out
  (~~like this~~), the current one marked, all the next ones, and the sub-steps of the current group. Never a short
  or partial list. `node tools/board.mjs todo` prints it in that form; `node tools/board.mjs move <id> done` moves an
  item; `node tools/board.mjs new backlog <slug> "<title>"` files a new one.
- **Long runs in the background.** The suite and long checks run with `run_in_background`; keep working on
  read-only things and post short status lines; never block the chat on a wait loop. **No edits under `src/` while a
  suite or check runs against that server**: Vite reloads the page and spoils the check.
- **Make changes plainly visible.** When asked to change how a place looks, change it boldly enough to see from the
  game's camera (new shapes, new layout, things moved or removed, not tweaked numbers), and prove it with before and
  after screenshots from the player's camera (and the overhead map). If the after shot doesn't read as different at
  a glance, go further.
- **Keep agent runs lean.** A handful of agents, each with a focused task and distilled notes, not a dozen re-reading
  the code (a 16-agent run hit the usage limit twice). Say up front roughly how long a run takes; report progress
  unasked; if a run stalls, say so and offer the faster path. How to split work: `docs/workflow/parallel-work.md`,
  `docs/workflow/agents.md`.
- **The design rules**: `docs/design/design-rules.md`. In short: no invisible walls; zones read as zones; woods by
  zone, never sprinkled evenly or on a grid; villages roomy; caves set in cliff faces; visible paths to every place
  with a purpose, none to secrets; nothing tall between the camera (+x+z side) and what should be seen; foes the
  knight sees show through occluders; fair fights (every attack shown 1.2 s or more before it lands, one at a time);
  living wood never a straight post; each realm balanced (its chests, quests and trial pay for what it sells with a
  modest surplus; `foeHp` so foes take as many blows as realm 1's did; bosses checked with a player-like bot).
- **About 40% common, 60% unique per realm**: the common part is the grammar (the quest's shape: village, leader,
  the way, the garrison, the tyrant; the village's services; resting places; rewards), the rest is the realm's own
  (land, foes, rules, look, music). `docs/design/common-and-unique.md`; the measured scores in
  `docs/design/realm-scores.md`.

## Traps we hit

- **Vite reloads open pages on any `src/` edit**, headless checks included: a check running while you edit fails
  for no reason. Edit in a copy, or wait for the run to finish.
- **Background commands stop after 2 hours**, a background dev server too, silently: before a long run check that it
  answers (`curl -s -o /dev/null -w "%{http_code}" http://localhost:<port>/`) and restart it if not.
- **`rm -rf` on a variable path** (`rm -rf "$dir"`) is blocked by a safety check: use a literal path, or
  `fs.rmSync` in a node script.
- **The machine is slow under load** (several agents, several servers, headless Edge each): timing checks (the boss
  bots, the fair-fight checks, lights, the serpent, the sea, the Tidelord) can miss. Rerun a failed timing check
  alone before calling it a failure. Some checks depend on chance (realm 1's `foes`): a run can miss an effect.
- **Line endings flipped by a tool** make a whole file differ and break merges (above).
- **The test browser is muted**: sound is only checked through the audio graph (`tests/seasound.js`). Real phones
  and real gamepads have never been tried (`docs/play/known-limits.md`).
- **`shot.mjs` without `PORT`** talks to the other app on 5173 (above).

## Where things are

- `docs/README.md`: the index of every doc, folder and tool, one line each.
- `docs/play/` how to play (controls, foes, known limits); `docs/realms/` each realm's places and people;
  `docs/design/` the user's rules, how to build a realm, the 40/60 comparison, difficulty, notes for later realms;
  `docs/code/` the layout, the architecture, the style; `docs/testing/` how the game is checked and every check;
  `docs/workflow/` work copies, briefs and merging, which agent, command or skill to use.
- `board/`: the board (backlog, todo, in progress, blocked, done, plans). `BOARD.md` at the root is its short index.
- `.claude/commands/` slash commands, `.claude/skills/` skills, `.claude/agents/` agent definitions
  (what each is for: `docs/workflow/agents.md`).
- `tools/`: `shot.mjs`, `test-all.mjs`, `mapview.js`, `emptymap.js`, `extract-samples.mjs`, `withserver.sh`,
  `board.mjs`, `copies/` (make a work copy, merge it back).
- The user's standing notes for Claude live outside the project (Claude's memory); everything they say is in these
  docs.
