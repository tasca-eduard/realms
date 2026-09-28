// Economy: trial foes drop nothing and the win pays 90 once; a thief bat's loot isn't
// multiplied by the combo; arrows that hit the horse never maim the knight.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const coinValue = () => g.combat.pickups.filter((k) => k.kind === 'coin').reduce((s, k) => s + k.value, 0);
(async () => {
  g.godMode = true;
  // The trial: fight all three waves, counting coins dropped along the way.
  p.place(g.trial.x + 1.2, g.trial.z + 1.2, g);
  g.cam.focus.set(p.x, p.y, p.z);
  await wait(300);
  g.trial.interact(g);
  const coins0 = p.coins;
  let dropped = 0;
  for (let i = 0; i < 60 && g.trial.state !== 'won'; i++) {
    await wait(250);
    const before = coinValue();
    for (const e of g.enemies) if (e.alive && e.group === 'trial') e.takeHit(99, 1, 0, 1, true, g);
    await wait(50);
    dropped += coinValue() - before;
  }
  await wait(300);
  out.trial = { droppedByFoes: dropped, state: g.trial.state, paid: p.coins - coins0 };
  // A thief bat carrying 10 coins, killed on a x4 combo.
  const bat = g.enemies.find((e) => e.alive && e.type === 'bat');
  bat.thief = true;
  bat.loot = 10;
  bat.golden = false;
  bat.elite = false;
  g.comboCount = 15;
  const before = coinValue();
  bat.takeHit(99, 1, 0, 1, true, g);
  await wait(100);
  out.bat = { dropped: coinValue() - before, mult: 4, max: 2 * 4 + 10 };
  // Thirty arrows into the horse: none maims the knight.
  g.godMode = false;
  g.horse.arriveAt(p.x + 1.4, p.z, g);
  await wait(100);
  p.mount(g.horse, g);
  await wait(200);
  const archer = g.enemies.find((e) => e.type === 'archer');
  let maimed = 0;
  for (let i = 0; i < 30; i++) {
    g.horse.hp = 99;
    p.iframes = 0;
    g.arrowHitsPlayer({ x: p.x + 0.2, y: p.y + 1, z: p.z, vx: -1, vy: 0, vz: 0, from: archer, kind: 'arrow' });
    if (p.effects.maim > 0) maimed++;
    p.effects.maim = 0;
  }
  out.horseArrows = { riding: !!p.riding, maimed };
})();
window.__report = () => out;
