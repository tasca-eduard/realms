// Session 2: Continue from the title and check what came back.
const g = window.__game;
const log = {};
log.titleButtons = [...document.querySelectorAll('#title .btn')].map((b) => b.textContent);
document.querySelector('#title .btn').click();
setTimeout(() => {
  const p = g.player;
  log.state = g.state;
  log.pos = [p.x.toFixed(1), p.z.toFixed(1)];
  log.coins = p.coins;
  log.crypt = g.chests.find((c) => c.id === 'c_crypt').open;
  log.farmFoes = g.enemies.filter((e) => e.group === 'farm').length;
  log.quests = g.save.data.quests;
  log.fowSaved = g.save.data.fow.length > 0;
}, 1500);
window.__report = () => log;
