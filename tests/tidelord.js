// The Tidelord's fight (run with &realm=aqua): walked into, his hall wakes him and the floodgate drops shut
// behind the knight. Every move seen: the charge (his lane on the floor, following the knight, then fixed
// before he goes), drowning orbs (they drift after the knight, slower than he walks; a blow cuts one down, with
// a breath of air in it), the slam (the spot marked under the knight, a wave over the floor after), the sweep
// (close by), his crew called in (they walk the sea floor). At half health he's enraged and the tide turns: a
// current sweeps the floor, carrying the knight (toward the far walls, never into the low ones on the camera's
// side), and turns a quarter, its new way shown first. Felled: victory, the sea free (the quest), everything he
// loosed gone, the dawn come down into his hall.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => performance.now() / 1000;
const c = document.querySelector('#view canvas');
const aimAt = (o) => {
  const s = { x: 0, y: 0 };
  g.cam.toScreen({ x: o.x, y: o.y, z: o.z, clone() { return new (g.cam.focus.constructor)(this.x, this.y, this.z); } }, s);
  c.dispatchEvent(new MouseEvent('mousemove', { clientX: s.x, clientY: s.y, bubbles: true }));
  return s;
};
const swing = (s) => {
  c.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: s.x, clientY: s.y, bubbles: true }));
  setTimeout(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })), 30);
};
(async () => {
  localStorage.removeItem('realms-save');
  g.save.data.flags.costume = true;
  p.dives = true;
  for (const e of g.enemies) if (e.alive && e.group === 'garrison') e.despawn(g);
  const gate = g.hallDoor, b = g.boss, a = g.realm.arena;
  gate.setOpen(true, g, true);
  p.maxHp = p.hp = 99;
  out.asleep = b.state;
  // In through the floodgate.
  p.place(122, 96, g);
  g.cam.focus.set(p.x, p.y, p.z);
  await wait(300);
  out.notYet = g.bossActive;
  p.place(127.5, 96, g);
  await wait(500);
  out.woke = { active: g.bossActive, gateShut: !gate.open };
  await wait(4000);
  // ---------- every move ----------
  const seen = { charge: 0, orbs: 0, slam: 0, sweep: 0, summon: 0 };
  const lane = [], marks = [], orbs = { most: 0, speeds: [] }, sweepWind = [];
  let last = '', laneFixedAt = null, stateAt = 0, h = null;
  const spy = () => {
    h = h ?? window.__tideHall?.();
    const t = now();
    if (b.state !== last) {
      if (last === 'paw' && b.state === 'charge') { seen.charge++; if (laneFixedAt !== null) lane.push(+(t - laneFixedAt).toFixed(2)); }
      if (last === 'windup' && b.state === 'strike') { seen.sweep++; sweepWind.push(+(t - stateAt).toFixed(2)); }
      if (b.state === 'chant') seen.orbs++;
      if (b.state === 'jump') seen.slam++;
      if (b.state === 'summon') seen.summon++;
      last = b.state;
      stateAt = t;
      laneFixedAt = null;
    }
    if (b.state === 'paw' && laneFixedAt === null && h?.lane.visible && h.lane.material === h.laneLockMat) laneFixedAt = t;
    for (const m of h?.marks ?? []) if (!marks.includes(m)) marks.push(m);
    if (h) orbs.most = Math.max(orbs.most, h.orbs.length);
  };
  // The knight keeps his distance (out of the sweep's way, mostly), and stands still a while.
  const t0 = now();
  while (now() - t0 < 30 && (seen.charge < 1 || seen.orbs < 1 || seen.slam < 1 || seen.summon < 1 || now() - t0 < 12)) {
    spy();
    await wait(40);
  }
  for (let k = 0; k < 40 && !b.summoned.some((e) => e.alive); k++) await wait(50);
  await wait(1200);
  // His crew, called in: they walk the sea floor (they've come away from where they appeared).
  const crew = b.summoned.filter((e) => e.alive);
  out.crew = { n: crew.length, dives: crew.every((e) => e.dives), moved: +Math.max(0, ...crew.map((e) => Math.hypot(e.x - e.home.x, e.z - e.home.z))).toFixed(2) };
  out.moves = { seen, laneFixedBefore: lane, slamMarks: marks.map((m) => +m.delay.toFixed(2)), mostOrbs: orbs.most, sweepWindup: sweepWind };
  // Orbs: loosed, they drift after him slower than he walks; a blow cuts one down.
  for (const e of b.summoned) if (e.alive) e.despawn(g);
  h.clear();
  b.state = 'chant';
  b.t = 0;
  b.struck = false;
  p.place(b.x + 5, b.z, g);
  await wait(1100);
  const o = h.orbs[0];
  const o0 = o ? { x: o.x, z: o.z } : null, d0 = o ? Math.hypot(o.x - p.x, o.z - p.z) : 0;
  await wait(1000);
  out.orbs = o ? { n: h.orbs.length, closedIn: +(d0 - Math.hypot(o.x - p.x, o.z - p.z)).toFixed(2), speed: +Math.hypot(o.x - o0.x, o.z - o0.z).toFixed(2) } : null;
  // Cut one down: face it and swing.
  p.air = 40;
  if (o) {
    p.place(o.x - 1.2, o.z, g);
    for (let k = 0; k < 6 && h.orbs.includes(o); k++) {
      swing(aimAt({ x: o.x, y: p.y + 0.9, z: o.z }));
      await wait(260);
    }
    out.orbs.cut = !h.orbs.includes(o);
    out.orbs.airAfter = +p.air.toFixed(1);
  }
  h.clear();
  b.state = 'recover';
  // ---------- enraged: the tide turns ----------
  b.hp = b.maxHp * 0.45;
  b.takeHit(1, 1, 0, 2, false, g);
  await wait(400);
  out.enraged = { enraged: b.enraged, tide: h.tide.on };
  // Carried: standing still in the hall's middle (the Tidelord held off a moment), he drifts with the current.
  const hold = setInterval(() => { b.state = 'stun'; b.t = 0; }, 30);
  p.place((a.x0 + a.x1) / 2, (a.z0 + a.z1) / 2, g);
  await wait(1200);
  const s0 = { x: p.x, z: p.z }, ang0 = h.tide.ang;
  await wait(1000);
  out.tide = { carried: +Math.hypot(p.x - s0.x, p.z - s0.z).toFixed(2), way: [+(p.x - s0.x).toFixed(2), +(p.z - s0.z).toFixed(2)], flow: [+h.flow.x.toFixed(2), +h.flow.z.toFixed(2)] };
  // It turns: its new way shows first.
  let warnedAt = null, turnedAt = null;
  const tt = now();
  while (now() - tt < 9 && turnedAt === null) {
    if (h.tide.warned && warnedAt === null) warnedAt = now();
    if (h.tide.ang !== ang0) turnedAt = now();
    await wait(30);
  }
  out.tide.turned = turnedAt !== null;
  out.tide.shownBefore = warnedAt && turnedAt ? +(turnedAt - warnedAt).toFixed(2) : null;
  out.tide.turnedBy = +((Math.abs(Math.atan2(Math.sin(h.tide.ang - ang0), Math.cos(h.tide.ang - ang0))) * 180) / Math.PI).toFixed(0);
  clearInterval(hold);
  b.state = 'chase';
  // ---------- felled ----------
  await wait(800);
  b.state = 'chant';
  b.t = 0;
  b.struck = false;
  await wait(700);
  const before = { orbs: h.orbs.length };
  b.hp = 1;
  b.takeHit(4, 1, 0, 2, false, g);
  const hp = p.hp;
  await wait(3500);
  out.felled = {
    dead: !b.alive,
    orbsBefore: before.orbs,
    left: { orbs: h.orbs.length, marks: h.marks.length, waves: h.waves.length, tide: h.tide.on },
    hurtAfter: hp - p.hp,
    victory: g.state,
    flag: !!g.save.data.flags.boss,
    quest: g.quests.def('main').short[g.save.data.quests.main],
    gateOpen: gate.open,
    dawn: +g.dawn.toFixed(2),
  };
  out.ok = out.asleep === 'sleep' && !out.notYet && out.woke.active && out.woke.gateShut && Object.values(seen).every((n) => n > 0) && lane.length > 0 && Math.min(...lane) >= 0.45
    && marks.length > 0 && Math.min(...marks.map((m) => m.delay)) >= 1.2 && out.crew.n > 0 && out.crew.dives && out.crew.moved > 0.5 && out.orbs?.closedIn > 0 && out.orbs.speed < 4.4 * 0.75 && out.orbs.cut
    && out.enraged.tide && out.tide.carried > 1 && out.tide.way[0] < 0.05 && out.tide.way[1] < 0.05 && out.tide.turned && out.tide.shownBefore >= 1.2 && out.tide.turnedBy === 90
    && out.felled.dead && !out.felled.left.orbs && !out.felled.left.tide && out.felled.hurtAfter === 0 && out.felled.flag && out.felled.quest === 'The sea is free';
  localStorage.removeItem('realms-save');
})();
window.__report = () => out;
