# Board

Tasks and known issues for Eight Realms: The Moonlit Keep. New work and newly found
problems go into **Backlog**; whatever is being worked on sits in **In progress**; finished
items move to **Done** with the date.

## In progress

_Nothing right now._

## Backlog

Sorted by priority on 2026-09-28. Each group is a set of related issues, fixed together
and then reviewed together. "Confirmed" = reproduced in a live game.

### High

_All done (2026-09-28)._

### Medium

_All done (2026-09-28)._

### Low

_All done (2026-09-28)._

### Can't be checked here
- [ ] Every sound (effects, ambience, music): the test browser is muted, so none of it has been heard.
- [ ] Real phones: touch controls and frame rate were only tested in an emulator.
- [ ] A real gamepad: only a faked one was tested. Buttons are named as on an Xbox pad, so a PlayStation pad works but its prompts say X/Y/A/B.
- [ ] Difficulty and economy: tuned by feel, not playtested.

## Done

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
