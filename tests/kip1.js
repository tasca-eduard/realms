// The pearl-diver's son (run with &realm=aqua; tests/kip2.js runs after the reload): Maren asks after Kip;
// on Gull Rock the crew guard his cage; three blows break it; Kip gives the pearls he hid and swims for
// home; Maren gives her best pearl. Then the page reloads.
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
  g.save.data.flags.costume = true;
  p.dives = true;
  await wait(300);
  // Maren, on the green by her house.
  g.talkTo(g.npc('maren'));
  await through();
  out.maren = { quest: g.save.data.quests.kip };
  // Gull Rock: its guards, the knight at the cage.
  const cage = g.cage;
  out.guards = g.enemies.filter((e) => e.alive && e.group === 'gull').map((e) => e.type);
  for (const e of g.enemies) if (e.alive && e.group === 'gull') e.despawn(g);
  p.place(cage.x - 1.5, cage.z - 0.3, g);
  g.cam.focus.set(p.x, p.y, p.z);
  await wait(700);
  const coins0 = p.coins;
  for (let i = 0; i < 3; i++) {
    strike(cage.x, cage.y + 0.9, cage.z);
    await wait(i < 2 ? 330 : 700);
  }
  out.cage = { open: cage.open, hp: cage.hp };
  await wait(900);
  out.kipTalks = g.ui.dialogOpen;
  await through();
  await wait(300);
  const kip = g.npc('kip');
  out.freed = { coins: p.coins - coins0, rescued: !!g.save.data.flags.rescued, quest: g.save.data.quests.kip, swimming: !!kip.walkTo };
  await wait(5200);
  out.home = { kipGone: !kip.visible, kipHome: g.npc('kiphome').visible, swamWest: kip.x < cage.x - 5 };
  const coins1 = p.coins;
  g.talkTo(g.npc('maren'));
  await through();
  await wait(300);
  out.thanks = { coins: p.coins - coins1, quest: g.save.data.quests.kip };
  g.writeSave();
  sessionStorage.setItem('test-kip', JSON.stringify(out));
  location.reload();
})();
window.__report = () => out;
