// Draws the current realm from above over the page (for planning and review; used with
// tools/shot.mjs): ground by height and type, water, paths, colliders (trees and rocks as dots),
// and what's placed: moonfires (blue), chests (gold), shards (cyan), NPCs (white), foes (red),
// traps (orange), vines (green lines). One pixel square per cell.
const g = window.__game, G = g.grid;
// &crop=x0,z0,x1,z1 in the page's URL draws just that part of the map, bigger.
const crop = (new URLSearchParams(location.search).get('crop') ?? '').split(',').map(Number);
const [C0, C1, C2, C3] = crop.length === 4 && crop.every((v) => !Number.isNaN(v)) ? crop : [0, 0, g.realm.w, g.realm.d];
const W = C2 - C0, D = C3 - C1;
const S = Math.floor(Math.min(innerWidth / (W + 4), innerHeight / (D + 4)));
const cv = document.createElement('canvas');
cv.width = (W + 4) * S;
cv.height = (D + 4) * S;
Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', zIndex: 9999, background: '#000' });
document.body.appendChild(cv);
const c = cv.getContext('2d');
const X = (x) => (x - C0 + 2) * S, Z = (z) => (z - C1 + 2) * S;
const T = { 0: [70, 110, 50], 1: [110, 85, 55], 2: [170, 140, 90], 4: [140, 140, 130], 6: [120, 90, 60], 7: [40, 50, 60], 8: [60, 100, 55], 12: [45, 80, 40], 13: [80, 65, 45], 14: [110, 105, 100], 17: [90, 110, 60] };
for (let z = C1 - 2; z < C3 + 2; z++)
  for (let x = C0 - 2; x < C2 + 2; x++) {
    if (!G.inside(x, z)) continue;
    const i = G.i(x, z), h = G.deck?.[i] > -99 ? G.deck[i] : G.h[i];
    let col = T[G.t[i]] ?? [90, 90, 90];
    const k = Math.max(0.35, Math.min(1.6, 0.75 + h * 0.07));
    col = col.map((v) => Math.min(255, v * k));
    if (G.water[i] > -99 && G.water[i] > G.h[i]) col = G.water[i] - G.h[i] > 0.55 ? [30, 60, 110] : [60, 100, 140];
    if (h < -5) col = [15, 15, 20];
    c.fillStyle = `rgb(${col.map(Math.round).join(',')})`;
    c.fillRect(X(x), Z(z), S, S);
  }
c.strokeStyle = 'rgba(255,255,255,0.35)';
c.strokeRect(X(0), Z(0), g.realm.w * S, g.realm.d * S);
for (const k of G.colliders) {
  if (k.kind === 'c') {
    c.fillStyle = k.r > 1.2 ? 'rgba(20,40,15,0.9)' : 'rgba(15,35,10,0.75)';
    c.beginPath();
    c.arc(X(k.x), Z(k.z), Math.max(1.2, k.r * S), 0, Math.PI * 2);
    c.fill();
  } else {
    c.fillStyle = 'rgba(80,60,40,0.55)';
    c.fillRect(X(k.x0), Z(k.z0), Math.max(1, (k.x1 - k.x0) * S), Math.max(1, (k.z1 - k.z0) * S));
  }
}
const dot = (x, z, col, r = 3) => { c.fillStyle = col; c.beginPath(); c.arc(X(x), Z(z), r, 0, Math.PI * 2); c.fill(); };
for (const v of g.realm.vines ?? []) { c.strokeStyle = '#7f7'; c.lineWidth = 3; c.beginPath(); c.moveTo(X(v.x - v.w / 2), Z(v.z)); c.lineTo(X(v.x + v.w / 2), Z(v.z)); c.stroke(); }
for (const [x, z] of g.realm.snares ?? []) dot(x, z, '#f90', 2.5);
for (const e of g.enemies) dot(e.home.x, e.home.z, '#f33', 3);
for (const n of g.npcs) dot(n.x, n.z, '#fff', 3.5);
for (const o of g.realm.objects) {
  if (o.kind === 'moonfire') dot(o.x, o.z, '#6af', 5);
  if (o.kind === 'chest') dot(o.x, o.z, '#fc3', 4);
  if (o.kind === 'shard') dot(o.x, o.z, '#6ff', 4);
  if (o.kind === 'lore' || o.kind === 'sign') dot(o.x, o.z, '#c9f', 2.5);
}
c.font = `${Math.max(10, S * 2)}px sans-serif`;
c.fillStyle = 'rgba(255,255,255,0.8)';
const step = Math.max(W, D) > 60 ? 20 : 5;
for (let v = 0; v <= 120; v += step) {
  if (v >= C0 && v <= C2) c.fillText(String(v), X(v), Z(C1 - 0.5));
  if (v >= C1 && v <= C3) c.fillText(String(v), X(C0 - 2), Z(v) + 4);
}
window.__report = () => ({ cell: S, trees: G.colliders.filter((k) => k.kind === 'c').length });
