// Runs every scripted check in tests/ against the running dev server and prints
// each one's report. Usage: npm run dev (in another terminal), then npm test.
// Name some checks to run only those: npm test -- bats economy
import { execFileSync } from 'node:child_process';

const TESTS = [
  ['reach', 'shot&play', 1500, 'tests/reach.js', 'everything reachable, no way out of the world'],
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
  ['talk', 'shot&play', 26000, 'tests/talk.js', 'E, Enter or Space page through a talk and end it without restarting it or jumping; mashing or tapping through the smith buys nothing; arrow keys walk'],
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
