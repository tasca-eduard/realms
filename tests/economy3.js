// The Sunken Reef's economy and toughness (run with &realm=aqua). Everything the realm pays once: its chests (the
// 33 placed, the chest dug up from the bottle's map, Old Inkarm's), the Whalebone Isle's purse and every quest's and
// errand's reward (each `coins += n` in the realm's story files, its toast naming the sum), against everything its
// folk sell: the coral-smith's two coral edges, each seller's wares (the old diver's air bladder, the beachcomber's
// lodestone), Jetsam's secret. (Flasks: a knight comes with six, bought in Blackpine; barding is the Keep's.) It
// pays 10-25% more, a modest surplus, not twice over; the foes' coins and the clams' pearls come on top. Chests pay
// by how hidden: in the open by the ways 25-35, tucked away 45-55, hidden 70-90, the trench's floor and Inkarm's
// the most. Its foes are 2.25 times as tough as their kind (the knight comes with a better sword).
const g = window.__game, out = {};
window.__report = () => out;
(async () => {
  const raw = async (p) => (await import(/* @vite-ignore */ `${p}?raw`)).default;
  const { WARES } = await import('/src/game/wares.ts');
  const { FOES, HAZARDS } = await import('/src/config.ts');
  const { RAID } = await import('/src/world/errands.ts');
  const story = {};
  for (const f of ['aqua', 'reef', 'reeflife', 'errands', 'lighthouse', 'grotto', 'seacaves']) story[f] = await raw(`/src/game/story/${f}.ts`);

  // Chests: placed, and the two the story brings up later.
  const later = [
    ['r3_dig', +(story.errands.match(/new Chest\('r3_dig', [^;]*?, (\d+), g\)/)?.[1] ?? NaN)],
    ['r3_inkarm', +(story.grotto.match(/CHEST = \{ id: 'r3_inkarm', coins: (\d+)/)?.[1] ?? NaN)],
  ];
  const chests = [...g.chests.map((c) => [c.id, c.coins]), ...later.filter(([id]) => !g.chests.some((c) => c.id === id))];
  const chestCoins = chests.reduce((s, [, n]) => s + n, 0);
  // Quests and errands: each reward, and its toast saying the same sum.
  const rewards = [], unsaid = [];
  for (const [f, src] of Object.entries(story))
    for (const m of src.matchAll(/coins \+= (\d+)/g)) {
      rewards.push(+m[1]);
      if (!src.includes(`${m[1]} coins`)) unsaid.push(`${f}: ${m[1]}`);
    }
  const quests = rewards.reduce((s, n) => s + n, 0);
  const purse = g.realm.trial.purse, purseSaid = g.realm.trial.win.join(' ').includes(`${purse} coins`);
  const pays = chestCoins + quests + purse;

  // What its folk sell: the coral-smith takes the sword from Whisperwood's top (5) to his (7).
  const prices = JSON.parse((await raw('/src/game/game.ts')).match(/const prices = (\[[\d, ]+\])/)[1]);
  const smith = g.npcs.find((n) => n.def.shop === 'sword');
  const edges = prices.slice(5, smith.def.upTo).reduce((a, b) => a + b, 0);
  const sold = g.npcs.flatMap((n) => n.def.wares ?? []);
  const wares = sold.reduce((s, id) => s + WARES[id].prices.reduce((a, b) => a + b, 0), 0);
  const secret = +(story.seacaves.match(/const SECRET_COST = (\d+)/)?.[1] ?? 0);
  const sells = edges + wares + secret;

  // On top: the clams' pearls (once each), and the foes' coins as they fall on average (a little jelly splits off
  // twice; one in 12.5 is golden, ten times as rich, never a boss, Brassbelly or Inkarm; no combo counted). The trial's drop none.
  const clams = (g.realm.clams?.length ?? 0) * HAZARDS.clamPearl;
  const mean = (type) => (FOES[type].coins[0] + FOES[type].coins[1]) / 2;
  let foesBase = 0, foesExp = 0;
  const foe = (type, elite, canGold) => {
    const m = mean(type) * (type === 'jelly' ? 3 : 1) * (elite ? 3 : 1);
    foesBase += m;
    foesExp += !elite && canGold ? m * (0.92 + 0.08 * 10) : m;
  };
  for (const e of g.enemies) if (!e.isBoss && e.group !== 'trial') foe(e.type, e.elite, e.type !== 'inkarm' && e.type !== 'salvager');
  for (const r of RAID) foe(r.type, false, true);

  // Chests by how hidden.
  const TIER = {
    open: { range: [25, 35], ids: ['r3_camp', 'r3_bar', 'r3_shallows', 'r3_gardens', 'r3_gardens2', 'r3_market', 'r3_plaza', 'r3_street', 'r3_northst', 'r3_bow'] },
    tucked: { range: [45, 55], ids: ['r3_cliffs', 'r3_reefboat', 'r3_house', 'r3_library', 'r3_temple', 'r3_kelpwest', 'r3_kelpsouth', 'r3_vent', 'r3_skull', 'r3_gull', 'r3_neboat', 'r3_tower', 'r3_cabin', 'r3_shiprock', 'r3_inkhoard', 'r3_seacache'] },
    hidden: { range: [70, 90], ids: ['r3_kelpheart', 'r3_harbour', 'r3_trenchend', 'r3_treasury', 'r3_treasury2', 'r3_dig', 'r3_grotto'] },
    most: { range: [110, 140], ids: ['r3_trench', 'r3_inkarm'] },
  };
  const tierOf = (id) => Object.keys(TIER).find((t) => TIER[t].ids.includes(id));
  const offTier = chests.filter(([id, n]) => { const t = tierOf(id); return !t || n < TIER[t].range[0] || n > TIER[t].range[1]; });
  const tiers = Object.fromEntries(Object.entries(TIER).map(([t, { ids }]) => [t, ids.reduce((s, id) => s + (chests.find(([c]) => c === id)?.[1] ?? 0), 0)]));
  const most = Math.min(...TIER.most.ids.map((id) => chests.find(([c]) => c === id)?.[1] ?? 0));
  const rest = Math.max(...chests.filter(([id]) => tierOf(id) !== 'most').map(([, n]) => n));

  const goblin = g.enemies.find((e) => e.type === 'goblin' && !e.elite && !e.golden);
  out.pays = { chests: chestCoins, count: chests.length, tiers, quests, rewards, purse, all: pays };
  out.sells = { edges, wares: Object.fromEntries(sold.map((id) => [id, WARES[id].prices])), secret, all: sells };
  out.surplus = +(pays / sells - 1).toFixed(3);
  out.onTop = { clams, foes: Math.round(foesBase), foesWithGolden: Math.round(foesExp), raid: RAID.length };
  out.allIn = +((pays + clams + foesBase) / sells).toFixed(2);
  out.offTier = offTier;
  out.unsaid = unsaid;
  out.tough = { goblin: goblin ? +goblin.maxHp.toFixed(2) : null, goblinBase: goblin?.spec.hp ?? null };
  out.ok = chests.length === 35 && chests.every(([, n]) => Number.isFinite(n)) && rewards.length >= 7 && !unsaid.length && purseSaid
    && edges === 640 + 720 && sold.includes('bladder') && sold.includes('lodestone')
    && out.surplus >= 0.1 && out.surplus <= 0.25 && !offTier.length && most > rest
    && Math.abs((goblin?.maxHp ?? 0) - 6.75) < 0.01;
})();
