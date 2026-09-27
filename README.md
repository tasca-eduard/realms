# Eight Realms: The Moonlit Keep

An isometric remake of the first realm of Eight Realms: a knight crosses a moonlit
countryside, frees a captive, lowers the keep's drawbridge and dethrones the Goblin King.
It runs in the browser, on desktop and on phones.

## Run it

```
npm install
npm run dev
```

Open http://localhost:5173.

**On your phone:** keep the dev server running and put the phone on the same Wi-Fi.
Vite prints a `Network:` address when it starts (something like `http://192.168.1.20:5173`).
Open that on the phone. The game goes fullscreen and asks for landscape when you press Begin.

`npm run build` makes a static copy in `dist/` that any web host can serve.

## Controls

| Action | Desktop | Phone |
| --- | --- | --- |
| Move | WASD | Left thumb (the stick stays where you first touch) |
| Aim | Mouse (attacks, rolls and blocks go where you point) | Automatic: the nearest foe roughly where you push |
| Attack | Left click; click again to combo (the third hit breaks shields) | Red sword button |
| Charged spin | Hold left click, release; blue means full (two hits, breaks shields) | Hold the sword button |
| Down-stab | Left click in the air; bounces off what it hits | Sword button in the air |
| Guard | Right click: **tap** to roll, **hold** to block, press just before a hit to **parry**; in the air, a dodge | Shield button (same) |
| Jump | Space (up onto ledges about a metre high) | Blue arrow button |
| Special | F, costs half the blue bar: **dash strike** when moving, **sword wave** when still, **plunge** in the air | Star button |
| Talk, open, rest, read, ride | E | Gold button that appears with the prompt |
| Drink a Moon Flask | Q | Flask button |
| Pause, settings, journal | Esc | Pause button at the top |

A gamepad also works: left stick moves, right stick aims, X attack, B guard, A jump,
RB special, Y interact, LB drink, Start pause. In menus and dialogs the stick picks and
A, X or Y confirms. The pause menu lists the controls for whichever device you are using.

**On the warhorse** (it waits by the King's Road; E to ride and to get off): attack kicks,
guard rears and stomps, special charges, galloping into foes tramples them. Hits land on
the horse first; if its three pips run out you are thrown and it bolts, coming back later.
It won't go indoors, and it finds you when you rest at a far-off moonfire. Resting heals it.

**Combat details:** hits build energy and a combo; at 5, 10 and 15 hits foes drop 2, 3 or
4 times the coins. Blocking drains stamina while held; rolling needs stamina ("tired"
when you're out). A parry stuns, slows time and gives stamina and energy back. Enemies
flash before they strike; ones you could see from where the knight stands show as a red
outline when trees, walls or roofs hide them from the camera.

## The realm

- **The King's Road**: where you arrive, with the warhorse. The Old Warden's homestead
  stands in the meadow by the road (he has a job for you: raiders on the southern fields).
  Light the moonfire at the wayshrine; if you fall, you rise at the last moonfire you lit.
- **Keepsfoot**: the village. The innkeeper sells Moon Flasks, the smith sharpens your sword.
- **Blackpine Wood and Gnasher's Camp**: someone is locked in a cage there.
- **The Outer Bailey**: the winch that lowers the drawbridge (arrow slits watch it).
- **The Moonlit Keep**: clear the courtyard garrison to open the great hall and the
  Goblin King. His crashes can bring the chandeliers down, on you or on him.
- **Off the road**: the Seven Stones (a three-wave trial for the Knight's Crest relic), the
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

The **journal** in the pause menu lists your quests; the current step of the main quest
shows at the top right.

Unexplored land stays under mist (fog of war) until you walk near it.

**Saving.** Progress saves on this device (browser storage) whenever something changes
and when you close or switch away from the tab. It keeps: your coins, flasks and sword,
the last moonfire you rested at, chests opened, walls broken, shards, the relic, quests,
explored land, and which placed foes you have defeated: **a cleared area stays cleared**.
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
  engine/    renderer (low-res pixel pipeline, outlines, bloom, fog, fog of war),
             camera, input, lights, particles, materials, character rigs
  world/     map grid and collision, terrain and water meshes, grass, props,
             realm1.ts (the whole map, its people, foes and objects),
             outskirts.ts (the landscape beyond the map edges)
  game/      game.ts (states, camera, events, boss, saving), player.ts (the knight's
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
  `&god` for no damage, `&dawn` for the ending light, `&lines=200` to zoom in.
- `?play&viewer&anim=attack0&t=0.2` shows every character model in one pose.
- `?debug` enables keys: G god mode, T teleport to the mouse, 1 to 7 jump to key places.
- In the browser console, `__reach()` floods the map from the start the way the knight
  moves and lists anything unreachable and any spot where he could leave the world
  (`__reach(false)` checks before the drawbridge is lowered).

**Automated checks.** With the dev server running, `npm test` drives the game in headless
Microsoft Edge through every scripted check and prints what each one found: reachability,
controls, the full moveset, a fight, death and respawn, riding, the cracked wall, the
trial, the Warden's quest, saved kills, the boss fight and the phone flow. Screenshots
land in `shots/` (not kept).

One screenshot from the command line:

```
node tools/shot.mjs "shot&play&at=94,31" shots/camp.png 3000
MOBILE=1 node tools/shot.mjs "shot" shots/phone.png 9000 844x390 tests/mobileflow.js
```

## Known limits

- **Sound has never been heard during development.** The headless test browser is muted,
  so effects, ambience and music are untested by ear. Volumes are in the pause menu.
- **Phones were tested in an emulator only.** Touch controls and layout work there;
  real-device feel and frame rate are unknown. Phones get lighter settings (fewer lights,
  a smaller shadow map, less grass, a coarser pixel grid).
- **Balance is tuned by feel, not playtested**: damage, enemy counts, prices and the boss.
- The **title menu** is mouse, touch or gamepad; there is no keyboard navigation there.

## Credits

Music uses instrument samples from the FluidR3_GM soundfont by Frank Wen (CC BY 3.0),
taken from the original Eight Realms. Everything else is made in code.
