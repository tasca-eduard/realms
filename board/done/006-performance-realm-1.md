---
id: 006
title: Performance (realm 1)
realm: 1
area: perf
status: done
group: 6
created: 2026-09-28
done: 2026-09-28
owner: lead
depends: []
links: []
---

# 006 Performance (realm 1)

Frame time in realm 1: moon shadows, idle foes, shaders compiled at load, wildlife on phones.

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## Done 2026-09-28: what was built and checked

- 2026-09-28: Group 6, performance: characters cast moon shadows only near the knight (blob shadows everywhere; -150 draw calls at the camp, game code 8.2 -> 7.0 ms per frame there); idle foes far from the knight and the view skip their frame; the shaders for firepots, rings, orbs, sword arcs and pickups are compiled at load (the first-use freeze went from ~170 ms to a normal frame); phones get half the extra wildlife. Particles turned out cheap (0.08 ms), so they were left alone. The main remaining cost is character draw calls (each body part is its own mesh).
