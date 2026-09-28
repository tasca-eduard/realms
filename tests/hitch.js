// The longest frame right after the first firepot, coin drop and sword swing of the session.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let worst = 0, last = 0, on = false;
const tick = (t) => { if (on && last) worst = Math.max(worst, t - last); last = t; requestAnimationFrame(tick); };
requestAnimationFrame(tick);
(async () => {
  g.godMode = true;
  await wait(1500);
  on = true; worst = 0;
  await wait(600);
  out.baseline = +worst.toFixed(1);
  worst = 0;
  const bomber = g.enemies.find((e) => e.type === 'bomber');
  g.combat.throwPot(bomber, p.x + 2, p.z, null);
  g.combat.coins(p.x + 1, p.y + 0.5, p.z, 3);
  g.combat.powerOrb(p.x - 1, p.y + 0.8, p.z);
  g.swoosh(p, 0);
  g.swoosh(p, 3);
  await wait(1500);
  out.firstUse = +worst.toFixed(1);
})();
window.__report = () => out;
