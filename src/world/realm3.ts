import { K } from '../engine/materials';
import { fbm, mulberry32, smoothstep, type Rng } from '../engine/util';
import * as D from './details';
import type { Builder } from './builder';
import { Grid, NONE, S, T } from './grid';
import { Painter, distLine, insidePoly, type Pt } from './paint';
import type { EnemySpawn, ObjDef, RealmData, RegionDef } from './realm';
import { buildLighthouse, LAMP } from './lighthouse';
import { buildKingdom } from './kingdom';
import { buildReef, reefClear, reefIsleHeight } from './reef';
import { buildReefLife } from './reeflife';
import { buildErrands } from './errands';
import { buildSeaCaves } from './seacaves';
import { dressSeaBed } from './seabed';
import { wreck, anemone, boardwalk, brainCoral, branchCoral, bubbleColumn, bubbleVent, drownedArch, drownedColumn, drownedTower, dryingRack, floatLantern, kelp, ruinWall, salvageHeap, SEA, seaFan, seaRock, stiltHouse } from './sea';
import { buildInkGrotto } from './inkgrotto';
import { driftwood, fallenMast, kelpStand, knoll, longboat, marram, netRack, sailTent, wrack } from './sea';
import { dressReefStair, paintReefStair, REEF_STAIR, reefStairBare } from './seastair';
import { buildShoreLife } from './shorelife';

// ---------------------------------------------------------------------------
// Realm 3: the Sunken Reef (the prototype's third realm). 140 x 110. A drowned coast, about half land and
// half sea: the camera stays above, and the sea is clear water you look down into; walk off the strand
// into deep water and the knight goes down onto the sea floor (under the surface everything floats).
// Built in groups 28 to 36 of the realm 3 plan (board/plans/); its builder modules are listed in docs/code/architecture.md.
//
//   north-west   the strand: dunes, driftwood, rocks, a goblin camp (where you arrive)
//   offshore     the lighthouse isle (the goblins' salvage yard, Brassbelly the salvager and his diving suit),
//                out along a sandbar you can wade; two islets
//   under the sea, going out   reef flats and coral (1 to 4 m down), kelp groves (4 to 8 m), the drowned
//                plaza (its columns break the surface), the trench, an abyss in it
// The journey runs the other way from realms 1 and 2: from the top of the screen down toward the open
// sea on the camera's side (low: nothing tall hides it). Edges: sea cliffs along the far (north and west)
// edges, the open sea along the near ones, its floor falling away into the abyss.
// ---------------------------------------------------------------------------

export const MAP_W = 140;
export const MAP_D = 110;
const SEA_LEVEL = 0;

const ISLES: { x: number; z: number; r: number; h: number }[] = [
  { x: 100, z: 34, r: 7.5, h: 9 }, // the lighthouse isle (shaped by hand, see isleHeight)
  { x: 57, z: 88, r: 4.5, h: 6 }, // a green islet off the coral gardens
  { x: 127, z: 44.5, r: 2.2, h: 7 }, // the rock the ship broke on (clear of the Dune Strait)
];
/** The coral village ("the tide took our harbour; we built on the coral instead"): a shelf of coral just
 *  above the water where the shore bulges out, houses on stilts round its seaward side, boardwalks. */
const VILLAGE = { x: 37, z: 66, r: 8.5 };
/** The drowned kingdom: its streets on a terrace 4.5 m down, the plaza in the middle, towers on its far side
 *  breaking the surface. */
const KINGDOM: Pt[] = [[70, 79], [86, 72], [104, 74], [113, 83], [106, 93], [88, 99], [72, 93]];
/** Across the trench, the drowned palace (the Tidelord's hall comes with group 35; its ground is kept). */
const KINGDOM_RIM: Pt[] = [...KINGDOM, KINGDOM[0]];
const PALACE = { x: 122, z: 99, r: 9 };
/** The sunken ship, broken on its rock: the bow up on the shelf, the stern down toward the deep. */
const SHIP = { x: 121, z: 50, a: 0.55 };
/** The lighthouse isle: a flat salvage yard a metre above the water, a beach round it, and the rock the
 *  lighthouse stands on at its far (north-west) side. */
const YARD = { x: 100, z: 35, r: 5.8 };
const LIGHT = { x: 97, z: 29.5, r: 2.3 };
/** The sandbar out to the isle: wading-deep all the way, a hump or two of sand showing. */
const BAR: Pt[] = [[50, 27], [62, 31], [74, 31], [86, 34], [94, 35]];
/** The trench between the kingdom and the palace, 12 m down, sheer-sided: currents carry a diver over it. */
const TRENCH: Pt[] = [[48, 118], [70, 110], [92, 105], [108, 97], [116, 87], [126, 77], [136, 67], [150, 60]];
const ABYSS = { x: 121, z: 82, r: 3.2 };
/** Columns of bubbles up out of the trench (on its floor: either side of the crossing, and past the abyss; the
 *  second on the floor short of the abyss, out from under the currents). */
const LIFTS: Pt[] = [[104.8, 98.6], [114, 86.9], [132.5, 70.5]];
/** Currents over the trench, both ways between the kingdom's terrace and the palace's floor ("the currents know
 *  the way: ride them, not against them"). */
const CURRENTS: { pts: Pt[]; y: number; r: number; speed: number }[] = [
  { pts: [[104.5, 89.5], [118.5, 97]], y: -2.9, r: 1.6, speed: 6 },
  { pts: [[119, 93.5], [106, 85.5]], y: -3, r: 1.6, speed: 6 },
];
/** The coral gardens off the village's jetty: the reef at its brightest, coral packed close (sparse elsewhere). */
const GARDENS: Pt[] = [[46, 52], [62, 54], [67, 70], [61, 86], [49, 91], [44, 77]];
const KELP: Pt[] = [[58, 46], [84, 42], [106, 52], [104, 66], [86, 70], [62, 68]];
const PLAZA = { x: 90, z: 86, r: 7 };
/** Vents on the sea floor: their streams of bubbles are air pockets for a diver. */
const VENTS: Pt[] = [[64, 58], [92, 64], [80, 96], [110, 70]];
const START = { x: 12, z: 12 };
/** Stairfoot Cove, under the north-west cliffs where the Sea Stair comes down (the first of the Reef the knight sees):
 *  the sea come in from the west between two headlands, a beach shelving up from it toward the camera to the heights
 *  at the stair's foot. */
const COVE = { x: 4.8, z: 9.6, rx: 6, rz: 7.8 };
/** How far a point lies outside the cove's water (negative inside); the stair's moonfire and the realm's start kept
 *  on the beach. */
const coveDist = (x: number, z: number) =>
  Math.max((Math.hypot((x - COVE.x) / COVE.rx, (z - COVE.z) / COVE.rz) - 1) * Math.min(COVE.rx, COVE.rz) + (fbm(x * 0.22, z * 0.22, 2, 87) - 0.5) * 2.4, 2.4 - Math.hypot(x - START.x, z - START.z));
/** Beyond the west edge the cove opens to the open sea between two headlands (the cliffs falling back as they go). */
const coveMouth = (x: number, z: number, edgeH: number) =>
  z > 2.5 && z < 20.5 && (edgeH < 0 || Math.abs(z - 11.4) < 4.6 - x * 0.25 + (fbm(x * 0.3, z * 0.3, 2, 91) - 0.5) * 2.4);
const CAMP = { x: 36, z: 26 };
/** The Tide Serpent's prison: netted in the pool south of the sandbar, the nets' lines staked out on the bar and
 *  in the shallows west of the pool, where its keepers stand guard (src/game/serpent.ts). */
const PEN = { x: 79, z: 37.6 };
const PEN_STAKES: Pt[] = [[76.6, 33.5], [81.6, 33.5], [73.4, 37.2]];
/** The way on to the Scorched Dunes (realm 4): a channel out to the open sea at the east edge between two low
 *  reefs, falling away into the deep so that only the serpent swims it; shut until realm 4 is built (the area's
 *  name says so, and at the edge the serpent turns back). */
const STRAIT = { x: 136, z: 40 };

/** The lie of the land: high in the north-west, falling to the sea toward the south-east, islands offshore. */
function elevation(x: number, z: number) {
  const s = (x * 0.55 + z * 0.45) / (MAP_W * 0.55 + MAP_D * 0.45);
  let e = 4.4 - 11.5 * s + (fbm(x * 0.03, z * 0.03, 3, 71) - 0.5) * 4;
  for (const i of ISLES.slice(1)) e += i.h * Math.exp(-((Math.hypot(x - i.x, z - i.z) / i.r) ** 2));
  return e;
}

/** The lighthouse isle's own heights (NaN off it): the rock, the yard, the beach. */
function isleHeight(x: number, z: number) {
  const n = (fbm(x * 0.4, z * 0.4, 2, 75) - 0.5) * 1.2;
  if (Math.hypot(x - LIGHT.x, z - LIGHT.z) < LIGHT.r + n * 0.5) return 4;
  const d = Math.hypot(x - YARD.x, z - YARD.z) + n;
  if (d < YARD.r) return 1;
  if (d < YARD.r + 1.6) return 0.1;
  // East and south (the camera's side, and the reef where Cockle went down) the beach shelves into the sea: a wading
  // ledge, then the reef's own step down (the floor's smoothing, below), so a diver climbs out there. (Not north,
  // where the lens lies in the deep.)
  const a = Math.atan2(z - YARD.z, x - YARD.x);
  if (d < YARD.r + 2.8 && a > -0.6 && a < 2.9) return -0.3;
  return NaN;
}

/** Height from the lie of the land, in broad bands: the beach just above the water, wading shallows just
 *  below it (a walkable step between), then the reef going down in steps a floating jump climbs (1.2 m),
 *  and on land whole steps. */
function heightOf(e: number) {
  if (e >= 3) return Math.round(e);
  if (e >= 1.9) return 2;
  if (e >= 0.7) return 1;
  if (e >= 0) return 0.1;
  if (e >= -0.9) return -0.3;
  return -0.3 - 1.2 * Math.ceil((-0.9 - e) / 1.3);
}

/** The strand's patches (group 31): where the dunes' grass grows thick (marram in clumps, turf in the hollows), and
 *  where the heights' rock breaks through in crags; bare sand and heath between. */
const dunes = (x: number, z: number) => fbm(x * 0.1 + 3, z * 0.1, 2, 57);
const crags = (x: number, z: number) => fbm(x * 0.12 - 5, z * 0.12, 2, 59);

export function buildRealm3(builder: Builder): RealmData {
  const grid = builder.grid;
  const p = new Painter(grid);
  const b = builder;
  const r = mulberry32(3033);

  // ---------- land and sea floor ----------
  const sheer = new Uint8Array(grid.w * grid.d);
  p.each((x, z, i) => {
    const cx = x + 0.5, cz = z + 0.5;
    const e = elevation(cx, cz);
    let h = heightOf(e);
    const isle = isleHeight(cx, cz);
    const shelf = Math.hypot(cx - VILLAGE.x, cz - VILLAGE.z) + (fbm(x * 0.2, z * 0.2, 2, 81) - 0.5) * 3;
    const street = insidePoly(KINGDOM, cx, cz), palace = Math.hypot(cx - PALACE.x, cz - PALACE.z) < PALACE.r + (fbm(x * 0.25, z * 0.25, 2, 83) - 0.5) * 2 || inPrecinct(cx, cz);
    if (!Number.isNaN(isle)) h = isle;
    else if (shelf < VILLAGE.r) h = Math.max(h, 0.5);
    else {
      // The sandbar: wading-deep, here and there a hump of sand above the water.
      const bar = distLine(BAR, cx, cz) + (fbm(x * 0.25, z * 0.25, 2, 77) - 0.5) * 1.2;
      if (bar < 1.7) h = Math.max(h, bar < 0.7 && fbm(x * 0.3 + 5, z * 0.3, 2, 79) > 0.56 ? 0.1 : -0.3);
    }
    // The drowned kingdom's terrace, the palace's floor across the trench, the shelf the ship broke on.
    if (street) h = -4.5;
    // (Round its edge the reef comes down to meet it: a step you walk, not a lip you must jump.)
    else if (distLine(KINGDOM_RIM, cx, cz) < 2.2 && h > -4.1) h = -4.1;
    if (palace) h = -6;
    if (Math.hypot(cx - SHIP.x, cz - SHIP.z) < 6.5 && h < -1.5) h = -2.7;
    // The reef's own isles: the Whalebone Isle (the trial) and Gull Rock (the crew's diving rock; src/world/reef.ts).
    const reefIsle = reefIsleHeight(cx, cz);
    if (!Number.isNaN(reefIsle)) h = reefIsle;
    if (distLine(TRENCH, cx, cz) + (fbm(x * 0.2, z * 0.2, 2, 35) - 0.5) * 2.4 < 3.4 && !street && !palace) {
      h = Math.min(h, -12);
      sheer[i] = 1;
    }
    // The abyss: a hole in the trench's floor, wall to wall (no ledge left beside it to be stuck on).
    if (Math.hypot(cx - ABYSS.x, cz - ABYSS.z) < ABYSS.r + (fbm(x * 0.5, z * 0.5, 2, 37) - 0.5) * 1.2 || (sheer[i] && Math.hypot(cx - ABYSS.x, cz - ABYSS.z) < ABYSS.r + 2.6)) h = -30;
    grid.h[i] = h;
    grid.side[i] = S.Rock;
    const meadow = fbm(x * 0.09, z * 0.09, 2, 41), fine = fbm(x * 0.45 + 7, z * 0.45, 2, 43), grit = fbm(x * 0.6 - 3, z * 0.6, 1, 45);
    if (shelf < VILLAGE.r && h >= SEA_LEVEL) {
      // The village's coral, worn smooth where people walk, sand blown into its hollows.
      grid.t[i] = fine > 0.62 ? T.Sand : T.Coral;
    } else if (h >= SEA_LEVEL) {
      // The strand: sand by the water, dune grass above it, rock on the heights.
      grid.t[i] = h < 0.6 ? T.Sand : h < 2.5 ? (dunes(cx, cz) > 0.62 && fine > 0.3 ? T.Grass : T.Sand) : crags(cx, cz) > 0.6 || grit > 0.72 ? T.Rock : T.DarkGrass;
    } else {
      grid.water[i] = SEA_LEVEL;
      // The sea floor: sand in the shallows, seagrass and coral rubble on the reef flats, silt in the deep;
      // the kingdom's flagstones (silted over in drifts), the palace's.
      if (street || palace) grid.t[i] = grit > 0.66 ? T.Silt : fine > 0.7 ? T.Cobble : T.Flag;
      else grid.t[i] = h > -1 ? T.Sand : h > -4.5 ? (meadow > 0.52 && fine > 0.4 ? T.Seagrass : grit > 0.62 ? T.Coral : T.Sand) : grit > 0.74 ? T.Gravel : T.Silt;
      grid.noGrass[i] = h < -5 || street || palace ? 1 : 0;
    }
  });

  // Below the water every step is one a floating jump climbs (1.2 m): nowhere to be stuck in a pit. (Not the
  // abyss, which is a fall, nor the trench's sheer walls, which the bubble columns and currents get you out of.)
  for (let pass = 0; pass < 12; pass++)
    p.each((x, z, i) => {
      const h = grid.h[i];
      if (h >= SEA_LEVEL || h <= -29 || sheer[i]) return;
      let top = h;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= MAP_W || nz >= MAP_D) continue;
        const n = grid.h[grid.i(nx, nz)];
        if (n < SEA_LEVEL) top = Math.max(top, n);
      }
      if (top - h > 1.2) grid.h[i] = top - 1.2;
    });

  // The Dune Strait: two low reefs reach out almost to the east edge, the channel between them falling into the
  // deep. (Under half a metre high, and not on the edge itself: beyond the edge the outskirts stay open sea.)
  p.each((x, z, i) => {
    const ax = x + 0.5 - STRAIT.x, az = Math.abs(z + 0.5 - STRAIT.z) + (fbm(x * 0.3, z * 0.3, 2, 81) - 0.5) * 1.2;
    if (az > 4.6 && az < 6.6 && ax > -4.5 + fbm(x * 0.5, z * 0.5, 2, 83) * 2 && x < MAP_W - 1) {
      grid.h[i] = 0.2 + Math.round(fbm(x * 0.6 + 3, z * 0.6, 2, 85) * 2) * 0.12;
      grid.water[i] = NONE;
      grid.t[i] = T.Coral;
    } else if (az <= 4.6 && ax > -2) {
      grid.h[i] = -30;
      grid.t[i] = T.Silt;
      grid.noGrass[i] = 1;
    }
  }, STRAIT.x - 6, STRAIT.z - 8, MAP_W, STRAIT.z + 8);

  // ---------- what grows and lies there ----------
  const ground = (x: number, z: number) => grid.groundAt(x, z);
  // Paths: from the foot of the stair down the strand to the coral village, and out to the sandbar.
  p.path([[16, 17], [22, 30], [27, 44], [31, 56]], 1.8, T.Path, 0.5, 5, false);
  p.path([[22, 30], [34, 30], [46, 28], [51, 27.5]], 1.6, T.Path, 0.5, 7, false);
  const free = (x: number, z: number, rad: number) =>
    Math.hypot(x - START.x, z - START.z) > 5 && Math.hypot(x - CAMP.x, z - CAMP.z) > 7 && Math.hypot(x - YARD.x, z - YARD.z) > YARD.r + 2.5 && distLine(BAR, x, z) > 2.2
    && Math.hypot(x - VILLAGE.x, z - VILLAGE.z) > VILLAGE.r + 4 && !insidePoly(KINGDOM, x, z) && Math.hypot(x - PALACE.x, z - PALACE.z) > PALACE.r + 1
    && Math.hypot(x - SHIP.x, z - SHIP.z) > 8 && !VENTS.some(([vx, vz]) => Math.hypot(x - vx, z - vz) < rad + 1.5)
    && Math.hypot(x - PEN.x, z - PEN.z) > 7 && !(x > STRAIT.x - 8 && Math.abs(z - STRAIT.z) < 8)
    && reefClear(x, z, rad) && !inPrecinct(x, z);
  // Coral, 1 to 4.5 m down: packed close in the gardens (in clumps with sand between), a clump here and there
  // over the rest of the reef flats.
  for (let k = 0; k < 420; k++) {
    const inGarden = k < 320;
    const x = inGarden ? 44 + r() * 23 : 4 + r() * (MAP_W - 8), z = inGarden ? 52 + r() * 39 : 4 + r() * (MAP_D - 8), h = ground(x, z);
    if (inGarden !== insidePoly(GARDENS, x, z) || h > -0.9 || h < -4.5 || fbm(x * 0.09, z * 0.09, 2, 51) < (inGarden ? 0.36 : 0.58) || !free(x, z, 1)) continue;
    const u = r();
    if (u < 0.35) branchCoral(b, x, z, 0.6 + r() * 0.7, r() < 0.5 ? SEA.coralPink : SEA.coralOrange);
    else if (u < 0.55) seaFan(b, x, z, 0.7 + r() * 0.6, r() * Math.PI, r() < 0.6 ? SEA.coralPurple : SEA.coralPink);
    else if (u < 0.72) brainCoral(b, x, z, 0.6 + r() * 0.6);
    else anemone(b, x, z, 0.7 + r() * 0.5, r() < 0.5 ? SEA.coralTeal : SEA.coralPink, r() < 0.5 ? SEA.glowCyan : SEA.glowPink);
  }
  // The kelp: groves rising toward the light from 4 to 8 m down, clearings between.
  for (let z = 40; z < 80; z += 2.2)
    for (let x = 54; x < 110; x += 2.2) {
      const kx = x + r() * 1.8, kz = z + r() * 1.8, h = ground(kx, kz), grove = fbm(kx * 0.09, kz * 0.09, 2, 53);
      if (!insidePoly(KELP, kx, kz) || h > -2.5 || h < -9 || grove < 0.48 || r() > (grove - 0.43) * 2.2 || !free(kx, kz, 0.6)) continue;
      kelp(b, kx, kz, Math.min(-h - 0.6, 3.5 + r() * 3.5), 1 + Math.floor(r() * 3));
    }
  // Rocks with barnacles in the shallows. (The strand above the water is dressed zone by zone further down; its
  // draws are still taken here, so that what's placed after this stays where it was.)
  for (let k = 0; k < 120; k++) {
    const x = 3 + r() * (MAP_W - 6), z = 3 + r() * (MAP_D - 6), h = ground(x, z);
    if (!free(x, z, 1) || fbm(x * 0.07, z * 0.07, 2, 55) < 0.45) continue;
    const u = r();
    if (h > 0.3) {
      if (u < 0.35) r();
      else if (u < 0.55 && h < 2.5) {
        r();
        r();
      } else if (u < 0.85) r();
    } else if (h > -3) seaRock(b, x, z, 0.4 + r() * 0.7);
  }
  // The drowned plaza: columns of the sunken kingdom; the tallest stand out of the water.
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + r() * 0.3, d = PLAZA.r * (0.5 + r() * 0.45);
    const x = PLAZA.x + Math.cos(a) * d, z = PLAZA.z + Math.sin(a) * d, h = ground(x, z);
    if (h > -2 || h < -11) continue;
    drownedColumn(b, x, z, k % 3 === 0 ? -h + 2.2 : 3 + r() * 1.5, k % 3 !== 0 && r() < 0.5);
  }
  for (const [x, z] of VENTS) bubbleVent(b, x, z, true);

  // The coral village: houses on stilts round the shelf's seaward side, their porches to the green; a jetty
  // out over the deep between two of them, boats moored by it; kelp drying on the landward side; lamps of
  // glass floats. The green in the middle is left open (the reef's folk and their shrine come with group 34).
  for (const deg of [-52, -16, 22, 57, 92]) {
    const a = (deg * Math.PI) / 180, hx = VILLAGE.x + Math.cos(a) * 10.6, hz = VILLAGE.z + Math.sin(a) * 10.6;
    stiltHouse(b, hx, hz, a + Math.PI);
  }
  boardwalk(b, [44.2, 66.2], [57, 66.6], 1.7, 0.7);
  for (const [x, s] of [[47.5, 1], [51.5, -1], [55.5, 1]] as const) floatLantern(b, x, 66.4 + s * 1.05, 0.7);
  b.rowboat(50.5, -0.15, 68.6, 0.15);
  b.rowboat(54, -0.15, 64.5, -0.2);
  for (const deg of [148, 172, 196, 222]) {
    const a = (deg * Math.PI) / 180;
    dryingRack(b, VILLAGE.x + Math.cos(a) * 5.6, VILLAGE.z + Math.sin(a) * 5.6, a + Math.PI / 2);
  }
  for (const deg of [0, 120, 240]) {
    const a = ((deg + 30) * Math.PI) / 180;
    floatLantern(b, VILLAGE.x + Math.cos(a) * 4.4, VILLAGE.z + Math.sin(a) * 4.4);
  }

  // The drowned kingdom: the high street from the north-west into the plaza and on toward the trench, a cross
  // street, house footings along them with gaps (the doorways and lanes), an arch where the high street
  // starts, towers on its far side breaking the surface; coral and anemones on the old stones.
  const streets: [Pt, Pt][] = [[[75, 81], [84, 84.5]], [[96, 88.5], [106, 91]], [[89, 74.5], [89.5, 80]], [[90.5, 92.5], [89, 98]]];
  for (const [a, c] of streets) {
    const dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz), rot = Math.atan2(dz, dx), nx = -dz / len, nz = dx / len;
    for (const side of [-1, 1])
      for (let s = 0.8; s < len - 0.8; ) {
        const l = 2.4 + r() * 2.4;
        if (r() < 0.8) ruinWall(b, a[0] + (dx / len) * (s + l / 2) + nx * side * 2.6, a[1] + (dz / len) * (s + l / 2) + nz * side * 2.6, l, rot, 1.2 + r() * 1.1);
        s += l + 1.2 + r() * 1.4;
      }
  }
  drownedArch(b, 77.5, 82, Math.atan2(3.5, 9));
  for (const [x, z, rad, h] of [[74.5, 79, 1.6, 6.4], [87.5, 73.8, 1.4, 5.6], [101, 75.5, 1.7, 6]]) drownedTower(b, x, z, rad, h);
  // A secret with no path: the middle tower's top stands out of the water, and a column of bubbles beside it
  // lifts a diver onto it (a chest up there, and the whole kingdom below).
  const TOWER_TOP = { x: 87.5, z: 73.8 }, towerTop = ground(TOWER_TOP.x, TOWER_TOP.z) + 5.6;
  for (let zz = 72; zz <= 76; zz++)
    for (let xx = 85; xx <= 90; xx++) if (Math.hypot(xx + 0.5 - TOWER_TOP.x, zz + 0.5 - TOWER_TOP.z) < 1.25) grid.deck[grid.i(xx, zz)] = towerTop;
  bubbleColumn(b, TOWER_TOP.x + 2.3, TOWER_TOP.z + 0.9);
  for (let k = 0; k < 46; k++) {
    const x = 70 + r() * 44, z = 72 + r() * 28;
    if (!insidePoly(KINGDOM, x, z) || Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r - 1 || streets.some(([a, c]) => distLine([a, c], x, z) < 1.6)) continue;
    const u = r();
    if (u < 0.4) anemone(b, x, z, 0.6 + r() * 0.4, r() < 0.5 ? SEA.coralTeal : SEA.coralPink, r() < 0.5 ? SEA.glowCyan : SEA.glowPink);
    else if (u < 0.7) brainCoral(b, x, z, 0.5 + r() * 0.4);
    else seaRock(b, x, z, 0.4 + r() * 0.5);
  }
  // Across the trench, the drowned palace: the Tidelord's throne hall, its floodgate, the landing before it (see
  // buildPalace, below); the great bell that opens the gate hangs in the drowned plaza.
  const palace = buildPalace(b, grid);
  // The sunken ship on its rock: in by the breach, up the column of bubbles in the hold onto the bow deck; air
  // in the stern cabin.
  const ship = wreck(b, SHIP.x, SHIP.z, SHIP.a);
  bubbleColumn(b, ship.lift.x, ship.lift.z);
  // The trench: columns of bubbles up out of it (each to a little over the higher of its rims), and currents
  // over it both ways.
  const lifts = LIFTS.map(([x, z]) => {
    let rim = -99;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12)
      for (const d of [3.5, 4.5, 5.5]) {
        const h = ground(x + Math.cos(a) * d, z + Math.sin(a) * d);
        if (h > -11 && h < SEA_LEVEL) rim = Math.max(rim, h);
      }
    bubbleColumn(b, x, z);
    return { x, z, r: 1.3, top: rim + 0.8 };
  });
  lifts.push({ x: ship.lift.x, z: ship.lift.z, r: 1.2, top: grid.groundAt(SHIP.x + Math.cos(SHIP.a) * 4, SHIP.z + Math.sin(SHIP.a) * 4) + 0.4 });
  lifts.push({ x: TOWER_TOP.x + 2.3, z: TOWER_TOP.z + 0.9, r: 1.1, top: towerTop + 0.45 });
  // The lighthouse isle: the salvage yard (heaps of what the goblins have hauled up round its edge, the middle
  // clear: Brassbelly fights there). (The lighthouse on its rock, its stair and its keeper: src/world/lighthouse.ts.)
  // Steps cut up from the beach (the yard a metre above it, more than a stride): where the sandbar comes ashore (by
  // the keeper's skiff), on the south shore and on the east, between the heaps.
  p.ramp(93, 33, 95, 35, 0, 0.1, 1, true, T.Flag);
  p.ramp(98, 40, 101, 42, 3, 0.1, 1, true, T.Flag);
  p.ramp(105, 33, 107, 36, 2, 0.1, 1, true, T.Flag);
  for (const [a, k] of [[0.3, 0], [1.2, 1], [2.3, 2], [3.4, 3], [4.6, 1], [5.5, 0]] as const)
    salvageHeap(b, YARD.x + Math.cos(a) * (YARD.r - 1.1), YARD.z + Math.sin(a) * (YARD.r - 1.1), k, a);
  b.rowboat(YARD.x - 3.5, ground(YARD.x - 3.5, YARD.z + 3.8), YARD.z + 3.8, 0.6);
  // The goblins' camp on the strand: a fire, a tent, nets drying.
  b.campfire?.(CAMP.x, CAMP.z);
  // The Dune Strait's reefs: barnacled rocks, and at their tips two broken columns of the drowned kingdom.
  for (let k = 0; k < 8; k++) seaRock(b, STRAIT.x - 3.5 + r() * 6, STRAIT.z + (k % 2 ? 1 : -1) * (5.1 + r() * 0.9), 0.4 + r() * 0.5);
  for (const s of [-1, 1]) drownedColumn(b, STRAIT.x + 2.6, STRAIT.z + s * 5.6, 3, true);

  // ---------- the strand, the camp, the kelp forest, the islets, the wreck's mast (group 31) ----------
  // Drawn with a random stream of their own, so that the props drawn before and after them stay as they were.
  const keepRng = b.rng;
  const q = (b.rng = mulberry32(3131));
  const nearPath = (x: number, z: number, m: number) => [0, 1, 2, 3, 4, 5, 6, 7].some((k) => grid.typeAt(x + Math.cos(k * 0.785) * m, z + Math.sin(k * 0.785) * m) === T.Path);
  const clear = (x: number, z: number, rad: number) => free(x, z, rad) && !(x < 20 && z < 20) && Math.hypot(x - CAMP.x, z - CAMP.z) > 10.5 && Math.hypot(x - CAMP.x - 9.5, z - CAMP.z - 8.2) > 3.5 && !nearPath(x, z, rad + 0.8) && grid.typeAt(x, z) !== T.Path;
  const land = (x: number, z: number) => grid.waterAt(x, z) === NONE;
  // The tide line: wrack heaped along the water's edge in stretches, bare sand between; driftwood among it, and
  // higher up the beach, where the storms left it.
  for (let z = 1; z < MAP_D - 1; z++)
    for (let x = 1; x < MAP_W - 1; x++) {
      const cx = x + 0.5, cz = z + 0.5, h = ground(cx, cz);
      if (!land(cx, cz) || h > 0.6 || fbm(cx * 0.07, cz * 0.07, 2, 65) < 0.5) continue;
      let nx = 0, nz = 0;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (!land(cx + dx, cz + dz)) (nx += dx), (nz += dz);
      if (!nx && !nz) continue;
      const nl = Math.hypot(nx, nz), along = Math.atan2(nz, nx) + Math.PI / 2, wx = cx - (nx / nl) * 0.4 + (q() - 0.5) * 0.6, wz = cz - (nz / nl) * 0.4 + (q() - 0.5) * 0.6;
      if (!clear(wx, wz, 1)) continue;
      const u = q();
      if (u < 0.3) wrack(b, wx, wz, 1.2 + q() * 2.2, along + (q() - 0.5) * 0.4);
      else if (u < 0.36) driftwood(b, wx - (nx / nl) * (1 + q() * 2), wz - (nz / nl) * (1 + q() * 2), 1.4 + q() * 2.6, along + (q() - 0.5) * 0.9);
    }
  // The dunes: marram in clumps of every size where the dunes' grass grows (turf in the hollows among them), bare
  // sand between; at their foot a log or two thrown up by a storm.
  for (let z = 2; z < MAP_D - 2; z += 4.4)
    for (let x = 2; x < MAP_W - 2; x += 4.4) {
      const cx = x + q() * 3.6, cz = z + q() * 3.6, h = ground(cx, cz), d = dunes(cx, cz);
      if (!land(cx, cz) || h < 0.05 || h > 2.6 || d < 0.45 || q() > (d - 0.42) * 3 || !clear(cx, cz, 1.2)) continue;
      const n = 1 + Math.floor(q() * q() * 13), spread = 0.35 + n * 0.17;
      for (let k = 0; k < n; k++) {
        const a = q() * Math.PI * 2, rr = Math.sqrt(q()) * spread, tx = cx + Math.cos(a) * rr, tz = cz + Math.sin(a) * rr;
        if (land(tx, tz) && ground(tx, tz) > 0.05 && grid.typeAt(tx, tz) !== T.Path) marram(b, tx, tz, 0.75 + q() * 0.55);
      }
      if (h > 0.6 && q() < 0.06) driftwood(b, cx + 2, cz + 1, 2 + q() * 2.4, q() * Math.PI);
    }
  // The heights: knolls of rock where the crags break through, boulders round them, heather in clumps on the heath
  // between, loose stones.
  for (let z = 2; z < MAP_D - 2; z += 5)
    for (let x = 2; x < MAP_W - 2; x += 5) {
      const cx = x + q() * 3.5, cz = z + q() * 3.5, h = ground(cx, cz), c = crags(cx, cz);
      if (!land(cx, cz) || h < 2.5 || !clear(cx, cz, 2)) continue;
      if (c > 0.6 && q() < 0.8) knoll(b, cx, cz, 0.8 + q() * 0.6, q() * Math.PI);
      else if (c > 0.47 && c < 0.6 && q() < 0.6)
        for (let k = 0, n = 2 + Math.floor(q() * 4); k < n; k++) b.bush(cx + (q() - 0.5) * 2.6, cz + (q() - 0.5) * 2.6, 0.45 + q() * 0.35, q() < 0.5 ? '#4a4a3a' : '#5a4a4e');
      else if (c > 0.55) D.pebbles(b, cx, cz, 4);
    }
  // The goblins' camp: two tents of old sailcloth on the far side of the fire, a net hung to dry, barrels and crates
  // of what they've salvaged, their longboat drawn up on the beach below (the fire and the crew's ground kept clear).
  sailTent(b, CAMP.x - 5.6, CAMP.z - 4.4, Math.atan2(4.4, 5.6));
  sailTent(b, CAMP.x - 0.6, CAMP.z - 5.6, Math.atan2(5.6, 0.6) + 0.15, 2.5);
  netRack(b, [CAMP.x + 5.5, CAMP.z - 3.5], [CAMP.x + 9, CAMP.z - 7]);
  for (const [dx, dz] of [[1.6, -6.2], [2.3, -6.6]]) b.barrel(CAMP.x + dx, CAMP.z + dz);
  b.crate(CAMP.x + 2.9, CAMP.z - 5.7, 0.7);
  b.crate(CAMP.x + 3.5, CAMP.z - 6.4, 0.55);
  b.barrel(CAMP.x - 6.8, CAMP.z - 0.6);
  longboat(b, CAMP.x + 9.5, CAMP.z + 8.2, -0.35);
  // The green islet: a knoll at its top, thrift in a clump, marram round it. The ship's rock: crags crusted with
  // barnacles, the ship's mainmast fallen across it.
  knoll(b, ISLES[1].x - 0.8, ISLES[1].z - 1, 0.75, 0.6);
  for (let k = 0; k < 4; k++) b.bush(ISLES[1].x + 1 + q() * 1.6, ISLES[1].z - 1.4 + q() * 1.4, 0.4 + q() * 0.3, '#4a5a3a');
  for (let k = 0; k < 7; k++) {
    const a = q() * Math.PI * 2, d = 2 + q() * 1.6, tx = ISLES[1].x + Math.cos(a) * d, tz = ISLES[1].z + Math.sin(a) * d;
    if (land(tx, tz)) marram(b, tx, tz, 0.8 + q() * 0.4);
  }
  knoll(b, ISLES[2].x + 0.6, ISLES[2].z - 0.9, 0.9, 2.2);
  for (let k = 0; k < 6; k++) {
    const a = -1.6 + q() * 3.6, d = 2.2 + q() * 1.4;
    seaRock(b, ISLES[2].x + Math.cos(a) * d, ISLES[2].z + Math.sin(a) * d, 0.5 + q() * 0.6);
  }
  {
    const dx = ISLES[2].x - ship.mast.x, dz = ISLES[2].z - ship.mast.z, l = Math.hypot(dx, dz), tx = ship.mast.x + (dx / l) * (l - 1.5), tz = ship.mast.z + (dz / l) * (l - 1.5);
    fallenMast(b, [ship.mast.x, ship.mast.y, ship.mast.z], [tx, ground(tx, tz) + 0.3, tz]);
  }
  // The kelp forest, the reef's woods: its stands packed close in the groves, thinning toward the clearings between,
  // its edge ragged (in and out of the line the forest keeps to); under the groves the floor darker with fallen fronds.
  const KELP_RIM: Pt[] = [...KELP, KELP[0]];
  for (let z = 36; z < 82; z += 1.5)
    for (let x = 50; x < 114; x += 1.5) {
      const kx = x + q() * 1.3, kz = z + q() * 1.3, h = ground(kx, kz), grove = fbm(kx * 0.09, kz * 0.09, 2, 53);
      const edge = (insidePoly(KELP, kx, kz) ? 1 : -1) * distLine(KELP_RIM, kx, kz) + (fbm(kx * 0.15, kz * 0.15, 2, 67) - 0.5) * 10;
      if (edge < 0 || h > -2.5 || h < -9.5 || grove < 0.4 || q() > (grove - 0.4) * 5 || !free(kx, kz, 0.8)) continue;
      kelpStand(b, kx, kz, Math.min(-h - 0.45, 4 + q() * 4), 2 + Math.floor(q() * Math.min(4, (grove - 0.38) * 14)));
      if (grove > 0.5) {
        const i = grid.i(Math.floor(kx), Math.floor(kz));
        if (grid.t[i] === T.Silt || grid.t[i] === T.Sand) grid.t[i] = T.Seagrass;
      }
    }
  b.rng = keepRng;

  // ---------- data ----------
  const enemies: EnemySpawn[] = [
    // Goblins on the strand (the divers and the sea's own creatures come in group 32).
    { type: 'goblin', x: CAMP.x + 2, z: CAMP.z + 1, group: 'camp' },
    { type: 'goblin', x: CAMP.x - 2, z: CAMP.z + 2, group: 'camp' },
    { type: 'archer', x: CAMP.x + 3, z: CAMP.z - 3, group: 'camp', guard: true },
    // Brassbelly the salvager and his crew, in the salvage yard: felled, he drops his diving suit.
    { type: 'salvager', x: YARD.x, z: YARD.z, group: 'salvager' },
    { type: 'goblin', x: YARD.x - 2.5, z: YARD.z + 2, group: 'salvager' },
    { type: 'goblin', x: YARD.x + 2.6, z: YARD.z + 1.4, group: 'salvager' },
    { type: 'shield', x: YARD.x + 1, z: YARD.z - 3, group: 'salvager' },
    // The crew on the strand: more at the camp, harpooners by the way to the sandbar and on it, divers in the deep either side (the serpent's keepers guard the bar's middle).
    { type: 'shield', x: CAMP.x - 3.6, z: CAMP.z - 2.6, group: 'camp' },
    { type: 'harpooner', x: 46, z: 30.5, guard: true },
    { type: 'harpooner', x: 30, z: 41 },
    { type: 'harpooner', x: 66, z: 31.6, guard: true },
    { type: 'diver', x: 64, z: 37 },
    { type: 'diver', x: 90, z: 41 },
    // The coral gardens: divers in pairs, crabs on the open sand, pufferfish by the coral.
    { type: 'diver', x: 60, z: 60 },
    { type: 'diver', x: 61.5, z: 61.2 },
    { type: 'diver', x: 52, z: 82 },
    { type: 'diver', x: 53.5, z: 83.2 },
    { type: 'crab', x: 58, z: 72 },
    { type: 'crab', x: 65.5, z: 80.5 },
    { type: 'puffer', x: 56.5, z: 64.5 },
    { type: 'puffer', x: 49.5, z: 75 },
    // The kelp forest: jellies drifting (two in a clearing), eels at the groves' edges, a pufferfish, divers.
    { type: 'jelly', x: 72, z: 52 },
    { type: 'jelly', x: 88, z: 56 },
    { type: 'jelly', x: 89.5, z: 57.6 },
    { type: 'eel', x: 79.5, z: 62.5 },
    { type: 'eel', x: 96, z: 50 },
    { type: 'puffer', x: 82, z: 48 },
    { type: 'diver', x: 68, z: 64 },
    { type: 'diver', x: 69.5, z: 65.2 },
    // The drowned kingdom: crabs on the plaza, eels in the ruins, divers, a jelly; at its edge by the current over
    // the trench, an elite crab (the gauntlet's end).
    { type: 'crab', x: 87, z: 89 },
    { type: 'crab', x: 92.7, z: 84.3 },
    { type: 'eel', x: 80, z: 83 },
    { type: 'eel', x: 98, z: 91 },
    { type: 'diver', x: 84, z: 78 },
    { type: 'diver', x: 85.5, z: 79.2 },
    { type: 'jelly', x: 100, z: 82 },
    { type: 'crab', x: 101.5, z: 87.5, elite: true },
    // The wreck: a harpooner and a goblin on the bow deck, a crab in the hold.
    { type: 'harpooner', x: ship.bowChest.x - 0.8, z: ship.bowChest.z - 1.2, guard: true },
    { type: 'goblin', x: ship.lift.x + Math.cos(SHIP.a) * 2.6, z: ship.lift.z + Math.sin(SHIP.a) * 2.6 },
    { type: 'crab', x: SHIP.x - Math.cos(SHIP.a) * 2, z: SHIP.z - Math.sin(SHIP.a) * 2 },
    // The trench: jellies drifting along its floor.
    { type: 'jelly', x: 98, z: 103.5 },
    { type: 'jelly', x: 126, z: 75 },
    // The Tide Serpent's keepers, on the sandbar and the shallows round its pool.
    { type: 'goblin', x: 75.2, z: 32.6, group: 'serpent' },
    { type: 'goblin', x: 83.4, z: 33.2, group: 'serpent' },
    { type: 'shield', x: 71.6, z: 36.2, group: 'serpent' },
    { type: 'archer', x: 69.9, z: 32, group: 'serpent', guard: true },
    // The Tidelord's crew on the landing before his palace, and the Tidelord on his throne.
    ...palace.enemies,
  ];
  const objects: ObjDef[] = [
    { kind: 'moonfire', id: 'reefstair', name: 'The Foot of the Sea Stair', x: START.x + 2.5, z: START.z + 2.5 },
    { kind: 'moonfire', id: 'coralvillage', name: 'The Coral Village', x: VILLAGE.x - 3.4, z: VILLAGE.z },
    // The wreck's: a chest washed against the bow's rail, the captain's in his cabin.
    { kind: 'chest', id: 'r3_bow', x: ship.bowChest.x, z: ship.bowChest.z, rot: ship.bowChest.rot, coins: 35 },
    { kind: 'chest', id: 'r3_tower', x: TOWER_TOP.x - 0.3, z: TOWER_TOP.z - 0.2, rot: 0.8, coins: 50 },
    { kind: 'chest', id: 'r3_cabin', x: ship.cabinChest.x, z: ship.cabinChest.z, rot: ship.cabinChest.rot, coins: 50, power: 'bubble' },
    { kind: 'nets', id: 'serpent', x: PEN.x, z: PEN.z, stakes: PEN_STAKES },
    ...palace.objects,
  ];
  const under = (x: number, z: number) => grid.groundAt(x, z) < SEA_LEVEL - 0.6 && grid.waterAt(x, z) !== NONE;
  const regions: RegionDef[] = [
    { name: 'The Dune Strait', music: 'road', amb: 'sea', test: (x, z) => x > STRAIT.x - 7 && Math.abs(z - STRAIT.z) < 7 },
    { name: 'The Sunken Ship', music: 'keep', amb: 'sea', test: (x, z) => Math.hypot(x - SHIP.x, z - SHIP.z) < 9 },
    { name: 'The Abyss', music: 'hall', amb: 'sea', test: (x, z) => Math.hypot(x - ABYSS.x, z - ABYSS.z) < ABYSS.r + 2 },
    { name: 'The Trench', music: 'hall', amb: 'sea', test: (x, z) => distLine(TRENCH, x, z) < 4.5 && under(x, z) },
    { name: 'The Throne Hall', music: 'hall', amb: 'grotto', test: (x, z) => x > HALL.x0 && x < HALL.x1 && z > HALL.z0 && z < HALL.z1 && under(x, z) },
    { name: 'The Drowned Palace', music: 'hall', amb: 'sea', test: (x, z) => Math.hypot(x - PALACE.x, z - PALACE.z) < PALACE.r + 1 && under(x, z) },
    { name: 'The Drowned Plaza', music: 'keep', amb: 'sea', test: (x, z) => Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.r + 3 && under(x, z) },
    { name: 'The Drowned Kingdom', music: 'keep', amb: 'sea', test: (x, z) => insidePoly(KINGDOM, x, z) && under(x, z) },
    { name: 'The Coral Village', music: 'village', amb: 'harbour', test: (x, z) => (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r + 6 || (x > 43 && x < 58 && Math.abs(z - 66.4) < 2)) && !under(x, z) },
    { name: 'The Lighthouse Isle', music: 'road', amb: 'shore', test: (x, z) => Math.hypot(x - ISLES[0].x, z - ISLES[0].z) < ISLES[0].r + 2 && !under(x, z) },
    { name: 'The Sandbar', music: 'road', amb: 'shore', test: (x, z) => distLine(BAR, x, z) < 2.4 && !under(x, z) },
    { name: 'The Coral Gardens', music: 'fields', amb: 'sea', test: (x, z) => insidePoly(GARDENS, x, z) && under(x, z) },
    { name: 'The Kelp Forest', music: 'wilds', amb: 'sea', test: (x, z) => insidePoly(KELP, x, z) && under(x, z) },
    { name: 'The Reef Flats', music: 'fields', amb: 'sea', test: (x, z) => under(x, z) && grid.groundAt(x, z) > -5 },
    { name: 'The Deep', music: 'fields', amb: 'sea', test: (x, z) => under(x, z) },
    { name: 'The Strand', music: 'road', amb: 'shore', test: () => true },
  ];
  // The reef's people, quests and secrets (group 34: src/world/reef.ts).
  const reef = buildReef(b, grid, under);
  enemies.push(...reef.enemies);
  objects.push(...reef.objects);
  regions.unshift(...reef.regions);
  // The coral village's night: the inn, the market, the boatyard, fishers, children (src/world/reeflife.ts).
  const life = buildReefLife(b, grid, under, reef.npcs);
  enemies.push(...life.enemies);
  objects.push(...life.objects);
  regions.unshift(...life.regions);
  // The reef's errands: a bottle's map, the current race, glowing bait, a lost diver, the night raid (src/world/errands.ts).
  const errands = buildErrands(b, grid, under);
  // The sea cave, the grotto in the trench wall, the blowhole (group 36: src/world/seacaves.ts).
  const caves = buildSeaCaves(b, grid, under);
  enemies.push(...caves.enemies);
  objects.push(...caves.objects);
  regions.unshift(...caves.regions);
  // Life on the shore and the surface: the gulls' posts, the seals' skerries (src/world/shorelife.ts).
  buildShoreLife(b, grid);
  // The drowned kingdom's set pieces: the temple, the Kings' Way, the library, the treasury, the gardens, the harbour
  // wall (src/world/kingdom.ts).
  const kingdom = buildKingdom(b, grid, under);
  enemies.push(...kingdom.enemies);
  objects.push(...kingdom.objects);
  regions.unshift(...kingdom.regions);
  // The floor's own life: starfish, urchins, sea cucumbers, shells, in clumps (src/world/seabed.ts).
  // The lighthouse, its stair and its keeper's quest (src/world/lighthouse.ts).
  const light = buildLighthouse(b, grid, under);
  enemies.push(...light.enemies);
  objects.push(...light.objects);
  regions.unshift(...light.regions);
  // Old Inkarm's grotto in the trench's wall west of the kingdom (src/world/inkgrotto.ts).
  const grotto = buildInkGrotto(b, grid, under);
  enemies.push(...grotto.enemies);
  objects.push(...grotto.objects);
  regions.unshift(...grotto.regions);
  lifts.push(...grotto.lifts);
  dressSeaBed(b, grid);
  // Stairfoot Cove, at the foot of the Sea Stair (cut after everything else is placed, so that nothing shifts).
  cutCove(b, grid);
  regions.unshift({ name: 'Stairfoot Cove', music: 'fields', amb: 'sea', test: (x, z) => coveDist(x, z) < 0.5 && x < 14 && under(x, z) });
  // Where boardwalks and platforms built by different hands leave a lone cell of water boxed in by planks or land,
  // board it over: a diver dropped into it could never climb back out.
  for (let z = 1; z < MAP_D - 1; z++)
    for (let x = 1; x < MAP_W - 1; x++) {
      const i = grid.i(x, z);
      if (grid.deck[i] !== NONE || grid.water[i] === NONE || grid.h[i] >= SEA_LEVEL) continue;
      const tops = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => grid.cellTop(x + dx, z + dz, x + dx + 0.5, z + dz + 0.5));
      // (A side is shut by planks or land above the water, or by something solid standing in it: a house's stilts.)
      const shut = (k: number, dx: number, dz: number) =>
        tops[k] >= SEA_LEVEL || grid.collidersNear(x + dx + 0.5, z + dz + 0.5).some((c) => c.on && c.kind === 'c' && c.y1 > grid.h[i] + 1 && Math.hypot(x + dx + 0.5 - c.x, z + dz + 0.5 - c.z) < c.r);
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dz], k) => shut(k, dx, dz))) grid.deck[i] = Math.min(...tops.filter((t) => t > SEA_LEVEL + 0.4).concat([0.7]));
    }

  return {
    id: 'aqua',
    w: MAP_W,
    d: MAP_D,
    grid,
    builder,
    start: START,
    // Up the Sea Stair in the north-west corner to Whisperwood.
    borders: [REEF_STAIR],
    // (No land beasts here: the horse and the stag wait above the sea stair.)
    horse: null,
    sea: { surface: SEA_LEVEL, deep: -12, pockets: [...VENTS.map(([x, z]) => ({ x, z, r: 1.4 })), { x: ship.cabin.x, z: ship.cabin.z, r: 1.6 }, ...palace.pockets, ...grotto.pockets], currents: [...CURRENTS, ...errands.currents], lifts },
    enemies,
    npcs: [...reef.npcs, ...life.npcs, ...errands.npcs, ...caves.npcs, ...light.npcs],
    inn: life.inn,
    // The lighthouse's lamp hums once it's lit.
    hums: [{ x: LAMP.x, y: LAMP.y, z: LAMP.z, flag: 'lampLit' }],
    trial: reef.trial,
    objects,
    regions,
    waterPoints: [],
    grassDensity: (x, z) => {
      const t = grid.typeAt(x, z);
      return t === T.Seagrass ? 2.4 : t === T.Grass ? 1.6 : 0;
    },
    grassScale: () => 1.2,
    fireflyZones: [],
    critters: [],
    afterOutskirts: caves.afterOutskirts,
    titleView: { x: 60, z: 50 },
    debugSpots: [[START.x, START.z], [CAMP.x, CAMP.z], [70, 31], [YARD.x, YARD.z], [80, 60], [86, 88], [96, 94], [PEN.x - 2, PEN.z - 4]],
    foeHp: 2.25,
    // Giant clams: in the gardens, in the kingdom, in the wreck's hold.
    clams: [[57, 58], [62, 70], [48, 86], [78, 90], [96, 79.5], [SHIP.x - Math.cos(SHIP.a) * 4.6, SHIP.z - Math.sin(SHIP.a) * 4.6]],
    arena: palace.arena,
  };
}

/** Stairfoot Cove (group 36): the Sea Stair comes down the cliff over it, so it's the first of the Reef the knight
 *  sees. Sheer rock on its far side, deep right to the cliffs' feet; toward the camera a beach shelving up 0.4 m a
 *  metre to the heights where the stair comes down (low, so nothing in front hides the water), sand by the stair's
 *  moonfire, shingle further round, the wading shallows along it; rocks fallen from the cliffs standing in the
 *  water, wrack and driftwood on the beach, the reef's folk's old landing for whoever comes down the stair (posts,
 *  a boat, a lamp). Its own random stream. */
function cutCove(b: Builder, grid: Grid) {
  const keep = b.rng, r = (b.rng = mulberry32(3838));
  // How far round toward the camera a point lies from the cove's middle: 0 under the cliffs, 1 on the beach.
  const near = (x: number, z: number) => {
    const dx = x - COVE.x, dz = z - COVE.z;
    return smoothstep(-0.25, 0.55, ((dx + dz) * 0.7071) / (Math.hypot(dx, dz) || 1));
  };
  const p = new Painter(grid);
  p.each((x, z, i) => {
    // (The corner under the stair's head stays rock, as high as the stair beside it: a buttress of the cliff, a
    // lookout over the cove. What the game keeps parked out of sight at the world's origin stays buried in it.)
    if (x <= 1 && z <= 1) {
      grid.h[i] = Math.max(grid.h[i], 10);
      grid.t[i] = T.Rock;
      return;
    }
    // (Under the stair's upper flights the water comes right to the cliff's foot: no ledge there to jump down onto
    // and be stranded on.)
    const cx = x + 0.5, cz = z + 0.5, d = z <= 2 && x <= 7 ? Math.min(coveDist(cx, cz), -0.6) : coveDist(cx, cz), n = near(cx, cz);
    if (d >= 0) {
      // (The stair's foot stays as it was: its steps are cut to meet it.)
      if (x >= 9 && z < 2) return;
      const h = 0.1 + Math.round(((1 - n) * 5.6 + 0.42 * d) / 0.4) * 0.4;
      if (h >= grid.h[i]) return;
      grid.h[i] = h;
      if (grid.t[i] === T.Path || h > 2.5) return;
      grid.t[i] = n < 0.45 || fbm(cx * 0.35, cz * 0.35, 2, 93) > 0.66 ? T.Rock : Math.hypot(cx - START.x, cz - START.z) < 7.5 ? T.Sand : T.Gravel;
      return;
    }
    // The water: a wading margin along the beach (none under the cliffs, deep at their feet), then down in steps.
    const dd = -d + (1 - n) * 1.6;
    grid.h[i] = dd < 1.2 ? -0.3 : Math.max(-5.2, -0.3 - 1.1 * Math.ceil((dd - 1.2) / 1.3));
    grid.water[i] = SEA_LEVEL;
    grid.t[i] = grid.h[i] > -1 ? T.Sand : fbm(cx * 0.3, cz * 0.3, 2, 89) > 0.55 ? T.Seagrass : grid.h[i] > -3 ? T.Sand : T.Silt;
    grid.noGrass[i] = 0;
  }, 0, 0, 22, 30);
  // Below the water every step one a floating jump climbs (1.2 m), as on the rest of the sea floor.
  for (let pass = 0; pass < 6; pass++)
    p.each((x, z, i) => {
      if (grid.water[i] === NONE || grid.h[i] >= SEA_LEVEL) return;
      let top = grid.h[i];
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = grid.i(x + dx, z + dz);
        if (x + dx >= 0 && grid.water[j] !== NONE && grid.h[j] < SEA_LEVEL) top = Math.max(top, grid.h[j]);
      }
      if (top - grid.h[i] > 1.2) grid.h[i] = top - 1.2;
    }, 0, 0, 22, 30);
  const wet = (x: number, z: number) => grid.waterAt(x, z) !== NONE;
  // Blocks fallen from the cliffs, standing out of the water under them (as in the cove at the stair's head).
  for (const [x, z, s] of [[4.2, 4.4, 1.25], [7.6, 3.8, 0.9], [2.9, 6.3, 0.8]] as const) {
    const fl = b.y(x, z), top = 0.5 + s * 0.6;
    b.g(x, z).blob(x, (fl + top) / 2, z, 1.0 * s, (top - fl) / 2 + 0.25, 0.85 * s, s > 1 ? '#716d78' : '#5a5662', Math.round(x * 13 + z), { kind: K.Rock, jitter: 0.25 });
    b.collide({ kind: 'c', x, z, r: 0.85 * s, y0: fl - 1, y1: top + 0.2 });
  }
  // Barnacled rocks at the cliffs' feet, kelp rising from the deep middle, anemones by the fallen blocks.
  for (const [x, z, s] of [[6, 3, 0.7], [2.5, 9.5, 0.8], [2.6, 13.4, 0.6], [9.4, 5.2, 0.6]] as const) if (wet(x, z)) seaRock(b, x, z, s);
  for (const [x, z] of [[5.6, 7.2], [6.4, 9.6], [4.6, 10.4], [7.3, 8.4], [5.2, 12.6]] as const) {
    const fl = b.y(x, z);
    if (wet(x, z) && fl < -2) kelp(b, x, z, Math.min(-fl - 0.5, 2.2 + r() * 1.2), 2 + Math.floor(r() * 2));
  }
  for (const [x, z] of [[5.3, 5.4], [3.7, 7.4], [8.4, 5.4]] as const) if (wet(x, z) && b.y(x, z) < -0.8) anemone(b, x, z, 0.7 + r() * 0.3, r() < 0.5 ? SEA.coralTeal : SEA.coralPink, r() < 0.6 ? SEA.glowCyan : SEA.glowPink);
  // The beach: wrack along the tide line, driftwood thrown up above it, a boulder or two, marram on its upper edge.
  for (const [x, z, len, rot] of [[10.6, 10.2, 1.8, 1.5], [9.9, 16.4, 1.6, -0.7], [5, 16.9, 2.2, 0.1]] as const) wrack(b, x, z, len, rot);
  driftwood(b, 7.6, 19.8, 3.2, 0.4);
  driftwood(b, 3.6, 17.8, 1.8, -0.3);
  for (const [x, z, s] of [[4.6, 21.2, 0.7], [1.9, 17.7, 0.9], [12.4, 20.6, 0.5]] as const) b.rock(x, z, s);
  for (const [x, z, n] of [[3.4, 20.4, 6], [9.6, 21.6, 9], [13.4, 19.4, 4], [6.2, 22.4, 5]] as const)
    for (let k = 0; k < n; k++) {
      const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * (0.4 + n * 0.12), tx = x + Math.cos(a) * rr, tz = z + Math.sin(a) * rr;
      if (!wet(tx, tz) && grid.typeAt(tx, tz) !== T.Path) marram(b, tx, tz, 0.7 + r() * 0.5);
    }
  // The reef's folk's old landing, for whoever comes down the stair: the posts of a jetty whose planks are gone, a
  // boat drawn up on the shingle, and a lamp they keep lit on a post by it (warm against the sea's green).
  for (let k = 0; k < 4; k++) {
    const x = 10.4 - k * 0.9, z = 14 + k * 0.4, fl = b.y(x, z), top = 0.75 - k * 0.12 + (r() - 0.5) * 0.2;
    b.g(x, z).cyl(x, fl - 0.1, z, 0.1, 0.08, top - fl + 0.1, 6, '#4e3826', { kind: K.Wood });
    if (k > 0) b.g(x, z).cyl(x, -0.15, z, 0.11, 0.11, 0.3, 6, SEA.barnacle, { kind: K.Rock });
  }
  b.rowboat(6.4, b.y(6.4, 18.2) + 0.05, 18.2, 0.35);
  {
    const x = 10.9, z = 15.3, y = b.y(x, z), g = b.g(x, z), gl = b.gl(x, z);
    g.cyl(x, y - 0.1, z, 0.07, 0.06, 1.9, 6, '#4e3826', { kind: K.Wood });
    g.box(x - 0.18, y + 1.72, z, 0.42, 0.06, 0.06, '#4e3826', { kind: K.Wood });
    g.box(x - 0.34, y + 1.36, z, 0.2, 0.04, 0.2, '#3a3a3a', { kind: K.Rock });
    gl.box(x - 0.34, y + 1.48, z, 0.15, 0.2, 0.15, [2.4, 1.5, 0.6], { kind: 0 });
    g.box(x - 0.34, y + 1.61, z, 0.22, 0.05, 0.22, '#3a3a3a', { kind: K.Rock });
    b.lights.add(x - 0.34, y + 1.5, z, 0xffb060, 3, 6, 0.2);
    b.collide({ kind: 'c', x, z, r: 0.12, y0: y - 1, y1: y + 1.9 });
  }
  b.rng = keep;
}

/** Beyond the edges: sea cliffs along the far (north and west) edges, rising toward Whisperwood; along the
 *  near (south and east) edges the open sea, its floor falling away into the abyss (nothing tall on the
 *  camera's side). */
export function paintSeaOutskirts(grid: Grid, W: number, D: number) {
  for (let gz = grid.oz; gz < grid.oz + grid.d; gz++)
    for (let gx = grid.ox; gx < grid.ox + grid.w; gx++) {
      if (gx >= 0 && gz >= 0 && gx < W && gz < D) continue;
      const i = grid.i(gx, gz);
      const cx = Math.max(0, Math.min(W - 1, gx)), cz = Math.max(0, Math.min(D - 1, gz));
      const edgeH = grid.h[grid.i(cx, cz)];
      const out = Math.max(cx - gx, gx - cx, cz - gz, gz - cz);
      const n = fbm(gx * 0.1, gz * 0.1, 3, 61);
      grid.side[i] = S.Rock;
      grid.dir[i] = -1;
      if ((gx > W - 1 || gz > D - 1) && edgeH < SEA_LEVEL + 0.5) {
        // The open sea: the floor slopes away, then nothing.
        grid.h[i] = out <= 2 + Math.round(n * 3) ? Math.min(edgeH, -1) - out : -34;
        grid.water[i] = SEA_LEVEL;
        grid.t[i] = T.Silt;
      } else if (gx > W - 1 || gz > D - 1) {
        // Where the strand meets the near edges: dunes falling to the sea.
        grid.h[i] = Math.max(0.1, edgeH - out * 0.8);
        grid.t[i] = T.Sand;
      } else if (gx < 0 && coveMouth(gx + 0.5, gz + 0.5, edgeH)) {
        // Stairfoot Cove's mouth, out to the open sea: the floor falling away at once.
        grid.h[i] = out <= 2 ? -1.8 : -34;
        grid.water[i] = SEA_LEVEL;
        grid.t[i] = T.Silt;
      } else {
        // The sea cliffs.
        grid.h[i] = Math.round(Math.max(edgeH, 2) + 3 + out * 0.7 + n * 5);
        // (South of Stairfoot Cove's mouth a low headland, rising as it goes, so the sea shows past it.)
        if (gx < 0 && gz >= 14 && gz < 32) grid.h[i] = Math.min(grid.h[i], Math.round(Math.max(edgeH, 1) + 0.6 + out * 0.45 + n * 3 + Math.max(0, gz - 24) * 0.6));
        grid.t[i] = n > 0.55 ? T.DarkGrass : T.Rock;
      }
    }
  // The Sea Stair, cut down the cliff in the north-west corner.
  paintReefStair(grid);
}

export function decorateSeaOutskirts(b: Builder, grid: Grid, W: number, D: number, r: Rng) {
  for (let z = grid.oz; z < grid.oz + grid.d; z += 2.4)
    for (let x = grid.ox; x < grid.ox + grid.w; x += 2.4) {
      if (x > -1 && z > -1 && x < W && z < D) continue;
      const tx = x + r() * 1.8, tz = z + r() * 1.8;
      if (!grid.inside(Math.floor(tx), Math.floor(tz))) continue;
      const h = grid.groundAt(tx, tz), u = r();
      // (The Sea Stair kept clear, drawing what a bush there drew, so nothing else shifts.)
      if (reefStairBare(tx, tz)) {
        if (u < 0.4) r();
        continue;
      }
      // (The cliffs' tops and the brink are dressed in stretches by dressSeaEdges; here only kelp, in patches.)
      if (h < -2 && h > -9 && u < 0.25 && fbm(tx * 0.1, tz * 0.1, 2, 69) > 0.52) kelp(b, tx, tz, Math.min(-h - 0.6, 3 + r() * 3), 1 + Math.floor(r() * 2));
    }
  dressSeaEdges(b, grid, W, D);
  dressReefStair(b, grid);
}

/** The edges dressed in stretches, bare runs between (group 31): along the sea cliffs (north and west) boulders
 *  fallen at their foot, heather in clumps and crags on their tops; along the open sea (south and east) rocks
 *  tumbled down the brink where the floor falls away, kelp in groups at its lip, marram where the strand reaches
 *  the edge. Not in the far north-west corner, where the Sea Stair comes down. (Its own random stream.) */
function dressSeaEdges(b: Builder, grid: Grid, W: number, D: number) {
  const keep = b.rng, q = (b.rng = mulberry32(3232));
  const edges: { n: number; at: (s: number, o: number) => Pt; cliff: boolean }[] = [
    { n: W, at: (s, o) => [s, -o], cliff: true },
    { n: D, at: (s, o) => [-o, s], cliff: true },
    { n: W, at: (s, o) => [s, D + o], cliff: false },
    { n: D, at: (s, o) => [W + o, s], cliff: false },
  ];
  edges.forEach((e, k) => {
    for (let s = 1.5; s < e.n - 1.5; s += 1.8 + q() * 1.4) {
      const [ex, ez] = e.at(s, 0);
      if ((ex < 20 && ez < 20) || (k === 3 && Math.abs(s - STRAIT.z) < 9) || fbm(s * 0.06, k * 7.3, 2, 63) < 0.48) continue;
      const pick = (o: number) => {
        const [x, z] = e.at(s + (q() - 0.5) * 1.5, o);
        return { x, z, h: grid.groundAt(x, z), wet: grid.waterAt(x, z) !== NONE };
      };
      if (e.cliff) {
        // At the cliff's foot (just inside the edge), boulders fallen from it; on its top heather in clumps, crags.
        const foot = pick(-0.8 - q() * 1.2);
        if (q() < 0.45)
          for (let n = 2 + Math.floor(q() * 4), fs = 0.7 + q() * 0.5; n > 0; n--, fs *= 0.75) {
            const rx = foot.x + (q() - 0.5) * 2.2, rz = foot.z + (q() - 0.5) * 2.2;
            if (grid.waterAt(rx, rz) !== NONE) seaRock(b, rx, rz, fs);
            else b.rock(rx, rz, fs);
          }
        const top = pick(1.5 + q() * 5);
        if (q() < 0.2) knoll(b, top.x, top.z, 0.9 + q() * 0.6, q() * Math.PI);
        else if (q() < 0.55) for (let n = 2 + Math.floor(q() * 4); n > 0; n--) b.bush(top.x + (q() - 0.5) * 2.4, top.z + (q() - 0.5) * 2.4, 0.5 + q() * 0.4, q() < 0.5 ? '#4a4a3a' : '#5a4a4e');
        else if (q() < 0.4) marram(b, top.x, top.z, 0.9);
      } else {
        // Where the floor falls away: rocks tumbled down the brink, kelp at its lip; on land, marram.
        const lip = pick(1.5 + q() * 3.5);
        if (!lip.wet) {
          if (lip.h > 0 && q() < 0.6) for (let n = 1 + Math.floor(q() * 4); n > 0; n--) marram(b, lip.x + (q() - 0.5) * 2, lip.z + (q() - 0.5) * 2, 0.8 + q() * 0.4);
          continue;
        }
        if (q() < 0.45 && lip.h < -1.5 && lip.h > -9) for (let n = 1 + Math.floor(q() * 3); n > 0; n--) {
          const kx = lip.x + (q() - 0.5) * 2.5, kz = lip.z + (q() - 0.5) * 2.5, kh = grid.groundAt(kx, kz);
          if (kh < -1.5 && kh > -9) kelp(b, kx, kz, Math.min(-kh - 0.6, 2 + q() * 3), 2 + Math.floor(q() * 2));
        }
        for (let n = q() < 0.7 ? 2 + Math.floor(q() * 3) : 0; n > 0; n--) {
          const brink = pick(0.3 + q() * 2.6);
          if (brink.h > -12 && brink.h < -0.5) seaRock(b, brink.x, brink.z, 0.45 + q() * 0.7);
        }
        if (q() < 0.2 && lip.h < -1.2) seaFan(b, lip.x, lip.z, 0.6 + q() * 0.5, q() * Math.PI, q() < 0.5 ? SEA.coralPurple : SEA.coralPink);
      }
    }
  });
  b.rng = keep;
}

// ---------------------------------------------------------------------------
// The drowned palace (group 35): across the trench from the kingdom, on the floor 6 m down in the map's
// south-east corner. The currents over the trench bring a diver to the landing before its floodgate (and take
// him back from beside it), where the Tidelord's crew wait. The floodgate, in the throne hall's west wall, stays
// shut until the kingdom's great bell (in the drowned plaza) is rung; its towers break the surface, seen from
// across the trench. Inside, the throne hall: 14.5 by 15.5 m of open floor, its walls high on the far (north and
// west) sides, low on the camera's (2.2 m: more than a floating jump climbs, too low to hide anything); the
// throne on a dais against the north wall; vents breathing air in three corners (the fight would outlast a
// diver's air otherwise). The hall's east wall stands on the map's edge: beyond it, and beyond the landing's
// south edge, the open sea's floor falls away.
// ---------------------------------------------------------------------------

/** The throne hall's floor inside its walls, and its height. */
export const HALL = { x0: 124.5, z0: 88.5, x1: 139, z1: 104, y: -6 };
/** The floodgate in the hall's west wall: its middle, how wide, how high (the wall's height). */
export const FLOODGATE = { x: 124.05, z: 96, w: 4, h: 2.6 };
/** The drowned kingdom's great bell, in the middle of its plaza: where it hangs, and its beam's height. */
export const BELL = { x: 90, z: 86, top: 3.0 };
/** Vents breathing air: three in the hall's corners, one on the landing. */
const PALACE_VENTS: Pt[] = [[126.3, 102.3], [137.3, 102.3], [137.3, 90.5], [116, 102.6]];

/** The palace's precinct, laid at the hall's floor height: the hall, its walls, the strip before it. */
function inPrecinct(x: number, z: number) {
  return x > 123.4 && z > 87.4;
}

function buildPalace(b: Builder, grid: Grid) {
  const F = HALL.y, g = b.g(HALL.x0 + 7, HALL.z0 + 7), gl = b.gl(HALL.x0 + 7, HALL.z0 + 7), r = mulberry32(3535);
  const stone = (k: number) => (k % 3 ? SEA.stone : SEA.stoneDark);
  /** A wall of big drowned stones from (x0, z0) to (x1, z1) (one of them a thickness), h high, a coping on top,
   *  barnacles on it; solid to its top. */
  const wall = (x0: number, z0: number, x1: number, z1: number, h: number) => {
    const alongX = x1 - x0 > z1 - z0, len = alongX ? x1 - x0 : z1 - z0, n = Math.max(1, Math.round(len / 1.1));
    for (let k = 0; k < n; k++)
      for (let c = 0; c < Math.ceil(h / 0.55); c++) {
        const u0 = (k + (c % 2 ? 0.5 : 0)) / n, u1 = Math.min(1, (k + 1 + (c % 2 ? 0.5 : 0)) / n), yh = Math.min(0.55, h - c * 0.55);
        if (u0 >= 1 || yh <= 0) continue;
        if (alongX) g.box(x0 + (len * (u0 + u1)) / 2, F + c * 0.55, (z0 + z1) / 2, len * (u1 - u0) - 0.04, yh - 0.03, z1 - z0, stone(k + c), { kind: K.Brick });
        else g.box((x0 + x1) / 2, F + c * 0.55, z0 + (len * (u0 + u1)) / 2, x1 - x0, yh - 0.03, len * (u1 - u0) - 0.04, stone(k + c), { kind: K.Brick });
      }
    if (alongX) g.box((x0 + x1) / 2, F + h, (z0 + z1) / 2, len + 0.1, 0.18, z1 - z0 + 0.16, SEA.stoneDark, { kind: K.Rock });
    else g.box((x0 + x1) / 2, F + h, (z0 + z1) / 2, x1 - x0 + 0.16, 0.18, len + 0.1, SEA.stoneDark, { kind: K.Rock });
    for (let k = 0; k < len * 1.5; k++) {
      const u = r(), y = F + 0.3 + r() * (h - 0.4), side = r() < 0.5 ? 0 : 1;
      const x = alongX ? x0 + u * len : side ? x1 + 0.02 : x0 - 0.02, z = alongX ? (side ? z1 + 0.02 : z0 - 0.02) : z0 + u * len;
      g.cyl(x, y, z, 0.05, 0.03, 0.05, 5, SEA.barnacle, { kind: K.Rock });
    }
    b.collide({ kind: 'b', x0, z0, x1, z1, y0: F - 2, y1: F + h + 0.18 });
  };
  const FG = FLOODGATE, west = FG.x - 0.45, westIn = FG.x + 0.45;
  // The far wall, high; the rest low (the west wall faces the camera from the landing), broken by the
  // floodgate's towers.
  wall(west, 87.6, 140, HALL.z0, 4.4);
  wall(west, HALL.z0, westIn, FG.z - FG.w / 2 - 1.4, 2.2);
  wall(west, FG.z + FG.w / 2 + 1.4, westIn, 105, 2.2);
  wall(HALL.x1, HALL.z0, 140, 105, 2.2);
  wall(westIn, HALL.z1, HALL.x1, 105, 2.2);
  // The floodgate's towers, either side of it, breaking the surface; a beam across their tops for its winch.
  for (const s of [-1, 1]) {
    const tz = FG.z + s * (FG.w / 2 + 0.7);
    g.box(FG.x, F, tz, 1.4, 7.4, 1.4, SEA.stone, { kind: K.Brick, top: SEA.stoneDark });
    for (const yy of [2.2, 4.6]) g.box(FG.x, F + yy, tz, 1.5, 0.22, 1.5, SEA.stoneDark, { kind: K.Rock });
    g.box(FG.x, F + 7.4, tz, 1.6, 0.3, 1.6, SEA.stoneDark, { kind: K.Rock });
    for (let k = 0; k < 10; k++) g.cyl(FG.x + (r() < 0.5 ? -0.71 : 0.71), F + 0.4 + r() * 6.4, tz + (r() - 0.5) * 1.2, 0.05, 0.03, 0.05, 5, SEA.barnacle, { kind: K.Rock });
    // A glowing pearl set in each, either side of the gate.
    gl.box(FG.x - 0.72, F + 3.8, tz, 0.08, 0.22, 0.22, [1.6, 1.8, 2.2], { kind: 0 });
    b.collide({ kind: 'b', x0: FG.x - 0.7, z0: tz - 0.7, x1: FG.x + 0.7, z1: tz + 0.7, y0: F - 2, y1: F + 7.7 });
  }
  g.box(FG.x, F + 7.0, FG.z, 0.7, 0.4, FG.w + 0.2, SEA.stoneDark, { kind: K.Rock });
  g.cyl(FG.x - 0.1, F + 7.45, FG.z - 1, 0.32, 0.32, 0.2, 8, '#4f7a62', { kind: K.Metal });
  b.lights.add(FG.x - 1.4, F + 3.6, FG.z, 0x90d8e0, 2.2, 6, 0.1);
  // Pilasters along the far walls (none where the throne stands), weed hanging between them, pearls glowing in
  // the niches: the hall's own light.
  for (const x of [126.2, 129.2, 134.8, 137.8]) {
    g.box(x, F, HALL.z0 + 0.15, 0.7, 4.4, 0.4, SEA.stone, { kind: K.Brick, top: SEA.stoneDark });
    b.collide({ kind: 'b', x0: x - 0.35, z0: HALL.z0, x1: x + 0.35, z1: HALL.z0 + 0.36, y0: F - 1, y1: F + 4.4 });
  }
  for (const x of [127.7, 136.3]) {
    const z = HALL.z0 + 0.02;
    gl.box(x, F + 2.6, z, 0.3, 0.3, 0.06, [1.5, 1.7, 2.1], { kind: 0 });
    b.lights.add(x, F + 2.4, z + 1.2, 0x9ad8f0, 2.6, 7, 0.1);
    for (let k = 0; k < 3; k++) g.box(x - 0.5 + k * 0.5, F + 2.9 - k * 0.2, z + 0.06, 0.12, 1.4 + k * 0.3, 0.04, k % 2 ? SEA.kelp : SEA.kelpDark, { kind: K.Leaves, wind: 0.5 });
  }
  for (const [x, z] of [[128, 97], [135.5, 97]]) b.lights.add(x, F + 2.2, z, 0x7ad0e0, 2.2, 9, 0.1);
  // The throne: a dais a step up against the north wall, a seat of coral-crusted stone, its back a great clam's
  // shell standing open.
  for (let z = 88; z <= 90; z++) for (let x = 129; x <= 134; x++) grid.h[grid.i(x, z)] = F + 0.4;
  const TX = 131.8, D = F + 0.4;
  g.box(TX, D, 89.35, 2.2, 0.55, 0.7, SEA.stoneDark, { kind: K.Brick });
  g.box(TX, D + 0.55, 89.35, 2.3, 0.1, 0.76, SEA.stone, { kind: K.Rock });
  for (const s of [-1, 1]) g.box(TX + s * 1.05, D + 0.55, 89.35, 0.2, 0.5, 0.7, SEA.stone, { kind: K.Brick });
  for (let k = 0; k < 9; k++) {
    const a = Math.PI * (0.08 + (k / 8) * 0.84), rr = 1.6;
    g.beam([TX, D + 0.5, 88.75], [TX + Math.cos(a) * rr, D + 0.5 + Math.sin(a) * rr * 1.5, 88.7], 0.2, k % 2 ? '#c8b8a8' : '#a89888', { kind: K.Rock });
  }
  g.blob(TX, D + 1.4, 88.65, 1.3, 1.4, 0.2, '#b8a898', 3537, { kind: K.Rock });
  gl.box(TX, D + 2.4, 88.85, 0.32, 0.32, 0.1, [1.8, 1.9, 2.3], { kind: 0 });
  for (const s of [-1, 1]) branchCoral(b, TX + s * 1.6, 89.0, 0.7, SEA.coralPink);
  b.collide({ kind: 'b', x0: TX - 1.5, z0: HALL.z0 - 0.2, x1: TX + 1.5, z1: 89.0, y0: F - 1, y1: D + 3 });
  // Air: vents in three corners of the hall and one on the landing.
  for (const [x, z] of PALACE_VENTS) bubbleVent(b, x, z, true);
  // The landing before the floodgate, and the strip along the hall's foot: fallen columns, rocks.
  for (const [x, z] of [[117.2, 105.4], [121.8, 107.4], [127.5, 107.4], [134.5, 107.8]]) drownedColumn(b, x, z, 1.8, true);
  for (const [x, z] of [[114.2, 104.5], [131, 108.6]]) seaRock(b, x, z, 0.7);

  // The great bell's frame in the middle of the drowned plaza (the bell is the story's: see src/game/palace.ts):
  // two stone posts and a beam, coral grown up them.
  const bg = b.g(BELL.x, BELL.z), by = grid.groundAt(BELL.x, BELL.z);
  for (const s of [-1, 1]) {
    bg.box(BELL.x + s * 1.75, by - 0.1, BELL.z, 0.5, BELL.top + 0.45, 0.5, SEA.stone, { kind: K.Brick, top: SEA.stoneDark });
    bg.box(BELL.x + s * 1.75, by - 0.1, BELL.z, 0.8, 0.3, 0.8, SEA.stoneDark, { kind: K.Rock });
    b.collide({ kind: 'c', x: BELL.x + s * 1.75, z: BELL.z, r: 0.34, y0: by - 1, y1: by + BELL.top + 0.35 });
    branchCoral(b, BELL.x + s * 2.15, BELL.z + 0.3, 0.6, s < 0 ? SEA.coralOrange : SEA.coralPink);
  }
  bg.box(BELL.x, by + BELL.top, BELL.z, 4.1, 0.36, 0.44, SEA.stoneDark, { kind: K.Rock });

  const enemies: EnemySpawn[] = [
    { type: 'brute', x: 120.4, z: 96.2, group: 'garrison' },
    { type: 'shield', x: 119.6, z: 99.8, group: 'garrison' },
    { type: 'goblin', x: 117.4, z: 94.4, group: 'garrison' },
    { type: 'goblin', x: 121.4, z: 102.4, group: 'garrison' },
    { type: 'archer', x: 116.4, z: 99.6, group: 'garrison', guard: true },
    { type: 'tidelord', x: TX, z: 90.1, group: 'boss' },
  ];
  const arena: NonNullable<RealmData['arena']> = {
    x0: HALL.x0 + 1.1,
    z0: HALL.z0 + 0.1,
    x1: HALL.x1 - 0.1,
    z1: HALL.z1 - 0.1,
    y: F - 0.5,
    // (His crew come out beside the throne.)
    summons: [[128.2, 90.9], [135.4, 90.9]],
    dust: [HALL.x0, HALL.x1 - HALL.x0, F + 6, HALL.z0, HALL.z1 - HALL.z0],
    mountOut: [116.5, 97],
  };
  // A moonfire on the landing, by its vent (somewhere to rise again after a lost fight).
  const objects: ObjDef[] = [{ kind: 'moonfire', id: 'palacelanding', name: 'The Palace Landing', x: 118, z: 103.6 }];
  return { enemies, objects, pockets: PALACE_VENTS.map(([x, z]) => ({ x, z, r: 1.4 })), arena };
}
