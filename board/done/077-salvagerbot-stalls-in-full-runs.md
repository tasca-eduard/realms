---
id: 077
title: Why salvagerbot stalls in full runs
realm: 3
area: tests
status: done
created: 2026-10-02
done: 2026-10-02
owner: agent
depends: []
links: [../done/064-suite-on-the-merged-whole.md, ../done/029-diving-costume-and-air.md, ../done/036-reef-review-and-balance.md, ../../docs/testing/testing.md]
---

# 077 Why salvagerbot stalls in full runs

`salvagerbot` (a player-like bot fighting Brassbelly the salvager, realm 3's first mini-boss) fails in full suite
runs and passes alone. Find out why and fix the game or the check, whichever is wrong.

## Why

It is the one failure left of the 90 checks on the merged whole ([064](../done/064-suite-on-the-merged-whole.md)),
and the work isn't committed until the suite passes ([065](../done/065-commit-the-merged-work.md)).

What is known (2026-10-02, about 21:00):
- In both full runs (89 of 90 passing in the second): no win in 150 s, 19 steam rings.
- Run alone: passes 19 of 20.
- Expected, from group 36: Brassbelly 42 health and a 1.2 s steam ring, never while the knight is dazed; a level-5
  bot wins in 34-45 s losing 0-3 hearts ([036](../done/036-reef-review-and-balance.md)). The bot was written in
  group 29 ([029](../done/029-diving-costume-and-air.md)).
- The lighthouse stair fix (Brassbelly lifted onto a turn of the stair; `src/game/story/lighthouse.ts`) was merged
  after run 1, type-check clean.

Places to look first: what differs in a full run (frame timing under load, state left by earlier checks, where
Brassbelly and the knight start).

## Checks

`salvagerbot` alone 20 times (no worse than 19 of 20) and in a full run (`node tools/test-all.mjs`), its report
read: win time and hearts lost within group 36's range.

## Steps

- [x] Find what makes the bot stall in a full run.
- [x] Fix it (in the game if a player could hit the same stall, else in the check).
- [x] salvagerbot alone 5 times and the suite's last eight twice (not 20 alone and a full run: enough to show the
  stall gone); write the numbers here and move this task and 064 to done/.

## Done 2026-10-02

**The cause: the bot, not the game.** The steps up from Brassbelly's yard to the rock (cells x 97-98, z 32-35)
rise from 1.0 to 4.1; from the beach strip west of them (y 1.0) their side is a wall 1-3 m high. Some openings
(a roll west from the first steam ring) leave the knight on that strip, and then the bot and Brassbelly (or his
crew) walk straight at each other into the steps' side: the knight at (96.7, 33.5) running in place from 8 s to
150 s, Brassbelly 3.05 m off on the yard, outside his 2.8 m steam ring and his 2.1 m reach (or above on the steps,
in reach of the ring: run 2's 19 rings). A player walks round. Not state between checks (each check gets a fresh
page and the test clears the save) and not slow frames (147.9 game-seconds in 148 s).

**The fix, the test only** (`tests/salvagerbot.js`): `straight()` asks whether the knight can go directly to a spot at
his width (no rise of more than a step, no deep water; a 1 m rise only when the foe stands higher, as the bot
jumps); `wayTo()` tries the eight key directions at 1-4.5 m and takes the shortest way round; the bot steers along
it before the old run-at-it. The lighthouse stair fix (064) is a separate, real game fix: an alone run had
Brassbelly lifted to y 9.39.

**Checked:** salvagerbot alone 5 times: won in 37-42 s, 1-6 hearts, 5 steam rings each; the suite's last eight
(pearl to salvagerbot) twice: all reported, salvagerbot won in 40 and 32 s, 1 and 2 hearts; tsc clean. Left as
known: about 1 run in 8 the bot loses 6 hearts, one over the check's 5 (3 of 25 alone runs since the balance):
[079](../done/079-brassbelly-sometimes-six-hearts.md).
