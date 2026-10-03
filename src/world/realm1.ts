import * as THREE from 'three';
import { K } from '../engine/materials';
import { P } from '../engine/particles';
import { mulberry32, rand, fbm, type Rng } from '../engine/util';
import { Builder, GLOW, PAL, type Structure } from './builder';
import { Grid, S, T, NONE } from './grid';
import { Painter, insidePoly, distLine, sdPoly, type Pt } from './paint';
import type { CritterDef } from '../game/critters';
import { OUTSKIRT_ROAD, RIVER as MIRROW } from './outskirts';
import * as D from './details';
import { bramble, greatTree, thicket } from './wood';
import { KEEP_ZONES } from './lightzones';
import { buildMoonpetals } from './moonpetals';
import { buildKeepsfoot } from './keepsfoot';
import { blossomTree, buildIsleShrine, buildKeepSights } from './keepsights';
import { MapKit, dressRealm, forest, wallTorch, waterPoints, type EnemySpawn, type NpcDef, type ObjDef, type RealmData, type RegionDef } from './realm';

// ---------------------------------------------------------------------------
// Realm 1: the Moonlit Keep.
// Map is 120 x 120 tiles. Screen-up is toward (-x, -z), so the journey runs
// from the south-east corner (the King's Road) to the keep in the north-west.
// ---------------------------------------------------------------------------

export const MAP_W = 120;
export const MAP_D = 120;

// Key shapes, shared between terrain, props and regions.
const VILLAGE: Pt[] = [[54, 46], [100, 44], [108, 56], [104, 66], [96, 71], [86, 73], [74, 79], [62, 84], [54, 80], [50, 66]];
const WOODS: Pt[] = [[58, 0], [120, 0], [120, 58], [110, 56], [102, 48], [90, 45], [76, 43], [62, 42], [58, 36]];
const PLATEAU: Pt[] = [[0, 0], [63, 0], [63, 36], [60, 44], [56, 50], [44, 53], [26, 55], [10, 56], [0, 57]];
const STREAM: Pt[] = [[125, 61.3], [106, 72], [96, 78], [88, 79], [80, 86], [72, 98], [66, 110], [62, 122]];
const ROAD_IN: Pt[] = [[119, 119], [110, 110], [104, 102], [98, 92], [93.5, 85], [93, 78], [93, 72], [92, 70.6], [88.5, 70.4], [85, 70.2]];
const ROAD_WEST: Pt[] = [[76, 65], [66, 66], [58, 67.5], [52, 67.5], [44, 71], [42, 76]];
const ROAD_NORTH: Pt[] = [[80, 62], [84.5, 59], [86, 52], [85.5, 46], [86, 40], [89, 34], [93, 29]];
const ROAD_CAMP_WEST: Pt[] = [[93, 27], [84, 22], [76, 18], [68, 15.5], [62, 15]];
// Deer trails deeper into Blackpine: east to the gorge lookout, north-east to the old lodge.
const TRAIL_EAST: Pt[] = [[100, 28], [106, 30.5], [113, 30.5], [119.5, 30.5]];
const TRAIL_LODGE: Pt[] = [[97, 22], [102, 17], [107, 13]];
const LODGE = { x: 108.5, z: 11.5 };
// The thorn road: from the lodge north along the gorge's rim, out of the realm into the Old Wood.
// The Warden's thorns have grown across it; only a charging warhorse breaks through.
const THORN_ROAD: Pt[] = [[113.6, 14.2], [115.3, 9], [116.2, 3], [116.4, -4], [116.6, -9.8]];
const HEDGE = { x: 116.5, z: 1.6, w: 11.4 };
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
const LANE_CHAPEL: Pt[] = [[86.2, 54.2], [91.5, 54.6], [95.9, 54.2]];
const LANE_BACK: Pt[] = [[85, 62.8], [89, 63.1], [94, 63.1], [98.5, 63.3]];
const LANE_SW: Pt[] = [[61, 67.3], [62.6, 71], [63.3, 76.9]];
const LANES = [LANE_HOME, LANE_STONES, LANE_RIVER, LANE_FARM, LANE_FIELDS, LANE_PIER, LANE_STAIR, LANE_CHAPEL, LANE_BACK, LANE_SW];
// Inside the graveyard: from the gate to the crypt door.
const GRAVE_PATH: Pt[] = [[42.5, 76], [37.5, 75.6], [34.4, 75.1]];
// The old burial mounds that gave the Barrow Fields their name (doorway at local +x), and a dolmen by the lane.
const BARROWS = [
  { x: 19.5, z: 72.5, len: 6, wid: 3.6, rot: 0 },
  { x: 16.5, z: 80.5, len: 5, wid: 3.4, rot: -Math.PI / 2 },
];
const DOLMEN = { x: 24, z: 68.4 };
// The keep's banners and pennants: moon-blue cloth with the gold crescent, as the prototype's castle flew them.
const MOON_CLOTH = '#2a64b8';
// A great glowing stone arch among the barrows.
const ARCH = { x: 23.6, z: 77.6 };
// What the raiders left of the farm's barn; the rail where the warhorse is tied.
const BARN = { x: 105.5, z: 116 };
const HITCH = { x: 104.9, z: 109 };

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
  // The street from the ramp top to the square: level ground.
  p.rect(84, 69, 91, 72, { h: 1 });
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
  // Deep from wall to wall: a shallow edge under the walls would be a pit with no way out.
  p.each((_x, _z, i) => {
    if (grid.water[i] !== NONE) grid.h[i] = Math.min(grid.h[i], 1.9);
  }, 46, 4, 52, 47);
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
  // The north-east corner: the border hills end here, and the land runs level out to the
  // gorge's rim (nothing tall on the near side of the thorn road, so the camera sees it).
  p.each((x, z, i) => {
    if (x + z * 0.35 < 112.5) return;
    grid.h[i] = 2;
    grid.dir[i] = -1;
    grid.t[i] = (x * 7 + z * 3) % 5 === 0 ? T.Dirt : T.DarkGrass;
  }, 110, 0, 120, 9);
  p.path(THORN_ROAD.slice(0, 4), 1.6, T.Dirt, 0.4, 16);

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
  p.path(GRAVE_PATH, 1.4, T.Path, 0.3, 31, false);

  // ---------- props ----------
  const b = builder;
  const inKnoll = (x: number, z: number) => x > 27 && x < 40 && z > 50 && z < 63;
  const kit = new MapKit(grid, [ROAD_IN, ROAD_WEST, ROAD_NORTH, ROAD_CAMP_WEST, BAILEY_ROAD, BAILEY_ROAD2, TRAIL_EAST, TRAIL_LODGE, THORN_ROAD, ...LANES]);
  const nearRoad = (x: number, z: number, d: number) => kit.nearRoad(x, z, d);
  const flatAround = (x: number, z: number, rad: number) => kit.flatAround(x, z, rad);

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
    if (BARROWS.some((m) => Math.hypot(x - m.x, z - m.z) < m.len / 2 + 2) || Math.hypot(x - DOLMEN.x, z - DOLMEN.z) < 3 || Math.hypot(x - ARCH.x, z - ARCH.z) < 3.5) continue;
    const k = r();
    if (k < 0.18) b.oak(x, z, 0.9 + r() * 0.5);
    else if (k < 0.3) D.birch(b, x, z, 0.9 + r() * 0.4);
    else if (k < 0.6) b.bush(x, z, 0.8 + r() * 0.5);
    else if (k < 0.75) b.rock(x, z, 0.5 + r() * 0.6);
    else b.deadTree(x, z, 0.8 + r() * 0.4);
  }
  // ---------- the Old Warden's homestead ----------
  {
    const H = HOME;
    b.house(H.x, H.z, 5, 4, { doorSide: 0, roof: 'thatch', lit: 1, name: 'warden house', flowers: true });
    // Yard fence with a gate facing the road.
    b.fence([[H.x + 4.8, H.z - 1.2], [H.x + 4.8, H.z - 4.8], [H.x - 5, H.z - 4.8], [H.x - 5, H.z + 4.5], [H.x + 4.8, H.z + 4.5], [H.x + 4.8, H.z + 1.4]]);
    // Torches either side of the gate.
    b.standingTorch(H.x + 5.4, H.z - 1.8);
    b.standingTorch(H.x + 5.4, H.z + 2.2);
    // A carpenter's bench against the fence behind the house, flowers along the yard.
    D.workbench(b, H.x + 1.1, H.z + 3.9, 0);
    D.wildflowers(b, H.x + 6.6, H.z + 5.5, 12, 1.2);
    D.wildflowers(b, H.x - 6.2, H.z + 7.6, 10, 1.1, 'yellow');
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
    if (Math.hypot(x - BARN.x, z - BARN.z) < 5.5 || Math.hypot(x - HITCH.x, z - HITCH.z) < 2.2) continue;
    const k = r();
    if (k < 0.25) b.oak(x, z, 0.9 + r() * 0.4);
    else if (k < 0.4) D.birch(b, x, z, 0.9 + r() * 0.4);
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
  // The raid: crops trampled and burned in patches, the barn a smoking shell, a stew pot on the go.
  const COOK = { x: 96.5, z: 117.4 };
  const burned = (x: number, z: number) =>
    fbm(x * 0.35, z * 0.35, 2, 97) > 0.6 || ([[76, 115], [93, 115.5], [79, 117], [81.8, 116.9], [80.5, 115.2], [77.6, 116.8], [82.8, 117.8], [COOK.x, COOK.z]] as Pt[]).some(([hx, hz]) => Math.hypot(x - hx, z - hz) < 1.4);
  D.crops(b, 70.3, 112, 83.7, 119.9, 'wheat', burned);
  D.crops(b, 88.3, 112, 100.1, 119.9, 'cabbage', burned);
  D.cauldron(b, COOK.x, COOK.z);
  D.burnedBarn(b, BARN.x, BARN.z);
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
  // Lily pads on still water: the lake's edge, the marsh pools, the slow stretch below the ford.
  for (const [lx, lz, n] of [[5.5, 90, 9], [4.5, 106, 9], [3.5, 95.5, 6], [22.5, 110.5, 6], [27.5, 113.5, 6], [43.5, 118.5, 5], [51.5, 115.5, 6], [64.5, 113, 5], [75.5, 92.5, 4]] as [number, number, number][]) D.lilyPads(b, lx, lz, n, 1.4);

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
  D.hangingSign(tavern.shell, 78.6, 3.3, 57.15, 0, 'mug');
  // Keepsfoot, in order of standing: the tavern, the Elder's hall (two storeys,
  // stone below, facing the square), the chapel with its bell tower by the north
  // road, the stone smithy at the top of the street from the bridge, then cottages.
  b.house(68.2, 60.4, 4.6, 5.6, { doorSide: 0, roof: 'slate', ridgeX: false, storeys: 2, walls: 'stone', lit: 0.9, name: 'elder hall' });
  b.house(67.5, 69, 4.5, 4, { doorSide: 0, roof: 'thatch', lit: 0.6 });
  b.house(89.5, 59.5, 5, 4, { doorSide: 2, roof: 'slate', storeys: 2, lit: 0.8, tint: '#c8b89a' });
  const smithy = b.house(90.8, 66.6, 5.2, 4.2, { doorSide: 1, roof: 'slate', walls: 'stone', lit: 0.6, name: 'smithy' });
  b.house(78.5, 74.5, 6, 4, { doorSide: 3, roof: 'thatch', lit: 0.7, shed: 0 });
  b.house(98.5, 60, 4, 5, { doorSide: 1, roof: 'thatch', ridgeX: false, lit: 0.6 });
  b.house(60.5, 77, 4, 5, { doorSide: 0, roof: 'thatch', ridgeX: false, lit: 0.4, shed: 1 });
  D.chapel(b, 97, 51);
  b.well(78, 64.5);
  for (const [x, z] of [[73.5, 58.8], [83.5, 60.5], [72.5, 68.5], [84.5, 68.8], [88.5, 73.5], [63, 66], [86.5, 49]] as Pt[]) b.lamp(x, z);
  // The smithy's open forge under a lean-to on its west side, its sign over the street.
  {
    D.forgeLeanTo(b, smithy, 93.4, 64.6, 68.6, 1);
    b.brazier(94.4, 67.5, true);
    D.anvil(b, 94.4, 65.5, 0.4);
    D.trough(b, 96.5, 66.4, Math.PI / 2);
    D.hangingSign(smithy.core, 92.6, grid.groundAt(92.6, 68) + 2.45, 68.7, 0, 'anvil');
  }
  // A market stall on the square, and the rail where the warhorse waits by the road.
  D.marketStall(b, 74.8, 69.2, Math.PI / 2);
  D.hitchingPost(b, HITCH.x, HITCH.z, 0);
  b.cart(71.5, 72.3, 0.2);
  b.hay(64.3, 72.8, 0.4);
  b.hay(65.4, 74, 1.2);
  b.bench(74.5, 62.5, Math.PI / 2);
  b.bench(81.5, 66.5, 0);
  for (const [x, z] of [[82.8, 57.8], [83.4, 58.4], [70.8, 64.6], [92.6, 60.2], [92.7, 59.4]] as Pt[]) b.barrel(x, z);
  b.crate(71, 65.4);
  b.crate(71.6, 66.2, 0.55);
  b.fence([[62, 62], [62, 57], [66, 57]]);
  b.fence([[101, 63], [104, 63], [104, 56], [100.5, 56]]);
  b.fence([[56, 72], [58, 72], [58, 81]]);
  for (let i = 0; i < 18; i++) {
    const x = rand(r, 56, 104), z = rand(r, 46, 82);
    if (!insidePoly(VILLAGE, x, z) || nearRoad(x, z, 2.2) || !flatAround(x, z, 0.8)) continue;
    if (x > 69 && x < 88 && z > 48 && z < 78) continue;
    let crowded = false;
    for (let dz = -2; dz <= 2 && !crowded; dz++)
      for (let dx = -2; dx <= 2 && !crowded; dx++) crowded = grid.collidersNear(x + dx, z + dz).some((c) => c.on && c.kind === 'b' && c.y0 < -10 && x > c.x0 - 1.5 && x < c.x1 + 1.5 && z > c.z0 - 1.5 && z < c.z1 + 1.5);
    if (crowded) continue;
    r() < 0.4 ? b.oak(x, z, 1 + r() * 0.3) : b.bush(x, z, 0.8 + r() * 0.3);
  }
  // Vegetable patches.
  for (let x = 62.6; x < 65.2; x += 0.8) for (let z = 58; z < 61.5; z += 0.9) b.bush(x, z, 0.28, '#4a6a30');
  for (let x = 100.8; x < 103.5; x += 0.8) for (let z = 57; z < 62.5; z += 0.9) b.bush(x, z, 0.25, '#58703a');

  // ---------- Barrow Fields ----------
  // The graveyard: a weathered picket fence, a lych-gate over the way in, stones of
  // every age, two railed family plots, an angel, coffins above ground, a grave left open.
  D.picketFence(b, [[27, 69], [43, 69], [43, 74.5]]);
  D.picketFence(b, [[43, 77.5], [43, 83], [27, 83], [27, 69]]);
  D.lychGate(b, 43, 76, 3);
  buildCrypt(b, grid, 34, 71);
  const owlGrave = b.deadTree(29, 71.5, 1.2);
  b.deadTree(42.3, 82.3, 0.9);
  {
    const kinds: D.Stone[] = ['slab', 'round', 'cross', 'celtic', 'small', 'broken', 'slab', 'round'];
    const stone = (x: number, z: number, kind?: D.Stone, lit = false) =>
      D.headstone(b, x + (r() - 0.5) * 0.25, z + (r() - 0.5) * 0.15, kind ?? kinds[Math.floor(r() * kinds.length)], (r() - 0.5) * 0.15, { candles: lit });
    // North side, either side of the crypt.
    stone(28.6, 73.0, 'cross');
    stone(30.4, 73.3, 'round', true);
    stone(41.9, 71.2, 'small');
    stone(41.9, 73.2, 'broken');
    D.ironRailing(b, 37.3, 71.2, 40.7, 73.8);
    stone(38.2, 71.8, 'celtic', true);
    stone(39.8, 71.8, 'slab');
    // Two rows south of the aisle.
    [30.2, 32.0, 33.8, 35.6, 37.4, 39.2, 41.0].forEach((x, i) => stone(x, 77.4, undefined, i % 3 === 1));
    D.sarcophagus(b, 30.3, 80.6, 0);
    D.openGrave(b, 33.3, 80.2, 0);
    D.ironRailing(b, 35.7, 79.3, 39.5, 82.2);
    stone(36.5, 80.1, 'cross');
    stone(37.6, 80.3, 'obelisk', true);
    stone(38.7, 80.1, 'small');
    D.sarcophagus(b, 41.4, 80.9, Math.PI / 2, true);
    // The angel at the end of the aisle, facing the gate; lanterns and wisps.
    D.angelStatue(b, 29.7, 75.5, Math.PI / 2);
    D.groundLantern(b, 30.6, 74.4);
    D.groundLantern(b, 36.0, 73.5, false);
    D.bones(b, 36.9, 74.1, 3);
    for (const [wx, wz] of [[31, 78], [36, 78], [39, 72.5], [33, 81], [28.5, 75]] as Pt[]) b.fx.addEmitter({ x: wx, y: grid.groundAt(wx, wz) + 0.3, z: wz, rate: 0.35, spec: P.wisp, spread: 3, vy: 0.1 });
    b.moonflowers(31.5, 79, 6, 1.2);
    D.wildflowers(b, 28.3, 78.5, 8, 0.6, 'purple');
    D.wildflowers(b, 42.2, 79.8, 6, 0.5, 'purple');
    D.wildflowers(b, 27.8, 70.2, 6, 0.6, 'purple');
  }
  // The barrows, and the old dolmen by the Overlook lane.
  for (const m of BARROWS) D.barrow(b, m.x, m.z, m.len, m.wid, m.rot);
  D.dolmen(b, DOLMEN.x, DOLMEN.z, 0.4);
  D.stoneArch(b, ARCH.x, ARCH.z, Math.PI / 4);
  b.moonflowers(DOLMEN.x, DOLMEN.z + 0.3, 6, 0.8);
  D.wildflowers(b, 21.5, 76.8, 10, 1.2);
  D.bones(b, 22.9, 70.4, 2);
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
  // The war drum that beats all night, trophies, standards daubed with the red hand.
  D.warDrum(b, 97.6, 29.4);
  D.trophyRack(b, 86.9, 27.9, Math.PI / 2);
  D.goblinStandard(b, 93.3, 19.4);
  D.goblinStandard(b, 101.8, 33.6, '#5a3a2a');
  D.spearStack(b, 100.2, 23.6);
  D.bones(b, 88.7, 24.3, 4, true);
  D.bones(b, 103.2, 29.6, 3);

  // ---------- the old hunting lodge ----------
  let owlLodge: [number, number, number] = [113.4, 4, 14.2];
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
    owlLodge = b.deadTree(113.4, 14.2, 1.1);
    b.crate(106, 12.2);
    b.barrel(106.8, 12.4);
    b.sign(114.2, 9.6, 0.8);
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

  // ---------- nature: stumps, fallen logs, birches, wild flowers ----------
  const room = (x: number, z: number, rad: number) => kit.room(x, z, rad);
  for (const [x, z, len, rot] of [[52, 60.5, 3, 0.3], [12.5, 91, 2.8, 1.2], [49, 107.5, 3.2, 0.1], [70.5, 40, 3, 0.8], [104, 44, 2.6, 2.2], [116, 85.5, 2.5, 1.9], [24.5, 88, 3, 2.6], [58, 94, 2.6, 0.5]] as [number, number, number, number][])
    if (room(x, z, len / 2)) D.fallenLog(b, x, z, len, rot);
  for (const [x, z] of [[66, 44.5], [72.5, 42.5], [78, 44.5], [57.5, 86.5], [26, 91.5], [110, 78.5], [100, 40.5], [64.5, 25.5], [112, 43], [18, 64.5]] as Pt[])
    if (room(x, z, 0.5)) D.stump(b, x, z, 0.8 + r() * 0.5);
  for (const [x, z] of [[114, 81], [117, 84.5], [104.5, 83.5], [60.5, 51], [66, 50.5], [100, 49.5], [28, 94], [12, 86]] as Pt[])
    if (room(x, z, 0.4)) D.birch(b, x, z, 0.9 + r() * 0.3);
  for (let i = 0; i < 70; i++) {
    const x = rand(r, 6, 118), z = rand(r, 56, 116);
    if (insidePoly(VILLAGE, x, z) || nearRoad(x, z, 1.8) || grid.waterAt(x, z) !== NONE || !flatAround(x, z, 0.5)) continue;
    if ((x > 26 && x < 45 && z > 67 && z < 85) || (x > 68 && x < 101 && z > 111)) continue;
    const k = r();
    D.wildflowers(b, x, z, 6 + Math.floor(r() * 8), 0.6 + r() * 0.7, k < 0.5 ? 'meadow' : k < 0.8 ? 'purple' : 'yellow');
  }

  // ---------- roadsides: pebbled edges, and lanterns on the way to the village ----------
  for (const [line, w] of [[ROAD_IN, 2.6], [ROAD_WEST, 2.4], [ROAD_NORTH, 2.2], [ROAD_CAMP_WEST, 2], [TRAIL_EAST, 1.6], [TRAIL_LODGE, 1.6], [GRAVE_PATH, 1.4], ...LANES.map((l) => [l, l === LANE_FARM ? 2 : 1.7])] as [Pt[], number][])
    D.edgeStones(b, grid, line, w);
  kit.lanterns(b, ROAD_IN, [25, 33, 41], 2.1);
  kit.lanterns(b, ROAD_WEST, [28], 2);

  // ---------- the Kings' Orchard: the keep's old orchard behind its west wall, gone wild ----------
  // Found, not signposted (no path): north from the Overlook along the outside of the wall.
  for (const [x, z, s] of [[6.6, 15.8, 1.25], [9.4, 18.6, 1.05], [7.2, 21.4, 0.9], [6.4, 30.2, 1.3], [9.2, 32.6, 1], [6.9, 35.4, 0.85]] as [number, number, number][]) blossomTree(b, x, z, s);
  for (const [x, z, s] of [[8.4, 14.6, 0.8], [5.8, 19.2, 1], [10.6, 30.4, 0.7], [8, 34.4, 0.9], [11.2, 24, 0.6]] as [number, number, number][]) b.bush(x, z, s);
  b.deadTree(10.2, 26.4, 0.9);
  b.moonflowers(8.6, 25.4, 9, 1.8);
  b.moonflowers(8.2, 10.6, 6, 1.2);
  b.mushrooms(6.2, 31.6, 5, false);
  b.rock(5.9, 9.8, 0.8);

  // Moonpetals glowing moon-blue by the Seven Stones, the barrows and in the orchard.
  buildMoonpetals(b, grid);

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
    { type: 'archer', x: 91.4, z: 35.6 },
    // Goblin camp
    { type: 'brute', x: 93, z: 23, group: 'camp' },
    { type: 'goblin', x: 98, z: 26, group: 'camp' },
    { type: 'shield', x: 92, z: 29, group: 'camp', elite: true },
    { type: 'archer', x: 101, z: 19.4, group: 'camp' },
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
    { type: 'bomber', x: 83, z: 116.6, group: 'farm' },
    { type: 'archer', x: 87, z: 115.5, group: 'farm' },
    { type: 'bomber', x: 93.5, z: 114.3, group: 'farm' },
    // A goblin fishing camp on the Mirrow's bank
    { type: 'goblin', x: 119, z: 97 },
    { type: 'bomber', x: 119.5, z: 100.8 },
    // Patrols in the western fields
    { type: 'goblin', x: 13, z: 73 },
    { type: 'goblin', x: 14.6, z: 65.6 },
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
    { type: 'darter', x: 47.9, z: 113.9, guard: true },
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
        'And past the lodge, black thorns have come up out of the Old Wood, right across the deer trail along the gorge.',
        "There were two wardens once. I kept the king's road; the other kept the Old Wood. Only a charging warhorse would get through those thorns now.",
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
      id: 'smith', look: 'smith', name: 'Garrow the Smith', x: 94.7, z: 66.5, face: 1,
      lines: ['That blade has seen better nights.', 'Bring me coin and I will put an edge on it that goblin hide will remember.', 'And barding for that horse of yours, if you mean to keep it on its feet.'],
      shop: 'sword',
      wares: ['barding'],
    },
    {
      id: 'brother', look: 'captive', name: 'Tam', x: 101, z: 26, face: -1, caged: true,
      lines: ['You came for me? Pip sent you, didn\'t she.', 'Here. I took this off a goblin before they caught me. It is yours.', 'I will run home. Go and knock that crown off his head!'],
    },
    {
      id: 'tamhome', look: 'captive', name: 'Tam', x: 71.8, z: 70.4, face: 1, hidden: true,
      lines: ['I owe you my life, sir knight. Pip will not stop talking about you.'],
    },
  ];

  const objects: ObjDef[] = [
    { kind: 'moonfire', id: 'wayshrine', name: 'Wayshrine', x: 105.5, z: 99.5 },
    { kind: 'moonfire', id: 'hearth', name: 'Tavern Hearth', x: 73.2, z: 53.3, indoor: true },
    { kind: 'moonfire', id: 'rest', name: "Knight's Rest", x: 70, z: 20 },
    { kind: 'moonfire', id: 'gate', name: 'Gate of the Keep', x: 41.5, z: 28.5 },
    { kind: 'lore', id: 'lore1', x: 45.5, z: 79.5, text: 'The keep was built by the first knights, when the moon was young.' },
    { kind: 'lore', id: 'lore2', x: 24.2, z: 51.4, text: 'Every king before this one kept the gates open to travellers.' },
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
    { kind: 'thorns', id: 'w_thorns', x: HEDGE.x, z: HEDGE.z, alongX: true, w: HEDGE.w },
    { kind: 'sign', x: 114.2, z: 9.6, text: 'North, along the gorge: the Old Wood. (Scratched under it, newer: THE THORNS BITE.)' },
    { kind: 'lore', id: 'lore4', x: 106.8, z: 85.6, text: 'Seven stones for seven kings who kept the road. The eighth stone was never raised.' },
    { kind: 'lore', id: 'lore5', x: 8.6, z: 9.4, text: "The keep's old orchard. Nobody has pruned it since the King's men fled, and the apples have gone small and sour." },
    { kind: 'lever', id: 'winch', x: 56.5, z: 10.2 },
    { kind: 'drawbridge', x0: 47, z0: 23, x1: 51, z1: 26, deck: 4 },
    { kind: 'cage', id: 'cage', x: 101, z: 26 },
    { kind: 'hallDoor', x: 34, z: 18.5, y: 4 },
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
    { name: "The Warden's Homestead", music: 'road', amb: 'road', test: (x, z) => Math.abs(x - HOME.x) < 7.5 && z > HOME.z - 6 && z < HOME.z + 13, light: KEEP_ZONES.home },
    { name: 'The Crescent & Crown', music: 'tavern', amb: 'indoor', test: (x, z) => x > 72 && x < 82 && z > 50 && z < 57, light: KEEP_ZONES.village },
    { name: 'Hall of the Moon Throne', music: 'hall', amb: 'indoor', test: (x, z) => x > 16 && x < 34 && z > 10 && z < 27, light: KEEP_ZONES.hall },
    { name: 'The Hollow', music: 'hall', amb: 'indoor', test: (x, z, y) => x > 30 && x < 36.2 && z > 54 && z < 59.4 && y < 1, light: KEEP_ZONES.hollow },
    { name: 'The Old Lodge', music: 'wilds', amb: 'woods', test: (x, z) => (x - LODGE.x) ** 2 + (z - LODGE.z) ** 2 < 81, light: KEEP_ZONES.pines },
    { name: 'The Gorge Lookout', music: 'wilds', amb: 'woods', test: (x, z) => x > 115 && z > 24 && z < 37, light: KEEP_ZONES.pines },
    { name: 'The Thorn Road', music: 'wilds', amb: 'woods', test: (x, z) => z < 0 || (x + z * 0.35 > 113 && z < 7), light: KEEP_ZONES.pines },
    { name: 'Riverside', music: 'road', amb: 'road', test: (x, z) => x > 119.5 && z > 58, light: KEEP_ZONES.water },
    { name: 'The Raided Farm', music: 'road', amb: 'fields', test: (x, z) => x > 68 && x < 109 && z > 109, light: KEEP_ZONES.fields },
    { name: 'The Moonlit Keep', music: 'keep', amb: 'keep', test: (x, z) => x > 13 && x < 47 && z > 7 && z < 41, light: KEEP_ZONES.keep },
    { name: "The Kings' Orchard", music: 'keep', amb: 'woods', test: (x, z, y) => y > 3.5 && x < 47 && z > 3 && (x < 13.5 ? z < 41.5 : z < 7.5), light: KEEP_ZONES.orchard },
    { name: 'The Outer Bailey', music: 'keep', amb: 'keep', test: (x, z, y) => x >= 47 && x < 63 && z < 47 && y > 3.5, light: KEEP_ZONES.keep },
    { name: "Gnasher's Camp", music: 'wilds', amb: 'woods', test: (x, z) => (x - CAMP.x) ** 2 + (z - CAMP.z) ** 2 < 11 * 11, light: KEEP_ZONES.pines },
    { name: 'Blackpine Wood', music: 'wilds', amb: 'woods', test: (x, z, y) => insidePoly(WOODS, x, z) && y > 1.5, light: KEEP_ZONES.pines },
    { name: 'The Overlook', music: 'keep', amb: 'keep', test: (x, z, y) => y > 3.5 && z > 40 && x < 47, light: KEEP_ZONES.fields },
    { name: 'Keepsfoot', music: 'village', amb: 'village', test: (x, z, y) => insidePoly(VILLAGE, x, z) && y > 0.5, light: KEEP_ZONES.village },
    { name: 'Mirrormere', music: 'fields', amb: 'fields', test: (x, z) => x < 14 && z > 80, light: KEEP_ZONES.water },
    { name: 'The Sallow Marsh', music: 'fields', amb: 'fields', test: (x, z) => z > 104 && x < 62, light: KEEP_ZONES.marsh },
    { name: 'The Seven Stones', music: 'road', amb: 'road', test: (x, z) => (x - 111.5) ** 2 + (z - 88) ** 2 < 36, light: KEEP_ZONES.stones },
    { name: 'The Barrow Fields', music: 'fields', amb: 'fields', test: (x, z) => x < 66 && z > 55, light: KEEP_ZONES.barrows },
    { name: "The King's Road", music: 'road', amb: 'road', test: () => true, light: KEEP_ZONES.fields },
  ];

  // The Keep's set pieces: the old mill, the beacon, the First Knights' Isle, the Seven Stones' runes and the eighth
  // stone, the orchard in blossom, the raided farm, Pilgrims' Fall, the night fisher (src/world/keepsights.ts).
  const sights = buildKeepSights(b, grid);
  objects.push(...sights.objects);
  npcs.push(...sights.npcs);
  regions.unshift(...sights.regions);

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

  const critters: CritterDef[] = [
    ...[0, 1, 2, 3].map((k): CritterDef => ({ kind: 'chicken', x: HOME.x - 2 + k * 0.8, z: HOME.z - 3.9 + (k % 2) * 0.5, area: [HOME.x - 4.5, HOME.z - 4.3, HOME.x + 4.3, HOME.z - 2.2] })),
    ...[0, 1].map((k): CritterDef => ({ kind: 'chicken', x: HOME.x + 1 + k, z: HOME.z + 3.4, area: [HOME.x - 0.5, HOME.z + 2.5, HOME.x + 4.3, HOME.z + 4] })),
    ...([[84, 104], [80, 98], [104, 94], [30, 90], [24, 86], [44, 104], [112, 92]] as Pt[]).map(([x, z]): CritterDef => ({ kind: 'rabbit', x, z, area: [x - 5, z - 5, x + 5, z + 5] })),
    ...([[86, 106], [68, 21], [55, 87]] as Pt[]).map(([x, z]): CritterDef => ({ kind: 'squirrel', x, z, area: [x - 4, z - 3, x + 4, z + 3] })),
    { kind: 'fox', x: 18, z: 89, area: [12, 85, 24, 94] },
    { kind: 'fox', x: 52, z: 105.5, area: [46, 103.5, 58, 108] },
    { kind: 'deer', x: 114, z: 78, area: [110, 74, 119, 83] },
    { kind: 'deer', x: 116.5, z: 80.5, area: [110, 74, 119, 83] },
    { kind: 'deer', x: 107.2, z: 39.4, area: [104, 34, 114, 44] },
    { kind: 'owl', x: owlGrave[0], z: owlGrave[2], perch: owlGrave[1], area: [0, 0, 0, 0] },
    { kind: 'owl', x: owlLodge[0], z: owlLodge[2], perch: owlLodge[1], area: [0, 0, 0, 0] },
  ];

  // Keepsfoot lived in: its people at their night's work, lanterns over the square and the street, the hens;
  // Gnasher's camp at its business before the fight (src/world/keepsfoot.ts).
  const folk = buildKeepsfoot(b, grid, npcs);
  enemies.push(...folk.enemies);
  npcs.push(...folk.npcs);
  critters.push(...folk.critters);

  return {
    id: 'castle',
    w: MAP_W,
    d: MAP_D,
    grid,
    builder,
    start: { x: 105.5, z: 105 },
    horse: { x: 103.2, z: 107.2 },
    // The stream runs down from the hills to the Mirrow, and the Mirrow round into Mirrormere.
    flows: [{ pts: STREAM, speed: 0.9 }, { pts: MIRROW, speed: 0.55 }, ...sights.flows],
    // The Seven Stones: the last wave is a brute, a shaman, a goblin and an elite boar.
    trial: {
      x: 111.5,
      z: 88,
      relic: 'crest',
      quest: 'stones',
      prompt: 'Face the trial of the Seven Stones',
      wake: ['The Seven Stones wake', 'Three waves. Stand your ground.'],
      win: ["The Knight's Crest", 'Relic won: blocking costs 30% less stamina. The stones give up 90 coins of old offerings.'],
      purse: 90,
      waves: [
        [{ type: 'goblin' }, { type: 'goblin' }, { type: 'goblin' }],
        [{ type: 'shield' }, { type: 'shield' }, { type: 'archer' }, { type: 'bomber' }],
        [{ type: 'brute' }, { type: 'shaman' }, { type: 'goblin' }, { type: 'boar', elite: true }],
      ],
    },
    critters,
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
      buildIsleShrine(bb, g);
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
      // The thorn road beyond the realm: a level shelf along the gorge's rim, high ground to the
      // west, running into the thorns and the roots of the Great Tree where the Old Wood begins.
      // (It stops well short of the world's edge, so the camera never sees past it.)
      const roadOut = THORN_ROAD.slice(2);
      new Painter(g).each((x, z, i) => {
        const d = distLine(roadOut, x + 0.5, z + 0.5);
        if (g.water[i] !== NONE) return;
        if (x >= 120 && g.h[i] < 0) return; // the gorge itself
        if (z > -11.5 && (d < 1.9 || (x >= 117 && x < 122 && g.h[i] > -1))) {
          g.h[i] = 2;
          g.t[i] = d < 1.2 ? T.Path : T.DarkGrass;
          g.dir[i] = -1;
          g.side[i] = S.Rock;
        } else if (x < 122) g.h[i] = Math.max(g.h[i], 5);
      }, 108, -24, 124, 0);
      new Painter(g).path(roadOut, 1.4, T.Path, 0.4, 17, false);
      // The end of the road: the thorns close over it in an arch, and grow into a wall past it.
      thicket(bb, [[112.8, -11.9], [122.4, -11.9]], 2.4, 1.6);
      for (const s0 of [-1, 1]) for (let k = 0; k < 5; k++) bramble(bb, 116.6 + s0 * (1.7 + k * 0.08), -6.4 - k * 0.9, 1.3, 2.6, k > 2);
      for (let k = 0; k < 6; k++) {
        const a = (k / 5) * Math.PI;
        bramble(bb, 116.6 + Math.cos(a) * 1.5, -10.9, 0.9, 2.2 + Math.sin(a) * 1.2, true);
      }
      bb.collide({ kind: 'b', x0: 113.5, z0: -11.2, x1: 115, z1: -6.2, y0: -3, y1: 8 });
      bb.collide({ kind: 'b', x0: 118.2, z0: -11.2, x1: 122.4, z1: -6.2, y0: -3, y1: 8 });
      // A green-gold glow deep in the thorns: the Old Wood's light, where the road goes on.
      bb.lights.add(116.6, 3.2, -11.4, 0xc8e070, 7, 7, 0.25);
      bb.fx.addEmitter({ x: 116.6, y: 2.8, z: -10.8, rate: 2.5, spec: P.firefly, spread: 1.6, vy: 0.1 });
      // Brambles creeping along the road, a dead pine, and the Great Tree's roots beyond the thorns.
      for (const [bx, bz, sc] of [[114.3, -3.5, 1], [118.6, -1.2, 0.8], [114.1, -5.6, 1.2], [118.9, -4.6, 0.9], [119.4, 5.8, 0.8], [112.4, 6.4, 0.9]] as [number, number, number][]) bramble(bb, bx, bz, sc, 1.8);
      bb.deadTree(113.6, -1.2, 1.1);
      greatTree(bb, 117, -17.5, 1.25);
      // A goblin fishing camp on the Mirrow's bank, at the end of the lane from the stones.
      new Painter(g).path(LANE_RIVER, 1.7, T.Path, 0.4, 22, false);
      bb.tent(121.4, 100.4, Math.PI / 2, '#5a4a2a');
      bb.campfire(120.4, 97.6);
      bb.barrel(122.3, 98.6);
      const fx = bb.g(121.8, 95.5), fy = g.groundAt(121.8, 95.5);
      fx.box(121.8, fy, 95.5, 0.08, 1.4, 0.08, PAL.woodDark);
      fx.beam([121.8, fy + 1.3, 95.5], [123.6, fy + 0.4, 95.2], 0.025, PAL.woodDark);

      // ---- detail everywhere, not just at the landmarks ----
      const posts = [...(objects.filter((o) => 'x' in o) as unknown as { x: number; z: number }[]), ...npcs, ...enemies];
      const fits = (x: number, z: number, kind: 'soft' | 'solid' | 'tree') => {
        const inRealm = x >= 0 && z >= 0 && x < MAP_W && z < MAP_D;
        const gap = kind === 'tree' ? 3.5 : 1.6;
        if (inRealm ? nearRoad(x, z, gap) : OUTSKIRT_ROAD.some((l) => distLine(l, x, z) < gap + 0.6)) return false;
        if (kind === 'tree' && (insidePoly(VILLAGE, x, z) || Math.hypot(x - ARCH.x, z - ARCH.z) < 4)) return false;
        if (Math.hypot(x - 111.5, z - 88) < 7.5) return false; // the trial ring
        if (x > 26 && x < 45 && z > 67 && z < 85) return false; // the graveyard is dressed by hand
        if (x > 68 && x < 101 && z > 111 && z < 121) return false; // the crops
        if (BARROWS.some((m) => Math.hypot(x - m.x, z - m.z) < m.len / 2 + 1.5)) return false;
        // Nothing solid by people, doors, chests or where foes stand.
        return kind === 'soft' || !posts.some((o) => Math.hypot(x - o.x, z - o.z) < (kind === 'tree' ? 4 : 3));
      };
      dressRealm(bb, g, r, {
        w: MAP_W,
        d: MAP_D,
        fits,
        afterScatter: () => {
          for (const l of OUTSKIRT_ROAD) D.edgeStones(bb, g, l, 2.6);
        },
        // Lily pads on all the still water: the lake, the marsh pools, the moat.
        still: (px, pz) => (px < 14 && pz > 76 && pz < 124) || (pz > 104 && px < 62) || (px > 46 && px < 52 && pz < 47),
        // Wildlife all over the realm, not only where it was put by hand.
        wild: [
          ['rabbit', 10, [T.Grass]],
          ['squirrel', 6, [T.DarkGrass]],
          ['deer', 4, [T.Grass, T.DarkGrass]],
          ['fox', 3, [T.Grass, T.Mud, T.Reeds]],
        ],
        noWild: (x, z) => insidePoly(VILLAGE, x, z),
        critters,
      });
    },
    enemies,
    npcs,
    objects,
    regions,
    structures: { tavern, hall },
    waterPoints: waterPoints(grid, MAP_W, MAP_D),
    grassDensity,
    grassScale,
    fireflyZones: [
      { x: 40, z: 90, r: 18 },
      { x: 70, z: 100, r: 12 },
      { x: 100, z: 96, r: 12 },
      { x: 34, z: 76, r: 8 },
      { x: 80, z: 30, r: 14 },
    ],
    // The keep's towers and gate towers.
    slits: [[44.4, 7.2, 9.6], [44.4, 7.2, 38.4], [15.6, 7.2, 38.4], [47.9, 6.6, 20.5], [47.9, 6.6, 28.5]],
    chandeliers: [{ x: 24, z: 18.5, floor: 4 }, { x: 28.5, z: 18.5, floor: 4 }],
    // The Hall of the Moon Throne. Dust falls from the rafters (x 20..32, z 12..25) when the king crashes.
    arena: { x0: 16, z0: 10, x1: 32, z1: 27, y: 3.5, summons: [[30, 13], [30, 24]], dust: [20, 12, 9, 12, 13] },
    drums: { x: 95, z: 27, group: 'camp' },
    inn: { x: 77, z: 53.5, region: 'The Crescent & Crown' },
    // Its places' own sounds (src/audio/lands.ts): the smith at his anvil, the tavern's crowd through its walls,
    // the chapel's bell on the hour, the marsh's frogs and a bittern, the stream's babble and the ford's white
    // water, the wind in Blackpine's pines, banners and chains at the keep, skylarks at dawn; and the beasts
    // calling from where they are (crows over the keep's towers and the burned crops, sheep in the meadows, a cow
    // and geese at the homestead, swans on Mirrormere and the moat, a heron below the ford, cocks at dawn).
    sounds: [
      { kind: 'forge', x: 93, z: 66.6, r: 24 },
      { kind: 'tavern', x: 77, z: 53.5, r: 20, region: 'The Crescent & Crown' },
      { kind: 'chapel', x: 97, z: 51, r: 75 },
      // The Old Mill's wheel (group 89: src/world/keepsights.ts).
      { kind: 'mill', x: 72.4, z: 87.4, r: 20 },
      { kind: 'marsh', poly: [[14, 105], [62, 105], [62, 124], [14, 124]], r: 22 },
      { kind: 'bittern', x: 30, z: 114, r: 60 },
      { kind: 'brook', pts: STREAM, r: 14 },
      { kind: 'rush', x: FORD.x, z: FORD.z, r: 18 },
      { kind: 'rush', x: 93, z: 78, r: 10, v: 0.5 },
      { kind: 'pines', poly: WOODS, r: 12 },
      { kind: 'banners', x: 47.5, z: 24.5, r: 22 },
      { kind: 'banners', x: 30, z: 41.5, r: 18, v: 0.8 },
      { kind: 'chains', x: 48.5, z: 24.5, r: 16 },
      { kind: 'chains', x: 56.5, z: 10.2, r: 12, v: 0.7 },
      { kind: 'larks', amb: ['fields', 'road'], when: 'dawn' },
      { kind: 'call', voice: 'crow', x: 14.5, z: 8.5, area: 4, r: 55, every: 6 },
      { kind: 'call', voice: 'crow', x: 30, z: 24, area: 12, r: 40, every: 5 },
      { kind: 'call', voice: 'crow', x: 46, z: 40, area: 3, r: 45, every: 9 },
      { kind: 'call', voice: 'crow', x: 46, z: 24.5, area: 4, r: 40, every: 12 },
      { kind: 'call', voice: 'crow', x: 86, z: 116, area: 8, r: 35, every: 12 },
      // (Where group 87's flocks graze: src/game/castlelife.ts.)
      { kind: 'call', voice: 'sheep', x: 99, z: 84, area: 5, r: 35, every: 8 },
      { kind: 'call', voice: 'sheep', x: 57, z: 96, area: 5, r: 35, every: 10 },
      { kind: 'call', voice: 'sheep', x: 112, z: 104, area: 5, r: 35, every: 12 },
      { kind: 'call', voice: 'cow', x: 95, z: 100, area: 3, r: 40, every: 20 },
      { kind: 'call', voice: 'goose', x: 75, z: 99, area: 2, r: 30, every: 16 },
      { kind: 'call', voice: 'goose', x: 92, z: 82, area: 2, r: 30, every: 18 },
      { kind: 'call', voice: 'swan', x: 4, z: 92, area: 6, r: 35, every: 15 },
      { kind: 'call', voice: 'duck', x: 49, z: 32, area: 8, r: 30, every: 20 },
      { kind: 'call', voice: 'duck', x: 6, z: 106, area: 4, r: 30, every: 12 },
      { kind: 'call', voice: 'heron', x: 65, z: 110, area: 3, r: 35, every: 28 },
      { kind: 'call', voice: 'frog', x: 70.5, z: 100.5, area: 4, r: 18, every: 3 },
      { kind: 'call', voice: 'rooster', x: 89, z: 92, area: 1, r: 60, every: 9, when: 'dawn' },
      { kind: 'call', voice: 'rooster', x: 66, z: 70, area: 2, r: 50, every: 12, when: 'dawn' },
    ],
    titleView: { x: 80, z: 66 },
    viewer: [79, 64.5],
    debugSpots: [[105.5, 105], [78, 66], [40, 78], [92, 32], [58, 16], [40, 26], [31, 18.5], [115.4, 7]],
    // The Great Tree, where the thorn road goes: seen from afar, so never under the mist.
    landmarks: [{ x: 117, z: -17.5, r: 7 }, ...sights.landmarks],
    borders: [{ id: 'thornroad', to: 'forest', arrive: 'thornroad', x: 116.6, z: -9.6, r: 1.4, out: { x: 115.6, z: 6.8, fx: -0.25, fz: 0.97 }, card: ['Blackpine', 'The Old Wood'] }],
  };
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
  // A porch over the door on two posts, lanterns either side.
  for (const px of [75.9, 78.1]) {
    shell.box(px, y, z1 + 1.05, 0.16, 2.35, 0.16, T0, { kind: K.Wood });
    grid.addCollider({ kind: 'c', x: px, z: z1 + 1.05, r: 0.12, y0: 0, y1: 4 });
    shell.beam([px, y + 1.9, z1 + 0.05], [px, y + 2.3, z1 + 0.7], 0.04, T0, { kind: K.Wood });
    shell.box(px, y + 1.55, z1 + 1.2, 0.2, 0.26, 0.2, PAL.iron, { kind: K.Metal });
    s.shellGlow.box(px, y + 1.58, z1 + 1.2, 0.14, 0.2, 0.14, GLOW.window, { kind: 1 });
  }
  shell.push().translate(77, y + 2.55, z1 + 0.62).rotateX(0.35);
  shell.box(0, 0, 0, 2.8, 0.08, 1.4, PAL.slate2, { kind: K.Slate });
  shell.pop();
  // Dormer windows in the south slope: rooms to let upstairs.
  for (const dx of [74.2, 80.2]) {
    const dy = y + H + 0.8, dz = z1 - 0.6;
    shell.box(dx, dy, dz - 0.5, 1.2, 1.0, 1.2, PAL.plaster, { kind: K.Plaster });
    shell.push().translate(dx, dy + 1.0, dz - 0.5).rotateY(Math.PI / 2);
    shell.gable(0, 0, 0, 1.5, 1.5, 0.6, PAL.slate2, PAL.plaster, { kind: K.Slate });
    shell.pop();
    s.shellGlow.box(dx, dy + 0.25, dz + 0.11, 0.5, 0.5, 0.04, dx > 77 ? GLOW.windowDim : [0.03, 0.035, 0.06], {});
    shell.box(dx, dy + 0.2, dz + 0.12, 0.62, 0.06, 0.06, T0, { kind: K.Wood });
  }
  b.bench(80.6, 57.8, 0);
  // Windows: back walls in core glow, front walls in shell glow.
  for (const [wx, on] of [[73.5, 0], [75, 1], [79.5, 0], [81, 1]]) s.shellGlow.box(wx, y + 1.1, z1 + 0.02, 0.55, 0.6, 0.06, on ? GLOW.window : [0.03, 0.035, 0.06], {});
  for (const [wz, on] of [[51.8, 0], [55.2, 1]]) s.shellGlow.box(x1 + 0.02, y + 1.1, wz, 0.06, 0.6, 0.55, on ? GLOW.windowDim : [0.03, 0.035, 0.06], {});
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
  g.box(x + 2.0, y + 3.5, z - 0.3, 0.1, 0.6, 0.1, PAL.stone, { kind: K.Rock });
  g.box(x + 2.0, y + 3.85, z - 0.3, 0.1, 0.1, 0.4, PAL.stone, { kind: K.Rock });
  g.blob(x - 0.8, y + 2.95, z + 0.4, 0.7, 0.14, 0.5, '#4a5e3a', 41, { kind: K.Leaves });
  g.blob(x + 1.1, y + 2.75, z + 0.7, 0.4, 0.1, 0.3, '#4a5e3a', 43, { kind: K.Leaves });
  D.candles(b, x - 0.7, y + 0.05, z + 1.45, 3);
  D.candles(b, x + 0.8, y + 0.05, z + 1.45, 2);
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
  // Shuttered window, a stone string course, stores stacked by the wall.
  for (const sg of [-1, 1]) g.box(x + 1.2 + sg * 0.34, y + 1.0, z + 1.54, 0.2, 0.62, 0.04, '#4a3424', { kind: K.Wood });
  g.box(x, y + 2.35, z + 1.55, 4.1, 0.14, 0.1, PAL.stoneDark, { kind: K.Brick });
  for (const [bx, bz] of [[x + 2.4, z + 0.9], [x + 2.5, z + 0.2]] as Pt[]) b.barrel(bx, bz);
  b.crate(x + 2.5, z - 0.6, 0.6);
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
    b.wall(s, x0, z0, x1, z1, base, H, 1.6, { slits: true, outerSign: outer, litSlits: outer === 1 });
    return s;
  };
  wall('wallN', 16, 8, 44, 8, -1);
  wall('wallW', 14, 10, 14, 38, -1);
  const wS = wall('wallS1', 16, 40, 44, 40, 1);
  const wE1 = wall('wallE1', 46, 10, 46, 21, 1);
  const wE2 = wall('wallE2', 46, 28, 46, 38, 1);
  // Long red banners down the outer walls, torches between them. Drawn into the
  // walls so they fade with them when the knight is behind.
  for (const bx of [21, 30, 39]) b.banner(bx, base + 0.4, 40.83, 0, MOON_CLOTH, 3.8, wS.core);
  b.banner(46.83, base + 0.4, 15, Math.PI / 2, MOON_CLOTH, 3.8, wE1.core);
  b.banner(46.83, base + 0.4, 33, Math.PI / 2, MOON_CLOTH, 3.8, wE2.core);
  for (const tx of [25.5, 34.5]) wallTorch(b, wS, tx, base + 2.8, 41.0, 0, 1);
  wallTorch(b, wE1, 47.0, base + 2.8, 11.5, 1, 0);
  wallTorch(b, wE2, 47.0, base + 2.8, 36.5, 1, 0);
  // A corbelled parapet along the outer faces: a projecting band on a row of stone brackets.
  const corbels = (s: Structure, x0: number, z0: number, x1: number, z1: number) => {
    const alongX = z0 === z1, len = alongX ? x1 - x0 : z1 - z0;
    s.core.box(alongX ? (x0 + x1) / 2 : x0 + 0.1, base + H - 0.3, alongX ? z0 + 0.1 : (z0 + z1) / 2, alongX ? len : 0.3, 0.25, alongX ? 0.3 : len, PAL.stoneDark, { kind: K.Brick });
    for (let t = 0.3; t < len; t += 0.6) s.core.box(alongX ? x0 + t : x0 + 0.05, base + H - 0.75, alongX ? z0 + 0.05 : z0 + t, alongX ? 0.22 : 0.22, 0.45, 0.22, PAL.stoneDark, { kind: K.Brick });
  };
  corbels(wS, 16, 40.8, 44, 40.8);
  corbels(wE1, 46.8, 10, 46.8, 19);
  corbels(wE2, 46.8, 30, 46.8, 38);
  // Buttresses between the slits on the south wall, stepping in as they rise.
  for (const bx of [23.5, 32.5, 41.5]) {
    wS.core.box(bx, base - 1, 41.1, 0.7, 2.6, 0.7, PAL.stoneDark, { kind: K.Brick });
    wS.core.box(bx, base + 1.6, 40.95, 0.6, 1.4, 0.4, PAL.stoneDark, { kind: K.Brick });
    wS.core.push().translate(bx, base + 3.0, 40.95).rotateX(-0.6);
    wS.core.box(0, 0, 0, 0.6, 0.12, 0.55, PAL.stone, { kind: K.Brick });
    wS.core.pop();
    grid.addCollider({ kind: 'b', x0: bx - 0.35, z0: 40.75, x1: bx + 0.35, z1: 41.45, y0: base - 5, y1: base + 3 });
  }
  // Gatehouse arch over the passage.
  {
    const s = b.structure('gatehouse', new THREE.Box3(new THREE.Vector3(44.5, base, 21), new THREE.Vector3(47.5, base + H + 1.5, 28)));
    const g = s.core;
    g.box(46, base + 3.2, 24.5, 1.8, H - 3.2 + 0.4, 5.4, PAL.stone, { kind: K.Brick });
    for (let i = 0; i < 4; i++) g.box(46, base + H + 0.4, 22.6 + i * 1.3, 1.8, 0.5, 0.6, PAL.stone, { kind: K.Brick });
    s.glow.box(46.95, base + 4.2, 24.5, 0.04, 0.5, 0.5, GLOW.sinister, {});
    // Dressed stones round the opening, and the portcullis teeth showing under the arch.
    for (let i = 0; i < 7; i++) {
      const a = (i / 6) * Math.PI, rz = 1.55, ry = 0.5;
      g.box(46.93, base + 2.7 + Math.sin(a) * ry, 24.5 - Math.cos(a) * rz, 0.1, 0.34, 0.42, '#a8a4b0', { kind: K.Rock });
    }
    for (const jz of [23.0, 26.0]) for (let q = 0; q < 4; q++) g.box(46.93, base + q * 0.7, jz, 0.1, 0.34, q % 2 ? 0.3 : 0.4, '#a8a4b0', { kind: K.Rock });
    for (let pz = 23.25; pz < 25.9; pz += 0.28) {
      g.box(46.35, base + 2.75, pz, 0.07, 0.45, 0.07, PAL.iron, { kind: K.Metal });
      g.pyramid(46.35, base + 2.62, pz, 0.08, 0.08, -0.14, PAL.iron);
    }
    g.box(46.35, base + 2.95, 24.5, 0.06, 0.07, 2.9, PAL.iron, { kind: K.Metal });
    b.banner(47.0, base + 1.2, 22.4, Math.PI / 2, MOON_CLOTH, 1.8);
    b.banner(47.0, base + 1.2, 26.6, Math.PI / 2, MOON_CLOTH, 1.8);
  }
  // Towers.
  const tower = (name: string, x: number, z: number, rad: number, h: number, banner = true) => {
    const s = b.structure(name, new THREE.Box3(new THREE.Vector3(x - rad, base - 2, z - rad), new THREE.Vector3(x + rad, base + h + rad * 2.4, z + rad)));
    b.roundTower(s, x, z, rad, base, h, { banner: banner ? MOON_CLOTH : undefined, windows: 5 });
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
    g.box(x + 0.45, base + 21.8, z, 0.8, 0.45, 0.03, MOON_CLOTH, { kind: K.Cloth, wind: 0.9 });
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
  for (const bx of [23.5, 27.5, 31.5]) b.banner(bx, y + 3.2, z0 + t + 0.03, 0, MOON_CLOTH, 2.4);
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
