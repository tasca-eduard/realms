// Conversations by keyboard: E opens one, E (or Enter/Space) pages through it, and the
// press that ends it doesn't start it again or make the knight jump. Mashing through the
// smith's lines doesn't buy anything; a deliberate press does. The arrow keys walk.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const key = async (code) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }));
  await wait(50);
  window.dispatchEvent(new KeyboardEvent('keyup', { code }));
  await wait(250);
};
(async () => {
  g.godMode = true;
  await wait(400);
  let talks = 0;
  const talkTo = g.talkTo.bind(g);
  g.talkTo = (n) => { talks++; return talkTo(n); };
  const w = g.npc('warden');
  const run = async (code) => {
    p.place(w.x + 1.2, w.z + 0.4, g);
    await wait(400);
    talks = 0;
    await key('KeyE');
    const opened = g.ui.dialogOpen;
    let presses = 0;
    while (g.ui.dialogOpen && presses < 30) { await key(code); presses++; }
    await wait(300);
    return { opened, presses, talks, openAfter: g.ui.dialogOpen, jumped: p.state === 'jump' || !p.onGround };
  };
  out.byE = await run('KeyE');
  await wait(800);
  out.byEnter = await run('Enter');
  await wait(800);
  out.bySpace = await run('Space');
  // The smith: mash E through his lines (fast), then choose on purpose.
  await wait(800);
  const smith = g.npc('smith');
  p.coins = 200;
  const lvl = p.swordLevel;
  p.place(smith.x - 1.1, smith.z + 0.3, g);
  await wait(400);
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));
  for (let i = 0; i < 16; i++) {
    await wait(70);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    await wait(40);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' }));
  }
  const mashed = { coins: p.coins, level: p.swordLevel - lvl, open: g.ui.dialogOpen };
  await wait(900);
  await key('KeyE');
  out.smith = { mashed, chosen: { coins: p.coins, level: p.swordLevel - lvl, open: g.ui.dialogOpen } };
  // The same by taps: fast taps on the box (some landing on an answer as it appears) buy nothing.
  await wait(600);
  p.coins = 400;
  const lvl2 = p.swordLevel;
  await key('KeyE');
  const box = document.getElementById('dialog');
  const tapEl = (el) => el.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', bubbles: true }));
  for (let i = 0; i < 14; i++) {
    await wait(110);
    const opt = box.querySelector('.opt:not([disabled])');
    tapEl(opt ?? box);
  }
  const tapped = { coins: p.coins, level: p.swordLevel - lvl2, open: g.ui.dialogOpen };
  await wait(700);
  tapEl(box.querySelector('.opt:not([disabled])'));
  out.smithTaps = { tapped, chosen: { coins: p.coins, level: p.swordLevel - lvl2, open: g.ui.dialogOpen } };
  // Arrow keys move the knight like WASD.
  p.place(80, 63, g);
  await wait(300);
  const x0 = p.x, z0 = p.z;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }));
  await wait(500);
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft' }));
  out.arrowsWalk = +Math.hypot(p.x - x0, p.z - z0).toFixed(2);
})();
window.__report = () => out;
