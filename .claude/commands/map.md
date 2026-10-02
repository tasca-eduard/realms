---
description: Draw a realm's overhead map (or part of it, or where nothing happens) and read it
argument-hint: "<realm> [x0,z0,x1,z1] [empty]  e.g. aqua 25,55,60,80"
allowed-tools: Bash(bash tools/withserver.sh:*), Bash(curl:*), Read
---

Draw the overhead map: `$ARGUMENTS`.

1. Realm: `castle` (or 1), `forest` (2), `aqua` (3); default `castle`. A crop `x0,z0,x1,z1` adds
   `&crop=x0,z0,x1,z1` to the query (only that part, bigger). `empty` uses `tools/emptymap.js` (distance to the
   nearest thing with a purpose) instead of `tools/mapview.js`.
2. Run (a free port above 5180; never 5173-5175):
   `bash tools/withserver.sh . 5190 node tools/shot.mjs "shot&play&realm=<realm>[&crop=...]" shots/map-<realm>.png 1500 1280x1280 tools/mapview.js`
3. Read the PNG. The legend (`tools/mapview.js`): ground by type, shaded by height; water light blue shallow, dark
   blue deep; decks brown; black a drop out of the world; trees and rocks dark green dots, box colliders brown;
   moonfires blue, chests gold, shards cyan, people white, foes red, snares orange, vines green lines, lore stones
   and signs violet; the edge numbers are map coordinates. For `empty`: green near something, red far; the report
   lists the empty patches over 13 m, biggest first, numbered on the map.
4. Say what it shows against the user's design rules (`docs/design/design-rules.md`): zones that read as zones,
   nothing sprinkled evenly or on a grid, no empty stretch without a reason, villages with room, paths linking
   places with a purpose. Give coordinates for anything worth fixing.
