# Board

Tasks and known issues for Eight Realms: The Moonlit Keep. New work and newly found
problems go into **Backlog**; whatever is being worked on sits in **In progress**; finished
items move to **Done** with the date.

## In progress

_Nothing right now._

## Backlog

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
- [ ] Dropped coins vanish after 40 s, while the chest they came from is already marked opened.
- [ ] Mouse released outside the window can leave the attack "held" (charging a spin) until the next click.
- [ ] Key names in tips assume QWERTY (keys are physical positions: on AZERTY "Q" is the key labelled A).
- [ ] Tam walks through fences and trees on his way home after the rescue.
- [ ] Debug key 1 teleports to the old start position.

**Unverified**
- [ ] Every sound (effects, ambience, music): the test browser is muted, so none of it has been heard.
- [ ] Real phones: touch controls and frame rate were only tested in an emulator.
- [ ] Difficulty and economy: tuned by feel, not playtested.

## Done

- 2026-09-27: Pathways between zones. Seven new footpaths (Warden's gate; wayshrine to the
  Seven Stones and on to the river camp; start to the raided farm; graveyard gate past the
  farmhouse and over the ford into the farm; to the pier; to the Overlook stair). Rule:
  places that are there to be found (marsh, island, Hollow) get no path. Also: the ford's
  bank was a ledge too high to climb out of the water; outskirts scenery no longer lands
  on paths.
- 2026-09-27: Balance update: status effects (maim, daze, burn, poison), harmless coin-thief bats, hammer brute, firepot thrower, bog darter, goblin shaman, knockdowns, tuning table in `src/config.ts`.
- 2026-09-27: Review fixes: effects pause in dialogs, no stun-lock, light leak, fire out on horseback, ranged foes walk home, courtyard trimmed to eight, trial uses the new foes, tips remembered.
