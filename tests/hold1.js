// The Warden's Hold (run with &realm=forest; tests/hold2.js runs after the reload): living thorns
// bar the gully at the top of the stair (walking at them gets nowhere); up the rock spire's vines,
// tearing out the Thorn Heart withers them (quest, saved); through the gully into the Warden's
// grove; the garrison falls and the thorns across the Great Tree's roots draw back; stepping in
// wakes the Warden and the thorns grow shut behind the knight.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const down = (c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
const up = (c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
const hold = async (codes, ms) => {
  codes.forEach(down);
  await wait(ms);
  codes.forEach(up);
  await wait(300);
};
const at = async (x, z) => {
  p.place(x, z, g);
  g.cam.focus.set(p.x, p.y, p.z);
  await wait(400);
};
(async () => {
  localStorage.removeItem('realms-save');
  g.godMode = true;
  for (const e of g.enemies) if (e.alive && e.group !== 'garrison' && e.group !== 'boss') e.despawn(g);
  const wall = g.thornWall, door = g.hallDoor, lv = g.lever;
  // West along the gully from the stair's top (screen up-left, W + A, is world -x).
  await at(32.6, 15);
  await hold(['KeyW', 'KeyA'], 1600);
  out.shut = { x: +p.x.toFixed(1), stopped: p.x > wall.x + 0.2, wallOpen: wall.open };
  // Up the spire's vines (its east face), facing west.
  await at(lv.x + 1.45, lv.z);
  p.fx = -1;
  p.fz = 0;
  await hold(['Space'], 3200);
  out.climb = { y: +p.y.toFixed(2), onTop: Math.abs(p.y - 7) < 0.1 };
  await at(lv.x + 0.6, lv.z + 0.4);
  await hold(['KeyE'], 80);
  await wait(4500);
  out.heart = { torn: lv.pulled, flag: !!g.save.data.flags.bridge, quest: g.save.data.quests.main, wallOpen: wall.open };
  // Through the gully.
  await at(32.6, 15);
  await hold(['KeyW', 'KeyA'], 1600);
  out.through = { x: +p.x.toFixed(1), past: p.x < wall.x - 1 && Math.abs(p.y - 5) < 0.2 };
  // The garrison.
  const before = door.open;
  for (const e of g.enemies) if (e.alive && e.group === 'garrison') e.die(g);
  await wait(5000); // the thorns draw back after 1.2 s, then the camera shows them for 3.2 s
  out.garrison = { before, after: door.open, flag: !!g.save.data.flags.garrison };
  // Into the arena from its mouth (north is screen up-right: W + D).
  await at(door.x, door.z + 1.6);
  await hold(['KeyW', 'KeyD'], 900);
  await wait(1500);
  out.arena = { z: +p.z.toFixed(1), bossActive: g.bossActive, shutBehind: !door.open, region: g.region?.name ?? null };
  g.writeSave();
  sessionStorage.setItem('test-hold', JSON.stringify(out));
  location.reload();
})();
window.__report = () => out;
