---
id: 014
title: Whisperwood's foes and hazards
realm: 2
area: foes
status: done
group: 14
plan: realm-2
created: 2026-09-28
done: 2026-09-28
owner: lead
depends: []
links: [../plans/realm-2.md]
---

# 014 Whisperwood's foes and hazards

Whisperwood's foes, the Snared effect, snare traps and the Thorn Ravine's bursting thorns.

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## In the plan

- [x] **14 Whisperwood's foes and hazards.** Done 2026-09-28 (see Done).

## Done 2026-09-28: what was built and checked

- 2026-09-28: **Group 14, Whisperwood's foes and hazards.**
  - Each realm colours its foes: in the Old Wood the goblins wear the prototype's forest greens and mossy
    cloth, the skeleton archers are moss-grown with yellow-green eyes (`setFoePalette`).
  - New foes (numbers in `config.ts`): the **Thorn Spitter** (the prototype's forest creature: rooted,
    rears back and lobs a hard seed where you're heading, snaps if you come close); the **Snarer** (a
    goblin with a bola: no damage, but you're **Snared**); the **Thornback** (a boar grown over with
    thorns: charges like the armored boar, and striking it before it's stunned pricks you, a shove and
    25 stamina; parry it or let it charge into a tree first).
  - New effect **Snared** (1.3 s): no walking, rolling, jumping or dashing, but you can swing and block; a
    flask frees you; never on horseback. HUD row and first-time tip like the others.
  - Hazards: **snare traps** glinting in the grass beside the paths (a heart and snared; a blow springs one
    safely); the **Thorn Ravine**'s three strips where thorns rustle, then burst for a moment (a heart and a
    shove, once per burst; foes caught in them are hurt too).
  - 35 placed foes: the grove, the canopy, the east woods, both ends of the Rookfall bridge, the lane,
    the gatherers' clearing, the ravine, the Overhang, the Mossfen. None by the arrival or in the village.
  - Review, found and fixed: a spitter's seed went through the arrow code and could maim like an arrow
    (now only real arrows maim); eight foes started touching trees or cliff edges (moved beside the paths).
  - Checks: new `foes2` (a spitter's seed costs hearts, a snarer's bola snares and the HUD shows it, a
    thornback pricks unstunned and not stunned, one heart per thorn burst, a trap bites and snares, a
    blow springs one), `spawns2` (54 checked, none bad); the full suite: 36 checks, all as before in
    realm 1, no errors.
