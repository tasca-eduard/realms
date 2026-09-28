// Two minutes of random play all over the map (no god mode): mashing moves, attacks,
// blocks, rolls, jumps, specials, flasks and talk. Flags anything that breaks: script
// errors, NaN positions, falling through the ground, a state that never ends.
const g = window.__game, p = g.player, out = { anomalies: [], states: {}, deaths: 0, teleports: 0 };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const note = (s) => { if (out.anomalies.length < 25 && !out.anomalies.includes(s)) out.anomalies.push(s); };
window.addEventListener('error', (e) => note('error: ' + e.message));
window.addEventListener('unhandledrejection', (e) => note('rejection: ' + e.reason));
const stops = [[105.5,105],[87.5,99],[80,63],[76,54],[40,78],[33,61],[16,50],[3,99.5],[38,113],[80,115],[121,99],[111.5,88],[93,78],[86,40],[95,27],[108,14],[118,30.5],[70,20],[56,15],[44,25],[30,33]];
const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
const acts = ['attack', 'attack', 'attack', 'guard', 'jump', 'special', 'heal', 'interact'];
const kd = (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code }));
const ku = (code) => window.dispatchEvent(new KeyboardEvent('keyup', { code }));
let rng = 7;
const rnd = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);
(async () => {
  await wait(500);
  let lastState = p.state, since = performance.now(), stop = 0, t0 = performance.now(), wasDead = false;
  const fin = (v) => Number.isFinite(v);
  while (performance.now() - t0 < 120000) {
    // Every 12 s, move on to the next part of the map.
    if (performance.now() - t0 > (stop + 1) * 12000 || stop === 0) {
      const [x, z] = stops[stop % stops.length];
      if (g.state === 'play' && p.alive) { p.place(x, z, g); g.cam.focus.set(x, p.y, z); out.teleports++; }
      stop++;
    }
    // Random input: hold a direction for a while, tap or hold an action.
    for (const k of keys) ku(k);
    const n = Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) kd(keys[Math.floor(rnd() * 4)]);
    const a = acts[Math.floor(rnd() * acts.length)];
    g.input.mouseX = innerWidth * rnd();
    g.input.mouseY = innerHeight * rnd();
    g.input.press(a);
    await wait(40 + rnd() * 400);
    g.input.release(a);
    // Keep the game moving: close dialogs, get up after a fall.
    if (g.ui.dialogOpen) { g.ui.dialogKey('ok'); }
    if (g.state === 'dead') {
      if (!wasDead) out.deaths++;
      wasDead = true;
      g.input.press('attack'); await wait(50); g.input.release('attack');
      kd('Enter'); ku('Enter');
    } else wasDead = false;
    if (g.paused) g.setPaused(false);
    // Checks.
    if (![p.x, p.y, p.z].every(fin)) note(`knight position NaN in state ${p.state}`);
    for (const e of g.enemies) if (e.alive && ![e.x, e.y, e.z, e.hp].every(fin)) note(`${e.type} NaN in state ${e.state}`);
    const gy = g.grid.groundAt(p.x, p.z);
    if (g.state === 'play' && p.alive && !p.riding && p.y < gy - 1.2 && !g.falling) note(`knight under the ground at ${p.x.toFixed(1)},${p.z.toFixed(1)} (y ${p.y.toFixed(2)}, ground ${gy.toFixed(2)})`);
    out.states[p.state] = (out.states[p.state] ?? 0) + 1;
    if (p.state !== lastState) { lastState = p.state; since = performance.now(); }
    else if (!['idle', 'walk', 'run', 'rest', 'dead', 'ride'].includes(p.state) && performance.now() - since > 8000) note(`knight stuck in "${p.state}" for 8 s at ${p.x.toFixed(1)},${p.z.toFixed(1)}`);
  }
  for (const k of keys) ku(k);
  out.done = true;
  out.kills = g.save.data.kills;
  out.hp = p.hp;
})();
window.__report = () => out;
