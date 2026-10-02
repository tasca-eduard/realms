# Realm 4 plan (draft, 2026-10-02; for the user to read, nothing built)

> Moved from BOARD.md on 2026-10-02, word for word, with a link added to each group's task file (and group 36
> ticked). Where the text says "(see Done)" or "checks recorded under Done", the record is now in that task file.
> REALMS.md and README's realm sections have since been split into docs/; where the text sends a reader there, it
> now links to the new file. How the board works: [board/README.md](../README.md).

Realm 4 is **the Scorched Dunes**, the prototype's fourth realm (`desert`): "A buried king has woken beneath the dunes."
The prototype gave it a sunset sky with a great pale sun, pyramids on the skyline, dunes, palms and cacti, an oasis
village of adobe houses under red-and-cream striped awnings (folk in scarves), pots where other realms have crates,
sinking sand under a sandstorm (its set piece: "quicksand! mash jump"), pressure plates that fire darts from statues
(its hazard), the Cactus (its creature), the Sand Wyrm (its mount: a lunge bite, Burrow, a burrow dodge, "crosses
quicksand", 4 hits), the Sun Scarab (its relic: +25% coins from foes), a captive taken from a caravan by the tomb
guards, skeleton archers, and the Sand Pharaoh, "Undying Ruler of the Sands" (sand rain, volleys, teleport; "Kneel
before the eternal king." / "The sands will bury you!" / "My tomb... awaits..."). Its village's words: "Drink at the
oasis before you cross the dunes", "When the sand starts to howl, find shelter or keep your head down", "A caravan
was taken by the tomb guards. My daughter was with them"; its lore: "The Sand Pharaoh ruled a thousand years, and
refused to stop", "The tombs remember every name the desert has buried". Its music: 100 bpm in E Phrygian, an oboe
over pizzicato eighths and taiko drums; its ambience: wind and gusts.

Translated the way realms 1 to 3 were, with [REALMS.md](../../docs/design/common-and-unique.md)'s 40/60 aim set from the start, and with realm 3's lessons
applied before building, not after: no recoloured foes anywhere (the trial and the tyrant's calls included), a light
of its own and a first screen that says which realm it is, the shared spine kept (the village and its leader first, a
garrison that opens the tyrant's door), the counts and the purse set before any content, a varied foe mix with
ranged foes back, and an upgrade that isn't another fading +25%. Everything below is decided (the user: "decide,
don't ask"); the story can be revisited.

**Decisions**
- **The story: a king who won't let the day end.** The Sand Pharaoh was buried at sunset a thousand years ago. He has
  woken, and the sun has stood on the rim of the west ever since, red and low, and will not set: his day must never
  end. The sand never cools, the tombs' dead walk, his guards took a caravan. The oasis folk long for night.
  Felled, he sinks into his tomb's sand ("My tomb... awaits..."), and the sun goes down at last.
- **Its light: an endless sunset, and night as the reward.** Every built realm is a night with a dawn after the
  tyrant. This one turns that round: a low red-gold sun in the west (the prototype's sky, `#e8784a` to `#fadba2`),
  long shadows stretching east, hot amber haze, and cool blue-violet shade in canyons, tomb mouths and under awnings.
  Screens should sit at hue 20-45° (realms 1-3: 150-253°), so the light alone says which realm it is. The tyrant's
  fall brings the first night in a thousand years (the `dawn` slot holds it): the sun slides under, stars, a cool
  blue, the village lights its lamps for the first time and its windows glow. Needs a light direction per realm
  (today the moon's is fixed at (-0.62, 0.72, 0.3) in game.ts): the sun at about 25° up, from the west. The
  moonfires still burn, pale blue: the only cool light in the realm, easy to spot.
- **A frame of its own: across the screen, left to right.** Realms 1-2 run up the screen (south-east to north-west),
  realm 3 down it (north-west to south-east). This one runs across: in off the sea at the west edge's south end
  (screen left), out at the east edge north of the middle (screen right). 150 x 100 (15,000 m², about realm 3's
  15,400, but most of it land: water on under 10%, against realm 3's 66%). Its edges:
  - the sea along the west edge, a far edge for the first time (you leave it behind you);
  - the Red Mesas' cliffs along the north edge (tall, on the far side);
  - a belt of sinking sand along the south edge and the Sinking Sea along the east (flat and low on the near side,
    so nothing tall hides the play; a real edge: no wall, the sand just won't carry you).

  ```
  N  (the Red Mesas' cliffs, far side)                                     x: 0 -> 150
  +------------------------------------------------------------------------------+
  |~  cliffs    Red Mesas      Scarab Ring        Valley of Tombs    Great    ::::|
  |~  Smugglers'  (cacti)        (trial)          (cage, Sealed      Pyramid  ::::|
  |~  Cave                                          Tomb)          [/\]    :::::: Frost
  |~ Sea           Scorpion Hollow                       Avenue of Obelisks ::: Pass >
  |~                    Sweetwell (oasis)  caravan road -->  Robbers' Dig  :::::::|
  |~ Lagoon <-- Salt Flats    Palm Gardens     Great Dune             :: Sinking  |
  |~ (arrive)   Dhow       Bone Arch    Sun Temple    Mirage Flats    :: Sea      |
  |~                 Dune Sea              Sunken Face           Sunk Caravan :::|
  +:::::::::::::::::::::::::: sinking sand belt (south edge) :::::::::::::::::::::+
  ```
  Counts of its own, set now (realm 1, 2, 3 -> 4): named places 21, 31, 30 -> about 24; chests 11, 23, 33 -> 24;
  people 7, 17, 37 -> about 22; lore stones 5, 9, 13 -> 9; quests 7, 5, 11 -> 8; moonfires 4, 4, 3 -> 4 (the
  lagoon, Sweetwell, the Sun Temple's steps, the Avenue's head); placed foes 55, 54, 62 -> about 56 (54 and two
  mini-bosses); signs 3, 3, 0 -> 4 (carved way-stones at the caravan road's forks). Volume stops growing here.
- **The realm's rule: the sand moves.** One rule at its heart, as water was realm 3's, changing how the shared
  moveset plays without changing the moveset:
  - *Sinking sand* (the prototype's quicksand): its own ground, smoother, darker and wetter-looking than dune sand,
    turning in a slow swirl, ringed by bones, a half-sunk cartwheel, dead scrub; readable from above. Step in and
    the knight slows to half and sinks, ankles to chest, over about 3.5 s; each press of jump pulls him up a quarter
    (the prototype's "mash jump"), a roll toward firm ground frees him while he's knee-deep or less. Fully sunk: a
    heart, and back on firm ground at the edge, as a fall. Patches in the open are 2-5 m across, always with firm
    ground round them (never a trap); the first one, on the caravan road, is shallow (never past the knees) and
    teaches it. Living foes go round it; the dead don't look where they walk: lure a tomb guard or a mummy in and
    it's gone (no coins). The Sinking Sea and the south belt are too wide to cross on foot: only the wyrm swims them.
  - *Sandstorms* ("when the sand starts to howl, find shelter or keep your head down"): only in the open dunes and
    flats, about every 80-100 s spent there. A howl rising and sand streaming low over the ground for 4 s first (a
    toast, the horizon browning), then 12 s of storm: the wind from the west pushes the knight east at 1.5 m/s
    (under a third of his run), the view closes to about 10 m in a sand haze (foes he sees stay outlined), arrows
    and needles drift and can't aim past 6 m (both ways). Holding guard braces him ("head down": no push, walking
    at block speed); in the lee of rocks, walls and buildings it's calm. Never a heart; the push never carries him
    onto sinking sand or off a ledge. What the storm gives: three spots in the dunes where, once a storm has passed
    over them, a buried chest's lid or a statue's hand shows (saved).
  - *No heat meter.* Realm 3's air is a bar that runs down and refills in pockets; a heat bar refilled in shade would
    be the same rule in a new coat, and score as common. The sun's part is its light (the Sunglass, below).
  - *The oasis's water*: drinking at Sweetwell's pool (and the Sun Temple's old well) fills the flasks, as a moonfire
    does, without the rest. "Drink at the oasis before you cross the dunes."
- **The realm's tool: the Sunglass, won from a mini-boss.** The sun-priests' bronze mirror, worn on the brow of the
  Sun Sphinx, the temple's old guardian, which the Pharaoh woke and bound. Beaten, it lies down cracked, speaks, and
  the Sunglass falls from its brow; walked onto, it's set in the boss of the knight's shield (a bronze sun-disc on it
  from then on, visible). Held guard in sunlight, the shield catches the sun and throws a beam the way he faces
  (10 m); in a sandstorm the sun's hidden and it only braces (the same button, the same idea: guard is how you
  meet the sun and the sand). Indoors only standing in a pool of light under a shaft. The beam: sets mummies alight,
  bakes fallen tomb guards to dust, drives off scarab swarms, opens sun-seals, wakes the bronze mirrors on the
  obelisks, and strips the Pharaoh's sand shroud; the living (goblins, scorpions, cacti) it only dazzles a moment.
  Realm 3's storm lantern lights the tombs' dark round him (no beam).
- **The dead rise again in the shade.** Tomb guards and tomb archers felled in the sun crumble for good. In the shade
  (the Valley of Tombs' floor, every tomb and the pyramid), their bones lie twitching and stand again 5 s later (a
  ring filling 1.5 s over the pile first) unless a blow scatters the pile or the Sunglass's light touches it. Coins
  only once they're gone for good. It gives the tombs their own rhythm and makes the light worth carrying.
- **Mostly its own foes; none recoloured.** Realm 3's lesson: 21 of its 62 placed foes and its whole trial were
  realm 1's goblins in teal. Here every foe is dressed as the realm's own, and the trial and the Pharaoh's calls use
  them. About 54 placed (base health; x2.75 here, `foeHp`):
  - *The Pharaoh's dead* (a new body: bones and wrappings, the prototype's red eyes): tomb guards with khopesh (3;
    10 of them) and tall shields (4; 4 of them: blows from the front glance off, as a shield goblin's), tomb archers
    on walls, plinths and ledges (2; 7); mummies (7; 6): slow, a wrappings lash along a line filling 1.2 s that maims
    (never holds him), set alight by the Sunglass they burn, taking double for 4 s and unable to lash.
  - *The desert's own*: scorpions (5; 7): burrow up to him as a moving mound nothing reaches, surface at a ring
    filling 1.2 s, snap, and strike with the tail over their head onto a spot filling 1.2 s (poison); after a tail
    strike the tail sticks in the sand 1 s. Scarab swarms (3; 5): a dark, glinting patch flowing over the sand that
    pours from urns and sarcophagi; on the knight a ring fills 1.2 s before it bites (a heart and poison); a blow
    kills a third, a spin or the beam all of it. The Cactus (4; 5), the prototype's creature: stands among real cacti
    looking like one (a pink flower on top) until he's within 7 m, then uproots and hops toward him, plants, swells
    (a ring filling 1.2 s) and fires needles along 8 lines shown on the ground.
  - *Goblin tomb-robbers* (the rivals; the one familiar face, dressed as their own: scarves, dust goggles, picks,
    sacks): diggers (3; 6), slingers whose stones land on a marked spot (2; 3), and Grit the foreman with a great
    pick (8, elite; 1), all at their dig.
  - Shares: ranged foes about 28% (archers, slingers, cacti; realm 3: 13%), foes causing an effect about 48%
    (maim, poison, daze), biggest group 5 (the dig), one placed elite.
  - Life, not foes: vultures circling that land on loose coins and eat them unless he gets there first (they flap
    off when struck; never hurt him), lizards, jerboas, doves at the oasis, a jackal's eyes in the shade.
- **Hazards.** The prototype's pressure plates: a sun-glyph slab a little raised, a click, a line filling 1.2 s along
  the darts' path from the statue's mouth, then the darts (a heart); jump over a plate, walk round it, strike it from
  the side to spend it, or lure a foe onto it (the darts hit foes too). In the tombs, the Avenue and the pyramid's
  passage. Dust devils wander the Mirage Flats: one catches him, spins him and sets him down 4 m on (never on
  sinking sand or off a ledge; never a heart). The buried dead: on the Avenue, tomb guards lie under the sand and
  rise as he passes (realm 2's lurking ambush in this realm's form). Fire is back (nothing here is wet): the
  robbers' torches, burning mummies, the Fire Blade possible in a chest.
- **Two mini-bosses, both creatures.**
  - *The Sun Sphinx* (holds the Sunglass, on the main quest): a great stone lion with a king's head on the Sun
    Temple's terrace (open, sunlit, about 15 x 15 m). A pounce onto a spot filling 1.2 s under the knight, after
    which its claws are stuck in the stone 1.5 s (strike then); a roar of sand along a cone filling 1.2 s (a shove);
    a tail sweep behind it along an arc filling 1.2 s; its brow's mirror flashes a beam along a line that follows
    him and is fixed 0.5 s before. About 48 health, tuned alone.
  - *The Scorpion Queen* (optional, as Old Inkarm was): in the Scorpion Hollow, a sinkhole among rocks. Burrows
    under and surfaces at a ring filling 1.2 s; three tail strikes on spots shown in turn; a double pincer snap along
    a line; calls two scorpions (one attack at a time). About 50 health. Her chest gives Scorpion Venom (a power:
    for 30 s blows poison foes, a poisoned foe taking a blow's worth more over 3 s).
- **The beast: the Sand Wyrm** (the prototype's). A long sand-gold wyrm, pale beneath, a frilled hood and a red eye,
  the robbers' broken harness of rugs and bells on it (reusing the serpent's long jointed body). The robbers keep it
  shackled at their dig to drag loot sleds over the Sinking Sea; guarded by them (the user's rule). Freed: once its
  keepers are beaten, it thrashes (its coils sweeping along lines filling 1.2 s: a shove, no heart, it's not a foe),
  and each time it rears a bronze shackle on its neck shows: three blows on three shackles free it (not three stakes
  again). Ridden: 1.3 times the knight's run on sand, slower on rock; a lower jump than the horse's; 4 hits (the
  Tide Pearl and barding add theirs); a lunging bite; **Burrow** (the blue bar, sand only): it dives under the sand
  with him, both unhittable, a ridge of sand racing along for up to 2 s, then bursts up hitting all round (2.5 m,
  arrows broken); the burrow dodge (guard: a 0.5 s duck under the sand). It swims through sinking sand (the only
  way over the Sinking Sea and the south belt) and won't go into deep water or up into snow. Its purpose in its own
  realm, as the stag's bed was: the Sealed Tomb's door is choked with packed sand a sword only scratches, and the
  wyrm burrows through it; the Sunk Caravan in the Sinking Sea holds a shard. Where it waits is saved (realm 3's
  serpent's wasn't).
- **Borders.** In by the Dune Strait: the serpent swims it (`swim` on a border, as `leap` for the stag): from the
  Reef he rides out through the strait and comes in, in the saddle, through a gap in the reef into the Serpent's
  Lagoon; the serpent waits in the lagoon (and can swim the coast's strip to the Smugglers' Cave in the north sea
  cliffs, a chest only it reaches); riding back out through the gap takes him to the strait. Realm 3's "shut, for
  now" lines (story/aqua.ts:130, serpent.ts:696) change. Out by the Frost Pass, on the east edge north of the middle,
  across the Sinking Sea's northern arm: only the wyrm carries him over; at the pass's foot it stops (it won't go
  up into the snow) and the road climbs into the mountains, snow on the peaks beyond (seen from the dunes: the first
  cool thing in the realm). Shut until realm 5 is built; coming back through it later, the wyrm waits at the foot.
  No horse or stag here: they can't cross the sea (as realm 3 had none).
- **The sword and the hits.** The sword's damage is complete at level 7 (x2.75): each further +25% of the base adds
  less (+9% at level 8) and only pushes `foeHp` up. Sweetwell's bronze-smith instead re-forges its edge curved, in
  the oasis's bronze: two levels, each +12% reach and a wider arc (the blade visibly curves). `foeHp` 2.75 (a
  goblin-kind takes 3 blows on arrival, as everywhere), and it stays there until a realm sells damage again. Hearts
  have risen every realm while every hit costs one (9 on arrival here, 10 by the end), so from realm 4 on a boss's
  or a mini-boss's blow costs two hearts, as in the prototype (`bossDmg` is 2 from the fourth realm), shown on the
  HUD as a cracked pair. Ordinary foes, sinking sand and falls stay at one.
- **Sweetwell, the oasis village.** Adobe houses, one or two storeys with flat roofs and the prototype's red-and-
  cream striped awnings, round an oasis pool with an irregular shelving shore and date palms (no pool sides), a
  well, the palm gardens' green fields south of it, the caravanserai (the inn: a courtyard you walk into, its roof
  fading), a market under awnings, a dovecote; roomy (the user's rule), palms by zone (the oasis and two wadis only).
  Its folk in scarves (the prototype's colours), names of spices (placeholders): Saffron the Well-keeper (leader,
  main quest), Myrrh of the Caravanserai (flasks), Cassia the Bronze-smith (the curved edge), Cumin the Caravan
  Master (the captive's father; sells the prototype's combo keeper, left over from realm 3's list), Indigo the
  Weaver (sand-veils: the storm's push halved and the haze closing less a level), Old Sumac the Star-reader (the
  hint-giver, one hint a talk; she hasn't seen a star in years), Old Tamarisk the sand-reader and Fig the dune-runner
  (errands), a potter, gardeners, water-carriers, children; Amber, the last sun-priest, in the temple's ruins.
- **Music and sound of its own from the first group.** Its own versions of every mood, grown from the prototype's
  track: E Phrygian dominant (a scale new to the game: 0 1 4 5 7 8 10; realm 3's mini-boss fight is plain Phrygian),
  the oboe lead over pizzicato eighths, and the prototype's tribal pattern on taiko (a new drum style); the village
  warmer (harp, flute), the tombs a low choir and timpani with no lead, the caravanserai in sevens (a 7-beat bar, new),
  the fight and the boss in E harmonic minor on taiko, and a "nightfall" for the victory (celesta and choir, slow,
  major). The samples are the eleven the game has (all the prototype holds). Ambience: the prototype's wind bed and
  gusts, the storm's howl (the music ducks under it), doves, frogs and rustling palms at the oasis, dry wind and
  rattling bones in the tombs, no birdsong.
- **Its ground and props.** Five ground types of its own: dune sand (pale gold), salt crust (white, cracked in
  polygons), sandstone paving (cut, drifted over), red mesa rock, sinking sand; sand shared with realm 3. Props
  mostly its own: date palms, saguaro-like cacti in clumps and lone acacias, wind-carved rocks and arches, bleached
  bones and ribs, clay pots (the prototype's breakables here), adobe, awnings, obelisks, statues, sarcophagi,
  wrecked carts and sleds. Dunes are long ramps with steep lee faces (jump down, walk round to go up; every hollow
  has a way out). Paths: the caravan road (tracks, cairns, way-stones), the processional way (paving under drifts).
- **What's common, on purpose (the 40%).** Kept: the knight and his moveset, status effects, moonfire rest, 3 shards
  for a heart, chests and lore, a cracked wall (a tomb's false wall), a captive in a cage whose kin waits in the
  village, a relic trial of 3 waves (3/4/4), a village with a leader who gives the main quest, an innkeeper, a smith,
  a hint-giver and wares, the stronghold opened by a "lever" (here a light: the sun-seal), a garrison whose fall
  opens the tyrant's door, a hall whose door shuts (two summon points, enrage at half health, the light changing
  after), a beast freed from a guarded prison, a way in only the last realm's beast opens, the camera and pixel
  look. Its own: the rest of this list. Expected, scored as [REALMS.md](../../docs/design/realm-scores.md) scores:

  | Area | Realm 3 (after group 36) | Realm 4 (aim) | Why |
  |---|---|---|---|
  | Quest steps and words | ~50% | ~45% | The spine kept (village, leader, lever, garrison, tyrant); the Sphinx, the sun-seal, the errands its own |
  | Rewards | ~70% | ~65% | Storm-uncovered chests, a mini-boss's power, the Sunglass |
  | Village services | ~60% | ~55% | The oasis's water, the curved edge, veils, the combo keeper |
  | Stronghold and tyrant | ~60% | ~50% | Mirrors for the lever, shade where the garrison rises again, the shroud and the sun's light |
  | Map frame and route | ~45% | ~35% | Across the screen, the sea on a far edge, sinking sand for near edges |
  | Kinds of place | ~33% | ~30% | Kin: an inn, a camp (the dig), caves (the tombs); the rest its own |
  | Terrain and look | ~25% | ~20% | Its own ground, props and a warm light (realm 3's turquoise night is its own since group 36) |
  | Mechanics | ~40% | ~35% | Sinking sand, storms, the Sunglass, the dead rising, darts, the wyrm |
  | Foes | ~37% | ~33% | No recoloured foe; roles kept for guards, archers and robbers |
  | Music and sound | ~45% | ~40% | A new scale, drums and metre; every mood its own |
  | **All** | **~46%** | **~40%** | |
- **Performance from the start** (realm 3's was left undone): open desert needs few lights (no lanterns lit until
  nightfall; moonfires, tomb torches and shafts only), so keep point lights in view under realm 1's; the storm is a
  screen pass (a moving sand texture, tint and sight falloff) plus at most 150 streaks (60 on phones), not a cloud of
  particles; palms, cacti and rocks instanced; the pyramid one simple mesh; long low-sun shadows want the shadow
  camera at about ±36 m on desktop (±28 and 1024 on phones). Measured in groups 37 and 46 against realm 3's figures.

**Groups** (numbered on from realm 3's; each reviewed afterwards; checks recorded under Done)
- [ ] **37 Groundwork.** ([task 037](../backlog/037-dunes-groundwork.md)) `desert`, the Scorched Dunes, in the registry (`RealmId`, `src/world/realm4.ts`: a rough
  150 x 100 land to try things on: the sea and the lagoon on the west, the Red Mesas' cliffs on the north, the dune
  sea's ramps in the south half, the valley cut into the north cliffs, the pyramid's mound, the Sinking Sea and the
  south belt as plain ground for now), its story module, quest and light: the endless sunset (a light direction per
  realm; warm sun, blue-violet shade), and its nightfall. The five ground types, the first props (palms, cacti, rocks,
  bones, pots), its outskirts (the sea, the mesas, the erg, the snowy peaks beyond the north-east). Its music and
  ambience (`REALM_TRACKS.desert`, the new scale, the taiko pattern, the 7-beat bar). `wip`; no horse. Checks:
  tests/dunes.js (new: it builds, its ground mix, screens at hue 20-45°), reach4, spawns4 and normals4 (new),
  frame time against realm 3's, the full suite, screenshots including the first screen.
- [ ] **38 The sand.** ([task 038](../backlog/038-the-sand.md)) Sinking sand (ground, look, sinking, pulling free, fully sunk = a heart and back to the edge,
  the dead blundering in, the AI going round it), the shallow teaching patch on the road; sandstorms (warning, push,
  bracing on guard, the lee, the haze, shots drifting, the howl, never onto sinking sand or off a ledge), the three
  storm-uncovered spots (saved); dust devils; the oasis's water filling the flasks. Checks: tests/sinksand.js and
  sandstorm.js (new), a bot that walks the dunes through three storms and never loses a heart to one, reach4 (no
  traps in hollows), screenshots of a storm from the game camera.
- [ ] **39 The way in.** ([task 039](../backlog/039-dunes-the-way-in.md)) The Dune Strait opened from the Reef (`swim` on a border; the travel card "The Sunken Reef
  -> The Scorched Dunes"), the Serpent's Lagoon and its reef gap, the serpent waiting in the lagoon (saved), the coast's
  strip and the Smugglers' Cave; the first screen: the serpent coming into the lagoon under the low sun, salt flats,
  palms, dunes, the pyramid's tip on the skyline. The pause menu sets no knight down here who hasn't the serpent.
  Checks: tests/dunestrait.js (new: both ways, with a reload), serpent, serpentswim, travel, border, menutravel,
  worldmap, reach3, reachserpent.
- [ ] **40 The land.** ([task 040](../backlog/040-dunes-land.md)) The zones dressed, each its own ground, plants, relief and light: the Salt Flats and the
  Stranded Dhow, the caravan road and its way-stones, Sweetwell and its palm gardens (roomy), the Red Mesas and the
  Scarab Ring's hollow, the Scorpion Hollow, the dune sea (the Great Dune, the Bone Arch, the Sunken Face, the Mirage
  Flats), the Sun Temple on its outcrop, the Robbers' Dig, the Valley of Tombs (tombs cut into the cliffs, the
  Sealed Tomb, the caravan's empty wagons), the Avenue of Obelisks, the pyramid's forecourt, the Sinking Sea and the
  Sunk Caravan, the Frost Pass's foot. Paths to every place with a purpose, none to secrets; about 24 named places;
  tall things kept off the camera's line to places meant to be seen. Checks: the overhead map (no even sprinkles, no
  empty stretches), reach4, normals4, region names, screenshots of each zone.
- [ ] **41 Foes and hazards.** ([task 041](../backlog/041-dunes-foes-and-hazards.md)) The dead's body and its kinds (tomb guards and shield-bearers rising again in the
  shade, tomb archers, mummies burning), scorpions, scarab swarms, the Cactus, the goblin tomb-robbers in their own
  gear; dart plates and statues; the Avenue's buried ambush; the vultures and the rest of the life. Placed: about 54
  (the dig's robbers, cacti and scorpions on the rocky flats and mesas, swarms in tombs and urns, the dead in the
  valley and the pyramid, an ambush on the Avenue). Checks: tests/tombfoes.js and darts.js (new; every attack's mark
  fills 1.2 s or more), spawns4 (the dead may start in the shade only where meant), foes4 (blows per foe on arrival).
- [ ] **42 The Sunglass and the Sun Sphinx.** ([task 042](../backlog/042-sunglass-and-sun-sphinx.md)) The Sun Temple's terrace and the Sphinx (its fight, its fall, its
  words); the Sunglass set in the shield (visible), the beam in sunlight, shafts and pools of light indoors, what
  it does to each thing, the obelisks' bronze mirrors (struck, each turns a quarter; a faint line shows where it
  points). The quest: "Win the sun-priests' glass" after the leader's step. Checks: tests/sunglass.js, sphinxbot.js
  (a player-like bot at level 7: about 40 s, 0-2 blows) and sphinxfair.js (a dodging bot hit at most once), reach4.
- [ ] **43 The Sand Wyrm.** ([task 043](../backlog/043-the-sand-wyrm.md)) Its model and riding (sand, rock, sinking sand, its jump, bite, Burrow, the burrow dodge),
  the Robbers' Dig and its keepers, the shackles and its thrashing, "The Shackled Wyrm" quest (saved), the Sealed
  Tomb's sand-choked door it burrows through, the Sinking Sea and the Sunk Caravan, the Frost Pass's foot (shut, it
  turns back from the snow), where it waits (saved). Checks: tests/wyrm.js (with a reload), wyrmmoves.js,
  reachwyrm (it reaches only what the story allows), reach4 with and without it.
- [ ] **44 People, quests and secrets.** ([task 044](../backlog/044-dunes-people-quests-secrets.md)) Sweetwell's 22 or so folk going about the endless evening (their words
  changing with the Sunglass, the wyrm and the captive); the bronze-smith's curved edge and the wares; the captive
  ("The Lost Caravan": Anise, the caravan master's daughter, caged in the Valley of Tombs, guarded); the trial in the
  Scarab Ring (3/4/4 of the realm's own foes, a sheltered hollow where no storm reaches; the Sun Scarab: +25% coins
  from foes, the prototype's; purse 110); three Moon Shards (one a storm uncovers, one on the Sunk Caravan, one in
  the Sealed Tomb); 24 chests by how hidden; 9 lore stones (the prototype's two lines among them); the cracked wall
  (a tomb's false wall); the Scorpion Queen and her chest. Three errands: the Dry Well (something nests under
  Sweetwell's second well: a scarab nest in a cave down its stair; cleared, the water rises and the gardens green,
  visible from the camera), What the Storm Uncovers (Old Tamarisk sends him to wait out storms at the three spots),
  the Shield Slide (Fig bets he can't slide the Great Dune on his shield through the flags in his time: hold guard
  running down its long face). Checks: tests/folk4, captive4, trial4, shards4, errands4, economy4 (new), reach4.
- [ ] **45 The Sand Pharaoh.** ([task 045](../backlog/045-the-sand-pharaoh.md)) The way in, the shared spine in the realm's form: the Sun Door lies in the pyramid's
  shadow; the Avenue's three obelisk mirrors carry the sun to it (the lever); inside, the descending passage (dart
  plates, swarms in the urns), the Hall of Guards (the garrison: the dead rising again in its shade, shafts of light
  to finish them in; their fall opens the burial chamber), the burial chamber (the arena: about 16 x 14 m of floor
  for a ranged tyrant, low walls on the camera's side, two sarcophagi for his calls, three shafts of the stuck sun
  falling in pools; the door shuts when he wakes, a lost fight lifts it). The fight, one attack at a time: sand rain
  onto spots filling 1.5 s that leaves sinking pools for 4 s; a fan of golden scarabs along 3 lines (5 enraged) fixed
  0.45 s before; he sinks into the floor and rises where a whirl of sand fills 1.2 s (never under the knight), with a
  burst 2 m round; close in, his crook's sweep, its reach filling 1.2 s; between, a whirling sand shroud that blows
  glance off until the Sunglass's light from a pool strikes him (dazed 2 s, full damage). Enraged at half ("The sands
  will bury you!"): the floor's rim turns to sinking sand (shown 2 s before), the pools last 6 s, two tomb guards
  rise from the sarcophagi. Felled: the sun sets; nightfall over the realm (the lamps, the stars, the village out
  celebrating). Checks: tests/pyramid.js, pharaoh.js, pharaohfair.js (a dodging bot hit at most once calm, once
  enraged), pharaohbot.js (a level-7 bot: 55-70 s, losing 1-3 blows, 2-6 of 10 hearts).
- [ ] **46 Review and balance.** ([task 046](../backlog/046-dunes-review-and-balance.md)) The economy, toughness, the bosses' bots, how much is common with realms 1 to 3 (aim
  about 40%, scored as [REALMS.md](../../docs/design/realm-scores.md) does), the counts against this plan, performance on desktop and phones, a
  playthrough from a fresh save to nightfall (every quest finishes and stays done after reloads and travel), the
  full suite, [README](../../docs/realms/README.md), [REALMS.md](../../docs/design/realm-scores.md); then `wip` off.

**Balance plan** (targets set now; group 46 measures them)

| | Realm 3 ([its scores](../../docs/design/difficulty.md); bosses and coins after group 36) | Realm 4 (target) |
|---|---|---|
| The knight on arrival | Level 5 (x2.25), 8 hearts | Level 7 (x2.75), 9 hearts, 6 flasks healing 3, the Crest, Seed, Tide Pearl, storm lantern, the serpent |
| The knight at the end | Level 7, 9 hearts | Level 7 and the curved edge 2 (reach +24%), 10 hearts, the Sun Scarab, the Sunglass, the wyrm |
| `foeHp` | x2.25 | x2.75 (and no higher while no realm sells damage) |
| Placed foes, their health | 62, 682 (mini-bosses 194) | about 54 and 2 mini-bosses, about 700 (mini-bosses about 98) |
| Opening blows to clear them on arrival | 303 | 260-290 (the dead rising again in the shade adds a few) |
| Ranged foes; foes causing an effect | 13%; 39% | about 28%; about 48% |
| A hit costs | 1 heart | 1; a boss's or mini-boss's 2 (fully sunk in sinking sand: 1; a storm: never) |
| Mini-bosses (a level-7 bot) | Brassbelly 34-45 s, 0-4 hearts; Old Inkarm 49-69 s, 0-2 | the Sphinx about 48 health, 35-45 s, 0-2 blows; the Queen about 50, the same |
| Tyrant (a level-7 bot) | the Tidelord 105: 52-61 s, 0-4 hearts | the Pharaoh about 115 (tuned alone): 55-70 s, 1-3 blows (2-6 hearts) |
| Trial | 11 realm-1 foes, purse 100 | 11 of the realm's own, purse 110 |
| What it sells | 1,860 | about 2,050: the curved edge 600 and 750; sand-veils 100 and 220; the combo keeper 120 and 260 |
| What it pays | +20% over what it sells | about 2,350 (+15%): 24 chests 35-90 by how hidden (~1,350), quests ~500, the trial 110, foes and pots ~300, the robbers' cache 90 |

How it's checked: economy4 (chests, quests, purse, trial against the price list), foes4 (blows per foe on arrival
at level 7, and at level 5 for a knight who skipped the coral-smith: about 22% more), the three boss bots and the two
fair bots, the storm bot, reach4 with and without the wyrm and the Sunglass. Where it might need a second look:
the two-heart boss blows against 10 hearts and flasks healing 3 (if the bots lose under a third of their hearts, the
Pharaoh hits harder rather than more often); the Sunglass outdoors against mummies (keep mummies mostly in the shade);
whether reach alone feels like an upgrade (if not, the second level adds a faster spin instead).

**Size of the work.** Ten groups, about realm 3's (28 to 36 and its content round folded into 40 to 44, with the
counts above fixed first). Run lean: two or three agents' copies at a time (the land and foes can run side by side
once 37 and 38 are in).
