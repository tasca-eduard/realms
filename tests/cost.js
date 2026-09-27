// Measure the game's own JS time per frame at a few busy places.
const g = window.__game;
const orig = g.frame.bind(g);
let sum = 0, n = 0, worst = 0;
g.frame = (now) => { const t0 = performance.now(); orig(now); const d = performance.now() - t0; sum += d; n++; worst = Math.max(worst, d); };
const out = {};
const spots = { village: [80, 63], camp: [95, 26], courtyard: [40, 27], fields: [40, 80] };
let i = 0;
const names = Object.keys(spots);
const next = () => {
  if (i > 0) out[names[i - 1]] = { avgMs: +(sum / n).toFixed(2), worstMs: +worst.toFixed(1) };
  if (i >= names.length) return;
  const [x, z] = spots[names[i++]];
  g.player.place(x, z, g);
  g.godMode = true;
  setTimeout(() => { sum = 0; n = 0; worst = 0; setTimeout(next, 3000); }, 800);
};
next();
window.__report = () => out;
