---
id: 067
title: Ash's door under the inn tree's crown
realm: 2
area: world
status: done
priority: low
created: 2026-10-02
done: 2026-10-02
owner: an agent (realm-builder, its own copy)
depends: []
links: [../done/036-reef-review-and-balance.md, ../done/021-fixes-from-the-comparison.md]
---

# 067 Ash's door under the inn tree's crown

In Hollowbough, Ash's door stands under the crown of the inn tree, so it can be hidden from the camera. Left as known in group 36's second round (2026-10-02: "Left as known: Ash's door under the inn tree's crown"), after Ash himself was moved to the front of his garden in view (0 of 17 points hidden, was 17).

## Why

Places and people meant to be seen should not sit under a crown on the camera's line (group 21's rule). Group 21
moved the inn tree off the Ring of Oaks to the bay's south shore by the kilns lane.

## Checks

Cast rays from the game camera as group 21 did (points of 17 hidden), before and after, with screenshots from the
game camera (the user's rule: changes plainly visible from where the player looks). Then folk, oaks, spawns2 and
reach2.

## Done 2026-10-02

Hollowbough's sightlines, 067 to 069 together (a realm-builder agent in its own copy; merged). The inn tree moved
from the bay's south-west corner to where the road comes in, across the kilns lane by the owl's snag (58.2, 96; a
size smaller, 1.05; its door turned so the Old Grove's first giant oak doesn't hide it): its crown hid a 13 m band
of the west shore, Ash's door and the lane west with it, and no spot for Ash's home cleared it. The lane's bend
and the inn's second table moved to suit, Bram's round ends round the inn's east side, the inn's yard keeps the
village's name. Ash's family's home tree a size smaller (0.85, the same spot), so its crown no longer reaches the
Ring of Oaks. Points of 17 hidden from the camera: Ash's door 17 -> 0, the Ring of Oaks 5 -> 2 (its own oaks), the
altar 0, Old Nettle's spot and Old Nettle 0 (069 settled by group 36's move of her herb spot), the inn's door 0.
The dice unchanged (4,369 colliders, the same away from the two trees). Only `src/world/realm2.ts` (7 lines).
Checked: reach2 (10,858 reachable, no escapes, no traps), spawns2, folk, oaks, normals2, corners2 (Bram's round),
treasures2 (9 of 9 chests); tsc clean; before/after shots from the game camera (Ash's garden: his home and lit door
now in the open). Left as known: the inn's crown now covers the island end of the south rope bridge;
four doors hidden by crowns ([082](../backlog/082-hollowbough-doors-hidden.md)).
