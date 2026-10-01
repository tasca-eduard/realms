// Barding (the Moonlit Keep): Garrow the smith sells it beside his sharpening; each piece is one more
// hit the warhorse (and any freed mount) can take; two pieces, then no more.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const key = async (code) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }));
  await wait(50);
  window.dispatchEvent(new KeyboardEvent('keyup', { code }));
  await wait(250);
};
const dlg = document.getElementById('dialog');
const talk = async (id, pick) => {
  g.talkTo(g.npc(id));
  for (let i = 0; i < 30 && g.ui.dialogOpen; i++) {
    await wait(120);
    if (dlg.querySelector('.opt')) {
      const opts = [...dlg.querySelectorAll('.opt')].map((o) => (o.hasAttribute('disabled') ? '(off) ' : '') + o.textContent);
      await wait(600);
      for (let k = 0; k < pick; k++) await key('ArrowDown');
      await key('KeyE');
      await wait(300);
      return opts;
    }
    await key('KeyE');
  }
  await wait(300);
  return null;
};
window.__report = () => out;
(async () => {
  g.godMode = true;
  for (const e of g.enemies) if (e.alive) e.despawn(g);
  await wait(400);
  p.coins = 1000;
  const pips0 = g.horse.maxHp;
  const a = await talk('smith', 1), b = await talk('smith', 1), c = await talk('smith', 1);
  out.offers = [a, b, c];
  out.horse = { before: pips0, after: g.horse.maxHp, kit: p.kit.barding };
  out.paid = 1000 - p.coins;
  out.ok = pips0 === 3 && g.horse.maxHp === 5 && out.paid === 300 && !!c && c[1].startsWith('(off)');
})();
