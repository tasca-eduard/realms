// Stand near each new foe type and record what happens to the knight.
const g = window.__game;
const p = g.player;
const spots = { brute: [59.5, 14], bomber: [84, 114], darter: [36, 110.5], shaman: [100, 18], camp: [95, 25] };
const out = {};
let cur = null, seen = null;
const iv = setInterval(() => {
  if (!cur) return;
  p.hp = Math.max(p.hp, 3);
  for (const k of ['maim', 'daze', 'burn', 'poison']) if (p.effects[k] > 0) seen.effects.add(k);
  if (p.state === 'down') seen.effects.add('knocked down');
  for (const e of g.enemies) if (e.alive && e.hasteT > 0) seen.hasted.add(e.type);
  seen.fires = Math.max(seen.fires, g.combat.fires.length);
  seen.pots = Math.max(seen.pots, g.combat.pots.length);
}, 50);
const names = Object.keys(spots);
let i = 0;
const next = () => {
  if (cur) out[cur] = { effects: [...seen.effects], hasted: [...seen.hasted], fires: seen.fires, pots: seen.pots, hits: seen.hp0 - 0 };
  if (i >= names.length) { clearInterval(iv); return; }
  cur = names[i++];
  seen = { effects: new Set(), hasted: new Set(), fires: 0, pots: 0, hp0: 0 };
  const [x, z] = spots[cur];
  p.cureAll();
  p.place(x, z, g);
  g.cam.focus.set(x, p.y, z);
  setTimeout(next, 9000);
};
next();
window.__report = () => out;
