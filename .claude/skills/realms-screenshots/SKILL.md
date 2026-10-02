---
name: realms-screenshots
description: How to take and judge screenshots of the Eight Realms game (F:\dev\realms) from the game camera - before/after pairs for a change to how a place looks, zoomed out or close up, under the sea, wide in explore mode, at dawn, at phone sizes. Use whenever a change affects what the player sees (land, props, models, light, water, the HUD), when the user asks to see a place, or to prove a visual change is plainly visible.
---

# Screenshots from the game camera

The user's rule: a change to how a place looks must be **plainly visible from the game camera**, and it is proven
with before and after shots. If the after shot doesn't read as different at a glance, the change isn't done: go
further (new shapes, a new layout, things removed or moved), not a tweak of numbers.

## Steps

1. **Find the spot.** Places and their coordinates are in the realm's file (`src/world/realm1.ts`, `realm2.ts`,
   `realm3.ts` and their parts: named constants such as `VILLAGE`, and `debugSpots`), or read them off the overhead
   map (`/map <realm>`, or `tools/mapview.js`; its edge numbers are map coordinates). `&at=x,z` puts the knight
   there and the camera on him. The camera looks down from the +x+z side (the south-east): anything tall on that
   side of a place hides it.
2. **Take the before shots before you change anything**, with the exact query, size, wait and script you will use
   after; several per change: the place itself, the way in, and a wider view. If the change is already made, take
   them in a work copy of the committed version (`docs/workflow/parallel-work.md`). Name them
   `shots/<topic>-<spot>-before.png` and `-after.png` (`shots/` is git-ignored; a copy uses `shots-<id>/`).
3. **Shoot** on a temporary server (a free port above 5180; 5173 and 5174 belong to another app, 5175 is the
   lead's), several shots in one start:

   ```
   bash tools/withserver.sh . 5190 bash -c '
     node tools/shot.mjs "shot&play&realm=aqua&at=37,66&god" shots/village-green-before.png 3000 1280x720
     node tools/shot.mjs "shot&play&realm=aqua&at=44,60&god" shots/village-jetty-before.png 3000 1280x720 shots/wide.js'
   ```

   `&god` keeps foes from killing the knight mid-shot. Wait 3000 ms: lamps fade in and the fog of war opens round
   him. Any `[pageerror]`, `[script error]` or `[shot] __ready never set` means the shot can't be trusted.
4. **Views**, each a small page script saved in `shots/` and passed as the last argument:
   - More of the scene: `window.__game.cam.zoom = 0.7;` (1 is the game's view). A close-up: `1.6`, or `&lines=200`
     in the query (a finer pixel grid).
   - Wide, the whole area clear: explore mode, which also lifts the fog of war (in a fresh save everything the
     knight hasn't seen is misty):
     `const g = window.__game; g.settings.fly = true; g.applyFlying(); g.cam.zoom = 0.4;` (0.3 is the furthest
     the wheel goes).
   - Under the sea (realm 3): the diving suit and god mode, at a spot over deep water; wait 4000 ms for him to sink:
     `const g = window.__game, p = g.player; g.save.data.flags.costume = true; p.dives = true; g.godMode = true;`
   - Dawn, the light after the tyrant falls: `&dawn` in the query.
   - Phones: put `env MOBILE=1` before `node` (touch, the touch controls showing, a phone's lighter settings: fewer
     lights, smaller shadows, less grass, a coarser pixel grid) and use a phone's size held sideways: `844x390`
     (the suite's), also `740x360` and `915x412`. Upright, `390x844`, shows what a phone held upright gets
     (`tests/portrait.js`).
5. **Look at every PNG** (Read it). Judge the pair side by side:
   - Does the after read as different at a glance from the game camera? If not, go further.
   - Is the place seen: nothing tall between it and the camera (+x+z side), foes the knight sees outlined?
   - The design rules (`docs/design/design-rules.md`): zones that read as zones, nothing sprinkled evenly or in a
     grid, no identical clumps, villages with room, cliff edges dressed in stretches.
   - Faults: black squares (a broken normal: run the realm's `normals` check), things floating or sunk into the
     ground, stretched or missing textures, light that pops, on a phone the HUD, prompts and buttons overlapping.
6. **Report** the pairs by path, one line each on what changed and where (coordinates). Offer the shots as proof in
   the task's Done entry on the board.
