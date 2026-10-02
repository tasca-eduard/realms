# Realm 3 plan (agreed 2026-10-01)

> Moved from BOARD.md on 2026-10-02, word for word, with a link added to each group's task file (and group 36
> ticked). Where the text says "(see Done)" or "checks recorded under Done", the record is now in that task file.
> REALMS.md and README's realm sections have since been split into docs/; where the text sends a reader there, it
> now links to the new file. How the board works: [board/README.md](../README.md).

Realm 3 is **the Sunken Reef**, the prototype's third realm (`aqua`): "The sea swallowed a kingdom. Its lord still
waits below." The prototype built it all under the sea (light rays, a blue tint, bubbles from the knight's helmet,
floaty physics, currents over the trenches, bubble columns, the sunken ship, the Jelly, giant clams, the Tide
Serpent, the Tidelord). Asked for on 2026-10-01: first the whole realm under the sea ("let's do A for now, we'll
see how it goes"), then, once tried, a drowned coast half land and half sea (way B, below); air pockets "just like
an annoying thing, not that hardcore", no fire under the sea, and the sword's progression left to my recommendation. Built the way realms 1 and 2 were, with [REALMS.md](../../docs/design/common-and-unique.md)'s 40/60 aim from the
start: about 40% the shared grammar (the quest's shape, the village's services, rest and rewards), the rest its own.

**Decisions**
- **A drowned coast, half land and half sea** (way B; first tried all under the sea, then, on 2026-10-01: "a bit
  weird having goblins in water all the time... let's have 50/50 land-water"). The strand, the islands and the
  coral village above the water; the sea below it, clear, so the camera, staying above, looks down through it
  at the sea floor. Walk into deep water and the knight goes down onto the bottom: below the surface the floor
  is lit as under water (a blue-green tint deepening with depth, light rippling over the sand, shafts coming
  down from the surface), everything floats, sounds are muffled. On land, a moonlit coast.
- **The diving costume** (the user's idea): improvised, and won from a mini-boss on one of the islands: a goblin
  salvager in a patched brass diving suit on the lighthouse isle. Without it deep water stops the knight at its
  edge, as in the other realms (he'd sink in his armour); with it he walks into the deep and back.
- **Air, a nuisance not a killer**, only below the surface: the costume holds about 90 s; surfacing fills it
  again, as do air pockets down there (bubble vents, the wreck's cabin). Empty, the knight is **Breathless**:
  stamina stops refilling, he slows, the view narrows. No hearts lost (a heart cost can come later if it proves
  toothless).
- **Floaty physics under the surface.** Lower gravity, a slow fall, higher and longer jumps, the knight 15%
  slower, shots slower (the prototype: gravity x0.53, jump x0.77, fall x0.4, speed x0.85).
- **Goblins in improvised dive gear** (the user's idea): on land the Tidelord's crew are goblins as ever; in the
  shallows and on the reefs, goblin divers with buckets, kettles and fishbowls on their heads, hoses up to a cork
  float bobbing on the surface (which gives them away from above). The deep belongs to the sea's own creatures.
- **No fire.** No firepot throwers, nothing burns, no Fire Blade in its chests.
- **The sword.** The reef's coral-smith sets a coral edge on it: levels 6 and 7, +25% each, so each realm's
  smith takes it two levels further. Its foes are as tough as the sword they're met with: `foeHp` 2.25.
- **The swimmer: the Tide Serpent**, the realm's beast: on its back you swim, across the surface and down and up
  through the water (tap jump to stroke up, sink between strokes); a shadow and a ring on the floor show how high.
- **A frame of its own.** In from the top, down the Sea Stair onto the strand; out to sea and down toward the
  deep on the camera's side (low: nothing tall hides it). Depth is the journey: the strand and the coral village,
  the reef flats, the kelp groves, the drowned kingdom (its towers and columns breaking the surface), the sunken
  ship on its rocks (deck above the water, hold below), the trench, the Tidelord's flooded throne hall. A map that
  isn't 120 x 120 (140 x 110) and counts of its own.
- **Mostly its own foes.** On land and in the shallows the crew (goblins, divers, harpooners); below, the Jelly
  (the prototype's: splits in two), crabs with an armoured claw, eels that strike from crevices, pufferfish.
- **Borders.** In by the Sea Stair past the Withered Wood, broken by the rockfall: only the Thornstag's second leap
  clears the gap. Out toward the Scorched Dunes by a way only the serpent can swim, shut until realm 4 is built.

**Groups** (each reviewed afterwards; checks recorded under Done)
- [x] **28 Groundwork.** ([task 028](../done/028-reef-groundwork.md)) Done 2026-10-01: `aqua`, the Sunken Reef, in the registry (`src/world/realm3.ts`
  builds a rough 140 x 110 drowned coast to try things on: the strand and a goblin camp in the north-west, the sea
  floor stepping down toward the south-east, three isles, the drowned plaza's columns breaking the surface, kelp
  groves, the trench and its abyss; its story module, quest and light, a moonlit coast). The pause menu travels
  there ("The Sunken Reef (being built)"); the world map leaves it out until it's built. The sea is clear water
  the camera looks down through: below its surface the floor darkens and turns blue-green with depth, light
  ripples over it and shafts come down (the last pass, `src/engine/pipeline.ts`), specks drift, bubbles rise from
  the knight's helmet. Below the surface everything floats (`physics` in `src/game/realms.ts`: a jump 1.27 m
  high and 0.8 s long against 1.12 m and 0.53 s on land, sinking at 5.5 m/s at most, the knight 15% slower,
  shots 30% slower). Deep water: a diver walks in (for now any knight in the realm; group 29 gives it to the
  suit), a land-walker stops at its edge, a sea creature can't leave it. Nothing burns, no Fire Blade, no horse.
  The sea's ground (coral rubble, silt, seagrass) and props (`src/world/sea.ts`: kelp, corals, sea fans,
  anemones, barnacled rocks, bubble vents, drowned columns). Below the surface sound is muffled, with bubbles
  and a low drone; its own music (the prototype's: 70 bpm C Lydian, a celesta over a choir and harp, an echo).
  Checks: tests/sea.js (new), reach3, spawns3 and normals3 (new), the full suite (66 checks, all passing;
  the Warden's bot won in 77 s losing 10 hearts, at the edge of its limit, 5 the time before), screenshots. Found
  afterwards and fixed: on the sea floor he still counted as wading (about half speed, splashes on the surface
  over him); now 85% of his speed (sea.js checks it).
- [x] **29 The diving costume and air.** ([task 029](../done/029-diving-costume-and-air.md)) Done 2026-10-01: Brassbelly the salvager (`salvager`: a goblin a head
  taller than a brute in a patched canvas suit, lead boots and a brass helm, swinging a ship's anchor) fights with
  three of his crew in the goblins' salvage yard on the lighthouse isle, under a health bar: a brute's slow,
  unflinching anchor blows, and when he's struck three times in quick succession (or the knight hangs about
  close) his valves hiss, a ring shows on the ground for 0.95 s, and his suit blows off steam all round (a heart
  and a shove; no shield stops it, a roll does). Felled, he drops his diving suit (the helm on a heap of canvas,
  glinting); walked onto, it's the knight's (saved; left lying, it's still there after a reload). Without it deep
  water stops the knight at its edge; a sandbar, wading-deep, runs out from the strand to the isle, which has its
  yard (salvage heaps, a rowboat) and its lighthouse on a rock at the far side, its lantern burning. In the suit
  he walks into deep water, a brass helm on (his plume off), an air cask on his back. Air (`AIR` in config.ts):
  90 s below the surface, a row of bubbles under the bars (one for each ten seconds, pulsing when low, outlined red
  when gone); it fills again above the surface (in 2 s) and in vents' streams of bubbles (four vents are air
  pockets). Out of air he's breathless: 70% speed, no stamina back, the view closes in and greys; never a heart
  lost to it. Warnings: "air running low" and a sound at a quarter left, the sound again every 6 s, "breathless!";
  tips on the first dive and the first time out of air. The quest: "Find a way down into the sea" (the salvager's
  suit), then "Go down into the deep". Checks: tests/costume.js, costumedrop1-2.js and salvagerbot.js (new; a
  player-like bot wins at sword level 4 in 25 s losing 4 hearts and at level 5 in 62 s losing none: 30 health,
  x2.25 here), reach without the suit (the isle reached, nothing else missing) and with it (16,209 places, no way
  out, no traps), sea.js, screenshots.
- [x] **30 The way down.** ([task 030](../done/030-the-way-down.md)) Done 2026-10-01 (an agent's copy, merged): past the Withered Wood Whisperwood's heights
  now end at a sea cliff over a cove (the water 4.5 m down, surf at the cliffs' feet, blocks fallen into it, a sea
  gate out between the cliffs), and the Sea Stair is cut down the cove's north face (`src/world/seastair.ts`), a path
  to its head from the Warden's path round the Great Tree's roots, a sign there. A rockfall broke its head: two
  great blocks across it, 2.1 m over the heights, a gap between them down to the rocks. On foot (a jump and an air
  dash reach about 1.8 m) or on the warhorse he can't get up; the Thornstag's second leap gets onto the first, over
  the gap, and down a landing, two flights and the turn to the last flight into the water, where the travel card
  takes him to the Sunken Reef. There the same stair comes down the north-west cliff from a cleft to the strand by
  the Foot of the Sea Stair; back up into the cleft, he comes out below the rockfall, the stag waiting on the
  landing, the warhorse at the top (`leap` on a border). From the pause menu a knight without the stag isn't set
  down below the rockfall. The Reef stays `wip`. Checks: seastair, stairleap (played both ways with keys),
  stairmenu (new); travel, border, menutravel, worldmap, reach2, reachstag, reachstag2, arenastag, stag. Left as
  known: Wind Boots (a 20 s power-up) give a second jump about as high as the stag's and could cross the rockfall
  while they last, as with the Warden's roots; the blocks still read a little boxy.
- [x] **31 The Sunken Reef's land.** ([task 031](../done/031-sunken-reef-land.md)) Done 2026-10-01 (the zones here; their dressing by an agent's copy, merged): the
  coral village on a coral shelf where the shore bulges out ("the tide took our harbour; we built on the coral
  instead"): five houses on stilts round its seaward side, plank huts in faded sea colours under dried-kelp roofs,
  porches to the green (left open for its folk), a jetty out over the deep with boats moored, kelp drying, lamps of
  glass floats; paths from the stair to it and to the sandbar. Under the sea, by depth: the coral gardens off the
  jetty (coral packed close, sparse elsewhere), the kelp forest (stands of giant kelp by a grove noise, their fronds
  a canopy under the surface, clearings, a ragged edge), the drowned kingdom on a terrace 4.5 m down (streets of
  ruined walls with gaps, an arch, the plaza's columns, three towers on its far side breaking the surface; the reef
  steps down to meet it), the trench past it (12 m, sheer) with the abyss in it, and across it the palace's floor
  (kept for 35); the sunken ship on its rock (a planked hull stove in on the near side, its bow deck above the water,
  the hold, the stern cabin with lit windows, its mainmast fallen across the rock). New ways to move below the
  surface (`sea.currents`, `sea.lifts`): currents carry a diver along them, held at their height ("ride them, not
  against them"; both ways over the trench), columns of bubbles lift him to their top and give him air (out of the
  trench three of them, in the wreck's hold up onto the bow deck, beside the middle tower onto its top: a secret,
  no path). The strand dressed zone by zone (wrack and driftwood along the tide line in stretches, marram in clumps,
  knolls and heather on the heights), the crew's camp (sailcloth tents, nets drying, a longboat drawn up), the
  islets and the edges dressed in stretches. Under water every step is one a floating jump climbs (no pits), the
  kingdom's and palace's edges and the trench apart. Chests: the bow (50), the tower top (45), the captain's cabin
  (70, a bubble). The overhead map tool shades a sea's depth. Checks: tests/rides.js (new), reach3 (16,010 places
  with the suit, no traps), spawns3, normals3, sea, costume; screenshots. Left as known: under the deep tint the
  wreck's hull reads faintly (it reads from its deck, sheer, cabin and mast); the kelp stands on floor 2.7 m down,
  shallower than meant.
- [x] **32 Foes and hazards.** ([task 032](../done/032-reef-foes-and-hazards.md)) Done 2026-10-01 (an agent's copy, merged; placed here): the Sunken Reef's own foes
  (`src/game/seafoes.ts`, `src/game/seamodels.ts`, numbers in `FOES`), each as tough as the level-5 sword they're met
  with. The crew: goblin divers (a goblin's blows; they walk into deep water; a tin bucket, a copper kettle or a
  fishbowl on the head, a hose up to a red-topped cork float bobbing on the surface over them) and harpooners in
  yellow sou'westers (a line on the ground follows the knight, then holds still 0.45 s before the throw; struck, a
  heart and he's reeled in; a roll or a swing frees him, a shield stops it). Below, the sea's own, which can't leave
  deep water: the prototype's Jelly (squeezes, flashing, and lunges; felled, it splits into two little ones whose
  stings poison), the crab (blows from the front glance off its claw; it turns slowly and scuttles sideways; a heavy
  blow flips it onto its back), the eel (in a den where nothing reaches it; lunges along a held line, then pulls
  back), the pufferfish (a ring fills as it swells; its spikes burst; strike it small or winded). Giant clams (`clams`):
  a ring fills and they snap shut; struck open, a pearl (12 coins, once). Placed: harpooners and divers by the
  strand and the sandbar, divers in pairs, crabs and pufferfish in the gardens, jellies, eels and divers in the kelp,
  crabs, eels, divers and a jelly in the kingdom, an elite crab at its edge by the current, crew and a crab on the
  wreck, jellies in the trench, six clams (44 foes and the clams checked by spawns3). Checks: tests/seafoes.js (new);
  spawns3 lets divers and sea creatures start in deep water and flags a sea creature out of it. Left for 36: the
  pearls in the economy, the eel's two baits, the crab's maim chance.
- [x] **33 The Tide Serpent.** ([task 033](../done/033-the-tide-serpent.md)) Done 2026-10-01 (an agent's copy, merged): the crew hold it in their nets in the pool
  off the sandbar, the lines staked on the bar and the shallows, two goblins, a shield goblin and an archer keeping
  it; near it the quest starts ("The Netted Serpent"), a blow at each stake cuts its line, the third frees it
  (saved), and it swims over to be ridden (`src/game/serpent.ts`: a long teal sea serpent, pale beneath, a red
  saddle). It swims wherever the water is deep, at 6 m/s; at the surface the knight rides dry and a jump leaps it
  out of the water; in the diving suit the leap plunges under, each tap is a stroke up, it sinks between strokes,
  his air runs as when diving, and out of air it carries him up; without the suit it won't go under. A ring on the
  floor below it, wider the higher, shows how high it swims. Bubble shot, Whirlpool (drags foes in, knocks arrows
  away), Bubble shell (the next hit bursts it). He gets off onto ground up to a metre out of the water, in the suit
  anywhere; thrown off without it the sea washes him back (a heart). At the east edge the Dune Strait, the way on to
  the Scorched Dunes between two low reefs, shut for now; the serpent turns back at the edge. A knight who died in
  the saddle no longer leaves his mount unrideable. Checks: serpent (with a reload), serpentswim, serpentmoves,
  serpentledge, reachserpent (new; it objects only to the serpent reaching what the story keeps shut: the wreck's
  deck and the tower's top before the suit are meant). Left: the whirlpool skips bosses; where it waits isn't saved.
- [x] **34 People, quests and secrets.** ([task 034](../done/034-reef-people-quests-secrets.md)) Done 2026-10-01 (an agent's copy, merged): the coral village's folk in
  oilskins and sou'westers (`src/world/reef.ts`, `src/game/story/reef.ts`): Gannet the Harbourmaster, Dulse the Innkeeper,
  Shale the Coral-smith (a coral edge, levels 6 and 7, +25% each, 640 and 720), Maren the Pearl-diver, Old Tally the
  Tide-reader (a hint a talk), Shrimp and Ling about their day, Old Hake the Diver (the air bladder, +30 s a level),
  Flotsam the Beachcomber (the lodestone, coins from further); the coral shrine mends whatever carries the knight.
  The Pearl-Diver's Son: Kip caged on Gull Rock on the trench's lip, guarded, the crew's floats leading there; freed,
  his pearls and Maren's. The Whalebone Isle's trial (three waves; the Tide Pearl: a mount takes one more hit).
  Three Moon Shards under the sea, 20 more chests by how hidden (23 in all), four lore stones; the chests, purse and
  quests pay about 6% over what the village sells.
- [x] **35 The Tidelord.** ([task 035](../done/035-the-tidelord.md)) Done 2026-10-01 (an agent's copy, merged): across the trench the drowned palace on the floor
  6 m down (`src/game/palace.ts`, `tidelord.ts`, `tidelordModel.ts`); the currents bring a diver to the landing before
  its floodgate (two towers breaking the surface), shut fast until the drowned kingdom's great bell, hanging in the
  plaza, is struck: it tolls and the floodgate grinds up (saved; the quest's "Ring the sunken bell", "Face the
  Tidelord"); his crew on the landing, a moonfire there. The throne hall: 14.5 by 15.5 m of floor, the north wall
  high (the throne on a dais, a giant clam's shell for its back), the others 2.2 m, vents breathing air in three
  corners; in, he wakes and the gate drops shut, a lost fight lifts it. The Tidelord (95 health, tuned alone): his
  charge's lane follows the knight then is fixed 0.65 s before he runs it (into a wall, he's dazed); drowning orbs
  drift after the knight (a blow cuts one down, a breath of air in it); the slam lands on a spot marked under the
  knight (filling 1.5 s) and sends a wave to jump; close in, the sweep's reach fills on the floor for 1.2 s; his crew
  called in; one attack at a time. Enraged, "the tide turns": a current carries the knight and the orbs toward the
  far walls, turning a quarter every 7 s, its new way shown first. Felled: the sea free, shafts of morning light into
  his hall; the sea's dawn retuned. Checks in its copy: palace, tidelord, tidefair (a dodging bot hit 0 times calm, 1
  enraged), tidebot (level 6: 58 s, 2 to 3 hearts; level 5: 72 s, 3).
- [x] **Realm 3 content round.** ([task 048](../done/048-reef-content-round.md)) Done 2026-10-01 (eight agents' copies, merged; light checks only, balance to come):
  - The village's night (`reeflife.ts`): the Harbour Arms, Dulse's inn on stilts, a lit room you walk into (its roof
    fading), hearth, regulars, its tune leaking out; a fish market with a cook-fire; a boatyard; fishers on the jetty
    and two new stages whose floats bite; children at ball and tag; a coral-carver, Granny Whelk shelling, Nipper
    and his crab on a string; chimney smoke, washing lines, more lamps; 17 more villagers, their words changing with
    the suit, the serpent and Kip.
  - Errands (`errands.ts`): a message in a bottle, its map drawn from the real coast, an X on the dunes to dig; Brill's
    glowing bait (five shrimp in the gardens: each flask heals one more heart); Pike's current race through seven
    rings over the abyss; Cockle the lost diver in a shrinking bubble, led to air (Merrow, his wife, pays); the night
    raid on the village once the suit is won.
  - The lighthouse (`lighthouse.ts`, "The Dark Lamp"): a stair winding round the tower to its gallery; the lamp dark
    until old Wick's oil (by the wreck's breach) and lens (on the sea floor) are found; lit, two beams sweep the sea and
    the fishing boats come home; his storm lantern (a relic: a light at the belt that shows the deep).
  - The drowned kingdom (`kingdom.ts`): the sunken temple (walk in; the Lady of the Tides, moonlight through its
    broken roof), the market square and its fountain, the Kings' Way of coral-grown kings, the royal library, the
    treasury behind a cracked wall, the queen's gardens, the old harbour wall over the trench, ruined houses; seven
    chests, six lore stones.
  - Sea caves (`seacaves.ts`): the castaway's cave in the north cliffs (Jetsam, the crew's cache), the Glowing Grotto
    in the trench wall, a blowhole on the strand that throws the knight up.
  - Old Inkarm (`inkgrotto.ts`, `inkarm.ts`): a second mini-boss under the sea, a giant octopus in the Ink Grotto
    west of the kingdom (arms slamming along lines that fill for 1.2 s, a grab mashed free, ink darkening the screen,
    its body hit only while its arms are down); its chest gives Kraken's Ink (a power: blows blind foes).
  - Life: under the sea (`sealife.ts`, `seabed.ts`) 30 schools of fish by zone that scatter from the knight, rays,
    turtles that surface to breathe, octopuses that jet off in ink, glowing jellyfish and plankton, crabs, starfish,
    urchins and shells; on the shore and surface (`shorelife.ts`) gulls, seals on skerries, beach crabs, moving surf
    and spray, leaping fish, three fishing boats with lanterns, flotsam, mist.
  - Merged by hand (two villagers renamed where two agents chose the same: Pike the Diver Lad, Merrow); a pass boards
    over any lone cell of water boxed in by planks or stilts. Realm 3 now: 37 people, 63 foes of 13 kinds, 33 chests,
    30 named places; reach: nothing unreachable, no way out, no traps.
- [x] **36 Review and balance.** ([task 036](../done/036-reef-review-and-balance.md)) The economy (chests, quests and the trial pay for the coral-smith and the wares
  with a modest surplus), toughness, the Tidelord's bot, how much is common with realms 1 and 2 (aim about 40%),
  performance (particles, lights) and phones, [README](../../docs/realms/README.md), [REALMS.md](../../docs/design/realm-scores.md).
