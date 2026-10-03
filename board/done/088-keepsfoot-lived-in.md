---
id: 088
title: Keepsfoot lived in
realm: castle
area: people
status: done
priority: high
created: 2026-10-02
done: 2026-10-03
owner: an agent (its own copy)
depends: [085]
links: [../plans/realms-1-2-revisit.md]
---

# 088 Keepsfoot lived in

Group 88 of [the plan for realms 1 and 2](../plans/realms-1-2-revisit.md) (task [081](../in-progress/081-realms-1-2-as-beautiful-as-realm-3.md)).

## What

About 12 more villagers in Keepsfoot, each doing something (`roam` and `pose`): a night watchman's round with a lantern over the bridge, the smith at his anvil with sparks, children at the well, a couple on a bench, a lamplighter, a fisher on the bridge, washing hung, a drinker at the tavern door, a girl feeding the hens. Villagers turn and speak a line as he passes (as the prototype's did). Lanterns strung across the street. The village changes with the story: a feast table after Tam comes home, lanterns up the north road after the drawbridge falls, everyone out at dawn. Gnasher's camp at its business before the fight (a boar on a spit, goblins dicing, the drummer).

## Checks

People in Keepsfoot ~20, most doing something (a folk check for realm 1 like realm 2's `folk`); spawns, reach, talk, review, economy1; before/after shots of the square; tsc. Before/after shots from the game camera at the comparison's spots (the user's rule: changes plainly
visible from where the player looks).

## Done 2026-10-03

A content-builder agent in its own copy; merged after 085 and 087 (three "keep both" conflicts in realm 1's story,
its imports and the suite's list). Keepsfoot: 5 people standing still before; 21 now, 18 at work or play
(`src/world/keepsfoot.ts`, `src/game/story/keepsfoot.ts`): Old Hob of the Watch on a round with a lantern over the
bridge, Garrow hammering and Wat at the bellows, Nell and Dickon chasing round the well, Old Aldous and Old Mabel
on the bench, Jory the Lamplighter reaching his pole to each lamp, Osric angling off the bridge, Edda's washing on
the bank, Rufus with a tankard at the tavern door, Bess feeding the hens (a hen-house, four chickens), Agnes at
the stall, Godric carrying sacks from the cart, Cole of the Watch at the north road, Cuthbert sweeping the chapel
step, Alys carrying water; each with Keepsfoot's own look (caps, plum, cornflower and russet cloth, kettle helms)
and lines in the realm's voice. A villager the knight walks past turns and says a word in a bubble (one at a time;
a shared `heed` on `Npc`, set only by realm 1's story). Nine ropes of paper lanterns over the square and street
(warm, moon-blue, violet; no new point lights). The village follows the story: a feast table before the tavern
once Tam is home, ten lantern posts up the north road once the drawbridge falls, twenty people in the square at
dawn. Gnasher's camp at its business: a boar on the spit, two goblins dicing (three new camp goblins, appended;
an old save with the camp cleared doesn't spawn them). Checked: folk1 (new), spawns (136, none bad), reach (no
traps), talk, review, economy1, wildlife1, zonelight, tsc; before/after shots (the square, the feast, the camp).
For 090: Jory can give the stolen-oil errand; Cuthbert's victory line asks for a bell rope.
