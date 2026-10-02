import * as THREE from 'three';
import type { Geo } from '../engine/geo';
import { K } from '../engine/materials';
import { P } from '../engine/particles';
import { fbm, mulberry32, type Rng } from '../engine/util';
import type { Builder } from './builder';
import { T, type Grid } from './grid';
import { distLine, insidePoly, type Pt } from './paint';
import type { EnemySpawn, ObjDef, RegionDef } from './realm';
import { anemone, branchCoral, brainCoral, kelp, SEA, seaFan } from './sea';

// ---------------------------------------------------------------------------
// The drowned kingdom's set pieces: the harbour city the reef's folk lost ("a kingdom sleeps beneath these waves,
// and its lord never left"), on its terrace 4.5 m down round the plaza. The sunken temple on the square north-east
// of the plaza (in by its door, the roof fades; an altar under the Lady of the Tides, fallen pews, moonlight in
// through its broken windows and the hole in its roof, a chest before the altar); the market square in front of it
// round a dry fountain; the Kings' Way, the street from the plaza to the harbour (the way to the palace), lined
// with the old kings in stone, coral-grown; the royal library's ruins in the west (fallen shelves, the chronicle's
// lore stones); the royal treasury beside the plaza, shut, its south wall cracked (a heavy blow breaks it: two
// chests inside); the queen's drowned gardens south of it (stone planters overgrown with anemones); the harbour
// wall along the kingdom's edge over the trench (bollards, mooring rings, boats sunk at its foot); and houses in
// the north-west with their doorways and stairs. Chests paid by how hidden.
// ---------------------------------------------------------------------------

/** The sunken temple: its door in the south wall toward the Kings' Way, the altar against the north wall. */
const TEMPLE = { x0: 100.7, z0: 77.6, x1: 107.2, z1: 84, door: 104 };
/** The Kings' Way: the street from the plaza east to the harbour wall, where the current sets out for the palace. */
const WAY: [Pt, Pt] = [[96, 88.5], [106, 91]];
/** The royal library (roofless now), in the west of the kingdom. */
const LIBRARY = { x0: 72.3, z0: 86, x1: 76.8, z1: 92.4 };
/** The royal treasury, a strongroom of great blocks beside the plaza: its south wall cracked. */
const VAULT = { x0: 79.3, z0: 88.3, x1: 83.3, z1: 91.3 };
/** The queen's gardens, between the treasury and the kingdom's south edge. */
const GARDENS: Pt[] = [[77.4, 92], [86, 92], [86.4, 97.6], [81, 96.6], [77.4, 95.2]];
/** The harbour wall, along the kingdom's edge over the trench (the old harbour). */
const QUAY: Pt[] = [[90.4, 97.6], [105.2, 92.6], [110.9, 85]];
/** The market square in front of the temple, its fountain in the middle. */
const SQUARE = { x: 98, z: 81.7 };

const STONE = '#8a9492', STONE_D = '#66716f', MARBLE = '#a8aea6', GOLD = '#c8a040', TIMBER = '#3e3428', IRON = '#3a3e42';
const MOON: [number, number, number] = [0.45, 0.85, 1.05];
const MOON_DIM: [number, number, number] = [0.12, 0.26, 0.32];

type Hole = { at: number; w: number; lo: number; hi: number };

/** Draw a sea prop standing on something at height y (a planter's soil, a statue's shoulder) rather than on the floor. */
function on(b: Builder, y: number, draw: () => void) {
  const keep = b.heightFn;
  b.heightFn = () => y;
  draw();
  b.heightFn = keep;
}

/** A straight wall of dressed stone from a to c (along x or along z, a before c), t thick and H tall, with openings
 *  (`at` along it, w wide, lo to hi above its foot: a door from 0, a breach up to the sky). Its pieces block the way
 *  up to their tops. */
function stoneWall(b: Builder, g: Geo, a: Pt, c: Pt, y: number, H: number, t: number, holes: Hole[], col = STONE) {
  const alongX = Math.abs(c[0] - a[0]) >= Math.abs(c[1] - a[1]), len = alongX ? c[0] - a[0] : c[1] - a[1];
  const piece = (u0: number, u1: number, h0: number, h1: number) => {
    if (u1 - u0 < 0.03 || h1 - h0 < 0.03) return;
    const u = (u0 + u1) / 2, px = alongX ? a[0] + u : a[0], pz = alongX ? a[1] : a[1] + u, sx = alongX ? u1 - u0 : t, sz = alongX ? t : u1 - u0;
    g.box(px, y + h0, pz, sx, h1 - h0, sz, col, { kind: K.Brick });
    if (h0 < 0.5) b.collide({ kind: 'b', x0: px - sx / 2, z0: pz - sz / 2, x1: px + sx / 2, z1: pz + sz / 2, y0: y - 1, y1: y + h1 });
  };
  const cuts = [...new Set([0, len, ...holes.flatMap((h) => [h.at - h.w / 2, h.at + h.w / 2])])].filter((u) => u >= 0 && u <= len).sort((p, q) => p - q);
  for (let k = 0; k + 1 < cuts.length; k++) {
    const u0 = cuts[k], u1 = cuts[k + 1], h = holes.find((o) => Math.abs((u0 + u1) / 2 - o.at) < o.w / 2);
    if (!h) piece(u0, u1, 0, H);
    else {
      piece(u0, u1, 0, h.lo);
      piece(u0, u1, h.hi, H);
    }
  }
}

/** A ruined run of wall (along x or along z, a before c): blocks in courses, its top broken off between lo and hi
 *  metres (rising and falling along it), gaps where `gaps` say ([from, to] along it). */
function ruinRun(b: Builder, g: Geo, a: Pt, c: Pt, y: number, lo: number, hi: number, t: number, gaps: [number, number][], r: Rng) {
  const alongX = Math.abs(c[0] - a[0]) >= Math.abs(c[1] - a[1]), len = alongX ? c[0] - a[0] : c[1] - a[1], ph = r() * 6;
  for (let u = 0, k = 0; u < len - 0.05; u += 0.6, k++) {
    const w = Math.min(0.6, len - u), um = u + w / 2;
    if (gaps.some(([p, q]) => um > p && um < q)) continue;
    const h = lo + (hi - lo) * (0.5 + 0.5 * Math.sin(um * 0.9 + ph)) * (0.75 + r() * 0.25);
    const px = alongX ? a[0] + um : a[0], pz = alongX ? a[1] : a[1] + um, sx = alongX ? w - 0.03 : t, sz = alongX ? t : w - 0.03;
    for (let yy = 0, n = 0; yy < h - 0.05; yy += 0.5, n++) g.box(px, y + yy, pz, sx, Math.min(0.5, h - yy) - 0.02, sz, (k + n) % 3 ? STONE : STONE_D, { kind: K.Brick });
    if (r() < 0.25) g.cyl(px + (alongX ? 0 : t / 2), y + h * (0.3 + r() * 0.5), pz + (alongX ? t / 2 : 0), 0.05, 0.03, 0.05, 6, SEA.barnacle, { kind: K.Rock });
    if (h > 0.3) b.collide({ kind: 'c', x: px, z: pz, r: Math.max(t, 0.36) * 0.6, y0: y - 1, y1: y + h });
  }
}

// ---------- the sunken temple ----------

/** A pew of stone: a seat on two end blocks, a back; standing, tipped over on its back, or broken in two. */
function pew(g: Geo, x: number, y: number, z: number, len: number, state: number, r: Rng) {
  const draw = (l: number) => {
    g.box(0, 0.38, 0, l, 0.09, 0.42, MARBLE, { kind: K.Rock });
    g.box(0, 0.47, -0.19, l, 0.5, 0.07, STONE, { kind: K.Rock });
    for (const s of [-1, 1]) g.box((s * (l - 0.12)) / 2, 0, 0, 0.12, 0.42, 0.4, STONE_D, { kind: K.Rock });
  };
  g.push().translate(x, y, z);
  if (state === 0) draw(len);
  else if (state === 1) {
    // Tipped over backward: lying on its back, its seat standing up.
    g.translate(0, 0.05, -0.25).rotateY((r() - 0.5) * 0.3).rotateX(-1.35);
    draw(len);
  } else {
    // Broken in two, the halves fallen apart.
    for (const s of [-1, 1]) {
      g.push().translate((s * len) / 4, 0, s * 0.12).rotateY(s * (0.2 + r() * 0.2)).rotateZ(s * 0.12);
      draw(len / 2 - 0.08);
      g.pop();
    }
  }
  g.pop();
}

/** The Lady of the Tides behind the altar: a robed woman of stone, veiled, a great shell held to her breast with a
 *  pearl in it still glowing; coral grown over her shoulder. Faces +z. */
function tideLady(b: Builder, x: number, y: number, z: number) {
  const g = b.g(x, z), gl = b.gl(x, z);
  g.box(x, y, z, 0.9, 0.55, 0.7, STONE_D, { kind: K.Brick });
  g.cyl(x, y + 0.55, z, 0.42, 0.24, 1.5, 9, MARBLE, { kind: K.Rock });
  g.box(x, y + 1.9, z, 0.62, 0.2, 0.34, MARBLE, { kind: K.Rock });
  g.blob(x, y + 2.25, z + 0.02, 0.17, 0.21, 0.17, MARBLE, 41, { kind: K.Rock });
  // The veil, falling to her shoulders.
  g.cyl(x, y + 1.95, z - 0.03, 0.27, 0.15, 0.48, 8, STONE, { kind: K.Rock });
  // Her arms round the shell; the shell, ribbed, open toward the nave; the pearl.
  for (const s of [-1, 1]) g.beam([x + s * 0.3, y + 1.95, z], [x + s * 0.18, y + 1.45, z + 0.32], 0.07, MARBLE, { kind: K.Rock });
  g.blob(x, y + 1.42, z + 0.36, 0.34, 0.22, 0.14, '#c8bca8', 43, { kind: K.Rock });
  for (let k = -2; k <= 2; k++) g.beam([x, y + 1.3, z + 0.48], [x + k * 0.13, y + 1.62, z + 0.44], 0.02, '#a89c88', { kind: K.Rock });
  gl.blob(x, y + 1.46, z + 0.47, 0.1, 0.1, 0.1, [2.2, 2.6, 3], 44, { detail: 1, jitter: 0 });
  b.lights.add(x, y + 1.6, z + 0.9, 0xbfefff, 2.2, 3.5, 0.15);
  on(b, y + 2.0, () => branchCoral(b, x - 0.28, z + 0.05, 0.42, SEA.coralOrange));
  for (let k = 0; k < 8; k++) g.cyl(x + (k % 2 ? 0.3 : -0.32), y + 0.7 + k * 0.12, z + 0.1 + (k % 3) * 0.05, 0.04, 0.025, 0.04, 6, SEA.barnacle, { kind: K.Rock });
  b.collide({ kind: 'c', x, z, r: 0.5, y0: y - 1, y1: y + 2.5 });
}

/** The temple: a nave of pale stone, its roof of slates on rafters (a hole torn in it), lancet windows broken; in
 *  by its door in the south wall. The south and east walls and the roof fade when the knight is inside. */
function temple(b: Builder, r: Rng) {
  const { x0, z0, x1, z1, door } = TEMPLE, xc = (x0 + x1) / 2, zc = (z0 + z1) / 2;
  const y = b.y(xc, zc), H = 3, t = 0.45, rh = 1.8;
  const s = b.structure('temple', new THREE.Box3(new THREE.Vector3(x0 - 0.5, y, z0 - 0.5), new THREE.Vector3(x1 + 0.5, y + H + rh + 0.4, z1 + 0.5)), [x0, z0, x1, z1], y);
  const core = s.core, shell = s.shell;
  // The walls. North: three lancets, the middle one behind the Lady blind. West: one. South: the door between
  // two windows, one of them smashed down to the floor. East: its upper half fallen in.
  stoneWall(b, core, [x0, z0 + t / 2], [x1, z0 + t / 2], y, H, t, [{ at: 1.5, w: 0.7, lo: 1, hi: 2.5 }, { at: x1 - x0 - 1.5, w: 0.7, lo: 1, hi: 2.5 }], MARBLE);
  stoneWall(b, core, [x0 + t / 2, z0 + t], [x0 + t / 2, z1 - t], y, H, t, [{ at: 2.6, w: 0.7, lo: 1, hi: 2.5 }], MARBLE);
  stoneWall(b, shell, [x0, z1 - t / 2], [x1, z1 - t / 2], y, H, t, [{ at: 1.3, w: 0.8, lo: 0.6, hi: 2.4 }, { at: door - x0, w: 1.3, lo: 0, hi: 2.3 }, { at: x1 - x0 - 1.3, w: 0.7, lo: 1, hi: 2.5 }], MARBLE);
  stoneWall(b, shell, [x1 - t / 2, z0 + t], [x1 - t / 2, z1 - t], y, H, t, [{ at: 1.6, w: 0.7, lo: 1, hi: 2.5 }, { at: 3.6, w: 1.8, lo: 1.4, hi: 9 }], MARBLE);
  // Buttresses on the walls the camera sees, a plinth course round the foot, the door's frame and a step.
  for (const bx of [x0 + 0.05, x0 + 1.95, x1 - 2.05, x1 - 0.05]) shell.box(bx, y, z1 + 0.15, 0.4, H - 0.5, 0.35, STONE, { kind: K.Brick });
  for (const bz of [z0 + 2.2, z1 - 0.05]) shell.box(x1 + 0.15, y, bz, 0.35, H - 0.5, 0.4, STONE, { kind: K.Brick });
  for (const [u0, u1] of [[x0 - 0.05, door - 0.65], [door + 0.65, x1 + 0.05]]) shell.box((u0 + u1) / 2, y, z1 + 0.04, u1 - u0, 0.3, 0.1, STONE_D, { kind: K.Brick });
  core.box(xc, y, z0 - 0.04, x1 - x0 + 0.1, 0.3, 0.1, STONE_D, { kind: K.Brick });
  for (const sx of [-1, 1]) shell.box(door + sx * 0.72, y, z1 + 0.06, 0.18, 2.45, 0.22, STONE, { kind: K.Brick });
  shell.pyramid(door, y + 2.3, z1 + 0.06, 1.62, 0.24, 0.55, STONE, { kind: K.Brick });
  b.g(door, z1 + 0.6).box(door, y - 0.05, z1 + 0.55, 1.8, 0.12, 0.7, STONE_D, { kind: K.Flag });
  // Moonlight in the windows: the panes broken out, what's left of the tracery dark against the light.
  const pane = (geo: Geo, px: number, pz: number, alongX: boolean, lo: number, hi: number) => {
    geo.box(px, y + lo, pz, alongX ? 0.62 : 0.05, hi - lo, alongX ? 0.05 : 0.62, MOON, { kind: 0 });
  };
  pane(s.glow, x0 + 1.5, z0 + 0.05, true, 1, 2.5);
  pane(s.glow, x1 - 1.5, z0 + 0.05, true, 1, 2.5);
  pane(s.glow, x0 + 0.05, z0 + t + 2.6, false, 1, 2.5);
  for (const mx of [x0 + 1.5, x1 - 1.5]) core.box(mx, y + 1, z0 + 0.1, 0.06, 1.5, 0.08, STONE_D, { kind: K.Rock });
  pane(s.shellGlow, x1 - 1.3, z1 - 0.05, true, 1, 1.6);
  pane(s.shellGlow, x1 - 0.05, z0 + t + 1.6, false, 1.7, 2.5);
  // The roof: slates on rafters, the ridge along the nave; over the nave's middle a hole torn in the south slope,
  // its slates fallen to the floor below.
  const hd = (z1 - z0) / 2 + 0.35, L = Math.hypot(hd, rh), ang = Math.atan2(rh, hd), rw = x1 - x0 + 0.6;
  for (const side of [-1, 1]) {
    shell.push().translate(xc, y + H, side > 0 ? z1 + 0.35 : z0 - 0.35).rotateX(side > 0 ? ang : -ang);
    for (let u = -rw / 2 + 0.25; u < rw / 2; u += 0.85) shell.box(u, -0.16, (-side * L) / 2, 0.1, 0.14, L, TIMBER, { kind: K.Wood });
    for (let k = 0, d = 0; d < L - 0.05; k++, d += 0.42) {
      const zz = -side * (d + 0.21);
      // The hole: courses 2 to 6 on the south slope, ragged.
      const h0 = -0.4 - r() * 0.5, h1 = 1.6 + r() * 0.5;
      const torn = side > 0 && k >= 2 && k <= 6;
      for (const [u0, u1] of torn ? [[-rw / 2, h0], [h1, rw / 2]] : [[-rw / 2, rw / 2]]) {
        // Here and there a slate missing at the edges too.
        if (u1 - u0 < 0.1) continue;
        shell.box((u0 + u1) / 2, 0, zz, u1 - u0, 0.07, 0.44, k % 2 ? '#3e4a52' : '#46525a', { kind: K.Slate });
      }
    }
    shell.pop();
  }
  shell.box(xc, y + H + rh - 0.04, zc, rw + 0.1, 0.16, 0.2, STONE_D, { kind: K.Brick });
  // The gable ends: the west one whole, the east one with a round window, its glass gone.
  for (const [gx, geo] of [[x0, core], [x1, shell]] as const)
    for (const k of [-0.02, 0.02]) {
      const a: [number, number, number] = [gx + k, y + H, z0 - 0.1], c: [number, number, number] = [gx + k, y + H, z1 + 0.1], top: [number, number, number] = [gx + k, y + H + rh - 0.05, zc];
      if (gx + k > gx) geo.tri(a, top, c, MARBLE, { kind: K.Brick });
      else geo.tri(c, top, a, MARBLE, { kind: K.Brick });
    }
  s.shellGlow.push().translate(x1 + 0.08, y + H + 0.7, zc).rotateZ(Math.PI / 2);
  s.shellGlow.cyl(0, 0, 0, 0.42, 0.42, 0.03, 10, MOON_DIM, { kind: 0 });
  s.shellGlow.pop();
  b.collide({ kind: 'b', x0: x0 - 0.1, z0: z0 - 0.1, x1: x1 + 0.1, z1: z0 + 0.05, y0: y - 1, y1: y + 9 });

  // Inside: the dais and the altar, the Lady behind it, the pews in two blocks either side of the aisle.
  const g = b.g(xc, zc), gl = b.gl(xc, zc);
  g.box(door, y, z0 + t + 0.9, 3.6, 0.14, 1.8, STONE_D, { kind: K.Flag });
  g.box(door, y + 0.14, z0 + t + 1.55, 1.9, 0.8, 0.85, MARBLE, { kind: K.Brick });
  g.box(door, y + 0.94, z0 + t + 1.55, 2.1, 0.12, 1.0, STONE, { kind: K.Brick });
  // On the altar: a candlestick standing, one fallen, a silver bowl, a cloth gone green.
  g.cyl(door - 0.7, y + 1.06, z0 + t + 1.5, 0.08, 0.04, 0.5, 6, GOLD, { kind: K.Metal });
  g.push().translate(door + 0.6, y + 1.1, z0 + t + 1.6).rotateZ(1.45);
  g.cyl(0, 0, 0, 0.08, 0.04, 0.5, 6, GOLD, { kind: K.Metal });
  g.pop();
  g.cyl(door + 0.1, y + 1.06, z0 + t + 1.5, 0.2, 0.26, 0.1, 8, '#9aa0a4', { kind: K.Metal });
  g.box(door, y + 0.62, z0 + t + 2.0, 1.4, 0.46, 0.03, '#3e5a4a', { kind: K.Cloth, wind: 0.6 });
  b.collide({ kind: 'b', x0: door - 1.05, z0: z0 + t + 1.05, x1: door + 1.05, z1: z0 + t + 2.05, y0: y - 1, y1: y + 1.1 });
  tideLady(b, door, y + 0.14, z0 + t + 0.42);
  for (const [bz, rows] of [[z0 + 3.9, [0, 2]], [z0 + 5.05, [1, 0]]] as const)
    rows.forEach((state, k) => {
      const bx = k ? door + 1.55 : door - 1.6;
      pew(g, bx, y, bz, 1.7, state, r);
      b.collide({ kind: 'c', x: bx - 0.45, z: bz, r: 0.3, y0: y - 1, y1: y + 0.9 });
      b.collide({ kind: 'c', x: bx + 0.45, z: bz, r: 0.3, y0: y - 1, y1: y + 0.9 });
    });
  // A pew thrown against the west wall, slates from the hole in a heap, silt drifted into the corners, kelp and
  // anemones taking the floor; outside, a column fallen along the east wall.
  g.push().translate(x0 + t + 0.35, y, z0 + 4.2).rotateY(Math.PI / 2 + 0.2).rotateZ(0.5);
  g.box(0, 0, 0, 1.5, 0.1, 0.42, MARBLE, { kind: K.Rock });
  g.pop();
  g.push().translate(x1 + 1.3, y + 0.3, z0 + 4.4).rotateY(Math.PI / 2 + 0.2).rotateZ(Math.PI / 2);
  g.cyl(0, -1.2, 0, 0.3, 0.28, 2.4, 8, MARBLE, { kind: K.Rock });
  g.pop();
  for (const d of [-0.7, 0.7]) b.collide({ kind: 'c', x: x1 + 1.3 + d * 0.2, z: z0 + 4.4 + d, r: 0.35, y0: y - 1, y1: y + 0.6 });
  for (let k = 0; k < 9; k++) {
    const sx = door - 0.5 + r() * 2.1, sz = z0 + 4.4 + r() * 1.2;
    g.push().translate(sx, y + 0.03 + r() * 0.08, sz).rotateY(r() * 3).rotateZ((r() - 0.5) * 0.4);
    g.box(0, 0, 0, 0.42, 0.05, 0.3, k % 2 ? '#3e4a52' : '#46525a', { kind: K.Slate });
    g.pop();
  }
  for (const [dx, dz, sx, sz] of [[x0 + 0.8, z0 + 0.9, 0.9, 0.6], [x1 - 0.8, z1 - 0.9, 0.8, 0.7], [x0 + 0.9, z1 - 0.8, 1, 0.6]])
    g.blob(dx, y, dz, sx, 0.18, sz, '#8a8068', Math.floor(r() * 999), { kind: K.Sand, flatBottom: true });
  kelp(b, x0 + 0.85, z1 - 0.9, 2.6, 2);
  kelp(b, x1 - 0.8, z0 + 0.9, 2.2, 1);
  for (const [ax, az] of [[x0 + 1.1, z0 + 3.2], [x1 - 0.7, z1 - 0.75], [door + 2.1, z0 + 2.6]]) anemone(b, ax, az, 0.7, r() < 0.5 ? SEA.coralTeal : SEA.coralPink, SEA.glowCyan);
  // The moonlight: pools of it on the floor under the windows and the hole in the roof, motes drifting in it.
  for (const [px, pz, w, d] of [[x0 + 1.6, z0 + 1.3, 0.7, 1.4], [x1 - 1.4, z0 + 1.3, 0.7, 1.4], [door + 0.6, z0 + 5, 2.2, 1.8], [x1 - 1.3, z1 - 1.0, 0.7, 0.9]]) {
    gl.box(px, y + 0.02, pz, w, 0.01, d, MOON_DIM, { kind: 0 });
    b.lights.add(px, y + 0.9, pz, 0x9fd8ff, 1.6, 3, 0.12);
  }
  b.fx.addEmitter({ x: door + 0.6, y: y + 1.6, z: z0 + 5, rate: 2.5, spec: P.mote, spread: 0.9, vy: 0.05 });
  b.fx.addEmitter({ x: x0 + 1.6, y: y + 1.4, z: z0 + 1.2, rate: 1, spec: P.mote, spread: 0.4, vy: 0.05 });
  // Outside: the porch's columns broken off either side of the door, coral on the walls, anemones at their foot.
  for (const sx of [-1, 1]) {
    const cx = door + sx * 1.35, cz = z1 + 0.95;
    b.g(cx, cz).box(cx, y - 0.1, cz, 0.75, 0.3, 0.75, STONE_D, { kind: K.Rock });
    b.g(cx, cz).cyl(cx, y + 0.2, cz, 0.28, 0.26, sx > 0 ? 0.9 : 1.6, 8, MARBLE, { kind: K.Rock });
    b.collide({ kind: 'c', x: cx, z: cz, r: 0.38, y0: y - 1, y1: y + 1.8 });
  }
  on(b, y + 1.8, () => branchCoral(b, door - 1.35, z1 + 0.95, 0.5, SEA.coralPink));
  for (const [cx, cz, k] of [[x1 + 0.45, z0 + 1.1, 0], [x0 + 1.2, z1 + 0.55, 1], [x1 + 0.5, z1 - 1.2, 2], [x1 - 0.6, z1 + 0.6, 3]] as const) {
    if (k === 0) seaFan(b, cx, cz, 0.8, 0.3, SEA.coralPurple);
    else if (k === 1) brainCoral(b, cx, cz, 0.5, SEA.coralYellow);
    else anemone(b, cx, cz, 0.8, SEA.coralPink, SEA.glowPink);
  }
}

// ---------- the market square ----------

/** The market square's fountain, dry of all but the sea: a round basin, a column in it carrying a bowl, three stone
 *  fish leaping round the column. Bubbles still rise from its spout (a seep from below). */
function fountain(b: Builder, x: number, z: number) {
  const g = b.g(x, z), gl = b.gl(x, z), y = b.y(x, z);
  // The basin: a low round wall, a step round it, sand in it.
  g.cyl(x, y - 0.1, z, 1.75, 1.75, 0.22, 16, STONE_D, { kind: K.Brick });
  g.cyl(x, y + 0.1, z, 1.5, 1.5, 0.5, 16, MARBLE, { kind: K.Brick });
  g.cyl(x, y + 0.6, z, 1.58, 1.58, 0.1, 16, STONE, { kind: K.Rock });
  g.cyl(x, y + 0.55, z, 1.3, 1.3, 0.04, 16, '#6a6656', { kind: K.Sand });
  // The column, the great bowl on it, the lesser bowl over it, and on top a fish leaping, its mouth to the sky.
  g.cyl(x, y + 0.5, z, 0.3, 0.24, 1.3, 8, MARBLE, { kind: K.Rock });
  g.cyl(x, y + 1.75, z, 0.22, 0.95, 0.35, 12, MARBLE, { kind: K.Rock });
  g.cyl(x, y + 2.1, z, 0.95, 0.95, 0.06, 12, STONE, { kind: K.Rock });
  g.cyl(x, y + 2.1, z, 0.16, 0.14, 0.55, 8, MARBLE, { kind: K.Rock });
  g.cyl(x, y + 2.6, z, 0.12, 0.5, 0.22, 10, MARBLE, { kind: K.Rock });
  g.sweep([[x + 0.3, y + 2.75, z + 0.1], [x + 0.05, y + 3.05, z], [x - 0.05, y + 3.45, z - 0.05], [x + 0.08, y + 3.75, z]], [0.16, 0.24, 0.2, 0.1], MARBLE, { seg: 7, lumpy: 0.05, seed: 5, kind: K.Rock });
  for (const sd of [-1, 1]) g.beam([x + 0.32, y + 2.78, z + 0.1], [x + 0.5, y + 2.85, z + sd * 0.25], 0.04, MARBLE, { kind: K.Rock });
  // Three lesser fish round the column below, that spouted into the basin once.
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.4, fx = x + Math.cos(a) * 0.6, fz = z + Math.sin(a) * 0.6;
    g.sweep([[fx, y + 0.6, fz], [fx + Math.cos(a) * 0.18, y + 0.95, fz + Math.sin(a) * 0.18], [x + Math.cos(a) * 0.38, y + 1.4, z + Math.sin(a) * 0.38]], [0.12, 0.15, 0.07], MARBLE, { seg: 6, lumpy: 0.05, seed: k, kind: K.Rock });
  }
  // The sea still breathes up through it: bubbles from the fish's mouth, a glow in the upper bowl.
  b.fx.addEmitter({ x: x + 0.08, y: y + 3.8, z, rate: 9, spec: P.seaBubble, spread: 0.12, vy: 1.2 });
  gl.cyl(x, y + 2.16, z, 0.85, 0.85, 0.02, 12, [0.2, 0.55, 0.65], { kind: 0 });
  b.lights.add(x, y + 2.6, z, 0x7fe0e8, 2.4, 5, 0.15);
  on(b, y + 0.57, () => {
    anemone(b, x + 0.9, z - 0.6, 0.65, SEA.coralTeal, SEA.glowCyan);
    anemone(b, x - 0.9, z + 0.4, 0.55, SEA.coralPink, SEA.glowPink);
    anemone(b, x + 0.2, z + 1.0, 0.5, SEA.coralTeal, SEA.glowCyan);
  });
  on(b, y + 2.16, () => branchCoral(b, x - 0.55, z - 0.3, 0.45, SEA.coralOrange));
  b.collide({ kind: 'c', x, z, r: 1.6, y0: y - 1, y1: y + 0.7 });
  b.collide({ kind: 'c', x, z, r: 0.4, y0: y - 1, y1: y + 3.8 });
}

/** A market stall of stone: a counter, posts for an awning (its cloth long rotted to a rag), jars and baskets on it.
 *  Its counter's front to +z, turned by rot (radians). */
function stall(b: Builder, x: number, z: number, rot: number, r: Rng) {
  const g = b.g(x, z), y = b.y(x, z), c = Math.cos(rot), s = Math.sin(rot);
  g.push().translate(x, y, z).rotateY(-rot);
  g.box(0, 0, 0, 1.9, 0.8, 0.6, STONE, { kind: K.Brick });
  g.box(0, 0.8, 0, 2.0, 0.08, 0.7, MARBLE, { kind: K.Rock });
  for (const sx of [-0.9, 0.9]) g.box(sx, 0, -0.55, 0.12, 2.1, 0.12, TIMBER, { kind: K.Wood });
  g.box(0, 2.05, -0.3, 2.0, 0.08, 0.08, TIMBER, { kind: K.Wood });
  // What's left of the awning: a rag of faded red on the cross-bar, streaming in the swell.
  g.push().translate(-0.1, 2.05, -0.3).rotateX(0.5);
  g.quad([-0.9, 0, 0], [0.4, 0, 0], [0.25, -0.05, 0.9], [-0.7, -0.1, 0.75], '#8a4a3a', { kind: K.Cloth, wind: 1.8 });
  g.quad([0.4, 0, 0], [-0.9, 0, 0], [-0.7, -0.1, 0.75], [0.25, -0.05, 0.9], '#7a4234', { kind: K.Cloth, wind: 1.8 });
  g.pop();
  for (let k = 0; k < 3; k++) {
    const jx = -0.6 + k * 0.55 + (r() - 0.5) * 0.1;
    if (r() < 0.7) g.cyl(jx, 0.88, 0, 0.12, 0.08, 0.3, 7, k % 2 ? '#8a5a3a' : '#7a6a52', { kind: K.Rock });
    else g.cyl(jx, 0.88, 0, 0.2, 0.22, 0.12, 8, '#6a5a3a', { kind: K.Thatch });
  }
  g.pop();
  for (const a of [-0.55, 0.55]) b.collide({ kind: 'c', x: x + c * a, z: z + s * a, r: 0.42, y0: y - 1, y1: y + 0.9 });
}

/** Amphorae: tall jars of the kingdom's trade, some standing in a huddle, one lying on its side. */
function jars(b: Builder, x: number, z: number, n: number, r: Rng) {
  const g = b.g(x, z), y = b.y(x, z);
  for (let k = 0; k < n; k++) {
    const a = r() * Math.PI * 2, d = k ? 0.3 + r() * 0.35 : 0, jx = x + Math.cos(a) * d, jz = z + Math.sin(a) * d, col = r() < 0.5 ? '#9a6a48' : '#8a7a5a';
    g.push().translate(jx, y, jz);
    if (k === n - 1 && n > 2) g.translate(0, 0.2, 0).rotateY(a).rotateZ(Math.PI / 2 - 0.1);
    g.cyl(0, 0, 0, 0.08, 0.2, 0.3, 8, col, { kind: K.Rock });
    g.cyl(0, 0.3, 0, 0.2, 0.07, 0.3, 8, col, { kind: K.Rock });
    g.cyl(0, 0.6, 0, 0.06, 0.08, 0.12, 6, col, { kind: K.Rock });
    g.pop();
  }
  b.collide({ kind: 'c', x, z, r: 0.45, y0: y - 1, y1: y + 0.7 });
}

// ---------- the Kings' Way ----------

/** A king of the harbour in stone on his plinth, facing `face` (radians), coral grown on him: crowned and cloaked,
 *  his hands on his sword's pommel (or a sceptre and an orb), one without his head. On the seaward side (odd k)
 *  the sea has broken them at the waist: the upper half lies on its face in front of the plinth. */
function king(b: Builder, x: number, z: number, face: number, k: number, r: Rng) {
  const g = b.g(x, z), gl = b.gl(x, z), y = b.y(x, z), cf = Math.cos(face), sf = Math.sin(face), fallen = k % 2 === 1;
  const at = (lx: number, ly: number, lz: number): [number, number, number] => [x + lx * cf - lz * sf, y + ly, z + lx * sf + lz * cf];
  const tint = k % 2 ? '#b0b8b2' : '#a2aca8', dark = '#7e8884', JEWEL: [number, number, number] = k % 3 ? [2.4, 0.5, 0.45] : [0.5, 1.4, 2.6];
  g.box(x, y - 0.1, z, 1.15, 0.7, 1.15, STONE_D, { kind: K.Brick });
  g.box(x, y + 0.6, z, 1.0, 0.14, 1.0, STONE, { kind: K.Brick });
  // Standing on the plinth (the local frame faces +x, its origin on the plinth's top).
  const stand = (geo: Geo) => geo.push().translate(x, y + 0.74, z).rotateY(-face);
  // The upper half's frame: on the robe, or fallen on its face on the floor in front, turned along the way.
  const upper = (geo: Geo) => {
    stand(geo);
    if (fallen) geo.translate(0.85, -0.5, 0).rotateY(k === 3 ? -0.95 : 0.95).rotateZ(-Math.PI / 2 + 0.06).translate(0, -1.25, 0);
  };
  stand(g);
  // The name cut on the plinth's front, worn smooth; the robe falling to his feet, the cloak down his back.
  g.box(0.585, -0.55, 0, 0.03, 0.2, 0.62, '#3e4846');
  const lo = fallen ? 0.95 + (k % 3) * 0.12 : 1.45;
  g.cyl(0, 0, 0, 0.46, fallen ? 0.36 : 0.3, lo, 8, tint, { kind: K.Rock });
  g.cyl(-0.12, 0, 0, 0.42, 0.34, fallen ? lo + 0.1 : 1.85, 7, dark, { kind: K.Rock, rot: 0.2 });
  if (fallen) for (let n = 0; n < 4; n++) g.box((r() - 0.5) * 0.4, lo - 0.05, (r() - 0.5) * 0.5, 0.18, 0.12 + r() * 0.16, 0.16, tint, { kind: K.Rock });
  // His sword, its point on the plinth (still standing there where he broke).
  if (k % 3 !== 1) g.box(0.52, 0.0, 0, 0.05, 1.12, 0.12, '#b8c0c4', { kind: K.Metal });
  for (let n = 0; n < 8; n++) {
    const a = r() * Math.PI * 2;
    g.cyl(Math.cos(a) * 0.42, 0.1 + r() * (lo - 0.2), Math.sin(a) * 0.42, 0.05, 0.03, 0.05, 6, SEA.barnacle, { kind: K.Rock });
  }
  g.pop();
  // His chest and shoulders, head and crown, his arms; sceptre and orb, or the sword's hilt under his hands.
  upper(g);
  if (!fallen) g.cyl(0, lo, 0, 0.3, 0.3, 0.02, 8, tint, { kind: K.Rock });
  else g.cyl(0, 0.95, 0, 0.36, 0.3, 0.5, 8, tint, { kind: K.Rock });
  g.box(0.02, 1.35, 0, 0.42, 0.5, 0.7, tint, { kind: K.Rock });
  g.box(-0.04, 1.8, 0, 0.5, 0.18, 0.9, tint, { kind: K.Rock });
  g.box(-0.16, 1.4, 0, 0.12, 0.5, 0.86, dark, { kind: K.Rock });
  if (k !== 4) {
    g.blob(0.04, 2.2, 0, 0.21, 0.25, 0.2, tint, 60 + k, { kind: K.Rock });
    g.box(0.2, 1.93, 0, 0.1, 0.26, 0.24, tint, { kind: K.Rock });
    g.cyl(0.04, 2.36, 0, 0.22, 0.24, 0.14, 8, GOLD, { kind: K.Metal, cap: false });
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      g.box(0.04 + Math.cos(a) * 0.22, 2.48, Math.sin(a) * 0.22, 0.06, 0.16, 0.06, GOLD, { kind: K.Metal });
    }
  } else g.box(0, 1.98, 0, 0.2, 0.1, 0.22, '#5a6662', { kind: K.Rock });
  if (k % 3 === 1) {
    g.beam([0, 1.8, -0.4], [0.36, 1.3, -0.22], 0.08, tint, { kind: K.Rock });
    g.beam([0.38, 0.95, -0.22], [0.38, 2.3, -0.22], 0.045, GOLD, { kind: K.Metal });
    g.blob(0.38, 2.34, -0.22, 0.08, 0.08, 0.08, GOLD, 80 + k, { kind: K.Metal });
    g.beam([0, 1.8, 0.4], [0.34, 1.32, 0.22], 0.08, tint, { kind: K.Rock });
    g.blob(0.4, 1.38, 0.22, 0.14, 0.14, 0.14, GOLD, 70 + k, { kind: K.Metal });
  } else {
    for (const sd of [-1, 1]) g.beam([0, 1.8, sd * 0.4], [0.48, 1.22, sd * 0.06], 0.08, tint, { kind: K.Rock });
    if (!fallen) {
      g.box(0.52, 1.1, 0, 0.08, 0.08, 0.5, GOLD, { kind: K.Metal });
      g.box(0.52, 1.18, 0, 0.07, 0.18, 0.07, tint, { kind: K.Rock });
    }
  }
  g.pop();
  // A jewel in the crown, catching what light there is.
  if (k !== 4) {
    upper(gl);
    gl.box(0.27, 2.43, 0, 0.06, 0.07, 0.06, JEWEL, { kind: 0 });
    gl.pop();
  }
  // The headless king's head on the floor at his feet, crown and all; coral grown on the standing kings' shoulders and
  // on the fallen ones' backs.
  if (k === 4) {
    const [hx, , hz] = at(0.85, 0, 0.4), hy = b.y(hx, hz);
    g.blob(hx, hy + 0.18, hz, 0.21, 0.24, 0.2, tint, 64, { kind: K.Rock });
    g.cyl(hx + 0.06, hy + 0.04, hz, 0.22, 0.24, 0.14, 8, GOLD, { kind: K.Metal, cap: false });
  }
  const [sx, sy, sz] = fallen ? at(0.85 + 0.6 * Math.cos(k === 3 ? -0.95 : 0.95), 0.25, 0.6 * Math.sin(k === 3 ? -0.95 : 0.95)) : at(-0.05, 2.72, -0.36);
  if (k !== 2) on(b, sy, () => (k % 4 === 1 ? branchCoral(b, sx, sz, 0.45 + r() * 0.2, k % 3 ? SEA.coralOrange : SEA.coralPink) : k % 4 === 3 ? anemone(b, sx, sz, 0.6, SEA.coralPink, SEA.glowPink) : seaFan(b, sx, sz, 0.45, face, SEA.coralPurple)));
  const [ax, , az] = at(0.8, 0, fallen ? 0.55 : -0.5);
  anemone(b, ax, az, 0.55, r() < 0.5 ? SEA.coralTeal : SEA.coralPink, r() < 0.5 ? SEA.glowCyan : SEA.glowPink);
  b.collide({ kind: 'c', x, z, r: 0.62, y0: y - 1, y1: y + (fallen ? 1.9 : 3.2) });
  if (fallen) {
    const a = k === 3 ? -0.95 : 0.95;
    for (const d of [0.25, 0.85]) {
      const [cx, , cz] = at(0.85 + Math.cos(a) * d, 0, Math.sin(a) * d);
      b.collide({ kind: 'c', x: cx, z: cz, r: 0.38, y0: y - 1, y1: y + 0.45 });
    }
  }
}

// ---------- the royal library ----------

/** A bookcase of stone, w wide, its back to -z (rotated by rot): shelves of the kingdom's books (bound in boards gone
 *  to stone, tablets, scroll cases), some fallen out. Standing, or `fallen` on its face. */
function shelf(g: Geo, x: number, y: number, z: number, rot: number, w: number, fallen: number, r: Rng) {
  g.push().translate(x, y, z).rotateY(-rot);
  if (fallen) g.translate(0, 0.25, 0.3).rotateZ(fallen * 0.15).rotateX(Math.PI / 2 - 0.2);
  const h = 2.1, d = 0.45;
  for (const sx of [-1, 1]) g.box((sx * (w - 0.1)) / 2, 0, 0, 0.1, h, d, MARBLE, { kind: K.Rock });
  g.box(0, 0, -d / 2 + 0.04, w, h, 0.08, '#4a4440', { kind: K.Rock });
  g.box(0, h, 0, w + 0.1, 0.12, d + 0.05, MARBLE, { kind: K.Rock });
  const BOOK = ['#7a4a34', '#3e5a56', '#8a6a3a', '#5a3a4a', '#9a8a68', '#b0a888'];
  for (let sh = 0; sh < 4; sh++) {
    const sy = 0.08 + sh * 0.5;
    g.box(0, sy, 0, w - 0.1, 0.06, d - 0.04, MARBLE, { kind: K.Rock });
    for (let u = -w / 2 + 0.12; u < w / 2 - 0.15; ) {
      const bw = 0.06 + r() * 0.07, bh = 0.24 + r() * 0.16;
      if (r() < 0.22) {
        u += 0.15;
        continue;
      }
      g.push().translate(u + bw / 2, sy + 0.06, 0.02).rotateZ(r() < 0.12 ? 0.35 : 0);
      g.box(0, 0, 0, bw, bh, d - 0.14, BOOK[Math.floor(r() * BOOK.length)], { kind: K.Wood });
      // Gilt on a spine here and there, still catching the light.
      if (r() < 0.18) g.box(0, bh * 0.6, (d - 0.14) / 2 + 0.005, bw * 0.8, 0.03, 0.01, GOLD, { kind: K.Metal });
      g.pop();
      u += bw + 0.01;
    }
  }
  g.pop();
}

/** Books and tablets spilled on the floor round (x, z). */
function spill(b: Builder, x: number, z: number, n: number, spread: number, r: Rng) {
  const g = b.g(x, z);
  for (let k = 0; k < n; k++) {
    const bx = x + (r() - 0.5) * spread * 2, bz = z + (r() - 0.5) * spread, by = b.y(bx, bz);
    g.push().translate(bx, by + 0.02, bz).rotateY(r() * 3).rotateX(r() < 0.3 ? 0.3 : 0);
    g.box(0, 0, 0, 0.2 + r() * 0.12, 0.05 + r() * 0.04, 0.28, r() < 0.4 ? '#7a7468' : r() < 0.5 ? '#4a3e34' : '#3e4a46', { kind: K.Wood });
    g.pop();
  }
}

/** The library: back walls standing tall with their windows, the front ones broken low (the camera sees in); stone
 *  bookcases along the walls, two thrown down across the floor; the reading table, a lectern with the great book
 *  open on it, scroll jars, books everywhere. */
function library(b: Builder, r: Rng) {
  const { x0, z0, x1, z1 } = LIBRARY, xc = (x0 + x1) / 2, zc = (z0 + z1) / 2, y = b.y(xc, zc), t = 0.5;
  const g = b.g(xc, zc), gl = b.gl(xc, zc);
  stoneWall(b, g, [x0, z0 + t / 2], [x1, z0 + t / 2], y, 3.2, t, [{ at: 1.4, w: 0.6, lo: 1.3, hi: 2.6 }, { at: 3.3, w: 0.6, lo: 1.3, hi: 2.6 }, { at: 2.4, w: 1.2, lo: 2.7, hi: 9 }], STONE);
  stoneWall(b, g, [x0 + t / 2, z0 + t], [x0 + t / 2, z1], y, 2.8, t, [{ at: 2.6, w: 0.6, lo: 1.3, hi: 2.4 }, { at: 4.6, w: 1.6, lo: 1.9, hi: 9 }], STONE);
  ruinRun(b, g, [x0 + t, z1 - t / 2], [x1, z1 - t / 2], y, 0.3, 1.5, t, [[1.6, 3]], r);
  ruinRun(b, g, [x1 - t / 2, z0 + t], [x1 - t / 2, z1 - t], y, 0.4, 1.8, t, [[1.4, 2.6]], r);
  for (const wx of [x0 + 1.4, x0 + 3.3]) gl.box(wx, y + 1.3, z0 + 0.04, 0.5, 1.3, 0.04, MOON_DIM, { kind: 0 });
  // The bookcases: one still standing against the north wall, the other beside it thrown down on its face across
  // the floor (something hidden behind it); two along the west wall.
  shelf(g, x0 + 1.3, y, z0 + t + 0.25, 0, 1.5, 0, r);
  b.collide({ kind: 'b', x0: x0 + 0.55, z0: z0 + t, x1: x0 + 2.05, z1: z0 + t + 0.5, y0: y - 1, y1: y + 2.2 });
  shelf(g, x0 + t + 0.25, y, z0 + 3, -Math.PI / 2, 1.4, 0, r);
  shelf(g, x0 + t + 0.25, y, z0 + 4.9, -Math.PI / 2, 1.4, 0, r);
  for (const sz of [z0 + 3, z0 + 4.9]) b.collide({ kind: 'b', x0: x0 + t, z0: sz - 0.7, x1: x0 + t + 0.5, z1: sz + 0.7, y0: y - 1, y1: y + 2.2 });
  const fx = x0 + 3.2, fz = z0 + t + 0.25, fa = 0.4;
  shelf(g, fx, y, fz, fa, 1.5, 1, r);
  for (const d of [0.9, 1.9]) b.collide({ kind: 'c', x: fx - Math.sin(fa) * d, z: fz + Math.cos(fa) * d, r: 0.55, y0: y - 1, y1: y + 0.55 });
  spill(b, fx - 0.9, fz + 2.4, 10, 0.9, r);
  spill(b, x0 + 2.2, z0 + 4.4, 6, 0.6, r);
  // The lectern with the great book open on it, scroll jars by the east wall.
  const lx = x1 - 1.2, lz = z1 - 1.4;
  g.cyl(lx, y, lz, 0.22, 0.14, 1.0, 6, STONE_D, { kind: K.Rock });
  g.push().translate(lx, y + 1.0, lz).rotateX(-0.35);
  g.box(0, 0, 0, 0.7, 0.08, 0.5, STONE, { kind: K.Rock });
  g.box(-0.17, 0.08, 0, 0.32, 0.06, 0.44, '#c8c0a8', { kind: K.Plaster });
  g.box(0.17, 0.08, 0, 0.32, 0.06, 0.44, '#c0b8a0', { kind: K.Plaster });
  g.pop();
  gl.box(lx, y + 1.18, lz - 0.02, 0.5, 0.01, 0.3, [0.2, 0.4, 0.55], { kind: 0 });
  b.collide({ kind: 'c', x: lx, z: lz, r: 0.35, y0: y - 1, y1: y + 1.2 });
  for (const [jx, jz] of [[x1 - t - 0.3, z1 - 2.2], [x1 - t - 0.35, z1 - 2.65]]) {
    g.cyl(jx, y, jz, 0.18, 0.2, 0.55, 8, '#7a6a52', { kind: K.Rock });
    for (let k = 0; k < 3; k++) g.beam([jx + (k - 1) * 0.06, y + 0.4, jz], [jx + (k - 1) * 0.1, y + 0.75, jz + (k - 1) * 0.04], 0.03, '#b8ac90', { kind: K.Plaster });
    b.collide({ kind: 'c', x: jx, z: jz, r: 0.2, y0: y - 1, y1: y + 0.6 });
  }
  // The sea in the ruin: kelp in the corner, anemones on the shelves' tops and the fallen ones, a fan by the door.
  kelp(b, x0 + 0.9, z1 - 0.6, 2.6, 2);
  on(b, y + 2.15, () => anemone(b, x0 + 1.3, z0 + t + 0.25, 0.6, SEA.coralPink, SEA.glowPink));
  on(b, y + 2.15, () => branchCoral(b, x0 + t + 0.2, z0 + 4.9, 0.5, SEA.coralOrange));
  on(b, y + 0.5, () => anemone(b, fx - 0.5, fz + 1.4, 0.6, SEA.coralTeal, SEA.glowCyan));
  seaFan(b, x1 + 0.5, z0 + 1.1, 0.8, 1.2, SEA.coralPurple);
  b.lights.add(xc, y + 2, zc, 0x7fb8d8, 1.8, 4, 0.1);
}

// ---------- the royal treasury ----------

/** The treasury: a strongroom of great blocks, shut, its iron door rusted fast; its south wall cracked through (the
 *  game's cracked wall stands in the gap: a heavy blow breaks it). Inside, the kingdom's last gold: the chests, gold
 *  in heaps, a crown on a cushion. Its roof and the walls toward the camera fade when the knight is inside. */
function treasury(b: Builder, r: Rng) {
  const { x0, z0, x1, z1 } = VAULT, xc = (x0 + x1) / 2, zc = (z0 + z1) / 2, y = b.y(xc, zc), H = 2.6, t = 0.6;
  const s = b.structure('treasury', new THREE.Box3(new THREE.Vector3(x0 - 0.3, y, z0 - 0.3), new THREE.Vector3(x1 + 0.3, y + H + 0.6, z1 + 0.3)), [x0 + t, z0 + t, x1 - t, z1 - t], y);
  const block = (geo: Geo, a: Pt, c: Pt, skip?: [number, number]) => {
    const alongX = Math.abs(c[0] - a[0]) >= Math.abs(c[1] - a[1]), len = alongX ? c[0] - a[0] : c[1] - a[1];
    for (let row = 0; row < 4; row++)
      for (let u = row % 2 ? -0.45 : 0; u < len - 0.02; u += 0.9) {
        const u0 = Math.max(0, u), u1 = Math.min(len, u + 0.9);
        if (skip && u0 >= skip[0] - 0.01 && u1 <= skip[1] + 0.01) continue;
        const sk0 = skip && u0 < skip[1] && u1 > skip[0] ? (u0 < skip[0] ? [u0, skip[0]] : [skip[1], u1]) : [u0, u1];
        const um = (sk0[0] + sk0[1]) / 2, w = sk0[1] - sk0[0] - 0.03;
        if (w < 0.05) continue;
        geo.box(alongX ? a[0] + um : a[0], y + row * (H / 4), alongX ? a[1] : a[1] + um, alongX ? w : t, H / 4 - 0.03, alongX ? t : w, (row + Math.floor(u)) % 3 ? STONE : STONE_D, { kind: K.Brick, shade: 0.9 + r() * 0.15 });
      }
  };
  block(s.core, [x0, z0 + t / 2], [x1, z0 + t / 2]);
  block(s.core, [x0 + t / 2, z0 + t], [x0 + t / 2, z1 - t]);
  block(s.shell, [x1 - t / 2, z0 + t], [x1 - t / 2, z1 - t]);
  // The south wall, the crack's gap (2.2 m) left for the cracked wall.
  block(s.shell, [x0, z1 - t / 2], [x1, z1 - t / 2], [xc - 1.1 - x0, xc + 1.1 - x0]);
  // The roof: a slab with a cornice, coral and barnacles on it (all in the shell, so it fades with it).
  s.shell.box(xc, y + H, zc, x1 - x0 + 0.3, 0.35, z1 - z0 + 0.3, STONE_D, { kind: K.Brick, top: STONE });
  s.shell.box(xc, y + H + 0.35, zc, x1 - x0 - 0.3, 0.12, z1 - z0 - 0.3, STONE, { kind: K.Brick });
  for (let k = 0; k < 4; k++) {
    const cx = x0 + 0.6 + r() * (x1 - x0 - 1.2), cz = z0 + 0.6 + r() * (z1 - z0 - 1.2);
    s.shell.blob(cx, y + H + 0.45, cz, 0.3, 0.2, 0.28, k % 2 ? SEA.coralYellow : '#7a5a6a', Math.floor(r() * 999), { kind: K.Rock, flatBottom: true });
  }
  for (let k = 0; k < 12; k++) s.shell.cyl(x0 + r() * (x1 - x0), y + 0.3 + r() * 2, z1 + 0.02, 0.05, 0.03, 0.05, 6, SEA.barnacle, { kind: K.Rock });
  // The iron door in the east wall, rusted fast, a lion's-head ring on it.
  s.shell.box(x1 + 0.03, y, zc, 0.06, 2, 1.2, '#4a3a30', { kind: K.Metal });
  for (let k = 0; k < 4; k++) s.shell.box(x1 + 0.07, y + 0.3 + k * 0.45, zc, 0.04, 0.06, 1.24, IRON, { kind: K.Metal });
  s.shell.blob(x1 + 0.1, y + 1.05, zc, 0.06, 0.12, 0.12, '#8a6a3a', 91, { kind: K.Metal });
  // Its walls block the way, all the way up (the only way in is through the crack).
  b.collide({ kind: 'b', x0, z0, x1, z1: z0 + t, y0: y - 1, y1: y + 9 });
  b.collide({ kind: 'b', x0, z0, x1: x0 + t, z1, y0: y - 1, y1: y + 9 });
  b.collide({ kind: 'b', x0: x1 - t, z0, x1, z1, y0: y - 1, y1: y + 9 });
  b.collide({ kind: 'b', x0, z0: z1 - t, x1: xc - 1.1, z1, y0: y - 1, y1: y + 9 });
  b.collide({ kind: 'b', x0: xc + 1.1, z0: z1 - t, x1, z1, y0: y - 1, y1: y + 9 });
  // Inside: gold in heaps against the back wall, a strongbox fallen open, the crown on its cushion, coins scattered.
  const g = b.g(xc, zc), gl = b.gl(xc, zc);
  for (const [hx, hs] of [[x0 + t + 0.4, 0.42], [xc + 0.1, 0.3], [x1 - t - 0.4, 0.38]]) {
    g.blob(hx, y, z0 + t + 0.3, hs, hs * 0.6, hs * 0.75, GOLD, Math.floor(r() * 999), { kind: K.Metal, flatBottom: true });
    gl.blob(hx + 0.05, y + hs * 0.4, z0 + t + 0.35, hs * 0.25, 0.04, hs * 0.2, [1.4, 1.0, 0.3], 7, { jitter: 0.1 });
  }
  g.push().translate(xc, y + 0.12, zc + 0.15).rotateY(0.5).rotateX(-0.3);
  g.box(0, 0, 0, 0.5, 0.32, 0.34, '#5a4030', { kind: K.Wood });
  g.pop();
  g.box(xc - 0.5, y, z0 + t + 0.25, 0.4, 0.5, 0.4, MARBLE, { kind: K.Rock });
  g.box(xc - 0.5, y + 0.5, z0 + t + 0.25, 0.36, 0.08, 0.36, '#6a2a30', { kind: K.Cloth });
  g.cyl(xc - 0.5, y + 0.58, z0 + t + 0.25, 0.15, 0.17, 0.12, 8, GOLD, { kind: K.Metal, cap: false });
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2;
    g.box(xc - 0.5 + Math.cos(a) * 0.16, y + 0.66, z0 + t + 0.25 + Math.sin(a) * 0.16, 0.04, 0.1, 0.04, GOLD, { kind: K.Metal });
  }
  for (let k = 0; k < 14; k++) g.cyl(x0 + t + 0.2 + r() * (x1 - x0 - 2 * t - 0.4), y + 0.01, z0 + t + 0.2 + r() * (z1 - z0 - 2 * t - 0.4), 0.05, 0.05, 0.015, 6, GOLD, { kind: K.Metal });
  b.lights.add(xc, y + 1.2, zc, 0xffc870, 1.6, 3, 0.1);
}

// ---------- the queen's gardens ----------

/** A garden planter of stone, w by d (rectangular) or round (d = 0, w its radius), filled with silt; the sea's
 *  growth in it (anemones packed in, a fan or a branch of coral). */
function planter(b: Builder, x: number, z: number, w: number, d: number, r: Rng) {
  const g = b.g(x, z), y = b.y(x, z), h = 0.55;
  if (d) {
    for (const [px, pz, sx, sz] of [[x, z - d / 2, w, 0.22], [x, z + d / 2, w, 0.22], [x - w / 2, z, 0.22, d], [x + w / 2, z, 0.22, d]]) g.box(px, y, pz, sx, h, sz, STONE, { kind: K.Brick, top: MARBLE });
    g.box(x, y, z, w - 0.1, h - 0.08, d - 0.1, '#5a5444', { kind: K.Sand });
    b.collide({ kind: 'b', x0: x - w / 2 - 0.1, z0: z - d / 2 - 0.1, x1: x + w / 2 + 0.1, z1: z + d / 2 + 0.1, y0: y - 1, y1: y + h });
  } else {
    g.cyl(x, y, z, w, w + 0.08, h, 12, STONE, { kind: K.Brick, top: MARBLE });
    g.cyl(x, y + h, z, w + 0.1, w + 0.1, 0.08, 12, MARBLE, { kind: K.Rock });
    g.cyl(x, y + h + 0.02, z, w - 0.1, w - 0.1, 0.07, 12, '#5a5444', { kind: K.Sand });
    b.collide({ kind: 'c', x, z, r: w + 0.1, y0: y - 1, y1: y + h });
  }
  const n = Math.max(2, Math.round((d ? w * d : w * w * 3) * 1.6));
  on(b, y + h, () => {
    for (let k = 0; k < n; k++) {
      const ax = x + (r() - 0.5) * (d ? w - 0.4 : w), az = z + (r() - 0.5) * (d ? d - 0.4 : w);
      const u = r();
      if (u < 0.65) anemone(b, ax, az, 0.55 + r() * 0.35, r() < 0.5 ? SEA.coralTeal : SEA.coralPink, r() < 0.5 ? SEA.glowCyan : SEA.glowPink);
      else if (u < 0.82) seaFan(b, ax, az, 0.5 + r() * 0.3, r() * Math.PI, r() < 0.5 ? SEA.coralPurple : SEA.coralPink);
      else branchCoral(b, ax, az, 0.5 + r() * 0.3, r() < 0.5 ? SEA.coralOrange : SEA.coralPink);
    }
  });
}

/** The gardens: planters along a walk from the treasury's crack down to the spring (the vent by the edge), a
 *  pergola of slender columns over the walk with its beams fallen half away, a seat; seagrass let grow between. */
function gardens(b: Builder, grid: Grid, r: Rng) {
  for (let z = 91; z < 99; z++)
    for (let x = 76; x < 88; x++) {
      const i = grid.i(x, z);
      if (!insidePoly(GARDENS, x + 0.5, z + 0.5) || grid.h[i] > -4) continue;
      if (fbm(x * 0.4, z * 0.4, 2, 97) > 0.42) {
        grid.t[i] = T.Seagrass;
        grid.noGrass[i] = 0;
      }
    }
  for (const [x, z, w, d] of [[78.6, 93.4, 1.4, 2.4], [84.6, 93.1, 2.2, 1.3], [84.6, 95.9, 0.75, 0], [78.6, 95.4, 0.6, 0], [85.9, 97.2, 1.1, 1.1]]) planter(b, x, z, w, d, r);
  // The pergola: two pairs of slender columns either side of the walk, a beam along each side (the east one broken
  // with its column), cross-beams, one fallen.
  const g = b.g(81.3, 94), y = b.y(81.3, 94);
  for (const px of [80.3, 82.3])
    for (const pz of [92.6, 94.4]) {
      const py = b.y(px, pz), broken = px > 82 && pz > 94;
      g.cyl(px, py, pz, 0.18, 0.15, broken ? 1.1 : 2.4, 8, MARBLE, { kind: K.Rock });
      if (!broken) g.box(px, py + 2.4, pz, 0.36, 0.12, 0.36, STONE, { kind: K.Rock });
      b.collide({ kind: 'c', x: px, z: pz, r: 0.22, y0: py - 1, y1: py + 2.5 });
    }
  g.box(80.3, y + 2.52, 93.5, 0.2, 0.18, 2.4, STONE, { kind: K.Rock });
  g.box(82.3, y + 2.52, 93.0, 0.2, 0.18, 1.2, STONE, { kind: K.Rock });
  for (const pz of [92.6, 93.5]) g.box(81.3, y + 2.7, pz, 2.5, 0.12, 0.16, STONE_D, { kind: K.Rock });
  g.push().translate(82.5, y + 0.1, 95.7).rotateY(0.4).rotateZ(0.12);
  g.box(0, 0, 0, 1.8, 0.18, 0.2, STONE, { kind: K.Rock });
  g.pop();
  // Kelp let climb the columns, anemones along the beams.
  for (const [kx, kz] of [[80.3, 92.6], [82.3, 94.4]]) kelp(b, kx + 0.25, kz + 0.2, 2.6, 1);
  on(b, y + 2.82, () => {
    anemone(b, 81, 93.5, 0.6, SEA.coralPink, SEA.glowPink);
    anemone(b, 81.8, 92.6, 0.5, SEA.coralTeal, SEA.glowCyan);
  });
  // A stone seat facing the walk, by the pergola's east side.
  g.box(83.2, y, 94.4, 0.5, 0.42, 1.5, STONE, { kind: K.Rock, top: MARBLE });
  b.collide({ kind: 'b', x0: 82.95, z0: 93.65, x1: 83.45, z1: 95.15, y0: y - 1, y1: y + 0.45 });
  // The walk: big flags from the crack to the spring.
  for (let z = 91; z <= 96; z++) for (const x of [80, 81, 82]) if (grid.h[grid.i(x, z)] <= -4.4) grid.t[grid.i(x, z)] = T.Flag;
}

// ---------- the harbour wall ----------

/** A boat sunk long ago: its hull of planks with gaps where they've rotted through, ribs showing, the mast's stump;
 *  heeled over by `heel`, lying along `rot`, `len` long. */
function sunkenBoat(b: Builder, x: number, z: number, rot: number, heel: number, len: number, r: Rng) {
  const g = b.g(x, z), y = b.y(x, z), hw = len * 0.2, hd = len * 0.12;
  g.push().translate(x, y + 0.1, z).rotateY(-rot).rotateX(heel);
  for (let k = 0; k < 5; k++) {
    const t0 = k / 5, depth = hd * (1 - t0 * 0.5);
    for (const sd of [-1, 1])
      for (let u = -len / 2; u < len / 2 - 0.05; u += 0.45) {
        const taper = 1 - (Math.abs(u + 0.22) / (len / 2)) ** 2, wz = sd * hw * (0.35 + 0.65 * Math.sqrt(Math.max(0, taper))) * (0.55 + t0 * 0.45);
        if (r() < 0.16) continue;
        g.box(u + 0.22, k * depth * 0.5 - 0.1, wz, 0.44, depth * 0.46, 0.05, k % 2 ? '#4e3e30' : '#5a4838', { kind: K.Wood });
      }
  }
  for (let u = -len / 2 + 0.5; u < len / 2 - 0.3; u += 0.6)
    for (const sd of [-1, 1]) g.beam([u, -0.1, 0], [u, hd * 1.4, sd * hw * 0.95], 0.04, '#3e3024', { kind: K.Wood });
  g.box(0, -0.12, 0, len * 0.9, 0.12, 0.2, '#3e3024', { kind: K.Wood });
  g.cyl(len * 0.1, 0, 0, 0.09, 0.07, 1.1, 6, '#4a3a2e', { kind: K.Wood });
  g.pop();
  b.collide({ kind: 'c', x, z, r: Math.min(1.1, len * 0.22), y0: y - 1, y1: y + 0.9 });
}

/** The harbour wall along the kingdom's edge: a kerb of great coping stones (gaps where it has fallen), bollards on
 *  it, mooring rings on its face over the water, ropes still trailing from two of them down to boats sunk at its
 *  foot in the trench; steps down from where the Kings' Way meets it. */
function harbour(b: Builder, r: Rng) {
  for (let k = 0; k + 1 < QUAY.length; k++) {
    const [ax, az] = QUAY[k], [cx, cz] = QUAY[k + 1], len = Math.hypot(cx - ax, cz - az), ux = (cx - ax) / len, uz = (cz - az) / len, rot = Math.atan2(uz, ux);
    // Its outward side (toward the trench) is to the right of a to c.
    const ox = -uz, oz = ux;
    for (let s = 0.6; s < len - 0.4; s += 1.05) {
      const px = ax + ux * s, pz = az + uz * s;
      // A gap where the Kings' Way meets the wall (its steps down) and where the kerb has fallen.
      if (Math.hypot(px - 105.4, pz - 92.2) < 1.6 || fbm(px * 0.35, pz * 0.35, 2, 99) < 0.32) continue;
      const g = b.g(px, pz), y = b.y(px, pz);
      g.push().translate(px, y, pz).rotateY(-rot);
      g.box(0, -0.1, 0, 1.0, 0.65, 0.75, (Math.floor(s) % 3 ? STONE : STONE_D), { kind: K.Brick, top: MARBLE });
      if (r() < 0.3) g.cyl((r() - 0.5) * 0.6, 0.15 + r() * 0.3, 0.38, 0.05, 0.03, 0.05, 6, SEA.barnacle, { kind: K.Rock });
      g.pop();
      b.collide({ kind: 'c', x: px, z: pz, r: 0.42, y0: y - 1, y1: y + 0.55 });
    }
    // Bollards every few metres, an iron ring on the wall's face beside each.
    for (let s = 2.2; s < len - 1; s += 3.6) {
      const px = ax + ux * s - ox * 0.9, pz = az + uz * s - oz * 0.9, g = b.g(px, pz), y = b.y(px, pz);
      if (Math.hypot(px - 105.4, pz - 92.2) < 2 || Math.hypot(px - 104.5, pz - 89.5) < 2) continue;
      g.cyl(px, y, pz, 0.26, 0.22, 0.6, 8, IRON, { kind: K.Metal });
      g.cyl(px, y + 0.6, pz, 0.3, 0.3, 0.12, 8, IRON, { kind: K.Metal });
      b.collide({ kind: 'c', x: px, z: pz, r: 0.3, y0: y - 1, y1: y + 0.72 });
      const rx = ax + ux * (s + 0.5) + ox * 0.42, rz = az + uz * (s + 0.5) + oz * 0.42, ry = b.y(rx - ox * 0.4, rz - oz * 0.4) + 0.45, ring: [number, number, number][] = [];
      for (let a = 0; a <= 8; a++) ring.push([rx + ux * Math.cos((a / 8) * Math.PI * 2) * 0.2, ry - 0.2 + Math.sin((a / 8) * Math.PI * 2) * 0.2, rz + uz * Math.cos((a / 8) * Math.PI * 2) * 0.2]);
      b.g(rx, rz).sweep(ring, ring.map(() => 0.035), '#5a4a3a', { seg: 5, lumpy: 0, kind: K.Metal });
    }
  }
  // The steps down from the end of the Kings' Way: a flight going down the wall's face into the trench, broken off
  // where the deep begins.
  const g = b.g(106, 92.6);
  for (let k = 0; k < 6; k++) {
    const sx = 105.9 + k * 0.42, sz = 92.4 + k * 0.32, y = -4.6 - k * 0.42;
    g.box(sx, y, sz, 0.55, 0.3, 1.6, k % 2 ? STONE : STONE_D, { kind: K.Brick, top: MARBLE });
    g.box(sx, y - 1.4, sz, 0.5, 1.4, 1.5, STONE_D, { kind: K.Brick });
  }
  // Boats sunk at the wall's foot in the trench, their ropes still up to the rings; one more broken on the rim.
  sunkenBoat(b, 98.2, 99.4, 2.85, 0.35, 4.2, r);
  sunkenBoat(b, 109.6, 90.2, 2.2, -0.45, 3.4, r);
  sunkenBoat(b, 88.2, 99.2, 0.3, 0.25, 3, r);
  for (const [[ax, ay, az], [cx, cz]] of [[[96.9, -4.1, 97.2], [98.2, 99.4]], [[108.2, -4.1, 88.6], [109.6, 90.2]]] as [[number, number, number], Pt][]) {
    const cy = b.y(cx, cz) + 0.6, mx = (ax + cx) / 2, mz = (az + cz) / 2;
    b.g(mx, mz).sweep([[ax, ay, az], [mx, (ay + cy) / 2 - 1.2, mz], [cx, cy, cz]], [0.03, 0.03, 0.03], '#8a7a5a', { seg: 4, lumpy: 0, kind: K.Cloth, wind: 0.8 });
  }
  // Kelp along the wall's foot, a fan on a bollard's ring.
  for (const [kx, kz] of [[101.6, 97.6], [107.6, 93.4], [93.6, 99.6]]) {
    const h = b.y(kx, kz);
    if (h < -2.5) kelp(b, kx, kz, Math.min(-h - 0.6, 5 + r() * 3), 2);
  }
}

// ---------- the houses ----------

/** A house of the kingdom gone to ruin, w by d (x by z) at (x0, z0): its back walls (north, west) standing two
 *  storeys with a window up there, its front ones broken lower; a doorway (`door`: side 'e' or 's', `at` along
 *  that wall); a stone stair up the inside of its west wall to the upper floor, of which only a ledge of joists and
 *  boards is left along the back. */
function house(b: Builder, x0: number, z0: number, w: number, d: number, door: { side: 'e' | 's'; at: number }, r: Rng) {
  const x1 = x0 + w, z1 = z0 + d, y = b.y(x0 + w / 2, z0 + d / 2), t = 0.42, g = b.g(x0 + w / 2, z0 + d / 2);
  stoneWall(b, g, [x0, z0 + t / 2], [x1, z0 + t / 2], y, 4.2, t, [{ at: w * 0.6, w: 0.55, lo: 2.9, hi: 3.7 }, { at: w * 0.2, w: 1, lo: 3.6, hi: 9 }]);
  stoneWall(b, g, [x0 + t / 2, z0 + t], [x0 + t / 2, z1], y, 3.6, t, [{ at: d * 0.6, w: 0.5, lo: 1.1, hi: 1.9 }, { at: d - 0.4, w: 0.9, lo: 2.4, hi: 9 }]);
  ruinRun(b, g, [x0 + t, z1 - t / 2], [x1, z1 - t / 2], y, 0.5, 2.3, t, door.side === 's' ? [[door.at - 0.6, door.at + 0.6]] : [], r);
  ruinRun(b, g, [x1 - t / 2, z0 + t], [x1 - t / 2, z1 - t], y, 0.8, 2.6, t, door.side === 'e' ? [[door.at - 0.6, door.at + 0.6]] : [], r);
  // The doorway's lintel, if its wall still stands that high: a long stone over two jambs.
  const [jx, jz, alongX] = door.side === 's' ? [x0 + door.at, z1 - t / 2, true] : [x1 - t / 2, z0 + door.at, false];
  for (const sd of [-1, 1]) g.box(jx + (alongX ? sd * 0.62 : 0), y, jz + (alongX ? 0 : sd * 0.62), alongX ? 0.2 : t + 0.06, 2.1, alongX ? t + 0.06 : 0.2, MARBLE, { kind: K.Brick });
  g.box(jx, y + 2.1, jz, alongX ? 1.5 : t + 0.08, 0.26, alongX ? t + 0.08 : 1.5, MARBLE, { kind: K.Brick });
  // The stair: steps up along the west wall, northward, to the ledge of the upper floor.
  const steps = Math.floor((d - t - 1) / 0.36);
  for (let k = 0; k < steps; k++) {
    const sz = z1 - t - 0.3 - k * 0.36, sh = 0.28 * (k + 1);
    g.box(x0 + t + 0.4, y, sz, 0.8, sh, 0.36, k % 2 ? STONE : STONE_D, { kind: K.Brick, top: MARBLE });
  }
  b.collide({ kind: 'b', x0: x0 + t, z0: z1 - t - 0.12 - steps * 0.36, x1: x0 + t + 0.8, z1: z1 - t - 0.1, y0: y - 1, y1: y + 0.6 });
  // The upper floor's ledge along the back wall: joists out from the wall, a few boards; the rest fallen in.
  const fy = y + 2.85;
  for (let u = x0 + t + 0.1; u < x1 - t; u += 0.5) g.box(u, fy, z0 + t + (u > x0 + w * 0.6 ? 0.35 : 0.6), 0.12, 0.16, u > x0 + w * 0.6 ? 0.7 : 1.2, TIMBER, { kind: K.Wood });
  g.box(x0 + t + 0.8, fy + 0.16, z0 + t + 0.6, 1.4, 0.06, 1.2, '#4e4234', { kind: K.Wood });
  for (let k = 0; k < 3; k++) {
    g.push().translate(x0 + w * 0.55 + (r() - 0.5), y + 0.05, z0 + d * 0.55 + (r() - 0.5) * 0.8).rotateY(r() * 3).rotateZ(0.1 + r() * 0.2);
    g.box(0, 0, 0, 1.6, 0.12, 0.14, TIMBER, { kind: K.Wood });
    g.pop();
  }
  // The sea's growth: an anemone on the stair's top, coral on the wall's broken top, sand drifted in.
  on(b, y + 0.28 * steps, () => anemone(b, x0 + t + 0.4, z1 - t - 0.3 - (steps - 1) * 0.36, 0.5, SEA.coralPink, SEA.glowPink));
  on(b, y + 4.2, () => branchCoral(b, x0 + w * 0.8, z0 + t / 2, 0.45, SEA.coralOrange));
  g.blob(x1 - t - 0.5, y, z1 - t - 0.5, 0.7, 0.15, 0.5, '#8a8068', Math.floor(r() * 999), { kind: K.Sand, flatBottom: true });
}

// ---------- the data ----------

/** Everything of the drowned kingdom's set pieces, built onto the realm: its props now, and its chests, lore, foes
 *  and regions. `under` says whether a spot is under the sea. */
export function buildKingdom(b: Builder, grid: Grid, under: (x: number, z: number) => boolean) {
  // (Drawn with a random stream of their own, so that the props drawn before and after them stay as they were.)
  const keep = b.rng, r = (b.rng = mulberry32(4747));
  temple(b, r);
  fountain(b, SQUARE.x, SQUARE.z);
  stall(b, 97.6, 76.9, 0, r);
  stall(b, 99.9, 79.2, Math.PI / 2, r);
  jars(b, 95.4, 76.6, 4, r);
  jars(b, 99.9, 84.2, 3, r);
  // The Kings' Way: three kings a side, facing each other across it.
  {
    const [[ax, az], [cx, cz]] = WAY, len = Math.hypot(cx - ax, cz - az), ux = (cx - ax) / len, uz = (cz - az) / len, nx = -uz, nz = ux;
    [1.6, 4.1, 6.6].forEach((s, k) =>
      [-1, 1].forEach((sd, j) => king(b, ax + ux * s + nx * sd * 1.75, az + uz * s + nz * sd * 1.75, Math.atan2(-nz * sd, -nx * sd), k * 2 + j, r)),
    );
  }
  library(b, r);
  treasury(b, r);
  gardens(b, grid, r);
  harbour(b, r);
  house(b, 77.8, 75.7, 3.6, 2.9, { side: 'e', at: 1.5 }, r);
  house(b, 82.4, 74.2, 3.4, 2.8, { side: 's', at: 2 }, r);
  b.rng = keep;

  const enemies: EnemySpawn[] = [
    // A pair of the crew's divers looting the market, a crab in the gardens, an eel in the library's fallen shelves,
    // a pufferfish by the harbour wall.
    { type: 'diver', x: 96.4, z: 83.6 },
    { type: 'diver', x: 97.9, z: 84.4 },
    { type: 'crab', x: 81.3, z: 95 },
    { type: 'eel', x: 73.9, z: 91.3 },
    { type: 'puffer', x: 98.2, z: 93.4 },
  ];
  const objects: ObjDef[] = [
    // The treasury's cracked wall.
    { kind: 'cracked', id: 'r3w_treasury', x: (VAULT.x0 + VAULT.x1) / 2, z: VAULT.z1 - 0.3, alongX: true },
    // Chests, paid by how hidden: in the open in the market (30), in the house's corner (45), behind the library's
    // fallen shelves (45), before the temple's altar (50), in a boat sunk in the trench (70), the treasury's (70, 75).
    { kind: 'chest', id: 'r3_market', x: 95.2, z: 78.2, rot: 0.6, coins: 30 },
    { kind: 'chest', id: 'r3_house', x: 80.6, z: 76.7, rot: -0.3, coins: 45 },
    { kind: 'chest', id: 'r3_library', x: LIBRARY.x0 + 1.3, z: LIBRARY.z0 + 1.65, rot: 0.15, coins: 45 },
    { kind: 'chest', id: 'r3_temple', x: TEMPLE.door - 0.1, z: TEMPLE.z0 + 3.15, rot: 0, coins: 50 },
    { kind: 'chest', id: 'r3_harbour', x: 99.6, z: 100.6, rot: 2.6, coins: 70 },
    { kind: 'chest', id: 'r3_treasury', x: VAULT.x0 + 1.25, z: VAULT.z0 + 1.45, rot: 0.15, coins: 70 },
    { kind: 'chest', id: 'r3_treasury2', x: VAULT.x1 - 1.2, z: VAULT.z0 + 1.5, rot: -0.2, coins: 75 },
    // Pots in the market to break.
    { kind: 'breakable', x: 94.6, z: 77.4, what: 'pot' },
    { kind: 'breakable', x: 98.9, z: 84.9, what: 'pot' },
    { kind: 'breakable', x: 100.1, z: 77.4, what: 'pot' },
    // Lore: the chronicle in the library, the royal line, the Lady's inscription, the Kings' Way, the harbour, the
    // queen's garden.
    { kind: 'lore', id: 'r3lore_fall', x: LIBRARY.x1 - 0.5, z: LIBRARY.z1 + 0.7, text: 'The chronicle\'s last leaf, cut in stone: The sea came up the harbour steps at dusk, and into the high street by moonrise. The people took to the boats. The lord would not go. He said the sea would have to take him with his kingdom.' },
    { kind: 'lore', id: 'r3lore_line', x: LIBRARY.x0 + 2.3, z: LIBRARY.z0 + 4.2, text: 'A tablet of the royal line: eleven kings, each crowned on the plaza and set in stone along the way to the sea. The twelfth name has been struck out, and over it someone has cut a wave.' },
    { kind: 'lore', id: 'r3lore_lady', x: TEMPLE.x1 - 1.0, z: TEMPLE.z0 + 1.7, text: 'Carved at the Lady\'s feet: Ask the tide, and the tide answers. The last lord asked it for his kingdom, for ever. It answered: then keep it, below.' },
    { kind: 'lore', id: 'r3lore_kings', x: 95.6, z: 91.2, text: 'The kings of the harbour stand along the way to the sea, to watch their ships come home. The ships are all below them now. At the end of the way the current still runs to the palace, as the barges did.' },
    { kind: 'lore', id: 'r3lore_harbour', x: 95, z: 95.2, text: 'Moorings for forty ships, and steps for the lord\'s barge. The kingdom\'s wealth came in over this wall. On the last night the sea came in after it.' },
    { kind: 'lore', id: 'r3lore_garden', x: 85.4, z: 94.6, text: 'The queen kept her garden by the treasury, where the lord could see it from his counting-room. The anemones have every bed now. They open at night, the way her moonflowers did.' },
  ];
  const inRect = (o: { x0: number; z0: number; x1: number; z1: number }, x: number, z: number, m = 0) => x > o.x0 - m && x < o.x1 + m && z > o.z0 - m && z < o.z1 + m;
  const regions: RegionDef[] = [
    { name: 'The Sunken Temple', music: 'hall', amb: 'temple', test: (x, z) => inRect(TEMPLE, x, z) && under(x, z) },
    { name: 'The Royal Treasury', music: 'hall', amb: 'grotto', test: (x, z) => inRect(VAULT, x, z) && under(x, z) },
    { name: 'The Royal Library', music: 'keep', amb: 'grotto', test: (x, z) => inRect(LIBRARY, x, z, 0.5) && under(x, z) },
    { name: 'The Kings\' Way', music: 'keep', amb: 'sea', test: (x, z) => distLine(WAY, x, z) < 2.6 && under(x, z) },
    { name: 'The Market Square', music: 'keep', amb: 'sea', test: (x, z) => Math.hypot(x - SQUARE.x, z - SQUARE.z) < 3.8 && x < TEMPLE.x0 && under(x, z) },
    { name: 'The Queen\'s Gardens', music: 'keep', amb: 'sea', test: (x, z) => insidePoly(GARDENS, x, z) && under(x, z) },
    { name: 'The Old Harbour', music: 'keep', amb: 'sea', test: (x, z) => distLine(QUAY, x, z) < 3.2 && under(x, z) },
  ];
  return { enemies, objects, regions };
}
