// The diving suit and air (run with &realm=aqua on a fresh save): without the suit deep water stops the knight
// at its edge; the sandbar takes him out to the lighthouse isle, where Brassbelly the salvager fights under a
// health bar (a ring on the ground before his suit blows off steam) and drops the suit when he falls; walked
// onto, it's his (saved): now he walks into deep water, a brass helm on below the surface. There his air runs
// down a second a second; above the surface or in a vent's stream of bubbles it fills again; run out, he's
// breathless (slower, stamina stops filling, the view narrows) and never loses a heart to it.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const held = new Set();
const down = (code) => { held.add(code); window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true })); };
const up = (code) => { held.delete(code); window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })); };
// Walk toward a point (screen-relative keys: the camera's ground axes).
const walkTo = async (x, z, ms) => {
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    const dx = x - p.x, dz = z - p.z;
    if (Math.hypot(dx, dz) < 0.4) break;
    const R = g.cam.groundRight, U = g.cam.groundUp;
    const mx = dx * R.x + dz * R.z, my = dx * U.x + dz * U.z;
    const want = new Set();
    if (mx > 0.25) want.add('KeyD'); else if (mx < -0.25) want.add('KeyA');
    if (my > 0.25) want.add('KeyW'); else if (my < -0.25) want.add('KeyS');
    for (const k of [...held]) if (!want.has(k)) up(k);
    for (const k of want) if (!held.has(k)) down(k);
    await wait(50);
  }
  for (const k of [...held]) up(k);
};
window.__report = () => out;
(async () => {
  await wait(400);
  const sea = g.realm.sea;
  out.start = { dives: p.dives, costume: !!g.save.data.flags.costume, hud: !document.getElementById('air').classList.contains('off') };
  // 1. No diving yet: from the shallows next to deep water, walking in stops at its edge.
  let edge = null;
  for (let z = 40; z < 70 && !edge; z++) for (let x = 50; x < 90 && !edge; x++)
    if (!g.grid.isDeep(x, z) && g.grid.waterAt(x + 0.5, z + 0.5) > g.grid.groundAt(x + 0.5, z + 0.5) && g.grid.isDeep(x + 1, z) && g.grid.isDeep(x + 2, z)) edge = [x, z];
  p.place(edge[0] + 0.5, edge[1] + 0.5, g);
  await wait(300);
  await walkTo(edge[0] + 3.5, edge[1] + 0.5, 1500);
  out.noDive = { edge, x: +p.x.toFixed(2), stopped: p.x < edge[0] + 1.3, under: p.under };
  // 2. The sandbar reaches the isle (no suit): the reach flood without it.
  const dry = window.__reach(false);
  out.sandbar = { salvagerReached: !dry.unreachable.some((u) => u.what === 'enemy:salvager') };
  // 3. Brassbelly: his health bar while he fights; the vent's ring; felled, the suit.
  const s = g.enemies.find((e) => e.type === 'salvager');
  out.salvager = { found: !!s, hp: s && +s.maxHp.toFixed(1) };
  for (const e of g.enemies) if (e !== s && e.alive) e.despawn(g);
  g.godMode = true;
  p.place(s.x - 2.5, s.z, g);
  await wait(1500);
  out.salvager.bar = document.getElementById('boss').classList.contains('on');
  out.salvager.barName = document.querySelector('#boss .bname').textContent;
  // Three quick blows set his valves hissing.
  for (let i = 0; i < 3; i++) s.takeHit(0.1, 1, 0, 0, false, g);
  let ring = false, vented = false;
  for (let i = 0; i < 40; i++) {
    await wait(50);
    if (s.state === 'vent') ring = ring || !!s.potRing;
    if (s.state === 'vent' && s.struck) vented = true;
  }
  out.salvager.vent = { ring, vented };
  s.takeHit(s.hp + 1, 1, 0, 0, true, g);
  await wait(800);
  out.salvager.barAfter = document.getElementById('boss').classList.contains('on');
  // 4. The suit: walk onto it.
  await walkTo(s.x, s.z, 3000);
  await wait(300);
  out.suit = { dives: p.dives, saved: !!JSON.parse(localStorage.getItem('realms-save')).realms.aqua.flags.costume, quest: g.save.data.quests.main };
  g.godMode = false;
  // 5. Air: down on the sea floor it drains a second a second; above the water it fills; in a vent's stream too.
  const deep = [86, 88];
  p.place(deep[0], deep[1], g);
  await wait(300);
  const a0 = p.air;
  await wait(3000);
  out.air = { under: p.under, max: p.airMax, drained: +(a0 - p.air).toFixed(1), hud: !document.getElementById('air').classList.contains('off'), helm: p.model.rig.j('dome').scale.x > 0.5 };
  p.air = 20;
  const v = sea.pockets[0];
  p.place(v.x, v.z, g);
  await wait(1500);
  out.air.pocket = { at: [v.x, v.z], under: p.under, air: +p.air.toFixed(1) };
  // 6. Breathless: slower, no stamina back, the view narrows; no hearts lost in 12 s of it.
  p.place(deep[0], deep[1], g);
  await wait(300);
  p.air = 0.01;
  await wait(200);
  p.stamina = 30;
  const hp0 = p.hp;
  await wait(1500);
  out.breathless = { on: p.breathless, stamina: +p.stamina.toFixed(1), narrow: +g.pipe.narrow.toFixed(2) };
  // His speed after half a second of running (walls may stop him, so it's his pace, not the distance).
  down('KeyD');
  await wait(500);
  out.breathless.ran = +Math.hypot(p.vx, p.vz).toFixed(2);
  up('KeyD');
  await wait(10000);
  out.breathless.hp = [hp0, p.hp];
  // ... and on the strand it all comes back.
  p.place(20, 20, g);
  await wait(2500);
  out.surfaced = { air: +p.air.toFixed(1), breathless: p.breathless, hud: !document.getElementById('air').classList.contains('off') };
  out.ok = !out.start.dives && !out.start.costume && !out.start.hud && out.noDive.stopped && out.sandbar.salvagerReached && out.salvager.found && out.salvager.bar
    && out.salvager.vent.ring && out.salvager.vent.vented && !out.salvager.barAfter && out.suit.dives && out.suit.saved && out.suit.quest >= 1
    && out.air.under && out.air.drained > 2.5 && out.air.drained < 3.5 && out.air.hud && out.air.helm && out.air.pocket.air > 50
    && out.breathless.on && out.breathless.stamina <= 30 && out.breathless.narrow > 0.3 && out.breathless.ran > 2.4 && out.breathless.ran < 3.4 && out.breathless.hp[1] === out.breathless.hp[0]
    && out.surfaced.air === out.air.max && !out.surfaced.breathless && !out.surfaced.hud;
})();
