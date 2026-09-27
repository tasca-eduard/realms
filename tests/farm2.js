const g = window.__game;
const p = g.player;
p.place(86, 112.5, g);
const log = [];
const iv = setInterval(() => { p.hp = 5; const b = g.enemies.filter((e) => e.type === 'bomber' && e.group === 'farm'); log.push(b.map((e) => e.state).join('/') + ' fires:' + g.combat.fires.length + (p.effects.burn > 0 ? ' BURN' : '')); }, 700);
window.__report = () => { clearInterval(iv); return log; };
