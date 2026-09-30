// Where nothing happens (for review; used with tools/shot.mjs): every cell the knight can reach,
// coloured by how far it is from the nearest thing with a purpose (a foe, a person, a chest, a
// shard, a lore stone, a sign, a moonfire, the trial, a cage, bindings, a lever, a breakable):
// green near, red far. Reports the empty patches (reachable cells more than LIMIT m from anything)
// grouped into blobs, biggest first, and a summary to compare realms by.
const LIMIT = 13;
const g = window.__game, G = g.grid, W = g.realm.w, D = g.realm.d;
const pois = [];
for (const e of g.enemies) if (e.alive) pois.push([e.home.x, e.home.z, 'foe:' + e.type]);
for (const n of g.npcs) pois.push([n.x, n.z, 'npc:' + n.def.id]);
for (const it of g.interactables) pois.push([it.x, it.z, it.constructor.name]);
for (const b of g.breakables ?? []) pois.push([b.x, b.z, 'breakable']);
for (const s of g.shards) pois.push([s.x, s.z, 'shard']);
if (g.cage) pois.push([g.cage.x, g.cage.z, 'cage']);
// Reachable cells: the reach flood (story open), inside the realm.
const reach = window.__reach(true);
const route = (x, z) => reach.reached(x, z) && !G.isDeep(x, z);
const S = Math.floor(Math.min(innerWidth / (W + 4), innerHeight / (D + 4)));
const cv = document.createElement('canvas');
cv.width = (W + 4) * S; cv.height = (D + 4) * S;
Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', zIndex: 9999, background: '#000' });
document.body.appendChild(cv);
const c = cv.getContext('2d');
const X = (x) => (x + 2) * S, Z = (z) => (z + 2) * S;
const far = new Float32Array(W * D).fill(-1);
let cells = 0, sum = 0, over = 0, max = 0;
for (let z = 0; z < D; z++)
  for (let x = 0; x < W; x++) {
    if (!route(x, z)) continue;
    let d = 1e9;
    for (const [px, pz] of pois) d = Math.min(d, Math.hypot(px - x - 0.5, pz - z - 0.5));
    far[z * W + x] = d;
    cells++; sum += d; max = Math.max(max, d);
    if (d > LIMIT) over++;
    const k = Math.min(1, d / (LIMIT * 1.6));
    c.fillStyle = `rgb(${Math.round(40 + 215 * k)},${Math.round(200 - 170 * k)},40)`;
    c.fillRect(X(x), Z(z), S, S);
  }
for (const [px, pz] of pois) { c.fillStyle = '#fff'; c.fillRect(X(px) - 1, Z(pz) - 1, 3, 3); }
// Group the far cells into blobs (4-connected).
const seen = new Uint8Array(W * D), blobs = [];
for (let i = 0; i < W * D; i++) {
  if (seen[i] || far[i] <= LIMIT) continue;
  const q = [i]; seen[i] = 1; let n = 0, sx = 0, sz = 0, worst = 0, wx = 0, wz = 0;
  while (q.length) {
    const j = q.pop(), x = j % W, z = (j / W) | 0;
    n++; sx += x; sz += z;
    if (far[j] > worst) { worst = far[j]; wx = x; wz = z; }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= D) continue;
      const k = nz * W + nx;
      if (!seen[k] && far[k] > LIMIT) { seen[k] = 1; q.push(k); }
    }
  }
  blobs.push({ cells: n, centre: [Math.round(sx / n), Math.round(sz / n)], emptiest: [wx, wz], dist: +worst.toFixed(1) });
}
blobs.sort((a, b) => b.cells - a.cells);
c.font = `${Math.max(11, S * 2)}px sans-serif`; c.fillStyle = '#fff';
blobs.slice(0, 20).forEach((b, k) => c.fillText(String(k + 1), X(b.centre[0]), Z(b.centre[1])));
window.__report = () => ({ pois: pois.length, reachable: cells, meanDist: +(sum / cells).toFixed(1), maxDist: +max.toFixed(1), farCells: over, farShare: +(over / cells * 100).toFixed(1) + '%', blobs: blobs.slice(0, 20) });
