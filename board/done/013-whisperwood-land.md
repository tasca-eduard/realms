---
id: 013
title: Whisperwood's land
realm: 2
area: world
status: done
group: 13
plan: realm-2
created: 2026-09-28
done: 2026-09-28
owner: lead
depends: []
links: [../plans/realm-2.md]
---

# 013 Whisperwood's land

Whisperwood's map, edges, props and light, laid out from the prototype's forest level (no foes or people yet).

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## In the plan

- [x] **13 Whisperwood's land.** Done 2026-09-28 (see Done).

## Done 2026-09-28: what was built and checked

- 2026-09-28: **Group 13, Whisperwood's land** (no foes or people yet: groups 14 to 16).
  - The map (`src/world/realm2.ts`), laid out from the prototype's forest level: the thorn road comes over
    the brook by a stone bridge to the Warden's Stone (south-east); the Old Grove's ancient oaks; Hollowbough,
    four treehouse knolls round a black pond with the heart-oak on its island, joined by rope bridges; the
    High Canopy, giant trunks whose roots step up a metre at a time; the east woods and the rope bridge over
    Rookfall Chasm; the Thorn Ravine, a shelf under the northern cliffs above the Blackwater; the Overhang
    and its stair; the Warden's Hold round the Great Tree, ringed by thorns (its gate comes in group 17);
    west, the Ring of Oaks, the herbwife's glade and the Mossfen (no path: found by leaving the track);
    past the Whisper, the gatherers' clearing. Four moonfires, two signs, two lore stones with the
    prototype's lines. A green-teal night with a smaller green moon, and a gold-green dawn.
  - Edges: the Old Wood's heights north and west, the gorge east (the same one as realm 1's), the brook
    south with a steep far bank; nothing tall on the near sides.
  - New props: giant oaks, rope bridges (planks over two cells, rails you can't slip between), the Great
    Tree in the Hold. Giant crowns fade when they stand between the camera and the knight, like roofs.
  - Review, found and fixed: the crowns hid half the screen (they fade now, and are built from smaller
    leaf clusters); two village rope bridges ran over dry pond-edge land (an invisible wall under them:
    moved inward over deep water); the chasm bridge covered one cell, so the knight fell off it (bridges now
    run along cell boundaries); knoll oaks and lamps stood on bridge landings; a one-cell gap let you round
    the Blackwater past the ravine; the gorge's rim ran out of the world north and south, and the brook's
    far bank could be reached round the stone bridge's rail (the rim stops, the bank is steep); two
    squirrels started inside trunks; the grove and the fen were overgrown; phones get a third fewer trees.
  - **Also a bug in both realms:** falling into a gorge or chasm could put you back on its floor (you
    landed there while the fall faded, and that counted as safe footing), then fall again and again. Safe
    footing is now never below -5.
  - Checks: new `wood` (across the chasm bridge and a village bridge without dropping; a step off the
    chasm's edge costs exactly one heart and puts you back on the rim; the brook's far bank can't be
    reached), `reach2` (Whisperwood: nothing unreachable, no way out), `spawns2`; `reach`, `travel`,
    `border`, `menutravel`, `death`, `ride`, `horse`, `controls`, `moves` in realm 1; a tour of 18 stops
    (`tests/tour2.js`: 60 fps, 95 to 164 draw calls, 340k to 590k triangles); screenshots of every area.
