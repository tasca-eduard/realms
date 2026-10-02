# Eight Realms: The Moonlit Keep

An isometric remake of Eight Realms. Realm 1: a knight crosses a moonlit countryside, frees a
captive, lowers the keep's drawbridge and dethrones the Goblin King. Realm 2, Whisperwood (the
prototype's second realm), is reached on foot along the thorn road; see BOARD.md. Realm 3, the Sunken
Reef, a drowned coast, lies at the foot of the Sea Stair below Whisperwood's sea cliff. It runs in the
browser, on desktop and on phones.

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
round (only it tears away the living thorns that choke the cleft to the stag's old bed), and jump
twice to leap again in the air. Whichever beast you rode last is the one that comes when you rest
at a far-off moonfire.

**Vines** hang down some cliff faces in Whisperwood: hold jump against them to climb.

**Diving** (the Sunken Reef): in his armour the knight would sink like a stone, so deep water stops
him at its edge until he wins Brassbelly's diving suit; in it he walks into the deep and down onto
the sea floor. Below the surface everything floats: jumps go higher and last longer, he sinks
slowly, walks 15% slower, and shots fly slower; nothing burns. His air (the row of bubbles under
the bars, about a minute and a half) runs down below the surface and fills again above it and in
the streams of bubbles rising from vents on the floor. Out of air he is **breathless**: slower, no
stamina back, the view closing in, but it never costs a heart. **Currents** carry a diver along
their way (ride them, not against them: one runs each way over the trench), and **columns of
bubbles** lift him to their top and give him air on the way.

**The Tide Serpent** (the Sunken Reef: cut it free of the crew's nets south of the sandbar; it stays
in the reef's waters): it swims wherever the water is deep, quicker than the knight runs. At the
surface he rides dry and jump leaps out of the water; in the diving suit the leap plunges under,
each tap of jump is a stroke up (it costs stamina), and it sinks between strokes; a ring on the
floor below shows how high it swims. Attack spits a bubble shot, guard wraps you in a bubble shell
(the next hit bursts it, not you), special stirs up a whirlpool that drags foes in and knocks arrows
away. Get off onto ground up to a metre out of the water (in the suit, anywhere). Without the suit
it won't go under, and thrown off, the sea washes you ashore (a heart); out of air on its back, it
carries you up. The warhorse and the Thornstag can't come down the Sea Stair.

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
| Goblin | Everywhere | Flashes before it swings. Whisperwood's wear bark masks and crowns of leaves and swing thorned clubs; three lie hidden in the Old Grove's bushes by the road and burst out as you pass |
| Shield goblin | Camp, marsh, bailey, courtyard | Blocks from the front until the third hit of a combo breaks the shield |
| Skeleton archer | Towers, camps, the farm | Shows a red aim line; its arrows **maim** 30% of the time. (The keep's arrow slits glint before they fire and don't maim.) |
| Bat | Barrow Fields, woods, marsh | Harmless but a pest: a swoop shoves you, costs stamina and interrupts what you're doing (a flask you were drinking isn't used up). Some **steal coins** and fly off; catch them before they escape and the coins drop. In Whisperwood the thieves are rooks (only the Bat Roost keeps bats) |
| Armored boar | Camp, lodge, courtyard | Paws the ground, then charges; a charge that hits **knocks you down**. Hits into a wall stun it |
| **Hammer brute** | Camp, bailey winch, gorge, courtyard | Slow, can't be interrupted while it winds up, and stops turning just before the blow: step aside. A hit may **daze**; blocking it costs over twice the stamina. A parry stuns it for almost two seconds |
| **Firepot thrower** | Farm, camp, bailey, overlook, river | Keeps its distance and lobs a pot where you're heading; a red ring marks the spot. The flames **burn** you, and they also scorch other goblins |
| **Bog darter** | Sallow Marsh | Blowpipe darts do no damage but **poison** |
| **Goblin shaman** | Barrow Fields, camp, lodge, courtyard | Chants to heal nearby goblins and make them faster (they glow red), and vanishes when you get close. Kill it first |
| Goblin King | The great hall | Charges **knock you down**; enraged, he calls in a brute |
| **Thorn Spitter** | Whisperwood: the grove, the canopy, the ravine | Rooted: rears back and lobs a hard seed where you're heading (a heart), and snaps if you come close |
| **Snarer** | Whisperwood | Whirls a bola and throws it: it does no damage but leaves you **snared**. A raised shield stops it |
| **Thornback** | Whisperwood: the grove, the east woods | A boar grown over with thorns: charges like the armored boar, and striking it before it's stunned **pricks** you (a shove, stamina). Parry it or let it charge into a tree first |
| **Goblin diver** | The Sunken Reef: the shallows, the gardens, the kelp, the kingdom | A goblin in a tin bucket, a copper kettle or a fishbowl, walking the sea floor with a boathook: it fights as a goblin does. A red-topped cork float bobs on the surface over it and gives it away from above |
| **Harpooner** | The Sunken Reef: the strand, the sandbar, the wreck | A line on the ground follows you while it aims, then holds still just before the throw: step off it, or raise your shield. Struck, you lose a heart and are **reeled in**: roll or swing to cut free |
| **Jelly** | The Sunken Reef: the kelp, the kingdom, the trench | Squeezes, flashing, then lunges along a line. Felled, it splits into two little ones whose stings **poison** |
| **Crab** | The Sunken Reef: the gardens, the kingdom, the wreck | Blows from the front glance off its claw, and it turns slowly: get round it, or flip it onto its back with a heavy blow. Its pinch may **maim** |
| **Eel** | The Sunken Reef: the kelp, the kingdom | Waits in its den, where nothing reaches it; lunges along a line it shows, bites, and stays out a moment: strike it then |
| **Pufferfish** | The Sunken Reef: the gardens, the kelp | A ring fills round it as it swells, then its spikes burst out. Strike it early in the swell, or while it's winded after |
| Giant clam | The Sunken Reef's sea floor | Not a foe: a ring fills, then it snaps shut on whoever stands in it (a heart; roll out). Struck while open, it gives up its pearl, once |
| **Brassbelly the Salvager** | The Sunken Reef: the lighthouse isle | A goblin a head taller than a brute, in a patched brass diving suit, swinging an anchor: slow blows he won't be stopped in (a hit may **daze**). Strike him three times quickly, or crowd him, and his valves hiss and a ring shows on the ground: his suit blows off steam all round. Roll out; a shield won't stop it |
| **Old Inkarm** | The Sunken Reef: the Ink Grotto | A giant octopus that never leaves its den. Its arms slam along lines that fill first; a ring filling under you means a grab (press attack to tear free); it inks the water dark. Its body takes blows only while its arms are down. Its chest holds Kraken's Ink (a power-up: your blows blind foes) |

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
  hall, the smith (he sharpens your sword, and sells barding: each piece one more hit for your
  mount), the market stall, and the chapel by the north road.
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
  river bank, the gorge lookout, and the Kings' Orchard gone wild behind the keep's west wall.
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
  them twice more (levels 4 and 5, +25% each); Ash's sister Wren is missing; the old owl on the
  snag where the road comes in gives a hint each time you ask. The village goes about its day:
  a fisher on the jetty, washing at the bay, children chasing round the fire, the old man by it,
  a gardener, a carrier on the lakeside path, the watch at the east bridge, the beekeeper at her
  hives by the Whisper, the weaver at her door (she wraps boots in spider silk: quicker on your
  feet).
- **The Gatherers' Clearing**, past the Whisper on the Blackwater's shore: Wren in a goblin cage.
- **The Ring of Oaks**, west of the village: a three-wave trial for the Heartwood Seed (one
  more heart) and 100 coins. Old Nettle lives in the glade south of it (her nettle tonic fills the
  blue bar faster).
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
  guard the bound stag. North of it a cleft runs into the western heights, choked with living
  thorns a sword only scratches; the freed stag's thorn burst tears them away, and the stag's old
  bed lies beyond.
- **Off the paths**: the Deer Meadow's hunter's stand, the Whisper's Fall into Rookfall, a rock
  pillar in the gorge a running jump from the rim, the Rookery in the pines north of it (the
  rooks' hoard), the Bat Roost in the north cliff, the Fallen Giant lying across the Whisper, the
  Drowned Shrine out on the Blackwater's stepping stones, a fallen knight's cairn in the Withered
  Wood and the Warden's Seat behind the Great Tree (both on the Warden's heights), the Mushroom
  Dell, the kingfisher's bank of the east river, and a goblin camp by the brook. Each hides a
  chest, as do the Charcoal Kilns down a lane south of the village (goblins have taken them).
- **Its own music**: Whisperwood plays its own versions of the moods (a flute over harp and cello in
  D Dorian, soft hand drums), and its nights have birdsong.

## The Sunken Reef (realm 3)

The sea swallowed a kingdom, and its lord still waits below: a drowned coast at night, half land and
half clear sea that the camera looks down into, the sea floor lit blue-green below the surface.

- **The Sea Stair**: past the Withered Wood, Whisperwood's heights end at a sea cliff, and a stair is
  cut down it (a path to its head from the Warden's path round the Great Tree's roots, a sign there).
  A rockfall broke its head: a jump and an air dash don't reach the blocks, nor does the warhorse;
  only the Thornstag's second leap gets over. Down the stair, the knight comes out at the **Foot of
  the Sea Stair** on the reef's strand (a moonfire); going back up, the stag waits on the landing.
- **The Strand**: dunes, marram and driftwood along the north-west shore; the crew's camp (sailcloth
  tents, nets drying, a longboat drawn up); a blowhole on a point of rock that spouts with the swell
  and throws whoever stands in it; Jetsam the castaway's cave in the north cliffs, half flooded, the
  crew's cache at its back where only a diver reaches.
- **The Lighthouse Isle**, out along the **Sandbar** (wading-deep all the way): the goblins' salvage
  yard, where Brassbelly and three of his crew fight. Felled, he drops his diving suit: walk onto it
  and it's yours. Old Wick's lighthouse stands on its rock, its lamp put out by the crew: find his oil
  (by the sunken ship's breach) and his lens (on the sea floor), climb the stair round the tower and
  light it; the fishing boats come home, and his storm lantern is yours (a light that shows the deep).
- **The Netted Serpent**, in the pool south of the sandbar: two goblins, a shield goblin and an archer
  keep it. A blow at each of the three stakes cuts a line of the nets; the third frees it.
- **The Coral Village**, on a coral shelf where the shore bulges out ("the tide took our harbour; we
  built on the coral instead"): houses on stilts, a jetty out over the deep, lamps of glass floats.
  Gannet the Harbourmaster knows how the crew go down; Dulse sells Moon Flasks at the Harbour Arms,
  an inn on stilts you walk into; Shale the Coral-smith files a coral edge onto the sword (levels 6
  and 7, +25% each); Maren the Pearl-diver's son Kip has been taken; Old Tally the Tide-reader gives a
  hint each time you ask; Old Hake sews air bladders to the suit's hose (+30 s of air each) and
  Flotsam the Beachcomber sells a lodestone (loose coins come to you from further off). The coral
  shrine on the green mends whatever carries you. The village goes about its night: the fish market,
  the boatyard, fishers on the jetty, children at ball and tag, Nipper and his crab on a string.
- **Under the sea**, going out and down: the **Coral Gardens** off the jetty, the **Kelp Forest**, the
  **Drowned Kingdom** on its terrace 4.5 m down (the plaza and its great bell, the sunken temple of the
  Lady of the Tides, the market square, the Kings' Way of coral-grown kings, the royal library, the
  treasury behind a cracked wall, the queen's gardens, the old harbour wall), the **Sunken Ship** on its
  rock (the bow deck above the water, the hold, the captain's cabin) and the **Trench**, 12 m deep, with
  the abyss in its floor (a fall in costs a heart). Old Inkarm lairs in the Ink Grotto, where the
  trench begins west of the kingdom.
- **Gull Rock**, the crew's diving rock on the trench's lip (their tarred floats lead out to it from
  the lighthouse isle): Kip in a cage, guarded. **The Whalebone Isle**, off the coral gardens (the
  village's glass floats lead there): an old whale's bones ring a giant clam, and holding the ring
  against three waves of the crew wins the Tide Pearl (whatever carries you takes one more hit) and a
  purse of lesser pearls.
- **Moon Shards**: three under the sea, where the coral grows thickest, in the kelp's dark heart and
  at the bottom of the trench (another heart). Off the paths: the Glowing Grotto in the trench's wall,
  which only a diver finds; a column of bubbles up onto a drowned tower's top; six giant clams with a
  pearl each; 33 chests and 13 lore stones in all.
- **Errands**: a message in a bottle on the beach (a map to an X of stones on the north dunes: strike
  it to dig); Brill's glowing bait (five shrimp from the gardens: from then on each Moon Flask heals
  one more heart); Pike's current race through glowing rings over the abyss; Cockle, a diver lost out
  of air in a shrinking bubble, to be led to air (his wife Merrow pays); and once the suit is won, the
  crew raid the village one night.
- **The Drowned Palace**, across the trench: the currents carry a diver to the Palace Landing (a
  moonfire) and the Tidelord's crew before his floodgate, shut fast until the great bell in the drowned
  plaza is struck. In the throne hall (vents in three corners breathe air) the **Tidelord** wakes and
  the gate drops shut. Every attack shows first: his charge's lane follows you on the floor, then
  fixes before he runs it (into a wall, he's dazed); drowning orbs drift after you (a blow cuts one
  down); he leaps onto a spot that fills under you and sends a wave over the floor (jump it); close in,
  his trident's sweep fills on the floor; he calls in his crew. Enraged, the tide turns: a current
  sweeps the floor toward the walls, turning every few seconds, its new way shown first. One attack at
  a time; a lost fight lifts the gate again.
- **Its own music**: the prototype's sea track (70 bpm, C Lydian, a celesta over a choir and harp, an
  echo), slower and lower as it gets deeper; below the surface every sound is muffled, with bubbles
  and a low drone. Its edges: sea cliffs to the north and west, the open sea to the south and east,
  its floor falling away into the deep. At the east edge the Dune Strait, the way on to the Scorched
  Dunes that only the serpent could swim, is shut for now.

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
             realm2.ts (Whisperwood), realm3.ts (the Sunken Reef; its parts in sea.ts,
             reef.ts, reeflife.ts, kingdom.ts, lighthouse.ts, seacaves.ts, seastair.ts...),
             outskirts.ts (realm 1's land beyond the map edges)
  game/      game.ts (states, camera, events, boss, saving), realms.ts (the realms: map,
             outskirts, story, quests, light), story/ (each realm's story moments: levers,
             cages, cleared groups, special talks, the tyrant), player.ts (the knight's
             moveset and riding), enemies.ts (AI), models.ts (3D characters and their
             animations), objects.ts (chests, moonfires, doors, the cave wall...),
             combat.ts (arrows, waves, pickups, power-ups), mount.ts (the warhorse),
             wares.ts (what village folk sell besides flasks and the sword),
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
  `&realm=forest` to play Whisperwood, `&realm=aqua` the Sunken Reef (`castle` is realm 1).
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
and crossing to Whisperwood and back; in the Sunken Reef, diving and air, the suit's mini-boss, its
foes and clams, the serpent's swimming, the currents and bubble columns, its people and secrets, its
economy, the palace and the Tidelord (a fair-fight check and a bot), and the Sea Stair both ways.
`npm test -- talk pad` runs only the named
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
