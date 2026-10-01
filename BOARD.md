# Board

Tasks and known issues for Eight Realms: The Moonlit Keep. New work and newly found
problems go into **Backlog**; whatever is being worked on sits in **In progress**; finished
items move to **Done** with the date.

## In progress

Nothing yet: the realm 3 plan (below) is written, waiting for the word to start group 28. Open choice from the
follow-up: the Ash family's home tree still covers Old Nettle's glade (group 21).

## Realm 3 plan (agreed 2026-10-01)

Realm 3 is **the Sunken Reef**, the prototype's third realm (`aqua`): "The sea swallowed a kingdom. Its lord still
waits below." The prototype built it all under the sea (light rays, a blue tint, bubbles from the knight's helmet,
floaty physics, currents over the trenches, bubble columns, the sunken ship, the Jelly, giant clams, the Tide
Serpent, the Tidelord). Asked for on 2026-10-01: the whole realm under the sea ("let's do A for now, we'll see how
it goes"), air pockets "just like an annoying thing, not that hardcore", no fire under the sea, and the sword's
progression left to my recommendation. Built the way realms 1 and 2 were, with REALMS.md's 40/60 aim from the
start: about 40% the shared grammar (the quest's shape, the village's services, rest and rewards), the rest its own.

**Decisions**
- **Under the sea.** The realm is the sea floor and the knight walks it. The iso view never shows a sky, so the
  sea is made of light and motion: a blue-green grade that deepens with depth, shafts of light slanting down
  from the surface, light rippling over the sand (the renderer's last pass already knows each pixel's place in
  the world, as the cloud shadows and ground mist do), drifting specks, swaying kelp, rising bubbles, fish
  schools. Sound muffled.
- **Floaty physics.** Lower gravity, a slow fall, higher and longer jumps, the knight 15% slower, arrows and
  thrown things slower (the prototype: gravity x0.53, jump x0.77, fall x0.4, speed x0.85), as realm numbers.
- **Air, a nuisance not a killer.** An air bar that empties in about 90 s; air pockets fill it again: bubble
  vents in every part of the realm, the coral village's air-bell houses, the wreck's cabin, the moonfires. Empty,
  the knight is **Breathless**: stamina stops refilling, he slows, the view narrows. No hearts lost (a heart
  cost can come later if it proves toothless).
- **No fire.** No firepot throwers, nothing burns, no Fire Blade in its chests; light from glowing coral,
  jellies and anglerfish lamps instead of torches and fires.
- **The sword.** The reef's coral-smith sets a coral edge on it: levels 6 and 7, +25% each, so each realm's
  smith takes it two levels further (the grammar stays, the look of it changes). The realm's foes are as tough
  as the sword they're met with: `foeHp` 2.25 for a level-5 sword, so a goblin still takes three blows.
- **The swimmer: the Tide Serpent**, the realm's beast. On its back, tap jump to stroke up (stamina), sink
  slowly between strokes; a shadow and a ring on the sea floor show where it is and how high, and the camera
  eases up with it. It reaches what nothing else does, and its gate is the way on to realm 4.
- **A frame of its own.** In from the top, down the Sea Stair from Whisperwood's cliffs, and down toward the
  deep on the camera's side (low ground there, so nothing tall hides it): depth is the journey. Sunlit shallows
  and the coral village near the start, coral gardens, the kelp forest, the drowned kingdom's streets, the
  sunken ship, the trench, and the Tidelord's flooded throne hall at the bottom. A map that isn't 120 x 120
  (about 140 x 110) and counts of its own.
- **Mostly its own foes.** The Jelly (the prototype's: hops, splits in two), crabs with an armoured claw, eels
  that strike from crevices, harpooners, pufferfish; the Tidelord's crew are barnacled drowned goblins, so the
  goblin army is the common thread.
- **Borders.** In by the Sea Stair, past the Withered Wood where the heights drop to the sea, broken by the
  rockfall: only the Thornstag's second leap clears the gap (the stag's border job). Out toward the Scorched
  Dunes by a way only the serpent can swim, shut until realm 4 is built.

**Groups** (each reviewed afterwards; checks recorded under Done)
- [ ] **28 Groundwork.** `aqua` in the registry (its map builder, story module, quests, light, its own map
  size); the realm lists that only knew two realms (foe looks and palettes, relics, music) made per realm; the
  underwater look as a realm setting in the renderer (grade by depth, light shafts, ripples over the sand,
  drifting specks, bubbles); the underwater physics as realm numbers; no fire as a realm rule; muffled sound,
  its music (the prototype's: 70 bpm, Lydian, a celesta over a choir, echo) and ambience (bubbles and drips over
  a low drone). A rough sea floor to try it on. Checks: the realm builds and loads, the physics, screenshots.
- [ ] **29 Air.** The air bar on desktop and phones, the pockets, Breathless, the warnings (the bar pulses,
  bubbles from the helmet, a sound). Checks: air drains, a pocket refills it, Breathless does what it says and
  never kills.
- [ ] **30 The way down.** The Sea Stair in Whisperwood (a stair cut down the sea cliff past the Withered Wood,
  broken by the rockfall; only the stag's second leap crosses), the walk down into the water, the way back, the
  world map. Checks: the border both ways, the leap needed, reach in both realms.
- [ ] **31 The Sunken Reef's land.** Zones by depth, each its own ground, growth and light: the coral village
  (air-bell houses on the coral, kelp gardens, glowing lanterns, room to move); coral gardens; the kelp forest;
  the drowned kingdom's streets and plaza (ruins under coral and barnacles); the sunken ship (inside, currents
  both ways and a bubble lift, air in the cabin); the lighthouse; the trench and its abyss. Currents over the
  trenches, bubble columns up onto reef terraces, secrets with no path, real edges (reef walls, sea cliffs, the
  abyss), and the design rules (zones read as zones, nothing sprinkled evenly, dressed edges, nothing tall on
  the camera's side). Checks: the overhead map, screenshots, reach.
- [ ] **32 Foes and hazards.** The Jelly, the crab (blocks from the front until a heavy blow; scuttles
  sideways), the eel (hides in a crevice, lunges, pulls back), the harpooner (a harpoon on a line that drags
  the knight toward it), the pufferfish (swells into spikes when close; strike it while it's small), drowned
  goblins and archers (the crew in barnacles and kelp), an elite at the end of the gauntlet; giant clams (snap
  shut on you; struck open, a pearl); `foeHp` 2.25. Checks: each foe in a live encounter.
- [ ] **33 The Tide Serpent.** Held in the crew's nets and guarded (the rule for a mount's prison); freed, it
  swims (strokes, sinking, the height ring, the camera); Bubble shot, Whirlpool, Bubble shell; places only it
  reaches; the shut way toward realm 4. Checks: freeing it, each move, swimming up onto a ledge, reach on the
  serpent (no way out of the world).
- [ ] **34 People, quests and secrets.** The coral village going about an underwater day; its leader, innkeeper,
  coral-smith (levels 6 and 7), a parent whose son was taken toward the deep trenches, a hint-giver; the coral
  shrine that heals your mount (the prototype's); wares of its own (an air bladder for more air; the prototype's
  coin magnet); the son in the trench; the trial and its relic, the Tide Pearl (one more hit for your mount);
  three Moon Shards; chests paid by how hidden; lore; its own words.
- [ ] **35 The Tidelord.** The way into the drowned palace (its own lever: the sunken bell rung to open the
  floodgate), its garrison, a roomy flooded throne hall (low on the camera's side), the fight (charge, orbs,
  slam; enraged, "the tide turns": a current sweeps the floor and turns), the fairness rules and the bots;
  victory, and dawn light flooding down through the water.
- [ ] **36 Review and balance.** The economy (chests, quests and the trial pay for the coral-smith and the wares
  with a modest surplus), toughness, the Tidelord's bot, how much is common with realms 1 and 2 (aim about 40%),
  performance (particles, lights) and phones, README, REALMS.md.

## Follow-up plan (agreed 2026-10-01: "note all of this, and start doing everything")

From the realm comparison (REALMS.md): realm 2 is about two thirds the same as realm 1 against an aim of
about 40% common, and the extra sameness sits in its foes, its music, its words and the map's frame. Each
group is reviewed afterwards; checks are recorded under Done. Realm 2's frame (its size, its direction,
its counts) stays as it is: how later realms vary theirs is a note in REALMS.md for when realm 3 is
planned, and the way on to realm 3 waits for that too.

- [x] **20 Notes.** Done 2026-10-01: REALMS.md (the comparison, the 40/60 aim, difficulty and how it
  scales); the aim added to the design rules; this plan.
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
- [x] **22 Realm 2's own words.** Done 2026-10-01: Wren's three lines, Moss's welcome, the trial's prompt and
  toasts, the cage's line, the victory card, the innkeeper's and the thorn wall's lines, the quest steps that
  copied realm 1's, all written for the Old Wood; the child called Pip at the fire is now Sprig. (The Reeve's,
  Bryony's and Ash's first lines are the prototype's own and stay.)
- [x] **23 Realm 2's own music and sounds.** Done 2026-10-01: Whisperwood plays its own versions of the moods
  (`REALM_TRACKS` in `src/audio/music.ts`), grown from the prototype's forest track: the road 88 bpm in D Dorian
  with a flute over harp and cello and soft hand drums, the village a 92 bpm waltz, the woods slower and
  sparser, an oboe in the Warden's hold, its own fight and dawn; its nights have birdsong (more at dawn). The
  Keep's music is unchanged. Checked in the game: each place picks the realm's track, no errors (still never
  heard: the test browser is muted).
- [x] **24 Realm 2's own foes.** Done 2026-10-01: goblins with bark masks, crowns of leaves and twigs and
  thorned clubs, shield goblins with bark shields set with thorns, moss-grown archers with crowns of branches
  and branch bows (`woodGoblin`, `FOE_LOOK` in `src/game/models.ts`); the thieves outside the Bat Roost are
  rooks (the Roost keeps bats: `plain` on a spawn); the Mossfen's darter is a spitter in the reeds, the Kilns'
  firepot thrower a snarer; the prototype's ambush: three goblins hidden in bushes by the Old Grove's road (a
  'lurk' state: unseen, can't be struck, don't block, don't stop a rest) burst out as the knight passes
  (tests/ambush.js); an elite shield goblin at the end of the Thorn Ravine. Rechecked: foes2, oaks, the Hold,
  sister, folk, corners, hidden places, both economies, explore mode, spawns, reach. Foes went from about 75%
  common to about 41% (REALMS.md).
- [x] **25 Coins and tempers.** Done 2026-10-01: the tempers add +25% a level, as sharpening does (level 5:
  x2.25, was x2.05). Wares (`src/game/wares.ts`, carried from realm to realm in the save): Keepsfoot's smith
  sells barding (each piece one more hit for every mount, 90 and 210); Hollowbough's weaver silk-wrapped boots
  (+8% on foot a level, 80 and 200), Old Nettle a nettle tonic (the blue bar fills 40% faster a level, 90, 200,
  340), so she has a part to play. With the tempers that is about 1,870 to spend in Whisperwood against about
  1,520 earned there plus what Blackpine leaves over: a modest surplus for a knight who buys everything. The
  prototype's coin magnet and combo keeper are left for later realms' villages. (tests/wares.js, wares1.js.)
- [x] **26 The Thornstag's purpose.** Done 2026-10-01: north of the Stag's Thicket a cleft runs through the
  wood's western wall into the heights, choked with living thorns a sword only scratches and the warhorse's
  charge can't break; the freed stag's thorn burst tears them away (saved), and beyond lies the stag's old bed,
  a mossy dell with a chest (55 coins, Wind Boots) and a lore stone. The owl has a hint for it. On the stag
  nothing climbs round it (reachstag2), and nothing is unreachable (reach2). (tests/stagbed.js.)
- [x] **27 Review.** Done 2026-10-01: the full suite, 62 checks (4 new: ambush, stagbed, wares, wares1), every
  report read, none failing. The Warden's bot still wins at level 3 in 67 s losing 5 hearts; the dodger isn't hit;
  nothing unreachable and no way out in either realm, on foot or on the stag. Found in review and fixed: the
  mount's health bar said "Warhorse" on the Thornstag too. Familiarity measured again: realm 2 is about 58% realm
  1 (was 67%), foes about 41% (was 75%), sound about 60% (was 85%); what's left over is the shared frame and
  structure, kept on purpose (REALMS.md). README and REALMS.md brought up to date.

## Realm 2 plan (agreed 2026-09-28)

Realm 2 is **Whisperwood**, the prototype's second realm (source: `C:\Users\Ed\Downloads\eight-realms-source`),
rebuilt the way realm 1 was: the prototype's tyrant, creature, mount, village, captive, hazard,
set piece, relic, fortress and arena become places and systems on an open 120 x 120 map, plus
side content. The realms are neighbouring lands, crossed on foot or by mount; each border opens
with the beast freed in the realm before (the Warhorse's charge opens the way to Whisperwood).
**A border needs the right beast, never a beaten tyrant**: you can go back and forth between realms
whether or not they are finished (asked for on 2026-09-28). For testing: `?realm=forest` in the URL,
and with `?debug` the keys N and B cross to the next or previous realm from anywhere.

**How the game picks and switches realms**
- Realm ids follow the prototype: `castle` (the Moonlit Keep), `forest` (Whisperwood), then aqua,
  desert, ice, lava, storm, void. A registry (`src/game/realms.ts`) lists each realm's map
  builder, outskirts, story module, quests, palette and borders.
- One realm is built per page load. Crossing a border saves (current realm + where you arrive)
  and reloads; the loading screen shows a travel card ("Blackpine → the Old Wood") and the knight
  comes out at the other end of the same path, without the title screen. A realm build takes
  about a third of a second, so this stays quick. Tests pick a realm with `?realm=forest`.

**How the save holds several realms (version 2)**
- Top level: what the knight carries (coins, flasks, sword, relics, freed mounts, deaths, play
  time, foes felled). Under `realms.<id>`: everything about a place (last moonfire, chests,
  moonfires lit, lore read, walls broken, shards, felled foes, explored land, quests, story flags).
- A version-1 save becomes `realms.castle` plus the carried part, keeping every field; the
  Knight's Crest becomes `relics: ['crest']`. A check writes a real version-1 save and compares
  every field after loading.

**What moves out of `realm1.ts` and `game.ts`**
- `src/world/realm.ts` (new): the realm types, and map helpers realm 1 wrote inline: the
  flat-ground / near-road / clear-of-colliders tests, tree scatter, lantern rows along a road,
  the detail pass (scatter, lily pads on still water, wildlife, owls on dead trees), water points.
- `outskirts.ts`: the painter takes each realm's biomes, river, lake and roads instead of
  realm 1's (realm 1's move into its own spec).
- `game.ts` keeps the generic flow and hands realm moments to a story module
  (`src/game/story/castle.ts` now, `forest.ts` later): what levers, cages, doors and cleared
  groups do, special talks, region triggers, hints, boss intro and death, victory text, what
  `__reach` opens. Realm data instead of hard-coded realm 1 numbers: the boss arena, arrow slits,
  chandeliers, camp drums and tavern music, title camera, debug spots, the night palette.
  Quests become per realm. Goblins and archers get a palette so each realm can recolour them.

**Groups** (each reviewed afterwards; checks recorded under Done)
- [x] **11 Groundwork.** Done 2026-09-28 (see Done).
- [x] **12 The way to Whisperwood.** Done 2026-09-28 (see Done).
- [x] **13 Whisperwood's land.** Done 2026-09-28 (see Done).
- [x] **14 Whisperwood's foes and hazards.** Done 2026-09-28 (see Done).
- [x] **15 Climbing and the Thornstag.** Done 2026-09-28 (see Done).
- [x] **16 People, quests and secrets.** Done 2026-09-28 (see Done).
- [x] **16b Whisperwood relaid.** Done 2026-09-28 (see Done): woods by zone, a roomier village, a place with
  a purpose in every part of the map.
- [x] **17 The Warden's Hold and the Thorn Warden.** Done 2026-09-28 (see Done). Wall of thorn trees, the gate lever on a
  tree-tower roof, the drawbridge over the thorn moat, the garrison, the arena inside the Great
  Tree; the boss (arrow volleys, arrow rain on marked spots, summons; enraged, roots burst from the
  floor), victory and dawn; the sea-cliff stair to realm 3 visible but closed. Checks: the boss
  fight, a playthrough.
- [x] **18 Review and balance.** Done 2026-09-28 (see Done). Prices, difficulty (hearts can reach 8 by the end of realm 2),
  performance and phones in the new realm, the pause-menu world map (the prototype's, filled in as
  you travel), README. Checks: the full suite in both realms.

## Backlog

Sorted by priority on 2026-09-28. Each group is a set of related issues, fixed together
and then reviewed together. "Confirmed" = reproduced in a live game.

### High

_The follow-up groups above (the 2026-10-01 comparison's findings are in groups 21 to 26)._

### Medium

_None open._

### Low

_None open._

### Can't be checked here
- [ ] Every sound (effects, ambience, music): the test browser is muted, so none of it has been heard.
- [ ] Real phones: touch controls and frame rate were only tested in an emulator.
- [ ] A real gamepad: only a faked one was tested. Buttons are named as on an Xbox pad, so a PlayStation pad works but its prompts say X/Y/A/B.
- [ ] Difficulty and economy: tuned by feel, not playtested.

## Done

- 2026-10-01: **Realm 1 vs realm 2 compared** (asked: what is common, what is unique, difficulty per realm and how
  it scales, and how familiar realm 2 is against a 40% common / 60% unique aim, "to see if we are on the right
  track", not to plan realm 3 yet). The code was read by 9 agents (3 inventories checked by a second agent),
  plus 28 screenshots. Nothing in `src/` changed. Found:
  - **About two thirds common** (estimate; same = 1, same role in a new form = ½, new = 0): map and route ~75%,
    kinds of place ~40%, terrain and look ~55%, sound ~85%, foes ~75%, stronghold and tyrant ~60%, mechanics
    ~55%, quests ~80%, village and people ~60%, rewards ~85%.
  - **New, and working:** the land (tree village round a lake, canopy and rope walk, the chasm inside the map,
    the ravine, water on 18% of the map against 7%), realm 2's own rules (snares, thorn strips, vines, rope
    bridges, the Thornstag), and the Warden, a keep-away archer where the King was a brawler.
  - **Most repeated:** foes, music, the map's frame and counts, the quest text (see Backlog).
  - **Difficulty is flat by design:** a goblin takes 3 blows on arrival in both realms (`foeHp` 1.6 against the
    level-3 sword). Realm 2 is harder in kind, not in numbers: packs (8 to 5), elites (3 to 0) and
    status-effect foes (49% to 35%) went down. Upgrades cut realm 1's work by 29% but realm 2's by 3%.
- 2026-09-30: **Review, balance, flaws** (full suite: 58 reports, all read; the lights check's limit then set above frame-time jitter, 5 a second (a pop reads tens), and rerun) (asked: "review, balance, find flaws"). Measured first:
  - **Economy.** Blackpine pays ~1,145 coins (chests 720, foes ~225, quests and trial ~200) for 770 of
    things to buy (the sword to level 3, flasks to six). Whisperwood paid ~1,930 (chests 1,550!, foes
    ~210, quests and trial 170) for 960 (the two tempers): with Blackpine's leftovers some 1,500 coins
    unspent by its end. Now its chests pay by how hard they are to reach, 35 to 60 (1,055 in all):
    the tempers take most of the realm (tests/economy2.js).
  - **Toughness.** A knight comes into Whisperwood with a level-3 sword (1.75 times the damage), so its
    foes (as tough as Blackpine's) fell in fewer blows than Blackpine's had: the curve went down. Now a
    realm sets how much tougher its foes are than their kind (`foeHp`): Whisperwood 1.6, so a goblin
    takes three blows at level 3, as it did at level 0 (thornbacks two stun-combos, like Blackpine's
    boars at levels 0 to 1); the tyrants are tuned alone (tests/economy1.js, economy2.js).
  - **The Warden** (a bot that plays like a person: real keys, aimed clicks, dodges what it sees coming a
    quarter second late, keeps back from a blow winding up, otherwise closes in and swings): with a
    level-3 sword it won in 40 s losing 7 hearts, every one to the bow's swipe: the knight (5.2 m/s)
    ran the keep-away archer (2.7 m/s) down and cut it apart. Now it leaps back to open ground after its
    swipe and after three blows in quick succession (a crouch first; the landing and the path checked
    clear of roots and thorns), never volleys from close by (its arrows would be on him before he could
    step aside: it rains instead), 54 health (was 46). The bot: 68 to 73 s, 6 to 8 hearts, all to the
    swipe, which winds up for 0.65 s (tests/bossbot.js). (The Goblin King, for comparison: 29 s, 6
    hearts at level 2; left as it is.)
  - **Flaws found** (a code review of everything uncommitted, then checked): any toggle in the pause menu
    "landed" the knight (paused in mid-air over Rookfall, a screen-shake toggle put him on the rim);
    explore mode's "can't be hurt" wasn't true (a foe already after him, marks and arrows still hurt, and
    chests, the Thorn Heart and quest folk could be used while flying); the Thornstag's second leap
    (2.23 m) cleared the hollow's 2 m roots, so it could jump in before the garrison fell (the stag reach
    check couldn't see it: it treated every root over 1.1 m as a wall); the volley's arrows flew 3 to 4 m
    past its lines; a Warden felled mid-leap hung in the air; an arrow marked dead could still hit in the
    frame its Warden died; lamps could still pop when many faded at once (and the lights check measured
    the wrong thing); the bridges' search could loop for ever; landing never greeted the knight with the
    place's story, and could put him on ground that counts as a fall; small ones (an open bough end,
    children running through the log seats, a lax check). All fixed; new or extended checks: fly,
    arenastag, wardenfair (the volley's end), lights (what a lamp actually shows), corners2.
  - Also: the Goblin King left as it is (29 s, 6 hearts for the bot at level 2: short for a tyrant, but realm 1 was
    called done); Hollowbough is the heaviest place to draw (60 frames a second headless, 120 to 144 elsewhere).

- 2026-09-30: **Group 23 review** (full suite: 53 reports, all read; then corners2, 54). All pass. Realm 1's
  "foes" check is chance-bound as ever (the thrower's burn missed its own round, landed in the camp's). New
  checks this group: wardenfair (the fair fight, with a dodging bot), normals and normals2 (no face that
  can blacken the screen), corners2 (the once-empty corners pay; the village's walkers walk, its sitters
  stay sat); the lights check made frame-rate independent. Screenshots of every changed place looked at:
  the stair and its hills, the path, the hollow in a fight, the gorge (bridge, cave, pillar), the village
  (green, inn side, jetty, north homes, hives) and the new corners. The file's header comment redrawn for
  the new layout.

- 2026-09-30: **Explore mode** (asked: "I need a godmode with flying mode so I can check the map myself
  easily"): a switch in the pause menu (and V with ?debug). The knight flies over everything a little
  above the ground, through walls, trees and water; can't be hurt; foes don't notice him; the mist lifts
  (the world's edge stays misty); hold guard to go faster, click to jump to a spot, the mouse wheel zooms
  out; nothing picked up, no quest moved, no border crossed, no boss woken while flying; switched off he
  lands on the nearest open ground (tests/fly.js).
- 2026-09-30: **Review of realm 2** (asked: "review realm 2, find flaws, fix"). Fixed: stale texts (people
  talking about knolls, a comment still describing the pit and drawbridge, the story file saying the stag
  "comes with later groups", the Thorn Heart's saved flag still called 'bridge', the arena's toast "The
  Great Tree opens"); regions (the Deep Wood named, the Whisper's name following the river, the
  Blackwater's name off the Deep Wood's north edge); the heights' new growth thinned on phones; the
  realm-wide detail scatter in patches; a debug spot inside rock; the README's section. The reach check now
  also floods back from every reachable cell to the start and found places to be stranded (drop in, never
  climb out): in Whisperwood a one-cell strip of low ground along the heights' west edge and a shallow
  corner of the Mirror Pool; in the Moonlit Keep shallow cells at the moat's edges. Fixed: traps 0 in both
  realms.

- 2026-09-30: **Whisperwood's empty corners given a purpose** (asked: "some areas are empty, they don't serve a
  purpose (check realm 1, I had that issue there too and it was fixed)"). Measured with tools/emptymap.js
  (reachable ground more than 13 m from anything to do): 5% of it, five patches, the worst 25.5 m from
  anything (realm 1: 11%). Each patch given a place: **the Warden's Seat** (a knot of great roots grown
  into a seat on the heights north-east of the Great Tree, a lore stone, a chest behind it, a thornback);
  **the Rookery** in the pines north of Rookfall (three dead pines with stick nests, a fallen nest with the
  rooks' hoard, feathers, bats for rooks, a lore stone); **the beekeeper's hives** between the Heartpool
  and the Whisper (straw skeps on a log bench, bees, flowers, Marigold at work); **a goblin camp by the
  brook** (fire, a hide on a pole, a stolen chest); **the kingfisher's bank** (a chest in the reeds by the
  east river). Now 0.4%, the worst 15 m. (Each built on dice of its own, lent to the builder and given
  back, so nothing placed after moved.)

- 2026-09-30: **Hollowbough rebuilt: bigger, uneven, lived in** (asked: "the village is small, I can't really
  see anybody there, the positions of the trees are too symmetric, it's not natural, the middle island is
  too crowded, barely any room there to move around the tree").
  - **The lake**: some 35 by 31 m (was a 23 m wavy round): a body with an arm reaching north-east and a bay to
    the south-west, round lobes melted together, the shore wandering (lakeSd; lakeR and byLake now read
    from it, so every lane and lantern string round it followed).
  - **The island**: broad (7.6 m, a tongue reaching south-east), the Heart Oak at its back, a green on the
    near side with the gathering fire and log seats (moved from the north shore). The bridges aren't a
    matched pair any more: one east to the road's shore, one south to the lane's.
  - **Seven home trees** (were four, 90 degrees apart): placed by hand, most behind the lake (north, west,
    east), none between the camera and the green, sizes 0.82 to 1.2; three new ones (the weaver's, the
    elder's, the fisher's).
  - **Folk about their day** (16 in the realm now; 9 new): Reed fishing off the jetty, Tansy washing at the
    bay, Pip and Linnet chasing round the fire, Old Burdock sitting by it, Hazel working Ash's family's beds,
    Bram carrying between the smithy and the inn, Rowan watching the east bridge, Old Sorrel at her door.
    New for them: villagers walk a round of spots with pauses, and sit, fish, work or play; a rod, a basket,
    a sack; eight new looks.
  - Checks: wood's village bridge follows the new bridge; spawns clean; folk names them all; sister passes.
    The lights check now measures by the game's clock (a slow frame then a fast one read as a pop): the
    fastest a lamp changes is the fade's own 3.5 a second.

- 2026-09-30: **Rookfall made a gorge, the bank by the lake opened up** (second pass at "too much cliff/hole,
  looks like a grand canyon" and "the space between the lake and the bridge is too narrow, too much cliff";
  the first pass only made it shallower and moved the lake's shore, and it barely showed).
  - The chasm was an 11 by 49 m trench from the northern cliffs to the Whisper, walls sheer all the way.
    Now a gorge winding from the Whisper's Fall north to a cave where the river goes under the rock (an arch
    of rock over a dark mouth, mist, a faint light): 5.5 to 8.5 m across, ragged, its rim broken here and
    there (a step down to a lip of rock, never more than a climb back); boulders, ferns and roots over its
    edge, trees right up to it. Its old north half is pine wood (the East Woods reach over it; no ridges
    there, the zone's edge would cut them straight).
  - The bank between the Blackwater and the bridge: 11 m of meadow (was 8, and a cliff at the end of it).
  - The Rook Pillar stands where the gorge is widest (still a running jump from the east rim); the bridge
    is shorter. Checks moved with them (wood, treasures2, fly): all pass; reach, stag, spawns clean.

- 2026-09-30: **The Warden's fight made fair, its hollow and the way to it made natural** (asked: "it's very
  hard to fight the boss in realm 2, there's not enough space, they can hit me from anywhere, don't have time
  to react"; "the way to the boss area is too crowded"; "the boss area too crowded"; "the tree trunk and its
  roots look so plastic/fake/straight").
  - **Room**: the hollow is 16 by 15 m (179 m² of floor, was 88), its mouth on the east, straight down a short
    path from the top of the stair. The garrison stands before the mouth; the spring moved aside.
  - **Nothing hidden**: the roots round it stand 2 m on the camera's side (were 3 to 3.4 m all round; still
    more than the knight can climb), 3.4 m at the back. Moonlight on the floor. Marked spots and the volley's
    lines are drawn over everything.
  - **Time to react**: marked spots fill up for 1.5 s (1.25 s enraged; were 0.95 s) and are as big as what they
    hit; the rain marks the knight's spot and an arc to one side, never all round; the volley's lines lie on
    the ground while it draws and are fixed 0.45 s before the arrows fly along them; roots 1.25 s. One attack
    at a time (nothing new while marks are still to land), longer pauses between, 46 health (was 54).
    Goblins summoned, not snarers (a bola held the knight still under the rain). The fight is on foot (the
    stag waits outside). Arrows in the air and marks die with the Warden. Its name replaces the place's.
  - **Proved** (tests/wardenfair.js): a bot that only steps out of the way a quarter second after each
    warning took 0 hits calm and 0 to 1 enraged in 22 s; standing still, 3 to 4 hits in 14 s.
  - **Living wood**: a new knobbly tube (Geo.sweep) and trunk, root and bough builders (wood.ts): trunks
    taper, lean, wander and flare at the foot; roots arch out of the bark, run half-sunk, fork and dive in
    (colliders where they stand high); boughs bow. The Great Tree, the home trees, giant oaks, withered oaks
    and the Fallen Giant (with a root plate) are built with them; the ring round the hollow is a braid of two
    great roots with knots, moss and rootlets (collision follows them; no blocky raised cells). Same dice as
    before, so nothing placed after them moved.
  - **The way up**: no box-shaped rock towers either side of the stair: two ragged, mossy hills at the
    heights' edge, the cleft between them (still too high to climb from the stair, even on the stag); the
    stair a slope of bare rock with roots across it for steps.
  - **Found on the way**: a black square at the foot of the stair (a face with no area gave a NaN that the bloom
    smeared); faces with no area are skipped now, and tests/normals.js checks both realms for them.

- 2026-09-30: **Group 20, the north-west made natural** (full suite: 48 reports, all read, no errors) (asked: "I don't really like the north-west, the area
  around the boss. I don't like those new bushes, they are so weird planted. Go for a more natural look
  instead of looking so man-made").
  - **What made it look planted** (overhead map, screenshots, code): dead trees and thorn domes spread evenly
    on a jittered grid, every clump the same round dome; the heights a flat table with a straight 29 m south
    edge; square patches of mud; the Great Tree's roots two straight walls round a checkerboard floor, with
    green pines growing on them; rows of bushes along every cliff lip; a row of brambles along the ravine lip;
    brambles on an even arc round the stag; the gully's rock masses 8 m boxes with checkerboard tops; the
    Thorn Heart on a square rock column.
  - **The land**: the heights' outline lobed (bays and points); mossy rises and a few crags on the plateau (no
    lone blocks); a spring among mossy stones in the Withered Wood, its stream across the heights and over
    their south cliff in a small waterfall into a deep plunge pool, then on to the Whisper; the ground in small
    natural patches (leaf litter under the groves, moss by the water, mud here and there). The rock masses by
    the gully are grassy, pine-topped knolls rising in broken steps (2.9 m over the gully at their edges),
    stone jutting from their faces and heaped at their feet.
  - **Growth** (`src/world/wood.ts`: `witheredOak`, `deadShrub`, `thornCreeper`, `thornClimb`): everything grows
    in groves and clumps with open ground between (a patch noise gates the whole wood's trees and
    undergrowth). On the heights: groves of dead trees of every size on the leaf litter, a few great withered
    oaks alone, dead shrubs, fallen trunks; thorns only where thorns take (at the feet of trees and crags, over
    the cliff lips in stretches, up the trunks near the Great Tree), creepers running out over the ground from
    it; thin patchy grass. No green pines in the Withered Wood. Cliff lips everywhere dressed in stretches with
    long bare runs; the ravine's and the stag's brambles in clumps; thorn scrub in clumps of one to three.
  - **The Great Tree**: its arena a hollow ringed by two great roots curving out from the trunk and back in,
    drawn as massive knuckled roots with moss on top and rootlets diving into the ground, their tips at the
    mouth (grown shut by thorns in the fight); roots snaking over the heights; toadstools and bones in the
    hollow. No collar block round the trunk (its own roots show).
  - **The Thorn Heart** now beats in the broken top of a great dead trunk by the stair's foot (split grey bark,
    jagged splinters, roots gripping the ground, ivy up its east side where it's climbed, thorns coiling
    round it). Quest text and README updated.
  - **Found on the way: the Thornstag could leave the world and skip the story.** Its double leap (2.3 m) plus
    the step-up at the top (0.45 m) reaches 2.75 m, but barriers were built for the knight's 1.5 m. Traced with
    the reach tool (now given a climb height and a route to any cell): in Whisperwood, up the brook's 2 m far
    bank beside the thorn road's bridge and out to the world's edge; into the Warden's hold over the lowered
    rocks and roots, or up the new stream's channel; in the Moonlit Keep, up the 2 m steps of the forest land
    beyond the north edge to the world's edge. Fixed: the brook's far bank 3 m; the gully's rocks and the
    arena's roots 2.9 m+; a deep plunge pool under the stream's channel; the Keep's northern forest land at
    least 3 m over the map's edge. Left as it is: in the Keep the stag can hop the border hills round the thorn
    hedge to the thorn road (harmless: the pause menu travels to Whisperwood anyway, and the stag is only had
    after going there). The reach tool also let jumps cross deep water, which the game never allows: fixed.
  - Checks: new `reachstag` and `reachstag2` (both realms on the stag: no escapes, no story skipped but the
    known hop); reach and spawns in both realms clean; `hold` (thorns stop a walk, up the ivy to the heart,
    through, garrison, arena) passes. Screenshots: `shots/nw4-*.png` (trunk, rocks, gully, arena outside and
    in, the falls, a grove), overhead `shots/map-nw.png` (the map tool takes `&crop=x0,z0,x1,z1` now).

- 2026-09-28: **Group 19, Whisperwood made wild** (asked: "the complexity isn't the same as realm 1, no zones,
  just random structures/groups in the forest; the boss arena is man-made, it should be a wild map; the
  big lake is square, like a pool; the cliff edges are empty; the village is boring and man-made: I
  expected big trees with the houses built in them; the stag should be guarded, and its fence looks
  man-made").
  - **Zones** (`zoneAt()` and `ZONES` in realm2.ts, borders wobbled so none is a straight line): the
    thorn road's verge (birches, bracken, meadow), the Old Grove (moss and leaf litter under the ancient
    oaks, ferns, moonflowers), Hollowbough, the Deer Meadow (flowers, a few birches), the High Canopy
    (moss, ferns, glowing fungi in the giants' shade), the East Woods (close pines on rocky ridges),
    Rookfall's rims and the Thorn Ravine (gravel, stone, dead trees, thorn scrub), the Blackwater's
    shores (mud, reed beds, birches, drowned trees), the river banks, the Deep Wood (old oaks and pines
    close together on mossy root mounds, ferns, fungi, fallen trunks), the cut wood round the Charcoal
    Kilns (stumps, young birches), the withered Warden's heights, mixed woodland between. Each has its
    own trees, ground, undergrowth and (East Woods, Deep Wood) relief.
  - **Waters**: the village lake (the Heartpool) has a wavy round shore; it and the Blackwater (new, more
    ragged outline) shelve: sand, 1.6 m of wadeable shallows, then deep. No sheer pool walls.
  - **Cliff edges dressed** everywhere: ferns, bushes and stones along every lip, brown roots and moss
    down the faces the camera sees (not green, so they aren't mistaken for climbable vines), boulders at
    the feet.
  - **Hollowbough, a tree village**: four great home trees round the Heartpool (`homeTree` in wood.ts):
    a lit door in the trunk under a shingled hood, shuttered windows up the bark, a stone chimney, a
    lantern in the roots; treehouses on platforms in three crowns with rope ladders, rope walks from two
    of them to the Heart Oak (the Reeve's) on the island, which two rope bridges reach. The inn's tables,
    the smith's forge and anvil in the roots, Ash's family's garden and woodpile, a gathering fire, a
    jetty and a boat, lanterns strung between the trees. The box houses and round knolls are gone.
  - **The Stag's Thicket**: a hollow among mossy rocks in the Deep Wood (open toward its lane, briars
    spilling over the rocks, a fallen trunk, a dead tree), no ring of hedge; guarded by the Warden's
    keepers (a snarer, two goblins, a thornback).
  - **The Warden's Hold, grown not built**: the stair comes up into a gully between two masses of rock;
    living thorns grow across it (`ThornGate`), fed by the Thorn Heart on a rock spire by the stair's
    foot (climbed by its vines; the heart beats until torn out, then shrivels and the thorns wither).
    Beyond, the Warden's grove of dead trees and thorns (the garrison), the Great Tree at the back (a
    living giant again), and the arena between two great ridges of its roots, a tangle of thorns growing
    shut across its mouth behind the knight. The pit, drawbridge, tree-tower, gateposts and staves are
    gone (the drafted hollow tree removed).
  - Also: the Ring of Oaks' oaks set less evenly; home trees' doors turned toward the camera.
  - Checks: `hold` rewritten (the thorns stop a walk; up the spire's vines, the heart; through the
    gully; the garrison; the arena's thorns shut behind; all kept after a reload); `wood` crosses to the
    Heart Oak's island; `stag` clears the stag's keepers first; `warden` starts inside the new arena.
    Reach and spawns clean. Frame rate: desktop over 60 everywhere (up to 702k triangles at the village),
    phone mode 102-184 draw calls, 257k-444k triangles (as before the rework). Screenshots:
    `shots/g19-*.png` (village), `shots/g19z-*.png` (zones), `shots/g19h-*.png` (stag, hold).
- 2026-09-28: **Final review of groups 16-19** (asked: "after you are done you must review, find flaws, and fix").
  Found and fixed: the main quest sent you to the Reeve "on the north-east knoll" (he's in the Heart Oak) and
  the owl spoke of knolls; the README described the old knolls, drawbridge and tower; the drafted hollow tree
  was dead code; the thorn gates read as a palisade of straight canes (now a tangle leaning both ways, leaves,
  berries); the Thorn Heart's spire, the Rook Pillar and the Mirror Pool still looked cut with a ruler (rock
  shouldering the spire and the pillar, a lobed pool edge); the `hold` check's description. Full suite: 46
  reports, all read, no errors (`pause` counted 3 music notes after an 8 s stall where it used to see 0: within
  its own "a handful, not 8 s worth", so not a regression). After the last fixes: reach, spawns and
  `treasures2` rerun clean; screenshots `shots/g19f-*.png`.
- 2026-09-28: **Group 18, review and balance.** The pause menu's **map of the eight realms** (the
  prototype's world map, `src/ui/worldmap.ts`): islands on a pixel sea along a dotted route; realms
  visited show their land, their tyrant freed or not, shards and chests found, and a click travels there;
  the next realm is a rumour, the rest "?". **Economy**: Whisperwood paid ~1,560 coins (chests and rewards)
  against ~770 to spend, so the thorn-smith's tempering costs 400 and 560 (was 330 and 440) and the six
  biggest chests there are lighter. Check `worldmap` (a two-realm save; states, stats, travel by click).
  The baseline worktree is removed.

- 2026-09-28: **Group 17, the Warden's Hold and the Thorn Warden.**
  - **The Thorn Warden** (the prototype's forest tyrant: volley, rain, summon): a giant bone archer grown
    over with bark and moss, a crown of thorn-antlers, a living-wood longbow with a glowing string. It
    keeps its distance (backs off inside 4.8 m, circles, closes in past 8.3 m) and shoots: volleys fanned
    at the knight (3 arrows, 5 enraged); arrow rain on 5 spots round him (7 enraged), each marked by a
    ring that brightens for 0.95 s before the arrows land (a raised shield stops them); goblins and a
    snarer called in (shields enraged). Too close, it swipes with the bow. At half health it's enraged:
    faster, and roots burst under the knight and where he's heading (0.8 s warning, unblockable, they
    prick foes too). 54 health. `isBoss` now stands for the King or the Warden wherever the code said
    'king' (no golden or elite rolls, the health bar, heavy knockback, no coin drops, reset to sleep).
  - **The Warden's Hold**: the hollow Great Tree (a wall of trunk staves round a floor, the half toward
    the camera vanishing while the knight is inside, its crown fading when it hides him); a ring of
    thorn-trees open only at the gate; a pit of thorn stakes before the gate with a drawbridge; a
    tree-tower beside it whose roof lever, reached up its vines, lowers the bridge (quest step 5, saved);
    the garrison (two shields, two archers, a snarer, a thornback), whose fall opens the tree's door;
    inside, the arena: the door shuts behind the knight and the Warden wakes. Falling in the fight resets
    it with the door open (once the garrison is gone). Victory, dawn, quest done.
  - **The Sea Stair**: past the Withered Wood the heights drop to the sea; a stair cut down the cliff
    toward the Sunken Reef (realm 3) is blocked by a rockfall, with a sign.
  - Screenshots: `shots/g17-*.png` (gate, roof, courtyard, the fight calm and enraged, the stair). Fixed
    from them: the tree's staves were a palisade (now thick enough to read as one trunk); the stair's
    rock wall hid the sea (removed: deep water either side already keeps the knight on the stair).
  - Checks (new): `hold` (the gate holds against a walk and a running jump; up the vines, the lever, over
    the bridge, the garrison, into the tree; after a reload it stays done, the Warden asleep inside) and
    `warden` (every move seen; 7.7 m kept on average; enraged roots; felled: victory, quest 6, summons
    gone). Reach and spawns clean in both realms.
  - Full suite: 45 reports, all read, no errors.

- 2026-09-28: **Group 16b, Whisperwood relaid** (asked: "the village is very crowded; the forest is very
  dense but basically empty; make every area have a purpose and be beautiful scenery where you can find
  treasures"). An overhead map tool (`tools/mapview.js`, drawn with `tools/shot.mjs`) showed one even
  sprinkle of trees edge to edge and purpose zones as islands in it.
  - **Woods by zone** (`woods()` in realm2.ts, a fixed hash not the dice picking spots): deep only in the
    East Woods and the Deep Wood round the Stag's Thicket; light under the giants and between places;
    open over meadows, the grove, the Warden's heights (dead trees only) and along the waters. Meadow grass
    where it opens. Trees 4,567 to 3,969.
  - **Hollowbough** half again as big: a rounded pond, knolls of 6.5 m with 6 m rope bridges, houses on the
    far side of each knoll and open yards (the inn's tables, the smith's anvil and bench, the herb garden),
    no giant oak on the knolls (two frame the village from the far side), four lanterns on the heart-oak.
  - **Waters**: the Whisper and the brook bend (the brook's steep far bank follows its line); the Blackwater
    has bays; Rookfall's tip is wider so the Whisper pours into it (**the Whisper's Fall**: falling drops,
    faint streaks, spray, a lookout with a lore stone and a chest).
  - **New places**: the **Deer Meadow** (a herd, two old snares, a hunter's stand with a chest up its
    ladder); the **High Canopy** as five giants round the **Mirror Pool**, a rope walk from one's top to a
    shelf on another that only the walk reaches (the canopy shard is there now, a spitter guards it); the
    **Rook Pillar** (a rock column a running jump from Rookfall's east rim, a chest and a rooks' nest); the
    **Bat Roost** (a cleft in the East Woods' cliff, two bats, a chest); the **Fallen Giant** (a trunk
    across the Whisper: a secret way over, a chest in its roots); the **Drowned Shrine** (an island in the
    Blackwater: a glowing arch, lore, a chest; stepping stones with shallows between); the **Withered
    Wood** on the Warden's heights (dead trees, thorns, two spitters, Ser Aldric's cairn, lore and a chest);
    the **Mushroom Dell** (giant glowing mushrooms, a fairy ring round a chest); the **Charcoal Kilns**
    (smouldering kilns, the burners' hut taken by goblins, a chest, a lane from the road). The **Ring of
    Oaks** stands in a clear meadow, its oaks set back so the ring and altar read from above.
  - **Fixes found on the way**: the reach check counted thin posts (bridge rails, lamp posts) as filling a
    cell, so it called the inn's knoll unreachable (the knight walks the bridge fine); it now ignores posts
    that thin, and models the knight's running jump (gaps of up to two cells; 7.8 m/s up, gravity 26, 5.2
    m/s run carry him about 3 m). Realm 1's report is unchanged by both (no new bypass or escape). The
    heights' pine scatter now keeps clear of foes' posts too (one had landed on a ravine spitter). Deep water
    stays unjumpable (the Thornstag's leap would otherwise clear rivers and realm 1's moat), so the shrine's
    stones have shallows between; every step there and onto the Fallen Giant is within PLAYER.stepUp.
  - Checks: new `treasures2` (each new place reached as a player would, all nine new chests pay: 700 coins,
    five power-ups); `wood` updated for the new bridge and brook; reach and spawns in both realms clean;
    the tour at 60 fps everywhere (113-198 draw calls, 262k-482k triangles). Screenshots: `shots/g16b-*.png`,
    overhead map `shots/map-forest.png`.
  - Full suite: 43 reports, all read, no errors. `border` once found the warhorse more than 4 m from the
    knight after the crossing: the game sets it down 2.2 m away and it starts wandering after 5-10 s, so
    `border` and `travel` now check where it was set down (its home), not where it has ambled to.

- 2026-09-28: **Group 16, people, quests and secrets.**
  - **Hollowbough's folk** in hooded greens and browns: Alder the Reeve (the way to the Warden: main
    quest step 2), Moss the innkeeper (flasks), Bryony the thorn-smith, Ash (his sister is missing),
    Old Nettle in her glade (the stag, the oaks), and the **old owl** on a snag at the foot of the ramp
    into the village: one hint a talk, the next each time. Built by hand, not with `deadTree` (which
    rolls the builder's dice and offers the perch to a wild owl).
  - **The sword past level 3**: the thorn-smith sharpens (levels 1 to 3, as in realm 1) and tempers
    (level 4 for 330, level 5 for 440; +15% a level, so x1.90 and x2.05). Realm 1's smith still stops at 3.
  - **A Sister Past the River**: Wren is caged in the Gatherers' Clearing on the Blackwater's shore.
    Three blows break the cage; she gives a traveller's purse (40) and walks home along the lane;
    Ash gives his savings (30). Saved: after a reload the cage stays broken and Wren stays home.
  - **The Ring of Oaks**: a three-wave trial (goblins and a snarer; a shield, an archer, a snarer and a
    spitter; an elite thornback, a shaman, a goblin and a bomber) for the **Heartwood Seed** (one more
    heart, filled at once) and 100 coins.
  - **Secrets**: three Moon Shards (fen, vine ledge, canopy root top: a heart); a niche under the
    Overhang's rock, walled on three sides and sealed by a cracked rock, with a chest (110, Giant
    Slash); nine chests in all (the vine ledge, the niche, a root top, the grove, the fen, the gorge
    rim, the chasm's east bank, the glade, the goblins' hoard), a third lore stone, pots and barrels.
  - **Main quest** in seven steps: find Hollowbough, talk to the Reeve, cross Rookfall, through the
    Thorn Ravine, open the Warden's gate (group 17), defeat the Warden, free.
  - **Fixes**: a goblin at the foot of the Overhang stair started inside the moonfire (found by
    spawns2 after group 15). The wood's scatter now keeps 1.3 m clear of every foe's and animal's
    post, so trees and rocks can't land on them however later changes shift the scatter (they had,
    twice). The spawns check exempts any caged or perched NPC instead of Tam by name.
  - Checks (new): `folk`, `sister` (with a reload), `oaks`, `secrets2`. Also run: typecheck, reach and
    spawns in both realms (clean). Screenshots: `shots/g16-*.png` (owl, cage, niche, ring, glade, reeve).
  - Full suite: 42 reports, all read, no errors. `travel` had checked "no chests at all in Whisperwood" to
    mean "none of realm 1's"; now that the wood has its own, it checks for realm 1's ids (passes).
  - For group 18: the Ring of Oaks reads as more forest from above (the crowns hide the ring).

- 2026-09-28: **Group 15, climbing and the Thornstag.**
  - **The Thornstag** (the prototype's second mount): held in the Warden's thorns in the Stag's Thicket, a
    ring of briar west of the Ring of Oaks with a lane to it. Three blows cut the three knots; it shakes
    itself free (quest "The Bound Stag", saved with what the knight carries, so it comes to every realm).
    On its back: attack gores with the antlers, guard raises a thorn shield (0.9 s: knocks arrows and
    darts away, pricks what's close), special is a thorn burst (a ring that hits all round and breaks
    shields), and a second jump in the air. It runs a little slower than the warhorse. Built on the
    warhorse's frame, so riding, poses and the rider's seat all carry over.
  - Whichever beast you rode last is the one that finds you at a far-off moonfire.
  - **Vines** down cliff faces: hold jump against them to climb and step off at the top. Two stone
    ledges under Whisperwood's northern cliffs (above the Overhang, over the Thorn Ravine) are reached
    only this way (their treasures come with group 16). `__reach` follows vines.
  - Review, found and fixed before building: the ledge faces would have sat half a cell off the vines
    (fractional bounds round outward); the thicket's opening faced away from its lane; after building:
    one goblin started in a tree the new props had shifted.
  - Checks: new `stag` (three blows free it, quest and save; gore, shield against an arrow, burst on both
    sides, double jump 2.2 m against 1.2 m), `vines` (climbs from 2 to 5 onto the ledge; a bare cliff
    doesn't), `reach2`, `spawns2`, and realm 1's `ride` and `horse`; screenshots of the bound stag and a
    vined ledge.

- 2026-09-28: **Group 14, Whisperwood's foes and hazards.**
  - Each realm colours its foes: in the Old Wood the goblins wear the prototype's forest greens and mossy
    cloth, the skeleton archers are moss-grown with yellow-green eyes (`setFoePalette`).
  - New foes (numbers in `config.ts`): the **Thorn Spitter** (the prototype's forest creature: rooted,
    rears back and lobs a hard seed where you're heading, snaps if you come close); the **Snarer** (a
    goblin with a bola: no damage, but you're **Snared**); the **Thornback** (a boar grown over with
    thorns: charges like the armored boar, and striking it before it's stunned pricks you, a shove and
    25 stamina; parry it or let it charge into a tree first).
  - New effect **Snared** (1.3 s): no walking, rolling, jumping or dashing, but you can swing and block; a
    flask frees you; never on horseback. HUD row and first-time tip like the others.
  - Hazards: **snare traps** glinting in the grass beside the paths (a heart and snared; a blow springs one
    safely); the **Thorn Ravine**'s three strips where thorns rustle, then burst for a moment (a heart and a
    shove, once per burst; foes caught in them are hurt too).
  - 35 placed foes: the grove, the canopy, the east woods, both ends of the Rookfall bridge, the lane,
    the gatherers' clearing, the ravine, the Overhang, the Mossfen. None by the arrival or in the village.
  - Review, found and fixed: a spitter's seed went through the arrow code and could maim like an arrow
    (now only real arrows maim); eight foes started touching trees or cliff edges (moved beside the paths).
  - Checks: new `foes2` (a spitter's seed costs hearts, a snarer's bola snares and the HUD shows it, a
    thornback pricks unstunned and not stunned, one heart per thorn burst, a trap bites and snares, a
    blow springs one), `spawns2` (54 checked, none bad); the full suite: 36 checks, all as before in
    realm 1, no errors.

- 2026-09-28: **Group 13, Whisperwood's land** (no foes or people yet: groups 14 to 16).
  - The map (`src/world/realm2.ts`), laid out from the prototype's forest level: the thorn road comes over
    the brook by a stone bridge to the Warden's Stone (south-east); the Old Grove's ancient oaks; Hollowbough,
    four treehouse knolls round a black pond with the heart-oak on its island, joined by rope bridges; the
    High Canopy, giant trunks whose roots step up a metre at a time; the east woods and the rope bridge over
    Rookfall Chasm; the Thorn Ravine, a shelf under the northern cliffs above the Blackwater; the Overhang
    and its stair; the Warden's Hold round the Great Tree, ringed by thorns (its gate comes in group 17);
    west, the Ring of Oaks, the herbwife's glade and the Mossfen (no path: found by leaving the track);
    past the Whisper, the gatherers' clearing. Four moonfires, two signs, two lore stones with the
    prototype's lines. A green-teal night with a smaller green moon, and a gold-green dawn.
  - Edges: the Old Wood's heights north and west, the gorge east (the same one as realm 1's), the brook
    south with a steep far bank; nothing tall on the near sides.
  - New props: giant oaks, rope bridges (planks over two cells, rails you can't slip between), the Great
    Tree in the Hold. Giant crowns fade when they stand between the camera and the knight, like roofs.
  - Review, found and fixed: the crowns hid half the screen (they fade now, and are built from smaller
    leaf clusters); two village rope bridges ran over dry pond-edge land (an invisible wall under them:
    moved inward over deep water); the chasm bridge covered one cell, so the knight fell off it (bridges now
    run along cell boundaries); knoll oaks and lamps stood on bridge landings; a one-cell gap let you round
    the Blackwater past the ravine; the gorge's rim ran out of the world north and south, and the brook's
    far bank could be reached round the stone bridge's rail (the rim stops, the bank is steep); two
    squirrels started inside trunks; the grove and the fen were overgrown; phones get a third fewer trees.
  - **Also a bug in both realms:** falling into a gorge or chasm could put you back on its floor (you
    landed there while the fall faded, and that counted as safe footing), then fall again and again. Safe
    footing is now never below -5.
  - Checks: new `wood` (across the chasm bridge and a village bridge without dropping; a step off the
    chasm's edge costs exactly one heart and puts you back on the rim; the brook's far bank can't be
    reached), `reach2` (Whisperwood: nothing unreachable, no way out), `spawns2`; `reach`, `travel`,
    `border`, `menutravel`, `death`, `ride`, `horse`, `controls`, `moves` in realm 1; a tour of 18 stops
    (`tests/tour2.js`: 60 fps, 95 to 164 draw calls, 340k to 590k triangles); screenshots of every area.

- 2026-09-28: **Group 12, the way to Whisperwood**, and travel from the pause menu.
  - **The pause menu has "Travel to <realm>"** between Resume and Quit (asked for): it crosses to the
    other realm whether or not either is finished, coming out at your last lit moonfire there (or where
    the road from here comes in).
  - **The thorn road** (realm 1's north-east corner): the border hills end at the old lodge and a level
    shelf runs north along the gorge's rim (the drop on the near side, so nothing hides the knight). A hedge
    of the Warden's thorns grows right across it: swords and heavy blows only make it spring back; a
    warhorse's charge tears through, the Goblin King alive or not (kept with the broken walls). Past it
    the road runs into an arch of thorns lit green-gold from within, the roots of the Great Tree beyond,
    and over into Whisperwood; the same road brings you back to its mouth. A sign at the lodge, two new
    lines from the Old Warden (the other warden, the thorns), a quest "The Thorn Road", a region name.
  - New props (`src/world/wood.ts`): the Warden's briar (green canes, bone-pale thorns, red berries, glowing
    sap), thickets, the Great Tree.
  - Review, found and fixed: the thorns were dark brown on dark ground and didn't read (recoloured with the
    prototype's thorn colours, denser, with glowing sap); the Great Tree, meant as a landmark on the
    horizon, never showed: in this view a 30 m tree shows only its trunk, and unexplored land is misted
    (moved to the road's end so its roots, low pods and drifting seeds are in view, and landmarks are never
    under the mist); at the road's first end the camera could see past the world's edge into black
    (shortened by 6 m); the Warden's longer talk ran the `talk` check out of time (given 32 s).
  - Checks: new `border` (hedge holds against a sword and a dash strike, a charge breaks it with the King
    alive, the road leads to Whisperwood and back to its mouth with the hedge still down), `menutravel`
    (menu to Whisperwood and back to the lit moonfire); `reach` (125 more reachable cells, nothing
    unreachable, no way out; before the hedge breaks the border is unreachable, as it should be),
    `spawns`, `travel`, `talk`, `pad`, `farm`; screenshots of the hedge, the road, the tunnel end.

- 2026-09-28: **Group 11, groundwork for several realms.** Nothing in realm 1 looks or plays differently.
  - Realm registry (`src/game/realms.ts`): each realm's map, outskirts, story module, quests and light.
    One realm is built per page load; `?realm=forest` picks one (tests, and a way in before the borders
    exist); with `?debug`, N and B cross to the next or previous realm. A border crossing saves, fades,
    reloads with a travel card ("Blackpine → The Old Wood") and comes out at the other end.
  - Save version 2: what the knight carries at the top, each realm under `realms.<id>`. Version-1 saves
    migrate with every field kept (the Crest becomes `relics: ['crest']`).
  - Moved out of `realm1.ts` into `src/world/realm.ts`: the realm types, the ground tests, tree scatter,
    lantern rows, the detail pass (scatter, lily pads, wildlife, owls). Out of `game.ts` into
    `src/game/story/castle.ts`: levers, the cage, cleared groups, special talks, region triggers, the
    King's lines, victory text. Realm data instead of hard-coded numbers: arrow slits, chandeliers, the
    boss arena, camp drums, the inn's tune, title camera, debug spots, the trial (waves, relic, purse).
    Quests are per realm. Whisperwood is a bare stub for now (group 13 builds it).
  - Review: all 30 checks ran; every realm-1 report matches an untouched baseline run (same reachable
    cells, spawns, rigs, light counts). Found and fixed in my own work: loading a save could stash a blank
    realm over the loaded one (split `view` from `select`); a crossing could let a late timer or the
    page-hide save write this realm's data into the next (all writes stop once a crossing starts); the new
    migration check stood the knight where a thief bat could take coins (moved to the hearth).
  - Checks: new `migrate` (a real version-1 save, every field compared) and `travel` (to Whisperwood and
    back: card, arrival, horse, coins, both realms kept). `tools/shot.mjs` takes `AFTER=` scripts to follow
    a reload. `review.js`, `trial.js` and `playthrough.js` read the new save layout.

- 2026-09-28: Group 10, fresh review (a screenshot tour of every area, a 2-minute random-play soak, reading the flow code). Found and fixed:
  - **High:** pressing E through a conversation restarted it (the press that closed it opened it again), so a keyboard player couldn't leave a talk (or a lore stone) with E. The press that closes a dialog, a reading, the pause menu, the story or the death screen now goes no further; Enter and Space page through talks too, and a pad's A, X or Y confirm as the README says.
  - **Medium:** foes that started inside things: a bomber inside the river camp's tent (drawn as a red see-through outline), a goblin standing in its campfire, an archer in a Gnasher's Camp tent, a marsh darter in a tree, and five more touching posts and fences. Chickens started in the Warden's front step, and the random wildlife could start inside a tower or a rock (it now checks).
  - **Medium:** with a gamepad, every prompt and tip still named keyboard keys ("E Talk", "Tap Right click to roll", Q beside the flasks). They now follow the device in use (Y, B, LB...) and switch as soon as you pick up the other one; the pause menu gets a gamepad controls list (it showed the keyboard's, though the README said otherwise).
  - **Medium:** mashing E through the smith's lines bought a sharpening (80 coins) by accident, because the answers appear with the paid one selected. Keys and taps now only pick an answer after a short pause (each mashed press or tap restarts it). The lore card's "Press E or tap to close" now names the right key or button.
  - **Low:** the arrow keys move the knight too (and pick answers in talks).
  - Also checked, no change needed: load time (ready ~0.3 s after the scripts), draw calls at 25 stops (96 to 237 on desktop and phone), the coin economy (chests 720 + quests 200 + kills against 770 of upgrades), the production build.
  - Checks: `tests/spawns.js`, `tests/talk.js`, `tests/pad.js` (fakes a pad), `tests/monkey.js` (not in `npm test`: it takes two minutes). The tour (`tests/tour.js`) now counts a whole frame's draw calls.
- 2026-09-28: Group 9, draw calls and stutters: each character's parts are merged into one skinned mesh (plus one for glowing bits and one for the see-through silhouette), so the goblin camp went from 556 to 224 draw calls on desktop and 489 to 196 on a phone, and game code from 7.0 to 5.55 ms per frame there. Coins, hearts and "!" marks share their materials and frame quads, so a coin drop no longer costs a ~27 ms frame (now a normal ~7.5 ms one). The review caught two slips before they shipped: the knight's see-through silhouette was switched off, and a removed foe kept its bone texture; both fixed. Check: `tests/rigs.js`. The runner now takes check names (`npm test -- bats economy`).
- 2026-09-28: Group 8, small fixes: the Seven Stones journal says "Stand at its altar and face the trial"; the cracked wall only chips from a blow aimed at it (spins, dashes and plunges still hit all round); dead archers' aim lines are removed; Tam walks home along the camp road instead of through tents and trees; debug key 1 goes to the real start. Check: `tests/menus.js`.
- 2026-09-28: Group 7, controls and menus: key names in tips, prompts, the HUD and the pause menu follow the keyboard's layout (AZERTY shows ZQSD, A for the flask); a mouse button released outside the window can't leave an attack or block stuck; the title menu works from the keyboard (arrows or W/S, Enter, Space or E) and the pause menu from the keyboard and a pad (up/down, A or Y to choose, B to resume). Checks: `tests/menus.js`, `node tools/shot.mjs "shot"` + Enter.
- 2026-09-28: Group 6, performance: characters cast moon shadows only near the knight (blob shadows everywhere; -150 draw calls at the camp, game code 8.2 -> 7.0 ms per frame there); idle foes far from the knight and the view skip their frame; the shaders for firepots, rings, orbs, sword arcs and pickups are compiled at load (the first-use freeze went from ~170 ms to a normal frame); phones get half the extra wildlife. Particles turned out cheap (0.08 ms), so they were left alone. The main remaining cost is character draw calls (each body part is its own mesh).
- 2026-09-28: Group 5, economy: the Seven Stones' foes drop no coins and the win pays 90 once (dying and retrying can't farm it any more; the elite's power-up and mid-fight hearts are unchanged); a thief bat's stolen coins come back as they were, never multiplied by the combo; an arrow that hits the horse doesn't maim the rider. Check: `tests/economy.js`.
- 2026-09-28: Group 4, phones: warnings (the cracked wall, "strike the cage with your sword", "Enemies are near" at a moonfire) show as a banner on phones; the wayshrine tip names the gold button instead of E; the quest note moves to the top right on short screens so it can't sit on the area name; phones held upright see ~14 m across instead of ~6 m (the pixel size follows the shorter side); in portrait the area title sits below the HUD and tips wrap above the buttons; tips never block the thumb stick; the pause menu keeps Resume and Quit pinned in reach while the rest scrolls.
- 2026-09-28: Group 3, never lose progress: "New journey" asks first ("No, keep my journey" is the default); a chest's coins count the moment it opens and are saved with it (the coins that spill out fly to the knight as the show); the kill count is saved for the victory screen (older saves start from the foes already felled). Checks: `tests/progress1.js` then `tests/progress2.js` with the same `PROFILE`.
- 2026-09-28: Group 2, pause, focus and time: timers (Tam's dialog, the hall-door cutscene, the victory screen, respawns) and cutscenes wait while paused; switching to another window, tab or app pauses the game, and the sound sleeps while the page is hidden; the music skips beats it missed instead of playing them all at once; the world holds still behind the victory screen. Check: `tests/pause.js`.
- 2026-09-28: Group 1, flasks, hearts and effects: a flask cures maim, poison and burn even at full health, and on horseback too; pressing it with nothing to fix says "not hurt" (or "no flasks left") instead of silently doing nothing; hearts stay on the ground until you're hurt; the effect tips read right on phones ("Drink a flask (the flask button)"). Check: `tests/flask.js`.
- 2026-09-28: Detail pass and village rework.
  - Graveyard: headstones of every age (slab, round, cross, Celtic cross, obelisk, broken), stone coffins, two iron-railed plots, a weeping angel, candles and lanterns, an open grave with a spade, bones, a weathered picket fence, a lych-gate, blue wisps; two barrows with rune-sealed doorways and a dolmen in the Barrow Fields.
  - Everywhere: a map-wide scatter (flowers, ferns, loose stones, stumps, fallen logs, mushrooms, reeds) by what grows on each tile, out to the land beyond the edges; pebbled paths and stone edges on every road and trail; lily pads on all still water; squirrels, foxes, deer and owls (which watch the knight and fly off) spread across the map; birches.
  - Buildings: every house now has timber studs and braces, shutters, door frames with a step and a hood, a range of plaster washes, flower boxes, chimney caps and moss; options for stone walls with dressed corners, a jettied second storey and a lean-to woodshed. Fewer windows lit (it's late).
  - Keepsfoot re-laid out with a clear order: the road from the bridge climbs the ramp into a short street along the stone smithy's front (no more walking into a back wall); the smithy has an open forge; a two-storey stone Elder's hall faces the square; a chapel with a bell tower stands by the north road with its own path; the tavern has a porch, lanterns and dormer rooms; a market stall, hanging signs, a hitching rail, a trough.
  - Review fixes: the forge moved to the smithy's east side so it's the first thing you see from the ramp; the workbench moved to the Warden's front yard (it was behind the house); bones toned down (they read as white check marks); flower heads faintly self-lit so their colour shows at night; bigger owls; pale smoke from the barn and the stew pot (dark smoke was invisible); a glowing stone arch among the barrows; bushes and the odd tree out in the fields; lanes to the two cottages whose doors led nowhere; solid tavern porch posts; "Talk to Old Warden".
  - Keep and structures: banners, torches and corbelled parapets on the outer walls, buttresses, dressed stones and portcullis teeth at the gate, bands and corbels on the towers; the crypt, the winch hut and the goblin camp (war drum, trophy rack, standards, spears) dressed; the raided farm has crops, a burned barn still smoking and a stew pot.
- 2026-09-27: Pathways between zones. Seven new footpaths (Warden's gate; wayshrine to the
  Seven Stones and on to the river camp; start to the raided farm; graveyard gate past the
  farmhouse and over the ford into the farm; to the pier; to the Overlook stair). Rule:
  places that are there to be found (marsh, island, Hollow) get no path. Also: the ford's
  bank was a ledge too high to climb out of the water; outskirts scenery no longer lands
  on paths.
- 2026-09-27: Balance update: status effects (maim, daze, burn, poison), harmless coin-thief bats, hammer brute, firepot thrower, bog darter, goblin shaman, knockdowns, tuning table in `src/config.ts`.
- 2026-09-27: Review fixes: effects pause in dialogs, no stun-lock, light leak, fire out on horseback, ranged foes walk home, courtyard trimmed to eight, trial uses the new foes, tips remembered.
