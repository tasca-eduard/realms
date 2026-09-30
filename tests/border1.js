// The thorn road, part 1 (the Moonlit Keep): the hedge past the Old Lodge holds against the
// sword, a warhorse's charge breaks it (the Goblin King still alive), and the road beyond
// leads over to Whisperwood. Parts 2 and 3 (AFTER=tests/border2.js,tests/border3.js) follow.
const g = window.__game, p = g.player;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const press = async (code, ms = 60) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
  await wait(ms);
  window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
};
const log = { castle: {} };
(async () => {
  sessionStorage.removeItem('test-log');
  g.godMode = true;
  const h = g.hedges[0];
  const out = log.castle;
  out.kingAlive = !!g.boss?.alive;
  out.promptOnFoot = null;
  // On foot: swing at it.
  const side = h.alongX ? { x: 0, z: 1 } : { x: 1, z: 0 };
  p.place(h.x + side.x * 1.3, h.z + side.z * 1.3, g);
  p.fx = -side.x;
  p.fz = -side.z;
  await wait(400);
  out.promptOnFoot = g.ui.promptText?.() ?? h.prompt(g);
  for (let i = 0; i < 3; i++) {
    g.input.mouseX = window.innerWidth / 2;
    g.input.mouseY = window.innerHeight / 2 - 40;
    await press('KeyF'); // a dash strike: a heavy blow, still not enough for thorns
    await wait(700);
  }
  out.afterSword = h.broken ? 'broken' : 'holds';
  // On the warhorse: a charge.
  g.horse.arriveAt(h.x + side.x * 6, h.z + side.z * 6, g);
  p.place(h.x + side.x * 6.8, h.z + side.z * 6.8, g);
  await wait(300);
  p.mount(g.horse, g);
  await wait(300);
  p.fx = -side.x;
  p.fz = -side.z;
  p.energy = 100;
  out.riding = !!p.riding;
  await press('KeyF');
  await wait(1400);
  out.afterCharge = h.broken ? 'broken' : 'holds';
  out.saved = g.save.data.walls.includes(h.id);
  out.quest = g.save.data.quests.thorns ?? null;
  sessionStorage.setItem('test-log', JSON.stringify(log));
  // Down the thorn road to the border.
  p.dismount(g);
  const b = g.realm.borders.find((x) => x.to === 'forest');
  p.place(b.x, b.z, g);
})();
