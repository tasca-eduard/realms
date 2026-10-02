---
description: Screenshot a realm from the game camera at a spot, optionally zoomed, under the sea or at phone size, and look at it
argument-hint: "<realm> [x,z] [zoom=0.7] [under] [phone] [name=...]  e.g. aqua 37,66 zoom=0.7"
allowed-tools: Bash(bash tools/withserver.sh:*), Bash(curl:*), Write(shots/**), Read
---

Take a screenshot of the game: `$ARGUMENTS`. The full guide is the `realms-screenshots` skill
(`.claude/skills/realms-screenshots/SKILL.md`); this is the short form.

1. Read the arguments:
   - realm: `castle` (or 1, keep), `forest` (2, whisperwood), `aqua` (3, reef). Default `castle`.
   - `x,z`: the map spot (`&at=x,z`); none means the realm's start. Places and their coordinates are in the realm's
     file (`src/world/realm1.ts`, `realm2.ts`, `realm3.ts`: constants and `debugSpots`).
   - `zoom=<n>`: the camera's zoom (1 the game's view, 0.7 more of it, 1.6 a close-up).
   - `under`: under the sea (realm 3): the diving suit on and god mode, so he sinks to the floor at the spot.
   - `phone`: a phone held sideways (`MOBILE=1`, 844x390, the touch controls showing).
   - `name=<file>`: the file name in `shots/` (default `shot-<realm>-<x>-<z>.png`).
2. Query: `shot&play&realm=<realm>[&at=x,z]&god`. If there's a zoom or `under`, write a page script to `shots/cam.js`:
   ```js
   const g = window.__game, p = g.player;
   g.cam.zoom = 0.7;                                                        // zoom=<n>
   g.save.data.flags.costume = true; p.dives = true; g.godMode = true;      // under
   ```
3. Run (pick a free port above 5180; never 5173-5175):
   `bash tools/withserver.sh . 5190 node tools/shot.mjs "<query>" shots/<name> 3000 <1280x720 or 844x390> [shots/cam.js]`
   with `MOBILE=1` in front of `node` for a phone (`... 5190 env MOBILE=1 node tools/shot.mjs ...`). Use a wait of
   4000 for `under` (he has to sink).
4. Any `[pageerror]`, `[script error]` or `[shot] __ready never set` in the output: report it, the shot is not to be
   trusted.
5. Read the PNG and say plainly what it shows: the place, what stands out, anything wrong (black squares, things
   floating or sunk into the ground, a tall thing hiding the place from the camera, which looks from the +x+z side).
