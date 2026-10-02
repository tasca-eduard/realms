// The Sea Stair, part 3 (Whisperwood again): came out on the stair below the rockfall, the Thornstag waiting
// on the landing under it and the warhorse up at the head (it couldn't come down). On foot the knight can't get
// back up onto the blocks (jumps and air dashes at the second); on the stag he leaps up onto it, over the gap
// and down onto the heights.
const g = window.__game, p = g.player;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const held = new Set();
const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
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
const log = JSON.parse(sessionStorage.getItem('test-log') || '{}');
const b = g.realm.borders.find((x) => x.id === 'seastair');
const stag = g.mounts.find((m) => m.kind === 'stag');
const out = (log.back = {
  realm: g.def.id,
  at: [r2(p.x), r2(p.z)],
  belowRockfall: Math.hypot(p.x - b.out.x, p.z - b.out.z) < 0.6,
  stagWaiting: !!stag && Math.hypot(stag.home.x - b.leap.stag.x, stag.home.z - b.leap.stag.z) < 0.5,
  horseAtHead: !!g.horse && Math.hypot(g.horse.home.x - b.leap.horse.x, g.horse.home.z - b.leap.horse.z) < 0.5,
});
(async () => {
  g.godMode = true;
  for (const e of g.enemies) if (e.alive && Math.hypot(e.x - 4, e.z - 34) < 26) e.despawn(g);
  await wait(900);
  // On foot, from the landing under the second block (the stag led off down the stair): run east (S+D) at it,
  // jump and dash, three times.
  stag.arriveAt(-13.5, 33.5, g);
  p.place(-9.4, 33.5, g);
  await wait(300);
  let top = 0, east = -99;
  const watch = setInterval(() => ((top = Math.max(top, p.y)), (east = Math.max(east, p.x))), 16);
  for (let i = 0; i < 3; i++) {
    hold('KeyS', 'KeyD');
    await wait(250);
    await tap('Space');
    await wait(220);
    await airDash();
    await wait(650);
  }
  hold();
  clearInterval(watch);
  out.onFoot = { highest: r2(top), furthestEast: r2(east), gotOnTheBlocks: east > -7.8 };
  // On the stag: up onto the second block, over the gap, down onto the heights.
  stag.arriveAt(-9.6, 33.5, g);
  p.place(-10.3, 33.5, g);
  await wait(250);
  [stag.fx, stag.fz] = [1, 0];
  p.mount(stag, g);
  await wait(300);
  out.riding = p.riding?.kind ?? null;
  // (Turned toward it and pressed against its face first.)
  hold('KeyS', 'KeyD');
  await wait(700);
  await tap('Space');
  await wait(250);
  await tap('Space');
  const up = await until(() => p.onGround && p.y > 6.6, 1500);
  out.ontoBlock = { up, x: r2(p.x), y: r2(p.y) };
  await until(() => p.x > -6.6, 1500);
  await tap('Space');
  const over = await until(() => p.onGround && p.x > -2.8, 2000);
  out.overGap = { over, x: r2(p.x), y: r2(p.y) };
  const home = await until(() => p.onGround && p.x > 0.4, 2500);
  hold();
  out.home = { home, x: r2(p.x), y: r2(p.y), onHeights: home && Math.abs(p.y - 5) < 0.3, region: g.region?.name ?? null };
  localStorage.removeItem('realms-save');
  sessionStorage.setItem('test-log', JSON.stringify(log));
})();
window.__report = () => log;
