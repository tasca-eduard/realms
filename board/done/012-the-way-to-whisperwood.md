---
id: 012
title: The way to Whisperwood
realm: 1, 2
area: world
status: done
group: 12
plan: realm-2
created: 2026-09-28
done: 2026-09-28
owner: lead
depends: []
links: [../plans/realm-2.md]
---

# 012 The way to Whisperwood

The thorn road from realm 1 to Whisperwood (only the warhorse's charge breaks the hedge), and travel from the pause menu.

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## In the plan

- [x] **12 The way to Whisperwood.** Done 2026-09-28 (see Done).

## Done 2026-09-28: what was built and checked

- 2026-09-28: **Group 12, the way to Whisperwood**, and travel from the pause menu.
  - **The pause menu has "Travel to <realm>"** between Resume and Quit (asked for): it crosses to the
    other realm whether or not either is finished, coming out at your last lit moonfire there (or where
    the road from here comes in).
  - **The thorn road** (realm 1's north-east corner): the border hills end at the old lodge and a level
    shelf runs north along the gorge's rim (the drop on the near side, so nothing hides the knight). A hedge
    of the Warden's thorns grows right across it: swords and heavy blows only make it spring back; a
    warhorse's charge tears through, the Goblin King alive or not (kept with the broken walls). Past it
    the road runs into an arch of thorns lit green-gold from within, the roots of the Great Tree beyond,
    and over into Whisperwood; the same road brings you back to its mouth. A sign at the lodge, two new
    lines from the Old Warden (the other warden, the thorns), a quest "The Thorn Road", a region name.
  - New props (`src/world/wood.ts`): the Warden's briar (green canes, bone-pale thorns, red berries, glowing
    sap), thickets, the Great Tree.
  - Review, found and fixed: the thorns were dark brown on dark ground and didn't read (recoloured with the
    prototype's thorn colours, denser, with glowing sap); the Great Tree, meant as a landmark on the
    horizon, never showed: in this view a 30 m tree shows only its trunk, and unexplored land is misted
    (moved to the road's end so its roots, low pods and drifting seeds are in view, and landmarks are never
    under the mist); at the road's first end the camera could see past the world's edge into black
    (shortened by 6 m); the Warden's longer talk ran the `talk` check out of time (given 32 s).
  - Checks: new `border` (hedge holds against a sword and a dash strike, a charge breaks it with the King
    alive, the road leads to Whisperwood and back to its mouth with the hedge still down), `menutravel`
    (menu to Whisperwood and back to the lit moonfire); `reach` (125 more reachable cells, nothing
    unreachable, no way out; before the hedge breaks the border is unreachable, as it should be),
    `spawns`, `travel`, `talk`, `pad`, `farm`; screenshots of the hedge, the road, the tunnel end.
