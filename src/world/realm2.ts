import * as THREE from 'three';
import { K } from '../engine/materials';
import { P } from '../engine/particles';
import { mulberry32, fbm, rand, type Rng } from '../engine/util';
import { GLOW, PAL, type Builder } from './builder';
import { Grid, NONE, S, T } from './grid';
import { Painter, distLine, insidePoly, sdPoly, type Pt } from './paint';
import type { CritterDef } from '../game/critters';
import * as D from './details';
import { MOBILE } from '../config';
import { MapKit, dressRealm, forest, waterPoints, type EnemySpawn, type ObjDef, type RealmData, type RegionDef } from './realm';
import { bramble, giantMushroom, giantOak, greatTree, homeTree, ropeBridge, thicket, WOOD } from './wood';

// ---------------------------------------------------------------------------
// Realm 2: Whisperwood, the Old Wood (the prototype's second realm).
// 120 x 120. Screen-up is toward (-x, -z): the journey runs from the thorn road in
// the south-east (up from Blackpine) to the Warden's Hold in the north-west.
//
//   south-east   the thorn road comes over the brook: the Warden's Stone (moonfire)
//   south        the Old Grove: ancient oaks, where the goblins wait in the bushes
//   middle       Hollowbough: treehouses on four knolls round a black pond, rope bridges
//   east         the High Canopy: giant trunks, roots you climb, a perch above it all
//   north-east   the east woods, and the rope bridge over Rookfall Chasm
//   north        the Thorn Ravine: a shelf under the northern cliffs, black water below
//   north-west   the Overhang, the stair, and the Warden's Hold round the Great Tree
//   west         the Ring of Oaks, the herbwife's glade, the Mossfen (no path: a secret)
//   past the river (the Whisper), on the Blackwater's shore: the gatherers' clearing
//
// Edges (no invisible walls): the Old Wood's heights to the north and west (tall, the
// far side), the gorge along the east (the same gorge as in realm 1), the brook along
// the south. Nothing tall on the near (south and east) sides.
// ---------------------------------------------------------------------------

export const MAP_W = 120;
export const MAP_D = 120;
const FLOOR = 2;

// Waters.
const RIVER: Pt[] = [[-6, 53.5], [6, 57], [16, 55.2], [24, 50.8], [32, 48.6], [40, 50.8], [48, 52.4], [56, 52.4], [64, 50], [72, 48.4], [80, 50.6], [90.5, 50]];
const BROOK: Pt[] = [[-6, 115.5], [10, 118], [22, 116], [34, 113.8], [46, 115.5], [58, 117.8], [70, 116], [82, 114.6], [94, 116.6], [106, 117.4], [112, 116.8], [119.5, 117]];
const BLACKWATER: Pt[] = [[31, 24.5], [35, 21], [41, 20], [46, 22.5], [51, 20.5], [56, 23], [61, 19.5], [67, 21], [72, 24], [77, 20.5], [83.5, 21.5], [85, 27], [82, 31.5], [84.5, 36.5], [80, 41], [75, 38.5], [70, 41.8], [65, 38], [59, 40.5], [54, 37], [48, 39.5], [43, 37.5], [38, 35], [34, 31], [31.5, 28]];
/** Where a west-to-east line (a river) crosses x. */
const lineZ = (pts: Pt[], x: number) => {
  for (let k = 1; k < pts.length; k++)
    if (x <= pts[k][0]) {
      const [ax, az] = pts[k - 1], [bx, bz] = pts[k], t = Math.max(0, Math.min(1, (x - ax) / (bx - ax)));
      return az + (bz - az) * t;
    }
  return pts[pts.length - 1][1];
};
const MOSSFEN: Pt[] = [[6, 96], [26, 97], [34, 106], [30, 113], [8, 113], [5, 104]];
// High ground.
const HOLD: Pt[] = [[0, 0], [37, 0], [37, 6], [34, 14], [33, 30], [35, 40], [29, 46.5], [0, 46.5]];
const CHASM = { x0: 88, x1: 99, z0: 4, z1: 53 }; // its tip takes the whole Whisper
// Hollowbough: a village of great home trees round a lake (the Heartpool), the Heart Oak on
// an island in the middle reached by two rope bridges. POND is the lake's centre; lakeR its
// shore's distance from the centre at an angle (a wavy round, never a square).
const POND = { x: 56, z: 74 };
const lakeR = (a: number) => 11.5 + 1.8 * Math.sin(2 * a + 0.6) + 1.2 * Math.sin(3 * a + 2.1) + 0.7 * Math.sin(5 * a + 0.4);
const ISLAND_R = 4.6;
/** A point `out` metres beyond the lake's shore at angle a. */
const byLake = (a: number, out: number): Pt => [POND.x + Math.cos(a) * (lakeR(a) + out), POND.z + Math.sin(a) * (lakeR(a) + out)];
// The home trees: where round the lake, and which way their doors face (toward the camera side).
const HOMES = {
  inn: { a: -2.3, out: 5, s: 1.15, face: 0.84, treehouse: true }, // by the Whisper, clear of the Fallen Giant
  lodge: { a: -0.9, out: 6.5, s: 1.05, face: 1.3, treehouse: true },
  smithy: { a: 0.75, out: 6.5, s: 1, face: 0.4, treehouse: false },
  ash: { a: 2.3, out: 6.5, s: 0.95, face: 0.73, treehouse: true },
};
/** The lakeside path round the Heartpool. */
const LAKE_RING: Pt[] = Array.from({ length: 25 }, (_, k) => byLake((k / 24) * Math.PI * 2, 2.4));
// The High Canopy: giant trunks with roots stepping up round them.
// Roots step up round each trunk a metre a step (turn: where round the trunk the top step is).
// The fourth has no steps: a shelf of root on its north side, reached only by the rope walk
// from the second's top over the Mirror Pool.
const CANOPY: { x: number; z: number; top: number; turn?: number; shelf?: boolean }[] = [
  { x: 97, z: 70, top: 5 },
  { x: 109, z: 62, top: 6, turn: 0.1 },
  { x: 104, z: 91, top: 4 },
  { x: 110, z: 84, top: 6, shelf: true },
  { x: 118, z: 78, top: 5, turn: 0.5 },
];
const MIRROR = { x: 109, z: 73.5, rx: 3.5, rz: 7 };
const WALK = { x: 109, z0: 66.4, z1: 80.9 };
// The Deer Meadow's hunter's stand: a platform on posts, a ladder up its south side.
const STAND = { x0: 85, x1: 87, z0: 79, z1: 81, top: 5.5 };
// The Fallen Giant: a great trunk lying across the Whisper (a way over, and no path to it).
const LOG = { x: 38, z0: 43.2, z1: 56.8 };
// The Drowned Shrine: an island in the Blackwater, stepping stones out from the south shore.
const SHRINE = { x: 65, z: 30, r: 2.8 };
// The Withered Wood on the Warden's heights, and the grave of the knight who came before.
const GRAVE = { x: 12, z: 40.5 };
// The Sea Stair beyond the Withered Wood (in the land past the map's west edge).
const SEA = { z0: 22, z1: 50, stair: 36, level: -3 };
const PAD_W = 26;
// The Mushroom Dell against the western cliff.
const DELL = { x: 11, z: 89.6 };
// The Charcoal Kilns south of the village, and the lane to them.
const KILNS = { x: 45, z: 104 };
const LANE_KILNS: Pt[] = [byLake(1.65, 2.4), [56, 96], [53, 100.5], [50.5, 102]];
// The Bat Roost: a cleft in the East Woods' northern cliff.
const ROOST = { x0: 108, x1: 112, z0: 1, z1: 6 };
const RING = { x: 22, z: 66, r: 6 };
// The Stag's Thicket: where the Warden's thorns hold the Thornstag.
const STAG = { x: 11, z: 73 };
// Two ledges under the northern cliffs, reached only up their vines (their treasures come with group 16).
const LEDGES = [
  { x0: 41, x1: 46, z0: 7, z1: 11 }, // above the Overhang (whole cells: the face is at z = 11)
  { x0: 65, x1: 69, z0: 7, z1: 11 }, // over the Thorn Ravine
];
const LEDGE_H = 5;
// A niche in the cliff under the Overhang's rock, sealed by a cracked rock (the prototype's
// overhang secret): two cells wide, its mouth at z = 10.
const NICHE = { x0: 37, x1: 39, z0: 6, z1: 10 };
// Where the goblins keep Wren caged, in the gatherers' clearing.
const CAGE = { x: 43.4, z: 41.6 };
const GLADE = { x: 22, z: 86 };
const CLEARING = { x: 46, z: 43 };
// The old owl's snag, by the foot of the ramp up to Hollowbough, and how high it sits.
const OWL: Pt = [62.4, 93.6];
const OWL_PERCH = 2.5;
// The Warden's Hold: the hollow Great Tree, a ring of thorn-trees round it with one gate facing
// the stair, a pit of thorns before the gate and a drawbridge over it, and a tree-tower whose
// roof lever lowers the bridge (reached up its vines; five cells from the niche's walls, so no
// jump from its roof reaches the northern heights).
// The Warden's Hold (all grown, nothing built): the stair from the Overhang comes up into a gully
// between two masses of rock; living thorns grow across it, fed by the Thorn Heart on a rock
// spire by the stair's foot (climbed by its vines). Past the gully, the Warden's grove; the
// Great Tree stands at the back, and its arena is the hollow between two of its great roots on
// the near (south) side, thorns growing shut across its mouth behind the knight.
const GREAT = { x: 13, z: 14 };
const ROCKS_N: Pt[] = [[26.5, 3.5], [34, 4], [36.5, 8], [35, 12.6], [29.5, 12.5], [26, 9]];
const ROCKS_S: Pt[] = [[26.5, 17.5], [33.5, 17.5], [35.5, 21], [34, 27], [29, 27.5], [26, 22]];
const GULLY = { x0: 26, x1: 34, z0: 13, z1: 17 };
const SPIRE = { x0: 38, x1: 40, z0: 17, z1: 19, top: 7 };
const ARENA = { x0: GREAT.x - 5.6, x1: GREAT.x + 5.6, z0: GREAT.z + 3.6, z1: GREAT.z + 12.3 };
const HOLD_H = 5;


// Paths to every place with a purpose. (The Mossfen and the canopy's perch get none.)
const ROAD_IN: Pt[] = [[112.5, 119.5], [112, 113], [109, 108], [102, 104.5], [92, 102.5], [82, 100], [75, 97.5], [69.5, 95.6], byLake(1.05, 2.4)];
const ROAD_EAST: Pt[] = [byLake(-0.35, 2.4), [74, 66.5], [84, 64.8], [91, 66]];
const ROAD_NORTH: Pt[] = [[101, 64], [104.5, 57], [107, 48], [106, 38], [102.5, 31], [100.5, 30]];
const RAVINE_PATH: Pt[] = [[86.5, 30], [86, 24], [83, 17], [74, 13.5], [62, 12.5], [52, 13.5], [44, 15], [40, 16]];
const LANE_BANK: Pt[] = [[86.5, 31], [86, 38], [83.5, 44.5], [72, 45.2], [60, 45.4], [52, 44.5], [47, 43.5]];
const LANE_WEST: Pt[] = [byLake(2.75, 2.4), [36, 80], [32, 78], [29, 75], [26.5, 70.5]];
const LANE_GLADE: Pt[] = [[33, 80.5], [29.5, 84], [25.5, 85.5]];
const LANE_STAG: Pt[] = [[16.2, 66.5], [13.5, 69], [12, 70.8]];
const STAIR = { x0: 33, x1: 37, z0: 13, z1: 17 };
const HOLD_PATH: Pt[] = [[33, 15], [27, 15], [24, 19], [22.5, 24.5], [18.5, 28], [13, 28.2]];

// How wooded each part of the Old Wood is (the same scale as forest()'s density): deep only where
// the wood is the point (the East Woods' pines and patrols; the Deep Wood round the Stag's
// Thicket), light under the giants and between places, open over meadows, the grove and the waters.
const DEEP_WEST: Pt[] = [[0, 57], [24, 58.5], [33, 62], [31, 78], [34, 95], [14, 95.5], [0, 95.5]];
const DEER_MEADOW: Pt[] = [[75, 69], [86, 67.5], [92, 74], [90, 86.5], [81, 90.5], [74, 85]];
const hash = (x: number, z: number) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
/**
 * The Old Wood's zones, each with its own ground, trees, undergrowth and relief (as realm 1's
 * places each have theirs). zoneAt() wobbles its borders so none ends on a straight line.
 */
type ZoneId = 'verge' | 'grove' | 'village' | 'meadow' | 'canopy' | 'pines' | 'rim' | 'mere' | 'bank' | 'deep' | 'fen' | 'kilns' | 'thorns' | 'wood';
type TreeKind = 'pine' | 'oak' | 'birch' | 'dead' | 'bush';
type PlantKind = 'fern' | 'flower' | 'mushroom' | 'rock' | 'log' | 'stump' | 'reeds' | 'moon' | 'thorn';
interface ZoneStyle {
  /** Trees per sample (0..~0.35), their kinds by weight, their size. */
  density: number;
  trees: [TreeKind, number][];
  size: number;
  /** Ground types, mostly the first. */
  ground: number[];
  /** Undergrowth per sample, and its kinds by weight. */
  under: number;
  plants: [PlantKind, number][];
}
const ZONES: Record<ZoneId, ZoneStyle> = {
  // The thorn road's verge: birches, bracken and meadow grass where the traveller comes in.
  verge: { density: 0.1, size: 1, trees: [['birch', 5], ['oak', 3], ['bush', 2]], ground: [T.Grass, T.DarkGrass], under: 0.22, plants: [['fern', 4], ['flower', 4], ['rock', 2]] },
  // The Old Grove: leaf litter and moss under the ancient oaks, ferns, moonflowers, few young trees.
  grove: { density: 0.03, size: 1.1, trees: [['oak', 6], ['birch', 2], ['bush', 2]], ground: [T.Moss, T.Dirt, T.Grass], under: 0.32, plants: [['fern', 5], ['moon', 2], ['mushroom', 2], ['log', 1]] },
  village: { density: 0.015, size: 1, trees: [['birch', 6], ['bush', 4]], ground: [T.Grass], under: 0.14, plants: [['flower', 7], ['fern', 3]] },
  meadow: { density: 0.012, size: 1, trees: [['birch', 8], ['bush', 2]], ground: [T.Grass], under: 0.28, plants: [['flower', 8], ['rock', 2]] },
  // The High Canopy: moss and ferns in the giants' shade, glowing fungi, little else grows.
  canopy: { density: 0.035, size: 1, trees: [['bush', 5], ['oak', 3], ['pine', 2]], ground: [T.Moss, T.DarkGrass], under: 0.45, plants: [['fern', 5], ['mushroom', 4], ['log', 1]] },
  // The East Woods: close pines on rocky ridges, needles and stone underfoot.
  pines: { density: 0.34, size: 1.15, trees: [['pine', 9], ['dead', 1]], ground: [T.DarkGrass, T.Dirt, T.Rock], under: 0.22, plants: [['rock', 5], ['fern', 3], ['mushroom', 2]] },
  // Rookfall's rims and the Thorn Ravine: gravel, stone, dead trees, thorn scrub.
  rim: { density: 0.05, size: 0.9, trees: [['dead', 5], ['pine', 3], ['bush', 2]], ground: [T.Gravel, T.Rock, T.DarkGrass], under: 0.25, plants: [['rock', 6], ['thorn', 4]] },
  // The Blackwater's shores: mud and reed beds, birches and drowned trees.
  mere: { density: 0.05, size: 0.95, trees: [['birch', 4], ['dead', 3], ['bush', 3]], ground: [T.Grass, T.Mud, T.Reeds], under: 0.3, plants: [['reeds', 6], ['fern', 2], ['flower', 2]] },
  bank: { density: 0.05, size: 0.95, trees: [['bush', 5], ['birch', 3], ['oak', 2]], ground: [T.Grass, T.Reeds], under: 0.25, plants: [['reeds', 5], ['flower', 3], ['fern', 2]] },
  // The Deep Wood: old oaks and pines close together, moss, ferns, fungi, fallen trunks.
  deep: { density: 0.3, size: 1.2, trees: [['oak', 55], ['pine', 35], ['dead', 5], ['bush', 5]], ground: [T.DarkGrass, T.Moss], under: 0.45, plants: [['fern', 5], ['mushroom', 3], ['log', 1], ['rock', 1]] },
  fen: { density: 0, size: 1, trees: [], ground: [], under: 0, plants: [] },
  // Round the Charcoal Kilns the wood has been cut: stumps, young birches, bare earth.
  kilns: { density: 0.03, size: 0.85, trees: [['birch', 6], ['bush', 4]], ground: [T.Dirt, T.Grass], under: 0.4, plants: [['stump', 6], ['log', 2], ['fern', 2]] },
  // The Warden's heights: withered trees and thorns.
  thorns: { density: 0.05, size: 1, trees: [['dead', 8], ['bush', 2]], ground: [T.DarkGrass, T.Mud], under: 0.25, plants: [['thorn', 5], ['rock', 3], ['mushroom', 2]] },
  // Everywhere else: mixed woodland.
  wood: { density: 0.14, size: 1, trees: [['oak', 45], ['pine', 35], ['birch', 10], ['bush', 10]], ground: [T.DarkGrass, T.Grass], under: 0.25, plants: [['fern', 4], ['mushroom', 2], ['flower', 2], ['rock', 2]] },
};
function zoneAt(x: number, z: number): ZoneId {
  const wx = x + (fbm(x * 0.06, z * 0.06, 2, 87) - 0.5) * 7, wz = z + (fbm(x * 0.06 + 9, z * 0.06, 2, 89) - 0.5) * 7;
  if (insidePoly(HOLD, x, z)) return 'thorns';
  if (insidePoly(MOSSFEN, wx, wz)) return 'fen';
  if (Math.hypot(x - POND.x, z - POND.z) < lakeR(Math.atan2(z - POND.z, x - POND.x)) + 11) return 'village';
  if (sdPoly(BLACKWATER, x, z) < 5) return 'mere';
  if (wx > 100 && wz < 56) return 'pines';
  if ((x > 84 && x < 104 && z < 56) || (wz < 24 && wx < 88)) return 'rim';
  if (distLine(RIVER, x, z) < 5.5 || distLine(BROOK, x, z) < 5) return 'bank';
  if (insidePoly(DEER_MEADOW, wx, wz)) return 'meadow';
  if (wx > 88 && wz > 56 && wz < 96) return 'canopy';
  if (Math.hypot(wx - KILNS.x, wz - KILNS.z) < 13) return 'kilns';
  if (wx > 96 && wz > 96) return 'verge';
  if (wx > 54 && wz > 90) return 'grove';
  if (insidePoly(DEEP_WEST, wx, wz)) return 'deep';
  return 'wood';
}
/** A weighted choice, u in 0..1. */
function pick<K>(list: [K, number][], u: number): K {
  let t = list.reduce((s, [, w]) => s + w, 0) * u;
  for (const [k, w] of list) if ((t -= w) <= 0) return k;
  return list[list.length - 1][0];
}
/** Depth of a shelving shore: `e` is the signed distance to the shoreline (negative in the water).
 * Wadeable shallows for the first 1.6 m, then down toward `deep` below the water. */
const shelve = (e: number, level: number, deep: number) => (e > -1.6 ? level - 0.25 : level - 0.25 - Math.min(deep, (-e - 1.6) * 0.8));

export function buildRealm2(builder: Builder): RealmData {
  const grid = builder.grid;
  const p = new Painter(grid);
  const r = mulberry32(2026);
  const b = builder;

  // ---------- terrain ----------
  p.rect(0, 0, MAP_W, MAP_D, { h: FLOOR, t: T.DarkGrass, side: S.Dirt });
  // The Old Wood's heights along the far (north and west) edges.
  p.each((x, z, i) => {
    const n = fbm(x * 0.09, z * 0.09, 3, 41) * 3;
    if (z < 3 + n || (x < 3.5 + n && z > 44) || (x > 38 && x < 90 && z < 8.5 + n)) {
      grid.h[i] = 8 + Math.round(n);
      grid.t[i] = T.DarkGrass;
      grid.side[i] = S.Rock;
    }
  });
  // The Warden's high ground in the north-west.
  p.poly(HOLD, { h: 5, t: T.DarkGrass, side: S.Rock }, 1.2, 7);
  // A few whole-step rises in the woods (never half-steps).
  p.each((x, z, i) => {
    if (grid.h[i] === FLOOR && x > 70 && z > 55 && fbm(x * 0.08, z * 0.08, 3, 43) > 0.68) grid.h[i] = FLOOR + 1;
  });
  // The Whisper, running east into the chasm, and the brook along the south edge.
  p.stream(RIVER, 5.2, FLOOR - 0.35, FLOOR - 3.2, 1.3, 51);
  p.stream(BROOK, 4.6, FLOOR - 0.4, FLOOR - 2.8, 1.1, 53);
  // Past the brook the bank rises steeply (the thorn road's bridge is the only way over).
  p.each((x, z, i) => {
    if (grid.water[i] === NONE && z + 0.5 > lineZ(BROOK, x + 0.5) + 1 && (x < 110 || x > 115)) {
      grid.h[i] = FLOOR + 2;
      grid.t[i] = T.DarkGrass;
      grid.side[i] = S.Dirt;
    }
  }, 0, 110, MAP_W, MAP_D);
  // The Blackwater: a still, deep mere under the Warden's heights, shelving at its shores.
  p.each((x, z, i) => {
    const d = sdPoly(BLACKWATER, x + 0.5, z + 0.5) + (fbm(x * 0.12, z * 0.12, 2, 57) - 0.5) * 2.6;
    if (d < 0) {
      grid.h[i] = shelve(d, FLOOR - 0.35, 2.1);
      grid.t[i] = T.Bed;
      grid.water[i] = FLOOR - 0.35;
      grid.noGrass[i] = 1;
      grid.side[i] = S.Dirt;
    } else if (d < 1.4 && grid.h[i] === FLOOR) grid.t[i] = d < 0.7 ? T.Mud : T.Reeds;
  }, 28, 16, 90, 46);
  // Rookfall Chasm: a crack in the wood from the northern cliffs down to the Whisper.
  p.each((x, z, i) => {
    const w = (CHASM.x1 - CHASM.x0) / 2 - Math.max(0, (z - 47.5) * 0.7) + (fbm(x * 0.3, z * 0.3, 2, 59) - 0.5) * 1.2;
    const cx = (CHASM.x0 + CHASM.x1) / 2 + Math.sin(z * 0.12) * 1.2;
    if (Math.abs(x + 0.5 - cx) < w) {
      grid.h[i] = -13;
      grid.t[i] = T.Rock;
      grid.water[i] = NONE;
      grid.side[i] = S.Rock;
      grid.noGrass[i] = 1;
    }
  }, CHASM.x0 - 2, CHASM.z0, CHASM.x1 + 2, CHASM.z1);
  // The Mossfen: shallow pools and mud in the south-west, found by leaving the paths.
  p.each((x, z, i) => {
    if (!insidePoly(MOSSFEN, x + 0.5, z + 0.5) || grid.water[i] !== NONE) return;
    const n = fbm(x * 0.18, z * 0.18, 3, 61);
    if (n > 0.6) {
      grid.h[i] = FLOOR - 0.5;
      grid.water[i] = FLOOR - 0.2;
      grid.t[i] = T.Bed;
      grid.noGrass[i] = 1;
    } else grid.t[i] = n > 0.5 ? T.Mud : n > 0.4 ? T.Reeds : T.Moss;
  });
  // Hollowbough: the black pond, the four knolls, and ramps up onto three of them.
  // The Heartpool: a lake with a wavy shore that shelves (sand, then shallows you can wade, then
  // deep), and the Heart Oak's island in the middle.
  p.each((x, z, i) => {
    const dx = x + 0.5 - POND.x, dz = z + 0.5 - POND.z, d = Math.hypot(dx, dz);
    const e = d - lakeR(Math.atan2(dz, dx)) + (fbm(x * 0.25, z * 0.25, 2, 63) - 0.5) * 1.2;
    if (d < ISLAND_R) {
      grid.t[i] = d < ISLAND_R - 0.8 ? T.Moss : T.Sand;
      grid.noGrass[i] = d < ISLAND_R - 0.8 ? 0 : 1;
    } else if (e < 0) {
      grid.h[i] = shelve(Math.max(e, ISLAND_R - d - 0.6), FLOOR - 0.35, 2.2);
      grid.t[i] = T.Bed;
      grid.water[i] = FLOOR - 0.35;
      grid.noGrass[i] = 1;
      grid.side[i] = S.Dirt;
    } else if (e < 1.3) {
      grid.t[i] = e < 0.6 ? T.Sand : T.Reeds;
      grid.noGrass[i] = e < 0.6 ? 1 : 0;
    } else if (d < lakeR(Math.atan2(dz, dx)) + 13) grid.t[i] = T.Grass;
  }, POND.x - 30, POND.z - 30, POND.x + 30, POND.z + 30);
  // The Mirror Pool among the giants: black water under the rope walk.
  p.each((x, z, i) => {
    const dx = (x + 0.5 - MIRROR.x) / MIRROR.rx, dz = (z + 0.5 - MIRROR.z) / MIRROR.rz;
    const k = Math.hypot(dx, dz) + (fbm(x * 0.3, z * 0.3, 2, 83) - 0.5) * 0.55 + Math.sin(Math.atan2(dz, dx) * 3 + 1.2) * 0.12, under = Math.abs(x + 0.5 - WALK.x) < 1 && z + 0.5 > WALK.z0 + 0.5 && z + 0.5 < WALK.z1 - 0.5;
    if (k < 1 || under) {
      grid.h[i] = k > 0.75 && !under ? FLOOR - 0.6 : FLOOR - 2;
      grid.t[i] = T.Bed;
      grid.water[i] = FLOOR - 0.35;
      grid.noGrass[i] = 1;
      grid.side[i] = S.Dirt;
    }
  }, MIRROR.x - 5, MIRROR.z - 9, MIRROR.x + 5, MIRROR.z + 9);
  // The High Canopy: roots stepping up round each giant trunk, a metre a step.
  for (const c of CANOPY)
    p.each((x, z, i) => {
      const dx = x + 0.5 - c.x, dz = z + 0.5 - c.z, d = Math.hypot(dx, dz);
      if (c.shelf) {
        // A sheer shelf of root on the north side, as high as the other's top.
        if (d >= 1 && d < 4.1 && dz < 0.6) {
          grid.h[i] = c.top;
          grid.side[i] = S.Wood;
          grid.t[i] = T.Moss;
          grid.water[i] = NONE;
          grid.dir[i] = -1;
        }
        return;
      }
      if (d > 4.6 || d < 1) return;
      const a = ((Math.atan2(dz, dx) + Math.PI) / (Math.PI * 2) + (c.turn ?? 0)) % 1; // 0..1 round the trunk
      const step = Math.floor(a * (c.top - FLOOR + 1));
      grid.h[i] = Math.max(grid.h[i], Math.min(c.top, FLOOR + step));
      grid.side[i] = S.Wood;
      grid.t[i] = step >= c.top - FLOOR ? T.Moss : T.DarkGrass;
      grid.dir[i] = -1;
    }, c.x - 5, c.z - 5, c.x + 5, c.z + 5);
  // Each zone's own ground (mostly its first type, patches of the others).
  p.each((x, z, i) => {
    if (grid.water[i] !== NONE || grid.h[i] > 7 || (grid.t[i] !== T.DarkGrass && grid.t[i] !== T.Grass)) return;
    const gs = ZONES[zoneAt(x + 0.5, z + 0.5)].ground;
    if (!gs.length) return;
    const n = fbm(x * 0.21, z * 0.21, 2, 93);
    grid.t[i] = gs[n > 0.62 && gs.length > 2 ? 2 : n > 0.5 && gs.length > 1 ? 1 : 0];
  });
  // Relief: the East Woods' pine ridges (rock outcrops in whole steps) and the Deep Wood's mossy
  // root mounds, never on a path or at a place with a purpose.
  const spots: [number, number, number][] = [[STAG.x, STAG.z, 9], [RING.x, RING.z, RING.r + 5], [GLADE.x, GLADE.z, 7], [DELL.x, DELL.z, 8], [110, 7, 6], [103.5, 33.5, 5], [100, 30, 5], [100, 12.5, 6]];
  p.each((x, z, i) => {
    if (grid.h[i] !== FLOOR || grid.water[i] !== NONE) return;
    const zone = zoneAt(x + 0.5, z + 0.5);
    if (zone !== 'pines' && zone !== 'deep') return;
    if ([ROAD_NORTH, LANE_WEST, LANE_GLADE, LANE_STAG, LANE_BANK].some((l) => distLine(l, x + 0.5, z + 0.5) < 3)) return;
    if (spots.some(([sx, sz, sr]) => Math.hypot(x + 0.5 - sx, z + 0.5 - sz) < sr)) return;
    const n = fbm(x * 0.08, z * 0.08, 3, zone === 'pines' ? 91 : 95);
    if (zone === 'pines' && n > 0.6) {
      grid.h[i] = FLOOR + (n > 0.7 ? 2 : 1);
      grid.side[i] = S.Rock;
      grid.t[i] = n > 0.7 ? T.Rock : T.DarkGrass;
    } else if (zone === 'deep' && n > 0.7) {
      grid.h[i] = FLOOR + 1;
      grid.side[i] = S.Dirt;
      grid.t[i] = T.Moss;
    }
  });
  // The stair from the Overhang up onto the Warden's heights.
  p.ramp(STAIR.x0, STAIR.z0, STAIR.x1, STAIR.z1, 2, FLOOR, 5, true, T.Flag);
  // The ravine shelf under the northern cliffs: level, stony.
  p.flattenAlong(RAVINE_PATH.slice(2, -1), 4.2, FLOOR);
  // Paths (after the ground they cross).
  p.path(ROAD_IN, 2.4, T.Path, 0.5, 3);
  for (const [l, w, k] of [[ROAD_EAST, 2, 4], [ROAD_NORTH, 2, 5], [RAVINE_PATH, 2.2, 6], [LANE_BANK, 1.7, 7], [LANE_WEST, 1.7, 8], [LANE_GLADE, 1.5, 9], [HOLD_PATH, 1.8, 10], [LANE_STAG, 1.5, 11], [LANE_KILNS, 1.6, 12], [LAKE_RING, 1.7, 14]] as [Pt[], number, number][])
    p.path(l, w, T.Path, 0.45, k, false);
  // The Stag's Thicket: a hollow among mossy rocks in the Deep Wood, trampled earth in its floor,
  // open only toward the lane (the rocks round it are too high to climb).
  {
    const gap = Math.atan2(LANE_STAG[0][1] - STAG.z, LANE_STAG[0][0] - STAG.x);
    p.each((x, z, i) => {
      const dx = x + 0.5 - STAG.x, dz = z + 0.5 - STAG.z, d = Math.hypot(dx, dz), a = Math.atan2(dz, dx);
      const rim = 4.6 + (fbm(x * 0.35, z * 0.35, 2, 101) - 0.5) * 1.6 + Math.sin(a * 3 + 1) * 0.5;
      const open = Math.abs(Math.atan2(Math.sin(a - gap), Math.cos(a - gap))) < 0.42;
      if (d < rim - 0.4) {
        grid.t[i] = d < 2.8 ? T.Dirt : T.Moss;
        grid.noGrass[i] = d < 2.8 ? 1 : 0;
      } else if (d < rim + 2.2 + fbm(x * 0.5, z * 0.5, 2, 103) * 1.2 && !open) {
        grid.h[i] = FLOOR + (d < rim + 1 ? 2 : 3);
        grid.side[i] = S.Rock;
        grid.t[i] = fbm(x * 0.6, z * 0.6, 2, 105) > 0.5 ? T.Moss : T.Rock;
        grid.noGrass[i] = 1;
      }
    }, STAG.x - 10, STAG.z - 10, STAG.x + 10, STAG.z + 10);
  }
  // The two masses of rock either side of the stair's top (tall enough that nothing climbs them),
  // the gully between them, and the Thorn Heart's spire by the stair's foot.
  for (const poly of [ROCKS_N, ROCKS_S]) p.poly(poly, { h: HOLD_H + 4, t: T.Rock, side: S.Rock, noGrass: true }, 0.8, 97);
  p.each((x, z, i) => {
    if (grid.h[i] === HOLD_H + 4 && fbm(x * 0.3, z * 0.3, 2, 99) > 0.55) grid.h[i] = HOLD_H + 5;
  }, 24, 2, 38, 30);
  p.rect(GULLY.x0, GULLY.z0 - 2, GULLY.x1, GULLY.z0, { h: HOLD_H + 4, t: T.Rock, side: S.Rock, noGrass: true });
  p.rect(GULLY.x0, GULLY.z1, GULLY.x1, GULLY.z1 + 2, { h: HOLD_H + 4, t: T.Rock, side: S.Rock, noGrass: true });
  p.rect(GULLY.x0, GULLY.z0, GULLY.x1, GULLY.z1, { h: HOLD_H, t: T.DarkGrass, side: S.Rock, noGrass: false });
  p.rect(SPIRE.x0, SPIRE.z0, SPIRE.x1, SPIRE.z1, { h: SPIRE.top, t: T.Rock, side: S.Rock, noGrass: true });
  // The Great Tree's roots: a mass of root round the trunk's foot, and two great ridges of root
  // (too high to climb) either side of the arena, from the trunk to the arena's mouth; the arena's
  // floor, trodden earth and moss.
  p.each((x, z, i) => {
    const cz = z + 0.5 - GREAT.z;
    if (cz < ARENA.z0 - GREAT.z && Math.hypot(x + 0.5 - GREAT.x, cz) < 6.9) {
      grid.h[i] = HOLD_H + 3;
      grid.side[i] = S.Wood;
      grid.t[i] = T.Moss;
      grid.noGrass[i] = 1;
      return;
    }
    for (const sd of [-1, 1]) {
      const rx = GREAT.x + sd * 6.6 + Math.sin(cz * 0.35) * 0.6 * sd;
      if (cz > 0 && cz < 12.6 && Math.abs(x + 0.5 - rx) < 1.1 + (cz < 5 ? 0.4 : 0)) {
        grid.h[i] = HOLD_H + (cz > 10.5 ? 2 : 3);
        grid.side[i] = S.Wood;
        grid.t[i] = T.Moss;
        grid.noGrass[i] = 1;
        return;
      }
    }
    if (x + 0.5 > ARENA.x0 && x + 0.5 < ARENA.x1 && z + 0.5 > ARENA.z0 - 1 && z + 0.5 < ARENA.z1) {
      grid.t[i] = (x * 5 + z * 3) % 4 ? T.Dirt : T.Moss;
      grid.noGrass[i] = 1;
    }
  }, GREAT.x - 9, GREAT.z - 2, GREAT.x + 9, GREAT.z + 14);
  // The Drowned Shrine's island, and stepping stones out to it (a jump between each).
  p.each((x, z, i) => {
    if (Math.hypot(x + 0.5 - SHRINE.x, z + 0.5 - SHRINE.z) < SHRINE.r) {
      grid.h[i] = FLOOR;
      grid.t[i] = T.Flag;
      grid.water[i] = NONE;
      grid.noGrass[i] = 1;
      grid.side[i] = S.Rock;
    }
  }, SHRINE.x - 4, SHRINE.z - 4, SHRINE.x + 4, SHRINE.z + 4);
  // (Deep water can't be jumped into, so the water between the stones is shallow: wade or hop.)
  const firstStone = Math.floor(SHRINE.z + SHRINE.r) + 1; // the first cell off the island is a stone
  for (let z = firstStone; z < 46; z++)
    for (const x of [SHRINE.x - 1, SHRINE.x]) {
      const i = grid.i(x, z);
      if (grid.water[i] === NONE) continue;
      grid.noGrass[i] = 1;
      grid.side[i] = S.Rock;
      // Each step (shallows up to a stone, a stone up to the shore) is within PLAYER.stepUp.
      if ((z - firstStone) % 2 === 0) {
        grid.h[i] = FLOOR - 0.2;
        grid.t[i] = T.Rock;
        grid.water[i] = NONE;
      } else grid.h[i] = grid.water[i] - 0.25;
    }
  // The Fallen Giant: its top is a walk over the river (a deck of cells, low enough to step up
  // onto at PLAYER.stepUp; the trunk drawn below).
  for (let z = Math.floor(LOG.z0) + 1; z < Math.floor(LOG.z1); z++) for (const x of [LOG.x - 1, LOG.x]) grid.deck[grid.i(x, z)] = FLOOR + 0.42;
  // Clear meadow round the Ring of Oaks, so it reads as a ring.
  p.each((x, z, i) => {
    const d = Math.hypot(x + 0.5 - RING.x, z + 0.5 - RING.z);
    if (d > RING.r + 1 && d < RING.r + 5 && grid.h[i] === FLOOR && grid.water[i] === NONE) grid.t[i] = T.Grass;
  }, RING.x - 12, RING.z - 12, RING.x + 12, RING.z + 12);
  // The dell and the kilns' clearing.
  p.each((x, z, i) => {
    if (grid.h[i] !== FLOOR || grid.water[i] !== NONE) return;
    if (Math.hypot(x + 0.5 - DELL.x, z + 0.5 - DELL.z) < 6) grid.t[i] = T.Moss;
    else if (Math.hypot(x + 0.5 - KILNS.x, z + 0.5 - KILNS.z) < 7) grid.t[i] = (x * 3 + z) % 5 === 0 ? T.Mud : T.Dirt;
  }, 0, 80, 60, 115);
  // The hunter's stand: its platform (a deck of cells, the posts and planks drawn below).
  for (let z = STAND.z0; z < STAND.z1; z++) for (let x = STAND.x0; x < STAND.x1; x++) grid.deck[grid.i(x, z)] = STAND.top;
  // The Bat Roost: a cleft cut back into the northern cliff, its walls as high as the cliff.
  p.rect(ROOST.x0 - 1, 0, ROOST.x1 + 1, ROOST.z1, { h: 9, t: T.Rock, side: S.Rock, noGrass: true });
  p.rect(ROOST.x0, ROOST.z0, ROOST.x1, ROOST.z1 + 3, { h: FLOOR, t: T.Dirt, side: S.Rock, noGrass: true });
  // The Rook Pillar: a column of rock left standing in Rookfall Chasm, a jump from the east rim.
  const rim = (() => {
    let x = 94;
    while (x < 104 && grid.h[grid.i(x, 12)] < -5) x++;
    return x;
  })();
  const PILLAR = { x0: rim - 4, x1: rim - 2, z0: 11, z1: 14 };
  p.rect(PILLAR.x0, PILLAR.z0, PILLAR.x1, PILLAR.z1, { h: FLOOR, t: T.Rock, side: S.Rock, noGrass: true });
  // The ledges: stone shelves stepped out of the cliff, too high to jump.
  for (const l of LEDGES) p.rect(l.x0, l.z0, l.x1, l.z1, { h: LEDGE_H, t: T.Moss, side: S.Rock });
  // The niche: rock on three sides (as high as the northern heights, so nothing drops in from the
  // Warden's high ground), dug back into the cliff under the Overhang.
  p.rect(NICHE.x0 - 1, NICHE.z0 - 1, NICHE.x1 + 1, NICHE.z1, { h: 9, t: T.Rock, side: S.Rock, noGrass: true });
  p.rect(NICHE.x0, NICHE.z0, NICHE.x1, NICHE.z1, { h: FLOOR, t: T.Dirt, side: S.Rock, noGrass: true });
  // The Ring of Oaks: a mossy round of old grass.
  p.each((x, z, i) => {
    if (Math.hypot(x + 0.5 - RING.x, z + 0.5 - RING.z) < RING.r + 1) grid.t[i] = T.Moss;
  }, RING.x - 8, RING.z - 8, RING.x + 8, RING.z + 8);
  // Clearings: the gatherers' by the Blackwater, the herbwife's glade.
  for (const [cx, cz, rr] of [[CLEARING.x, CLEARING.z, 4.5], [GLADE.x, GLADE.z, 4]] as [number, number, number][])
    p.each((x, z, i) => {
      if (grid.h[i] === FLOOR && grid.water[i] === NONE && Math.hypot(x + 0.5 - cx, z + 0.5 - cz) < rr) grid.t[i] = (x + z) % 4 === 0 ? T.Dirt : T.Grass;
    }, cx - rr - 1, cz - rr - 1, cx + rr + 1, cz + rr + 1);

  // ---------- props ----------
  const kit = new MapKit(grid, [ROAD_IN, ROAD_EAST, ROAD_NORTH, RAVINE_PATH, LANE_BANK, LANE_WEST, LANE_GLADE, HOLD_PATH, LANE_STAG, LANE_KILNS, LAKE_RING]);
  const flat = (x: number, z: number, rad: number) => kit.flatAround(x, z, rad);
  // ---------- who lives where (placed before the props, which keep clear of them) ----------
  // A foe's index in this list is its save id: append, never reorder.
  const enemies: EnemySpawn[] = [
    // The Old Grove: goblins among the ancient oaks, a snarer, a spitter by a root, a thornback rooting about.
    { type: 'goblin', x: 84, z: 99.5, group: 'grove' },
    { type: 'goblin', x: 78, z: 104.5, group: 'grove' },
    { type: 'snarer', x: 87.5, z: 101.2, group: 'grove' },
    { type: 'spitter', x: 71.5, z: 101.5 },
    { type: 'thornback', x: 97, z: 96 },
    // The High Canopy: spitters on the roots, an archer up on the high root.
    { type: 'spitter', x: 93.8, z: 67.6 },
    { type: 'spitter', x: 111.2, z: 81 },
    { type: 'archer', x: 107.6, z: 65.2, guard: true },
    { type: 'snarer', x: 101, z: 84 },
    // The east woods: a patrol on the north road, a thornback in the trees.
    { type: 'goblin', x: 107.8, z: 50.5 },
    { type: 'shield', x: 104.5, z: 44 },
    { type: 'snarer', x: 110.5, z: 39 },
    { type: 'thornback', x: 110.5, z: 60.6 },
    { type: 'bat', x: 106, z: 26 },
    // Rookfall: archers holding both ends of the bridge.
    { type: 'archer', x: 103.2, z: 28.2, guard: true },
    { type: 'archer', x: 86.3, z: 36.5, guard: true },
    { type: 'goblin', x: 85.4, z: 35 },
    // The lane along the Blackwater's shore.
    { type: 'archer', x: 70, z: 44.2 },
    { type: 'goblin', x: 62, z: 44.8 },
    // The gatherers' clearing: the captive's guards.
    { type: 'shield', x: 48.5, z: 41.8, group: 'clearing' },
    { type: 'goblin', x: 44, z: 45, group: 'clearing' },
    { type: 'snarer', x: 50.5, z: 45.3, group: 'clearing' },
    // The Thorn Ravine: spitters against the cliff, bats over the shelf.
    { type: 'spitter', x: 78.5, z: 14 },
    { type: 'spitter', x: 60.5, z: 10.6 },
    { type: 'spitter', x: 50, z: 11.8 },
    { type: 'bat', x: 70, z: 16 },
    { type: 'bat', x: 55, z: 16.5 },
    // The Overhang: guards at the foot of the stair.
    { type: 'shield', x: 38.4, z: 16.1 },
    { type: 'goblin', x: 43.4, z: 17.2 },
    // The Mossfen: bats over the pools, a darter in the reeds.
    { type: 'bat', x: 14, z: 102 },
    { type: 'bat', x: 24, z: 108 },
    { type: 'darter', x: 26, z: 104.5 },
    // The Bat Roost.
    { type: 'bat', x: 109.5, z: 3.5 },
    { type: 'bat', x: 110.8, z: 2.5 },
    // The Withered Wood: spitters among the dead trees.
    { type: 'spitter', x: 19.5, z: 45 },
    { type: 'spitter', x: 6.8, z: 36.6 },
    // The Charcoal Kilns: goblins who took the burners' camp.
    { type: 'goblin', x: 44, z: 103, group: 'kilns' },
    { type: 'goblin', x: 46.8, z: 107.4, group: 'kilns' },
    { type: 'bomber', x: 51.2, z: 101.4, group: 'kilns' },
    { type: 'archer', x: 39.6, z: 99.4, group: 'kilns', guard: true },
    // The Stag's Thicket: the Warden's keepers of the bound stag.
    { type: 'snarer', x: 15.4, z: 67.6, group: 'stag' },
    { type: 'goblin', x: 9.6, z: 75.4, group: 'stag' },
    { type: 'goblin', x: 13.2, z: 75.2, group: 'stag' },
    { type: 'thornback', x: 8.4, z: 71, group: 'stag' },
    // The Warden's garrison in the courtyard (cleared, it opens the Great Tree), and the Warden.
    { type: 'shield', x: 22.6, z: 27.4, group: 'garrison' },
    { type: 'shield', x: 17.2, z: 29.4, group: 'garrison' },
    { type: 'archer', x: 24.4, z: 21.4, group: 'garrison', guard: true },
    { type: 'archer', x: 7.6, z: 29.6, group: 'garrison', guard: true },
    { type: 'snarer', x: 26, z: 28.4, group: 'garrison' },
    { type: 'thornback', x: 11.6, z: 31.2, group: 'garrison' },
    { type: 'warden', x: GREAT.x, z: GREAT.z + 7.5, group: 'boss' },
  ];
  const critters: CritterDef[] = [
    ...([[88, 84], [30, 60], [74, 108], [80, 78], [84, 72]] as Pt[]).map(([x, z]): CritterDef => ({ kind: 'deer', x, z, area: [x - 5, z - 4, x + 5, z + 4] })),
    ...([[80, 66.6], [110, 44], [36, 92], [61.5, 103]] as Pt[]).map(([x, z]): CritterDef => ({ kind: 'squirrel', x, z, area: [x - 4, z - 3, x + 4, z + 3] })),
    { kind: 'fox', x: 16, z: 92, area: [10, 88, 24, 96] },
  ];
  // Where foes and animals start: no tree, rock or bush lands on them, however the scatter shifts.
  const homes: Pt[] = [...enemies.filter((e) => e.type !== 'bat'), ...critters].map((e): Pt => [e.x, e.z]).concat([OWL]);
  const keepOut = (x: number, z: number) =>
    homes.some(([px, pz]) => Math.hypot(x - px, z - pz) < 1.3) ||
    Math.hypot(x - POND.x, z - POND.z) < lakeR(Math.atan2(z - POND.z, x - POND.x)) + 9.5 || // the village
    CANOPY.some((c) => Math.hypot(x - c.x, z - c.z) < 6) ||
    Math.hypot((x - MIRROR.x) / (MIRROR.rx + 1.5), (z - MIRROR.z) / (MIRROR.rz + 1.5)) < 1 ||
    (x > STAND.x0 - 2.5 && x < STAND.x1 + 2.5 && z > STAND.z0 - 2.5 && z < STAND.z1 + 3) ||
    (x > ROOST.x0 - 3 && x < ROOST.x1 + 3 && z < ROOST.z1 + 6) ||
    (x > 94 && x < 106 && z > 7 && z < 18) || // the Rook Pillar's run-up
    (x > 82 && x < 106 && z > 44 && z < 62) || // the Whisper's Fall, its lookout, and the view of it
    Math.hypot(x - RING.x, z - RING.z) < RING.r + 6 ||
    (x > LOG.x - 4 && x < LOG.x + 4 && z > LOG.z0 - 2 && z < LOG.z1 + 2.5) ||
    Math.hypot(x - SHRINE.x, z - SHRINE.z) < SHRINE.r + 1 ||
    Math.hypot(x - DELL.x, z - DELL.z) < 7 ||
    Math.hypot(x - KILNS.x, z - KILNS.z) < 8.5 ||
    Math.hypot(x - GRAVE.x, z - GRAVE.z) < 3.5 ||
    Math.hypot(x - GLADE.x, z - GLADE.z) < 6 ||
    Math.hypot(x - STAG.x, z - STAG.z) < 6.5 ||
    LEDGES.some((l) => x > l.x0 - 2 && x < l.x1 + 2 && z < l.z1 + 2.5) ||
    (x > NICHE.x0 - 1.5 && x < NICHE.x1 + 1.5 && z < NICHE.z1 + 2.5) ||
    Math.hypot(x - CLEARING.x, z - CLEARING.z) < 6 ||
    (x > CHASM.x0 - 3 && x < CHASM.x1 + 3 && z < CHASM.z1 + 2) ||
    Math.hypot(x - GREAT.x, z - GREAT.z) < 7 || // the Great Tree
    (x > ARENA.x0 - 2.5 && x < ARENA.x1 + 2.5 && z > GREAT.z && z < ARENA.z1 + 3.5) || // its arena and mouth
    (x > GULLY.x0 - 3 && x < GULLY.x1 + 1 && z > GULLY.z0 - 1 && z < GULLY.z1 + 1) ||
    (x > SPIRE.x0 - 1.5 && x < SPIRE.x1 + 2.5 && z > SPIRE.z0 - 1.5 && z < SPIRE.z1 + 1.5) ||
    (x > 104 && z > 100 && z < 112 && x < 116); // the Warden's Stone
  // The Old Wood's trees, each zone its own kinds and density (a fixed hash, not the dice, picks
  // the spots, so nothing else shifts). Phones get a third fewer.
  const thin = MOBILE ? 0.7 : 1;
  for (let z0 = 3; z0 < 117; z0 += 1.6)
    for (let x0 = 3; x0 < 118; x0 += 1.6) {
      const x = x0 + hash(x0, z0) * 1.4, z = z0 + hash(z0 + 7, x0) * 1.4, zs = ZONES[zoneAt(x, z)];
      if (!zs.trees.length || hash(x * 1.3, z * 0.7) > zs.density * 1.9 * thin) continue;
      if (keepOut(x, z) || kit.nearRoad(x, z, 2.6) || insidePoly(MOSSFEN, x, z)) continue;
      if (grid.groundAt(x, z) < FLOOR - 0.05 || grid.waterAt(x, z) !== NONE || !flat(x, z, 0.4)) continue;
      const kind = pick(zs.trees, hash(x * 2.1, z * 1.7)), s = zs.size * (0.85 + hash(z * 3.1, x) * 0.5);
      if (kind === 'pine') b.pine(x, z, s);
      else if (kind === 'oak') b.oak(x, z, s);
      else if (kind === 'birch') D.birch(b, x, z, s);
      else if (kind === 'dead') b.deadTree(x, z, s * 0.9);
      else b.bush(x, z, s * 0.9, '#3b6b2a');
    }
  // Pines on the northern and western heights.
  forest(b, r, 0, 0, 120, 120, 0.3, (x, z) => grid.groundAt(x, z) >= 7.5 && flat(x, z, 0.3) && !homes.some(([px, pz]) => Math.hypot(x - px, z - pz) < 1.3), 'pine');
  // The Old Grove's ancient oaks, each alone in a pool of moonlight.
  for (const [x, z, s] of [[64, 100, 1.1], [76, 106, 1.25], [88, 97, 1], [96, 108, 1.15], [70, 111, 0.9]] as [number, number, number][]) giantOak(b, x, z, s, 3);
  for (const [x, z] of [[80, 102], [92, 104], [70, 98]] as Pt[]) b.moonflowers(x, z, 8, 1.6);
  // The Warden's Stone: a tall mossy waystone where the road comes over the brook.
  {
    const x = 107.5, z = 104.2, y = grid.groundAt(x, z), g = b.g(x, z);
    g.cyl(x, y - 0.2, z, 0.55, 0.35, 3.2, 6, PAL.stoneDark, { kind: K.Rock, rot: 0.4 });
    g.box(x, y + 1, z + 0.36, 0.5, 1.6, 0.12, WOOD.moss, { kind: K.Grass });
    for (let k = 0; k < 5; k++) b.gl(x, z).box(x + 0.2, y + 0.8 + k * 0.4, z - 0.4, 0.1, 0.12, 0.03, WOOD.glow, {});
    b.collide({ kind: 'c', x, z, r: 0.6, y0: y - 1, y1: y + 3 });
    b.lights.add(x, y + 2, z - 0.8, 0xc8e070, 3, 5, 0.1);
  }
  // A stone bridge over the brook: the thorn road's last span.
  {
    const x = 112.5, z0 = 113.2, z1 = 120, y = FLOOR + 0.1, g = b.g(x, 116.5);
    for (let z = Math.floor(z0); z < z1; z++) for (let cx = 111; cx <= 113; cx++) if (grid.inside(cx, z)) grid.deck[grid.i(cx, z)] = y;
    g.box(x, y - 0.35, (z0 + z1) / 2, 3.2, 0.35, z1 - z0, PAL.stoneDark, { kind: K.Flag });
    for (const px of [110.85, 114.15]) {
      g.box(px, y - 0.1, (z0 + z1) / 2, 0.3, 0.55, z1 - z0, PAL.stone, { kind: K.Brick });
      b.collide({ kind: 'b', x0: px - 0.15, z0, x1: px + 0.15, z1, y0: y - 2, y1: y + 0.6 });
    }
    g.cyl(x, FLOOR - 2.6, 116.5, 1.1, 1.3, 2.3, 8, PAL.stoneDark, { kind: K.Brick });
  }
  // ---------- Hollowbough ----------
  // The home trees round the lake: a door in each trunk, windows up the bark, treehouses in
  // three of the crowns; the Heart Oak (the Reeve's) on the island.
  const home = Object.fromEntries(Object.entries(HOMES).map(([k, h]) => {
    const [x, z] = byLake(h.a, h.out);
    return [k, { x, z, ...homeTree(b, x, z, h.s, { face: h.face, treehouse: h.treehouse, chimney: true }) }];
  })) as Record<keyof typeof HOMES, { x: number; z: number; door: { x: number; z: number }; deck: [number, number, number] | null }>;
  const heart = homeTree(b, POND.x, POND.z, 1.25, { face: Math.PI / 4, treehouse: true, chimney: false });
  // Rope bridges to the island from the east shore (the road's side) and the west (the inn's),
  // each from the island's edge to the first dry ground (over water only).
  const shoreX = (dir: 1 | -1) => {
    let x = POND.x + dir * (ISLAND_R - 0.5);
    while (grid.water[grid.i(Math.floor(x), 73)] === NONE && grid.water[grid.i(Math.floor(x), 74)] === NONE) x += dir * 0.25;
    const edge = x;
    while (grid.water[grid.i(Math.floor(x), 73)] !== NONE || grid.water[grid.i(Math.floor(x), 74)] !== NONE) x += dir * 0.25;
    return [edge - dir * 0.2, x + dir * 0.3];
  };
  for (const dir of [1, -1] as const) {
    const [a, z] = shoreX(dir);
    ropeBridge(b, grid, a, 74, z, 74, FLOOR);
  }
  // Rope walks between the treehouses, high over the water (to look at, not to walk).
  const skyBridge = (from: [number, number, number], to: [number, number, number]) => {
    const [ax, ay, az] = from, [bx, by, bz] = to, len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len;
    const s = b.structure('rope walk', new THREE.Box3(new THREE.Vector3(Math.min(ax, bx) - 1, Math.min(ay, by) - 1, Math.min(az, bz) - 1), new THREE.Vector3(Math.max(ax, bx) + 1, Math.max(ay, by) + 1.5, Math.max(az, bz) + 1)));
    for (let t = 0.1; t < len - 0.1; t += 0.45) {
      const k = t / len, y = ay + (by - ay) * k - Math.sin(k * Math.PI) * 0.7;
      s.core.push().translate(ax + dx * t, y, az + dz * t).rotateY(Math.atan2(dx, dz));
      s.core.box(0, 0, 0, 0.9, 0.07, 0.34, (Math.floor(t * 7) % 3) ? PAL.wood : PAL.woodDark, { kind: K.Wood });
      s.core.pop();
    }
    for (const side of [-0.45, 0.45]) {
      let prev: [number, number, number] | null = null;
      for (let k = 0; k <= 12; k++) {
        const t = k / 12, y = ay + (by - ay) * t - Math.sin(t * Math.PI) * 0.7 + 0.8;
        const pnt: [number, number, number] = [ax + dx * len * t - dz * side, y, az + dz * len * t + dx * side];
        if (prev) s.core.beam(prev, pnt, 0.02, '#8a7a5a', { wind: 0.3 });
        prev = pnt;
      }
    }
  };
  const edgeOf = (deck: [number, number, number], toward: [number, number, number], rr: number): [number, number, number] => {
    const d = Math.hypot(toward[0] - deck[0], toward[2] - deck[2]);
    return [deck[0] + ((toward[0] - deck[0]) / d) * rr, deck[1], deck[2] + ((toward[2] - deck[2]) / d) * rr];
  };
  if (heart.deck)
    for (const k of ['inn', 'lodge'] as const) {
      const d = home[k].deck;
      if (d) skyBridge(edgeOf(d, heart.deck, 1.9 * HOMES[k].s + 1.6), edgeOf(heart.deck, d, 1.9 * 1.25 + 1.6));
    }
  // Lanterns hung from the Heart Oak's limbs over the water.
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 0.3;
    const lx = POND.x + Math.cos(a) * 4.8, lz = POND.z + Math.sin(a) * 4.8, y = FLOOR + 4.2 + (k % 2) * 0.7;
    b.g(lx, lz).beam([lx, y + 1.8, lz], [lx, y + 0.25, lz], 0.012, '#8a7a5a');
    b.gl(lx, lz).box(lx, y, lz, 0.22, 0.3, 0.22, GLOW.window, {});
    b.lights.add(lx, y - 0.3, lz, 0xffa050, 2.5, 4, 0.2);
  }
  // The inn's tables under its tree; the smith's forge in the roots; Ash's family's garden and
  // woodpile; the lodge's chopping block; the gathering fire on the north shore; a jetty and a boat.
  const off = (h: { door: { x: number; z: number } }, face: number, along: number, out: number): Pt => [h.door.x + Math.cos(face) * out - Math.sin(face) * along, h.door.z + Math.sin(face) * out + Math.cos(face) * along];
  const table = (x: number, z: number) => {
    const g = b.g(x, z), y = grid.groundAt(x, z);
    g.box(x, y + 0.7, z, 1.2, 0.08, 0.7, PAL.wood, { kind: K.Wood });
    for (const s of [-0.45, 0.45]) g.box(x + s, y, z, 0.08, 0.7, 0.5, PAL.woodDark, { kind: K.Wood });
    for (const s of [-0.62, 0.62]) g.box(x, y + 0.4, z + s, 1.1, 0.07, 0.22, PAL.woodDark, { kind: K.Wood });
    b.collide({ kind: 'b', x0: x - 0.65, z0: z - 0.4, x1: x + 0.65, z1: z + 0.4, y0: y - 1, y1: y + 0.8 });
  };
  table(...off(home.inn, HOMES.inn.face, 2.2, 2.4));
  table(...off(home.inn, HOMES.inn.face, -2.4, 2));
  {
    const [fx, fz] = off(home.smithy, HOMES.smithy.face, 2.3, 0.6), y = grid.groundAt(fx, fz), g = b.g(fx, fz);
    g.blob(fx, y + 0.35, fz, 0.7, 0.55, 0.7, PAL.stoneDark, 151, { kind: K.Rock, jitter: 0.2, flatBottom: true });
    b.gl(fx, fz).box(fx, y + 0.55, fz, 0.4, 0.22, 0.4, [3.2, 1.2, 0.3], {});
    b.fx.addEmitter({ x: fx, y: y + 0.8, z: fz, rate: 2, spec: P.ember, spread: 0.2, vy: 0.5 });
    b.lights.add(fx, y + 1, fz, 0xff7a30, 5, 5, 0.35);
    b.collide({ kind: 'c', x: fx, z: fz, r: 0.7, y0: y - 1, y1: y + 1 });
    D.anvil(b, ...off(home.smithy, HOMES.smithy.face, 0.6, 2.4), HOMES.smithy.face);
    D.workbench(b, ...off(home.smithy, HOMES.smithy.face, -2.4, 1.2), HOMES.smithy.face);
  }
  D.wildflowers(b, ...off(home.ash, HOMES.ash.face, 2.6, 1.6), 14, 1.3, 'purple');
  D.wildflowers(b, ...off(home.ash, HOMES.ash.face, 3.4, 3), 8, 0.9, 'yellow');
  const woodpile = (x: number, z: number, rot: number) => {
    const g = b.g(x, z), y = grid.groundAt(x, z);
    for (let k = 0; k < 5; k++) {
      const o = ((k % 3) - 1) * 0.36, ly = y + 0.18 + (k > 2 ? 0.32 : 0), ox = Math.cos(rot) * o, oz = Math.sin(rot) * o;
      g.beam([x + ox - Math.sin(rot) * 1.1, ly, z + oz + Math.cos(rot) * 1.1], [x + ox + Math.sin(rot) * 1.1, ly, z + oz - Math.cos(rot) * 1.1], 0.17, k % 2 ? PAL.woodDark : '#6a4a30', { kind: K.Bark });
    }
    b.collide({ kind: 'c', x, z, r: 0.9, y0: y - 1, y1: y + 0.8 });
  };
  woodpile(...off(home.ash, HOMES.ash.face, -2.6, 0.8), HOMES.ash.face);
  woodpile(...off(home.lodge, HOMES.lodge.face, 2.6, 0.8), HOMES.lodge.face);
  D.stump(b, ...off(home.lodge, HOMES.lodge.face, 0.4, 2.8), 1.1);
  {
    const [cx, cz] = byLake(-1.62, 3.6);
    b.campfire(cx, cz, true);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.4;
      D.fallenLog(b, cx + Math.cos(a) * 2.1, cz + Math.sin(a) * 2.1, 1.8, a + Math.PI / 2);
    }
  }
  const JETTY_Z = 80;
  const jettyX = (() => {
    let x = 36;
    while (x < POND.x && grid.water[grid.i(Math.floor(x), JETTY_Z)] === NONE) x += 0.5;
    return x;
  })();
  b.pier(jettyX - 0.6, jettyX + 3.4, JETTY_Z + 0.5, 1.6, FLOOR + 0.05);
  b.rowboat(jettyX + 2.4, FLOOR - 0.45, JETTY_Z + 2, 0.2);
  D.lilyPads(b, POND.x - 5.5, POND.z - 3.5, 7, 1.8);
  D.lilyPads(b, POND.x + 5, POND.z + 5, 7, 1.8);
  D.lilyPads(b, POND.x + 4.5, POND.z - 6, 5, 1.4);
  for (const a of [-1.2, 0.4, 1.9, 3.3, 4.4]) b.reeds(...byLake(a, -0.4), 9, 0.9);
  b.moonflowers(...byLake(-2.8, 3.2), 8, 1.2);
  b.moonflowers(...byLake(1.3, 4.5), 6, 1);
  // Strings of lanterns along the lakeside path, from branch to branch (to look at).
  for (const [a0, a1] of [[-2.1, -1.35], [-0.75, 0.05], [1.35, 2.05]]) {
    const [ax, az] = byLake(a0, 3.2), [bx, bz] = byLake(a1, 3.2), g = b.g((ax + bx) / 2, (az + bz) / 2), gl = b.gl((ax + bx) / 2, (az + bz) / 2), y = FLOOR + 4.3;
    let prev: [number, number, number] = [ax, y, az];
    for (let k = 1; k <= 8; k++) {
      const t = k / 8, pnt: [number, number, number] = [ax + (bx - ax) * t, y - Math.sin(t * Math.PI) * 0.8, az + (bz - az) * t];
      g.beam(prev, pnt, 0.015, '#8a7a5a', { wind: 0.3 });
      if (k < 8 && k % 2) gl.box(pnt[0], pnt[1] - 0.25, pnt[2], 0.14, 0.18, 0.14, GLOW.window, { wind: 0.3 });
      prev = pnt;
    }
    b.lights.add((ax + bx) / 2, y - 1, (az + bz) / 2, 0xffa050, 3, 5, 0.2);
  }
  // The old owl's snag, where the road comes into Hollowbough. Built by hand, not with
  // b.deadTree: that rolls the builder's dice (moving everything scattered after it) and
  // offers the perch to a wild owl.
  {
    const [x, z] = OWL, y = grid.groundAt(x, z), top = y + OWL_PERCH, g = b.g(x, z);
    g.cyl(x, y - 0.1, z, 0.24, 0.14, 1.4, 5, PAL.dead, { kind: K.Bark });
    g.beam([x, y + 1.2, z], [x, top, z], 0.11, PAL.dead, { kind: K.Bark });
    for (const [a, h, l] of [[0.6, 1.3, 0.9], [2.4, 1.7, 0.8], [4.1, 1.5, 1], [5.3, 2.1, 0.6]])
      g.beam([x, y + h, z], [x + Math.cos(a) * l, y + h + l * 0.6, z + Math.sin(a) * l], 0.05, PAL.dead, { kind: K.Bark, wind: 0.15 });
    g.box(x, top - 0.04, z, 0.34, 0.06, 0.3, PAL.dead, { kind: K.Bark });
    b.collide({ kind: 'c', x, z, r: 0.25, y0: y - 1, y1: top - 0.1 });
  }
  // ---------- the High Canopy ----------
  for (const c of CANOPY) giantOak(b, c.x, c.z, 1.35, 5);
  // The rope walk from the second giant's top over the Mirror Pool to the fourth's shelf.
  ropeBridge(b, grid, WALK.x, WALK.z0, WALK.x, WALK.z1, 6, 1.6);
  D.lilyPads(b, MIRROR.x - 1.6, MIRROR.z - 2.5, 6, 1.4);
  D.lilyPads(b, MIRROR.x + 1.5, MIRROR.z + 3, 5, 1.2);
  b.reeds(MIRROR.x + 3.4, MIRROR.z, 7);
  b.reeds(MIRROR.x - 3.3, MIRROR.z + 4, 6);
  for (const [x, z] of [[100.5, 66], [93, 74], [101, 88], [113.5, 68], [106.5, 95]] as Pt[]) b.mushrooms(x, z, 6);
  for (const [x, z] of [[98, 78], [92, 64], [113, 91], [118, 64], [99.5, 94]] as Pt[]) D.fern(b, x, z, 1.2);
  b.fx.addEmitter({ x: MIRROR.x, y: FLOOR + 0.6, z: MIRROR.z, rate: 0.6, spec: P.wisp, spread: 3, vy: 0.08 });
  // ---------- the Deer Meadow ----------
  for (const [x, z, n, k] of [[79, 73, 12, 'meadow'], [84, 71, 8, 'yellow'], [88, 77, 10, 'meadow'], [78, 83, 10, 'purple'], [83, 87, 8, 'meadow'], [86.5, 83.5, 6, 'yellow']] as [number, number, number, 'meadow' | 'yellow' | 'purple'][])
    D.wildflowers(b, x, z, n, 1.4, k);
  b.moonflowers(81, 79, 8, 1.6);
  for (const [x, z, s] of [[75.5, 71, 1], [90.5, 72.5, 0.9], [91, 85, 1.1], [76, 87.5, 0.95]] as [number, number, number][]) D.birch(b, x, z, s);
  D.stump(b, 80.5, 86.2, 1);
  D.fallenLog(b, 77.5, 76.5, 3.2, 0.5);
  {
    // The hunter's stand: four posts, a plank platform railed on three sides, a ladder on the south.
    const { x0, x1, z0, z1, top } = STAND, g = b.g((x0 + x1) / 2, (z0 + z1) / 2), y = FLOOR;
    for (const [x, z] of [[x0 + 0.1, z0 + 0.1], [x1 - 0.1, z0 + 0.1], [x0 + 0.1, z1 - 0.1], [x1 - 0.1, z1 - 0.1]] as Pt[]) g.box(x, y - 0.2, z, 0.18, top - y + 1.3, 0.18, PAL.woodDark, { kind: K.Wood });
    g.box((x0 + x1) / 2, top - 0.12, (z0 + z1) / 2, x1 - x0 + 0.2, 0.12, z1 - z0 + 0.2, PAL.wood, { kind: K.Wood });
    for (const [ax, az, bx, bz] of [[x0, z0, x1, z0], [x0, z0, x0, z1], [x1, z0, x1, z1]]) g.beam([ax + 0.1, top + 0.9, az + 0.1], [bx + 0.1, top + 0.9, bz + 0.1], 0.04, PAL.woodDark, { kind: K.Wood });
    for (const s of [-0.28, 0.28]) g.box((x0 + x1) / 2 + s, y, z1 + 0.08, 0.06, top - y + 0.9, 0.06, PAL.wood, { kind: K.Wood });
    for (let k = y + 0.35; k < top; k += 0.38) g.box((x0 + x1) / 2, k, z1 + 0.08, 0.62, 0.05, 0.05, PAL.wood, { kind: K.Wood });
    g.beam([x0 + 0.2, y + 1.2, z0 + 0.2], [x1 - 0.2, y + 2.6, z0 + 0.2], 0.05, PAL.woodDark, { kind: K.Wood });
  }
  // ---------- the Whisper's Fall ----------
  {
    // Where the Whisper pours over the lip into Rookfall: streaks of falling water, spray at the
    // lip and mist far below, and a lookout of boulders on the south bank.
    const g = b.gl(89, 50);
    for (let z = 47.8, k = 0; z < 52.6; z += 0.6, k++) {
      let x = 86;
      while (x < 94 && grid.h[grid.i(Math.floor(x), Math.floor(z))] > -5) x += 0.25;
      const lip = x - 0.1, y0 = FLOOR - 0.35, len = 5 + (k % 3) * 2.5;
      // Faint streaks down the fall (brighter ones would read as a wall), falling drops over them.
      g.box(lip + 0.15, y0 - len, z, 0.04, len, 0.08, [0.12, 0.17, 0.28], {});
      b.fx.addEmitter({ x: lip + 0.1, y: y0, z, rate: 7, spec: P.fall, spread: 0.12, vy: 0 });
      if (k % 2 === 0) b.fx.addEmitter({ x: lip, y: y0 + 0.1, z, rate: 3, spec: P.splash, spread: 0.2, vy: 0.6 });
    }
    b.fx.addEmitter({ x: 91.5, y: -6, z: 50, rate: 1.5, spec: P.mote, spread: 2.5, vy: 0.2 });
    b.fx.addEmitter({ x: 90.5, y: -11, z: 50, rate: 3, spec: P.smoke, spread: 2, vy: 0.3 });
    b.lights.add(89.5, FLOOR - 1, 50, 0x80a8ff, 4, 7, 0.2);
    for (const [x, z, s] of [[84.6, 54, 1.3], [86.4, 56.2, 0.9], [83.6, 55.9, 0.8], [88.2, 55.8, 0.7]] as [number, number, number][]) b.rock(x, z, s);
  }
  // ---------- the Rook Pillar ----------
  {
    const cx = (PILLAR.x0 + PILLAR.x1) / 2, cz = (PILLAR.z0 + PILLAR.z1) / 2, g = b.g(cx, cz);
    // A rooks' nest of sticks on top, dead trees along the rim, and the chasm's depth below.
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      g.beam([cx - 0.3 + Math.cos(a) * 0.5, FLOOR + 0.1, cz + 0.6 + Math.sin(a) * 0.5], [cx - 0.3 + Math.cos(a + 1.2) * 0.55, FLOOR + 0.22, cz + 0.6 + Math.sin(a + 1.2) * 0.55], 0.03, PAL.dead, { kind: K.Bark });
    }
    for (const [x, z] of [[rim + 1.2, 9.5], [rim + 1.6, 15.2], [rim + 2.6, 16.8]] as Pt[]) b.deadTree(x, z, 0.9);
    // Broken rock bulging from its sides down into the chasm, so it reads as a crag, not a column.
    for (const [ox, oy, oz, rx, ry, rz, seed] of [
      [-1.15, -1, -0.6, 0.8, 1.6, 0.9, 171], [1.05, -2.5, 0.4, 0.7, 2, 0.9, 172], [-0.9, -5, 1.4, 1, 2.2, 0.8, 173],
      [0.2, -3.6, -1.6, 0.9, 1.8, 0.7, 174], [0.8, -7.5, -0.5, 1.1, 2.4, 1.1, 175], [-0.3, -0.1, 1.7, 0.6, 0.5, 0.5, 176],
    ] as [number, number, number, number, number, number, number][])
      g.blob(cx + ox, FLOOR + oy, cz + oz, rx, ry, rz, PAL.rockDark, seed, { kind: K.Rock, jitter: 0.25 });
  }
  // ---------- the Fallen Giant ----------
  {
    const { x, z0, z1 } = LOG, y = FLOOR + 0.45, g = b.g(x, (z0 + z1) / 2);
    // The trunk (its top is the walk), moss along it, branch stubs, the root plate on the south
    // bank and the broken crown on the north.
    g.beam([x, y - 0.9, z0], [x, y - 0.8, z1], 0.9, WOOD.bark, { kind: K.Bark });
    g.box(x, y - 0.05, (z0 + z1) / 2, 1.1, 0.08, z1 - z0 - 1.2, WOOD.moss, { kind: K.Grass });
    for (const [bz, side] of [[46.5, 1], [49.8, -1], [53, 1]] as [number, number][]) g.beam([x + side * 0.7, y - 0.3, bz], [x + side * 2.2, y + 0.9, bz + 0.6], 0.14, WOOD.barkDark, { kind: K.Bark });
    g.blob(x, y + 0.2, z1 + 0.6, 2, 1.8, 0.7, WOOD.barkDark, 101, { kind: K.Bark, jitter: 0.3 });
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      g.beam([x + Math.cos(a) * 1.2, y + 0.2 + Math.sin(a) * 1.2, z1 + 0.7], [x + Math.cos(a) * 2.4, y + 0.2 + Math.sin(a) * 2.2, z1 + 1.1], 0.1, WOOD.barkDark, { kind: K.Bark });
    }
    b.collide({ kind: 'c', x, z: z1 + 0.8, r: 1.3, y0: y - 2, y1: y + 2.2 });
    for (let k = 0; k < 6; k++) g.beam([x, y - 0.3, z0 + 0.4], [x + Math.cos(k) * 2, y + 0.6 + (k % 2) * 0.6, z0 - 1.4 - (k % 3) * 0.4], 0.12, PAL.dead, { kind: K.Bark });
    b.mushrooms(x + 1.4, z1 - 0.8, 5);
  }
  // ---------- the Drowned Shrine ----------
  {
    const { x, z } = SHRINE, y = FLOOR, g = b.g(x, z);
    D.stoneArch(b, x, z - 0.8, 0);
    for (const [px, pz, h] of [[x - 1.9, z + 0.4, 1.6], [x + 1.9, z + 0.6, 0.9], [x + 1.2, z - 2, 2.2]] as [number, number, number][]) g.cyl(px, y - 0.1, pz, 0.28, 0.24, h, 6, PAL.stone, { kind: K.Brick });
    D.candles(b, x - 0.6, y, z + 0.9, 3);
    b.moonflowers(x, z + 0.6, 6, 1);
    b.lights.add(x, y + 1.4, z, 0x8ab0ff, 3, 5, 0.2);
    // A boat half sunk off the south shore.
    const bg = b.g(57.5, 41);
    bg.push().translate(57.5, FLOOR - 0.55, 40.8).rotateY(0.6).rotateX(0.2);
    bg.box(0, 0, 0, 1.1, 0.35, 2.6, PAL.woodDark, { kind: K.Wood });
    bg.box(0, 0.2, 0, 0.9, 0.1, 2.3, PAL.wood, { kind: K.Wood });
    bg.pop();
    b.reeds(55.5, 40.2, 8);
    b.reeds(72, 39.6, 7);
    b.reeds(40.5, 36.2, 7);
    D.lilyPads(b, 60, 36.5, 8, 2);
    D.lilyPads(b, 70, 35.5, 6, 1.6);
  }
  // ---------- the Withered Wood ----------
  {
    // The Warden's heights: grey dead trees, thorns, and a cairn where a knight fell.
    for (const [x, z, s] of [[4, 35, 1], [8, 43.5, 0.9], [16.5, 35.5, 1.1], [20.5, 43, 1], [25, 36.5, 0.9], [27.5, 43.2, 1.2], [6, 39.5, 0.8], [18.5, 39.5, 1], [23.5, 33.8, 0.9], [9.5, 34.2, 1.1], [29, 38.5, 0.9], [2.8, 43, 1]] as [number, number, number][])
      b.deadTree(x, z, s);
    for (const [x, z] of [[14, 44], [9.5, 37.5], [21.5, 37.5], [26, 40.5], [4, 41.5], [17.5, 33.2], [12.5, 36]] as Pt[]) bramble(b, x, z, 1, 1.5, false);
    const { x, z } = GRAVE, y = grid.groundAt(x, z), g = b.g(x, z);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      g.blob(x + Math.cos(a) * 0.7, y + 0.2, z + Math.sin(a) * 0.5, 0.35, 0.3, 0.35, PAL.stoneDark, 110 + k, { kind: K.Rock, jitter: 0.2 });
    }
    g.blob(x, y + 0.45, z, 0.55, 0.45, 0.5, PAL.stone, 120, { kind: K.Rock, jitter: 0.2 });
    // His sword driven into the cairn, his dented helm at its foot.
    g.beam([x + 0.1, y + 1.9, z], [x + 0.1, y + 0.5, z], 0.035, PAL.iron, { kind: K.Metal });
    g.box(x + 0.1, y + 1.55, z, 0.34, 0.05, 0.06, PAL.iron, { kind: K.Metal });
    g.box(x + 0.9, y + 0.15, z + 0.5, 0.3, 0.26, 0.3, '#7a7a82', { kind: K.Metal });
    b.collide({ kind: 'c', x, z, r: 0.9, y0: y - 1, y1: y + 1 });
    b.moonflowers(x - 0.8, z + 0.9, 4, 0.6);
  }
  // ---------- the Mushroom Dell ----------
  {
    const { x, z } = DELL;
    let k = 0;
    for (const [mx, mz, s] of [[7.6, 86.4, 1.3], [8.2, 93.2, 1.1], [14.6, 86.8, 1.2], [7.4, 90, 0.9], [13.8, 93.4, 1.4], [11, 84.8, 1]] as [number, number, number][])
      if (Math.abs(grid.groundAt(mx, mz) - FLOOR) < 0.1) giantMushroom(b, mx, mz, s, k++ % 2 === 0);
    // A fairy ring of little glowing ones, round the dell's treasure.
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) b.mushrooms(x + Math.cos(a) * 1.9, z + Math.sin(a) * 1.9, 2);
    b.fx.addEmitter({ x, y: FLOOR + 1, z, rate: 0.8, spec: P.wisp, spread: 4, vy: 0.1 });
    D.fern(b, x + 3.2, z + 2.2, 1.1);
    D.fern(b, x - 2.8, z - 2.6, 1);
  }
  // ---------- the Charcoal Kilns ----------
  {
    // Earth kilns smouldering, log stacks, the burners' hut (the goblins took it).
    for (const [x, z, seed] of [[41.5, 100.8, 131], [46.2, 99.6, 132], [49.4, 104.4, 133]] as [number, number, number][]) {
      const g = b.g(x, z), gl = b.gl(x, z), y = grid.groundAt(x, z);
      g.blob(x, y + 0.15, z, 1.6, 1.15, 1.6, '#4a3a2e', seed, { kind: K.Rock, jitter: 0.18, flatBottom: true });
      g.box(x, y + 1.15, z, 0.34, 0.35, 0.34, '#2a2420', { kind: K.Rock });
      gl.box(x + 1.45, y + 0.35, z, 0.06, 0.22, 0.45, [3, 1.1, 0.3], {});
      b.fx.addEmitter({ x, y: y + 1.5, z, rate: 1.1, spec: P.smoke, spread: 0.2, vy: 0.4 });
      b.fx.addEmitter({ x: x + 1.4, y: y + 0.5, z, rate: 0.5, spec: P.ember, spread: 0.2, vy: 0.3 });
      b.lights.add(x + 1.8, y + 0.6, z, 0xff8030, 3, 4, 0.3);
      b.collide({ kind: 'c', x, z, r: 1.4, y0: y - 1, y1: y + 1.5 });
    }
    b.house(42.4, 107.4, 3, 2.6, { doorSide: 0, roof: 'thatch', lit: 0.5, name: 'charcoal hut', tint: '#6a5a44' });
    for (const [x, z, rot] of [[48.8, 108.6, 0.2], [38.8, 104.6, 1.4]] as [number, number, number][]) {
      const g = b.g(x, z), y = grid.groundAt(x, z);
      for (let k = 0; k < 5; k++) {
        const lx = x + Math.cos(rot) * ((k % 3) - 1) * 0.36, lz = z + Math.sin(rot) * ((k % 3) - 1) * 0.36, ly = y + 0.18 + (k > 2 ? 0.32 : 0);
        g.beam([lx - Math.sin(rot) * 1.1, ly, lz + Math.cos(rot) * 1.1], [lx + Math.sin(rot) * 1.1, ly, lz - Math.cos(rot) * 1.1], 0.17, k % 2 ? PAL.woodDark : '#6a4a30', { kind: K.Bark });
      }
      b.collide({ kind: 'c', x, z, r: 0.9, y0: y - 1, y1: y + 0.8 });
    }
    D.goblinStandard(b, 44, 98.6);
  }
  // ---------- the Bat Roost ----------
  {
    const cx = (ROOST.x0 + ROOST.x1) / 2, g = b.g(cx, 3), y = FLOOR;
    // A lip of rock over the mouth, bones and glowing fungus inside.
    g.blob(cx, y + 3.6, ROOST.z1 + 0.6, 3, 0.8, 1.6, PAL.rockDark, 97, { kind: K.Rock, jitter: 0.25 });
    for (let k = 0; k < 6; k++) g.box(ROOST.x0 + 0.6 + k * 0.6, y + 2.3 + (k % 3) * 0.3, ROOST.z1 + 1.4, 0.05, 1 - (k % 3) * 0.25, 0.05, k % 2 ? WOOD.moss : WOOD.barkDark, { wind: 0.4 });
    D.bones(b, ROOST.x0 + 1, ROOST.z0 + 2.5, 4, true);
    b.mushrooms(ROOST.x1 - 0.7, ROOST.z0 + 1, 7);
    b.mushrooms(ROOST.x0 + 0.6, ROOST.z0 + 0.8, 5);
    b.lights.add(cx, y + 1.4, ROOST.z0 + 2, 0x6aa0ff, 2, 4, 0.1);
  }
  // ---------- Rookfall Chasm: the rope bridge ----------
  // Along a cell boundary (z = 30), so the planks cover the two cells between the rails.
  ropeBridge(b, grid, 86.8, 30, 100.6, 30, FLOOR, 1.8);
  for (let z = CHASM.z0 + 2; z < CHASM.z1; z += 2.5 + r() * 2) {
    const side = r() < 0.5 ? CHASM.x0 - 1.2 : CHASM.x1 + 1.2;
    if (Math.abs(z - 30) > 3 && flat(side, z, 0.4)) b.rock(side, z, 0.6 + r() * 0.6);
  }
  // ---------- the Thorn Ravine ----------
  // Thorn beds along the shelf's lip over the Blackwater (the ravine's thorns come in group 14).
  for (let x = 46; x < 84; x += 1.6 + r() * 1.4) {
    const z = 17.6 + r() * 1.4;
    if (grid.water[grid.i(Math.floor(x), Math.floor(z))] === NONE && !kit.nearRoad(x, z, 1.4)) bramble(b, x, z, 0.9 + r() * 0.3, 1.5);
  }
  // ---------- the Overhang ----------
  {
    // A shelf of rock juts out of the heights over the path, roots hanging from it.
    const x = 38.5, z = 9.5, y = FLOOR, g = b.g(x, z);
    g.blob(x, y + 3.2, z + 1.2, 3.6, 0.9, 2.4, PAL.rockDark, 71, { kind: K.Rock, jitter: 0.25 });
    for (let k = 0; k < 7; k++) g.box(x - 2.4 + k * 0.8, y + 1.9 + (k % 3) * 0.3, z + 2.4 + (k % 2) * 0.4, 0.05, 1 - (k % 3) * 0.25, 0.05, k % 2 ? WOOD.moss : WOOD.barkDark, { wind: 0.4 });
    b.lights.add(x, y + 1.2, z + 2.4, 0x6aa0ff, 2.5, 4, 0.1);
  }
  // ---------- the Warden's Hold ----------
  greatTree(b, GREAT.x, GREAT.z, 1.35);
  {
    // Roots along the tops of the two root ridges, so they read as the tree's (not as walls).
    const g = b.g(GREAT.x, GREAT.z + 6);
    for (const sd of [-1, 1])
      for (let k = 0; k < 12; k++) {
        const z0 = GREAT.z + k, z1 = GREAT.z + k + 1.1;
        const x0 = GREAT.x + sd * 6.6 + Math.sin(k * 0.35) * 0.6 * sd, x1 = GREAT.x + sd * 6.6 + Math.sin((k + 1) * 0.35) * 0.6 * sd;
        const y0 = HOLD_H + (k > 10 ? 2 : 3) + 0.2, y1 = HOLD_H + (k + 1 > 10.5 ? 2 : 3) + 0.2;
        g.beam([x0, y0, z0], [x1, y1, z1], 0.95 - k * 0.04, k % 2 ? WOOD.bark : WOOD.barkDark, { kind: K.Bark });
      }
    // More of the Great Tree's roots snaking over the ground behind and beside it (to look at).
    for (let k = 0; k < 6; k++) {
      const a = Math.PI + (k / 5) * Math.PI * 0.9 - 0.2;
      g.beam([GREAT.x + Math.cos(a) * 3, HOLD_H + 1.8, GREAT.z + Math.sin(a) * 3], [GREAT.x + Math.cos(a) * 9, HOLD_H - 0.1, GREAT.z + Math.sin(a) * 9], 0.6, WOOD.barkDark, { kind: K.Bark });
    }
    // Brambles along the root ridges and at the arena's mouth; glowing sap in the thorns.
    for (let k = 0; k < 7; k++) for (const sd of [-1, 1]) bramble(b, GREAT.x + sd * (7.8 + (k % 2) * 0.5), GREAT.z + 2 + k * 1.6, 0.9, 1.4, k % 3 === 0);
    // The Thorn Heart's spire: thorn canes up its sides, vines down its east face.
    const sg = b.g(SPIRE.x1, (SPIRE.z0 + SPIRE.z1) / 2);
    for (let z = SPIRE.z0 + 0.2; z < SPIRE.z1 - 0.1; z += 0.3) {
      const len = SPIRE.top - FLOOR - 0.3 - r() * 0.6;
      sg.beam([SPIRE.x1 + 0.04, SPIRE.top + 0.05, z], [SPIRE.x1 + 0.06, SPIRE.top - len, z + (r() - 0.5) * 0.3], 0.03, '#3b6b2a', { wind: 0.2 });
      for (let k = 0; k < 4; k++) sg.box(SPIRE.x1 + 0.08, SPIRE.top - r() * len, z + (r() - 0.5) * 0.2, 0.03, 0.1, 0.14, r() < 0.5 ? '#5a9a3a' : '#3b6b2a', { kind: K.Leaves, wind: 0.4 });
    }
    for (const [x, z] of [[SPIRE.x0 - 0.2, SPIRE.z0 + 0.6], [SPIRE.x0 + 0.8, SPIRE.z1 + 0.1]] as Pt[]) bramble(b, x, z, 0.8, 1.6, true);
    // Weathered boulders shouldering the spire on its hidden sides, so it reads as a crag, not a column.
    const rg = b.g((SPIRE.x0 + SPIRE.x1) / 2, (SPIRE.z0 + SPIRE.z1) / 2);
    for (const [x, y, z, rx, ry, rz, seed] of [
      [SPIRE.x0 - 0.1, FLOOR + 1.6, SPIRE.z0 + 0.5, 0.9, 1.8, 0.9, 161], [SPIRE.x0 + 0.6, FLOOR + 3.6, SPIRE.z0 - 0.1, 0.9, 1.4, 0.7, 162],
      [SPIRE.x0 + 0.3, SPIRE.top - 0.2, SPIRE.z0 + 0.3, 0.7, 0.6, 0.7, 163], [SPIRE.x0 - 0.2, FLOOR + 3.4, SPIRE.z1 - 0.4, 0.8, 1.5, 0.8, 164],
      [SPIRE.x1 - 0.5, FLOOR + 0.8, SPIRE.z0 - 0.2, 0.9, 1, 0.8, 165],
    ] as [number, number, number, number, number, number, number][]) rg.blob(x, y, z, rx, ry, rz, PAL.rockDark, seed, { kind: K.Rock, jitter: 0.25 });
    b.lights.add((SPIRE.x0 + SPIRE.x1) / 2, SPIRE.top + 1.4, (SPIRE.z0 + SPIRE.z1) / 2, 0xd060ff, 4, 6, 0.3);
  }
  // ---------- the Stag's Thicket ----------
  {
    // Briars spilling over the rocks round the hollow, a fallen trunk across its back, a dead tree.
    const gap = Math.atan2(LANE_STAG[0][1] - STAG.z, LANE_STAG[0][0] - STAG.x);
    for (let k = 0; k < 11; k++) {
      const a = gap + 0.75 + (k / 10) * (Math.PI * 2 - 1.5), d = 5.2 + (k % 3) * 0.6;
      bramble(b, STAG.x + Math.cos(a) * d, STAG.z + Math.sin(a) * d, 0.9 + (k % 2) * 0.3, 1.5, k % 4 === 0);
    }
    D.fallenLog(b, STAG.x - 3.2, STAG.z - 3.4, 4.2, 0.8);
    b.deadTree(STAG.x - 4.4, STAG.z + 2.6, 1.1);
    for (const [x, z, s] of [[STAG.x + 3.6, STAG.z - 2.4, 0.8], [STAG.x - 2.6, STAG.z + 3.8, 0.6]] as [number, number, number][]) b.rock(x, z, s);
  }
  // ---------- vines on the ledges ----------
  for (const l of LEDGES) {
    const g = b.g((l.x0 + l.x1) / 2, l.z1);
    for (let x = l.x0 + 0.6; x < l.x1 - 0.4; x += 0.35) {
      const len = LEDGE_H - FLOOR - 0.2 - r() * 0.8;
      g.beam([x, LEDGE_H + 0.05, l.z1 + 0.04], [x + (r() - 0.5) * 0.3, LEDGE_H - len, l.z1 + 0.06], 0.03, '#3b6b2a', { wind: 0.2 });
      for (let k = 0; k < 3; k++) g.box(x + (r() - 0.5) * 0.2, LEDGE_H - r() * len, l.z1 + 0.08, 0.14, 0.1, 0.03, r() < 0.5 ? '#5a9a3a' : '#3b6b2a', { kind: K.Leaves, wind: 0.4 });
    }
    b.moonflowers((l.x0 + l.x1) / 2, (l.z0 + l.z1) / 2, 5, 1);
  }
  // ---------- the Ring of Oaks ----------
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + 0.2;
    const rr = RING.r + 1.2 + Math.sin(k * 2.7) * 0.6;
    b.oak(RING.x + Math.cos(a + Math.sin(k * 1.9) * 0.12) * rr, RING.z + Math.sin(a + Math.sin(k * 1.9) * 0.12) * rr, 0.9 + (k % 3) * 0.15);
  }
  b.moonflowers(RING.x, RING.z, 10, 2);
  // ---------- the herbwife's glade, the gatherers' clearing ----------
  D.workbench(b, GLADE.x + 2, GLADE.z - 1.2, 0.4);
  for (let k = 0; k < 4; k++) b.bush(GLADE.x - 2.5 + k * 0.9, GLADE.z + 2.2, 0.35, '#5a7a3a');
  D.wildflowers(b, GLADE.x - 1, GLADE.z + 1, 10, 1.5, 'purple');
  for (const [x, z] of [[CLEARING.x + 2, CLEARING.z - 1.5], [CLEARING.x - 2.5, CLEARING.z + 1]] as Pt[]) b.bush(x, z, 0.5, '#6a3a3a');
  b.campfire(CLEARING.x, CLEARING.z + 1.2, false);
  // ---------- the Mossfen ----------
  for (let k = 0; k < 26; k++) {
    const x = rand(r, 7, 32), z = rand(r, 97, 113);
    if (!insidePoly(MOSSFEN, x, z)) continue;
    const wet = grid.waterAt(x, z) !== NONE;
    if (wet) continue;
    const q = r();
    if (q < 0.45) b.reeds(x, z, 7, 0.7);
    else if (q < 0.7) b.deadTree(x, z, 0.8 + r() * 0.4);
    else b.mushrooms(x, z, 5);
  }
  for (const [x, z] of [[14, 104], [22, 108], [18, 100]] as Pt[]) b.fx.addEmitter({ x, y: FLOOR + 0.4, z, rate: 0.4, spec: P.wisp, spread: 3, vy: 0.1 });

  // ---------- data ----------
  const objects: ObjDef[] = [
    { kind: 'moonfire', id: 'stone', name: "The Warden's Stone", x: 105.5, z: 106 },
    { kind: 'moonfire', id: 'bough', name: 'Hollowbough', x: 72.4, z: 92.4 },
    { kind: 'moonfire', id: 'bridge', name: 'Rookfall', x: 103.5, z: 33.5 },
    { kind: 'moonfire', id: 'overhang', name: 'The Overhang', x: 41.5, z: 15.8 },
    { kind: 'sign', x: 110.2, z: 110.5, text: 'Hollowbough, west through the Old Grove. Keep to the path: the ground bites.' },
    { kind: 'sign', x: 102.5, z: 36, text: 'Rookfall. The rope bridge holds, most nights.' },
    { kind: 'lore', id: 'wlore1', x: 70, z: 99, text: 'The Old Wood is older than the kingdom. It remembers everything.' },
    { kind: 'bindings', id: 'stag', x: STAG.x, z: STAG.z, mount: 'stag' },
    { kind: 'lever', id: 'heart', look: 'heart', x: (SPIRE.x0 + SPIRE.x1) / 2, z: (SPIRE.z0 + SPIRE.z1) / 2 },
    { kind: 'thornGate', id: 'wall', x: GULLY.x0 + 3.5, z: (GULLY.z0 + GULLY.z1) / 2, w: GULLY.z1 - GULLY.z0 + 3, alongX: false, role: 'wall' },
    { kind: 'thornGate', id: 'arena', x: GREAT.x, z: ARENA.z1 + 0.4, w: ARENA.x1 - ARENA.x0 + 1.6, alongX: true, role: 'arena' },
    { kind: 'cage', id: 'cage', x: CAGE.x, z: CAGE.z },
    // Three Moon Shards: among the fen's pools, up where the vines climb, at the top of the canopy.
    { kind: 'shard', id: 's_fen', x: 17.6, z: 108.4 },
    { kind: 'shard', id: 's_vines', x: 67, z: 8.6 },
    { kind: 'shard', id: 's_canopy', x: CANOPY[3].x - 0.8, z: CANOPY[3].z - 2.8 },
    { kind: 'cracked', id: 'w_niche', x: 38, z: 10, alongX: true },
    // Chests: up the ledge's vines, in the niche, on a root top, among the grove's oaks, in the fen, on
    // the gorge's rim, on the chasm's east bank, in the herbwife's glade, and the goblins' hoard.
    { kind: 'chest', id: 'wc_ledge', x: 43.5, z: 8.4, rot: 0, coins: 75, power: 'wind' },
    { kind: 'chest', id: 'wc_niche', x: 38, z: 7, rot: 0, coins: 90, power: 'giant' },
    { kind: 'chest', id: 'wc_root', x: CANOPY[0].x - 2.8, z: CANOPY[0].z + 1.4, rot: 0.6, coins: 70 },
    { kind: 'chest', id: 'wc_grove', x: 76.5, z: 109.2, rot: -0.4, coins: 60 },
    { kind: 'chest', id: 'wc_fen', x: 9.6, z: 105.6, rot: 1.2, coins: 80, power: 'bubble' },
    { kind: 'chest', id: 'wc_rim', x: 121.2, z: 20.5, rot: -Math.PI / 2, coins: 75 },
    { kind: 'chest', id: 'wc_chasm', x: 101.8, z: 45, rot: -1.4, coins: 65 },
    { kind: 'chest', id: 'wc_glade', x: GLADE.x - 2.4, z: GLADE.z - 2.2, rot: 0.3, coins: 50 },
    { kind: 'chest', id: 'wc_hoard', x: CLEARING.x + 3.6, z: CLEARING.z + 0.2, rot: -1.2, coins: 70, power: 'fire' },
    { kind: 'chest', id: 'wc_stand', x: STAND.x0 + 0.9, z: STAND.z0 + 0.6, rot: 0, coins: 60, power: 'magnet' },
    { kind: 'chest', id: 'wc_falls', x: 86, z: 54.6, rot: -0.6, coins: 70 },
    { kind: 'chest', id: 'wc_pillar', x: PILLAR.x0 + 0.6, z: PILLAR.z0 + 1.4, rot: Math.PI / 2, coins: 85, power: 'giant' },
    { kind: 'chest', id: 'wc_roost', x: (ROOST.x0 + ROOST.x1) / 2, z: ROOST.z0 + 0.8, rot: 0, coins: 65 },
    { kind: 'lore', id: 'wlore4', x: 84.2, z: 57.2, text: 'The Whisper falls into Rookfall and is never heard again. The rooks say it sings down there.' },
    { kind: 'chest', id: 'wc_log', x: LOG.x - 2.4, z: LOG.z1 + 0.4, rot: 1.3, coins: 65 },
    { kind: 'chest', id: 'wc_shrine', x: SHRINE.x - 1, z: SHRINE.z - 0.2, rot: 0, coins: 75, power: 'bubble' },
    { kind: 'chest', id: 'wc_grave', x: GRAVE.x - 1.2, z: GRAVE.z + 1, rot: 0.4, coins: 80, power: 'fire' },
    { kind: 'chest', id: 'wc_dell', x: DELL.x, z: DELL.z, rot: 0.2, coins: 70, power: 'wind' },
    { kind: 'chest', id: 'wc_kilns', x: 45.4, z: 107.8, rot: -0.3, coins: 75 },
    { kind: 'lore', id: 'wlore5', x: SHRINE.x + 1.3, z: SHRINE.z + 1.5, text: 'Before the thorns, the keepers of the wood prayed here to the moon. The water rose the night the Warden woke.' },
    { kind: 'sign', x: 1.4, z: SEA.stair + 3.2, text: 'The Sea Stair, down to the Sunken Reef. The rocks came down the night the Warden woke; no one has passed since.' },
    { kind: 'lore', id: 'wlore6', x: GRAVE.x + 1.4, z: GRAVE.z - 0.6, text: 'Ser Aldric of the Keep. He reached the Warden\'s gate. No farther.' },
    { kind: 'lore', id: 'wlore3', x: RING.x + 1.2, z: RING.z + RING.r + 1.6, text: 'Stand in the ring and the oaks remember you. Stand firm, and they give you their heart.' },
    { kind: 'lore', id: 'wlore2', x: 43.5, z: 12.2, text: 'The Thorn Warden was once a guardian. Something twisted it.' },
  ];
  for (const [x, z, what] of [[...off(home.inn, HOMES.inn.face, -1.6, 0.4), 'barrel'], [...off(home.inn, HOMES.inn.face, -2.2, 0.9), 'pot'], [...off(home.smithy, HOMES.smithy.face, -1.2, 2.6), 'crate'], [47.2, 40.9, 'crate'], [44.6, 40.4, 'barrel'], [105.6, 31.4, 'barrel'], [106.2, 32.1, 'pot'], [43.4, 18.6, 'pot']] as [number, number, 'pot' | 'crate' | 'barrel'][])
    objects.push({ kind: 'breakable', x, z, what });
  const regions: RegionDef[] = [
    { name: 'The Sea Stair', music: 'wilds', amb: 'fields', test: (x, z) => x < 1 && z > SEA.stair - 2 && z < SEA.stair + 4 },
    { name: 'The Withered Wood', music: 'wilds', amb: 'woods', test: (x, z, y) => z > 32 && insidePoly(HOLD, x, z) && y > 4 },
    { name: 'The Fallen Giant', music: 'wilds', amb: 'woods', test: (x, z) => x > 34 && x < 42 && z > LOG.z0 - 2 && z < LOG.z1 + 2 },
    { name: 'The Drowned Shrine', music: 'hall', amb: 'fields', test: (x, z) => Math.hypot(x - SHRINE.x, z - SHRINE.z) < SHRINE.r + 2 },
    { name: 'The Mushroom Dell', music: 'road', amb: 'woods', test: (x, z) => Math.hypot(x - DELL.x, z - DELL.z) < 7 },
    { name: 'The Charcoal Kilns', music: 'wilds', amb: 'fields', test: (x, z) => Math.hypot(x - KILNS.x, z - KILNS.z) < 9 },
    { name: 'The Bat Roost', music: 'hall', amb: 'indoor', test: (x, z) => x >= ROOST.x0 && x < ROOST.x1 && z < ROOST.z1 + 1 },
    { name: "The Whisper's Fall", music: 'wilds', amb: 'woods', test: (x, z) => x > 82 && x < 92 && z > 45 && z < 58 },
    { name: 'The Deer Meadow', music: 'fields', amb: 'fields', test: (x, z) => insidePoly(DEER_MEADOW, x, z) },
    { name: 'The Mirror Pool', music: 'wilds', amb: 'woods', test: (x, z) => Math.hypot((x - MIRROR.x) / (MIRROR.rx + 2), (z - MIRROR.z) / (MIRROR.rz + 2)) < 1 },
    { name: 'The Niche', music: 'hall', amb: 'indoor', test: (x, z) => x >= NICHE.x0 && x < NICHE.x1 && z >= NICHE.z0 && z < NICHE.z1 },
    { name: 'The Roots of the Great Tree', music: 'keep', amb: 'keep', test: (x, z, y) => x > ARENA.x0 && x < ARENA.x1 && z > ARENA.z0 - 1 && z < ARENA.z1 && y > 4 },
    { name: "The Warden's Hold", music: 'keep', amb: 'keep', test: (x, z, y) => x < 34 && z < 46 && y > 4 },
    { name: 'The Overhang', music: 'wilds', amb: 'woods', test: (x, z) => x < 46 && z < 24 },
    { name: 'The Thorn Ravine', music: 'wilds', amb: 'woods', test: (x, z) => z < 23 && x < 88 },
    { name: 'Rookfall Chasm', music: 'wilds', amb: 'woods', test: (x, z) => x > 84 && x < 103 && z < 50 },
    { name: "The Gatherers' Clearing", music: 'fields', amb: 'fields', test: (x, z) => Math.hypot(x - CLEARING.x, z - CLEARING.z) < 7 },
    { name: 'The Blackwater', music: 'fields', amb: 'fields', test: (x, z) => z < 48 && x < 88 },
    { name: 'The East Woods', music: 'wilds', amb: 'woods', test: (x, z) => x >= 100 && z < 56 },
    { name: 'Hollowbough', music: 'village', amb: 'village', test: (x, z) => Math.max(Math.abs(x - POND.x), Math.abs(z - POND.z)) < 17.5 },
    { name: 'The High Canopy', music: 'wilds', amb: 'woods', test: (x, z) => x > 88 && z > 56 && z < 96 },
    { name: "The Stag's Thicket", music: 'road', amb: 'woods', test: (x, z) => Math.hypot(x - STAG.x, z - STAG.z) < 6 },
    { name: 'The Ring of Oaks', music: 'road', amb: 'fields', test: (x, z) => Math.hypot(x - RING.x, z - RING.z) < RING.r + 3 },
    { name: "The Herbwife's Glade", music: 'road', amb: 'fields', test: (x, z) => Math.hypot(x - GLADE.x, z - GLADE.z) < 6 },
    { name: 'The Mossfen', music: 'fields', amb: 'fields', test: (x, z) => insidePoly(MOSSFEN, x, z) },
    { name: 'The Old Grove', music: 'road', amb: 'woods', test: (x, z) => x > 54 && z > 88 && x < 104 },
    { name: 'The Thorn Road', music: 'road', amb: 'road', test: (x, z) => x > 100 && z > 96 },
    { name: 'The Whisper', music: 'wilds', amb: 'woods', test: (x, z) => Math.abs(z - 50.5) < 5 },
    { name: 'Whisperwood', music: 'wilds', amb: 'woods', test: () => true },
  ];
  const grassDensity = (x: number, z: number) => {
    const y = grid.groundAt(x, z);
    if (y > 7) return 1.2;
    if (Math.max(Math.abs(x - POND.x), Math.abs(z - POND.z)) < 13) return 1.4;
    return 2.2 + fbm(x * 0.15, z * 0.15, 2, 5) * 2.8;
  };

  return {
    id: 'forest',
    w: MAP_W,
    d: MAP_D,
    grid,
    builder,
    start: { x: 111.5, z: 109.5 },
    horse: { x: 109.5, z: 110.5 },
    enemies,
    npcs: [
      // Hollowbough's folk, on the knolls, out of the way of the bridges.
      { id: 'reeve', look: 'woodreeve', name: 'Alder the Reeve', x: heart.door.x, z: heart.door.z, face: 1, lines: [
        'The thorns started growing the day the Warden woke.',
        'He kept this wood once. Now the wood keeps him, and it keeps nobody else.',
        'His hold is in the north-west: over the Rookfall bridge, through the Thorn Ravine, up the stair by the Overhang.',
      ] },
      { id: 'keeper2', look: 'woodwife', name: 'Moss the Innkeeper', x: home.inn.door.x, z: home.inn.door.z, face: 1, shop: 'flask', lines: [
        'Come up out of the dark, friend. Nothing climbs the knolls at night but us.',
        'Flasks, refilled or new. Coin still counts, even up here.',
      ] },
      { id: 'thornsmith', look: 'woodsmith', name: 'Bryony the Thorn-smith', x: off(home.smithy, HOMES.smithy.face, 1.4, 1.2)[0], z: off(home.smithy, HOMES.smithy.face, 1.4, 1.2)[1], face: 1, shop: 'sword', upTo: 5, lines: [
        'We live up in the trees now. The ground is not safe.',
        'That edge is keen. I can temper it with heartwood, and it will bite through thorn.',
      ] },
      { id: 'ash', look: 'woodboy', name: 'Ash', x: home.ash.door.x, z: home.ash.door.z, face: 1, lines: [
        'Have you seen my sister? She went gathering past the river.',
        'Past the Whisper, by the black water. She never came back.',
      ], after: ['Wren is home! She says you broke the lock with one blow.', 'I said it took three. She says one.'] },
      { id: 'wrenhome', look: 'woodgirl', name: 'Wren', x: off(home.ash, HOMES.ash.face, 1, 0.4)[0], z: off(home.ash, HOMES.ash.face, 1, 0.4)[1], face: 1, hidden: true, lines: ['Thank you, sir knight. The berries were worth it. Almost.'] },
      { id: 'wren', look: 'woodgirl', name: 'Wren', x: CAGE.x, z: CAGE.z, face: 1, caged: true, lines: [
        'You came! Ash sent you, didn\'t he.',
        'The goblins took this purse off a traveller. It is yours.',
        'I will run home. Mind the thorns in the ravine!',
      ] },
      { id: 'herbwife', look: 'herbwife', name: 'Old Nettle', x: GLADE.x + 1, z: GLADE.z + 1.6, face: -1, lines: [
        'A stag is held in the Warden\'s thorns, west of the oaks. Cut it loose and it will carry you.',
        'And the oaks themselves: stand in their ring and they will test you. The seed they keep makes a heart stronger.',
      ] },
      { id: 'owl', look: 'owl', name: 'Old Owl', x: OWL[0], z: OWL[1], perch: OWL_PERCH, lines: [
        'Hoo! The Reeve lives in the Heart Oak. The rope bridges take you over.',
        'Hoo! Cracked stone hides things. Strike it hard.',
        'Hoo! Vines hold, if you hold on. Keep jumping.',
        'Hoo! Thorns have a heart. Tear it out, and they wither.',
      ] },
    ],
    objects,
    // The Ring of Oaks: the Old Wood's relic trial.
    trial: {
      x: RING.x,
      z: RING.z,
      relic: 'heartwood',
      quest: 'oaks',
      prompt: 'Face the trial of the Ring of Oaks',
      wake: ['The oaks stir', 'Three waves. Stand your ground.'],
      win: ['The Heartwood Seed', 'Relic won: your heart is stronger (one more heart). The oaks give up 100 coins of old offerings.'],
      purse: 100,
      waves: [
        [{ type: 'goblin' }, { type: 'goblin' }, { type: 'snarer' }],
        [{ type: 'shield' }, { type: 'archer' }, { type: 'snarer' }, { type: 'spitter' }],
        [{ type: 'thornback', elite: true }, { type: 'shaman' }, { type: 'goblin' }, { type: 'bomber' }],
      ],
    },
    // Snare traps in the grass beside the paths, and the ravine's three strips of thorns.
    snares: [[80.5, 100.9], [104.2, 52.4], [68.2, 14.8], [57.5, 12], [45.5, 15.8], [80.2, 76.8], [88.6, 85.2]],
    // Vines up the ledges' south faces.
    vines: [
      ...LEDGES.map((l) => ({ x: (l.x0 + l.x1) / 2, z: l.z1, w: l.x1 - l.x0 - 1, alongX: true, top: LEDGE_H, nx: 0, nz: 1 })),
      { x: SPIRE.x1, z: (SPIRE.z0 + SPIRE.z1) / 2, w: SPIRE.z1 - SPIRE.z0 - 0.6, alongX: false, top: SPIRE.top, nx: 1, nz: 0 },
      // The hunter's stand's ladder climbs like vines.
      { x: (STAND.x0 + STAND.x1) / 2, z: STAND.z1, w: 0.8, alongX: true, top: STAND.top, nx: 0, nz: 1 },
    ],
    stagHome: { x: STAG.x + 1.5, z: STAG.z + 3 },
    thornBursts: [
      { x: 72, z: 14, w: 2.6, d: 10, ph: 0 },
      { x: 64, z: 13.5, w: 2.6, d: 10, ph: 1.1 },
      { x: 55.5, z: 14, w: 2.6, d: 10, ph: 2.1 },
    ],
    regions,
    waterPoints: waterPoints(grid, MAP_W, MAP_D),
    grassDensity,
    grassScale: (x, z) => (x > 56 && x < 100 && z > 92 ? 1.2 : 1),
    fireflyZones: [{ x: 80, z: 102, r: 16 }, { x: POND.x, z: POND.z, r: 13 }, { x: 20, z: 104, r: 12 }, { x: RING.x, z: RING.z, r: 8 }, { x: 60, z: 32, r: 16 }],
    critters,
    afterOutskirts: (g: Grid, bb: Builder) => {
      // The thorn road beyond the brook: south along the gorge's rim to the arch of thorns.
      const road: Pt[] = [[112.5, 119], [113.3, 125.5]];
      new Painter(g).each((x, z, i) => {
        const d = distLine(road, x + 0.5, z + 0.5);
        if (g.water[i] !== NONE || g.h[i] < -1) return;
        if (z < 127.5 && d < 2) {
          g.h[i] = FLOOR;
          g.t[i] = d < 1.1 ? T.Path : T.DarkGrass;
          g.dir[i] = -1;
          g.side[i] = S.Rock;
        } else g.h[i] = Math.max(g.h[i], FLOOR + 3);
      }, 106, 120, 120, 134);
      thicket(bb, [[108.5, 128.2], [119, 128.2]], 2.4, 1.6);
      for (let k = 0; k < 6; k++) {
        const a = (k / 5) * Math.PI;
        bramble(bb, 113.3 + Math.cos(a) * 1.5, 127.3, 0.9, 2.2 + Math.sin(a) * 1.2, true);
      }
      bb.lights.add(113.3, FLOOR + 1.2, 127.5, 0xc8e070, 5, 6, 0.25);
      // The Sea Stair: past the Withered Wood the Warden's heights fall sheer to the sea (the far
      // side, so it's seen and never in the way); a stair cut down the cliff toward the Sunken Reef
      // (realm 3), blocked halfway by a rockfall.
      const sea = new Painter(g);
      // Deep water right up to the cliff and on both sides of the stair (the knight can't step off
      // into it), so nothing hides the sea from the camera.
      sea.each((x, z, i) => {
        g.h[i] = -12;
        g.t[i] = T.Bed;
        g.side[i] = S.Rock;
        g.water[i] = SEA.level;
        g.noGrass[i] = 1;
        g.dir[i] = -1;
      }, -PAD_W, SEA.z0, 0, SEA.z1);
      sea.ramp(-12, SEA.stair, 0, SEA.stair + 2, 0, SEA.level + 1, HOLD_H, true, T.Flag);
      for (let z = SEA.stair; z < SEA.stair + 2; z++) for (let x = -12; x < 0; x++) g.water[g.i(x, z)] = NONE;
      for (const [x, z, s] of [[-7.4, SEA.stair + 0.5, 1.2], [-7.8, SEA.stair + 1.5, 1.1], [-6.9, SEA.stair + 1.2, 0.8], [-8.4, SEA.stair + 0.9, 0.9]] as [number, number, number][]) bb.rock(x, z, s);
      bb.collide({ kind: 'b', x0: -8.6, z0: SEA.stair - 0.2, x1: -6.6, z1: SEA.stair + 2.2, y0: -12, y1: HOLD_H + 2 });
      bb.fx.addEmitter({ x: -2, y: SEA.level + 0.3, z: (SEA.z0 + SEA.z1) / 2, rate: 2, spec: P.mote, spread: 12, vy: 0.2 });
      // Detail everywhere.
      const posts = [...(objects.filter((o) => 'x' in o) as unknown as { x: number; z: number }[])];
      const fits = (x: number, z: number, kind: 'soft' | 'solid' | 'tree') => {
        const inRealm = x >= 0 && z >= 0 && x < MAP_W && z < MAP_D;
        if (inRealm && kit.nearRoad(x, z, kind === 'tree' ? 3.2 : 1.5)) return false;
        if (!inRealm && distLine(road, x, z) < 3) return false;
        if (kind !== 'soft' && keepOut(x, z)) return false;
        return kind === 'soft' || !posts.some((o) => Math.hypot(x - o.x, z - o.z) < 3);
      };
      // Each zone's undergrowth (ferns and fungi in the woods, stumps round the kilns, stones on the
      // ridges and rims, thorn scrub on the Warden's heights, reeds by the water...).
      for (let z0 = 3; z0 < MAP_D - 3; z0 += 1.3)
        for (let x0 = 3; x0 < MAP_W - 3; x0 += 1.3) {
          const x = x0 + hash(x0 + 3, z0) * 1.1, z = z0 + hash(z0, x0 + 5) * 1.1, zs = ZONES[zoneAt(x, z)];
          if (!zs.plants.length || hash(x * 0.9 + 1, z * 1.1) > zs.under * (MOBILE ? 0.5 : 1)) continue;
          const kind = pick(zs.plants, hash(x * 1.7 + 2, z * 2.3)), u = hash(z * 1.9, x * 0.3);
          const solid = kind === 'rock' || kind === 'log' || kind === 'stump' || kind === 'thorn';
          if (kind !== 'reeds' && g.waterAt(x, z) !== NONE) continue;
          if (!fits(x, z, solid ? 'solid' : 'soft') || g.groundAt(x, z) < FLOOR - 0.7 || g.deck[g.i(Math.floor(x), Math.floor(z))] !== NONE) continue;
          const level = (rad: number) => [[rad, 0], [-rad, 0], [0, rad], [0, -rad]].every(([dx, dz]) => Math.abs(g.groundAt(x + dx, z + dz) - g.groundAt(x, z)) < 0.1);
          if (kind === 'fern') D.fern(bb, x, z, 0.8 + u * 0.6);
          else if (kind === 'flower') D.wildflowers(bb, x, z, 4 + Math.floor(u * 6), 0.5 + u * 0.6, u < 0.5 ? 'meadow' : u < 0.8 ? 'purple' : 'yellow');
          else if (kind === 'mushroom') bb.mushrooms(x, z, 3 + Math.floor(u * 4), false);
          else if (kind === 'moon') bb.moonflowers(x, z, 4, 0.6);
          else if (kind === 'reeds') bb.reeds(x, z, 6, 0.6);
          else if (kind === 'rock' && level(0.3)) bb.rock(x, z, 0.35 + u * 0.6, u > 0.4);
          else if (kind === 'log' && level(1.2)) D.fallenLog(bb, x, z, 1.8 + u * 1.4, u * Math.PI);
          else if (kind === 'stump' && level(0.4)) D.stump(bb, x, z, 0.7 + u * 0.5);
          else if (kind === 'thorn') {
            bramble(bb, x, z, 0.6 + u * 0.4, 1 + u * 0.5, u > 0.7);
            bb.collide({ kind: 'c', x, z, r: 0.45, y0: g.groundAt(x, z) - 1, y1: g.groundAt(x, z) + 1.4 });
          }
        }
      // Cliff edges dressed: plants and stones along the lip, roots and moss down the faces the
      // camera sees (brown, woody: not the green vines that can be climbed), boulders at the foot.
      for (let z = 1; z < MAP_D - 1; z++)
        for (let x = 1; x < MAP_W - 1; x++) {
          const i = g.i(x, z), h = g.h[i];
          if (g.water[i] !== NONE || g.deck[i] !== NONE) continue;
          let drop = 0, nx = 0, nz = 0;
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const j = g.i(x + dx, z + dz), below = g.deck[j] !== NONE ? g.deck[j] : g.h[j];
            if (h - below > drop) [drop, nx, nz] = [h - below, dx, dz];
          }
          if (drop < 2.5) continue;
          const u = hash(x * 1.3 + 11, z * 0.7), v = hash(z * 1.7 + 5, x * 0.9);
          const lx = x + 0.5 + nx * 0.2 + (v - 0.5) * 0.6 * nz, lz = z + 0.5 + nz * 0.2 + (v - 0.5) * 0.6 * nx;
          if (u < 0.22 && fits(lx, lz, 'soft')) D.fern(bb, lx, lz, 0.7 + v * 0.5);
          else if (u < 0.36 && fits(lx, lz, 'soft')) bb.bush(lx, lz, 0.5 + v * 0.4, v < 0.5 ? '#3b6b2a' : '#44603a');
          else if (u < 0.44 && fits(lx, lz, 'soft')) bb.rock(lx, lz, 0.3 + v * 0.3, false);
          if ((nx > 0 || nz > 0) && u > 0.3 && u < 0.85) {
            const fx = x + 0.5 + nx * 0.53, fz = z + 0.5 + nz * 0.53, gg = bb.g(fx, fz);
            for (let k = 0; k < 3; k++) {
              const o = (hash(x + k * 3.1, z) - 0.5) * 0.9, len = Math.min(drop - 0.3, 1 + hash(z + k, x * 1.1) * 2.6);
              const ax = fx + o * Math.abs(nz), az = fz + o * Math.abs(nx);
              gg.beam([ax, h + 0.05, az], [ax + nx * 0.12 + (v - 0.5) * 0.3 * nz, h - len, az + nz * 0.12 + (v - 0.5) * 0.3 * nx], 0.035, k % 2 ? '#5a4430' : '#46382a', { kind: K.Bark, wind: 0.15 });
            }
            if (u < 0.6) gg.box(fx + nx * 0.02, h - 0.3 - v * Math.min(2, drop - 1), fz + nz * 0.02, 0.5 * Math.abs(nz) + 0.05, 0.4 + v * 0.5, 0.5 * Math.abs(nx) + 0.05, WOOD.moss, { kind: K.Grass });
          }
          const bx = x + 0.5 + nx * 1.5, bz = z + 0.5 + nz * 1.5, bi = g.i(Math.floor(bx), Math.floor(bz));
          if (u > 0.86 && g.h[bi] > -5 && fits(bx, bz, 'solid')) bb.rock(bx, bz, 0.6 + v * 0.6, true);
        }
      dressRealm(bb, g, r, {
        w: MAP_W,
        d: MAP_D,
        fits,
        still: (x, z) => sdPoly(BLACKWATER, x, z) < 0 || insidePoly(MOSSFEN, x, z) || Math.hypot(x - POND.x, z - POND.z) < lakeR(Math.atan2(z - POND.z, x - POND.x)),
        wild: [
          ['squirrel', 6, [T.DarkGrass]],
          ['deer', 4, [T.DarkGrass, T.Grass]],
          ['fox', 2, [T.DarkGrass, T.Mud, T.Reeds]],
        ],
        noWild: (x, z) => Math.max(Math.abs(x - POND.x), Math.abs(z - POND.z)) < 17.5,
        critters,
      });
    },
    // The heart of the Great Tree: the Warden's arena (the door closes behind the knight).
    arena: {
      x0: ARENA.x0 + 0.4, z0: ARENA.z0, x1: ARENA.x1 - 0.4, z1: ARENA.z1 - 0.6, y: HOLD_H - 0.5,
      summons: [[GREAT.x - 3.6, GREAT.z + 6], [GREAT.x + 3.6, GREAT.z + 6]],
      dust: [ARENA.x0, ARENA.x1 - ARENA.x0, HOLD_H + 9, ARENA.z0, ARENA.z1 - ARENA.z0],
    },
    titleView: { x: POND.x + 4, z: POND.z + 6 },
    debugSpots: [[111.5, 109.5], [70, 92], [98, 64], [103.5, 33.5], [70, 14], [41.5, 15.8], [31, 19.5], [22, 66]],
    borders: [{ id: 'thornroad', to: 'castle', arrive: 'thornroad', x: 113.3, z: 125.6, r: 1.4, out: { x: 111.5, z: 109.5, fx: -0.45, fz: -0.9 }, card: ['The Old Wood', 'Blackpine'] }],
  };
}

/**
 * The land beyond Whisperwood's edges: the gorge along the east (the same gorge as
 * realm 1's), the Old Wood's heights to the north and west, low wood across the brook.
 */
export function paintForestOutskirts(grid: Grid, W: number, D: number) {
  for (let gz = grid.oz; gz < grid.oz + grid.d; gz++)
    for (let gx = grid.ox; gx < grid.ox + grid.w; gx++) {
      if (gx >= 0 && gz >= 0 && gx < W && gz < D) continue;
      const i = grid.i(gx, gz);
      if (grid.water[i] !== NONE) continue;
      const cx = Math.max(0, Math.min(W - 1, gx)), cz = Math.max(0, Math.min(D - 1, gz));
      const edgeH = grid.h[grid.i(cx, cz)];
      const out = Math.max(cx - gx, gx - cx, cz - gz, gz - cz);
      const n = fbm(gx * 0.1, gz * 0.1, 3, 71), n2 = fbm(gx * 0.23 + 5, gz * 0.23, 2, 73);
      const set = (h: number, t: number) => {
        grid.h[i] = h;
        grid.t[i] = t;
        grid.side[i] = S.Rock;
        grid.dir[i] = -1;
      };
      if (gx > W - 1) {
        // The gorge: a narrow rim, a sheer drop to a river far below, the far side. The rim
        // only runs alongside the wood (between the northern heights and the brook): past
        // either end it drops away, so it never leads out of the world.
        const o = gx - (W - 1);
        if (o < 3 && gz >= 8 && gz <= 110) set(FLOOR, n2 > 0.55 ? T.Rock : T.DarkGrass);
        else if (o < 3) set(-14, T.Rock);
        else if (o < 15) {
          if (o >= 6 && o <= 11) {
            set(-14, T.Bed);
            grid.water[i] = -12.6;
            grid.noGrass[i] = 1;
          } else set(-14 + (o < 6 ? 0 : 1), T.Rock);
        } else set(Math.round(FLOOR + n * 3 - 1), T.DarkGrass);
      } else if (gz > D - 1) set(FLOOR + 2 + Math.round(n * 1.5), T.DarkGrass); // the brook's far bank: too steep to climb, too low to hide the knight
      else set(Math.round(Math.max(edgeH, 6) + 1 + out * 0.5 + n * 5), n2 > 0.7 ? T.Rock : T.DarkGrass);
    }
}

export function decorateForestOutskirts(b: Builder, grid: Grid, W: number, D: number, r: Rng) {
  for (let z = grid.oz; z < grid.oz + grid.d; z += 1.6)
    for (let x = grid.ox; x < grid.ox + grid.w; x += 1.6) {
      if (x > -1 && z > -1 && x < W && z < D) continue;
      const tx = x + r() * 1.2, tz = z + r() * 1.2, k = r();
      if (!grid.inside(Math.floor(tx), Math.floor(tz)) || grid.waterAt(tx, tz) !== NONE) continue;
      const h = grid.groundAt(tx, tz);
      if (h < 0) continue;
      if (grid.typeAt(tx, tz) === T.Path) continue;
      if (tx > W + 1 && tx < W + 15) continue; // over the gorge
      if (tx > 106 && tx < 120 && tz > 118 && tz < 130) continue; // the thorn road's last stretch
      if (tx < 0.5 && tz > 33 && tz < 42) continue; // the Sea Stair
      if (k < 0.5) b.pine(tx, tz, 1 + r() * 0.7);
      else if (k < 0.62) b.oak(tx, tz, 1 + r() * 0.4);
    }
}
