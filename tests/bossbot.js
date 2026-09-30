// The tyrant's fight is balanced (run with &realm=forest&lvl=3): a player-like bot (real keys, aimed
// clicks) that steps out of marked spots a quarter second after they show, sidesteps a fixed volley,
// keeps back while a blow winds up (rolling away), and otherwise closes in and swings, beats the
// Thorn Warden with the sword a knight brings from Blackpine (level 3) in about a minute (45 to 110 s),
// losing no more than 10 hearts. (&lvl sets the sword's level.)
const g = window.__game, p = g.player, out = {};
const lvl = +(new URLSearchParams(location.search).get('lvl') ?? 3);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const c = document.querySelector('#view canvas');
const keys = new Set();
const press = (want) => {
  for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
    const on = want.includes(k);
    if (on && !keys.has(k)) { window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true })); keys.add(k); }
    if (!on && keys.has(k)) { window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true })); keys.delete(k); }
  }
};
const steer = (dx, dz) => {
  const l = Math.hypot(dx, dz);
  if (l < 1e-3) return press([]);
  const sx = (dx * g.cam.groundRight.x + dz * g.cam.groundRight.z) / l, sy = (dx * g.cam.groundUp.x + dz * g.cam.groundUp.z) / l;
  const k = [];
  if (sx > 0.38) k.push('KeyD');
  if (sx < -0.38) k.push('KeyA');
  if (sy > 0.38) k.push('KeyW');
  if (sy < -0.38) k.push('KeyS');
  press(k);
};
const aimAt = (e) => {
  const s = { x: 0, y: 0 };
  g.cam.toScreen({ x: e.x, y: e.y + 0.9, z: e.z, clone() { return new (g.cam.focus.constructor)(this.x, this.y, this.z); } }, s);
  c.dispatchEvent(new MouseEvent('mousemove', { clientX: s.x, clientY: s.y, bubbles: true }));
  return s;
};
let clickN = 0, rolledAt = -9;
// A roll away from a foe: point away from it, tap guard (a tap is a roll, where you point).
const rollAway = (e, t) => {
  if (t - rolledAt < 0.9 || p.stamina < 30) return false;
  rolledAt = t;
  const dx = p.x - e.x, dz = p.z - e.z, l = Math.hypot(dx, dz) || 1;
  const s = aimAt({ x: p.x + (dx / l) * 3, y: p.y - 0.9, z: p.z + (dz / l) * 3 });
  c.dispatchEvent(new MouseEvent('mousedown', { button: 2, clientX: s.x, clientY: s.y, bubbles: true }));
  setTimeout(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 2 })), 60);
  return true;
};
const swing = (s) => {
  if (clickN++ % 2) return;
  c.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: s.x, clientY: s.y, bubbles: true }));
  setTimeout(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })), 30);
};
(async () => {
  localStorage.removeItem('realms-save');
  p.swordLevel = lvl;
  p.maxHp = p.hp = 99;
  const b = g.boss, a = g.realm.arena, forest = g.realm.id === 'forest';
  for (const e of g.enemies) if (e.alive && e.group !== 'boss') e.despawn(g);
  if (g.hallDoor) g.hallDoor.setOpen(true, g, true);
  // Into the arena.
  p.place(forest ? a.x1 - 1.2 : (a.x0 + a.x1) / 2, forest ? (a.z0 + a.z1) / 2 : a.z1 - 1.5, g);
  g.cam.focus.set(p.x, p.y, p.z);
  await wait(4800);
  out.started = g.bossActive;
  const causes = {};
  for (const [fn, name] of [['wardenMarkLands', (m) => m.kind], ['arrowHitsPlayer', () => 'arrow'], ['enemyHitsPlayer', (e) => (e === b ? 'boss' : e.type)]]) {
    if (!g[fn]) continue;
    const orig = g[fn].bind(g);
    g[fn] = (...args) => { const hp = p.hp, r = orig(...args); if (p.hp < hp) causes[name(args[0])] = (causes[name(args[0])] ?? 0) + 1; return r; };
  }
  const t0 = performance.now(), hp0 = p.hp, seen = new Map();
  let side = null, backOff = 0;
  const hpAt = [];
  while (b.alive && performance.now() - t0 < 200000) {
    const t = performance.now() / 1000;
    if (hpAt.length < Math.floor((performance.now() - t0) / 10000) + 1) hpAt.push(+b.hp.toFixed(1));
    let vx = 0, vz = 0, busy = false;
    // Marked spots (the Warden's rain and roots): to the clearest spot, once seen for 0.25 s.
    for (const m of g.wardenMarks ?? []) if (!m.landed && !seen.has(m)) seen.set(m, t);
    const clear = (x, z) => Math.min(99, ...(g.wardenMarks ?? []).filter((m) => !m.landed && t - seen.get(m) > 0.25).map((m) => Math.hypot(x - m.x, z - m.z)));
    if (clear(p.x, p.z) < 1.5) {
      let best = -1;
      for (let k = 0; k < 16; k++) {
        const th = (k / 16) * Math.PI * 2, ux = Math.cos(th), uz = Math.sin(th);
        if (Math.abs(g.grid.groundAt(p.x + ux * 1.6, p.z + uz * 1.6) - p.y) > 0.4) continue;
        const cl = clear(p.x + ux * 1.8, p.z + uz * 1.8);
        if (cl > best) [best, vx, vz] = [cl, ux, uz];
      }
      busy = true;
    }
    // A fixed volley: sideways until it's passed.
    if (!busy && b.state === 'aim' && b.volleyAim !== undefined && b.t >= 0.75 / (b.enraged ? 1.2 : 1) + 0.25 && !side) {
      const px = -Math.sin(b.volleyAim), pz = Math.cos(b.volleyAim), k = Math.random() < 0.5 ? 1 : -1;
      side = { x: px * k, z: pz * k, until: t + 1 };
    }
    if (side && t > side.until) side = null;
    if (!busy && side) [vx, vz, busy] = [side.x, side.z, true];
    // A blow winding up close by: step back from it.
    const foes = g.enemies.filter((e) => e.alive);
    // (Keep away as long as it's winding up: a person waits for the blow to come and go.)
    for (const e of foes)
      if (e.telegraph > 0 && Math.hypot(e.x - p.x, e.z - p.z) < (e === b ? 3.4 : 2.4) && !busy && e.state !== 'aim' && e.state !== 'windup' && e.state !== 'summon') {
        backOff = t + 0.25;
        if (rollAway(e, t)) busy = true;
      }
    if (!busy && t < backOff) {
      const e = foes.sort((u, v) => Math.hypot(u.x - p.x, u.z - p.z) - Math.hypot(v.x - p.x, v.z - p.z))[0];
      if (e) [vx, vz, busy] = [p.x - e.x, p.z - e.z, true];
    }
    // Otherwise: at the nearest foe that's close (a summoned one), else the tyrant; swing in reach.
    if (!busy) {
      const near = foes.filter((e) => e !== b && Math.hypot(e.x - p.x, e.z - p.z) < 3).sort((u, v) => Math.hypot(u.x - p.x, u.z - p.z) - Math.hypot(v.x - p.x, v.z - p.z))[0];
      const target = near ?? b, d = Math.hypot(target.x - p.x, target.z - p.z);
      const s = aimAt(target);
      if (d > 1.7) [vx, vz] = [target.x - p.x, target.z - p.z];
      else swing(s);
    }
    steer(vx, vz);
    await wait(60);
  }
  press([]);
  out.fight = { level: lvl, won: !b.alive, seconds: +((performance.now() - t0) / 1000).toFixed(0), heartsLost: hp0 - p.hp, causes, bossHpEvery10s: hpAt };
  out.balanced = out.fight.won && out.fight.seconds >= 45 && out.fight.seconds <= 110 && out.fight.heartsLost <= 10;
  localStorage.removeItem('realms-save');
})();
window.__report = () => out;
