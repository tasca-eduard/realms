---
id: 029
title: The diving costume and air
realm: 3
area: systems
status: done
group: 29
plan: realm-3
created: 2026-10-01
done: 2026-10-01
owner: lead
depends: []
links: [../plans/realm-3.md]
---

# 029 The diving costume and air

The diving suit, won from Brassbelly the salvager on the lighthouse isle, and air below the surface (a nuisance, never a killer).

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## Done 2026-10-01: what was built and checked

- [x] **29 The diving costume and air.** Done 2026-10-01: Brassbelly the salvager (`salvager`: a goblin a head
  taller than a brute in a patched canvas suit, lead boots and a brass helm, swinging a ship's anchor) fights with
  three of his crew in the goblins' salvage yard on the lighthouse isle, under a health bar: a brute's slow,
  unflinching anchor blows, and when he's struck three times in quick succession (or the knight hangs about
  close) his valves hiss, a ring shows on the ground for 0.95 s, and his suit blows off steam all round (a heart
  and a shove; no shield stops it, a roll does). Felled, he drops his diving suit (the helm on a heap of canvas,
  glinting); walked onto, it's the knight's (saved; left lying, it's still there after a reload). Without it deep
  water stops the knight at its edge; a sandbar, wading-deep, runs out from the strand to the isle, which has its
  yard (salvage heaps, a rowboat) and its lighthouse on a rock at the far side, its lantern burning. In the suit
  he walks into deep water, a brass helm on (his plume off), an air cask on his back. Air (`AIR` in config.ts):
  90 s below the surface, a row of bubbles under the bars (one for each ten seconds, pulsing when low, outlined red
  when gone); it fills again above the surface (in 2 s) and in vents' streams of bubbles (four vents are air
  pockets). Out of air he's breathless: 70% speed, no stamina back, the view closes in and greys; never a heart
  lost to it. Warnings: "air running low" and a sound at a quarter left, the sound again every 6 s, "breathless!";
  tips on the first dive and the first time out of air. The quest: "Find a way down into the sea" (the salvager's
  suit), then "Go down into the deep". Checks: tests/costume.js, costumedrop1-2.js and salvagerbot.js (new; a
  player-like bot wins at sword level 4 in 25 s losing 4 hearts and at level 5 in 62 s losing none: 30 health,
  x2.25 here), reach without the suit (the isle reached, nothing else missing) and with it (16,209 places, no way
  out, no traps), sea.js, screenshots.
