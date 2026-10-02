---
id: 009
title: Draw calls and stutters
realm: 1
area: perf
status: done
group: 9
created: 2026-09-28
done: 2026-09-28
owner: lead
depends: []
links: []
---

# 009 Draw calls and stutters

Fewer draw calls per character, and no stutter when coins drop.

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## Done 2026-09-28: what was built and checked

- 2026-09-28: Group 9, draw calls and stutters: each character's parts are merged into one skinned mesh (plus one for glowing bits and one for the see-through silhouette), so the goblin camp went from 556 to 224 draw calls on desktop and 489 to 196 on a phone, and game code from 7.0 to 5.55 ms per frame there. Coins, hearts and "!" marks share their materials and frame quads, so a coin drop no longer costs a ~27 ms frame (now a normal ~7.5 ms one). The review caught two slips before they shipped: the knight's see-through silhouette was switched off, and a removed foe kept its bone texture; both fixed. Check: `tests/rigs.js`. The runner now takes check names (`npm test -- bats economy`).
