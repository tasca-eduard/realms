# Eight Realms: The Moonlit Keep

An isometric remake of Eight Realms. Realm 1: a knight crosses a moonlit countryside, frees a
captive, lowers the keep's drawbridge and dethrones the Goblin King. Realm 2, Whisperwood (the
prototype's second realm), is reached on foot along the thorn road; see BOARD.md. It runs in the browser, on desktop and
on phones.

## Run it

```
npm install
npm run dev
```

Open http://localhost:5173.

**On your phone:** keep the dev server running and put the phone on the same Wi-Fi.
Vite prints a `Network:` address when it starts (something like `http://192.168.1.20:5173`).
Open that on the phone. The game goes fullscreen and asks for landscape when you press Begin
(held upright it still plays, with a taller view).

`npm run build` makes a static copy in `dist/` that any web host can serve.

## Controls

| Action | Desktop | Phone |
| --- | --- | --- |
| Move | WASD or the arrow keys | Left thumb (the stick stays where you first touch) |
| Aim | Mouse (attacks, rolls and blocks go where you point) | Automatic: the nearest foe roughly where you push |
| Attack | Left click; click again to combo (the third hit breaks shields) | Red sword button |
| Charged spin | Hold left click, release; blue means full (two hits, breaks shields) | Hold the sword button |
| Down-stab | Left click in the air; bounces off what it hits | Sword button in the air |
| Guard | Right click: **tap** to roll, **hold** to block, press just before a hit to **parry**; in the air, a dodge | Shield button (same) |
| Jump | Space (up onto ledges about a metre high) | Blue arrow button |
| Special | F, costs half the blue bar: **dash strike** when moving, **sword wave** when still, **plunge** in the air | Star button |
| Talk, open, rest, read, ride | E (Enter or Space also page through a talk) | Gold button that appears with the prompt |
| Drink a Moon Flask | Q | Flask button |
| Pause, settings, journal | Esc | Pause button at the top |

A gamepad also works: left stick moves, right stick aims, X attack, B guard, A jump,
RB special, Y interact, LB drink, Start pause. In menus and dialogs the stick picks and
A, X or Y confirms. The pause menu lists the controls for whichever device you are using.

**On the warhorse** (it waits by the King's Road; E to ride and to get off): attack kicks,
guard rears and stomps, special charges, galloping into foes tramples them. Hits land on
the horse first; if its three pips run out you are thrown and it bolts, coming back later.
It won't go indoors, and it finds you when you rest at a far-off moonfire. Resting heals it.

**The Thornstag** (Whisperwood: cut it free of the Warden's thorns west of the Ring of Oaks;
once freed it goes with you to every realm): attack gores with its antlers, guard raises a
thorn shield (knocks arrows and darts away, pricks what's close), special is a thorn burst all
round, and jump twice to leap again in the air. Whichever beast you rode last is the one that
comes when you rest at a far-off moonfire.

**Vines** hang down some cliff faces in Whisperwood: hold jump against them to climb.

**Explore mode** (the pause menu's switch): to look round a realm freely. The knight flies over
everything, through walls and trees, and nothing can hurt him or notice him; the mist lifts.
Hold guard to go faster, click a spot to jump there, turn the mouse wheel to zoom out. Nothing
is picked up and no quest moves on while flying; switch it off to land on the nearest open
ground.

**Combat details:** hits build energy and a combo; at 5, 10 and 15 hits foes drop 2, 3 or
4 times the coins. Blocking drains stamina while held; rolling needs stamina ("tired"
when you're out). A parry stuns, slows time and gives stamina and energy back. Enemies
flash before they strike; ones you could see from where the knight stands show as a red
outline when trees, walls or roofs hide them from the camera. Knee-high walls and fences
don't block sight, for you or for them.

## Foes and effects

Some blows do more than cost a heart. What's on the knight shows under the flasks, with a
bar for the time left; the first time each one lands, a tip explains it (tips are
remembered on this device). Effects hold still while you read, talk or watch a cutscene.

| Effect | What it does | How to deal with it |
| --- | --- | --- |
| **Maimed** | 40% slower on foot for 3 s | Drink a flask (works at full health and on horseback), or rest |
| **Dazed** | Can't act for about a second (knocked down: a little longer, flat on your back) | Parry the blow, or roll clear of the charge. Once dazed, you can't be dazed again until 3 s after it ends, even if a hit cuts it short |
| **Burning** | Costs a heart after 1.5 s. The count pauses while you're dazed, so you always get your chance to roll | Roll, or step (or ride) into water, before then |
| **Poisoned** | Stamina refills at half speed for 6 s | Drink a flask (works at full health and on horseback), or rest |
| **Snared** | Held fast for about a second: no walking, rolling or jumping, but you can still swing and block. Never on horseback | Wait it out, or drink a flask |

| Foe | Where | What to know |
| --- | --- | --- |
| Goblin | Everywhere | Flashes before it swings |
| Shield goblin | Camp, marsh, bailey, courtyard | Blocks from the front until the third hit of a combo breaks the shield |
| Skeleton archer | Towers, camps, the farm | Shows a red aim line; its arrows **maim** 30% of the time. (The keep's arrow slits glint before they fire and don't maim.) |
| Bat | Barrow Fields, woods, marsh | Harmless but a pest: a swoop shoves you, costs stamina and interrupts what you're doing (a flask you were drinking isn't used up). Some **steal coins** and fly off; catch them before they escape and the coins drop |
| Armored boar | Camp, lodge, courtyard | Paws the ground, then charges; a charge that hits **knocks you down**. Hits into a wall stun it |
| **Hammer brute** | Camp, bailey winch, gorge, courtyard | Slow, can't be interrupted while it winds up, and stops turning just before the blow: step aside. A hit may **daze**; blocking it costs over twice the stamina. A parry stuns it for almost two seconds |
| **Firepot thrower** | Farm, camp, bailey, overlook, river | Keeps its distance and lobs a pot where you're heading; a red ring marks the spot. The flames **burn** you, and they also scorch other goblins |
| **Bog darter** | Sallow Marsh | Blowpipe darts do no damage but **poison** |
| **Goblin shaman** | Barrow Fields, camp, lodge, courtyard | Chants to heal nearby goblins and make them faster (they glow red), and vanishes when you get close. Kill it first |
| Goblin King | The great hall | Charges **knock you down**; enraged, he calls in a brute |
| **Thorn Spitter** | Whisperwood: the grove, the canopy, the ravine | Rooted: rears back and lobs a hard seed where you're heading (a heart), and snaps if you come close |
| **Snarer** | Whisperwood | Whirls a bola and throws it: it does no damage but leaves you **snared**. A raised shield stops it |
| **Thornback** | Whisperwood: the grove, the east woods | A boar grown over with thorns: charges like the armored boar, and striking it before it's stunned **pricks** you (a shove, stamina). Parry it or let it charge into a tree first |

Foes that lose you walk back to their posts and heal. Golden foes (rare) drop ten times
the coins; elites are bigger, tougher and drop a power-up.
Every number here (health, speed, wind-ups, chances, durations) is in `src/config.ts`
(`FOES`, `EFFECTS`, `PLAYER`), so balance can be tuned in one place.

## The realm

- **The King's Road**: where you arrive, with the warhorse. The Old Warden's homestead
  stands in the meadow by the road (he has a job for you: raiders on the southern fields).
  Light the moonfire at the wayshrine; if you fall, you rise at the last moonfire you lit.
- **Keepsfoot**: the village. The road from the bridge climbs into a short street past the
  smithy's open forge to the square: the tavern (the innkeeper sells Moon Flasks), the Elder's
  hall, the smith (he sharpens your sword), the market stall, and the chapel by the north road.
- **Blackpine Wood and Gnasher's Camp**: someone is locked in a cage there.
- **The Outer Bailey**: the winch that lowers the drawbridge (arrow slits watch it).
- **The Moonlit Keep**: clear the courtyard garrison to open the great hall and the
  Goblin King. His crashes can bring the chandeliers down, on you or on him.
- **Off the road**: the Seven Stones (a three-wave trial for the Knight's Crest relic and 90
  coins; its foes drop nothing, and falling resets it; the last wave is a brute, a shaman, a
  goblin and an elite boar), the
  Old Lodge (an elite beast), the Barrow Fields and its graveyard, the Overlook (a ruined
  watch post up the Pilgrims' Stair), the Hollow (a cave in the cliff below it),
  Mirrormere with its pier, the Sallow Marsh, the raided farm, a goblin camp on the
  river bank, and the gorge lookout.
- **Moon Shards**: three are hidden: by still water, behind old stone, above a long
  drop. All three give an extra heart. A cracked wall breaks to a heavy blow (finisher,
  full spin, dash strike or plunge).
- **Power-ups** (20 seconds) come from chests, elites and the odd pot: Fire Blade,
  Wind Boots (double jump), Magnet, Bubble (blocks two hits), Giant Slash. Golden foes
  are rare and drop ten times the coins.

## Whisperwood (realm 2)

- **The Warden's Stone**: where the thorn road comes in over the brook from Blackpine.
- **Hollowbough**: a village of great home trees round a lake, the Heartpool (a broad water with
  an arm reaching north-east and a bay to the south-west): doors and lit windows in the trunks,
  treehouses up in the crowns, lanterns strung between the trees, and the Heart Oak at the back of
  a broad island, a green in front of it round the gathering fire, reached by two rope bridges.
  Alder the Reeve, in the Heart Oak, knows where the Thorn Warden holds out; Moss the innkeeper
  sells Moon Flasks; Bryony the thorn-smith sharpens swords and, past realm 1's smith, tempers
  them twice more (levels 4 and 5, +15% each); Ash's sister Wren is missing; the old owl on the
  snag where the road comes in gives a hint each time you ask. The village goes about its day:
  a fisher on the jetty, washing at the bay, children chasing round the fire, the old man by it,
  a gardener, a carrier on the lakeside path, the watch at the east bridge, the beekeeper at her
  hives by the Whisper, the weaver at her door.
- **The Gatherers' Clearing**, past the Whisper on the Blackwater's shore: Wren in a goblin cage.
- **The Ring of Oaks**, west of the village: a three-wave trial for the Heartwood Seed (one
  more heart) and 100 coins. Old Nettle lives in the glade south of it.
- **Moon Shards**: three more, among the fen's pools, up where the vines climb, and on a giant's
  shelf in the High Canopy that only the rope walk over the Mirror Pool reaches (another heart).
  A cracked rock under the Overhang hides a niche.
- **Rookfall**: a gorge the Whisper falls into, winding north under the East Woods to where the
  river goes under the rock. A rope bridge crosses it; a fall in costs a heart.
- **The Warden's Hold**, up the rock stair between two hills by the Overhang: living thorns grow
  across the top of the stair, the Thorn Heart pulsing in them; tear it out and they wither. A
  short path leads to the Great Tree; clear the Warden's garrison before the hollow at its feet,
  and the thorns across its mouth draw back. The Thorn Warden waits in the hollow (room to move:
  16 by 15 m): it keeps its distance and shoots, and every attack shows first: the volley's lines
  lie on the ground and fix before the arrows fly along them (step aside or raise your shield),
  arrows rain on spots that glow and fill up before they land (step off them), it calls in
  goblins, and when enraged makes roots burst under you (their spots fill up too). One attack at a
  time. The fight is on foot: the stag waits outside.
- **The Stag's Thicket**: a hollow among mossy rocks in the Deep Wood, where the Warden's keepers
  guard the bound stag.
- **Off the paths**: the Deer Meadow's hunter's stand, the Whisper's Fall into Rookfall, a rock
  pillar in the gorge a running jump from the rim, the Rookery in the pines north of it (the
  rooks' hoard), the Bat Roost in the north cliff, the Fallen Giant lying across the Whisper, the
  Drowned Shrine out on the Blackwater's stepping stones, a fallen knight's cairn in the Withered
  Wood and the Warden's Seat behind the Great Tree (both on the Warden's heights), the Mushroom
  Dell, the kingfisher's bank of the east river, and a goblin camp by the brook. Each hides a
  chest, as do the Charcoal Kilns down a lane south of the village (goblins have taken them).

The **pause menu** has a map of the eight realms (the prototype's): the realms you have been to
show their land, whether their tyrant has fallen, Moon Shards and chests found, and a click on
one travels there; the next realm is a rumour, the rest unknown. Below it, the **journal**
lists your quests; the current step of the main quest shows at the top right.

**Finding your way.** Roads and trodden footpaths link every place with a purpose: the
village, the camps, the keep, the homestead, the stones, the farms, the ford, the pier
and the Overlook stair. Places that are there to be found (the Sallow Marsh, the island
in Mirrormere, the Hollow) have no path: leave the track to find them.

Unexplored land stays under mist (fog of war) until you walk near it.

**Saving.** Progress saves on this device (browser storage) whenever something changes
and when you close or switch away from the tab. What the knight carries (coins, flasks, sword,
relics) goes with him from realm to realm; each realm keeps its own last moonfire, chests
opened, walls broken, shards, quests, explored land, and which placed foes you have defeated:
**a cleared area stays cleared**. Saves from before realm 2 (version 1) load with everything kept.
Foes that were only wounded heal and go back to their posts when you fall. **New journey**
on the title screen starts over.

There are no invisible walls. Past the old map edge the land goes on until something
real stops you: mountain cliffs to the north and west, a gorge east of Blackpine (fall in
and you lose a heart), the deep Mirrow river along the east and south (the King's Road
bridge is broken), and Mirrormere to the west. Light shallow water can be waded (slowly);
dark deep water can't be entered or jumped across. The stream has a ford in the fields.

## Project layout

```
src/
  config.ts  every tuning number: the knight, the foes, the status effects
  engine/    renderer (low-res pixel pipeline, outlines, bloom, fog, fog of war),
             camera, input, lights, particles, materials, character rigs
  world/     map grid and collision, terrain and water meshes, grass, props,
             realm.ts (what every realm's map provides, shared layout helpers),
             realm1.ts (the Moonlit Keep: its map, people, foes and objects),
             realm2.ts (Whisperwood), outskirts.ts (realm 1's land beyond the map edges)
  game/      game.ts (states, camera, events, boss, saving), realms.ts (the realms: map,
             outskirts, story, quests, light), story/ (each realm's story moments: levers,
             cages, cleared groups, special talks, the tyrant), player.ts (the knight's
             moveset and riding), enemies.ts (AI), models.ts (3D characters and their
             animations), objects.ts (chests, moonfires, doors, the cave wall...),
             combat.ts (arrows, waves, pickups, power-ups), mount.ts (the warhorse),
             trial.ts (the Seven Stones), hazards.ts (arrow slits, chandeliers),
             critters.ts (chickens, rabbits), quests.ts, save.ts, fow.ts (fog of war),
             reach.ts (the reachability check)
  audio/     sound effects and ambience (synthesized), generative music
  ui/        HUD, dialog, menus, touch controls
public/audio/samples/   instrument samples used by the music
tools/       shot.mjs (headless screenshots), test-all.mjs (runs every check),
             extract-samples.mjs
tests/       scripts for shot.mjs that drive the game
```

## Testing shortcuts

Add these to the URL while the dev server runs:

- `?play` skips the title and story. Add `&at=78,64` to start at a map position,
  `&god` for no damage, `&dawn` for the ending light, `&lines=200` to zoom in,
  `&realm=forest` to play Whisperwood (`castle` is realm 1).
- `?play&viewer&anim=attack0&t=0.2` shows every character model in one pose.
- `?debug` enables keys: G god mode, T teleport to the mouse, 1 to 7 jump to key places,
  N and B cross to the next or previous realm (whether or not it is finished).
- In the browser console, `__reach()` floods the map from the start the way the knight
  moves and lists anything unreachable and any spot where he could leave the world
  (`__reach(false)` checks before the drawbridge is lowered).

**Automated checks.** With the dev server running, `npm test` drives the game in headless
Microsoft Edge through every scripted check and prints what each one found: reachability,
spawn spots (nothing starts inside a tent, a rock or a fire), controls, the full moveset,
a fight, death and respawn, riding, the cracked wall, the trial, the Warden's quest, saved
kills, the status effects, thief bats, flasks and hearts, pause and focus (timers,
cutscenes, leaving the window, the victory screen, the music), the economy, menus and
talks by keyboard, a (faked) gamepad, each new foe in a live encounter (these depend on
chance: a run can miss an effect), effects pausing in dialogs, no stun-locks, foes walking
home, fire on horseback, the trial's waves, a light-leak soak, the merged character
meshes, the boss fight, the phone flow, an old (version-1) save loading with nothing lost,
and crossing to Whisperwood and back. `npm test -- talk pad` runs only the named
checks. Screenshots land in `shots/` (not kept).

Two longer checks are left out of `npm test`: `tests/monkey.js` (two minutes of random
play all over the map, flagging errors, NaN positions, falls through the ground and stuck
states) and `tests/tour.js` (frame rate and draw calls at 25 stops).

A check that has to follow a reload (a border crossing, a save loaded fresh) names the
scripts for the reloaded page in `AFTER` (comma-separated, `AFTER_WAIT` ms apart); see the
`migrate` and `travel` entries in `tools/test-all.mjs`.

One screenshot from the command line:

```
node tools/shot.mjs "shot&play&at=94,31" shots/camp.png 3000
MOBILE=1 node tools/shot.mjs "shot" shots/phone.png 9000 844x390 tests/mobileflow.js
PORT=5174 node tools/shot.mjs "shot&play" shots/other.png   # a dev server on another port
node tools/shot.mjs "shot&play&god" shots/village.png 1500 924x700 tests/villagemap.js   # top-down plan of Keepsfoot
node tools/shot.mjs "shot&play" shots/monkey.png 124000 1280x720 tests/monkey.js      # random-play soak
```

## Known limits

- **Sound has never been heard during development.** The headless test browser is muted,
  so effects, ambience and music are untested by ear. Volumes are in the pause menu.
- **Phones were tested in an emulator only.** Touch controls and layout work there;
  real-device feel and frame rate are unknown. Phones get lighter settings (fewer lights,
  a smaller shadow map, less grass, a coarser pixel grid).
- **Balance is tuned by feel, not playtested**: damage, enemy counts, prices and the boss.
- **Gamepads were only tested with a faked pad** (buttons named as on an Xbox pad).

## Credits

Music uses instrument samples from the FluidR3_GM soundfont by Frank Wen (CC BY 3.0),
taken from the original Eight Realms. Everything else is made in code.
