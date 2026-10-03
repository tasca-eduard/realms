// The harmless life of realms 1 and 2 (run with &realm=castle or &realm=forest, &god): each realm's own kinds, four
// instanced meshes (one for each way of moving), every group's creatures in place; then the knight walks up to them in turn (set down beside
// them) and they answer: birds sitting on the walls or the ground go up, swans run along the water and fly (realm
// 1), a herd makes off together, frogs leap off their pads, the heron flies, the white hart bolts; and the air
// near him is full of motes (moths, down, glow-worms, fireflies, midges).
const g = window.__game, p = g.player, w = g.story.wildlife, out = { realm: g.def.id };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const put = (x, z) => {
  p.x = x;
  p.z = z;
  p.y = g.grid.groundAt(x, z);
  p.vx = p.vz = 0;
};
const all = w.all;
const flocks = all.filter((l) => l.birds && !l.def.flit), bats = all.filter((l) => l.birds && l.def.flit);
const swims = all.filter((l) => l.all && l.all[0] && 'air' in l.all[0]);
const herds = all.filter((l) => l.herds);
const frogs = all.filter((l) => l.all && l.all[0] && 'hx' in l.all[0]);
const wader = all.find((l) => l.spots && 'from' in l);
const shy = all.filter((l) => l.def && 'chance' in l.def);
const live = () => {
  let n = 0;
  for (const pool of [g.fx.glow, g.fx.soft]) for (let i = 0; i < pool.n; i++) if (pool.life[i] > 0) n++;
  return n;
};
(async () => {
  out.kinds = w.kinds.length;
  out.bodies = w.kinds.reduce((a, k) => a + k.herd.mesh.count, 0);
  out.groups = { flocks: flocks.length, bats: bats.length, swimmers: swims.length, herds: herds.length, frogs: frogs.reduce((a, f) => a + f.all.length, 0), wader: !!wader, shy: shy.length, all: all.length };
  // A flock's birds sitting: the knight below them, and they go up.
  const f = flocks[0], sat = f.birds.filter((b) => b.state === 'perch');
  if (sat.length) {
    const b = sat[0];
    put(b.x + (g.def.id === 'castle' ? 0 : 1.5), b.z + (g.def.id === 'castle' ? -2.5 : 1.5));
    await wait(1200);
    out.birds = { sat: sat.length, near: sat.filter((s) => Math.hypot(s.x - p.x, s.z - p.z) < 8).length, up: sat.filter((s) => s.state !== 'perch').length };
  }
  // A herd: set down among it, it makes off together.
  const h = herds.find((q) => q.def.way === 'beast') ?? herds[0];
  const a = h.all[0];
  put(a.x + 1.5, a.z + 1.5);
  await wait(400);
  out.herd = { n: h.all.length, fleeing: h.all.filter((q) => q.state === 'flee').length };
  await wait(2500);
  out.herd.far = +Math.min(...h.all.map((q) => Math.hypot(q.x - p.x, q.z - p.z))).toFixed(1);
  // Frogs: beside a pad, the frog leaps in and is gone a while.
  const fr = frogs.find((q) => q.all.some((x) => x.state === 'sit'));
  if (fr) {
    const one = fr.all.find((x) => x.state === 'sit');
    put(one.hx + 1.2, one.hz + 1.2);
    await wait(900);
    out.frog = one.state;
  }
  // Swans (realm 1) or ducks: on the water, the knight at the bank beside them.
  const sw = swims.find((q) => q.def.fly) ?? swims[0];
  const s = sw.all[0];
  put(s.x + 2, s.z + 2);
  await wait(2200);
  out.swim = { kind: sw.def.fly ? 'swan' : 'duck', state: s.state, air: +s.air.toFixed(2) };
  // The heron flies off to another of its spots.
  if (wader) {
    put(wader.x + 2.5, wader.z + 2.5);
    await wait(1500);
    out.heron = { state: wader.state, spots: wader.spots.length };
  }
  // The white hart, out at a spot, the knight coming up: it lifts its head and bolts.
  const hart = shy.find((q) => q.def.scare >= 10);
  if (hart) {
    hart.show(p.x, p.z);
    put(hart.x + 6, hart.z + 6);
    await wait(1600);
    out.hart = hart.state;
  }
  // The air in the countryside: motes in plenty.
  put(...(g.def.id === 'castle' ? [40, 110] : [20, 78]));
  await wait(5000);
  out.live = live();
  out.bats = bats.reduce((n, q) => n + q.birds.length, 0);
  out.done = true;
})();
window.__report = () => out;
