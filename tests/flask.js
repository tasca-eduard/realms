// Flasks cure at full health and on horseback; a flask isn't wasted with nothing to fix;
// hearts wait on the ground until the knight is hurt.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const press = async (a) => { g.input.press(a); await wait(80); g.input.release(a); };
(async () => {
  p.place(80, 64, g);
  g.cam.focus.set(80, p.y, 64);
  await wait(300);
  // Full health, poisoned: the flask cures it.
  p.hp = p.maxHp;
  p.afflict('poison', g);
  let f0 = p.flasks;
  await press('heal');
  await wait(1100);
  out.poisonAtFull = { cured: p.effects.poison === 0, flaskUsed: f0 - p.flasks, hp: p.hp };
  // Full health, nothing wrong: no flask spent.
  f0 = p.flasks;
  await press('heal');
  await wait(900);
  out.nothingToFix = { state: p.state, flaskUsed: f0 - p.flasks };
  // On horseback, maimed at full health: cured.
  p.flasks = p.flasksMax;
  g.horse.arriveAt(p.x + 1.4, p.z, g);
  await wait(100);
  p.mount(g.horse, g);
  await wait(200);
  p.hp = p.maxHp;
  p.afflict('maim', g);
  f0 = p.flasks;
  await press('heal');
  await wait(300);
  out.riding = { riding: !!p.riding, cured: p.effects.maim === 0, flaskUsed: f0 - p.flasks };
  p.dismount(g);
  await wait(600);
  // A heart at full health stays put; hurt, and it comes to you.
  p.hp = p.maxHp;
  g.combat.spawnPickup('heart', p.x + 0.8, p.y + 0.5, p.z);
  await wait(1600);
  const left = g.combat.pickups.filter((k) => k.kind === 'heart').length;
  p.hp = p.maxHp - 1;
  const h = g.combat.pickups.find((k) => k.kind === 'heart');
  if (h) p.place(h.x + 0.5, h.z, g);
  await wait(1600);
  out.heart = { waitedAtFull: left, hpAfter: p.hp, maxHp: p.maxHp, gone: g.combat.pickups.filter((k) => k.kind === 'heart').length === 0 };
})();
window.__report = () => out;
