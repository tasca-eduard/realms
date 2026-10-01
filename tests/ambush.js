// The Old Grove's ambush (run with &realm=forest&god): three goblins lie hidden in bushes beside the road
// (unseen, can't be struck, don't block the way, don't stop a rest); one bursts out when the knight passes
// close and fights like any goblin; the others wait for him; nothing stirs for a knight in explore mode.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
window.__report = () => out;
(async () => {
  const lurk = g.enemies.filter((e) => e.ambush);
  out.hidden = lurk.map((e) => ({ state: e.state, alive: e.alive, shown: e.model.rig.root.visible, solid: e.solid }));
  out.unhittable = lurk[0] ? lurk[0].takeHit(5, 1, 0, 1, false, g) : 'none';
  // Explore mode: flying close by stirs nothing.
  g.setPaused(true);
  await wait(200);
  const tog = document.querySelector('#pause .tog[data-s="fly"]');
  tog.click();
  g.setPaused(false);
  await wait(300);
  const c = lurk[2];
  p.place(c.x + 1.5, c.z + 1, g);
  await wait(800);
  out.flying = { state: c.state };
  // (Land well away from the bushes.)
  p.place(lurk[0].x - 6, lurk[0].z - 4, g);
  await wait(300);
  g.setPaused(true);
  await wait(200);
  tog.click();
  g.setPaused(false);
  await wait(1200);
  // On foot past the first bush: out it comes.
  const a = lurk[0];
  p.place(a.x + 2.4, a.z + 1.2, g);
  await wait(600);
  out.burst = { state: a.state, alive: a.alive, shown: a.model.rig.root.visible, others: lurk.slice(1).map((e) => e.state) };
  const hp0 = a.hp;
  const res = a.takeHit(1, 1, 0, 1, false, g);
  out.struck = { res, lost: +(hp0 - a.hp).toFixed(2) };
  out.ok = lurk.length === 3 && out.hidden.every((h) => h.state === 'lurk' && !h.alive && !h.shown && !h.solid) && out.unhittable === 'blocked'
    && out.flying.state === 'lurk' && a.alive && out.burst.shown && out.burst.state !== 'lurk' && out.struck.res !== 'blocked' && out.burst.others.every((s) => s === 'lurk');
})();
