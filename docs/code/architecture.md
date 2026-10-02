# Architecture

How the code fits together: what each folder does, the types and functions to look at first, how a realm is put
together when it loads, and what happens every frame. The plain list of files is [layout.md](layout.md); how the code is
written is [style.md](style.md); how to run and check it is [CLAUDE.md](../../CLAUDE.md).

Units: one grid cell is one metre; `y` is up; the camera looks down from the +x+z side (the "near" side, where
nothing tall should stand). Every tuning number is in `src/config.ts` (`PLAYER`, `FOES`, `EFFECTS`, `HAZARDS`,
`AIR`, `VIEW`).

## How a realm loads

Everything happens in the `Game` constructor (`src/game/game.ts`) and `Game.start()`; a border crossing reloads the
page, so a page only ever holds one realm.

1. **Which realm.** `Save.load()` reads `localStorage['realms-save']`. The realm is the save's, or `?realm=<id>`, or
   the far side of a border just crossed (a travel card in `sessionStorage['realms-travel']`). `REALMS[id]`
   (`src/game/realms.ts`) is its `RealmDef`: size, map builder, outskirts, story, quests, night and dawn light,
   birds, bubbles, muffle, physics, `noFire`.
2. **The map.** A `Grid` (`src/world/grid.ts`) covers the realm plus 26 cells of outskirts on every side. A `Builder`
   (`src/world/builder.ts`) is handed to `def.build(builder)` (`buildRealm1/2/3`), which paints the grid (heights,
   ground types, water, decks), places props (geometry into the builder's chunks, colliders into the grid) and returns
   a `RealmData` (`src/world/realm.ts`): start, borders, enemy spawns, people, objects, regions, the sea, the trial,
   the arena, `foeHp` and the rest.
3. **The outskirts.** `def.paintOutskirts`, then `realm.afterOutskirts`, then `def.decorateOutskirts`: the land past
   the map edge is real terrain that ends in something you can see (cliffs, a gorge, a river, the open sea).
4. **Meshes.** `builder.finish(scene)` merges each chunk's geometry into meshes; `buildTerrain` and `buildWater`
   (`src/world/terrain.ts`) and `buildGrass` (`src/world/grass.ts`) add the ground, water and grass. The moon
   (a shadow-casting directional light) and a hemisphere light are added.
5. **Things.** `Combat` and `Player` are made; the player gets the land or sea `Physics`. Each `ObjDef` in
   `realm.objects` becomes its class (`Moonfire`, `Chest`, `LoreStone`, `Sign`, `Lever`, `Drawbridge`, `Cage`,
   `ThornGate`, `HallDoor`, `Breakable`, `Windmill`, `Shard`, `CrackedWall`, `Bindings`, `ThornHedge`), most of them
   also in `g.interactables`. Then arrow slits, chandeliers, snare traps, thorn bursts, giant clams, the trial,
   critters, the warhorse (`Mount`) and the people (`Npc`). `spawnEnemies()` makes an `Enemy` for each spawn not
   retired (`off`), not killed in the save, and allowed by `story.spawns()`.
6. **The save applied.** `Game.start()` calls `applySave()`: explored land, what the knight carries, shards taken,
   walls broken, chests opened, moonfires lit, the Thornstag if freed, then **`story.apply(g)`**, which restores the
   realm's own state from `save.data.flags` and builds what only that realm has (the Sunken Reef's serpent pen, sea
   life, palace bell and floodgate, the diving suit lying where Brassbelly fell). Foes are spawned again after it.
7. **Into the world.** `enterWorld()` puts the knight at the border he came through, his last lit moonfire, or the
   realm's start. `?play` goes straight there; otherwise the title screen waits.

`Game.travel(border)` saves, records where to come out (`Save.travel`), sets the travel card and reloads.

## Every frame

`Game.frame(now)`: input polled (`Input.pollPad`), menus handled, timers run (they wait while paused), then
`updateWorld(dt, real)`:

- the mouse ray onto the knight's ground plane (aim);
- `player.update` (moves, fights, rides, swims, breathes), every `enemy.update`, `combat.update` (arrows, pots, fires,
  waves, pickups);
- `checkInteract` (the nearest `Interactable`'s prompt), `checkRegion` (area titles, music, `story.onRegion`),
  `checkBossTrigger`;
- people, mounts, bindings, shards, critters, hazards, clams, the trial, chests, lever, drawbridge, doors;
- alerts and sword swooshes, sea particles (specks, currents, helmet bubbles), fireflies, leaves, motes;
- particles and the light pool updated round the camera, structures faded where they hide the knight,
  the camera, small shadows, **audio** (ambience by region, music by region, the inn's tune, a mini-boss's fight
  music), **dawn** (the realm's night and dawn light blended into the moon, the hemisphere and the pipeline's
  atmosphere, sea look included);
- fog of war revealed round the knight, the HUD, the air bubbles, the breathless tunnel, the muffle under water;
- `story.tick(g, dt)` and `checkBorders()` while playing.

Then `ui.update`, `screens.update`, and `pipe.render(scene, camera)`.

Reading, talking and cutscenes freeze the world (`g.worldFrozen`: foes, arrows and effects get `dt = 0`); hitstop and
slow motion scale `dt`; pause sets it to 0.

## src/engine: drawing and input

- `pipeline.ts`, **`Pipeline`**: renders the scene into a small target (the pixel buffer, about `VIEW.targetLines`
  high), then bloom, then one atmosphere pass at that resolution: outlines from depth steps, cloud shadows, ground
  mist, depth fog, fog of war, and under the sea's surface the **sea look** (light rippling over everything, darker
  and bluer with depth, shafts of light from the surface), then grading (exposure, saturation, lift and gain,
  warmth, flash, desaturation, the breathless tunnel). Last, a nearest-filtered blit with a sub-pixel offset so the
  camera moves smoothly while pixels stay on the grid. Its inputs are the `Atmosphere` fields in `pipe.atmo`, set each
  frame by `Game.updateDawn` from the realm's `Light`.
- `camera.ts`, **`IsoCamera`**: orthographic, 30° elevation, 45° yaw, snapped to the pixel grid; `focus`, `zoom`
  (explore mode zooms out), shake, `toScreen`.
- `input.ts`, **`Input`**: one binding per action (`Action`: attack, guard, jump, special, interact, pause, heal);
  keyboard and mouse, the phone's touch controls (`src/ui/touch.ts` feeds it) and a gamepad (`pollPad`) all feed
  the same actions; `label(action)` names the key for prompts (keyboard layouts read with `loadKeyLayout`).
- `lights.ts`, **`LightPool`**: a fixed number of point lights (16, 10 on phones) given each frame to the nearest
  `LightSource`s; a lamp joining or leaving fades, never pops (checked by `tests/lights.js`).
- `particles.ts`, **`Particles`** and the presets **`P`** (flame, spark, dust, leaf, splash, seaBubble, stream,
  seaSnow...): two point pools (glowing and soft), `emit`, `burst`, emitters.
- `geo.ts`, **`Geo`**: collects flat-shaded triangles with a colour, a pattern kind and a wind weight under a
  transform stack: `box`, `cyl`, `blob`, `beam`, `gable`, `pyramid`, and `sweep` (tapering tubes: all living wood).
- `rig.ts`, **`Rig`**: a character as rigid parts on joints, merged into one skinned mesh (plus glow and a
  see-through silhouette, the red outline of foes hidden behind things); `face`, `place`, hit flash, tint.
- `materials.ts`: the uniforms every world material shares (`shared`: time, the knight's position, wind, the
  see-through circle round him), pattern ids **`K`**, `worldMaterial`, `glowMaterial`, `grassMaterial`.
- `sprites.ts` (pixel textures, `SpriteActor` for coins, hearts and alert marks), `util.ts` (`mulberry32` seeded
  random, `hash2`, `valueNoise`, `fbm`, `clamp`, `lerp`, `damp`, `smoothstep`).

## src/world: the land

- `grid.ts`, **`Grid`**: per cell `h` (height), `t` (ground type, `T`), `rise`/`dir` (ramps), `water` (surface
  height or `NONE`), `deck` (a walkable bridge, boardwalk or jetty over the cell), `side` (cliff style), `noGrass`,
  plus colliders (`Collider`: circle `'c'` or box `'b'`, with a height range and an `on` switch) in buckets.
  `groundAt`, `typeAt`, `waterAt`, `isDeep` (deeper than `DEEP` = 0.55 m), `cellTop`, `move(body, dx, dz, stepUp)`,
  `lineClear`. A **`Body`** may set `dives` (walks into deep water and along the bottom: the knight in the suit,
  goblin divers) or `aquatic` (never leaves deep water: the sea's creatures).
- `terrain.ts`: `buildTerrain` (chunked ground tops coloured by type, cliff sides) and `buildWater` (`clear` for the
  Reef's sea: a thin bright skin you see the floor through).
- `builder.ts`, **`Builder`**: geometry per chunk (`g` casts shadows, `d` small clutter without, `gl` glow),
  `structure()` (buildings that fade when they hide the knight; their shell goes when he walks inside), light
  sources, fires, and the shared props (`pine`, `oak`, `bush`, `rock`, `reeds`, `fence`, `lamp`, `torch`,
  `brazier`, `tent`, `wall`, `roundTower`...). `PAL` and `GLOW` are the shared colours.
- `paint.ts`: `Painter` (a pass over every cell), `insidePoly`, `distLine`, `sdPoly`: how realms shape their land.
- `realm.ts`: the types a realm's map provides (`RealmData`, `EnemySpawn`, `NpcDef`, `ObjDef`, `RegionDef`,
  `BorderDef`, `TrialDef`), `RealmId`, `EnemyType`, and shared layout helpers (`MapKit.room/flatAround/clearOf`,
  `forest`, `dressRealm`, `waterPoints`).
- **Realm 1**: `realm1.ts` (the map, the keep, tavern, hollow, crypt, winch hut; people, foes, objects),
  `details.ts` (its props: graves, fences, stalls, the chapel, crops, camp gear), `outskirts.ts` (its land beyond the
  edges: mountains, the gorge, the Mirrow river and its broken bridge).
- **Realm 2**: `realm2.ts` (zones, the Heartpool village, the gorge, the hold; its outskirts), `wood.ts` (living
  wood: `trunkUp`, `rootFrom`, `bough`, `greatTree`, `homeTree`, `giantOak`, `bramble`, `thicket`, `ropeBridge`).
- **Realm 3**: `realm3.ts` (the land and sea floor, the strand, the sandbar, the isles, the trench and abyss, vents,
  currents and bubble columns, the palace (`buildPalace`, `HALL`, `FLOODGATE`, `BELL`), Stairfoot Cove, its
  outskirts) calls its parts in turn, each `build<Part>(b, grid, under)` returning `{ enemies, objects, npcs,
  regions, ... }`: `reef.ts` (the coral village's people, the shrine, the Whalebone Isle trial, Gull Rock),
  `reeflife.ts` (the village's night: the Harbour Arms, market, boatyard, fishers, children), `errands.ts` (the
  bottle, the dig, the shrimp, the race rings, the raid), `seacaves.ts` (Jetsam's cave, the Glowing Grotto, the
  blowhole), `kingdom.ts` (the drowned kingdom's set pieces), `lighthouse.ts` (the tower, its stair, Wick's oil and
  lens, the boats), `inkgrotto.ts` (Old Inkarm's lair), `shorelife.ts` (perches and seal skerries), `seabed.ts`
  (floor life in clumps). `sea.ts` holds the sea's props (coral, kelp, vents, columns, the wreck, stilt houses,
  boardwalks, driftwood, tents, the longboat).
- `seastair.ts`: the Sea Stair at both ends (Whisperwood's rockfall and flights; the Reef's stair down the cliff),
  the two `BorderDef`s.

## src/game: the rules

- `game.ts`, **`Game`**: state (`loading`, `title`, `story`, `play`, `dead`, `victory`), the realm load above, the
  frame loop, and the events everything else calls: `enemyHitsPlayer`, `arrowHitsPlayer`, `onEnemyDeath`,
  `openChest`, `rest`, `talkTo` (shops and wares too), `quest(id, step)`, `writeSave`, `travel`, `startBoss`,
  `bossSummon`, `setDawn`, `focus` (cutscene), `after(t, fn)` (timers), `firstTime(key)` (tips once per device).
  Tests reach it as `window.__game`.
- `realms.ts`: **`RealmDef`**, **`Light`** (a realm's night and dawn, with `sea` for the underwater look) and the
  **`REALMS`** registry.
- `player.ts`, **`Player`**: the moveset (combo, charge and spin, down-stab, roll, block, parry, air dash, the
  three specials, jump, flask), status effects (`afflict`, `Effect`), power-ups, riding (`updateRiding`; the serpent
  hands off to `TideSerpent.swim`), vines (`climb`), explore-mode flight, and the sea: `phys` switches between
  `g.landPhys` and `g.seaPhys` when his head goes under, `dives` lets him walk into deep water (the suit),
  `breathe` runs his air (`air`, `airMax` with the air bladders, `breathless`), `seaFlow` lets currents and bubble
  columns carry him. `strike` lands blows (and offers them to `story.struck`), `hurt` takes them.
- `enemies.ts`, **`Enemy`**: one class for every foe. Health is its kind's (`FOES`) times the realm's `foeHp`
  (tyrants tuned alone). `update` picks the behaviour by type: `meleeUpdate` (goblins, shield goblins, brutes,
  Brassbelly with his steam vent), `archerUpdate` (archers, firepot throwers, darters, snarers), `shamanUpdate`,
  `batUpdate`, `boarUpdate`, `spitterUpdate`, `wardenUpdate`, `bossUpdate` (the Goblin King), and hands the
  Reef's to their modules: **`seafoes.ts`** (`SeaFoe`: divers, harpooners, jellies, crabs, eels, pufferfish;
  `GiantClam`), **`inkarm.ts`** (`Inkarm`, Old Inkarm's arms, grab and ink), **`tidelord.ts`** (`tidelordUpdate`,
  his charge, orbs, slam, sweep and the turning tide; `tideHall` holds what he has loosed), with models in `seamodels.ts` and
  `tidelordModel.ts`. Brassbelly the salvager is an `Enemy` of type `salvager` (`makeSalvager` in `models.ts`).
- `models.ts`: every character as a `Model` (a `Rig` plus its animations): the knight, goblin kinds, beasts,
  bosses, villagers (looks in `assets.ts` `LOOKS`), and `setFoePalette(realm)` (each realm's dress for the shared
  foes; the only place code branches on a realm's id).
- `combat.ts`, **`Combat`**: what flies or lies about: arrows (and darts, seeds, bolas), firepots and their fires,
  shockwaves, sword waves, pickups (coins, hearts), power orbs, aim lines and the Warden's volley lines.
- `mount.ts`, **`Mount`** (the warhorse, the Thornstag: grazes, comes when called, its own hits, barding) and
  `serpent.ts` (**`TideSerpent`** extends it: swims, leaps, strokes, bubble shot, shell, whirlpool, `landing`;
  **`SerpentPen`**, the nets that hold it; `nearestSea`).
- `objects.ts`: the **`Interactable`** interface (`prompt`, `interact`) and the objects: `Moonfire`, `Chest`,
  `LoreStone`, `Sign`, `Lever`, `Drawbridge`, `ThornGate`, `Cage`, `HallDoor`, `Shard`, `CrackedWall`, `ThornHedge`,
  `Bindings`, `Breakable`, `Windmill`, `Npc` (talks, walks rounds, sits, works), `DiveSuit`. `palace.ts`:
  `SunkenBell`, `Floodgate`, `DawnShafts`. `trial.ts`: `Trial` (a realm's three-wave relic trial).
- `hazards.ts`: `ArrowSlit`, `Chandelier` (the keep), `SnareTrap`, `ThornBurst`, `WardenMark` (Whisperwood).
- `critters.ts` (land animals), `sealife.ts` (`SeaLife`: fish, rays, turtles, octopuses, plankton, as instanced
  meshes) and `shorelife.ts` (`ShoreLife`: gulls, seals, surf, boats): harmless life, only moving near the camera.
- `fow.ts`: `FogOfWar`, the explored-land texture the pipeline draws mist over.
- **Story** (`story/`): **`RealmStory`** (`story/story.ts`) is what a realm decides that the generic game does not:
  `apply` (restore from the save), `spawns`, `onKill`, `onRegion`, `areaSub`, `talk`, `victoryLine`, `onLever`,
  `onBreak`, `struck`, `onCageOpen`, `onBossDeath`, `arenaOpen`, `tick`, plus the title, intro, victory text and
  `BossInfo`. Realm 1 is `castle.ts` (`CastleStory`), realm 2 `forest.ts` (`ForestStory`), realm 3 `aqua.ts`
  (`AquaStory`, which holds its parts and hands each hook on to them: `reef.ts` `ReefFolk`, `reeflife.ts`
  `ReefLife`, `errands.ts` `ReefErrands`, `seacaves.ts` `SeaCaves`, `lighthouse.ts` `DarkLamp`, `grotto.ts`
  `InkGrotto`). Story state lives in `save.data.flags`.
- `quests.ts`: **`QUESTS`** per realm (`QuestDef`: steps, short lines for the objective; every realm's main quest is
  `main`), `QuestBook`. Progress is a step index in `save.data.quests`.
- `save.ts`, **`Save`** (version 2): **`Carried`** goes with the knight (coins, flask count, sword level, relics,
  mounts, kit, deaths, play time, kills); each realm keeps its own **`Place`** (checkpoint, chests, lit, read,
  walls, shards, quests, killed spawn indexes, explored land, flags). `save.data` is the working view (`Carried &
  Place`) for the current realm; `select`, `write`, `travel`, `place(id)`, `shardSets`; `migrateV1` loads realm-1-only
  saves with nothing lost. Other keys: `realms-settings`, `realms-tips`, `realms-new` (localStorage),
  `realms-travel` (sessionStorage).
- `wares.ts`: **`WARES`** (barding, boots, the nettle tonic, the air bladder, the lodestone): name, effect, price per
  level; an `NpcDef.wares` list says who sells what; levels in `save.data.kit` and `player.kit`.
- `reach.ts`: **`reachability(g, assumeProgress, climb, serpent)`** floods the map the way the knight moves
  (climb 1.5 m, more under water where it's deep enough, `STAG_CLIMB` 2.75 m on the stag, or on the serpent) and
  returns a `ReachReport`: what can't be reached, escapes out of the world, traps (places to be stranded). In the
  page: `window.__reach()`.

## src/ui: what's on the screen

- `ui.ts`, **`UI`**: the HUD (hearts, flasks, stamina, energy, coins, the power-up, the mount's pips, effects, air bubbles,
  combo), prompts,
  toasts, hints, area titles, speech bubbles, dialogs with options (`say`), lore pages, the boss bar and intro,
  fades. `style.css` styles all of it.
- `screens.ts`, **`Screens`**: title, story, pause menu (settings, controls, journal, travel), the travel card,
  victory.
- `touch.ts`, **`TouchControls`**: the floating stick and the buttons on phones.
- `worldmap.ts`, **`WorldMap`**: the prototype's map of eight realms in the pause menu (`ROUTE` is their order).

## src/audio: what's heard

- `audio.ts`, **`Audio`**: Web Audio buses; `sfx(name, x, z)` (synthesized effects, panned), `update(dt, AmbState)`
  (ambience beds: wind, crickets, owls, birds, water, fire, drums, and the Reef's surf, lapping, creaks, inn voices,
  drips, echo, choir, hum, bubbles), `setMuffle` (under water, paused, dying).
- `music.ts`, **`Music`**: generative music on instrument samples (`public/audio/samples/`). **`TRACKS`** are the
  moods (road, village, fields, wilds, keep, hall, boss, dawn, tavern); **`REALM_TRACKS`** holds a realm's own
  versions (`forest`, `aqua`). A region's `music` picks the mood; the inn's tune leaks into the street; a mini-boss's
  fight sets `g.fightMusic`.

## Adding to a realm, or a realm

New content goes in its own module hooked in with a few lines (the pattern in `realm3.ts` above, the story class in
`aqua.ts`). A new realm needs: an id in `RealmId` (`src/world/realm.ts`), a builder and outskirts, a `RealmDef` in
`REALMS`, quests in `QUESTS`, a `RealmStory`, its light, its music in `REALM_TRACKS`, its foes' dress in
`setFoePalette`, borders in both realms, and checks in `tools/test-all.mjs`. The steps and the rules:
[realm-building.md](../design/realm-building.md).
