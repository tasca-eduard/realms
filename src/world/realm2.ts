import * as THREE from 'three';
import { K } from '../engine/materials';
import { P } from '../engine/particles';
import { mulberry32, fbm, rand, type Rng } from '../engine/util';
import { Builder, GLOW, PAL } from './builder';
import { Grid, NONE, S, T } from './grid';
import { Painter, distLine, insidePoly, sdPoly, type Pt } from './paint';
import type { CritterDef } from '../game/critters';
import * as D from './details';
import { MOBILE } from '../config';
import { MapKit, dressRealm, forest, waterPoints, type EnemySpawn, type ObjDef, type RealmData, type RegionDef } from './realm';
import { bough, bramble, deadShrub, diceAt, giantMushroom, giantOak, greatTree, homeTree, rootFrom, ropeBridge, thicket, witheredOak, WOOD } from './wood';
import { dressWoodStair, onWoodStair, paintWoodStair, WOOD_STAIR, WOOD_STAIR_HEAD, woodStairBare } from './seastair';
import { WOOD_ZONES } from './lightzones';

// ---------------------------------------------------------------------------
// Realm 2: Whisperwood, the Old Wood (the prototype's second realm).
// 120 x 120. Screen-up is toward (-x, -z): the journey runs from the thorn road in
// the south-east (up from Blackpine) to the Warden's Hold in the north-west.
//
//   south-east   the thorn road comes over the brook: the Warden's Stone (moonfire)
//   south        the Old Grove: ancient oaks, where the goblins wait in the bushes; the
//                Charcoal Kilns
//   middle       Hollowbough: home trees round a lake with an arm and a bay, the Heart Oak at
//                the back of its island, a green before it; the folk about their day; the
//                beekeeper's hives on the bank toward the Whisper
//   east         the High Canopy: giants round the Mirror Pool, a rope walk between two of
//                them; the Deer Meadow and its hunter's stand; the kingfisher's bank
//   north-east   the East Woods (pines on rocky ridges, the Bat Roost in the cliff, the Rookery
//                over Rookfall's cave), the rope bridge over Rookfall (a gorge the Whisper falls
//                into and runs north along, under the rock), the Whisper's Fall, the Rook Pillar
//   north        the Thorn Ravine: a shelf under the northern cliffs, the Blackwater below
//                (its Drowned Shrine), the Overhang and its niche
//   north-west   the Warden's heights: a rock stair through a cleft between two hills, the
//                Thorn Heart in the thorns across its top, a short path to the Great Tree and
//                the hollow of roots at its feet (the Warden's arena); the Withered Wood and the
//                fallen knight's cairn south of it, the Warden's Seat north of it; past the Withered
//                Wood the Sea Stair, down the sea cliff toward the Sunken Reef (src/world/seastair.ts)
//   west         the Ring of Oaks, the herbwife's glade, the Deep Wood with the Stag's Thicket,
//                the Mushroom Dell, the Mossfen (no path: a secret)
//   south edge   goblins camped by the brook
//   past the river (the Whisper), on the Blackwater's shore: the gatherers' clearing; the
//   Fallen Giant across the Whisper
//
// Edges (no invisible walls): the Old Wood's heights to the north and west (tall, the
// far side), a broad river along the east, the brook along the south. Nothing tall on the
// near (south and east) sides.
// ---------------------------------------------------------------------------

export const MAP_W = 120;
export const MAP_D = 120;
const FLOOR = 2;

// Waters.
const RIVER: Pt[] = [[-6, 53.5], [6, 57], [16, 55.2], [24, 50.8], [32, 48.6], [40, 50.8], [48, 52.4], [56, 52.4], [64, 50], [72, 48.4], [80, 50.6], [90.5, 50]];
const BROOK: Pt[] = [[-6, 115.5], [10, 118], [22, 116], [34, 113.8], [46, 115.5], [58, 117.8], [70, 116], [82, 114.6], [94, 116.6], [106, 117.4], [112, 116.8], [119.5, 117]];
// (Its east shore stays well back from Rookfall: a wide bank between the mere and the chasm.)
const BLACKWATER: Pt[] = [[31, 24.5], [35, 21], [41, 20], [46, 22.5], [51, 20.5], [56, 23], [61, 19.5], [67, 21], [72, 24], [76.5, 21], [78.8, 23], [79.4, 27.5], [77.4, 31.5], [79, 36], [75.5, 40.5], [71.5, 38.5], [68, 41.8], [65, 38], [59, 40.5], [54, 37], [48, 39.5], [43, 37.5], [38, 35], [34, 31], [31.5, 28]];
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
// The Warden's heights in the north-west: lobed, with bays and points (no straight edge).
const HOLD: Pt[] = [[0, 0], [37, 0], [37, 6], [34, 14], [34.5, 20], [33, 26], [34.8, 30.5], [32.2, 34], [34.6, 38.5], [31.4, 42], [27.8, 43.2], [24.6, 45.8], [20.4, 44.6], [16.8, 47.4], [12.6, 46.2], [9.4, 48.2], [5.4, 46.6], [0, 47.2]];
// The spring in the Withered Wood, and its stream: across the heights, over their south cliff, to the Whisper.
const SPRING = { x: 3.9, z: 28 };
const STREAM: Pt[] = [[3.9, 28], [5.2, 31], [5, 33.5], [6.4, 38], [7.8, 42.5], [8.6, 46], [9.2, 49.5], [9.8, 53.5]];
// Rookfall: a gorge the Whisper falls into at its south end, winding north under the East Woods'
// edge to where the river goes under the rock (a cave, at z = GORGE_END). 7.5 m deep, 5.5 to 8.5 m
// across, narrow at its ends and widest round the Rook Pillar; its rim ragged.
const GORGE: Pt[] = [[92.2, 53.5], [93.4, 47.5], [94.8, 41], [95.2, 35], [94.6, 29], [95.4, 23.5], [95.6, 20.5]];
const GORGE_END = 20.5;
const RAVINE_FLOOR = -5.5;
/** The gorge's half-width at z. */
const gorgeHW = (z: number) => (2.9 + 1.2 * Math.exp(-(((z - 38) / 6) ** 2)) - (z > 45 ? 0.2 : 0)) * Math.min(1, Math.max(0, (z - GORGE_END + 0.5) / 3));
/** How far (x, z) is in from the gorge's ragged edge (negative outside). */
const gorgeIn = (x: number, z: number) => gorgeHW(z) + (fbm(x * 0.3, z * 0.3, 2, 59) - 0.5) * 1.4 - distLine(GORGE, x, z);
/** The gorge's middle at z. */
const gorgeX = (z: number) => {
  for (let k = 1; k < GORGE.length; k++) {
    const [ax, az] = GORGE[k - 1], [bx, bz] = GORGE[k];
    if (z <= az && z >= bz) return ax + ((bx - ax) * (az - z)) / (az - bz);
  }
  return z > GORGE[0][1] ? GORGE[0][0] : GORGE[GORGE.length - 1][0];
};
// Hollowbough: a village of great home trees round a lake (the Heartpool), the Heart Oak on a
// broad island in it reached by two rope bridges. The lake: a body with an arm reaching north-east
// and a bay to the south-west (round lobes melted together, the shore wandering). POND is its
// middle; lakeR the shore's distance from there at an angle; byLake a point beyond the shore.
const POND = { x: 56, z: 74 };
const LOBES: [number, number, number][] = [[56, 74, 14], [65.5, 65.5, 6.5], [45, 81, 7]];
const smin = (a: number, b: number, k: number) => {
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k));
  return b + (a - b) * h - k * h * (1 - h);
};
/** Signed distance to the lake's shore (negative in the water). */
const lakeSd = (x: number, z: number) => LOBES.reduce((d, [cx, cz, r]) => smin(d, Math.hypot(x - cx, z - cz) - r, 5), 1e9) + (fbm(x * 0.12, z * 0.12, 2, 64) - 0.5) * 3.2;
const lakeRs = new Map<number, number>();
const lakeR = (a: number) => {
  const k = Math.round((((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) * 60);
  let r = lakeRs.get(k);
  if (r === undefined) {
    const an = k / 60;
    for (r = 2; r < 34 && lakeSd(POND.x + Math.cos(an) * r, POND.z + Math.sin(an) * r) < 0; r += 0.2);
    lakeRs.set(k, r);
  }
  return r;
};
/** A point `out` metres beyond the lake's shore at angle a. */
const byLake = (a: number, out: number): Pt => [POND.x + Math.cos(a) * (lakeR(a) + out), POND.z + Math.sin(a) * (lakeR(a) + out)];
// The island: broad and ragged, the Heart Oak at its back (north-west), a green on its near side
// round the gathering fire.
const ISLE = { x: 55, z: 75, r: 7.6 };
/** Signed distance to the island's shore: a broad body, a tongue of green reaching south-east. */
const isleSd = (x: number, z: number) => smin(Math.hypot(x - ISLE.x, z - ISLE.z) - ISLE.r, Math.hypot(x - 59, z - 79.5) - 4.6, 3) + (fbm(x * 0.3, z * 0.3, 2, 65) - 0.5) * 2;
const OAK = { x: 53, z: 72.6 };
const FIRE = { x: 58.6, z: 78.8 };
// The home trees: where round the lake (never evenly: most behind it, to the north and the sides,
// few in front of it), how big, which way their doors face (toward the camera side).
const HOMES = {
  inn: { x: 58.2, z: 96, s: 1.05, face: 1.05, treehouse: true }, // where the road comes in, across the kilns lane (on the bay's south shore its crown hid the west shore, Ash's family's door and the lane west)
  lodge: { x: 31, z: 58, s: 0.9, face: 0.8, treehouse: false }, // the forester's, apart by the Whisper (on the north shore it hid the Gatherers' Clearing)
  smithy: { x: 77.8, z: 75.2, s: 1, face: 0.4, treehouse: false }, // by the road east
  ash: { x: 33.5, z: 87.5, s: 0.85, face: 0.73, treehouse: true }, // a size smaller: a bigger crown reached over the Ring of Oaks' near side
  weaver: { x: 40, z: 60, s: 0.85, face: 0.9, treehouse: false },
  elder: { x: 79, z: 58, s: 1.18, face: 1.1, treehouse: true },
  fisher: { x: 79.5, z: 83.5, s: 0.82, face: 0.3, treehouse: false }, // east, off the line from the camera to the green
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
// The Mushroom Dell against the western cliff.
const DELL = { x: 11, z: 89.6 };
// The Charcoal Kilns south of the village, and the lane to them.
const KILNS = { x: 45, z: 104 };
const LANE_KILNS: Pt[] = [byLake(1.65, 2.4), [54.8, 96.2], [53, 100.5], [50.5, 102]];
// The Bat Roost: a cleft in the East Woods' northern cliff.
const ROOST = { x0: 108, x1: 112, z0: 1, z1: 6 };
const RING = { x: 22, z: 66, r: 6 };
// The Stag's Thicket: where the Warden's thorns hold the Thornstag.
const STAG = { x: 11, z: 73 };
/** The stag's bed: a mossy dell in the western heights behind its thicket, through a cleft the Warden's
 *  thorns have choked (only the Thornstag's thorn burst clears them). Its centre and size; the cleft's line. */
const BED = { x: -4.6, z: 80.5, rx: 3.6, rz: 3.1, cz: 80.2, mouth: 5.6 };
/** 1 in the stag's bed, 2 in the cleft that leads to it (through the wood's western wall), else 0. */
const inStagBed = (px: number, pz: number) => {
  const e = Math.hypot((px - BED.x) / BED.rx, (pz - BED.z) / BED.rz) + (fbm(px * 0.6, pz * 0.6, 2, 91) - 0.5) * 0.45;
  if (e < 1) return 1;
  return px > BED.x + BED.rx * 0.6 && px < BED.mouth && Math.abs(pz - BED.cz) < 1.3 + (fbm(px, 3, 1, 92) - 0.5) * 0.4 ? 2 : 0;
};
// Two ledges under the northern cliffs, reached only up their vines (a chest on one, a shard on the other).
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
// Old Nettle's corner of her glade, its south-west side: out from under the crown of Ash's family's
// tree (from her old spot by the lane's end it hid her from the camera); the wood is kept out of the
// camera's view of it (see the Old Wood's trees).
const HERBS = { x: 20, z: 88 };
const CLEARING = { x: 46, z: 43 };
// The old owl's snag, by the foot of the ramp up to Hollowbough, and how high it sits.
const OWL: Pt = [62.4, 93.6];
const OWL_PERCH = 2.5;
// The Warden's Hold (all grown, nothing built): the stair from the Overhang climbs a cleft in the
// heights' edge, a shoulder of mossy rock either side; living thorns grow across its top, the Thorn
// Heart pulsing in them (torn out right there, they wither). Beyond lies the Withered Wood; the
// Great Tree stands at the back, and its arena is the hollow ringed by two of its great roots on
// the near (south) side, thorns growing shut across its mouth behind the knight.
const GREAT = { x: 13, z: 14 };
// The cleft: the stair (STAIR, z 13 to 17) between two shoulders of rock (z 11 to 13, 17 to 19); the
// thorns across its top (x = WALL_X), the heart just in front of them.
const CLEFT = { x0: 31, x1: 37, z0: 11, z1: 19 };
// The hills either side of the cleft: x, z, reach, height above the heights.
const HILLS: [number, number, number, number][] = [[33.4, 8.6, 5.8, 3.8], [32.9, 19.9, 4.6, 3.4]];
const WALL_X = 32.4;
const HOLD_H = 5;
// Places for the wood's empty corners: the Warden's Seat behind the Great Tree; the Rookery in the
// pines north of Rookfall; the beekeeper's hives between the Heartpool and the Whisper; goblins
// camped by the brook in the south; a chest in the reeds of the east river's bank.
const SEAT = { x: 17, z: 3.8 }; // (north-east of the Great Tree: behind it, the trunk would hide it from the camera)
const ROOKERY = { x: 93.5, z: 11 };
const HIVES = { x: 65.5, z: 55.2 };
const BROOKCAMP = { x: 61, z: 112.6 };
// The Warden's arena: a wide hollow at the Great Tree's feet (16 by 15 m, room to run from its
// arrows), ringed by two great roots that curve out from the trunk and back in (an elliptical ring,
// bowlE 1 to rootOuter, some 2.3 m thick), open between their tips on the east, toward the stair.
const BOWL = { x: 16, z: 24, rx: 8, rz: 7.6 };
const bowlE = (x: number, z: number) => Math.hypot((x - BOWL.x) / BOWL.rx, (z - BOWL.z) / BOWL.rz);
/** Angle round the hollow: 0 east (the mouth), π/2 south, -π/2 north; the trunk stands at ROOT_A. */
const bowlA = (x: number, z: number) => Math.atan2((z - BOWL.z) / BOWL.rz, (x - BOWL.x) / BOWL.rx);
const ROOT_A = Math.atan2((GREAT.z - BOWL.z) / BOWL.rz, (GREAT.x - BOWL.x) / BOWL.rx);
const MOUTH = 0.42;
const inMouth = (a: number) => Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < MOUTH;
const rootOuter = (a: number) => 1 + (2.3 + 0.35 * Math.sin(a * 5 + 1)) / 7.8;
/**
 * The roots' height: 2.5 m on the camera's side (south and east: more than the knight's or the
 * stag's highest leap, low enough not to hide the fight), rising to 3.4 m at the back (north and
 * west) by the trunk. The stag waits outside while the Warden lives (see the arena's mountOut).
 */
const rootTop = (a: number) => HOLD_H + 2.5 + 0.9 * Math.max(0, -Math.cos(a - Math.PI / 4));


// Paths to every place with a purpose. (The places there to be found get none: the Mossfen, the
// Mushroom Dell, the Fallen Giant, the Drowned Shrine, the Rook Pillar, the Bat Roost...)
const ROAD_IN: Pt[] = [[112.5, 119.5], [112, 113], [109, 108], [102, 104.5], [92, 102.5], [82, 100], [75, 97.5], [69.5, 95.6], byLake(1.05, 2.4)];
const ROAD_EAST: Pt[] = [byLake(-0.35, 2.4), [77, 66.2], [84, 64.8], [91, 66]];
const ROAD_NORTH: Pt[] = [[101, 64], [104.5, 57], [107, 48], [106, 38], [102.5, 31], [100.5, 30]];
const RAVINE_PATH: Pt[] = [[86.5, 30], [86, 24], [83, 17], [74, 13.5], [62, 12.5], [52, 13.5], [44, 15], [40, 16]];
const LANE_BANK: Pt[] = [[86.5, 31], [86, 38], [83.5, 44.5], [72, 45.2], [60, 45.4], [52, 44.5], [47, 43.5]];
const LANE_WEST: Pt[] = [byLake(2.75, 2.4), [36, 80], [32, 78], [29, 75], [26.5, 70.5]];
const LANE_GLADE: Pt[] = [[33, 80.5], [29.5, 84], [25.5, 85.5]];
const LANE_STAG: Pt[] = [[16.2, 66.5], [13.5, 69], [12, 70.8]];
const STAIR = { x0: 33, x1: 37, z0: 13, z1: 17 };
// From the top of the stair straight to the hollow's mouth.
const HOLD_PATH: Pt[] = [[33, 15], [29.5, 16.2], [27.8, 19.5], [27, 23.2], [25.6, 24]];
// Off it, round the Great Tree's roots and through the Withered Wood to the head of the Sea Stair.
const LANE_SEA: Pt[] = [[27, 23.2], [27.6, 28.4], [24.8, 33.4], [18.6, 36.4], [12.4, 36.3], [6.4, 34.3], [WOOD_STAIR_HEAD.x, WOOD_STAIR_HEAD.z]];

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
  rim: { density: 0.05, size: 0.9, trees: [['dead', 5], ['pine', 4], ['bush', 1]], ground: [T.Gravel, T.Rock, T.DarkGrass], under: 0.25, plants: [['rock', 6], ['thorn', 4]] },
  // The Blackwater's shores: mud and reed beds, birches and drowned trees.
  mere: { density: 0.05, size: 0.95, trees: [['birch', 4], ['dead', 3], ['bush', 3]], ground: [T.Grass, T.Mud, T.Reeds], under: 0.3, plants: [['reeds', 6], ['fern', 2], ['flower', 2]] },
  bank: { density: 0.05, size: 0.95, trees: [['bush', 5], ['birch', 3], ['oak', 2]], ground: [T.Grass, T.Reeds], under: 0.25, plants: [['reeds', 5], ['flower', 3], ['fern', 2]] },
  // The Deep Wood: old oaks and pines close together, moss, ferns, fungi, fallen trunks.
  deep: { density: 0.3, size: 1.2, trees: [['oak', 55], ['pine', 35], ['dead', 5], ['bush', 5]], ground: [T.DarkGrass, T.Moss], under: 0.45, plants: [['fern', 5], ['mushroom', 3], ['log', 1], ['rock', 1]] },
  fen: { density: 0, size: 1, trees: [], ground: [], under: 0, plants: [] },
  // Round the Charcoal Kilns the wood has been cut: stumps, young birches, bare earth.
  kilns: { density: 0.03, size: 0.85, trees: [['birch', 6], ['bush', 4]], ground: [T.Dirt, T.Grass], under: 0.4, plants: [['stump', 6], ['log', 2], ['fern', 2]] },
  // The Warden's heights: dressed by hand (see "the Warden's heights: what grows there").
  thorns: { density: 0, size: 1, trees: [], ground: [], under: 0, plants: [] },
  // Everywhere else: mixed woodland.
  wood: { density: 0.14, size: 1, trees: [['oak', 45], ['pine', 35], ['birch', 10], ['bush', 10]], ground: [T.DarkGrass, T.Grass], under: 0.25, plants: [['fern', 4], ['mushroom', 2], ['flower', 2], ['rock', 2]] },
};
function zoneAt(x: number, z: number): ZoneId {
  const wx = x + (fbm(x * 0.06, z * 0.06, 2, 87) - 0.5) * 7, wz = z + (fbm(x * 0.06 + 9, z * 0.06, 2, 89) - 0.5) * 7;
  if (insidePoly(HOLD, x, z)) return 'thorns';
  if (insidePoly(MOSSFEN, wx, wz)) return 'fen';
  if (lakeSd(x, z) < 11) return 'village';
  if (sdPoly(BLACKWATER, x, z) < 5) return 'mere';
  // (The East Woods' pines reach west over the ground north of Rookfall's cave.)
  if ((wx > 100 && wz < 56) || (wx > 86 && wz < 19)) return 'pines';
  if (gorgeIn(x, z) > -4.5 || (wz < 24 && wx < 88)) return 'rim';
  if (distLine(RIVER, x, z) < 5.5 || distLine(BROOK, x, z) < 5) return 'bank';
  if (insidePoly(DEER_MEADOW, wx, wz)) return 'meadow';
  if (wx > 88 && wz > 56 && wz < 96) return 'canopy';
  if (Math.hypot(wx - KILNS.x, wz - KILNS.z) < 13) return 'kilns';
  if (wx > 96 && wz > 96) return 'verge';
  if (wx > 54 && wz > 90) return 'grove';
  if (insidePoly(DEEP_WEST, wx, wz)) return 'deep';
  return 'wood';
}
/**
 * Where things grow thick (1) and where the ground stays open (0): wide soft patches, so trees and
 * undergrowth come in groves and clumps with glades between, never evenly spread.
 */
const patchAt = (x: number, z: number) => Math.max(0, Math.min(1, (fbm(x * 0.085 + 11, z * 0.085 - 4, 2, 241) - 0.32) / 0.36));
/** The Warden's heights: leaf litter and groves of dead trees where this is high. */
const grovePatch = (x: number, z: number) => fbm(x * 0.1 + 7, z * 0.1, 2, 223);
/** A weighted choice, u in 0..1. */
function pick<K>(list: [K, number][], u: number): K {
  let t = list.reduce((s, [, w]) => s + w, 0) * u;
  for (const [k, w] of list) if ((t -= w) <= 0) return k;
  return list[list.length - 1][0];
}
/** Depth of a shelving shore: `e` is the signed distance to the shoreline (negative in the water).
 * Wadeable shallows for the first 1.6 m, then down toward `deep` below the water. */
const shelve = (e: number, level: number, deep: number) => (e > -1.6 ? level - 0.25 : level - 0.25 - Math.min(deep, (-e - 1.6) * 0.8));

/** A waymark: a standing stone with a pale blaze cut into its face and a cap of moss. */
function waystone(b: Builder, x: number, z: number) {
  const g = b.g(x, z), y = b.y(x, z);
  g.blob(x, y + 0.45, z, 0.3, 0.55, 0.24, PAL.rock, 7, { kind: K.Rock, flatBottom: true, jitter: 0.12 });
  g.blob(x - 0.04, y + 0.98, z - 0.03, 0.22, 0.08, 0.18, '#4f7a30', 9, { kind: K.Leaves });
  // The blaze, on the side that faces the camera: a stroke and a bar, like an arrow's feathers.
  g.push().translate(x + 0.21, y + 0.42, z + 0.19).rotateY(Math.PI / 4);
  g.box(0, 0, 0, 0.05, 0.38, 0.02, '#d8d0b0');
  for (const s of [-1, 1]) g.box(s * 0.07, 0.26, 0, 0.12, 0.04, 0.02, '#d8d0b0');
  g.pop();
  b.collide({ kind: 'c', x, z, r: 0.3, y0: y - 1, y1: y + 1.1 });
}

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
  p.poly(HOLD, { h: 5, t: T.DarkGrass, side: S.Rock }, 1.8, 7);
  // The heights run right to the map's west edge (the noisy outline left a strip of low ground
  // there, a pit between the heights and the hills beyond with no way out).
  p.each((x, z, i) => {
    if (grid.h[i] < HOLD_H && grid.water[i] === NONE) p.apply(i, { h: HOLD_H, t: T.DarkGrass, side: S.Rock });
  }, 0, 0, 2, 44);
  // A few whole-step rises in the woods (never half-steps; none by the Mirror Pool, where a rise
  // beside its shallows made a pit with no way out).
  p.each((x, z, i) => {
    if (grid.h[i] === FLOOR && x > 70 && z > 55 && fbm(x * 0.08, z * 0.08, 3, 43) > 0.68 && Math.hypot((x + 0.5 - MIRROR.x) / (MIRROR.rx + 3), (z + 0.5 - MIRROR.z) / (MIRROR.rz + 3)) > 1) grid.h[i] = FLOOR + 1;
  });
  // The Whisper, running east into the chasm, and the brook along the south edge.
  p.stream(RIVER, 5.2, FLOOR - 0.35, FLOOR - 3.2, 1.3, 51);
  p.stream(BROOK, 4.6, FLOOR - 0.4, FLOOR - 2.8, 1.1, 53);
  // Past the brook the bank rises steeply, 3 m (the thorn road's bridge is the only way over; the
  // Thornstag's leap and step-up reach 2.75 m).
  p.each((x, z, i) => {
    if (grid.water[i] === NONE && z + 0.5 > lineZ(BROOK, x + 0.5) + 1 && (x < 110 || x > 115)) {
      grid.h[i] = FLOOR + 3;
      grid.t[i] = T.DarkGrass;
      grid.side[i] = S.Dirt;
    }
  }, 0, 110, MAP_W, MAP_D);
  // The Blackwater: a still, deep mere under the Warden's heights, shelving at its shores.
  p.each((x, z, i) => {
    const d = sdPoly(BLACKWATER, x + 0.5, z + 0.5) + (fbm(x * 0.12, z * 0.12, 2, 57) - 0.5) * 2.6;
    if (d < 0) {
      // Under the Warden's cliff the mere is deep right to the rock: no wading round to his stair.
      grid.h[i] = shelve(sdPoly(HOLD, x + 0.5, z + 0.5) < 2.5 ? Math.min(d, -4) : d, FLOOR - 0.35, 2.1);
      grid.t[i] = T.Bed;
      grid.water[i] = FLOOR - 0.35;
      grid.noGrass[i] = 1;
      grid.side[i] = S.Dirt;
    } else if (d < 1.4 && grid.h[i] === FLOOR) grid.t[i] = d < 0.7 ? T.Mud : T.Reeds;
  }, 28, 16, 90, 46);
  // Rookfall: the gorge (see GORGE), the Whisper's water running on along its stony floor to the
  // cave (a fall in still costs a heart: it's below PLAYER.fallY). Its rim broken here and there, a
  // step down to a lip of rock (never more than a climb back up; not at the bridge or the pillar).
  p.each((x, z, i) => {
    const cx = x + 0.5, cz = z + 0.5, d = gorgeIn(cx, cz);
    if (d > 0) {
      const w = gorgeHW(cz), stream = distLine(GORGE, cx, cz) < Math.min(1.5, w * 0.42);
      grid.h[i] = stream ? RAVINE_FLOOR - 0.35 : RAVINE_FLOOR + (fbm(x * 0.7, z * 0.7, 2, 60) > 0.6 ? 0.3 : 0);
      grid.t[i] = stream ? T.Bed : fbm(x * 0.5, z * 0.5, 2, 58) > 0.55 ? T.Moss : T.Rock;
      grid.water[i] = stream ? RAVINE_FLOOR + 0.1 : NONE;
      grid.side[i] = S.Rock;
      grid.noGrass[i] = stream ? 1 : 0;
    } else if (d > -1.1 && grid.water[i] === NONE && grid.h[i] === FLOOR && Math.abs(cz - 30) > 2.5 && (cz < 34 || cz > 43)) {
      const n = fbm(cx * 0.6, cz * 0.6, 2, 62);
      if (n < 0.52) return;
      grid.h[i] = FLOOR - (n > 0.68 ? 1 : 0.5);
      grid.t[i] = T.Rock;
      grid.side[i] = S.Rock;
      grid.noGrass[i] = 1;
    }
  }, 84, 16, 104, 58);
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
  // The Heartpool: its shore shelves (sand, then shallows you can wade, then deep), and the Heart
  // Oak's island in it (a moss green inside a rim of sand).
  p.each((x, z, i) => {
    const cx = x + 0.5, cz = z + 0.5, di = isleSd(cx, cz);
    const e = lakeSd(cx, cz) + (fbm(x * 0.25, z * 0.25, 2, 63) - 0.5) * 1.2;
    if (di < 0) {
      grid.t[i] = di < -0.8 ? (fbm(x * 0.4, z * 0.4, 2, 66) > 0.62 ? T.Grass : T.Moss) : T.Sand;
      grid.noGrass[i] = di < -0.8 ? 0 : 1;
    } else if (e < 0) {
      grid.h[i] = shelve(Math.max(e, -di - 0.6), FLOOR - 0.35, 2.2);
      grid.t[i] = T.Bed;
      grid.water[i] = FLOOR - 0.35;
      grid.noGrass[i] = 1;
      grid.side[i] = S.Dirt;
    } else if (e < 1.3) {
      grid.t[i] = e < 0.6 ? T.Sand : T.Reeds;
      grid.noGrass[i] = e < 0.6 ? 1 : 0;
    } else if (e < 13) grid.t[i] = T.Grass;
  }, POND.x - 34, POND.z - 34, POND.x + 34, POND.z + 34);
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
    // (Not on the pines' ground north of Rookfall: the zone's edge there would cut them straight.)
    if (zone === 'pines' && n > 0.6 && x > 99) {
      grid.h[i] = FLOOR + (n > 0.7 ? 2 : 1);
      grid.side[i] = S.Rock;
      grid.t[i] = n > 0.7 ? T.Rock : T.DarkGrass;
    } else if (zone === 'deep' && n > 0.7) {
      grid.h[i] = FLOOR + 1;
      grid.side[i] = S.Dirt;
      grid.t[i] = T.Moss;
    }
  });
  // The way up from the Overhang onto the Warden's heights: a slope of bare rock, roots across it for
  // steps (drawn with the hold).
  p.ramp(STAIR.x0, STAIR.z0, STAIR.x1, STAIR.z1, 2, FLOOR, 5, false, T.Rock);
  // The ravine shelf under the northern cliffs: level, stony.
  p.flattenAlong(RAVINE_PATH.slice(2, -1), 4.2, FLOOR);
  // Paths (after the ground they cross).
  p.path(ROAD_IN, 2.4, T.Path, 0.5, 3);
  for (const [l, w, k] of [[ROAD_EAST, 2, 4], [ROAD_NORTH, 2, 5], [RAVINE_PATH, 2.2, 6], [LANE_BANK, 1.7, 7], [LANE_WEST, 1.7, 8], [LANE_GLADE, 1.5, 9], [HOLD_PATH, 1.8, 10], [LANE_STAG, 1.5, 11], [LANE_KILNS, 1.6, 12], [LAKE_RING, 1.7, 14], [LANE_SEA, 1.5, 15]] as [Pt[], number, number][])
    p.path(l, w, T.Path, 0.45, k, false);
  // ---------- the Warden's heights: the land ----------
  {
    // Which cells are the plateau (before anything is raised), and how far in from its edges.
    const mask = new Uint8Array(grid.w * grid.d);
    p.each((x, z, i) => (mask[i] = grid.h[i] === HOLD_H && grid.water[i] === NONE ? 1 : 0), 0, 0, 38, 50);
    const plat = (x: number, z: number) => grid.inside(x, z) && mask[grid.i(x, z)] === 1;
    const inner = (x: number, z: number, d: number) => {
      for (let dz = -d; dz <= d; dz++) for (let dx = -d; dx <= d; dx++) if (!plat(x + dx, z + dz)) return false;
      return true;
    };
    // Kept level: round the Great Tree and its hollow, the grave, the spring and stream, the
    // gully's mouth, the Warden's Seat, the path, where the garrison and the spitters stand.
    const keep: [number, number, number][] = [
      [GREAT.x, GREAT.z, 8.5], [BOWL.x, BOWL.z, 13], [GRAVE.x, GRAVE.z, 4.5], [SPRING.x, SPRING.z, 3.5], [CLEFT.x0, 15, 6], [SEAT.x, SEAT.z, 5.5],
      [18.2, 41.6, 2.5], [8.6, 37.4, 2.5],
    ];
    const kept = (x: number, z: number) => x > 25 || keep.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr) || distLine(HOLD_PATH, x, z) < 2.8 || distLine(STREAM, x, z) < 2.6;
    // Mossy rises a metre high (a jump up), and crags of rock too tall to climb, well in from the edges.
    const RISE = 1, CRAG = 2;
    const kind = new Uint8Array(grid.w * grid.d);
    p.each((x, z, i) => {
      if (!mask[i] || kept(x + 0.5, z + 0.5)) return;
      const crag = fbm(x * 0.19 + 40, z * 0.19, 2, 203), rise = fbm(x * 0.1, z * 0.1, 3, 201);
      if (crag > 0.73 && inner(x, z, 5)) kind[i] = CRAG;
      else if (rise > 0.63 && inner(x, z, 3)) kind[i] = RISE;
    }, 0, 0, 38, 50);
    // No lone blocks: a raised cell needs two raised neighbours.
    p.each((x, z, i) => {
      if (!kind[i]) return;
      let n = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (kind[grid.i(x + dx, z + dz)]) n++;
      if (n < 2) kind[i] = 0;
    }, 0, 0, 38, 50);
    p.each((x, z, i) => {
      if (kind[i] === CRAG) {
        const c = fbm(x * 0.19 + 40, z * 0.19, 2, 203);
        grid.h[i] = HOLD_H + 2.7 + Math.min(3, Math.round((c - 0.73) * 20)) * 0.3;
        grid.t[i] = c > 0.79 ? T.Rock : T.Moss;
        grid.side[i] = S.Rock;
        grid.noGrass[i] = 1;
      } else if (kind[i] === RISE) {
        grid.h[i] = HOLD_H + RISE;
        grid.side[i] = S.Rock;
      }
    }, 0, 0, 38, 50);
    // The spring (a pool among mossy stones) and its stream: a shallow stony run you can wade,
    // mossy banks, over the south cliff and down to the Whisper.
    p.each((x, z, i) => {
      const cx = x + 0.5, cz = z + 0.5;
      const d = Math.min(distLine(STREAM, cx, cz) + (fbm(cx * 0.45, cz * 0.45, 2, 211) - 0.5) * 0.5, Math.hypot(cx - SPRING.x, cz - SPRING.z) - 0.9);
      const h = grid.h[i], high = Math.abs(h - HOLD_H) < 0.3, low = Math.abs(h - FLOOR) < 0.3;
      if ((!high && !low) || d > 1.9) return;
      const level = (high ? HOLD_H : FLOOR) - 0.3;
      if (d < 0.8) {
        grid.h[i] = level - 0.4;
        grid.t[i] = T.Bed;
        grid.water[i] = level;
        grid.noGrass[i] = 1;
        grid.side[i] = S.Rock;
        grid.dir[i] = -1;
      } else if (grid.t[i] !== T.Path) grid.t[i] = d < 1.3 ? T.Gravel : T.Moss;
    }, 0, 20, 16, 58);
    // A deep plunge pool where the stream falls from the heights: every low cell touching its
    // channel up there, and the cells round those, are deep water (the channel's bed dips the cliff
    // to 2.3 m, within the Thornstag's reach, so nothing may stand beside it below).
    {
      const hi = HOLD_H - 0.3, pool: number[] = [];
      p.each((x, z, i) => {
        if (Math.abs(grid.water[i] - hi) > 0.01) return;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const j = grid.i(x + dx, z + dz);
          if (grid.h[j] < HOLD_H - 1.5) for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) pool.push(grid.i(x + dx + ox, z + dz + oz));
        }
      }, 0, 20, 16, 58);
      for (const i of pool) {
        if (grid.h[i] > FLOOR + 0.3 || grid.dir[i] >= 0) continue;
        grid.h[i] = FLOOR - 1.6;
        grid.t[i] = T.Bed;
        grid.water[i] = FLOOR - 0.3;
        grid.noGrass[i] = 1;
        grid.side[i] = S.Rock;
      }
    }
    // The ground in small patches: dark grass, leaf litter where the groves stand, moss on the
    // rises and by the water, bare mud here and there. Never big blocks of one kind.
    p.each((x, z, i) => {
      if (grid.water[i] !== NONE || grid.t[i] === T.Path || grid.t[i] === T.Gravel || !insidePoly(HOLD, x + 0.5, z + 0.5)) return;
      const h = grid.h[i];
      if (h < HOLD_H - 0.4 || h > HOLD_H + 1.2) return;
      const cx = x + 0.5, cz = z + 0.5, n = fbm(cx * 0.38, cz * 0.38, 3, 221), m = grovePatch(cx, cz);
      let t: number = T.DarkGrass;
      if (distLine(STREAM, cx, cz) < 2.6 || h > HOLD_H + 0.5) t = n > 0.4 ? T.Moss : T.DarkGrass;
      else if (m > 0.52 && n > 0.36) t = T.Dirt;
      else if (n > 0.7) t = T.Moss;
      else if (n < 0.27) t = T.Mud;
      grid.t[i] = t;
    }, 0, 0, 38, 50);
  }
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
  // The cleft to the stag's bed, through the wood's western wall north of the thicket.
  carveStagBed(grid, 0, Math.ceil(BED.mouth));
  // The stair climbs a cleft between two rocky, mossy hills at the heights' edge: highest at the
  // cleft's walls (too high to climb from the stair even on the stag, so the stair is the one way
  // up and the thorns across its top close it), falling away into the heights in ragged slopes; the
  // stair's foot comes out of the cliff face on its own. (Not over the path, the niche's rock.)
  for (const [x, z, i] of ((): [number, number, number][] => {
    const out: [number, number, number][] = [];
    p.each((x, z, i) => out.push([x, z, i]), 27, 2, 38, 25);
    return out;
  })()) {
    const cx = x + 0.5, cz = z + 0.5;
    if (!insidePoly(HOLD, cx, cz) || grid.h[i] < HOLD_H - 0.1 || distLine(HOLD_PATH, cx, cz) < 1.7) continue;
    if (x >= STAIR.x0 && x < STAIR.x1 && z >= STAIR.z0 && z < STAIR.z1) continue;
    if (x >= NICHE.x0 - 1 && x < NICHE.x1 + 1 && z >= NICHE.z0 - 1 && z < NICHE.z1) continue;
    const n = fbm(cx * 0.35, cz * 0.35, 2, 96);
    let lift = 0;
    for (const [hx, hz, hr, hh] of HILLS) {
      const d = Math.hypot(cx - hx, cz - hz) / (hr * (0.8 + n * 0.4));
      if (d < 1) lift = Math.max(lift, hh * (1 - d * d) ** 1.5 * (0.8 + n * 0.4));
    }
    if (x >= CLEFT.x0 && x < CLEFT.x1 && ((z >= CLEFT.z0 && z < STAIR.z0) || (z >= STAIR.z1 && z < CLEFT.z1))) lift = Math.max(lift, 3.2 + n * 0.8);
    if (lift < 0.45) continue;
    p.apply(i, { h: HOLD_H + Math.round(lift * 2) / 2, t: lift > 2.4 || n < 0.36 ? T.Rock : n > 0.55 ? T.Moss : T.DarkGrass, side: S.Rock, noGrass: lift > 2.4 });
  }
  // The Great Tree's roots: at its feet, the hollow ringed by two great roots that curve out from
  // the trunk and back in (the Warden's arena), their tips either side of the mouth. The trunk's
  // own cells stay level (the tree stands on them; its trunk is solid).
  p.each((x, z, i) => {
    const cx = x + 0.5, cz = z + 0.5, e = bowlE(cx, cz), a = bowlA(cx, cz), dt = Math.hypot(cx - GREAT.x, cz - GREAT.z);
    if (e < 1) {
      const n = fbm(cx * 0.4, cz * 0.4, 2, 231);
      grid.t[i] = n > 0.56 ? T.Moss : n < 0.3 ? T.Mud : T.Dirt;
      grid.noGrass[i] = n > 0.56 ? 0 : 1;
    } else if (dt < 2.3) return;
    else if (e < rootOuter(a) + 0.08 && !inMouth(a)) {
      grid.t[i] = T.Mud;
      grid.noGrass[i] = 1;
    }
  }, BOWL.x - 12, GREAT.z - 7, BOWL.x + 12, BOWL.z + 11);
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
  // The Rook Pillar: a column of rock left standing where the gorge is widest, a jump from the east rim.
  const rim = (() => {
    let x = Math.floor(gorgeX(38.5));
    while (x < 106 && grid.h[grid.i(x, 38)] < -3) x++;
    return x;
  })();
  const PILLAR = { x0: rim - 4, x1: rim - 2, z0: 37, z1: 40 };
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
  for (const [cx, cz, rr] of [[CLEARING.x, CLEARING.z, 4.5], [HERBS.x, HERBS.z, 4]] as [number, number, number][])
    p.each((x, z, i) => {
      if (grid.h[i] === FLOOR && grid.water[i] === NONE && Math.hypot(x + 0.5 - cx, z + 0.5 - cz) < rr) grid.t[i] = (x + z) % 4 === 0 ? T.Dirt : T.Grass;
    }, cx - rr - 1, cz - rr - 1, cx + rr + 1, cz + rr + 1);

  // ---------- props ----------
  const kit = new MapKit(grid, [ROAD_IN, ROAD_EAST, ROAD_NORTH, RAVINE_PATH, LANE_BANK, LANE_WEST, LANE_GLADE, HOLD_PATH, LANE_STAG, LANE_KILNS, LAKE_RING, LANE_SEA]);
  const flat = (x: number, z: number, rad: number) => kit.flatAround(x, z, rad);
  // ---------- who lives where (placed before the props, which keep clear of them) ----------
  // A foe's index in this list is its save id: append, never reorder.
  // The Old Grove's ambush (the prototype's): goblins crouch in bushes beside the road and burst out as
  // the knight passes.
  const AMBUSH: Pt[] = [[88.4, 99.4], [90.4, 104.2], [95.6, 105.2]];
  for (const [x, z] of AMBUSH) b.bush(x, z, 1.3);
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
    // The Thorn Ravine: spitters against the cliff, rooks over the shelf.
    { type: 'spitter', x: 78.5, z: 14 },
    { type: 'spitter', x: 60.5, z: 11.8 },
    { type: 'spitter', x: 50, z: 11.8 },
    { type: 'bat', x: 70, z: 16 },
    { type: 'bat', x: 55, z: 16.5 },
    // The Overhang: guards at the foot of the stair, the big one at the end of the ravine's gauntlet.
    { type: 'shield', x: 38.4, z: 16.1, elite: true },
    { type: 'goblin', x: 43.4, z: 17.2 },
    // The Mossfen: rooks over the pools, a spitter rooted in the reeds.
    { type: 'bat', x: 14, z: 102 },
    { type: 'bat', x: 24, z: 108 },
    { type: 'spitter', x: 26, z: 104.5 },
    // The Bat Roost: real bats, in the cliff.
    { type: 'bat', x: 109.5, z: 3.5, plain: true },
    { type: 'bat', x: 110.8, z: 2.5, plain: true },
    // The Withered Wood: spitters among the dead trees.
    { type: 'spitter', x: 18.2, z: 41.6 },
    { type: 'spitter', x: 8.6, z: 37.4 },
    // The Charcoal Kilns: goblins who took the burners' camp.
    { type: 'goblin', x: 44, z: 103, group: 'kilns' },
    { type: 'goblin', x: 46.8, z: 107.4, group: 'kilns' },
    { type: 'snarer', x: 51.2, z: 101.4, group: 'kilns' },
    { type: 'archer', x: 39.6, z: 99.4, group: 'kilns', guard: true },
    // The Stag's Thicket: the Warden's keepers of the bound stag.
    { type: 'snarer', x: 15.4, z: 67.6, group: 'stag' },
    { type: 'goblin', x: 9.6, z: 75.4, group: 'stag' },
    { type: 'goblin', x: 13.2, z: 75.2, group: 'stag' },
    { type: 'thornback', x: 8.4, z: 71, group: 'stag' },
    // The Warden's garrison before the hollow's mouth (cleared, the thorns across it draw back), and
    // the Warden, at the back of its hollow.
    { type: 'shield', x: 28.4, z: 21.2, group: 'garrison' },
    { type: 'shield', x: 28.6, z: 27, group: 'garrison' },
    { type: 'archer', x: 29, z: 24.8, group: 'garrison', guard: true },
    { type: 'archer', x: 26.6, z: 32.8, group: 'garrison', guard: true },
    { type: 'thornback', x: 30.4, z: 30.6, group: 'garrison' },
    { type: 'warden', x: BOWL.x - 3.5, z: BOWL.z - 1, group: 'boss' },
    // A thornback minds the Warden's Seat; the Rookery's rooks (they take coin); goblins camped by the brook.
    { type: 'thornback', x: SEAT.x + 1.8, z: SEAT.z + 4.1 },
    { type: 'bat', x: ROOKERY.x - 2, z: ROOKERY.z + 1.5, group: 'rookery' },
    { type: 'bat', x: ROOKERY.x + 2.5, z: ROOKERY.z - 1, group: 'rookery' },
    { type: 'goblin', x: BROOKCAMP.x - 1.8, z: BROOKCAMP.z - 0.6, group: 'brookcamp' },
    { type: 'goblin', x: BROOKCAMP.x + 2, z: BROOKCAMP.z + 0.4, group: 'brookcamp' },
    // ---- added 2026-10-01 (appended: a foe's index is its save id) ----
    ...AMBUSH.map(([x, z]): EnemySpawn => ({ type: 'goblin', x, z, group: 'ambush', ambush: true })),
  ];
  const critters: CritterDef[] = [
    ...([[88, 84], [30, 60], [74, 108], [84.5, 79], [84, 72]] as Pt[]).map(([x, z]): CritterDef => ({ kind: 'deer', x, z, area: [x - 5, z - 4, x + 5, z + 4] })),
    ...([[80, 66.6], [110, 44], [36, 92], [61.5, 103]] as Pt[]).map(([x, z]): CritterDef => ({ kind: 'squirrel', x, z, area: [x - 4, z - 3, x + 4, z + 3] })),
    { kind: 'fox', x: 16, z: 92, area: [10, 88, 24, 96] },
  ];
  // Where foes and animals start: no tree, rock or bush lands on them, however the scatter shifts.
  const homes: Pt[] = [...enemies.filter((e) => e.type !== 'bat'), ...critters].map((e): Pt => [e.x, e.z]).concat([OWL]);
  const keepOut = (x: number, z: number) =>
    homes.some(([px, pz]) => Math.hypot(x - px, z - pz) < 1.3) ||
    lakeSd(x, z) < 9.5 || // the village
    CANOPY.some((c) => Math.hypot(x - c.x, z - c.z) < 6) ||
    Math.hypot((x - MIRROR.x) / (MIRROR.rx + 1.5), (z - MIRROR.z) / (MIRROR.rz + 1.5)) < 1 ||
    (x > STAND.x0 - 2.5 && x < STAND.x1 + 2.5 && z > STAND.z0 - 2.5 && z < STAND.z1 + 3) ||
    (x > ROOST.x0 - 3 && x < ROOST.x1 + 3 && z < ROOST.z1 + 6) ||
    (x > 96 && x < 108 && z > 34 && z < 43) || // the Rook Pillar's run-up
    (x > 82 && x < 106 && z > 44 && z < 62) || // the Whisper's Fall, its lookout, and the view of it
    Math.hypot(x - RING.x, z - RING.z) < RING.r + 6 ||
    (x > LOG.x - 4 && x < LOG.x + 4 && z > LOG.z0 - 2 && z < LOG.z1 + 2.5) ||
    Math.hypot(x - SHRINE.x, z - SHRINE.z) < SHRINE.r + 1 ||
    Math.hypot(x - DELL.x, z - DELL.z) < 7 ||
    Math.hypot(x - KILNS.x, z - KILNS.z) < 8.5 ||
    Math.hypot(x - GRAVE.x, z - GRAVE.z) < 3.5 ||
    Math.hypot(x - GLADE.x, z - GLADE.z) < 6 ||
    Math.hypot(x - STAG.x, z - STAG.z) < 6.5 ||
    inStagBed(x, z) > 0 || Math.hypot(x - BED.mouth, z - BED.cz) < 2.5 || // the stag's bed and the mouth of its cleft
    LEDGES.some((l) => x > l.x0 - 2 && x < l.x1 + 2 && z < l.z1 + 2.5) ||
    (x > NICHE.x0 - 1.5 && x < NICHE.x1 + 1.5 && z < NICHE.z1 + 2.5) ||
    Math.hypot(x - CLEARING.x, z - CLEARING.z) < 6 ||
    gorgeIn(x, z) > -1.4 || // Rookfall (trees and ferns right up to its lip)
    Math.hypot(x - SEAT.x, z - SEAT.z) < 4 || Math.hypot(x - ROOKERY.x, z - ROOKERY.z) < 5.5 || Math.hypot(x - HIVES.x, z - HIVES.z) < 3.5 || Math.hypot(x - BROOKCAMP.x, z - BROOKCAMP.z) < 4 ||
    Math.hypot(x - GREAT.x, z - GREAT.z) < 7 || // the Great Tree
    bowlE(x, z) < 1.5 || // its hollow and the roots round it
    distLine(STREAM, x, z) < 1.4 || Math.hypot(x - SPRING.x, z - SPRING.z) < 2.6 || // the spring and its stream
    (x > CLEFT.x0 - 4 && x < CLEFT.x1 + 2 && z > CLEFT.z0 - 1.5 && z < CLEFT.z1 + 1.5) || // the cleft and the thorns across its top
    (x > 104 && z > 100 && z < 112 && x < 116); // the Warden's Stone
  // The Old Wood's trees, each zone its own kinds and density (a fixed hash, not the dice, picks
  // the spots, so nothing else shifts). Phones get a third fewer.
  const thin = MOBILE ? 0.7 : 1;
  // The camera's view of Old Nettle's corner (a strip from it toward the camera, south-east, as wide as
  // her corner and long enough that no crown stands up into it): the trees that would stand there are
  // still grown, on a builder whose work is thrown away, so the dice everything after them draws
  // (Hollowbough's trees and props) stay as they were.
  const unseen = new Builder(grid, b.lights, b.fx, b.rng);
  unseen.heightFn = (x, z) => grid.groundAt(x, z);
  const herbView = (x: number, z: number) => {
    const along = (x - HERBS.x + z - HERBS.z) / Math.SQRT2, across = (x - HERBS.x - (z - HERBS.z)) / Math.SQRT2;
    return Math.hypot(x - HERBS.x, z - HERBS.z) < 5.5 || (along > 0 && along < 13.5 && Math.abs(across) < 5.5);
  };
  // The same for the Mushroom Dell's floor (a big oak on the strip hid its south side).
  const dellView = (x: number, z: number) => {
    const along = (x - DELL.x + z - DELL.z) / Math.SQRT2, across = (x - DELL.x - (z - DELL.z)) / Math.SQRT2;
    return along > 0 && along < 12 && Math.abs(across) < 4.5;
  };
  for (let z0 = 3; z0 < 117; z0 += 1.6)
    for (let x0 = 3; x0 < 118; x0 += 1.6) {
      const x = x0 + hash(x0, z0) * 1.4, z = z0 + hash(z0 + 7, x0) * 1.4, zid = zoneAt(x, z), zs = ZONES[zid];
      // Groves and glades: thick where the patch noise is high, open where it's low (the deep woods
      // vary less).
      const pch = patchAt(x, z), dens = zs.density * (zid === 'deep' || zid === 'pines' ? 0.6 + 0.8 * pch : 0.15 + 1.7 * pch);
      if (!zs.trees.length || hash(x * 1.3, z * 0.7) > dens * 1.9 * thin) continue;
      if (keepOut(x, z) || kit.nearRoad(x, z, 2.6) || insidePoly(MOSSFEN, x, z)) continue;
      if (grid.groundAt(x, z) < FLOOR - 0.05 || grid.waterAt(x, z) !== NONE || !flat(x, z, 0.4)) continue;
      const kind = pick(zs.trees, hash(x * 2.1, z * 1.7)), s = zs.size * (0.85 + hash(z * 3.1, x) * 0.5), tb = herbView(x, z) || dellView(x, z) ? unseen : b;
      if (kind === 'pine') tb.pine(x, z, s);
      else if (kind === 'oak') tb.oak(x, z, s);
      else if (kind === 'birch') D.birch(tb, x, z, s);
      else if (kind === 'dead') tb.deadTree(x, z, s * 0.9);
      else tb.bush(x, z, s * 0.9, '#3b6b2a');
    }
  // Pines on the northern and western heights.
  // (Not in the Withered Wood: its crags and the Great Tree's roots stand that high too.)
  forest(b, r, 0, 0, 120, 120, 0.3, (x, z) => grid.groundAt(x, z) >= 7.5 && flat(x, z, 0.3) && !homes.some(([px, pz]) => Math.hypot(x - px, z - pz) < 1.3) && !(insidePoly(HOLD, x, z) && x < 25.5), 'pine');
  // ---------- the Warden's heights: what grows there ----------
  // Nothing planted: groves of dead trees of every size where the leaf litter lies (the ground's
  // own patch noise), open dark grass between, a few great withered oaks alone; dead shrubs; thorns
  // only where thorns take (at the feet of trees and crags, over the cliff lips, up the trunks near
  // the Great Tree); and creepers running out over the ground from the Great Tree, as if the thorns
  // came from it.
  {
    const onHeights = (x: number, z: number) => insidePoly(HOLD, x, z) && Math.abs(grid.groundAt(x, z) - HOLD_H) < 0.05 && grid.waterAt(x, z) === NONE;
    // (Round the Great Tree and before its arena's mouth: an open glade, so the way is plain.)
    const glade = (x: number, z: number) => Math.hypot(x - GREAT.x, z - GREAT.z) < 11 || Math.hypot(x - (BOWL.x + BOWL.rx + 5), z - BOWL.z) < 8 || bowlE(x, z) < 1.75;
    const clear = (x: number, z: number, rad: number) =>
      onHeights(x, z) && !keepOut(x, z) && !glade(x, z) && !kit.nearRoad(x, z, 1.6 + rad) && flat(x, z, rad) && distLine(STREAM, x, z) > 1.4 + rad;
    const trunks: [number, number, number, number][] = []; // x, z, room, scale
    const roomFor = (x: number, z: number, d: number) => !trunks.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < d + pr);
    const thornClump = (x: number, z: number, s: number) => {
      if (!clear(x, z, 0.3) || !roomFor(x, z, 0.2)) return;
      bramble(b, x, z, s, 0.9 + s * 0.6, hash(x * 5, z * 3) > 0.8);
      b.collide({ kind: 'c', x, z, r: 0.3 + s * 0.2, y0: HOLD_H - 1, y1: HOLD_H + 1.3 });
    };
    // Groves: a centre every ~6.5 m (jittered), trees only where the leaf litter lies, as many and as
    // spread as it's thick; half the trunks with thorns at their feet, some with a dead shrub.
    for (let gz = 0; gz < 48; gz += 6.5)
      for (let gx = 0; gx < 37; gx += 6.5) {
        const cx = gx + hash(gx + 0.31, gz) * 6.5, cz = gz + hash(gz + 0.77, gx) * 6.5, patch = grovePatch(cx, cz);
        if (patch < 0.48 || !insidePoly(HOLD, cx, cz)) continue;
        const n = Math.round((2 + Math.floor((patch - 0.48) * 14 + hash(cx, cz) * 2)) * (MOBILE ? 0.7 : 1));
        for (let k = 0; k < n; k++) {
          const a = hash(cx + k * 1.3, cz) * Math.PI * 2, d = Math.sqrt(hash(cz + k * 1.7, cx)) * (2.2 + patch * 2.4);
          const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, u = hash(x * 3.3, z * 2.1);
          const big = u > 0.88, s = big ? 0.85 + (u - 0.88) * 3 : 0.55 + u * 0.8, room = big ? 1.2 : 0.5;
          if (!clear(x, z, big ? 0.7 : 0.4) || !roomFor(x, z, big ? 1.6 : 0.9)) continue;
          trunks.push([x, z, room, s]);
          if (big) witheredOak(b, x, z, s);
          else b.deadTree(x, z, s);
          if (hash(x * 1.7, z) < 0.3) {
            const m = 1 + Math.floor(hash(z * 2.1, x) * 2.4);
            for (let j = 0; j < m; j++) {
              const ta = a + j * 2.2 + hash(x + j, z) * 1.2, td = room + 0.35 + hash(z + j, x) * 0.6;
              thornClump(x + Math.cos(ta) * td, z + Math.sin(ta) * td, 0.45 + hash(x, z + j) * 0.55);
            }
          }
          if (hash(x, z * 1.9) < 0.55) {
            const sa = a + 3.4, sd = room + 0.6 + hash(z, x * 1.3) * 0.9, sx = x + Math.cos(sa) * sd, sz = z + Math.sin(sa) * sd;
            if (clear(sx, sz, 0.3)) deadShrub(b, sx, sz, 0.7 + hash(sx, sz) * 0.6);
          }
        }
        // Now and then a fallen trunk among them.
        if (patch > 0.58 && hash(cx * 0.7, cz) < 0.4) {
          const lx = cx + (hash(cz, cx) - 0.5) * 3, lz = cz + (hash(cx, cz * 1.1) - 0.5) * 3;
          if (clear(lx, lz, 1.4) && roomFor(lx, lz, 1.4)) {
            D.fallenLog(b, lx, lz, 2.4 + hash(cz, cx) * 1.8, hash(cx, cz * 0.3) * Math.PI);
            trunks.push([lx, lz, 1.4, 1]);
          }
        }
      }
    // A few great withered oaks standing alone.
    for (const [x, z] of [[21.6, 40.2], [6.6, 21.8], [28.4, 36.4], [3.8, 11.5], [20.5, 6.5], [15.5, 44]] as Pt[])
      if (clear(x, z, 0.8) && roomFor(x, z, 2.2)) {
        const s = 1.25 + hash(x, z) * 0.35;
        witheredOak(b, x, z, s);
        trunks.push([x, z, 1.4, s]);
      }
    // The crags and rises: boulders against their feet (so they read as rock, not blocks), thorns
    // rooted by the crags.
    for (let z = 1; z < 48; z++)
      for (let x = 1; x < 26; x++) {
        const h = grid.h[grid.i(x, z)], crag = h > HOLD_H + 2.5 && h < HOLD_H + 4, rise = Math.abs(h - HOLD_H - 1) < 0.05;
        if ((!crag && !rise) || !insidePoly(HOLD, x + 0.5, z + 0.5)) continue;
        const u = hash(x * 1.9 + 0.5, z * 1.3);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as Pt[]) {
          if (Math.abs(grid.h[grid.i(x + dx, z + dz)] - HOLD_H) > 0.05) continue;
          const fx = x + 0.5 + dx * 0.55, fz = z + 0.5 + dz * 0.55;
          if (u < (crag ? 0.45 : 0.22))
            b.g(fx, fz).blob(fx, HOLD_H + (crag ? 0.5 + u : 0.2), fz, 0.45 + u * 0.6, crag ? 0.7 + u : 0.4 + u, 0.45 + u * 0.5, u < 0.2 ? PAL.rock : PAL.rockDark, x * 31 + z * 7, { kind: K.Rock, jitter: 0.3 });
          else if (crag && u < 0.62) thornClump(x + 0.5 + dx * 1.2, z + 0.5 + dz * 1.2, 0.55 + u * 0.4);
          break;
        }
      }
    // Over the heights' edges: thorns hanging over the lip, dead shrubs, stones, in stretches with
    // long bare runs between.
    for (let z = 0; z < 49; z++)
      for (let x = 0; x < 37; x++) {
        const i = grid.i(x, z);
        if (Math.abs(grid.h[i] - HOLD_H) > 0.05 || grid.water[i] !== NONE || !insidePoly(HOLD, x + 0.5, z + 0.5)) continue;
        let edge: Pt | null = null;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as Pt[]) if (grid.inside(x + dx, z + dz) && grid.h[grid.i(x + dx, z + dz)] < HOLD_H - 2.4) edge = [dx, dz];
        if (!edge) continue;
        const lp = patchAt(x * 1.7 + 3, z * 1.7), u = hash(x * 2.3 + 1, z * 0.9);
        if (u > 0.55 * lp) continue;
        const lx = x + 0.5 + edge[0] * 0.25 + (hash(z, x) - 0.5) * 0.5 * Math.abs(edge[1]), lz = z + 0.5 + edge[1] * 0.25 + (hash(x, z) - 0.5) * 0.5 * Math.abs(edge[0]);
        if (keepOut(lx, lz) || kit.nearRoad(lx, lz, 1.2)) continue;
        if (u < 0.22 * lp) {
          bramble(b, lx, lz, 0.55 + u * 1.4, 0.9 + u, false);
          b.collide({ kind: 'c', x: lx, z: lz, r: 0.35, y0: HOLD_H - 1, y1: HOLD_H + 1.2 });
        } else if (u < 0.4 * lp) deadShrub(b, lx, lz, 0.7 + u);
        else b.rock(lx, lz, 0.3 + u * 0.4, false);
      }
    // Out in the open: a dead shrub here and there, toadstools.
    for (let z0 = 1; z0 < 48; z0 += 2.3)
      for (let x0 = 1; x0 < 36; x0 += 2.3) {
        const x = x0 + hash(x0 * 1.1, z0) * 2, z = z0 + hash(z0, x0 * 0.9) * 2, u = hash(x * 4.1, z * 3.7);
        if (grovePatch(x, z) > 0.5 || u > 0.1 || !clear(x, z, 0.3) || !roomFor(x, z, 0.6)) continue;
        if (u < 0.06) deadShrub(b, x, z, 0.6 + u * 6);
        else b.mushrooms(x, z, 3 + Math.floor(u * 30), false);
      }
    // The spring: mossy stones round its pool, ferns and moonflowers (the one green corner of the wood).
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + 0.4, d = 2.2 + hash(k, 7) * 0.5, x = SPRING.x + Math.cos(a) * d, z = SPRING.z + Math.sin(a) * d;
      if (distLine(STREAM.slice(0, 2), x, z) < 1.3 || grid.waterAt(x, z) !== NONE) continue;
      b.rock(x, z, 0.45 + hash(k, 9) * 0.5, true);
    }
    D.fern(b, SPRING.x - 2.4, SPRING.z + 0.6, 1.2);
    D.fern(b, SPRING.x + 1.4, SPRING.z - 2.2, 1);
    b.moonflowers(SPRING.x + 2, SPRING.z + 1.8, 6, 0.8);
    b.fx.addEmitter({ x: SPRING.x, y: HOLD_H - 0.2, z: SPRING.z, rate: 0.6, spec: P.wisp, spread: 1.2, vy: 0.1 });
    // The stream's fall over the south cliff: water pouring from the lip, spray, mist at the foot.
    {
      let lip: Pt | null = null;
      for (let k = 1; k < STREAM.length && !lip; k++) {
        const [ax, az] = STREAM[k - 1], [bx, bz] = STREAM[k];
        for (let t = 0; t < 1; t += 0.05) {
          const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
          if (grid.groundAt(x, z) < HOLD_H - 1.5) {
            lip = [x - (bx - ax) * 0.06, z - (bz - az) * 0.06];
            break;
          }
        }
      }
      if (lip) {
        const [lx, lz] = lip, top = HOLD_H - 0.3, foot = FLOOR - 0.3, gl = b.gl(lx, lz);
        for (let k = -2; k <= 2; k++) {
          const ox = lx + k * 0.22, oz = lz + 0.15;
          gl.box(ox, foot, oz, 0.05, top - foot, 0.07, [0.14, 0.19, 0.3], {});
          b.fx.addEmitter({ x: ox, y: top, z: oz, rate: 6, spec: P.fall, spread: 0.1, vy: 0 });
        }
        b.fx.addEmitter({ x: lx, y: foot + 0.2, z: lz + 0.8, rate: 3, spec: P.splash, spread: 0.5, vy: 1 });
        b.fx.addEmitter({ x: lx, y: foot + 0.4, z: lz + 0.9, rate: 1.2, spec: P.smoke, spread: 0.8, vy: 0.3 });
        b.lights.add(lx, foot + 1, lz + 1, 0x80a8ff, 3, 5, 0.2);
        for (const [dx, dz, s] of [[-1.3, 1.2, 0.7], [1.2, 1.5, 0.55], [-0.9, 2.4, 0.45]] as [number, number, number][]) if (grid.waterAt(lx + dx, lz + dz) === NONE) b.rock(lx + dx, lz + dz, s, false);
      }
    }
  }
  // The Old Grove's ancient oaks, each alone in a pool of moonlight.
  for (const [x, z, s] of [[64, 100, 1.1], [88, 106, 1.25], [88, 97, 1], [96, 108, 1.15], [70, 111, 0.9]] as [number, number, number][]) giantOak(b, x, z, s, 3);
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
    const { x, z } = h;
    return [k, { x, z, ...homeTree(b, x, z, h.s, { face: h.face, treehouse: h.treehouse, chimney: true }) }];
  })) as Record<keyof typeof HOMES, { x: number; z: number; door: { x: number; z: number }; deck: [number, number, number] | null }>;
  const heart = homeTree(b, OAK.x, OAK.z, 1.25, { face: Math.PI / 4, treehouse: true, chimney: false });
  // Rope bridges to the island, not a matched pair: east from its side to the road's shore, and
  // south from its green down to the lane's shore; each from the island's edge to the first dry
  // ground (over water only), along a cell boundary.
  const span = (sx: number, sz: number, dx: number, dz: number, wet: (x: number, z: number) => boolean): [number, number] => {
    let x = sx, z = sz, n = 0;
    while (!wet(x, z) && n++ < 160) [x, z] = [x + dx * 0.25, z + dz * 0.25];
    const edge = dx ? x - dx * 0.2 : z - dz * 0.2;
    while (wet(x, z) && n++ < 320) [x, z] = [x + dx * 0.25, z + dz * 0.25];
    return [edge, dx ? x + dx * 0.3 : z + dz * 0.3];
  };
  const BRIDGE_Z = 77, BRIDGE_X = 53;
  let BRIDGE_END_E = 70;
  {
    const wetAt = (x: number, z: number) => grid.inside(Math.floor(x), Math.floor(z)) && grid.water[grid.i(Math.floor(x), Math.floor(z))] !== NONE;
    const [a, c] = span(ISLE.x, BRIDGE_Z, 1, 0, (x) => wetAt(x, BRIDGE_Z - 1) || wetAt(x, BRIDGE_Z));
    ropeBridge(b, grid, a, BRIDGE_Z, c, BRIDGE_Z, FLOOR);
    BRIDGE_END_E = c;
    const [d, e] = span(BRIDGE_X, ISLE.z, 0, 1, (_x, z) => wetAt(BRIDGE_X - 1, z) || wetAt(BRIDGE_X, z));
    ropeBridge(b, grid, BRIDGE_X, d, BRIDGE_X, e, FLOOR);
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
  // Lanterns hung from the Heart Oak's limbs over the green and the water.
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 0.3;
    const lx = OAK.x + Math.cos(a) * 4.8, lz = OAK.z + Math.sin(a) * 4.8, y = FLOOR + 4.2 + (k % 2) * 0.7;
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
  table(...off(home.inn, HOMES.inn.face, 4.2, 1)); // (on the lane's side: the Old Grove's first oak stands on the other)
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
  // The gathering fire on the island's green, logs round it to sit on.
  {
    const { x: cx, z: cz } = FIRE;
    b.campfire(cx, cz, true);
    for (const a of [0.9, 2.55, 5.25]) D.fallenLog(b, cx + Math.cos(a) * 2.1, cz + Math.sin(a) * 2.1, 1.8, a + Math.PI / 2);
  }
  // The fisher's jetty out from the south-east shore, a boat tied up by it.
  const JETTY_Z = 84;
  const jettyX = (() => {
    let x = 76;
    while (x > POND.x && grid.water[grid.i(Math.floor(x), JETTY_Z)] === NONE) x -= 0.5;
    return x + 0.5;
  })();
  b.pier(jettyX - 3.8, jettyX + 0.6, JETTY_Z + 0.5, 1.6, FLOOR + 0.05);
  b.rowboat(jettyX - 2.6, FLOOR - 0.45, JETTY_Z + 2.4, -0.3);
  for (const [x, z, n, r] of [[65.5, 64.5, 8, 2], [44.5, 82.5, 7, 1.8], [49.5, 67.5, 6, 1.6], [62.5, 82, 5, 1.4]] as [number, number, number, number][])
    if (lakeSd(x, z) < -1.5 && isleSd(x, z) > 1.5) D.lilyPads(b, x, z, n, r);
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
  // Where the folk go about their day (see the NPCs): washing at the bay's shore, the old man's
  // seat by the fire, the children's round of the green, the gardener's beds, the carrier's way
  // along the south shore between the smithy and the inn (where the road comes in), the watch at the east bridge.
  const shoreSpot = (a: number): [number, number, number] => {
    const [x, z] = byLake(a, 0.35);
    return [x, z, Math.atan2(POND.z - z, POND.x - x)];
  };
  const washSpot = shoreSpot(2.72);
  const sitSpot: [number, number, number] = [FIRE.x + Math.cos(1.72) * 1.6, FIRE.z + Math.sin(1.72) * 1.6, 1.72 + Math.PI];
  const kids: [number, number][] = [0.4, 2.0, 3.4, 4.9].map((a) => [FIRE.x + Math.cos(a) * 3.3, FIRE.z + Math.sin(a) * 3.3]);
  const garden: [number, number][] = [off(home.ash, HOMES.ash.face, 2.6, 1.9), off(home.ash, HOMES.ash.face, 3.6, 3.2), off(home.ash, HOMES.ash.face, 1.2, 3.4)];
  const carry: [number, number][] = [
    off(home.smithy, HOMES.smithy.face, -1.2, 1.4), ...[0.35, 0.7, 1.05, 1.4].map((a) => byLake(a, 2.4)), [61.4, 95.2], off(home.inn, HOMES.inn.face, 1.4, 1.6), // (round the inn's trunk, east of it)
  ];
  carry.push(...carry.slice(1, -1).reverse());
  const watchSpot: Pt = [BRIDGE_END_E + 1.4, BRIDGE_Z + 1.4];
  // ---------- the wood's empty corners, given something ----------
  // (Each built on dice of its own, lent to the builder and given back, so nothing placed after
  // moves.)
  const own = (seed: number, f: () => void) => {
    const keep = b.rng;
    b.rng = diceAt(seed, seed * 3, 13);
    try {
      f();
    } finally {
      b.rng = keep;
    }
  };
  // The Warden's Seat: a knot of great roots grown into a seat at the heights' north-west corner,
  // facing out over the wood (and the camera): its back roots rising and curling over, its arms
  // roots curving round either side, moss for the seat; the old hoard behind it.
  own(701, () => {
    const { x, z } = SEAT, y = grid.groundAt(x, z), g = b.g(x, z), d = diceAt(x, z, 11), back = -Math.PI * 0.75;
    for (let k = 0; k < 5; k++) {
      const a = back + (k - 2) * 0.34;
      bough(g, [x + Math.cos(a) * 0.7, y - 0.2, z + Math.sin(a) * 0.7], [x + Math.cos(a) * 1.3, y + 2.4 + d() * 0.9, z + Math.sin(a) * 1.3], 0.44, 0.12, k % 2 ? WOOD.barkDark : WOOD.bark, d);
    }
    for (const side of [-1, 1]) {
      const a0 = back + side * 1.25;
      bough(g, [x + Math.cos(a0) * 1.1, y + 0.2, z + Math.sin(a0) * 1.1], [x + Math.cos(a0 + side * 0.95) * 1.5, y + 0.85, z + Math.sin(a0 + side * 0.95) * 1.5], 0.36, 0.22, WOOD.bark, d);
    }
    g.blob(x, y + 0.35, z, 0.95, 0.35, 0.85, WOOD.moss, 702, { kind: K.Grass, jitter: 0.3 });
    b.collide({ kind: 'c', x, z, r: 1.1, y0: y - 1, y1: y + 0.95 });
    b.mushrooms(x - 2.6, z + 0.6, 4, true);
    D.bones(b, x + 1.6, z - 0.4, 2, true);
  });
  // The Rookery: three tall dead pines north of Rookfall, great stick nests in their tops; one nest
  // down on the ground in a scatter of feathers, what the rooks hoarded still in it.
  own(703, () => {
    const { x, z } = ROOKERY, d = diceAt(x, z, 12);
    for (const [px, pz, h] of [[x - 3.2, z - 2.4, 8.5], [x + 2.4, z - 3.4, 9.5], [x + 3.6, z + 1.8, 7.5]] as [number, number, number][]) {
      const g = b.g(px, pz), y = grid.groundAt(px, pz);
      g.sweep([[px, y - 0.4, pz], [px + (d() - 0.5) * 0.3, y + h * 0.5, pz + (d() - 0.5) * 0.3], [px + (d() - 0.5) * 0.5, y + h, pz + (d() - 0.5) * 0.5]], [0.34, 0.24, 0.08], PAL.dead, { kind: K.Bark, seg: 6, lumpy: 0.15, seed: Math.floor(d() * 999) });
      for (let k = 0; k < 5; k++) {
        const a = d() * Math.PI * 2, hy = y + h * (0.45 + k * 0.1);
        bough(g, [px, hy, pz], [px + Math.cos(a) * (1.4 - k * 0.15), hy + 0.5 + d() * 0.5, pz + Math.sin(a) * (1.4 - k * 0.15)], 0.08, 0.03, PAL.dead, d, 0.08);
      }
      // The nest: a knot of sticks in the top fork.
      const ny = y + h * 0.88;
      g.blob(px, ny, pz, 0.55, 0.28, 0.55, '#3a2e22', Math.floor(d() * 999), { kind: K.Bark, jitter: 0.35 });
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        g.beam([px + Math.cos(a) * 0.3, ny + 0.1, pz + Math.sin(a) * 0.3], [px + Math.cos(a + 1.3) * 0.7, ny + 0.2, pz + Math.sin(a + 1.3) * 0.7], 0.025, PAL.dead, { kind: K.Bark });
      }
      b.collide({ kind: 'c', x: px, z: pz, r: 0.35, y0: y - 1, y1: y + h });
    }
    // The fallen nest round the chest, feathers about it.
    const g = b.g(x, z), y = grid.groundAt(x, z);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + d() * 0.3;
      g.beam([x - 0.6 + Math.cos(a) * 0.6, y + 0.1, z + 0.2 + Math.sin(a) * 0.6], [x - 0.6 + Math.cos(a + 1.1) * 1.1, y + 0.2 + d() * 0.15, z + 0.2 + Math.sin(a + 1.1) * 1.1], 0.03, PAL.dead, { kind: K.Bark });
    }
    for (let k = 0; k < 14; k++) b.d(x, z).box(x + (d() - 0.5) * 6, y + 0.03, z + (d() - 0.5) * 6, 0.18, 0.02, 0.06, '#1c1c24', {});
    D.bones(b, x + 1.5, z - 1.2, 2, false);
  });
  // The beekeeper's hives on the bank between the Heartpool and the Whisper: straw skeps on a bench
  // of split logs, bees about them, flowers for them.
  own(705, () => {
    const { x, z } = HIVES, y = grid.groundAt(x, z), g = b.g(x, z);
    g.box(x, y + 0.3, z, 3.4, 0.08, 0.7, PAL.wood, { kind: K.Wood });
    for (const s of [-1.5, 0, 1.5]) g.box(x + s, y, z, 0.12, 0.3, 0.6, PAL.woodDark, { kind: K.Wood });
    for (const s of [-1.1, 0, 1.1]) {
      for (let k = 0; k < 4; k++) g.cyl(x + s, y + 0.38 + k * 0.17, z, 0.42 - k * 0.08, 0.38 - k * 0.09, 0.17, 9, k % 2 ? '#b89a50' : '#a88a44', { kind: K.Grass });
      g.box(x + s + 0.02, y + 0.42, z + 0.36, 0.14, 0.1, 0.04, '#1c1810', {});
      b.fx.addEmitter({ x: x + s, y: y + 0.9, z, rate: 1.5, spec: P.mote, spread: 0.9, vy: 0.05 });
    }
    b.collide({ kind: 'b', x0: x - 1.8, z0: z - 0.45, x1: x + 1.8, z1: z + 0.45, y0: y - 1, y1: y + 1.1 });
    D.wildflowers(b, x - 2.8, z + 1.8, 12, 1.2, 'yellow');
    D.wildflowers(b, x + 2.8, z + 2, 10, 1.1, 'purple');
    b.moonflowers(x + 0.4, z + 3, 6, 1);
  });
  // Goblins camped by the brook: a fire, a hide thrown over a pole, a stolen chest.
  own(707, () => {
    const { x, z } = BROOKCAMP, y = grid.groundAt(x, z), g = b.g(x, z);
    b.campfire(x, z, true);
    g.beam([x - 3.4, y, z - 1.8], [x - 2.2, y + 1.5, z - 1.4], 0.06, PAL.woodDark, { kind: K.Wood });
    g.beam([x - 1, y, z - 1.2], [x - 2.2, y + 1.5, z - 1.4], 0.06, PAL.woodDark, { kind: K.Wood });
    g.push().translate(x - 2.2, y + 0.8, z - 1.45).rotateZ(0.05);
    g.box(0, -0.8, 0, 2.2, 1.5, 0.06, '#6a5238', { kind: K.Wood });
    g.pop();
    D.bones(b, x + 1.4, z + 1.6, 3, false);
    D.fallenLog(b, x + 0.2, z + 2.2, 1.6, 0.2);
  });
  // The kingfisher's bank: reeds thick round a chest on the east river's bank.
  own(709, () => {
    b.reeds(117.4, 94.2, 10, 1.2);
    b.reeds(118.2, 96.8, 8, 1);
  });
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
      while (x < 94 && grid.h[grid.i(Math.floor(x), Math.floor(z))] > -3) x += 0.25;
      const lip = x - 0.1, y0 = FLOOR - 0.35, len = y0 - RAVINE_FLOOR - 0.2 + (k % 3) * 0.1;
      // Faint streaks down the fall (brighter ones would read as a wall), falling drops over them.
      g.box(lip + 0.15, y0 - len, z, 0.04, len, 0.08, [0.12, 0.17, 0.28], {});
      b.fx.addEmitter({ x: lip + 0.1, y: y0, z, rate: 7, spec: P.fall, spread: 0.12, vy: 0 });
      if (k % 2 === 0) b.fx.addEmitter({ x: lip, y: y0 + 0.1, z, rate: 3, spec: P.splash, spread: 0.2, vy: 0.6 });
    }
    b.fx.addEmitter({ x: 91.5, y: RAVINE_FLOOR + 1.5, z: 50, rate: 1.5, spec: P.mote, spread: 2.5, vy: 0.2 });
    b.fx.addEmitter({ x: 90.5, y: RAVINE_FLOOR + 0.4, z: 50, rate: 3, spec: P.smoke, spread: 2, vy: 0.3 });
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
    for (const [x, z] of [[rim + 1.2, 35.5], [rim + 1.6, 41.2], [rim + 2.6, 42.8]] as Pt[]) b.deadTree(x, z, 0.9);
    // Broken rock bulging from its sides down into the chasm, so it reads as a crag, not a column.
    for (const [ox, oy, oz, rx, ry, rz, seed] of [
      [-1.15, -1, -0.6, 0.8, 1.6, 0.9, 171], [1.05, -2.5, 0.4, 0.7, 2, 0.9, 172], [-0.9, -5, 1.4, 1, 2.2, 0.8, 173],
      [0.2, -3.6, -1.6, 0.9, 1.8, 0.7, 174], [0.8, -6.4, -0.5, 1.1, 1.6, 1.1, 175], [-0.3, -0.1, 1.7, 0.6, 0.5, 0.5, 176],
    ] as [number, number, number, number, number, number, number][])
      g.blob(cx + ox, FLOOR + oy, cz + oz, rx, ry, rz, PAL.rockDark, seed, { kind: K.Rock, jitter: 0.25 });
  }
  // ---------- the Fallen Giant ----------
  {
    const { x, z0, z1 } = LOG, y = FLOOR + 0.45, g = b.g(x, (z0 + z1) / 2), d = diceAt(x, z0, 5);
    // The trunk (its top is the walk): thicker toward the roots, bowed a little and knobbly, moss in
    // clumps along its top; broken stubs of limbs; the root plate standing up on the south bank with
    // the earth still in it, and the broken crown's dead limbs on the north.
    const lp: [number, number, number][] = [], lr: number[] = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12, r = 0.84 + 0.3 * t;
      lp.push([x + Math.sin(t * Math.PI) * 0.18 + (k > 0 && k < 12 ? (d() - 0.5) * 0.08 : 0), y - r * 0.9, z0 + (z1 - z0) * t]);
      lr.push(r * (k === 4 || k === 9 ? 1.08 : 1));
    }
    g.sweep(lp, lr, WOOD.bark, { kind: K.Bark, seg: 10, lumpy: 0.08, seed: 41, squash: 0.9 });
    for (let zz = z0 + 1.2; zz < z1 - 1; zz += 1.3 + d() * 0.9) g.blob(x + (d() - 0.5) * 0.5, y - 0.04, zz, 0.45 + d() * 0.3, 0.1, 0.55 + d() * 0.4, d() < 0.5 ? WOOD.moss : '#3d5a33', Math.floor(d() * 999), { kind: K.Grass, jitter: 0.3 });
    for (const [bz, side] of [[46.5, 1], [49.8, -1], [53, 1]] as [number, number][]) bough(g, [x + side * 0.6, y - 0.35, bz], [x + side * 2.2, y + 0.9, bz + 0.6], 0.24, 0.1, WOOD.barkDark, d);
    // The root plate: a wall of earth and roots on end, the roots curling out of it.
    g.blob(x, y + 0.3, z1 + 0.75, 1.9, 1.75, 0.55, '#3b2e22', 101, { kind: K.Rock, jitter: 0.3, detail: 1 });
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + d() * 0.4, len = 1.8 + d() * 0.9;
      bough(g, [x + Math.cos(a) * 0.9, y + 0.3 + Math.sin(a) * 0.9, z1 + 0.8], [x + Math.cos(a + (d() - 0.5) * 0.6) * (0.9 + len), y + 0.3 + Math.sin(a) * (0.8 + len * 0.9), z1 + 1 + d() * 0.8], 0.2, 0.04, WOOD.barkDark, d);
    }
    b.collide({ kind: 'c', x, z: z1 + 0.8, r: 1.3, y0: y - 2, y1: y + 2.2 });
    for (let k = 0; k < 6; k++) bough(g, [x, y - 0.3, z0 + 0.4], [x + Math.cos(k) * 2, y + 0.6 + (k % 2) * 0.6, z0 - 1.4 - (k % 3) * 0.4], 0.2, 0.05, PAL.dead, d);
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
    // The cairn where a knight fell (the wood round it grows in "the Warden's heights: what grows there").
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
    // (The biggest stands at its south-west side: in front, toward the camera, it hid the dell's floor.)
    for (const [mx, mz, s] of [[7.6, 86.4, 1.3], [8.2, 93.2, 1.1], [14.6, 86.8, 1.2], [7.4, 90, 0.9], [8.9, 95.3, 1.4], [11, 84.8, 1]] as [number, number, number][])
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
  // ---------- Rookfall: the rope bridge, the rim, the cave ----------
  // Along a cell boundary (z = 30), so the planks cover the two cells between the rails.
  ropeBridge(b, grid, 89.2, 30, 100.6, 30, FLOOR, 1.8);
  {
    // Boulders, ferns and roots along the rim, some roots hanging over into the gorge; where the
    // river goes under the rock at the north end, an arch of rock over a dark mouth, mist in it.
    const g = b.g(95, 35), dg = diceAt(95, 35, 7);
    for (let z = GORGE_END + 2; z < 53; z += 1.6 + dg() * 1.8) {
      for (const side of [-1, 1]) {
        const x = gorgeX(z) + side * (gorgeHW(z) + 1.1 + dg() * 0.8);
        if (Math.abs(z - 30) < 3 || (side > 0 && z > 34 && z < 43) || !flat(x, z, 0.35) || grid.waterAt(x, z) !== NONE) continue;
        const u = dg();
        if (u < 0.3) b.rock(x, z, 0.5 + dg() * 0.5);
        else if (u < 0.6) D.fern(b, x, z, 0.8 + dg() * 0.4);
        else if (u < 0.8) {
          const y = grid.groundAt(x, z);
          bough(g, [x, y + 0.1, z], [x - side * 1.6, y - 1.2 - dg(), z + (dg() - 0.5)], 0.14, 0.04, WOOD.barkDark, dg);
        }
      }
    }
    const cx = gorgeX(GORGE_END + 0.5), y = RAVINE_FLOOR;
    g.blob(cx, y + 1.1, GORGE_END + 0.2, 1.5, 1.2, 0.5, '#07080b', 601, { kind: K.Rock, jitter: 0.15 });
    for (const [ox, oy, oz, rx, ry, rz, seed] of [
      [-1.8, 1.6, 0.3, 0.9, 1.9, 0.9, 602], [1.8, 1.4, 0.4, 0.9, 1.8, 0.9, 603], [-0.7, 3.1, 0.5, 1.3, 0.8, 1.1, 604], [0.9, 3.3, 0.3, 1.2, 0.9, 1.1, 605], [0, 4.9, -0.2, 1.8, 1.1, 1.4, 606],
    ] as [number, number, number, number, number, number, number][])
      g.blob(cx + ox, y + oy, GORGE_END + oz, rx, ry, rz, seed % 2 ? PAL.rockDark : PAL.rock, seed, { kind: K.Rock, jitter: 0.25 });
    b.fx.addEmitter({ x: cx, y: y + 0.6, z: GORGE_END + 1.2, rate: 2, spec: P.smoke, spread: 1.4, vy: 0.2 });
    b.lights.add(cx, y + 1.6, GORGE_END + 2, 0x7aa0e0, 2.5, 5, 0.1);
  }
  // ---------- the Thorn Ravine ----------
  // Thorn thickets here and there on the shelf's lip over the Blackwater: in clumps of two to four,
  // bare stone between.
  for (let k = 0; k < 8; k++) {
    const cx = 47 + k * 4.8 + (hash(k, 13) - 0.5) * 3, cz = 17.9 + (hash(13, k) - 0.5) * 1.2;
    if (hash(k * 1.7, 17) < 0.3) continue;
    const n = 2 + Math.floor(hash(17, k * 1.3) * 3);
    for (let j = 0; j < n; j++) {
      const x = cx + (hash(k + j * 0.37, 19) - 0.5) * 2.4, z = cz + (hash(19, k + j * 0.53) - 0.5) * 1;
      if (grid.water[grid.i(Math.floor(x), Math.floor(z))] === NONE && !kit.nearRoad(x, z, 1.4)) bramble(b, x, z, 0.55 + hash(x, z) * 0.6, 1 + hash(z, x) * 0.8, hash(x * 3, z) > 0.85);
    }
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
  greatTree(b, GREAT.x, GREAT.z, 1.35, { clearToward: Math.atan2(BOWL.z - GREAT.z, BOWL.x - GREAT.x) });
  {
    // The two great roots round the hollow, each a braid of two: a broad one along the ground and a
    // thinner one riding on it up to the ring's height (higher at the back), knotted, mossy on top,
    // rootlets diving into the ground outside; each tip a great knuckle bending into the soil at the
    // mouth. They stand in the way as high as they stand (colliders along them): nothing climbs out.
    // (From the trunk, one runs east round the short way to the mouth's north tip, the other west
    // and south the long way round to its south tip.)
    const g = b.g(BOWL.x, BOWL.z), dr = diceAt(BOWL.x, BOWL.z, 9);
    for (const [side, span] of [[1, -MOUTH - ROOT_A], [-1, ROOT_A + Math.PI * 2 - MOUTH]] as [number, number][]) {
      const N = Math.max(4, Math.round(span * 7));
      const A: [number, number, number][] = [], rA: number[] = [], B: [number, number, number][] = [], rB: number[] = [];
      for (let k = 0; k <= N; k++) {
        const a = ROOT_A + side * (k / N) * span, ec = (1 + rootOuter(a)) / 2, top = rootTop(a) - HOLD_H;
        const far = Math.max(0, -Math.cos(a - Math.PI / 4));
        // (A swells and narrows as it goes; B twists over and round it, dipping where it crosses.)
        const swell = 1 + 0.16 * Math.sin(k * 0.9 + side) + 0.1 * Math.sin(k * 2.3 + 1), cross = Math.sin(k * 0.7 + side * 2);
        const ra = (1.45 + far * 0.3) * swell + (dr() - 0.5) * 0.12, rb = (0.7 + far * 0.42) * (1 + 0.15 * Math.sin(k * 1.3)) + (dr() - 0.5) * 0.1;
        const eb = ec + (cross * 0.9) / 7.8;
        A.push([BOWL.x + BOWL.rx * ec * Math.cos(a), HOLD_H + 0.4 + far * 0.4, BOWL.z + BOWL.rz * ec * Math.sin(a)]);
        rA.push(ra);
        B.push([BOWL.x + BOWL.rx * eb * Math.cos(a), HOLD_H + top - rb * 0.8 - (1 - Math.abs(cross)) * 0.25, BOWL.z + BOWL.rz * eb * Math.sin(a)]);
        rB.push(rb);
        b.collide({ kind: 'c', x: A[k][0], z: A[k][2], r: ra * 0.95, y0: HOLD_H - 1, y1: HOLD_H + Math.max(top, 0.4 + far * 0.4 + ra) });
        // Moss on top, a knot here and there, rootlets diving into the ground outside.
        if (k % 3 === 1) g.blob(B[k][0], B[k][1] + rb * 0.85, B[k][2], rb * 0.85, 0.22, rb * 0.75, k % 2 ? WOOD.moss : '#3d5a33', 300 + k * 2 + side, { kind: K.Grass, jitter: 0.3 });
        if (k % 4 === 2) g.blob(A[k][0], A[k][1] + ra * 0.3, A[k][2], ra * 0.5, ra * 0.55, ra * 0.5, WOOD.barkDark, 400 + k * 2 + side, { kind: K.Bark, jitter: 0.3 });
        if (k % 3 === 0 && k > 1 && k < N - 1) {
          const oa = a + (dr() - 0.5) * 0.3, oe = rootOuter(a) - 0.05;
          rootFrom(b, g, BOWL.x + BOWL.rx * oe * Math.cos(oa), BOWL.z + BOWL.rz * oe * Math.sin(oa), Math.atan2(Math.sin(a) * BOWL.rx, Math.cos(a) * BOWL.rz) + (dr() - 0.5) * 0.6, 1.4 + dr(), 0.34, 0.5, WOOD.barkDark, dr, false);
        }
      }
      g.sweep(A, rA, (i) => (i % 5 === 2 ? '#3b2e23' : WOOD.barkDark), { kind: K.Bark, seg: 9, lumpy: 0.15, seed: 20 + side });
      g.sweep(B, rB, (i) => (i % 4 === 1 ? '#56443a' : WOOD.bark), { kind: K.Bark, seg: 8, lumpy: 0.17, seed: 30 + side });
      // The tip: a great knuckle bending down into the soil.
      const [tx, , tz] = A[N];
      g.blob(tx, HOLD_H + 0.8, tz, 1.55, 1.35, 1.55, WOOD.barkDark, 500 + side, { kind: K.Bark, jitter: 0.28, detail: 1 });
      g.blob(tx, HOLD_H + 1.9, tz, 0.9, 0.25, 0.8, WOOD.moss, 510 + side, { kind: K.Grass, jitter: 0.3 });
    }
    // Moonlight through a gap in the crown onto the hollow's floor (so the fight can be seen), motes
    // drifting in it.
    b.lights.add(BOWL.x, HOLD_H + 6, BOWL.z + 0.5, 0xb8d0ff, 5, 13, 0);
    b.fx.addEmitter({ x: BOWL.x, y: HOLD_H + 2.5, z: BOWL.z, rate: 1.2, spec: P.mote, spread: 6, vy: -0.05 });
    // In the hollow, kept clear for the fight: pale toadstools glowing against the roots at the back,
    // a few bones.
    b.mushrooms(BOWL.x - 6.2, BOWL.z - 2.4, 6, true);
    b.mushrooms(BOWL.x + 1.5, BOWL.z - 6.4, 4, false);
    D.bones(b, BOWL.x - 5.2, BOWL.z + 3.8, 3, true);
    // The hills by the cleft: rock bulging from their faces, moss spilling down them, boulders at
    // their feet, a few pines and a dead snag on their backs, ferns; the heart's purple glow over
    // the thorns.
    for (let z = 2; z < 25; z++)
      for (let x = 27; x < 38; x++) {
        const h = grid.h[grid.i(x, z)];
        if (h < HOLD_H + 1.4) continue;
        for (const [dx, dz] of [[1, 0], [0, 1], [0, -1], [-1, 0]] as Pt[]) {
          const below = grid.h[grid.i(x + dx, z + dz)];
          if (h - below < 1.4) continue;
          const u = hash(x * 3.7 + dx, z * 2.3 + dz), v = hash(z * 1.9 + dz, x * 1.1 + dx);
          const fx = x + 0.5 + dx * 0.5, fz = z + 0.5 + dz * 0.5, g0 = b.g(fx, fz);
          if (u < 0.55) g0.blob(fx + dx * 0.15, below + (h - below) * (0.25 + v * 0.5), fz + dz * 0.15, 0.5 + v * 0.45, 0.45 + u * 0.8, 0.5 + u * 0.35, u < 0.25 ? PAL.rock : PAL.rockDark, x * 17 + z * 5 + dx * 3 + dz, { kind: K.Rock, jitter: 0.3 });
          else if (u < 0.85) g0.blob(fx + dx * 0.1, h - 0.35 - v * 0.4, fz + dz * 0.1, 0.35 + 0.3 * Math.abs(dz), 0.55 + v * 0.6, 0.35 + 0.3 * Math.abs(dx), v < 0.5 ? WOOD.moss : '#3d5a33', x * 13 + z * 7 + dx, { kind: K.Grass, jitter: 0.35 });
        }
        if (hash(x * 1.3, z * 2.9) < 0.12 && h > HOLD_H + 2.4 && z < 13 && x < 36) b.pine(x + 0.5, z + 0.5, 0.8 + hash(z, x) * 0.3);
        else if (hash(x * 2.1, z * 1.7) < 0.1) D.fern(b, x + 0.5, z + 0.5, 0.8);
      }
    b.deadTree(31.6, 21.4, 0.9);
    // Roots across the rock of the way up, half sunk, for steps.
    {
      const dw = diceAt(STAIR.x0, STAIR.z0, 6);
      for (let x = STAIR.x0 + 0.6; x < STAIR.x1 - 0.2; x += 0.9 + dw() * 0.3) {
        const y0 = grid.groundAt(x, STAIR.z0 + 0.3) + 0.05;
        bough(b.g(x, (STAIR.z0 + STAIR.z1) / 2), [x + (dw() - 0.5) * 0.3, y0, STAIR.z0 - 0.3], [x + (dw() - 0.5) * 0.4, y0 + (dw() - 0.5) * 0.1, STAIR.z1 + 0.3], 0.16 + dw() * 0.06, 0.12, WOOD.barkDark, dw);
      }
    }
    for (const [x, z, s] of [[37.8, 10.4, 0.8], [36.9, 19.6, 1], [38.6, 20.3, 0.6], [35.8, 21.2, 0.7]] as [number, number, number][]) b.rock(x, z, s, true);
    b.lights.add(WALL_X + 0.9, HOLD_H + 1.6, (STAIR.z0 + STAIR.z1) / 2, 0xd060ff, 5, 6, 0.3);
  }
  // ---------- the Stag's Thicket ----------
  {
    // Briars spilling over the rocks round the hollow, a fallen trunk across its back, a dead tree.
    const gap = Math.atan2(LANE_STAG[0][1] - STAG.z, LANE_STAG[0][0] - STAG.x);
    for (const [ca, n] of [[gap + 1.35, 4], [gap + 2.95, 3], [gap + 4.55, 4]] as [number, number][])
      for (let j = 0; j < n; j++) {
        const a = ca + (hash(ca, j) - 0.5) * 0.8, d = 4.9 + hash(j, ca) * 1.8;
        bramble(b, STAG.x + Math.cos(a) * d, STAG.z + Math.sin(a) * d, 0.65 + hash(ca * 2, j) * 0.6, 1.2 + hash(j * 2, ca) * 0.6, j === 0 && hash(ca, 3) < 0.4);
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
  D.workbench(b, HERBS.x + 2, HERBS.z - 1.2, 0.4);
  for (let k = 0; k < 4; k++) b.bush(HERBS.x - 2.5 + k * 0.9, HERBS.z + 2.2, 0.35, '#5a7a3a');
  D.wildflowers(b, HERBS.x - 1, HERBS.z + 1, 10, 1.5, 'purple');
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
  // The Old Wood's folk cut their waymarks into standing stones, not planed boards.
  for (const [x, z] of [[109.3, 112.4], [102.5, 36]] as Pt[]) waystone(b, x, z);
  const objects: ObjDef[] = [
    { kind: 'moonfire', id: 'stone', name: "The Warden's Stone", x: 105.5, z: 106 },
    { kind: 'moonfire', id: 'bough', name: 'Hollowbough', x: 72.4, z: 92.4 },
    { kind: 'moonfire', id: 'bridge', name: 'Rookfall', x: 103.5, z: 33.5 },
    { kind: 'moonfire', id: 'overhang', name: 'The Overhang', x: 41.5, z: 15.8 },
    { kind: 'sign', x: 109.3, z: 112.4, text: 'Hollowbough, west through the Old Grove. Keep to the path: the ground bites.' },
    { kind: 'sign', x: 102.5, z: 36, text: 'Rookfall. The rope bridge holds, most nights.' },
    { kind: 'sign', x: 1.4, z: 31, text: 'The Sea Stair, down to the drowned coast. The cliff came down on it: only the deer still go that way.' },
    { kind: 'lore', id: 'wlore1', x: 70, z: 99, text: 'The Old Wood is older than the kingdom. It remembers everything.' },
    { kind: 'bindings', id: 'stag', x: STAG.x, z: STAG.z, mount: 'stag' },
    { kind: 'lever', id: 'heart', look: 'heart', x: WALL_X + 0.85, z: (STAIR.z0 + STAIR.z1) / 2 },
    { kind: 'thornGate', id: 'wall', x: WALL_X, z: (STAIR.z0 + STAIR.z1) / 2, w: STAIR.z1 - STAIR.z0 + 0.8, alongX: false, role: 'wall' },
    { kind: 'thornGate', id: 'arena', x: BOWL.x + BOWL.rx * 1.12, z: BOWL.z, w: 9.4, alongX: false, role: 'arena' },
    { kind: 'cage', id: 'cage', x: CAGE.x, z: CAGE.z },
    // Three Moon Shards: among the fen's pools, up where the vines climb, at the top of the canopy.
    { kind: 'shard', id: 's_fen', x: 17.6, z: 108.4 },
    { kind: 'shard', id: 's_vines', x: 67, z: 8.6 },
    { kind: 'shard', id: 's_canopy', x: CANOPY[3].x - 0.8, z: CANOPY[3].z - 2.8 },
    { kind: 'cracked', id: 'w_niche', x: 38, z: 10, alongX: true },
    // Chests: up the ledge's vines, in the niche, on a root top, among the grove's oaks, in the fen, on
    // the gorge's rim, on the chasm's east bank, in the herbwife's glade, and the goblins' hoard.
    { kind: 'chest', id: 'wc_ledge', x: 43.5, z: 8.4, rot: 0, coins: 55, power: 'wind' },
    { kind: 'chest', id: 'wc_niche', x: 38, z: 7, rot: 0, coins: 60, power: 'giant' },
    { kind: 'chest', id: 'wc_root', x: CANOPY[0].x - 2.8, z: CANOPY[0].z + 1.4, rot: 0.6, coins: 40 },
    { kind: 'chest', id: 'wc_grove', x: 76.5, z: 109.2, rot: -0.4, coins: 40 },
    { kind: 'chest', id: 'wc_fen', x: 9.6, z: 105.6, rot: 1.2, coins: 55, power: 'bubble' },
    { kind: 'chest', id: 'wc_rim', x: 119.6, z: 20.5, rot: -Math.PI / 2, coins: 45 }, // in the reeds by the Greywater
    { kind: 'chest', id: 'wc_chasm', x: 101.8, z: 45, rot: -1.4, coins: 40 },
    { kind: 'chest', id: 'wc_glade', x: HERBS.x - 2.4, z: HERBS.z - 2.2, rot: 0.3, coins: 35 },
    { kind: 'chest', id: 'wc_hoard', x: CLEARING.x + 3.6, z: CLEARING.z + 0.2, rot: -1.2, coins: 50, power: 'fire' },
    { kind: 'chest', id: 'wc_stand', x: STAND.x0 + 0.9, z: STAND.z0 + 0.6, rot: 0, coins: 45, power: 'magnet' },
    { kind: 'chest', id: 'wc_falls', x: 86, z: 54.6, rot: -0.6, coins: 45 },
    { kind: 'chest', id: 'wc_pillar', x: PILLAR.x0 + 0.6, z: PILLAR.z0 + 1.4, rot: Math.PI / 2, coins: 60, power: 'giant' },
    { kind: 'chest', id: 'wc_roost', x: (ROOST.x0 + ROOST.x1) / 2, z: ROOST.z0 + 0.8, rot: 0, coins: 50 },
    { kind: 'lore', id: 'wlore4', x: 84.2, z: 57.2, text: 'The Whisper falls into Rookfall and is never heard again. The rooks say it sings down there.' },
    { kind: 'chest', id: 'wc_log', x: LOG.x - 2.4, z: LOG.z1 + 0.4, rot: 1.3, coins: 45 },
    { kind: 'chest', id: 'wc_shrine', x: SHRINE.x - 1, z: SHRINE.z - 0.2, rot: 0, coins: 55, power: 'bubble' },
    { kind: 'chest', id: 'wc_grave', x: GRAVE.x - 1.2, z: GRAVE.z + 1, rot: 0.4, coins: 55, power: 'fire' },
    { kind: 'chest', id: 'wc_dell', x: DELL.x, z: DELL.z, rot: 0.2, coins: 45, power: 'wind' },
    { kind: 'chest', id: 'wc_kilns', x: 45.4, z: 107.8, rot: -0.3, coins: 50 },
    { kind: 'lore', id: 'wlore5', x: SHRINE.x + 1.3, z: SHRINE.z + 1.5, text: 'Before the thorns, the keepers of the wood prayed here to the moon. The water rose the night the Warden woke.' },
    { kind: 'lore', id: 'wlore6', x: GRAVE.x + 1.4, z: GRAVE.z - 0.6, text: 'Ser Aldric of the Keep. He came through the thorns and saw the Great Tree. No farther.' },
    { kind: 'lore', id: 'wlore3', x: RING.x + 1.2, z: RING.z + RING.r + 1.6, text: 'Stand in the ring and the oaks remember you. Stand firm, and they give you their heart.' },
    { kind: 'lore', id: 'wlore2', x: 43.5, z: 12.2, text: 'The Thorn Warden was once a guardian. Something twisted it.' },
    { kind: 'lore', id: 'wlore7', x: SEAT.x + 1.9, z: SEAT.z + 1.6, text: 'Here the Warden sat and listened to the wood. The wood stopped talking to it. It never stopped listening.' },
    { kind: 'chest', id: 'wc_seat', x: SEAT.x - 1.9, z: SEAT.z - 1.3, rot: 0.8, coins: 60, power: 'magnet' },
    { kind: 'thorns', id: 'w_bedthorns', x: BED.mouth - 1.4, z: BED.cz, alongX: false, w: 3.4, by: 'stag' },
    { kind: 'chest', id: 'wc_bed', x: BED.x - 1.4, z: BED.z - 0.6, rot: 0.8, coins: 55, power: 'wind' },
    { kind: 'lore', id: 'wlore9', x: BED.x + 1.2, z: BED.z - 1.6, text: 'Moss pressed flat in the shape of a great beast, and white hairs caught in the thorns. The stag slept here before the Warden bound it.' },
    { kind: 'lore', id: 'wlore8', x: ROOKERY.x + 2.6, z: ROOKERY.z + 3, text: 'The rooks of Rookfall took everything that glittered. Their nests came down in the storm; what they took did not go far.' },
    { kind: 'chest', id: 'wc_rooks', x: ROOKERY.x - 0.6, z: ROOKERY.z + 0.2, rot: -0.5, coins: 45 },
    { kind: 'chest', id: 'wc_kingfisher', x: 117.6, z: 95.4, rot: -Math.PI / 2, coins: 35 }, // in the reeds by the east river
    { kind: 'chest', id: 'wc_brook', x: BROOKCAMP.x + 0.4, z: BROOKCAMP.z - 2.2, rot: 0.2, coins: 45 },
  ];
  for (const [x, z, what] of [[...off(home.inn, HOMES.inn.face, -1.6, 0.4), 'barrel'], [...off(home.inn, HOMES.inn.face, -2.2, 0.9), 'pot'], [...off(home.smithy, HOMES.smithy.face, -1.2, 2.6), 'crate'], [47.2, 40.9, 'crate'], [44.6, 40.4, 'barrel'], [105.6, 31.4, 'barrel'], [106.2, 32.1, 'pot'], [43.4, 18.6, 'pot']] as [number, number, 'pot' | 'crate' | 'barrel'][])
    objects.push({ kind: 'breakable', x, z, what });
  // The forge's yard and the fisher's tree stand where the Deer Meadow's grass begins: they keep the village's name.
  const yard = off(home.smithy, HOMES.smithy.face, 0, 1);
  const eastHomes = (x: number, z: number) => Math.hypot(x - yard[0], z - yard[1]) < 3.2 || Math.hypot(x - HOMES.fisher.x, z - HOMES.fisher.z) < 4;
  const regions: RegionDef[] = [
    { name: 'The Sea Stair', music: 'road', amb: 'road', test: (x, z) => onWoodStair(x, z), light: WOOD_ZONES.open },
    { name: 'The Withered Wood', music: 'wilds', amb: 'woods', test: (x, z, y) => z > 32 && insidePoly(HOLD, x, z) && y > 4, light: WOOD_ZONES.withered },
    { name: 'The Fallen Giant', music: 'wilds', amb: 'woods', test: (x, z) => x > 34 && x < 42 && z > LOG.z0 - 2 && z < LOG.z1 + 2, light: WOOD_ZONES.woods },
    { name: 'The Drowned Shrine', music: 'hall', amb: 'fields', test: (x, z) => Math.hypot(x - SHRINE.x, z - SHRINE.z) < SHRINE.r + 2, light: WOOD_ZONES.water },
    { name: 'The Mushroom Dell', music: 'road', amb: 'woods', test: (x, z) => Math.hypot(x - DELL.x, z - DELL.z) < 7, light: WOOD_ZONES.open },
    { name: 'The Charcoal Kilns', music: 'wilds', amb: 'fields', test: (x, z) => Math.hypot(x - KILNS.x, z - KILNS.z) < 9, light: WOOD_ZONES.open },
    { name: 'The Bat Roost', music: 'hall', amb: 'indoor', test: (x, z) => x >= ROOST.x0 && x < ROOST.x1 && z < ROOST.z1 + 1, light: WOOD_ZONES.indoor },
    { name: "The Whisper's Fall", music: 'wilds', amb: 'woods', test: (x, z) => x > 82 && x < 92 && z > 45 && z < 58, light: WOOD_ZONES.water },
    { name: 'The Deer Meadow', music: 'fields', amb: 'fields', test: (x, z) => insidePoly(DEER_MEADOW, x, z) && lakeSd(x, z) >= 11 && !eastHomes(x, z), light: WOOD_ZONES.open },
    { name: 'The Mirror Pool', music: 'wilds', amb: 'woods', test: (x, z) => Math.hypot((x - MIRROR.x) / (MIRROR.rx + 2), (z - MIRROR.z) / (MIRROR.rz + 2)) < 1, light: WOOD_ZONES.water },
    { name: 'The Niche', music: 'hall', amb: 'indoor', test: (x, z) => x >= NICHE.x0 && x < NICHE.x1 && z >= NICHE.z0 && z < NICHE.z1, light: WOOD_ZONES.indoor },
    { name: 'The Roots of the Great Tree', music: 'keep', amb: 'keep', test: (x, z, y) => bowlE(x, z) < 1.05 && y > 4, light: WOOD_ZONES.roots },
    { name: "The Warden's Hold", music: 'keep', amb: 'keep', test: (x, z, y) => x < 34 && z < 46 && y > 4, light: WOOD_ZONES.hold },
    { name: 'The Overhang', music: 'wilds', amb: 'woods', test: (x, z) => x < 46 && z < 24, light: WOOD_ZONES.withered },
    { name: 'The Thorn Ravine', music: 'wilds', amb: 'woods', test: (x, z) => z < 23 && x < 88, light: WOOD_ZONES.withered },
    { name: 'Rookfall Chasm', music: 'wilds', amb: 'woods', test: (x, z) => gorgeIn(x, z) > -3.5 && z < 50, light: WOOD_ZONES.gorge },
    { name: "The Gatherers' Clearing", music: 'fields', amb: 'fields', test: (x, z) => Math.hypot(x - CLEARING.x, z - CLEARING.z) < 7, light: WOOD_ZONES.open },
    { name: 'The Blackwater', music: 'fields', amb: 'fields', test: (x, z) => sdPoly(BLACKWATER, x, z) < 7, light: WOOD_ZONES.water },
    { name: 'The East Woods', music: 'wilds', amb: 'woods', test: (x, z) => x >= 100 && z < 56, light: WOOD_ZONES.woods },
    { name: 'Hollowbough', music: 'village', amb: 'village', test: (x, z) => lakeSd(x, z) < 11 || eastHomes(x, z) || Math.hypot(x - HOMES.inn.x, z - HOMES.inn.z) < 7, light: WOOD_ZONES.village }, // (the inn's yard, where the Old Grove begins)
    { name: 'The High Canopy', music: 'wilds', amb: 'woods', test: (x, z) => x > 88 && z > 56 && z < 96, light: WOOD_ZONES.woods },
    { name: "The Stag's Thicket", music: 'road', amb: 'woods', test: (x, z) => Math.hypot(x - STAG.x, z - STAG.z) < 6, light: WOOD_ZONES.woods },
    { name: 'The Ring of Oaks', music: 'road', amb: 'fields', test: (x, z) => Math.hypot(x - RING.x, z - RING.z) < RING.r + 3, light: WOOD_ZONES.open },
    { name: "The Herbwife's Glade", music: 'road', amb: 'fields', test: (x, z) => Math.hypot(x - HERBS.x, z - HERBS.z) < 6, light: WOOD_ZONES.open },
    { name: 'The Mossfen', music: 'fields', amb: 'fields', test: (x, z) => insidePoly(MOSSFEN, x, z), light: WOOD_ZONES.fen },
    { name: "The Stag's Bed", music: 'fields', amb: 'woods', test: (x, z) => x < BED.mouth && inStagBed(x, z) > 0, light: WOOD_ZONES.woods },
    { name: 'The Deep Wood', music: 'wilds', amb: 'woods', test: (x, z) => insidePoly(DEEP_WEST, x, z), light: WOOD_ZONES.deep },
    { name: 'The Old Grove', music: 'road', amb: 'woods', test: (x, z) => x > 54 && z > 88 && x < 104, light: WOOD_ZONES.grove },
    { name: 'The Thorn Road', music: 'road', amb: 'road', test: (x, z) => x > 100 && z > 96, light: WOOD_ZONES.open },
    { name: 'The Whisper', music: 'wilds', amb: 'woods', test: (x, z) => distLine(RIVER, x, z) < 5, light: WOOD_ZONES.water },
    { name: 'Whisperwood', music: 'wilds', amb: 'woods', test: () => true, light: WOOD_ZONES.woods },
  ];
  const grassDensity = (x: number, z: number) => {
    const y = grid.groundAt(x, z);
    if (y > 7) return 1.2;
    if (insidePoly(HOLD, x, z)) return 0.8 + fbm(x * 0.2, z * 0.2, 2, 7) * 2.4; // the withered heights: thin, patchy
    if (lakeSd(x, z) < 8) return 1.4;
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
    // The Whisper runs east and over the fall down Rookfall's floor; the brook east into the Greywater, which runs south.
    flows: [{ pts: RIVER, speed: 0.8 }, { pts: GORGE, speed: 1.5 }, { pts: BROOK, speed: 0.6 }, { pts: [[127.5, -30], [127.5, 150]], speed: 0.45 }],
    enemies,
    npcs: [
      // Hollowbough's folk, at the doors of their home trees round the lake.
      { id: 'reeve', look: 'woodreeve', name: 'Alder the Reeve', x: heart.door.x, z: heart.door.z, face: 1, lines: [
        'The thorns started growing the day the Warden woke.',
        'He kept this wood once. Now the wood keeps him, and it keeps nobody else.',
        'His hold is in the north-west: over the Rookfall bridge, through the Thorn Ravine, up the stair by the Overhang.',
      ] },
      { id: 'keeper2', look: 'woodwife', name: 'Moss the Innkeeper', x: home.inn.door.x, z: home.inn.door.z, face: 1, shop: 'flask', lines: [
        'Sit, sit. You have the look of someone who walked the Old Grove at night.',
        'I fill the Moon Flasks from the Heartpool, and the moon does the rest. A new one costs coin, mind.',
      ] },
      { id: 'thornsmith', look: 'woodsmith', name: 'Bryony the Thorn-smith', x: off(home.smithy, HOMES.smithy.face, 1.4, 1.2)[0], z: off(home.smithy, HOMES.smithy.face, 1.4, 1.2)[1], face: 1, shop: 'sword', upTo: 5, lines: [
        'We live up in the trees now. The ground is not safe.',
        'That edge is keen. I can temper it with heartwood, and it will bite through thorn.',
      ] },
      // (Ash waits at the front of his family's garden: at their door the inn tree's crown hid him from
      // the camera.)
      { id: 'ash', look: 'woodboy', name: 'Ash', x: off(home.ash, HOMES.ash.face, 3.2, 5)[0], z: off(home.ash, HOMES.ash.face, 3.2, 5)[1], face: 1, lines: [
        'Have you seen my sister? She went gathering past the river.',
        'Past the Whisper, by the black water. She never came back.',
      ], after: ['Wren is home! She says you broke the lock with one blow.', 'I said it took three. She says one.'] },
      // ...and going about their day: a fisher on the jetty, washing at the bay, children round the fire
      // on the green, the old man by it, a gardener, a carrier on the lakeside path, the watch at
      // the east bridge, the weaver at her door.
      { id: 'fisher', look: 'woodfisher', name: 'Reed the Fisher', x: jettyX - 3.2, z: JETTY_Z + 0.5, pose: 'fish', heading: Math.PI, lines: [
        'Nothing bites since the thorns came. Still, it is quiet out here.',
        'The Heartpool never freezes. The old folk say the oak keeps it warm.',
      ] },
      { id: 'washer', look: 'woodwasher', name: 'Tansy', x: washSpot[0], z: washSpot[1], pose: 'work', heading: washSpot[2], lines: [
        'Mind the wet stones, sir knight.',
        'Wren tears her frock on every bramble in the wood. I wash it, she tears it.',
      ] },
      { id: 'pip', look: 'woodchild', name: 'Sprig', x: FIRE.x + 3, z: FIRE.z + 1.2, roam: kids, pause: 0.8, speed: 2.8, pose: 'play', lines: [
        'You are a real knight! Is that sword heavy?',
        'Linnet says the Warden eats children. I said he would have to catch me first.',
      ] },
      { id: 'linnet', look: 'woodlass', name: 'Linnet', x: FIRE.x - 2.9, z: FIRE.z - 0.8, roam: [...kids.slice(2), ...kids.slice(0, 2)], pause: 1.1, speed: 2.6, pose: 'play', lines: [
        'We are not allowed past the bridges. Because of the goblins.',
        'Sprig is it. I am never it.',
      ] },
      { id: 'burdock', look: 'woodelder', name: 'Old Burdock', x: sitSpot[0], z: sitSpot[1], pose: 'sit', heading: sitSpot[2], lines: [
        'When I was a boy the Warden walked these banks and the wood sang for him.',
        'Now it only whispers. That is where the name came from, you know. Whisperwood.',
      ] },
      { id: 'hazel', look: 'woodgardener', name: 'Hazel', x: garden[0][0], z: garden[0][1], roam: garden, pause: 4, speed: 1.4, pose: 'work', lines: [
        'Moonflowers open only at night. Like the rest of us, these days.',
        'Ash tramples my beds looking for his sister. I do not have the heart to scold him.',
      ] },
      { id: 'bram', look: 'woodcarrier', name: 'Bram', x: carry[0][0], z: carry[0][1], roam: carry, pause: 3, speed: 1.7, lines: [
        'Charcoal for Bryony, ale for Moss. My back is for everyone.',
        'The road east is safe as far as the bridge over Rookfall. After that, keep your blade out.',
      ] },
      { id: 'rowan', look: 'woodward', name: 'Rowan of the Watch', x: watchSpot[0], z: watchSpot[1], pose: undefined, lines: [
        'I watch the road for goblins. And owls. Mostly owls.',
        'Saw a light up on the Warden\'s heights last night. Purple, beating like a heart.',
      ] },
      { id: 'marigold', look: 'woodgardener', name: 'Marigold the Beekeeper', x: HIVES.x - 1.6, z: HIVES.z + 1.6, roam: [[HIVES.x - 1.6, HIVES.z + 1.6], [HIVES.x + 1.4, HIVES.z + 1.5], [HIVES.x + 0.2, HIVES.z + 2.2]], pause: 5, speed: 1.2, pose: 'work', lines: [
        'Mind the bees. They are cross with everyone since the thorns came, not only you.',
        'Heather honey from the heights, once. Now it is bramble honey, and it bites.',
      ] },
      { id: 'sorrel', look: 'old', name: 'Old Sorrel the Weaver', x: home.weaver.door.x, z: home.weaver.door.z, pose: 'sit', heading: HOMES.weaver.face, lines: [
        'Spider silk and nettle thread. It keeps the thorns off better than wool.',
        'Wrap your boots in it and the brambles let you by. Quicker on your feet. For a little coin.',
        'The Reeve on the island will tell you what needs doing. He always does.',
      ], wares: ['boots'] },
      { id: 'wrenhome', look: 'woodgirl', name: 'Wren', x: off(home.ash, HOMES.ash.face, 4.4, 5.5)[0], z: off(home.ash, HOMES.ash.face, 4.4, 5.5)[1], face: 1, hidden: true, lines: ['Thank you, sir knight. The berries were worth it. Almost.'] },
      { id: 'wren', look: 'woodgirl', name: 'Wren', x: CAGE.x, z: CAGE.z, face: 1, caged: true, lines: [
        'A knight, out here? Ash put you up to this. He worries.',
        'They hid their takings in that hollow log. Have them: they are more yours than theirs.',
        'I know the deer paths home. Watch for the thorns in the ravine!',
      ] },
      { id: 'herbwife', look: 'herbwife', name: 'Old Nettle', x: HERBS.x + 1, z: HERBS.z + 1.6, face: -1, lines: [
        'A stag is held in the Warden\'s thorns, in a hollow of the Deep Wood west of the oaks. His goblins keep it. Cut it loose and it will carry you.',
        'And the oaks themselves: stand in their ring and they will test you. The seed they keep makes a heart stronger.',
        'Nettle tonic, if you want it. Clears the head; your second wind comes sooner. It costs, mind.',
      ], wares: ['focus'] },
      { id: 'owl', look: 'owl', name: 'Old Owl', x: OWL[0], z: OWL[1], perch: OWL_PERCH, lines: [
        'Hoo! The Reeve lives in the Heart Oak. The rope bridges take you over.',
        'Hoo! Cracked stone hides things. Strike it hard.',
        'Hoo! Vines hold, if you hold on. Keep jumping.',
        'Hoo! Thorns have a heart. Tear it out, and they wither.',
        'Hoo! Thorns answer thorns. The stag tears away what a sword only scratches.',
      ] },
    ],
    objects,
    // The Ring of Oaks: the Old Wood's relic trial.
    trial: {
      x: RING.x,
      z: RING.z,
      relic: 'heartwood',
      quest: 'oaks',
      prompt: 'Wake the oaks at their altar',
      wake: ['The oaks stir', 'Their roots close the ring. Hold it until they rest.'],
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
    fireflyZones: [{ x: 80, z: 102, r: 16 }, { x: POND.x, z: POND.z, r: 17 }, { x: 20, z: 104, r: 12 }, { x: RING.x, z: RING.z, r: 8 }, { x: 60, z: 32, r: 16 }],
    critters,
    afterOutskirts: (g: Grid, bb: Builder) => {
      // The stag's bed: moss and ferns, mushrooms, a fallen bough to lie against.
      for (const [dx, dz, s] of [[-2.2, -1.6, 1], [2.1, -2, 0.9], [-2.6, 1.8, 1.1], [1.4, 2.2, 0.8]] as [number, number, number][]) D.fern(bb, BED.x + dx, BED.z + dz, s);
      D.fallenLog(bb, BED.x - 1.2, BED.z - 2.3, 3.2, 0.4);
      bb.mushrooms(BED.x + 2.3, BED.z + 1.6, 5, false);
      giantMushroom(bb, BED.x - 2.8, BED.z + 0.6, 0.6, true);
      bb.moonflowers(BED.x + 0.3, BED.z + 0.6, 7, 1.4);
      // ...and the cleft: boulders and ferns at the feet of its walls.
      for (const [x, z, k] of [[0.8, 78.8, 0.45], [2.6, 81.6, 0.4], [-1.8, 81.7, 0.5]] as [number, number, number][]) bb.rock(x, z, k);
      for (const [x, z] of [[1.8, 79], [3.2, 81.4], [-0.6, 79.2], [-2.6, 79.4]] as [number, number][]) D.fern(bb, x, z, 0.8);
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
      // Detail everywhere.
      const posts = [...(objects.filter((o) => 'x' in o) as unknown as { x: number; z: number }[])];
      const fits = (x: number, z: number, kind: 'soft' | 'solid' | 'tree') => {
        const inRealm = x >= 0 && z >= 0 && x < MAP_W && z < MAP_D;
        if (inRealm && kit.nearRoad(x, z, kind === 'tree' ? 3.2 : 1.5)) return false;
        if (!inRealm && distLine(road, x, z) < 3) return false;
        // The Warden's heights are dressed by hand ("what grows there"): nothing generic on them.
        if (inRealm && insidePoly(HOLD, x, z) && g.groundAt(x, z) > HOLD_H - 0.6) return false;
        if (kind !== 'soft' && keepOut(x, z)) return false;
        return kind === 'soft' || !posts.some((o) => Math.hypot(x - o.x, z - o.z) < 3);
      };
      // Each zone's undergrowth (ferns and fungi in the woods, stumps round the kilns, stones on the
      // ridges and rims, thorn scrub on the Warden's heights, reeds by the water...).
      for (let z0 = 3; z0 < MAP_D - 3; z0 += 1.3)
        for (let x0 = 3; x0 < MAP_W - 3; x0 += 1.3) {
          const x = x0 + hash(x0 + 3, z0) * 1.1, z = z0 + hash(z0, x0 + 5) * 1.1, zs = ZONES[zoneAt(x, z)];
          // In clumps with bare ground between (a finer patch than the trees').
          if (!zs.plants.length || hash(x * 0.9 + 1, z * 1.1) > zs.under * (0.2 + 1.6 * patchAt(x * 1.6 + 40, z * 1.6)) * (MOBILE ? 0.5 : 1)) continue;
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
            // A clump of one to three, of different sizes, not one dome.
            const n = 1 + Math.floor(u * 3);
            for (let j = 0; j < n; j++) {
              const a = j * 2.4 + u * 6, d = j ? 0.45 + hash(x + j, z) * 0.5 : 0;
              bramble(bb, x + Math.cos(a) * d, z + Math.sin(a) * d, 0.5 + hash(z + j, x) * 0.5, 0.9 + hash(x, z + j) * 0.6, u > 0.8 && j === 0);
            }
            bb.collide({ kind: 'c', x, z, r: 0.35 + n * 0.18, y0: g.groundAt(x, z) - 1, y1: g.groundAt(x, z) + 1.4 });
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
          // In stretches along the lip, with long bare runs between (never a row of bushes).
          const lp = patchAt(x * 1.9 + 7, z * 1.9);
          const lx = x + 0.5 + nx * 0.2 + (v - 0.5) * 0.6 * nz, lz = z + 0.5 + nz * 0.2 + (v - 0.5) * 0.6 * nx;
          if (u < 0.2 * lp && fits(lx, lz, 'soft')) D.fern(bb, lx, lz, 0.7 + v * 0.5);
          else if (u < 0.28 * lp && fits(lx, lz, 'soft')) bb.bush(lx, lz, 0.45 + v * 0.45, v < 0.5 ? '#3b6b2a' : '#44603a');
          else if (u < 0.34 * lp && fits(lx, lz, 'soft')) bb.rock(lx, lz, 0.3 + v * 0.3, false);
          if ((nx > 0 || nz > 0) && u > 0.3 && u < 0.85 && v < 0.35 + 0.65 * lp) {
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
        still: (x, z) => sdPoly(BLACKWATER, x, z) < 0 || insidePoly(MOSSFEN, x, z) || lakeSd(x, z) < 0,
        wild: [
          ['squirrel', 6, [T.DarkGrass]],
          ['deer', 4, [T.DarkGrass, T.Grass]],
          ['fox', 2, [T.DarkGrass, T.Mud, T.Reeds]],
        ],
        noWild: (x, z) => lakeSd(x, z) < 11,
        critters,
        // The detail in clumps, as the undergrowth (the same patches).
        patch: (x, z) => patchAt(x * 1.6 + 40, z * 1.6),
      });
    },
    // The hollow among the Great Tree's roots: the Warden's arena (thorns grow shut behind the knight).
    arena: {
      x0: BOWL.x - 6.5, z0: BOWL.z - 5.4, x1: BOWL.x + 6.9, z1: BOWL.z + 5.4, y: HOLD_H - 0.5,
      summons: [[BOWL.x - 4.5, BOWL.z - 4.2], [BOWL.x - 4.5, BOWL.z + 4.2]],
      dust: [BOWL.x - 6.5, 12, HOLD_H + 9, BOWL.z - 5.5, 11],
      mountOut: [BOWL.x + 13.5, BOWL.z + 1],
    },
    // (A knight comes into the Old Wood with a better sword than he had in Blackpine: its foes are
    // tougher, and take about as many blows as Blackpine's did.)
    foeHp: 1.6,
    titleView: { x: POND.x + 4, z: POND.z + 6 },
    debugSpots: [[111.5, 109.5], [70, 92], [98, 64], [103.5, 33.5], [70, 14], [41.5, 15.8], [31, 15], [27, 24], [22, 66]],
    borders: [{ id: 'thornroad', to: 'castle', arrive: 'thornroad', x: 113.3, z: 125.6, r: 1.4, out: { x: 111.5, z: 109.5, fx: -0.45, fz: -0.9 }, card: ['The Old Wood', 'Blackpine'] }, WOOD_STAIR],
  };
}

/**
 * The land beyond Whisperwood's edges: the Greywater, a broad river along the east, the Old
 * Wood's heights to the north and west (west of the Withered Wood a cove of the sea under the
 * cliff), low wood across the brook.
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
        // The Greywater: a broad river along the east, the wood's floor running down to its reedy
        // bank; beyond it low wooded hills rise gently. The brook runs into it at the south. (The
        // east is the camera's side: nothing tall stands close.)
        const o = gx - (W - 1), bank = 2.3 + (n2 - 0.5) * 1.6, far = 14 + (n - 0.5) * 3;
        const water = (bed: number) => {
          set(bed, T.Bed);
          grid.water[i] = FLOOR - 0.35;
          grid.noGrass[i] = 1;
        };
        if (o < bank + 1 && Math.abs(gz + 0.5 - 117) < 2.3) water(FLOOR - 2.2); // the brook's mouth
        // (North of the wood's own northern heights the bank climbs into hills: no way round them.)
        else if (o < bank) gz < 6 ? set(Math.round(10 + n * 3), T.DarkGrass) : set(FLOOR, n2 > 0.55 ? T.Reeds : T.Grass);
        // (Wadeable shallows only beside the wood: past its ends the river is deep to the bank.)
        else if (o < far) water(Math.min(o - bank, far - o) < 1.4 && gz >= 8 && gz <= 112 ? FLOOR - 0.6 : FLOOR - 2.6);
        else set(Math.round(FLOOR + 0.6 + (o - far) * 0.35 + n * 2.5), n2 > 0.78 ? T.Rock : T.DarkGrass);
      } else if (gz > D - 1) set(FLOOR + 3 + Math.round(n * 1.5), T.DarkGrass); // the brook's far bank: too steep to climb (even on the stag), too low to hide the knight
      else set(Math.round(Math.max(edgeH, 6) + 1 + out * 0.5 + n * 5), n2 > 0.7 ? T.Rock : T.DarkGrass);
    }
  carveStagBed(grid, Math.floor(BED.x - BED.rx - 2), 0);
  // Past the Withered Wood the heights end at the sea cliff, the Sea Stair cut down it.
  paintWoodStair(grid);
}

/** The stag's bed and its cleft carved out of the ground between x0 and x1 (the map's wall, or the heights beyond). */
function carveStagBed(grid: Grid, x0: number, x1: number) {
  for (let gz = Math.floor(BED.z - BED.rz - 2); gz <= Math.ceil(BED.z + BED.rz + 2); gz++)
    for (let gx = x0; gx < x1; gx++) {
      const i = grid.i(gx, gz), px = gx + 0.5, pz = gz + 0.5, k = inStagBed(px, pz);
      if (!k) continue;
      grid.h[i] = FLOOR;
      grid.t[i] = k === 1 && fbm(px * 0.9, pz * 0.9, 1, 93) > 0.35 ? T.Moss : T.DarkGrass;
      grid.side[i] = S.Rock;
      grid.dir[i] = -1;
      grid.noGrass[i] = 0;
    }
}

export function decorateForestOutskirts(b: Builder, grid: Grid, W: number, D: number, r: Rng) {
  for (let z = grid.oz; z < grid.oz + grid.d; z += 1.6)
    for (let x = grid.ox; x < grid.ox + grid.w; x += 1.6) {
      if (x > -1 && z > -1 && x < W && z < D) continue;
      const tx = x + r() * 1.2, tz = z + r() * 1.2, k = r();
      // The Sea Stair's cove and the low shore across it: bare (drawing what a tree there drew, so nothing else shifts).
      if (woodStairBare(tx, tz)) {
        if (k < 0.62) r();
        continue;
      }
      if (!grid.inside(Math.floor(tx), Math.floor(tz)) || grid.waterAt(tx, tz) !== NONE) continue;
      const h = grid.groundAt(tx, tz);
      if (h < 0) continue;
      if (grid.typeAt(tx, tz) === T.Path) continue;
      if (Math.hypot((tx - BED.x) / (BED.rx + 0.6), (tz - BED.z) / (BED.rz + 0.6)) < 1 || (tx > BED.x && Math.abs(tz - BED.cz) < 2)) continue; // the stag's bed
      if (tx > W - 1 && tx < W + 16) {
        // The Greywater's banks: reeds, no trees (the camera's side).
        if (h >= FLOOR - 0.1 && h <= FLOOR + 0.1 && k < 0.3) b.reeds(tx, tz, 6, 0.6);
        continue;
      }
      if (tx > 106 && tx < 120 && tz > 118 && tz < 130) continue; // the thorn road's last stretch
      if (tx > 52 && tx < 76 && tz > D - 1 && tz < D + 9) continue; // the brook's far bank below the goblins' camp: the camera's side of it
      if (k < 0.5) b.pine(tx, tz, 1 + r() * 0.7);
      else if (k < 0.62) b.oak(tx, tz, 1 + r() * 0.4);
    }
  dressWoodStair(b, grid);
}
