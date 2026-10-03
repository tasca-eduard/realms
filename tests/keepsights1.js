// The Moonlit Keep's set pieces (group 89; tests/keepsights2.js runs after the reload): the mill wheel turns and
// throws foam; the beacon burns moon-blue at night and gold at dawn; the Seven Stones' runes wake one after another;
// the night fisher's boat drifts; the raided farm smoulders while its raiders live, and once they are beaten and the
// knight has gone on, it is mended (scaffolding, lanterns, the Harrows back) and stays so after a reload.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const at = async (x, z, ms = 500) => {
  p.place(x, z, g);
  g.cam.focus.set(p.x, p.y, p.z);
  await wait(ms);
};
const brightest = (s) => s.runes.reduce((b, m, i, a) => (m.color.r > a[b].color.r ? i : b), 0);
(async () => {
  localStorage.removeItem('realms-save');
  g.godMode = true;
  const s = g.story.sights;
  // The wheel, from the lane by the mill.
  await at(69, 92);
  const w0 = s.wheel.rotation.x;
  await wait(800);
  out.wheel = { turned: +Math.abs(s.wheel.rotation.x - w0).toFixed(2), foam: s.foam.filter((e) => e.on).length, region: g.region?.name ?? null };
  // The runes: the brightest stone moves on round the ring.
  await at(108, 92);
  const r0 = brightest(s);
  await wait(1200);
  const r1 = brightest(s);
  out.runes = { first: r0, then: r1, wokeInTurn: r0 !== r1, dim: +Math.min(...s.runes.map((m) => m.color.r)).toFixed(2), lit: +Math.max(...s.runes.map((m) => m.color.r)).toFixed(2) };
  // The boat drifts.
  const b0 = { x: s.boat.position.x, z: s.boat.position.z };
  await wait(1000);
  out.boat = { moved: +Math.hypot(s.boat.position.x - b0.x, s.boat.position.z - b0.z).toFixed(2) };
  // The beacon at night: blue over red.
  await at(53, 24.5);
  const c = s.flame.color;
  out.beaconNight = { r: +c.r.toFixed(2), b: +c.b.toFixed(2), blue: c.b > c.r * 2 };
  // The farm while the raiders hold it: smouldering, the Harrows away.
  await at(100, 112);
  out.raided = { smoulder: s.smoulder.group.visible, burning: s.smoulder.emitters.filter((e) => e.on).length, mended: s.mended.visible, wat: g.npc('wat').visible, edda: g.npc('edda').visible };
  // The raiders beaten: nothing changes in front of the knight...
  for (const e of g.enemies) if (e.alive && e.group === 'farm') e.die(g);
  await wait(1500);
  out.beaten = { quest: g.save.data.quests.farm ?? null, mendedInView: s.mended.visible };
  // ...but once he has gone on, the farm is mended.
  await at(80, 80, 800);
  out.mended = { smoulder: s.smoulder.group.visible, burning: s.smoulder.emitters.filter((e) => e.on).length, mended: s.mended.visible, wat: g.npc('wat').visible, edda: g.npc('edda').visible };
  // The beacon at dawn: gold.
  g.setDawn(1);
  await wait(300);
  out.beaconDawn = { r: +c.r.toFixed(2), b: +c.b.toFixed(2), gold: c.r > c.b * 2 };
  g.setDawn(0);
  g.writeSave();
  sessionStorage.setItem('test-sights', JSON.stringify(out));
  location.reload();
})();
window.__report = () => out;
