// Brassbelly's fight is fair (run with &realm=aqua&lvl=N): a player-like bot (real keys, aimed clicks) that
// rolls out of his steam ring a quarter second after it shows, keeps back while a blow winds up (rolling
// away, along the isle rather than into the sea round it), and otherwise closes in and swings at the nearest
// of the salvager and his crew (jumping back up onto his yard when thrown off it, going round by the foot of
// the steps up to the rock rather than into their side), beats them with the sword a knight brings from
// Whisperwood (level 4 or 5) in 25 to 90 s, losing no more than 5 hearts.
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
let clickN = 0, rolledAt = -9, jumpedAt = -9;
// Away from a foe as a person would go: the way most away from it that keeps to dry ground (the isle is ringed
// by the sea, a sandbar wading-deep at its west end), sideways if he's cornered.
const dry = (x, z) => {
  const h = g.grid.groundAt(x, z);
  if (g.grid.waterAt(x, z) > h + 0.05 || Math.abs(h - p.y) > 0.5) return false;
  return !g.grid.collidersNear(x, z).some((c) => c.on && c.y1 > h + 0.5 && (c.kind === 'b' ? x > c.x0 - 0.3 && x < c.x1 + 0.3 && z > c.z0 - 0.3 && z < c.z1 + 0.3 : Math.hypot(x - c.x, z - c.z) < c.r + 0.3));
};
const away = (e) => {
  const dx = p.x - e.x, dz = p.z - e.z, l = Math.hypot(dx, dz) || 1;
  let best = -9, bx = dx / l, bz = dz / l;
  for (let k = 0; k < 16; k++) {
    const th = (k / 16) * Math.PI * 2, ux = Math.cos(th), uz = Math.sin(th), sc = (ux * dx + uz * dz) / l;
    if (sc > best && [1, 2, 3].every((r) => dry(p.x + ux * r, p.z + uz * r))) [best, bx, bz] = [sc, ux, uz];
  }
  return [bx, bz];
};
// Can he go straight from one spot to another, the width of him, climbing no more than `up` at a time (a step
// walked, or the yard's edge jumped) and keeping out of deep water? The side of the steps up from the yard to the
// rock is a wall.
const straight = (x0, z0, x1, z1, up) => {
  const l = Math.hypot(x1 - x0, z1 - z0) || 1, n = Math.ceil(l / 0.25), ox = -(z1 - z0) / l, oz = (x1 - x0) / l;
  return [-0.3, 0, 0.3].every((o) => {
    let h = g.grid.groundAt(x0 + ox * o, z0 + oz * o);
    for (let k = 1; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n + ox * o, z = z0 + ((z1 - z0) * k) / n + oz * o, y = g.grid.groundAt(x, z);
      if (y - h > up || g.grid.waterAt(x, z) > y + 0.6) return false;
      h = y;
    }
    return true;
  });
};
// The way to a foe as a person would go: straight at it (jumping only up to one higher than him), else round
// what's between (the steps' foot, not their side): of the eight ways the keys take him, the one to a nearby spot
// he can walk to and go straight on from that makes the way shortest.
const wayTo = (e) => {
  const up = e.y - p.y > 0.45 ? 1 : 0.4;
  if (straight(p.x, p.z, e.x, e.z, up)) return null;
  const R = g.cam.groundRight, U = g.cam.groundUp;
  let best = 1e9, way = null;
  for (const [a, b] of [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]) {
    const l = Math.hypot(a, b), ux = (R.x * a + U.x * b) / l, uz = (R.z * a + U.z * b) / l;
    for (const r of [1, 2, 3, 4.5]) {
      const x = p.x + ux * r, z = p.z + uz * r, len = r + Math.hypot(e.x - x, e.z - z);
      if (len < best && straight(p.x, p.z, x, z, 0.4) && straight(x, z, e.x, e.z, up)) [best, way] = [len, [ux, uz]];
    }
  }
  return way;
};
const rollAway = (e, t) => {
  if (t - rolledAt < 0.9 || p.stamina < 30) return false;
  rolledAt = t;
  const [ux, uz] = away(e);
  const s = aimAt({ x: p.x + ux * 3, y: p.y - 0.9, z: p.z + uz * 3 });
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
  let ringSeen = -1, vents = 0, backOff = 0, windSeen = -1;
  while ((b.alive || crew.some((e) => e.alive)) && performance.now() - t0 < 150000) {
    const t = performance.now() / 1000;
    let vx = 0, vz = 0, busy = false, roll = false;
    // The steam ring: out of it, once seen for a quarter second (a roll as soon as a swing's done).
    if (b.alive && b.state === 'vent' && !b.struck) {
      if (ringSeen < 0) { ringSeen = t; vents++; }
      if (t - ringSeen > 0.25 && Math.hypot(p.x - b.x, p.z - b.z) < 2.8 + 0.8) [vx, vz, busy, roll] = [...away(b), true, true];
    } else ringSeen = -1;
    const foes = g.enemies.filter((e) => e.alive);
    // (His anchor drawn back is plain to see: away once it's been seen a quarter second, and not back in under it
    // until it falls (its blow reaches about 3 m with his lunge). The crew's quick jabs: at their flash.)
    if (b.alive && b.state === 'windup') { if (windSeen < 0) windSeen = t; } else windSeen = -1;
    const winding = (e) => (e === b ? windSeen >= 0 && t - windSeen >= 0.25 : e.telegraph > 0 && e.state !== 'vent');
    for (const e of foes)
      if (!busy && winding(e) && Math.hypot(e.x - p.x, e.z - p.z) < (e === b ? 4.2 : 2.4)) {
        backOff = t + 0.25;
        if (Math.hypot(e.x - p.x, e.z - p.z) < (e === b ? 3.2 : 2.4) && rollAway(e, t)) busy = true;
      }
    if (!busy && t < backOff) {
      const e = foes.sort((u, v) => Math.hypot(u.x - p.x, u.z - p.z) - Math.hypot(v.x - p.x, v.z - p.z))[0];
      if (e) [vx, vz, busy] = [...away(e), true];
    }
    if (!busy) {
      const target = foes.sort((u, v) => Math.hypot(u.x - p.x, u.z - p.z) - Math.hypot(v.x - p.x, v.z - p.z))[0];
      if (target) {
        const d = Math.hypot(target.x - p.x, target.z - p.z), s = aimAt(target), way = wayTo(target);
        // (Below the steps' side with them up on the steps, or on the yard beyond: round by the steps' foot.)
        if (way) [vx, vz] = way;
        else if (d > 1.7) [vx, vz] = [target.x - p.x, target.z - p.z];
        else swing(s);
        // (Thrown off the yard onto the beach below it: back up with a jump, as a person would.)
        if (target.y - p.y > 0.45 && d < 3.5 && p.onGround && p.state === 'run' && t - jumpedAt > 0.9) {
          jumpedAt = t;
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
          setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true })), 140);
        }
      }
    }
    steer(vx, vz);
    if (roll && !['attack', 'roll', 'hurt', 'block'].includes(p.state)) rollAway(b, t);
    await wait(60);
  }
  press([]);
  out.fight = { level: lvl, won: !b.alive && !crew.some((e) => e.alive), seconds: +((performance.now() - t0) / 1000).toFixed(0), heartsLost: hp0 - p.hp, causes, vents };
  out.fair = out.fight.won && out.fight.seconds >= 25 && out.fight.seconds <= 90 && out.fight.heartsLost <= 5;
  localStorage.removeItem('realms-save');
})();
window.__report = () => out;
