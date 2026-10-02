// Brassbelly's fight is fair (run with &realm=aqua&lvl=N): a player-like bot (real keys, aimed clicks) that
// steps out of his steam ring a quarter second after it shows, keeps back while a blow winds up (rolling
// away), and otherwise closes in and swings at the nearest of the salvager and his crew, beats them with the
// sword a knight brings from Whisperwood (level 4 or 5) in 25 to 90 s, losing no more than 5 hearts.
const g = window.__game, p = g.player, out = {};
const lvl = +(new URLSearchParams(location.search).get('lvl') ?? 5);
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
  await wait(300);
  p.swordLevel = lvl;
  p.maxHp = p.hp = 99;
  const b = g.enemies.find((e) => e.type === 'salvager'), crew = g.enemies.filter((e) => e.group === 'salvager' && e !== b);
  for (const e of g.enemies) if (e.alive && e.group !== 'salvager') e.despawn(g);
  // Off the sandbar's end, onto the yard.
  p.place(b.x - 5, b.z + 0.5, g);
  g.cam.focus.set(p.x, p.y, p.z);
  await wait(600);
  const causes = {};
  for (const [fn, name] of [['salvagerVents', () => 'steam'], ['enemyHitsPlayer', (e) => (e === b ? 'anchor' : e.type)]]) {
    const orig = g[fn].bind(g);
    g[fn] = (...args) => { const hp = p.hp, r = orig(...args); if (p.hp < hp) causes[name(args[0])] = (causes[name(args[0])] ?? 0) + (hp - p.hp); return r; };
  }
  const t0 = performance.now(), hp0 = p.hp;
  let ringSeen = -1, vents = 0, backOff = 0;
  while ((b.alive || crew.some((e) => e.alive)) && performance.now() - t0 < 150000) {
    const t = performance.now() / 1000;
    let vx = 0, vz = 0, busy = false;
    // The steam ring: out of it, once seen for a quarter second.
    if (b.alive && b.state === 'vent' && !b.struck) {
      if (ringSeen < 0) { ringSeen = t; vents++; }
      if (t - ringSeen > 0.25 && Math.hypot(p.x - b.x, p.z - b.z) < 2.8 + 0.8) [vx, vz, busy] = [p.x - b.x, p.z - b.z, true];
    } else ringSeen = -1;
    const foes = g.enemies.filter((e) => e.alive);
    for (const e of foes)
      if (!busy && e.telegraph > 0 && e.state !== 'vent' && Math.hypot(e.x - p.x, e.z - p.z) < (e === b ? 3.2 : 2.4)) {
        backOff = t + 0.25;
        if (rollAway(e, t)) busy = true;
      }
    if (!busy && t < backOff) {
      const e = foes.sort((u, v) => Math.hypot(u.x - p.x, u.z - p.z) - Math.hypot(v.x - p.x, v.z - p.z))[0];
      if (e) [vx, vz, busy] = [p.x - e.x, p.z - e.z, true];
    }
    if (!busy) {
      const target = foes.sort((u, v) => Math.hypot(u.x - p.x, u.z - p.z) - Math.hypot(v.x - p.x, v.z - p.z))[0];
      if (target) {
        const d = Math.hypot(target.x - p.x, target.z - p.z), s = aimAt(target);
        if (d > 1.7) [vx, vz] = [target.x - p.x, target.z - p.z];
        else swing(s);
      }
    }
    steer(vx, vz);
    await wait(60);
  }
  press([]);
  out.fight = { level: lvl, won: !b.alive && !crew.some((e) => e.alive), seconds: +((performance.now() - t0) / 1000).toFixed(0), heartsLost: hp0 - p.hp, causes, vents };
  out.fair = out.fight.won && out.fight.seconds >= 25 && out.fight.seconds <= 90 && out.fight.heartsLost <= 5;
  localStorage.removeItem('realms-save');
})();
window.__report = () => out;
