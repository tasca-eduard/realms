// The Sunken Reef's sound (run with &realm=aqua&god; the browser is muted, so this reads what the game hands the
// audio and the audio graph): every place has a track of the realm's own and a sea ambience; the surf is louder by
// the water than up on the dunes, with the strand's gusty wind and no owls; planks creak on the jetty and the
// wreck; the Harbour Arms has its own tune (a shanty) and voices, muffled outside; the castaway's cave drips and
// echoes; the drowned temple echoes, drips and sings; the lit lighthouse hums (not the dark one); Brassbelly's fight
// has its own music and the isle's comes back once he's felled; out on the serpent the sea laps and no crickets
// sing; steps on the sea floor don't splash.
const g = window.__game, p = g.player, a = g.audio, out = { spots: {} };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const r2 = (v) => (typeof v === 'number' ? +v.toFixed(2) : v);
window.__report = () => out;
const count = {};
for (const k of ['creakAt', 'syllable']) {
  const f = a[k].bind(a);
  a[k] = (...args) => { count[k] = (count[k] ?? 0) + 1; return f(...args); };
}
const steps = [];
const sfx = a.sfx.bind(a);
a.sfx = (n, ...r) => { if (n.startsWith('step')) steps.push(n); return sfx(n, ...r); };
const probe = async (name, x, z, ms = 2500) => {
  for (const k in count) delete count[k];
  p.place(x, z, g);
  g.cam.focus.set(p.x, p.y, p.z);
  await wait(ms);
  const s = a.amb, m = a.music;
  const o = {
    region: g.region?.name, under: p.under, music: m?.main?.name ?? '',
    ...Object.fromEntries(['wind', 'crickets', 'owls', 'surf', 'lap', 'creak', 'chatter', 'drips', 'echo', 'choir', 'hum'].map((k) => [k, r2(s[k] ?? 0)])),
    rev: r2(a.revSend.gain.value), ...count,
  };
  out.spots[name] = o;
  return o;
};
(async () => {
  await wait(500);
  for (const e of g.enemies) if (e.alive && e.type !== 'salvager') e.despawn(g);
  for (let i = 0; i < 40 && !a.music?.ready; i++) await wait(200);
  const own = ['road', 'wilds', 'fields', 'keep', 'hall', 'village', 'tavern'];
  const kinds = ['shore', 'harbour', 'sea', 'cave', 'grotto', 'temple', 'indoor'];
  out.badRegions = g.realm.regions.filter((r) => !own.includes(r.music) || !kinds.includes(r.amb)).map((r) => `${r.name}: ${r.music}/${r.amb}`);
  g.save.data.flags.costume = true;
  p.dives = true;
  const stair = await probe('dunes', 24, 16);
  const beach = await probe('beach', 30, 44);
  const jetty = await probe('jetty', 50, 66.4, 4500);
  const wreck = await probe('wreck', 121 + Math.cos(0.55) * 4.2, 50 + Math.sin(0.55) * 4.2);
  const inn = await probe('inn', 23, 54);
  inn.tavern = { track: a.music?.tavern?.name ?? null, gain: r2(a.music?.tavernGain.gain.value), lowpass: Math.round(a.chatterBus?.filter.frequency.value ?? 0) };
  const street = await probe('street', 30, 54);
  street.lowpass = Math.round(a.chatterBus?.filter.frequency.value ?? 0);
  const cave = await probe('cave', 125, -6);
  const temple = await probe('temple', 104, 81);
  const dark = await probe('isleDark', 99, 31.5);
  g.save.data.flags.lampLit = true;
  const lit = await probe('isleLit', 99, 31.5);
  // Brassbelly's fight, and after.
  const sal = g.enemies.find((e) => e.type === 'salvager' && e.alive);
  const fight = await probe('brassbelly', sal.x + 2, sal.z, 3000);
  sal.die(g);
  await wait(3000);
  out.felled = { music: a.music?.main?.name ?? '', region: g.region?.name };
  // On the sea floor: soft steps.
  p.place(70, 60, g);
  await wait(500);
  steps.length = 0;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', bubbles: true }));
  await wait(1500);
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', bubbles: true }));
  out.floorSteps = { under: p.under, steps: [...new Set(steps)] };
  // Out on the open sea on the serpent's back.
  const pen = g.story.serpent;
  pen.struck(g, () => true);
  const sp = pen.serpent;
  sp.arriveAt(85, 64, g);
  p.place(sp.x, sp.z, g);
  await wait(300);
  p.mount(sp, g);
  await wait(400);
  const sea = await probe('serpent', p.x, p.z, 1500);
  sea.riding = p.riding === sp;
  out.ok = !out.badRegions.length
    && beach.surf > 0.5 && beach.surf > stair.surf + 0.3 && beach.wind > 1 && beach.owls === 0
    && jetty.creak > 0.5 && wreck.creak > 0.3 && beach.creak === 0
    && inn.chatter === 1 && inn.syllable > 5 && inn.tavern.track === 'aqua:tavern' && inn.tavern.gain > 0.6 && inn.tavern.lowpass > 3000 && street.chatter < 0.5 && street.lowpass < 1000
    && cave.drips === 1 && cave.echo > 0.5 && cave.rev > 0.6 && cave.wind === 0
    && temple.under && temple.choir === 1 && temple.echo === 1 && temple.rev > 0.7
    && dark.hum === 0 && lit.hum > 0.1
    && fight.music === 'aqua:fight' && out.felled.music === 'aqua:road'
    && out.floorSteps.under && out.floorSteps.steps.length > 0 && !out.floorSteps.steps.includes('step-water')
    && sea.riding && sea.lap === 1 && sea.crickets === 0 && sea.owls === 0;
})();
