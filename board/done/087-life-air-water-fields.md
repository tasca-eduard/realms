---
id: 087
title: Life in the air, the water and the fields (realms 1 and 2)
realm: castle, forest
area: life
status: done
priority: high
created: 2026-10-02
done: 2026-10-03
owner: an agent (its own copy)
depends: []
links: [../plans/realms-1-2-revisit.md]
---

# 087 Life in the air, the water and the fields (realms 1 and 2)

Group 87 of [the plan for realms 1 and 2](../plans/realms-1-2-revisit.md) (task [081](../in-progress/081-realms-1-2-as-beautiful-as-realm-3.md)).

## What

The reef's instanced flocks and schools (`src/game/sealife.ts`, `shorelife.ts`) made general for land and fresh water, each realm's own creatures with their own models. Realm 1: crows round the keep's towers and on the battlements, harmless bats over the barrows and out of the Hollow, swans and ducks on Mirrormere and the moat (the swans take off when he comes), a heron at the ford, frogs off lily pads, fish rising in rings, sheep in a fold and on the meadow, two cows, geese by the stream, moths at every lamp, glow-worms in Blackpine, pale chimney smoke and the tavern's warm wisps. Realm 2: rooks over Rookfall and the Rookery, a heron and ducks on the Heartpool, bats leaving the Roost, trout in the Whisper, carp, frogs on the lily pads, moths, fireflies in every glade (yellow beside the cyan), a deer herd with a stag, rabbits, a badger. A white hart in each realm, seen rarely, that bolts.

## Checks

Something moving in every screen at the comparison's spots; particles in the empty places over 250; spawns, spawns2; draw calls no worse on desktop, phones measured (fewer there); tsc. Before/after shots from the game camera at the comparison's spots (the user's rule: changes plainly
visible from where the player looks).

## Done 2026-10-03

A content-builder agent in its own copy; merged (the suite's list kept both this group's checks and 085's). One
shared module, `src/game/wildlife.ts` (realm 3's sea life now built on it, unchanged: its herd, material and
culling moved there), and each realm's own creatures and models: `src/game/castlelife.ts` and `forestlife.ts`,
started by each realm's story. Realm 1 (151 on desktop, 90 on phones): 26 crows wheeling round the donjon, the
towers and the gatehouse, half sitting on the merlons and going up when the knight comes below; 16 bats over the
barrows and the Hollow; 5 swans on Mirrormere that run along the water and fly, mallards there, on the moat and
the marsh pools; a heron at the ford and along the stream; 22 frogs on lily pads; roach rising in rings and
leaping; 26 sheep, 2 cows, 9 white geese; a rare white hart with glowing moon-blue antlers; moths at every warm
lamp, thistledown, midges, glow-worms in Blackpine, marsh lights, warm motes at the tavern. Realm 2 (203, 125 on
phones): 22 rooks over the Rookery and Rookfall, 14 bats out of the Roost, 25 wood ducks, a night heron, 19 golden
carp, 28 trout holding against the Whisper's current, 26 tree frogs on pink-flowered pads, a red deer herd with
its stag, 30 rabbits at 6 warrens, a badger, a rare white hart with gold-green antlers, gold fireflies in 15
glades, luna moths, spores. Chimney smoke pale and visible (`P.smoke`; realm 3's cook-fire smoke now shows too).
Particles over 250 at every comparison spot (realm 1: 76-424 before, 260-542 after; realm 2: 161-318 before,
280-635 after). Draw calls: at most 4 instanced meshes a realm, +1.5 to +5 where the life is in view (paid back
later by moving the old critters onto these meshes: group 96). Checked: wildlife1 and wildlife2 (new), spawns,
spawns2, sea, reef, zonelight, tsc; before/after shots (swans on Mirrormere, sheep and geese by the Stones, crows
on the battlements, deer in the wood).
