import { fbm, type Rng } from '../engine/util';
import { PAL, type Builder } from './builder';
import { Grid, NONE, S, T } from './grid';
import { distLine, type Pt } from './paint';

// The land beyond the old map edge. It is real, walkable terrain; what stops
// the knight is always something you can see: mountain cliffs to the north and
// west, a gorge to the east of Blackpine, the deep Mirrow river along the east
// and south (its bridge broken), and Mirrormere to the west.

export type Biome = 'mountain' | 'forest' | 'lake' | 'marsh' | 'farm' | 'gorge' | 'meadow';

export function biomeAt(gx: number, gz: number, W: number, D: number): Biome {
  if (gz < 0) return gx < 66 ? 'mountain' : gx > W - 1 ? 'gorge' : 'forest';
  if (gx < 0) return gz < 80 ? 'mountain' : gz > D - 1 ? 'marsh' : 'lake';
  if (gz > D - 1) return gx < 62 ? 'marsh' : 'farm';
  if (gx > W - 1) return gz < 56 ? 'gorge' : 'meadow';
  return 'meadow';
}

/** The Mirrow: deep river round the east and south, draining into Mirrormere. */
export const RIVER: Pt[] = [
  [128, 57], [127.5, 80], [127.5, 104], [126, 118], [122, 125.5], [112, 128.5], [95, 129], [75, 128.5],
  [55, 129.5], [35, 128.5], [16, 127], [2, 124], [-8, 118],
];
const RIVER_HW = 4.2;
const RIVER_LEVEL = -0.35;

const LAKE = { x: -11, z: 100, rx: 21, rz: 27 };
const lakeD = (gx: number, gz: number) =>
  Math.hypot((gx - LAKE.x) / LAKE.rx, (gz - LAKE.z) / LAKE.rz) + (fbm(gx * 0.11, gz * 0.11, 3, 61) - 0.5) * 0.5;

/** The King's Road beyond the realm: to the broken bridge, and on past the river. */
export const OUTSKIRT_ROAD: Pt[][] = [
  [[119, 119], [118.5, 123.5]],
  [[118.5, 133], [121, 140], [125, 146]],
];

/** Where the King's Road leaves the realm over the (broken) Mirrow bridge. */
export const BRIDGE = { x: 118, z0: 123.2, z1: 133.5, breakZ0: 126.6, breakZ1: 130.2 };

/** Paint every cell outside the playable map (0..W, 0..D). */
export function paintOutskirts(grid: Grid, W: number, D: number) {
  for (let gz = grid.oz; gz < grid.oz + grid.d; gz++)
    for (let gx = grid.ox; gx < grid.ox + grid.w; gx++) {
      if (gx >= 0 && gz >= 0 && gx < W && gz < D) continue;
      const i = grid.i(gx, gz);
      const cx = Math.max(0, Math.min(W - 1, gx)), cz = Math.max(0, Math.min(D - 1, gz));
      const j = grid.i(cx, cz);
      const out = Math.max(cx - gx, gx - cx, cz - gz, gz - cz);
      const edgeH = grid.dir[j] >= 0 ? grid.h[j] + grid.rise[j] : grid.h[j];
      const n = fbm(gx * 0.1, gz * 0.1, 3, 71);
      const n2 = fbm(gx * 0.23 + 5, gz * 0.23, 2, 73);
      const set = (h: number, t: number) => {
        grid.h[i] = h;
        grid.t[i] = t;
        grid.side[i] = S.Rock;
        grid.dir[i] = -1;
      };
      const water = (level: number, bed: number) => {
        set(bed, T.Bed);
        grid.water[i] = level;
        grid.noGrass[i] = 1;
      };
      // Streams from inside the map run on into the river.
      if (grid.water[i] !== NONE) continue;

      // The river cuts across everything on its way round.
      const rd = distLine(RIVER, gx + 0.5, gz + 0.5) + (n2 - 0.5) * 1.4;
      if (rd < RIVER_HW) {
        const k = rd / RIVER_HW;
        water(RIVER_LEVEL, -2.4 + (RIVER_LEVEL - 0.28 + 2.4) * k * k * k);
        continue;
      }
      const bank = rd < RIVER_HW + 1.6;

      switch (biomeAt(gx, gz, W, D)) {
        case 'mountain': {
          // A cliff straight away, then rising, ridged peaks.
          const ridge = 1 - Math.abs(fbm(gx * 0.06, gz * 0.06, 4, 77) * 2 - 1);
          const h = Math.round(edgeH + 3 + out * 0.9 + ridge * ridge * 12 + n2 * 3);
          set(h, h > edgeH + 14 ? T.Snow : h > edgeH + 6 || n2 > 0.6 ? T.Rock : T.DarkGrass);
          break;
        }
        case 'forest':
          // Always at least 3 m over the realm's edge: too high to climb, even on the Thornstag
          // (its leap and step-up reach 2.75 m); beyond, it rolls on as it likes.
          set(Math.max(Math.ceil(edgeH + 3), Math.round(edgeH + 1 + out * 0.3 + n * 5 - 1.5)), n2 > 0.72 ? T.Rock : T.DarkGrass);
          break;
        case 'lake': {
          const d = lakeD(gx, gz);
          if (d < 1) water(-0.35, -1.7 + Math.max(0, d - 0.85) * 8);
          else if (d < 1.15) set(0, n2 > 0.5 ? T.Sand : T.Reeds);
          else set(Math.round(Math.min(11, 3 + (d - 1.15) * 9 + n * 3)), T.DarkGrass);
          break;
        }
        case 'marsh': {
          if (gz > 132) {
            set(Math.round(Math.max(0, (gz - 132) * 0.4 + n * 2 - 0.5)), T.DarkGrass);
            break;
          }
          const pond = fbm(gx * 0.17, gz * 0.17, 3, 79);
          if (pond > 0.56) water(-0.35, pond > 0.66 ? -1.3 : -0.65);
          else set(0, bank ? T.Reeds : pond > 0.5 ? T.Mud : n2 > 0.5 ? T.Moss : T.Reeds);
          break;
        }
        case 'farm': {
          const across = gz > 131;
          set(across ? Math.round((n - 0.5) * 1.2) : 0, T.Grass);
          const bx = Math.floor((gx + 3) / 9), bz = Math.floor((gz + 1) / 7);
          if (!bank && (bx * 7 + bz * 3) % 4 !== 0) {
            grid.t[i] = T.Field;
            grid.noGrass[i] = 1;
          }
          if (bank) grid.t[i] = T.Reeds;
          break;
        }
        case 'gorge': {
          // A narrow rim, then a sheer drop to a river far below.
          if (out < 3 && gz < 54) set(edgeH, n2 > 0.55 ? T.Rock : T.DarkGrass);
          else if (out < 15 && gz < 54) {
            if (out >= 6 && out <= 11) water(-12.6, -14);
            else set(-14 + (out < 6 ? 0 : 1), T.Rock);
          } else if (gz >= 54 && gz < 58) set(edgeH + 3, T.Rock);
          else set(Math.round(edgeH + n * 3 - 1), T.DarkGrass);
          break;
        }
        case 'meadow':
          set(Math.max(0, Math.round(edgeH + (n - 0.5) * 1.2)), bank ? T.Reeds : n2 > 0.8 ? T.Rock : T.Grass);
          break;
      }
    }
  // The King's Road runs to the broken bridge and on beyond the river.
  const road = OUTSKIRT_ROAD;
  for (const seg of road)
    for (let gz = 118; gz < grid.oz + grid.d; gz++)
      for (let gx = 110; gx < 132; gx++) {
        if (!grid.inside(gx, gz) || grid.water[grid.i(gx, gz)] !== NONE) continue;
        if (distLine(seg, gx + 0.5, gz + 0.5) < 1.3) {
          grid.t[grid.i(gx, gz)] = T.Path;
          grid.noGrass[grid.i(gx, gz)] = 1;
        }
      }
}

/** Scatter scenery (with colliders) over the outskirts. Before builder.finish(). */
export function decorateOutskirts(b: Builder, grid: Grid, W: number, D: number, r: Rng) {
  const wet = (x: number, z: number) => grid.waterAt(x, z) !== NONE;
  const nearWater = (x: number, z: number) => wet(x + 1.2, z) || wet(x - 1.2, z) || wet(x, z + 1.2) || wet(x, z - 1.2);
  const trodden = (x: number, z: number) => grid.inside(Math.floor(x), Math.floor(z)) && grid.t[grid.i(Math.floor(x), Math.floor(z))] === T.Path;
  const onPath = (x: number, z: number) => trodden(x, z) || trodden(x + 1.2, z) || trodden(x - 1.2, z) || trodden(x, z + 1.2) || trodden(x, z - 1.2);
  for (let z = grid.oz; z < grid.oz + grid.d; z += 1.5)
    for (let x = grid.ox; x < grid.ox + grid.w; x += 1.5) {
      if (x > -1 && z > -1 && x < W && z < D) continue;
      const tx = x + r() * 1.3, tz = z + r() * 1.3;
      if (!grid.inside(Math.floor(tx), Math.floor(tz)) || wet(tx, tz)) continue;
      if (Math.abs(tx - BRIDGE.x) < 3 && tz > 118) continue;
      const out = Math.max(-tx, -tz, tx - W, tz - D, 0);
      const k = r();
      const h = grid.groundAt(tx, tz);
      if (onPath(tx, tz)) continue;
      switch (biomeAt(Math.floor(tx), Math.floor(tz), W, D)) {
        case 'mountain':
          if (h < 18 && k < 0.28) b.pine(tx, tz, 1 + r() * 0.7);
          else if (k < 0.4) b.rock(tx, tz, 0.8 + r() * 1.4);
          break;
        case 'forest':
          if (k < 0.62) b.pine(tx, tz, 1 + r() * 0.8);
          else if (k < 0.68) b.rock(tx, tz, 0.8 + r());
          break;
        case 'lake':
          if (nearWater(tx, tz) && h < 0.5 && k < 0.4) b.reeds(tx, tz, 8);
          else if (h > 1 && k < 0.45) b.pine(tx, tz, 1 + r() * 0.6);
          else if (k < 0.52) b.rock(tx, tz, 0.5 + r() * 0.8);
          break;
        case 'marsh':
          if (nearWater(tx, tz) && k < 0.45) b.reeds(tx, tz, 9, 0.9);
          else if (out > 6 && k < 0.52) b.deadTree(tx, tz, 0.8 + r() * 0.5);
          else if (k < 0.6) b.bush(tx, tz, 0.6 + r() * 0.4, '#3e5232');
          else if (h > 0.5 && k < 0.7) b.pine(tx, tz, 1);
          break;
        case 'farm':
          if (nearWater(tx, tz) && k < 0.3) b.reeds(tx, tz, 7);
          else if (tz > 131 && k < 0.05) b.oak(tx, tz, 1 + r() * 0.4);
          else if (k < 0.055) b.hay(tx, tz, r() * 3);
          else if (k < 0.08) b.rock(tx, tz, 0.4);
          break;
        case 'gorge':
          if (h > -1 && out < 3 && k < 0.2) b.rock(tx, tz, 0.6 + r() * 0.8);
          else if (h > -1 && out > 15 && k < 0.55) b.pine(tx, tz, 1 + r() * 0.6);
          else if (h < -10 && k < 0.08) b.rock(tx, tz, 1 + r());
          break;
        case 'meadow':
          if (nearWater(tx, tz) && k < 0.3) b.reeds(tx, tz, 7);
          else if (tx > 133 && k < 0.07) b.oak(tx, tz, 1 + r() * 0.4);
          else if (k < 0.12) b.bush(tx, tz, 0.7 + r() * 0.4);
          else if (k < 0.16) b.rock(tx, tz, 0.4 + r() * 0.6);
          break;
      }
    }
  // Farms across the river, walled fields and a lit farmhouse.
  for (let gz = D + 13; gz < D + 26; gz += 7) b.drystone([[W - 58, gz], [W + 24, gz]].map(([x, z]) => [x + r(), z]) as [number, number][]);
  for (let gx = W - 57; gx < W + 26; gx += 9) b.drystone([[gx, D + 13], [gx, D + 24]]);
  b.house(W + 14, D + 17, 5, 4, { roof: 'thatch', doorSide: 2, lit: 1, name: 'farmhouse' });
  b.house(W + 21, D + 14, 4, 4, { roof: 'thatch', doorSide: 3, lit: 0.6, name: 'barn' });
  // A distant watch fire on the mountain shoulder.
  b.brazier(-9, 26);
  // The broken bridge: the near half still stands, the middle has fallen in.
  const g = b.g(BRIDGE.x, BRIDGE.z0);
  const deckY = 0.35;
  for (let z = BRIDGE.z0; z < BRIDGE.z1; z += 0.42) {
    if (z > BRIDGE.breakZ0 && z < BRIDGE.breakZ1) continue;
    const ragged = z > BRIDGE.breakZ0 - 0.9 && z < BRIDGE.breakZ1 + 0.9;
    g.box(BRIDGE.x + (ragged ? (r() - 0.5) * 0.4 : 0), deckY - 0.12, z + 0.2, ragged ? 1.4 + r() : 2.4, 0.12, 0.38, PAL.wood, { kind: 5, shade: 0.8 + r() * 0.3 });
  }
  for (const z of [BRIDGE.z0 + 0.3, BRIDGE.breakZ0 - 0.6, BRIDGE.breakZ1 + 0.6, BRIDGE.z1 - 0.4])
    for (const s of [-1, 1]) g.box(BRIDGE.x + s * 1.1, -2.2, z, 0.2, 3.4, 0.2, PAL.woodDark, { kind: 5 });
  // Snapped planks in the water.
  for (let k = 0; k < 4; k++) g.box(BRIDGE.x + (r() - 0.5) * 2, RIVER_LEVEL - 0.05, BRIDGE.breakZ0 + 0.6 + r() * 2.4, 1.6, 0.1, 0.35, PAL.woodDark, { kind: 5 });
  for (let z = Math.floor(BRIDGE.z0); z < BRIDGE.breakZ0 - 0.2; z++)
    for (let x = Math.floor(BRIDGE.x - 1.2); x < BRIDGE.x + 1.2; x++) grid.deck[grid.i(x, z)] = deckY;
  b.sign(BRIDGE.x + 1.8, BRIDGE.z0 - 1.2, 0.6);
}
