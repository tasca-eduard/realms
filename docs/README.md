# Docs

Every doc, folder and tool in the project, one line each, grouped as they are laid out. New to the project? Read
[CLAUDE.md](../CLAUDE.md) (how to run, check and work here, and the user's rules), then [the board](../board/README.md)
(what is being done and what is next), then whatever below fits your task.

## At the root

- [README.md](../README.md): what the game is, how to run it, a map of the docs, credits.
- [CLAUDE.md](../CLAUDE.md): read first by Claude Code: running, checking, conventions, the user's rules, traps.
- [BOARD.md](../BOARD.md): the board's short index (the board itself is in `board/`).

## docs/play: playing the game

- [controls.md](play/controls.md): desktop, phone and gamepad controls; riding the warhorse, the Thornstag and the
  Tide Serpent; vines, diving and air, explore mode, combat details.
- [foes.md](play/foes.md): status effects and every foe: where it is and what to know.
- [known-limits.md](play/known-limits.md): what has never been tried (sound heard, real phones, a real gamepad,
  playtested balance).

## docs/realms: the realms

- [README.md](realms/README.md): the eight realms in one line each, with links; and
  [the map, the journal and saving](realms/README.md#the-map-the-journal-and-saving) (the pause menu's world map,
  the journal, the mist over unexplored land, what is saved and where).
- [1-moonlit-keep.md](realms/1-moonlit-keep.md): realm 1's places, people, secrets and power-ups, its paths and its
  edges (no invisible walls).
- [2-whisperwood.md](realms/2-whisperwood.md): realm 2's places, people, secrets and music.
- [3-sunken-reef.md](realms/3-sunken-reef.md): realm 3's places, people, the sea, errands, the palace, its sound.

## docs/design: how the game should be

- [design-rules.md](design/design-rules.md): the user's design rules (edges, zones, woods, villages, paths, caves,
  controls, fair bosses, balance). Check new content against them.
- [realm-building.md](design/realm-building.md): how to build a realm, step by step.
- [common-and-unique.md](design/common-and-unique.md): the 40% common / 60% unique aim, how it is scored, what
  realms 1 and 2 share and what each brings.
- [realm-scores.md](design/realm-scores.md): each built realm measured against the ones before it.
- [difficulty.md](design/difficulty.md): the knight's strength, the foes' toughness, bosses and coins per realm,
  and the formulas.
- [later-realms.md](design/later-realms.md): lessons for the realms still to come: what worked, what to watch.

## docs/code: the code

- [layout.md](code/layout.md): the folders and files of `src/`, `tools/`, `tests/`, one line each.
- [architecture.md](code/architecture.md): how the parts fit: a realm's load, the frame, each module's key types.
- [style.md](code/style.md): how code, comments, the board, the docs and the game's words are written.

## docs/testing: checking the game

- [testing.md](testing/testing.md): how the game is checked: the suite, single checks, screenshots, bots, reruns.
- [checks.md](testing/checks.md): every check in the suite, by realm and area.
- [shortcuts.md](testing/shortcuts.md): URL flags, debug keys, console checks, screenshot commands.

## docs/workflow: working with agents

- [parallel-work.md](workflow/parallel-work.md): work copies, briefs, ports, and merging copies back.
- [agents.md](workflow/agents.md): which agent, slash command and skill to use for what.

## board/: the task board

- [README.md](../board/README.md): how the board works: one file per item, its fields, moving items between folders,
  the to-do list after every task.
- [backlog/](../board/backlog/): new work and problems found, not started.
- [todo/](../board/todo/): next up, in order.
- [in-progress/](../board/in-progress/): being worked on now.
- [blocked/](../board/blocked/): waiting on something (often the user).
- [done/](../board/done/): finished, with the date and what was checked.
- [plans/](../board/plans/): the agreed plans for realms 2 and 3, the follow-up plan, and realm 4's draft.

## .claude/: Claude Code's own

- `.claude/commands/`: slash commands for this project.
- `.claude/skills/<name>/SKILL.md`: skills (how to do a recurring job here).
- `.claude/agents/`: agent definitions for sub-agents.

What each is for, and when to use it: [agents.md](workflow/agents.md).

## tools/: scripts

- `tools/shot.mjs`: one headless screenshot of the running game, optionally running a script in the page and
  printing its report (`PORT=<port> node tools/shot.mjs "<query>" <out.png> <waitMs> <WxH> [script.js]`).
- `tools/test-all.mjs`: the suite, `npm test` (every check in `tests/`, or `npm test -- <names>`).
- `tools/mapview.js`: a script for `shot.mjs` that draws the realm from above with everything placed on it.
- `tools/emptymap.js`: a script for `shot.mjs` that shows where nothing happens (reachable ground far from anything
  with a purpose).
- `tools/withserver.sh`: runs one command against a temporary game server (`bash tools/withserver.sh <dir> <port>
  <command...>`).
- `tools/board.mjs`: prints the board (`node tools/board.mjs`) and the to-do list to post in chat (`todo`); moves,
  files and checks items (`move`, `new`, `check`).
- `tools/copies/make-copy.sh`: makes work copies (and their merge base) for agents working in parallel.
- `tools/copies/merge-copy.cjs`: merges a work copy back into the project, 3-way against its base.
- `tools/extract-samples.mjs`: pulled the instrument samples out of the prototype's music (done once).

## Other folders

- `src/`: the game ([layout](code/layout.md), [architecture](code/architecture.md)).
- `tests/`: the scripts the suite runs in the page ([testing](testing/testing.md)).
- `public/audio/samples/`: the instrument samples the music plays.
- `shots/`: screenshots from checks and tools (not kept). `dist/`: the built game (`npm run build`).
