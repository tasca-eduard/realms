import * as THREE from 'three';
import type { Geo } from '../engine/geo';
import { K } from '../engine/materials';
import type { PSpec } from '../engine/particles';
import { fbm, mulberry32 } from '../engine/util';
import { GLOW, type Builder } from './builder';
import * as D from './details';
import { T, type Grid } from './grid';
import { distLine, type Pt } from './paint';
import type { NpcDef, RegionDef } from './realm';
import { boardwalk, floatLantern, netRack, planking, SEA, SHORE } from './sea';

// ---------------------------------------------------------------------------
// The coral village going about its night (the realm 3 content pass): fishers on a drowned coast who built on
// the coral after the tide took their harbour. Dulse's inn, the Harbour Arms, on stilts over the beach where
// the path comes down off the strand (its sign floated across from the drowned quay; a lit room you walk into,
// a hearth, tables, a few regulars); the fish market on the beach below it (stalls of the day's catch, baskets,
// a cook-fire with a pot of chowder, a smoking rack); the boatyard on the shore (boats on trestles being
// re-planked, a tar pot, a net hung to mend); fishers off the jetty and off two stages between the houses;
// children with a ball on the green and a game of tag in the shallows; a coral-carver, an old woman shelling
// mussels, a boy with a crab on a string. Chimney smoke from every house, cooking smells, washing on lines,
// more glass-float lamps. Spread over the shelf, the jetty and the beach round it, open sand between.
// What moves (floats and bites, the ball, tag, the crab) and what they say is src/game/story/reeflife.ts.
// ---------------------------------------------------------------------------

/** The coral village's shelf and its houses (as in realm3.ts). */
const VILLAGE = { x: 37, z: 66 };
const HOUSES = [-52, -16, 22, 57, 92];
/** The Harbour Arms: its floor on stilts a little over the beach, the door in its east wall onto a porch by the
 *  path. (Walls x0..x1, z0..z1; the floor at y.) */
export const INN = { x0: 19, z0: 51, x1: 27, z1: 57, y: 0.9, door: 54, name: 'The Harbour Arms' };
/** The fish market's cook-fire, on the beach between the inn and the shore. */
const MARKET = { x: 23.4, z: 63.4 };
/** The boatyard on the south-west shore. */
const YARD = { x: 20.5, z: 73.4 };
/** Where the children play tag: wet sand and the shallows south of the beach. */
export const TAG = { x0: 25.4, z0: 75.3, x1: 32, z1: 80.6 };
/** The two children throwing a ball on the green's north side. */
export const BALL: [Pt, Pt] = [[33.4, 59.6], [39.1, 58.7]];
/** Granny Whelk's heap of empty shells. */
export const SHELLS = { x: 27.05, z: 73.55 };
/** The coral-carver's block. */
const CARVE = { x: 34.0, z: 72.9 };

/** A spot by the village's middle: r along an angle (in degrees). */
const at = (deg: number, r: number): Pt => {
  const a = (deg * Math.PI) / 180;
  return [VILLAGE.x + Math.cos(a) * r, VILLAGE.z + Math.sin(a) * r];
};

/** The fishing stages between the houses (their angles), each with a fisher on its end. */
const STAGES = [40, 74.5];
/** Who fishes where, which way they face, and where their float sits on the water. */
export const FISHERS: { id: string; x: number; z: number; heading: number }[] = [
  { id: 'bass', x: 49.5, z: 66.65, heading: Math.PI / 2 },
  { id: 'sprat', x: 54.6, z: 66.9, heading: Math.PI / 2 - 0.15 }, // (off Brill's shoulder: 0.5 m from him, his prompt was hers)
  ...STAGES.map((deg, k) => {
    const [x, z] = at(deg, 11.1);
    return { id: k ? 'skua' : 'tern', x, z, heading: (deg * Math.PI) / 180 };
  }),
];
/** A float lies this far out in front of its fisher. */
export const CAST = 2.3;

/** Smoke from chimneys and fires (grey enough to show against the night), and the smell of cooking: warm
 *  wisps that curl up and thin out. */
const SMOKE: PSpec = { color: [0.52, 0.53, 0.6], color2: [0.26, 0.27, 0.32], size: 4, size2: 11, life: 5.5, gravity: -0.35, drag: 0.4, wobble: 0.35, alpha: 0.42, fadeIn: 0.2, soft: true };
const SMELL: PSpec = { color: [1.0, 0.78, 0.48], color2: [0.55, 0.4, 0.25], size: 2, size2: 7, life: 3.6, gravity: -0.28, drag: 0.8, wobble: 0.8, alpha: 0.3, fadeIn: 0.35, soft: true };
const STEAM: PSpec = { color: [0.75, 0.8, 0.85], color2: [0.4, 0.44, 0.5], size: 2, size2: 5, life: 1.6, gravity: -0.9, drag: 1.2, wobble: 0.4, alpha: 0.3, fadeIn: 0.15, soft: true };
const CORAL_DUST: PSpec = { color: [0.95, 0.7, 0.72], size: 1, life: 0.7, gravity: 3, drag: 2, alpha: 0.8 };

const WOOD = { kind: K.Wood };
const PLANK = '#7a5c40', PLANK_D = '#5e4430', POST = '#4e3826', TRIM = '#3a2a1e', THATCH = '#6a6a3a';
const FISH = ['#a8b4bc', '#4a6a8a', '#c86a5a', '#8a7a5a', '#b8c0c8'];

// ---------- small things ----------

/** A fish lying on its side, nose toward local +x. */
function fish(g: Geo, x: number, y: number, z: number, a: number, L: number, col: string) {
  g.push().translate(x, y, z).rotateY(a);
  g.blob(0, 0.03, 0, L * 0.5, 0.045, L * 0.17, col, 7, { flatBottom: true, jitter: 0.1 });
  g.blob(-L * 0.56, 0.025, 0, L * 0.1, 0.02, L * 0.15, col, 9, { flatBottom: true, jitter: 0.1, shade: 0.8 });
  g.box(L * 0.34, 0.055, L * 0.06, 0.03, 0.02, 0.03, '#1a1a20');
  g.pop();
}

/** A wicker basket of something: mussels, crabs, fish, shells. */
function basket(b: Builder, x: number, z: number, what: 'mussels' | 'crabs' | 'fish' | 'shells', s = 1, y0?: number) {
  const g = b.g(x, z), y = y0 ?? b.y(x, z), r = b.rng;
  g.cyl(x, y, z, 0.24 * s, 0.29 * s, 0.32 * s, 8, '#8a6a3a', { kind: K.Thatch });
  g.cyl(x, y + 0.3 * s, z, 0.3 * s, 0.3 * s, 0.04 * s, 8, '#6a4a2a', { kind: K.Wood, cap: false });
  for (let k = 0; k < 6; k++) {
    const a = r() * Math.PI * 2, d = r() * 0.17 * s, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    if (what === 'fish') fish(g, px, y + 0.28 * s, pz, r() * 6, 0.32 * s, FISH[k % FISH.length]);
    else g.blob(px, y + 0.31 * s, pz, 0.07 * s, 0.05 * s, 0.06 * s, what === 'mussels' ? '#23243a' : what === 'crabs' ? '#c8582a' : k % 2 ? SHORE.shell : SHORE.shellPink, Math.floor(r() * 999), { jitter: 0.2 });
  }
}

/** A post with a line sagging to another and washing pegged on it: shirts, an oilskin, sheets, stockings. */
function washingLine(b: Builder, a: Pt, c: Pt) {
  const g = b.g(a[0], a[1]), r = b.rng, ya = b.y(a[0], a[1]), yc = b.y(c[0], c[1]), H = 1.85;
  for (const [x, z, y] of [[a[0], a[1], ya], [c[0], c[1], yc]]) {
    g.box(x, y - 0.1, z, 0.1, H + 0.15, 0.1, POST, WOOD);
    b.collide({ kind: 'c', x, z, r: 0.1, y0: y - 1, y1: y + H });
  }
  const dx = c[0] - a[0], dz = c[1] - a[1], rot = Math.atan2(dz, dx);
  const line = (t: number): [number, number, number] => [a[0] + dx * t, ya + (yc - ya) * t + H - 0.05 - Math.sin(t * Math.PI) * 0.18, a[1] + dz * t];
  for (let k = 0; k < 6; k++) g.beam(line(k / 6), line((k + 1) / 6), 0.008, '#d8d0b8');
  const CLOTHES = ['#d8d0c0', '#3a5a78', '#d8b040', '#b86a5c', '#e0dccc', '#5a7a5a', '#8a4a3a'];
  for (let t = 0.12; t < 0.9; t += 0.11 + r() * 0.07) {
    const [x, y, z] = line(t), col = CLOTHES[Math.floor(r() * CLOTHES.length)], u = r();
    g.push().translate(x, y, z).rotateY(-rot);
    if (u < 0.4) {
      // A shirt, its arms hanging.
      g.box(0, -0.5, 0, 0.42, 0.48, 0.03, col, { kind: K.Cloth, wind: 0.9 });
      for (const s of [-1, 1]) g.box(s * 0.26, -0.36, 0, 0.12, 0.34, 0.03, col, { kind: K.Cloth, wind: 1 });
    } else if (u < 0.7) g.box(0, -0.72, 0, 0.55 + r() * 0.3, 0.7, 0.025, col, { kind: K.Cloth, wind: 1.1 });
    else for (const s of [-1, 1]) g.box(s * 0.08, -0.42, 0, 0.09, 0.4, 0.03, col, { kind: K.Cloth, wind: 1.2 });
    g.pop();
  }
}

/** A stovepipe through the roof of one of the stilt houses, smoke from it. */
function stovepipe(b: Builder, deg: number, k: number) {
  const a = (deg * Math.PI) / 180, x = VILLAGE.x + Math.cos(a) * 10.6, z = VILLAGE.z + Math.sin(a) * 10.6, rot = a + Math.PI;
  const c = Math.cos(rot), s = Math.sin(rot), u = -0.55, v = k % 2 ? 0.5 : -0.5;
  const px = x + c * u - s * v, pz = z + s * u + c * v, g = b.g(px, pz);
  g.cyl(px, 3.3, pz, 0.1, 0.1, 1.15, 6, '#3a3a40', { kind: K.Metal });
  g.cyl(px, 4.42, pz, 0.17, 0.05, 0.12, 6, '#2a2a30', { kind: K.Metal });
  b.fx.addEmitter({ x: px, y: 4.6, z: pz, rate: 0.9 + (k % 3) * 0.3, spec: SMOKE, spread: 0.15, vy: 0.4 });
  // From two of the houses, supper: a smell out of the door.
  if (k === 1 || k === 3) {
    const dx = x + c * 1.5, dz = z + s * 1.5;
    b.fx.addEmitter({ x: dx, y: 1.6, z: dz, rate: 1.2, spec: SMELL, spread: 0.3, vy: 0.25 });
  }
}

/** A stake in the shallows with a glass float lit on it, marking the weir for the boats at night. */
function markerPost(b: Builder, x: number, z: number) {
  const g = b.g(x, z), fl = b.y(x, z);
  g.cyl(x, fl - 0.1, z, 0.06, 0.05, 1.6 - fl, 6, POST, WOOD);
  b.gl(x, z).blob(x, 1.6, z, 0.12, 0.12, 0.12, [0.8, 2.4, 1.7], 93, { detail: 1, jitter: 0 });
  b.lights.add(x, 1.7, z, 0x8ae8c0, 2, 5, 0.15);
}

/** A cell-aligned rectangle of deck at y (where the ground is lower). */
function deck(grid: Grid, x0: number, z0: number, x1: number, z1: number, y: number) {
  for (let z = z0; z < z1; z++)
    for (let x = x0; x < x1; x++) {
      if (!grid.inside(x, z)) continue;
      const i = grid.i(x, z);
      if (grid.h[i] < y) grid.deck[i] = y;
    }
}

// ---------- the inn ----------

/** The Harbour Arms: a long plank house on stilts painted the old harbour red, a roof of kelp thatch, a stone
 *  chimney at its landward end, a porch onto the path with steps down, the old quay's name board over the door.
 *  Inside (its south and east walls and roof fade round the knight): the counter with Dulse behind it, kegs and
 *  shelves of bottles, three tables, the hearth, glass-float lamps hung from the beams, a ship's wheel on the wall. */
function harbourArms(b: Builder, grid: Grid) {
  const { x0, z0, x1, z1, y: FY, door } = INN, H = 2.6, t = 0.2, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const box = new THREE.Box3(new THREE.Vector3(x0 - 0.6, 0, z0 - 0.8), new THREE.Vector3(x1 + 0.6, FY + H + 2.6, z1 + 0.8));
  const s = b.structure('inn', box, [x0, z0, x1, z1], FY);
  const core = s.core, shell = s.shell, r = b.rng;
  const PAINT = '#a2544a', PAINT_D = '#7a3e34', LINING = '#8a6a4a';
  const d0 = door - 0.65, d1 = door + 0.65;

  // The floor on its stilts, boards across it.
  core.box(cx, FY - 0.18, cz, x1 - x0 + 0.1, 0.18, z1 - z0 + 0.1, PLANK_D, { kind: K.Wood, top: '#6e5038' });
  for (let z = z0 + 0.35; z < z1; z += 0.34) core.box(cx, FY, z, x1 - x0 - 0.3, 0.008, 0.025, '#4e3826');
  for (let x = x0 + 0.12; x <= x1; x += (x1 - x0 - 0.24) / 4) for (const z of [z0 + 0.12, cz, z1 - 0.12]) core.box(x, -0.05, z, 0.22, FY - 0.1, 0.22, POST, WOOD);
  // North and west walls stay while the knight is inside (lined with bare planks within); south and east fade.
  core.box(cx, FY, z0 + t / 2, x1 - x0, H, t, PAINT, WOOD);
  core.box(cx, FY, z0 + t + 0.02, x1 - x0 - 0.1, H, 0.04, LINING, WOOD);
  core.box(x0 + t / 2, FY, cz, t, H, z1 - z0, PAINT, WOOD);
  core.box(x0 + t + 0.02, FY, cz, 0.04, H, z1 - z0 - 0.1, LINING, WOOD);
  shell.box(cx, FY, z1 - t / 2, x1 - x0, H, t, PAINT, WOOD);
  shell.box(x1 - t / 2, FY, (z0 + d0) / 2, t, H, d0 - z0, PAINT, WOOD);
  shell.box(x1 - t / 2, FY, (d1 + z1) / 2, t, H, z1 - d1, PAINT, WOOD);
  shell.box(x1 - t / 2, FY + 2.05, door, t, H - 2.05, d1 - d0, PAINT, WOOD);
  // Clapboards on the faces the street sees; corner posts, a skirting board.
  for (let yy = FY + 0.32; yy < FY + H - 0.1; yy += 0.3) {
    shell.box(cx, yy, z1 + 0.01, x1 - x0, 0.035, 0.025, PAINT_D, WOOD);
    shell.box(x1 + 0.01, yy, (z0 + d0) / 2, 0.025, 0.035, d0 - z0, PAINT_D, WOOD);
    if (yy < FY + 2.05 || yy > FY + 2.2) shell.box(x1 + 0.01, yy, (d1 + z1) / 2, 0.025, 0.035, z1 - d1, PAINT_D, WOOD);
  }
  for (const [px, pz] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) (px === x1 || pz === z1 ? shell : core).box(px, FY - 0.05, pz, 0.24, H + 0.08, 0.24, TRIM, WOOD);
  shell.box(cx, FY - 0.02, z1 + 0.03, x1 - x0, 0.24, 0.05, TRIM, WOOD);
  shell.box(x1 + 0.03, FY - 0.02, cz, 0.05, 0.24, z1 - z0, TRIM, WOOD);
  shell.box(cx, FY + H - 0.16, z1 + 0.03, x1 - x0, 0.16, 0.05, TRIM, WOOD);
  shell.box(x1 + 0.03, FY + H - 0.16, cz, 0.05, 0.16, z1 - z0, TRIM, WOOD);
  // The doorway: a frame, the door swung open against the wall outside, the old quay's name board over it
  // (an anchor painted on it: the sign came across on a raft the night the harbour drowned).
  for (const z of [d0 - 0.05, d1 + 0.05]) shell.box(x1 + 0.04, FY, z, 0.1, 2.1, 0.12, TRIM, WOOD);
  shell.box(x1 + 0.04, FY + 2.02, door, 0.1, 0.12, d1 - d0 + 0.24, TRIM, WOOD);
  shell.box(x1 + 0.1, FY + 0.02, d1 + 0.55, 0.07, 1.95, 0.9, '#4a3424', WOOD);
  shell.box(x1 + 0.12, FY + 2.2, door, 0.06, 0.42, 1.9, TRIM, WOOD);
  shell.box(x1 + 0.15, FY + 2.24, door, 0.04, 0.34, 1.78, '#c8b890', WOOD);
  shell.box(x1 + 0.18, FY + 2.29, door, 0.02, 0.24, 0.04, '#2a3a4a');
  shell.box(x1 + 0.18, FY + 2.47, door, 0.02, 0.03, 0.16, '#2a3a4a');
  for (const sg of [-1, 1]) shell.beam([x1 + 0.18, FY + 2.3, door], [x1 + 0.18, FY + 2.35, door + sg * 0.12], 0.015, '#2a3a4a');
  for (const sg of [-1, 1]) for (let k = 0; k < 3; k++) shell.box(x1 + 0.18, FY + 2.36, door + sg * (0.3 + k * 0.17), 0.02, 0.06, 0.1, '#5a3a2a');
  // Windows, lit warm: on the south and east faces (fading with them), the far walls dark with the night.
  const win = (gl: Geo, g: Geo, x: number, z: number, nx: number, nz: number, col: [number, number, number]) => {
    const w = 0.62, h = 0.62, y = FY + 1.0;
    gl.box(x + nx * 0.02, y, z + nz * 0.02, nx ? 0.04 : w, h, nx ? w : 0.04, col, { kind: 0 });
    g.box(x + nx * 0.05, y - 0.08, z + nz * 0.05, nx ? 0.1 : w + 0.16, 0.08, nx ? w + 0.16 : 0.1, TRIM, WOOD);
    g.box(x + nx * 0.04, y + h, z + nz * 0.04, nx ? 0.08 : w + 0.12, 0.08, nx ? w + 0.12 : 0.08, TRIM, WOOD);
    g.box(x + nx * 0.04, y, z + nz * 0.04, 0.05, h, 0.05, TRIM);
    for (const sg of [-1, 1]) g.box(x + nx * 0.06 + (nz ? sg * (w / 2 + 0.14) : 0), y - 0.02, z + nz * 0.06 + (nx ? sg * (w / 2 + 0.14) : 0), nx ? 0.04 : 0.24, h + 0.04, nx ? 0.24 : 0.04, '#3a5a5a', WOOD);
  };
  for (const [x, on] of [[20.8, 1], [23.3, 0.5], [25.6, 1]] as const) {
    win(s.shellGlow, shell, x, z1, 0, 1, on > 0.7 ? GLOW.window : GLOW.windowDim);
    b.lights.add(x, FY + 1.2, z1 + 1, 0xffa050, 3.2, 5, 0.06);
  }
  for (const z of [52.1, 55.9]) win(s.shellGlow, shell, x1, z, 1, 0, z > 55 ? GLOW.window : GLOW.windowDim);
  for (const x of [25.4, 20.3]) s.glow.box(x, FY + 1.0, z0 + t + 0.05, 0.6, 0.6, 0.02, [0.05, 0.07, 0.12], { kind: 0 });
  // The roof: dried kelp over a ridge (as the village thatches), a loft window lit in its east gable.
  shell.push().translate(cx, FY + H, cz);
  shell.gable(0, 0, 0, x1 - x0 + 0.9, z1 - z0 + 1.3, 2.3, THATCH, PAINT, { kind: K.Thatch });
  shell.box(0, 2.2, 0, x1 - x0 + 1.0, 0.16, 0.3, '#5a5a30', { kind: K.Thatch });
  for (const ex of [-(x1 - x0 + 0.9) / 2 - 0.03, (x1 - x0 + 0.9) / 2 + 0.03]) for (const ez of [-1, 1]) shell.beam([ex, -0.05, (ez * (z1 - z0 + 1.3)) / 2], [ex, 2.3, 0], 0.05, TRIM, WOOD);
  shell.pop();
  s.shellGlow.box(x1 + 0.47, FY + H + 0.5, cz, 0.03, 0.5, 0.46, GLOW.windowDim, { kind: 0 });
  shell.box(x1 + 0.48, FY + H + 0.42, cz, 0.06, 0.08, 0.62, TRIM, WOOD);
  // The chimney at the landward end, the hearth's smoke out of it.
  core.box(x0 + 0.45, FY - 0.1, 55, 0.9, H + 3.1, 1.25, '#6a6670', { kind: K.Brick });
  core.box(x0 + 0.45, FY + H + 3.0, 55, 1.05, 0.14, 1.4, '#55525c', { kind: K.Brick });
  b.fx.addEmitter({ x: x0 + 0.45, y: FY + H + 3.3, z: 55, rate: 1.6, spec: SMOKE, spread: 0.25, vy: 0.45 });
  b.fx.addEmitter({ x: x0 + 0.45, y: FY + H + 3.3, z: 55, rate: 0.6, spec: SMELL, spread: 0.3, vy: 0.3 });

  // Within: the hearth on the west wall, its fire always in.
  const hx = x0 + t;
  core.box(hx + 0.35, FY, 55, 0.7, 1.55, 1.9, '#5a5660', { kind: K.Brick });
  core.box(hx + 0.71, FY, 55, 0.04, 0.95, 1.05, '#0a0808');
  core.box(hx + 0.5, FY + 1.5, 55, 1.0, 0.1, 2.1, TRIM, WOOD);
  s.glow.box(hx + 0.72, FY + 0.04, 55, 0.08, 0.32, 0.85, GLOW.flame, { kind: 1 });
  b.fx.addEmitter({ x: hx + 0.78, y: FY + 0.3, z: 55, rate: 16, spec: { color: [4.5, 2.2, 0.6], color2: [1.4, 0.25, 0.05], size: 2, size2: 1, life: 0.45, gravity: -2.2, drag: 2, fadeIn: 0.05 }, spread: 0.4, vy: 0.5 });
  b.lights.add(hx + 1.5, FY + 1.0, 55, 0xff8a38, 12, 7, 0.3);
  b.fires.push({ x: hx + 0.8, y: FY + 0.3, z: 55, big: false });
  // A great cod mounted over it; pots and a kettle on the mantel.
  core.push().translate(hx + 0.08, FY + 1.95, 55).rotateY(Math.PI / 2).rotateX(-Math.PI / 2);
  fish(core, 0, 0, 0, 0, 1.1, '#8a8a72');
  core.pop();
  for (const [z, col] of [[54.3, '#8a5a3a'], [54.6, '#3a3a40'], [55.6, '#6a7a6a']] as const) core.cyl(hx + 0.55, FY + 1.6, z, 0.08, 0.07, 0.16, 6, col);
  // The counter, Dulse's side of it toward the north wall: kegs at its end, shelves of bottles behind.
  core.box(21.8, FY, 52.9, 3.6, 1.05, 0.55, '#6e4e34', { kind: K.Wood, top: '#8a6a48' });
  core.box(21.8, FY + 0.05, 53.18, 3.5, 0.06, 0.04, TRIM, WOOD);
  for (const [x, z] of [[20.4, 52.85], [22.7, 52.95]]) core.cyl(x, FY + 1.05, z, 0.07, 0.06, 0.16, 6, '#c8a040');
  core.push().translate(0, FY, 0);
  b.barrel(19.6, 51.68, core);
  b.barrel(19.6, 52.36, core);
  core.pop();
  for (const sy of [1.2, 1.7]) {
    core.box(21.8, FY + sy, z0 + t + 0.2, 3.2, 0.05, 0.32, TRIM, WOOD);
    for (let k = 0; k < 9; k++) core.cyl(20.4 + k * 0.35 + (r() - 0.5) * 0.08, FY + sy + 0.05, z0 + t + 0.2, 0.055, 0.045, 0.2 + r() * 0.1, 6, ['#3a6a4a', '#6a4a2a', '#4a5a7a', '#8a8a6a'][Math.floor(r() * 4)]);
  }
  b.collide({ kind: 'b', x0: 19.9, z0: 52.6, x1: 23.65, z1: 53.2, y0: -1, y1: FY + 1.2 });
  b.collide({ kind: 'b', x0: x0, z0: 51.2, x1: 19.95, z1: 52.75, y0: -1, y1: FY + 1 });
  b.collide({ kind: 'b', x0: x0, z0: 54, x1: hx + 0.75, z1: 56, y0: -1, y1: FY + 2 });
  // Three tables and their benches, a candle on each.
  for (const [tx, tz] of [[25.05, 52.3], [25.25, 55.85], [21.85, 55.6]]) {
    b.table(tx, tz, core, FY);
    b.bench(tx, tz - 0.78, 0, core, FY);
    b.bench(tx, tz + 0.78, 0, core, FY);
    s.glow.box(tx + 0.12, FY + 0.82, tz, 0.05, 0.1, 0.05, GLOW.flame, { kind: 1 });
    b.lights.add(tx + 0.12, FY + 1.3, tz, 0xffa050, 2.2, 3.5, 0.2);
  }
  // Beams under the roof, glass floats hung from them glowing sea-green; a rug down the way in; the wheel of the
  // harbour's pilot boat on the wall, a net with floats in it.
  for (const x of [21.4, 24.2]) core.box(x, FY + H - 0.2, cz, 0.16, 0.16, z1 - z0 - 0.3, POST, WOOD);
  for (const [x, z] of [[21.4, 54.2], [24.2, 52.6], [24.2, 55.4]]) {
    core.beam([x, FY + H - 0.2, z], [x, FY + 2.05, z], 0.01, '#8a7a5a');
    s.glow.blob(x, FY + 1.95, z, 0.13, 0.13, 0.13, [0.8, 2.4, 1.7], 93, { detail: 1, jitter: 0 });
    b.lights.add(x, FY + 1.8, z, 0x8ae8c0, 1.6, 4, 0.1);
  }
  core.box(23.9, FY + 0.005, door, 3.6, 0.015, 1.15, '#3a5a78', { kind: K.Cloth });
  core.box(23.9, FY + 0.008, door, 3.4, 0.015, 0.9, '#c8b890', { kind: K.Cloth });
  core.push().translate(25.2, FY + 1.55, z0 + t + 0.1).rotateX(Math.PI / 2);
  core.cyl(0, -0.04, 0, 0.1, 0.1, 0.08, 8, '#5a3a24', { kind: K.Wood });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, a2 = ((k + 1) / 8) * Math.PI * 2;
    core.beam([Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08], [Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55], 0.025, '#6e4e34', WOOD);
    core.beam([Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4], [Math.cos(a2) * 0.4, 0, Math.sin(a2) * 0.4], 0.035, '#6e4e34', WOOD);
  }
  core.pop();
  core.quad([23.4, FY + 2.3, z0 + t + 0.07], [22.4, FY + 2.3, z0 + t + 0.07], [22.5, FY + 1.6, z0 + t + 0.07], [23.5, FY + 1.75, z0 + t + 0.07], SHORE.net, { kind: K.Cloth });
  for (const [x, y] of [[22.6, 2.1], [23.2, 1.9]]) s.glow.blob(x, FY + y, z0 + t + 0.12, 0.08, 0.08, 0.08, [0.6, 1.8, 1.3], 95, { jitter: 0 });

  // The walls (a gap for the door).
  const wall = (ax0: number, az0: number, ax1: number, az1: number) => b.collide({ kind: 'b', x0: ax0, z0: az0, x1: ax1, z1: az1, y0: -1, y1: FY + H + 3 });
  wall(x0 - 0.05, z0 - 0.05, x1 + 0.05, z0 + t);
  wall(x0 - 0.05, z0, x0 + t, z1);
  wall(x0, z1 - t, x1 + 0.05, z1 + 0.05);
  wall(x1 - t, z0, x1 + 0.12, d0);
  wall(x1 - t, d1, x1 + 0.12, z1);
  deck(grid, x0, z0, x1, z1, FY);

  // The porch onto the path: boards on posts, a rail round it but for the steps, a bench and a keg, a lamp; the
  // inn's sign on a post at its corner.
  const g = b.g(x1 + 1, door);
  for (let x = x1 + 0.2; x < x1 + 2; x += 0.42) g.box(x, FY - 0.12, door, 0.38, 0.12, 4 * (0.97 + r() * 0.05), r() < 0.2 ? PLANK_D : PLANK, { kind: K.Wood, shade: 0.85 + r() * 0.25 });
  for (const [x, z] of [[x1 + 1.9, 52.1], [x1 + 1.9, 55.9], [x1 + 1.0, 52.1], [x1 + 1.0, 55.9]]) g.box(x, -0.05, z, 0.16, FY + 0.05, 0.16, POST, WOOD);
  for (const z of [52.08, 55.92]) {
    g.box(x1 + 1, FY + 0.85, z, 2, 0.07, 0.07, PLANK_D, WOOD);
    for (const x of [x1 + 0.1, x1 + 1, x1 + 1.9]) g.box(x, FY, z, 0.09, 0.9, 0.09, POST, WOOD);
    b.collide({ kind: 'b', x0: x1, z0: z - 0.08, x1: x1 + 2, z1: z + 0.08, y0: -1, y1: FY + 1 });
  }
  for (const [za, zb] of [[52.08, 53], [55, 55.92]]) {
    g.box(x1 + 1.93, FY + 0.85, (za + zb) / 2, 0.07, 0.07, zb - za, PLANK_D, WOOD);
    g.box(x1 + 1.93, FY, za === 52.08 ? zb : za, 0.09, 0.9, 0.09, POST, WOOD);
    b.collide({ kind: 'b', x0: x1 + 1.85, z0: za, x1: x1 + 2.02, z1: zb, y0: -1, y1: FY + 1 });
  }
  g.box(x1 + 2.5, -0.05, door, 1.0, 0.55, 2.0, PLANK, { kind: K.Wood, top: '#8a6a48' });
  g.box(x1 + 2.98, -0.05, door, 0.06, 0.5, 2.0, PLANK_D, WOOD);
  deck(grid, x1, 52, x1 + 2, 56, FY);
  deck(grid, x1 + 2, 53, x1 + 3, 55, 0.5);
  b.bench(x1 + 0.45, 55.1, Math.PI / 2, g, FY);
  g.push().translate(0, FY, 0);
  b.barrel(x1 + 0.45, 52.55, g);
  g.pop();
  b.collide({ kind: 'c', x: x1 + 0.45, z: 52.55, r: 0.3, y0: -1, y1: FY + 0.8 });
  g.box(x1 + 1.9, FY, 52.1, 0.14, 2.75, 0.14, POST, WOOD);
  D.hangingSign(g, x1 + 1.9, FY + 2.6, 52.1, Math.PI / 2, 'mug');
  floatLantern(b, x1 + 1.75, 55.75, FY);
  floatLantern(b, x1 + 3.4, 52.4);
  // Nets hung on the south wall to dry, glass floats in them.
  for (let k = 0; k < 4; k++) {
    const xa = 20.1 + k * 0.9, xb = xa + 0.9, sag = (k % 2 ? 0.18 : 0.08);
    shell.quad([xa, FY + 2.25, z1 + 0.06], [xb, FY + 2.25, z1 + 0.06], [xb - 0.05, FY + 1.5 - sag, z1 + 0.08], [xa + 0.05, FY + 1.45, z1 + 0.08], SHORE.net, { kind: K.Cloth, wind: 0.2 });
    s.shellGlow.blob(xa + 0.45, FY + 1.75 - sag * 0.5, z1 + 0.14, 0.1, 0.1, 0.1, [0.8, 2.4, 1.7], 97 + k, { jitter: 0 });
  }
}

// ---------- the market ----------

/** A fish stall: a counter of planks on trestles, the catch laid out on kelp, a sailcloth awning on poles over
 *  it (sloping toward the customer, local +z), a glass float lit under it, baskets by it. */
function fishStall(b: Builder, x: number, z: number, rot: number, stripe: string) {
  const g = b.g(x, z), gl = b.gl(x, z), y = b.y(x, z), r = b.rng;
  g.push().translate(x, y, z).rotateY(rot);
  g.box(0, 0.78, 0, 2.2, 0.08, 0.85, PLANK, { kind: K.Wood, top: '#8a6a48' });
  for (const sx of [-0.9, 0.9]) for (const sz of [-0.3, 0.3]) g.box(sx, 0, sz, 0.08, 0.78, 0.08, POST, WOOD);
  g.blob(0, 0.86, 0, 1.0, 0.03, 0.38, SEA.kelpDark, 3, { flatBottom: true, kind: K.Leaves, jitter: 0.3 });
  for (let k = 0; k < 9; k++) fish(g, -0.85 + (k % 5) * 0.42 + (r() - 0.5) * 0.1, 0.87, k < 5 ? -0.15 : 0.18, (r() - 0.5) * 0.5, 0.36 + r() * 0.14, FISH[Math.floor(r() * FISH.length)]);
  // A big one hung from the awning's bar, for show.
  g.beam([0.55, 2.0, 0.42], [0.55, 1.75, 0.42], 0.01, '#8a7a5a');
  g.push().translate(0.55, 1.45, 0.42).rotateZ(Math.PI / 2);
  fish(g, 0, 0, 0, 0, 0.62, '#8a9aa4');
  g.pop();
  for (const [px, pz, h] of [[-1.1, -0.5, 2.35], [1.1, -0.5, 2.35], [-1.1, 0.75, 1.95], [1.1, 0.75, 1.95]]) g.box(px, 0, pz, 0.09, h, 0.09, POST, WOOD);
  for (let k = 0; k < 6; k++) {
    const xa = -1.2 + (k * 2.4) / 6, xb = -1.2 + ((k + 1) * 2.4) / 6, col = k % 2 ? '#c8bca0' : stripe;
    g.quad([xa, 1.95, 0.85], [xb, 1.95, 0.85], [xb, 2.35, -0.55], [xa, 2.35, -0.55], col, { kind: K.Cloth, wind: 0.25 });
    g.quad([xa, 2.35, -0.55], [xb, 2.35, -0.55], [xb, 1.95, 0.85], [xa, 1.95, 0.85], col, { kind: K.Cloth, wind: 0.25 });
    g.box((xa + xb) / 2, 1.8, 0.85, xb - xa, 0.15, 0.02, k % 2 ? stripe : '#c8bca0', { kind: K.Cloth, wind: 0.5 });
  }
  g.beam([-0.4, 2.15, 0.1], [-0.4, 1.9, 0.1], 0.01, '#8a7a5a');
  g.pop();
  const c = Math.cos(rot), s = Math.sin(rot), w = (lx: number, lz: number): Pt => [x + lx * c + lz * s, z - lx * s + lz * c];
  const [lx, lz] = w(-0.4, 0.1);
  gl.blob(lx, y + 1.8, lz, 0.12, 0.12, 0.12, [0.8, 2.4, 1.7], 93, { detail: 1, jitter: 0 });
  b.lights.add(lx, y + 1.7, lz, 0x8ae8c0, 2.4, 5, 0.12);
  for (const [bx, bz, what] of [[-1.55, 0.35, 'crabs'], [1.5, 0.45, 'mussels'], [1.45, -0.35, 'fish']] as const) {
    const [px, pz] = w(bx, bz);
    basket(b, px, pz, what);
  }
  const [qx, qz] = w(0.2, -1.0);
  b.crate(qx, qz, 0.55);
  for (const lxx of [-0.75, 0.75]) {
    const [px, pz] = w(lxx, 0);
    b.collide({ kind: 'c', x: px, z: pz, r: 0.55, y0: y - 1, y1: y + 2 });
  }
}

/** The cook-fire: a ring of stones, a tripod of driftwood, the chowder pot steaming on its chain; crates and a
 *  log to sit on round it. */
function cookFire(b: Builder, x: number, z: number) {
  const g = b.g(x, z), y = b.y(x, z);
  b.campfire(x, z);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    g.beam([x + Math.cos(a) * 0.85, y - 0.05, z + Math.sin(a) * 0.85], [x, y + 1.75, z], 0.045, SHORE.driftDark, { kind: K.Bark });
  }
  g.beam([x, y + 1.75, z], [x, y + 1.05, z], 0.015, '#3a3a44');
  g.cyl(x, y + 0.55, z, 0.26, 0.36, 0.26, 9, '#2a2a30', { kind: K.Metal });
  g.cyl(x, y + 0.81, z, 0.36, 0.33, 0.18, 9, '#2a2a30', { kind: K.Metal, top: '#c8a870' });
  g.beam([x + 0.1, y + 0.95, z], [x + 0.45, y + 1.35, z + 0.15], 0.02, '#6a4a2a');
  b.fx.addEmitter({ x, y: y + 1.05, z, rate: 2.2, spec: STEAM, spread: 0.2, vy: 0.4 });
  b.fx.addEmitter({ x, y: y + 1.3, z, rate: 1.4, spec: SMELL, spread: 0.35, vy: 0.3 });
  for (const [a, k] of [[0.3, 0], [2.2, 1], [4.1, 0]] as const) {
    const sx = x + Math.cos(a) * 1.7, sz = z + Math.sin(a) * 1.7;
    if (k) D.fallenLog(b, sx, sz, 1.4, a + Math.PI / 2);
    else b.crate(sx, sz, 0.5);
  }
  // Bowls stacked on a crate by it, a ladle.
  const bx = x + Math.cos(0.3) * 1.7, bz = z + Math.sin(0.3) * 1.7, by = y + 0.5;
  for (let k = 0; k < 3; k++) g.cyl(bx - 0.1 + k * 0.02, by + k * 0.05, bz, 0.12, 0.15, 0.05, 7, '#8a6a48', WOOD);
}

/** A rack where fish are smoked: driftwood A-frames, bars with split fish hung on them in rows, over a pit
 *  smouldering under a lid of turf. */
function smokeRack(b: Builder, x: number, z: number, rot: number) {
  const g = b.g(x, z), gl = b.gl(x, z), y = b.y(x, z), r = b.rng;
  g.push().translate(x, y, z).rotateY(rot);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.beam([sx * 1.1, -0.05, sz * 0.5], [sx * 1.1, 1.75, 0], 0.045, SHORE.driftDark, { kind: K.Bark });
  for (const h of [1.65, 1.3]) {
    g.box(0, h, 0, 2.3, 0.05, 0.05, SHORE.drift, WOOD);
    for (let k = 0; k < 8; k++) {
      g.push().translate(-0.95 + k * 0.27, h - 0.24, (r() - 0.5) * 0.04).rotateZ(Math.PI / 2 + (r() - 0.5) * 0.1);
      fish(g, 0, 0, 0, 0, 0.4, k % 3 ? '#8a6a3a' : '#a07a40');
      g.pop();
    }
  }
  g.blob(0, 0.05, 0, 0.9, 0.18, 0.5, '#3a2a1e', 5, { flatBottom: true, kind: K.Dirt });
  g.pop();
  gl.box(x, y + 0.12, z, 0.5, 0.05, 0.25, [1.4, 0.4, 0.1], { kind: 1 });
  b.fx.addEmitter({ x, y: y + 0.5, z, rate: 2.2, spec: SMOKE, spread: 0.6, vy: 0.3 });
  b.collide({ kind: 'c', x, z, r: 0.9, y0: y - 1, y1: y + 1.8 });
}

// ---------- the boatyard ----------

/** A rowing boat's hull in local space (as the crew's longboat, smaller), drawn with planking; keep() says which
 *  planks are still on (the ones off show the ribs). */
function hull(g: Geo, keep: (side: number, k: number, u: number) => boolean) {
  const L = 1.55, B = 0.68, Dp = 0.6;
  const at = (u: number, t: number, side: number): [number, number, number] => {
    const f = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u) / (L + 0.3 * t), 2.2)), 0.55);
    return [u, -Dp * 0.55 + Dp * t + Math.pow(Math.abs(u) / L, 3) * 0.25, side * (0.05 + (B - 0.05) * (1 - Math.pow(1 - t, 2)) * f)];
  };
  planking(g, at, (t) => [-L - 0.3 * t, L + 0.3 * t], 4, 0.4, (_y, k) => (k % 2 ? '#8a9c9c' : '#6a8a98'), (side, k, u) => keep(side, k, u));
  g.sweep([[-L - 0.35, Dp * 0.5, 0], [-L + 0.3, -Dp * 0.55, 0], [L - 0.3, -Dp * 0.55, 0], [L + 0.35, Dp * 0.5, 0]], [0.05, 0.06, 0.06, 0.05], '#3a2a1e', { kind: K.Wood, seg: 4, lumpy: 0.05 });
  // Ribs inside, where a plank is off they show.
  for (let u = -1.1; u <= 1.1; u += 0.37)
    for (const side of [-1, 1]) g.beam(at(u, 0.05, side), at(u, 0.98, side), 0.025, '#6e5038', WOOD);
}

/** A boat turned keel-up on two trestles, a strake off it and new planks leaning by it. */
function boatOnTrestles(b: Builder, x: number, z: number, rot: number) {
  const g = b.g(x, z), y = b.y(x, z);
  g.push().translate(x, y + 1.05, z).rotateY(-rot).rotateX(Math.PI);
  hull(g, (side, k, u) => !(side < 0 && k === 1 && u > -0.6 && u < 0.5));
  g.pop();
  g.push().translate(x, y, z).rotateY(-rot);
  for (const u of [-0.85, 0.85]) {
    for (const sz of [-1, 1]) g.beam([u, -0.05, sz * 0.75], [u, 0.85, sz * 0.15], 0.05, POST, WOOD);
    g.box(u, 0.8, 0, 0.12, 0.1, 0.6, POST, WOOD);
  }
  for (let k = 0; k < 3; k++) g.beam([-0.6 + k * 0.5, 0.02, -1.25 - k * 0.05], [-0.4 + k * 0.5, 1.0, -0.85], 0.04, k ? '#a08060' : '#8a7050', WOOD);
  g.pop();
  const c = Math.cos(rot), s = Math.sin(rot);
  for (const u of [-1, 0, 1]) b.collide({ kind: 'c', x: x + c * u, z: z + s * u, r: 0.75, y0: y - 1, y1: y + 1.4 });
}

/** A boat upright on blocks, a gap in its side where the planks are off, the new ones and a tar brush by it. */
function boatOnBlocks(b: Builder, x: number, z: number, rot: number) {
  const g = b.g(x, z), y = b.y(x, z);
  g.push().translate(x, y + 0.45, z).rotateY(-rot);
  hull(g, (side, k, u) => !(side > 0 && k >= 1 && k <= 2 && u > -0.7 && u < 0.4));
  g.box(0.1, 0.12, 0, 0.25, 0.05, 1.1, '#7a5c40', WOOD);
  g.pop();
  g.push().translate(x, y, z).rotateY(-rot);
  for (const u of [-0.8, 0.8]) g.box(u, -0.05, 0, 0.4, 0.25, 0.5, '#6a6670', { kind: K.Rock });
  for (let k = 0; k < 4; k++) g.box(-0.2 + k * 0.05, 0.02 + k * 0.05, 1.05, 2.0, 0.05, 0.2, k % 2 ? '#a08060' : '#8a7050', WOOD);
  g.pop();
  const c = Math.cos(rot), s = Math.sin(rot);
  for (const u of [-0.9, 0.2, 1.1]) b.collide({ kind: 'c', x: x + c * u, z: z + s * u, r: 0.7, y0: y - 1, y1: y + 1 });
}

/** The tar pot over a little fire, thick smoke off it. */
function tarPot(b: Builder, x: number, z: number) {
  const g = b.g(x, z), gl = b.gl(x, z), y = b.y(x, z);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    g.blob(x + Math.cos(a) * 0.32, y + 0.06, z + Math.sin(a) * 0.32, 0.13, 0.1, 0.13, SHORE.rockDark, 40 + k, { kind: K.Rock, flatBottom: true });
  }
  gl.box(x, y + 0.02, z, 0.3, 0.05, 0.3, [2.2, 0.7, 0.15], { kind: 1 });
  g.cyl(x, y + 0.18, z, 0.2, 0.24, 0.3, 8, '#22222a', { kind: K.Metal, top: '#0e0e10' });
  g.beam([x, y + 0.45, z], [x + 0.25, y + 0.85, z + 0.2], 0.02, '#6a4a2a');
  b.fx.addEmitter({ x, y: y + 0.5, z, rate: 1.6, spec: SMOKE, spread: 0.15, vy: 0.35 });
  b.lights.add(x, y + 0.5, z, 0xff7a30, 3, 4, 0.35);
  b.collide({ kind: 'c', x, z, r: 0.42, y0: y - 1, y1: y + 0.5 });
}

// ---------- people at their work ----------

/** The coral-carver's place: a block of dead coral on a stump, chips round it, what she's carved laid out on a
 *  cloth, a basket of rough coral; dust off the block as she works. */
function carverBlock(b: Builder, x: number, z: number) {
  const g = b.g(x, z), d = b.d(x, z), y = b.y(x, z), r = b.rng;
  g.cyl(x, y - 0.05, z, 0.32, 0.36, 0.55, 8, '#6e5038', { kind: K.Bark, top: '#a08a60' });
  g.blob(x, y + 0.66, z, 0.28, 0.18, 0.24, '#e8c0c0', 31, { kind: K.Rock, jitter: 0.3 });
  for (let k = 0; k < 12; k++) d.blob(x + (r() - 0.5) * 1.3, y + 0.02, z + (r() - 0.5) * 1.3, 0.04, 0.02, 0.04, k % 3 ? '#e8d0cc' : '#d8a0a0', k, { flatBottom: true });
  g.box(x + 0.15, y + 0.56, z - 0.1, 0.22, 0.04, 0.06, '#5a4a3a', WOOD);
  // The cloth of carvings: little fish, a comb, floats, a whale.
  const cx = x + 0.95, cz = z - 0.55;
  d.box(cx, y + 0.01, cz, 0.9, 0.015, 0.6, '#3a5a78', { kind: K.Cloth });
  for (let k = 0; k < 5; k++) fish(d, cx - 0.32 + k * 0.16, y + 0.02, cz - 0.12 + (k % 2) * 0.22, 0.4 * k, 0.14, k % 2 ? '#e8b0b0' : '#f0e0d8');
  d.blob(cx + 0.25, y + 0.06, cz + 0.12, 0.16, 0.06, 0.07, '#f0d8d0', 33, { flatBottom: true });
  basket(b, x - 0.75, z + 0.35, 'shells', 1.1);
  b.fx.addEmitter({ x, y: y + 0.75, z, rate: 2.5, spec: CORAL_DUST, spread: 0.15, vy: 0.6 });
  b.collide({ kind: 'c', x, z, r: 0.38, y0: y - 1, y1: y + 0.8 });
}

/** Granny Whelk's place: an old fish crate to sit on, a basket of mussels, a bucket, the heap of empty shells. */
function shellingSpot(b: Builder, x: number, z: number) {
  const g = b.g(x, z), d = b.d(x, z), y = b.y(x, z), r = b.rng;
  g.box(x, y, z, 0.5, 0.34, 0.42, '#7a5c40', WOOD);
  g.box(x, y + 0.3, z, 0.52, 0.05, 0.44, PLANK_D, WOOD);
  basket(b, x - 0.55, z + 0.3, 'mussels');
  g.cyl(x + 0.55, y, z - 0.15, 0.17, 0.2, 0.32, 8, '#6a7a7a', { kind: K.Metal });
  g.cyl(x + 0.55, y + 0.26, z - 0.15, 0.17, 0.17, 0.02, 8, '#2a3a4a');
  const hx = SHELLS.x, hz = SHELLS.z;
  for (let k = 0; k < 22; k++) {
    const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * 0.4;
    d.blob(hx + Math.cos(a) * rr, y + 0.03 + (0.4 - rr) * 0.25, hz + Math.sin(a) * rr, 0.06, 0.03, 0.045, k % 4 ? '#2a2c40' : SHORE.shell, k + 50, { jitter: 0.15 });
  }
  b.collide({ kind: 'c', x, z, r: 0.3, y0: y - 1, y1: y + 0.35 });
}

/** A little castle of sand the children built at the water's edge, a stick flag in it. */
function sandCastle(b: Builder, x: number, z: number) {
  const g = b.d(x, z), y = b.y(x, z);
  g.cyl(x, y - 0.02, z, 0.45, 0.4, 0.16, 8, '#b8a070', { kind: K.Sand });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    g.cyl(x + Math.cos(a) * 0.3, y + 0.1, z + Math.sin(a) * 0.3, 0.1, 0.08, 0.18, 6, '#c0a878', { kind: K.Sand });
  }
  g.cyl(x, y + 0.12, z, 0.16, 0.12, 0.28, 6, '#c0a878', { kind: K.Sand });
  g.beam([x, y + 0.35, z], [x, y + 0.7, z], 0.01, '#5a4a3a');
  g.box(x + 0.07, y + 0.58, z, 0.14, 0.09, 0.01, '#c83a3a', { kind: K.Cloth, wind: 1 });
}

/** A trail of trodden sand from cell to cell (no change in height). */
function trail(grid: Grid, pts: Pt[], w: number) {
  const x0 = Math.floor(Math.min(...pts.map((p) => p[0])) - w - 1), x1 = Math.ceil(Math.max(...pts.map((p) => p[0])) + w + 1);
  const z0 = Math.floor(Math.min(...pts.map((p) => p[1])) - w - 1), z1 = Math.ceil(Math.max(...pts.map((p) => p[1])) + w + 1);
  for (let z = z0; z <= z1; z++)
    for (let x = x0; x <= x1; x++) {
      if (!grid.inside(x, z)) continue;
      const i = grid.i(x, z), d = distLine(pts, x + 0.5, z + 0.5) + (fbm(x * 0.4, z * 0.4, 2, 87) - 0.5) * 0.9;
      if (d < w / 2 && grid.h[i] > 0 && grid.h[i] < 0.4 && grid.deck[i] < -99) grid.t[i] = T.Path;
    }
}

// ---------- the people ----------

function people(): NpcDef[] {
  const F = (id: string) => FISHERS.find((f) => f.id === id)!;
  const fisher = (id: string, look: string, name: string, lines: string[]): NpcDef => ({ id, look, name, x: F(id).x, z: F(id).z, pose: 'fish', heading: F(id).heading, lines });
  return [
    // The Harbour Arms' regulars, at their tables.
    { id: 'gurnard', look: 'reefsalt', name: 'Bosun Gurnard', x: 21.85, z: 54.82, pose: 'sit', heading: Math.PI / 2, lines: [
      'Sit, sit. I was bosun of the harbour\'s pilot boat. Then the harbour went under, and the boat with it, and here I sit.',
      'The night the sea rose, the bells of the drowned kingdom rang under the water. You could hear them through the hull.',
    ] },
    { id: 'wrasse', look: 'reeflad', name: 'Wrasse the Fisher', x: 25.05, z: 51.52, pose: 'sit', heading: Math.PI / 2, lines: [
      'Fish are thin on the reef since the crew came. They dive with nets and take everything, even the little ones.',
      'I would go after them myself, but I promised my mother I would come home dry.',
    ] },
    { id: 'mullet', look: 'reefold2', name: 'Old Mullet', x: 25.25, z: 55.07, pose: 'sit', heading: Math.PI / 2, lines: [
      'Want a tale? When I was a lad there was a quay, a fish hall with a roof on it, a lighthouse with a keeper. Now the lighthouse keeps goblins.',
      'We rowed off the drowned quay with what we could carry and tied up to the coral. Forty years ago, that. We never untied.',
    ] },
    // Fishing off the jetty and off the stages between the houses.
    fisher('bass', 'reeffisher', 'Bass the Fisher', [
      'Shh. You will scare the fish. ...A joke. They have been scared since the crew came.',
      'We fish off the jetty now. The good water is out past the coral gardens, and the crew\'s divers keep it.',
    ]),
    fisher('sprat', 'reefgirl', 'Sprat', [
      'Grandad Hake says if I am quiet the fish come. I am being quiet. Very quiet. Are you being quiet?',
      'I caught a crab once. It caught me back.',
    ]),
    fisher('tern', 'reeffisher2', 'Tern the Fisher', [
      'The tide took the harbour in one night. We rowed out over the roofs and tied up here. Fishers do not stay on land.',
      'Every plank in this village is boat timber or driftwood. The sea gives back what it takes, slowly.',
    ]),
    fisher('skua', 'reeffisher3', 'Skua the Fisher', [
      'Mackerel at dusk, cod at night, nothing at all since the crew came.',
      'The coral eats line. The goblins eat fish. I eat what is left.',
    ]),
    // Children: two with a ball on the green, two at tag in the shallows, a boy with his crab.
    { id: 'minnow', look: 'reefgirl2', name: 'Minnow', x: BALL[0][0], z: BALL[0][1], pose: 'play', heading: Math.atan2(BALL[1][1] - BALL[0][1], BALL[1][0] - BALL[0][0]), lines: [
      'Catch! ...Not you. Him.',
      'It is a fish bladder, blown up and sewn into sailcloth. Ling made it. Do not pop it.',
    ] },
    { id: 'smelt', look: 'reefchild2', name: 'Smelt', x: BALL[1][0], z: BALL[1][1], pose: 'play', heading: Math.atan2(BALL[0][1] - BALL[1][1], BALL[0][0] - BALL[1][0]), lines: [
      'Minnow throws like a gull. All over the place.',
      'When Kip comes back he will play too. He throws furthest.',
    ] },
    { id: 'winkle', look: 'reefchild3', name: 'Winkle', x: 26.2, z: 77, speed: 2.9, pose: 'play', lines: [
      'You are it! ...No, wait, I am it. Bother.',
      'We play tag in the shallows. If you fall over, you are out.',
    ] },
    { id: 'limpet', look: 'reeflass', name: 'Limpet', x: 29.5, z: 78.5, speed: 2.7, pose: 'play', lines: [
      'Cannot talk, being chased!',
      'Mum says not past the floats. The floats are where the deep starts.',
    ] },
    { id: 'nipper', look: 'reefchild4', name: 'Nipper', x: 25.2, z: 68.4, speed: 1.1, pause: 3.5, roam: [[25.2, 68.4], [19.6, 69.2], [16.8, 64.6], [17.6, 59.6], [22.2, 58.8], [28.2, 60.6], [28.6, 66.2]], lines: [
      'This is Pinch. He is my crab. He is on a string so he does not go home.',
      'Pinch does not like knights. He does not like anyone. That is why he is the best crab.',
    ] },
    // At their work: the cook at the market's fire, the boatwright, the net-mender, the coral-carver, Granny Whelk.
    { id: 'samphire', look: 'reefcook', name: 'Samphire the Cook', x: MARKET.x - 1.1, z: MARKET.z - 0.62, pose: 'work', heading: 0.5, lines: [
      'Chowder: mussels, kelp, and whatever Bass did not lose. Sit by the fire and have a bowl.',
      'There was a fish hall on the quay once. Now it is three stalls and my pot, and the pot is the best part.',
    ] },
    { id: 'caulk', look: 'reefwright', name: 'Caulk the Boatwright', x: 22.35, z: 73.95, pose: 'work', heading: Math.PI / 4, lines: [
      'Caulk and tar, plank by plank. Every boat on this shelf has sunk once and been raised again.',
      'The crew stove in half our boats to keep us off the wrecks. I mend them faster than they break them. Just.',
    ] },
    { id: 'pollock', look: 'reefold3', name: 'Old Pollock the Net-mender', x: 16.4, z: 71.1, pose: 'sit', heading: 0.9, lines: [
      'A net is mostly holes. Mending it is knowing which holes to keep.',
      'Ling does the village\'s nets and I do the boats\'. We do not speak of whose knots are better. Mine are.',
    ] },
    { id: 'cowrie', look: 'reefcarver', name: 'Cowrie the Coral-carver', x: CARVE.x - 0.62, z: CARVE.z - 0.5, pose: 'work', heading: 0.68, lines: [
      'Shale files coral into edges. I carve it: floats, combs, little fish for the shrine.',
      'Dead coral only. The living reef holds the village up; you do not cut what holds you.',
    ] },
    { id: 'whelk', look: 'reefgran', name: 'Granny Whelk', x: 27.6, z: 72.9, pose: 'sit', heading: 1.25, lines: [
      'Mussels for Samphire\'s pot. A hundred a night, these old hands. The sea gives, if you keep asking.',
      'I was born on the quay that is under the bay now. Forty years since the tide came, and I still dream of dry streets.',
    ] },
  ];
}

/** The village's night, built onto the realm: its props now, and its people, the inn and the regions it adds.
 *  `folk` are the reef's people already placed (src/world/reef.ts): Dulse moves behind her own counter. */
export function buildReefLife(b: Builder, grid: Grid, under: (x: number, z: number) => boolean, folk: NpcDef[]) {
  const keep = b.rng;
  b.rng = mulberry32(3535);

  harbourArms(b, grid);
  // The market on the beach below the inn: three stalls round the cook-fire, the smoking rack by the shelf.
  fishStall(b, 20.2, 61.0, 0.75, '#4a6a8a');
  fishStall(b, 26.6, 60.4, -0.55, '#8a4a3a');
  fishStall(b, 19.4, 66.4, Math.PI / 2 + 0.15, '#5a7a5a');
  cookFire(b, MARKET.x, MARKET.z);
  smokeRack(b, 27.4, 66.6, 1.45);
  for (const [x, z, what] of [[22.0, 59.4, 'fish'], [24.6, 59.2, 'crabs'], [17.9, 63.0, 'mussels']] as const) basket(b, x, z, what, 1.15);
  b.barrel(18.4, 59.8);
  floatLantern(b, 22.8, 60.2);
  floatLantern(b, 25.2, 67.3);
  // The boatyard on the shore: a boat keel-up on trestles, another on blocks, the tar pot, planks, a net to mend.
  boatOnTrestles(b, YARD.x - 1.6, YARD.z - 0.4, 0.35);
  boatOnBlocks(b, YARD.x + 2.9, YARD.z + 1.4, -0.5);
  tarPot(b, YARD.x + 0.4, YARD.z - 2.5);
  netRack(b, [14.2, 68.6], [17.0, 67.4]);
  for (let k = 0; k < 5; k++) b.g(YARD.x + 5.6, YARD.z - 1).box(YARD.x + 5.6 + k * 0.02, b.y(YARD.x + 5.6, YARD.z - 1) + k * 0.07, YARD.z - 1 + k * 0.03, 0.22, 0.07, 2.4, k % 2 ? '#a08060' : '#8a7050', WOOD);
  b.collide({ kind: 'b', x0: YARD.x + 5.4, z0: YARD.z - 2.2, x1: YARD.x + 5.9, z1: YARD.z + 0.2, y0: -1, y1: 0.6 });
  floatLantern(b, YARD.x + 1.6, YARD.z - 1.6);
  // Pollock's log by the net, Granny Whelk's crate and shells, the coral-carver's block, a sand castle.
  D.fallenLog(b, 16.4, 71.6, 1.3, 0.9);
  shellingSpot(b, 27.6, 73.15);
  carverBlock(b, CARVE.x, CARVE.z);
  sandCastle(b, 26.6, 75.6);
  // Washing on lines: west of the market, and between the market and the shore.
  washingLine(b, [15.6, 58.4], [16.2, 62.8]);
  washingLine(b, [22.6, 69.5], [26.6, 70.3]);
  // A trail of trodden sand: down from the inn's steps past the market's fire to the boatyard, and across from
  // the shelf to the fire.
  trail(grid, [[30, 54], [27.6, 58.2], [24.6, 61.6], [22.2, 65.8], [21.6, 69.4], [20.8, 71.2]], 1.3);
  trail(grid, [[29.4, 64.8], [25.4, 63.8]], 1.1);

  // The village itself: a stovepipe and smoke on every house, two fishing stages out between the houses, more
  // glass-float lamps along the jetty.
  HOUSES.forEach((deg, k) => stovepipe(b, deg, k));
  for (const deg of STAGES) {
    const a = at(deg, 8.3), c = at(deg, 12.1);
    boardwalk(b, a, c, 1.3, 0.7);
    const [lx, lz] = at(deg + 3.6, 12.0);
    floatLantern(b, lx, lz, 0.7);
    const [bx, bz] = at(deg - 3.2, 10.5);
    basket(b, bx, bz, 'fish', 0.9, 0.7);
  }
  for (const [x, z] of [[44.9, 65.35], [44.9, 67.45], [47.5, 65.35], [51.5, 67.45], [55.5, 65.35]] as Pt[]) floatLantern(b, x, z, 0.7);
  for (const [x, z] of [[47.6, 66.9], [52.8, 67.2]] as Pt[]) basket(b, x, z, 'fish', 0.8, 0.7);

  // Out in the north shallows: two boats at their moorings, and a fish weir, stakes driven in a V with a basket
  // trap at its point.
  for (const [x, z, rot, px, pz] of [[35.2, 50.6, 0.5, 33.6, 52.6], [40.6, 51.8, -0.3, 39.4, 54.2]]) {
    b.rowboat(x, -0.15, z, rot);
    const fl = b.y(px, pz), g = b.g(px, pz);
    g.cyl(px, fl - 0.1, pz, 0.08, 0.07, 0.75 - fl, 6, POST, WOOD);
    g.beam([px, 0.5, pz], [x - Math.cos(rot) * 1.1, 0.1, z + Math.sin(rot) * 1.1], 0.012, '#a08a5a');
  }
  {
    const tip: Pt = [44.6, 51.2], arms: Pt[] = [[41.6, 46.4], [48.4, 47.6]];
    for (const [ax, az] of arms)
      for (let t = 0; t <= 1.001; t += 0.09) {
        const x = tip[0] + (ax - tip[0]) * t + (b.rng() - 0.5) * 0.12, z = tip[1] + (az - tip[1]) * t, fl = b.y(x, z);
        b.g(x, z).sweep([[x, fl - 0.1, z], [x + (b.rng() - 0.5) * 0.08, 0.35 + b.rng() * 0.3, z]], [0.05, 0.035], SHORE.driftDark, { kind: K.Bark, seg: 4, lumpy: 0.15 });
      }
    const fl = b.y(tip[0], tip[1]);
    b.g(tip[0], tip[1]).cyl(tip[0], fl, tip[1] + 0.6, 0.45, 0.3, 0.55 - fl, 8, '#6a5a3a', { kind: K.Thatch });
    markerPost(b, tip[0] + 0.8, tip[1] + 0.9);
  }

  b.rng = keep;

  // Dulse keeps her own inn now: behind its counter, wiping it down.
  const dulse = folk.find((n) => n.id === 'dulse');
  if (dulse) Object.assign(dulse, { x: 21.8, z: 51.95, pose: 'work', heading: Math.PI / 2 });
  const regions: RegionDef[] = [
    { name: INN.name, music: 'tavern', amb: 'indoor', test: (x, z) => x > INN.x0 && x < INN.x1 && z > INN.z0 && z < INN.z1 },
    // The beach the village spills onto (the inn's porch, the market, the boatyard) is the village too.
    { name: 'The Coral Village', music: 'village', amb: 'harbour', test: (x, z) => x > 13 && x < 31 && z > 49.5 && z < 79 && !under(x, z) },
  ];
  return { npcs: people(), enemies: [], objects: [], regions, inn: { x: (INN.x0 + INN.x1) / 2, z: INN.door, region: INN.name, chatter: true } };
}
