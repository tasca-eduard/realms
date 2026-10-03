---
id: 089
title: Realm 1's set pieces
realm: castle
area: places
status: done
priority: high
created: 2026-10-02
done: 2026-10-03
owner: an agent (its own copy)
depends: [085, 086]
links: [../plans/realms-1-2-revisit.md]
---

# 089 Realm 1's set pieces

Group 89 of [the plan for realms 1 and 2](../plans/realms-1-2-revisit.md) (task [081](../in-progress/081-realms-1-2-as-beautiful-as-realm-3.md)).

## What

A watermill on the stream above the ford (a turning wheel throwing foam, a mill race, a lit window, a lane to it); the keep's beacon as a landmark (cold moon-blue while the Goblin King holds it, gold at dawn; in `landmarks`); a ruined shrine on Mirrormere's island (hidden stepping stones, no path); the Seven Stones' runes glowing in turn and the eighth stone half-buried, a chest under it; the Kings' Orchard in blossom; the raided farm smouldering, then mended after the raiders are beaten; a waterfall off the Overlook's far edge with a ledge and chest behind it; a night fisher's lantern boat on Mirrormere. Tall things on the far side of what they dress.

## Checks

reach, normals, spawns, the overhead map and the empty-areas map; before/after shots of each place; draw calls; tsc. Before/after shots from the game camera at the comparison's spots (the user's rule: changes plainly
visible from where the player looks).

## Done 2026-10-03

A realm-builder agent in its own copy; merged after 085-088 ("keep both" conflicts in realm 1's story, imports
and the suite's list). `src/world/keepsights.ts` and `src/game/story/keepsights.ts` (new). The Old Mill on the
stream above the ford: a wheel turning in a stone-lined mill race (a new flow, white water under the wheel), a lit
window and door, a lane up from the ford, Hobb the Miller. The keep's beacon on the gatehouse, moon-blue until
dawn, then gold (in `landmarks`). The First Knights' Isle in Mirrormere: a moonlit stone knight among broken arches
(on the far side from the camera), stepping stones hidden in the shallows, lore6 and a chest. The Seven Stones'
runes waking in turn (all burning once the trial is won); the eighth stone half sunk, a chest under it. The
Kings' Orchard in blossom (11 trees, petals, windfalls, bee skeps). The raided farm smouldering until its raiders
are beaten, then mended out of sight (frame, scaffolding, lanterns, Wat and Edda Harrow back). Pilgrims' Fall off
the Overlook's far edge into a plunge pool, a ledge and a chest behind the curtain. A night fisher's lantern boat
drifting round the isle. Chests 11 -> 14 (+190 coins; group 90 rebalances), lore +1, people +3. Empty ground 10.5%
-> 6.9%. Checked: keepsights (new, across a reload), folk1, wildlife1, zonelight, reach (12,740, no traps), spawns
(139, none bad), normals (0 bad), economy, economy1, review, migrate, farm, tsc; before/after shots. Left as known:
the beacon can't show from the village's north edge with this camera (the gatehouse is off the top of the frame
from there): it shows on the approach to the drawbridge and in explore mode; the farm's crop rows stay burned.
For 090: `this.sights.setWheel(false/true)` for the jammed-wheel errand; lore6 is taken.
