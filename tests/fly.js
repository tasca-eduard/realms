// Explore mode (run with &realm=forest): switched on from the pause menu, the knight flies over
// Rookfall Chasm (no fall, no heart lost); a goblin close by doesn't notice him; the mouse wheel
// zooms out; a click jumps him to the spot under the mouse; flying over the Overhang moves no
// quest on; a goblin already after him can't hurt him, and nothing is opened while he flies; switching
// another setting (screen shake) leaves him be, even in mid-air; switched off, he lands on open ground
// (and the place greets him) and the view zooms back in.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const down = (c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
const up = (c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
const hold = async (codes, ms) => {
  codes.forEach(down);
  await wait(ms);
  codes.forEach(up);
  await wait(250);
};
const canvas = document.querySelector('#view canvas');
(async () => {
  localStorage.removeItem('realms-settings');
  // On, from the pause menu's switch.
  g.setPaused(true);
  await wait(300);
  const tog = document.querySelector('#pause .tog[data-s="fly"]');
  tog.click();
  g.setPaused(false);
  await wait(400);
  out.switch = { label: tog.textContent, flying: g.flying };
  // Over Rookfall Chasm, west (W + A).
  p.place(101, 37, g);
  g.cam.focus.set(p.x, p.y, p.z);
  await wait(300);
  const hp0 = p.hp;
  let low = 99;
  const iv = setInterval(() => (low = Math.min(low, p.y)), 20);
  await hold(['KeyW', 'KeyA'], 1300);
  clearInterval(iv);
  out.chasm = { x: +p.x.toFixed(1), crossed: p.x < 87, lowest: +low.toFixed(1), hpLost: hp0 - p.hp };
  // Next to a goblin of the Old Grove: it stays put.
  const gob = g.enemies.find((e) => e.alive && e.type === 'goblin' && e.group === 'grove');
  p.place(gob.x + 2, gob.z + 1, g);
  g.cam.focus.set(p.x, p.y, p.z);
  await wait(2000);
  out.foe = { state: gob.state, noticed: gob.state === 'chase' || gob.state === 'alert' };
  // A goblin already after him when he takes off can't hurt him; nothing is opened while flying.
  g.setPaused(true);
  tog.click();
  g.setPaused(false);
  await wait(300);
  gob.set('chase');
  p.place(gob.x + 0.8, gob.z, g);
  g.setPaused(true);
  tog.click();
  g.setPaused(false);
  const hpF = p.hp;
  for (let k = 0; k < 12; k++) {
    p.place(gob.x + 0.8, gob.z, g);
    await wait(250);
  }
  const chest = g.chests.find((c) => !c.open);
  p.place(chest.x + 0.8, chest.z, g);
  await wait(400);
  down('KeyE');
  await wait(80);
  up('KeyE');
  await wait(300);
  out.safe = { hpLost: hpF - p.hp, prompt: document.querySelector('#prompt')?.textContent || null, chestOpened: chest.open };
  // Another setting switched (screen shake) leaves him where he is, even up in the air over the gorge.
  g.setPaused(true);
  tog.click();
  g.setPaused(false);
  await wait(300);
  p.place(90.5, 40.5, g);
  p.y = 6;
  p.vy = 0;
  const bx = p.x, bz = p.z;
  g.setPaused(true);
  document.querySelector('#pause .tog[data-s="shake"]').click();
  const moved = +Math.hypot(p.x - bx, p.z - bz).toFixed(2);
  document.querySelector('#pause .tog[data-s="shake"]').click();
  tog.click();
  g.setPaused(false);
  await wait(300);
  out.otherSetting = { moved, flying: g.flying };
  // Zoom out with the wheel.
  for (let k = 0; k < 4; k++) window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120 }));
  await wait(200);
  out.zoom = +g.cam.zoom.toFixed(2);
  // A click jumps to the spot under the mouse (up and right of the knight on screen).
  const x0 = p.x, z0 = p.z;
  canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 900, clientY: 200, bubbles: true }));
  await wait(150);
  const aim = g.mouseGround ? [g.mouseGround.x, g.mouseGround.z] : null;
  canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 900, clientY: 200, bubbles: true }));
  await wait(60);
  window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
  await wait(300);
  out.click = { moved: +Math.hypot(p.x - x0, p.z - z0).toFixed(1), onTarget: aim ? Math.hypot(p.x - aim[0], p.z - aim[1]) < 1.5 : false };
  // Over the Overhang: no quest moves on.
  const main0 = g.save.data.quests.main;
  p.place(41, 17, g);
  await wait(900);
  out.quest = { before: main0, after: g.save.data.quests.main, area: g.region?.name ?? null };
  // Off, over the Blackwater: lands on open ground.
  p.place(60, 30, g);
  await wait(300);
  g.setPaused(true);
  tog.click();
  g.setPaused(false);
  await wait(400);
  const i = g.grid.i(Math.floor(p.x), Math.floor(p.z));
  out.land = { flying: g.flying, zoom: g.cam.zoom, deep: g.grid.isDeep(Math.floor(p.x), Math.floor(p.z)), water: g.grid.water[i] > -99, at: [+p.x.toFixed(1), +p.z.toFixed(1)], region: g.region?.name ?? null };
  localStorage.removeItem('realms-settings');
})();
window.__report = () => out;
