const g = window.__game;
const log = [];
g.player.place(51.8, 24.5, g);
let slitArrows = 0;
const seen = new Set();
const iv = setInterval(() => { for (const a of g.combat.arrows) if (a.from === null && !seen.has(a)) { seen.add(a); slitArrows++; } }, 100);
setTimeout(() => {
  log.push(['slit arrows in 5s', slitArrows]);
  g.player.place(24, 18.5, g);
  g.player.hp = 5;
  g.player.iframes = 0;
  g.chandeliers[0].drop(g);
}, 5000);
setTimeout(() => log.push(['after chandelier', g.chandeliers[0].state, 'hp', g.player.hp]), 7000);
window.__report = () => { clearInterval(iv); return log; };
