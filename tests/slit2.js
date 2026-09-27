const g = window.__game;
g.godMode = true;
g.player.place(51.8, 24.5, g);
const log = [];
const seen = new Map();
const iv = setInterval(() => {
  for (const a of g.combat.arrows) if (a.from === null) {
    if (!seen.has(a)) seen.set(a, [a.x, a.z]);
    const [x0, z0] = seen.get(a);
    a.__d = Math.hypot(a.x - x0, a.z - z0).toFixed(1) + (a.stuck > 0 ? ' stuck' : '');
  }
}, 30);
window.__report = () => { clearInterval(iv); return [...seen.keys()].map((a) => a.__d); };
