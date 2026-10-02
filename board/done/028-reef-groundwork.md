---
id: 028
title: Groundwork (realm 3)
realm: 3
area: world
status: done
group: 28
plan: realm-3
created: 2026-10-01
done: 2026-10-01
owner: lead
depends: []
links: [../plans/realm-3.md]
---

# 028 Groundwork (realm 3)

Realm 3, the Sunken Reef (`aqua`), in the registry: a rough drowned coast to try things on, clear water the camera looks down through, floaty physics below the surface.

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## Done 2026-10-01: what was built and checked

- [x] **28 Groundwork.** Done 2026-10-01: `aqua`, the Sunken Reef, in the registry (`src/world/realm3.ts`
  builds a rough 140 x 110 drowned coast to try things on: the strand and a goblin camp in the north-west, the sea
  floor stepping down toward the south-east, three isles, the drowned plaza's columns breaking the surface, kelp
  groves, the trench and its abyss; its story module, quest and light, a moonlit coast). The pause menu travels
  there ("The Sunken Reef (being built)"); the world map leaves it out until it's built. The sea is clear water
  the camera looks down through: below its surface the floor darkens and turns blue-green with depth, light
  ripples over it and shafts come down (the last pass, `src/engine/pipeline.ts`), specks drift, bubbles rise from
  the knight's helmet. Below the surface everything floats (`physics` in `src/game/realms.ts`: a jump 1.27 m
  high and 0.8 s long against 1.12 m and 0.53 s on land, sinking at 5.5 m/s at most, the knight 15% slower,
  shots 30% slower). Deep water: a diver walks in (for now any knight in the realm; group 29 gives it to the
  suit), a land-walker stops at its edge, a sea creature can't leave it. Nothing burns, no Fire Blade, no horse.
  The sea's ground (coral rubble, silt, seagrass) and props (`src/world/sea.ts`: kelp, corals, sea fans,
  anemones, barnacled rocks, bubble vents, drowned columns). Below the surface sound is muffled, with bubbles
  and a low drone; its own music (the prototype's: 70 bpm C Lydian, a celesta over a choir and harp, an echo).
  Checks: tests/sea.js (new), reach3, spawns3 and normals3 (new), the full suite (66 checks, all passing;
  the Warden's bot won in 77 s losing 10 hearts, at the edge of its limit, 5 the time before), screenshots. Found
  afterwards and fixed: on the sea floor he still counted as wading (about half speed, splashes on the surface
  over him); now 85% of his speed (sea.js checks it).
