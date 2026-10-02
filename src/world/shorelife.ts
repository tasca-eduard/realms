import { K } from '../engine/materials';
import { mulberry32 } from '../engine/util';
import type { Builder } from './builder';
import { NONE, type Grid } from './grid';
import type { Pt } from './paint';
import { SEA, SHORE } from './sea';

// ---------------------------------------------------------------------------
// Life on the Sunken Reef's shore and surface: where it sits. Old mooring posts standing in the shallows off the
// crew's beach and the lighthouse isle (the gulls' perches), skerries of flat rock out in the water where the
// seals haul out to bask, and the perches the coast already has (the lighthouse's gallery, the village's roof
// ridges, the drowned towers' tops). What moves (the gulls, the seals, the crabs, the surf, the boats, the
// fish, the flotsam, the moths and the mist) is src/game/shorelife.ts.
// ---------------------------------------------------------------------------

/** Somewhere a gull lands: the top of a post, a rock, a roof ridge. */
export interface Perch { x: number; y: number; z: number }
/** Where a seal basks (x, y, z: the top of its rock), and the water it slides into (wx, wz). */
export interface HaulOut { x: number; y: number; z: number; wx: number; wz: number }
/** What the coast's life needs to know: perches, haul-outs, and the rocks the surf breaks round (x, z, r). */
export interface ShoreLifeDef { perches: Perch[]; seals: HaulOut[]; rocks: { x: number; z: number; r: number }[] }

/** The coast's life as last built (src/game/shorelife.ts brings it to life: the realm's data has no place for it). */
export let shoreLife: ShoreLifeDef = { perches: [], seals: [], rocks: [] };

/** Rows of old mooring posts, each from a to c: in the shallows off the crew's beach below the camp, off the
 *  lighthouse isle's east beach, and a broken row off the strand north of the sandbar. */
const POST_ROWS: [Pt, Pt][] = [[[45, 46.6], [53.5, 45]], [[108.4, 30.5], [109.6, 37.5]], [[76.5, 24.5], [80, 19.5]]];
/** The skerries where the seals bask: a reef of flat rocks north of the lighthouse isle, one off the far south-west
 *  shore, a pair east of the kelp forest; and on the ship's rock, its own low shelves. */
const SKERRIES: { x: number; z: number; n: number }[] = [
  { x: 87, z: 17.5, n: 4 },
  { x: 24.5, z: 100.5, n: 3 },
  { x: 112, z: 58, n: 2 },
];
const SHIP_ROCK = { x: 127, z: 44.5 };
/** The village's houses (as in realm3.ts: their angles round the shelf, 10.6 out from its middle) and the drowned
 *  kingdom's towers that break the surface (x, z, radius, height). */
const VILLAGE = { x: 37, z: 66 };
const HOUSES = [-52, -16, 22, 57, 92];
const TOWERS: [number, number, number, number][] = [[74.5, 79, 1.6, 6.4], [87.5, 73.8, 1.4, 5.6], [101, 75.5, 1.7, 6]];
const LIGHT = { x: 97, z: 29.5 };

const WEED = '#3a4a2a', GUANO = '#e4e2d8';

/** An old mooring post in the shallows: a squared timber, weathered grey, leaning a little, a band of weed and
 *  barnacles where the tide washes it, a rope's end still knotted round it. Returns its top. */
function mooringPost(b: Builder, x: number, z: number, top: number): Perch {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng, lean = (r() - 0.5) * 0.16, tilt = (r() - 0.5) * 0.16, w = 0.2 + r() * 0.06;
  g.push().translate(x, y - 0.3, z).rotateZ(lean).rotateX(tilt);
  const H = top - y + 0.3;
  g.box(0, 0, 0, w, H, w, r() < 0.5 ? SHORE.drift : SHORE.driftDark, { kind: K.Wood });
  g.box(0, H, 0, w + 0.02, 0.04, w + 0.02, GUANO);
  g.box(0, 0.3 - y - 0.25, 0, w + 0.05, 0.5, w + 0.05, WEED, { kind: K.Leaves });
  for (let k = 0; k < 6; k++) {
    const a = r() * Math.PI * 2;
    g.cyl(Math.cos(a) * w * 0.55, 0.3 - y - 0.6 + r() * 0.4, Math.sin(a) * w * 0.55, 0.04, 0.025, 0.05, 5, SEA.barnacle, { kind: K.Rock });
  }
  if (r() < 0.6) {
    g.cyl(0, H - 0.45, 0, w * 0.75, w * 0.75, 0.1, 6, SHORE.net, { kind: K.Cloth });
    g.beam([w * 0.6, H - 0.42, 0], [w * 0.6 + 0.3, H - 0.9, 0.15], 0.02, SHORE.net);
  }
  g.pop();
  b.collide({ kind: 'c', x, z, r: w * 0.7, y0: y - 1, y1: top });
  return { x: x - Math.sin(lean) * H, y: top + 0.02, z: z + Math.sin(tilt) * H };
}

/** A skerry rock rising from the floor to a little over the surface, its top flat and broad (a seal's couch),
 *  weed round its waterline, barnacles, the gulls' white on its crown. Returns its top's height. */
function skerry(b: Builder, x: number, z: number, s: number, sea: number) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng, top = sea + 0.3 + r() * 0.2;
  const rock = () => (r() < 0.5 ? SHORE.rock : SHORE.rockDark);
  // The stack under the water, broad at the floor, then the couch on top.
  const tall = top - y;
  g.blob(x, y + tall * 0.3, z, 1.25 * s, tall * 0.55, 1.1 * s, rock(), Math.floor(r() * 999), { kind: K.Rock, jitter: 0.2, flatBottom: true });
  g.blob(x + (r() - 0.5) * 0.3, top - 0.2, z + (r() - 0.5) * 0.3, 1.15 * s, 0.24, 1.0 * s, rock(), Math.floor(r() * 999), { kind: K.Rock, jitter: 0.12, flatBottom: true });
  g.blob(x + (r() - 0.5) * 0.5, top - 0.02, z + (r() - 0.5) * 0.5, 0.5 * s, 0.05, 0.42 * s, GUANO, Math.floor(r() * 999), { jitter: 0.3, flatBottom: true });
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + r() * 0.5;
    g.blob(x + Math.cos(a) * 1.05 * s, sea - 0.05, z + Math.sin(a) * 0.95 * s, 0.24 * s, 0.12, 0.2 * s, WEED, Math.floor(r() * 999), { kind: K.Leaves, jitter: 0.3, flatBottom: true });
    g.cyl(x + Math.cos(a + 0.3) * 1.1 * s, sea - 0.3 - r() * 0.6, z + Math.sin(a + 0.3) * 1.0 * s, 0.05, 0.03, 0.06, 5, SEA.barnacle, { kind: K.Rock });
  }
  b.collide({ kind: 'c', x, z, r: 1.05 * s, y0: y - 1, y1: top });
  return top;
}

/** Where the water off (x, z) is deep enough for a seal to slip into: out from its rock, the deepest way. */
function slipInto(grid: Grid, x: number, z: number, d: number) {
  let best = { wx: x + d, wz: z, h: Infinity };
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2, wx = x + Math.cos(a) * d, wz = z + Math.sin(a) * d, h = grid.groundAt(wx, wz);
    if (grid.waterAt(wx, wz) !== NONE && h < best.h) best = { wx, wz, h };
  }
  return { wx: best.wx, wz: best.wz };
}

/** The shore's perches and haul-outs: posts, skerries, the ship's rock's shelves; and the perches the coast already
 *  has. (Its own random stream, so nothing else shifts.) */
export function buildShoreLife(b: Builder, grid: Grid) {
  const keep = b.rng, r = (b.rng = mulberry32(3535)), sea = 0;
  const life: ShoreLifeDef = { perches: [], seals: [], rocks: [] };
  const wet = (x: number, z: number) => grid.waterAt(x, z) !== NONE;
  // The posts: in rows with gaps (one rotted away here and there), each a little out of line.
  for (const [a, c] of POST_ROWS) {
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    for (let s = 0; s <= len; s += 1.1 + r() * 0.5) {
      const x = a[0] + ((c[0] - a[0]) * s) / len + (r() - 0.5) * 0.4, z = a[1] + ((c[1] - a[1]) * s) / len + (r() - 0.5) * 0.4, h = grid.groundAt(x, z);
      if (r() < 0.2 || !wet(x, z) || h < -3) continue;
      life.perches.push(mooringPost(b, x, z, sea + 0.55 + r() * 0.75));
    }
  }
  // The skerries: flat rocks out in the water, a seal's couch on each (two on the broadest).
  for (const k of SKERRIES)
    for (let i = 0; i < k.n; i++) {
      const a = (i / k.n) * Math.PI * 2 + r() * 0.8, d = i ? 1.9 + r() * 0.9 : 0, x = k.x + Math.cos(a) * d, z = k.z + Math.sin(a) * d, h = grid.groundAt(x, z);
      if (!wet(x, z) || h > -0.6 || h < -6) continue;
      const s = 0.85 + r() * 0.45, top = skerry(b, x, z, s, sea);
      life.rocks.push({ x, z, r: 1.15 * s });
      const w = slipInto(grid, x, z, 1.4 * s + 1.4);
      life.seals.push({ x: x + (r() - 0.5) * 0.3, y: top, z: z + (r() - 0.5) * 0.3, ...w });
      if (s > 1.1) life.seals.push({ x: x + 0.55 * s, y: top, z: z - 0.4 * s, ...w });
      life.perches.push({ x: x - 0.45 * s, y: top, z: z + 0.35 * s });
    }
  // The ship's rock: seals on its low shelves just above the water, on the side away from the wreck.
  for (const a of [2.2, 3.6]) {
    for (let d = 1.5; d < 5; d += 0.25) {
      const x = SHIP_ROCK.x + Math.cos(a) * d, z = SHIP_ROCK.z + Math.sin(a) * d, h = grid.groundAt(x, z);
      if (wet(x, z) || h > 1.2) continue;
      if (!wet(x + Math.cos(a) * 1.2, z + Math.sin(a) * 1.2)) continue;
      life.seals.push({ x, y: h, z, ...slipInto(grid, x, z, 2.2) });
      break;
    }
  }
  // The perches already there: the lighthouse's gallery rail (on the side toward the camera), the ridges of the
  // village's roofs, the drowned towers' broken tops.
  const ly = grid.groundAt(LIGHT.x, LIGHT.z) + 0.66 + 7.5 + 0.4;
  for (const a of [0.3, 0.95, 1.5]) life.perches.push({ x: LIGHT.x + Math.cos(a) * 1.08, y: ly, z: LIGHT.z + Math.sin(a) * 1.08 });
  for (const deg of HOUSES) {
    const a = (deg * Math.PI) / 180, hx = VILLAGE.x + Math.cos(a) * 10.6, hz = VILLAGE.z + Math.sin(a) * 10.6;
    for (const k of [-0.9, 0.6]) life.perches.push({ x: hx + Math.cos(a) * k, y: 0.9 + 1.9 + 1.15 - 0.04, z: hz + Math.sin(a) * k });
  }
  for (const [x, z, rad, h] of TOWERS) {
    const y = grid.groundAt(x, z) + h;
    life.perches.push({ x: x + rad * 0.45, y, z: z + rad * 0.2 }, { x: x - rad * 0.3, y, z: z + rad * 0.45 });
    life.rocks.push({ x, z, r: rad });
  }
  b.rng = keep;
  shoreLife = life;
  return life;
}
