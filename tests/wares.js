// Wares (run with &realm=forest): Old Sorrel the weaver sells silk-wrapped boots (faster on foot, two
// levels), Old Nettle a nettle tonic (the blue bar fills faster, three levels); a level is paid for,
// works at once, is saved with what the knight carries, and the top level can't be bought again. The
// thorn-smith's tempers now add +25% a level, as sharpening does.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const key = async (code) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }));
  await wait(50);
  window.dispatchEvent(new KeyboardEvent('keyup', { code }));
  await wait(250);
};
const dlg = document.getElementById('dialog');
// Talk to someone and take the answer at `pick` (0 = the first), or leave ('Not now', the last).
const talk = async (id, pick = -1) => {
  g.talkTo(g.npc(id));
  for (let i = 0; i < 30 && g.ui.dialogOpen; i++) {
    await wait(120);
    if (dlg.querySelector('.opt')) {
      const opts = [...dlg.querySelectorAll('.opt')].map((o) => (o.hasAttribute('disabled') ? '(off) ' : '') + o.textContent);
      await wait(600);
      if (pick < 0) await key('ArrowUp');
      else for (let k = 0; k < pick; k++) await key('ArrowDown');
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
  p.coins = 3000;
  const speed0 = p.footSpeed;
  const b1 = await talk('sorrel', 0), b2 = await talk('sorrel', 0), b3 = await talk('sorrel', 0);
  out.boots = { offers: [b1?.[0], b2?.[0], b3?.[0]], level: p.kit.boots, speed: +(p.footSpeed / speed0).toFixed(3) };
  // The tonic: the blue bar refills faster.
  const fill = async () => {
    p.energy = 0;
    await wait(1000);
    return p.energy;
  };
  const e0 = await fill();
  const t1 = await talk('herbwife', 0);
  const e1 = await fill();
  out.focus = { offer: t1?.[0], level: p.kit.focus, refill: +(e1 / Math.max(0.01, e0)).toFixed(2) };
  g.writeSave();
  out.saved = { ...g.save.data.kit };
  out.paid = 3000 - p.coins;
  p.swordLevel = 3;
  const d3 = p.damage;
  p.swordLevel = 5;
  out.temper = { level3: d3, level5: p.damage };
  out.ok = out.boots.level === 2 && out.boots.offers[2]?.startsWith('(off)') && Math.abs(out.boots.speed - 1.16) < 0.01 && out.focus.level === 1
    && out.focus.refill > 1.25 && out.saved.boots === 2 && out.saved.focus === 1 && out.paid === 80 + 200 + 90 && d3 === 1.75 && p.damage === 2.25;
})();
