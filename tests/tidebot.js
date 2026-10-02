// The Tidelord's fight with a player-like bot (run with &realm=aqua): real keys and aimed clicks, reacting a
// quarter second after a warning shows. It steps out of his charge's fixed lane, out of a slam's marked spot and
// jumps its wave as he lands, cuts down orbs that come close (or keeps away from them; the dodger too: a blow is
// how an orb is dodged), backs off from his sweep and holds its blows while he winds up, goes to a vent for air
// when its air runs low, and otherwise closes in and swings.
//   &lvl=N  balance: wins with a level-N sword (the coral-smith's 6; a knight arrives with 5) in about a minute,
//           losing well under the hearts a knight has by then (5 to 8).
//   &fair   fairness: his hall has room and nothing tall on the camera's side; every attack shows before it lands
//           (marks filling 1.2 s or more, the lane fixed 0.45 s or more before he goes), one at a time; the bot
//           only dodging is hardly hit, calm and enraged; standing still, it is.
const g = window.__game, p = g.player, grid = g.grid, out = {};
const q = new URLSearchParams(location.search), fair = q.has('fair'), lvl = +(q.get('lvl') ?? 6);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => performance.now() / 1000;
const c = document.querySelector('#view canvas');
const keys = new Set();
const key = (k, on) => {
  if (on && !keys.has(k)) { window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true })); keys.add(k); }
  if (!on && keys.has(k)) { window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true })); keys.delete(k); }
};
const press = (want) => { for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) key(k, want.includes(k)); };
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
const aimAt = (o) => {
  const s = { x: 0, y: 0 };
  g.cam.toScreen({ x: o.x, y: o.y, z: o.z, clone() { return new (g.cam.focus.constructor)(this.x, this.y, this.z); } }, s);
  c.dispatchEvent(new MouseEvent('mousemove', { clientX: s.x, clientY: s.y, bubbles: true }));
  return s;
};
let clickN = 0, rolledAt = -9, jumpedAt = -9;
const swing = (s) => {
  if (clickN++ % 2) return;
  c.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: s.x, clientY: s.y, bubbles: true }));
  setTimeout(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })), 30);
};
const rollAway = (x, z, t, gap = 0.9) => {
  if (t - rolledAt < gap || p.stamina < 30) return false;
  rolledAt = t;
  const dx = p.x - x, dz = p.z - z, l = Math.hypot(dx, dz) || 1;
  const s = aimAt({ x: p.x + (dx / l) * 3, y: p.y, z: p.z + (dz / l) * 3 });
  c.dispatchEvent(new MouseEvent('mousedown', { button: 2, clientX: s.x, clientY: s.y, bubbles: true }));
  setTimeout(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 2 })), 60);
  return true;
};
const jump = (t) => {
  if (t - jumpedAt < 0.9 || !p.onGround) return;
  jumpedAt = t;
  key('Space', true);
  setTimeout(() => key('Space', false), 140);
};

(async () => {
  localStorage.removeItem('realms-save');
  g.save.data.flags.costume = true;
  p.dives = true;
  p.swordLevel = lvl;
  const b = g.boss, a = g.realm.arena, gate = g.hallDoor;
  for (const e of g.enemies) if (e.alive && e.group !== 'boss') e.despawn(g);
  gate.setOpen(true, g, true);
  const floor = grid.groundAt(130, 97);
  if (fair) {
    // ---------- the room ----------
    const standing = (x, z) => {
      let top = grid.h[grid.i(Math.floor(x), Math.floor(z))];
      for (const cl of grid.collidersNear(x, z)) {
        if (!cl.on || cl.y1 <= floor + 0.3 || (cl.kind === 'c' && cl.r < 0.25)) continue;
        if (cl.kind === 'b' ? x > cl.x0 && x < cl.x1 && z > cl.z0 && z < cl.z1 : (x - cl.x) ** 2 + (z - cl.z) ** 2 < cl.r * cl.r) top = Math.max(top, cl.y1);
      }
      return top - floor;
    };
    // (A cell anything solid stands in: its walls are thinner than a cell.)
    const solid = (x, z) => [0.15, 0.5, 0.85].some((u) => [0.15, 0.5, 0.85].some((v) => standing(x + u, z + v) > 0.45));
    gate.setOpen(false, g, true);
    const seen = new Set(), st = [[Math.floor(130), Math.floor(97)]];
    seen.add(st[0].join());
    let cells = 0;
    while (st.length) {
      const [x, z] = st.pop();
      cells++;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz, k = nx + ',' + nz;
        if (seen.has(k) || !grid.inside(nx, nz) || Math.abs(grid.h[grid.i(nx, nz)] - floor) > 0.45 || solid(nx, nz)) continue;
        seen.add(k);
        st.push([nx, nz]);
      }
    }
    const xs = [...seen].map((k) => +k.split(',')[0]), zs = [...seen].map((k) => +k.split(',')[1]);
    // What stands round it (rays out from its middle): high enough to hold the knight, low on the camera's side.
    const rays = [];
    for (let k = 0; k < 48; k++) {
      const th = (k / 48) * Math.PI * 2;
      let top = -99;
      for (let r = 2; r < 14; r += 0.2) {
        const x = 131.75 + Math.cos(th) * r, z = 96.25 + Math.sin(th) * r;
        if (!grid.inside(Math.floor(x), Math.floor(z))) break;
        const hh = standing(x, z);
        if (hh > 0.5) top = Math.max(top, hh);
        else if (top > -99) break;
      }
      rays.push({ near: Math.cos(th - Math.PI / 4) > 0.35, rise: +top.toFixed(2) });
    }
    gate.setOpen(true, g, true);
    out.room = {
      floor: cells,
      across: [Math.max(...xs) - Math.min(...xs) + 1, Math.max(...zs) - Math.min(...zs) + 1],
      lowest: Math.min(...rays.map((r) => r.rise)),
      nearHighest: Math.max(...rays.filter((r) => r.near).map((r) => r.rise)),
      farHighest: Math.max(...rays.map((r) => r.rise)),
    };
  }
  // ---------- into the hall ----------
  p.maxHp = p.hp = fair ? 99 : 99;
  p.place(127.5, 96, g);
  g.cam.focus.set(p.x, p.y, p.z);
  await wait(4800);
  out.started = g.bossActive;
  const h = window.__tideHall();
  const causes = {};
  let part = 'fight';
  // (What hit him, told by where the blow came from.)
  const hurt = p.hurt.bind(p);
  p.hurt = (dmg, fx, fz, gg, opts) => {
    const hp = p.hp, r = hurt(dmg, fx, fz, gg, opts);
    if (p.hp < hp) {
      const at = (o) => Math.abs(o.x - fx) < 0.01 && Math.abs(o.z - fz) < 0.01;
      const e = g.enemies.find(at);
      const n = h.orbs.some(at) ? 'orb' : h.waves.some(at) ? 'wave' : e === b ? 'boss:' + b.state : e ? e.type + (b.summoned.includes(e) ? ' (crew)' : '') : 'other';
      causes[part + ':' + n] = (causes[part + ':' + n] ?? 0) + 1;
    }
    return r;
  };
  // ---------- what it sees (each warning seen a quarter second late) ----------
  const seenAt = new Map();
  const seenFor = (o, t) => {
    if (!seenAt.has(o)) seenAt.set(o, t);
    return t - seenAt.get(o) >= 0.25;
  };
  const inHall = (x, z) => x > a.x0 - 0.8 && x < a.x1 - 0.6 && z > a.z0 + 0.6 && z < a.z1 - 0.6;
  // The log: warnings and attacks, for the fairness rules.
  const log = { marks: [], lanes: [], startsWhileBusy: 0 }, sweepLog = [];
  out.sweeps = sweepLog;
  let lastState = '', laneFixed = null, windupAt = 0, stateAt = 0;
  const spy = (t) => {
    for (const m of h.marks) if (!log.marks.includes(m)) log.marks.push(m);
    if (b.state !== lastState) {
      if (['paw', 'chant', 'jump', 'windup', 'summon'].includes(b.state) && (h.orbs.length || h.marks.length || h.waves.length)) log.startsWhileBusy++;
      if (lastState === 'paw' && b.state === 'charge' && laneFixed !== null) log.lanes.push(+(t - laneFixed).toFixed(2));
      lastState = b.state;
      laneFixed = null;
      if (b.state === 'windup') { windupAt = t; sweepLog.push({ d0: +Math.hypot(b.x - p.x, b.z - p.z).toFixed(1), st0: p.state, stam: Math.round(p.stamina) }); }
      if (b.state === 'strike' && sweepLog.length) Object.assign(sweepLog[sweepLog.length - 1], { d1: +Math.hypot(b.x - p.x, b.z - p.z).toFixed(1), st1: p.state, hp: p.hp, shown: +(t - windupAt).toFixed(2) });
      stateAt = t;
    }
    if (b.state === 'paw' && laneFixed === null && h.lane.material === h.laneLockMat) laneFixed = t;
  };
  let side = null, backOff = 0, breathing = false;
  const bot = (t, attack) => {
    let vx = 0, vz = 0, busy = false;
    // The charge's fixed lane: sideways out of it, to the roomier side, until he has gone by.
    if (h.lane.visible && h.lane.material === h.laneLockMat && laneFixed !== null && t - laneFixed >= 0.25) {
      const ax = Math.cos(h.aim), az = Math.sin(h.aim), rx = p.x - b.x, rz = p.z - b.z, along = rx * ax + rz * az, off = -rx * az + rz * ax;
      if (along > -1 && along < h.len + 1.5 && Math.abs(off) < b.r + 1.4) {
        if (!side) {
          const k = off !== 0 ? Math.sign(off) : 1, room = (s) => [1, 2, 3].filter((r) => inHall(p.x - az * s * r, p.z + ax * s * r)).length;
          const s = room(k) >= room(-k) ? k : -k;
          side = { x: -az * s, z: ax * s, until: t + 1.2 };
        }
      }
    }
    if (side && t > side.until) side = null;
    if (side) [vx, vz, busy] = [side.x, side.z, true];
    // A slam's marked spot: out of it (to the clearest spot round about); and its wave: jump it as it comes.
    for (const m of h.marks) {
      if (!seenFor(m, t)) continue;
      const d = Math.hypot(p.x - m.x, p.z - m.z);
      if (d < 2.0 + 1.1 && !busy) {
        let best = -1;
        for (let k = 0; k < 16; k++) {
          const th = (k / 16) * Math.PI * 2, ux = Math.cos(th), uz = Math.sin(th);
          if (!inHall(p.x + ux * 2, p.z + uz * 2)) continue;
          const cl = Math.hypot(p.x + ux * 2 - m.x, p.z + uz * 2 - m.z);
          if (cl > best) [best, vx, vz] = [cl, ux, uz];
        }
        busy = true;
      }
      const arrive = m.delay - m.t + Math.max(0, d - 1.6) / 6.5;
      if (d < 7.6 && arrive < 0.42) jump(t);
    }
    for (const w of h.waves) {
      const d = Math.hypot(p.x - w.x, p.z - w.z);
      if (!w.hit && d > w.r && (d - w.r) / 6.5 < 0.4 && d < 7.6) jump(t);
    }
    // Orbs close by: cut them down if they're in front, else keep away.
    const orb = h.orbs.filter((o) => o.loose && seenFor(o, t)).sort((u, v) => Math.hypot(u.x - p.x, u.z - p.z) - Math.hypot(v.x - p.x, v.z - p.z))[0];
    if (orb && !busy) {
      const d = Math.hypot(orb.x - p.x, orb.z - p.z);
      if (d < 1.9) {
        swing(aimAt({ x: orb.x, y: p.y + 0.9, z: orb.z }));
        busy = true;
      } else if (d < 1.4) [vx, vz, busy] = [p.x - orb.x, p.z - orb.z, true];
    }
    // His sweep winding up close by: back off from him, rolling if it can (pointing away first).
    let roll = false;
    if (!busy && b.state === 'windup' && t - windupAt >= 0.25 && Math.hypot(b.x - p.x, b.z - p.z) < 3.6) {
      backOff = t + 0.6;
      roll = true;
    }
    if (!busy && t < backOff) [vx, vz, busy] = [p.x - b.x, p.z - b.z, true];
    // Air: to the nearest vent when it runs low, and stay till it's full.
    if (p.air < 22) breathing = true;
    if (p.air > 80) breathing = false;
    if (!busy && breathing) {
      const v = g.realm.sea.pockets.filter((k) => inHall(k.x, k.z) || k.x > 124).sort((u, w) => Math.hypot(u.x - p.x, u.z - p.z) - Math.hypot(w.x - p.x, w.z - p.z))[0];
      const d = Math.hypot(v.x - p.x, v.z - p.z);
      if (d > 0.6) [vx, vz] = [v.x - p.x, v.z - p.z];
      busy = true;
    }
    // Otherwise: at the nearest of his crew that's close, else at him; swing in reach.
    if (!busy && attack) {
      const foes = g.enemies.filter((e) => e.alive && e !== b && Math.hypot(e.x - p.x, e.z - p.z) < 3).sort((u, v) => Math.hypot(u.x - p.x, u.z - p.z) - Math.hypot(v.x - p.x, v.z - p.z));
      const target = foes[0] ?? b, d = Math.hypot(target.x - p.x, target.z - p.z);
      const s = aimAt({ x: target.x, y: target.y + 0.9, z: target.z });
      // (No new blow at him once he's seen winding up, or with a slam's mark down: a person holds off.)
      const wary = (b.telegraph > 0 && t - stateAt >= 0.25) || h.marks.some((m) => seenFor(m, t)) || h.waves.length > 0;
      if (d > 1.9) [vx, vz] = [target.x - p.x, target.z - p.z];
      else if (!(target === b && wary)) swing(s);
    }
    steer(vx, vz);
    // (As soon as it can: a blow already swinging finishes first.)
    if (roll && !['attack', 'roll', 'hurt', 'block'].includes(p.state)) rollAway(b.x, b.z, t, 0.4);
  };
  const run = async (secs, mode) => {
    const hp0 = p.hp, t0 = now();
    while (now() - t0 < secs && b.alive) {
      const t = now();
      spy(t);
      if (mode !== 'fight') for (const e of b.summoned) if (e.alive) e.despawn(g);
      if (mode === 'still') press([]);
      else bot(t, mode === 'fight');
      await wait(60);
    }
    press([]);
    return hp0 - p.hp;
  };
  if (fair) {
    part = 'calm';
    const calm = await run(24, 'dodge');
    b.hp = b.maxHp * 0.45;
    b.takeHit(1, 1, 0, 2, false, g);
    await wait(300);
    part = 'enraged';
    const enraged = await run(22, 'dodge');
    part = 'still';
    const still = await run(14, 'still');
    out.warnings = {
      slamMarks: log.marks.length,
      shortestMark: log.marks.length ? +Math.min(...log.marks.map((m) => m.delay)).toFixed(2) : null,
      charges: log.lanes.length,
      laneFixedBefore: log.lanes.length ? Math.min(...log.lanes) : null,
      startsWhileBusy: log.startsWhileBusy,
      sweepShownFor: sweepLog.filter((w) => w.shown).length ? Math.min(...sweepLog.filter((w) => w.shown).map((w) => w.shown)) : null,
    };
    out.dodger = { calmHits: calm, enragedHits: enraged, standingStillHits: still, causes };
    out.ok = out.started && out.room.floor >= 160 && out.room.lowest >= 1.8 && out.room.nearHighest <= 2.6 && out.warnings.shortestMark >= 1.2 && out.warnings.laneFixedBefore >= 0.45 && out.warnings.sweepShownFor >= 1.15
      && out.warnings.startsWhileBusy === 0 && calm <= 2 && enraged <= 3 && still >= 4;
  } else {
    const t0 = now(), hp0 = p.hp, hpAt = [];
    let airLow = 99;
    const tick = setInterval(() => {
      airLow = Math.min(airLow, p.air);
      if (hpAt.length < Math.floor((now() - t0) / 10) + 1) hpAt.push(+b.hp.toFixed(1));
    }, 200);
    await run(200, 'fight');
    clearInterval(tick);
    out.fight = { level: lvl, won: !b.alive, seconds: +(now() - t0).toFixed(0), heartsLost: hp0 - p.hp, causes, bossHpEvery10s: hpAt, lowestAir: +airLow.toFixed(0), breathless: airLow <= 0 };
    out.balanced = out.fight.won && out.fight.seconds >= 40 && out.fight.seconds <= 100 && out.fight.heartsLost <= 4;
    out.ok = out.balanced;
  }
  localStorage.removeItem('realms-save');
})();
window.__report = () => out;
