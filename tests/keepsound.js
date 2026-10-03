// The Moonlit Keep's own sound (run with &realm=castle&god; the browser is muted, so this reads what the game hands
// the audio, what the audio makes (src/audio/lands.ts counts its one-shots) and the beasts' calls): the smithy's
// hammer and bellows; the Crescent & Crown's crowd clear inside and through its walls outside; the chapel's bell
// tolling the hour; the marsh's frogs and bittern; the ford's white water and the stream's babble; the wind in
// Blackpine's pines; crows over the keep; banners and chains at the bailey; sheep in the meadow; on the open road
// none of the places' beds; at dawn the cocks crowing and the larks up.
const g = window.__game, p = g.player, a = g.audio, out = { spots: {} };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const r2 = (v) => (typeof v === 'number' ? +v.toFixed(2) : v);
window.__report = () => out;
const calls = [];
const sfx = a.sfx.bind(a);
a.sfx = (n, ...r) => { if (!n.startsWith('step')) calls.push(n); return sfx(n, ...r); };
const probe = async (name, x, z, ms = 3000) => {
  const before = { ...a.lands.played };
  p.place(x, z, g);
  g.cam.focus.set(p.x, p.y, p.z);
  await wait(400);
  calls.length = 0;
  // (Every patch of beasts in earshot calls at once, not in its own time.)
  if (g.placeSounds) g.placeSounds.wait.fill(0);
  // (And the place's own sounds come at once, not when their turn comes round.)
  a.lands.next = {};
  await wait(ms);
  const s = a.amb, made = {};
  for (const k in a.lands.played) if (a.lands.played[k] - (before[k] ?? 0) > 0) made[k] = a.lands.played[k] - (before[k] ?? 0);
  const o = {
    region: g.region?.name,
    // (The beds every realm has, as they were before the places had their own.)
    old: Object.fromEntries(['wind', 'crickets', 'owls', 'birds', 'water', 'fire', 'drums'].map((k) => [k, r2(s[k] ?? 0)]).filter(([, v]) => v > 0)),
    beds: { ...a.lands.heard },
    made,
    calls: [...new Set(calls.filter((c) => !['rustle', 'cluck', 'bat', 'boar', 'alert', 'neigh', 'thorns', 'bow', 'arrowThunk'].includes(c)))],
  };
  out.spots[name] = o;
  return o;
};
(async () => {
  await wait(500);
  for (const e of g.enemies) if (e.alive) e.despawn(g);
  for (let i = 0; i < 40 && !a.music?.ready; i++) await wait(200);
  const smithy = await probe('smithy', 95.5, 68.5, 6000);
  const tavern = await probe('tavern', 77, 53.5);
  tavern.lowpass = Math.round(a.lands.crowd?.filter.frequency.value ?? 0);
  const street = await probe('street', 77, 61);
  street.lowpass = Math.round(a.lands.crowd?.filter.frequency.value ?? 0);
  // The chapel: the hour about to turn.
  g.save.data.playTime = (Math.floor(g.save.data.playTime / 150) + 1) * 150 - 1;
  const chapel = await probe('chapel', 94, 56, 3000);
  const marsh = await probe('marsh', 32, 110);
  const ford = await probe('ford', 69.5, 101.5);
  const stream = await probe('stream', 84, 85);
  const woods = await probe('blackpine', 76, 24);
  const keep = await probe('keep', 30, 28, 3000);
  const bailey = await probe('bailey', 55, 22);
  const meadow = await probe('meadow', 80, 101);
  const road = await probe('road', 112, 104);
  g.setDawn(1);
  const dawn = await probe('dawn', 90, 90, 3000);
  const quiet = ['forge', 'tavern', 'marsh', 'pines', 'banners', 'chains', 'brook', 'rush'];
  out.ok = smithy.beds.forge > 0.6 && (smithy.made.hammer ?? 0) + (smithy.made.bellows ?? 0) >= 3 && !smithy.beds.tavern
    && tavern.beds.tavern === 1 && tavern.made.voice > 5 && tavern.lowpass > 3000 && street.beds.tavern > 0 && street.beds.tavern < 0.7 && street.lowpass < 1000
    && chapel.beds.chapel === 1 && chapel.made.bell >= 1
    && marsh.beds.marsh === 1 && marsh.beds.bittern > 0.5 && marsh.made.croak > 0 && marsh.made.bittern >= 1 && !marsh.beds.forge
    && ford.beds.rush > 0.8 && ford.beds.brook > 0.5 && ford.made.plip > 10 && stream.beds.brook > 0.8 && !stream.beds.rush
    && woods.beds.pines === 1 && woods.made.sough >= 1 && !woods.beds.marsh
    && keep.calls.includes('crow') && keep.beds.banners > 0
    && bailey.beds.banners > 0.5 && bailey.beds.chains > 0.5 && bailey.made.flap >= 1 && bailey.made.clink >= 1
    && meadow.calls.includes('sheep')
    && quiet.every((k) => !road.beds[k])
    && dawn.calls.includes('rooster') && dawn.beds.larks > 0.5 && dawn.made.lark >= 1 && !woods.beds.larks;
})();
