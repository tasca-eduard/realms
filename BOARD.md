# Board

The board moved into folders on 2026-10-02: one markdown file per task under **[board/](board/README.md)**, in the
folder for its state. This file is only an index now, so old links to BOARD.md still land somewhere useful. How it
works (the folders, a task file, moving tasks, posting the to-do list): [board/README.md](board/README.md). All the
other docs: [docs/README.md](docs/README.md).

    node tools/board.mjs           the board: counts per folder and the titles
    node tools/board.mjs todo      the whole to-do list to post in chat after each task
    node tools/board.mjs check     every task well formed, every link resolves

## The folders

- [board/backlog/](board/backlog/): known work not yet planned in (with a priority: high, medium, low, or
  can't be checked here), and the groups of a plan the user hasn't agreed yet.
- [board/todo/](board/todo/): agreed, ready to start.
- [board/in-progress/](board/in-progress/): being worked on now, and by whom.
- [board/blocked/](board/blocked/): waiting on something (the user's decision, another task, a limit), and on what.
- [board/done/](board/done/): finished, with the date and what was built and checked.

## The plans

- [Realm 4, the Scorched Dunes (draft, 2026-10-02)](board/plans/realm-4-draft.md): groups 37-46, waiting for the
  user to read and agree it.
- [Realm 3, the Sunken Reef (agreed 2026-10-01)](board/plans/realm-3.md): groups 28-36 and the content round, done.
- [The follow-up (agreed 2026-10-01)](board/plans/follow-up.md): groups 20-27, done.
- [Realm 2, Whisperwood (agreed 2026-09-28)](board/plans/realm-2.md): groups 11-18 and 16b, done.

## Now

<!-- board:now -->
_Written by `node tools/board.mjs index` on 2026-10-02; the folders are always the truth._

**In progress**

- (none)

**Todo (next)**

- [081 Realms 1 and 2 made as beautiful and interesting as realm 3](board/todo/081-realms-1-2-as-beautiful-as-realm-3.md)

**Blocked**

- [066 Read and agree the realm 4 plan](board/blocked/066-read-the-realm-4-plan.md): on the user (to read the draft and agree it or change it; realms 1 and 2 come first: 081)

**Next in the backlog**

- [082 Four Hollowbough doors hidden by crowns](board/backlog/082-hollowbough-doors-hidden.md) (medium)
- [084 A roll pressed early in a swing is dropped](board/backlog/084-roll-dropped-early-in-a-swing.md) (medium)
- [037 Groundwork (realm 4)](board/backlog/037-dunes-groundwork.md) (first group of plan realm-4-draft, waiting)

**Done lately**

- [080 Save where the Tide Serpent waits](board/done/080-serpent-waiting-place-saved.md) (2026-10-02)
- [079 Brassbelly sometimes costs the bot six hearts](board/done/079-brassbelly-sometimes-six-hearts.md) (2026-10-02)
- [078 The costumedrop check never reloads the page](board/done/078-costumedrop-never-reloads.md) (2026-10-02)

<!-- /board:now -->

## Where the old sections went

"In progress" (group 36) is [board/done/036](board/done/036-reef-review-and-balance.md) and the open tasks it left;
the plans are in [board/plans/](board/plans/); "Backlog" is [board/backlog/](board/backlog/); "Done" is
[board/done/](board/done/) (groups 1-36 and every dated entry). The full table: [board/README.md, "Where the old
BOARD.md went"](board/README.md#where-the-old-boardmd-went-2026-10-02).
