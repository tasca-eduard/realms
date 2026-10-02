---
id: 016
title: People, quests and secrets (realm 2)
realm: 2
area: story
status: done
group: 16
plan: realm-2
created: 2026-09-28
done: 2026-09-28
owner: lead
depends: []
links: [../plans/realm-2.md]
---

# 016 People, quests and secrets (realm 2)

Hollowbough's folk, the sword past level 3, the captive sister, the Ring of Oaks trial, secrets, the main quest.

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## In the plan

- [x] **16 People, quests and secrets.** Done 2026-09-28 (see Done).

## Done 2026-09-28: what was built and checked

- 2026-09-28: **Group 16, people, quests and secrets.**
  - **Hollowbough's folk** in hooded greens and browns: Alder the Reeve (the way to the Warden: main
    quest step 2), Moss the innkeeper (flasks), Bryony the thorn-smith, Ash (his sister is missing),
    Old Nettle in her glade (the stag, the oaks), and the **old owl** on a snag at the foot of the ramp
    into the village: one hint a talk, the next each time. Built by hand, not with `deadTree` (which
    rolls the builder's dice and offers the perch to a wild owl).
  - **The sword past level 3**: the thorn-smith sharpens (levels 1 to 3, as in realm 1) and tempers
    (level 4 for 330, level 5 for 440; +15% a level, so x1.90 and x2.05). Realm 1's smith still stops at 3.
  - **A Sister Past the River**: Wren is caged in the Gatherers' Clearing on the Blackwater's shore.
    Three blows break the cage; she gives a traveller's purse (40) and walks home along the lane;
    Ash gives his savings (30). Saved: after a reload the cage stays broken and Wren stays home.
  - **The Ring of Oaks**: a three-wave trial (goblins and a snarer; a shield, an archer, a snarer and a
    spitter; an elite thornback, a shaman, a goblin and a bomber) for the **Heartwood Seed** (one more
    heart, filled at once) and 100 coins.
  - **Secrets**: three Moon Shards (fen, vine ledge, canopy root top: a heart); a niche under the
    Overhang's rock, walled on three sides and sealed by a cracked rock, with a chest (110, Giant
    Slash); nine chests in all (the vine ledge, the niche, a root top, the grove, the fen, the gorge
    rim, the chasm's east bank, the glade, the goblins' hoard), a third lore stone, pots and barrels.
  - **Main quest** in seven steps: find Hollowbough, talk to the Reeve, cross Rookfall, through the
    Thorn Ravine, open the Warden's gate (group 17), defeat the Warden, free.
  - **Fixes**: a goblin at the foot of the Overhang stair started inside the moonfire (found by
    spawns2 after group 15). The wood's scatter now keeps 1.3 m clear of every foe's and animal's
    post, so trees and rocks can't land on them however later changes shift the scatter (they had,
    twice). The spawns check exempts any caged or perched NPC instead of Tam by name.
  - Checks (new): `folk`, `sister` (with a reload), `oaks`, `secrets2`. Also run: typecheck, reach and
    spawns in both realms (clean). Screenshots: `shots/g16-*.png` (owl, cage, niche, ring, glade, reeve).
  - Full suite: 42 reports, all read, no errors. `travel` had checked "no chests at all in Whisperwood" to
    mean "none of realm 1's"; now that the wood has its own, it checks for realm 1's ids (passes).
  - For group 18: the Ring of Oaks reads as more forest from above (the crowns hide the ring).
