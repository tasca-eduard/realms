import type { Geo } from '../engine/geo';
import { K } from '../engine/materials';
import { fbm, mulberry32 } from '../engine/util';
import type { Builder } from './builder';
import { NONE, T, type Grid } from './grid';
import { reefClear } from './reef';

// ---------------------------------------------------------------------------
// What lives on the Sunken Reef's floor and doesn't swim (the swimmers are src/game/sealife.ts): starfish,
// sea urchins, sea cucumbers and shells, in clumps by a patch noise each, bare floor between, each where
// it would live. Starfish on the sand and the coral rubble of the shallows and the gardens (on the
// kingdom's flagstones too, in darker reds and purples); urchins packed close on the kelp's floor (the
// barrens between its groves) and among the ruins; sea cucumbers on the silt of the deep and the trench's
// floor; shells on the sand of the shallows, and a few thrown up along the tide line. Small and bright, so
// that they read through the water from the game's camera. (Clutter: no colliders, no shadow pass.)
// ---------------------------------------------------------------------------

type V3 = [number, number, number];

/** The palace across the trench (its landing and its hall, out to the map's south-east corner) and the plaza's
 *  middle are kept for the Tidelord's hall and the sunken bell; the ship's hull, the serpent's pen, the village's
 *  shelf have their own things on their floors. */
const KEEP: { x: number; z: number; r: number }[] = [
  { x: 122, z: 99, r: 10.5 },
  { x: 90, z: 86, r: 4.5 },
  { x: 121, z: 50, r: 7 },
  { x: 79, z: 37.6, r: 5 },
  { x: 37, z: 66, r: 10 },
  { x: 12, z: 12, r: 8 },
];

const STAR = {
  shallow: ['#f08a3a', '#e8503a', '#f0c050', '#d86a8a'],
  garden: ['#3a7ae8', '#f05a3a', '#f0a040', '#b04ad0', '#f070a0'],
  ruin: ['#a03a5a', '#7a3a9a', '#c0503a', '#e08a3a'],
};
const URCHIN = ['#2a1830', '#3a1a3a', '#1e1a2a', '#5a1e24'];
const CUKE = ['#4a2a1e', '#6a2618', '#2a2224', '#8a6a3a'];
const SHELL = ['#f0dcc0', '#f0b0a0', '#e8c890', '#f4ece0', '#d8a8c8'];

/** A triangle turned to face up (or down) whichever way its corners come. */
function face(g: Geo, a: V3, b: V3, c: V3, col: string, down = false) {
  const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
  if (ny > 0 !== down) g.tri(a, b, c, col, { kind: K.Rock });
  else g.tri(a, c, b, col, { kind: K.Rock });
}

/** A starfish lying on the floor: five arms from a raised middle, each with a ridge down its back and a curl
 *  of its own, a paler bump or two along it. */
export function starfish(b: Builder, x: number, z: number, s: number, rot: number, col: string) {
  const g = b.d(x, z), r = b.rng, y = b.y(x, z) + 0.02;
  const mid: V3 = [x, y + 0.07 * s, z];
  for (let k = 0; k < 5; k++) {
    const a = rot + (k / 5) * Math.PI * 2, L = (0.3 + r() * 0.08) * s, curl = (r() - 0.5) * 0.5, w = 0.1 * s;
    const ta = a + curl, tip: V3 = [x + Math.cos(ta) * L, y, z + Math.sin(ta) * L];
    const ridge: V3 = [x + Math.cos(a + curl * 0.4) * L * 0.45, y + 0.04 * s, z + Math.sin(a + curl * 0.4) * L * 0.45];
    const left: V3 = [x + Math.cos(a - 0.62) * w, y, z + Math.sin(a - 0.62) * w];
    const right: V3 = [x + Math.cos(a + 0.62) * w, y, z + Math.sin(a + 0.62) * w];
    face(g, mid, left, ridge, col);
    face(g, mid, ridge, right, col);
    face(g, left, tip, ridge, col);
    face(g, ridge, tip, right, col);
    if (r() < 0.7) g.box(ridge[0], ridge[1] - 0.012, ridge[2], 0.04 * s, 0.03, 0.04 * s, '#f4e8d0', { kind: K.Rock });
  }
}

/** A sea urchin: a dark ball bristling with spines (a long, thin spine to every side and up). */
export function urchin(b: Builder, x: number, z: number, s: number, col: string) {
  const g = b.d(x, z), r = b.rng, R = 0.12 * s, y = b.y(x, z) + R * 0.55;
  g.blob(x, y, z, R, R * 0.8, R, col, Math.floor(r() * 999), { kind: K.Rock, flatBottom: true });
  const n = 18, spine = col === URCHIN[3] ? '#8a2a2a' : '#4a2a52';
  for (let k = 0; k < n; k++) {
    // Spread over the upper half (a spiral of directions), each spine a thin three-sided spike.
    const t = (k + 0.5) / n, el = Math.asin(t * 0.95) - 0.1, az = k * 2.4 + r() * 0.3;
    const dx = Math.cos(el) * Math.cos(az), dy = Math.sin(el), dz = Math.cos(el) * Math.sin(az);
    const L = (0.22 + r() * 0.1) * s, base: V3 = [x + dx * R * 0.8, y + dy * R * 0.65, z + dz * R * 0.8];
    const tip: V3 = [base[0] + dx * L, base[1] + dy * L, base[2] + dz * L];
    const w = 0.018 * s, px = -dz, pz = dx;
    const c0: V3 = [base[0] + px * w, base[1], base[2] + pz * w], c1: V3 = [base[0] - px * w, base[1], base[2] - pz * w], c2: V3 = [base[0], base[1] + w * 1.4, base[2]];
    g.tri(c0, c1, tip, spine, { kind: K.Rock });
    g.tri(c1, c2, tip, spine, { kind: K.Rock });
    g.tri(c2, c0, tip, spine, { kind: K.Rock });
  }
}

/** A sea cucumber: a fat, warty sausage lying in a lazy curve on the silt, a frill of feeding tentacles at its
 *  front end. */
export function seaCucumber(b: Builder, x: number, z: number, s: number, rot: number, col: string) {
  const g = b.d(x, z), r = b.rng, y = b.y(x, z);
  const L = (0.6 + r() * 0.3) * s, bend = (r() - 0.5) * 0.9, pts: V3[] = [];
  for (let i = 0; i < 5; i++) {
    const t = i / 4 - 0.5, a = rot + bend * t;
    pts.push([x + Math.cos(a) * L * t, y + 0.07 * s, z + Math.sin(a) * L * t + Math.sin(t * 3) * bend * 0.1]);
  }
  g.sweep(pts, [0.06 * s, 0.085 * s, 0.09 * s, 0.08 * s, 0.05 * s], col, { seg: 6, lumpy: 0.3, squash: 0.75, seed: Math.floor(r() * 99), kind: K.Rock });
  // Warts along its back, paler (the leopard kind: dark spots instead).
  const spot = col === CUKE[3] ? '#2a1e14' : '#c89a7a';
  for (let i = 0; i < 6; i++) {
    const p = pts[1 + Math.floor(r() * 3)], k = r();
    const q = pts[Math.min(4, pts.indexOf(p) + 1)];
    g.cyl(p[0] + (q[0] - p[0]) * k + (r() - 0.5) * 0.06 * s, y + 0.12 * s, p[2] + (q[2] - p[2]) * k + (r() - 0.5) * 0.06 * s, 0.025 * s, 0, 0.05 * s, 4, spot, { kind: K.Rock });
  }
  if (r() < 0.6) {
    const f = pts[4];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      g.beam(f, [f[0] + Math.cos(a) * 0.08 * s, f[1] + 0.04 * s + Math.sin(a) * 0.05 * s, f[2] + Math.sin(a) * 0.08 * s], 0.012 * s, '#f0d8a0', { kind: K.Rock });
    }
  }
}

/** A shell on the sand: kind 0 a scallop (a ribbed fan, its hinge to one side), 1 a whelk (a spiral cone lying
 *  on its side), 2 a cockle (a ribbed half-dome). */
export function shell(b: Builder, x: number, z: number, s: number, rot: number, kind: number, col: string) {
  const g = b.d(x, z), r = b.rng, y = b.y(x, z) + 0.01;
  g.push().translate(x, y, z).rotateY(rot);
  if (kind === 0) {
    const R = 0.16 * s, ribs = 7;
    for (let k = 0; k < ribs; k++) {
      const a0 = -1.2 + (k / ribs) * 2.4, a1 = -1.2 + ((k + 1) / ribs) * 2.4, am = (a0 + a1) / 2;
      const p0: V3 = [Math.sin(a0) * R, 0.01, Math.cos(a0) * R], p1: V3 = [Math.sin(a1) * R, 0.01, Math.cos(a1) * R], pm: V3 = [Math.sin(am) * R * 0.85, 0.05 * s, Math.cos(am) * R * 0.85];
      face(g, [0, 0.02 * s, 0], p0, pm, k % 2 ? col : '#e8d0b8');
      face(g, [0, 0.02 * s, 0], pm, p1, k % 2 ? col : '#e8d0b8');
    }
    g.box(0, 0, -0.01, 0.07 * s, 0.03 * s, 0.04 * s, col, { kind: K.Rock });
  } else if (kind === 1) {
    g.push().translate(0, 0.06 * s, 0).rotateZ(Math.PI / 2 + 0.15);
    g.cyl(0, -0.12 * s, 0, 0.075 * s, 0, 0.26 * s, 6, col, { kind: K.Rock });
    for (const t of [0.25, 0.5]) g.cyl(0, -0.12 * s + t * 0.26 * s, 0, 0.075 * s * (1 - t) + 0.008, 0.075 * s * (1 - t - 0.12) + 0.008, 0.03 * s, 6, '#b08060', { kind: K.Rock, cap: false });
    g.pop();
    g.box(-0.1 * s, 0.03 * s, 0.02 * s, 0.05 * s, 0.05 * s, 0.07 * s, '#f0a090', { kind: K.Rock });
  } else {
    g.blob(0, 0, 0, 0.09 * s, 0.06 * s, 0.1 * s, col, Math.floor(r() * 999), { kind: K.Rock, flatBottom: true });
    for (let k = -1; k <= 1; k++) g.box(k * 0.035 * s, 0.045 * s, 0, 0.012 * s, 0.02 * s, 0.17 * s, '#b89a80', { kind: K.Rock });
  }
  g.pop();
}

/**
 * Dress the sea floor with its starfish, urchins, sea cucumbers and shells (and shells along the tide line),
 * clump by clump. Its own random stream, so that nothing drawn before or after it moves.
 */
export function dressSeaBed(b: Builder, grid: Grid) {
  const keep = b.rng, r = (b.rng = mulberry32(3535));
  const ground = (x: number, z: number) => grid.groundAt(x, z);
  const wet = (x: number, z: number) => grid.waterAt(x, z) !== NONE;
  // (Nor inside anything standing there: a wall, a column, a rock.)
  const inside = (x: number, z: number) => grid.collidersNear(x, z).some((c) => c.on && (c.kind === 'b' ? x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 : Math.hypot(x - c.x, z - c.z) < c.r));
  const ok = (x: number, z: number) => reefClear(x, z, 0.5) && !KEEP.some((k) => Math.hypot(x - k.x, z - k.z) < k.r) && !(x > 112 && z > 86) && grid.deck[grid.i(Math.floor(x), Math.floor(z))] === NONE && !inside(x, z);
  // (The realm's own ground: the grid reaches as far again past each edge.)
  const W = grid.w + grid.ox * 2, D = grid.d + grid.oz * 2;
  for (let z = 1; z < D - 1; z += 2.1)
    for (let x = 1; x < W - 1; x += 2.1) {
      const cx = x + r() * 1.8, cz = z + r() * 1.8, h = ground(cx, cz), t = grid.typeAt(cx, cz);
      if (!ok(cx, cz)) continue;
      const ruin = t === T.Flag || t === T.Cobble;
      // Each kind's patches: where its noise is high it lives in clumps, the more the higher.
      const star = fbm(cx * 0.08 + 11, cz * 0.08, 2, 301), urch = fbm(cx * 0.1 - 7, cz * 0.1, 2, 303);
      const cuke = fbm(cx * 0.07, cz * 0.07 + 5, 2, 305), shl = fbm(cx * 0.12 + 2, cz * 0.12 - 3, 2, 307);
      const under = wet(cx, cz);
      const clump = (n: number, spread: number, put: (px: number, pz: number, k: number) => void, fits: (px: number, pz: number) => boolean) => {
        for (let k = 0; k < n; k++) {
          const a = r() * Math.PI * 2, d = Math.sqrt(r()) * spread, px = cx + Math.cos(a) * d, pz = cz + Math.sin(a) * d;
          if (fits(px, pz) && ok(px, pz)) put(px, pz, k);
        }
      };
      if (!under) {
        // The tide line: shells thrown up on the wet sand just above the water.
        if (h > 0.25 || t !== T.Sand || shl < 0.6 || r() > 0.5) continue;
        if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => wet(cx + dx * 1.5, cz + dz * 1.5))) continue;
        clump(1 + Math.floor(r() * 3), 0.8, (px, pz) => shell(b, px, pz, 1 + r() * 0.3, r() * 6.3, Math.floor(r() * 3), SHELL[Math.floor(r() * SHELL.length)]), (px, pz) => !wet(px, pz) && ground(px, pz) < 0.3);
        continue;
      }
      if (h < -13) continue;
      // (Not every spot in a patch gets its clump: open floor between them.)
      const gardenish = t === T.Coral || (h < -1 && h > -4.6 && t === T.Seagrass), go = r();
      if (urch > 0.63 && h < -1.2 && h > -9.5 && (t === T.Seagrass || t === T.Silt || t === T.Gravel || ruin || t === T.Coral)) {
        // Urchins: packed close in their barrens, a few strays round the edge.
        if (go > 0.65) continue;
        const n = 2 + Math.floor((urch - 0.63) * 60 * r());
        clump(Math.min(14, n), 0.5 + n * 0.12, (px, pz) => urchin(b, px, pz, 0.85 + r() * 0.4, URCHIN[Math.floor(r() * URCHIN.length)]), (px, pz) => wet(px, pz) && ground(px, pz) < -1.1);
      } else if (cuke > 0.64 && h < -3.4 && (t === T.Silt || t === T.Sand || t === T.Gravel || t === T.Seagrass)) {
        if (go > 0.5) continue;
        // Sea cucumbers: a few together on the silt, lying every which way.
        clump(1 + Math.floor(r() * 3), 1.4, (px, pz) => seaCucumber(b, px, pz, 0.7 + r() * 0.3, r() * 6.3, CUKE[Math.floor(r() * CUKE.length)]), (px, pz) => ground(px, pz) < -3.2);
      } else if (star > 0.62 && h < -0.2 && h > -7 && (t === T.Sand || t === T.Coral || t === T.Seagrass || t === T.Gravel || ruin)) {
        // Starfish: the shallows' oranges and reds, the gardens' blues and purples, the ruins' darker ones.
        if (go > 0.4) continue;
        const pal = ruin ? STAR.ruin : gardenish ? STAR.garden : STAR.shallow;
        clump(1 + Math.floor((star - 0.6) * 22 * r()), 1.3, (px, pz) => starfish(b, px, pz, 0.9 + r() * 0.5, r() * 6.3, pal[Math.floor(r() * pal.length)]), (px, pz) => wet(px, pz) && ground(px, pz) < -0.2);
      } else if (shl > 0.6 && h < -0.2 && h > -4.6 && (t === T.Sand || t === T.Coral || t === T.Gravel)) {
        if (go > 0.5) continue;
        clump(2 + Math.floor(r() * 4), 1.1, (px, pz) => shell(b, px, pz, 1 + r() * 0.4, r() * 6.3, Math.floor(r() * 3), SHELL[Math.floor(r() * SHELL.length)]), (px, pz) => wet(px, pz) && ground(px, pz) < -0.2);
      }
    }
  b.rng = keep;
}
