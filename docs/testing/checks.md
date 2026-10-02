# The checks

All 90 checks in `tools/test-all.mjs`, by realm and area, one line each. The line here is a summary;
the check's full description in `tools/test-all.mjs` (printed above its report when it runs) is its pass condition.
How to run them and read their reports: [how the game is checked](testing.md). URL flags: [shortcuts](shortcuts.md).

- **Run** is the page query after `http://localhost:<PORT>/?`. `shot&play` skips the title; `&realm=` picks the realm;
  `&god` no damage; `&lvl=N` a bot's sword level; `&fair` the fairness mode of `tests/tidebot.js`.
- **Wait** is how long `tools/shot.mjs` waits after the script (seconds). A script ending in an `async` block
  that is awaited runs first in full, so the check takes longer than its wait (see testing.md).
- ↻ the check reloads the page and runs more scripts after it (`AFTER`). † it depends on timing or chance and
  can fail on a loaded machine: rerun it alone before believing it ([flaky checks](testing.md#flaky-checks)).
- Run some against a running server, its port in `PORT` (on this machine 5173 and 5174 belong to another app):
  `PORT=5175 npm test -- reach3 spawns3 normals3`; or with a temporary server of their own:
  `bash tools/withserver.sh . 5190 node tools/test-all.mjs reach3 spawns3 normals3`.

## Realm 1, the Moonlit Keep (`castle`, the default): 37 checks

### The world

| Check | Script | Run | Wait | What it checks |
|---|---|---|---|---|
| `reach` | `reach.js` | `shot&play` | 1.5 | Everything reachable, no way out of the world, no traps. |
| `spawns` | `spawns.js` | `shot&play` | 0.3 | No foe, villager or animal starts inside a tent, wall, rock, deep water or a fire. |
| `normals` | `normals.js` | `shot&play` | 0.3 | No mesh face without a normal, no corner that is not a number (they blacken the screen). |
| `reachstag` | `reachstag.js` | `shot&play` | 1.5 | On the Thornstag (2.75 m climb): no way out, nothing shut skipped but the known thorn-road hop. |

### Controls, menus, talk

| Check | Script | Run | Wait | What it checks |
|---|---|---|---|---|
| `controls` | `controls.js` | `shot&play&at=80,63` | 2.8 | Guard tap rolls, hold blocks, Space jumps. |
| `moves` | `moves.js` | `shot&play&at=80,63` | 6.2 | Charge, spin, down-stab and the three specials. |
| `menus` | `menus.js` | `shot&play` | 15 | Pause menu by keyboard, a stuck mouse released, the cracked wall wants an aimed blow, aim lines removed, Tam walks home. |
| `talk` | `talk.js` | `shot&play` | 32 | E, Enter or Space page through a talk without restarting it or jumping; mashing at the smith buys nothing. |
| `pad` † | `pad.js` | `shot` | 22 | A faked gamepad starts, walks, talks and pauses; prompts and tips name pad buttons. |
| `phone` | `mobileflow.js` | `shot` `MOBILE=1` 844x390 | 9 | Phone size and touch: tap through the story, the stick, attack. |
| `pause` | `pause.js` | `shot&play&at=80,64` | 8 | Pause holds timers and cutscenes, leaving the window pauses, victory freezes the world, no music burst. |

### Fights, foes and effects

| Check | Script | Run | Wait | What it checks |
|---|---|---|---|---|
| `fight` | `fight.js` | `shot&play&at=86,40` | 9 | An auto-fight near the woods. |
| `death` | `death.js` | `shot&play&at=95,24` | 9 | The knight falls, then rises at the moonfire. |
| `effects` | `effects.js` | `shot&play&at=80,63` | 4.5 | Maim slows, daze with no re-daze, burn costs a heart, a roll puts it out. |
| `foes` † | `foes.js` | `shot&play` | 46.5 | Live encounters: the brute dazes, the thrower burns, the darter poisons, the shaman hastes. |
| `freeze` | `freeze.js` | `shot&play` | 4.2 | No burn damage while reading; no second daze right after one. |
| `home` | `home.js` | `shot&play` | 12 | A thrower that loses the knight walks back to its post. |
| `bats` | `bats.js` | `shot&play` | 8 | A thief bat steals coins, not hearts; killing it gives them back. |
| `flask` | `flask.js` | `shot&play` | 9 | Flasks cure at full health and on horseback, none wasted; hearts wait until needed. |
| `rigs` | `rigs.js` | `shot&play&at=95,24` | 6 | Characters built, the knight shows through walls, a broken shield vanishes, textures freed. |
| `soak` | `soak.js` | `shot&play` | 40 | 40 s under firepot fire: the light count stays flat. |

### Riding

| Check | Script | Run | Wait | What it checks |
|---|---|---|---|---|
| `ride` | `ride.js` | `shot&play&dawn&lines=200` | 3.8 | Mount, gallop, dismount, remount. |
| `horse` | `home2.js` | `shot&play` | 1.2 | Riding into shallow water puts out flames. |

### Places, quests, the tyrant

| Check | Script | Run | Wait | What it checks |
|---|---|---|---|---|
| `hollow` | `hollow.js` | `shot&play&god` | 4.8 | The cracked wall: a light hit chips it, a combo breaks it. |
| `trial` | `trial.js` | `shot&play&god` | 9 | The Seven Stones: three waves and the relic. |
| `trial2` | `trial2.js` | `shot&play` | 11 | The trial brings the new foes; the courtyard holds eight. |
| `farm` | `farm.js` | `shot&play&god&at=93,97` | 4.6 | The Warden's quest start to finish. |
| `review` | `review.js` | `shot&play` | 5.6 | Kills saved, no loot from a reset trial, chandeliers re-hang. |
| `wares1` | `wares1.js` | `shot&play` | 14 | The smith's barding: one more hit for the warhorse a piece, two pieces at most. |
| `boss` | `boss.js` | `shot&play&god&at=30,18.5` | 14 | The Goblin King fight runs. |

### Economy and saves

| Check | Script | Run | Wait | What it checks |
|---|---|---|---|---|
| `economy` | `economy.js` | `shot&play` | 20 | Trial foes drop nothing and the win pays 90; stolen coins come back unmultiplied; arrows into the horse never maim. |
| `economy1` | `economy1.js` | `shot&play` | 0.3 | Blackpine's foes are as tough as their kind (no realm multiplier). |
| `migrate` ↻ | `migrate1.js`, `migrate2.js` | `shot&play` | 2.5 | A version-1 save loads into the several-realm save with nothing lost. |

### Between realms

| Check | Script | Run | Wait | What it checks |
|---|---|---|---|---|
| `menutravel` ↻ | `menutravel1.js`, `menutravel2.js`, `menutravel3.js` | `shot&play` | 5 | The pause menu lists the other realms and travels to Whisperwood and back, out at the last moonfire. |
| `border` ↻ | `border1.js`, `border2.js`, `border3.js` | `shot&play` | 9 | The thorn road: the hedge holds against a sword, a warhorse charge breaks it, the road leads over and back. |
| `worldmap` ↻ | `worldmap1.js`, `worldmap2.js`, `worldmap3.js` | `shot&play` | 1.5 | The pause menu's world map: realms marked, visited ones' stats, clicking the Keep travels there. |
| `travel` ↻ | `travel1.js`, `travel2.js`, `travel3.js` | `shot&play` | 3.5 | Crossing to Whisperwood and back: travel card, both realms keep progress, the knight keeps his coins. |

## Realm 2, Whisperwood (`forest`): 27 checks

### The world

| Check | Script | Run | Wait | What it checks |
|---|---|---|---|---|
| `reach2` | `reach.js` | `shot&play&realm=forest` | 1.5 | Everything reachable, no way out of the world, no traps. |
| `reachstag2` | `reachstag.js` | `shot&play&realm=forest` | 1.5 | On the Thornstag: no way out of the world, no way round the Thorn Heart. |
| `spawns2` | `spawns.js` | `shot&play&realm=forest` | 0.3 | Nothing starts inside anything. |
| `normals2` | `normals.js` | `shot&play&realm=forest` | 0.3 | No mesh face without a normal, no corner that is not a number. |
| `wood` | `wood.js` | `shot&play&realm=forest` | 13 | Rope bridges hold, the chasm's edge costs a heart and puts him back, the brook's far bank can't be climbed. |
| `vines` | `vines.js` | `shot&play&realm=forest` | 5 | Holding jump against vines climbs onto the ledge; a bare cliff stays unclimbable. |
| `lights` † | `lights.js` | `shot&play&realm=forest` | 9 | Hollowbough's lamps fade in and out as the camera moves, never pop. |
| `fly` | `fly.js` | `shot&play&realm=forest` | 15 | Explore mode: flies unhurt, foes ignore him, nothing opened or moved on, wheel zooms, lands on open ground. |
| `arenastag` | `arenastag.js` | `shot&play&realm=forest` | 1.5 | The Warden's hollow holds until its garrison falls, on foot or on the stag's second leap. |

### Foes

| Check | Script | Run | Wait | What it checks |
|---|---|---|---|---|
| `foes2` † | `foes2.js` | `shot&play&realm=forest` | 26 | Live encounters: spitter's seed, snarer's bola, thornback's prick, the ravine's thorns, snare traps. |
| `ambush` | `ambush.js` | `shot&play&realm=forest&god` | 6 | The Old Grove's ambush: three hidden goblins, one bursts out when he passes close; explore mode stirs none. |

### Folk, wares, the captive

| Check | Script | Run | Wait | What it checks |
|---|---|---|---|---|
| `folk` | `folk.js` | `shot&play&realm=forest` | 30 | Prompts name the folk; the Reeve, the owl's hints, the thorn-smith (tempers to level 5), the innkeeper's flasks. |
| `wares` | `wares.js` | `shot&play&realm=forest` | 16 | The weaver's boots and the herbwife's tonic: paid for, at once, saved. |
| `sister` ↻ | `sister1.js`, `sister2.js` | `shot&play&realm=forest` | 16 | Wren's cage: three blows, her purse, she runs home, Ash's savings; all stays done after a reload. |

### The Thornstag, places and secrets

| Check | Script | Run | Wait | What it checks |
|---|---|---|---|---|
| `stag` | `stag.js` | `shot&play&realm=forest` | 13 | The Thornstag freed by three blows (saved); the gore, the thorn shield, the thorn burst, a second leap. |
| `stagbed` | `stagbed.js` | `shot&play&realm=forest` | 12 | Living thorns choke the stag's bed: a sword only scratches them, the thorn burst tears them away. |
| `oaks` | `oaks.js` | `shot&play&realm=forest&god` | 9 | The Ring of Oaks: three waves, the Heartwood Seed (+1 heart) and 100 coins. |
| `secrets2` | `secrets2.js` | `shot&play&realm=forest` | 12 | The niche's cracked rock, the vine ledge's chest, three shards give a heart. |
| `treasures2` | `treasures2.js` | `shot&play&realm=forest` | 23 | Hidden places reached as a player would (running jumps, ladders, the rope walk); every new chest pays. |
| `corners2` | `corners2.js` | `shot&play&realm=forest` | 8 | Once-empty corners pay (chests, lore, keepers); Hollowbough's walkers walk, its sitters sit. |

### The Hold and the Thorn Warden

| Check | Script | Run | Wait | What it checks |
|---|---|---|---|---|
| `hold` ↻ | `hold1.js`, `hold2.js` | `shot&play&realm=forest` | 33 | The Warden's Hold: thorns, the Thorn Heart, the garrison, the Warden wakes and the hall shuts; stays done after a reload. |
| `warden` | `warden.js` | `shot&play&realm=forest` | 44 | The Thorn Warden: volleys, arrow rain, goblins called in, enraged at half health, felled. |
| `wardenfair` † | `wardenfair.js` | `shot&play&realm=forest` | 78 | A fair fight: room, marks filling 1.2 s or more, one attack at a time; a dodging bot is hardly hit. |
| `bossbot` † | `bossbot.js` | `shot&play&realm=forest&lvl=3` | 125 | Balanced: a player-like bot with a level-3 sword wins in 45 to 110 s, losing at most 10 hearts. |

### Economy

| Check | Script | Run | Wait | What it checks |
|---|---|---|---|---|
| `economy2` | `economy2.js` | `shot&play&realm=forest` | 0.3 | Chests pay 900 to 1200 coins in all (the tempers and a little more); foes 1.6 times as tough. |

### Between realms

| Check | Script | Run | Wait | What it checks |
|---|---|---|---|---|
| `seastair` | `seastair.js` | `shot&play&realm=forest` | 1.5 | The Sea Stair's rockfall needs the Thornstag's second leap both ways (a reach check). |
| `stairleap` ↻ | `seastair1.js`, `seastair2.js`, `seastair3.js` | `shot&play&realm=forest` | 14 | The Sea Stair played: on foot he cannot pass; on the stag over to the Reef and back. |

## Realm 3, the Sunken Reef (`aqua`): 26 checks

### The world

| Check | Script | Run | Wait | What it checks |
|---|---|---|---|---|
| `sea` | `sea.js` | `shot&play&realm=aqua&god` | 12 | Groundwork: on land as usual, under the surface everything floats, shots slower, divers and land-walkers kept apart, its music and look. |
| `reach3` | `reach.js` | `shot&play&realm=aqua` | 1.5 | Everything reachable, no way out of the world, no traps. |
| `spawns3` | `spawns.js` | `shot&play&realm=aqua` | 0.3 | Nothing starts inside anything (sea creatures in the sea, divers may stand in deep water). |
| `normals3` | `normals.js` | `shot&play&realm=aqua` | 0.3 | No mesh face without a normal, no corner that is not a number. |
| `reachserpent` | `reachserpent.js` | `shot&play&realm=aqua` | 1.5 | On the Tide Serpent, with the suit and without: no way out, nothing unreachable, nothing reached early. |
| `rides` | `rides.js` | `shot&play&realm=aqua` | 26 | The trench's currents carry a diver both ways; bubble columns lift him to the wreck's and the tower's chests. |
| `seasound` | `seasound.js` | `shot&play&realm=aqua&god` | 45 | Its sound, read from the audio graph: a track and a sea ambience everywhere, place by place. |

### The diving suit and Brassbelly

| Check | Script | Run | Wait | What it checks |
|---|---|---|---|---|
| `costume` † | `costume.js` | `shot&play&realm=aqua` | 32 | Deep water stops him without the suit; Brassbelly drops it; air runs down and fills; breathless never costs a heart. |
| `costumedrop` ↻ | `costumedrop1.js`, `costumedrop2.js` | `shot&play&realm=aqua` | 1.5 | Brassbelly's suit left lying stays there after a reload; walked onto, it is the knight's. (Part 1 never reloads the page today, so part 2 runs on the same page: see [testing.md](testing.md#toolstest-allmjs-the-suite).) |
| `salvagerbot` † | `salvagerbot.js` | `shot&play&realm=aqua&lvl=5` | 160 | A fair fight: a level-5 bot beats Brassbelly and his crew in 25 to 90 s, losing at most 5 hearts. |

### Foes

| Check | Script | Run | Wait | What it checks |
|---|---|---|---|---|
| `seafoes` † | `seafoes.js` | `shot&play&realm=aqua` | 80 | Live encounters: the diver's float, the harpooner's line, jellies, crabs, eels, pufferfish, giant clams. |

### The Tide Serpent

| Check | Script | Run | Wait | What it checks |
|---|---|---|---|---|
| `serpent` ↻ | `serpent1.js`, `serpent2.js` | `shot&play&realm=aqua` | 14 | Netted in its pool: three stakes cut, freed (saved), ridden; stays free after a reload. |
| `serpentswim` | `serpentswim.js` | `shot&play&realm=aqua&god` | 0.3 | Without the suit it keeps to the surface; with it, it dives, strokes up, and carries him up out of air. |
| `serpentmoves` | `serpentmoves.js` | `shot&play&realm=aqua` | 0.3 | Bubble shot, whirlpool, bubble shell; thrown without the suit he is washed back. |
| `serpentledge` | `serpentledge.js` | `shot&play&realm=aqua&god` | 0.3 | Places only the serpent reaches; no getting off in open water without the suit; the Dune Strait shut. |

### Folk and the captive

| Check | Script | Run | Wait | What it checks |
|---|---|---|---|---|
| `reef` | `reef.js` | `shot&play&realm=aqua` | 48 | The coral village: prompts, rounds, hints, coral edges (levels 6 and 7), flasks, the air bladder, the lodestone. |
| `kip` ↻ | `kip1.js`, `kip2.js` | `shot&play&realm=aqua` | 16 | The pearl-diver's son: the guarded cage, his pearls, he swims home, Maren's pearl; all stays done after a reload. |

### Places, secrets, economy

| Check | Script | Run | Wait | What it checks |
|---|---|---|---|---|
| `pearl` | `pearl.js` | `shot&play&realm=aqua&god` | 22 | The coral shrine mends mounts; the Whalebone Isle: three waves, the Tide Pearl and 100 coins. |
| `secrets3` | `secrets3.js` | `shot&play&realm=aqua` | 8 | Three Moon Shards under the sea (out of reach without the suit) give a heart; four lore stones. |
| `economy3` | `economy3.js` | `shot&play&realm=aqua` | 1.5 | All 35 chests and every reward pay 10-25% over what its folk sell, not twice over; foes 2.25 times as tough. |

### Old Inkarm

| Check | Script | Run | Wait | What it checks |
|---|---|---|---|---|
| `inkbot` † | `inkbot.js` | `shot&play&realm=aqua&lvl=5` | 110 | Fair and balanced: lines and rings fill 1.2 s or more, mashing frees him; a level-5 bot wins in 40 to 90 s, at most 5 hearts. |

### The palace and the Tidelord

| Check | Script | Run | Wait | What it checks |
|---|---|---|---|---|
| `palace` ↻ | `palace1.js`, `palace2.js`, `palace3.js` | `shot&play&realm=aqua` | 38 | The floodgate, the great bell, the landing crew, the hall shuts behind; stays done over two reloads. |
| `tidelord` | `tidelord.js` | `shot&play&realm=aqua` | 72 | Every move seen (lane, orbs, slam, sweep, crew); enraged the tide turns; felled, the sea free. |
| `tidefair` † | `tidebot.js` | `shot&play&realm=aqua&fair` | 72 | A fair fight: room, low walls on the camera side, marks 1.2 s or more; a dodging bot is hardly hit. |
| `tidebot` † | `tidebot.js` | `shot&play&realm=aqua&lvl=6` | 130 | Balanced: a bot with the coral-smith's level-6 sword wins in 40 to 100 s, losing at most 4 hearts. |

### Between realms

| Check | Script | Run | Wait | What it checks |
|---|---|---|---|---|
| `stairmenu` ↻ | `seastairmenu1.js`, `seastairmenu2.js` | `shot&play&realm=aqua` | 5 | The pause menu to Whisperwood without the Thornstag sets him at the realm's start, not below the rockfall. |

## Not in the suite

Scripts in `tests/` that `npm test` does not run (run them with `tools/shot.mjs`; see testing.md):

- `monkey.js`: two minutes of random play all over realm 1, flagging errors, NaN positions, falls through the
  ground and stuck states (`node tools/shot.mjs "shot&play" shots/monkey.png 124000 1280x720 tests/monkey.js`).
- `tour.js` (realm 1) and `tour2.js` (`&realm=forest`): frame rate, draw calls and triangles at each area;
  `cost.js`, `perf.js`, `hitch.js`: frame cost, frame rate, the first-use hitch.
- `villagemap.js` (a top-down plan of Keepsfoot), `map.js` (an older debug map), `routes.js` (planned routes
  walked for steps and blocks); `tools/mapview.js` and `tools/emptymap.js` are the current map tools.
- `save1.js`/`save2.js` and `progress1.js`/`progress2.js`: saving across two sessions (run with `PROFILE=<dir>`
  so the second run sees the first one's storage); `playthrough.js`: realm 1's main quest by teleport.
- One-off probes kept from earlier work: `critters.js`, `farm2.js`, `hazards.js`, `slit.js`, `ride2.js`, `spin.js`,
  `swing.js`, `phonepause.js`, `portrait.js`, `review2.js`.

