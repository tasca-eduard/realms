# Design rules

The user's rules for Eight Realms, gathered in one place. They come from the user's own feedback while realms 1
to 3 were built (2026-09-27 to 2026-10-02), kept since then in the project's standing notes and in the board's
plans. They are the user's taste for this game: check new work against them before building it, and again before
calling it done.

Each rule has an id (W1, V2...) so a plan, a brief or a review can name it. Under each rule:
- **Said:** the user's own words where they were recorded, with the date. Where only the rule was kept, it says so.
- **Check:** the tool, test or look that proves the rule holds. Test names are entries in `tools/test-all.mjs`
  (run one with `npm test -- <name>` while the dev server runs); see [testing](../testing/testing.md) and the
  [table of checks](../testing/checks.md).

A few rules at the end of some groups are marked **(practice)**: not stated by the user, but set during the build
and kept since, for the user's sake or the game's.

How to look at a place (used by many checks below):
- From the game camera: `node tools/shot.mjs "shot&play&realm=<id>&at=<x>,<z>" shots/<name>.png 3000`.
- From above: `node tools/shot.mjs "shot&play&realm=<id>" shots/map.png 1500 1280x1280 tools/mapview.js` (add
  `&crop=x0,z0,x1,z1` to the query to draw one part bigger).
- In the game: explore mode (the pause menu's switch, or V with `?debug`): fly anywhere, the mist lifts, the
  mouse wheel zooms out.

The camera looks from the +x+z side: screen-up is toward -x-z. So "the camera's side" of a place is its +x+z side,
and a map's far edges are its north and west (-z, -x) edges.

**Deciding.** Where the rules don't settle something, the user has handed the call over: "do what is logic and
makes sense for the story... gameplay wise you should be able to decide" (2026-10-02), and for realm 4's plan
"decide, don't ask". Decide, write the decision into the plan, and say it can be revisited.

## Contents

- [World and terrain](#world-and-terrain) (W1-W15)
- [Villages and people](#villages-and-people) (V1-V5)
- [Foes and fights](#foes-and-fights) (F1-F5)
- [Bosses](#bosses) (B1-B8)
- [Quests and story](#quests-and-story) (Q1-Q8)
- [Economy and balance](#economy-and-balance) (E1-E6)
- [Controls and UI](#controls-and-ui) (C1-C7)
- [The 40/60 aim](#the-4060-aim) (A1-A4)

---

## World and terrain

### W1. No invisible walls
The map's edges are real terrain (cliffs, a gorge, a deep river, a lake, the open sea), with fog where it makes
sense. Past the playable map the land goes on (the outskirts) until something real stops the knight. Light
shallow water can be waded; dark deep water can't be entered or jumped across.
- **Said:** the rule was kept, not the words; set during realm 1.
- **Check:** `reach`, `reach2`, `reach3` (tests/reach.js: "no way out of the world"); on a beast, `reachstag`,
  `reachstag2`, `reachserpent`. Fly along every edge in explore mode. From the ends of roads and paths the camera
  must never see past the world into black (found at the thorn road's end, 2026-09-28).

### W2. Nowhere to be stranded
No pit, ledge or pool the knight can drop into and never climb out of. A fall into a chasm costs one heart and
puts him back on the rim.
- **Said:** the rule was kept, not the words (found in review on 2026-09-30: a one-cell strip below Whisperwood's
  heights, a corner of the Mirror Pool, the moat's edges).
- **Check:** the reach checks report `traps: 0` (they also flood back from every reachable cell to the start).
  `wood` checks that a step off Rookfall's edge costs exactly one heart and puts him back on the rim.

### W3. No empty zones without a reason
Every area has foes, a quest, or scenic landscape with hidden treasure, and every area is beautiful scenery with
a character of its own.
- **Said:** "make every area have a purpose and be beautiful scenery where you can find treasures" (2026-09-28);
  "some areas are empty, they don't serve a purpose (check realm 1, I had that issue there too and it was fixed)"
  (2026-09-30).
- **Check:** `tools/emptymap.js` (with shot.mjs, like mapview): every reachable cell coloured by its distance from
  the nearest thing with a purpose; it lists the patches more than 13 m from anything. Whisperwood went from 5% of
  its ground in such patches (the worst 25.5 m from anything; realm 1 had 11%) to 0.4% (the worst 15 m). `corners2`
  checks that each once-empty corner pays.

### W4. Zones read as zones
As in realm 1: each zone has its own ground, trees, plants, relief and light, with natural edges between zones
(no straight borders). Places dropped into one even wood read as random.
- **Said:** "the complexity isn't the same as realm 1, no zones, just random structures/groups in the forest"
  (2026-09-28).
- **Check:** the overhead map (each zone's ground and growth visible as its own patch); screenshots of each zone
  from the game camera; every zone a named region whose name shows when you walk in (`zoneAt()` and `ZONES` in
  `src/world/realm2.ts` are the pattern: borders wobbled by noise).

### W5. Woods by zone, not everywhere
Dense woods only where the wood is the point and holds something; open meadows, shores and glades between; the
ground and flowers vary.
- **Said:** "the village is very crowded; the forest is very dense but basically empty" (2026-09-28).
- **Check:** the overhead map shows no even sprinkle of trees from edge to edge (Whisperwood: one even sprinkle,
  4,567 trees, became woods by zone, 3,969).

### W6. Nothing "weird planted"
Never scatter trees, bushes or thorns evenly or on a grid; never repeat one identical clump. Grow things in groves
and clumps with open ground between (a patch noise), vary their sizes, and put plants where they would take
(thorns at the feet of trees and rocks, moss by water). Rock masses are knolls with broken steps and boulders at
their feet, never tall boxes. Ground types lie in small patches, never big squares. A special object (a lever, a
heart) sits in something natural (a dead trunk), not on a square pillar.
- **Said:** "I don't really like the north-west, the area around the boss. I don't like those new bushes, they
  are so weird planted. Go for a more natural look instead of looking so man-made" (2026-09-30).
- **Check:** the overhead map, cropped to the place: look for grids, rows, rings, identical domes, square patches
  and boxes. Screenshots from the game camera. `dressRealm` in `src/world/realm.ts` takes a `patch` function for
  clumps (realm 2's `patchAt`).

### W7. A wild realm stays wild
No man-made shapes where nature should be. No square or pool-sided water: irregular outlines, shelving shores,
shallows, reeds. No perfect rings or straight fences of brambles. The tyrant's arena is grown (rock, roots, living
thorns), not built (no pits with drawbridges, towers or gateposts). Houses belong to the land (see V3).
- **Said:** "the boss arena is man-made, it should be a wild map; the big lake is square, like a pool; the cliff
  edges are empty; the village is boring and man-made... the stag should be guarded, and its fence looks
  man-made" (2026-09-28).
- **Check:** screenshots and the overhead map. Water: sand, then about 1.6 m of wadeable shallows, then deep.

### W8. Living wood is never a straight post
Trunks, roots and boughs are tapering, knobbly, curving tubes: `Geo.sweep` (`src/engine/geo.ts`) and `trunkUp`,
`rootFrom`, `bough` in `src/world/wood.ts`.
- **Said:** "the tree trunk and its roots look so plastic/fake/straight" (2026-09-30).
- **Check:** close screenshots of every big trunk, root and bough.

### W9. Cliff edges are dressed, in stretches
Rocks, bushes and plants at the lip, roots and vines down the face, boulders at the foot: bare edges look empty.
But dress them in stretches with bare runs between: a line of bushes along every lip looks planted. Roots down a
face are brown, not green, so they aren't mistaken for climbable vines.
- **Said:** "the cliff edges are empty" (2026-09-28); the even rows along every lip were among what looked
  "weird planted" (2026-09-30).
- **Check:** screenshots along each cliff from the game camera; the overhead map for even rows.

### W10. Caves belong in the terrain
Caves and the like are cut into the terrain (a cliff face, a trench wall), never dropped into a meadow.
- **Said:** the rule was kept, not the words.
- **Check:** the overhead map and a screenshot of each mouth (as built: the Hollow under the Overhang, Rookfall's
  cave, the Bat Roost, Jetsam's cave in the north cliffs, the Glowing Grotto in the trench wall).

### W11. Paths link purposeful places; secrets get none
Every place with a purpose (the village, camps, the keep, the stones, farms, a ford, a pier) is linked by a
visible road or trodden path. Places meant to be discovered (scenic spots with hidden treasure, secrets) get no
path: leave the track to find them.
- **Said:** the rule was kept, not the words (set 2026-09-27, with realm 1's footpaths).
- **Check:** the overhead map (paths are their own ground type); walk each route in the game. `tests/routes.js`
  (realm 1) walks planned routes and reports steps, deep water and props in the way.

### W12. Nothing tall on the camera's side
Keep tall things (home trees, big trunks, walls, crowns) off the line from the camera (+x+z) to any place meant to
be seen. Tall ground goes on the far (north and west) edges, low ground and water on the near ones.
- **Said:** "the village is small, I can't really see anybody there" (2026-09-30); the cause recorded was a trunk
  south-east of the village green that hid the whole green.
- **Check:** cast rays from the camera at about 17 points over the place and count how many are hidden (done by
  hand so far; no test holds it): group 21 took the Gatherers' Clearing from 16 hidden to 1, the Ring of Oaks from
  16 to 5, the old owl from 17 to 2; group 36 took Ash in his garden from 17 to 0. Then a screenshot from the game
  camera. Big crowns and roofs fade when they stand between the camera and the knight, but that doesn't help a
  place he is looking at from outside.

### W13. Landmarks are seen from afar
A landmark meant to draw the knight on is never under the mist of unexplored land, and is placed where the camera
can actually show it (a 30 m tree shows only its trunk in this view).
- **Said:** the rule was kept, not the words (2026-09-28: the Great Tree never showed on the horizon).
- **Check:** `landmarks` in the realm's data (`src/world/realm.ts`); a screenshot from where the knight first could
  see it.

### W14. Realms are joined by real places, never a plain portal
See Q2.

### W15. Changes to a place are bold and visible
When the user asks for a place to change (less cliff, more room, less crowded, more natural), make a change that
is plainly visible from the game camera: new shapes, a new layout, things removed or moved. Not a tweak of
numbers.
- **Said:** "I can barely see a difference. It's almost the same" (2026-09-30, after a first pass made Rookfall
  shallower and moved a lake shore by a few metres; the second pass, a winding gorge a third the size, the village
  rebuilt, the boss hollow doubled, was what was wanted).
- **Check:** before and after shots from the same spot (shot.mjs with `&at=`) and from explore mode zoomed out. If
  the after shot doesn't read as different at a glance, go further.

---

## Villages and people

### V1. Villages need room
Small knolls or yards with a house, a giant tree, lamps, lanterns and people piled together read as very crowded.
Give the village space to walk round its trees and between its people.
- **Said:** "the village is very crowded" (2026-09-28); "the middle island is too crowded, barely any room there to
  move around the tree" (2026-09-30). Said for realm 1 first, then again for realm 2.
- **Check:** a top-down plan (`tests/villagemap.js` draws Keepsfoot; for other villages, mapview with `&crop=`);
  screenshots; `spawns` (no one starts inside anything).

### V2. A village is lived in, and not symmetric
Its people go about their day (or night): walking rounds, sitting, fishing, working, playing. Its trees and houses
are placed by hand, unevenly, not matched pairs at right angles.
- **Said:** "the village is small, I can't really see anybody there, the positions of the trees are too
  symmetric, it's not natural" (2026-09-30).
- **Check:** `folk` and `reef` (walkers walk their rounds, sitters stay sat); screenshots of the village from the
  game camera with its people in view.

### V3. Houses belong to the land
Dwellings grow out of the realm: in a forest, doors in great trunks and treehouses in the crowns (Hollowbough); on
a drowned coast, houses on stilts on the coral (the coral village); realm 4's draft, adobe round an oasis.
- **Said:** "the village is boring and man-made: I expected big trees with the houses built in them"
  (2026-09-28).
- **Check:** screenshots.

### V4. A realm's people have their own words
No line copied from another realm, no second villager with an earlier realm's name. The prototype's own lines for
that realm are kept where it has them.
- **Said:** part of the 40/60 aim (A1, 2026-10-01): realm 2's copied captive and trial text and its second Pip
  were counted as excess sameness, and rewritten (group 22).
- **Check:** read every NPC's `lines` and the story module's toasts against the other realms'; search the code for
  the names.

### V5. The village is safe and has its services (practice)
No foes in the village (the night raid, an errand, is the one exception). A leader who sends the knight on, an
innkeeper (flasks), a smith (the sword), a hint-giver (one hint a talk, in turn), the captive's kin, and wares of
the village's own. This is the shared part of every village (see A2).
- **Check:** `folk`, `reef`; `spawns` lists where each foe stands.

---

## Foes and fights

### F1. Foes the knight sees, the player sees
A foe the knight has a line of sight to shows as a red outline when trees, walls or roofs hide it from the camera.
Knee-high walls and fences don't block sight, either way.
- **Said:** the rule was kept, not the words; set during realm 1.
- **Check:** `rigs` (the knight shows through walls); the outline is enabled for every foe in the `Enemy`
  constructor (`src/game/enemies.ts`). A new foe built outside the shared models must keep it.

### F2. Every attack is shown before it lands, long enough to react
Rings and marks fill up for 1.2 s or more before the blow; a line that a shot or a lunge will follow is shown,
then fixed before it goes; foes flash before they strike. This began with the bosses (B3) and now holds for every
foe and hazard: realm 3's pufferfish's ring and its clams' fill for 1.2 s, its harpooner's and eel's lines are
fixed 0.45 s before (the Jelly's 0.35 s is the shortest in the game); realm 4's draft says "every attack's mark
fills 1.2 s or more".
- **Said:** "they can hit me from anywhere, don't have time to react" (2026-09-30, of the Thorn Warden).
- **Check:** the live-encounter checks (`foes2`, `seafoes`) and the fair-fight bots (B5). The numbers are in
  `FOES` and `HAZARDS` (`src/config.ts`): read every `windup`, `lock` and `warn`.

### F3. A realm's own rule is a nuisance, never a killer
The realm's special rule makes play harder in kind, not deadlier: running out of air under the sea never costs a
heart (the knight is breathless: slower, no stamina back, the view closing in). Realm 4's draft keeps this for its
storms (never a heart) and its sinking sand (never a trap: firm ground always round it).
- **Said:** air pockets "just like an annoying thing, not that hardcore" (2026-10-01).
- **Check:** `costume` (out of air, he never loses a heart to it); a bot that walks the realm's hazard through
  several rounds and loses no heart to it (realm 4's draft: a storm bot).

### F4. No fire under the sea (realm 3)
Nothing burns in the Sunken Reef: no firepot throwers, no burning, no Fire Blade in its chests (`noFire` in the
registry). An example of a realm's own physics: decide them per realm and keep them consistent.
- **Said:** asked for when the realm was planned (2026-10-01).
- **Check:** `sea` ("nothing burns").

### F5. No stun-locks; effects wait while you read (practice)
Once dazed, the knight can't be dazed again until 3 s after it ends; effects hold still in talks, lore and
cutscenes; nothing holds him still while other attacks land (see B4).
- **Check:** `effects`, `freeze`.

---

## Bosses

The Thorn Warden's fight was rebuilt on 2026-09-30 after the user found it unfair: "it's very hard to fight the
boss in realm 2, there's not enough space, they can hit me from anywhere, don't have time to react". B1 to B5
came from that, and every boss and mini-boss since was built to them from the start.

### B1. Room for the boss's style
An arena roomy for the way the boss fights: a ranged boss needs more room than a melee one. The Warden's hollow
went from 88 to 179 m² of floor (16 by 15 m); the Tidelord's hall is 14.5 by 15.5 m; realm 4's draft gives its
ranged tyrant about 16 by 14 m and its Sphinx an open terrace of about 15 by 15 m.
- **Said:** "there's not enough space" (2026-09-30); "the way to the boss area is too crowded", "the boss area
  too crowded" (2026-09-30).
- **Check:** `wardenfair`, `tidefair` ("room in his hall"); the overhead map with `&crop=` round the arena.

### B2. Nothing tall between the camera and the fight
Arena walls are low on the camera's +x+z side (the Warden's roots 2 m there, 3.4 m at the back; the Tidelord's
walls 2.2 m, the throne wall high), but still a barrier the knight can't climb. Marked spots and aim lines are
drawn over everything.
- **Said:** as B1 (2026-09-30).
- **Check:** `wardenfair`, `tidefair` ("walls that hold the knight but stay low on the camera's side");
  `arenastag` (not even the Thornstag's second leap gets in before the garrison falls). A screenshot of the fight.

### B3. Every attack shown, with time to react
Marks fill up over 1.2 s or more and are as big as what they hit (the Warden's rain 1.5 s, 1.25 s enraged; Old
Inkarm's lines and rings 1.2 s; Brassbelly's steam ring 1.2 s, raised from 0.95 s, and his anchor's wind-up 1.2 s,
raised from 1.0 s on 2026-10-02); aim lines are fixed well
before release (the Warden's volley 0.45 s; the Tidelord's charge lane and trident sweep 0.8 s). An attack that
follows the knight shows where it is going before it goes.
- **Said:** "they can hit me from anywhere, don't have time to react" (2026-09-30).
- **Check:** the fair checks below; the timings in `FOES` (`src/config.ts`).

### B4. One attack at a time, and nothing holds the knight under another
Nothing new starts while marks are still to land. No summons that hold the knight still under other attacks (the
Warden's snarers, whose bolas held him under the rain, were replaced by goblins). While Old Inkarm's arm holds
him, nothing else strikes, and mashing attack tears him free. Arrows in the air and marks die with the boss.
- **Said:** as B3 (2026-09-30).
- **Check:** `wardenfair`, `tidefair`, `inkbot` ("one attack at a time, nothing else strikes the knight while an
  arm holds him").

### B5. Proved by a dodging bot
A bot that only steps out of the way, a quarter second after each warning, is hardly hit (the Warden's: 0 hits
calm, 0 to 1 enraged, in 22 s); one that stands still is hit (3 to 4 times in 14 s).
- **Said:** kept with B1 to B4 (2026-09-30); the standing note on fair bosses ends "Prove it with a dodging bot".
- **Check:** `wardenfair` (tests/wardenfair.js), `tidefair` (tests/tidebot.js with `&fair`); `inkbot` holds the
  fairness checks for Old Inkarm.

### B6. Tuned alone, to about a minute
Each tyrant and mini-boss is tuned by hand, so that a player-like bot wins in about a minute at the expected
sword level, losing well under the hearts it has. As measured: the Warden (54 health) 68-73 s at level 3, 6-8 hearts; the Tidelord (105)
52-61 s at level 6, 0-4 hearts; Brassbelly (42, x2.25) 35-52 s at level 5, 0-5 hearts (30 runs, 2026-10-02); Old Inkarm (44, x2.25)
49-69 s, 0-2 hearts. (The Goblin King, 29 s and 6 hearts at level 2, was left as it is: realm 1 had been called
done.)
- **Said:** "review, balance, find flaws" (2026-09-30), from which the standing note sets the target.
- **Check:** `bossbot` (the Warden, `&lvl=3`), `tidebot` (`&lvl=6`), `salvagerbot` and `inkbot` (`&lvl=5`). The bot
  presses real keys, aims clicks, dodges what it sees coming a quarter second late, keeps back from a blow winding
  up, and otherwise closes in and swings. The tyrants' health is exempt from `foeHp` by type in
  `src/game/enemies.ts`; the mini-bosses' is not (Brassbelly's 42 is 94.5 at x2.25).

### B7. Mini-bosses are fights, not purses (practice)
A mini-boss fights under a health bar, is never rolled golden, and its purse is not multiplied by the combo bonus
(nor is a tyrant's).
- **Check:** `src/game/enemies.ts` names the mini-bosses in the golden roll; `economy3`.

### B8. The tyrant's hall (practice)
The door shuts when the tyrant wakes; two summon points; enraged at half health; a lost fight lifts the door again
(once the garrison is down); the light changes after (dawn, or realm 4's nightfall). The beast waits outside (the
Warden's fight is on foot). Part of the shared grammar (A2).
- **Check:** `hold`, `palace` (the door, the reset, after a reload); `warden`, `tidelord` (every move seen,
  victory).

---

## Quests and story

### Q1. Later realms are the prototype's realms, translated
Realms 2 to 8 are the original prototype's realms in its order: castle (the Moonlit Keep), forest (Whisperwood),
aqua (the Sunken Reef), desert (the Scorched Dunes), ice (Frostpeak), lava (the Molten Core), storm (Stormspire),
void (the Void). Each is translated the way realm 1 was: its boss, creature, mount, village lines, captive,
hazard, set piece, relic, fortress and arena become places and systems in an open isometric map, plus side
content. New themes are not invented.
- **Said:** "do the original realms in this new way" (2026-09-28, rejecting new themes for realm 2).
- **Check:** the realm's plan lists each of the prototype's pieces and where it went (see
  [realm building](realm-building.md)). The prototype's source:
  `C:\Users\Ed\Downloads\eight-realms-source\eight-realms\src`.

### Q2. No plain portals: realms meet at real border places
Realms are neighbouring lands, crossed on foot or by mount through a real place at the border (the thorn road, the
Sea Stair, realm 4's draft the Dune Strait), never a portal.
- **Said:** "I don't just want a basic portal" (2026-09-28).
- **Check:** `border`, `travel`, `seastair`, `stairleap`, `stairmenu`, `menutravel`, `worldmap`.

### Q3. A border needs the right beast, never a beaten tyrant
Each border opens with the beast freed in the realm before (the warhorse's charge through the thorn hedge; the
Thornstag's second leap over the Sea Stair's rockfall; realm 4's draft, the serpent through the Dune Strait). The
knight can go back and forth whether or not the realms are finished.
- **Said:** asked for on 2026-09-28 (the user's words were not kept).
- **Check:** `border` (the charge breaks the hedge with the King alive); `stairleap` (on foot he can't get past,
  on the stag he can, both ways); `stairmenu` (the pause menu doesn't set a knight without the stag down past the
  rockfall).

### Q4. A freed mount's prison is guarded
The beast is held somewhere natural and its keepers guard it: the Thornstag's thicket (a snarer, two goblins, a
thornback), the serpent's nets (two goblins, a shield goblin, an archer); realm 4's draft, the wyrm at the
robbers' dig.
- **Said:** "the stag should be guarded, and its fence looks man-made" (2026-09-28).
- **Check:** `stag` and `serpent` clear the keepers first; the plan and `spawns` show the guard.

### Q5. The beast has a purpose in its own realm (practice)
Something only the freed beast opens in its own realm, not only at the next border: the stag's thorn burst clears
the cleft to its old bed (a chest, a lore stone); the serpent carries the knight to the isles before the suit.
- **Check:** `stagbed`, `serpentledge`, `reachserpent`.

### Q6. The shared spine
The main quest keeps one shape in every realm: the village and its leader first, the way (the realm's tool or
road), a "lever" that opens the stronghold, a garrison whose fall opens the tyrant's door, the tyrant, then dawn.
Realm 3's content round pointed its main quest straight past the village and left the crew before the palace
opening nothing; group 36 put both back.
- **Said:** part of the 40/60 aim (A1, 2026-10-01: the common part is "the quest's shape").
- **Check:** the main quest's steps in `src/game/quests.ts` read in order; a playthrough from a fresh save to the
  victory (`tests/playthrough.js` for realm 1; group 36 did realm 3's by hand).

### Q7. Progress is never lost (practice)
Every step, chest, captive, beast and story flag survives a reload, a fall and travel to another realm and back.
"New journey" asks first. A quest never moves backwards: a later step completes the earlier ones, so a quest
never sticks (but check that no shortcut skips half the realm's content: see the lessons in
[realm building](realm-building.md)).
- **Check:** every story check that runs again after a reload (`sister`, `kip`, `hold`, `palace`, `serpent`,
  `costumedrop`: the `AFTER` scripts), `progress1`/`progress2`, `travel`, `migrate`.

### Q8. Each realm has a hint-giver and its own words (practice)
One hint a talk, the next each time (the old owl, Old Tally). The realm's lines are its own (V4).
- **Check:** `folk`, `reef`.

---

## Economy and balance

These came from "review, balance, find flaws" (2026-09-30) and were kept as the standing rules for every new
realm. The numbers, formulas and the tables per realm are in [difficulty](difficulty.md).

### E1. A realm pays for what it sells, with a modest surplus
Its chests, quests and trial pay for what its village sells (the sword's levels there, the wares), with a modest
surplus, not twice over. The foes' coins (and realm 3's pearls) come on top. Whisperwood's chests had paid 1,550
against 960 to spend; they now pay 35 to 60 by how hidden (about 1,055). Realm 3's content round paid about twice
what its village sells; group 36 brought it to 20% over (chests 1,840, quests 290, the trial 100: 2,230 against
1,860). Realm 4's draft aims at about 15% over.
- **Said:** "review, balance, find flaws" (2026-09-30).
- **Check:** `economy2`, `economy3` (all chests, the purse and every quest's and errand's reward against the
  price list: 10-25% over; every reward's toast names its sum).

### E2. Chests pay by how hidden they are
Open chests pay least, tucked ones more, hidden ones most (realm 3: open 25-35, tucked 45-55, hidden 70-90, the
trench's and Old Inkarm's the most).
- **Check:** `economy3`.

### E3. Foes as tough as the sword the knight brings
A realm's `foeHp` makes its foes take as many blows with the sword a knight brings as realm 1's took with a new
one: a goblin takes 3 blows on arrival in every realm. `foeHp` is about the arriving sword's damage multiplier:
1.0, 1.6, 2.25 (realm 4's draft: 2.75).
- **Said:** "review, balance, find flaws" (2026-09-30).
- **Check:** `economy1`, `economy2`, `economy3` (each ends with the toughness line); realm 4's draft adds a
  `foes4` that counts blows per foe on arrival.

### E4. The tyrant is tuned alone
See B6.

### E5. Every hit costs one heart (practice, for now)
From every source, in every realm. Realm 4's draft changes this for bosses and mini-bosses (two hearts), because
hearts rise every realm (6, 8, 9 by the ends of realms 1 to 3).
- **Check:** [difficulty](difficulty.md), "Where today's rules run out".

### E6. No farming (practice)
A trial's foes drop nothing and its win pays once; dying and retrying can't farm it. Stolen coins come back as
they were, never multiplied by the combo. A smith never sells past the price list.
- **Check:** `economy`, `review`, `trial`.

---

## Controls and UI

### C1. One binding per action on desktop
- **Said:** the rule was kept, not the words; set during realm 1.
- **Check:** `controls`, `menus`; the pause menu's controls list.

### C2. Guard is one button
Tap to roll, hold to block, press just before a hit to parry (in the air, a dodge).
- **Said:** the rule was kept, not the words.
- **Check:** `controls` (tap rolls, hold blocks).

### C3. Jump exists
Space on desktop (up onto ledges about a metre high); the blue arrow on phones.
- **Check:** `controls`, `moves`.

### C4. The phone stick stays where the thumb first lands
- **Said:** the rule was kept, not the words.
- **Check:** `phone` (tests/mobileflow.js with `MOBILE=1`).

### C5. Desktop and phone both
The game runs in the browser on both, landscape and upright. Phones get lighter settings (`MOBILE` in
`src/config.ts`: fewer trees, half the wildlife, less grass, fewer lights, a smaller shadow map, a coarser pixel
grid). Every new move and HUD element needs a touch form that doesn't overlap the others.
- **Check:** `phone`; `MOBILE=1 node tools/shot.mjs "shot" shots/phone.png 9000 844x390 tests/mobileflow.js`;
  `tests/portrait.js`, `tests/phonepause.js`.

### C6. Prompts follow the device (practice)
Key names follow the keyboard's layout (AZERTY shows ZQSD); with a pad, prompts and tips name pad buttons; a pad
on a phone switches the touch controls off. Mashing through a talk never buys anything.
- **Check:** `pad`, `talk`, `menus`.

### C7. Explore mode stays working
A flying switch in the pause menu so the user can check a map himself: the knight flies over everything, can't be
hurt, nothing notices him, nothing is picked up and no quest moves on.
- **Said:** "I need a godmode with flying mode so I can check the map myself easily" (2026-09-30).
- **Check:** `fly`. A new realm's story moments must not fire while flying (`onRegion` isn't called then).

---

## The 40/60 aim

### A1. About 40% common, 60% the realm's own
The common part is what lets the player know where to go and what to expect; the rest is the realm's own:
terrain, foes, mechanics, look, music.
- **Said:** asked for on 2026-10-01 (the record keeps the request, not a quote): each realm about 40% common, so
  the player knows where to go and what to expect, and about 60% its own: terrain, foes, mechanics and the rest.
- **Check:** score the realm as [common and unique](common-and-unique.md#the-aim-about-40-common-60-unique)
  explains, area by area (the scores so far are in [realm scores](realm-scores.md)): each part counts 1 if a player who finished
  an earlier realm would call it the same thing (a recolour counts as the same), ½ if it has the same role in a
  clearly new form, 0 if it is new; an estimate, read as ±10. Realm 2 measured about 67% (58% after its
  follow-up), realm 3 about 48% (46% after its review); realm 4's draft aims at 40%. The other measures (foes by
  kind, the ground-type mix, screenshot hue, tracks of its own, counts) are listed in
  [realm building](realm-building.md#the-4060-aim).

### A2. The common 40% is the grammar, kept on purpose
The quest's spine (Q6), the village's services (V5), resting places (moonfires), rewards (chests by how hidden,
3 Moon Shards for a heart, lore, a cracked wall, a captive in a cage whose kin waits in the village, a relic trial
of 3 waves of 3/4/4 foes), the stronghold's steps and the tyrant's hall (B8), cliffs on the far edges, a way in
only the last realm's beast opens, the knight and his moveset, the camera and pixel look.
- **Check:** [common and unique](common-and-unique.md) lists what all the realms share.

### A3. The 60% is the realm's own, from its first group
Its own ground types and props, its own light (a night of its own and a first screen that says which realm it is),
its own frame (size, the way the journey runs, counts), its own foes (most of what you fight, and none only
recoloured: shared kinds wear the realm's own gear), its own music and sounds (its own version of every mood),
its own rule at its heart and its own words.
- **Said:** the 2026-10-01 measure found realm 2's excess in its foes (two thirds realm-1 types, recoloured), its
  music (no track of its own), its frame (the same size, direction and counts) and lines copied word for word.
- **Check:** screenshots measured for hue against the other realms (realm 1 205-253°, realm 2 150-168°, realm 3
  172-196°; realm 4's draft 20-45°); `seasound` (every place a track of the realm's own); the placed foes counted
  by kind.

### A4. Plan the 40/60 before building
Decide the common part and the realm's own in the plan, with an expected score per area, and measure straight
after the content round, so the review can fix what the measure finds. Realm 3, planned this way, came in at 48%
on its first build; realm 2, fixed afterwards, at 67%.
- **Check:** the plan's expected score table; [later realms](later-realms.md).
