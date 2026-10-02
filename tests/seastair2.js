// The Sea Stair, part 2 (the Sunken Reef): came out at the top of the stair in the north-west corner, on foot
// (no beasts here), looking down the steps; the pause menu's map has the Reef here and Whisperwood visited.
// Walks down toward the strand, then back up into the cleft at the stair's head, over to Whisperwood again.
const g = window.__game, p = g.player;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const held = new Set();
const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
const hold = (...codes) => {
  for (const c of [...held]) if (!codes.includes(c)) key('keyup', c), held.delete(c);
  for (const c of codes) if (!held.has(c)) key('keydown', c), held.add(c);
};
const until = async (fn, ms) => {
  const t0 = performance.now();
  while (!fn() && performance.now() - t0 < ms) await wait(16);
  return fn();
};
const r2 = (v) => +v.toFixed(2);
const log = JSON.parse(sessionStorage.getItem('test-log') || '{}');
const b = g.realm.borders?.find((x) => x.id === 'seastair');
const out = (log.reef = {
  realm: g.def.id,
  at: [r2(p.x), r2(p.z)],
  atTopOfStair: !!b && Math.hypot(p.x - b.out.x, p.z - b.out.z) < 0.6,
  riding: p.riding?.kind ?? null,
  beasts: g.mounts.length,
});
g.setPaused(true);
const nodes = Object.fromEntries([...document.querySelectorAll('#pause .wnode')].map((n) => [n.dataset.realm, n.className.replace('wnode ', '').trim()]));
g.setPaused(false);
out.map = { aqua: nodes.aqua, forest: nodes.forest, forestClickable: document.querySelector('#pause .wnode[data-realm="forest"]')?.dataset.go === '1' };
sessionStorage.setItem('test-log', JSON.stringify(log));
(async () => {
  g.godMode = true;
  await wait(900);
  // Down the steps (east, S+D), then back up (west, W+A) into the cleft.
  const y0 = p.y;
  hold('KeyS', 'KeyD');
  await wait(1000);
  hold();
  out.walkedDown = { x: r2(p.x), dropped: r2(y0 - p.y) };
  await wait(200);
  hold('KeyW', 'KeyA');
  await until(() => g.leaving, 4000);
  hold();
  out.leaving = g.leaving;
  out.card = JSON.parse(sessionStorage.getItem('realms-travel') || 'null');
  sessionStorage.setItem('test-log', JSON.stringify(log));
})();
window.__report = () => log;
