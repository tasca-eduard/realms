# Agents, commands and skills: which to use for what

What the lead (or the user) can hand work to in this project, and when. The agent definitions are in
`.claude/agents/`, the slash commands in `.claude/commands/`, the skills in `.claude/skills/<name>/SKILL.md`. How
agents work side by side in copies and how their work is merged: [parallel-work.md](parallel-work.md).

## Agent definitions

Each one is a Claude Code subagent: its file tells it what to read first, where to work, the rules, the checks to run
and the report to give, so it can be launched with only a task line.

| Agent | Use it for | Works in | It checks with |
|---|---|---|---|
| `realm-builder` | A piece of a realm: a numbered group of a realm plan (the land and zones, foes and hazards, people and quests, a mount, the tyrant's hall), anything touching a realm's map and story together | Its own copy | Type-check, one load, the overhead map, screenshots from the camera, reach and spawns, the checks of what it touched, new checks for new systems |
| `content-builder` | One slice of content in a built realm: life (animals, fish, villagers about their day), a set piece, an errand or quest, a mini-boss, a secret | Its own copy | Light: type-check, one load, screenshots, reach and spawns if it placed things |
| `reviewer` | Finding and fixing real defects: after a merge of several copies, before a group is called done, "review, find flaws, fix". Tries to refute each finding before fixing; "read-only" for a review without fixes | Its own copy (or read-only) | A page script that shows each defect and then its fix; the area's checks |
| `playtester` | Playing a realm from a fresh save to its victory with page scripts, reloads and travel; fixing flow-breakers | Its own copy | The playthrough itself, step by step; reach and spawns if it moved anything |
| `balancer` | A realm's economy (coins paid against coins sold), its foes' toughness (`foeHp`), boss and mini-boss fights (player-like bots, fair-fight checks) | Its own copy | The economy checks and the bots, two or three runs each, before and after |
| `suite-runner` | The whole suite (98 checks, 45 minutes or more): sorting out-of-date tests from regressions and noise, fixing, running it all again | A copy of the merged project | The suite, twice |
| `docs-writer` | README, the pages in `docs/`, the board's entries, measuring a realm against the 40/60 aim | The project itself when told (docs only), else a copy | Every number against the code |

Every agent that edits code works in a copy, never in the project. If the task line gives no copy, the agent makes
one with `tools/copies/make-copy.sh` in its scratchpad and names it, its base and its port in its report, so the
lead can merge it with `tools/copies/merge-copy.cjs`.

**Launching.** With the Agent tool: `subagent_type: 'suite-runner'` and a prompt such as "The merged project after
group 36. Copy: `...\wt\f1`, port 5241, base `...\wt\base8`." In a workflow script, `agentType: 'suite-runner'` (the
definitions are loaded when a session starts). Run them in the background and keep working.

**A good task line** names the area, the files to start from, the targets (numbers), what to stay off and who else
is working nearby, and anything that changed since the brief. For example:

- `content-builder`: "Realm 3: the lighthouse, its stair and its keeper's quest on the lighthouse isle (97, 29.5).
  Another agent adds Old Inkarm's grotto in the trench wall: stay off `src/world/kingdom.ts`."
- `balancer`: "Realm 3's economy: chests, quests and the trial to pay 10-25% over what the reef sells. Report the
  totals before and after."
- `reviewer`: "Read-only: the merged realm 3 story hooks in `src/game/story/aqua.ts` and every class it holds."

## Which to use when

| Situation | Use |
|---|---|
| Starting a realm's group from its plan | `realm-builder`, one per group; the land first, then the groups that build on it side by side |
| "Bring this realm to life", content rounds | Several `content-builder`s, one slice each, sharing one brief |
| A round of copies just merged | `reviewer` on the merged code, then `suite-runner` on a copy of the whole |
| A realm's review-and-balance group | `balancer` (one per area if it's big: economy, bosses), `reviewer`, `playtester`, `suite-runner`, `docs-writer` |
| Checks failing and nobody knows why | `suite-runner` |
| "Does it play through?", "is anything lost on reload?" | `playtester` |
| A group merged and recorded | `docs-writer` for the realm's page, the docs index and the board's entry |
| A question about the code ("where is X", "what does Y do") | No subagent needed: read it, or Claude Code's built-in Explore agent for wide searches |

**How many at once.** Two or three for groups of a new realm that build on each other; six to eight for a round of
independent areas (content, review and balance); ten at once hit the usage limit on 2026-10-02. Say up front how
long a round will take (one to two hours for building and balancing agents), and post progress unasked.

## Slash commands

Typed in Claude Code as `/<name>`; each is a markdown file in `.claude/commands/`.

| Command | What it does |
|---|---|
| `/typecheck` | `npx tsc --noEmit -p .`, the errors grouped by file |
| `/shot <realm> [x,z] [zoom=0.7] [under] [phone]` | One screenshot from the game camera on a temporary server, then looks at it |
| `/map <realm> [x0,z0,x1,z1] [empty]` | The overhead map (`tools/mapview.js`), a part of it, or where nothing happens (`tools/emptymap.js`), and reads it |
| `/reach [realm]` | A realm's world checks: reach, spawns, normals, its mounts' reach (none: all three realms) |
| `/suite [names...]` | The whole suite or the named checks, on a temporary server in the background, then what failed |
| `/status` | The board's to-do list in the user's format (`node tools/board.mjs todo`), and any checks or servers running |

## Skills

Loaded by Claude Code when a task matches them; each is `.claude/skills/<name>/SKILL.md`.

| Skill | What it covers |
|---|---|
| `realms-testing` | Checking a change: which of the 98 checks to run for which kind of change, running them on a temporary server (in the background when long), reading their reports, which ones are flaky |
| `realms-screenshots` | Screenshots from the game camera, the overhead map, before-and-after shots, looking at them |

## Tools

| Tool | Use |
|---|---|
| `tools/copies/make-copy.sh` | Work copies and their base: `--base <dir> <copy>...`, or `--from <base> <copy>...` |
| `tools/copies/merge-copy.cjs` | A copy merged back 3-way: `node tools/copies/merge-copy.cjs <copy> <base> [project] [--dry] [--json]` |
| `tools/withserver.sh` | A command run against a temporary game server: `bash tools/withserver.sh <dir> <port> <command...>` |
| `tools/board.mjs` | The board and the to-do list (`node tools/board.mjs todo`), moving and adding tasks |
| `tools/shot.mjs` | One headless run: a screenshot, a page script, its report |
| `tools/test-all.mjs` | The suite, or the named checks |
| `tools/mapview.js`, `tools/emptymap.js` | Page scripts for `shot.mjs`: the overhead map, and where nothing happens |

More on checks: [testing.md](../testing/testing.md), [checks.md](../testing/checks.md). The board's workflow:
[board/README.md](../../board/README.md).

## A round, start to end

1. Pick the owners (one per area; how many: above), the base and the ports; tell the user how many and how long.
2. `bash tools/copies/make-copy.sh --base <wt>/baseN <wt>/<id>...`; write the brief.
3. Launch the agents with their task lines, in the background.
4. As each reports: `merge-copy.cjs --dry`, then for real; settle conflicts; `/typecheck`; one load (`/shot`);
   `/reach` for the realm.
5. When all are in: `reviewer` if the round was large, then `suite-runner` on a copy of the merged whole.
6. `docs-writer` (or the lead) for the board's Done entries and the docs; `/status` for the whole to-do list in chat.
