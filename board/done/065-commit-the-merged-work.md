---
id: 065
title: Commit the merged work
realm: all
area: process
status: done
created: 2026-10-02
done: 2026-10-02
owner: the lead
depends: [064, 075]
links: [../done/064-suite-on-the-merged-whole.md, ../done/075-docs-round.md]
---

# 065 Commit the merged work

Everything since commit 3a4b28d ("realm 3 imrpoove") is uncommitted in `F:\dev\realms`: group 36's second round, the realm 4 draft plan, the docs round and the board as folders.

## Why blocked

Only the user commits; agents never run git commands that change anything. Once the suite passes
([064](../done/064-suite-on-the-merged-whole.md)) and the docs round lands
([075](../done/075-docs-round.md)), tell the user it is ready to commit, with a one-line summary per area.

## Done 2026-10-02

The user (2026-10-02): "you can commit organized, grouped, etc. DONT DO DESTRUCTIVE ACTIONS." Committed on a new
branch, `realm3-review-docs-board`, off master at 3a4b28d (master left as it was: a fast-forward brings it up). One
commit per area, the mixed files staged hunk by hunk: performance; realm 3's own light; Stairfoot Cove, the steps to
the yard and the world fixes; the gameplay fixes and decisions; the phone HUD and the pad on a phone; Whisperwood
in view; the tests (salvagerbot round the yard's steps); the tools (board.mjs, withserver.sh, copies/, and a
.gitattributes keeping shell scripts LF); the docs; the board; .claude/ (agents, commands, skills). Nothing pushed.
