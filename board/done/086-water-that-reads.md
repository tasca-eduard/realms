---
id: 086
title: Water that reads (realms 1 and 2)
realm: castle, forest
area: look
status: done
priority: high
created: 2026-10-02
done: 2026-10-03
owner: an agent (its own copy)
depends: []
links: [../plans/realms-1-2-revisit.md]
---

# 086 Water that reads (realms 1 and 2)

Group 86 of [the plan for realms 1 and 2](../plans/realms-1-2-revisit.md) (task [081](../in-progress/081-realms-1-2-as-beautiful-as-realm-3.md)).

## What

A lapping edge on every bank and shores that aren't square steps; flow on streams and rivers (ripples and foam drifting downstream, white water at fords, falls and bridges); clear shallows over a visible bed (pebbles, weed), dark deeps as a mirror; a moon path on still water and lamps' and windows' light laid on it as wavering streaks. In the water code (`src/world/terrain.ts` `buildWater`), realm 3's sea unchanged.

## Checks

Before/after shots of the ford, Mirrormere, the moat, the marsh (realm 1), the Heartpool, the Whisper, the Blackwater, Rookfall (realm 2); realm 3's sea shots unchanged; sea, reach, reach2, normals, normals2; draw calls no worse; tsc. Before/after shots from the game camera at the comparison's spots (the user's rule: changes plainly
visible from where the player looks).

## Done 2026-10-03

A realm-builder agent in its own copy; merged. `src/world/water.ts` (new). Low, soft banks in realms 1 and 2 slope
into the water (drawn into the terrain's chunks: no new draw calls): a wavering waterline, points of land rounded,
inner corners cut; stone walls, paving and wood stay sheer (the moat's walls as they were). A new surface for
rivers, lakes and pools (one mesh): a pale edge lapping at every shore and a thread of foam further out; ripples
and foam drifting downstream along `RealmData.flows` (realm 1: the stream 0.9 m/s, the Mirrow 0.55; realm 2: the
Whisper 0.8, Rookfall's stream 1.5, the brook 0.6, the Greywater 0.45; the rest lies still); white water at the
ford, the Whisper's fall lip and round bridges over running water; clear shallows over stones and silt with weed
streaming, dark deeps mirroring the sky; a moon path from the knight; lamps and torches laid on the water as
wavering streaks; its colours from the realm's own moon and sky (so group 85's light carries into it). Reeds in the
still shallows and low stones in the running ones, in patches, none where a path, jetty or bridge meets the water
(realm 1: 30 and 39, realm 2: 57 and 24; their own dice). Realm 3's sea unchanged (the old shader serves only the
sea now; four shots measured the same). Draw calls the same (the ford 169, Mirrormere 156, the green 215, the
Blackwater ~193); triangles about +10%. Checked: tsc; reach 12,756 and reach2 10,858 reachable, no traps; normals
and normals2 0 bad; sea; before/after shots (the ford: a dark stepped band before, a flowing stream with wavy
banks and white water after; lamp streaks by the village bridge; the Heartpool's moon path). Left as known: the
bank cells' tops still step (only the waterline is rounded); at a bank's foot the slope can hide 0.25 m of the
knight's feet; each water pixel loops over the 14 pool lights (not measured on a phone).
