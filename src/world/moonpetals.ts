import { fbm, mulberry32 } from '../engine/util';
import type { Builder } from './builder';
import { NONE, T, type Grid } from './grid';

// Moonpetals: the Moonlit Keep's own flower, five moon-blue petals that glow at night round a silver heart (the
// prototype's accent colour). They grow in drifts where the old magic lingers: inside the Seven Stones, among the
// barrows and the glowing arch, and under the wild trees of the Kings' Orchard. Realm 1's signature glow.

/** Where they grow: a centre, how far the drift reaches, and how thickly. */
const DRIFTS = [
  { x: 111.5, z: 88, r: 7.5, dense: 0.75 }, // the Seven Stones
  { x: 21, z: 76, r: 9, dense: 0.6 }, // the barrows and the arch
  { x: 24.5, z: 69.5, r: 3.5, dense: 0.7 }, // by the dolmen
  { x: 8.4, z: 13, r: 5, dense: 0.6 }, // the orchard's south end
  { x: 8.2, z: 25, r: 6, dense: 0.65 }, // under the orchard's middle trees
  { x: 8.2, z: 34, r: 4.5, dense: 0.6 }, // the orchard's north end
];

/** Ground they never grow on: paths, floors, decks and stream beds. */
const BARE: number[] = [T.Path, T.Cobble, T.Flag, T.Floor, T.Carpet, T.Wood, T.Bed, T.Sand, T.Gravel, T.Rock, T.Mud];

const PETAL: [number, number, number] = [0.32, 1.05, 2.4];
const HEART: [number, number, number] = [1.6, 1.8, 2.3];

export function buildMoonpetals(b: Builder, grid: Grid) {
  const keep = b.rng, r = (b.rng = mulberry32(8517));
  let n = 0;
  for (const d of DRIFTS) {
    // A jittered lattice over the drift, kept where a patch noise is high (clumps and gaps, never an even sprinkle).
    for (let gz = -d.r; gz <= d.r; gz += 0.55)
      for (let gx = -d.r; gx <= d.r; gx += 0.55) {
        const x = d.x + gx + (r() - 0.5) * 0.5, z = d.z + gz + (r() - 0.5) * 0.5;
        const fall = Math.hypot(x - d.x, z - d.z) / d.r;
        if (fall > 1) continue;
        const patch = fbm(x * 0.32, z * 0.32, 2, 41);
        if (patch < 0.48 + fall * 0.18 || r() > d.dense) continue;
        if (!growsAt(grid, x, z)) continue;
        flower(b, x, z, r);
        n++;
      }
  }
  b.rng = keep;
  return n;
}

function growsAt(grid: Grid, x: number, z: number) {
  if (BARE.includes(grid.typeAt(x, z))) return false;
  const y = grid.groundAt(x, z);
  if (grid.waterAt(x, z) !== NONE && grid.waterAt(x, z) > y - 0.05) return false;
  // Not on a slope, nor inside a stone, a tree or a wall.
  if (Math.abs(grid.groundAt(x + 0.4, z) - y) > 0.3 || Math.abs(grid.groundAt(x, z + 0.4) - y) > 0.3) return false;
  for (const c of grid.collidersNear(x, z)) {
    if (!c.on || c.y1 < y + 0.2 || c.y0 > y + 0.5) continue;
    if (c.kind === 'b' ? x > c.x0 - 0.15 && x < c.x1 + 0.15 && z > c.z0 - 0.15 && z < c.z1 + 0.15 : (x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + 0.2) ** 2) return false;
  }
  return true;
}

/** One flower: a dark stem, five glowing petals tilted up round a silver heart. */
function flower(b: Builder, x: number, z: number, r: () => number) {
  const y = b.y(x, z), h = 0.16 + r() * 0.2, s = 0.75 + r() * 0.5;
  b.d(x, z).box(x, y, z, 0.025, h, 0.025, '#24413c', { wind: 0.5 });
  const gl = b.gl(x, z);
  gl.push().translate(x, y + h, z).rotateY(r() * Math.PI * 2);
  for (let k = 0; k < 5; k++) {
    gl.push().rotateY((k / 5) * Math.PI * 2).rotateZ(0.45);
    gl.box(0.07 * s, -0.008, 0, 0.13 * s, 0.016, 0.055 * s, PETAL, { wind: 0.5 });
    gl.pop();
  }
  gl.box(0, 0, 0, 0.04, 0.03, 0.04, HEART, { wind: 0.5 });
  gl.pop();
}
