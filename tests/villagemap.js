// Top-down plan of Keepsfoot: ground, heights, colliders (buildings, props), NPCs and doors.
const g = window.__game, grid = g.grid;
const X0 = 46, Z0 = 38, X1 = 112, Z1 = 88, S = 14;
const c = document.createElement('canvas');
c.width = (X1 - X0) * S; c.height = (Z1 - Z0) * S;
c.style.cssText = `position:fixed;left:0;top:0;z-index:99;width:${c.width}px;height:${c.height}px;background:#000`;
const x2 = c.getContext('2d');
const T = { 0: [70, 110, 60], 12: [55, 95, 50], 1: [120, 95, 60], 2: [200, 170, 110], 3: [150, 145, 160], 4: [150, 145, 165], 6: [140, 100, 60], 7: [60, 60, 60], 8: [70, 100, 60], 16: [90, 70, 40] };
for (let z = Z0; z < Z1; z++)
  for (let x = X0; x < X1; x++) {
    const i = grid.i(x, z);
    let col = T[grid.t[i]] || [90, 90, 90];
    const k = 0.6 + grid.h[i] * 0.25;
    col = col.map((v) => Math.min(255, v * k));
    if (grid.water[i] > -100) col = [50, 80, 140];
    if (grid.dir[i] >= 0) col = [220, 120, 220];
    x2.fillStyle = `rgb(${col.map(Math.round).join(',')})`;
    x2.fillRect((x - X0) * S, (z - Z0) * S, S, S);
  }
x2.lineWidth = 1;
for (const col of grid.colliders) {
  if (!col.on || col.x1 < X0 || col.x0 > X1 || col.z1 < Z0 || col.z0 > Z1) continue;
  const big = (col.x1 - col.x0) * (col.z1 - col.z0) > 6;
  x2.strokeStyle = big ? '#ff4040' : '#ffe080';
  x2.fillStyle = big ? 'rgba(255,60,60,0.35)' : 'rgba(255,220,120,0.25)';
  if (col.kind === 'b') {
    x2.fillRect((col.x0 - X0) * S, (col.z0 - Z0) * S, (col.x1 - col.x0) * S, (col.z1 - col.z0) * S);
    x2.strokeRect((col.x0 - X0) * S, (col.z0 - Z0) * S, (col.x1 - col.x0) * S, (col.z1 - col.z0) * S);
  } else {
    x2.beginPath(); x2.arc((col.x - X0) * S, (col.z - Z0) * S, col.r * S, 0, 7); x2.fill(); x2.stroke();
  }
}
x2.font = 'bold 12px sans-serif';
for (const n of g.npcs) {
  x2.fillStyle = '#40c0ff';
  x2.fillRect((n.x - X0) * S - 4, (n.z - Z0) * S - 4, 8, 8);
  x2.fillText(n.def.name.split(' ')[0], (n.x - X0) * S + 6, (n.z - Z0) * S + 4);
}
// Grid labels every 5 units.
x2.fillStyle = '#fff';
for (let x = Math.ceil(X0 / 5) * 5; x < X1; x += 5) x2.fillText(String(x), (x - X0) * S + 2, 12);
for (let z = Math.ceil(Z0 / 5) * 5; z < Z1; z += 5) x2.fillText(String(z), 2, (z - Z0) * S + 12);
document.body.appendChild(c);
