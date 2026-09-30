// Whisperwood's secrets (run with &realm=forest): the niche under the Overhang is sealed by its
// cracked rock (walking at it gets nowhere), a combo breaks it and the knight walks in to its
// chest; the chest on the vine ledge; the three Moon Shards give a heart and finish the quest.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const down = (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
const up = (code) => window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
// Screen up-right is world -z: walk north with W and D held.
const north = async (ms) => {
  down('KeyW');
  down('KeyD');
  await wait(ms);
  up('KeyW');
  up('KeyD');
  await wait(200);
};
const c = document.querySelector('#view canvas');
const strike = (x, y, z) => {
  const s = { x: 0, y: 0 };
  g.cam.toScreen({ clone: () => new g.cam.focus.constructor(x, y, z) }, s);
  c.dispatchEvent(new MouseEvent('mousemove', { clientX: s.x, clientY: s.y, bubbles: true }));
  c.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: s.x, clientY: s.y, bubbles: true }));
  setTimeout(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })), 40);
};
// Open a chest: with E if the knight stands at it, else directly.
const open = async (id, byKey = false) => {
  const ch = g.chests.find((k) => k.id === id);
  const c0 = p.coins;
  if (byKey) {
    down('KeyE');
    await wait(60);
    up('KeyE');
    await wait(300);
  }
  const opened = ch.open;
  if (!ch.open) ch.interact(g);
  await wait(500);
  return { byKey: byKey && opened, coins: p.coins - c0, power: ch.power ?? null };
};
(async () => {
  g.godMode = true;
  for (const e of g.enemies) if (e.alive) e.despawn(g);
  // The niche: sealed.
  const w = g.crackedWalls.find((k) => k.id === 'w_niche');
  p.place(w.x, w.z + 1.4, g);
  g.cam.focus.set(p.x, p.y, p.z);
  await wait(500);
  await north(1500);
  out.sealed = { z: +p.z.toFixed(2), stoppedAtRock: p.z > w.z + 0.2 };
  p.place(w.x, w.z + 1.2, g);
  await wait(300);
  for (let i = 0; i < 3; i++) {
    strike(w.x, w.y + 0.9, w.z);
    await wait(i < 2 ? 300 : 800);
  }
  out.broken = w.broken;
  await north(1400);
  const inside = g.grid.groundAt(p.x, p.z);
  out.walkedIn = { z: +p.z.toFixed(2), inside: p.z < w.z - 1, ground: inside, area: g.region?.name ?? null };
  await north(600);
  out.nicheChest = await open('wc_niche', true);
  // The chest on the vine ledge, and the shards.
  out.ledgeChest = await open('wc_ledge');
  const hp0 = p.maxHp;
  for (const s of g.shards) {
    p.place(s.x, s.z, g);
    await wait(700);
  }
  out.shards = { taken: g.save.data.shards, quest: g.save.data.quests.shards, hearts: [hp0, p.maxHp] };
})();
window.__report = () => out;
