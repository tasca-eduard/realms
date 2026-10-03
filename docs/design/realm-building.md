# Building a realm

How a realm is built, end to end, the way realms 2 (Whisperwood, `forest`) and 3 (the Sunken Reef, `aqua`) were.
The record is the board: each realm's plan in [board/plans/](../../board/plans/) ([realm 2](../../board/plans/realm-2.md),
[realm 3](../../board/plans/realm-3.md), realm 2's [follow-up](../../board/plans/follow-up.md)) and each group's
Done entry, which says what was built and how it was checked. Realm 4's
[draft plan](../../board/plans/realm-4-draft.md) (the Scorched Dunes, `desert`) already follows this page; read it
as a worked example.

Read first: the [design rules](design-rules.md) (the user's rules, with an id each) and
[common and unique](common-and-unique.md) (what every realm shares). How to test is in
[testing](../testing/testing.md) and the [table of checks](../testing/checks.md); how to split the work between
agents' copies and merge them back is in [parallel work](../workflow/parallel-work.md). The code map is in
[architecture](../code/architecture.md).

Contents:
1. [Plan first](#1-plan-first)
2. [The code pieces](#2-the-code-pieces)
3. [The order to build in](#3-the-order-to-build-in)
4. [Checklists](#4-checklists)
5. [Lessons from realms 2 and 3](#5-lessons-from-realms-2-and-3)

---

## 1. Plan first

Nothing is built until the plan is written on the [board](../../board/README.md) and the user has read it (realm 2's plan was agreed on
2026-09-28, realm 3's on 2026-10-01; realm 4's is a draft "for the user to read, nothing built"). The plan holds
decisions, a balance table and numbered groups, each with its checks.

### Start from the prototype
Realms 2 to 8 are the prototype's realms in its order (design rule Q1): castle, forest, aqua, desert, ice, lava,
storm, void. Its source is at `C:\Users\Ed\Downloads\eight-realms-source\eight-realms\src`:

| File | What it holds for a realm |
|---|---|
| `a43.js` | `THEMES`: sky, colours, props, the look |
| `levels.js` | `CHUNKS`, `ITINERARY`: the level's pieces in order |
| `k50.js` | the bosses (moves, health, lines) |
| `e42.js` | the mounts |
| `w54.js` | the creatures |
| `village.js` | the village, its folk and their lines |
| `hazards.js`, `setpieces.js`, `encounters.js` | the hazard, the set piece, encounters (realm 2's ambush) |
| `relics.js` | the relic |
| `s49.js` | lines, lore and the world map |
| `o40.js`, `r22.js` | `TRACKS` (the music) and `THEMES_AMB` (the ambience) |

Translate each piece the way realm 1 was: the tyrant, the creature, the mount, the village's lines, the captive,
the hazard, the set piece, the relic, the fortress and the arena become places and systems on an open isometric
map, plus side content. Quote the prototype's lines where it has them (Whisperwood's Reeve, Bryony and Ash keep
theirs).

### The decisions
Write each down in the plan, in this order (realm 3's and realm 4's plans are the models):
- **The story**, in a few sentences, and how the tyrant's fall changes the realm (dawn; realm 4's draft: nightfall).
- **Its light and its first screen.** A night (or day) of its own, and a first screen that says at once which
  realm this is. Give it a target hue for screenshots (realms 1-3 sit at 205-253°, 150-168° and 172-196°; realm 4's
  draft 20-45°). Set both in the first group, not at the end (realm 3's were fixed late).
- **A frame of its own.** Size (120 x 120, 120 x 120, 140 x 110; realm 4's draft 150 x 100), the way the journey
  runs across the screen (up it for realms 1-2, down it for realm 3, across it for realm 4's draft), the edges (tall
  on the far north and west sides, low on the camera's side: rule W12), a sketch map, and the **counts**: named
  places, chests, people, lore stones, quests, moonfires, placed foes, signs. Set the counts now; volume grew every
  realm (chests 11, 23, 33; people 7, 17, 34) until realm 4's draft stopped it.
- **The realm's rule.** One rule at its heart that changes how the shared moveset plays without changing the
  moveset (realm 3: water, the suit, air, floating, currents; realm 4's draft: the sand moves). It is a nuisance,
  never a killer (F3). Avoid a rule that is an earlier one in a new coat (realm 4's draft rejected a heat bar
  because it would be realm 3's air again).
- **The realm's tool**, won as a step of the quest, ideally from a mini-boss (Brassbelly's diving suit; realm 4's
  draft, the Sphinx's Sunglass).
- **Its foes**: mostly its own; the shared kinds (goblins, shield goblins, archers) only in the realm's own gear;
  the trial and the tyrant's calls too. Set the shares: ranged foes (realm 1 36%, realm 2 41%, realm 3 13%: too
  few), foes that cause an effect, the biggest group, elites. Base health per kind.
- **Hazards**, and **mini-bosses** (each with its health and a bot target).
- **The beast**: where it is held and who guards it (Q4), how it is freed, how it rides, what only it opens in its
  own realm (Q5), and which border it opens next.
- **Borders**: in by the last realm's beast (Q3), out by a way shut until the next realm is built.
- **The sword and the hits**: the smith's levels here, `foeHp`, what a hit costs (see [difficulty](difficulty.md)).
- **The village**: roomy (V1), houses that belong to the land (V3), its people by name and job, the services
  (leader, innkeeper, smith, hint-giver, the captive's kin) and wares of its own.
- **Music and sound** of its own from the first group: a version of every mood, an ambience.
- **Ground and props**: its own ground types and its own props file.
- **What's common, on purpose (the 40%)**, and a table of the expected score per area, scored as
  [common and unique](common-and-unique.md#the-aim-about-40-common-60-unique) explains (design rule A4).
- **Performance from the start**: what costs most in this realm and the budget for it.

Where a rule or the user doesn't settle a decision, decide it and say so in the plan: the user has said "decide,
don't ask" for realm 4's plan, and "do what is logic and makes sense for the story... gameplay wise you should be
able to decide" (2026-10-02).

### The balance plan
A table of targets set before any content, which the last group measures: the knight on arrival and at the end
(sword level, hearts, flasks, relics, beasts), `foeHp`, placed foes and their health, the opening blows to clear
them, ranged and effect shares, what a hit costs, each mini-boss's and the tyrant's health and bot target, the
trial, what the village sells and what the realm pays. Realm 4's draft has one to copy.

### The groups
Numbered on from the last realm's (realm 2 was 11 to 18, realm 3 28 to 36, realm 4's draft 37 to 46). Each group
says what it builds and which checks prove it, and is reviewed afterwards; the checks it ran go into its Done entry.
Realm 3 took nine groups and a content round in which eight agents' copies built side by side. Run lean: two or
three copies for groups that build on each other, six to eight for rounds of independent areas, and say how
long a run will take (see [parallel work](../workflow/parallel-work.md)).

---

## 2. The code pieces

Paths are from the project root. [Architecture](../code/architecture.md) maps the rest of the code.

### The registry
- `RealmId` in `src/world/realm.ts`: add the id (the prototype's: `desert`, `ice`, `lava`, `storm`, `void`).
- `REALMS` in `src/game/realms.ts`: one `RealmDef` per realm: `id`, `name`, `w`, `d`, `build` (the map builder),
  `paintOutskirts` and `decorateOutskirts` (the land past the map's edge), `story` (makes the story module),
  `quests`, `night` and `dawn` (its `Light`), `birds` (birdsong, 0 to 1), `bubbles` and `muffle` (under the sea),
  `physics` (gravity, jump, falls, speed, shots), `noFire`, `wip`.
- `QUESTS` in `src/game/quests.ts` is keyed by `RealmId`: the new realm needs its list there.
- The world map (`src/ui/worldmap.ts`) already lists all eight realms in the prototype's order (`ALL`, `NODES`,
  `ROUTE`).
- `wip: true` while it's being built: the pause menu's travel list shows it as "(being built)" and the world map
  leaves it out (`src/game/game.ts`, `setTravel` and `refreshMap`); reach it with `?realm=<id>`. Turn it off in the
  review group.
- For testing: `?realm=<id>` in the URL picks the realm; with `?debug`, N and B cross to the next or previous realm
  and keys 1 to 9 jump to the realm's `debugSpots` (one key each, as many as it has). See [shortcuts](../testing/shortcuts.md).

### The map: `RealmData`
`build<Realm>()` returns a `RealmData` (`src/world/realm.ts`), the contract between a realm's map and the game:

| Field | What it is |
|---|---|
| `id`, `w`, `d`, `grid`, `builder` | the realm, its playable size in cells (the grid reaches further, into the outskirts) |
| `start`, `titleView`, `viewer`, `debugSpots` | where a new journey starts, where the title camera drifts, the model viewer, debug keys 1-7 |
| `borders` | ways to the neighbouring realms (`BorderDef`: where, the other side's id, where you come out, the travel card, `leap` for a way only the stag crosses) |
| `horse`, `stagHome` | where the warhorse and the Thornstag wait (`horse: null`: no land beasts here) |
| `sea` | a sea's surface, depth, air pockets, `currents`, `lifts` (bubble columns) |
| `flows` | its streams and rivers: each a line in the way the water runs and its speed (m/s); the water's ripples and foam drift along them, and other water lies still |
| `enemies`, `npcs`, `objects`, `regions`, `trial` | the placed foes, people, objects, named regions and the relic trial (below) |
| `foeHp` | how much tougher its foes are than their kind (not the tyrant) |
| `arena` | the tyrant's hall: walking in (above `y`) starts the fight; `summons` (two points), `dust`, `mountOut` (where the beast waits) |
| `slits`, `chandeliers`, `drums`, `vines`, `snares`, `thornBursts`, `clams` | realm 1's, 2's and 3's hazards and climbing |
| `inn`, `hums` | the inn's tune and chatter leaking out; lamps that hum once lit |
| `waterPoints`, `grassDensity`, `grassScale`, `fireflyZones`, `critters` | ambience, grass, fireflies, animals |
| `landmarks` | ground never under the mist (W13) |
| `afterOutskirts`, `structures` | things placed once the outskirts exist; structures kept for reference |

### The builder and its modules
- `src/world/realm<N>.ts` exports `buildRealm<N>(builder)`. Its header comment draws the layout (what lies where,
  which way the journey runs, the edges); constants name the places (`START`, `VILLAGE`, `CAMP`...), exported when
  the story needs them (realm 3's `HALL`, `FLOODGATE`, `BELL`). It paints the ground cell by cell with
  `Painter.each` (`src/world/paint.ts`: height `grid.h`, ground type `grid.t`, water `grid.water`, cliff style
  `grid.side`, `grid.noGrass`), places the props, calls its modules and returns the `RealmData`.
- A big realm splits into **builder modules** (realm 3: `reef.ts` the village's folk, `reeflife.ts` its night,
  `errands.ts`, `seacaves.ts`, `shorelife.ts`, `kingdom.ts`, `lighthouse.ts`, `inkgrotto.ts`, `seabed.ts`,
  `seastair.ts`). Each exports `build<Part>(b, grid, under)`, draws its props and returns its data
  (`{ enemies, objects, npcs, regions, ... }`); the realm's builder hooks it in with one short block after the last:
  ```ts
  const reef = buildReef(b, grid, under);
  enemies.push(...reef.enemies);
  objects.push(...reef.objects);
  regions.unshift(...reef.regions);
  ```
  and adds its people to `npcs: [...reef.npcs, ...]`. This is what let eight copies build realm 3 side by side.
- **Dice of its own.** A module that places things by chance borrows the builder's random stream and gives it
  back, so nothing placed after it moves (`cutCove` in `src/world/realm3.ts`):
  `const keep = b.rng, r = (b.rng = mulberry32(3838)); ... b.rng = keep;`. Without this, adding one bush moves every
  later tree, rock and spawn check.
- **Ground types**: `T` in `src/world/grid.ts` (realm 3 added `Coral`, `Silt`, `Seagrass`), each with a colour and
  surface in `src/world/terrain.ts` and, if grass grows on it, a line in `src/world/grass.ts`.
- **The outskirts**: the realm's `paint...Outskirts` and `decorate...Outskirts` (realm 1's are in
  `src/world/outskirts.ts`). Tall on the far edges, low on the near ones, and enough land that the camera never
  sees past the world into black.
- **Detail and growth**: `dressRealm` in `src/world/realm.ts` (the scatter, lily pads, wildlife, owls) with a
  `patch` function for clumps (W6); realm 2's `woods()` and `zoneAt()` show trees by zone (W4, W5).

### Props
- `src/world/builder.ts`: the `Builder` (trees, bushes, rocks, boats and the rest; geometry by place `b.g(x, z)`,
  glowing parts `b.gl(x, z)`, colliders `b.collide`, lights `b.lights.add`, particles `b.fx.addEmitter`) and the
  palettes `PAL`, `GLOW`. A realm's own leaf colours go through `b.leafTone` (set before the trees grow: their dice
  stay the same, only the colour changes; Whisperwood's by zone in `src/world/woodcolours.ts`), so each zone's
  woods read as its own (W4, W5).
- `src/world/details.ts`: realm 1's dressing (headstones, lanterns, stalls, fences, crops...) and `dressWorld`, the
  realm-wide scatter.
- `src/world/wood.ts`: Whisperwood's living wood, built with `Geo.sweep` (`trunkUp`, `rootFrom`, `bough`,
  `homeTree`, `giantOak`, `greatTree`, `ropeBridge`, brambles, thickets).
- `src/world/sea.ts`: the reef's (kelp, corals, sea fans, bubble vents and columns, stilt houses, boardwalks, the
  wreck, drowned ruins, the strand's driftwood, wrack, marram, tents, nets, boats).
- A new realm gets a props file of its own (realm 4's draft: palms, cacti, adobe, awnings, obelisks...). Every
  solid prop gets a collider; anything tall stays off the camera's line to places meant to be seen (W12).

### Regions, music and ambience
- `RegionDef` (`src/world/realm.ts`): `name` (shown when the knight walks in), `music` (a mood), `amb` (the
  ambience: `fields`, `village`, `woods`, `keep`, `indoor`, `road`, `shore`, `harbour`, `sea`, `cave`, `grotto`,
  `temple`), `test(x, z, y)`, and `light` (the place's own light: [below](#the-light)). Every new region needs a
  `light:`, a module's too (group 93's inn room took the wood's `indoor`).
- **The first region that matches wins** (`checkRegion` in `src/game/game.ts`), so list small, specific regions
  first and end with a catch-all (`test: () => true`); modules `unshift` theirs in front. A name that covers
  another place hides it (Whisperwood's Deer Meadow once covered Bryony's forge).
- Music: the moods are `road`, `village`, `fields`, `wilds`, `keep`, `hall`, `boss`, `dawn`, `tavern` (the inn's
  tune), and realm 3's `fight` (its mini-bosses). `REALM_TRACKS[<id>][<mood>]` in `src/audio/music.ts` holds the
  realm's own version of each; a mood it leaves out plays the shared `TRACKS`, which is a point of sameness (A3).
  The instruments are the eleven samples in `public/audio/samples/` (all the prototype holds).
- Ambience beyond `amb`: `birds`, `bubbles`, `muffle` in the registry; `inn`, `hums`, `drums` in the realm data.
  A new kind of ambience needs work in `src/audio/audio.ts` and where `game.ts` builds the ambience mix.
- The test browser is muted: sound is checked by reading the audio graph (`seasound`).

### Foes
- Kinds: the `EnemyType` union (`src/world/realm.ts`); numbers in `FOES` (`src/config.ts`: health, size, speed,
  sight, reach, wind-up, coins, and each kind's own); the shared AI in `src/game/enemies.ts`; a realm's own kinds in
  a module of their own, attached in the `Enemy` constructor (realm 3: `SeaFoe.of` in `src/game/seafoes.ts`, models
  in `src/game/seamodels.ts`; Old Inkarm in `src/game/inkarm.ts`).
- The shared kinds' dress per realm: `setFoePalette(realm)` and `FOE_LOOK` in `src/game/models.ts`
  (`woodGoblin`, the reef's crew). Recolouring alone counts as common (A3).
- `EnemySpawn`: `type`, `x`, `z`, `group`, `guard` (holds its post), `elite`, `plain` (keeps the shared look),
  `ambush` (hidden in a bush), `off` (retired). Groups carry meaning: `garrison` (its fall opens the tyrant's door),
  `boss` (the tyrant and its calls), `trial`; the story's `spawns()` hook decides who appears.
- **Never remove or reorder a spawn**: the save keeps felled foes as indexes into the realm's enemy list
  (`killed` in `src/game/save.ts`). Retire one with `off: true`; add new ones after the existing ones.
- `foeHp`: health times `foeHp` for every foe but the tyrants; elites x3, golden x1.5. The code names the special
  ones: the tyrants by type in the `Enemy` constructor and `isBoss` (`king`, `warden`, `tidelord`), the mini-bosses
  in the golden roll (`salvager`, `inkarm`). A new tyrant or mini-boss must be added there.
- Placement: none by the arrival or in the village; ranged foes on ledges and walls where they can fight; every
  foe clear of posts, tents, fires, rocks and trees (`spawns`); the realm's scatter keeps 1.3 m clear of every
  foe's and animal's post.

### Objects
`ObjDef` (`src/world/realm.ts`): `moonfire` (3 or 4 a realm: arrival, village, on the way, the stronghold's gate),
`chest` (`coins` by how hidden, an optional power-up), `lore`, `lever` (`look: 'heart'` for the Thorn Heart),
`thornGate`, `drawbridge`, `cage` (one a realm, with its captive an NPC marked `caged`), `hallDoor`, `breakable`
(pot, crate, barrel), `windmill`, `sign`, `shard` (three a realm), `cracked` (a wall a heavy blow breaks),
`bindings` (the stag), `nets` (the serpent), `thorns` (a border hedge; `by: 'stag'` for the stag's burst only).
- A thing of the realm's own can be a new `ObjDef` kind (built in `src/game/objects.ts`) or a class the story
  module makes and pushes into `g.interactables` (realm 3's `SunkenBell`, `Floodgate`, `DiveSuit`).
- Chests, moonfires, lore, walls and shards are saved by `id`: every id unique in the realm (a code review of realm
  3's merge found duplicates).
- The trial: `TrialDef` (the altar, the relic id, the quest, the prompt, the wake and win toasts, the purse, three
  waves of 3, 4 and 4 foes of the realm's own).

### People
`NpcDef` (`src/world/realm.ts`): `id`, `look`, `name`, `x`, `z`, `lines`, `after` (once the captive is free),
`shop` (`flask` or `sword`, with `upTo`: the smith's top level), `wares`, `perch`, `hidden`, `caged`, `roam` with
`pause` and `speed` (a round of spots), `pose` (`sit`, `fish`, `work`, `play`) and `heading`.
- Looks: `LOOKS` in `src/game/assets.ts`, dressed for the realm (Hollowbough's hooded greens, the reef's oilskins
  and sou'westers). Each villager their own look and name: two of realm 3's agents picked the same names, and two
  villagers shared another's look until fixed.
- The sword's prices are one list in `src/game/game.ts` (`[80, 150, 240, 400, 560, 640, 720]`, by level); it ends
  at level 7. Each realm's smith takes the sword two levels further (`upTo`); realm 4's draft sells another kind of
  upgrade instead.
- Wares: `WARES` in `src/game/wares.ts` (name, what a level does, the price of each level), sold by whoever's
  trade fits (`wares: [...]` on the NPC). Their levels go with the knight (`kit` in the save).

### The story module
`src/game/story/<id>.ts` implements `RealmStory` (`src/game/story/story.ts`). The game runs the generic flow
(moonfires, chests, fights, saving) and asks the story what happens at the realm's moments:
- Data: `title`, `intro`, `victoryTitle`, `victoryText`, `boss` (`BossInfo`: the name over the health bar, the
  intro card, the lines for waking, enraging, summoning and dying, the calm and enraged summons), `cagedPlea`,
  `cageHolds`.
- Hooks: `apply` (restore story state from the save), `spawns`, `onKill` (groups cleared, mini-bosses felled),
  `onRegion` (quest steps by place), `areaSub` (a line under a place's name), `talk` (return lines, or `'handled'`
  if the story ran the talk), `victoryLine`, `onLever`, `onBreak`, `struck` (a blow reaching the story's things),
  `onCageOpen`, `onBossDeath`, `arenaOpen` (does the door stand open after a lost fight), `tick`.
- Story state lives in `save.data.flags` (per realm). A freed beast goes into the carried `mounts`.
- A big realm splits its story into parts held as fields, each called from the hooks it needs (realm 3's
  `AquaStory` holds `ReefFolk`, `ReefLife`, `ReefErrands`, `SeaCaves`, `DarkLamp`, `InkGrotto`...). In `talk`, each
  part adds its say to what the last left, so none swallows another's lines.
- Quests: `QuestDef` in `src/game/quests.ts` (`id`, `title`, `main`, `steps`, `short`); the main quest's id is
  `main`; the last step is the finished state. `g.quest(id, step)` never moves a quest back. Realm 3 finds main
  steps by their short name (`step(g, 'Ring the sunken bell')`), so a step added later doesn't break the others.

### The light
`Light` in `src/game/realms.ts`: the moon's colour and strength, the sky and ground light, fog, mist (`mistLevel`
about 1.2 m above the realm's floor), the lift in the shadows, warmth, exposure, cloud, and under a sea the deep
water's colour, the caustics and the shafts. Each realm has a `night` and a `dawn` (`CASTLE_NIGHT`, `FOREST_NIGHT`,
`SEA_NIGHT`...), and may set `saturation`, `fogNear` and `fogFar`. The light's direction is one fixed vector in
`src/game/game.ts` for every realm; realm 4's draft (a low sun in the west) needs a direction per realm.

Over that, **each place has its own light** (group 85, realms 1 and 2): a region's `light` is a `ZoneLight` (a
colour cast `tint`, `bright` and `mist` times the realm's, and the same under `dawn`). `src/game/zonelight.ts`
paints the regions' lights into two maps of the realm, night and dawn, blended over about 4 m, and the atmosphere
pass lays them over the ground (lamps, fires and glows keep their own colour). Keep a realm's values together, as
`KEEP_ZONES` and `WOOD_ZONES` in `src/world/lightzones.ts` do, and point each region at one. A realm whose regions
have no `light` gets no map (realm 3); in a realm that has them, ground whose region has none takes the realm's
plain light (no cast, its mist as the realm sets it). Check it with a `zonelight`-style script (read the maps at
each place: `g.pipe.zone`) and measure shots with `tools/look.mjs` ([testing](../testing/testing.md#measuring-the-look)).

### Water and harmless life
Both are shared systems a new realm uses, not builds again:
- **Rivers, lakes and pools** (`src/world/water.ts`, any realm without a `sea`): soft banks shelving into the water,
  the lapping edge, flow along `RealmData.flows`, white water at fords, falls and bridges, clear shallows and dark
  deeps, the moon's path and the lamps' streaks, reeds and stones by the shores. The realm gives its `flows` and its
  water's place in the grid; the colours come from its own moon and sky.
- **Harmless life** (`src/game/wildlife.ts`): flocks, birds on the water, herds, frogs, fish, a wader, a shy rare
  beast, motes in the air, each kind of body one instanced mesh, moving only near the camera and fewer on phones.
  A realm brings its own creatures and their models in a `Wildlife` subclass of its own (`castlelife.ts`,
  `forestlife.ts`; realm 3's `sealife.ts` is built on the same grammar), started in its story's `apply` and run in
  its `tick`. Its creatures are its own (the 40/60 aim: the system is shared grammar, the animals the realm's
  vocabulary). Checks: a `wildlife`-style script (each group in place and answering the knight), `spawns`.

### The beast
Realm 2's Thornstag is built on the warhorse's frame (`src/game/mount.ts`); realm 3's Tide Serpent is a module of
its own (`src/game/serpent.ts`). Both are freed through an object (`bindings`, `nets`) and a quest, saved in the
carried `mounts`. Climb heights matter: every barrier must hold against the best climber the realm will see (the
stag reaches 2.75 m with its second leap; the knight 1.5 m with a jump and an air dash).

---

## 3. The order to build in

Realms 2 and 3 were built in this order, and realm 4's draft keeps it (with the realm's rule as a group of its
own). Each step is a group; after each, review the work (a code review of the change, then screenshots), run its
checks and the ones it could break, and write the Done entry with what was checked.

| Step | Realm 2 | Realm 3 | Builds | Check after |
|---|---|---|---|---|
| 1. Groundwork | 11, 13 | 28 | The registry entry, `wip`; a rough map to try things on; the story module, the main quest, the light and its dawn; its music and ambience; its ground types and first props; its outskirts | `npx tsc --noEmit -p .`; a groundwork check of its own (`sea`: physics, the look, the music); new `reach<N>`, `spawns<N>`, `normals<N>` entries; the full suite (the other realms unchanged: group 11 compared every realm-1 report with an untouched baseline); screenshots, the first screen among them; frame time against the last realm |
| 2. The way in | 12 | 30 | The border place on both sides, the beast that opens it, the travel card, coming back; the pause menu never sets a knight down where he couldn't have got | `border`, `travel`, `menutravel`, `worldmap`; a border check played both ways with a reload (`seastair`, `stairleap`, `stairmenu`); reach on the beast (`reachstag`) |
| 3. The realm's rule and tool | none (its rules came with 14 and 15) | 29 | The realm's rule (realm 3: the suit, air, floating) and the tool that opens it, often from a mini-boss | its own checks (`costume`, `costumedrop`); a bot for the mini-boss (`salvagerbot`); reach with and without the tool |
| 4. The land | 13, 16b | 31 | The zones, each its own ground, growth, relief and light; the village, roomy; paths; named regions; the edges dressed; the rule's places (currents, lifts) | the overhead map (mapview) and `tools/emptymap.js`; reach, normals, region names; screenshots of each zone from the game camera; explore mode; its movement checks (`rides`) |
| 5. Foes and hazards | 14 | 32 | The realm's own kinds (numbers, AI, models), the shared kinds in its gear, hazards, placement | a live-encounter check (`foes2`, `seafoes`); `spawns`; every warning 1.2 s or more (F2) |
| 6. The beast | 15 | 33 | Its guarded prison, freeing it, riding it, its moves, its purpose in the realm | `stag` / `serpent` (with a reload); its moves (`serpentswim`, `serpentmoves`, `serpentledge`); reach on it (`reachstag2`, `reachserpent`): no way out, nothing the story keeps shut |
| 7. People, quests and secrets | 16 | 34, content round | The folk, the leader, inn, smith, hint-giver, the captive's kin, wares; the captive; the trial; three shards; chests by how hidden; lore; the cracked wall; errands; the village's life | `folk` / `reef`; the captive with a reload (`sister`, `kip`); the trial (`oaks`, `pearl`); secrets (`secrets2`, `secrets3`, `treasures2`); economy |
| 8. The tyrant | 17 | 35 | The stronghold's "lever", the garrison, the hall and its door; the fight; victory and dawn | the way in with reloads (`hold`, `palace`); every move (`warden`, `tidelord`); the fair bot (`wardenfair`, `tidefair`); the balance bot (`bossbot`, `tidebot`); the beast can't skip it (`arenastag`) |
| 9. Review and balance | 18, 27 | 36 | Economy, toughness, the bosses' bots, the 40/60 score, the counts against the plan, performance on desktop and phones, a playthrough from a fresh save to the victory, the full suite, the docs; then `wip` off | the checklists below; every report of the full suite read |

Two things the order teaches:
- **Light, first screen, music, ground and props go in step 1**, not at the end: realm 3 got its own night and a
  first screen of sea only in its review.
- **Measure the 40/60 straight after the content**, so the review can fix what the measure finds.

---

## 4. Checklists

Run the commands with the dev server up (`npm run dev`); the suite is `npm test` (about 12 minutes: run it in the
background and keep working read-only; don't edit `src/` while it runs, Vite would reload the page mid-check). One
check: `npm test -- reach3`. See [testing](../testing/testing.md).

### Design rules
Go through [design rules](design-rules.md) group by group. For the land in particular:
- [ ] The overhead map shows no even sprinkle, no rows or grids, no square patches, no empty stretch, no crowding
  (`node tools/shot.mjs "shot&play&realm=<id>" shots/map.png 1500 1280x1280 tools/mapview.js`). (W3-W6)
- [ ] `tools/emptymap.js`: no reachable patch far from anything with a purpose. (W3)
- [ ] Each zone has its own ground, growth, relief and light, and a name. (W4)
- [ ] Water has irregular, shelving shores; nothing built where the realm is wild. (W7)
- [ ] Cliff edges dressed in stretches; caves cut into cliffs. (W9, W10)
- [ ] Paths to every place with a purpose, none to secrets. (W11)
- [ ] Nothing tall between the camera and the village, the arena, the captive, the trial or the beast. (W12)
- [ ] The village roomy, lived in, uneven; its houses belong to the land. (V1-V3)
- [ ] The beast's prison guarded; the border needs the last realm's beast. (Q3, Q4)

### The 40/60 aim
Score it as [common and unique](common-and-unique.md#the-aim-about-40-common-60-unique) explains (the earlier
realms' scores are in [realm scores](realm-scores.md)), per area: quest steps and words, rewards, village services,
stronghold and tyrant, map frame and route, kinds of place, terrain and look, mechanics, foes, music and sound.
Each part counts 1 if a player who finished an earlier realm would call it the same thing (a recolour counts as
the same), ½ if it has the same role in a clearly new form, 0 if new. Then the other measures:
- [ ] **Placed foes by kind**: how many are earlier realms' kinds as they were, the same role in a new form, new.
  None only recoloured.
- [ ] **The ground-type mix** against each earlier realm: count the ground types over the map (built with the
  game's code: `g.grid.typeAt` in a page script) and compare the shares (realm 3 overlaps realm 1's by 12%; realms
  1 and 2 overlap 57%).
- [ ] **Screenshot hue**: the average hue of shots of each place under its light, against the other realms'
  ranges. (Measured by hand so far; no tool keeps it.)
- [ ] **Music and sound**: a track of its own for every mood it plays (`seasound` for realm 3); sounds of its own.
- [ ] **Counts** against the plan: named places, chests, people, lore stones, quests, moonfires, placed foes,
  signs; water and deep water as a share of the map.
- [ ] The shared spine kept (village and leader first, the lever, the garrison, the tyrant), and the realm's
  lines its own. (Q6, V4)
Write the result into the realm scores and the lessons into [later realms](later-realms.md).

### Economy
- [ ] Chests pay by how hidden (realm 3: open 25-35, tucked 45-55, hidden 70-90). (E2)
- [ ] Chests, quests and the trial pay 10-25% over what the village sells (the smith's levels, the wares); foes'
  coins and pickups come on top. (E1)
- [ ] Every reward's toast names its sum; a trial's foes drop nothing; no reward can be farmed. (E6)
- [ ] A check of its own, `economy<N>` (`tests/economy3.js` is the model: it reads every `coins += n` in the
  realm's story files).

### Toughness
- [ ] `foeHp` set so a goblin-kind takes 3 blows on arrival with the expected sword: `foeHp ≈ 1 + 0.25 × the
  arriving sword level` (see [difficulty](difficulty.md)). (E3)
- [ ] The opening blows to clear every placed foe, with the arriving sword and the end sword, in the table.
- [ ] A knight who skipped a smith (menu travel lets him) is slower, not stuck: measure the work at one level
  lower (realm 3: 37% more at level 3).

### Boss fairness and bot balance
For the tyrant and each mini-boss:
- [ ] The arena's floor fits the boss's style; walls low on the camera's side; marks drawn over everything.
  (B1, B2)
- [ ] Every mark fills for 1.2 s or more; aim lines fixed well before release; one attack at a time; nothing holds
  the knight still under another attack; marks and shots die with the boss; a lost fight lifts the door. (B3, B4,
  B8)
- [ ] The fair bot (copy `tests/wardenfair.js` or `tests/tidebot.js` with `&fair`): a bot that dodges a quarter
  second after each warning is hardly hit; one that stands still is hit. (B5)
- [ ] The balance bot (copy `tests/bossbot.js`, `tests/tidebot.js`, `tests/salvagerbot.js` or `tests/inkbot.js`,
  run with `&lvl=<expected sword level>`): wins in about a minute, losing well under its hearts. Tune the boss
  alone. (B6)
- [ ] Never golden; no combo bonus on its purse; its type named where the code names the tyrants and mini-bosses.
  (B7)

### Reach, spawns, normals
- [ ] `reach<N>` (tests/reach.js, the `__reach()` flood): nothing unreachable, no way out of the world,
  `traps: 0`. Before and after each story barrier opens (`__reach(false)` for realm 1's drawbridge).
- [ ] Reach on every beast the realm allows, with its climb height: no way out, nothing the story keeps shut
  reached early (`reachstag`, `reachserpent`). Barriers built for the best climber, not the knight.
- [ ] `spawns<N>`: no foe, villager or animal starts inside anything (sea creatures and divers may start in deep
  water; a sea creature out of it is flagged).
- [ ] `normals<N>`: no face without a normal, no corner that isn't a number (they blacken the screen).

### Performance
- [ ] A tour of the realm: frame rate, draw calls and triangles at each place (`tests/tour.js` and
  `tests/tour2.js` are realm 1's and 2's; a new realm needs its own stops). For reference: realm 1 96-237 draw
  calls; Whisperwood 60 fps everywhere headless, 95-198 draw calls, up to 702k triangles at its village (the
  heaviest place in the game); realm 3's strand came down from 323 to 95 draw calls in its review.
- [ ] The game's own time per frame at the busiest places (`tests/cost.js`), the worst frame after the first fire,
  coin drop and swing (`tests/hitch.js`).
- [ ] Lamps fade and never pop (`lights`); the light count stays flat under fire (`soak`).
- [ ] Characters cast moon shadows only near the knight; far, idle foes skip their frame; small life is culled out
  of view (realm 3's sea life). Realm 4's draft adds a budget: point lights in view under realm 1's, props that
  come in hundreds (palms, cacti, rocks) instanced, weather as a screen pass rather than a cloud of particles.
- [ ] `tests/monkey.js` (two minutes of random play, not in the suite): no errors, no NaN positions, no falls
  through the ground.

### Phones
- [ ] `phone` (`MOBILE=1`, 844x390, tests/mobileflow.js): tap through, the stick, attack.
- [ ] Every new move and prompt has a touch form (realm 3: the serpent's stroke up, tearing free of Old Inkarm's
  grab); the HUD's new rows don't overlap (combo, toasts, titles, prompts); upright too (`tests/portrait.js`).
- [ ] Phone settings for the realm's heavy things (realm 3: no kelp shadows, fewer light-shaft samples; realm 2: a
  third fewer trees). Draw calls in phone mode (realm 2: 102-184).

### Before `wip` comes off
- [ ] A playthrough from a fresh save to the victory: every quest finishes and stays done after reloads and travel
  (group 36 found five flow-breakers this way).
- [ ] The full suite, every report read (a report that isn't as its line describes is a failure, even if nothing
  says FAILED).
- [ ] The realm's page in [docs/realms/](../realms/README.md), the [realm scores](realm-scores.md) and
  [difficulty](difficulty.md) brought up to date; the [board](../../board/README.md)'s Done entries written.

---

## 5. Lessons from realms 2 and 3

### Planning
- **Decide the common 40% on purpose.** Realm 2 copied "whatever realm 1 had": the same size, direction and counts,
  even lines. Realm 3 planned the 40/60 from the start and built its own ground, props, foes and music in its first
  groups: 48% on its first build against realm 2's 67% ([later realms](later-realms.md), "What worked in realm
  3").
- **One rule at the realm's heart** (water) that changes how the shared moveset plays, and **the realm's tool won
  from a mini-boss**, gave realm 3 most of its own character.
- **Set the counts and the purse before content.** Realm 3's content round added chests, people and quests
  freely and paid about twice what its village sells, until group 36 brought it to 20% over.
- **Upgrades fade.** Each sword level adds +25% of the base, so less and less of what the sword already does
  (+10% at level 7), and the list ends at 7; hearts reach 9. Realm 4's draft sells reach instead of damage and makes
  a boss's blow cost two hearts.
- **Keep the foe mix varied.** Realm 3's threats came up close (ranged foes 13%, from 36-41%); realm 2's variety of
  kind (snares, lobbed seeds, traps, a keep-away tyrant) is what made it harder.

### The look
- **Set the light in the first group.** Realm 3's night was the Keep's blue (screens at 199-206°) and its first
  screens, down the Sea Stair, read as realm 1's, until group 36 gave it a turquoise night (172-196°) and a cove at
  the stair's foot.
- **Old kinds under a new dress still count.** Realm 3's crew were realm 1's goblins in teal until group 36 dressed
  them in oilskins, crab-shell helms and net shields (foes from about 54% common to 37%); their AI and wind-ups are
  still realm 1's. Kinds of the realm's own count for more.
- **Look from the game camera, and go bold.** A first pass that moved a shore by a few metres "barely" showed;
  before and after shots from the same spot settle it (W15). Explore mode zoomed out shows the whole place.
- **The overhead map finds what screenshots miss**: realm 2's one even sprinkle of trees, rows of bushes on every
  lip, square mud, boxes of rock (`tools/mapview.js`, added in group 16b).
- **Cast rays from the camera** at places meant to be seen: trunks, crowns and walls on the +x+z side hid
  Whisperwood's clearing, its trial ring, its owl and a villager.
- **Big crowns fade** when they stand between the camera and the knight, or they hide half the screen.

### The land and the reach check
- **A beast's climb breaks barriers built for the knight.** The Thornstag's 2.75 m reach could leave the world and
  skip the story in both realms; the reach tool was given a climb height, and barriers were raised to 2.9 m or
  more. Deep water stays unjumpable.
- **Check routes for shortcuts.** Whisperwood's Blackwater shallows let the knight skip half the realm (64 m from
  the village to the Warden's stair, against 139 m round); the quest never stuck, but the content did. Measure the
  quickest route and what it passes.
- **Bridges run along cell boundaries**, and the reach check ignores posts too thin to fill a cell.
- **Safe footing is never below -5**, or a fall into a chasm put the knight back on its floor, again and again.
- **Faces with no area make a NaN** that the bloom smears into a black square: `normals` checks every realm.
- **What sits at the world's origin**: things parked out of sight were drawn at the map's origin in every realm,
  hidden in the cliff, until group 36 placed them where they stand; realm 3 keeps its (0, 0) corner solid rock.

### Story and quests
- **Keep the shared spine.** Realm 3's content round pointed the main quest past the village and its leader, and
  the crew before the palace opened nothing; group 36 restored both (Q6).
- **Regions added by modules hide the realm's own.** The bell step didn't fire from the kingdom's named places
  (the temple, the library...) until the story listed them all (`KINGDOM_WAY` in `src/game/story/aqua.ts`).
- **Say the right direction.** Lines that send the knight somewhere (Jetsam's "south-east") are checked against
  the map.
- **A playthrough from a fresh save** finds what single checks miss (group 36: five flow-breakers).

### Merging parallel copies
How copies are made and merged is in [parallel work](../workflow/parallel-work.md). What realm 3's eight-copy
content round taught:
- **New files, small hooks.** Each agent's content went in its own builder and story modules, hooked in with one
  short block; shared files got only small, clearly placed additions. Never reformat or reorder.
- **Names and looks collide.** Two agents chose the same villager names (Pike, Merrow: renamed in the merge), and
  villagers shared another's look. Give each copy its names up front, or check after the merge.
- **Ids collide.** The code review after the merge found duplicate ids; ids must be unique per realm.
- **Edges between hands.** Boardwalks and stilts built by different agents boxed in lone cells of water a diver
  could never climb out of; a pass after all the modules boards them over (`buildRealm3`).
- **Story parts must not swallow each other**: `talk` passes each part's lines on to the next.
- **Light checks in content rounds, the suite after.** The content round ran only a typecheck, a page load and
  screenshots; the review group brought the suite up to date (ten spawns moved out of posts and raised ground,
  timing-fragile checks steadied).

### Tests
- **A check that assumed a realm was empty breaks when it fills** (`travel` checked "no chests at all in
  Whisperwood"); check for what you mean.
- **Chance-bound checks can miss** (realm 1's `foes`: the thrower's burn lands in some runs and not others); a miss
  isn't a failure, a wrong outcome is.
- **Check where something was set down, not where it wandered** (the warhorse after a crossing).
- **Bots that play like a person** (real keys, aimed clicks, dodging a quarter second late) are the proof of a fair
  and balanced fight; a scripted kill only proves the fight runs.

### Left as known (so a new realm doesn't repeat them)
- Wind Boots (a 20 s power-up) give a second jump about as high as the stag's, and can cross barriers built for it
  while they last.
- Realm 3's serpent doesn't save where it waits (realm 4's draft saves the wyrm's).
- Tyrants and mini-bosses are named one by one in the code.
- The realm order isn't enforced (menu travel), so the sword a realm assumes isn't guaranteed.
