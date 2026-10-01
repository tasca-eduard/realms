// Whisperwood's folk (run with &realm=forest): prompts name each of them; Alder the Reeve moves
// the main quest on; the old owl gives one hint a talk, the next one each time; the thorn-smith
// sharpens a blunt sword and tempers a keen one past realm 1's top (levels 4 and 5, +25% each),
// then no further; the innkeeper sells flasks.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const key = async (code) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }));
  await wait(50);
  window.dispatchEvent(new KeyboardEvent('keyup', { code }));
  await wait(250);
};
const dlg = document.getElementById('dialog');
// Talk to someone: page through the lines; at the answers, wait a moment and take the first
// (buy) or leave with 'Not now' (the last).
const talk = async (id, buy = false) => {
  g.talkTo(g.npc(id));
  const said = [...g.ui.lines];
  for (let i = 0; i < 30 && g.ui.dialogOpen; i++) {
    await wait(120);
    if (dlg.querySelector('.opt')) {
      const opts = [...dlg.querySelectorAll('.opt')].map((o) => (o.hasAttribute('disabled') ? '(off) ' : '') + o.textContent);
      await wait(700);
      if (!buy) await key('ArrowUp'); // round to the last answer: 'Not now'
      await key('KeyE');
      return { said, opts };
    }
    await key('KeyE');
  }
  await wait(300);
  return { said };
};
(async () => {
  g.godMode = true;
  for (const e of g.enemies) if (e.alive) e.despawn(g);
  await wait(400);
  out.prompts = g.npcs.filter((n) => n.visible).map((n) => n.prompt());
  // The Reeve: the way to the Warden.
  const before = g.save.data.quests.main;
  await talk('reeve');
  await wait(300);
  out.reeve = { before, after: g.save.data.quests.main };
  // The owl: one line a talk, never the same twice running.
  const o1 = await talk('owl'), o2 = await talk('owl');
  out.owl = { first: o1.said, second: o2.said, oneEach: o1.said.length === 1 && o2.said.length === 1, differ: o1.said[0] !== o2.said[0] };
  // The thorn-smith: a blunt sword is sharpened, a keen one tempered, to level 5.
  p.coins = 2000;
  p.swordLevel = 0;
  const s0 = await talk('thornsmith', true);
  const sharpened = { level: p.swordLevel, coins: 2000 - p.coins, offer: s0.opts?.[0] };
  p.swordLevel = 3;
  const c3 = p.coins;
  const s3 = await talk('thornsmith', true);
  const d4 = p.damage;
  const s4 = await talk('thornsmith', true);
  const d5 = p.damage;
  const s5 = await talk('thornsmith', true);
  out.smith = { sharpened, temper4: { offer: s3.opts?.[0], level: 4, damage: +d4.toFixed(2) }, temper5: { offer: s4.opts?.[0], damage: +d5.toFixed(2) }, paid: c3 - p.coins, top: { level: p.swordLevel, offer: s5.opts?.[0] } };
  // The innkeeper's flasks.
  const inn = await talk('keeper2');
  out.inn = inn.opts;
  out.dialogClosed = !g.ui.dialogOpen;
})();
window.__report = () => out;
