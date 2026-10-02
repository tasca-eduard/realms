// Brassbelly felled, his suit left lying (part 1; tests/costumedrop2.js runs after the reload): it's still there
// where he stood, and walked onto, it's the knight's. Then the page reloads.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
window.__report = () => out;
(async () => {
  await wait(400);
  const s = g.enemies.find((e) => e.type === 'salvager');
  g.godMode = true;
  s.takeHit(s.hp + 1, 1, 0, 0, true, g);
  await wait(500);
  g.writeSave();
  out.felled = { dead: s.state === 'dead', costume: !!g.save.data.flags.costume, dives: p.dives };
  // (A mark on this page that the reloaded one won't have; not ready until the reloaded game is.)
  window.__beforeReload = true;
  window.__ready = false;
  sessionStorage.setItem('test-costumedrop', JSON.stringify(out));
  location.reload();
})();
