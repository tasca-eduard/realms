# Parallel work: many agents, one project

How several agents work on Eight Realms at once, each in its own copy of the project, and how their work is merged
back. This is the method used to build and finish realm 3 on 2026-10-01 and 2026-10-02 (board: groups 28 to 36 and
the realm 3 content round). The tools are `tools/copies/make-copy.sh` and `tools/copies/merge-copy.cjs`; the agent
definitions are in `.claude/agents/` (see [agents.md](agents.md) for which to use when).

In short: the lead takes an untouched snapshot of the project (the **base**), makes one **work copy** per agent from
it, gives every agent the same **brief** plus its own task, copy and port, lets them work, then merges each copy back
with a **3-way merge** against the base, file by file, and checks the whole.

## The rounds so far

| Round | When | Copies (base) | Ports | Agents | What happened |
|---|---|---|---|---|---|
| Groups 30-35 | 2026-10-01 | `g30`, `g32`, `g33` (base); `g31p`, `g34`, `g35` (base2); `snap` | 5180-5186 | 6 | The Sea Stair, the land's dressing, the sea foes, the serpent, the people, the Tidelord. `snap` was a snapshot for long bot runs, never merged. |
| Content round | 2026-10-01 evening | `c1`-`c8` (base3) | one each | 8 | Sea life, shore life, the village's night, errands, the lighthouse, the drowned kingdom, sea caves, Old Inkarm. "Just build", light checks only. |
| Group 36, review and balance | 2026-10-02 morning | `r1`-`r7` (base4), `r8`-`r12` (base5) | 5201-5212 | 7, then 10 | The first run (`r1`-`r7`) was cut off when the session ended; the resumed run restarted five of them and added five follow-ups, and two stopped at the usage limit. About 81 minutes and 3.1M tokens for the resumed run. |
| Finish | 2026-10-02 afternoon | `s1`-`s7` (base6) | 5221-5227 | 7 | Performance, the light, world fixes, gameplay fixes, the phone HUD, Whisperwood's Ash tree, the realm 4 plan. About 99 minutes, 2.1M tokens. |
| Docs, final suite | 2026-10-02 evening | `d1`, `d2` (base7); `f1` (base8) | 5241 for `f1` | 1-2 | The README and REALMS.md refresh; one agent running all 90 checks on the merged whole. |

All copies lived in the session's scratchpad: `C:\Users\Ed\AppData\Local\Temp\claude\f--dev-realms\<session>\scratchpad\wt\`.

**How many at once.** Six to eight owners per round went well: the lead could merge each copy as its report came in
(5 to 15 minutes a copy, most of it reading the report and settling conflicts). Ten at once ran into the usage
limit, and a 16-agent read-only inventory on 2026-10-01 hit it twice and left the user waiting for hours. The user's
standing note: keep fan-outs small, say up front roughly how long a run will take, and report progress without being
asked. Groups of a new realm that build on each other run two or three at a time (the realm 4 plan: the land
and the foes side by side once the groundwork is in); rounds of independent areas (content, review and balance) six
to eight.

## Why copies, not branches or worktrees

- **Nothing is committed but by the user.** The user commits and pushes; nobody else (the user, 2026-10-01: "you dont
  commit and push - only i do"). The project normally holds a day or more of uncommitted work (`git status` shows
  dozens of modified files).
- **A worktree or branch starts from the last commit**, so it would leave out all that uncommitted work. An agent
  building on it would build on an old game.
- **A plain copy of the folder starts from what is on disk now**, uncommitted work included, and needs no git
  command that changes anything. Merging back needs only `git merge-file`, which works on three loose files and never
  touches a repository.

## Making copies

```
W=/c/Users/Ed/AppData/Local/Temp/claude/f--dev-realms/<session>/scratchpad/wt
bash tools/copies/make-copy.sh --base "$W/base9" "$W/t1" "$W/t2" "$W/t3"
```

What it does, the same way the copies were made by hand on 2026-10-01/02:

1. **The base.** A tar of the project without `node_modules`, `.git`, `shots`, `shots-*`, `dist` and `.vite-cache`,
   unpacked into the base folder. The base is never served, edited or linked: it is the merge's common ancestor, the
   project exactly as every copy of this round first saw it. Keep it until every copy from it is merged.
2. **Each work copy** is the same tar of the base, then:
   - `node_modules` as a **junction** to the project's (`New-Item -ItemType Junction` through PowerShell, since this
     is Windows): nothing is installed twice, and a copy is ready in a second.
   - `cacheDir: '.vite-cache',` added to **the copy's own** `vite.config.ts`, so its dev server keeps its pre-bundle
     cache inside the copy and never writes into the project's `node_modules/.vite`. The project's
     `vite.config.ts` is never changed, and the merge tool never brings a copy's back.
3. `--from <base>` makes more work copies from an existing base later in the same round (a late extra agent, or a
   fresh copy for an agent whose first try failed). Without `--base` or `--from` the copies come straight from the
   project and no base is kept: only for copies that won't be merged, such as a snapshot for long bot runs.

The script never deletes anything: a target folder that exists and isn't empty is refused. To remove an old copy,
remove its junction on its own first (`cmd //c rmdir <copy>\node_modules`, which leaves the project's
`node_modules` alone), then the folder. Never delete a copy's folder with its junction still in it: some Windows
tools follow a junction and empty the project's `node_modules`.

**A port per copy.** Every copy runs its own dev server on its own port, so agents never share a server (a check
that reloads the page would spoil another agent's run). Give each round a block of ten above 5180 (5181-5186,
5201-5212, 5221-5227, 5241 so far) and keep off 5173-5175: on this machine 5173 and 5174 are taken by another app and
the lead's own server runs on 5175. Each agent starts its server itself, in the background, in its copy's folder:

```
node node_modules/vite/bin/vite.js --port 5201 --strictPort
```

`--strictPort` makes a taken port an error instead of a silent move to the next one (which would point the agent's
screenshots at somebody else's copy). `tools/withserver.sh <dir> <port> <command...>` starts a server, runs one
command with `PORT` set, and stops it again. Then every tool takes the port:
`PORT=5201 node tools/shot.mjs "shot&play&realm=aqua" shots-r1/a.png 1500` and `PORT=5201 node tools/test-all.mjs`.

## The brief

Every agent of a round reads the same brief first (`BRIEF.md` for the content round, `BRIEF36.md` for group 36 and
again for the finish round; they were kept in `scratchpad\wt\`). The task line given to each agent is short and
names only what differs: its id, its copy, its port, its base, and its area. A brief holds:

1. **The game in a few lines** and the user's words for this round, quoted.
2. **Your copy:** start its server (command above, the 2-hour limit below), the screenshot and suite commands with
   `PORT`, the URL flags it needs (`shot&play&realm=aqua&at=x,z&god`, `lvl=5`, `fair`), how to drive the game from a
   page script (`window.__game`), where screenshots and scratch files go: `shots-<id>/` inside the copy, nowhere
   else.
3. **How the work comes back** (the rules):
   - Work only in your copy. Never write anything into the project, not even a screenshot. Never run a git command
     that changes anything (`git diff --no-index` to compare folders is fine: it changes nothing).
   - Own your files: new content goes in new modules; shared files get only small, clearly placed additions; never
     reformat, reorder or re-indent code you don't own; don't move or remove what exists unless that is the fix.
   - Don't edit `BOARD.md`, the board, README, the docs, `tools/test-all.mjs` (unless your task registers a check)
     or `vite.config.ts`: the lead writes those (the merge tool skips most of them anyway).
   - Type-check before you finish: `npx tsc --noEmit -p .`.
4. **What exists** that the agent needs: the realm's constants and coordinates, the places other agents own ("keep
   out of the palace and the plaza's middle").
5. **The user's rules** that matter for the round (see [design-rules.md](../design/design-rules.md)).
6. **The report**, kept short and in this order: files added and changed; what was built or found and where
   (coordinates, numbers before -> after); checks run and their results; screenshots worth a look; a few lines for
   the board's Done entry in its style; anything the lead must know to merge (every shared-file edit, with
   `file:line`).

A brief reused for a later round says so ("written for the previous round, its rules all still hold") and the task
line adds what changed (the new base, what the last round found).

## Splitting the work so edits rarely collide

Split by **ownership**, not by step: one agent owns an area of the game and every file that area needs.

- **New modules plus one hook line.** A content agent puts its place in a new world module that draws its props and
  returns its data (`src/world/kingdom.ts` exporting `buildKingdom(b, grid, under)`, returning `{ enemies, objects,
  npcs, regions, ... }`) and, if it has story, a new class in `src/game/story/` (`ReefErrands` in
  `src/game/story/errands.ts`). The only shared edits are a block of four lines in the realm's map
  (`src/world/realm3.ts`):

  ```ts
  // The drowned kingdom's set pieces: ... (src/world/kingdom.ts).
  const kingdom = buildKingdom(b, grid, under);
  enemies.push(...kingdom.enemies);
  objects.push(...kingdom.objects);
  regions.unshift(...kingdom.regions);
  ```

  plus its people appended to `npcs: [...reef.npcs, ...life.npcs, ...]`.
- **Story classes held by the realm's story.** The realm's story (`src/game/story/aqua.ts`, `AquaStory`) holds each
  agent's class as a field and calls it once in each hook it needs: `this.lamp.apply(g)`, `this.lamp.tick(g, dt)`,
  `this.errands.onRegion(g, r)`, `lines = this.grotto.talk(g, n, lines)`, a `victoryLine` chain joined with `??`.
  Every agent adds a field and a few one-line calls; nothing else in the file moves.
- **Its own dice.** A builder that draws random numbers borrows the builder's stream and gives it back
  (`const keep = b.rng, r = (b.rng = mulberry32(4747)); ... b.rng = keep;`), so whether its block runs before or
  after another agent's moves nothing else on the map.
- **Areas that must touch the same file** get told who else is there: "another agent recolours the harmless crabs in
  sealife.ts and shorelife.ts: stay off those lines". Two agents making the *same* edit is harmless: identical
  changes merge cleanly (group 36's suite agent gave ten spawns exactly the values the people agent chose).
- **Tests:** a new check is a new file in `tests/` plus one line in `tools/test-all.mjs`'s list.

## Launching: workflow scripts

The rounds were run with Claude Code's Workflow tool: one script per round, all agents in parallel, each given the
brief's path and its task line. The scripts are kept in the session's folder
(`C:\Users\Ed\.claude\projects\f--dev-realms\<session>\workflows\scripts\`, e.g. `realm3-finish-*.js`). The shape
(a fan-out of N owners):

```js
export const meta = {
  name: 'realm3-finish',
  description: 'Seven agents in parallel copies: ...',
  phases: [{ title: 'Finish', detail: 'seven owners, each in its own copy (starting copy base6)' }],
}
const W = 'C:\\Users\\Ed\\AppData\\Local\\Temp\\claude\\f--dev-realms\\<session>\\scratchpad\\wt'
const head = (id, port) => `Read ${W}\\BRIEF36.md first (the rules for this work). Your id: ${id}. ` +
  `Your copy: ${W}\\${id} . Your port: ${port}. The untouched starting copy is ${W}\\base6.\n\n`
const TASKS = [
  { id: 's1', port: 5221, label: 'performance', task: `Your area: PERFORMANCE of realm 3 ... Report numbers before and after per zone.` },
  { id: 's3', port: 5223, label: 'world-fixes', task: `Your area: WORLD FIXES ... Check reach, spawns and the rides check after.` },
  // ...
]
phase('Finish')
const results = await parallel(TASKS.map((t) => () =>
  agent(head(t.id, t.port) + t.task, { label: t.label, phase: 'Finish', agentType: 'general-purpose' })))
return TASKS.map((t, i) => ({ id: t.id, area: t.label, report: results[i] }))
```

With the definitions in `.claude/agents/`, `agentType` can name one of them (`'realm-builder'`, `'suite-runner'`...)
and the task can shrink to the area; they are loaded when a session starts.

A task line names the area, the files to start from, the numbers to reach, what to stay off, and what to report:
"Your area: THE ECONOMY of realm 3. Count every coin ... Bring realm 3 to a modest surplus (chests + quests + trial
about 10-25% over what it sells) ... Report the totals before and after."

**Resume rules** (group 36's run was cut off when the session ended):

- Agents that had finished are cached and not run again on resume; their copies are merged as usual.
- Agents that start again get a note: "an earlier run of this same task was cut off midway. Your copy may already
  hold some of its changes. Compare your copy's files with the untouched starting copy (`git diff --no-index`,
  which changes nothing) to see what was done, keep what is sound, and finish the task. Restart your game server
  first (the old one is gone)." They keep their copy and their base.
- A new session may not accept the old run's script path: copy the script into the scratchpad and launch it again
  with only the unfinished agents.
- An agent stopped by the usage limit is not resumed mid-thought: its task goes into the next round with a fresh copy
  from the new base, and the task line says so ("a first attempt was cut off by a usage limit; this copy is fresh").

## Merging back

One copy at a time, in the order the reports come in, each against **its own** base, and never while a suite or a
check runs against the project's server (a merge edits `src/`, Vite reloads the page and spoils the check: wait for
it, or run long checks in a copy):

```
node tools/copies/merge-copy.cjs "$W/s3" "$W/base6" --dry     # what it would do
node tools/copies/merge-copy.cjs "$W/s3" "$W/base6"           # into the project (the default third argument)
```

For each file the agent changed against the base:

- the project still has the base's version: the agent's is **taken** whole;
- both changed it: a **3-way merge** with `git merge-file` (project, base, copy): changes that don't overlap are
  **merged**; overlapping ones are written as a conflict, `<<<<<<< project` / `=======` / `>>>>>>> s3`, and listed;
- new in the copy: **added**, unless the project has a different file at that path (a conflict, left alone);
- deleted in the copy: only **listed**, never removed from the project.

Text files are compared and merged with LF line endings and written back in the project's own (the project mixes
CRLF and LF files). Never merged: `node_modules`, `.vite-cache`, `dist`, `shots`, `shots-*`, `.png` files, and at
the top `BOARD.md`, `README.md`, `REALMS.md`, `CLAUDE.md`, `vite.config.ts`, `package-lock.json`, `board/`, `docs/`
and `.claude/`. If an agent's report says it changed one of those, take that change by hand. The tool exits with 1
when there are conflicts, 0 when there are none.

Then find the markers and settle them:

```
grep -rn '^<<<<<<<\|^>>>>>>>' src tests tools
```

**Most conflicts are "keep both".** Two agents adding their block after the same line in `realm3.ts`, their field
and calls in `aqua.ts`, their check at the end of `tools/test-all.mjs`'s list, or an import in the same spot: keep
both sides, project's first, and delete the markers. On 2026-10-01/02 nearly every conflict was in those three files
(`aqua.ts` with 3 to 6 hunks a copy, `realm3.ts` 1 to 5, then `enemies.ts`, `realm.ts`, `quests.ts`, `assets.ts`).

**Things to watch while settling:**

- **Duplicate ids and names.** Two agents picking the same NPC id (`wrasse`, `winkle`), look name (`reeffisher`,
  `reeflad`) or villager name merge without a conflict and break at run time or read wrong: rename one side
  (`reeffisher4`, `reeflad2`, "Pike the Diver Lad", "Merrow"). Also chest and lore ids, save flags, region names.
  Search the merged realm for each new id.
- **Imports:** both sides adding the same import, or one side removing one the other still uses. The type-check
  finds these.
- **Builders that must run last.** Some passes look at everything placed before them: realm 3's floor dressing
  (`dressSeaBed`) avoids every prop, Stairfoot Cove is cut "after everything else is placed, so that nothing
  shifts", and the pass that boards over lone cells of water boxed in by planks runs at the very end. A new block
  goes before them, never after.
- **Saved kills are indexes** into the realm's enemy list (`save.data.killed`). Append new foe blocks after the
  existing ones; a block put in front shifts every saved kill after it (in a test save, the wrong foes stay dead).
- **CRLF flips.** An agent's tool can rewrite a CRLF file as LF (`tools/test-all.mjs` once), which without
  normalising reads as every line changed: one conflict the size of the file. The merge tool normalises; still look
  at the counts it prints, and if a copy's file was flipped, say so to the agent.
- **Logic one side changed that the other relied on**: a constant moved, a function renamed, a hook order. Read the
  agent's list of shared-file edits against what was merged before it.

## After merging

After each copy, or after a few small ones:

1. **Type-check:** `npx tsc --noEmit -p .` (don't pipe it through `head`: that hides its exit code; use
   `${PIPESTATUS[0]}` if you must).
2. **One load** of each realm the copy touched, looking for page errors:
   `PORT=5175 node tools/shot.mjs "shot&play&realm=aqua" shots/merged.png 2500` (prints `[pageerror]` lines).
3. **Reach and spawns** for that realm: `PORT=5175 node tools/test-all.mjs reach3 spawns3` (nothing unreachable, no
   way out of the world, no traps; nothing starts inside anything).
4. **The suite** once the round is merged, in the background, with nobody editing `src/` while it runs (Vite reloads
   the page mid-check and spoils results): `npm test`. The 98 checks wait about 33 minutes between them, so a full
   run takes 45 minutes or more. On 2026-10-02 this went to an agent in its own copy of the merged whole (`f1`), so
   the lead could go on merging docs meanwhile. How to read the suite's reports: [testing.md](../testing/testing.md).
5. The board: a Done entry for each merged area, from the agent's lines (see [board/README.md](../../board/README.md)).

## What went wrong, and how it was handled

- **Servers stop after 2 hours.** Background commands are stopped after two hours, the game servers with them.
  Agents were told to restart their own ("Background commands stop after 2 hours; restart it if it dies"); the lead
  didn't restart servers for copies already merged.
- **The session ended mid-run.** Group 36's first run was cut off; it was resumed with the rules above. Two of its
  agents had finished and were kept; the five others found their predecessors' half-done work in their copies and
  finished it.
- **Usage limits.** "You've hit your session limit" stopped the performance and light agents of group 36's resumed
  run. The lead merged the eight that finished before replying, and both tasks went into the next round in fresh
  copies. The earlier 16-agent inventory hit the limit twice; its checked fact sheet alone answered the question.
- **An agent wrote into the project.** One content agent saved a map screenshot into `F:\dev\realms\shots-c3\`. It
  was noticed because later copies, made from the project, carried a `shots-c3` folder; the lead moved it to the
  scratchpad (nothing deleted). Since then briefs say "never write anything into the project (not even
  screenshots)", and after a round the lead runs `git status --short` in the project (read-only) to spot strays. A
  copy that shows no changes after an hour is also worth a look: it may be editing the project by mistake.
- **Stale reports.** A report describes the copy at the moment it was written: an agent can go on editing after it
  (the lighthouse copy differed from what had been merged when checked later), line numbers refer to the copy, not
  to the project after other merges, and a resumed agent's copy holds work its report may not mention. After each
  final report, compare the copy with what was merged; running the merge again picks up only the new changes (the
  earlier ones are on both sides and merge cleanly), but hunks settled by hand come back as conflicts: keep the
  project's side there. Find things by their text, not by a report's line number.
- **Smaller ones.** Patch scripts written through shell quoting garbled their escapes (write `.cjs` scripts with an
  editor tool instead); `rm -rf` with variables was blocked by the safety check (so the tools never delete); a
  check written in one copy before other agents' content landed went out of date (more foes, decks and regions where
  it walked): the suite agent sorts those from real regressions.

## A short worked example

Two agents add a lighthouse quest and a grotto boss to realm 3 at the same time.

1. **Copies.** `bash tools/copies/make-copy.sh --base "$W/base9" "$W/t1" "$W/t2"`. Ports 5251 and 5252.
2. **Brief** `$W/BRIEF-t.md` (the sections above), and two task lines: "Read `$W\BRIEF-t.md` first. Your id: t1. Your
   copy: `$W\t1`. Your port: 5251. Your area: the lighthouse ..." and the same for t2, the grotto, adding "another
   agent adds the lighthouse block in realm3.ts: put yours after it".
3. **Launch** both with a two-task workflow script, or two `Agent` calls with `subagent_type: 'content-builder'`, in
   the background. Tell the user: two agents, about 1.5 hours.
4. **t1 reports first.** `node tools/copies/merge-copy.cjs "$W/t1" "$W/base9" --dry` shows `src/world/realm3.ts`,
   `src/game/story/aqua.ts` taken (nobody else changed them yet), `src/world/lighthouse.ts`,
   `src/game/story/lighthouse.ts` added. Run it without `--dry`, type-check, load the reef once.
5. **t2 reports.** Its dry run shows `realm3.ts` and `aqua.ts` merged with conflicts: both added a block after the
   kingdom's. In `realm3.ts`:

   ```
     regions.unshift(...kingdom.regions);
   <<<<<<< project
     // The lighthouse, its stair and its keeper's quest (src/world/lighthouse.ts).
     const light = buildLighthouse(b, grid, under);
     ...
   =======
     // Old Inkarm's grotto in the trench's wall west of the kingdom (src/world/inkgrotto.ts).
     const grotto = buildInkGrotto(b, grid, under);
     ...
   >>>>>>> t2
     dressSeaBed(b, grid);
   ```

   Keep both (the lighthouse first), markers out, `dressSeaBed` still after both. Same in `aqua.ts` (two fields, two
   calls in `apply` and `tick`). Search for t2's new ids in the merged code: none taken twice.
6. **Check.** Type-check; one load of the reef; `reach3` and `spawns3`; screenshots of both places. The suite in the
   background when the round is in. Done entries on the board; the user's to-do list in chat.
7. **Clean up** when the user has the work: junctions first (`cmd //c rmdir`), then the copies and the base.
