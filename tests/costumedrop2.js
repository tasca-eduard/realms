// After tests/costumedrop1.js and a reload (a fresh page and game, the save loaded): the suit lies where
// Brassbelly fell, and walked onto, it's the knight's.
const g = window.__game, p = g.player;
const out = JSON.parse(sessionStorage.getItem('test-costumedrop') ?? '{}');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
window.__report = () => out;
(async () => {
  await wait(400);
  const i = g.realm.enemies.findIndex((s) => s.type === 'salvager'), home = g.realm.enemies[i];
  out.reloaded = { page: performance.getEntriesByType('navigation')[0]?.type, fresh: !window.__beforeReload, killed: g.save.data.killed.includes(i), salvager: g.enemies.some((e) => e.type === 'salvager' && e.alive), dives: p.dives };
  p.place(home.x + 2, home.z, g);
  await wait(300);
  p.place(home.x, home.z, g);
  await wait(500);
  out.taken = { dives: p.dives, costume: !!g.save.data.flags.costume };
  out.ok = !!out.felled?.dead && !out.felled.costume && !out.felled.dives && out.reloaded.page === 'reload' && out.reloaded.fresh
    && out.reloaded.killed && !out.reloaded.salvager && !out.reloaded.dives && out.taken.dives && out.taken.costume;
  localStorage.removeItem('realms-save');
})();
