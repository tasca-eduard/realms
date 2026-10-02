---
id: 080
title: Save where the Tide Serpent waits
realm: aqua
area: mounts
status: done
priority: low
created: 2026-10-02
done: 2026-10-02
owner:
depends: []
links: [../done/033-the-tide-serpent.md, ../done/074-left-as-known-notes.md]
---

# 080 Save where the Tide Serpent waits

## What

Group 33 left it as known: "where it waits isn't saved". Ridden somewhere and left, the serpent keeps that spot as its
`home` (`src/game/serpent.ts`) only until a reload or a journey; then it is back by its old pen. The realm 4 plan
saves where the wyrm waits, and notes that realm 3's serpent's wasn't.

## Why

A player who leaves it by Gull Rock or the Whalebone Isle and comes back after a reload finds it gone from there, and
must swim (or walk) back to the pen to call it: not a softlock (the knight wakes at a moonfire), but it reads as lost.

## Checks

Ride it to an island, get off, reload: it waits where it was left (serpent, serpentmoves, reachserpent still pass).

## Done 2026-10-02

Each realm's part of the save keeps `spots`, where things were left by name (`src/game/save.ts`; older saves start
with none). The serpent writes its waiting place there whenever it takes a new one (got off, called to a spot,
back from a dive, come to a moonfire: `keepHome` in `src/game/serpent.ts`), and a freed serpent starts there after
a reload or a journey (at the nearest open sea to it). The page's save on leaving writes it. Checked: a new check,
`serpentspot` (left on open sea 35 m from its pen: saved, and after a reload exactly there, 0 m off); serpentswim,
serpentmoves and serpent still pass; tsc clean.
