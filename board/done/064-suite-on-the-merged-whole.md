---
id: 064
title: The full suite on the merged whole
realm: all
area: tests
status: done
created: 2026-10-02
done: 2026-10-02
owner: agent (the suite run, in its own copy)
blocked_on: 077 (salvagerbot stalls in full runs)
depends: [077]
links: [../done/036-reef-review-and-balance.md, ../done/077-salvagerbot-stalls-in-full-runs.md, ../../docs/testing/testing.md]
---

# 064 The full suite on the merged whole

Run the whole suite (90 checks, `node tools/test-all.mjs`) on the project as merged after group 36's two rounds, read every report, and fix what fails.

## Why

Group 36 was merged from seven agents' copies and then a second round. The board said: "In hand: the full suite (90
checks) on the merged whole, with an agent." It is the last step before the work is committed
([065](../done/065-commit-the-merged-work.md)).

## Checks

Every report read; anything not as the check's description says is a failure. Rerun single checks with
`node tools/test-all.mjs <name>` (see [docs/testing/testing.md](../../docs/testing/testing.md)).

## Steps

- [x] Run 1 on the merged whole: one fix found (Brassbelly lifted onto a turn of the lighthouse stair;
  `src/game/story/lighthouse.ts`).
- [x] Run 2 (finished 2026-10-02, about 21:00): 89 of 90 pass. `salvagerbot` fails in full runs (both runs: no win
  in 150 s, 19 steam rings) while it passes 19 of 20 run alone.
- [x] The lighthouse fix merged into `F:\dev\realms`, type-check clean.
- [x] salvagerbot in full runs: [077](../done/077-salvagerbot-stalls-in-full-runs.md): the bot was stuck at the
  yard steps' side; the bot now goes round (test only), merged.
- [x] Record the results here and move this task to done/.

## Done 2026-10-02

Two full runs of the 90 checks on the merged whole (group 36's two rounds), in the copy `f1` on port 5241. Run 1:
89 pass; salvagerbot failed. Run 2 (with the lighthouse fix): 89 pass; salvagerbot failed again, which 077 traced to
the bot stuck against the side of the yard's steps. The numbers that matter from run 2: reach in realm 1 12,756 cells,
no escapes, no traps; the Sunken Reef on the serpent 7,087 cells, with the suit 15,870, no escapes, no traps, nothing
unreachable; economy3 +19.9% over what the reef sells (1,840 in 35 chests, quests 290, the purse 100); Old Inkarm won
in 45 s, 0 hearts; the Tidelord's fair and balance checks passed; the rides, costume drop and palace passed.
**Fixed and merged:** `src/game/story/lighthouse.ts` (a foe on the steps from Brassbelly's yard is no longer lifted
onto a turn of the lighthouse stair high above) and `tests/salvagerbot.js` (077). Type-check clean. Not run: a third
full run with both fixes (the suite's last eight ran twice with them; the next round's suite run covers the rest).
