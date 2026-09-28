// Controls, menus and small fixes: pause menu from the keyboard, a stuck mouse button
// released, the cracked wall only answers blows aimed at it, dead archers' aim lines go,
// Tam walks home along the road.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const key = async (code) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }));
  await wait(60);
  window.dispatchEvent(new KeyboardEvent('keyup', { code }));
  await wait(60);
};
(async () => {
  g.godMode = true;
  await wait(300);
  // Pause menu: down selects Quit, up back to Resume, Enter resumes.
  g.setPaused(true);
  await wait(100);
  const sel = () => [...document.querySelectorAll('#pause .btns .btn')].findIndex((b) => b.classList.contains('sel'));
  const s0 = sel();
  await key('ArrowDown');
  const s1 = sel();
  await key('ArrowUp');
  await key('Enter');
  out.pauseMenu = { opened: s0, down: s1, resumedByEnter: !g.paused };
  out.deskKeys = [...document.querySelectorAll('#pause [data-keys]')].map((b) => b.textContent);
  out.controlsListed = [...document.querySelectorAll('#pause .keys')].filter((k) => getComputedStyle(k).display !== 'none').map((k) => k.className);
  // A held attack whose button came up outside the window is released on the next move.
  const cv = g.pipe.renderer.domElement;
  cv.dispatchEvent(new MouseEvent('mousedown', { button: 0, buttons: 1, bubbles: true }));
  await wait(50);
  const heldBefore = g.input.held('attack');
  cv.dispatchEvent(new MouseEvent('mousemove', { buttons: 0, clientX: 400, clientY: 300, bubbles: true }));
  await wait(50);
  out.stuckMouse = { heldBefore, heldAfterMove: g.input.held('attack') };
  // The cracked wall: a slash aimed away from it doesn't chip it; one aimed at it does.
  const w = g.crackedWalls[0];
  let chips = 0;
  const chip = w.chip.bind(w);
  w.chip = (...a) => { chips++; return chip(...a); };
  p.place(w.x, w.z + 1.3, g);
  p.fx = 0; p.fz = 1;
  p.strike(g, { cx: p.x, cz: p.z, reach: 1.8, arc: 0.3, dmg: 1, kb: 1, set: new Set() });
  const away = chips;
  p.fx = 0; p.fz = -1;
  p.strike(g, { cx: p.x, cz: p.z, reach: 1.8, arc: 0.3, dmg: 1, kb: 1, set: new Set() });
  out.crackedWall = { chipsFacingAway: away, chipsFacingIt: chips - away };
  w.chip = chip;
  // An archer takes aim, then dies: its aim line is removed.
  const archer = g.enemies.find((e) => e.alive && e.type === 'archer');
  g.combat.aim(archer);
  const lines0 = g.combat.aimLines.size;
  archer.takeHit(99, 1, 0, 1, true, g);
  await wait(200);
  out.aimLines = { whileAiming: lines0, afterDeath: g.combat.aimLines.has(archer) ? 'still there' : 'removed' };
  // Tam: break the cage, read his lines, and watch him walk the road out.
  p.place(g.cage.x - 1.5, g.cage.z, g);
  g.cam.focus.set(p.x, p.y, p.z);
  for (const e of g.enemies) if (e.alive && e.group === 'camp') e.despawn(g);
  await wait(300);
  g.cage.hp = 1;
  g.hitCage();
  await wait(900);
  for (let i = 0; i < 8; i++) { g.ui.dialogKey('ok'); await wait(80); }
  const tam = g.npc('brother');
  let nearest = 99;
  for (let i = 0; i < 26; i++) {
    await wait(300);
    if (!tam.visible) break;
    for (const [x, z, r] of [[95, 27, 0.6], [101.5, 31.5, 1.1], [89, 31, 1.1], [97.6, 29.4, 0.5]]) nearest = Math.min(nearest, Math.hypot(tam.x - x, tam.z - z) - r);
  }
  out.tam = { clearanceFromCampfireTentsDrum: +nearest.toFixed(2), gone: !tam.visible, home: g.npc('tamhome').visible };
})();
window.__report = () => out;
