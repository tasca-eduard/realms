---
id: 074
title: Go through the "left as known" notes in done tasks
realm: all
area: review
status: done
priority: low
created: 2026-10-02
done: 2026-10-02
owner: the lead
depends: []
links: [../done/021-fixes-from-the-comparison.md, ../done/030-the-way-down.md, ../done/031-sunken-reef-land.md, ../done/032-reef-foes-and-hazards.md, ../done/033-the-tide-serpent.md, ../done/054-north-west-made-natural.md, ../done/062-review-balance-flaws.md]
---

# 074 Go through the "left as known" notes in done tasks

Several done records end with things left as they were. None had a task of its own on the old board. Decide for each: fix it (a new task), keep it on purpose (say why, in the record), or note that a later group already did it.

## The notes (word for word from the records)

- [021](../done/021-fixes-from-the-comparison.md): "The Rookfall bridge can be walked round at the gorge's north end (28 m
  against 13): left as it is, it's how you find the Rookery's chest and lore." (kept on purpose)
- [030](../done/030-the-way-down.md): "Wind Boots (a 20 s power-up) give a second jump about as high as the stag's and could
  cross the rockfall while they last, as with the Warden's roots; the blocks still read a little boxy."
- [031](../done/031-sunken-reef-land.md): "under the deep tint the wreck's hull reads faintly (it reads from its deck, sheer,
  cabin and mast); the kelp stands on floor 2.7 m down, shallower than meant."
- [032](../done/032-reef-foes-and-hazards.md): "Left for 36: the pearls in the economy, the eel's two baits, the crab's maim
  chance." (group 36 balanced the economy; check whether the other two were done)
- [033](../done/033-the-tide-serpent.md): "Left: the whirlpool skips bosses; where it waits isn't saved." (the realm 4 plan
  saves where the wyrm waits and notes "realm 3's serpent's wasn't")
- [054](../done/054-north-west-made-natural.md): "in the Keep the stag can hop the border hills round the thorn hedge to the
  thorn road (harmless ...)."
- [062](../done/062-review-balance-flaws.md): "the Goblin King left as it is (29 s, 6 hearts for the bot at level 2: short for
  a tyrant, but realm 1 was called done); Hollowbough is the heaviest place to draw."

## Checks

Each note's outcome written into this task; fixes become their own tasks with their own checks.

## Done 2026-10-02

Each note, checked against the code and later records:
- **021, the Rookfall bridge walked round**: kept on purpose (the way to the Rookery's chest and lore).
- **030, Wind Boots over the rockfall**: kept on purpose. A 20 s power-up that lets a knight cross early, as with the
  Warden's roots, rewards finding it; the stag's leap is still the way. The boxy blocks: a look note for realm 2's
  next review, no task.
- **031, the wreck's hull faint under the deep tint; kelp on a floor 2.7 m down**: the tint is realm 3's own since
  group 36 (a turquoise night, a teal sea), so the hull's look is not the one noted; not rechecked. No task: the
  next realm 3 look pass takes it up.
- **032, the pearls, the eel's two baits, the crab's maim chance**: the pearls are in the economy since group 36
  (economy3 counts the clams' 72 on top). The crab's maim chance is 0.35 (`src/config.ts`; the archer's 0.3): in line.
  The eel's "two baits" are not described in the record or the code's comments; left to the next balance playtest
  ([073](../backlog/073-difficulty-and-economy-playtest.md)).
- **033, the whirlpool skips bosses**: kept on purpose (a vortex dragging a tyrant or a mini-boss about would make
  the fights trivial). **Where the serpent waits isn't saved**: a new task, [080](../done/080-serpent-waiting-place-saved.md).
- **054, the stag hops the Keep's border hills round the thorn hedge**: kept (harmless: it lands on the thorn road,
  which is the way on anyway).
- **062, the Goblin King's short fight**: kept (realm 1 was called done; 29 s and 6 hearts for a level-2 bot).
  **Hollowbough the heaviest place to draw**: no task; group 36's performance pass cut draws in every realm, and the
  next performance pass starts there.
