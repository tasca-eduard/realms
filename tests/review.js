// Checks for the review fixes: saved kills, no loot from a reset trial, chandeliers re-hang.
const g = window.__game;
g.godMode = true;
const log = {};
// Saved kills.
const farm = g.enemies.filter((e) => e.group === 'farm');
for (const e of farm) e.die(g);
g['writeSave']();
const saved = JSON.parse(localStorage.getItem('realms-save')).killed;
log.killedSaved = farm.every((e) => saved.includes(e.spawnId));
setTimeout(() => {
  g['spawnEnemies']();
  log.farmAfterRespawn = g.enemies.filter((e) => e.group === 'farm').length;
  // Trial reset gives nothing.
  g.player.place(110.2, 88.8, g);
  g.trial.interact(g);
}, 1200);
setTimeout(() => {
  log.trialFoes = g.enemies.filter((e) => e.group === 'trial' && e.alive).length;
  const before = g.combat.pickups.length + g.combat.orbs.length;
  g.trial.reset(g);
  setTimeout(() => { log.lootFromReset = g.combat.pickups.length + g.combat.orbs.length - before; }, 300);
  // Chandelier re-hangs.
  g.chandeliers[0].drop(g);
}, 3200);
setTimeout(() => { log.chandelierBefore = g.chandeliers[0].state; g.chandeliers[0].reset(); log.chandelierAfter = g.chandeliers[0].state; }, 5000);
window.__report = () => log;
