// Runs every scripted check in tests/ against the running dev server and prints
// each one's report. Usage: npm run dev (in another terminal), then npm test.
// Name some checks to run only those: npm test -- bats economy
import { execFileSync } from 'node:child_process';

const TESTS = [
  ['reach', 'shot&play', 1500, 'tests/reach.js', 'everything reachable, no way out of the world, nowhere to be stranded (traps: 0)'],
  ['spawns', 'shot&play', 300, 'tests/spawns.js', 'no foe, villager or animal starts inside a tent, wall, rock, deep water or a campfire'],
  ['controls', 'shot&play&at=80,63', 2800, 'tests/controls.js', 'guard tap rolls, hold blocks, Space jumps'],
  ['moves', 'shot&play&at=80,63', 6200, 'tests/moves.js', 'charge, spin, down-stab, the three specials'],
  ['fight', 'shot&play&at=86,40', 9000, 'tests/fight.js', 'an auto-fight near the woods'],
  ['death', 'shot&play&at=95,24', 9000, 'tests/death.js', 'fall, then rise at the moonfire'],
  ['ride', 'shot&play&dawn&lines=200', 3800, 'tests/ride.js', 'mount, gallop, dismount, remount'],
  ['hollow', 'shot&play&god', 4800, 'tests/hollow.js', 'cracked wall: light hit chips, combo breaks'],
  ['trial', 'shot&play&god', 9000, 'tests/trial.js', 'Seven Stones: three waves and the relic'],
  ['farm', 'shot&play&god&at=93,97', 4600, 'tests/farm.js', "the Warden's quest start to finish"],
  ['review', 'shot&play', 5600, 'tests/review.js', 'saved kills, no loot from a reset trial, chandeliers re-hang'],
  ['effects', 'shot&play&at=80,63', 4500, 'tests/effects.js', 'maim slows, daze and no re-daze, burn costs a heart, roll puts it out'],
  ['bats', 'shot&play', 8000, 'tests/bats.js', 'a thief bat steals coins, no hearts; killing it returns them'],
  ['flask', 'shot&play', 9000, 'tests/flask.js', 'flasks cure at full health and on horseback, none wasted; hearts wait until needed'],
  ['pause', 'shot&play&at=80,64', 8000, 'tests/pause.js', 'pause holds timers and cutscenes, leaving the window pauses, victory freezes the world, no music burst'],
  ['economy', 'shot&play', 20000, 'tests/economy.js', 'trial foes drop nothing and the win pays 90; stolen coins come back unmultiplied; arrows into the horse never maim'],
  ['menus', 'shot&play', 15000, 'tests/menus.js', 'pause menu by keyboard, stuck mouse released, cracked wall needs an aimed blow, aim lines removed, Tam walks the road home'],
  ['talk', 'shot&play', 32000, 'tests/talk.js', 'E, Enter or Space page through a talk and end it without restarting it or jumping; mashing or tapping through the smith buys nothing; arrow keys walk'],
  ['pad', 'shot', 22000, 'tests/pad.js', 'a gamepad (faked) starts, walks, talks and pauses; prompts and tips name pad buttons'],
  ['foes', 'shot&play', 46500, 'tests/foes.js', 'brute dazes, thrower burns, darter poisons, shaman hastes'],
  ['freeze', 'shot&play', 4200, 'tests/freeze.js', 'no burn damage while reading; no second daze right after one'],
  ['home', 'shot&play', 12000, 'tests/home.js', 'a thrower that loses you walks back to its post'],
  ['horse', 'shot&play', 1200, 'tests/home2.js', 'riding into shallow water puts out flames'],
  ['trial2', 'shot&play', 11000, 'tests/trial2.js', 'the trial brings the new foes; the courtyard holds eight'],
  ['soak', 'shot&play', 40000, 'tests/soak.js', '40 s under firepot fire: the light count stays flat'],
  ['rigs', 'shot&play&at=95,24', 6000, 'tests/rigs.js', 'characters are built, the knight shows through walls, a broken shield vanishes, removed foes free their textures'],
  ['boss', 'shot&play&god&at=30,18.5', 14000, 'tests/boss.js', 'the Goblin King fight runs'],
  ['phone', 'shot', 9000, 'tests/mobileflow.js', 'phone: tap through the story, stick, attack', { MOBILE: '1' }, '844x390'],
  ['migrate', 'shot&play', 2500, 'tests/migrate1.js', 'a version-1 save (realm 1 only) loads into the several-realm save with nothing lost', { AFTER: 'tests/migrate2.js', AFTER_WAIT: '1500' }],
  ['menutravel', 'shot&play', 5000, 'tests/menutravel1.js', 'the pause menu travels to the other realm and back (unfinished), coming out at the last moonfire', { AFTER: 'tests/menutravel2.js,tests/menutravel3.js', AFTER_WAIT: '3500' }],
  ['border', 'shot&play', 9000, 'tests/border1.js', 'the thorn road: the hedge holds against a sword, a warhorse charge breaks it (King alive), the road leads to Whisperwood and back', { AFTER: 'tests/border2.js,tests/border3.js', AFTER_WAIT: '3500' }],
  ['wood', 'shot&play&realm=forest', 13000, 'tests/wood.js', "Whisperwood: rope bridges hold the knight across, the chasm's edge costs a heart and puts him back, the brook's far bank can't be climbed"],
  ['foes2', 'shot&play&realm=forest', 26000, 'tests/foes2.js', "Whisperwood's foes and hazards: a spitter's seed, a snarer's bola, a thornback's prick (not once stunned), the ravine's thorns, a snare trap bites and a blow springs one"],
  ['ambush', 'shot&play&realm=forest&god', 6000, 'tests/ambush.js', "the Old Grove's ambush: three goblins hidden in bushes by the road (unseen, can't be struck, don't block the way); one bursts out when the knight passes close and fights; the others wait; explore mode stirs none"],
  ['stagbed', 'shot&play&realm=forest', 12000, 'tests/stagbed.js', "the stag's bed: living thorns choke the cleft through the western wall; a sword only scratches them, the Thornstag's thorn burst tears them away (saved); the dell's chest and lore lie beyond"],
  ['wares', 'shot&play&realm=forest', 16000, 'tests/wares.js', "Whisperwood's wares: the weaver's silk-wrapped boots (two levels, +8% each), the herbwife's nettle tonic (the blue bar fills 40% faster); paid for, at once, saved; the tempers +25% a level"],
  ['wares1', 'shot&play', 14000, 'tests/wares1.js', "the Keep's smith sells barding beside his sharpening: each piece one more hit for the warhorse, two pieces and no more"],
  ['stag', 'shot&play&realm=forest', 13000, 'tests/stag.js', 'the Thornstag: three blows free it (quest, saved); on its back the gore, the thorn shield against an arrow, the thorn burst all round, a second leap'],
  ['vines', 'shot&play&realm=forest', 5000, 'tests/vines.js', 'holding jump against vines climbs onto the ledge; a bare cliff stays unclimbable'],
  ['reach2', 'shot&play&realm=forest', 1500, 'tests/reach.js', 'Whisperwood: everything reachable, no way out of the world, nowhere to be stranded (traps: 0)'],
  ['reachstag', 'shot&play', 1500, 'tests/reachstag.js', 'the Moonlit Keep on the Thornstag (2.75 m climb): no way out of the world, nothing the story keeps shut (but the known thorn-road hop)'],
  ['reachstag2', 'shot&play&realm=forest', 1500, 'tests/reachstag.js', "Whisperwood on the Thornstag (2.75 m climb): no way out of the world, no way round the Thorn Heart"],
  ['spawns2', 'shot&play&realm=forest', 300, 'tests/spawns.js', 'Whisperwood: nothing starts inside anything'],
  ['folk', 'shot&play&realm=forest', 30000, 'tests/folk.js', "Whisperwood's folk: prompts name them; the Reeve moves the main quest on; the owl gives one hint a talk, in turn; the thorn-smith sharpens, then tempers to level 5 (+25% a level) and no further; the innkeeper sells flasks"],
  ['sister', 'shot&play&realm=forest', 16000, 'tests/sister1.js', "the sister past the river: Ash asks, three blows break the cage, Wren's purse, she runs home, Ash's savings; after a reload it all stays done", { AFTER: 'tests/sister2.js', AFTER_WAIT: '1500' }],
  ['oaks', 'shot&play&realm=forest&god', 9000, 'tests/oaks.js', "the Ring of Oaks: three waves with the Old Wood's foes, the Heartwood Seed (+1 heart, filled at once) and 100 coins"],
  ['secrets2', 'shot&play&realm=forest', 12000, 'tests/secrets2.js', "Whisperwood's secrets: the niche's cracked rock seals it until a combo breaks it, its chest; the vine ledge's chest; three shards give a heart"],
  ['treasures2', 'shot&play&realm=forest', 23000, 'tests/treasures2.js', "Whisperwood's hidden places reached as a player would: a running jump onto the Rook Pillar, the Drowned Shrine's stones, the stand's ladder, the rope walk, the Fallen Giant, the Bat Roost; every new chest pays"],
  ['corners2', 'shot&play&realm=forest', 8000, 'tests/corners2.js', "Whisperwood's once-empty corners: the Warden's Seat, the Rookery, the brook camp and the kingfisher's bank each pay (their chests, lore stones, keepers); Hollowbough's walkers walk their rounds, its sitters stay sat"],
  ['hold', 'shot&play&realm=forest', 33000, 'tests/hold1.js', "the Warden's Hold: living thorns across the top of the stair stop him; tearing out the Thorn Heart in them withers them; the garrison falls and the thorns at the Great Tree's roots draw back; inside, the Warden wakes and they grow shut behind; after a reload it stays done", { AFTER: 'tests/hold2.js', AFTER_WAIT: '1500' }],
  ['warden', 'shot&play&realm=forest', 44000, 'tests/warden.js', 'the Thorn Warden: keeps away and shoots (volleys, arrow rain on marked spots, goblins called in), enraged at half health (roots burst underfoot), felled: the wood is free'],
  ['wardenfair', 'shot&play&realm=forest', 78000, 'tests/wardenfair.js', "the Thorn Warden's fight is fair: room to run in its hollow, roots low on the camera's side but a barrier all round; marked spots fill for 1.2 s or more, the volley's lines fixed well before it looses, one attack at a time; a knight who only steps out of the way, a quarter second after each warning, is hardly hit, one who stands still is"],
  ['normals', 'shot&play', 300, 'tests/normals.js', "the Moonlit Keep: no face without a normal, no corner that isn't a number (they blacken the screen)"],
  ['normals2', 'shot&play&realm=forest', 300, 'tests/normals.js', "Whisperwood: no face without a normal, no corner that isn't a number (they blacken the screen)"],
  ['arenastag', 'shot&play&realm=forest', 1500, 'tests/arenastag.js', "the Warden's hollow holds until its garrison falls: with the Thorn Heart torn out and the thorns across its mouth, neither the knight nor the Thornstag's second leap gets over its roots"],
  ['economy2', 'shot&play&realm=forest', 300, 'tests/economy2.js', "the Old Wood's economy: its chests pay 900 to 1200 coins (enough for the thorn-smith's two tempers and a little more, not twice over); its foes 1.6 times as tough as their kind, the Warden tuned alone"],
  ['economy1', 'shot&play', 300, 'tests/economy1.js', "Blackpine's foes are as tough as their kind"],
  ['bossbot', 'shot&play&realm=forest&lvl=3', 125000, 'tests/bossbot.js', "the Thorn Warden's fight is balanced: a player-like bot (dodges what it can see coming, a quarter second late; keeps back from a blow winding up; otherwise closes in and swings) wins with a level-3 sword in 45 to 110 s, losing at most 10 hearts"],
  ['worldmap', 'shot&play', 1500, 'tests/worldmap1.js', "the pause menu's world map: the freed Keep and its stats, Whisperwood marked, the next realm a rumour, the rest unknown; clicking the Keep travels there", { AFTER: 'tests/worldmap2.js,tests/worldmap3.js', AFTER_WAIT: '3500' }],
  ['fly', 'shot&play&realm=forest', 15000, 'tests/fly.js', "explore mode: switched on in the pause menu, flies over the gorge unhurt, foes ignore him (and one already after him can't hurt him), nothing is opened while flying, another setting switched leaves him be, wheel zooms out, a click jumps, no quest moved by flying past, switched off he lands on open ground"],
  ['lights', 'shot&play&realm=forest', 9000, 'tests/lights.js', "lamps fade in and out as the camera moves across Hollowbough, never pop (the biggest jump in a frame stays small)"],
  ['travel', 'shot&play', 3500, 'tests/travel1.js', 'crossing to Whisperwood and back: travel card, both realms keep their progress, the knight keeps his coins', { AFTER: 'tests/travel2.js,tests/travel3.js', AFTER_WAIT: '3500' }],
];

const only = process.argv.slice(2);
for (const [name, query, wait, script, what, env, size] of TESTS) {
  if (only.length && !only.includes(name)) continue;
  process.stdout.write(`${name.padEnd(9)} ${what}\n`);
  try {
    const out = execFileSync('node', ['tools/shot.mjs', query, `shots/test-${name}.png`, String(wait), size ?? '1280x720', script], {
      env: { ...process.env, ...(env ?? {}) },
      encoding: 'utf8',
    });
    const lines = out.split('\n').filter((l) => /\[(report|pageerror|script error)\]/.test(l));
    for (const l of lines) process.stdout.write(`          ${l}\n`);
  } catch (e) {
    process.stdout.write(`          FAILED: ${String(e.message).split('\n')[0]}\n`);
  }
}
