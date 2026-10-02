# Project layout

Where the code lives: a line for each folder and main file under `src/`, and the tools and tests beside it.

```
src/
  config.ts  every tuning number: the knight, the foes, the status effects
  engine/    renderer (low-res pixel pipeline, outlines, bloom, fog, fog of war),
             camera, input, lights, particles, materials, character rigs
  world/     map grid and collision, terrain and water meshes, grass, props,
             realm.ts (what every realm's map provides, shared layout helpers),
             realm1.ts (the Moonlit Keep: its map, people, foes and objects),
             realm2.ts (Whisperwood), realm3.ts (the Sunken Reef; its parts in sea.ts,
             reef.ts, reeflife.ts, kingdom.ts, lighthouse.ts, seacaves.ts, seastair.ts...),
             outskirts.ts (realm 1's land beyond the map edges)
  game/      game.ts (states, camera, events, boss, saving), realms.ts (the realms: map,
             outskirts, story, quests, light), story/ (each realm's story moments: levers,
             cages, cleared groups, special talks, the tyrant), player.ts (the knight's
             moveset and riding), enemies.ts (AI), models.ts (3D characters and their
             animations; each realm's dress for the shared foes, such as the reef's crew),
             objects.ts (chests, moonfires, doors, the cave wall...),
             combat.ts (arrows, waves, pickups, power-ups), mount.ts (the warhorse),
             wares.ts (what village folk sell besides flasks and the sword),
             trial.ts (the Seven Stones), hazards.ts (arrow slits, chandeliers),
             critters.ts (chickens, rabbits), quests.ts, save.ts, fow.ts (fog of war),
             reach.ts (the reachability check); the Sunken Reef's own: seafoes.ts and
             seamodels.ts (its foes), serpent.ts, palace.ts, tidelord.ts, inkarm.ts,
             sealife.ts and shorelife.ts (its harmless life)
  audio/     sound effects and ambience (synthesized), generative music
  ui/        HUD, dialog, menus, touch controls
public/audio/samples/   instrument samples used by the music
tools/       shot.mjs (headless screenshots), test-all.mjs (runs every check),
             mapview.js (the overhead map), emptymap.js (where nothing happens),
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
art), `tidelordModel.ts`, and `story/`'s parts of the Sunken Reef (`reef.ts`, `reeflife.ts`, `errands.ts`,
`seacaves.ts`, `lighthouse.ts`, `grotto.ts`); `ui/` also holds `worldmap.ts` and `style.css`. `mount.ts` is the
Thornstag's too.

See also: [Architecture](architecture.md) (how the parts work together), [Code and writing style](style.md), [Testing shortcuts](../testing/shortcuts.md), [the docs index](../README.md).
