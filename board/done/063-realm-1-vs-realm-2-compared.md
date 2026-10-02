---
id: 063
title: Realm 1 against realm 2, compared
realm: 1, 2
area: docs
status: done
created: 2026-10-01
done: 2026-10-01
owner: lead
depends: []
links: [../done/020-notes-realms-comparison.md, ../../docs/design/realm-scores.md]
---

# 063 Realm 1 against realm 2, compared

What is common and what is unique between realms 1 and 2, difficulty per realm, and how familiar realm 2 is against the 40/60 aim.

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## Done 2026-10-01: what was built and checked

- 2026-10-01: **Realm 1 vs realm 2 compared** (asked: what is common, what is unique, difficulty per realm and how
  it scales, and how familiar realm 2 is against a 40% common / 60% unique aim, "to see if we are on the right
  track", not to plan realm 3 yet). The code was read by 9 agents (3 inventories checked by a second agent),
  plus 28 screenshots. Nothing in `src/` changed. Found:
  - **About two thirds common** (estimate; same = 1, same role in a new form = ½, new = 0): map and route ~75%,
    kinds of place ~40%, terrain and look ~55%, sound ~85%, foes ~75%, stronghold and tyrant ~60%, mechanics
    ~55%, quests ~80%, village and people ~60%, rewards ~85%.
  - **New, and working:** the land (tree village round a lake, canopy and rope walk, the chasm inside the map,
    the ravine, water on 18% of the map against 7%), realm 2's own rules (snares, thorn strips, vines, rope
    bridges, the Thornstag), and the Warden, a keep-away archer where the King was a brawler.
  - **Most repeated:** foes, music, the map's frame and counts, the quest text (see Backlog).
  - **Difficulty is flat by design:** a goblin takes 3 blows on arrival in both realms (`foeHp` 1.6 against the
    level-3 sword). Realm 2 is harder in kind, not in numbers: packs (8 to 5), elites (3 to 0) and
    status-effect foes (49% to 35%) went down. Upgrades cut realm 1's work by 29% but realm 2's by 3%.
