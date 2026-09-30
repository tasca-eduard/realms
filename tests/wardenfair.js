// The Thorn Warden's fight is fair (run with &realm=forest): its hollow has room to run (the floor
// counted), a barrier all round that stays low on the camera's side (so it hides nothing); every
// attack shows before it lands, long enough to react (marked spots fill up for 1.2 s or more; the
// volley's lines are fixed well before it looses, and they're all the way its arrows go), and one
// comes at a time. Then proof: a knight
// who only steps out of the way, a quarter second after each warning, is hardly ever hit, and one
// who stands still is.
const g = window.__game, p = g.player, grid = g.grid, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => performance.now() / 1000;
(async () => {
  localStorage.removeItem('realms-save');
  for (const e of g.enemies) if (e.alive && e.group !== 'boss') e.despawn(g);
  g.hallDoor.setOpen(true, g, true);
  const b = g.boss, a = g.realm.arena;
  const floor = grid.groundAt(b.x, b.z);
  // How high whatever stands on a spot stands above the hollow's floor (ground or something solid:
  // a root, a trunk; thin things aside).
  const standing = (x, z) => {
    let top = grid.h[grid.i(Math.floor(x), Math.floor(z))];
    for (const c of grid.collidersNear(x, z)) {
      if (!c.on || c.y1 <= floor + 0.3 || (c.kind === 'c' && c.r < 0.25)) continue;
      if (c.kind === 'b' ? x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 : (x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) top = Math.max(top, c.y1);
    }
    return top - floor;
  };
  // ---------- the room: the hollow's floor, flooded from the Warden's spot ----------
  const seen = new Set(), q = [[Math.floor(b.x), Math.floor(b.z)]];
  seen.add(q[0].join());
  let cells = 0, cx = 0, cz = 0;
  while (q.length) {
    const [x, z] = q.pop();
    cells++;
    cx += x + 0.5;
    cz += z + 0.5;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz, k = nx + ',' + nz;
      if (seen.has(k) || !grid.inside(nx, nz) || Math.abs(grid.h[grid.i(nx, nz)] - floor) > 0.3 || standing(nx + 0.5, nz + 0.5) > 0.3) continue;
      // (Out through the mouth: stop at the thorns' line.)
      if (nx + 0.5 > g.hallDoor.x - 0.3) continue;
      seen.add(k);
      q.push([nx, nz]);
    }
  }
  cx /= cells;
  cz /= cells;
  // ---------- the roots round it: high enough to hold the knight, low on the camera's side ----------
  const rays = [];
  for (let k = 0; k < 48; k++) {
    const th = (k / 48) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(th), Math.cos(th))) < 0.55) continue; // the mouth (east)
    let top = -99;
    for (let r = 2; r < 14; r += 0.25) {
      const x = cx + Math.cos(th) * r, z = cz + Math.sin(th) * r;
      if (!grid.inside(Math.floor(x), Math.floor(z))) break;
      const h = standing(x, z);
      if (h > 0.5) top = Math.max(top, h);
      else if (top > -99) break;
    }
    rays.push({ th, near: Math.cos(th - Math.PI / 4) > 0.35, rise: +top.toFixed(2) });
  }
  const nearRises = rays.filter((r) => r.near).map((r) => r.rise), allRises = rays.map((r) => r.rise);
  out.room = {
    floor: cells,
    across: [+(Math.max(...[...seen].map((k) => +k.split(',')[0])) - Math.min(...[...seen].map((k) => +k.split(',')[0])) + 1).toFixed(0), +(Math.max(...[...seen].map((k) => +k.split(',')[1])) - Math.min(...[...seen].map((k) => +k.split(',')[1])) + 1).toFixed(0)],
    lowestRoot: Math.min(...allRises),
    nearHighest: Math.max(...nearRises),
    farHighest: Math.max(...allRises.filter((r) => r < 6)), // (not the Great Tree's trunk)
  };
  // ---------- the fight: warnings, and one thing at a time ----------
  p.maxHp = p.hp = 99;
  p.place(a.x1 - 1.5, (a.z0 + a.z1) / 2, g);
  g.cam.focus.set(p.x, p.y, p.z);
  await wait(4500); // past the intro
  out.started = g.bossActive;
  const log = { marks: [], arrows: [] };
  const known = new Set();
  const markSeen = new Map();
  let fanLockedAt = null, fanLead = [], lastLock = 0, lastAim = 0, lastWarden = [0, 0];
  const sp = () => (b.enraged ? 1.2 : 1);
  const spy = () => {
    const t = now();
    for (const m of g.wardenMarks)
      if (!known.has(m)) {
        known.add(m);
        const pending = log.marks.filter((o) => !o.m.landed && t - o.t > 0.35).length;
        log.marks.push({ m, t, delay: m.delay, kind: m.kind, overlapped: pending });
      }
    for (const ar of g.combat.arrows)
      if (ar.from === b && !known.has(ar)) {
        known.add(ar);
        log.arrows.push({ t, duringMarks: g.wardenMarks.filter((m) => !m.landed).length });
        if (fanLockedAt !== null) fanLead.push(+(t - fanLockedAt).toFixed(2));
        fanLockedAt = null;
      }
    if (b.state === 'aim' && b.t >= 0.75 / sp() && fanLockedAt === null) {
      fanLockedAt = lastLock = t;
      lastAim = b.volleyAim;
      lastWarden = [b.x, b.z];
    }
    if (b.state !== 'aim' && !log.arrows.length) fanLockedAt = null;
  };
  // A knight who dodges: a quarter second after a warning shows, he steps out of the marked spots
  // and sideways out of a fixed volley's lines, and keeps out of reach of the Warden's bow.
  const move = (dx, dz) => {
    const l = Math.hypot(dx, dz);
    if (l < 1e-3) return;
    const s = Math.min(l, 5.2 * 0.05);
    const body = { x: p.x, y: p.y, z: p.z, r: p.r };
    grid.move(body, (dx / l) * s, (dz / l) * s, 0.45);
    if (Math.abs(grid.groundAt(body.x, body.z) - floor) < 0.3) p.place(body.x, body.z, g);
  };
  // (Clearance from the marks he has seen for a quarter second; open floor well inside the roots.)
  const clearance = (x, z) => {
    let c = 99;
    for (const m of g.wardenMarks) {
      if (m.landed || !markSeen.has(m) || now() - markSeen.get(m) < 0.25) continue;
      c = Math.min(c, Math.hypot(x - m.x, z - m.z));
    }
    return c;
  };
  const onFloor = (x, z) => seen.has(Math.floor(x) + ',' + Math.floor(z));
  const open = (x, z) => [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]].every(([dx, dz]) => onFloor(x + dx, z + dz));
  let side = null, stuck = 0;
  const bot = () => {
    const t = now();
    for (const m of g.wardenMarks) if (!m.landed && !markSeen.has(m)) markSeen.set(m, t);
    let vx = 0, vz = 0;
    // Marked spots: to whichever spot 1.8 m away is clearest.
    if (clearance(p.x, p.z) < 1.5) {
      let best = -1;
      for (let k = 0; k < 16; k++) {
        const th = (k / 16) * Math.PI * 2, ux = Math.cos(th), uz = Math.sin(th);
        if (![0.6, 1.2, 1.8].every((r) => open(p.x + ux * r, p.z + uz * r))) continue;
        const c = clearance(p.x + ux * 1.8, p.z + uz * 1.8);
        if (c > best) [best, vx, vz] = [c, ux, uz];
      }
      if (best < 0) stuck++;
    }
    // A fixed volley: sideways out of its lines (toward the roomier side), until it has passed.
    if (b.state === 'aim' && b.t >= 0.75 / sp() + 0.25 && !side) {
      const px = -Math.sin(b.volleyAim), pz = Math.cos(b.volleyAim);
      const room = (k) => [1, 2, 3].filter((r) => open(p.x + px * k * r, p.z + pz * k * r)).length;
      const k = room(1) >= room(-1) ? 1 : -1;
      side = { x: px * k, z: pz * k, until: t + 1.1 };
    }
    if (side && t > side.until) side = null;
    if (side && !vx && !vz) [vx, vz] = [side.x, side.z];
    // Out of reach of its bow.
    const db = Math.hypot(p.x - b.x, p.z - b.z);
    if (db < 3.4 && !vx && !vz) [vx, vz] = [(p.x - b.x) / db, (p.z - b.z) / db];
    move(vx, vz);
  };
  // What hit him, in each part (for the report).
  const causes = { dodging: {}, still: {} };
  let part = 'dodging';
  for (const [fn, name] of [['wardenMarkLands', (m) => m.kind], ['arrowHitsPlayer', () => 'arrow'], ['enemyHitsPlayer', (e) => (e === b ? 'swipe' : e.type)]]) {
    const orig = g[fn].bind(g);
    g[fn] = (...args) => {
      const hp = p.hp, r = orig(...args);
      if (p.hp < hp) causes[part][name(args[0])] = (causes[part][name(args[0])] ?? 0) + 1;
      return r;
    };
  }
  const run = async (secs, dodge) => {
    const hp0 = p.hp, t0 = now();
    while (now() - t0 < secs) {
      spy();
      // (Only the Warden's own attacks: whatever it calls in is sent away at once.)
      for (const e of b.summoned) if (e.alive) e.despawn(g);
      if (dodge && p.alive) bot();
      await wait(50);
    }
    return hp0 - p.hp;
  };
  const calmHits = await run(24, true);
  b.hp = b.maxHp * 0.45;
  b.takeHit(1, 1, 0, 2, false, g);
  await wait(300);
  const enragedHits = await run(22, true);
  part = 'still';
  const stillHits = await run(14, false);
  const delays = log.marks.map((o) => o.delay);
  out.warnings = {
    marks: log.marks.length,
    shortestMark: +Math.min(...delays).toFixed(2),
    volleys: log.arrows.length,
    fanFixedBefore: fanLead.length ? Math.min(...fanLead) : null,
    arrowsDuringMarks: log.arrows.filter((a) => a.duringMarks).length,
    marksOverMarks: log.marks.filter((o) => o.overlapped).length,
  };
  out.dodger = { calmHits, enraged: b.enraged, enragedHits, standingStillHits: stillHits, stuck, causes };
  // A fixed volley's lines are all the way its arrows go: backed straight out past a line's end he's
  // safe; standing on the line he's hit.
  for (const e of b.summoned) if (e.alive) e.despawn(g);
  const volleyAt = async (past) => {
    b.x = cx - 4;
    b.z = cz;
    b.set('aim');
    p.place(cx, cz, g);
    const hp = p.hp;
    await wait(1000 * (0.75 / sp()) + 60);
    const aim = b.volleyAim, reach = b.volleyReach, along = past ? reach + 1.2 : reach - 2.5;
    p.place(b.x + Math.cos(aim) * along, b.z + Math.sin(aim) * along, g);
    await wait(1800);
    return { reach: +reach.toFixed(1), at: +along.toFixed(1), hit: hp - p.hp };
  };
  out.volleyEnd = { pastTheEnd: await volleyAt(true), onTheLine: await volleyAt(false) };
  // Felled: nothing it loosed hurts after.
  b.hp = 1;
  b.set('aim');
  await wait(1300);
  const inAir = g.combat.arrows.filter((a) => a.from === b && !a.dead && !a.stuck).length;
  b.takeHit(4, 1, 0, 2, false, g);
  const hpDead = p.hp;
  await wait(2500);
  out.felled = { dead: !b.alive, arrowsInAir: inAir, hitAfter: hpDead - p.hp, marksLeft: g.wardenMarks.length };
  localStorage.removeItem('realms-save');
})();
window.__report = () => out;
