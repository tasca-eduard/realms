import { K } from '../engine/materials';
import type { Col } from '../engine/geo';
import { fbm, hexToLinear, mulberry32, type Rng } from '../engine/util';
import { MOBILE } from '../config';
import { PAL, type Builder } from './builder';
import { NONE, T, type Grid } from './grid';
import { distLine, type Pt } from './paint';
import type { MapKit } from './realm';
import { bough, diceAt, trunkUp, WOOD } from './wood';

// ---------------------------------------------------------------------------
// Whisperwood's colours (group 92). The Old Wood's leaves by zone, so each part of the wood reads as its own
// from the path and on the map: silver birches on the verges, copper and gold beeches in the Old Grove,
// blue-black pines in the East Woods and on the rims, rust in the Withered Wood, lime-green oaks in the Deep
// Wood, teal under the High Canopy, willow-greys by the waters, and one tree in twelve an odd tone (a gold, a
// scarlet, a plum, a silver among the green). Then colour put in by hand: white hawthorns in blossom by the
// Heartpool, rowans hung with red berries along the lanes, a copper beech on the far side of each glade, the
// Withered Wood's last rust leaves, the prototype's pink campion and foxgloves (#e86a8a) in drifts, and ivy
// hanging in stretches down the cliffs the camera sees (short and flowering, never to the foot: the vines
// that climb are the ledges' full curtains).
// ---------------------------------------------------------------------------

type Rgb = [number, number, number];
const lin = (hex: string): Rgb => hexToLinear(hex);
const hashAt = (x: number, z: number, k = 0) => {
  const s = Math.sin(x * 91.7 + z * 247.3 + k * 37.1) * 43758.5453;
  return s - Math.floor(s);
};

/** Each zone's leaves, by kind of tree (zones and kinds not named keep the colour they had). */
const TONES: Record<string, Partial<Record<string, string[]>>> = {
  // The thorn road's verge: silver birches, pale and bright.
  verge: { birch: ['#b8c89a', '#a6ba8a', '#c6d0aa', '#9fb488'], oak: ['#6e8e46', '#7c9a52'], bush: ['#6a8a4a', '#76925a'], giant: ['#a8572e', '#c08a2c', '#b46a2e'] },
  // The Old Grove: copper beeches and gold, a little green between.
  grove: { oak: ['#a4532c', '#b8682e', '#c0882e', '#8e4226', '#c89a3a', '#5a7a34'], giant: ['#a8572e', '#c08a2c', '#b46a2e', '#94442a', '#b8802a'], birch: ['#c8a03a', '#bc8e36', '#b8c08a'], bush: ['#8a5a2a', '#6a6a30', '#7a4a26'] },
  village: { oak: ['#4e7e32', '#5a8a38', '#467636'], birch: ['#8ea85c', '#9cb468'], bush: ['#4a7a30', '#58883a'], home: ['#3b6b2a', '#4a7c30', '#2f6a44', '#56843a', '#3e6e3a'] },
  meadow: { birch: ['#9cb46a', '#acc078', '#b8c48a'], bush: ['#5a8a3a', '#6a964a'], oak: ['#5a8a38'] },
  // The High Canopy: teal-greens in the giants' shade.
  canopy: { oak: ['#2f6a4a', '#3a7a52'], giant: ['#2e6a4c', '#3a7656', '#28604a', '#347054'], bush: ['#2a5a40', '#336a48'], pine: ['#1f4038', '#24483e'] },
  // The East Woods and the rims: blue-black pines.
  pines: { pine: ['#1c3244', '#22394e', '#1a2c3c', '#263e52'], oak: ['#2e4a44'], bush: ['#2a4440'] },
  rim: { pine: ['#1e3446', '#243c50', '#1c3040'], bush: ['#3a4a3a', '#4a5238'], birch: ['#8a9a7a'] },
  // The waters' edges: willow-greys and silver birches.
  mere: { birch: ['#a2b08e', '#8e9e7c', '#b0bc9a'], bush: ['#5e7250', '#6a7c56'], oak: ['#5a7050'] },
  bank: { birch: ['#a6b48a', '#92a478', '#b4c096'], bush: ['#4e7044', '#5a7c4a', '#64824e'], oak: ['#4e7a46', '#5a8450'] },
  // The Deep Wood: lime-green oaks, dark pines.
  deep: { oak: ['#6e9a2a', '#7aa630', '#62902a', '#567e24', '#86ae36'], pine: ['#1e3a2a', '#24442e', '#1a3426'], bush: ['#4a7a2a', '#5a8a30'], birch: ['#a0b85a'] },
  kilns: { birch: ['#a4ac54', '#b4b85e', '#98a44c'], bush: ['#6a7a3a', '#7a8442'] },
  // The Warden's heights: rust, where anything still has leaves.
  thorns: { oak: ['#8a4420', '#a0582a', '#6e3418', '#b4662e'], bush: ['#7a4422', '#8a5428'], pine: ['#3a3e36'], birch: ['#a8743a'] },
  wood: { oak: ['#3d5e33', '#4a6b36', '#527438', '#46663a', '#5a7a3c'], pine: ['#2a4a3c', '#325642', '#2c4e46', '#26443a'], birch: ['#7a9a4a', '#8aa456', '#98ae64'], bush: ['#3b6b2a', '#4a6b36', '#44703a'] },
};
/** One tree in twelve: an odd tone among its neighbours. */
const ODD = ['#b8522e', '#b88a30', '#9aa83c', '#7a4a6a', '#b0baa2', '#9a3a2e'];
const ODD_PINE = ['#9c8a3c', '#3e6474', '#5a6a3a'];
/** The colours each tree was drawn with, and how light each is within its tree (the dark side, the light, the top). */
const SHADE: Record<string, number> = {
  [PAL.oak]: 0.9, [PAL.oak2]: 1.06, [PAL.pine]: 0.9, [PAL.pine2]: 1.06, '#6a8a3e': 0.94, '#7a9444': 1.05,
  [WOOD.leaf]: 0.88, [WOOD.leaf2]: 1, '#4a7a34': 1.16, '#44603a': 0.92,
};
/** Bushes are recoloured only from the wood's plain greens (a bush given its own colour keeps it). */
const BUSH = new Set<string>([PAL.oak, PAL.oak2, WOOD.leaf2, '#44603a']);

/**
 * The leaf colours of Whisperwood's trees by zone (set on the builder before the wood is grown: every tree's
 * dice stay as they were, only its colour changes). `zoneAt` is the realm's own zone map.
 */
export function woodTones(zoneAt: (x: number, z: number) => string) {
  return (kind: string, x: number, z: number, col: Col): Col => {
    if (typeof col !== 'string') return col;
    if (kind === 'bush' && !BUSH.has(col)) return col;
    let zone = zoneAt(x, z);
    // (The Old Grove's ancient oaks reach out to the verge: all of them copper and gold.)
    if (kind === 'giant' && (zone === 'verge' || zone === 'village' || zone === 'kilns')) zone = 'grove';
    const group = kind === 'great' ? 'giant' : kind;
    const list = TONES[zone]?.[group];
    const u = hashAt(x, z), shade = SHADE[col] ?? 1;
    let hex: string;
    if (kind !== 'home' && kind !== 'great' && u < 1 / 12) hex = (kind === 'pine' ? ODD_PINE : ODD)[Math.floor(hashAt(z, x, 3) * (kind === 'pine' ? ODD_PINE.length : ODD.length))];
    else if (list) hex = list[Math.floor(hashAt(x, z, 1) * list.length)];
    else return col;
    // A little of each tree's own: lighter or darker, warmer or cooler.
    const c = lin(hex), f = shade * (0.9 + hashAt(x, z, 2) * 0.2), w = (hashAt(x, z, 4) - 0.5) * 0.08;
    return [c[0] * f * (1 + w), c[1] * f, c[2] * f * (1 - w)];
  };
}

/** What the realm tells this module about where things are. */
export interface WoodPlaces {
  zoneAt: (x: number, z: number) => string;
  kit: MapKit;
  /** Places to keep clear (people's spots, set pieces, the village). */
  keepOut: (x: number, z: number) => boolean;
  /** Where foes and animals start (kept clear in the village too). */
  people: Pt[];
  /** A point `out` metres beyond the Heartpool's shore, at angle `a` round it. */
  byLake: (a: number, out: number) => Pt;
  /** The lanes the rowans grow along. */
  lanes: Pt[][];
  /** Glades: centre and how far they reach (a copper beech on the far side of each). */
  glades: [number, number, number][];
  /** The Withered Wood's floor. */
  withered: (x: number, z: number) => boolean;
  /** Ground dressed by hand, where no drift of flowers goes. */
  bare: (x: number, z: number) => boolean;
  /** Cliff faces with vines to climb (no ivy there). */
  climb: (x: number, z: number) => boolean;
}

/** Nothing solid within rad (the buckets round the spot, not just its own). */
function clearAt(grid: Grid, x: number, z: number, rad: number) {
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++)
      for (const c of grid.collidersNear(x + dx, z + dz))
        if (c.on && (c.kind === 'c' ? Math.hypot(x - c.x, z - c.z) < c.r + rad : x > c.x0 - rad && x < c.x1 + rad && z > c.z0 - rad && z < c.z1 + rad)) return false;
  return true;
}

/** Room for a tree: dry, level, off the paths, nothing solid near, no one's place (in the village only its people's). */
function treeRoom(grid: Grid, at: WoodPlaces, x: number, z: number, rad: number, road = 2.4, village = false) {
  if (!grid.inside(Math.floor(x), Math.floor(z)) || [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => grid.typeAt(x + dx, z + dz) === T.Path)) return false;
  if (grid.deck[grid.i(Math.floor(x), Math.floor(z))] !== NONE) return false;
  if (village ? at.people.some(([px, pz]) => Math.hypot(x - px, z - pz) < 2.5) : at.keepOut(x, z)) return false;
  return !at.kit.nearRoad(x, z, road) && at.kit.flatAround(x, z, rad * 0.8) && clearAt(grid, x, z, rad);
}

/** A rowan: a slender grey trunk, a light feathery crown, bunches of red berries hanging all over it. */
function rowan(b: Builder, x: number, z: number, s: number, r: Rng) {
  const g = b.g(x, z), gl = b.gl(x, z), y = b.y(x, z), d = diceAt(x, z, 21);
  const at = trunkUp(g, x, y, z, 0.12 * s, 0.06 * s, 2.7 * s, '#7a746a', d, { seg: 6, lean: 0.3 * s, sway: 0.1, flare: 0.3, lumpy: 0.06 });
  const tips: [number, number, number][] = [[...at(y + 2.7 * s)].map((v, i) => (i === 1 ? v + 0.2 * s : v)) as [number, number, number]];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + r() * 1.2, from = at(y + (1.4 + k * 0.35) * s);
    const to: [number, number, number] = [from[0] + Math.cos(a) * 0.95 * s, from[1] + (0.6 + r() * 0.4) * s, from[2] + Math.sin(a) * 0.95 * s];
    bough(g, from, to, 0.05 * s, 0.025 * s, '#7a746a', d, 0.1);
    tips.push(to);
  }
  // Autumn has begun in some: their leaves gone orange.
  const turned = r() < 0.3;
  for (const [cx, cy, cz] of tips)
    for (let k = 0; k < 2; k++)
      g.blob(cx + (r() - 0.5) * 0.6 * s, cy + (r() - 0.3) * 0.4 * s, cz + (r() - 0.5) * 0.6 * s, (0.45 + r() * 0.2) * s, (0.35 + r() * 0.15) * s, (0.45 + r() * 0.2) * s, turned ? (r() < 0.5 ? '#c0642a' : '#a8502a') : r() < 0.5 ? '#6a9a3a' : '#7aa646', Math.floor(r() * 999), { kind: K.Leaves, wind: 0.5, jitter: 0.25 });
  // The berries: bunches under the leaves, a faint glow of their own so they read red at night.
  for (let k = 0; k < 9; k++) {
    const [cx, cy, cz] = tips[k % tips.length], a = r() * Math.PI * 2, rr = (0.35 + r() * 0.3) * s, bx = cx + Math.cos(a) * rr, bz = cz + Math.sin(a) * rr, by = cy - (0.15 + r() * 0.3) * s;
    for (let j = 0; j < 4; j++) gl.box(bx + (r() - 0.5) * 0.14, by - r() * 0.12, bz + (r() - 0.5) * 0.14, 0.07, 0.07, 0.07, [0.52, 0.05, 0.035], { wind: 0.5 });
  }
  b.collide({ kind: 'c', x, z, r: 0.16 * s, y0: y - 1, y1: y + 3.5 * s });
}

/** A hawthorn in blossom: a short gnarled trunk, a low wide dome of dark leaves foamed over with white. */
function hawthorn(b: Builder, x: number, z: number, s: number, r: Rng) {
  const g = b.g(x, z), gl = b.gl(x, z), dg = b.d(x, z), y = b.y(x, z), d = diceAt(x, z, 22);
  const at = trunkUp(g, x, y, z, 0.17 * s, 0.1 * s, 1.7 * s, '#5a4a3e', d, { seg: 7, lean: 0.55 * s, sway: 0.2, flare: 0.45, lumpy: 0.15 });
  const tips: [number, number, number][] = [at(y + 1.7 * s)];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + r() * 0.9, from = at(y + (0.9 + r() * 0.6) * s);
    const to: [number, number, number] = [from[0] + Math.cos(a) * 1.1 * s, from[1] + (0.3 + r() * 0.4) * s, from[2] + Math.sin(a) * 1.1 * s];
    bough(g, from, to, 0.07 * s, 0.03 * s, '#5a4a3e', d, 0.05);
    tips.push(to);
  }
  for (const [cx, cy, cz] of tips) {
    g.blob(cx, cy + 0.1 * s, cz, (0.6 + r() * 0.25) * s, (0.45 + r() * 0.15) * s, (0.6 + r() * 0.25) * s, r() < 0.5 ? '#3a5a2c' : '#46663a', Math.floor(r() * 999), { kind: K.Leaves, wind: 0.3, jitter: 0.25 });
    // The blossom: pale clusters over the top and the sides, specks of it catching the light.
    for (let k = 0; k < 4; k++) {
      const a = r() * Math.PI * 2, rr = (0.35 + r() * 0.3) * s, bx = cx + Math.cos(a) * rr, bz = cz + Math.sin(a) * rr, by = cy + (0.15 + r() * 0.35) * s;
      g.blob(bx, by, bz, 0.24 * s, 0.17 * s, 0.24 * s, r() < 0.6 ? '#ece6da' : '#f2dcdc', Math.floor(r() * 999), { kind: K.Leaves, wind: 0.3, jitter: 0.3 });
      gl.box(bx + (r() - 0.5) * 0.2, by + 0.12 * s, bz + (r() - 0.5) * 0.2, 0.06, 0.05, 0.06, [0.34, 0.33, 0.3], { wind: 0.3 });
    }
  }
  // Fallen petals on the grass under it.
  for (let k = 0; k < 14; k++) {
    const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 1.6 * s, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
    if (b.grid.waterAt(px, pz) === NONE) dg.box(px, b.y(px, pz) + 0.01, pz, 0.07, 0.015, 0.07, '#e8e2d6');
  }
  b.collide({ kind: 'c', x, z, r: 0.22 * s, y0: y - 1, y1: y + 2.6 * s });
}

/**
 * A broad beech: a smooth grey trunk, great limbs, a wide dome of leaves in `tones` (the copper beech of a
 * glade; sparse, the Withered Wood's last dying one).
 */
function beech(b: Builder, x: number, z: number, s: number, r: Rng, tones: string[], sparse = false) {
  const g = b.g(x, z), y = b.y(x, z), d = diceAt(x, z, 23);
  const at = trunkUp(g, x, y, z, 0.3 * s, 0.18 * s, 3.3 * s, sparse ? '#6a625a' : '#7a7672', d, { seg: 8, lean: 0.35 * s, sway: 0.1, flare: 0.4, lumpy: 0.05 });
  const tips: [number, number, number][] = [[...at(y + 3.3 * s)].map((v, i) => (i === 1 ? v + 0.5 * s : v)) as [number, number, number]];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + r() * 0.8, from = at(y + (2 + r() * 0.9) * s);
    const to: [number, number, number] = [from[0] + Math.cos(a) * 1.9 * s, from[1] + (0.9 + r() * 0.6) * s, from[2] + Math.sin(a) * 1.9 * s];
    bough(g, from, to, 0.13 * s, 0.05 * s, sparse ? '#6a625a' : '#7a7672', d, 0.05);
    tips.push(to);
  }
  for (const [cx, cy, cz] of tips)
    for (let k = 0; k < (sparse ? 1 : 3); k++) {
      const top = k === 2, col = top ? tones[tones.length - 1] : tones[Math.floor(r() * (tones.length - 1))];
      g.blob(cx + (r() - 0.5) * 1.4 * s, cy + (top ? 0.5 : (r() - 0.4) * 0.6) * s, cz + (r() - 0.5) * 1.4 * s, (sparse ? 0.55 : 0.95 + r() * 0.35) * s, (sparse ? 0.4 : 0.7 + r() * 0.25) * s, (sparse ? 0.55 : 0.95 + r() * 0.35) * s, col, Math.floor(r() * 999), { kind: K.Leaves, wind: 0.25, jitter: 0.25, detail: 1 });
    }
  b.collide({ kind: 'c', x, z, r: 0.34 * s, y0: y - 1, y1: y + 5 * s });
}
const COPPER = ['#6e2c2a', '#8a3a2c', '#7a3228', '#9a4a30', '#b0603a'];
const RUST = ['#8a4420', '#6e3418', '#a0582a', '#b8702e'];

/** Campion: a clump of thin stems, each with a pink five-petalled head. */
function campion(b: Builder, x: number, z: number, r: Rng) {
  const dg = b.d(x, z), gl = b.gl(x, z), n = 3 + Math.floor(r() * 4);
  for (let k = 0; k < n; k++) {
    const fx = x + (r() - 0.5) * 0.5, fz = z + (r() - 0.5) * 0.5, y = b.y(fx, fz), h = 0.25 + r() * 0.25;
    dg.box(fx, y, fz, 0.025, h, 0.025, '#3e5a34', { skip: { nx: true, nz: true } });
    gl.box(fx, y + h, fz, 0.11, 0.05, 0.11, r() < 0.8 ? '#e86a8a' : '#f09ab0', { shade: 0.34, skip: { nx: true, nz: true } });
  }
}

/** A foxglove: a rosette of leaves, a tall spike hung with pink bells, smaller toward its tip. */
function foxglove(b: Builder, x: number, z: number, r: Rng) {
  const dg = b.d(x, z), gl = b.gl(x, z), y = b.y(x, z), h = 0.75 + r() * 0.45, col = r() < 0.7 ? '#e86a8a' : r() < 0.5 ? '#c860a0' : '#f0e8e0';
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + r();
    dg.push().translate(x + Math.cos(a) * 0.14, y + 0.03, z + Math.sin(a) * 0.14).rotateY(-a);
    dg.box(0, 0, 0, 0.28, 0.03, 0.1, '#4a6a3a');
    dg.pop();
  }
  dg.box(x, y, z, 0.035, h, 0.035, '#3e5a34', { wind: 0.3, skip: { nx: true, nz: true } });
  for (let k = 0; k < 6; k++) {
    const t = 0.35 + (k / 6) * 0.6, a = k * 2.4, w = 0.1 - k * 0.01;
    gl.box(x + Math.cos(a) * 0.05, y + h * t, z + Math.sin(a) * 0.05, w, 0.09, w, col, { shade: 0.32, wind: 0.3, skip: { nx: true, nz: true } });
  }
}

/** Ivy down a cliff face from its lip (x, z at h), `drop` deep, hanging toward (nx, nz): never to the foot. */
function ivy(b: Builder, x: number, z: number, h: number, drop: number, nx: number, nz: number, r: Rng) {
  const g = b.g(x, z), gl = b.gl(x, z), len = drop * (0.3 + r() * 0.45), steps = 4;
  let prev: [number, number, number] = [x, h + 0.05, z];
  const flowers = r() < 0.3;
  for (let k = 1; k <= steps; k++) {
    const t = k / steps, sway = Math.sin(t * 3 + x) * 0.12;
    const p: [number, number, number] = [x + nx * 0.06 + sway * Math.abs(nz), h - len * t, z + nz * 0.06 + sway * Math.abs(nx)];
    g.beam(prev, p, 0.022, '#35602a', { wind: 0.15 });
    for (let j = 0; j < 2; j++) {
      const o = (j ? 1 : -1) * (0.06 + r() * 0.06), ly = (prev[1] + p[1]) / 2 - r() * 0.1;
      g.box(p[0] + o * Math.abs(nz) + nx * 0.04, ly, p[2] + o * Math.abs(nx) + nz * 0.04, 0.16, 0.12, 0.16, r() < 0.5 ? '#3b6b2a' : '#4e8034', { kind: K.Leaves, wind: 0.3, skip: { ny: true } });
    }
    if (flowers && k % 2 === 0) gl.box(p[0] + nx * 0.09, p[1] + 0.05, p[2] + nz * 0.09, 0.08, 0.06, 0.08, r() < 0.6 ? '#e86a8a' : '#e8e4d8', { shade: 0.34 });
    prev = p;
  }
  g.blob(prev[0] + nx * 0.05, prev[1], prev[2] + nz * 0.05, 0.18, 0.14, 0.18, '#3b6b2a', Math.floor(r() * 999), { kind: K.Leaves, wind: 0.3, jitter: 0.3 });
}

/** What was put where in the last build (for checks: tests/woodcolours.js). */
export const WOOD_COLOURS = { trees: [] as [string, number, number][], counts: {} as Record<string, number> };

export function buildWoodColours(b: Builder, grid: Grid, at: WoodPlaces) {
  const keep = b.rng, r = (b.rng = mulberry32(9292));
  WOOD_COLOURS.trees = [];
  const n = { rowans: 0, hawthorns: 0, beeches: 0, rust: 0, campion: 0, foxgloves: 0, ivy: 0 };
  try {
    // ---------- white hawthorns by the Heartpool ----------
    // Just outside the lakeside path, where the shore is open and nobody's way goes (in blossom, low: they
    // hide nothing).
    for (const a0 of [-0.95, 0.6, 0.3, 2.35]) {
      if (n.hawthorns === 3) break;
      for (let out = 4.6; out < 8; out += 0.4) {
        const [x, z] = at.byLake(a0, out);
        if (!treeRoom(grid, at, x, z, 1.3, 2.3, true)) continue;
        hawthorn(b, x, z, 0.95 + r() * 0.25, r);
        WOOD_COLOURS.trees.push(['hawthorn', x, z]);
        n.hawthorns++;
        break;
      }
    }
    // ---------- rowans along the lanes ----------
    // Every eight to fourteen metres, three metres off the way, on its far side from the camera where it can be.
    for (const lane of at.lanes) {
      let next = 3 + r() * 5, run = 0;
      for (let k = 0; k < lane.length - 1; k++) {
        const [ax, az] = lane[k], [bx, bz] = lane[k + 1], len = Math.hypot(bx - ax, bz - az);
        for (; next < run + len; next += 8 + r() * 6) {
          const t = (next - run) / len, px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
          let nx = -(bz - az) / len, nz = (bx - ax) / len;
          if (nx + nz > 0.15) [nx, nz] = [-nx, -nz];
          const off = 2.9 + r() * 0.8, x = px + nx * off, z = pz + nz * off;
          if (distLine(lane, x, z) < 2.6 || !treeRoom(grid, at, x, z, 1.1, 2.5)) continue;
          rowan(b, x, z, 0.9 + r() * 0.3, r);
          WOOD_COLOURS.trees.push(['rowan', x, z]);
          n.rowans++;
        }
        run += len;
      }
    }
    // ---------- a copper beech at the far side of each glade ----------
    for (const [gx, gz, gr] of at.glades) {
      let done = false;
      for (let ring = 0; ring < 5 && !done; ring++)
        for (let k = 0; k < 9 && !done; k++) {
          const a = Math.PI * 1.25 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.22, rr = gr + 1 + ring * 0.8;
          const x = gx + Math.cos(a) * rr, z = gz + Math.sin(a) * rr;
          if (!treeRoom(grid, at, x, z, 1.8, 2.6)) continue;
          beech(b, x, z, 1.15 + r() * 0.2, r, COPPER);
          WOOD_COLOURS.trees.push(['copper beech', x, z]);
          n.beeches++;
          done = true;
        }
    }
    // ---------- the Withered Wood's last leaves ----------
    // Rust tufts clinging to the dead trees' tops, and a few beeches dying in rust among them.
    for (const [px, py, pz] of b.perches) {
      if (!at.withered(px, pz) || r() > 0.6) continue;
      const g = b.g(px, pz);
      for (let k = 0; k < 3 + Math.floor(r() * 3); k++)
        g.blob(px + (r() - 0.5) * 1.3, py - r() * 1, pz + (r() - 0.5) * 1.3, 0.22 + r() * 0.2, 0.16 + r() * 0.12, 0.22 + r() * 0.2, RUST[Math.floor(r() * RUST.length)], Math.floor(r() * 999), { kind: K.Leaves, wind: 0.4, jitter: 0.35 });
      n.rust++;
    }
    for (let k = 0, dying = 0; k < 60 && dying < 7; k++) {
      const x = 2 + r() * 32, z = 33 + r() * 14;
      if (!at.withered(x, z) || !treeRoom(grid, at, x, z, 1.6, 2.6)) continue;
      beech(b, x, z, 0.75 + r() * 0.3, r, RUST, true);
      WOOD_COLOURS.trees.push(['dying beech', x, z]);
      n.beeches++;
      dying++;
    }
    // ---------- campion and foxgloves ----------
    // In drifts where a wide patch noise is high, more on the verges, banks and meadows (campion) and in the
    // cut and broken ground of the kilns, the grove and the wood's edges (foxgloves); none on paths or water.
    const CAMPION: Record<string, number> = { verge: 1, bank: 0.9, meadow: 0.9, village: 0.45, grove: 0.55, kilns: 0.5, mere: 0.5, wood: 0.35, canopy: 0.25, deep: 0.2, pines: 0.1 };
    const FOXGLOVE: Record<string, number> = { kilns: 1, grove: 0.65, verge: 0.5, canopy: 0.45, wood: 0.4, deep: 0.35, village: 0.25, bank: 0.2, meadow: 0.3 };
    const thin = MOBILE ? 0.5 : 1;
    for (let z0 = 2; z0 < 118; z0 += 2.1)
      for (let x0 = 2; x0 < 118; x0 += 2.1) {
        const x = x0 + r() * 1.6, z = z0 + r() * 1.6, zone = at.zoneAt(x, z), u = r(), v = r();
        const patch = fbm(x * 0.075 + 13, z * 0.075 - 9, 2, 92);
        if (patch < 0.56) continue;
        const pc = (CAMPION[zone] ?? 0) * (patch - 0.5) * 2.4 * thin, pf = (FOXGLOVE[zone] ?? 0) * (patch - 0.5) * 1.6 * thin;
        if (u > pc + pf) continue;
        if (!grid.inside(Math.floor(x), Math.floor(z)) || grid.waterAt(x, z) !== NONE || grid.typeAt(x, z) === T.Path || at.bare(x, z)) continue;
        if (grid.deck[grid.i(Math.floor(x), Math.floor(z))] !== NONE || at.kit.nearRoad(x, z, 1.3) || !clearAt(grid, x, z, 0.35)) continue;
        if (u < pc) {
          for (let k = 0; k < 2 + Math.floor(v * 3); k++) campion(b, x + (r() - 0.5) * 1.4, z + (r() - 0.5) * 1.4, r);
          n.campion++;
        } else {
          for (let k = 0; k < 2 + Math.floor(v * 3); k++) {
            const fx = x + (r() - 0.5) * 1.3, fz = z + (r() - 0.5) * 1.3;
            if (grid.waterAt(fx, fz) === NONE && clearAt(grid, fx, fz, 0.2)) foxglove(b, fx, fz, r);
          }
          n.foxgloves++;
        }
      }
    // ---------- ivy down the cliffs ----------
    // On the faces the camera sees, in stretches with long bare runs between.
    for (let z = 1; z < 119; z++)
      for (let x = 1; x < 119; x++) {
        const i = grid.i(x, z), h = grid.h[i];
        if (grid.water[i] !== NONE || grid.deck[i] !== NONE) continue;
        let drop = 0, nx = 0, nz = 0;
        for (const [dx, dz] of [[1, 0], [0, 1]]) {
          const j = grid.i(x + dx, z + dz), below = grid.deck[j] !== NONE ? grid.deck[j] : grid.h[j];
          if (h - below > drop) [drop, nx, nz] = [h - below, dx, dz];
        }
        if (drop < 2.4 || at.climb(x + 0.5, z + 0.5)) continue;
        const stretch = fbm(x * 0.12 + 31, z * 0.12 - 17, 2, 93);
        if (stretch < 0.52 || r() > (stretch - 0.5) * 3.2) continue;
        const strands = 1 + Math.floor(r() * 2);
        for (let k = 0; k < strands; k++) {
          const o = (r() - 0.5) * 0.8, fx = x + 0.5 + nx * 0.52 + o * nz, fz = z + 0.5 + nz * 0.52 + o * nx;
          ivy(b, fx, fz, h, drop, nx, nz, r);
          n.ivy++;
        }
      }
  } finally {
    b.rng = keep;
  }
  WOOD_COLOURS.counts = n;
  return n;
}
