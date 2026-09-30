// The Thorn Warden (run with &realm=forest): stepping into the Great Tree wakes it; it keeps its
// distance and shoots: fanned volleys, arrows raining on marked spots, goblins called in; at half
// health it's enraged and roots burst under the knight; felled, the wood is free (quest, saved,
// dawn, the victory screen).
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  localStorage.removeItem('realms-save');
  // Not god mode (so hits count): hearts to spare instead.
  p.maxHp = p.hp = 99;
  for (const e of g.enemies) if (e.alive && e.group !== 'boss') e.despawn(g);
  g.hallDoor.setOpen(true, g, true);
  const b = g.boss;
  p.place(b.x + 1, b.z + 3.5, g); // inside the arena, between the Warden and its mouth
  g.cam.focus.set(p.x, p.y, p.z);
  const seen = new Set(), dist = [];
  let volleyArrows = 0, rain = 0, roots = 0, summoned = 0;
  const known = new Set();
  const iv = setInterval(() => {
    seen.add(b.state);
    if (b.alive) dist.push(Math.hypot(p.x - b.x, p.z - b.z));
    for (const a of g.combat.arrows) if (a.from === b && !known.has(a)) { known.add(a); volleyArrows++; }
    for (const m of g.wardenMarks) if (!known.has(m)) { known.add(m); m.kind === 'rain' ? rain++ : roots++; }
    summoned = Math.max(summoned, b.summoned.length);
  }, 50);
  await wait(4500); // past the intro (the camera on the Warden, then its name over the bar)
  out.started = { bossActive: g.bossActive, name: document.querySelector('#boss .bname')?.textContent ?? null };
  await wait(12000);
  const calm = { states: [...seen], volleyArrows, rain, roots, summoned, keptAway: +(dist.reduce((s, d) => s + d, 0) / dist.length).toFixed(1) };
  // Down to half: enraged.
  b.hp = b.maxHp * 0.55;
  b.takeHit(4, 1, 0, 2, false, g);
  const r0 = roots;
  await wait(12000);
  out.fight = { calm, enraged: b.enraged, rootsWhenEnraged: roots - r0, heartsLost: 99 - p.hp };
  // Felled.
  b.hp = 1;
  b.takeHit(4, 1, 0, 2, false, g);
  await wait(4500);
  out.end = { dead: !b.alive, victory: g.victory, flag: !!g.save.data.flags.boss, quest: g.save.data.quests.main, state: g.state, summonsLeft: b.summoned.filter((e) => e.alive).length };
  clearInterval(iv);
  localStorage.removeItem('realms-save');
})();
window.__report = () => out;
