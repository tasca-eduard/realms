---
id: 021
title: Fixes from the comparison
realm: 1, 2
area: world
status: done
group: 21
plan: follow-up
created: 2026-10-01
done: 2026-10-01
owner: lead
depends: []
links: [../plans/follow-up.md, ../in-progress/069-ash-home-tree-covers-nettles-glade.md]
---

# 021 Fixes from the comparison

Fix what the realm comparison found: the mist, things on the camera's line, foes' posts, the shortcut round the east loop, region names, signs, realm 1's empty ground.

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## Done 2026-10-01: what was built and checked

- [x] **21 Fixes from the comparison.** Done 2026-10-01 (each checked in the game; reach, spawns and the new
  ambush check pass in both realms):
  - Realm 2's ground mist: each realm's light now sets the mist's height (`mistLevel`, `src/game/realms.ts`);
    Whisperwood's lies 1.2 m over its 2 m floor, as the Keep's does over its fields (it showed only in Rookfall).
  - Things on the camera's line: the lodge home tree moved off the Gatherers' Clearing (to the Whisper's bank,
    without its treehouse), the inn tree off the Ring of Oaks (to the bay's south shore by the kilns lane; Bram's
    round shortened to match), a grove giant oak off the Old Owl's snag, the border pines off the brook below
    the goblins' camp. (Checked by casting rays from the camera: the clearing went from 16 of 17 points hidden
    to 1, the ring 16 to 5, the owl 17 to 2.)
  - Garrison archer #46 out of the Blackwater onto the plateau's lip (29, 24.8); spitter #23 off the cliff top
    onto the ravine's shelf (60.5, 11.8), where it fights.
  - The shortcut round the east loop: real (the Blackwater's shallows ran along the foot of the Warden's cliff,
    64 m from the village to his stair against 139 m round). The quest never stuck (a later step completes the
    earlier ones), but the realm's route and half its content were skippable: the mere is now deep right up to
    the cliff, and the quickest way passes the Thorn Ravine (128 m). The Fallen Giant stays a pathless find.
  - The Rookfall bridge can be walked round at the gorge's north end (28 m against 13): left as it is, it's
    how you find the Rookery's chest and lore.
  - Region names: Bryony's forge and the fisher's tree read Hollowbough (the Deer Meadow's name covered them);
    realm 1's drawbridge deck reads the Outer Bailey (it fell through to "The King's Road").
  - Realm 1's empty ground behind the keep's west wall (about 330 m², reachable north from the Overlook) is
    now the Kings' Orchard: old oaks gone wild, moonflowers, a lore stone, no path and no coins.
  - Signs: the Old Lodge's sign has its post; Whisperwood's two signs, which had no model at all, are standing
    stones with a pale blaze cut in them (the arrival's moved 2 m off the warhorse's spot).
  - Realm 1's stream runs on into the Mirrow (it stopped a metre short, leaving a dry way round it); the dead
    `arenaGate` object is gone; a smith never sells past the price list (a level without a price would have
    cost nothing); stale notes about the Sea Stair and the east gorge corrected in the code.
  - Left open: the Ash family's home tree's crown still covers Old Nettle's glade (12 of 17 points). Crowns fade
    when the knight walks under them; moving the tree or the glade reshuffles the village's crown shapes.
