---
id: 047
title: Whisperwood relaid (16b)
realm: 2
area: world
status: done
group: 16b
plan: realm-2
created: 2026-09-28
done: 2026-09-28
owner: lead
depends: []
links: [../plans/realm-2.md]
---

# 047 Whisperwood relaid (16b)

Whisperwood relaid: woods by zone, a roomier village, a place with a purpose in every part of the map.

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## In the plan

- [x] **16b Whisperwood relaid.** Done 2026-09-28 (see Done): woods by zone, a roomier village, a place with
  a purpose in every part of the map.

## Done 2026-09-28: what was built and checked

- 2026-09-28: **Group 16b, Whisperwood relaid** (asked: "the village is very crowded; the forest is very
  dense but basically empty; make every area have a purpose and be beautiful scenery where you can find
  treasures"). An overhead map tool (`tools/mapview.js`, drawn with `tools/shot.mjs`) showed one even
  sprinkle of trees edge to edge and purpose zones as islands in it.
  - **Woods by zone** (`woods()` in realm2.ts, a fixed hash not the dice picking spots): deep only in the
    East Woods and the Deep Wood round the Stag's Thicket; light under the giants and between places;
    open over meadows, the grove, the Warden's heights (dead trees only) and along the waters. Meadow grass
    where it opens. Trees 4,567 to 3,969.
  - **Hollowbough** half again as big: a rounded pond, knolls of 6.5 m with 6 m rope bridges, houses on the
    far side of each knoll and open yards (the inn's tables, the smith's anvil and bench, the herb garden),
    no giant oak on the knolls (two frame the village from the far side), four lanterns on the heart-oak.
  - **Waters**: the Whisper and the brook bend (the brook's steep far bank follows its line); the Blackwater
    has bays; Rookfall's tip is wider so the Whisper pours into it (**the Whisper's Fall**: falling drops,
    faint streaks, spray, a lookout with a lore stone and a chest).
  - **New places**: the **Deer Meadow** (a herd, two old snares, a hunter's stand with a chest up its
    ladder); the **High Canopy** as five giants round the **Mirror Pool**, a rope walk from one's top to a
    shelf on another that only the walk reaches (the canopy shard is there now, a spitter guards it); the
    **Rook Pillar** (a rock column a running jump from Rookfall's east rim, a chest and a rooks' nest); the
    **Bat Roost** (a cleft in the East Woods' cliff, two bats, a chest); the **Fallen Giant** (a trunk
    across the Whisper: a secret way over, a chest in its roots); the **Drowned Shrine** (an island in the
    Blackwater: a glowing arch, lore, a chest; stepping stones with shallows between); the **Withered
    Wood** on the Warden's heights (dead trees, thorns, two spitters, Ser Aldric's cairn, lore and a chest);
    the **Mushroom Dell** (giant glowing mushrooms, a fairy ring round a chest); the **Charcoal Kilns**
    (smouldering kilns, the burners' hut taken by goblins, a chest, a lane from the road). The **Ring of
    Oaks** stands in a clear meadow, its oaks set back so the ring and altar read from above.
  - **Fixes found on the way**: the reach check counted thin posts (bridge rails, lamp posts) as filling a
    cell, so it called the inn's knoll unreachable (the knight walks the bridge fine); it now ignores posts
    that thin, and models the knight's running jump (gaps of up to two cells; 7.8 m/s up, gravity 26, 5.2
    m/s run carry him about 3 m). Realm 1's report is unchanged by both (no new bypass or escape). The
    heights' pine scatter now keeps clear of foes' posts too (one had landed on a ravine spitter). Deep water
    stays unjumpable (the Thornstag's leap would otherwise clear rivers and realm 1's moat), so the shrine's
    stones have shallows between; every step there and onto the Fallen Giant is within PLAYER.stepUp.
  - Checks: new `treasures2` (each new place reached as a player would, all nine new chests pay: 700 coins,
    five power-ups); `wood` updated for the new bridge and brook; reach and spawns in both realms clean;
    the tour at 60 fps everywhere (113-198 draw calls, 262k-482k triangles). Screenshots: `shots/g16b-*.png`,
    overhead map `shots/map-forest.png`.
  - Full suite: 43 reports, all read, no errors. `border` once found the warhorse more than 4 m from the
    knight after the crossing: the game sets it down 2.2 m away and it starts wandering after 5-10 s, so
    `border` and `travel` now check where it was set down (its home), not where it has ambled to.
