// The Sunken Reef's own foes and its giant clams in live encounters (run with &realm=aqua): each one
// baited, its telegraph seen before its blow lands, the blow, and the counter that beats it.
//   diver      walks the sea floor, its float bobbing on the surface over it; flashes, then strikes (a heart);
//              three blows of a realm-3 sword (level 5) fell it
//   harpooner  its line on the ground holds still before the throw: stepped off, the harpoon misses; stood
//              on, it strikes (a heart) and reels the knight in; a roll frees him
//   jelly      squeezes (flashing), lunges and stings (a heart); felled, it splits in two little ones whose
//              stings poison and cost no heart
//   crab       its claw turns blows from the front (it turns slowly: from behind they land); a heavy blow
//              flips it, and flipped it takes more; it flashes before its pinch (a heart)
//   eel        in its den nothing reaches it; it lunges along a line fixed before it goes (a heart; stepped
//              off, nothing), stays out (blows land; struck, it flinches, a second blow lands, then it pulls back)
//   puffer     close, it swells (a ring filling round it, flashing) and its spikes burst (a heart); swollen,
//              blows do a quarter and prick; gone down, winded, they land in full; struck early in the swell,
//              it stops
//   clam       stood in, a ring fills and it snaps shut (a heart); struck open (a real swing), its pearl
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const Enemy = g.enemies[0].constructor;
window.__report = () => out;
const fresh = () => {
  p.hp = p.maxHp;
  p.stamina = p.maxStamina;
  p.cureAll();
  p.iframes = 0;
  p.vx = p.vz = 0;
};
const spawn = (type, x, z) => {
  const e = new Enemy(type, x, z, g, 'test');
  // (Never golden here: as tough as its kind.)
  if (e.golden) e.hp = e.maxHp = e.spec.hp * (g.realm.foeHp ?? 1);
  e.golden = false;
  e.model.rig.addTo(g.scene);
  g.enemies.push(e);
  return e;
};
const clear = () => {
  for (const e of g.enemies) if (e.alive || e.state === 'hide') e.despawn(g);
};
// A realm-3 sword (level 5): the combo's three blows.
const SWORD = [1, 1.1, 1.6].map((k) => k * 2.25);
// Watch a fight: when the foe starts to flash, when the knight loses a heart (and how long after).
const watch = (e) => {
  const w = { teleAt: -1, leads: [], hits: 0, states: [] };
  let hp = p.hp, tele = false;
  w.id = setInterval(() => {
    if (w.states[w.states.length - 1] !== e.state) w.states.push(e.state);
    if (e.telegraph > 0 && !tele) w.teleAt = g.time;
    tele = e.telegraph > 0;
    if (p.hp < hp) {
      w.hits += hp - p.hp;
      w.leads.push(w.teleAt < 0 ? -1 : +(g.time - w.teleAt).toFixed(2));
    }
    hp = p.hp;
  }, 10);
  w.stop = () => clearInterval(w.id);
  return w;
};
const until = async (fn, ms) => {
  const t0 = performance.now();
  while (!fn() && performance.now() - t0 < ms) await wait(10);
  return fn();
};
const C = { x: 86, z: 88 };
// Level ground on the strand, 8 m of it in a row (for the harpooner).
const flatRow = () => {
  for (let z = 16; z < 28; z++)
    for (let x = 14; x < 26; x++) {
      const h = g.grid.groundAt(x + 0.5, z + 0.5);
      let ok = h > 0.05;
      for (let k = 0; k <= 8 && ok; k++) ok = Math.abs(g.grid.groundAt(x + k + 0.5, z + 0.5) - h) < 0.05 && Math.abs(g.grid.groundAt(x + k + 0.5, z + 2.5) - h) < 0.05;
      if (ok) return { x: x + 0.5, z: z + 0.5 };
    }
  return { x: 20, z: 21 };
};

(async () => {
  await wait(400);
  g.input.mouseAim = false;
  p.dives = true;
  clear();
  const sea = g.realm.sea;

  // ---------- a diver ----------
  {
    fresh();
    p.place(C.x, C.z, g);
    const e = spawn('diver', C.x + 3, C.z);
    const w = watch(e);
    await until(() => w.hits > 0, 6000);
    w.stop();
    const f = e.sea.look.float;
    out.diver = { dives: e.dives, floatOnSurface: !!f && Math.abs(e.y + f.y - sea.surface) < 0.15, under: e.y < sea.surface - 2, hearts: w.hits, lead: w.leads[0] };
    let blows = 0;
    while (e.alive && blows < 6) e.takeHit(SWORD[blows % 3], 1, 0, 0, blows % 3 === 2, g), blows++;
    out.diver.blows = blows;
    clear();
  }

  // ---------- a harpooner, on the strand ----------
  {
    fresh();
    const K = flatRow();
    p.place(K.x, K.z, g);
    const e = spawn('harpooner', K.x + 7, K.z);
    const F = { windup: 1.15, lock: 0.45 };
    // 1. Stepped off the line once it holds still: a miss.
    await until(() => e.state === 'aim' && e.t >= F.windup - F.lock + 0.02, 6000);
    const aimLocked = e.sea.aim;
    p.place(K.x, K.z + 1.8, g);
    await until(() => e.state !== 'aim', 1000);
    const aimThrown = e.sea.aim;
    await wait(900);
    out.harpooner = { lineHeld: Math.abs(aimLocked - aimThrown) < 1e-6, dodgedHearts: p.maxHp - p.hp };
    // 2. Stood on the line: struck and hooked, hauled in toward it.
    fresh();
    p.place(K.x, K.z, g);
    await until(() => e.state === 'aim', 6000);
    const w = watch(e);
    const d0 = Math.hypot(e.x - p.x, e.z - p.z);
    await until(() => e.state === 'reel', 3000);
    const hooked = e.state === 'reel';
    await until(() => e.state !== 'reel', 2000);
    w.stop();
    out.harpooner.hooked = { hooked, hearts: w.hits, lead: w.leads[0], from: +d0.toFixed(1), to: +Math.hypot(e.x - p.x, e.z - p.z).toFixed(1) };
    // 3. Hooked again, he rolls: free at once.
    fresh();
    p.place(K.x, K.z, g);
    await wait(200);
    e.x = K.x + 7;
    e.z = K.z;
    const wasHooked = await until(() => e.state === 'reel', 8000);
    // (Once he's over the blow, he can act.)
    await until(() => p.state !== 'hurt', 1000);
    await wait(50);
    p.fx = 0;
    p.fz = 1;
    p.aim.set(0, 1);
    g.input.press('guard');
    await wait(60);
    g.input.release('guard');
    await wait(150);
    out.harpooner.roll = { hooked: wasHooked, freed: e.state !== 'reel', slack: !e.sea.harpoon || e.sea.harpoon.mode === 'back' };
    clear();
  }

  // ---------- a Jelly ----------
  {
    fresh();
    p.place(C.x, C.z, g);
    const e = spawn('jelly', C.x + 3.2, C.z);
    const w = watch(e);
    await until(() => w.hits > 0, 7000);
    w.stop();
    out.jelly = { hearts: w.hits, lead: w.leads[0], lifted: +e.model.rig.lift.toFixed(2) };
    e.takeHit(e.hp + 1, 1, 0, 2, false, g);
    await wait(500);
    const small = g.enemies.filter((j) => j.alive && j.type === 'jelly' && j.sea.small);
    out.jelly.split = { n: small.length, hp: small.map((j) => +j.maxHp.toFixed(2)), inDeep: small.every((j) => g.grid.isDeep(Math.floor(j.x), Math.floor(j.z))) };
    // A little one's sting: poison, no heart.
    fresh();
    const hp0 = p.hp;
    await until(() => p.effects.poison > 0, 7000);
    out.jelly.smallSting = { poisoned: p.effects.poison > 0, hearts: hp0 - p.hp };
    clear();
  }

  // ---------- a crab ----------
  {
    fresh();
    p.place(C.x, C.z, g);
    const e = spawn('crab', C.x + 2.6, C.z);
    await until(() => e.state === 'chase', 3000);
    await wait(500);
    // (Squarely facing the knight: from where he stands, his blows go along +x... toward it.)
    const dx = (e.x - p.x) / Math.hypot(e.x - p.x, e.z - p.z), dz = (e.z - p.z) / Math.hypot(e.x - p.x, e.z - p.z);
    const facing = -(dx * e.fx + dz * e.fz);
    e.state = 'chase';
    const hp0 = e.hp;
    const front = e.takeHit(SWORD[0], dx, dz, 0, false, g);
    const frontLost = hp0 - e.hp;
    // From behind (it's still turned toward where he was).
    const behind = e.takeHit(SWORD[0], -dx, -dz, 0, false, g);
    const behindLost = +(hp0 - e.hp - frontLost).toFixed(2);
    e.hp = e.maxHp;
    e.state = 'chase';
    e.fx = -dx;
    e.fz = -dz;
    const heavy = e.takeHit(SWORD[2], dx, dz, 0, true, g);
    const flipped = e.state === 'stun';
    const hp1 = e.hp;
    e.takeHit(SWORD[0], dx, dz, 0, false, g);
    out.crab = { facing: +facing.toFixed(2), front, frontLost, behind, behindLost, heavy, flipped, flippedTook: +(hp1 - e.hp).toFixed(2) };
    // It turns slowly: a knight that steps behind it is faced only after a while.
    await until(() => e.state === 'chase', 4000);
    e.hp = e.maxHp;
    p.place(e.x - e.fx * 2, e.z - e.fz * 2, g);
    const t0 = g.time;
    await until(() => (p.x - e.x) * e.fx + (p.z - e.z) * e.fz > 0.8 * Math.hypot(p.x - e.x, p.z - e.z), 3000);
    out.crab.turnTime = +(g.time - t0).toFixed(2);
    // Its pinch: flashes first.
    fresh();
    const w = watch(e);
    await until(() => w.hits > 0, 8000);
    w.stop();
    out.crab.pinch = { hearts: w.hits, lead: w.leads[0], maimed: p.effects.maim > 0 };
    clear();
  }

  // ---------- an eel ----------
  {
    fresh();
    const den = { x: C.x + 2.6, z: C.z };
    p.place(C.x - 3, C.z, g);
    const e = spawn('eel', den.x, den.z);
    await wait(300);
    const hidden = e.takeHit(SWORD[0], 1, 0, 0, false, g);
    out.eel = { hidden, state: e.state, hiddenHp: e.hp === e.maxHp };
    p.place(C.x, C.z, g);
    // Stood on its line: bitten.
    const w = watch(e);
    await until(() => w.hits > 0, 5000);
    w.stop();
    out.eel.bite = { hearts: w.hits, lead: w.leads[0], reachedOut: +Math.hypot(e.x - den.x, e.z - den.z).toFixed(2) };
    // Out: a blow lands and it pulls back in.
    await until(() => e.state === 'recover', 1000);
    const hp0 = e.hp;
    const outRes = e.takeHit(SWORD[0], 1, 0, 0, false, g);
    // (It flinches a moment: a quick second blow lands too.)
    await wait(150);
    const second = e.takeHit(SWORD[1], 1, 0, 0, false, g);
    await until(() => e.state === 'hide', 1500);
    out.eel.out = { res: outRes, second, took: +(hp0 - e.hp).toFixed(2), backInDen: e.state === 'hide' && Math.hypot(e.x - den.x, e.z - den.z) < 0.3 };
    // Stepped off its line once it holds still: missed.
    fresh();
    await until(() => e.state === 'aim' && e.t >= 0.75 - 0.45 + 0.02, 6000);
    p.place(p.x, p.z + 1.6, g);
    await until(() => e.state === 'recover', 1500);
    await wait(200);
    out.eel.dodged = { hearts: p.maxHp - p.hp };
    clear();
  }

  // ---------- a pufferfish ----------
  {
    fresh();
    p.place(C.x, C.z, g);
    const e = spawn('puffer', C.x + 3.4, C.z);
    const w = watch(e);
    let swellAt = -1;
    let was = '';
    const sw = setInterval(() => {
      if (e.state === 'swell' && was !== 'swell') swellAt = g.time;
      was = e.state;
    }, 10);
    await until(() => w.hits > 0, 7000);
    w.stop();
    clearInterval(sw);
    out.puffer = { hearts: w.hits, lead: w.leads[0], swollenFor: +(g.time - swellAt).toFixed(2) };
    await until(() => e.state === 'puffed', 1000);
    const hp0 = e.hp, st0 = p.stamina;
    p.iframes = 0;
    e.takeHit(SWORD[0], 1, 0, 0, false, g);
    out.puffer.swollen = { took: +(hp0 - e.hp).toFixed(3), of: SWORD[0], pricked: p.stamina < st0, still: e.state };
    await until(() => e.state === 'recover' && e.t > 0.5, 4000);
    const hp1 = e.hp;
    e.takeHit(SWORD[0], 1, 0, 0, false, g);
    out.puffer.winded = { took: +(hp1 - e.hp).toFixed(3), state: e.state };
    // Struck early in its swell (still small): the swell stops, no spikes.
    e.hp = e.maxHp;
    await until(() => e.state === 'swell', 5000);
    await wait(150);
    e.takeHit(0.1, 1, 0, 0, false, g);
    out.puffer.early = { state: e.state };
    clear();
  }

  // ---------- a giant clam ----------
  {
    const { GiantClam } = await import('/src/game/seafoes.ts');
    fresh();
    const c = new GiantClam(C.x, C.z + 0.2, g);
    g.clams.push(c);
    p.place(C.x, C.z, g);
    const hp0 = p.hp;
    await wait(200);
    const ring = c.mark.visible;
    await until(() => p.hp < hp0, 3000);
    out.clam = { ringFirst: ring, hearts: hp0 - p.hp };
    // Out of it; once it's open again, a real swing at it takes its pearl.
    fresh();
    p.place(C.x - 1.6, C.z + 0.2, g);
    await until(() => c.phase === 'open', 4000);
    const coins0 = g.combat.pickups.filter((k) => k.kind === 'coin').length;
    p.fx = 1;
    p.fz = 0;
    p.aim.set(1, 0);
    g.input.press('attack');
    await wait(60);
    g.input.release('attack');
    await wait(500);
    out.clam.pearl = { taken: !c.pearl, coins: g.combat.pickups.filter((k) => k.kind === 'coin').length - coins0, shut: c.phase === 'shut', saved: !!g.save.data.flags[c.key] };
  }

  // ---------- every new kind's model is whole (a corner or normal that isn't a number blackens the screen) ----------
  {
    let bad = 0, n = 0;
    for (const [type, x] of [['diver', 80], ['diver', 80.3], ['diver', 80.6], ['harpooner', 82], ['jelly', 84], ['crab', 86], ['eel', 88], ['puffer', 90]]) {
      const e = spawn(type, x, C.z + 6);
      await wait(50);
      for (const m of e.model.rig.meshes)
        for (const a of ['position', 'normal']) {
          const arr = m.geometry.getAttribute(a).array;
          n += arr.length;
          for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) bad++;
        }
      e.despawn(g);
    }
    out.models = { values: n, bad };
  }

  const leadOk = (l) => l === undefined || l >= 0.25;
  out.ok = out.diver.dives && out.diver.floatOnSurface && out.diver.under && out.diver.hearts >= 1 && leadOk(out.diver.lead) && out.diver.blows === 3
    && out.harpooner.lineHeld && out.harpooner.dodgedHearts === 0 && out.harpooner.hooked.hooked && out.harpooner.hooked.hearts === 1 && leadOk(out.harpooner.hooked.lead)
    && out.harpooner.hooked.from - out.harpooner.hooked.to > 3 && out.harpooner.roll.hooked && out.harpooner.roll.freed && out.harpooner.roll.slack
    && out.jelly.hearts >= 1 && leadOk(out.jelly.lead) && out.jelly.lifted > 0.5 && out.jelly.split.n === 2 && out.jelly.split.inDeep && out.jelly.smallSting.poisoned && out.jelly.smallSting.hearts === 0
    && out.crab.front === 'blocked' && out.crab.frontLost === 0 && out.crab.behind === 'hit' && out.crab.behindLost > 0 && out.crab.heavy === 'hit' && out.crab.flipped && out.crab.flippedTook > SWORD[0] * 1.4
    && out.crab.turnTime > 0.6 && out.crab.pinch.hearts >= 1 && leadOk(out.crab.pinch.lead)
    && out.eel.hidden === 'blocked' && out.eel.hiddenHp && out.eel.bite.hearts === 1 && leadOk(out.eel.bite.lead) && out.eel.bite.reachedOut > 1.5 && out.eel.out.res === 'hit' && out.eel.out.second === 'hit' && out.eel.out.took > SWORD[0] + 0.1 && out.eel.out.backInDen && out.eel.dodged.hearts === 0
    && out.puffer.hearts === 1 && out.puffer.swollenFor >= 1.1 && out.puffer.swollen.took < SWORD[0] * 0.3 && out.puffer.swollen.pricked && out.puffer.winded.took >= SWORD[0] - 1e-6 && out.puffer.early.state === 'hurt'
    && out.models.values > 0 && out.models.bad === 0
    && out.clam.ringFirst && out.clam.hearts === 1 && out.clam.pearl.taken && out.clam.pearl.coins > 0 && out.clam.pearl.shut && out.clam.pearl.saved;
})();
