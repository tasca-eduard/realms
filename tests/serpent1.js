// The Tide Serpent freed (run with &realm=aqua; tests/serpent2.js after a reload): the crew's nets hold it in
// the pool south of the sandbar, their three lines staked on the sand, its keepers round it. Coming near starts
// the quest; a blow that misses the stakes cuts nothing; a blow at each stake cuts its line; the third frees it
// (quest done, saved), and it swims over to the knight, who rides it (a real E press). It's a mount like the
// others: its name on the mount bar. Then the page reloads.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const c = document.querySelector('#view canvas');
// A click on the screen where a world point shows (the sword swings toward the mouse). The mouse goes there
// first and the view is let settle (after a jump across the map the camera is still catching up, more so on a
// slow frame rate, and the same spot on the screen would be somewhere else by the time of the click).
const clickAt = async (x, y, z) => {
  const v = p.rig.root.position.clone().set(x, y, z), s = { x: 0, y: 0 };
  g.cam.toScreen(v, s);
  c.dispatchEvent(new MouseEvent('mousemove', { clientX: s.x, clientY: s.y, bubbles: true }));
  await wait(700);
  g.cam.toScreen(v, s);
  c.dispatchEvent(new MouseEvent('mousemove', { clientX: s.x, clientY: s.y, bubbles: true }));
  await wait(60);
  c.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: s.x, clientY: s.y, bubbles: true }));
  await wait(80);
  window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
};
const key = async (code, ms = 60) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
  await wait(ms);
  window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
};
(async () => {
  g.godMode = true;
  const pen = g.story.serpent, def = g.realm.objects.find((o) => o.kind === 'nets');
  const keepers = g.enemies.filter((e) => e.group === 'serpent');
  out.prison = { nets: !!pen && !pen.freed, lines: pen.left, keepers: keepers.map((e) => e.type), mounts: g.mounts.length, quest: g.save.data.quests.serpent ?? null };
  // The keepers stay out of it (this checks the nets, not the fight).
  for (const e of keepers) e.despawn(g);
  // Up the sandbar toward the pool: the quest starts.
  p.place(70, 31, g);
  await wait(300);
  p.place(76, 32.4, g);
  await wait(400);
  out.quest = g.save.data.quests.serpent ?? null;
  // A swing away from the stakes (north, onto the bar) cuts nothing. (Clicked at the height the game aims at, the
  // knight's waist: a point on the sand shows on screen right beside him, and the swing could go any way.)
  await clickAt(p.x - 2, p.y + 0.9, p.z - 2);
  await wait(700);
  out.miss = pen.left;
  // One blow at each stake, from the sand beside it (not the pool's side).
  const cuts = [];
  for (const [sx, sz] of def.stakes) {
    const dx = sx - def.x, dz = sz - def.z, l = Math.hypot(dx, dz);
    p.place(sx + (dx / l) * 1.1, sz + (dz / l) * 1.1, g);
    await wait(350);
    await clickAt(sx, g.grid.groundAt(sx, sz) + 0.8, sz);
    await wait(700);
    cuts.push(pen.left);
  }
  const s = g.mounts.find((m) => m.kind === 'serpent');
  out.freed = { cuts, freed: pen.freed, quest: g.save.data.quests.serpent ?? null, saved: g.save.data.mounts.includes('serpent'), mount: !!s, interactable: g.interactables.includes(s) };
  if (!s) return;
  // It swims over to him; "Ride the Tide Serpent", and E puts him on its back.
  await wait(2500);
  out.comes = { dist: +Math.hypot(s.x - p.x, s.z - p.z).toFixed(2), prompt: s.prompt(g) };
  await key('KeyE');
  await wait(400);
  out.ride = { riding: p.riding === s, bar: g.ui.horseEl.textContent, hp: s.hp, maxHp: s.maxHp, y: +p.y.toFixed(2) };
  out.ok = out.prison.nets && out.prison.lines === 3 && out.prison.keepers.length >= 3 && out.prison.mounts === 0 && out.quest === 0 && out.miss === 3
    && cuts.join() === '2,1,0' && out.freed.freed && out.freed.quest === 1 && out.freed.saved && out.freed.interactable && out.comes.dist < 3 && !!out.comes.prompt && out.ride.riding && out.ride.bar === 'Tide Serpent';
  g.writeSave();
  sessionStorage.setItem('test-serpent', JSON.stringify(out));
  location.reload();
})();
window.__report = () => out;
