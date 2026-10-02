// The Sunken Reef's rides (run with &realm=aqua): a diver in the salvager's suit is carried over the trench by
// its currents, both ways (the kingdom's terrace to the palace's floor and back); a column of bubbles lifts him
// out of the trench; in the wreck, the column in the hold takes him up onto the bow deck by its chest; a column
// beside the middle tower of the drowned kingdom lifts him onto its top (a chest, no path).
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
const walkTo = async (x, z, ms) => {
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    const dx = x - p.x, dz = z - p.z, l = Math.hypot(dx, dz);
    if (l < 1.1) break;
    const R = g.cam.groundRight, U = g.cam.groundUp, sx = (dx * R.x + dz * R.z) / l, sy = (dx * U.x + dz * U.z) / l;
    const want = [];
    if (sx > 0.38) want.push('KeyD');
    if (sx < -0.38) want.push('KeyA');
    if (sy > 0.38) want.push('KeyW');
    if (sy < -0.38) want.push('KeyS');
    for (const k of keys) window.dispatchEvent(new KeyboardEvent(want.includes(k) ? 'keydown' : 'keyup', { code: k, bubbles: true }));
    await wait(60);
  }
  for (const k of keys) window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
  await wait(400);
};
const along = (c, t) => [c.pts[0][0] + (c.pts[1][0] - c.pts[0][0]) * t, c.pts[0][1] + (c.pts[1][1] - c.pts[0][1]) * t];
window.__report = () => out;
(async () => {
  g.godMode = true;
  g.save.data.flags.costume = true;
  p.dives = true;
  for (const e of g.enemies) if (e.alive) e.despawn(g);
  const sea = g.realm.sea;
  // Over the trench and back.
  for (const [name, c] of [['over', sea.currents[0]], ['back', sea.currents[1]]]) {
    p.place(...along(c, 0.05), g);
    await wait(3800);
    const e = c.pts[c.pts.length - 1];
    out[name] = { distToEnd: +Math.hypot(p.x - e[0], p.z - e[1]).toFixed(1), y: +p.y.toFixed(1), region: g.region?.name };
  }
  // Out of the trench.
  const l = sea.lifts[0];
  p.place(l.x, l.z, g);
  await wait(200);
  const y0 = p.y;
  await wait(3800);
  out.trench = { from: +y0.toFixed(1), y: +p.y.toFixed(1), top: +l.top.toFixed(1) };
  // The wreck, and the tower.
  for (const [name, id] of [['wreck', 'r3_bow'], ['tower', 'r3_tower']]) {
    const chest = g.interactables.find((i) => i.id === id);
    const lift = sea.lifts.slice().sort((a, b) => Math.hypot(a.x - chest.x, a.z - chest.z) - Math.hypot(b.x - chest.x, b.z - chest.z))[0];
    p.place(lift.x, lift.z, g);
    await wait(3200);
    await walkTo(chest.x, chest.z, 2500);
    out[name] = { y: +p.y.toFixed(2), chestY: +chest.y.toFixed(2), near: +Math.hypot(chest.x - p.x, chest.z - p.z).toFixed(1) };
  }
  out.ok = out.over.distToEnd < 3 && out.over.region === 'The Drowned Palace' && out.back.distToEnd < 3 && out.back.region === 'The Drowned Kingdom'
    && out.trench.y > out.trench.top - 0.6 && ['wreck', 'tower'].every((k) => out[k].near < 1.4 && Math.abs(out[k].y - out[k].chestY) < 0.2);
})();
