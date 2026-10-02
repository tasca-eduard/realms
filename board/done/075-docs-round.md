---
id: 075
title: Docs round: docs for people and agents, the board as folders
realm: all
area: docs
status: done
created: 2026-10-02
done: 2026-10-02
owner: docs agents 1-6 (agent 5: the board)
depends: []
links: [../../docs/README.md, ../README.md]
---

# 075 Docs round: docs for people and agents, the board as folders

The user (2026-10-02): "create docs, all kinds. for skills, commands, etc you know best. Better board: each folder for backlog, todo, in progress, blocked, done. And any docs that can help these agents work. Maybe even agents files." Then: "make separate folders for the docs, we need to organize stuff", and "split existing docs so its much easier for everybody to read each section".

## Steps

- [x] CLAUDE.md, the docs index (docs/README.md), the code map (docs/code/architecture.md, layout.md brought up to date) and style (agent 1).
- [x] The design rules (docs/design/design-rules.md: 52 rules with ids and how to check each) and how to build a realm
  (docs/design/realm-building.md) (agent 2).
- [x] Testing docs (docs/testing/testing.md, checks.md: all 90 checks by realm and area, shortcuts.md brought up to
  date), six slash commands (/suite, /shot, /map, /reach, /typecheck, /status), two skills (realms-testing,
  realms-screenshots), tools/withserver.sh (tried in a copy: exit codes passed through, a busy port refused) (agent 3).
- [x] Parallel work (docs/workflow/parallel-work.md), which agent for what (docs/workflow/agents.md), seven agent
  definitions in .claude/agents/, tools/copies/make-copy.sh and merge-copy.cjs (agent 4).
- [x] The board as folders: board/ (README, five folders, plans), BOARD.md as a short index, tools/board.mjs (agent 5).
- [x] README.md and REALMS.md split into docs/play, docs/realms, docs/design, docs/code/layout.md and
  docs/testing/shortcuts.md; REALMS.md removed (agent 6, finished by the lead, 2026-10-02).
- [x] Stale lines fixed (the lead, 2026-10-02): the realm3.ts header, "travellers" in a realm 1 lore stone,
  "Armoured boar", the port in README and in test-all's header; the `wip` comment in realms.ts; the design docs and
  the realm 4 plan linked to the board's plans; the realm 4 plan's realm 3 column brought to its figures after group 36.
- [x] The lead: the stale lines the agents found fixed (CLAUDE.md's suite time, about 40-45 minutes, and debug
  keys; realm-building.md's keys and agent counts; one anchor in checks.md); every relative link and anchor in
  docs/, board/, .claude/, CLAUDE.md, README.md and BOARD.md checked: 373 links in 123 files, 0 broken; the board
  notes in memory moved to the folders; a found test flaw filed (078: costumedrop never reloads).

## Checks

`node tools/board.mjs check` (every task file well formed, every link resolves); every group number and every dated
entry of the old BOARD.md found under board/ (checked when the board moved: see board/README.md, "Where the old
BOARD.md went").

## Done 2026-10-02

Seven agents, each owning its own files, writing straight into the project (nothing under src/ or tests/ but
comment and spelling fixes by the lead). What there is now:
- **CLAUDE.md** at the root: how to run and check the game, the code on one screen, conventions, the user's rules,
  the traps we hit, where the docs live. **README.md** cut to 45 lines (the game, Run it, a map of the docs, Credits).
- **docs/** in folders, indexed by docs/README.md: `play/` (controls, foes, known limits), `realms/` (one file per
  realm and an index), `design/` (the 52 design rules with ids and checks, how to build a realm, the 40/60 aim,
  the realm scores, difficulty, later realms), `code/` (architecture, layout, style), `testing/` (how the game is
  checked, all 90 checks, shortcuts), `workflow/` (parallel work with copies, which agent for what). REALMS.md is
  gone: every line of it and of the old README is in the new files (checked by a script).
- **board/** as folders (this board): 76 tasks then, plans in board/plans/, BOARD.md a short index;
  `node tools/board.mjs` prints it, moves tasks, checks it.
- **.claude/**: seven agent definitions (realm-builder, content-builder, reviewer, playtester, balancer,
  suite-runner, docs-writer), six commands (/suite, /shot, /map, /reach, /typecheck, /status), two skills
  (realms-testing, realms-screenshots).
- **tools/**: withserver.sh (a temporary server round a command), copies/make-copy.sh and copies/merge-copy.cjs
  (work copies and the 3-way merge back), board.mjs.
Checked: `node tools/board.mjs check` 0 errors; 373 relative links in 123 files, 0 broken; tsc clean after the
comment fixes. The commands, skills and agent definitions are written, not yet tried in a real round.
