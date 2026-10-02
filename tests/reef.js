// The coral village's folk (run with &realm=aqua): prompts name them; the walkers walk their rounds and the
// sitters sit; the harbourmaster's word changes once the knight has the salvager's suit; the tide-reader gives
// one hint a talk, the next each time; the coral-smith sharpens a blunt sword and sets a coral edge on a
// tempered one (levels 6 and 7, +25% each, 640 and 720) and no further; the innkeeper sells flasks; the old
// diver's air bladder (two levels, +30 s of air each) and the beachcomber's lodestone (two levels: loose coins
// come from 50% further off a level) are paid for, work at once and are saved.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const key = async (code) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }));
  await wait(50);
  window.dispatchEvent(new KeyboardEvent('keyup', { code }));
  await wait(250);
};
const dlg = document.getElementById('dialog');
// Talk to someone: page through the lines; at the answers take the one at `pick` (0 = the first), or leave
// ('Not now', the last).
const talk = async (id, pick = -1) => {
  g.talkTo(g.npc(id));
  const said = [...g.ui.lines];
  for (let i = 0; i < 30 && g.ui.dialogOpen; i++) {
    await wait(120);
    if (dlg.querySelector('.opt')) {
      const opts = [...dlg.querySelectorAll('.opt')].map((o) => (o.hasAttribute('disabled') ? '(off) ' : '') + o.textContent);
      await wait(600);
      if (pick < 0) await key('ArrowUp');
      else for (let k = 0; k < pick; k++) await key('ArrowDown');
      await key('KeyE');
      await wait(300);
      return { said, opts };
    }
    await key('KeyE');
  }
  await wait(300);
  return { said };
};
window.__report = () => out;
(async () => {
  g.godMode = true;
  for (const e of g.enemies) if (e.alive) e.despawn(g);
  p.place(37, 66, g);
  await wait(400);
  out.prompts = g.npcs.filter((n) => n.visible).map((n) => n.prompt());
  // Going about their day: walkers have moved after a while, sitters sit where they were.
  const at0 = Object.fromEntries(g.npcs.map((n) => [n.def.id, [n.x, n.z]]));
  await wait(9000);
  const moved = (id) => Math.hypot(g.npc(id).x - at0[id][0], g.npc(id).z - at0[id][1]);
  out.day = { shrimp: +moved('shrimp').toFixed(1), ling: +moved('ling').toFixed(1), flotsam: +moved('flotsam').toFixed(1), tally: +moved('tally').toFixed(1), hake: +moved('hake').toFixed(1) };
  // The harbourmaster, before and after the suit.
  g.save.data.flags.costume = false;
  const h0 = await talk('gannet');
  g.save.data.flags.costume = true;
  p.dives = true;
  const h1 = await talk('gannet');
  out.gannet = { before: h0.said.at(-1), after: h1.said.at(-1) };
  // The tide-reader: one line a talk, never the same twice running.
  const t1 = await talk('tally'), t2 = await talk('tally');
  out.tally = { first: t1.said, second: t2.said, oneEach: t1.said.length === 1 && t2.said.length === 1, differ: t1.said[0] !== t2.said[0] };
  // The coral-smith: a blunt sword sharpened; a tempered one (level 5) given a coral edge, twice, then no more.
  p.coins = 4000;
  p.swordLevel = 0;
  const s0 = await talk('shale', 0);
  const sharpened = { level: p.swordLevel, paid: 4000 - p.coins, offer: s0.opts?.[0] };
  p.swordLevel = 5;
  const c5 = p.coins, d5 = p.damage;
  const s5 = await talk('shale', 0);
  const d6 = p.damage, paid6 = c5 - p.coins;
  const s6 = await talk('shale', 0);
  const d7 = p.damage, paid7 = c5 - p.coins - paid6;
  const s7 = await talk('shale', 0);
  out.smith = { sharpened, edge6: { offer: s5.opts?.[0], damage: d6, paid: paid6 }, edge7: { offer: s6.opts?.[0], damage: d7, paid: paid7 }, top: { level: p.swordLevel, offer: s7.opts?.[0] }, damage5: d5 };
  // The innkeeper's flasks.
  out.inn = (await talk('dulse')).opts;
  // The old diver's air bladder: more air for each.
  const a0 = p.airMax, coinsB = p.coins;
  const b1 = await talk('hake', 0), b2 = await talk('hake', 0), b3 = await talk('hake', 0);
  out.bladder = { offers: [b1.opts?.[0], b2.opts?.[0], b3.opts?.[0]], level: p.kit.bladder, air: [a0, p.airMax], paid: coinsB - p.coins };
  // The beachcomber's lodestone: a coin lying 4.2 m off stays put without it and comes to the knight with it.
  const coinAt = async () => {
    p.place(37, 66, g);
    await wait(200);
    const k = g.combat.spawnPickup('coin', 37 + 4.2, g.grid.groundAt(41.2, 66) + 0.2, 66, 1);
    k.vx = k.vz = 0;
    k.vy = 0;
    await wait(1600);
    const got = k.dead;
    if (!k.dead) {
      k.dead = true;
      g.scene.remove(k.sprite.mesh);
    }
    return got;
  };
  const without = await coinAt();
  const coinsL = p.coins;
  const l1 = await talk('flotsam', 0);
  const paidL1 = coinsL - p.coins;
  const with1 = await coinAt();
  const coinsL2 = p.coins;
  const l2 = await talk('flotsam', 0), l3 = await talk('flotsam', 0);
  out.lodestone = { offers: [l1.opts?.[0], l2.opts?.[0], l3.opts?.[0]], level: p.kit.lodestone, coinWithout: without, coinWith: with1, paid: paidL1 + coinsL2 - p.coins };
  g.writeSave();
  out.saved = { ...g.save.data.kit };
  out.dialogClosed = !g.ui.dialogOpen;
  out.ok = out.prompts.length >= 9 && out.day.shrimp > 1 && out.day.ling > 1 && out.day.flotsam > 1 && out.day.tally < 0.01 && out.day.hake < 0.01
    && out.gannet.before !== out.gannet.after && out.tally.oneEach && out.tally.differ
    && sharpened.level === 1 && sharpened.paid === 80 && /Sharpen/.test(sharpened.offer)
    && /coral edge/.test(s5.opts?.[0] ?? '') && d6 === 2.5 && paid6 === 640 && d7 === 2.75 && paid7 === 720 && p.swordLevel === 7 && /as fine as it gets/.test(s7.opts?.[0] ?? '')
    && out.inn?.some((o) => /Moon Flask/.test(o))
    && out.bladder.level === 2 && out.bladder.air[0] === 90 && out.bladder.air[1] === 150 && out.bladder.paid === 270 && out.bladder.offers[2]?.startsWith('(off)')
    && out.lodestone.level === 2 && !without && with1 && out.lodestone.paid === 200 && out.lodestone.offers[2]?.startsWith('(off)')
    && out.saved.bladder === 2 && out.saved.lodestone === 2 && out.dialogClosed;
})();
