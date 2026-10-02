const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
window.__report = () => out;
(async () => {
  await wait(400);
  const i = g.realm.enemies.findIndex((s) => s.type === 'salvager'), home = g.realm.enemies[i];
  out.reloaded = { killed: g.save.data.killed.includes(i), salvager: g.enemies.some((e) => e.type === 'salvager' && e.alive), dives: p.dives };
  p.place(home.x + 2, home.z, g);
  await wait(300);
  p.place(home.x, home.z, g);
  await wait(500);
  out.taken = { dives: p.dives, costume: !!g.save.data.flags.costume };
  out.ok = out.reloaded.killed && !out.reloaded.salvager && !out.reloaded.dives && out.taken.dives && out.taken.costume;
})();
