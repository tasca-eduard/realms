---
id: 019
title: Whisperwood made wild
realm: 2
area: world
status: done
group: 19
created: 2026-09-28
done: 2026-09-28
owner: lead
depends: []
links: [../done/047-whisperwood-relaid.md]
---

# 019 Whisperwood made wild

Whisperwood made wild: zones of their own, natural waters, dressed cliff edges, a tree village, the Warden's Hold grown not built, the stag guarded.

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## Done 2026-09-28: what was built and checked

- 2026-09-28: **Group 19, Whisperwood made wild** (asked: "the complexity isn't the same as realm 1, no zones,
  just random structures/groups in the forest; the boss arena is man-made, it should be a wild map; the
  big lake is square, like a pool; the cliff edges are empty; the village is boring and man-made: I
  expected big trees with the houses built in them; the stag should be guarded, and its fence looks
  man-made").
  - **Zones** (`zoneAt()` and `ZONES` in realm2.ts, borders wobbled so none is a straight line): the
    thorn road's verge (birches, bracken, meadow), the Old Grove (moss and leaf litter under the ancient
    oaks, ferns, moonflowers), Hollowbough, the Deer Meadow (flowers, a few birches), the High Canopy
    (moss, ferns, glowing fungi in the giants' shade), the East Woods (close pines on rocky ridges),
    Rookfall's rims and the Thorn Ravine (gravel, stone, dead trees, thorn scrub), the Blackwater's
    shores (mud, reed beds, birches, drowned trees), the river banks, the Deep Wood (old oaks and pines
    close together on mossy root mounds, ferns, fungi, fallen trunks), the cut wood round the Charcoal
    Kilns (stumps, young birches), the withered Warden's heights, mixed woodland between. Each has its
    own trees, ground, undergrowth and (East Woods, Deep Wood) relief.
  - **Waters**: the village lake (the Heartpool) has a wavy round shore; it and the Blackwater (new, more
    ragged outline) shelve: sand, 1.6 m of wadeable shallows, then deep. No sheer pool walls.
  - **Cliff edges dressed** everywhere: ferns, bushes and stones along every lip, brown roots and moss
    down the faces the camera sees (not green, so they aren't mistaken for climbable vines), boulders at
    the feet.
  - **Hollowbough, a tree village**: four great home trees round the Heartpool (`homeTree` in wood.ts):
    a lit door in the trunk under a shingled hood, shuttered windows up the bark, a stone chimney, a
    lantern in the roots; treehouses on platforms in three crowns with rope ladders, rope walks from two
    of them to the Heart Oak (the Reeve's) on the island, which two rope bridges reach. The inn's tables,
    the smith's forge and anvil in the roots, Ash's family's garden and woodpile, a gathering fire, a
    jetty and a boat, lanterns strung between the trees. The box houses and round knolls are gone.
  - **The Stag's Thicket**: a hollow among mossy rocks in the Deep Wood (open toward its lane, briars
    spilling over the rocks, a fallen trunk, a dead tree), no ring of hedge; guarded by the Warden's
    keepers (a snarer, two goblins, a thornback).
  - **The Warden's Hold, grown not built**: the stair comes up into a gully between two masses of rock;
    living thorns grow across it (`ThornGate`), fed by the Thorn Heart on a rock spire by the stair's
    foot (climbed by its vines; the heart beats until torn out, then shrivels and the thorns wither).
    Beyond, the Warden's grove of dead trees and thorns (the garrison), the Great Tree at the back (a
    living giant again), and the arena between two great ridges of its roots, a tangle of thorns growing
    shut across its mouth behind the knight. The pit, drawbridge, tree-tower, gateposts and staves are
    gone (the drafted hollow tree removed).
  - Also: the Ring of Oaks' oaks set less evenly; home trees' doors turned toward the camera.
  - Checks: `hold` rewritten (the thorns stop a walk; up the spire's vines, the heart; through the
    gully; the garrison; the arena's thorns shut behind; all kept after a reload); `wood` crosses to the
    Heart Oak's island; `stag` clears the stag's keepers first; `warden` starts inside the new arena.
    Reach and spawns clean. Frame rate: desktop over 60 everywhere (up to 702k triangles at the village),
    phone mode 102-184 draw calls, 257k-444k triangles (as before the rework). Screenshots:
    `shots/g19-*.png` (village), `shots/g19z-*.png` (zones), `shots/g19h-*.png` (stag, hold).
