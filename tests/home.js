// A ranged foe chases, loses the knight, and walks home.
const g = window.__game;
const p = g.player;
g.godMode = true;
const log = {};
const b = g.enemies.find((e) => e.type === 'bomber' && e.group === 'farm');
p.place(b.x + 6, b.z - 4, g);
setTimeout(() => { log.chasing = b.state; p.place(40, 70, g); }, 2500);
setTimeout(() => { log.later = b.state; log.distFromHome = Math.hypot(b.x - b.home.x, b.z - b.home.z).toFixed(1); }, 11000);
window.__report = () => log;
