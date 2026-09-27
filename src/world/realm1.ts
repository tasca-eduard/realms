import * as THREE from 'three';
import { K } from '../engine/materials';
import { mulberry32, rand, fbm, type Rng } from '../engine/util';
import { Builder, GLOW, PAL, type Structure } from './builder';
import { Grid, S, T, NONE } from './grid';
import { Painter, insidePoly, distLine, sdPoly, type Pt } from './paint';
import type { CritterDef } from '../game/critters';

// ---------------------------------------------------------------------------
// Realm 1: the Moonlit Keep.
// Map is 120 x 120 tiles. Screen-up is toward (-x, -z), so the journey runs
// from the south-east corner (the King's Road) to the keep in the north-west.
// ---------------------------------------------------------------------------

export const MAP_W = 120;
export const MAP_D = 120;

export type EnemyType = 'goblin' | 'shield' | 'archer' | 'bat' | 'boar' | 'brute' | 'bomber' | 'darter' | 'shaman' | 'king';

export interface EnemySpawn {
  type: EnemyType;
  x: number;
  z: number;
  group?: string;
  /** Archers that hold position. */
  guard?: boolean;
  /** Bigger, tougher, drops a power-up. */
  elite?: boolean;
  /** Retired from the realm (kept in the list so later save ids don't shift). */
  off?: boolean;
}

export interface NpcDef {
  id: string;
  look: string;
  name: string;
  x: number;
  z: number;
  face?: -1 | 1;
  lines: string[];
  /** Extra lines after the captive is rescued. */
  after?: string[];
  shop?: 'flask' | 'sword';
  hidden?: boolean;
}

export type ObjDef =
  | { kind: 'moonfire'; id: string; name: string; x: number; z: number }
  | { kind: 'chest'; id: string; x: number; z: number; rot: number; coins: number; power?: 'fire' | 'wind' | 'magnet' | 'bubble' | 'giant' }
  | { kind: 'lore'; id: string; x: number; z: number; text: string }
  | { kind: 'lever'; id: string; x: number; z: number }
  | { kind: 'drawbridge'; x0: number; z0: number; x1: number; z1: number; deck: number }
  | { kind: 'cage'; id: string; x: number; z: number }
  | { kind: 'hallDoor'; x: number; z: number; y: number }
  | { kind: 'breakable'; x: number; z: number; what: 'pot' | 'crate' | 'barrel' }
  | { kind: 'windmill'; x: number; z: number }
  | { kind: 'sign'; x: number; z: number; text: string }
  | { kind: 'arenaGate'; x: number; z: number; y: number }
  | { kind: 'shard'; id: string; x: number; z: number }
  | { kind: 'cracked'; id: string; x: number; z: number; alongX: boolean };

export interface RegionDef {
  name: string;
  music: string;
  test: (x: number, z: number, y: number) => boolean;
  /** Wind strength and ambience flavour. */
  amb?: 'fields' | 'village' | 'woods' | 'keep' | 'indoor' | 'road';
  quiet?: boolean;
}

export interface RealmData {
  horse: { x: number; z: number };
  trial: { x: number; z: number };
  grid: Grid;
  builder: Builder;
  start: { x: number; z: number };
  enemies: EnemySpawn[];
  npcs: NpcDef[];
  objects: ObjDef[];
  regions: RegionDef[];
  tavern: Structure;
  hall: Structure;
  waterPoints: [number, number][];
  grassDensity: (x: number, z: number) => number;
  grassScale: (x: number, z: number) => number;
  fireflyZones: { x: number; z: number; r: number }[];
  critters: CritterDef[];
  /** Things placed once the land beyond the map edge exists. */
  afterOutskirts: (grid: Grid, b: Builder) => void;
}

// Key shapes, shared between terrain, props and regions.
const VILLAGE: Pt[] = [[54, 46], [100, 44], [108, 56], [104, 66], [96, 71], [86, 73], [74, 79], [62, 84], [54, 80], [50, 66]];
const WOODS: Pt[] = [[58, 0], [120, 0], [120, 58], [110, 56], [102, 48], [90, 45], [76, 43], [62, 42], [58, 36]];
const PLATEAU: Pt[] = [[0, 0], [63, 0], [63, 36], [60, 44], [56, 50], [44, 53], [26, 55], [10, 56], [0, 57]];
const STREAM: Pt[] = [[122, 63], [106, 72], [96, 78], [88, 79], [80, 86], [72, 98], [66, 110], [62, 122]];
const ROAD_IN: Pt[] = [[119, 119], [110, 110], [104, 102], [98, 92], [93.5, 85], [93, 78], [93, 72], [89, 67], [80, 64]];
const ROAD_WEST: Pt[] = [[76, 65], [66, 66], [58, 67.5], [52, 67.5], [44, 71], [42, 76]];
const ROAD_NORTH: Pt[] = [[80, 62], [84.5, 59], [86, 52], [85.5, 46], [86, 40], [89, 34], [93, 29]];
const ROAD_CAMP_WEST: Pt[] = [[93, 27], [84, 22], [76, 18], [68, 15.5], [62, 15]];
// Deer trails deeper into Blackpine: east to the gorge lookout, north-east to the old lodge.
const TRAIL_EAST: Pt[] = [[100, 28], [106, 30.5], [113, 30.5], [119.5, 30.5]];
const TRAIL_LODGE: Pt[] = [[97, 22], [102, 17], [107, 13]];
const LODGE = { x: 108.5, z: 11.5 };
// The Old Warden's homestead, in the meadow inside the stream's bend.
const HOME = { x: 87.5, z: 95 };
const BAILEY_ROAD: Pt[] = [[62, 15], [56, 15], [55, 11]];
const BAILEY_ROAD2: Pt[] = [[56, 15], [55, 22], [52, 24.5], [46, 24.5]];

const CAMP = { x: 95, z: 27, r: 9 };
const FORD = { x: 69, z: 104 };

// Footpaths from the roads to every place with a purpose, so the ground shows the way.
// Places that are there to be found (the marsh, the island, the Hollow) get none.
const LANE_HOME: Pt[] = [[99.9, 95.2], [96, 95.4], [90.4, 95.1]];
const LANE_STONES: Pt[] = [[102.3, 98.8], [104.2, 97.6], [106.2, 94.6], [109.2, 89.6]];
const LANE_RIVER: Pt[] = [[113.6, 90], [116.5, 92.6], [119, 95], [120.4, 96.4]];
const LANE_FARM: Pt[] = [[106.8, 105.8], [99, 109.1], [91, 109.8], [86, 110.3], [86, 116]];
// Graveyard gate -> past the farmhouse -> over the ford -> into the farm.
const LANE_FIELDS: Pt[] = [
  [44.2, 71.5], [46.5, 78], [48.3, 84.5], [49.3, 89], [51.2, 94], [52, 99.3],
  [56, 101.3], [63, 102.9], [69, 104], [74, 106.2], [80, 108.5], [86, 110.3],
];
const LANE_PIER: Pt[] = [[48.4, 85], [41, 87.8], [31, 91.5], [21, 96.8], [14, 99.3], [9.6, 99.5]];
const LANE_STAIR: Pt[] = [[48, 69.3], [42, 66.8], [30, 65.5], [20, 62.6], [10, 60.6], [6.2, 59.8], [6, 58.3]];
const LANES = [LANE_HOME, LANE_STONES, LANE_RIVER, LANE_FARM, LANE_FIELDS, LANE_PIER, LANE_STAIR];

export function buildRealm1(builder: Builder): RealmData {
  const grid = builder.grid;
  const p = new Painter(grid);
  const r = mulberry32(2024);

  // ---------- terrain ----------
  p.rect(0, 0, MAP_W, MAP_D, { h: 0, t: T.Grass, side: S.Dirt });
  p.poly(VILLAGE, { h: 1, t: T.Grass, side: S.Dirt }, 1.6, 3);
  p.poly(WOODS, { h: 2, t: T.DarkGrass, side: S.Rock }, 1.8, 5);
  p.poly(PLATEAU, { h: 4, t: T.Grass, side: S.Rock }, 1.6, 7);

  // Gentle rolls in the woods and fields (half-step terraces avoided: hills are whole steps).
  p.each((x, z, i) => {
    if (grid.h[i] === 2 && x > 70 && fbm(x * 0.07, z * 0.07, 3, 21) > 0.66) grid.h[i] = 3;
  });

  // Border hills on the far (north and west) edges only: anything tall on the
  // near edges would stand between the camera and the knight.
  p.each((x, z, i) => {
    const n = fbm(x * 0.1, z * 0.1, 2, 31) * 3;
    const edge = Math.min(x, z);
    if (edge < 3 + n) {
      const hh = x < 64 && z < 57 ? 9 : 5;
      grid.h[i] = Math.max(grid.h[i], hh);
      grid.t[i] = T.DarkGrass;
      grid.side[i] = S.Rock;
    }
  }, 0, 0, MAP_W, MAP_D);

  // The stream, crossed by the road bridge, and a shallow ford further down.
  p.stream(STREAM, 3.4, -0.35, -1.3, 1.4);
  p.each((x, z, i) => {
    if (grid.water[i] !== NONE && Math.hypot(x + 0.5 - FORD.x, z + 0.5 - FORD.z) < 2.6) grid.h[i] = Math.max(grid.h[i], -0.5);
  }, FORD.x - 4, FORD.z - 4, FORD.x + 4, FORD.z + 4);
  // Keep the SE arrival flat around the road.
  p.flattenAlong(ROAD_IN.slice(1, 4), 5, 0);

  // Village square, roads and ramps.
  p.rect(90, 74, 96, 76, { h: 0 });
  p.ramp(91, 71, 95, 74, 3, 0, 1, true, T.Cobble);
  p.rect(88, 66, 97, 71, { h: 1 });
  p.rect(70, 57, 86, 71, { h: 1 });
  p.rect(72, 58, 85, 71, { t: T.Cobble, noGrass: true });
  p.path(ROAD_IN, 2.6, T.Path, 0.6, 3);
  p.path(ROAD_WEST, 2.4, T.Path, 0.6, 4);
  p.path(ROAD_NORTH, 2.2, T.Path, 0.5, 5);

  // Village -> fields ramp (west).
  p.rect(48, 64, 56, 71, { h: 0 });
  p.rect(54, 64, 60, 71, { h: 1 });
  p.ramp(50, 66, 54, 70, 0, 0, 1, true, T.Path);

  // Village -> woods stairs (north).
  p.rect(82, 36, 90, 42, { h: 2 });
  p.rect(82, 47, 90, 51, { h: 1 });
  p.ramp(84, 42, 88, 47, 3, 1, 2, true, T.Cobble);

  // Camp clearing and trails in the woods.
  p.each((x, z, i) => {
    if ((x + 0.5 - CAMP.x) ** 2 + (z + 0.5 - CAMP.z) ** 2 < CAMP.r * CAMP.r) {
      grid.h[i] = 2;
      grid.t[i] = T.Dirt;
    }
  });
  p.flattenAlong(ROAD_NORTH.slice(3), 3, 2);
  p.flattenAlong(ROAD_CAMP_WEST, 3.2, 2);
  p.path(ROAD_CAMP_WEST, 2, T.Path, 0.5, 6);
  p.path(ROAD_NORTH.slice(3), 2, T.Path, 0.5, 7);

  // Woods -> outer bailey stairs (rising west).
  p.rect(66, 11, 72, 19, { h: 2 });
  p.rect(50, 4, 62, 47, { h: 4, t: T.Grass });
  p.ramp(62, 13, 66, 17, 2, 2, 4, true, T.Flag);
  p.rect(62, 11, 66, 13, { h: 4 });
  p.rect(62, 17, 66, 19, { h: 4 });

  // Moat along the east wall of the keep, with a ruined tower sealing its south end.
  p.stream([[49, 6], [49, 46]], 4.2, 2.7, 1.4, 0, 41);
  p.rect(47, 4, 51, 47, { side: S.Brick });
  p.path(BAILEY_ROAD, 2, T.Flag, 0.3, 8);
  p.path(BAILEY_ROAD2, 2.2, T.Flag, 0.3, 9);

  // Keep courtyard and great hall floor.
  p.rect(14, 8, 47, 41, { h: 4, t: T.Flag, noGrass: true, side: S.Brick });
  p.clearWater(14, 8, 47, 41);
  p.rect(16, 10, 34, 27, { t: T.Floor });
  p.rect(20, 17, 34, 20, { t: T.Carpet });
  p.rect(16, 16, 20, 21, { h: 4.4, t: T.Carpet, side: S.Brick }); // throne dais
  p.rect(20, 16, 21, 21, { h: 4.2, t: T.Carpet, side: S.Brick });
  // The gate passage over the drawbridge line.
  p.rect(44, 23, 47, 26, { t: T.Flag, h: 4 });

  // The Pilgrims' Stair: cut along the cliff face from the Barrow Fields up to the
  // Overlook, rock on one side and a low parapet on the other.
  p.poly([[5, 51], [21, 51], [21.5, 56.5], [15, 57.2], [8, 56.8], [5.5, 55]], { h: 4, t: T.Grass, side: S.Rock }, 0.9, 17);
  p.rect(16, 57, 20, 59, { h: 4, t: T.Flag, side: S.Brick, noGrass: true });
  p.ramp(8, 57, 16, 59, 0, 0, 4, true, T.Flag);
  p.rect(8, 57, 16, 59, { side: S.Brick });
  p.rect(4, 57, 8, 59, { h: 0, t: T.Path, noGrass: true });
  p.rect(4, 59, 22, 62, { h: 0, t: T.Grass });

  // The Hollow: a cave in a spur of the Overlook cliff, its mouth sealed by a
  // cracked wall. The spur's north and west sides are the cliff itself; its
  // south and east faces and its roof are built (see buildHollow) so they can
  // lift away while you are inside.
  p.rect(29, 52, 37, 54, { h: 4, t: T.Grass, side: S.Rock });
  p.rect(29, 54, 30, 60, { h: 4, t: T.Grass, side: S.Rock });
  p.rect(30, 54, 37, 60, { h: 0, t: T.Dirt, side: S.Rock, noGrass: true });
  p.rect(37, 54, 40, 61, { h: 0, t: T.Grass });
  p.rect(29, 60, 38, 62, { h: 0, t: T.Grass });

  // Trails into the deep wood, and the clearing round the old lodge.
  p.flattenAlong(TRAIL_EAST, 3, 2);
  p.flattenAlong(TRAIL_LODGE, 3, 2);
  p.each((x, z, i) => {
    if ((x + 0.5 - LODGE.x) ** 2 + (z + 0.5 - LODGE.z) ** 2 < 42) {
      grid.h[i] = 2;
      grid.t[i] = (x + z) % 5 === 0 ? T.Dirt : T.DarkGrass;
    }
  }, LODGE.x - 8, LODGE.z - 8, LODGE.x + 8, LODGE.z + 8);
  p.path(TRAIL_EAST, 1.6, T.Dirt, 0.4, 14);
  p.path(TRAIL_LODGE, 1.6, T.Dirt, 0.4, 15);

  // Tavern floor.
  p.rect(72, 50, 82, 57, { t: T.Wood, h: 1, noGrass: true });

  // Mirrormere reaches into the west of the fields.
  const LAKE_IN: Pt[] = [[-6, 82], [5, 85], [9.5, 94], [8.5, 106], [4, 115], [-6, 118]];
  p.each((x, z, i) => {
    const d = sdPoly(LAKE_IN, x + 0.5, z + 0.5) + (fbm(x * 0.2, z * 0.2, 2, 81) - 0.5) * 1.6;
    if (d < 0) {
      grid.h[i] = -1.5 + Math.min(1, -d / 3) * -0.1 + Math.min(0.9, Math.max(0, 2 + d) * 0.45);
      grid.t[i] = T.Bed;
      grid.water[i] = -0.35;
      grid.noGrass[i] = 1;
    } else if (d < 1.6) {
      grid.h[i] = 0;
      grid.t[i] = d < 0.8 ? T.Sand : T.Reeds;
    }
  }, 0, 78, 16, 120);
  // A line of shallows runs from the pier's end out to the island.
  p.each((x, z, i) => {
    if (grid.water[i] !== NONE) grid.h[i] = Math.max(grid.h[i], -0.62);
  }, 0, 99, 3, 101);
  // Marsh pools in the south-west.
  p.each((x, z, i) => {
    if (grid.h[i] !== 0 || grid.water[i] !== NONE) return;
    const pond = fbm(x * 0.17, z * 0.17, 3, 79);
    const edge = Math.min(1, (z - 106) / 6);
    if (pond > 0.62 - edge * 0.06 && z > 107) {
      grid.h[i] = -0.9;
      grid.t[i] = T.Bed;
      grid.water[i] = -0.35;
      grid.noGrass[i] = 1;
    } else if (pond > 0.52 && z > 105) grid.t[i] = T.Mud;
  }, 14, 104, 60, 120);
  // Fields in the south-east.
  p.rect(70, 112, 84, 120, { t: T.Field, noGrass: true });
  p.rect(88, 112, 100, 120, { t: T.Field, noGrass: true });

  // Graveyard earth and the windmill knoll.
  p.poly([[27, 69], [43, 69], [43, 83], [27, 83]], { t: T.Moss }, 0.8, 12);
  p.poly([[36, 92], [44, 90], [46, 97], [38, 100]], { h: 1, t: T.Grass, side: S.Dirt }, 1.2, 13);

  // Footpaths (after the ground they cross). The farm lane is a cart track.
  LANES.forEach((l, k) => p.path(l, l === LANE_FARM ? 2 : 1.7, T.Path, 0.4, 20 + k, false));

  // ---------- props ----------
  const b = builder;
  const inKnoll = (x: number, z: number) => x > 27 && x < 40 && z > 50 && z < 63;
  const avoid: Pt[][] = [ROAD_IN, ROAD_WEST, ROAD_NORTH, ROAD_CAMP_WEST, BAILEY_ROAD, BAILEY_ROAD2, TRAIL_EAST, TRAIL_LODGE, ...LANES];
  const nearRoad = (x: number, z: number, d: number) => avoid.some((l) => distLine(l, x, z) < d);
  const flatAround = (x: number, z: number, rad: number) => {
    const h = grid.groundAt(x, z);
    for (const [dx, dz] of [[rad, 0], [-rad, 0], [0, rad], [0, -rad]]) if (Math.abs(grid.groundAt(x + dx, z + dz) - h) > 0.1) return false;
    return grid.waterAt(x, z) === NONE;
  };

  // Blackpine Wood: dense pines, clearings for the camp and trails.
  forest(b, r, 60, 1, 119, 57, 0.33, (x, z) => {
    if (!insidePoly(WOODS, x, z) && !(z < 4 || x > 116)) return false;
    if (x < 64 && z < 47) return false;
    if ((x - CAMP.x) ** 2 + (z - CAMP.z) ** 2 < (CAMP.r + 1) ** 2) return false;
    if ((x - LODGE.x) ** 2 + (z - LODGE.z) ** 2 < 52) return false;
    if (nearRoad(x, z, 2.3)) return false;
    if (x > 60 && x < 74 && z > 9 && z < 22) return false;
    return flatAround(x, z, 0.4);
  }, 'pine');
  // Border woods everywhere else.
  forest(b, r, 0, 0, 120, 120, 0.3, (x, z) => {
    const edge = Math.min(x, z);
    if (edge > 7) return false;
    if (x < 64 && z < 57) return false;
    if (nearRoad(x, z, 3)) return false;
    return flatAround(x, z, 0.3);
  }, 'mixed');
  // Pines on the keep's back hills.
  forest(b, r, 0, 0, 64, 57, 0.25, (x, z) => {
    if (grid.groundAt(x, z) < 8.5) return false;
    return flatAround(x, z, 0.3);
  }, 'pine');

  // Fields: scattered oaks, bushes and rocks.
  for (let i = 0; i < 70; i++) {
    const x = rand(r, 6, 60), z = rand(r, 58, 114);
    if (nearRoad(x, z, 3) || !flatAround(x, z, 0.6)) continue;
    if (x > 26 && x < 45 && z > 67 && z < 85) continue;
    if (inKnoll(x, z)) continue;
    if (distLine(STREAM, x, z) < 4) continue;
    if (x > 34 && x < 48 && z > 88 && z < 102) continue;
    const k = r();
    if (k < 0.3) b.oak(x, z, 0.9 + r() * 0.5);
    else if (k < 0.6) b.bush(x, z, 0.8 + r() * 0.5);
    else if (k < 0.75) b.rock(x, z, 0.5 + r() * 0.6);
    else b.deadTree(x, z, 0.8 + r() * 0.4);
  }
  // ---------- the Old Warden's homestead ----------
  {
    const H = HOME;
    b.house(H.x, H.z, 5, 4, { doorSide: 0, roof: 'thatch', lit: 1, name: 'warden house' });
    // Yard fence with a gate facing the road.
    b.fence([[H.x + 4.8, H.z - 1.2], [H.x + 4.8, H.z - 4.8], [H.x - 5, H.z - 4.8], [H.x - 5, H.z + 4.5], [H.x + 4.8, H.z + 4.5], [H.x + 4.8, H.z + 1.4]]);
    b.lamp(H.x + 5.4, H.z + 1.8);
    // Vegetable rows.
    for (let x = H.x - 4.2; x < H.x - 1.2; x += 0.75) for (let z = H.z + 2.6; z < H.z + 4.1; z += 0.7) b.bush(x, z, 0.26, x % 1.5 < 0.75 ? '#4a6a30' : '#5a7a34');
    // Chicken coop.
    {
      const x = H.x - 3.4, z = H.z - 3.3, y = grid.groundAt(x, z), g = b.g(x, z);
      g.box(x, y, z, 1.5, 0.9, 1.1, PAL.wood, { kind: K.Wood });
      g.push().translate(x, y + 0.9, z);
      g.gable(0, 0, 0, 1.7, 1.3, 0.5, PAL.thatch, PAL.wood, { kind: K.Thatch });
      g.pop();
      g.box(x + 0.2, y, z + 0.56, 0.35, 0.4, 0.02, '#1a1410');
      g.beam([x + 0.2, y + 0.02, z + 1.2], [x + 0.2, y + 0.3, z + 0.58], 0.08, PAL.woodLight, { kind: K.Wood });
      b.collide({ kind: 'b', x0: x - 0.75, z0: z - 0.55, x1: x + 0.75, z1: z + 0.55, y0: y - 1, y1: y + 1.4 });
    }
    // Woodpile and chopping block by the north wall.
    {
      const x = H.x + 0.2, z = H.z - 2.6, y = grid.groundAt(x, z), g = b.g(x, z);
      for (let row = 0; row < 3; row++)
        for (let k = 0; k < 5 - row; k++) {
          g.push().translate(x - 1 + k * 0.4 + row * 0.2, y + 0.14 + row * 0.26, z).rotateX(Math.PI / 2);
          g.cyl(0, -0.45, 0, 0.13, 0.13, 0.9, 6, k % 2 ? PAL.bark : PAL.barkDark, { kind: K.Bark });
          g.pop();
        }
      g.cyl(x + 1.6, y, z + 0.4, 0.26, 0.28, 0.45, 7, PAL.bark, { kind: K.Bark });
      g.beam([x + 1.6, y + 0.45, z + 0.4], [x + 1.9, y + 0.95, z + 0.5], 0.03, PAL.woodDark);
      g.box(x + 1.85, y + 0.85, z + 0.5, 0.14, 0.12, 0.03, '#a0a0aa');
      b.collide({ kind: 'b', x0: x - 1.2, z0: z - 0.5, x1: x + 1.1, z1: z + 0.5, y0: y - 1, y1: y + 0.9 });
    }
    // Beehives beyond the yard, and a little orchard.
    for (let k = 0; k < 3; k++) {
      const x = H.x - 7 + k * 1.2, z = H.z + 6.2, y = grid.groundAt(x, z), g = b.g(x, z);
      g.box(x, y, z, 0.5, 0.25, 0.5, PAL.woodDark, { kind: K.Wood });
      g.cyl(x, y + 0.25, z, 0.26, 0.1, 0.55, 7, '#b09050', { kind: K.Thatch });
      b.collide({ kind: 'c', x, z, r: 0.3, y0: y - 1, y1: y + 0.8 });
    }
    for (let row = 0; row < 2; row++)
      for (let k = 0; k < 4; k++) {
        const x = H.x - 5 + k * 3 + row * 1.5, z = H.z + 8.5 + row * 3;
        b.oak(x, z, 0.6);
        const y = grid.groundAt(x, z), gl = b.g(x, z);
        for (let a = 0; a < 5; a++) gl.box(x + Math.cos(a * 1.3) * 0.5, y + 1.1 + (a % 2) * 0.3, z + Math.sin(a * 1.3) * 0.5, 0.09, 0.09, 0.09, '#b83030');
      }
    // A bench under the eaves and a washing line.
    b.bench(H.x + 3.3, H.z + 2.6, Math.PI / 2);
    {
      const g = b.g(H.x - 2, H.z + 0.5), y = grid.groundAt(H.x - 4.5, H.z);
      g.box(H.x - 4.5, y, H.z - 1.5, 0.08, 1.6, 0.08, PAL.woodDark);
      g.box(H.x - 4.5, y, H.z + 1.8, 0.08, 1.6, 0.08, PAL.woodDark);
      g.beam([H.x - 4.5, y + 1.55, H.z - 1.5], [H.x - 4.5, y + 1.5, H.z + 1.8], 0.01, '#d8d0c0');
      for (const [z, c] of [[H.z - 0.8, '#8a4a3a'], [H.z, '#d8d0c0'], [H.z + 0.9, '#4a6a9a']] as [number, string][]) g.box(H.x - 4.5, y + 0.95, z, 0.03, 0.55, 0.5, c, { kind: K.Cloth, wind: 0.8 });
    }
  }

  // Around the arrival road.
  for (let i = 0; i < 40; i++) {
    const x = rand(r, 88, 116), z = rand(r, 82, 116);
    if (nearRoad(x, z, 3.2) || !flatAround(x, z, 0.6) || distLine(STREAM, x, z) < 4) continue;
    if (Math.abs(x - HOME.x) < 10 && z > HOME.z - 7 && z < HOME.z + 14) continue;
    if (Math.hypot(x - 106, z - 99) < 4) continue;
    const k = r();
    if (k < 0.4) b.oak(x, z, 0.9 + r() * 0.4);
    else if (k < 0.7) b.bush(x, z, 0.8 + r() * 0.4);
    else b.rock(x, z, 0.5 + r() * 0.5);
  }
  // ---------- the edges of the realm ----------
  // West: the shore of Mirrormere, with a pier and a boat.
  b.pier(2.5, 9, 99.5, 1.6, 0.3);
  b.rowboat(3.2, -0.35, 102.2, 0.4);
  b.lamp(9.6, 97.6);
  for (let i = 0; i < 16; i++) {
    const z = 84 + r() * 32, x = 7 + r() * 5;
    if (grid.waterAt(x, z) !== NONE || Math.abs(z - 99.5) < 2) continue;
    r() < 0.6 ? b.reeds(x, z, 8) : b.rock(x, z, 0.4 + r() * 0.5, false);
  }
  // South-west: the marsh the stream drains into.
  for (let i = 0; i < 40; i++) {
    const x = 16 + r() * 44, z = 108 + r() * 11;
    const wet = grid.waterAt(x + 1, z) !== NONE || grid.waterAt(x - 1, z) !== NONE || grid.waterAt(x, z + 1) !== NONE;
    if (grid.waterAt(x, z) !== NONE) continue;
    if (wet && r() < 0.8) b.reeds(x, z, 8, 0.8);
    else if (r() < 0.2) b.deadTree(x, z, 0.7 + r() * 0.3);
    else if (r() < 0.4) b.bush(x, z, 0.6, '#3e5232');
  }
  // South-east: farm fields either side of the King's Road.
  b.drystone([[70, 111.5], [84, 111.5], [84, 119.5]]);
  b.drystone([[88, 111.5], [100.5, 111.5]]);
  b.drystone([[100.5, 111.5], [100.5, 117]]);
  for (const [x, z, rot] of [[76, 115, 0.3], [93, 115.5, 1.2], [79, 117, 2]] as [number, number, number][]) b.hay(x, z, rot);
  // East: an old stone circle on the meadow.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    b.standingStone(111.5 + Math.cos(a) * 3.2, 88 + Math.sin(a) * 3.2, 1.6 + r() * 0.9, a);
  }
  b.moonflowers(110, 91, 6, 1.2);
  // East: the rim of the gorge beyond Blackpine.
  for (let z = 3; z < 56; z += 2 + r() * 2) if (r() < 0.6) b.rock(117.5 + r() * 1.5, z, 0.6 + r() * 0.7);

  // Stepping stones across the ford.
  for (let k = -2; k <= 2; k++) {
    const x = FORD.x + k * 0.85 + (r() - 0.5) * 0.3, z = FORD.z + k * 0.55 + (r() - 0.5) * 0.3;
    b.g(x, z).blob(x, -0.5, z, 0.34, 0.2, 0.3, PAL.rockDark, 300 + k, { kind: K.Rock, flatBottom: true });
  }
  b.reeds(FORD.x - 2.5, FORD.z + 2, 6);
  b.reeds(FORD.x + 2.4, FORD.z - 2.2, 6);

  // Rocks along the stream.
  for (let i = 0; i < 40; i++) {
    const t = r();
    const seg = Math.floor(t * (STREAM.length - 1));
    const a = STREAM[seg], c = STREAM[seg + 1], f = t * (STREAM.length - 1) - seg;
    const x = a[0] + (c[0] - a[0]) * f + (r() - 0.5) * 7, z = a[1] + (c[1] - a[1]) * f + (r() - 0.5) * 7;
    if (grid.waterAt(x, z) !== NONE || nearRoad(x, z, 2.5) || Math.abs(x - 93) < 3) continue;
    b.rock(x, z, 0.35 + r() * 0.5, r() < 0.5);
  }
  // Keep plateau ledges (south side overlook) and bailey.
  for (let i = 0; i < 14; i++) {
    const x = rand(r, 4, 44), z = rand(r, 42, 53);
    if (grid.groundAt(x, z) !== 4 || !flatAround(x, z, 0.8)) continue;
    if (x < 28 && z > 44) continue;
    if (inKnoll(x, z)) continue;
    r() < 0.5 ? b.deadTree(x, z, 0.9) : b.rock(x, z, 0.6);
  }

  // ---------- bridge over the stream ----------
  for (let z = 75; z <= 81; z++)
    for (let x = 92; x <= 93; x++) grid.deck[grid.i(x, z)] = 0.3;
  {
    const g = b.g(93, 78);
    for (let z = 74.6; z < 82.2; z += 0.42) g.box(93, 0.18, z + 0.2, 2.4, 0.12, 0.38, PAL.wood, { kind: K.Wood, shade: 0.85 + r() * 0.25 });
    for (const x of [91.85, 94.15]) {
      for (const z of [75, 77.5, 80, 82]) g.box(x, -1.4, z, 0.2, 2.6, 0.2, PAL.woodDark, { kind: K.Wood });
      g.beam([x, 1.1, 74.8], [x, 1.1, 82.2], 0.05, PAL.woodDark, { kind: K.Wood });
    }
    grid.addCollider({ kind: 'b', x0: 91.7, z0: 74.5, x1: 92.0, z1: 82.3, y0: -2, y1: 2 });
    grid.addCollider({ kind: 'b', x0: 94.0, z0: 74.5, x1: 94.3, z1: 82.3, y0: -2, y1: 2 });
    b.lamp(90.8, 83.2);
    b.lamp(95.2, 73.4);
  }

  // ---------- the King's Road (arrival) ----------
  b.sign(101.5, 104.5, 0.8);
  b.cart(108.5, 105, 0.9);
  b.crate(110.2, 106.4);
  b.moonflowers(104.5, 97, 12, 2);
  b.moonflowers(100, 110, 8, 1.5);
  // Wayshrine: a weathered knight statue watching the road.
  {
    const x = 107.5, z = 97.5, y = grid.groundAt(x, z), g = b.g(x, z);
    g.box(x, y, z, 1.6, 0.5, 1.6, PAL.stoneDark, { kind: K.Brick });
    g.box(x, y + 0.5, z, 0.9, 0.9, 0.7, PAL.stone, { kind: K.Rock });
    g.box(x, y + 1.4, z, 0.55, 0.9, 0.4, PAL.stone, { kind: K.Rock });
    g.box(x, y + 2.3, z, 0.36, 0.38, 0.36, PAL.stone, { kind: K.Rock });
    g.beam([x + 0.35, y + 1.2, z + 0.15], [x + 0.35, y + 2.9, z + 0.15], 0.05, PAL.stone, { kind: K.Rock });
    g.box(x + 0.35, y + 2.45, z + 0.15, 0.4, 0.06, 0.06, PAL.stone);
    grid.addCollider({ kind: 'b', x0: x - 0.8, z0: z - 0.8, x1: x + 0.8, z1: z + 0.8, y0: y - 1, y1: y + 3 });
  }

  // ---------- Keepsfoot (village) ----------
  const tavern = buildTavern(b, grid);
  b.house(68, 60.5, 5, 4, { doorSide: 0, roof: 'thatch', lit: 0.8 });
  b.house(67.5, 69, 4.5, 4, { doorSide: 0, roof: 'thatch', lit: 0.6 });
  b.house(89.5, 59.5, 5, 4, { doorSide: 2, roof: 'slate', lit: 0.8 });
  b.house(90.5, 67.5, 5, 4, { doorSide: 2, roof: 'slate', lit: 0.5 });
  b.house(78.5, 74.5, 6, 4, { doorSide: 3, roof: 'thatch', lit: 0.7 });
  b.house(98.5, 60, 4, 5, { doorSide: 2, roof: 'thatch', ridgeX: false, lit: 0.6 });
  b.house(60.5, 77, 4, 5, { doorSide: 0, roof: 'thatch', ridgeX: false, lit: 0.4 });
  b.house(97, 51, 5, 4, { doorSide: 1, roof: 'slate', lit: 0.3 });
  b.well(78, 64.5);
  for (const [x, z] of [[73.5, 58.8], [83.5, 60.5], [72.5, 68.5], [84.5, 68.8], [88.5, 73.5], [63, 66], [86.5, 49]] as Pt[]) b.lamp(x, z);
  // Smithy forge beside the slate house.
  {
    b.brazier(86.8, 69.5, true);
    const x = 86.6, z = 66.9, y = grid.groundAt(x, z), g = b.g(x, z);
    g.box(x, y, z, 0.35, 0.45, 0.3, PAL.iron, { kind: K.Metal });
    g.box(x, y + 0.45, z, 0.7, 0.18, 0.28, PAL.iron, { kind: K.Metal });
    grid.addCollider({ kind: 'c', x, z, r: 0.35, y0: y - 1, y1: y + 1 });
  }
  b.cart(71.5, 72.3, 0.2);
  b.hay(64.3, 72.8, 0.4);
  b.hay(65.4, 74, 1.2);
  b.bench(74.5, 62.5, Math.PI / 2);
  b.bench(81.5, 66.5, 0);
  for (const [x, z] of [[82.8, 57.8], [83.4, 58.4], [70.8, 64.6], [93.2, 62.2], [92.9, 63]] as Pt[]) b.barrel(x, z);
  b.crate(71, 65.4);
  b.crate(71.6, 66.2, 0.55);
  b.fence([[62, 62], [62, 57], [66, 57]]);
  b.fence([[101, 63], [104, 63], [104, 56], [100.5, 56]]);
  b.fence([[56, 72], [58, 72], [58, 81]]);
  for (let i = 0; i < 18; i++) {
    const x = rand(r, 56, 104), z = rand(r, 46, 82);
    if (!insidePoly(VILLAGE, x, z) || nearRoad(x, z, 2.2) || !flatAround(x, z, 0.8)) continue;
    if (x > 69 && x < 88 && z > 48 && z < 78) continue;
    r() < 0.4 ? b.oak(x, z, 1 + r() * 0.3) : b.bush(x, z, 0.8 + r() * 0.3);
  }
  // Vegetable patches.
  for (let x = 62.6; x < 65.8; x += 0.8) for (let z = 58; z < 61.5; z += 0.9) b.bush(x, z, 0.28, '#4a6a30');
  for (let x = 100.8; x < 103.5; x += 0.8) for (let z = 57; z < 62.5; z += 0.9) b.bush(x, z, 0.25, '#58703a');

  // ---------- Barrow Fields ----------
  b.fence([[27, 69], [43, 69], [43, 74.5]]);
  b.fence([[43, 77.5], [43, 83], [27, 83], [27, 69]]);
  for (let gx = 30; gx <= 41; gx += 2.2)
    for (let gz = 74.5; gz <= 81; gz += 2.4) if (r() < 0.8) b.grave(gx + (r() - 0.5) * 0.4, gz + (r() - 0.5) * 0.3, r() < 0.3 ? 1 : 0);
  b.deadTree(29, 71.5, 1.2);
  b.deadTree(41, 81, 1.0);
  b.moonflowers(35, 79, 10, 3);
  buildCrypt(b, grid, 34, 71);
  // Scarecrow in the fields.
  {
    const x = 47, z = 84, y = grid.groundAt(x, z), g = b.g(x, z);
    g.box(x, y, z, 0.1, 1.9, 0.1, PAL.woodDark, { kind: K.Wood });
    g.box(x, y + 1.4, z, 1.3, 0.08, 0.08, PAL.woodDark, { kind: K.Wood });
    g.box(x, y + 0.95, z, 0.5, 0.6, 0.3, '#6a5a3a', { kind: K.Cloth, wind: 0.3 });
    g.blob(x, y + 1.75, z, 0.2, 0.2, 0.2, '#a08a50', 5, { kind: K.Thatch });
    g.cyl(x, y + 1.9, z, 0.35, 0.05, 0.3, 6, '#3a3024', { kind: K.Cloth });
    grid.addCollider({ kind: 'c', x, z, r: 0.2, y0: y - 1, y1: y + 2 });
  }
  for (const [x, z, rot] of [[51, 88, 0.3], [53, 90, 1.1], [44, 106, 0.2]] as [number, number, number][]) b.hay(x, z, rot);
  // Farmhouse by the windmill.
  b.house(47.5, 97, 4, 4, { roof: 'thatch', doorSide: 1, lit: 0.9 });
  b.fence([[44, 101], [51, 101], [51, 104]]);

  // ---------- Blackpine Wood and the goblin camp ----------
  for (const [x, z] of [[72, 30], [78, 12], [106, 40], [110, 20], [100, 12], [68, 38], [88, 8]] as Pt[]) b.mushrooms(x, z, 6);
  b.campfire(CAMP.x, CAMP.z);
  const tentCol = ['#5a4a2a', '#6a3a2a', '#4a4a30', '#5a3a3a'];
  b.tent(90, 21.5, 0.5, tentCol[0]);
  b.tent(99.5, 21, -0.4, tentCol[1]);
  b.tent(101.5, 31.5, 1.1, tentCol[2]);
  b.tent(89, 31, 2.4, tentCol[3]);
  for (const [x, z] of [[87.5, 25.5], [102.5, 27.5], [95, 18.8], [95, 35.5]] as Pt[]) b.standingTorch(x, z);
  for (const [x, z] of [[97.5, 34], [98.3, 34.6], [91.5, 18.8]] as Pt[]) b.barrel(x, z);
  b.crate(92.2, 35.2);
  b.crate(103.8, 24.2);
  // Goblin banners: crude skulls on poles.
  for (const [x, z] of [[86.5, 30], [104, 23]] as Pt[]) {
    const y = grid.groundAt(x, z), g = b.g(x, z);
    g.box(x, y, z, 0.1, 2.4, 0.1, PAL.woodDark, { kind: K.Wood });
    g.box(x, y + 2.35, z, 0.3, 0.28, 0.3, '#d8d0b8', {});
    g.box(x + 0.35, y + 1.6, z, 0.6, 0.7, 0.04, '#6a2a1a', { kind: K.Cloth, wind: 0.6 });
    grid.addCollider({ kind: 'c', x, z, r: 0.12, y0: y - 1, y1: y + 2 });
  }

  // ---------- the old hunting lodge ----------
  {
    const g = b.g(LODGE.x, LODGE.z), y = 2;
    const logs = (x0: number, z0: number, x1: number, z1: number, n: number) => {
      for (let k = 0; k < n; k++) g.beam([x0, y + 0.18 + k * 0.32, z0], [x1, y + 0.18 + k * 0.32, z1], 0.15, k % 2 ? PAL.bark : PAL.barkDark, { kind: K.Bark });
    };
    // Four walls, two fallen in.
    logs(105, 8, 112, 8, 5);
    logs(105, 8, 105, 13, 4);
    logs(112, 8, 112, 11, 2);
    logs(105, 13, 107, 13, 1);
    b.collide({ kind: 'b', x0: 104.8, z0: 7.8, x1: 112.2, z1: 8.2, y0: 0, y1: 5 });
    b.collide({ kind: 'b', x0: 104.8, z0: 8, x1: 105.2, z1: 13.2, y0: 0, y1: 5 });
    for (const [x, z] of [[105, 8], [112, 8], [105, 13]] as Pt[]) g.cyl(x, y - 0.1, z, 0.22, 0.2, 2.2, 6, PAL.barkDark, { kind: K.Bark });
    // Antlers over the door, bones, and a cold fire pit.
    g.box(108.5, y + 1.7, 8.2, 0.4, 0.2, 0.1, '#d8d0b8');
    for (const s of [-1, 1]) g.beam([108.5 + s * 0.15, y + 1.8, 8.25], [108.5 + s * 0.6, y + 2.3, 8.3], 0.035, '#d8d0b8');
    for (let k = 0; k < 6; k++) g.box(106.5 + r() * 4, y + 0.02, 10 + r() * 2.5, 0.35, 0.05, 0.06, '#d8d0b8');
    b.campfire(109.2, 14.8, false);
    b.crate(106, 12.2);
    b.barrel(106.8, 12.4);
  }

  // ---------- the Hollow ----------
  const hollow = buildHollow(b, grid);
  void hollow;

  // ---------- the Overlook: an old watch post above the fields ----------
  {
    // Parapet along the stair's open side, stepping up with it, and along the landing.
    for (let x = 8.2; x < 19.8; x += 0.7) {
      const top = grid.groundAt(Math.min(x, 15.9), 58);
      const g = b.g(x, 59);
      g.box(x, top - 0.1, 58.85, 0.66, 0.6, 0.3, PAL.stoneDark, { kind: K.Brick, shade: 0.85 + r() * 0.3 });
      b.collide({ kind: 'b', x0: x - 0.35, z0: 58.7, x1: x + 0.35, z1: 59.05, y0: top - 1, y1: top + 0.55 });
    }
    // A ruined arch over the top of the stair.
    const ay = 4, g = b.g(17, 58);
    for (const z of [57.05, 58.95]) {
      g.box(17.2, ay, z, 0.5, z < 58 ? 2.8 : 1.9, 0.4, PAL.stone, { kind: K.Brick });
      b.collide({ kind: 'b', x0: 16.95, z0: z - 0.2, x1: 17.45, z1: z + 0.2, y0: ay - 1, y1: ay + 3 });
    }
    g.box(17.2, ay + 2.8, 57.4, 0.55, 0.35, 0.9, PAL.stone, { kind: K.Brick });
    g.blob(18.2, ay + 0.1, 59.6, 0.35, 0.2, 0.3, PAL.stone, 91, { kind: K.Brick, flatBottom: true });
    b.standingTorch(15.6, 56.4);
    // The broken watchtower and its walls.
    const tx = 11.5, tz = 48.5, ty = 4;
    const tg = b.g(tx, tz);
    tg.cyl(tx, ty - 0.2, tz, 1.9, 1.8, 1.4, 10, PAL.stone, { kind: K.Brick, top: PAL.stoneDark, cap: false });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      tg.box(tx + Math.cos(a) * 1.6, ty + 1.2, tz + Math.sin(a) * 1.6, 0.7, 0.3 + r() * 1.4, 0.7, PAL.stone, { kind: K.Brick });
    }
    tg.box(tx, ty - 0.05, tz, 3, 0.05, 3, PAL.stoneDark, { kind: K.Flag });
    b.collide({ kind: 'c', x: tx, z: tz, r: 1.95, y0: ty - 1, y1: ty + 3 });
    for (const [x0, z0, x1, z1, h] of [[14, 45, 19, 45, 0.9], [14, 45, 14, 47.5, 1.3], [6, 52, 9.5, 52, 0.7]] as [number, number, number, number, number][]) {
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, sx = Math.max(0.5, x1 - x0), sz = Math.max(0.5, z1 - z0);
      tg.box(mx, ty, mz, sx, h, sz, PAL.stoneDark, { kind: K.Brick });
      b.collide({ kind: 'b', x0: mx - sx / 2, z0: mz - sz / 2, x1: mx + sx / 2, z1: mz + sz / 2, y0: ty - 1, y1: ty + h });
    }
    // The goblin sentries' camp.
    b.campfire(15.8, 50.2);
    for (const [x, z, rot] of [[14.2, 52, 0.3], [17.6, 51.8, -0.4]] as [number, number, number][]) {
      tg.push().translate(x, ty + 0.02, z).rotateY(rot);
      tg.box(0, 0, 0, 0.7, 0.08, 1.5, '#5a4a30', { kind: K.Cloth });
      tg.pop();
    }
    b.crate(19.5, 48.5);
    b.barrel(20.2, 49.2);
    b.standingTorch(13.8, 46);
    // A lookout at the edge: bench facing the fields.
    b.bench(26.2, 52.3, 0);
    b.crate(31, 46.4);
  }

  // ---------- the Sallow Marsh: a drowned shrine and a mud islet ----------
  for (const [x, z, h] of [[36, 114, 1.8], [39, 113.4, 1.1], [37.2, 117.2, 2.3], [40.2, 116.8, 0.8]] as [number, number, number][]) {
    const g = b.g(x, z), y = grid.groundAt(x, z);
    g.cyl(x, y - 0.5, z, 0.32, 0.28, h + 0.5, 7, PAL.stoneDark, { kind: K.Brick });
    b.collide({ kind: 'c', x, z, r: 0.35, y0: y - 1, y1: y + h });
  }
  {
    const x = 38.4, z = 115.4, y = grid.groundAt(x, z), g = b.g(x, z);
    g.blob(x, y - 0.1, z, 0.55, 0.45, 0.5, PAL.stone, 42, { kind: K.Rock, flatBottom: true });
    b.gl(x, z).box(x + 0.2, y + 0.15, z + 0.46, 0.08, 0.05, 0.02, GLOW.rune, {});
  }
  p.rect(45, 112, 49, 115, { h: 0, t: T.Mud });
  p.clearWater(45, 112, 49, 115);
  b.deadTree(48.2, 112.4, 0.8);

  // ---------- raiders on the southern fields ----------
  b.cart(80.5, 115.2, 0.6);
  b.campfire(77.6, 116.8);
  b.standingTorch(84.5, 114);
  b.hay(82.8, 117.8, 1.4);

  // ---------- outer bailey ----------
  buildWinchHut(b, grid, 56.5, 7.5);
  b.brazier(59, 20);
  b.brazier(53, 29);
  b.standingTorch(53.5, 21.2);
  b.standingTorch(53.5, 27.8);
  // Ruined tower plugging the moat's south end.
  {
    const x = 49, z = 48.5, y = 4, g = b.g(x, z);
    g.cyl(x, y - 3, z, 2.6, 2.4, 5.2, 10, PAL.stone, { kind: K.Brick, top: PAL.stoneDark });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const hh = 0.4 + r() * 1.8;
      g.box(x + Math.cos(a) * 2.2, y + 2.2, z + Math.sin(a) * 2.2, 0.8, hh, 0.8, PAL.stone, { kind: K.Brick });
    }
    for (let i = 0; i < 6; i++) b.rock(x + (r() - 0.5) * 6, z - 3.5 + r() * 1.5, 0.5, false);
    grid.addCollider({ kind: 'c', x, z, r: 2.6, y0: -5, y1: 12 });
    grid.addCollider({ kind: 'b', x0: 46, z0: 45, x1: 52, z1: 52, y0: -5, y1: 12 });
  }

  // ---------- the keep ----------
  const hall = buildKeep(b, grid, r);

  // ---------- data ----------
  const enemies: EnemySpawn[] = [
    // Barrow Fields
    { type: 'goblin', x: 46, z: 74 },
    { type: 'goblin', x: 38, z: 88 },
    { type: 'bat', x: 33, z: 77 },
    { type: 'bat', x: 38, z: 72 },
    { type: 'shaman', x: 22, z: 96 },
    { type: 'goblin', x: 24, z: 99 },
    // Road into the woods
    { type: 'goblin', x: 88, z: 38 },
    { type: 'archer', x: 91, z: 36 },
    // Goblin camp
    { type: 'brute', x: 93, z: 23, group: 'camp' },
    { type: 'goblin', x: 98, z: 26, group: 'camp' },
    { type: 'shield', x: 92, z: 29, group: 'camp', elite: true },
    { type: 'archer', x: 100, z: 20, group: 'camp' },
    { type: 'archer', x: 90, z: 32.5, group: 'camp' },
    { type: 'boar', x: 97, z: 31, group: 'camp' },
    // Woods west trail
    { type: 'goblin', x: 78, z: 20 },
    { type: 'bat', x: 74, z: 16 },
    // Outer bailey
    { type: 'shield', x: 56, z: 22 },
    { type: 'archer', x: 57.5, z: 30, guard: true },
    { type: 'archer', x: 58.5, z: 36, guard: true },
    { type: 'brute', x: 58, z: 12 },
    // The Overlook's sentries
    { type: 'goblin', x: 16.5, z: 48.5 },
    { type: 'bomber', x: 32, z: 45.5 },
    // The gorge lookout
    { type: 'archer', x: 120.4, z: 28.2, guard: true },
    { type: 'archer', x: 120.4, z: 32.8, guard: true },
    { type: 'brute', x: 117, z: 30.5 },
    // The old lodge and its beast
    { type: 'boar', x: 108.5, z: 11.5, group: 'lodge', elite: true },
    { type: 'shaman', x: 104.5, z: 15 },
    { type: 'archer', x: 111.5, z: 14 },
    // Bog goblins in the Sallow Marsh
    { type: 'darter', x: 33, z: 111 },
    { type: 'shield', x: 43, z: 116 },
    { type: 'bat', x: 38, z: 117 },
    { type: 'bat', x: 51, z: 110 },
    // Raiders on the southern fields
    { type: 'goblin', x: 78.5, z: 114, group: 'farm' },
    { type: 'bomber', x: 83.5, z: 117.5, group: 'farm' },
    { type: 'archer', x: 87, z: 115.5, group: 'farm' },
    { type: 'bomber', x: 93, z: 114.5, group: 'farm' },
    // A goblin fishing camp on the Mirrow's bank
    { type: 'goblin', x: 121, z: 97.5 },
    { type: 'bomber', x: 121.6, z: 101 },
    // Patrols in the western fields
    { type: 'goblin', x: 13, z: 73 },
    { type: 'goblin', x: 15, z: 66 },
    { type: 'bat', x: 17, z: 88 },
    // Courtyard garrison: the hall stays barred until they fall.
    { type: 'goblin', x: 40, z: 22, group: 'courtyard' },
    { type: 'brute', x: 38, z: 30, group: 'courtyard' },
    { type: 'shield', x: 36, z: 25, group: 'courtyard' },
    { type: 'shield', x: 30, z: 33, group: 'courtyard' },
    { type: 'archer', x: 42, z: 14, group: 'courtyard' },
    { type: 'archer', x: 22, z: 35, group: 'courtyard' },
    { type: 'boar', x: 28, z: 30, group: 'courtyard', elite: true },
    // The tyrant.
    { type: 'king', x: 19.5, z: 18.5, group: 'boss' },
    // ---- added in the balance update (appended: a foe's index is its save id) ----
    { type: 'goblin', x: 25.5, z: 95.5 },
    { type: 'shaman', x: 97, z: 21.5, group: 'camp' },
    { type: 'bomber', x: 101.5, z: 27.5, group: 'camp' },
    { type: 'bomber', x: 55.5, z: 33 },
    { type: 'darter', x: 41, z: 112.5 },
    { type: 'shaman', x: 26, z: 36.5, group: 'courtyard' },
    { type: 'bomber', x: 44, z: 35, group: 'courtyard', off: true },
    { type: 'darter', x: 47, z: 113.5, guard: true },
  ];

  const npcs: NpcDef[] = [
    {
      id: 'warden', look: 'guard', name: 'Old Warden', x: 93.4, z: 96.2, face: -1,
      lines: [
        'A knight? On this road, at this hour? Then the moon has not given up on us.',
        'Keepsfoot lies over the bridge. The Goblin King holds the keep above it.',
        'That warhorse followed you over the bridge before it burned. It will carry you, if you let it.',
        'And if you have a sword to spare: goblins are burning the fields south of my house. Drive them off and I will make it worth your while.',
        'They say the old royal hunting lodge in Blackpine has something living in it now. Something big.',
      ],
    },
    {
      id: 'elder', look: 'old', name: 'Elder Maren', x: 79.9, z: 66.4, face: 1,
      lines: [
        'The Goblin King took the keep in a single night.',
        'The drawbridge is up, and the winch sits across the moat on the bailey. You will have to go round, through Blackpine Wood.',
        'Take the north road past the tavern.',
      ],
    },
    {
      id: 'wife', look: 'woman', name: 'Hesta', x: 74.5, z: 58.5, face: 1,
      lines: ['Mind the archers on the towers, sir knight.', 'They loose their arrows slow. Keep moving, or raise your shield and they break on it.'],
    },
    {
      id: 'sister', look: 'girl', name: 'Pip', x: 70.8, z: 69.5, face: 1,
      lines: ['My brother is still out there. Please find him!', 'He went after the goblins with a pitchfork. Into Blackpine Wood.'],
      after: ['You found him! You really found him!', 'I knew a knight would come.'],
    },
    {
      id: 'keeper', look: 'keeper', name: 'Brannoc the Innkeeper', x: 79.4, z: 51.1, face: -1,
      lines: ['Come in from the dark, friend. The hearth keeps it out.', 'I can refill a Moon Flask, or sell you another one. Coin is coin, goblins or no.'],
      shop: 'flask',
    },
    {
      id: 'smith', look: 'smith', name: 'Garrow the Smith', x: 87.5, z: 68.3, face: 1,
      lines: ['That blade has seen better nights.', 'Bring me coin and I will put an edge on it that goblin hide will remember.'],
      shop: 'sword',
    },
    {
      id: 'brother', look: 'captive', name: 'Tam', x: 101, z: 26, face: -1, hidden: true,
      lines: ['You came for me? Pip sent you, didn\'t she.', 'Here. I took this off a goblin before they caught me. It is yours.', 'I will run home. Go and knock that crown off his head!'],
    },
    {
      id: 'tamhome', look: 'captive', name: 'Tam', x: 71.8, z: 70.4, face: 1, hidden: true,
      lines: ['I owe you my life, sir knight. Pip will not stop talking about you.'],
    },
  ];

  const objects: ObjDef[] = [
    { kind: 'moonfire', id: 'wayshrine', name: 'Wayshrine', x: 105.5, z: 99.5 },
    { kind: 'moonfire', id: 'hearth', name: 'Tavern Hearth', x: 73.2, z: 53.3 },
    { kind: 'moonfire', id: 'rest', name: "Knight's Rest", x: 70, z: 20 },
    { kind: 'moonfire', id: 'gate', name: 'Gate of the Keep', x: 41.5, z: 28.5 },
    { kind: 'lore', id: 'lore1', x: 45.5, z: 79.5, text: 'The keep was built by the first knights, when the moon was young.' },
    { kind: 'lore', id: 'lore2', x: 24.2, z: 51.4, text: 'Every king before this one kept the gates open to travelers.' },
    { kind: 'lore', id: 'lore3', x: 103, z: 95.5, text: 'Eight realms, eight crowns, one moon over all of them. So it was sung, before the shadow.' },
    { kind: 'chest', id: 'c_crypt', x: 34, z: 74.2, rot: 0, coins: 60 },
    { kind: 'chest', id: 'c_camp', x: 104.5, z: 33.5, rot: -1.2, coins: 80 },
    { kind: 'chest', id: 'c_court', x: 17.5, z: 37, rot: 0, coins: 100 },
    { kind: 'chest', id: 'c_ledge', x: 9.2, z: 49.6, rot: 0.9, coins: 70 },
    { kind: 'chest', id: 'c_mill', x: 49.5, z: 100, rot: 0.3, coins: 40 },
    { kind: 'chest', id: 'c_pier', x: 3.4, z: 99.5, rot: -Math.PI / 2, coins: 55 },
    { kind: 'chest', id: 'c_cave', x: 33.2, z: 55.1, rot: 0, coins: 45, power: 'giant' },
    { kind: 'chest', id: 'c_marsh', x: 46.8, z: 113.4, rot: 0.8, coins: 50, power: 'bubble' },
    { kind: 'chest', id: 'c_farm', x: 81.8, z: 116.9, rot: -0.5, coins: 60 },
    { kind: 'chest', id: 'c_lodge', x: 110.6, z: 9.4, rot: 0, coins: 90, power: 'fire' },
    { kind: 'chest', id: 'c_river', x: 122.2, z: 103.5, rot: -Math.PI / 2, coins: 70 },
    { kind: 'shard', id: 's_lake', x: -5.2, z: 100.3 },
    { kind: 'shard', id: 's_cave', x: 31.2, z: 55.2 },
    { kind: 'shard', id: 's_gorge', x: 124.3, z: 30.5 },
    { kind: 'cracked', id: 'w_cave', x: 33, z: 59.7, alongX: true },
    { kind: 'lore', id: 'lore4', x: 106.8, z: 85.6, text: 'Seven stones for seven kings who kept the road. The eighth stone was never raised.' },
    { kind: 'lever', id: 'winch', x: 56.5, z: 10.2 },
    { kind: 'drawbridge', x0: 47, z0: 23, x1: 51, z1: 26, deck: 4 },
    { kind: 'cage', id: 'cage', x: 101, z: 26 },
    { kind: 'hallDoor', x: 34, z: 18.5, y: 4 },
    { kind: 'arenaGate', x: 34, z: 18.5, y: 4 },
    { kind: 'windmill', x: 40.5, z: 95 },
    { kind: 'sign', x: 101.5, z: 104.5, text: 'North-west: Keepsfoot. Beyond it, the Moonlit Keep.' },
    { kind: 'sign', x: 119.8, z: 122, text: 'The Mirrow bridge. The goblins burned it behind you, the night the keep fell. There is no way back but through.' },
  ];
  // Breakable pots and crates for coins.
  const pots: [number, number, 'pot' | 'crate' | 'barrel'][] = [
    [83, 56.3, 'pot'], [72.3, 64, 'pot'], [91.8, 64.3, 'barrel'], [66, 63, 'pot'],
    [97, 25, 'pot'], [96.2, 24.2, 'crate'], [89.3, 27.8, 'pot'], [100.8, 29.5, 'barrel'],
    [32, 71.8, 'pot'], [36.2, 71.8, 'pot'], [58, 9.8, 'crate'], [59.5, 34, 'barrel'],
    [44, 12, 'crate'], [44, 13.2, 'crate'], [18, 31.5, 'barrel'], [19, 31, 'pot'], [43.8, 37, 'pot'],
    [78.8, 51.2, 'barrel'], [80.6, 51.1, 'barrel'], [49, 97.5, 'pot'],
  ];
  for (const [x, z, what] of pots) objects.push({ kind: 'breakable', x, z, what });

  const regions: RegionDef[] = [
    { name: "The Warden's Homestead", music: 'road', amb: 'road', test: (x, z) => Math.abs(x - HOME.x) < 7.5 && z > HOME.z - 6 && z < HOME.z + 13 },
    { name: 'The Crescent & Crown', music: 'tavern', amb: 'indoor', test: (x, z) => x > 72 && x < 82 && z > 50 && z < 57 },
    { name: 'Hall of the Moon Throne', music: 'hall', amb: 'indoor', test: (x, z) => x > 16 && x < 34 && z > 10 && z < 27 },
    { name: 'The Hollow', music: 'hall', amb: 'indoor', test: (x, z, y) => x > 30 && x < 36.2 && z > 54 && z < 59.4 && y < 1 },
    { name: 'The Old Lodge', music: 'wilds', amb: 'woods', test: (x, z) => (x - LODGE.x) ** 2 + (z - LODGE.z) ** 2 < 81 },
    { name: 'The Gorge Lookout', music: 'wilds', amb: 'woods', test: (x, z) => x > 115 && z > 24 && z < 37 },
    { name: 'Riverside', music: 'road', amb: 'road', test: (x, z) => x > 119.5 && z > 58 },
    { name: 'The Raided Farm', music: 'road', amb: 'fields', test: (x, z) => x > 68 && x < 102 && z > 109 },
    { name: 'The Moonlit Keep', music: 'keep', amb: 'keep', test: (x, z) => x > 13 && x < 47 && z > 7 && z < 41 },
    { name: 'The Outer Bailey', music: 'keep', amb: 'keep', test: (x, z, y) => x > 50 && x < 63 && z < 47 && y > 3.5 },
    { name: "Gnasher's Camp", music: 'wilds', amb: 'woods', test: (x, z) => (x - CAMP.x) ** 2 + (z - CAMP.z) ** 2 < 11 * 11 },
    { name: 'Blackpine Wood', music: 'wilds', amb: 'woods', test: (x, z, y) => insidePoly(WOODS, x, z) && y > 1.5 },
    { name: 'The Overlook', music: 'keep', amb: 'keep', test: (x, z, y) => y > 3.5 && z > 40 && x < 47 },
    { name: 'Keepsfoot', music: 'village', amb: 'village', test: (x, z, y) => insidePoly(VILLAGE, x, z) && y > 0.5 },
    { name: 'Mirrormere', music: 'fields', amb: 'fields', test: (x, z) => x < 14 && z > 80 },
    { name: 'The Sallow Marsh', music: 'fields', amb: 'fields', test: (x, z) => z > 104 && x < 62 },
    { name: 'The Seven Stones', music: 'road', amb: 'road', test: (x, z) => (x - 111.5) ** 2 + (z - 88) ** 2 < 36 },
    { name: 'The Barrow Fields', music: 'fields', amb: 'fields', test: (x, z) => x < 66 && z > 55 },
    { name: "The King's Road", music: 'road', amb: 'road', test: () => true },
  ];

  const waterPoints: [number, number][] = [];
  for (let z = 0; z < MAP_D; z += 2) for (let x = 0; x < MAP_W; x += 2) if (grid.water[grid.i(x, z)] !== NONE) waterPoints.push([x + 0.5, z + 0.5]);

  const grassDensity = (x: number, z: number) => {
    const y = grid.groundAt(x, z);
    if (x > 13 && x < 47 && z > 7 && z < 41 && y > 3) return 0;
    if (insidePoly(WOODS, x, z)) return 1.4 + fbm(x * 0.2, z * 0.2, 2, 3) * 2;
    if (x < 66 && z > 55) return 3 + fbm(x * 0.15, z * 0.15, 2, 4) * 4;
    if (insidePoly(VILLAGE, x, z)) return 1.8;
    return 2.5 + fbm(x * 0.15, z * 0.15, 2, 4) * 3;
  };
  const grassScale = (x: number, z: number) => {
    if (x < 66 && z > 55) return 1.1 + fbm(x * 0.1, z * 0.1, 2, 9) * 0.8;
    if (insidePoly(VILLAGE, x, z)) return 0.7;
    return 0.9;
  };

  return {
    grid,
    builder,
    start: { x: 105.5, z: 105 },
    horse: { x: 103.2, z: 107.2 },
    trial: { x: 111.5, z: 88 },
    critters: [
      ...[0, 1, 2, 3].map((k): CritterDef => ({ kind: 'chicken', x: HOME.x - 2 + k * 0.8, z: HOME.z - 3.4 + (k % 2), area: [HOME.x - 4.5, HOME.z - 4.3, HOME.x + 4.3, HOME.z - 2.2] })),
      ...[0, 1].map((k): CritterDef => ({ kind: 'chicken', x: HOME.x + 1 + k, z: HOME.z + 3.4, area: [HOME.x - 0.5, HOME.z + 2.5, HOME.x + 4.3, HOME.z + 4] })),
      ...([[84, 104], [80, 98], [104, 94], [30, 90], [20, 78], [44, 104], [112, 92]] as Pt[]).map(([x, z]): CritterDef => ({ kind: 'rabbit', x, z, area: [x - 5, z - 5, x + 5, z + 5] })),
    ],
    afterOutskirts: (g: Grid, bb: Builder) => {
      // The island in Mirrormere, reached by the hidden shallows.
      for (let z = 96; z < 105; z++)
        for (let x = -9; x < 0; x++) {
          const i = g.i(x, z);
          const d = Math.hypot(x + 0.5 + 5, z + 0.5 - 100.3);
          if (d < 2.7) {
            g.h[i] = 0.25;
            g.t[i] = d < 1.6 ? T.Grass : T.Sand;
            g.water[i] = NONE;
            g.noGrass[i] = 0;
          } else if (z >= 99 && z <= 100 && x >= -3 && g.water[i] !== NONE) g.h[i] = Math.max(g.h[i], -0.62);
        }
      bb.deadTree(-6.2, 99, 0.9);
      bb.rock(-3.8, 101.6, 0.5);
      bb.reeds(-2.8, 98.4, 6);
      bb.moonflowers(-5, 100.8, 6, 1);
      // The gorge lookout: a platform out over the drop.
      const rim = g.groundAt(119.5, 30.5);
      for (let z = 29; z <= 31; z++) for (let x = 120; x <= 124; x++) g.deck[g.i(x, z)] = rim;
      const gg = bb.g(122, 30.5);
      for (let x = 119.8; x < 125.2; x += 0.42) gg.box(x + 0.2, rim - 0.12, 30.5, 0.38, 0.12, 3, PAL.wood, { kind: K.Wood, shade: 0.8 + r() * 0.3 });
      for (const x of [121, 123, 124.9]) for (const z of [29.1, 31.9]) gg.box(x, rim - 14, z, 0.2, 14, 0.2, PAL.woodDark, { kind: K.Wood });
      for (const z of [28.95, 32.05]) {
        gg.beam([120, rim + 0.9, z], [125.1, rim + 0.9, z], 0.05, PAL.woodDark, { kind: K.Wood });
        bb.collide({ kind: 'b', x0: 120, z0: z - 0.1, x1: 125.2, z1: z + 0.1, y0: rim - 1, y1: rim + 1.2 });
      }
      gg.beam([125.1, rim + 0.9, 29], [125.1, rim + 0.9, 32], 0.05, PAL.woodDark, { kind: K.Wood });
      bb.collide({ kind: 'b', x0: 125, z0: 29, x1: 125.3, z1: 32, y0: rim - 1, y1: rim + 1.2 });
      bb.standingTorch(119.2, 28.4);
      // A goblin fishing camp on the Mirrow's bank, at the end of the lane from the stones.
      new Painter(g).path(LANE_RIVER, 1.7, T.Path, 0.4, 22, false);
      bb.tent(121.4, 100.4, Math.PI / 2, '#5a4a2a');
      bb.campfire(120.4, 97.6);
      bb.barrel(122.3, 98.6);
      const fx = bb.g(121.8, 95.5), fy = g.groundAt(121.8, 95.5);
      fx.box(121.8, fy, 95.5, 0.08, 1.4, 0.08, PAL.woodDark);
      fx.beam([121.8, fy + 1.3, 95.5], [123.6, fy + 0.4, 95.2], 0.025, PAL.woodDark);
    },
    enemies,
    npcs,
    objects,
    regions,
    tavern,
    hall,
    waterPoints,
    grassDensity,
    grassScale,
    fireflyZones: [
      { x: 40, z: 90, r: 18 },
      { x: 70, z: 100, r: 12 },
      { x: 100, z: 96, r: 12 },
      { x: 34, z: 76, r: 8 },
      { x: 80, z: 30, r: 14 },
    ],
  };
}

function forest(b: Builder, r: Rng, x0: number, z0: number, x1: number, z1: number, density: number, ok: (x: number, z: number) => boolean, kind: 'pine' | 'mixed') {
  for (let z = z0; z < z1; z += 1.7)
    for (let x = x0; x < x1; x += 1.7) {
      if (r() > density * 1.9) continue;
      const tx = x + r() * 1.5, tz = z + r() * 1.5;
      if (!ok(tx, tz)) continue;
      const k = r();
      if (kind === 'pine' || k < 0.55) b.pine(tx, tz, 0.9 + r() * 0.6);
      else if (k < 0.8) b.oak(tx, tz, 0.9 + r() * 0.4);
      else b.bush(tx, tz, 0.9);
    }
}

// ---------------------------------------------------------------------------

function buildTavern(b: Builder, grid: Grid): Structure {
  const x0 = 72, z0 = 50, x1 = 82, z1 = 57, y = 1, H = 3.2;
  const box = new THREE.Box3(new THREE.Vector3(x0 - 0.6, y, z0 - 0.6), new THREE.Vector3(x1 + 0.6, y + H + 4, z1 + 0.6));
  const s = b.structure('tavern', box, [x0, z0, x1, z1], y);
  const t = 0.3;
  const core = s.core, shell = s.shell;
  // Foundation.
  core.box((x0 + x1) / 2, y - 0.6, (z0 + z1) / 2, x1 - x0 + 0.2, 0.62, z1 - z0 + 0.2, PAL.stoneDark, { kind: K.Brick, skip: { py: true } });
  // Back walls (north, west) stay; front walls (south, east) and roof fade when inside.
  core.box((x0 + x1) / 2, y, z0 + t / 2, x1 - x0, H, t, PAL.plaster, { kind: K.Plaster });
  core.box(x0 + t / 2, y, (z0 + z1) / 2, t, H, z1 - z0, PAL.plaster, { kind: K.Plaster });
  const doorX0 = 76.3, doorX1 = 77.7;
  shell.box((x0 + doorX0) / 2, y, z1 - t / 2, doorX0 - x0, H, t, PAL.plaster, { kind: K.Plaster });
  shell.box((doorX1 + x1) / 2, y, z1 - t / 2, x1 - doorX1, H, t, PAL.plaster, { kind: K.Plaster });
  shell.box((doorX0 + doorX1) / 2, y + 2.1, z1 - t / 2, doorX1 - doorX0, H - 2.1, t, PAL.plaster, { kind: K.Plaster });
  shell.box(x1 - t / 2, y, (z0 + z1) / 2, t, H, z1 - z0, PAL.plaster, { kind: K.Plaster });
  // Timber framing on all walls.
  const T0 = PAL.timber;
  for (const [g, px, pz, sx, sz] of [
    [core, (x0 + x1) / 2, z0 - 0.02, x1 - x0, 0.12],
    [core, x0 - 0.02, (z0 + z1) / 2, 0.12, z1 - z0],
    [shell, (x0 + x1) / 2, z1 + 0.02, x1 - x0, 0.12],
    [shell, x1 + 0.02, (z0 + z1) / 2, 0.12, z1 - z0],
  ] as [typeof core, number, number, number, number][]) {
    g.box(px, y + H - 0.12, pz, sx, 0.14, sz, T0, { kind: K.Wood });
    g.box(px, y + 1.4, pz, sx, 0.1, sz, T0, { kind: K.Wood });
  }
  for (const [px, pz] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) (px === x1 || pz === z1 ? shell : core).box(px, y, pz, 0.24, H, 0.24, T0, { kind: K.Wood });
  // Roof (ridge along x) with a dormer chimney.
  shell.push().translate((x0 + x1) / 2, y + H, (z0 + z1) / 2);
  shell.gable(0, 0, 0, x1 - x0 + 0.8, z1 - z0 + 1.2, 3.2, PAL.slate2, PAL.plaster, { kind: K.Slate });
  shell.box(0, 3.1, 0, x1 - x0 + 0.9, 0.14, 0.16, T0, { kind: K.Wood });
  shell.pop();
  core.box(x0 + 0.9, y, 53.5, 1.4, H + 3.6, 1.6, PAL.stoneDark, { kind: K.Brick });
  b.fx.addEmitter({ x: x0 + 0.9, y: y + H + 3.8, z: 53.5, rate: 1.5, spec: { color: [0.09, 0.09, 0.12], color2: [0.05, 0.05, 0.07], size: 3, size2: 8, life: 5, gravity: -0.35, drag: 0.4, wobble: 0.35, alpha: 0.35, fadeIn: 0.2 }, spread: 0.3, vy: 0.5 });
  // Hanging sign.
  shell.box(78.6, y + 2.3, z1 + 0.5, 0.06, 0.06, 0.9, PAL.iron);
  shell.box(78.6, y + 1.7, z1 + 0.85, 0.08, 0.55, 0.7, PAL.woodLight, { kind: K.Wood });
  s.shellGlow.box(78.64, y + 1.72, z1 + 0.85, 0.02, 0.16, 0.18, [2.6, 2.2, 0.8], {});
  // Windows: back walls in core glow, front walls in shell glow.
  for (const wx of [73.5, 75, 79.5, 81]) s.shellGlow.box(wx, y + 1.1, z1 + 0.02, 0.55, 0.6, 0.06, GLOW.window, {});
  for (const wz of [51.8, 55.2]) s.shellGlow.box(x1 + 0.02, y + 1.1, wz, 0.06, 0.6, 0.55, GLOW.window, {});
  for (const wx of [75, 79]) s.glow.box(wx, y + 1.1, z0 - 0.02, 0.55, 0.6, 0.06, GLOW.windowDim, {});
  b.lights.add(77, y + 1.2, z1 + 1.2, 0xffa050, 4, 5, 0.06);
  b.lights.add(x1 + 1.2, y + 1.2, 53.5, 0xffa050, 4, 5, 0.06);
  // Interior: bar counter, tables, benches, barrels, hearth.
  const g = core;
  g.box(79.5, y, 52.2, 3.2, 1.05, 0.6, PAL.wood, { kind: K.Wood, top: PAL.woodLight });
  g.box(81.3, y, 51.2, 0.9, 1.8, 1.8, PAL.woodDark, { kind: K.Wood });
  for (const bx of [80.3, 80.9]) b.barrel(bx, 50.8, g);
  g.box(79.5, y + 1.6, 50.35, 3.2, 0.08, 0.4, PAL.woodDark, { kind: K.Wood });
  for (let i = 0; i < 6; i++) g.cyl(78.2 + i * 0.5, y + 1.68, 50.35, 0.07, 0.06, 0.2, 5, i % 2 ? '#5a7a4a' : '#8a5a3a');
  grid.addCollider({ kind: 'b', x0: 77.9, z0: 51.9, x1: 81.1, z1: 52.5, y0: 0, y1: 2.2 });
  grid.addCollider({ kind: 'b', x0: 80.8, z0: 50.2, x1: 82, z1: 52.1, y0: 0, y1: 3 });
  for (const [tx, tz] of [[76, 55], [79.8, 55], [76.6, 52.6]]) {
    b.table(tx, tz, g, y);
    b.bench(tx, tz - 0.8, 0, g, y);
    b.bench(tx, tz + 0.8, 0, g, y);
    s.glow.box(tx + 0.1, y + 0.8, tz, 0.06, 0.12, 0.06, GLOW.flame, { kind: 1 });
    b.lights.add(tx + 0.1, y + 1.3, tz, 0xffa050, 2.2, 3.5, 0.2);
  }
  // Hearth on the west wall.
  g.box(x0 + 0.55, y, 53.5, 0.8, 1.6, 2.0, PAL.stoneDark, { kind: K.Brick });
  g.box(x0 + 0.95, y, 53.5, 0.3, 1.0, 1.1, '#0a0808');
  s.glow.box(x0 + 1.0, y + 0.05, 53.5, 0.3, 0.3, 0.9, GLOW.flame, { kind: 1 });
  b.fx.addEmitter({ x: x0 + 1.05, y: y + 0.3, z: 53.5, rate: 18, spec: { color: [4.5, 2.2, 0.6], color2: [1.4, 0.25, 0.05], size: 2, size2: 1, life: 0.45, gravity: -2.2, drag: 2, fadeIn: 0.05 }, spread: 0.5, vy: 0.6 });
  b.lights.add(x0 + 1.6, y + 1.0, 53.5, 0xff8a38, 12, 7, 0.3);
  grid.addCollider({ kind: 'b', x0: x0, z0: 52.4, x1: x0 + 1.0, z1: 54.6, y0: 0, y1: 3 });
  // Rug and a few crates.
  g.box(77.5, y + 0.005, 54, 2.6, 0.02, 1.6, '#6a2a30', { kind: K.Cloth });
  // Wall colliders (door gap on the south wall).
  grid.addCollider({ kind: 'b', x0: x0 - 0.1, z0: z0 - 0.1, x1: x1 + 0.1, z1: z0 + t, y0: 0, y1: 8 });
  grid.addCollider({ kind: 'b', x0: x0 - 0.1, z0: z0, x1: x0 + t, z1: z1, y0: 0, y1: 8 });
  grid.addCollider({ kind: 'b', x0: x1 - t, z0: z0, x1: x1 + 0.1, z1: z1, y0: 0, y1: 8 });
  grid.addCollider({ kind: 'b', x0: x0, z0: z1 - t, x1: doorX0, z1: z1 + 0.1, y0: 0, y1: 8 });
  grid.addCollider({ kind: 'b', x0: doorX1, z0: z1 - t, x1: x1, z1: z1 + 0.1, y0: 0, y1: 8 });
  // Doorstep.
  b.g(77, 57.6).box(77, y - 0.05, 57.5, 1.6, 0.1, 0.6, PAL.stoneDark, { kind: K.Flag });
  return s;
}

function buildHollow(b: Builder, grid: Grid) {
  void grid;
  // Cave floor x 30..36.2, z 54..59.2. The camera looks from +x/+z, so the
  // spur's south and east faces and its roof are the shell: they fade when
  // you are inside. North and west are the real cliff (terrain).
  const box = new THREE.Box3(new THREE.Vector3(29.5, 0, 53.5), new THREE.Vector3(37.5, 6.5, 60.5));
  const s = b.structure('hollow', box, [30, 54, 36.2, 59.3], 0);
  const r = mulberry32(55);
  const CLIFF = '#5d5966', GRASS = '#4f7a3c';
  const face = (x0: number, z0: number, x1: number, z1: number, h: number) => {
    s.shell.box((x0 + x1) / 2, -0.05, (z0 + z1) / 2, x1 - x0, h + 0.05, z1 - z0, CLIFF, { kind: K.Rock, top: GRASS });
    b.collide({ kind: 'b', x0, z0, x1, z1, y0: -1, y1: 6 });
  };
  // South face with the mouth at x 32..34, and the east face.
  face(30, 59.2, 32, 60, 4);
  face(34, 59.2, 37, 60, 4);
  face(36.2, 54, 37, 59.2, 4);
  // Lintel over the mouth, and a lip of grass hanging over the edge.
  s.shell.box(33, 2.45, 59.6, 2, 1.55, 0.8, CLIFF, { kind: K.Rock, top: GRASS });
  for (const [x0, z0, x1, z1] of [[29.9, 59.95, 37.05, 60.07], [36.95, 53.9, 37.07, 60.07]] as [number, number, number, number][])
    s.shell.box((x0 + x1) / 2, 3.86, (z0 + z1) / 2, x1 - x0, 0.14, z1 - z0, GRASS, { kind: K.Grass });
  // Roof, flush with the plateau.
  s.shell.box(33.5, 3.7, 56.6, 7.2, 0.3, 6.9, CLIFF, { kind: K.Rock, top: GRASS });
  // Fallen rock heaped on top: nothing walks over the cave.
  for (const [x, z, s0] of [[31.2, 55.6, 1.1], [33.4, 55, 1.3], [35.6, 55.8, 1.0], [32, 57.8, 1.2], [34.8, 58.2, 1.1], [33.3, 56.8, 1.4], [30.8, 58.6, 0.8], [36.2, 57.4, 0.8]] as [number, number, number][])
    s.shell.blob(x, 4, z, s0, s0 * 0.65, s0, r() < 0.5 ? PAL.rock : PAL.rockDark, Math.floor(r() * 999), { kind: K.Rock, jitter: 0.3, flatBottom: true });
  for (const [x, z] of [[30.6, 56.6], [35.9, 59.1], [34, 54.4]]) s.shell.blob(x, 4.2, z, 0.5, 0.35, 0.5, '#3e5a34', Math.floor(r() * 999), { kind: K.Leaves, wind: 0.3, flatBottom: true });
  b.collide({ kind: 'b', x0: 29.9, z0: 53.9, x1: 37.1, z1: 60.1, y0: 3.4, y1: 50 });
  // Roots and moss hanging over the mouth.
  for (let k = 0; k < 6; k++) s.shell.box(32.2 + k * 0.32, 2.1 - (k % 3) * 0.25, 60.03, 0.05, 0.5 + (k % 3) * 0.25, 0.03, k % 2 ? '#3e5a34' : PAL.bark, { wind: 0.4 });

  // Inside: crystals, stalagmites, mushrooms, and an adventurer who never left.
  const g = s.core, gl = s.glow;
  const crystal = (x: number, z: number, h: number, lean: number) => {
    gl.push().translate(x, 0, z).rotateZ(lean).rotateX(lean * 0.6);
    gl.cyl(0, 0, 0, 0.12, 0, h, 5, [0.6, 1.6, 3.4], {});
    gl.pop();
  };
  for (const [x, z] of [[30.6, 54.6], [35.6, 54.7], [35.6, 58.4], [30.5, 58.5]] as [number, number][]) {
    for (let k = 0; k < 4; k++) crystal(x + (r() - 0.5) * 0.5, z + (r() - 0.5) * 0.5, 0.4 + r() * 0.6, (r() - 0.5) * 0.7);
    b.lights.add(x, 0.9, z, 0x6aa0ff, 4, 4.5, 0.08);
  }
  for (const [x, z, h] of [[32.2, 54.6, 0.9], [34.5, 54.7, 1.2], [35.7, 56.6, 0.8], [30.5, 56.3, 1.1]] as [number, number, number][]) {
    g.cyl(x, 0, z, 0.26, 0, h, 6, PAL.rockDark, { kind: K.Rock });
    b.collide({ kind: 'c', x, z, r: 0.25, y0: -1, y1: h });
  }
  // Stone teeth hanging from the roof.
  for (const [x, z] of [[31.5, 55.4], [33.8, 57.3], [35, 55.6]] as [number, number][]) g.cyl(x, 3.7, z, 0.18, 0, -0.9, 5, PAL.rockDark, { kind: K.Rock });
  b.mushrooms(35, 57.6, 6);
  for (let k = 0; k < 6; k++) g.box(31.4 + r() * 1.6, 0.03, 56.4 + r() * 1.2, 0.35, 0.05, 0.06, '#d8d0b8');
  g.box(31.8, 0.1, 57.2, 0.2, 0.2, 0.22, '#d8d0b8');
  g.push().translate(32.9, 0.04, 57.6).rotateX(-Math.PI / 2 + 0.1);
  g.box(0, 0, 0, 0.45, 0.55, 0.05, '#5a4a3a', { kind: K.Wood });
  g.pop();
  g.box(30.9, 0.02, 55.6, 0.9, 0.02, 0.6, '#1a2438');
  return s;
}

function buildCrypt(b: Builder, grid: Grid, x: number, z: number) {
  const y = grid.groundAt(x, z), g = b.g(x, z);
  g.box(x, y - 0.2, z, 4.2, 0.4, 3.2, PAL.stoneDark, { kind: K.Flag });
  g.box(x, y + 0.2, z - 0.3, 3.6, 2.2, 2.2, PAL.stone, { kind: K.Brick });
  g.push().translate(x, y + 2.4, z - 0.3);
  g.gable(0, 0, 0, 4.0, 2.8, 1.2, PAL.slate, PAL.stone, { kind: K.Slate });
  g.pop();
  for (const px of [x - 1.3, x + 1.3]) g.cyl(px, y + 0.2, z + 1.1, 0.18, 0.16, 2.2, 6, PAL.stone, { kind: K.Rock });
  g.box(x, y + 2.3, z + 1.1, 3.2, 0.25, 0.4, PAL.stone, { kind: K.Brick });
  g.box(x, y + 0.2, z + 0.82, 1.1, 1.6, 0.05, '#0a0a12');
  b.gl(x, z).box(x, y + 1.9, z + 0.86, 0.3, 0.3, 0.02, GLOW.rune, {});
  b.lights.add(x, y + 1.5, z + 1.6, 0x6aa0ff, 3, 4, 0.1);
  grid.addCollider({ kind: 'b', x0: x - 1.9, z0: z - 1.5, x1: x + 1.9, z1: z + 0.85, y0: -5, y1: 8 });
  for (const px of [x - 1.3, x + 1.3]) grid.addCollider({ kind: 'c', x: px, z: z + 1.1, r: 0.2, y0: -5, y1: 8 });
}

function buildWinchHut(b: Builder, grid: Grid, x: number, z: number) {
  const y = 4, g = b.g(x, z);
  g.box(x, y - 0.1, z, 4, 2.6, 3, PAL.stone, { kind: K.Brick });
  g.push().translate(x, y + 2.5, z);
  g.gable(0, 0, 0, 4.4, 3.4, 1.4, PAL.slate, PAL.stone, { kind: K.Slate });
  g.pop();
  g.box(x, y, z + 1.52, 1.0, 1.7, 0.06, PAL.woodDark, { kind: K.Wood });
  // Chains running from the hut toward the drawbridge.
  g.beam([x - 2, y + 2, z + 0.5], [x - 5.5, y + 1.4, z + 6], 0.04, PAL.iron);
  b.gl(x, z).box(x + 1.2, y + 1.2, z + 1.52, 0.4, 0.4, 0.04, GLOW.windowDim, {});
  b.torch(x - 1.2, y + 1.6, z + 1.7);
  grid.addCollider({ kind: 'b', x0: x - 2, z0: z - 1.5, x1: x + 2, z1: z + 1.5, y0: -5, y1: 10 });
}

function buildKeep(b: Builder, grid: Grid, r: Rng): Structure {
  const base = 4, H = 5;
  // Curtain walls, each its own structure so it can fade when it hides the knight.
  const wall = (name: string, x0: number, z0: number, x1: number, z1: number, outer: number) => {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const bx = new THREE.Box3(
      new THREE.Vector3(Math.min(x0, x1) - (alongX ? 0 : 1), base - 2, Math.min(z0, z1) - (alongX ? 1 : 0)),
      new THREE.Vector3(Math.max(x0, x1) + (alongX ? 0 : 1), base + H + 0.6, Math.max(z0, z1) + (alongX ? 1 : 0)),
    );
    const s = b.structure(name, bx);
    b.wall(s, x0, z0, x1, z1, base, H, 1.6, { slits: true, outerSign: outer });
    return s;
  };
  wall('wallN', 16, 8, 44, 8, -1);
  wall('wallW', 14, 10, 14, 38, -1);
  wall('wallS1', 16, 40, 44, 40, 1);
  wall('wallE1', 46, 10, 46, 21, 1);
  wall('wallE2', 46, 28, 46, 38, 1);
  // Gatehouse arch over the passage.
  {
    const s = b.structure('gatehouse', new THREE.Box3(new THREE.Vector3(44.5, base, 21), new THREE.Vector3(47.5, base + H + 1.5, 28)));
    const g = s.core;
    g.box(46, base + 3.2, 24.5, 1.8, H - 3.2 + 0.4, 5.4, PAL.stone, { kind: K.Brick });
    for (let i = 0; i < 4; i++) g.box(46, base + H + 0.4, 22.6 + i * 1.3, 1.8, 0.5, 0.6, PAL.stone, { kind: K.Brick });
    s.glow.box(46.95, base + 4.2, 24.5, 0.04, 0.5, 0.5, GLOW.sinister, {});
    b.banner(47.0, base + 1.2, 22.4, Math.PI / 2, PAL.cloth, 1.8);
    b.banner(47.0, base + 1.2, 26.6, Math.PI / 2, PAL.cloth, 1.8);
  }
  // Towers.
  const tower = (name: string, x: number, z: number, rad: number, h: number, banner = true) => {
    const s = b.structure(name, new THREE.Box3(new THREE.Vector3(x - rad, base - 2, z - rad), new THREE.Vector3(x + rad, base + h + rad * 2.4, z + rad)));
    b.roundTower(s, x, z, rad, base, h, { banner: banner ? PAL.cloth : undefined, windows: 3 });
    return s;
  };
  tower('towerNE', 46, 8, 2.2, 7.5);
  tower('towerSE', 46, 40, 2.2, 7.5);
  tower('towerSW', 14, 40, 2.2, 7.5);
  tower('gateN', 46, 20.5, 1.8, 6.5);
  tower('gateS', 46, 28.5, 1.8, 6.5);
  // Donjon: the tall tower where the tyrant's light burns, visible from far below.
  {
    const s = b.structure('donjon', new THREE.Box3(new THREE.Vector3(10, base - 2, 4), new THREE.Vector3(19, base + 20, 13)));
    const g = s.core, x = 14.5, z = 8.5;
    g.box(x, base - 3, z, 6, 16 + 3, 6, PAL.stone, { kind: K.Brick, top: PAL.stoneDark });
    for (let i = 0; i < 8; i++) {
      const t = -2.6 + (i % 4) * 1.75, side = i < 4 ? 1 : -1;
      g.box(x + t, base + 16, z + side * 2.8, 0.7, 0.6, 0.4, PAL.stone, { kind: K.Brick });
      g.box(x + side * 2.8, base + 16, z + t, 0.4, 0.6, 0.7, PAL.stone, { kind: K.Brick });
    }
    g.pyramid(x, base + 16.5, z, 5, 5, 4.5, PAL.slate2, { kind: K.Slate });
    g.box(x, base + 20.8, z, 0.08, 1.6, 0.08, PAL.iron);
    g.box(x + 0.45, base + 21.8, z, 0.8, 0.45, 0.03, PAL.cloth, { kind: K.Cloth, wind: 0.9 });
    for (const [wy, wx, wz] of [[9, 3.01, 0], [13, 3.01, 0], [11, 0, 3.01], [14.2, 0, 3.01], [6, 3.01, 1.5]] as [number, number, number][]) {
      s.glow.box(x + wx, base + wy, z + wz, wx ? 0.05 : 0.5, 1.0, wz ? 0.05 : 0.5, GLOW.sinister, {});
      b.lights.add(x + wx * 1.3, base + wy, z + wz * 1.3, 0xffd060, 5, 6, 0.1);
    }
    grid.addCollider({ kind: 'b', x0: x - 3, z0: z - 3, x1: x + 3, z1: z + 3, y0: -5, y1: 30 });
  }

  // Great hall: back walls in core, front walls + roof in shell.
  const x0 = 16, z0 = 10, x1 = 34, z1 = 27, y = base, HH = 6;
  const hall = b.structure('hall', new THREE.Box3(new THREE.Vector3(x0 - 0.5, y, z0 - 0.5), new THREE.Vector3(x1 + 0.5, y + HH + 5, z1 + 0.5)), [x0, z0, x1, z1], y);
  const t = 0.6;
  const core = hall.core, shell = hall.shell;
  core.box((x0 + x1) / 2, y, z0 + t / 2, x1 - x0, HH, t, PAL.stone, { kind: K.Brick });
  core.box(x0 + t / 2, y, (z0 + z1) / 2, t, HH, z1 - z0, PAL.stone, { kind: K.Brick });
  shell.box((x0 + x1) / 2, y, z1 - t / 2, x1 - x0, HH, t, PAL.stone, { kind: K.Brick });
  const dz0 = 17, dz1 = 20;
  shell.box(x1 - t / 2, y, (z0 + dz0) / 2, t, HH, dz0 - z0, PAL.stone, { kind: K.Brick });
  shell.box(x1 - t / 2, y, (dz1 + z1) / 2, t, HH, z1 - dz1, PAL.stone, { kind: K.Brick });
  shell.box(x1 - t / 2, y + 3.4, (dz0 + dz1) / 2, t, HH - 3.4, dz1 - dz0, PAL.stone, { kind: K.Brick });
  shell.box(x1 + 0.05, y + 3.4, (dz0 + dz1) / 2, 0.3, 0.35, dz1 - dz0 + 0.6, PAL.stoneDark, { kind: K.Brick });
  // Buttresses.
  for (let bx = x0 + 3; bx < x1; bx += 4.5) shell.box(bx, y, z1 + 0.35, 0.8, HH - 0.5, 0.7, PAL.stoneDark, { kind: K.Brick });
  for (const bz of [12.5, 23.5]) shell.box(x1 + 0.35, y, bz, 0.7, HH - 0.5, 0.8, PAL.stoneDark, { kind: K.Brick });
  // Roof (ridge along x).
  shell.push().translate((x0 + x1) / 2, y + HH, (z0 + z1) / 2);
  shell.gable(0, 0, 0, x1 - x0 + 1.0, z1 - z0 + 1.4, 5, PAL.slate, PAL.stone, { kind: K.Slate });
  shell.pop();
  // Tall windows, moonlight falling in.
  for (let wx = x0 + 2.5; wx < x1 - 1; wx += 4.5) {
    hall.shellGlow.box(wx, y + 2.2, z1 + 0.02, 0.6, 2.2, 0.06, GLOW.window, {});
    hall.glow.box(wx, y + 2.6, z0 - 0.02, 0.6, 2.2, 0.06, GLOW.windowDim, {});
  }
  // Interior: pillars, throne, braziers, banners.
  for (let px = 22; px <= 31; px += 4.5)
    for (const pz of [13.5, 23.5]) {
      core.cyl(px, y, pz, 0.45, 0.4, HH, 8, PAL.stone, { kind: K.Brick });
      core.box(px, y + HH - 0.4, pz, 1.1, 0.4, 1.1, PAL.stoneDark, { kind: K.Brick });
      grid.addCollider({ kind: 'c', x: px, z: pz, r: 0.5, y0: 0, y1: 20 });
    }
  // Throne.
  {
    const tx = 17.4, tz = 18.5, ty = 4.4;
    core.box(tx, ty, tz, 1.1, 0.6, 1.4, PAL.woodDark, { kind: K.Wood });
    core.box(tx - 0.45, ty, tz, 0.25, 2.6, 1.6, PAL.woodDark, { kind: K.Wood });
    core.box(tx, ty + 0.6, tz, 1.0, 0.12, 1.3, '#7a2833', { kind: K.Cloth });
    core.box(tx - 0.45, ty + 2.6, tz, 0.3, 0.3, 0.3, PAL.gold, { kind: K.Metal });
    grid.addCollider({ kind: 'b', x0: tx - 0.6, z0: tz - 0.8, x1: tx + 0.4, z1: tz + 0.8, y0: 0, y1: 8 });
  }
  for (const [bx, bz] of [[21.5, 15.8], [21.5, 21.2]] as Pt[]) b.brazier(bx, bz);
  for (const bx of [23.5, 27.5, 31.5]) b.banner(bx, y + 3.2, z0 + t + 0.03, 0, PAL.cloth, 2.4);
  // (The chandeliers are live objects: see game/hazards.ts.)
  for (const [wx, wz] of [[x0 + t + 0.1, 13], [x0 + t + 0.1, 24]] as Pt[]) b.torch(wx + 0.2, y + 2.4, wz);
  // Hall wall colliders (door gap on the east side).
  grid.addCollider({ kind: 'b', x0: x0 - 0.1, z0: z0 - 0.1, x1: x1 + 0.1, z1: z0 + t, y0: 0, y1: 20 });
  grid.addCollider({ kind: 'b', x0: x0 - 0.1, z0: z0, x1: x0 + t, z1: z1, y0: 0, y1: 20 });
  grid.addCollider({ kind: 'b', x0: x0, z0: z1 - t, x1: x1 + 0.1, z1: z1 + 0.1, y0: 0, y1: 20 });
  grid.addCollider({ kind: 'b', x0: x1 - t, z0: z0, x1: x1 + 0.1, z1: dz0, y0: 0, y1: 20 });
  grid.addCollider({ kind: 'b', x0: x1 - t, z0: dz1, x1: x1 + 0.1, z1: z1, y0: 0, y1: 20 });

  // Courtyard dressing.
  for (const [bx, bz] of [[38, 17], [38, 33], [26, 34], [42, 36]] as Pt[]) b.brazier(bx, bz);
  b.well(30, 36.5);
  b.cart(40.5, 11.5, 0.2);
  // Stables lean-to along the south wall.
  {
    const g = b.g(20, 38);
    g.push().translate(20.5, base + 2.6, 38.2);
    g.rotateX(0.35);
    g.box(0, 0, 0, 8, 0.15, 3, PAL.thatch, { kind: K.Thatch });
    g.pop();
    for (const px of [17, 20.5, 24]) g.box(px, base, 37, 0.18, 2.3, 0.18, PAL.woodDark, { kind: K.Wood });
    b.hay(19, 38.5, 0.1);
    b.hay(22.5, 38.4, -0.2);
  }
  // Training dummies.
  for (const [dx, dz] of [[36, 36], [33.5, 36.5]] as Pt[]) {
    const g = b.g(dx, dz), yy = grid.groundAt(dx, dz);
    g.box(dx, yy, dz, 0.12, 1.6, 0.12, PAL.woodDark);
    g.box(dx, yy + 1.2, dz, 0.9, 0.1, 0.1, PAL.woodDark);
    g.blob(dx, yy + 1.1, dz, 0.28, 0.4, 0.22, '#a08a50', 3 + Math.floor(r() * 100), { kind: K.Thatch });
    grid.addCollider({ kind: 'c', x: dx, z: dz, r: 0.25, y0: 0, y1: 8 });
  }
  // Torches along the inner walls.
  for (let tx = 20; tx < 44; tx += 6) b.torch(tx, base + 2.3, 9.2);
  for (let tx = 20; tx < 44; tx += 6) b.torch(tx, base + 2.3, 38.8);
  for (let tz = 14; tz < 38; tz += 8) b.torch(15.2, base + 2.3, tz);
  // Torches outside on the gate towers, visible from the village.
  b.torch(48.3, base + 2.8, 21.8, 1.3);
  b.torch(48.3, base + 2.8, 27.2, 1.3);
  return hall;
}
