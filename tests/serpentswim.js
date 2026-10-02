// Swimming on the Tide Serpent (run with &realm=aqua&god). Without the diving suit it keeps to the surface: the
// knight rides dry, a tap of jump leaps out of the water and it splashes back up to float (never under, his air
// untouched). In the suit: the leap plunges it under; below the surface it sinks between strokes (about 1.4 m/s)
// down to the sea floor, each tap of jump is a stroke up (each costs stamina), and stroking it comes up to float
// again; under the surface his air runs down as when he dives on foot, and out of air it carries him up by itself.
// A ring on the floor straight below shows how high it swims (wider the higher), with its shadow.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const key = async (code, ms = 60) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
  await wait(ms);
  window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
};
// Follow his height (and anything else) while something happens.
const watch = async (ms, fn) => {
  const s = { top: -99, low: 99, under: false };
  const iv = setInterval(() => {
    s.top = Math.max(s.top, p.y);
    s.low = Math.min(s.low, p.y);
    s.under ||= p.under;
    fn?.(s);
  }, 10);
  await wait(ms);
  clearInterval(iv);
  return s;
};
const r2 = (v) => +v.toFixed(2);
window.__report = () => out;
(async () => {
  for (const e of g.enemies) if (e.alive) e.despawn(g);
  const pen = g.story.serpent;
  pen.struck(g, () => true);
  const s = pen.serpent;
  // Out to deep open water: a spot 5 to 8.5 m deep, the floor level round about.
  let spot = null;
  const level = (x, z, f) => [-2, 0, 2].every((dx) => [-2, 0, 2].every((dz) => Math.abs(g.grid.groundAt(x + dx, z + dz) - f) < 0.2));
  for (let z = 60; z < 106 && !spot; z += 1)
    for (let x = 40; x < 134 && !spot; x += 1) {
      const f = g.grid.groundAt(x + 0.5, z + 0.5);
      if (f > -8.5 && f < -5 && level(x + 0.5, z + 0.5, f)) spot = [x + 0.5, z + 0.5];
    }
  s.arriveAt(spot[0], spot[1], g);
  p.place(s.x, s.z, g);
  await wait(300);
  p.mount(s, g);
  await wait(400);
  const top = g.realm.sea.surface - 0.45, floor = g.grid.groundAt(p.x, p.z);
  out.spot = { x: r2(p.x), z: r2(p.z), floor: r2(floor), float: r2(top), riding: p.riding === s };

  // ---- Without the suit: the surface only.
  p.dives = false;
  g.save.data.flags.costume = false;
  const air0 = p.air;
  const leap = await watch(1600);
  await key('Space');
  const leap2 = await watch(1800);
  out.dry = { atRest: { top: r2(leap.top), low: r2(leap.low), under: leap.under }, leap: { peak: r2(leap2.top - top), lowest: r2(leap2.low - top), under: leap2.under }, back: r2(p.y - top), air: p.air === air0 };

  // ---- In the suit: a leap and a plunge under, sinking, the floor, strokes, up again.
  p.dives = true;
  g.save.data.flags.costume = true;
  await key('Space');
  const plunge = await watch(1500);
  out.dive = { peak: r2(plunge.top - top), depth: r2(top - plunge.low), under: p.under };
  // Sinking between strokes: its speed after a moment with no input.
  let sink = 0;
  await watch(900, () => (sink = Math.min(sink, p.vy)));
  out.dive.sink = r2(-sink);
  // Down to the floor, where it rests.
  for (let i = 0; i < 60 && p.y > floor + 0.05; i++) await wait(100);
  out.dive.floor = { y: r2(p.y), floor: r2(floor), resting: Math.abs(p.y - floor) < 0.06, air: r2(p.air) };
  // The ring under it on the floor, and how it grows with height.
  const ring = s.ring;
  out.ring = { onFloor: ring.visible && Math.abs(ring.position.y - floor) < 0.2, below: Math.hypot(ring.position.x - p.x, ring.position.z - p.z) < 0.05, scaleLow: r2(ring.scale.x) };
  // Strokes: one, then three more in time; each takes stamina.
  await wait(300);
  const st0 = p.stamina, y0 = p.y;
  await key('Space', 30);
  const cost = st0 - p.stamina;
  const one = await watch(900);
  out.strokes = { one: r2(one.top - y0), cost: r2(cost) };
  for (let i = 0; i < 6 && p.y < top - 0.01; i++) {
    await key('Space');
    await wait(550);
  }
  out.ring.scaleHigh = r2(ring.scale.x);
  out.ring.grows = out.ring.scaleHigh > out.ring.scaleLow + 0.4;
  // Air ran down below; at the surface it fills again.
  const airUnder = out.dive.floor.air;
  for (let i = 0; i < 20 && s.move !== 'surface'; i++) {
    await key('Space');
    await wait(400);
  }
  await wait(600);
  out.up = { surfaced: s.move === 'surface', y: r2(p.y - top), under: p.under, airUnder: r2(airUnder), airAfter: r2(p.air), max: p.airMax };
  // Out of air down below: it brings him up by itself.
  await key('Space');
  await wait(1600);
  const deep = p.y;
  p.air = 0;
  const carried = await watch(1500);
  out.breathless = { from: r2(deep - top), rose: r2(carried.top - deep) };
  p.air = p.airMax;

  out.ok = out.spot.riding && Math.abs(out.dry.atRest.top - top) < 0.1 && !out.dry.atRest.under && out.dry.leap.peak > 0.8 && out.dry.leap.lowest > -0.5 && !out.dry.leap.under && Math.abs(out.dry.back) < 0.05 && out.dry.air
    && out.dive.peak > 0.8 && out.dive.depth > 1.2 && out.dive.under && out.dive.sink > 1.2 && out.dive.sink < 1.6 && out.dive.floor.resting
    && out.ring.onFloor && out.ring.below && out.ring.grows && out.strokes.one > 1 && out.strokes.cost > 5
    && out.up.surfaced && !out.up.under && out.up.airUnder < out.up.max && out.up.airAfter > out.up.airUnder && out.breathless.rose > 0.8;
})();
