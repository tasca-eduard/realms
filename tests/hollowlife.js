// Hollowbough lived in (run with &realm=forest): how many folk live in the village and how many are doing
// something (walking a round, or sitting, fishing, working, playing); the swing swings, the lamplighter and the
// foragers walk; the inn's room is a place the knight can walk into (reachable, its own region, its voices and lute
// on); the thorn-scarred trees go green once the Thorn Heart is torn out; the lanes' lanterns light and the
// garlands go up once the Warden falls; the news of it in the folk's words.
const g = window.__game, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  g.godMode = true;
  for (const e of g.enemies) if (e.alive) e.despawn(g);
  const regionAt = (x, z) => g.realm.regions.find((r) => r.test(x, z, g.grid.groundAt(x, z)))?.name;
  const life = g.story.life;
  const inn = g.realm.inn;
  // (The village and its edges: the lake, the homes round it, the inn's yard, the carver's by the road east.)
  const inVillage = (n) => n.def.x > 24 && n.def.x < 92 && n.def.z > 50 && n.def.z < 106;
  const folk = g.npcs.filter((n) => inVillage(n) && !n.def.hidden && !n.def.caged);
  out.village = { listed: g.npcs.length, people: folk.length, doing: folk.filter((n) => n.def.roam || n.def.pose).length, idle: folk.filter((n) => !n.def.roam && !n.def.pose).map((n) => n.def.id) };
  // What moves: the child on the swing, the lamplighter, the foragers.
  const at = (id) => { const n = g.npc(id); return n ? [n.x, n.y, n.z] : null; };
  const ids = ['clover', 'linden', 'fern', 'hob', 'sloe', 'midge'];
  const a = Object.fromEntries(ids.map((id) => [id, at(id)]));
  await wait(6000);
  out.moved = Object.fromEntries(ids.map((id) => { const b = at(id); return [id, a[id] && b ? +Math.hypot(b[0] - a[id][0], b[2] - a[id][2]).toFixed(2) : null]; }));
  // The inn's room: reachable from the road, its own region inside, its sound.
  const rep = window.__reach(true);
  const room = { door: [+inn.x.toFixed(1), +inn.z.toFixed(1)], region: inn.region, chatter: !!inn.chatter };
  const centre = (() => { const k = g.npc('keeper2'); return [k.def.x, k.def.z]; })();
  room.keeperIn = regionAt(centre[0], centre[1]) === inn.region;
  room.reachable = rep.reachable;
  room.traps = rep.trapCount;
  // Walk the knight in through the doorway (straight at the room's middle) and see where he ends up.
  // (inn.x, inn.z is the doorway; the room's structure knows its inside.)
  const box = g.structures.find((s) => s.name === 'inn' && s.interior).interior, mid = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
  const p = g.player, fx = inn.x + (inn.x - mid[0]) * 0.6, fz = inn.z + (inn.z - mid[1]) * 0.6;
  room.doorwayClear = g.grid.lineClear(fx, fz, mid[0], mid[1], g.grid.groundAt(fx, fz));
  p.x = fx; p.z = fz; p.y = g.grid.groundAt(fx, fz);
  await wait(300);
  for (let k = 0; k < 40; k++) { g.grid.move(p, (mid[0] - fx) / 40, (mid[1] - fz) / 40, 0.6); await wait(16); }
  await wait(600);
  room.walkedIn = { at: [+p.x.toFixed(2), +p.z.toFixed(2)], region: g.region?.name };
  out.inn = room;
  // The Thorn Heart torn out: the scarred trees green over a few seconds.
  const scars = () => life.scars.map((s) => +s.k.toFixed(2));
  out.scarred = { before: scars(), witheredShown: life.scars.filter((s) => s.withered.visible).length };
  g.save.data.flags.heart = true;
  await wait(4000);
  out.scarred.after = scars();
  out.scarred.greenShown = life.scars.filter((s) => s.green.visible).length;
  out.scarred.witheredAfter = life.scars.filter((s) => s.withered.visible).length;
  // The Warden fallen: the lanes light one after another, then the garlands.
  out.lanes = { lamps: life.lanes.length, litBefore: life.lanes.filter((l) => l.visible).length, lightsOn: life.laneLights.filter((l) => l.s.on).length };
  g.save.data.flags.boss = true;
  await wait(4000);
  out.lanes.litAfter = life.lanes.filter((l) => l.visible).length;
  out.lanes.lightsOnAfter = life.laneLights.filter((l) => l.s.on).length;
  out.lanes.garlands = life.garlands.visible;
  // The news: the lookout's words once the heart is out.
  g.talkTo(g.npc('kestrel'));
  out.news = { kestrel: [...g.ui.lines].slice(-1)[0] };
  for (let i = 0; i < 6 && g.ui.dialogOpen; i++) { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); await wait(50); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' })); await wait(200); }
  out.ok = out.village.people >= 32 && out.village.doing >= out.village.people - 7 && out.moved.clover > 0.3 && out.moved.linden > 0.3
    && room.keeperIn && room.walkedIn.region === inn.region && room.traps === 0
    && out.scarred.after.every((k) => k === 1) && out.scarred.witheredAfter === 0 && out.lanes.litAfter === out.lanes.lamps && out.lanes.garlands;
})();
window.__report = () => out;
