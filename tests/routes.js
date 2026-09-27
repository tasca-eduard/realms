// Walk each planned route and report height steps, deep water and blocking props.
const g = window.__game;
const grid = g.grid;
const R = {
  home: [[99.9, 95.2], [96, 95.4], [90.4, 95.1]],
  stones: [[102.3, 98.8], [104.2, 97.6], [106.2, 94.6], [109.2, 89.6]],
  river: [[113.6, 90], [116.5, 92.6], [119, 95], [120.4, 96.4]],
  farm: [[106.8, 105.8], [99, 109.1], [91, 109.8], [86, 110.3], [86, 116]],
  fields: [[44.2, 71.5], [46.5, 78], [48.3, 84.5], [49.3, 89], [51.2, 94], [52, 99.3], [56, 101.3], [63, 102.9], [69, 104], [74, 106.2], [80, 108.5], [86, 110.3]],
  pier: [[48.4, 85], [41, 87.8], [31, 91.5], [21, 96.8], [14, 99.3], [9.6, 99.5]],
  stair: [[48, 69.3], [42, 66.8], [30, 65.5], [20, 62.6], [10, 60.6], [6.2, 59.8], [6, 58.3]],
};
const out = {};
for (const [k, pts] of Object.entries(R)) {
  let prev = null, maxStep = 0, deep = [], blocked = [], lo = 99, hi = -99, stepAt = null;
  for (let s = 0; s < pts.length - 1; s++) {
    const [ax, az] = pts[s], [bx, bz] = pts[s + 1];
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.2);
    for (let i = 0; i <= n; i++) {
      const x = ax + ((bx - ax) * i) / n, z = az + ((bz - az) * i) / n;
      const h = grid.groundAt(x, z);
      lo = Math.min(lo, h); hi = Math.max(hi, h);
      if (prev !== null && Math.abs(h - prev) > maxStep) { maxStep = Math.abs(h - prev); stepAt = [x.toFixed(1), z.toFixed(1)]; }
      prev = h;
      const cx = Math.floor(x), cz = Math.floor(z);
      if (grid.isDeep(cx, cz)) deep.push([cx, cz].join(','));
      for (const c of grid.collidersNear(x, z)) {
        if (!c.on || c.y1 < h + 0.5 || c.y0 > h + 1.5) continue;
        const inside = c.kind === 'b' ? x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 : (x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r;
        if (inside) blocked.push(`${x.toFixed(1)},${z.toFixed(1)} ${c.kind}${c.kind === 'c' ? ' r' + c.r.toFixed(2) + ' @' + c.x.toFixed(1) + ',' + c.z.toFixed(1) : ''}`);
      }
    }
  }
  out[k] = { heights: [lo, hi].map((v) => +v.toFixed(2)), maxStep: +maxStep.toFixed(2), stepAt, deep: [...new Set(deep)].slice(0, 6), blocked: [...new Set(blocked)].slice(0, 8) };
}
window.__report = () => out;
