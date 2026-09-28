// Session 1: open a chest (coins count at once and are saved), fell a foe (the count is saved).
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  g.godMode = true;
  const c = g.chests.find((k) => !k.open && k.id === 'c_crypt');
  p.place(c.x, c.z + 1.1, g);
  await wait(300);
  const before = p.coins;
  c.interact(g);
  out.coinsAtOnce = p.coins - before;
  out.savedCoins = JSON.parse(localStorage.getItem('realms-save')).coins;
  const e = g.enemies.find((x) => x.alive);
  const k0 = g.save.data.kills;
  e.takeHit(99, 1, 0, 1, true, g);
  out.killCounted = g.save.data.kills - k0;
  await wait(4000);
  out.coinsAfterFlyIn = p.coins - before;
  out.homingLeft = g.combat.pickups.filter((k) => k.home).length;
})();
window.__report = () => out;
