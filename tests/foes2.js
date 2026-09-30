// Whisperwood's foes and hazards in live encounters (run with &realm=forest): a spitter's seed
// costs a heart, a snarer's bola snares, a thornback pricks when struck unstunned (and not once
// stunned), the ravine's thorns burst once per cycle, a snare trap bites and holds, and a blow
// springs one safely. (Chance plays a part: a run can miss a hit.)
const g = window.__game, p = g.player;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};
const near = (type, x, z) => g.enemies.filter((e) => e.type === type && e.alive).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
const fresh = () => {
  p.hp = p.maxHp;
  p.stamina = p.maxStamina;
  p.cureAll();
  p.iframes = 0;
};
const quiet = (keep) => {
  // Everything but the foe under test holds still (far foes can't join in).
  for (const e of g.enemies) if (e !== keep && e.alive && Math.hypot(e.x - keep.x, e.z - keep.z) < 16) e.despawn(g);
};
(async () => {
  // A spitter.
  const sp = near('spitter', 71.5, 101.5);
  quiet(sp);
  fresh();
  p.place(sp.x + 5, sp.z + 1, g);
  const hp0 = p.hp;
  let seeds = 0;
  const count = setInterval(() => (seeds = Math.max(seeds, g.combat.arrows.filter((a) => a.kind === 'seed').length)), 50);
  await wait(5000);
  clearInterval(count);
  out.spitter = { seedsInAir: seeds, hpLost: hp0 - p.hp };
  // A snarer.
  const sn = near('snarer', 90.5, 107);
  quiet(sn);
  fresh();
  // Both on the open road through the grove, in plain sight of each other.
  sn.x = sn.home.x = 88;
  sn.z = sn.home.z = 101.4;
  p.place(81.5, 99.4, g);
  let snared = false, hud = [];
  const watch = setInterval(() => {
    if (p.effects.snare > 0 && !snared) {
      snared = true;
      setTimeout(() => (hud = [...document.querySelectorAll('#effects .fx')].map((f) => f.textContent)), 100);
    }
  }, 40);
  await wait(6000);
  clearInterval(watch);
  out.snarer = { snared, hud };
  // A thornback: strike it unstunned, then stunned.
  const tb = near('thornback', 97, 96);
  quiet(tb);
  fresh();
  p.place(tb.x - 1.2, tb.z, g);
  tb.state = 'idle';
  await wait(200);
  const st0 = p.stamina;
  tb.takeHit(0.1, 1, 0, 0, false, g);
  const prickedUnstunned = st0 - p.stamina;
  await wait(1000);
  fresh();
  tb.state = 'stun';
  tb.t = 0;
  const st1 = p.stamina;
  tb.takeHit(0.1, 1, 0, 0, false, g);
  out.thornback = { stunnedTook: 'stun', staminaLostUnstunned: Math.round(prickedUnstunned), staminaLostStunned: Math.round(st1 - p.stamina) };
  // The ravine's thorns: stand in a strip through exactly one burst (from the rustle to the end).
  for (const e of g.enemies) if (e.alive && Math.hypot(e.x - 72, e.z - 14) < 18) e.despawn(g);
  fresh();
  p.place(72, 14, g);
  const strip = g.thornBursts[0];
  while (strip.state !== 'warn') await wait(20);
  const hp2 = p.hp;
  while (strip.state !== 'low') await wait(20);
  out.ravine = { heartsInOneBurst: hp2 - p.hp };
  // A snare trap: step on one.
  fresh();
  const trap = g.snareTraps[0];
  p.place(trap.x + 0.2, trap.z, g);
  await wait(400);
  out.trap = { bit: !trap.armed, snared: p.effects.snare > 0, hp: p.maxHp - p.hp };
  // Another: spring it with a blow (nobody else about).
  fresh();
  const trap2 = g.snareTraps[1];
  for (const e of g.enemies) if (e.alive && Math.hypot(e.x - trap2.x, e.z - trap2.z) < 18) e.despawn(g);
  p.place(trap2.x - 1.1, trap2.z, g);
  p.fx = 1;
  p.fz = 0;
  await wait(1300); // over the last trap's bite
  // Aim down and right on screen (world +x, where the trap is) and swing.
  const c = document.querySelector('#view canvas');
  c.dispatchEvent(new MouseEvent('mousemove', { clientX: 740, clientY: 410, bubbles: true }));
  c.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 740, clientY: 410, bubbles: true }));
  await wait(90);
  window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
  await wait(500);
  out.spring = { sprung: !trap2.armed, hpLost: p.maxHp - p.hp };
})();
window.__report = () => out;
