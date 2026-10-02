// Places only the Tide Serpent reaches (run with &realm=aqua&god). Under the water, a reef terrace 3 m above
// the floor round it (raised here in the grid for the check): the knight in his diving suit can't climb it on foot,
// but on the serpent, stroking up as it swims at it, it rises over the edge, settles on top, and he gets off there.
// Out of the water: the Dune Strait's low reef (0.35 m above the sea, out in deep water) and a ledge a metre up
// (raised here): from the serpent's back he steps off onto each, and gets back on; with no ground near and no
// suit he stays on. At the east edge, the Dune Strait (the way on to realm 4): its name says it's shut, and the
// serpent goes no further than the map's edge.
const g = window.__game, p = g.player, grid = g.grid, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const key = async (code, ms = 60) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
  await wait(ms);
  window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
};
const hold = (codes, on) => codes.forEach((code) => window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code, bubbles: true })));
// World +x on screen is right and down: D and S together.
const EAST = ['KeyD', 'KeyS'];
const r2 = (v) => +v.toFixed(2);
const raise = (x0, z0, x1, z1, h) => {
  for (let z = z0; z <= z1; z++)
    for (let x = x0; x <= x1; x++) {
      const i = grid.i(x, z);
      grid.h[i] = h;
      if (h >= 0) grid.water[i] = -999;
    }
};
window.__report = () => out;
(async () => {
  for (const e of g.enemies) if (e.alive) e.despawn(g);
  const pen = g.story.serpent;
  pen.struck(g, () => true);
  const s = pen.serpent;
  // On its back at (x, z), floating at the surface. (Got on in the suit, where he stands on the sea floor.)
  const rideTo = async (x, z) => {
    if (!p.riding) {
      p.dives = true;
      s.arriveAt(x, z, g);
      p.place(s.x, s.z, g);
      await wait(250);
      p.mount(s, g);
    }
    p.x = x;
    p.z = z;
    p.y = g.realm.sea.surface - 0.45;
    p.vx = p.vz = p.vy = 0;
    s.move = 'surface';
    await wait(300);
  };

  // ---- Under the water: a terrace 3 m up from a 5 m deep floor, 2 m under the surface.
  g.save.data.flags.costume = true;
  p.dives = true;
  let spot = null;
  const flat = (x, z, f) => [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].every((d) => [-2, 0, 2].every((e) => Math.abs(grid.groundAt(x + d + 0.5, z + e + 0.5) - f) < 0.1 && grid.isDeep(x + d, z + e)));
  for (let z = 50; z < 106 && !spot; z++)
    for (let x = 40; x < 126 && !spot; x++) {
      const f = grid.groundAt(x + 0.5, z + 0.5);
      if (f > -8.5 && f < -4.6 && flat(x, z, f)) spot = [x, z, f];
    }
  const [sx, sz, floor] = spot, top = floor + 3;
  raise(sx + 3, sz - 2, sx + 10, sz + 2, top);
  out.terrace = { at: [sx + 3, sz], floor: r2(floor), top: r2(top) };
  // On foot in the suit: walking and jumping at it gets him nowhere.
  p.place(sx + 0.5, sz + 0.5, g);
  await wait(400);
  let footTop = -99;
  hold(EAST, true);
  for (let i = 0; i < 6; i++) {
    await key('Space');
    await wait(350);
    footTop = Math.max(footTop, p.y);
  }
  hold(EAST, false);
  out.terrace.onFoot = { x: r2(p.x), highest: r2(footTop - floor), onTop: p.x > sx + 3 && p.y > top - 0.3 };
  // On the serpent: down to the floor (a leap and a plunge, then it sinks), then at the terrace, stroking up
  // whenever it stops rising, until it's over the edge; then it settles on top.
  await rideTo(sx + 0.5, sz + 0.5);
  await key('Space');
  for (let i = 0; i < 60 && p.y > floor + 0.05; i++) await wait(100);
  out.terrace.serpentFrom = r2(p.y - floor);
  hold(EAST, true);
  for (let i = 0; i < 80 && p.x < sx + 3.3; i++) {
    if (p.vy < 0.5 && p.y < top + 0.3) await key('Space', 40);
    await wait(60);
  }
  hold(EAST, false);
  await wait(3000);
  out.terrace.serpent = { x: r2(p.x - sx), y: r2(p.y), over: p.x > sx + 3 && p.x < sx + 11, resting: Math.abs(p.y - top) < 0.06 };
  await key('KeyE');
  await wait(1200);
  out.terrace.off = { riding: !!p.riding, y: r2(p.y), standing: Math.abs(p.y - top) < 0.06 && p.x > sx + 3 && p.x < sx + 11 };

  // ---- Out of the water, no suit: the strait's reef (0.35 m up, out in deep water), from the serpent's back.
  let reef = null;
  for (let z = 32; z < 37 && !reef; z++)
    for (let x = 132; x < 139 && !reef; x++) if (!grid.isDeep(x, z) && grid.waterAt(x + 0.5, z + 0.5) < -100 && grid.isDeep(x, z + 1) && grid.isDeep(x, z + 2)) reef = [x, z];
  await rideTo(reef[0] + 0.5, reef[1] + 2.2);
  g.save.data.flags.costume = false;
  p.dives = false;
  out.reef = { at: reef, h: r2(grid.groundAt(reef[0] + 0.5, reef[1] + 0.5)), from: [r2(p.x), r2(p.z)], landing: s.landing(p, g, false) };
  await key('KeyE');
  await wait(600);
  out.reef.off = { riding: !!p.riding, y: r2(p.y), onReef: !grid.isDeep(Math.floor(p.x), Math.floor(p.z)) && p.y > 0.2 };
  await wait(400);
  out.reef.prompt = s.prompt(g);
  // (Facing it: the E press finds the nearest thing to get on.)
  await key('KeyE');
  await wait(500);
  out.reef.back = p.riding === s;

  // A ledge a metre up, beside deep water in the serpent's pool (raised here): off onto it, and back on.
  raise(82, 38, 83, 38, 1.0);
  await rideTo(82.5, 40.2);
  await key('KeyE');
  await wait(600);
  out.ledge = { riding: !!p.riding, y: r2(p.y), on: Math.abs(p.y - 1.0) < 0.06 };
  await wait(400);
  await key('KeyE');
  await wait(500);
  out.ledge.back = p.riding === s;
  // Open water, no suit, nothing near: he stays on.
  await rideTo(116, 60);
  await key('KeyE');
  await wait(500);
  out.openWater = { stillRiding: p.riding === s };

  // ---- The Dune Strait: east to the map's edge.
  await rideTo(129.5, 40);
  hold(EAST, true);
  let far = 0;
  for (let i = 0; i < 30; i++) {
    await wait(100);
    far = Math.max(far, p.x);
  }
  hold(EAST, false);
  out.strait = { at: [r2(p.x), r2(p.z)], region: g.region?.name ?? null, sub: g.ui.areaEl.querySelector('.sub').textContent, farthest: r2(far), edge: g.realm.w };

  out.ok = !out.terrace.onFoot.onTop && out.terrace.onFoot.highest < 2 && out.terrace.serpentFrom < 0.1 && out.terrace.serpent.over && out.terrace.serpent.resting && !out.terrace.off.riding && out.terrace.off.standing
    && !out.reef.off.riding && out.reef.off.onReef && !!out.reef.prompt && out.reef.back && !out.ledge.riding && out.ledge.on && out.ledge.back && out.openWater.stillRiding
    && out.strait.region === 'The Dune Strait' && /shut/.test(out.strait.sub) && out.strait.farthest <= out.strait.edge - 0.5 && out.strait.farthest > out.strait.edge - 1.5;
})();
