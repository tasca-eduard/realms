// Crossing between realms, part 1 (the Moonlit Keep): make some progress, then cross to
// Whisperwood. Parts 2 and 3 (runner: AFTER=tests/travel2.js,tests/travel3.js) follow the reloads.
const g = window.__game;
sessionStorage.removeItem('test-log');
g.godMode = true;
g.player.coins = 77;
const c = g.chests.find((k) => k.id === 'c_crypt');
g.player.place(c.x, c.z + 1.1, g);
setTimeout(() => {
  c.interact(g);
  sessionStorage.setItem('test-log', JSON.stringify({ castle: { realm: g.def.id, coinsBefore: g.player.coins } }));
  // No border in realm 1 yet (group 12): cross the way a border would.
  g.travel({ id: 'test', to: 'forest', arrive: 'thornroad', x: 0, z: 0, r: 0, out: { x: 0, z: 0, fx: 0, fz: 0 }, card: ['Blackpine', 'The Old Wood'] });
}, 400);
