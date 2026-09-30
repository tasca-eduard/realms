const g = window.__game;
g.player.place(110.2, 88.8, g);
const kd = (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
const ku = (code) => window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
setTimeout(() => kd('KeyE'), 300);
setTimeout(() => ku('KeyE'), 350);
// Clear each wave instantly to check the flow.
const log = [];
const iv = setInterval(() => {
  const t = g.trial;
  log.push(`${t.state}:${t.wave}`);
  if (t.state === 'wave') for (const e of g.enemies) if (e.group === 'trial' && e.alive) e.die(g);
}, 700);
window.__report = () => { clearInterval(iv); return { states: [...new Set(log)], relic: g.save.data.relics.includes('crest'), crest: g.player.crest, quest: g.save.data.quests.stones }; };
