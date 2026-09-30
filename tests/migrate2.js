// Session 2 (after tests/migrate1.js wrote a version-1 save and reloaded): everything came back.
const g = window.__game, p = g.player;
const v1 = JSON.parse(sessionStorage.getItem('test-v1'));
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const out = {
  realm: g.def.id,
  carried: { coins: p.coins === 321, flasks: p.flasksMax === 5, sword: p.swordLevel === 2, crest: p.crest, hearts: p.maxHp === 5 },
  chests: same(g.chests.filter((c) => c.open).map((c) => c.id), v1.chests),
  lit: v1.lit.every((id) => g.moonfires.find((m) => m.id === id).lit),
  story: { bridgeDown: g.bridge.down, lever: g.lever.pulled, cageOpen: g.cage.open, tamHome: g.npc('tamhome').visible, tamCaged: g.npc('brother').visible, hallOpen: g.hallDoor.open, dawn: g.victory },
  felledStayGone: !g.enemies.some((e) => v1.killed.includes(e.spawnId)),
  courtyardGone: !g.enemies.some((e) => e.group === 'courtyard'),
  wallBroken: g.crackedWalls.find((w) => w.id === 'w_cave').broken,
  shardsTaken: g.shards.filter((s) => s.taken).map((s) => s.id),
  quests: JSON.stringify(g.save.data.quests) === JSON.stringify(v1.quests),
  fow: g.save.data.fow === v1.fow,
  atHearth: Math.hypot(p.x - 74.5, p.z - 54.6) < 0.5,
};
g.writeSave();
const s = JSON.parse(localStorage.getItem('realms-save'));
const c = s.realms.castle;
out.stored = {
  v: s.v,
  realm: s.realm,
  carried: s.coins === 321 && s.flasksMax === 5 && s.sword === 2 && s.deaths === 4 && s.playTime >= 1234 && s.kills === 57 && same(s.relics, ['crest']),
  // Every realm-1 field, under realms.castle (the fog of war was checked before this write: the knight has explored since).
  placeDiffers: ['chests', 'lit', 'read', 'walls', 'shards', 'killed'].filter((k) => !same(c[k], v1[k])).concat(c.checkpoint === 'hearth' ? [] : ['checkpoint'], JSON.stringify(c.quests) === JSON.stringify(v1.quests) ? [] : ['quests']),
  fowKept: c.fow.length === v1.fow.length,
  flags: c.flags,
  noLeftovers: !('relic' in s) && !('chests' in s) && !('bridge' in s),
};
window.__report = () => out;
