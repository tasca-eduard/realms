// Session 1: make progress, then leave the tab (pagehide saves).
const g = window.__game;
const p = g.player;
g.godMode = true;
p.place(104.5, 99.8, g);
setTimeout(() => { const m = g.moonfires.find((x) => x.id === 'wayshrine'); g.rest(m); }, 500);
setTimeout(() => { p.coins = 123; g.chests.find((c) => c.id === 'c_crypt').interact(g); for (const e of g.enemies) if (e.group === 'farm') e.die(g); p.afflict; }, 1500);
setTimeout(() => { p.place(40, 70, g); }, 2500);
window.__report = () => ({ checkpoint: g.save.data.checkpoint, coins: p.coins, chests: g.save.data.chests, killed: g.save.data.killed.length });
