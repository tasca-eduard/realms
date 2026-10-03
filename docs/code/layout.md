# Project layout

Where the code lives: a line for each folder and main file under `src/`, and the tools and tests beside it.

```
src/
  config.ts  every tuning number: the knight, the foes, the status effects
  engine/    renderer (low-res pixel pipeline, outlines, bloom, fog, fog of war),
             camera, input, lights, particles, materials, character rigs
  world/     map grid and collision, terrain and water meshes, grass, props,
             realm.ts (what every realm's map provides, shared layout helpers),
             water.ts (rivers, lakes and pools: soft banks, flow, white water, the
             moon path, reeds and stones), lightzones.ts (each place's light in
             realms 1 and 2: KEEP_ZONES, WOOD_ZONES),
             realm1.ts (the Moonlit Keep: its map, people, foes and objects; its parts
             keepsfoot.ts, the village's night, keepsights.ts, its set pieces, and
             moonpetals.ts),
             realm2.ts (Whisperwood; its parts hollowlife.ts, the village's day and the
             inn's room, and woodcolours.ts, leaves by zone and trees, flowers and ivy
             by hand), realm3.ts (the Sunken Reef; its parts in sea.ts,
             reef.ts, reeflife.ts, kingdom.ts, lighthouse.ts, seacaves.ts, seastair.ts...),
             outskirts.ts (realm 1's land beyond the map edges)
  game/      game.ts (states, camera, events, boss, saving), realms.ts (the realms: map,
             outskirts, story, quests, light), zonelight.ts (the places' light painted
             into two maps of the realm), story/ (each realm's story moments: levers,
             cages, cleared groups, special talks, the tyrant), player.ts (the knight's
             moveset and riding), enemies.ts (AI), models.ts (3D characters and their
             animations; each realm's dress for the shared foes, such as the reef's crew),
             objects.ts (chests, moonfires, doors, the cave wall...),
             combat.ts (arrows, waves, pickups, power-ups), mount.ts (the warhorse),
             wares.ts (what village folk sell besides flasks and the sword),
             trial.ts (the Seven Stones), hazards.ts (arrow slits, chandeliers),
             critters.ts (chickens, rabbits, owls...), quests.ts, save.ts, fow.ts (fog of war),
             reach.ts (the reachability check); wildlife.ts (harmless life for every
             realm: flocks, swimmers, herds, frogs, fish, motes, as instanced meshes),
             castlelife.ts and forestlife.ts (realm 1's and 2's creatures on it);
             the Sunken Reef's own: seafoes.ts and seamodels.ts (its foes), serpent.ts,
             palace.ts, tidelord.ts, inkarm.ts, sealife.ts (on wildlife.ts) and
             shorelife.ts (its harmless life)
  audio/     sound effects and ambience (synthesized), generative music
  ui/        HUD, dialog, menus, touch controls
public/audio/samples/   instrument samples used by the music
tools/       shot.mjs (headless screenshots), test-all.mjs (runs every check),
             mapview.js (the overhead map), emptymap.js (where nothing happens),
             look.mjs (colour measures of screenshots),
             withserver.sh (a server for one command), board.mjs (prints the board
             and the to-do list), copies/ (make a work copy, merge it back),
             extract-samples.mjs
tests/       scripts for shot.mjs that drive the game
docs/        the docs: play/, realms/, design/, code/, testing/, workflow/ (index: docs/README.md)
board/       the board: backlog/, todo/, in-progress/, blocked/, done/, plans/ (board/README.md)
.claude/     commands/, skills/, agents/ for Claude Code (CLAUDE.md at the root)
```

The parts the tree leaves out: `world/` also holds `details.ts` (realm 1's props), `wood.ts` (realm 2's living
wood), `paint.ts` (the `Painter` realms shape their land with), `grass.ts`, and realm 3's `errands.ts`,
`inkgrotto.ts`, `shorelife.ts`, `seabed.ts`; `game/` also holds `assets.ts` (villagers' looks, the pickups' pixel
art), `tidelordModel.ts`, `story/keepsfoot.ts` (realm 1's village through the night and the story: what its people
hold and do, the word as the knight passes, the feast, the north road's lanterns, dawn in the square, Gnasher's camp
at its business), `story/keepsights.ts` (realm 1's set pieces that move or change: the mill wheel, the beacon,
the Seven Stones' runes, the raided farm mended, the night fisher's boat), `story/hollowlife.ts` (Hollowbough's: the swing, the lute, the tale, the scarred trees greening,
the lanes lit), and `story/`'s parts of the Sunken Reef (`reef.ts`, `reeflife.ts`, `errands.ts`, `seacaves.ts`,
`lighthouse.ts`, `grotto.ts`); `ui/` also holds `worldmap.ts` and `style.css`. `mount.ts` is the Thornstag's too.

See also: [Architecture](architecture.md) (how the parts work together), [Code and writing style](style.md), [Testing shortcuts](../testing/shortcuts.md), [the docs index](../README.md).
