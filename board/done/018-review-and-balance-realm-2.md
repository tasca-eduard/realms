---
id: 018
title: Review and balance (realm 2)
realm: 2
area: review
status: done
group: 18
plan: realm-2
created: 2026-09-28
done: 2026-09-28
owner: lead
depends: []
links: [../plans/realm-2.md]
---

# 018 Review and balance (realm 2)

Realm 2's review and balance: the pause menu's map of the eight realms, the economy.

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## In the plan

- [x] **18 Review and balance.** Done 2026-09-28 (see Done). Prices, difficulty (hearts can reach 8 by the end of realm 2),
  performance and phones in the new realm, the pause-menu world map (the prototype's, filled in as
  you travel), README. Checks: the full suite in both realms.

## Done 2026-09-28: what was built and checked

- 2026-09-28: **Group 18, review and balance.** The pause menu's **map of the eight realms** (the
  prototype's world map, `src/ui/worldmap.ts`): islands on a pixel sea along a dotted route; realms
  visited show their land, their tyrant freed or not, shards and chests found, and a click travels there;
  the next realm is a rumour, the rest "?". **Economy**: Whisperwood paid ~1,560 coins (chests and rewards)
  against ~770 to spend, so the thorn-smith's tempering costs 400 and 560 (was 330 and 440) and the six
  biggest chests there are lighter. Check `worldmap` (a two-realm save; states, stats, travel by click).
  The baseline worktree is removed.
