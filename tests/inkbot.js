// Old Inkarm's fight (run with &realm=aqua&lvl=N): a player-like bot (real keys, aimed clicks) that reacts a
// quarter second after a warning shows: steps sideways off the line an arm rises over, walks out of the ring
// filling under it (all but the first: that one catches it napping, and it mashes attack to tear free), goes to
// the grotto's vent for air when its air runs low, and strikes the body while the arms are down (otherwise it
// waits a few steps off, as a person would).
//   &lvl=N  wins with the sword a knight brings (5; the coral-smith's 6) in about 40 to 90 s, losing at most 5
//           hearts. The log checks fairness as it goes: every line and ring fills 1.2 s or more (timed by the
//           fight's own clock), one attack at a time (no arm rises or grabs while another is still coming),
//           nothing strikes the knight while it holds him, and mashing tears him free before it squeezes.
const g = window.__game, p = g.player, out = {};
const lvl = +(new URLSearchParams(location.search).get('lvl') ?? 5);
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
let clickN = 0, mashAt = -9;
const click = (s) => {
  c.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: s.x, clientY: s.y, bubbles: true }));
  setTimeout(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })), 30);
};
const swing = (s) => { if (!(clickN++ % 2)) click(s); };

(async () => {
  localStorage.removeItem('realms-save');
  g.save.data.flags.costume = true;
  p.dives = true;
  p.swordLevel = lvl;
  p.maxHp = p.hp = 99;
  const b = g.enemies.find((e) => e.type === 'inkarm'), ink = b.ink, F = { windup: 1.2, slamW: 1.5, ring: 1.3 };
  for (const e of g.enemies) if (e.alive && e !== b) e.despawn(g);
  // Its den and the grotto (src/world/inkgrotto.ts): in at its mouth, before the octopus.
  const DEN = { x: 65.6, z: 99.5 }, G = { x0: 60, z0: 97.6, x1: 71.2, z1: 105 }, VENT = { x: 61.4, z: 103 };
  const inside = (x, z, m = 0.7) => x > G.x0 + m && x < G.x1 - m && z > G.z0 + m && z < G.z1 - m;
  p.place(66, 103.6, g);
  g.cam.focus.set(p.x, p.y, p.z);
  await wait(300);
  const causes = {};
  const hurt = p.hurt.bind(p);
  p.hurt = (...args) => {
    const hp = p.hp, r = hurt(...args);
    if (p.hp < hp) causes[ink.phase] = (causes[ink.phase] ?? 0) + (hp - p.hp);
    return r;
  };
  // ---------- the log (fairness) ----------
  const log = { slams: 0, grabs: 0, held: 0, tornFree: 0, squeezed: 0, inks: 0, shortestLine: 99, shortestRing: 99, startsWhileBusy: 0, hitsWhileHeld: 0, bodyBlows: 0 };
  // (How long each line and ring filled: its own clock when the arm comes, read as it does.)
  for (const [fn, k] of [['slamTick', 'shortestLine'], ['grabTick', 'shortestRing']]) {
    const tick = ink[fn].bind(ink);
    ink[fn] = (gg) => {
      const s0 = ink.strike, ph0 = ink.phase, t = ink.t;
      tick(gg);
      if (fn === 'slamTick' ? s0 && ink.strike !== s0 : ph0 === 'grab' && ink.phase !== 'grab') log[k] = Math.min(log[k], +t.toFixed(2));
    };
  }
  let lastPhase = '', phaseAt = now(), lastStrike = null, strikeAt = 0, heldHp = 0, bodyHp = b.hp;
  const spy = (t) => {
    if (b.hp < bodyHp) log.bodyBlows++;
    bodyHp = b.hp;
    if (ink.strike !== lastStrike) {
      if (ink.strike) {
        log.slams++;
        // (Another arm rising, or a ring filling, as this one rises: two attacks at once.)
        if (ink.arms.filter((a) => a.mode === 'rise').length > 1 || ink.phase === 'grab') log.startsWhileBusy++;
      }
      lastStrike = ink.strike;
      strikeAt = t;
    }
    if (ink.phase !== lastPhase) {
      if (lastPhase === 'held' && ink.phase === 'down') log.tornFree++;
      if (lastPhase === 'held' && ink.phase === 'recover') log.squeezed++;
      if (ink.phase === 'grab') {
        log.grabs++;
        if (ink.strike || ink.arms.some((a) => a.mode === 'rise' || a.mode === 'slam')) log.startsWhileBusy++;
      }
      if (ink.phase === 'held') { log.held++; heldHp = p.hp; }
      if (ink.phase === 'swell') log.inks++;
      lastPhase = ink.phase;
      phaseAt = t;
    }
    // (Held, nothing else may strike him: anything lost but the squeeze itself.)
    if (ink.phase === 'held' && p.hp < heldHp) { log.hitsWhileHeld += heldHp - p.hp; heldHp = p.hp; }
  };
  // ---------- the bot ----------
  let side = null, ringOut = null, breathing = false;
  const bot = (t) => {
    let vx = 0, vz = 0, busy = false;
    const seen = t - phaseAt >= 0.25, s = ink.strike, seenLine = s && t - strikeAt >= 0.25;
    // Held: mash attack to tear free (a person, about seven presses a second).
    if (ink.phase === 'held') {
      press([]);
      if (seen && t - mashAt > 0.14) { mashAt = t; click(aimAt({ x: b.x, y: b.y + 1, z: b.z })); }
      return;
    }
    // (The first ring catches it napping: it stands there, to be seized and tear free.)
    if (ink.phase === 'grab' && log.grabs === 1) return press([]);
    // An arm rising over its line: sideways off it, to the roomier side, till it has crashed down.
    if (seenLine) {
      const along = (p.x - s.x) * s.ux + (p.z - s.z) * s.uz, across = (p.x - s.x) * s.uz - (p.z - s.z) * s.ux;
      if (along > -0.9 && along < s.len + 0.8 && Math.abs(across) < F.slamW / 2 + 0.7) {
        if (!side || side.s !== s) {
          const room = (k) => [0.8, 1.6, 2.4].filter((r) => inside(p.x + s.uz * k * r, p.z - s.ux * k * r)).length;
          let k = across !== 0 ? Math.sign(across) : 1;
          if (room(k) < room(-k) && Math.abs(across) < 0.3) k = -k;
          side = { s, x: s.uz * k, z: -s.ux * k };
        }
        [vx, vz, busy] = [side.x, side.z, true];
      }
    }
    // A ring filling under it: out of it, away from its middle (toward the open floor).
    if (!busy && ink.phase === 'grab' && seen) {
      const a = ink.grabAt, d = Math.hypot(p.x - a.x, p.z - a.z);
      if (d < F.ring + 0.6) {
        if (!ringOut) {
          let best = -1;
          for (let k = 0; k < 16; k++) {
            const th = (k / 16) * Math.PI * 2, ux = Math.cos(th), uz = Math.sin(th);
            if (!inside(a.x + ux * 2.2, a.z + uz * 2.2)) continue;
            const score = (ux * (p.x - a.x) + uz * (p.z - a.z)) / (d || 1) + 0.3 * -Math.hypot(a.x + ux * 2.2 - DEN.x, a.z + uz * 2.2 - DEN.z) / 4;
            if (score > best || best < 0) [best, ringOut] = [score, { x: ux, z: uz }];
          }
          ringOut ??= { x: p.x - DEN.x, z: p.z - DEN.z };
        }
        [vx, vz, busy] = [ringOut.x, ringOut.z, true];
      }
    } else ringOut = null;
    // Air: to the vent when it runs low, and stay till it's full (unless something is coming).
    if (p.air < 22) breathing = true;
    if (p.air > 80) breathing = false;
    if (!busy && breathing) {
      const d = Math.hypot(VENT.x - p.x, VENT.z - p.z);
      if (d > 0.6) [vx, vz] = [VENT.x - p.x, VENT.z - p.z];
      busy = true;
    }
    // Its arms down: at the body and strike it. Otherwise wait a few steps off its den, before it.
    if (!busy) {
      const d = Math.hypot(b.x - p.x, b.z - p.z);
      if (ink.open && b.alive) {
        const s2 = aimAt({ x: b.x, y: b.y + 1, z: b.z });
        if (d > b.r + 1.4) [vx, vz] = [b.x - p.x, b.z - p.z];
        else swing(s2);
      } else if (d < 3.0) [vx, vz] = [p.x - b.x, p.z - b.z];
      else if (d > 4.2) [vx, vz] = [b.x - p.x, b.z - p.z];
    }
    steer(vx, vz);
  };
  const t0 = now(), hp0 = p.hp, hpAt = [];
  let airLow = 99;
  while (b.alive && now() - t0 < 150) {
    const t = now();
    if (hpAt.length < Math.floor((t - t0) / 10) + 1) hpAt.push(+b.hp.toFixed(1));
    airLow = Math.min(airLow, p.air);
    spy(t);
    bot(t);
    await wait(60);
  }
  press([]);
  out.fight = { level: lvl, won: !b.alive, seconds: +(now() - t0).toFixed(0), heartsLost: hp0 - p.hp, causes, hpEvery10s: hpAt, lowestAir: +airLow.toFixed(0) };
  out.log = log;
  out.fair = log.shortestLine >= 1.2 && (log.grabs === 0 || log.shortestRing >= 1.2) && log.startsWhileBusy === 0 && log.hitsWhileHeld === 0 && log.squeezed === 0 && log.tornFree === log.held;
  out.balanced = out.fight.won && out.fight.seconds >= 40 && out.fight.seconds <= 90 && out.fight.heartsLost <= 5;
  out.ok = out.fair && out.balanced;
  localStorage.removeItem('realms-save');
})();
window.__report = () => out;
