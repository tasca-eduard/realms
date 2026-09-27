// The trial's waves spawn the new foes; the courtyard is down to eight.
const g = window.__game;
const log = { courtyard: g.enemies.filter((e) => e.group === 'courtyard').map((e) => e.type) };
g.godMode = true;
g.player.place(110.2, 88.8, g);
setTimeout(() => g.trial.interact(g), 300);
const seen = new Set();
const iv = setInterval(() => {
  for (const e of g.enemies) if (e.group === 'trial' && e.alive) seen.add(e.type);
  if (g.trial.state === 'wave') for (const e of g.enemies) if (e.group === 'trial' && e.alive) e.die(g);
}, 600);
window.__report = () => { clearInterval(iv); return { ...log, trialFoes: [...seen], trial: g.trial.state }; };
