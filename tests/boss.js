// Auto-fight: aim at the nearest living enemy and click, roll when low stamina is fine.
const g = window.__game;
const c = document.querySelector('#view canvas');
const log = [];
let n = 0;
const iv = setInterval(() => {
  const p = g.player;
  const foes = g.enemies.filter((e) => e.alive);
  foes.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
  const e = foes[0];
  if (!e) return;
  const v = new g.player.aim.constructor(0, 0);
  const s = { x: 0, y: 0 };
  g.cam.toScreen({ x: e.x, y: e.y + 0.9, z: e.z, clone() { return new (g.cam.focus.constructor)(this.x, this.y, this.z); } }, s);
  c.dispatchEvent(new MouseEvent('mousemove', { clientX: s.x, clientY: s.y, bubbles: true }));
  const d = Math.hypot(e.x - p.x, e.z - p.z);
  // Walk toward the enemy when far.
  const keyOpts = (code) => ({ code, bubbles: true });
  const dir = { x: e.x - p.x, z: e.z - p.z };
  const sx = dir.x * g.cam.groundRight.x + dir.z * g.cam.groundRight.z;
  const sy = dir.x * g.cam.groundUp.x + dir.z * g.cam.groundUp.z;
  for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) window.dispatchEvent(new KeyboardEvent('keyup', keyOpts(k)));
  if (d > 1.6) {
    if (sx > 0.3) window.dispatchEvent(new KeyboardEvent('keydown', keyOpts('KeyD')));
    if (sx < -0.3) window.dispatchEvent(new KeyboardEvent('keydown', keyOpts('KeyA')));
    if (sy > 0.3) window.dispatchEvent(new KeyboardEvent('keydown', keyOpts('KeyW')));
    if (sy < -0.3) window.dispatchEvent(new KeyboardEvent('keydown', keyOpts('KeyS')));
  } else if (n++ % 2 === 0) {
    c.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: s.x, clientY: s.y, bubbles: true }));
    setTimeout(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })), 30);
  }
}, 120);
window.__report = () => {
  clearInterval(iv);
  const p = g.player;
  const k = g.boss; return { boss: k ? [k.state, k.hp.toFixed(1), k.enraged] : null, bossActive: g.bossActive, hp: p.hp, state: g.state, coins: p.coins, kills: g.kills, alive: g.enemies.filter((e) => e.alive).length, pos: [p.x.toFixed(1), p.z.toFixed(1)] };
};
