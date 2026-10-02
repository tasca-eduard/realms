// The Sunken Reef's secrets (run with &realm=aqua): its three Moon Shards lie under the sea, out of reach
// without the diving suit and with no path to them (a coral bower in the gardens, the kelp's dark heart,
// the trench's floor); taken, they give one more heart. Its lore stones read.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
window.__report = () => out;
(async () => {
  g.godMode = true;
  for (const e of g.enemies) if (e.alive) e.despawn(g);
  const early = window.__reach(false).unreachable.map((u) => u.what);
  out.shards = g.shards.map((s) => ({ id: s.id, x: s.x, z: s.z, depth: +(-g.grid.groundAt(s.x, s.z)).toFixed(1), needsSuit: early.includes(`shard:${s.id}`) }));
  g.save.data.flags.costume = true;
  p.dives = true;
  const hearts0 = p.maxHp;
  for (const s of g.shards) {
    p.place(s.x, s.z + 0.2, g);
    g.cam.focus.set(p.x, p.y, p.z);
    await wait(900);
  }
  out.taken = g.shards.filter((s) => s.taken).length;
  out.hearts = { before: hearts0, after: p.maxHp };
  out.quest = g.save.data.quests.shards;
  out.lore = g.interactables.filter((it) => it.constructor.name === 'LoreStone').map((l) => l.id);
  out.ok = out.shards.length === 3 && out.shards.every((s) => s.needsSuit && s.depth >= 1.5) && out.taken === 3 && out.hearts.after === out.hearts.before + 1 && out.quest === 1
    && ['r3lore1', 'r3lore2', 'r3lore3', 'r3lore4'].every((id) => out.lore.includes(id));
})();
