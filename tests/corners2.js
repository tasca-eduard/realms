// Whisperwood's once-empty corners (run with &realm=forest): the Warden's Seat (its lore stone, its
// chest, a thornback minding it), the Rookery (the rooks' hoard, a lore stone, bats for rooks), the
// goblins' camp by the brook (its chest, two goblins), the kingfisher's bank (a chest in the reeds),
// the beekeeper at her hives; and Hollowbough going about its day: those who walk a round of spots
// move, those who sit, fish or work stay put in their pose.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const near = (x, z, r) => (e) => e.alive && Math.hypot(e.x - x, e.z - z) < r;
(async () => {
  localStorage.removeItem('realms-save');
  g.godMode = true;
  // The chests pay.
  const ids = ['wc_seat', 'wc_rooks', 'wc_brook', 'wc_kingfisher'];
  const c0 = p.coins, powers = [], owed = ids.reduce((s, id) => s + (g.chests.find((k) => k.id === id)?.coins ?? 0), 0);
  for (const id of ids) {
    const c = g.chests.find((k) => k.id === id);
    if (!c) continue;
    c.interact(g);
    if (c.power) powers.push(c.power);
  }
  await wait(600);
  out.chests = { found: ids.filter((id) => g.chests.some((k) => k.id === id)).length, of: ids.length, coins: p.coins - c0, owed, powers };
  // The lore stones, and who keeps each place.
  const stone = (id) => g.interactables.find((s) => s.id === id);
  const seat = stone('wlore7'), rook = stone('wlore8');
  out.lore = { seat: !!seat, rookery: !!rook, seatText: seat?.text.slice(0, 30) ?? null };
  out.keepers = {
    seatThornback: g.enemies.filter((e) => e.type === 'thornback' && seat && near(seat.x, seat.z, 6)(e)).length,
    rookeryBats: g.enemies.filter((e) => e.group === 'rookery' && e.alive).length,
    brookGoblins: g.enemies.filter((e) => e.group === 'brookcamp' && e.alive).length,
  };
  // The village's day: where each is now, and in 5 s.
  for (const e of g.enemies) if (e.alive && e.group !== 'boss') e.despawn(g);
  p.place(60, 90, g);
  const who = ['pip', 'linnet', 'hazel', 'bram', 'marigold', 'fisher', 'burdock', 'washer', 'sorrel'];
  const npc = (id) => g.npcs.find((n) => n.def.id === id);
  const at0 = Object.fromEntries(who.map((id) => [id, [npc(id)?.x, npc(id)?.z]]));
  await wait(5000);
  const moved = (id) => { const n = npc(id), [x, z] = at0[id]; return n ? +Math.hypot(n.x - x, n.z - z).toFixed(1) : null; };
  out.day = {
    walkers: Object.fromEntries(['pip', 'linnet', 'hazel', 'bram', 'marigold'].map((id) => [id, moved(id)])),
    sitters: Object.fromEntries(['fisher', 'burdock', 'washer', 'sorrel'].map((id) => [id, moved(id)])),
    poses: Object.fromEntries(['fisher', 'burdock', 'washer'].map((id) => [id, npc(id)?.def.pose ?? null])),
  };
  out.ok = out.chests.found === 4 && out.chests.coins === owed && owed > 0 && out.lore.seat && out.lore.rookery && out.keepers.seatThornback === 1 && out.keepers.rookeryBats === 2 && out.keepers.brookGoblins === 2
    && Object.values(out.day.walkers).filter((d) => d > 0.5).length >= 4 && Object.values(out.day.sitters).every((d) => d === 0);
  localStorage.removeItem('realms-save');
})();
window.__report = () => out;
