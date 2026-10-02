// The Sea Stair, part 1 (Whisperwood, played with keys): at the head of the stair the knight on foot can't get
// up onto the rockfall's blocks (he runs at the first, jumps and dashes in the air, three times); the Thornstag,
// freed, leaps up onto it with its second leap, over the gap onto the second block, and carries him down the
// stair to the turn and on down the last flight toward the water, over to the Sunken Reef.
// Parts 2 and 3 (AFTER=tests/seastair2.js,tests/seastair3.js) follow.
const g = window.__game, p = g.player;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const held = new Set();
const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
/** Hold exactly these keys (the rest let go). */
const hold = (...codes) => {
  for (const c of [...held]) if (!codes.includes(c)) key('keyup', c), held.delete(c);
  for (const c of codes) if (!held.has(c)) key('keydown', c), held.add(c);
};
const tap = async (code) => {
  key('keydown', code);
  await wait(60);
  key('keyup', code);
};
const airDash = async () => {
  document.querySelector('#view canvas').dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true }));
  await wait(70);
  window.dispatchEvent(new MouseEvent('mouseup', { button: 2 }));
};
const until = async (fn, ms) => {
  const t0 = performance.now();
  while (!fn() && performance.now() - t0 < ms) await wait(16);
  return fn();
};
const r2 = (v) => +v.toFixed(2);
const log = { wood: {} }, out = log.wood;
(async () => {
  sessionStorage.removeItem('test-log');
  g.godMode = true;
  for (const e of g.enemies) if (e.alive && Math.hypot(e.x - 4, e.z - 34) < 26) e.despawn(g);
  // On foot (keys W+A run west, at the first block): a jump, an air dash at its top, three times.
  p.place(1.3, 33.5, g);
  await wait(300);
  let top = 0, west = 9;
  const watch = setInterval(() => ((top = Math.max(top, p.y)), (west = Math.min(west, p.x))), 16);
  for (let i = 0; i < 3; i++) {
    hold('KeyW', 'KeyA');
    await wait(250);
    await tap('Space');
    await wait(220);
    await airDash();
    await wait(650);
  }
  hold();
  clearInterval(watch);
  out.onFoot = { highest: r2(top), furthestWest: r2(west), gotOnTheBlocks: west < -0.2 };
  // The Thornstag, freed, brought to the head; mounted.
  g.freeBeast(g.bindings[0]);
  const stag = g.mounts.find((m) => m.kind === 'stag');
  stag.arriveAt(1.6, 33.5, g);
  p.place(2.3, 33.5, g);
  await wait(250);
  [stag.fx, stag.fz] = [-1, 0];
  p.mount(stag, g);
  await wait(300);
  out.riding = p.riding?.kind ?? null;
  // Up onto the first block: a leap, and the second leap at its top.
  // (Turned toward it and pressed against its face first.)
  hold('KeyW', 'KeyA');
  await wait(700);
  await tap('Space');
  await wait(250);
  await tap('Space');
  const up = await until(() => p.onGround && p.y > 6.6, 1500);
  out.ontoBlock = { up, x: r2(p.x), y: r2(p.y) };
  // Over the gap: a leap from the first block's far end, onto the second (or past it, onto the landing).
  await until(() => p.x < -1.4, 1500);
  await tap('Space');
  const over = await until(() => p.onGround && p.x < -5.2, 2000);
  out.overGap = { over, x: r2(p.x), y: r2(p.y) };
  // Down the flights to the turn, then south down the last flight toward the water.
  await until(() => p.x < -16.4, 6000);
  out.atTurn = { x: r2(p.x), y: r2(p.y) };
  hold('KeyS', 'KeyA');
  await until(() => g.leaving, 3000);
  hold();
  out.leaving = g.leaving;
  out.card = JSON.parse(sessionStorage.getItem('realms-travel') || 'null');
  out.save = { realm: JSON.parse(localStorage.getItem('realms-save') || '{}').realm ?? null, stag: g.save.data.mounts.includes('stag') };
  sessionStorage.setItem('test-log', JSON.stringify(log));
})();
window.__report = () => log;
