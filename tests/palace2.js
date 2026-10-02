// After tests/palace1.js and a reload: the bell stays rung and the floodgate up, the crew gone, the Tidelord
// asleep on his throne; then felled, and after another reload (tests/palace3.js) the dawn stays in his hall.
const g = window.__game, p = g.player;
const before = JSON.parse(sessionStorage.getItem('test-palace') ?? '{}');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { ...before };
out.reloaded = {
  bellRung: !!g.story.bell?.rung,
  gateOpen: !!g.hallDoor?.open,
  garrison: g.enemies.filter((e) => e.group === 'garrison' && e.alive).length,
  boss: g.boss?.alive ? g.boss.state : null,
  quest: g.quests.def('main').short[g.save.data.quests.main],
};
window.__report = () => out;
(async () => {
  // Felled, then saved.
  g.save.data.flags.costume = true;
  p.dives = true;
  g.godMode = true;
  p.place(130, 98, g);
  await wait(5200);
  out.reloaded.fight = g.bossActive;
  g.boss.hp = 1;
  g.boss.takeHit(4, 1, 0, 2, false, g);
  await wait(3500);
  out.reloaded.won = !g.boss.alive && !!g.save.data.flags.boss;
  g.writeSave();
  sessionStorage.setItem('test-palace', JSON.stringify(out));
  location.reload();
})();
