const g = window.__game;
const p = g.player;
const log = {};
p.coins = 50;
const bat = g.enemies.find((e) => e.type === 'bat');
bat.thief = true;
p.place(bat.home.x + 3, bat.home.z + 1, g);
const hp0 = p.hp;
const iv = setInterval(() => {
  if (bat.state === 'flee' && !log.stole) {
    log.stole = 50 - p.coins;
    log.hpLost = hp0 - p.hp;
    log.loot = bat.loot;
    setTimeout(() => { bat.takeHit(5, 1, 0, 2, false, g); }, 300);
    setTimeout(() => { log.coinsDropped = g.combat.pickups.filter((k) => k.kind === 'coin').reduce((s, k) => s + k.value, 0); clearInterval(iv); }, 700);
  }
}, 50);
window.__report = () => log;
