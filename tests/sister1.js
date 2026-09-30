// The sister past the river (run with &realm=forest; tests/sister2.js runs after the reload):
// Ash asks after Wren; three blows break the goblins' cage; Wren gives the traveller's purse
// and runs home along the Blackwater lane; Ash gives his savings. Then the page reloads.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const key = async (code) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }));
  await wait(50);
  window.dispatchEvent(new KeyboardEvent('keyup', { code }));
  await wait(250);
};
const through = async () => {
  for (let i = 0; i < 30 && g.ui.dialogOpen; i++) await key('KeyE');
};
const c = document.querySelector('#view canvas');
const strike = (x, y, z) => {
  const s = { x: 0, y: 0 };
  g.cam.toScreen({ clone: () => new g.cam.focus.constructor(x, y, z) }, s);
  c.dispatchEvent(new MouseEvent('mousemove', { clientX: s.x, clientY: s.y, bubbles: true }));
  c.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: s.x, clientY: s.y, bubbles: true }));
  setTimeout(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })), 40);
};
(async () => {
  localStorage.removeItem('realms-save');
  g.godMode = true;
  await wait(300);
  // Ash, on the south-west knoll.
  g.talkTo(g.npc('ash'));
  await through();
  out.ash = { quest: g.save.data.quests.sister };
  // The clearing: its guards gone, the knight at the cage.
  for (const e of g.enemies) if (e.alive && Math.hypot(e.x - 46, e.z - 43) < 12) e.die(g);
  const cage = g.cage;
  p.place(cage.x + 0.3, cage.z + 1.3, g);
  g.cam.focus.set(p.x, p.y, p.z);
  await wait(600);
  const coins0 = p.coins;
  for (let i = 0; i < 3; i++) {
    strike(cage.x, cage.y + 0.9, cage.z);
    await wait(i < 2 ? 330 : 700);
  }
  out.cage = { open: cage.open, hp: cage.hp };
  await wait(900);
  out.wrenTalks = g.ui.dialogOpen;
  await through();
  await wait(300);
  const wren = g.npc('wren');
  out.freed = { coins: p.coins - coins0, rescued: !!g.save.data.flags.rescued, quest: g.save.data.quests.sister, walking: !!wren.walkTo };
  await wait(5600);
  out.home = { wrenGone: !wren.visible, wrenHome: g.npc('wrenhome').visible, wrenWentEast: wren.x > 50 };
  const coins1 = p.coins;
  g.talkTo(g.npc('ash'));
  await through();
  await wait(300);
  out.thanks = { coins: p.coins - coins1, quest: g.save.data.quests.sister };
  g.writeSave();
  sessionStorage.setItem('test-sister', JSON.stringify(out));
  location.reload();
})();
window.__report = () => out;
