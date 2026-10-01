// The stag's bed (run with &realm=forest): a mossy dell cut into the western heights behind the Stag's
// Thicket, through a cleft choked with living thorns. A sword only scratches them and the warhorse's
// charge can't break them; the freed Thornstag's thorn burst tears them away (saved), and the dell's
// chest and lore stone lie beyond.
const g = window.__game, p = g.player, out = {};
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
window.__report = () => out;
(async () => {
  g.godMode = true;
  for (const e of g.enemies) if (e.alive) e.despawn(g);
  const h = g.hedges.find((x) => x.id === 'w_bedthorns');
  const chest = g.chests.find((x) => x.id === 'wc_bed');
  out.place = { ground: +g.grid.groundAt(chest.x, chest.z).toFixed(2), region: g.realm.regions.find((r) => r.test(chest.x, chest.z, 2)).name, hedge: !!h };
  // On foot: the sword only scratches the thorns.
  p.place(h.x + 1.6, h.z, g);
  p.fx = -1;
  p.fz = 0;
  await wait(400);
  out.prompt = h.prompt(g);
  for (let i = 0; i < 3; i++) {
    await click(560, 400);
    await wait(450);
  }
  out.sword = { broken: h.broken };
  // Free the stag (its knots), ride it to the cleft, and burst.
  const b = g.bindings[0];
  p.place(b.x - 2.2, b.z, g);
  await wait(400);
  for (let i = 0; i < 3 && !b.freed; i++) {
    await click();
    await wait(700);
  }
  const stag = g.mounts.find((m) => m.kind === 'stag');
  if (!stag) return;
  stag.x = h.x + 1.8;
  stag.z = h.z;
  p.place(stag.x + 0.4, stag.z, g);
  await wait(200);
  p.mount(stag, g);
  await wait(400);
  out.riddenPrompt = h.prompt(g);
  await key('KeyF');
  await wait(900);
  out.burst = { broken: h.broken, saved: g.save.data.walls.includes('w_bedthorns') };
  // Through the cleft to the chest.
  p.dismount?.(g);
  await wait(300);
  p.place(chest.x + 1.2, chest.z + 0.4, g);
  await wait(500);
  out.atChest = { region: g.region?.name, y: +p.y.toFixed(2) };
  out.ok = out.place.ground === 2 && out.place.region === "The Stag's Bed" && !out.sword.broken && out.burst.broken && out.burst.saved;
})();
