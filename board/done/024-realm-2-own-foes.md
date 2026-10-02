---
id: 024
title: Realm 2's own foes
realm: 2
area: foes
status: done
group: 24
plan: follow-up
created: 2026-10-01
done: 2026-10-01
owner: lead
depends: []
links: [../plans/follow-up.md]
---

# 024 Realm 2's own foes

Whisperwood's own foes (not recoloured goblins), the prototype's ambush, an elite.

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## Done 2026-10-01: what was built and checked

- [x] **24 Realm 2's own foes.** Done 2026-10-01: goblins with bark masks, crowns of leaves and twigs and
  thorned clubs, shield goblins with bark shields set with thorns, moss-grown archers with crowns of branches
  and branch bows (`woodGoblin`, `FOE_LOOK` in `src/game/models.ts`); the thieves outside the Bat Roost are
  rooks (the Roost keeps bats: `plain` on a spawn); the Mossfen's darter is a spitter in the reeds, the Kilns'
  firepot thrower a snarer; the prototype's ambush: three goblins hidden in bushes by the Old Grove's road (a
  'lurk' state: unseen, can't be struck, don't block, don't stop a rest) burst out as the knight passes
  (tests/ambush.js); an elite shield goblin at the end of the Thorn Ravine. Rechecked: foes2, oaks, the Hold,
  sister, folk, corners, hidden places, both economies, explore mode, spawns, reach. Foes went from about 75%
  common to about 41% (REALMS.md).
