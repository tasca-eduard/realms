// Runs every scripted check in tests/ against the running dev server and prints
// each one's report. Usage: npm run dev (in another terminal), then npm test.
import { execFileSync } from 'node:child_process';

const TESTS = [
  ['reach', 'shot&play', 1500, 'tests/reach.js', 'everything reachable, no way out of the world'],
  ['controls', 'shot&play&at=80,63', 2800, 'tests/controls.js', 'guard tap rolls, hold blocks, Space jumps'],
  ['moves', 'shot&play&at=80,63', 6200, 'tests/moves.js', 'charge, spin, down-stab, the three specials'],
  ['fight', 'shot&play&at=86,40', 9000, 'tests/fight.js', 'an auto-fight near the woods'],
  ['death', 'shot&play&at=95,24', 9000, 'tests/death.js', 'fall, then rise at the moonfire'],
  ['ride', 'shot&play&dawn&lines=200', 3800, 'tests/ride.js', 'mount, gallop, dismount, remount'],
  ['hollow', 'shot&play&god', 4800, 'tests/hollow.js', 'cracked wall: light hit chips, combo breaks'],
  ['trial', 'shot&play&god', 9000, 'tests/trial.js', 'Seven Stones: three waves and the relic'],
  ['farm', 'shot&play&god&at=93,97', 4600, 'tests/farm.js', "the Warden's quest start to finish"],
  ['review', 'shot&play', 5600, 'tests/review.js', 'saved kills, no loot from a reset trial, chandeliers re-hang'],
  ['boss', 'shot&play&god&at=30,18.5', 14000, 'tests/boss.js', 'the Goblin King fight runs'],
  ['phone', 'shot', 9000, 'tests/mobileflow.js', 'phone: tap through the story, stick, attack', { MOBILE: '1' }, '844x390'],
];

for (const [name, query, wait, script, what, env, size] of TESTS) {
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
