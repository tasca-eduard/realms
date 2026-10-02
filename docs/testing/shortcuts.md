# Testing shortcuts

URL flags, debug keys and console checks for a running dev server, the automated checks (`npm test`), the long soaks, and screenshots from the command line.

Add these to the URL while the dev server runs:

- `?play` skips the title and story. Add `&at=78,64` to start at a map position,
  `&god` for no damage, `&dawn` for the ending light, `&lines=200` to zoom in,
  `&realm=forest` to play Whisperwood, `&realm=aqua` the Sunken Reef (`castle` is realm 1).
- `?play&viewer&anim=attack0&t=0.2` shows every character model in one pose.
- `?debug` enables keys: G god mode, V explore mode (flying), T teleport to the mouse, 1 to 8 jump to key
  places (1 to 9 in Whisperwood; each realm's `debugSpots`), N and B cross to the next or previous realm
  (whether or not it is finished).
- Only for the checks: `&lvl=N` gives a boss bot a level-N sword (`tests/bossbot.js`, `tidebot.js`,
  `salvagerbot.js`, `inkbot.js`), `&fair` runs `tests/tidebot.js` as the fairness check, and `&crop=x0,z0,x1,z1`
  draws part of the overhead map (`tools/mapview.js`).
- In the browser console, `__reach()` floods the map from the start the way the knight
  moves and lists anything unreachable and any spot where he could leave the world
  (`__reach(false)` checks before the story opens anything, such as realm 1's drawbridge;
  `__reach(true, 2.75)` on the Thornstag; `__reach(true, undefined, true)` with the Tide Serpent).

**Automated checks.** `PORT=<port> npm test` (all 91) or `PORT=<port> npm test -- talk pad` (only those) against a
running server; what each check covers is in [the checks](checks.md), how to run and read them in
[how the game is checked](testing.md).

Two longer checks are left out of `npm test`: `tests/monkey.js` (two minutes of random
play all over the map, flagging errors, NaN positions, falls through the ground and stuck
states) and `tests/tour.js` (frame rate and draw calls at 25 stops).

A check that has to follow a reload (a border crossing, a save loaded fresh) names the
scripts for the reloaded page in `AFTER` (comma-separated, `AFTER_WAIT` ms apart); see the
`migrate` and `travel` entries in `tools/test-all.mjs`.

One screenshot from the command line (`PORT` is the dev server's port: on this machine 5173 and 5174 belong to
another app, so `npm run dev` lands on 5175 or later; `tools/withserver.sh` starts a server of its own):

```
PORT=5175 node tools/shot.mjs "shot&play&at=94,31" shots/camp.png 3000
PORT=5175 MOBILE=1 node tools/shot.mjs "shot" shots/phone.png 9000 844x390 tests/mobileflow.js
PORT=5175 node tools/shot.mjs "shot&play&god" shots/village.png 1500 924x700 tests/villagemap.js   # top-down plan of Keepsfoot
PORT=5175 node tools/shot.mjs "shot&play" shots/monkey.png 124000 1280x720 tests/monkey.js      # random-play soak
bash tools/withserver.sh . 5190 node tools/shot.mjs "shot&play&realm=aqua" shots/reef.png 2500   # a server of its own
```

See also: [How the game is checked](testing.md), [The checks](checks.md), [Project layout](../code/layout.md), [the docs index](../README.md).
