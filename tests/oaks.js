// The Ring of Oaks (run with &realm=forest): the trial wakes at its altar, brings three waves
// with the Old Wood's own foes, and gives the Heartwood Seed (one more heart, filled at once)
// and 100 coins.
const g = window.__game, p = g.player, t = g.trial;
g.godMode = true;
p.place(t.x + 1.2, t.z + 1, g);
const kd = (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
const ku = (code) => window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
const before = { maxHp: p.maxHp, coins: p.coins };
p.hp = 2;
setTimeout(() => kd('KeyE'), 300);
setTimeout(() => ku('KeyE'), 350);
const log = [], types = new Set();
const iv = setInterval(() => {
  log.push(`${t.state}:${t.wave}`);
  if (t.state === 'wave')
    for (const e of g.enemies)
      if (e.group === 'trial' && e.alive) {
        types.add(e.type);
        e.die(g);
      }
}, 700);
window.__report = () => {
  clearInterval(iv);
  return {
    states: [...new Set(log)],
    foes: [...types],
    relic: g.save.data.relics.includes('heartwood'),
    hearts: { before: before.maxHp, after: p.maxHp, full: p.hp === p.maxHp },
    paid: p.coins - before.coins,
    quest: g.save.data.quests.oaks,
  };
};
