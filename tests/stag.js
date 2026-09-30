// The Thornstag (run with &realm=forest): three blows cut the thorn knots and free it (quest,
// saved), then on its back: an antler gore hurts a foe in front, the thorn shield knocks an
// arrow out of the air, the thorn burst hurts foes all round, and it leaps higher with a
// second jump in the air.
const g = window.__game, p = g.player;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const c = document.querySelector('#view canvas');
const click = async (x = 740, y = 410) => {
  c.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
  c.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: x, clientY: y, bubbles: true }));
  await wait(80);
  window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
};
const key = async (code, ms = 60) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
  await wait(ms);
  window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
};
const out = {};
(async () => {
  g.godMode = true;
  // The stag's keepers stay out of it (this checks the stag, not the fight).
  for (const e of g.enemies) if (e.alive && e.group === 'stag') e.despawn(g);
  const b = g.bindings[0];
  // Stand west of the knots' ring (world -x) and swing east at it, three times.
  p.place(b.x - 2.2, b.z, g);
  await wait(400);
  for (let i = 0; i < 3 && !b.freed; i++) {
    await click();
    await wait(700);
  }
  const stag = g.mounts.find((m) => m.kind === 'stag');
  out.freed = { freed: b.freed, knotsLeft: b.left, quest: g.save.data.quests.stag ?? null, saved: g.save.data.mounts.includes('stag'), mount: !!stag };
  if (!stag) return;
  // Ride it.
  p.place(stag.x + 0.4, stag.z, g);
  await wait(200);
  p.mount(stag, g);
  await wait(300);
  out.riding = p.riding?.kind ?? null;
  // Two foes brought over: one in front for the gore, then both round us for the burst.
  const foes = g.enemies.filter((e) => e.alive && e.type === 'goblin').slice(0, 2);
  const put = (e, dx, dz) => {
    e.x = e.home.x = p.x + dx;
    e.z = e.home.z = p.z + dz;
    e.state = 'idle';
    e.hp = e.maxHp = 50;
  };
  p.fx = 1;
  p.fz = 0;
  put(foes[0], 1.5, 0);
  put(foes[1], -8, 8);
  await wait(100);
  const hpA = foes[0].hp;
  await click(760, 400);
  await wait(600);
  out.gore = { hurtInFront: hpA - foes[0].hp > 0 };
  // The shield against an arrow.
  const hp0 = p.hp;
  g.godMode = false;
  p.iframes = 0;
  window.dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true }));
  await wait(90);
  window.dispatchEvent(new MouseEvent('mouseup', { button: 2 }));
  await wait(60);
  g.combat.shootFrom(p.x + 6, p.y + 1, p.z, p.x, p.y + 1, p.z);
  await wait(700);
  out.shield = { state: p.rideState, arrowsLeft: g.combat.arrows.filter((a) => !a.dead && a.stuck <= 0).length, hpLost: hp0 - p.hp };
  g.godMode = true;
  await wait(500);
  // The burst: foes on two sides.
  put(foes[0], 1.8, 0.5);
  put(foes[1], -1.6, -1);
  p.energy = 100;
  const hb0 = foes[0].hp, hb1 = foes[1].hp;
  await key('KeyF');
  await wait(800);
  out.burst = { hitBoth: hb0 - foes[0].hp > 0 && hb1 - foes[1].hp > 0 };
  // Jumps: one leap, then a leap with a second jump at its top.
  for (const e of foes) e.despawn(g);
  await wait(400);
  const y0 = p.y;
  let top1 = 0;
  const t1 = setInterval(() => (top1 = Math.max(top1, p.y - y0)), 16);
  await key('Space');
  await wait(1100);
  clearInterval(t1);
  let top2 = 0;
  const t2 = setInterval(() => (top2 = Math.max(top2, p.y - y0)), 16);
  await key('Space');
  await wait(280);
  await key('Space');
  await wait(1200);
  clearInterval(t2);
  out.jump = { single: +top1.toFixed(2), double: +top2.toFixed(2), higher: top2 > top1 + 0.4 };
})();
window.__report = () => out;
