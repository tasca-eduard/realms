---
id: 055
title: The Warden's fight made fair
realm: 2
area: boss
status: done
created: 2026-09-30
done: 2026-09-30
owner: lead
depends: []
links: []
---

# 055 The Warden's fight made fair

The Thorn Warden's fight made fair, its hollow and the way to it natural, living wood for trunks and roots.

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## Done 2026-09-30: what was built and checked

- 2026-09-30: **The Warden's fight made fair, its hollow and the way to it made natural** (asked: "it's very
  hard to fight the boss in realm 2, there's not enough space, they can hit me from anywhere, don't have time
  to react"; "the way to the boss area is too crowded"; "the boss area too crowded"; "the tree trunk and its
  roots look so plastic/fake/straight").
  - **Room**: the hollow is 16 by 15 m (179 m² of floor, was 88), its mouth on the east, straight down a short
    path from the top of the stair. The garrison stands before the mouth; the spring moved aside.
  - **Nothing hidden**: the roots round it stand 2 m on the camera's side (were 3 to 3.4 m all round; still
    more than the knight can climb), 3.4 m at the back. Moonlight on the floor. Marked spots and the volley's
    lines are drawn over everything.
  - **Time to react**: marked spots fill up for 1.5 s (1.25 s enraged; were 0.95 s) and are as big as what they
    hit; the rain marks the knight's spot and an arc to one side, never all round; the volley's lines lie on
    the ground while it draws and are fixed 0.45 s before the arrows fly along them; roots 1.25 s. One attack
    at a time (nothing new while marks are still to land), longer pauses between, 46 health (was 54).
    Goblins summoned, not snarers (a bola held the knight still under the rain). The fight is on foot (the
    stag waits outside). Arrows in the air and marks die with the Warden. Its name replaces the place's.
  - **Proved** (tests/wardenfair.js): a bot that only steps out of the way a quarter second after each
    warning took 0 hits calm and 0 to 1 enraged in 22 s; standing still, 3 to 4 hits in 14 s.
  - **Living wood**: a new knobbly tube (Geo.sweep) and trunk, root and bough builders (wood.ts): trunks
    taper, lean, wander and flare at the foot; roots arch out of the bark, run half-sunk, fork and dive in
    (colliders where they stand high); boughs bow. The Great Tree, the home trees, giant oaks, withered oaks
    and the Fallen Giant (with a root plate) are built with them; the ring round the hollow is a braid of two
    great roots with knots, moss and rootlets (collision follows them; no blocky raised cells). Same dice as
    before, so nothing placed after them moved.
  - **The way up**: no box-shaped rock towers either side of the stair: two ragged, mossy hills at the
    heights' edge, the cleft between them (still too high to climb from the stair, even on the stag); the
    stair a slope of bare rock with roots across it for steps.
  - **Found on the way**: a black square at the foot of the stair (a face with no area gave a NaN that the bloom
    smeared); faces with no area are skipped now, and tests/normals.js checks both realms for them.
