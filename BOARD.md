# Board

Tasks and known issues for Eight Realms: The Moonlit Keep. New work and newly found
problems go into **Backlog**; whatever is being worked on sits in **In progress**; finished
items move to **Done** with the date.

## In progress

_Nothing right now._

## Backlog

**From the detail pass (2026-09-28)**
- [ ] Performance of the new detail (deferred on request): the detail pass adds about 18-22% triangles per frame (the start area ~228k -> ~269k), ~25 new animals and more particle emitters. Measure on a real phone; if needed, thin the map-wide scatter on phones further, merge critter meshes, or cull far emitters.

Found in the review of 2026-09-28. "Confirmed" = reproduced in a live game (`tests/review2.js`); the rest are from reading the code.

**Bugs**
- [ ] Poison can't be cured at full health: the flask only works below full hearts, but darts poison without costing one. The tip and the README both say "a flask cures it". (Confirmed)
- [ ] A flask drunk on horseback heals but doesn't cure maim, poison or burn; on foot it does. (Confirmed)
- [ ] Timers keep running while paused: Tam's thank-you dialog, the hall-door cutscene, the victory screen, respawns and fall recovery can all fire behind the pause menu. (Confirmed)
- [ ] Phones never see warning prompts: the cracked wall's hint, "strike the cage to break the lock" and "Enemies are near" at a moonfire exist only in the desktop prompt, and no button shows either. A phone player gets no clue at all. (Confirmed for the wall and the cage)
- [ ] Phones: the wayshrine tip says "Light the moonfire with E".
- [ ] "New journey" on the title screen erases the save at once, with no confirmation.
- [ ] The victory screen's "foes defeated" only counts kills since the page last loaded (the count isn't saved).

**Exploits and balance**
- [ ] Endless coins from the Seven Stones: die mid-trial and it resets, but you keep the coins from the foes you killed; wave 1 can be farmed forever.
- [ ] Killing a thief bat returns its stolen coins multiplied by the combo bonus (up to ×4).
- [ ] Heart pickups are used up at full health. (Confirmed)
- [ ] An arrow that hits the horse can still maim the knight.

**Minor**
- [ ] The Seven Stones journal says "Strike its altar"; the altar is actually used with the interact button ("Face the trial").
- [ ] The cracked wall chips from any swing within reach, even one aimed away from it.
- [ ] Aim-line meshes of dead archers are never removed (one more per trial run).
- [ ] The title menu can't be used from the keyboard (Tab and Space are swallowed), and the pause menu can't be used from a gamepad (Start only opens and closes it).

Found in the review of 2026-09-27 (see the chat for details).

**Bugs**
- [ ] Music burst after returning to a background tab: the scheduler has no catch-up guard, so every missed note plays at once.
- [ ] Portrait phones and tall windows show only ~6 m around the knight: zoom is picked from screen height only.
- [ ] Portrait layout: the area title prints over the effect icons; tips run off both edges and over the touch buttons.
- [ ] Touch tip wording: "A flask (the flask) cures it".
- [ ] The game keeps running when the window loses focus (only tab switches stop it): foes attack while you're in another app.
- [ ] 118 ms freeze the first time fire and pots appear (shaders compiled on first use, not at load).
- [ ] Victory screen: controls are off for up to 12 s while leftover foes, fires and effects keep running.

**Performance**
- [ ] The game's own code takes 4.6–7.5 ms per frame on a fast laptop, likely too slow for 60 fps on phones. All ~58 foes animate every frame even far away; particles process all 4,500 slots every frame. Skip far foes, process only live particles, warm up shaders at load, then re-measure.

**Minor**
- [ ] Dropped coins vanish after 40 s, while the chest they came from is already marked opened. The same happens if the tab is closed before they're picked up.
- [ ] Mouse released outside the window can leave the attack "held" (charging a spin) until the next click.
- [ ] Key names in tips assume QWERTY (keys are physical positions: on AZERTY "Q" is the key labelled A).
- [ ] Tam walks through fences and trees on his way home after the rescue.
- [ ] Debug key 1 teleports to the old start position.

**Unverified**
- [ ] Every sound (effects, ambience, music): the test browser is muted, so none of it has been heard.
- [ ] Real phones: touch controls and frame rate were only tested in an emulator.
- [ ] Difficulty and economy: tuned by feel, not playtested.

## Done

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
