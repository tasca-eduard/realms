# The board

Every task and known issue for Eight Realms, one markdown file per task, in the folder for its state. New work and
newly found problems go into `backlog/`; whatever is being worked on sits in `in-progress/`; finished tasks move to
`done/` with the date and what was built and checked. It replaced the single long `BOARD.md` on 2026-10-02
(`BOARD.md` is now a short index pointing here). The other docs: [docs/README.md](../docs/README.md).

Quick start:

    node tools/board.mjs                 the board: counts per folder and the titles
    node tools/board.mjs todo            the to-do list to post in chat after each task
    node tools/board.mjs move 064 done   move a task (file, status, date, links, BOARD.md's "Now")
    node tools/board.mjs check           every task well formed, every link resolves

## The folders

| Folder | What sits there | Must have |
|---|---|---|
| [backlog/](backlog/) | Known work not yet planned in: found problems, ideas, the groups of a plan the user hasn't agreed yet | `priority` (or a `plan`) |
| [todo/](todo/) | Agreed and ready to start; nothing it waits for is open | `depends` all done |
| [in-progress/](in-progress/) | Being worked on now | `owner` (which agent, or the lead) and a `## Steps` list |
| [blocked/](blocked/) | Waiting on something outside the work: the user's decision, another task, the usage limit | `blocked_on` (on what, in words) |
| [done/](done/) | Finished | `done` (the date) and `## Done <date>`: what was built and what was checked |
| [plans/](plans/) | One file per realm plan; each group links to its task file | |

Only the user agrees a plan, and commits happen when the user asks for them; tasks waiting on either sit in `blocked/` with
`blocked_on: the user (...)`.

## A task file

Named `NNN-short-slug.md`: a three-digit id, then a few lower-case words joined by hyphens
(`064-suite-on-the-merged-whole.md`). The id never changes and is never reused; the folder changes as the task moves.

```
---
id: 064
title: The full suite on the merged whole
realm: all
area: tests
status: in-progress
created: 2026-10-02
done:
owner: agent (the suite run, in its own copy)
depends: []
links: [../done/036-reef-review-and-balance.md, ../../docs/testing/testing.md]
---

# 064 The full suite on the merged whole

One or two sentences: what it is.

## Why
## Checks
## Steps            (while in progress: - [ ] / - [x], the sub-steps posted with the to-do list)
## Done 2026-10-02: what was built and checked
```

The frontmatter is plain `key: value` lines (lists in `[a, b]`), so `tools/board.mjs` reads it without a YAML
library. Keep each value on one line.

| Field | Values |
|---|---|
| `id` | The three-digit id, as in the file name. |
| `title` | Short, plain: what a reader would call it. |
| `realm` | `1` the Moonlit Keep (`castle`), `2` Whisperwood (`forest`), `3` the Sunken Reef (`aqua`), `4` the Scorched Dunes (`desert`), a list like `1, 2`, or `all`. |
| `area` | One of: `world` (map, terrain, places), `foes`, `boss`, `story` (people, quests, words), `systems` (mechanics, mounts, save), `balance`, `perf`, `ui` (HUD, menus, controls, phones), `audio`, `review`, `tests`, `tools`, `docs`, `process`. |
| `status` | The folder it sits in: `backlog`, `todo`, `in-progress`, `blocked`, `done`. |
| `priority` | Backlog only: `high`, `medium`, `low`, or `cant-check` (can't be checked here: it needs the user, real hardware or ears; see 070-073). |
| `group` | The group number in its plan, where it has one (`28`, `16b`, `content round`). |
| `plan` | The plan file it belongs to, without `.md`: `realm-2`, `follow-up`, `realm-3`, `realm-4-draft`. |
| `created` | The date it was put on the board (for tasks moved from the old board: the plan's date, or the done date where nothing else was known). |
| `done` | The date it finished; empty until then. |
| `owner` | Who does it: `lead`, an agent (`agent (copy c3)`), `the user`. Empty in the backlog. |
| `blocked_on` | Blocked only: what it waits for, in words. |
| `depends` | Ids of tasks that must be done first: `[037, 038]`. |
| `links` | Related files, relative to the task file: its plan, related tasks, docs. |

The body is written in the board's usual dense style: concrete (paths, numbers, commands), what was built, then the
checks and what they printed (`reach3 (16,010 places with the suit, no traps)`), then what was left as known.
"Confirmed" means reproduced in a live game.

## Ids and group numbers

Ids 001 to 046 are the plans' group numbers (group 28 is `028-...`), so "group 36" and "task 036" are the same
thing. Ids 047 on are everything else: 047 is group 16b, 048 the realm 3 content round, 049-063 the dated entries
from the old board's Done that had no group (054 and 061 were called "group 20" and "group 23" on 2026-09-30, before
the follow-up plan reused 20 to 27; their `group` field says so), 064 on the work open on 2026-10-02.

From now on a new plan's groups take the next free ids, so the group number and the id stay the same
(`node tools/board.mjs next` prints the next free id). A task outside any plan also takes the next free id.

## How work moves

1. **Found or asked for**: a new file in `backlog/` with a priority (`node tools/board.mjs new backlog some-slug
   "A title"`). A flaw found in a review goes here rather than only into a chat message. Related issues can be one
   task, fixed together and reviewed together.
2. **Agreed**: the user agrees a plan (or asks for a task); its tasks move to `todo/`.
3. **Started**: move it to `in-progress/`, set `owner`, write `## Steps`.
4. **Stuck**: move it to `blocked/` and write `blocked_on` (the user's decision, task 064, the usage limit).
5. **Finished**: write `## Done <date>` (what was built, the checks run and their numbers, what was left as
   known), then move it to `done/`. Each group is reviewed after it is built; the review's findings are in its record
   or become new backlog tasks.

Moving a task means moving its file and changing `status` to match. `node tools/board.mjs move <id> <folder>` does
both, sets `done` to today when the folder is `done`, rewrites every link to the file (under `board/`, `docs/`,
`.claude/`, `BOARD.md`, `CLAUDE.md`, `README.md`), ticks its group in the plan, and rewrites `BOARD.md`'s "Now"
section. By hand: move the file, edit `status` (and `done`), search for `<old-folder>/<file name>` and fix the
links, then `node tools/board.mjs index`. Links between tasks always go through the folder
(`../done/028-reef-groundwork.md`, even from a task in the same folder), so the rewrite finds them. Keep the folder
and the state out of a link's words: write "[064]" linking to the file, not "[in-progress/064]" or "064 (in
progress)", since a move rewrites the target, not the words.

Several agents may work at once, each in its own copy of the project (see
[docs/workflow/parallel-work.md](../docs/workflow/parallel-work.md)). Agents in copies don't edit the board; they
report to the lead, who moves the tasks.

## Posting the to-do list (the user's rule)

After each task, post the **whole** to-do list in chat: done tasks crossed out (`~~like this~~`), the current one
marked, all the next ones, and the current task's sub-steps. The user asked for this because they couldn't tell what
was being worked on.

    node tools/board.mjs todo                        the latest 5 done crossed out, in progress with its steps, todo, blocked, the backlog's size
    node tools/board.mjs todo --done 10              more of the done ones
    node tools/board.mjs todo --plan realm-4-draft   every group of the plan being built, done ones crossed out, then what else is open

Paste the output as it is. Without the script: list `in-progress/`, `todo/` and `blocked/` by file name, take the
latest few files in `done/` by their `done` date, and write them in that order with the done ones crossed out and
the in-progress task's `## Steps` under it.

## Plans

A plan is written for the user to read before a realm (or a round of work) starts, and agreed by the user. It keeps
the decisions, the map, the counts and the balance targets; each group in it is one task file. When a group is done
its line in the plan is ticked (`- [x]`) and its record goes in the task file.

| Plan | Agreed | Groups |
|---|---|---|
| [Realm 4, the Scorched Dunes (draft)](plans/realm-4-draft.md) | not yet (task 066) | 37-46, all in `backlog/` |
| [Realm 3, the Sunken Reef](plans/realm-3.md) | 2026-10-01 | 28-36 and the content round (048), all done |
| [The follow-up](plans/follow-up.md) | 2026-10-01 | 20-27, all done |
| [Realm 2, Whisperwood](plans/realm-2.md) | 2026-09-28 | 11-18 and 16b (047), all done; 19 came after it |

Realm 1's groups 1-10 had no plan file: they were the old backlog's issues, sorted by priority on 2026-09-28 and
fixed a group at a time; their records are in `done/001` to `done/010`. The
design rules every plan follows: [docs/design/design-rules.md](../docs/design/design-rules.md); how a realm is
built: [docs/design/realm-building.md](../docs/design/realm-building.md).

## Where the old BOARD.md went (2026-10-02)

Everything was moved, word for word; only links were added (and group 36 ticked in its plan).

| Old section | Now |
|---|---|
| The header | This file |
| In progress (group 36) | [036](done/036-reef-review-and-balance.md) (its two rounds, the decisions, and the first round's "To decide" and "Small things" from the committed board), [064](done/064-suite-on-the-merged-whole.md) (the full suite), [067](backlog/067-ash-door-under-inn-tree-crown.md) and [068](backlog/068-ring-of-oaks-partly-hidden.md) (left as known), [069](backlog/069-ash-home-tree-covers-nettles-glade.md) (the open choice from group 21) |
| Realm 4 plan (draft) | [plans/realm-4-draft.md](plans/realm-4-draft.md); groups 37-46 in `backlog/` |
| Realm 3 plan | [plans/realm-3.md](plans/realm-3.md); groups 28-36 and the content round in `done/` |
| Follow-up plan | [plans/follow-up.md](plans/follow-up.md); groups 20-27 in `done/` |
| Realm 2 plan | [plans/realm-2.md](plans/realm-2.md); groups 11-18 and 16b in `done/` (each with its plan line and its Done record) |
| Backlog | High: a pointer to the follow-up's groups 21-26 (kept at the end of plans/follow-up.md); Medium and Low: none open; "Can't be checked here": backlog 070-073 (`priority: cant-check`). The old note "each group is a set of related issues, fixed together and then reviewed together; 'Confirmed' = reproduced in a live game" is under "How work moves" above |
| Done | `done/`: groups 1-19 and 16b, and every dated entry without a group (049-063) |

Checked when it moved: every non-heading line of the old file is in a file under `board/` (1,164 lines, none
missing), every group number (1-46, 16b, the content round, and the old 20 and 23) has a task, and all 35 dated Done
entries are in `done/` word for word. Added at the move: 064-066 and 074-076 (the open work of 2026-10-02 and a few
loose ends). The old file is in git up to commit 3a4b28d; its last version (with group 36's second round and the
realm 4 draft) was never committed, and lives on in done/036 and plans/realm-4-draft.md.
