// Whisperwood's land (run with &realm=forest): the rope bridges (over Rookfall, to the Heart Oak's
// island) hold the knight all the way
// across, a step off the chasm's edge costs a heart and puts him back on firm ground, and
// the far bank of the brook can't be climbed.
const g = window.__game, p = g.player;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const hold = async (codes, ms) => {
  for (const c of codes) window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
  await wait(ms);
  for (const c of codes) window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
};
const out = {};
(async () => {
  // West across Rookfall (up + left on screen is world -x). Without god mode: falls cost hearts.
  p.place(100.3, 30, g);
  await wait(300);
  const hp0 = p.hp;
  let lowest = 99;
  const iv = setInterval(() => (lowest = Math.min(lowest, p.y)), 30);
  await hold(['KeyW', 'KeyA'], 3200);
  clearInterval(iv);
  out.chasmBridge = { endX: +p.x.toFixed(1), lowestY: +lowest.toFixed(2), hpLost: hp0 - p.hp, across: p.x < 88 && lowest > 1.5 };
  // Across the Heartpool's east bridge to the Heart Oak's island (screen up + left is world -x).
  // The bridge: its deck along rows 76 and 77, from the island's edge (west) to the shore (east).
  let west = 56;
  while (west < 80 && g.grid.deck[g.grid.i(west, 76)] <= -99) west++;
  let east = west;
  while (east < 80 && g.grid.deck[g.grid.i(east + 1, 76)] > -99) east++;
  p.place(east + 1.4, 77, g);
  await wait(300);
  let low2 = 99;
  const iv2 = setInterval(() => (low2 = Math.min(low2, p.y)), 30);
  await hold(['KeyW', 'KeyA'], 2600);
  clearInterval(iv2);
  out.villageBridge = { from: east + 1.4, island: west, endX: +p.x.toFixed(1), lowestY: +low2.toFixed(2), across: p.x < west - 0.5 && low2 > 1.9 };
  // Off the gorge's edge: a step back from its west lip where it's widest.
  let lip = 84;
  while (lip < 100 && g.grid.h[g.grid.i(lip + 1, 40)] > -3) lip++;
  p.place(lip - 0.6, 40.5, g);
  await wait(300);
  const hp1 = p.hp;
  await hold(['KeyD', 'KeyS'], 650); // right + down on screen: world +x, into the chasm
  await wait(1800);
  out.chasmFall = { hpLost: hp1 - p.hp, backOnGround: p.y > 1.5, at: [+p.x.toFixed(1), +p.z.toFixed(1)] };
  // The brook's far bank.
  p.place(60, 113.3, g);
  await wait(300);
  await hold(['KeyS', 'KeyA'], 1500); // down + left on screen: world +z, at the bank
  out.brookBank = { z: +p.z.toFixed(1), stayedNorth: p.z < 117.5 }; // the brook's middle runs at z 117.5 here
})();
window.__report = () => out;
