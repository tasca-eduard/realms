// Whisperwood's hidden places (run with &realm=forest), each reached the way a player would: a
// running jump from Rookfall's rim onto the Rook Pillar; out along the Drowned Shrine's stepping
// stones (shallows between them) and onto its island; up the hunter's stand's
// ladder; along the rope walk over the Mirror Pool onto the giant's shelf; over the Whisper on
// the Fallen Giant; into the Bat Roost. Then every new chest opens and pays.
const g = window.__game, p = g.player, G = g.grid, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const down = (c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
const up = (c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
const hold = async (codes, ms) => {
  codes.forEach(down);
  await wait(ms);
  codes.forEach(up);
  await wait(250);
};
// Walk with keys held, jumping after `jumpAt` ms; report where he ends and the lowest he got.
const run = async (codes, ms, jumpAt = -1) => {
  let low = 99;
  const iv = setInterval(() => (low = Math.min(low, p.y)), 20);
  codes.forEach(down);
  if (jumpAt >= 0) setTimeout(() => { down('Space'); setTimeout(() => up('Space'), 120); }, jumpAt);
  await wait(ms);
  codes.forEach(up);
  await wait(400);
  clearInterval(iv);
  return { x: +p.x.toFixed(2), z: +p.z.toFixed(2), y: +p.y.toFixed(2), low: +low.toFixed(2) };
};
const at = async (x, z) => {
  p.place(x, z, g);
  g.cam.focus.set(p.x, p.y, p.z);
  await wait(450);
};
(async () => {
  g.godMode = true;
  for (const e of g.enemies) if (e.alive) e.despawn(g);
  // The Rook Pillar: a run at the rim (west, W + A), a jump just before the edge.
  // The east rim: walking west from the east woods, the last ground before the drop.
  let rim = 106;
  while (rim > 90 && G.h[G.i(rim - 1, 38)] > -5) rim--;
  await at(rim + 1.8, 38.5);
  const jump = await run(['KeyW', 'KeyA'], 800, 180);
  out.pillar = { rim, ...jump, onPillar: jump.x < rim - 2 && jump.x > rim - 4 && Math.abs(jump.y - 2) < 0.15 };
  // The Drowned Shrine: from the lane on the south shore, north (W + D) over the stones to the island.
  const stones = [];
  for (let z = 30; z < 46; z++) if (Math.abs(G.h[G.i(64, z)] - 1.8) < 0.01 && G.water[G.i(64, z)] < -99) stones.push(z);
  await at(64.95, 44.6);
  const wade = await run(['KeyW', 'KeyD'], 3000);
  out.shrine = { stones, ...wade, onIsland: Math.hypot(wade.x - 65, wade.z - 30) < 2.8 && Math.abs(wade.y - 2) < 0.15 };
  // The hunter's stand: up the ladder (hold jump against it, facing north).
  await at(86, 81.45);
  p.fx = 0;
  p.fz = -1;
  await hold(['Space'], 2000);
  out.stand = { y: +p.y.toFixed(2), onTop: Math.abs(p.y - 5.5) < 0.1 };
  // The rope walk: from the second giant's top south (S + A) over the pool to the shelf.
  await at(109, 65.6);
  const walk = await run(['KeyS', 'KeyA'], 3300);
  out.ropeWalk = { startY: 6, ...walk, onShelf: walk.z > 80.3 && Math.abs(walk.y - 6) < 0.1 && walk.low > 5.8 };
  // The Fallen Giant: from the north bank south along the trunk over the Whisper.
  await at(38, 43.2);
  const log = await run(['KeyS', 'KeyA'], 2900);
  out.log = { ...log, across: log.z > 55 && log.low > 1.9 }; // never down into the river (its bed is below 0)
  // The Bat Roost: north into the cleft.
  await at(110, 9.5);
  const roost = await run(['KeyW', 'KeyD'], 1500);
  out.roost = { ...roost, inside: roost.z < 4, area: g.region?.name ?? null };
  // Every new chest.
  const ids = ['wc_stand', 'wc_falls', 'wc_pillar', 'wc_roost', 'wc_log', 'wc_shrine', 'wc_grave', 'wc_dell', 'wc_kilns'];
  const c0 = p.coins;
  const powers = [];
  for (const id of ids) {
    const c = g.chests.find((k) => k.id === id);
    if (!c) continue;
    c.interact(g);
    if (c.power) powers.push(c.power);
  }
  await wait(600);
  out.chests = { found: ids.filter((id) => g.chests.some((k) => k.id === id)).length, of: ids.length, coins: p.coins - c0, powers };
})();
window.__report = () => out;
