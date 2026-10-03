// Whisperwood's trees and colours (group 92): the props' distinct colours; the leaves' colour by zone (the mean
// colour of the leaves within a few metres of a spot in each: hue in degrees and saturation); the trees, flowers
// and ivy put in by hand (src/world/woodcolours.ts), none on a path; and Hollowbough's doors (082): of five points
// on each door, how many are hidden from the game camera (the door's own hood not counted).
(async () => {
  const g = window.__game, G = g.grid;
  const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/world/woodcolours.ts')) ?? '/src/world/woodcolours.ts';
  // (Before group 92 there is no such module: the colours are still measured.)
  const wc = await import(url).then((m) => m.WOOD_COLOURS).catch(() => ({ trees: [], counts: {} }));
  const out = {};
  // ---------- colours ----------
  const cols = new Set(), leaves = [];
  g.scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.material?.vertexColors) return;
    const c = o.geometry.attributes.color, k = o.geometry.attributes.aKind, p = o.geometry.attributes.position;
    if (!c) return;
    for (let i = 0; i < c.count; i += 3) {
      cols.add(((c.getX(i) * 31) | 0) * 1024 + ((c.getY(i) * 31) | 0) * 32 + ((c.getZ(i) * 31) | 0));
      if (k && Math.abs(k.getX(i) - 11) < 0.5 && p) leaves.push([p.getX(i), p.getZ(i), c.getX(i), c.getY(i), c.getZ(i)]);
    }
  });
  out.propColours = cols.size;
  const hueAt = (x, z, rad) => {
    let r = 0, gg = 0, b = 0, n = 0;
    for (const [px, pz, cr, cg, cb] of leaves) if (Math.hypot(px - x, pz - z) < rad) { r += cr; gg += cg; b += cb; n++; }
    if (!n) return 'none';
    const srgb = (v) => Math.pow(v / n, 1 / 2.2);
    r = srgb(r); gg = srgb(gg); b = srgb(b);
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    let h = mx === mn ? 0 : mx === r ? ((gg - b) / (mx - mn)) % 6 : mx === gg ? (b - r) / (mx - mn) + 2 : (r - gg) / (mx - mn) + 4;
    return `hue ${Math.round((h * 60 + 360) % 360)}, sat ${((mx - mn) / mx).toFixed(2)} (${n} leaf vertices)`;
  };
  out.leaves = {
    'the Old Grove (copper, gold)': hueAt(88, 102, 9),
    'the East Woods (blue-black)': hueAt(110, 30, 8),
    'the Deep Wood (lime)': hueAt(14, 74, 8),
    'the Withered Wood (rust)': hueAt(16, 40, 9),
    'the verge (silver birches)': hueAt(113, 103, 6),
    'the High Canopy (teal)': hueAt(104, 76, 9),
    'mixed wood (green)': hueAt(60, 30, 10),
  };
  // ---------- what was put in by hand ----------
  const kinds = {};
  for (const [k] of wc.trees) kinds[k] = (kinds[k] ?? 0) + 1;
  out.trees = kinds;
  out.counts = wc.counts;
  out.treesOnPaths = wc.trees.filter(([, x, z]) => [[0, 0], [0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]].some(([dx, dz]) => G.typeAt(x + dx, z + dz) === 2)).map(([k, x, z]) => `${k} ${x.toFixed(1)},${z.toFixed(1)}`);
  // ---------- the doors ----------
  const el = (30 * Math.PI) / 180, yaw = (45 * Math.PI) / 180;
  const D = [Math.cos(el) * Math.sin(yaw), Math.sin(el), Math.cos(el) * Math.cos(yaw)];
  const tris = [];
  for (const grp of g.scene.children.filter((o) => o.name === 'terrain' || o.name === 'props'))
    grp.traverse((m) => {
      if (!m.isMesh || m.isSkinnedMesh || m.isInstancedMesh || m.material?.type === 'MeshBasicMaterial') return;
      m.updateMatrixWorld();
      tris.push({ p: m.geometry.attributes.position, idx: m.geometry.index, e: m.matrixWorld.elements });
    });
  const V = (t, k) => { const p = t.p, x = p.getX(k), y = p.getY(k), z = p.getZ(k), e = t.e; return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; };
  const hidden = (pts) => {
    const hit = pts.map(() => false);
    const x0 = Math.min(...pts.map((p) => p[0])) - 1, z0 = Math.min(...pts.map((p) => p[2])) - 1, x1 = x0 + 47, z1 = z0 + 47;
    for (const t of tris) {
      const n = t.idx ? t.idx.count : t.p.count;
      for (let k = 0; k < n; k += 3) {
        const a = V(t, t.idx ? t.idx.getX(k) : k), b = V(t, t.idx ? t.idx.getX(k + 1) : k + 1), c = V(t, t.idx ? t.idx.getX(k + 2) : k + 2);
        if (Math.max(a[0], b[0], c[0]) < x0 || Math.min(a[0], b[0], c[0]) > x1 || Math.max(a[2], b[2], c[2]) < z0 || Math.min(a[2], b[2], c[2]) > z1) continue;
        const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const h = [D[1] * e2[2] - D[2] * e2[1], D[2] * e2[0] - D[0] * e2[2], D[0] * e2[1] - D[1] * e2[0]], det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
        if (Math.abs(det) < 1e-9) continue;
        const inv = 1 / det;
        pts.forEach((P, r) => {
          if (hit[r]) return;
          const s = [P[0] - a[0], P[1] - a[1], P[2] - a[2]], u = (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) * inv;
          if (u < 0 || u > 1) return;
          const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], w = (D[0] * q[0] + D[1] * q[1] + D[2] * q[2]) * inv;
          if (w < 0 || u + w > 1) return;
          if ((e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv > 1.5) hit[r] = true;
        });
      }
    }
    return hit.filter(Boolean).length;
  };
  // The home trees as built (src/world/realm2.ts HOMES): x, z, size, which way the door faces.
  const HOMES = { weaver: [40, 60, 0.85, 0.9], elder: [78, 60, 1.18, 1.5], fisher: [79.5, 81.5, 0.82, 0.3], lodge: [28, 58, 0.9, 0.8] };
  out.doorsHidden = {};
  for (const [k, [tx, tz, ts, tf]] of Object.entries(HOMES)) {
    const rr = 1.9 * ts - 0.08 + 0.35, yy = G.groundAt(tx, tz);
    const pts = [[0, 1], [-0.35, 0.45], [0.35, 0.45], [-0.35, 1.55], [0.35, 1.55]].map(([w, hh]) => [tx + Math.cos(tf) * rr - Math.sin(tf) * w, yy + hh, tz + Math.sin(tf) * rr + Math.cos(tf) * w]);
    out.doorsHidden[k] = `${hidden(pts)} of 5`;
  }
  window.__report = () => out;
})();
