const g = window.__game;
g.player.place(51.8, 24.5, g);
const log = [];
const iv = setInterval(() => { const s = g.slits[3]; log.push([+s.cd.toFixed(2), +s.aim.toFixed(2), g.combat.arrows.length]); }, 500);
window.__report = () => { clearInterval(iv); return log; };
