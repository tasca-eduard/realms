import { K } from '../engine/materials';
import { P, type PSpec } from '../engine/particles';
import { fbm, mulberry32 } from '../engine/util';
import { LOOKS } from '../game/assets';
import { GLOW, PAL, type Builder } from './builder';
import { NONE, S, T, type Grid } from './grid';
import { KEEP_ZONES } from './lightzones';
import { Painter, distLine, type Pt } from './paint';
import type { NpcDef, ObjDef, RegionDef } from './realm';
import * as D from './details';
import { bough, trunkUp } from './wood';

// ---------------------------------------------------------------------------
// The Moonlit Keep's set pieces (group 89): the places that make the countryside worth the walk.
// - The old mill on the stream above the ford: its wheel turning in a stone-lined race, foam where it bites the
//   water, a lit window, a lane up from the ford, and Hobb the miller (his errand comes later).
// - The keep's beacon, a great iron cresset on the gatehouse between the gate towers: cold moon-blue while the
//   Goblin King holds the keep, gold at dawn when he falls.
// - The First Knights' Isle in Mirrormere: where they swore their oath, a moonlit knight in stone among broken
//   arches, a lore stone and a chest, reached by stepping stones hidden in the shallows (no path).
// - The Seven Stones' runes waking in turn round the ring, and the eighth stone, never raised, lying half sunk in
//   the grass to the north-east with a chest in the hollow under it.
// - The Kings' Orchard in blossom: pale apple blossom, petals drifting, windfalls, old bee skeps.
// - The raided farm smouldering while the raiders hold it, then mended once they are beaten (src/game/story/
//   keepsights.ts): scaffolding on the barn, lanterns, the Harrows back at work.
// - Pilgrims' Fall: a spring pouring off the heights at the Overlook's far (west) edge into a plunge pool, a
//   ledge and a chest behind the falling water (no path).
// - A night fisher's lantern boat drifting on Mirrormere.
// What moves or changes with the story (the wheel, the beacon, the runes, the farm, the boat) is built at
// runtime by the story's part (src/game/story/keepsights.ts); this module draws what stands still.
// ---------------------------------------------------------------------------

/** The mill house (its centre and size), on the stream's far bank so the wheel and the race are seen in front of it. */
export const MILL = { x: 68.2, z: 86.6, w: 5, d: 4.4 };
/** The wheel: its axle runs along x out of the mill's east wall, over the race. */
export const WHEEL = { x: 72.4, y: 0.85, z: 87.4, r: 1.55, w: 0.72 };
/** The mill race, in the way its water runs: out of the stream above the mill, under the wheel, back below it. */
export const RACE: Pt[] = [[84.6, 80.5], [80.2, 80.6], [76.2, 82.4], [73.4, 84.6], [72.4, 86.0], [72.4, 89.4], [71.6, 91.6], [73.6, 93.6]];
/** The lane up from the ford's path to the mill door. */
const LANE_MILL: Pt[] = [[62.6, 102.6], [64.4, 98.2], [66.6, 94.0], [68.0, 90.2]];

/** The beacon's cresset on the gatehouse's battlements, over the drawbridge. */
export const BEACON = { x: 46, y: 9.9, z: 24.5 };

/** The First Knights' Isle in Mirrormere (the old islet, grown a little), its statue and its stepping stones. */
export const ISLE = { x: -5.8, z: 100, rx: 4.8, rz: 3.7 };
const STATUE = { x: -8.0, z: 100.4 };

/** The Seven Stones: the ring's centre and radius, and each stone's turn (as realm1.ts raises them). */
export const STONES = { x: 111.5, z: 88, r: 3.2, n: 7, a0: 0.3 };
/** The eighth stone, never raised, half sunk in the long grass north-east of the ring. */
export const EIGHTH = { x: 115.8, z: 77.2 };

/** The raided farm's barn (as realm1.ts places it) and its yard. */
export const FARM = { x: 105.5, z: 116 };

/** Pilgrims' Fall: the lip it pours from, the pool below, the ledge behind. */
export const FALLS = { x: 5.2, z0: 45.1, z1: 48.8, top: 8.95, level: 3.75 };

/** The night fisher's drift round the far side of the isle, end to end and back. */
export const BOAT_WAY: Pt[] = [[2.2, 91.5], [-3.5, 89], [-10, 90.5], [-14, 96], [-14.5, 102.5], [-11.5, 108.5], [-5, 111.5], [1.5, 109.5]];


/** Pale apple blossom, faintly lit by the moon. */
const BLOSSOM = ['#e8d6de', '#f0e2e6', '#dcc6d4', '#e6dce4'];
/** Petals drifting down from the blossom. */
const PETAL: PSpec = { color: [1.3, 1.1, 1.2], color2: [0.8, 0.62, 0.72], size: 1, life: 7, gravity: 0.18, drag: 1.4, wobble: 0.9, fadeIn: 0.3, alpha: 0.85 };
/** Spray drifting off the foot of the falls. */
const SPRAY: PSpec = { color: [0.55, 0.62, 0.72], color2: [0.32, 0.36, 0.44], size: 3, size2: 7, life: 2.2, gravity: -0.25, drag: 1.2, wobble: 0.3, alpha: 0.32, fadeIn: 0.15, soft: true };

// The mill's and the farm's people wear looks of their own (added to the shared table from here, so its lines
// stay as they are): the miller floury and aproned, the Harrows in field browns.
Object.assign(LOOKS, {
  miller: { skin: '#e0b090', hair: '#d0ccc0', cloth: '#9a9284', cloth2: '#8a8274', pants: '#5a5244', boots: '#3a2e22', h: 22, bald: true, beard: '#d0ccc0', apron: '#e8e4d8' },
  farmer: { skin: '#d49a74', hair: '#5a3a1e', cloth: '#6a5a2e', cloth2: '#5a4a24', pants: '#4a3a24', boots: '#2e2218', h: 22, beard: '#5a3a1e', hat: 'hood', hatCol: '#7a6a3a' },
  farmwife: { skin: '#e8b890', hair: '#a85a2a', cloth: '#7a4a3a', cloth2: '#6a3a2e', pants: '#4a3424', boots: '#2e2218', h: 20, apron: '#c8b890', dress: true, longHair: true },
});

export interface KeepSights {
  objects: ObjDef[];
  npcs: NpcDef[];
  regions: RegionDef[];
  flows: { pts: Pt[]; speed: number }[];
  landmarks: { x: number; z: number; r: number }[];
}

export function buildKeepSights(b: Builder, grid: Grid): KeepSights {
  const keep = b.rng;
  b.rng = mulberry32(8989);
  const p = new Painter(grid);
  buildMill(b, grid, p);
  buildBeacon(b);
  buildEighthStone(b, grid);
  dressOrchard(b, grid);
  buildFalls(b, grid, p);
  b.rng = keep;

  const objects: ObjDef[] = [
    { kind: 'lore', id: 'lore6', x: -3.4, z: 98.0, text: 'Here the first knights knelt and swore to keep the road, with only the moon and the water to witness. The water remembers.' },
    { kind: 'chest', id: 'c_isle', x: -5.6, z: 102.7, rot: Math.PI / 4, coins: 65 },
    { kind: 'chest', id: 'c_eighth', x: EIGHTH.x + 1.15, z: EIGHTH.z + 0.75, rot: Math.PI / 4, coins: 55 },
    { kind: 'chest', id: 'c_falls', x: 3.75, z: 46.9, rot: Math.PI / 2, coins: 70, power: 'wind' },
  ];
  const npcs: NpcDef[] = [
    {
      id: 'miller', look: 'miller', name: 'Hobb the Miller', x: 70.6, z: 90.1, speed: 0.9, pause: 5, roam: [[70.6, 90.1], [68.9, 90.0], [70.9, 89.0]],
      lines: [
        'The wheel turns all night, sir knight. Flour does not care who sits on the throne.',
        'The goblins came for my sacks once. The race is deeper than it looks: two of them went home wet.',
        'Keepsfoot eats my bread. When the keep is ours again, the castle ovens will want it too.',
      ],
    },
    {
      id: 'wat', look: 'farmer', name: 'Wat Harrow', x: 103.6, z: 113.1, hidden: true, pose: 'work', heading: Math.atan2(FARM.z - 113.1, FARM.x - 103.6),
      lines: [
        'They burned the barn, but the stones stood. We will have a roof on it by harvest.',
        'Edda says you fought them in the cabbages. A few squashed cabbages is a fair price, I say.',
      ],
    },
    {
      id: 'edda', look: 'farmwife', name: 'Edda Harrow', x: 99.2, z: 113.8, hidden: true, speed: 1, pause: 4, roam: [[99.2, 113.8], [101.6, 113.2], [97.4, 114.6]],
      lines: [
        'We hid in the Warden\'s cellar the night they came. And look: a frame up already.',
        'Lanterns all night now, so nobody comes creeping back through the wheat.',
      ],
    },
  ];
  const regions: RegionDef[] = [
    { name: 'The Old Mill', music: 'fields', amb: 'fields', test: (x, z) => (x - 70) ** 2 + (z - 87.5) ** 2 < 6.5 * 6.5, light: KEEP_ZONES.home },
    { name: "The First Knights' Isle", music: 'fields', amb: 'fields', test: (x, z) => ((x - ISLE.x) / (ISLE.rx + 0.4)) ** 2 + ((z - ISLE.z) / (ISLE.rz + 0.4)) ** 2 < 1, light: KEEP_ZONES.stones },
    { name: "Pilgrims' Fall", music: 'keep', amb: 'keep', test: (x, z, y) => x > 1.5 && x < 8.6 && z > 43 && z < 50.2 && y > 3.5, light: KEEP_ZONES.water },
  ];
  return {
    objects,
    npcs,
    regions,
    // The race runs quicker than the stream it is taken from.
    flows: [{ pts: RACE, speed: 1.3 }, { pts: [[0.2, 46.9], [3.4, 46.9]], speed: 1.2 }],
    // The beacon over the gate: never under the mist of unexplored land.
    landmarks: [{ x: BEACON.x, z: BEACON.z, r: 5 }],
  };
}

// ---------- the old mill ----------

function buildMill(b: Builder, grid: Grid, p: Painter) {
  const r = b.rng;
  // The race: a channel cut beside the stream, its sides lined with stone, shallow where it runs out from under
  // the wheel (white water there).
  p.each((x, z, i) => {
    const d = distLine(RACE, x + 0.5, z + 0.5);
    if (grid.water[i] !== NONE) return;
    if (d < 0.78) {
      const tail = z + 0.5 > WHEEL.z + 1.2 && z + 0.5 < WHEEL.z + 3;
      grid.h[i] = tail ? -0.52 : -0.78;
      grid.t[i] = T.Bed;
      grid.water[i] = -0.35;
      grid.noGrass[i] = 1;
      grid.dir[i] = -1;
      grid.side[i] = S.Brick;
    } else if (d < 1.5) {
      grid.side[i] = S.Brick;
      if (grid.h[i] < 0) grid.h[i] = 0;
    }
  }, 69, 78, 87, 96);
  // Flagstones between the mill's east wall and the race, where the miller watches his wheel.
  p.each((x, z, i) => {
    if (grid.water[i] !== NONE) return;
    grid.t[i] = T.Flag;
    grid.noGrass[i] = 1;
  }, 70.7, 84.4, 71.6, 90.4);
  p.path(LANE_MILL, 1.6, T.Path, 0.4, 89, false);
  p.rect(66.4, 88.8, 70.4, 91.2, { t: T.Path, noGrass: true });
  D.edgeStones(b, grid, LANE_MILL, 1.6);

  // The house: stone, thatched, its door toward the lane.
  const s = b.house(MILL.x, MILL.z, MILL.w, MILL.d, { doorSide: 1, roof: 'thatch', walls: 'stone', lit: 1, name: 'mill' });
  const y = grid.groundAt(MILL.x, MILL.z) - 0.05, ex = MILL.x + MILL.w / 2;
  // A lit window in the east wall beside the wheel, and another by the door: the miller works late.
  s.glow.box(ex + 0.03, y + 1.25, 85.05, 0.05, 0.62, 0.55, GLOW.window, { kind: 1 });
  s.core.box(ex + 0.06, y + 1.2, 85.05, 0.06, 0.08, 0.7, PAL.timber, { kind: K.Wood });
  s.core.box(ex + 0.06, y + 1.9, 85.05, 0.06, 0.08, 0.7, PAL.timber, { kind: K.Wood });
  b.lights.add(ex + 0.8, y + 1.5, 85.1, 0xffa050, 4, 5, 0.08);
  // The wheel's bearings: a block on the wall and a stone pier beyond the race.
  const g = b.g(WHEEL.x, WHEEL.z);
  g.box(ex + 0.12, WHEEL.y - 0.25, WHEEL.z, 0.3, 0.5, 0.5, PAL.woodDark, { kind: K.Wood });
  g.box(WHEEL.x + 1.05, -0.8, WHEEL.z, 0.42, WHEEL.y + 0.75, 0.42, PAL.stoneDark, { kind: K.Brick });
  g.box(WHEEL.x + 1.05, WHEEL.y - 0.05, WHEEL.z, 0.5, 0.18, 0.5, PAL.woodDark, { kind: K.Wood });
  b.collide({ kind: 'b', x0: WHEEL.x - 0.5, z0: WHEEL.z - WHEEL.r - 0.1, x1: WHEEL.x + 1.3, z1: WHEEL.z + WHEEL.r + 0.1, y0: -1.5, y1: WHEEL.y + WHEEL.r + 0.2 });
  // The sluice where the race leaves the stream: two posts and a plank gate, drawn up.
  {
    const [sx, sz] = [80.2, 80.6], gs = b.g(sx, sz);
    for (const dz of [-0.85, 0.85]) gs.box(sx, -0.8, sz + dz, 0.2, 2.2, 0.2, PAL.woodDark, { kind: K.Wood });
    gs.box(sx, 1.15, sz, 0.18, 0.14, 1.9, PAL.woodDark, { kind: K.Wood });
    gs.box(sx, 0.35, sz, 0.08, 0.6, 1.5, PAL.wood, { kind: K.Wood });
    gs.beam([sx, 1.2, sz], [sx, 0.65, sz], 0.03, PAL.iron);
  }
  // Kerbstones along the race's lips, in stretches.
  for (let s0 = 0; s0 < 1; s0 += 0.035) {
    const k = Math.floor(s0 * (RACE.length - 1)), f = s0 * (RACE.length - 1) - k;
    const [ax, az] = RACE[k], [bx, bz] = RACE[k + 1];
    const x = ax + (bx - ax) * f, z = az + (bz - az) * f, len = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / len, nz = (bx - ax) / len;
    if (Math.hypot(x - WHEEL.x, z - WHEEL.z) < 2.2 || fbm(x * 0.4, z * 0.4, 2, 189) < 0.42) continue;
    for (const side of [-1, 1]) {
      const kx = x + nx * 0.95 * side, kz = z + nz * 0.95 * side;
      if (grid.waterAt(kx, kz) !== NONE) continue;
      b.g(kx, kz).blob(kx, grid.groundAt(kx, kz) - 0.05, kz, 0.3, 0.16, 0.26, r() < 0.5 ? PAL.stone : PAL.stoneDark, Math.floor(r() * 999), { kind: K.Rock, flatBottom: true, jitter: 0.2 });
    }
  }
  // The yard: millstones leaning by the door, sacks of flour, a cart waiting for them, a lantern.
  {
    const gy = b.g(MILL.x, MILL.z + 3);
    for (const [mx, mz, rot] of [[65.9, 89.4, 0.25], [66.5, 89.5, -0.15]] as [number, number, number][]) {
      gy.push().translate(mx, y + 0.62, mz).rotateY(rot).rotateX(Math.PI / 2 - 0.25);
      gy.cyl(0, -0.12, 0, 0.62, 0.62, 0.24, 10, '#8c8a90', { kind: K.Rock });
      gy.cyl(0, -0.13, 0, 0.12, 0.12, 0.26, 6, '#3a3830');
      gy.pop();
    }
    b.collide({ kind: 'b', x0: 65.2, z0: 89.0, x1: 67.2, z1: 90.0, y0: y - 1, y1: y + 1.3 });
    for (const [sx, sz, h] of [[69.6, 89.25, 0.55], [70.05, 89.35, 0.5], [69.8, 89.7, 0.45]] as [number, number, number][]) {
      gy.blob(sx, y + h * 0.5, sz, 0.24, h * 0.5, 0.2, '#d8d0bc', Math.floor(r() * 999), { kind: K.Cloth, flatBottom: true });
      gy.box(sx, y + h - 0.02, sz, 0.12, 0.06, 0.12, '#a89a7a');
    }
    b.cart(64.6, 91.2, 1.9);
    D.postLantern(b, 67.0, 91.0);
    b.barrel(65.6, 85.0);
  }
  // Reeds and a willow-green bush where the race comes back to the stream.
  b.reeds(73.4, 92.1, 7, 0.5);
  b.bush(70.4, 92.6, 0.8);
}

// ---------- the keep's beacon ----------

function buildBeacon(b: Builder) {
  const { x, y, z } = BEACON, g = b.g(x, z);
  // A stone plinth on the battlements, and the iron cresset on it: bars flaring out to a ring.
  g.box(x, y - 0.05, z, 1.2, 0.35, 1.2, PAL.stoneDark, { kind: K.Brick });
  g.box(x, y + 0.3, z, 0.9, 0.12, 0.9, PAL.stone, { kind: K.Brick });
  g.cyl(x, y + 0.42, z, 0.18, 0.12, 0.35, 6, PAL.iron, { kind: K.Metal });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    g.beam([x + Math.cos(a) * 0.14, y + 0.75, z + Math.sin(a) * 0.14], [x + Math.cos(a) * 0.62, y + 1.65, z + Math.sin(a) * 0.62], 0.035, PAL.iron, { kind: K.Metal });
  }
  g.cyl(x, y + 1.55, z, 0.64, 0.66, 0.1, 10, PAL.iron, { kind: K.Metal, cap: false });
  g.cyl(x, y + 0.75, z, 0.18, 0.4, 0.3, 8, PAL.iron, { kind: K.Metal, cap: false });
}

// ---------- the First Knights' Isle ----------

/** The isle grows a little and takes its shrine (after the outskirts, which paint the lake round it). */
export function buildIsleShrine(b: Builder, grid: Grid) {
  const keep = b.rng, r = (b.rng = mulberry32(8990));
  const p = new Painter(grid);
  p.each((x, z, i) => {
    const cx = x + 0.5, cz = z + 0.5;
    const d = Math.hypot((cx - ISLE.x) / ISLE.rx, (cz - ISLE.z) / ISLE.rz) + (fbm(cx * 0.4, cz * 0.4, 2, 191) - 0.5) * 0.25;
    if (d >= 1) return;
    grid.h[i] = 0.25;
    grid.t[i] = d < 0.72 ? T.Grass : T.Sand;
    grid.water[i] = NONE;
    grid.noGrass[i] = 0;
    grid.dir[i] = -1;
    if (Math.hypot(cx - STATUE.x, cz - STATUE.z) < 1.9) {
      grid.t[i] = T.Flag;
      grid.noGrass[i] = 1;
    }
  }, ISLE.x - ISLE.rx - 1, ISLE.z - ISLE.rz - 1, ISLE.x + ISLE.rx + 1, ISLE.z + ISLE.rz + 1);

  // The statue: a knight of the first days, helm bowed over his sword, its point on the stone; moonlight
  // caught in the blade and the crescent on his shield.
  {
    const { x, z } = STATUE, y = grid.groundAt(x, z), g = b.g(x, z), gl = b.gl(x, z);
    const st = '#c4c2d2', st2 = '#a8a6b8', o = { kind: K.Rock };
    g.push().translate(x, y, z).rotateY(1.0);
    gl.push().translate(x, y, z).rotateY(1.0);
    g.box(0, -0.1, 0, 1.35, 0.6, 1.35, PAL.stoneDark, { kind: K.Brick });
    g.box(0, 0.5, 0, 1.05, 0.5, 1.05, st2, { kind: K.Brick });
    g.translate(0, 0.38, 0);
    gl.translate(0, 0.38, 0);
    g.box(0, 0.62, 0, 0.62, 0.95, 0.42, st, o);
    g.box(0, 1.55, 0, 0.66, 0.72, 0.4, st, o);
    g.box(0, 1.85, 0.02, 0.8, 0.2, 0.36, st2, o);
    g.box(0, 2.27, 0.04, 0.32, 0.36, 0.32, st, o);
    g.box(0, 2.52, 0.04, 0.36, 0.08, 0.36, st2, o);
    // Both hands on the pommel, the blade down before him.
    g.beam([-0.3, 1.9, 0.05], [-0.05, 1.42, 0.38], 0.07, st, o);
    g.beam([0.3, 1.9, 0.05], [0.05, 1.42, 0.38], 0.07, st, o);
    g.box(0, 1.3, 0.42, 0.42, 0.07, 0.08, st2, o);
    gl.box(0, 0.42, 0.42, 0.07, 0.88, 0.04, GLOW.moon, {});
    gl.box(0, 2.25, 0.21, 0.2, 0.05, 0.02, GLOW.moon, {});
    // The shield on his left arm, the crescent glowing on it.
    g.push().translate(0.42, 1.0, 0.12).rotateY(0.5);
    g.box(0, 0, 0, 0.08, 0.95, 0.66, st2, o);
    g.pop();
    gl.push().translate(0.47, 1.25, 0.18).rotateY(0.5);
    for (let k = 0; k < 5; k++) {
      const a = -1.1 + k * 0.55;
      gl.box(0.02, Math.sin(a) * 0.2, Math.cos(a) * 0.2 - 0.08, 0.02, 0.07, 0.06, GLOW.moon, {});
    }
    gl.pop();
    g.pop();
    gl.pop();
    b.collide({ kind: 'c', x, z, r: 0.75, y0: y - 1, y1: y + 3.1 });
    b.fx.addEmitter({ x, y: y + 1.6, z, rate: 0.8, spec: P.mote, spread: 1.6, vy: 0.08 });
    b.moonflowers(x + 0.9, z + 1.0, 7, 0.9);
  }
  // Broken arches behind him (on the far side from the camera): five pillars on an arc, two lintels still up,
  // one lying where it fell.
  {
    const hs = [2.9, 1.1, 3.1, 2.8, 0.7];
    const at = (k: number): Pt => {
      const a = Math.PI * (0.85 + k * 0.18);
      return [STATUE.x + Math.cos(a) * 1.8, STATUE.z + Math.sin(a) * 1.8];
    };
    hs.forEach((h, k) => {
      const [x, z] = at(k), y = grid.groundAt(x, z), g = b.g(x, z);
      g.box(x, y - 0.1, z, 0.62, 0.3, 0.62, PAL.stoneDark, { kind: K.Brick });
      g.cyl(x, y + 0.15, z, 0.24, 0.22, h, 8, '#9896a6', { kind: K.Rock });
      if (h > 2) g.box(x, y + 0.15 + h, z, 0.55, 0.2, 0.55, '#8e8c9c', { kind: K.Brick });
      else for (let q = 0; q < 2; q++) g.blob(x + (r() - 0.5) * 1.2, y + 0.1, z + (r() - 0.5) * 1.2, 0.22, 0.16, 0.2, '#8e8c9c', Math.floor(r() * 999), { kind: K.Rock, flatBottom: true });
      b.collide({ kind: 'c', x, z, r: 0.32, y0: y - 1, y1: y + h });
    });
    for (const [k0, k1] of [[2, 3], [3, 4]] as [number, number][]) {
      if (hs[k0] < 2 || hs[k1] < 2) continue;
      const [ax, az] = at(k0), [bx, bz] = at(k1), top = grid.groundAt(ax, az) + 0.35 + Math.min(hs[k0], hs[k1]);
      b.g(ax, az).beam([ax, top, az], [bx, top, bz], 0.17, '#9896a6', { kind: K.Brick });
    }
    // An arch between the first two, broken in the middle: its halves still reach for each other.
    const [ax, az] = at(0), [bx, bz] = at(1), top = grid.groundAt(ax, az) + 0.35 + 2.85;
    b.g(ax, az).beam([ax, top, az], [ax + (bx - ax) * 0.3, top + 0.25, az + (bz - az) * 0.3], 0.15, '#9896a6', { kind: K.Brick });
    const [lx, lz] = [STATUE.x + 0.3, STATUE.z + 2.1], ly = grid.groundAt(lx, lz);
    b.g(lx, lz).push().translate(lx, ly + 0.14, lz).rotateY(0.6);
    b.g(lx, lz).box(0, 0, 0, 1.6, 0.3, 0.34, '#8e8c9c', { kind: K.Brick });
    b.g(lx, lz).pop();
    b.collide({ kind: 'c', x: lx, z: lz, r: 0.45, y0: ly - 1, y1: ly + 0.45 });
  }
  // The stepping stones from the pier's end: low and mossy in the shallows, easy to take for rocks.
  for (const [sx, sz, s] of [[1.75, 99.8, 0.36], [0.75, 100.25, 0.32], [-0.3, 99.75, 0.34]] as [number, number, number][]) {
    const g = b.g(sx, sz);
    g.blob(sx, -0.42, sz, s * 1.2, 0.2, s, PAL.rockDark, Math.floor(r() * 999), { kind: K.Rock, flatBottom: true, jitter: 0.2 });
    g.box(sx + 0.05, -0.24, sz + 0.03, s * 1.1, 0.03, s * 0.8, '#4a5a3a', {});
  }
  b.reeds(-2.2, 102.6, 6, 0.5);
  b.reeds(-9.0, 97.2, 5, 0.5);
  b.moonflowers(-4.2, 102.2, 5, 0.8);
  b.rng = keep;
}

// ---------- the eighth stone ----------

function buildEighthStone(b: Builder, grid: Grid) {
  const { x, z } = EIGHTH, y = grid.groundAt(x, z), g = b.g(x, z), r = b.rng;
  // Never raised: a long slab lying where it was dropped, one end sunk in the turf, the other resting on a
  // boulder over a hollow (the chest is down there). Moss on its back, a crescent begun and never finished.
  g.blob(x + 1.15, y + 0.1, z + 0.6, 0.55, 0.42, 0.5, PAL.rockDark, 4401, { kind: K.Rock, flatBottom: true, jitter: 0.2 });
  g.push().translate(x, y + 0.3, z).rotateY(Math.PI / 4 - 0.1).rotateZ(-0.24);
  g.box(0, -0.45, 0, 3.4, 0.62, 1.0, PAL.stoneDark, { kind: K.Rock });
  g.box(-0.3, 0.17, 0.05, 2.4, 0.03, 0.66, '#4a5a3a', {});
  // Turf grown up over its sunk end.
  g.blob(-1.6, -0.2, 0, 0.7, 0.35, 0.75, '#3d5a33', 4403, { kind: K.Grass, flatBottom: true, jitter: 0.25 });
  for (let k = 0; k < 6; k++) {
    const a = -1.2 + k * 0.48;
    g.box(0.6 + Math.cos(a) * 0.28, 0.175, Math.sin(a) * 0.28, 0.06, 0.02, 0.05, '#3a3640', {});
  }
  g.pop();
  // The hollow under it: dark earth, a few roots.
  g.blob(x + 1.15, y - 0.12, z + 0.75, 0.75, 0.16, 0.65, '#2a2420', 4402, { kind: K.Dirt, flatBottom: true });
  for (let k = 0; k < 3; k++) g.beam([x + 0.6 + k * 0.3, y + 0.5, z + 0.2], [x + 0.8 + k * 0.35, y + 0.05, z + 0.6 + r() * 0.3], 0.025, PAL.bark, { kind: K.Bark });
  b.collide({ kind: 'b', x0: x - 1.4, z0: z - 0.9, x1: x + 0.6, z1: z + 0.5, y0: y - 1, y1: y + 0.9 });
  b.moonflowers(x - 1.4, z + 1.2, 4, 0.6);
  D.wildflowers(b, x + 0.2, z - 1.4, 7, 0.7, 'purple');
}

// ---------- the Kings' Orchard in blossom ----------

/**
 * An old apple tree in blossom: a crooked trunk, boughs reaching out, and pale crowns of flowers. It draws the
 * builder's dice exactly as Builder.oak does (it stands where the orchard's oaks did, and nothing placed after
 * it may change); its own shapes come from those draws.
 */
export function blossomTree(b: Builder, x: number, z: number, s = 1) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  const tone = r(), n = 3 + Math.floor(r() * 2);
  const crowns: number[][] = [];
  for (let i = 0; i < n; i++) crowns.push([r(), r(), r(), r(), r(), Math.floor(r() * 1000)]);
  const d = mulberry32(Math.floor(x * 131 + z * 17));
  const lean = (d() - 0.5) * 0.5;
  const top = trunkUp(g, x, y, z, 0.2 * s, 0.11 * s, 1.35 * s, PAL.bark, d, { lean, lumpy: 0.25 })(y + 1.25 * s);
  crowns.forEach(([ka, ky, krx, kry, krz, seed], i) => {
    const a = (i / n) * Math.PI * 2 + ka * 1.2, reach = i === 0 ? 0.15 : 0.95 * s;
    const cx = x + Math.cos(a) * reach, cz = z + Math.sin(a) * reach, cy = y + (1.75 + ky * 0.45) * s;
    if (i > 0) bough(g, top, [cx, cy - 0.25 * s, cz], 0.08 * s, 0.04 * s, PAL.bark, d, 0.2);
    const col = BLOSSOM[(i + Math.floor(tone * 4)) % BLOSSOM.length];
    const rx = (0.72 + krx * 0.3) * s, ry = (0.55 + kry * 0.2) * s, rz = (0.72 + krz * 0.3) * s;
    g.blob(cx, cy, cz, rx, ry, rz, col, seed, { kind: K.Leaves, wind: 0.45, detail: 1, jitter: 0.22 });
    // The flowers catching the moon: pale specks over the crown's upper side.
    const gl = b.gl(x, z);
    for (let k = 0; k < 14; k++) {
      const u = d() * Math.PI * 2, v = d() * 1.1;
      gl.box(cx + Math.cos(u) * Math.sin(v) * rx * 1.02, cy + Math.cos(v) * ry * 1.02, cz + Math.sin(u) * Math.sin(v) * rz * 1.02, 0.09, 0.06, 0.09, k % 3 ? [0.62, 0.46, 0.56] : [0.8, 0.66, 0.74], { wind: 0.45 });
    }
    // A few dark leaves showing through.
    if (i % 2 === 0) g.blob(cx + 0.2 * s, cy - 0.25 * s, cz - 0.15 * s, 0.4 * s, 0.3 * s, 0.4 * s, PAL.oak2, seed + 1, { kind: K.Leaves, wind: 0.45, shade: 0.9 });
  });
  b.collide({ kind: 'c', x, z, r: 0.3 * s, y0: y - 1, y1: y + 4 * s });
}

function dressOrchard(b: Builder, grid: Grid) {
  const r = b.rng;
  // More old trees in the gaps (the wild orchard spread), petals drifting down from all of them.
  const trees: [number, number, number][] = [[10.6, 14.2, 0.95], [10.4, 21.6, 0.85], [5.6, 25.6, 1.1], [11.0, 28.6, 0.8], [10.9, 36.6, 0.9]];
  for (const [x, z, s] of trees) blossomTree(b, x, z, s);
  for (const [x, z] of [[6.6, 15.8], [9.4, 18.6], [7.2, 21.4], [6.4, 30.2], [9.2, 32.6], [6.9, 35.4], ...trees] as Pt[]) {
    const y = grid.groundAt(x, z);
    b.fx.addEmitter({ x, y: y + 2.4, z, rate: 1.1, spec: PETAL, spread: 1.4, vy: -0.05 });
    // Fallen petals under the tree, and windfalls in the grass.
    const dg = b.d(x, z);
    for (let k = 0; k < 26; k++) {
      const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 1.9, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
      if (grid.groundAt(px, pz) < 3.5) continue;
      dg.box(px, grid.groundAt(px, pz) + 0.01, pz, 0.09, 0.012, 0.07, BLOSSOM[k % 4], {});
    }
    for (let k = 0; k < 3; k++) {
      const a = r() * Math.PI * 2, rr = 0.6 + r() * 1.2, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
      dg.blob(px, grid.groundAt(px, pz) + 0.06, pz, 0.07, 0.065, 0.07, r() < 0.6 ? '#9a3a2a' : '#8a8a3a', Math.floor(r() * 999), {});
    }
  }
  // Old bee skeps on a plank bench against the wall: straw domes, the bees long gone wild in the trees.
  {
    const x = 11.9, z = 18.2, y = grid.groundAt(x, z), g = b.g(x, z);
    for (const dz of [-0.9, 0.9]) g.box(x, y, z + dz, 0.4, 0.42, 0.12, PAL.woodDark, { kind: K.Wood });
    g.box(x, y + 0.42, z, 0.55, 0.08, 2.3, PAL.wood, { kind: K.Wood });
    for (const [dz, h] of [[-0.7, 0.62], [0.05, 0.7], [0.75, 0.56]] as [number, number][]) {
      g.cyl(x, y + 0.5, z + dz, 0.3, 0.06, h, 9, '#b09050', { kind: K.Thatch });
      for (let k = 1; k < 4; k++) g.cyl(x, y + 0.5 + (h * k) / 4, z + dz, 0.31 - k * 0.06, 0.3 - k * 0.06, 0.03, 9, '#8a6a38');
      g.box(x + 0.27, y + 0.5, z + dz, 0.04, 0.08, 0.1, '#1a1410');
    }
    b.collide({ kind: 'b', x0: x - 0.35, z0: z - 1.2, x1: x + 0.35, z1: z + 1.2, y0: y - 1, y1: y + 1.2 });
    // A tumbled skep in the grass by the trees.
    g.push().translate(7.9, grid.groundAt(7.9, 27.6) + 0.25, 27.6).rotateZ(1.3).rotateY(0.4);
    g.cyl(0, -0.3, 0, 0.27, 0.06, 0.6, 9, '#9a7a44', { kind: K.Thatch });
    g.pop();
  }
}

// ---------- Pilgrims' Fall ----------

function buildFalls(b: Builder, grid: Grid, p: Painter) {
  const { x: fx, z0, z1, top, level } = FALLS, r = b.rng;
  // The pool at the foot: shallow round its rim, deep where the water lands.
  p.each((x, z, i) => {
    const cx = x + 0.5, cz = z + 0.5;
    const k = Math.hypot((cx - 7.0) / 2.3, (cz - 46.8) / 2.5) + (fbm(cx * 0.5, cz * 0.5, 2, 193) - 0.5) * 0.2;
    if (k >= 1 || grid.h[i] !== 4) return;
    const plunge = Math.max(0, 1 - Math.hypot(cx - 5.6, cz - 46.9) / 1.7);
    grid.h[i] = level - 0.38 - (1 - k) * 0.12 - plunge * 0.6;
    grid.t[i] = T.Bed;
    grid.water[i] = level;
    grid.noGrass[i] = 1;
    grid.dir[i] = -1;
    grid.side[i] = S.Rock;
  }, 4, 43, 11, 51);
  // The ledge behind the falling water, cut back into the heights, and the spring's channel on top.
  p.each((x, z, i) => {
    if (x >= 3 && x <= 4 && z >= 45 && z <= 48) {
      grid.h[i] = 4.4;
      grid.t[i] = T.Rock;
      grid.noGrass[i] = 1;
      grid.dir[i] = -1;
      grid.side[i] = S.Rock;
    }
  }, 2, 44, 6, 50);
  p.each((x, z, i) => {
    if (x <= 2 && z >= 46 && z <= 47) {
      grid.h[i] = top - 0.45;
      grid.t[i] = T.Bed;
      grid.water[i] = top - 0.1;
      grid.noGrass[i] = 1;
      grid.side[i] = S.Rock;
    }
  }, 0, 45, 3, 49);
  // The lip it pours from: a slab jutting out over the ledge.
  const g = b.g(fx, (z0 + z1) / 2), gl = b.gl(fx, (z0 + z1) / 2);
  g.blob(3.9, top - 0.35, 46.95, 1.75, 0.45, 2.3, PAL.rockDark, 4501, { kind: K.Rock, jitter: 0.18 });
  g.blob(4.6, top - 0.7, 45.0, 0.7, 0.5, 0.6, PAL.rock, 4502, { kind: K.Rock, jitter: 0.25 });
  g.blob(4.5, top - 0.8, 48.9, 0.65, 0.55, 0.6, PAL.rock, 4503, { kind: K.Rock, jitter: 0.25 });
  // The falling water: pale streaks down the curtain, drops falling over them, spray where it lands.
  for (let z = z0, k = 0; z < z1; z += 0.26, k++) {
    const len = top - 0.45 - level + (k % 3) * 0.05, x = fx + (k % 2) * 0.08;
    gl.box(x, level, z, 0.05, len, 0.09, k % 4 === 1 ? [0.36, 0.44, 0.6] : [0.2, 0.26, 0.38], {});
    if (k % 2 === 0) b.fx.addEmitter({ x, y: top - 0.5, z, rate: 9, spec: P.fall, spread: 0.12, vy: 0 });
  }
  for (let z = z0 + 0.3; z < z1; z += 0.9) {
    b.fx.addEmitter({ x: fx + 0.3, y: level + 0.05, z, rate: 4, spec: P.splash, spread: 0.35, vy: 1.6 });
    b.fx.addEmitter({ x: fx + 0.6, y: level + 0.2, z, rate: 1.2, spec: SPRAY, spread: 0.6, vy: 0.4 });
  }
  b.lights.add(6.4, level + 1.4, 46.9, 0x8ab0ff, 4, 6, 0.15);
  // Wet rocks and ferns round the pool, moss on the lip; nothing on the knight's side of the curtain.
  for (const [x, z, s] of [[8.9, 44.4, 0.7], [9.4, 48.6, 0.55], [6.2, 43.9, 0.5], [7.4, 49.5, 0.6]] as [number, number, number][]) b.rock(x, z, s);
  for (const [x, z] of [[8.2, 43.6], [9.6, 46.4], [5.2, 49.8], [5.4, 44.0]] as Pt[]) D.fern(b, x, z, 0.9 + r() * 0.3);
  b.moonflowers(9.0, 47.6, 5, 0.6);
}

/** For the story's part: the stones' places round the ring (as realm1.ts raises them), each with its turn. */
export function stoneAt(k: number): { x: number; z: number; a: number } {
  const a = (k / STONES.n) * Math.PI * 2 + STONES.a0;
  return { x: STONES.x + Math.cos(a) * STONES.r, z: STONES.z + Math.sin(a) * STONES.r, a };
}

