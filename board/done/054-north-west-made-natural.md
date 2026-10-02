---
id: 054
title: The north-west made natural (old group 20)
realm: 2
area: world
status: done
group: 20 (2026-09-30 numbering)
created: 2026-09-30
done: 2026-09-30
owner: lead
depends: []
links: []
---

# 054 The north-west made natural (old group 20)

The north-west of Whisperwood, round the Warden, made natural instead of planted. Numbered group 20 on 2026-09-30, before the follow-up plan reused 20 to 27.

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## Done 2026-09-30: what was built and checked

- 2026-09-30: **Group 20, the north-west made natural** (full suite: 48 reports, all read, no errors) (asked: "I don't really like the north-west, the area
  around the boss. I don't like those new bushes, they are so weird planted. Go for a more natural look
  instead of looking so man-made").
  - **What made it look planted** (overhead map, screenshots, code): dead trees and thorn domes spread evenly
    on a jittered grid, every clump the same round dome; the heights a flat table with a straight 29 m south
    edge; square patches of mud; the Great Tree's roots two straight walls round a checkerboard floor, with
    green pines growing on them; rows of bushes along every cliff lip; a row of brambles along the ravine lip;
    brambles on an even arc round the stag; the gully's rock masses 8 m boxes with checkerboard tops; the
    Thorn Heart on a square rock column.
  - **The land**: the heights' outline lobed (bays and points); mossy rises and a few crags on the plateau (no
    lone blocks); a spring among mossy stones in the Withered Wood, its stream across the heights and over
    their south cliff in a small waterfall into a deep plunge pool, then on to the Whisper; the ground in small
    natural patches (leaf litter under the groves, moss by the water, mud here and there). The rock masses by
    the gully are grassy, pine-topped knolls rising in broken steps (2.9 m over the gully at their edges),
    stone jutting from their faces and heaped at their feet.
  - **Growth** (`src/world/wood.ts`: `witheredOak`, `deadShrub`, `thornCreeper`, `thornClimb`): everything grows
    in groves and clumps with open ground between (a patch noise gates the whole wood's trees and
    undergrowth). On the heights: groves of dead trees of every size on the leaf litter, a few great withered
    oaks alone, dead shrubs, fallen trunks; thorns only where thorns take (at the feet of trees and crags, over
    the cliff lips in stretches, up the trunks near the Great Tree), creepers running out over the ground from
    it; thin patchy grass. No green pines in the Withered Wood. Cliff lips everywhere dressed in stretches with
    long bare runs; the ravine's and the stag's brambles in clumps; thorn scrub in clumps of one to three.
  - **The Great Tree**: its arena a hollow ringed by two great roots curving out from the trunk and back in,
    drawn as massive knuckled roots with moss on top and rootlets diving into the ground, their tips at the
    mouth (grown shut by thorns in the fight); roots snaking over the heights; toadstools and bones in the
    hollow. No collar block round the trunk (its own roots show).
  - **The Thorn Heart** now beats in the broken top of a great dead trunk by the stair's foot (split grey bark,
    jagged splinters, roots gripping the ground, ivy up its east side where it's climbed, thorns coiling
    round it). Quest text and README updated.
  - **Found on the way: the Thornstag could leave the world and skip the story.** Its double leap (2.3 m) plus
    the step-up at the top (0.45 m) reaches 2.75 m, but barriers were built for the knight's 1.5 m. Traced with
    the reach tool (now given a climb height and a route to any cell): in Whisperwood, up the brook's 2 m far
    bank beside the thorn road's bridge and out to the world's edge; into the Warden's hold over the lowered
    rocks and roots, or up the new stream's channel; in the Moonlit Keep, up the 2 m steps of the forest land
    beyond the north edge to the world's edge. Fixed: the brook's far bank 3 m; the gully's rocks and the
    arena's roots 2.9 m+; a deep plunge pool under the stream's channel; the Keep's northern forest land at
    least 3 m over the map's edge. Left as it is: in the Keep the stag can hop the border hills round the thorn
    hedge to the thorn road (harmless: the pause menu travels to Whisperwood anyway, and the stag is only had
    after going there). The reach tool also let jumps cross deep water, which the game never allows: fixed.
  - Checks: new `reachstag` and `reachstag2` (both realms on the stag: no escapes, no story skipped but the
    known hop); reach and spawns in both realms clean; `hold` (thorns stop a walk, up the ivy to the heart,
    through, garrison, arena) passes. Screenshots: `shots/nw4-*.png` (trunk, rocks, gully, arena outside and
    in, the falls, a grove), overhead `shots/map-nw.png` (the map tool takes `&crop=x0,z0,x1,z1` now).
