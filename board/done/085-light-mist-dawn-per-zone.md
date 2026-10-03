---
id: 085
title: Light, mist and dawn per zone (realms 1 and 2)
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

# 085 Light, mist and dawn per zone (realms 1 and 2)

Group 85 of [the plan for realms 1 and 2](../plans/realms-1-2-revisit.md) (task [081](../in-progress/081-realms-1-2-as-beautiful-as-realm-3.md)).

## What

A light per zone, blended at the borders (a light or tint on `RegionDef`): realm 1 Keepsfoot warm amber, Blackpine green-black, the barrows cold violet with ghost-cyan, the marsh sallow, the fields silver-blue, the keep indigo against torch orange, the hall ember-red; realm 2 mist by zone (thin and low over open ground, water and the village; thick only in the Deep Wood, the Mossfen and Rookfall's floor). Brighter nights; dawns of their own (realm 1 rose-gold on stone, green meadows, silver water; realm 2 gold through the trunks, mist burning off). Moon-blue as realm 1's signature glow (moonpetals by the Stones, the barrows and the orchard; moon-blue banners with a gold crescent on the keep). `tools/look.mjs`: the comparison's colour measures (from `r1look/shots-r1look/analyze.mjs` and `r2look/shots-r2look/hue.mjs` in the scratchpad) as a project tool.

## Checks

At the comparison's spots, before and after: realm 1 night brightness ~0.28, saturation ~0.45, contrast 0.11 or more, hue still 205-253; realm 2 ~0.30 and ~0.12, hue still 143-169; dawns about half warm with a hue spread over 40. Realm 3 unchanged (its shots measure the same). lights, travel, border, worldmap; tsc. Before/after shots from the game camera at the comparison's spots (the user's rule: changes plainly
visible from where the player looks).

## Done 2026-10-03

A realm-builder agent in its own copy; merged after 086 (no conflicts). Each place's light is painted into a light
map of the realm (`RegionDef.light`: cast, brightness and mist, by night and at dawn; `src/game/zonelight.ts`,
the values in `src/world/lightzones.ts`), blended over about 4 m, so from the fields Keepsfoot shows amber and the
fields silver-blue; lamps, fires and glows keep their own colour. Realm 1: Keepsfoot and the tavern warm amber,
Blackpine green-black, the barrows cold violet, the Stones and the Hollow silver-cyan, the marsh sallow under
thick mist, the fields, road and Overlook silver-blue, Mirrormere and the river silver, the keep indigo against
torch orange, the hall ember-red, the orchard moon-silver. Realm 2: mist thin over Hollowbough (x0.35), open ground
and water, thick in the Deep Wood (x2.3), the Mossfen and on Rookfall's floor; casts for the Old Grove, the hold,
the withered wood, the Great Tree's roots. Nights brighter and clearer; dawns of their own (realm 1 rose-gold on
stone, green meadows, silver water, the beige veil gone; realm 2 gold with blue-teal shadows, the mist burning
off). 343 moonpetals in drifts at the Seven Stones, the barrows and arch, the dolmen and the Kings' Orchard; the
keep's banners and pennants moon-blue with the gold crescent. `tools/look.mjs` (the comparison's measures).
Measured at the comparison's spots: realm 1's night brightness 0.228 -> 0.276, contrast 0.091 -> 0.119, saturation
0.402 -> 0.448; realm 2's 0.247 -> 0.295, contrast 0.091 -> 0.120; dawns' hue spread 21 -> 79 and 15 -> 51, about a
third warm (meadows, water and canopy stay green and silver); realm 3 the same (0.344/0.345). Checked: zonelight
(new), lights, travel, border, worldmap, reach, reach2, spawns, normals (0 bad), sea, tsc; before/after shots.
Left as known: a few open-ground spots just outside the hue ranges (realm 1 202-205, realm 2 138-142 and 170);
moonpetals not thinned on phones (~80k glow vertices); docs to bring up to date (checks.md, layout.md, the realms'
pages, look.mjs's use).
