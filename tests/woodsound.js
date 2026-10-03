// Whisperwood's own sound (run with &realm=forest&god; the browser is muted, so this reads what the game hands the
// audio, what the audio makes (src/audio/lands.ts counts its one-shots) and the beasts' calls): the canopy's hush
// and its trunks groaning in the woods; branches cracking in the Deep Wood (not in the village); the roar at the
// Whisper's Fall (its bed playing) and white water down Rookfall, rooks over it; the frogs' chorus round the
// Heartpool and in the Mossfen; chimes in Hollowbough's home trees; the inn's voices and lute through its walls; a
// nightingale by the Heartpool at night; at dawn the dawn chorus, a cuckoo, the frogs and the nightingale quiet.
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
  const deep = await probe('deepwood', 8, 62, 3500);
  const falls = await probe('whispersfall', 86.5, 53.5);
  falls.roar = r2(a.lands.loops.roar?.gain.gain.value ?? 0);
  const bridge = await probe('rookfall', 103.5, 33.5);
  const green = await probe('heartpool', 61, 80);
  const inn = await probe('inn', 60, 100.5);
  inn.lowpass = Math.round(a.lands.crowd?.filter.frequency.value ?? 0);
  const bay = await probe('nightingale', 36, 80.5);
  const fen = await probe('mossfen', 20, 105);
  const meadow = await probe('deermeadow', 83, 78);
  const road = await probe('thornroad', 111.5, 109.5);
  g.setDawn(1);
  const dawn = await probe('dawn', 36, 80.5, 3500);
  out.ok = deep.region === 'The Deep Wood' && deep.beds.canopy === 1 && deep.beds.snaps === 1 && deep.made.snap >= 1 && deep.made.groan >= 1 && !deep.beds.chimes
    && falls.beds.falls === 1 && falls.made.falls >= 1 && falls.roar > 0.1 && !falls.beds.snaps
    && bridge.beds.rush > 0 && bridge.calls.includes('rook')
    && green.beds.peepers === 1 && green.made.peep > 5 && green.beds.chimes > 0.3 && green.made.chime >= 1 && !green.beds.snaps
    && inn.beds.inn > 0.3 && inn.made.voice > 3 && inn.made.lute > 3 && inn.lowpass < 1000
    && bay.beds.nightingale > 0.8 && bay.made.nightingale >= 1
    && fen.beds.peepers === 1 && fen.made.peep > 5
    && meadow.calls.includes('stag')
    && !road.beds.falls && !road.beds.peepers && !road.beds.inn && !road.beds.snaps
    && dawn.beds.dawnsong > 0.9 && dawn.made.dawnbird >= 1 && !dawn.beds.nightingale && !dawn.beds.peepers && dawn.calls.includes('cuckoo');
})();
