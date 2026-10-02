import * as THREE from 'three';
import type { Geo } from '../engine/geo';
import { K } from '../engine/materials';
import { mulberry32 } from '../engine/util';
import type { Builder } from './builder';
import { T, type Grid } from './grid';
import { Painter, type Pt } from './paint';
import type { NpcDef } from './realm';
import { SEA } from './sea';

// ---------------------------------------------------------------------------
// The lighthouse on its rock, and its keeper's quest, "The Dark Lamp" (the story's side is
// src/game/story/lighthouse.ts). The crew put the lamp out so that the fishers' boats would break on the
// rocks for salvage; old Wick the keeper sits on the village shore staring at his dark tower. A stone stair
// winds round the outside of the tower, one turn and a half, from the rock up to the gallery and the lamp
// room; steps cut in the rock climb to it from the salvage yard. The keeper's store leans on the rock's
// beach side. What the lamp needs lies in the sea: its lens, thrown off the gallery east of the rock, and
// oil, in the sunken ship's hold.
//
// The stair and the gallery are drawn here; underfoot they are surfaces the story lays into the grid's
// decks round the knight as he climbs (lighthouseTops), since one height a cell can't hold a stair that
// passes over itself.
// ---------------------------------------------------------------------------

type V3 = [number, number, number];

/** The lighthouse rock's middle (as in realm3.ts), the height of its top, the gallery's floor. */
export const LIGHT = { x: 97, z: 29.5 };
export const ROCK_Y = 4;
export const GALLERY_Y = 12.2;
/** The stair: from the rock's top at phi0 (just west of where the steps from the yard come up) round
 *  the tower the way the angle grows, `turns` turns up to the gallery, `out` its outer edge. */
export const STAIR = { phi0: (95 * Math.PI) / 180, turns: 1.5, out: 2.6 };
const CLIMB = (GALLERY_Y - ROCK_Y) / STAIR.turns;
/** Where the stair comes out on the gallery, and the open well in the gallery's floor it climbs through
 *  (so that no one walks into the floor above him on the last steps). */
const PHI_END = STAIR.phi0 + STAIR.turns * Math.PI * 2;
const WELL = (130 * Math.PI) / 180;
export const GALLERY_R = 2.35;
/** The lantern on the gallery: the lamp in its glass, where the knight lights it. */
export const LAMP = { x: LIGHT.x, y: GALLERY_Y + 0.35, z: LIGHT.z, r: 0.66, h: 1.1 };
/** The keeper's door, facing the yard. */
const DOOR_PHI = (35 * Math.PI) / 180;
/** The lamp's lens, thrown off the gallery into the sea east of the rock; the last whole cask of lamp oil,
 *  spilled out of the sunken ship's hold through its breach onto the sand. */
export const LENS = { x: 102.2, z: 26.2 };
export const OIL = { x: 119.06, z: 52.21 };
/** The fishers' boats: waiting out past the reef for the light (east of the isle, off the strait), their way home
 *  round the isle's south and over the kelp, and their moorings by the end of the village's jetty. */
export const BOATS: { wait: Pt; moor: [number, number, number] }[] = [
  { wait: [129, 31.5], moor: [59.4, 68.6, -0.3] },
  { wait: [135.5, 31.5], moor: [60.8, 65.4, 0.25] },
  { wait: [133.5, 25.5], moor: [58.6, 63.4, 0.6] },
];
export const BOAT_WAY: Pt[] = [[112, 42], [95, 49], [76, 55], [64, 62]];

const TAU = Math.PI * 2;
const wrap = (a: number) => ((a % TAU) + TAU) % TAU;
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/** The tower's radius at height y: wider at its foot. */
export function towerR(y: number) {
  return 1.32 - 0.32 * clamp01((y - ROCK_Y) / (GALLERY_Y - ROCK_Y));
}

/** Is this angle in the gallery's open well (where the stair comes up)? */
function inWell(phi: number) {
  return wrap(PHI_END - phi) < WELL;
}

/** The walkable tops of the stair and the gallery over a point (none off them): every turn of the stair
 *  that passes over it, then the gallery's floor. `firm` is whether the stair is built solid down to the
 *  rock here (its lowest steps): then there's no walking under it. */
export function lighthouseTops(x: number, z: number, out: number[]) {
  out.length = 0;
  const dx = x - LIGHT.x, dz = z - LIGHT.z, r = Math.hypot(dx, dz);
  if (r > STAIR.out + 0.05) return false;
  const phi = Math.atan2(dz, dx), u0 = wrap(phi - STAIR.phi0) / TAU;
  let firm = false;
  for (let k = 0; k < 2; k++) {
    const u = u0 + k;
    if (u > STAIR.turns) break;
    const y = ROCK_Y + CLIMB * u;
    if (r < towerR(y) - 0.05) continue;
    out.push(y);
    if (y - ROCK_Y < 2.4) firm = true;
  }
  if (r < GALLERY_R && (r < 1.05 || !inWell(phi))) out.push(GALLERY_Y);
  return firm;
}

// ---------- drawing ----------

/** A quad facing `out` (whichever way its corners were given). */
function face(g: Geo, a: V3, b: V3, c: V3, d: V3, out: V3, col: string, o: Parameters<Geo['quad']>[5] = {}) {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) g.quad(d, c, b, a, col, o);
  else g.quad(a, b, c, d, col, o);
}

/** A wedge of stone round the tower: from radius r0 to r1, angle a0 to a1, its top at y1, its bottom at y0. */
function wedge(g: Geo, a0: number, a1: number, r0: number, r1: number, y0: number, y1: number, col: string, side: string, kind: number = K.Rock) {
  const { x, z } = LIGHT;
  const P = (a: number, r: number, y: number): V3 => [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
  const am = (a0 + a1) / 2;
  face(g, P(a0, r0, y1), P(a0, r1, y1), P(a1, r1, y1), P(a1, r0, y1), [0, 1, 0], col, { kind });
  face(g, P(a0, r1, y0), P(a1, r1, y0), P(a1, r1, y1), P(a0, r1, y1), [Math.cos(am), 0, Math.sin(am)], side, { kind });
  face(g, P(a0, r0, y0), P(a0, r1, y0), P(a0, r1, y1), P(a0, r0, y1), [Math.sin(a0), 0, -Math.cos(a0)], side, { kind });
  face(g, P(a1, r0, y0), P(a1, r1, y0), P(a1, r1, y1), P(a1, r0, y1), [-Math.sin(a1), 0, Math.cos(a1)], side, { kind });
  face(g, P(a0, r0, y0), P(a0, r1, y0), P(a1, r1, y0), P(a1, r0, y0), [0, -1, 0], side, { kind });
}

const WHITE = '#c8c2b2', RED = '#9a3a32', IRON = '#3a3a44', STEP = '#8a8a86', STEP_D = '#5e6466';

/** The tower, its stair and its door, in one structure (it fades when it stands between the camera and the
 *  knight, say on the stair's far side); the gallery and the lamp room in another above it. */
function drawLighthouse(b: Builder) {
  const { x, z } = LIGHT;
  const box = (r: number, y0: number, y1: number) => new THREE.Box3(new THREE.Vector3(x - r, y0, z - r), new THREE.Vector3(x + r, y1, z + r));
  const shaft = b.structure('lighthouse', box(1.12, ROCK_Y, GALLERY_Y - 0.4));
  const top = b.structure('lamp room', box(2.45, GALLERY_Y - 0.5, GALLERY_Y + 2.9));
  const g = shaft.core, gl = shaft.glow, P = (a: number, r: number, y: number): V3 => [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
  // A collar of stone round its foot, flush with the rock; the tower whitewashed, banded in red, tapering.
  g.cyl(x, ROCK_Y - 0.8, z, 1.66, 1.6, 0.85, 14, SEA.stoneDark, { kind: K.Rock });
  const y0 = ROCK_Y + 0.05, y1 = GALLERY_Y - 0.25;
  g.cyl(x, y0, z, towerR(y0), towerR(y1), y1 - y0, 14, WHITE, { kind: K.Brick });
  for (const t of [0.3, 0.63]) {
    const ya = y0 + (y1 - y0) * t, yb = ya + 0.7;
    g.cyl(x, ya, z, towerR(ya) + 0.03, towerR(yb) + 0.03, 0.7, 14, RED, { kind: K.Brick, cap: false });
  }
  // Small windows up the tower, over the stair (dark: no one has climbed it since the lamp went out).
  for (const [a, y] of [[2.6, 6.2], [4.6, 7.9], [0.6, 9.6], [2.3, 11]]) {
    const r = towerR(y) + 0.02;
    g.push().translate(x + Math.cos(a) * r, y, z + Math.sin(a) * r).rotateY(-a);
    g.box(0, -0.05, 0, 0.08, 0.6, 0.36, SEA.stoneDark, { kind: K.Rock });
    gl.box(0.03, 0, 0, 0.04, 0.5, 0.26, [0.05, 0.06, 0.09], { kind: 0 });
    g.pop();
  }
  // The keeper's door, facing the yard: planks, iron straps, a stone lintel; a brass bell on a bracket by it,
  // a lamp hook over it.
  {
    const r = towerR(y0);
    g.push().translate(x + Math.cos(DOOR_PHI) * r, y0, z + Math.sin(DOOR_PHI) * r).rotateY(-DOOR_PHI);
    g.box(0, 0, 0, 0.14, 1.55, 0.82, '#3a2a1e', { kind: K.Wood });
    for (const h of [0.35, 1.15]) g.box(0.05, h, 0, 0.06, 0.07, 0.86, IRON, { kind: K.Metal });
    g.box(0.02, 1.55, 0, 0.22, 0.2, 1.06, SEA.stone, { kind: K.Rock });
    g.box(0.06, 0.75, 0.3, 0.06, 0.08, 0.08, '#b8862e', { kind: K.Metal });
    g.beam([0, 1.9, -0.62], [0.42, 1.95, -0.62], 0.03, IRON, { kind: K.Metal });
    g.cyl(0.42, 1.58, -0.62, 0.13, 0.07, 0.3, 8, '#b8862e', { kind: K.Metal });
    g.beam([0.42, 1.95, -0.62], [0.42, 1.88, -0.62], 0.012, IRON);
    g.pop();
  }
  // The stair: stone steps out from the wall, one turn and a half; the lowest built solid down to the rock,
  // the rest on iron brackets; an iron rail along their outer edge, its posts on the steps.
  const N = 30, dA = (STAIR.turns * TAU) / N, rail: V3[] = [];
  for (let i = 0; i < N; i++) {
    const a0 = STAIR.phi0 + i * dA, a1 = a0 + dA, am = a0 + dA / 2;
    const yt = ROCK_Y + CLIMB * ((i + 0.5) / N) * STAIR.turns, ri = towerR(yt) - 0.08, ro = STAIR.out;
    const solid = yt - ROCK_Y < 2.4;
    wedge(g, a0, a1, ri, ro, solid ? ROCK_Y - 0.4 : yt - 0.24, yt, i % 2 ? STEP : '#949490', STEP_D);
    if (!solid) g.beam(P(am, ri, yt - 0.95), P(am, ro - 0.35, yt - 0.24), 0.06, IRON, { kind: K.Metal });
    if (i >= 3) {
      const [px, , pz] = P(am, ro - 0.08, 0);
      g.box(px, yt, pz, 0.06, 0.95, 0.06, IRON, { kind: K.Metal });
      rail.push([px, yt + 0.95, pz]);
      b.collide({ kind: 'c', x: px, z: pz, r: 0.18, y0: yt - 0.3, y1: yt + 1.05 });
    }
  }
  g.sweep(rail, rail.map(() => 0.03), IRON, { seg: 4, lumpy: 0, kind: K.Metal });
  // The tower stops whoever climbs beside it (its foot wider than its top).
  for (let k = 0; k < 4; k++) {
    const ya = ROCK_Y + (k * (GALLERY_Y - ROCK_Y)) / 4;
    b.collide({ kind: 'c', x, z, r: towerR(ya) + 0.02, y0: k ? ya : ROCK_Y - 3, y1: ya + (GALLERY_Y - ROCK_Y) / 4 + (k === 3 ? -0.3 : 0.02) });
  }

  // The gallery: a ring of stone slabs on brackets round the tower's top, open where the stair comes up
  // through it, an iron rail round its edge and along the well's far edge.
  const t = top.core, G = GALLERY_Y;
  t.cyl(x, G - 0.25, z, 1.08, 1.08, 0.25, 14, SEA.stone, { kind: K.Rock });
  const seg = 30, sA = TAU / seg, runs: V3[][] = [[]];
  for (let k = 0; k < seg; k++) {
    const a0 = PHI_END + k * sA, a1 = a0 + sA, am = (a0 + a1) / 2;
    if (inWell(am)) {
      if (runs[runs.length - 1].length) runs.push([]);
      continue;
    }
    wedge(t, a0, a1, 1.0, GALLERY_R, G - 0.25, G, k % 2 ? SEA.stone : '#88949a', SEA.stoneDark);
    if (k % 3 === 1) t.beam(P(am, towerR(G - 1.3), G - 1.3), P(am, GALLERY_R - 0.25, G - 0.25), 0.08, SEA.stoneDark, { kind: K.Rock });
    const [px, , pz] = P(a0 + (k ? 0 : sA * 0.15), GALLERY_R - 0.07, 0);
    t.box(px, G, pz, 0.06, 1.0, 0.06, IRON, { kind: K.Metal });
    runs[runs.length - 1].push([px, G + 1.0, pz]);
    b.collide({ kind: 'c', x: px, z: pz, r: 0.15, y0: G - 0.2, y1: G + 1.1 });
  }
  for (const run of runs) if (run.length > 1) t.sweep(run, run.map(() => 0.03), IRON, { seg: 4, lumpy: 0, kind: K.Metal });
  // (Along the well's far edge, where the gallery ends over the stair below.)
  const aw = PHI_END - WELL;
  t.box(...P(aw, 1.25, G), 0.06, 1.0, 0.06, IRON, { kind: K.Metal });
  t.beam(P(aw, 1.25, G + 1.0), P(aw, GALLERY_R - 0.07, G + 1.0), 0.03, IRON, { kind: K.Metal });
  t.beam(P(aw, 1.25, G + 0.5), P(aw, GALLERY_R - 0.07, G + 0.5), 0.025, IRON, { kind: K.Metal });
  for (const r of [1.3, 1.75, 2.2]) b.collide({ kind: 'c', x: x + Math.cos(aw) * r, z: z + Math.sin(aw) * r, r: 0.2, y0: G - 0.2, y1: G + 1.1 });
  // The lamp room: an iron-framed lantern on a low stone drum, a copper roof gone green, its vent ball and a
  // vane. (The glass and the lamp in it are the story's: dark until it's lit.)
  t.cyl(x, G, z, 0.95, 0.9, 0.35, 12, SEA.stoneDark, { kind: K.Rock });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    t.box(x + Math.cos(a) * 0.7, LAMP.y, z + Math.sin(a) * 0.7, 0.06, LAMP.h, 0.06, IRON, { kind: K.Metal });
  }
  for (const yy of [LAMP.y, LAMP.y + LAMP.h - 0.05]) t.cyl(x, yy, z, 0.74, 0.74, 0.06, 12, IRON, { kind: K.Metal, cap: false });
  t.cyl(x, LAMP.y + LAMP.h, z, 0.98, 0.02, 0.8, 12, '#4a7a6a', { kind: K.Metal });
  t.blob(x, LAMP.y + LAMP.h + 0.85, z, 0.16, 0.16, 0.16, '#4a7a6a', 7, { kind: K.Metal, detail: 1, jitter: 0 });
  t.beam([x, LAMP.y + LAMP.h + 0.9, z], [x, LAMP.y + LAMP.h + 1.6, z], 0.025, IRON);
  t.box(x + 0.18, LAMP.y + LAMP.h + 1.42, z, 0.36, 0.12, 0.02, IRON, { kind: K.Metal });
  b.collide({ kind: 'c', x, z, r: 0.98, y0: G - 0.3, y1: G + 2.6 });
}

/** The keeper's store, leaning on the rock's beach side (its back to the rock's west face, open to the
 *  water): a lean-to of tarred planks, empty oil drums knocked over (the crew's doing), a rain barrel, lobster
 *  pots, a coil of rope; his skiff upturned on the beach south of it, stove in. */
function keepersStore(b: Builder, x: number, z: number) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  // (Local x runs along the rock's face, north to south; local z out from it, west over the beach.)
  g.push().translate(x, y, z).rotateY(-Math.PI / 2);
  g.box(0, 0, -0.42, 1.9, 1.95, 0.12, '#4a3a2e', { kind: K.Wood });
  for (const s of [-1, 1]) {
    g.box(s * 0.92, 0, 0, 0.08, 1.6, 0.84, '#4a3a2e', { kind: K.Wood });
    g.box(s * 0.85, 0, 0.42, 0.1, 1.5, 0.1, '#3a2e24', { kind: K.Wood });
  }
  g.push().translate(0, 1.72, 0).rotateX(0.32);
  for (let k = 0; k < 6; k++) g.box(-0.85 + k * 0.34, 0, 0, 0.32, 0.05, 1.05, k % 2 ? '#3a3a40' : '#44444a', { kind: K.Wood });
  g.pop();
  // Inside: a shelf with a spare lamp chimney, a coil of wick on a peg.
  g.box(0.3, 0.95, -0.25, 1.1, 0.05, 0.28, '#5e4430', { kind: K.Wood });
  g.cyl(0.1, 1.0, -0.25, 0.08, 0.06, 0.26, 8, '#9ab0b0', { kind: K.Metal });
  g.cyl(-0.55, 1.2, -0.3, 0.12, 0.12, 0.08, 8, '#c8b890', { kind: K.Cloth });
  g.pop();
  b.collide({ kind: 'b', x0: x - 0.5, z0: z - 0.98, x1: x + 0.5, z1: z + 0.98, y0: y - 1, y1: y + 2 });
  // Oil drums out on the beach, empty and knocked about.
  g.push().translate(x - 1.2, y + 0.28, z + 0.25).rotateZ(Math.PI / 2).rotateY(0.4);
  g.cyl(0, -0.4, 0, 0.27, 0.27, 0.8, 10, '#5a4a2e', { kind: K.Metal });
  g.pop();
  g.cyl(x - 0.9, y, z + 1.05, 0.27, 0.27, 0.8, 10, '#6a5636', { kind: K.Metal });
  g.cyl(x - 0.9, y + 0.78, z + 1.05, 0.28, 0.28, 0.04, 10, IRON, { kind: K.Metal });
  b.collide({ kind: 'c', x: x - 0.9, z: z + 1.05, r: 0.3, y0: y - 1, y1: y + 0.8 });
  // The rain barrel at the corner, lobster pots stacked, a coil of rope.
  b.barrel(x - 0.35, z + 1.35);
  for (const [dx, dz, h] of [[-1.35, 1.9, 0], [-0.85, 2.15, 0], [-1.1, 2.0, 0.36]]) {
    g.cyl(x + dx, y + h, z + dz, 0.25, 0.22, 0.34, 8, '#7a6a4a', { kind: K.Wood, cap: false });
    g.cyl(x + dx, y + h + 0.32, z + dz, 0.22, 0.12, 0.06, 8, '#5a4a32', { kind: K.Wood });
  }
  g.cyl(x - 0.3, y, z + 2.0, 0.3, 0.3, 0.12, 10, '#8a7a5a', { kind: K.Cloth });
  g.cyl(x - 0.3, y + 0.1, z + 2.0, 0.2, 0.2, 0.06, 10, '#7a6a4a', { kind: K.Cloth });
  // The skiff, keel up, a hole stove in its planks.
  const sx = x - 1.35, sz = z + 4, sy = b.y(sx, sz);
  g.push().translate(sx, sy, sz).rotateY(-1.45);
  g.blob(0, 0.18, 0, 1.15, 0.36, 0.5, '#5a4632', 51, { kind: K.Wood, flatBottom: true, jitter: 0.05 });
  g.box(-0.1, 0.48, 0, 2.1, 0.06, 0.08, '#3e2c20', { kind: K.Wood });
  g.blob(0.2, 0.42, 0.25, 0.22, 0.08, 0.16, '#141210', 52, { jitter: 0.3 });
  g.pop();
  for (let k = 0; k < 3; k++) g.beam([sx + 0.4 + r() * 0.3, sy + 0.03, sz + 0.6 + r() * 0.3], [sx + 0.9 + r() * 0.3, sy + 0.05, sz + 0.9 + r() * 0.3], 0.04, '#5a4632', { kind: K.Wood });
  b.collide({ kind: 'c', x: sx, z: sz, r: 0.75, y0: sy - 1, y1: sy + 0.7 });
}

/** A flagstaff on the yard's edge by the steps, its pennant in tatters. */
function flagstaff(b: Builder, x: number, z: number) {
  const g = b.g(x, z), y = b.y(x, z);
  g.cyl(x, y, z, 0.28, 0.24, 0.3, 8, SEA.stoneDark, { kind: K.Rock });
  g.cyl(x, y + 0.3, z, 0.06, 0.04, 4.4, 6, '#6a5a48', { kind: K.Wood });
  g.box(x + 0.42, y + 4.15, z, 0.8, 0.22, 0.02, RED, { kind: K.Cloth, wind: 2 });
  g.box(x + 0.25, y + 3.95, z, 0.45, 0.16, 0.02, RED, { kind: K.Cloth, wind: 2.4 });
  b.collide({ kind: 'c', x, z, r: 0.3, y0: y - 1, y1: y + 4.6 });
}

/** Where the lens lies: bits of the lamp's iron cage the crew broke off with it, on the sand. */
function lensWreckage(b: Builder, x: number, z: number) {
  const g = b.g(x, z), y = b.y(x, z);
  g.beam([x - 0.9, y + 0.05, z + 0.4], [x - 0.2, y + 0.12, z + 0.9], 0.04, IRON, { kind: K.Metal });
  g.beam([x + 0.7, y + 0.04, z - 0.5], [x + 1.2, y + 0.3, z + 0.1], 0.04, IRON, { kind: K.Metal });
  g.cyl(x + 0.9, y, z + 0.8, 0.3, 0.3, 0.05, 10, IRON, { kind: K.Metal, cap: false });
  g.blob(x - 0.7, y + 0.1, z - 0.6, 0.35, 0.25, 0.3, SEA.stoneDark, 61, { kind: K.Rock, flatBottom: true });
}

/** Smashed casks round the last whole one, spilled out of the ship's hold: staves, a hoop, a lid. */
function brokenCasks(b: Builder, x: number, z: number) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  for (let k = 0; k < 7; k++) {
    const a = r() * TAU, d = 0.5 + r() * 0.8, sx = x + Math.cos(a) * d, sz = z + Math.sin(a) * d;
    g.beam([sx, y + 0.04, sz], [sx + Math.cos(a + 1.3) * 0.6, y + 0.06 + r() * 0.1, sz + Math.sin(a + 1.3) * 0.6], 0.045, '#4a3826', { kind: K.Wood });
  }
  g.cyl(x - 0.7, y, z + 0.5, 0.33, 0.33, 0.05, 10, IRON, { kind: K.Metal, cap: false });
  g.cyl(x + 0.6, y, z - 0.45, 0.3, 0.3, 0.05, 10, '#4a3826', { kind: K.Wood });
  g.push().translate(x + 0.75, y + 0.3, z + 0.5).rotateZ(Math.PI / 2).rotateY(1.1);
  g.cyl(0, -0.38, 0, 0.29, 0.29, 0.76, 10, '#4a3826', { kind: K.Wood, cap: false });
  g.pop();
}

/** A stool for the keeper on the shelf's north edge, where he sits and stares out at his dark tower. */
function stool(b: Builder, x: number, z: number) {
  const g = b.g(x, z), y = b.y(x, z);
  g.cyl(x, y, z, 0.24, 0.22, 0.34, 8, '#6a5a42', { kind: K.Wood, cap: false });
  g.cyl(x, y + 0.34, z, 0.26, 0.26, 0.05, 8, '#5e4430', { kind: K.Wood });
}

/** The keeper (on the village shelf's north edge at first, at his lighthouse once the crew's salvager is gone),
 *  and the fisher who comes home when the lamp burns (by the jetty's root). */
function people(): NpcDef[] {
  return [
    { id: 'wick', look: 'reefkeeper', name: 'Old Wick the Lighthouse-keeper', x: 36.2, z: 57.6, pose: 'sit', heading: -0.43, lines: [
      'See that tower out past the sandbar? Forty years I kept that lamp lit. Look at it now. Dark as a drowned man\'s pocket.',
      'The crew put it out. No light, and the boats come in blind and break on the rocks, and the crew dive for whatever sinks. That is salvage, to a goblin.',
      'Three of our boats are still out past the reef, waiting for the light. They will not risk the rocks in the dark, and I do not blame them.',
      'The lamp wants oil. The last casks went down in the hold of the ship the crew wrecked first, off the far rock. And they threw my lens off the gallery into the sea, east of the lighthouse rock. Bring me both.',
    ] },
    { id: 'wickhome', look: 'reefkeeper', name: 'Old Wick the Lighthouse-keeper', x: 99.9, z: 33.1, hidden: true, lines: [
      'Home again. The crew have left my store in a state, but the tower stands.',
    ] },
    { id: 'ness', look: 'reeffisher5', name: 'Ness the Fisher', x: 43.1, z: 67.5, hidden: true, lines: [
      'Three nights out past the reef with the lamp dark, and then she blazed, and we came home along her beam.',
      'Whoever lit her: there is fish for you at my door, any day you like.',
    ] },
  ];
}

/** Everything of the lighthouse's on the Sunken Reef: its rock reshaped for the steps, the tower and its
 *  stair, the keeper's things, the places the lens and the oil lie; the data the realm hands the game. */
export function buildLighthouse(b: Builder, grid: Grid, _under: (x: number, z: number) => boolean) {
  const keep = b.rng;
  b.rng = mulberry32(3535);
  // Steps cut up the rock from the yard (stepped ground the terrain draws), coming out on the rock's top
  // beside the stair's foot; the rock filled out a little where they come up.
  const p = new Painter(grid);
  const top = grid.i(97, 31);
  grid.h[grid.i(98, 31)] = ROCK_Y;
  grid.t[grid.i(98, 31)] = grid.t[top];
  p.ramp(97, 32, 99, 36, 3, 1, ROCK_Y, true, T.Flag);
  drawLighthouse(b);
  keepersStore(b, 94.45, 31);
  flagstaff(b, 99.6, 31.9);
  lensWreckage(b, LENS.x, LENS.z);
  brokenCasks(b, OIL.x, OIL.z);
  stool(b, 36.2, 57.6);
  b.rng = keep;
  return { npcs: people(), enemies: [], objects: [], regions: [] };
}
