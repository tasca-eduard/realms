# The realms

The prototype's eight realms, the three built so far with a page each, and what holds across them: the pause menu's map, the journal, the mist and saving.

| # | Realm | Id | In one line | Page |
| --- | --- | --- | --- | --- |
| 1 | The Moonlit Keep | `castle` | A moonlit countryside: free a captive, lower the keep's drawbridge, dethrone the Goblin King | [1-moonlit-keep.md](1-moonlit-keep.md) |
| 2 | Whisperwood | `forest` | A village of home trees round a lake, reached along the thorn road: free the Thornstag, tear out the Thorn Heart, face the Thorn Warden | [2-whisperwood.md](2-whisperwood.md) |
| 3 | The Sunken Reef | `aqua` | A drowned coast below Whisperwood's sea cliff: win a diving suit, free the Tide Serpent, wake the Tidelord in the Drowned Palace | [3-sunken-reef.md](3-sunken-reef.md) |
| 4 | The Scorched Dunes | `desert` | Nothing built yet: a buried king woken beneath the dunes, across the Dune Strait that only the serpent can swim | A draft plan [on the board](../../board/README.md) |
| 5-8 | Frostpeak, The Molten Core, Stormspire, The Void | `ice`, `lava`, `storm`, `void` | The prototype's last four realms: not planned yet | none yet |

How the realms compare and how one is built: [what they share, what each brings](../design/common-and-unique.md), [realm scores](../design/realm-scores.md), [difficulty and how it scales](../design/difficulty.md), [notes for later realms](../design/later-realms.md), [how to build a realm](../design/realm-building.md).

## The map, the journal and saving

The **pause menu** has a map of the eight realms (the prototype's): the realms you have been to
show their land, whether their tyrant has fallen, Moon Shards and chests found, and a click on
one travels there; the next realm is a rumour, the rest unknown. Below it, the **journal**
lists your quests; the current step of the main quest shows at the top right.

Unexplored land stays under mist (fog of war) until you walk near it.

**Saving.** Progress saves on this device (browser storage) whenever something changes
and when you close or switch away from the tab. What the knight carries (coins, flasks, sword,
relics) goes with him from realm to realm; each realm keeps its own last moonfire, chests
opened, walls broken, shards, quests, explored land, and which placed foes you have defeated:
**a cleared area stays cleared**. Saves from before realm 2 (version 1) load with everything kept.
Foes that were only wounded heal and go back to their posts when you fall. **New journey**
on the title screen starts over.

See also: [Controls](../play/controls.md), [Foes and effects](../play/foes.md), [the board](../../board/README.md), [the docs index](../README.md).
