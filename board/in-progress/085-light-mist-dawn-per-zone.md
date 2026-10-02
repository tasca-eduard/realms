---
id: 085
title: Light, mist and dawn per zone (realms 1 and 2)
realm: castle, forest
area: look
status: in-progress
priority: high
created: 2026-10-02
done:
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
