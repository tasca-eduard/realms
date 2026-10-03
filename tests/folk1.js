// Keepsfoot's folk (run with &realm=castle): about twenty people in the village, most of them doing something
// (a round, a seat, work, play); prompts name the new ones; walkers walk their rounds and sitters stay sat; a
// villager the knight walks past turns to him with a word (one at a time); their talk takes in the news (Tam
// home, the drawbridge down); the feast table comes out once Tam is home (diners seated, Tam at its head, the
// table solid), lanterns go up the north road once the drawbridge is down, everyone gathers in the square at
// dawn; Gnasher's camp is at its business before the fight (two goblins squat at dice, one at the drum, the boar
// turns on its spit) and up and fighting once they see the knight; on an older journey whose camp was cleared,
// the camp's three later goblins stay gone too.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const life = g.story.folk;
const r2 = (v) => Math.round(v * 100) / 100;
const inVillage = (n) => n.x > 56 && n.x < 101 && n.z > 44 && n.z < 84;
const busyOf = (n) => !!(n.def.roam?.length || n.def.pose);
const key = async (code) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }));
  await wait(50);
  window.dispatchEvent(new KeyboardEvent('keyup', { code }));
  await wait(250);
};
// Talk to someone and page through to the end.
const talk = async (id) => {
  g.talkTo(g.npc(id));
  const said = [...g.ui.lines];
  for (let i = 0; i < 30 && g.ui.dialogOpen; i++) await key('KeyE');
  await wait(300);
  return said;
};
window.__report = () => out;
(async () => {
  g.godMode = true;
  // (Gnasher's camp stays: the village checks don't go near it.)
  for (const e of g.enemies) if (e.alive && e.group !== 'camp') e.despawn(g);
  p.place(78, 62, g);
  await wait(600);
  const folk = g.npcs.filter((n) => n.visible && inVillage(n));
  out.people = { inVillage: folk.length, doing: folk.filter(busyOf).length, idle: folk.filter((n) => !busyOf(n)).map((n) => n.def.name) };
  out.prompts = g.npcs.filter((n) => n.def.id.startsWith('kf')).map((n) => n.prompt());
  // Going about their night: walkers have moved after a while, sitters sit where they were.
  const ids = ['kfwatch', 'kflamp', 'kfcarter', 'kfnell', 'kfaldous', 'kfdrinker', 'kfangler'];
  const at0 = Object.fromEntries(ids.map((id) => [id, [g.npc(id).x, g.npc(id).z]]));
  p.place(60, 90, g);
  await wait(9000);
  const moved = (id) => r2(Math.hypot(g.npc(id).x - at0[id][0], g.npc(id).z - at0[id][1]));
  out.night = Object.fromEntries(ids.map((id) => [id, moved(id)]));
  // Held things: the watch's lantern, the lamplighter's pole, Garrow's hammer hang on their right arms.
  out.held = ['kfwatch', 'kflamp', 'smith', 'kfmilitia', 'kfpriest', 'kfwater'].map((id) => `${id}:${g.npc(id).model.rig.j('armR').children.length}`);
  // A word as he passes: walk the knight past Old Aldous and Old Mabel on their bench.
  const al = g.npc('kfaldous');
  p.place(al.x + 3.4, al.z + 3, g);
  await wait(400);
  const bubble = document.getElementById('bubble');
  let said = null, who = null, faces = null;
  for (let k = 0; k < 45 && !said; k++) {
    p.place(al.x + 3.4 - k * 0.12, al.z + 2.6 - k * 0.09, g);
    await wait(60);
    const h = g.npcs.find((n) => n.heed > 0);
    if (h && bubble?.classList.contains('on')) {
      said = bubble.textContent;
      who = h.def.name;
      await wait(400);
      const dx = p.x - h.x, dz = p.z - h.z, d = Math.hypot(dx, dz);
      faces = r2((h.fx * dx + h.fz * dz) / d);
    }
  }
  // Standing still among them: nothing more said (only in passing, one at a time).
  await wait(3200);
  const t0 = bubble.textContent;
  await wait(4500);
  out.passing = { who, said, facesKnight: faces, stillSaysMore: bubble.classList.contains('on') && bubble.textContent !== t0 };
  // Talk: the news gets about.
  const before = await talk('kfmabel');
  // Tam home: the feast.
  g.save.data.flags.rescued = true;
  g.npc('brother').visible = false;
  g.npc('tamhome').visible = true;
  p.place(84, 66, g);
  await wait(500);
  const seats = ['kfaldous', 'kfmabel', 'kfdrinker', 'kfcarter'].map((id) => g.npc(id));
  const tam = g.npc('tamhome');
  const blocked = g.grid.colliders.some((c) => c.on && c.kind === 'b' && c.x0 < 77 && c.x1 > 77 && c.z0 < 60.8 && c.z1 > 60.8 && c.y1 < 3);
  out.feast = {
    table: life.feast?.visible ?? false,
    solid: blocked,
    seated: seats.map((n) => `${n.def.id}:${n.def.pose}@${r2(n.x)},${r2(n.z)}`),
    tam: `${r2(tam.x)},${r2(tam.z)}`,
  };
  // The drawbridge down: lanterns up the north road.
  g.save.data.flags.bridge = true;
  await wait(300);
  const after = await talk('kfmabel');
  out.news = { before: before.length, after: after.length, added: after.slice(before.length) };
  out.northRoad = { lanterns: life.lanterns?.visible ?? false, posts: g.grid.colliders.filter((c) => c.on && c.kind === 'c' && c.r === 0.1 && c.x > 83 && c.x < 91 && c.z > 32 && c.z < 58).length };
  // The Gnasher's camp at its business: approached unseen, the dicers squat, the drummer drums, the boar turns.
  p.place(86, 47, g);
  g.cam.focus.set(94, 2, 27);
  await wait(400);
  const biz = life.busy.map((b) => g.enemies.find((e) => e.spawnId === b.id));
  const rest = biz.map((e) => e.model.rig.rest.hips.p.y);
  const spin0 = life.boar.rotation.x;
  // (Look at them from close enough that they're updated, but out of their sight.)
  await wait(1500);
  out.camp = {
    foes: biz.map((e, k) => `${e.type}/${e.group}:${e.state}:hips ${r2(e.model.rig.j('hips').position.y / rest[k])}`),
    boarTurns: r2(life.boar.rotation.x - spin0),
    dice: life.dice.map((d) => d.visible),
  };
  // Seen, they're up and fighting.
  p.place(92.5, 31.5, g);
  await wait(2500);
  out.camp.seen = biz.map((e) => e.state);
  // An older journey whose camp was cleared: the later three stay gone too.
  const campIds = g.realm.enemies.map((e, i) => [e, i]).filter(([e]) => e.group === 'camp').map(([, i]) => i);
  const keep = g.save.data.killed;
  g.save.data.killed = campIds.filter((i) => !life.busy.some((b) => b.id === i));
  out.oldSave = { spawns: life.busy.map((b) => g.story.spawns(g, g.realm.enemies[b.id])) };
  g.save.data.killed = keep;
  // Dawn: everyone out in the square, round the well.
  p.place(60, 90, g);
  g.setDawn(1);
  await wait(500);
  const gathered = g.npcs.filter((n) => n.visible && Math.hypot(n.x - 79.5, n.z - 64.5) < 7.5);
  out.dawn = { inSquare: gathered.length, sample: gathered.slice(0, 6).map((n) => n.def.name) };
})();
