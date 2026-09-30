// Vines (run with &realm=forest): holding jump against a vined face climbs it and steps off onto
// the ledge; the same hold against a bare cliff of the same height doesn't.
const g = window.__game, p = g.player;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const hold = async (code, ms) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
  await wait(ms);
  window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
};
const out = {};
(async () => {
  g.godMode = true;
  for (const e of g.enemies) if (e.alive) e.despawn(g);
  const v = g.realm.vines[0];
  // At the foot of the vines, facing them.
  p.place(v.x, v.z + 0.45, g);
  p.fx = 0;
  p.fz = -1;
  await wait(400);
  const y0 = p.y;
  await hold('Space', 1600);
  await wait(400);
  out.vines = { from: +y0.toFixed(2), to: +p.y.toFixed(2), onLedge: Math.abs(p.y - v.top) < 0.05 && p.z < v.z };
  // A bare face: the ravine's northern cliff, a little way along (found by walking north to it).
  let fz = 14;
  while (g.grid.groundAt(56, fz - 0.5) < 4 && fz > 5) fz -= 0.25;
  p.place(56, fz + 0.45, g);
  p.fx = 0;
  p.fz = -1;
  await wait(400);
  const y1 = p.y;
  await hold('Space', 1600);
  await wait(600);
  out.bare = { from: +y1.toFixed(2), to: +p.y.toFixed(2), stayedDown: p.y < y1 + 0.2 };
})();
window.__report = () => out;
