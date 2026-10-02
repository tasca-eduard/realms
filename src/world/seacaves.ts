import * as THREE from 'three';
import type { Geo } from '../engine/geo';
import { K } from '../engine/materials';
import { fbm, mulberry32 } from '../engine/util';
import { PAL, type Builder, type Structure } from './builder';
import * as D from './details';
import { NONE, T, type Grid } from './grid';
import { Painter, type Pt } from './paint';
import type { EnemySpawn, NpcDef, ObjDef, RegionDef } from './realm';
import { anemone, brainCoral, branchCoral, driftwood, SEA, seaFan, seaRock, SHORE } from './sea';

// ---------------------------------------------------------------------------
// The Sunken Reef's caves (group 36 of the realm 3 plan), each cut into the land as it lies:
//
//   the sea cave    in the north cliffs, its mouth at the water's foot, a shingle ledge along the cliff's foot
//                   to it from the strand. Half flooded: the shingle wades in, a dry shelf up its south-west side
//                   where Jetsam the castaway lives (his fire, his bed of kelp, the days scratched on the wall),
//                   deep water up its middle that a diver follows to the back, where the crew keep their cache
//                   on a ledge only the water reaches. Glowing weed on its walls, crystals by the old man's fire.
//   the grotto      a mouth in the trench's north wall below the reef, south of the coral gardens: only a diver
//                   finds it (no path, nothing marks it). Anemones glow inside; a drowned diver's chest at the back.
//   the blowhole    on a point of rock on the strand's north-east shore, on the way to the cave: when the swell
//                   comes it spouts (src/game/story/seacaves.ts), and tosses whoever stands in it.
//
// Both caves run in toward the north-west, straight away from the camera, so that with their roofs lifted (the
// roofs are a structure's shell: they fade while the knight is inside) the whole of each shows. Their walls are
// the land itself. The sea cave reaches out under the cliffs beyond the map's edge, so it is cut once the
// outskirts are painted (afterOutskirts).
// ---------------------------------------------------------------------------

const R2 = Math.SQRT1_2;
type Frame = { x: number; z: number };
/** A spot in a cave's own frame: u metres in from its mouth, v across it (+ toward the north-east). */
const caveAt = (o: Frame, u: number, v: number): Pt => [o.x - (u - v) * R2, o.z - (u + v) * R2];
const caveUV = (o: Frame, x: number, z: number) => ({ u: (o.x - x + o.z - z) * R2, v: (x - o.x - (z - o.z)) * R2 });

/** The sea cave: where its middle meets the cliff's face (z = 0), how far in it runs, its ceiling. (Clear of the
 *  stretch of cliff top that the realm's edge dressing covers, x 73 to 112.) */
export const SEA_CAVE = { x: 125, z: 0, len: 14.2, ceil: 4.2 };
/** The shingle ledge along the cliff's foot, from the strand's shallows to the cave's mouth. */
const LEDGE = { x0: 103.5, z1: 2.6 };
/** The grotto: where its middle meets the trench's north wall, its floors stepping up from the trench's. */
export const GROTTO = { x: 80.5, z: 104.6 };
/** The blowhole, at the seaward end of its point of rock (the rock's middle a little inland). */
export const BLOWHOLE = { x: 86.1, z: 9.3 };
const POINT = { x: 84.4, z: 8.2, r: 3.3 };

/** Jetsam's place on his shelf, his fire, and the crew's cache. */
const HERMIT_AT = caveAt(SEA_CAVE, 9, -2.55);
const FIRE_AT = caveAt(SEA_CAVE, 8.1, -1.45);
const CACHE_CHEST = caveAt(SEA_CAVE, 10.2, 2.6);
const GROTTO_CHEST = caveAt(GROTTO, 6.4, 0.5);

type Zone = 'wade' | 'shelf' | 'channel' | 'step' | 'cache';

/** Which part of the sea cave a spot is in (null: not the cave). The shelf up its south-west side (wading shingle at
 *  the mouth), the cache's ledge at the back of its north-east side (a step down to the water before it), the deep
 *  channel between them and round the back, wide enough everywhere that no knight jumps it. */
function seaCaveZone(u: number, v: number, n: number): Zone | null {
  // (Its mouth is cut back on the slant to the cliff's face, so that no corner of the cliff stands in front of it.)
  if (u < -6 || u > SEA_CAVE.len) return null;
  // As wide at the mouth as at the back: from anywhere inside, the way out toward the camera is clear.
  let sw = 3.5, ne = 3.7;
  if (u > 11.6) {
    const e = Math.sqrt(Math.max(0, 1 - ((u - 11.6) / 2.6) ** 2));
    sw *= e;
    ne *= e;
  }
  if (v < -sw - n || v > ne + n) return null;
  if (v < -0.7) return u < 2.2 ? 'wade' : 'shelf';
  if (v > 1.2 && u >= 6.4 && u <= 12.4) return v < 1.8 ? 'step' : 'cache';
  return 'channel';
}
const SEA_CAVE_FLOOR = (z: Zone, u: number) => (z === 'wade' || z === 'step' ? -0.3 : z === 'shelf' ? (u < 6.2 ? 0.5 : 0.9) : z === 'cache' ? 0.4 : u < 3.5 ? -1.5 : -1.9);

/** The grotto's floor at u (null: not the grotto): steps up from the trench's floor, a chamber at the back. In front
 *  of its mouth (u below 0) the trench's wall is notched down to the first step, open above, so that nothing of the
 *  wall stands between the grotto and the camera. */
function grottoFloor(u: number, v: number, n: number) {
  if (u < -3 || u > 8.7) return null;
  let w = u < 3 ? 2.2 : 2.9;
  if (u > 6.5) w *= Math.sqrt(Math.max(0, 1 - ((u - 6.5) / 2.2) ** 2));
  if (Math.abs(v) > w + n) return null;
  return u < 1.2 ? -10.8 : u < 2.6 ? -9.6 : -8.4;
}
const grottoCeil = (u: number) => (u < 1.6 ? -6.4 : -5.2);

/** Top colours of the land a roof stands in for (the terrain's own, see terrain.ts). */
const TOP: Record<number, string> = { [T.Rock]: '#6a6670', [T.DarkGrass]: '#3d6334', [T.Sand]: '#a69a78', [T.Seagrass]: '#6a7356', [T.Coral]: '#a8786c', [T.Silt]: '#46525a', [T.Gravel]: '#6f6a64' };
const CLIFF = '#5d5966';
/** The glowing weed on the walls, the crystals, the anemones' light. */
const WEED: [number, number, number] = [0.3, 1.6, 1.15];
const CRYSTAL: [number, number, number] = [0.7, 1.6, 2.6];

// ---------- props ----------

/** A roof over cut-away land: a column of rock for each cell, from the ceiling up to where the land stood, topped as
 *  it was; stone teeth hanging from it here and there. In the structure's shell (it lifts while the knight is in). */
function roof(b: Builder, s: Structure, cells: { x: number; z: number; ceil: number; top: number; t: number }[], r: () => number, teeth: number) {
  for (const c of cells) {
    s.shell.box(c.x + 0.5, c.ceil, c.z + 0.5, 1.02, c.top - c.ceil, 1.02, CLIFF, { kind: K.Rock, top: TOP[c.t] ?? TOP[T.Rock] });
    if (r() < teeth) {
      const tx = c.x + 0.25 + r() * 0.5, tz = c.z + 0.25 + r() * 0.5;
      s.shell.cyl(tx, c.ceil + 0.02, tz, 0.12 + r() * 0.12, 0, -(0.4 + r() * 0.8), 5, r() < 0.5 ? PAL.rockDark : CLIFF, { kind: K.Rock });
    }
  }
  void b;
}

/** A patch of glowing weed on a wall: a few soft blobs flat against it. (nx, nz) is the wall's face, into the cave. */
function weed(b: Builder, x: number, y: number, z: number, nx: number, nz: number, r: () => number, col = WEED, into?: Geo) {
  const gl = into ?? b.gl(x, z);
  for (let k = 0, n = 2 + Math.floor(r() * 4); k < n; k++) {
    const a = (r() - 0.5) * 0.9, h = (r() - 0.5) * 0.7, s = 0.07 + r() * 0.12;
    gl.blob(x - nz * a + nx * 0.03, y + h, z + nx * a + nz * 0.03, s * (nx ? 0.35 : 1), s, s * (nz ? 0.35 : 1), col, Math.floor(r() * 999), { detail: 0, jitter: 0.2 });
  }
}

/** A cluster of crystals growing out of the rock, glowing cold blue. */
function crystals(b: Builder, x: number, z: number, r: () => number, n = 4) {
  const gl = b.gl(x, z), y = b.y(x, z);
  for (let k = 0; k < n; k++) {
    const lean = (r() - 0.5) * 0.8;
    gl.push().translate(x + (r() - 0.5) * 0.5, y - 0.05, z + (r() - 0.5) * 0.5).rotateZ(lean).rotateX(lean * 0.7);
    gl.cyl(0, 0, 0, 0.07 + r() * 0.06, 0, 0.35 + r() * 0.6, 5, CRYSTAL, {});
    gl.pop();
  }
}

/** Jetsam's hearth: a ring of beach stones, driftwood burning low, a pot on a hook. */
function hearth(b: Builder, x: number, z: number) {
  const g = b.g(x, z), gl = b.gl(x, z), y = b.y(x, z);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    g.blob(x + Math.cos(a) * 0.42, y + 0.05, z + Math.sin(a) * 0.42, 0.13, 0.1, 0.12, k % 2 ? SHORE.rock : SHORE.rockDark, 400 + k, { kind: K.Rock, flatBottom: true });
  }
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.3;
    g.beam([x + Math.cos(a) * 0.3, y + 0.04, z + Math.sin(a) * 0.3], [x - Math.cos(a) * 0.05, y + 0.25, z - Math.sin(a) * 0.05], 0.05, SHORE.driftDark, { kind: K.Bark });
  }
  gl.box(x, y + 0.02, z, 0.32, 0.05, 0.32, [2.5, 0.8, 0.2]);
  // A crooked driftwood hook over it, a pot hanging.
  g.sweep([[x + 0.55, y - 0.05, z + 0.2], [x + 0.5, y + 0.8, z + 0.12], [x + 0.2, y + 1.05, z + 0.02], [x + 0.02, y + 0.95, z]], [0.05, 0.045, 0.035, 0.025], SHORE.drift, { kind: K.Bark, seg: 5, lumpy: 0.2, seed: 41 });
  g.beam([x, y + 0.95, z], [x, y + 0.6, z], 0.01, '#3a3028');
  g.cyl(x, y + 0.38, z, 0.16, 0.14, 0.22, 8, '#2e2c30', { kind: K.Metal });
  b.fx.addEmitter({ x, y: y + 0.15, z, rate: 16, spec: { color: [4.5, 2.2, 0.6], color2: [1.4, 0.25, 0.05], size: 1, size2: 1, life: 0.4, gravity: -2.2, drag: 2, fadeIn: 0.05 }, spread: 0.2, vy: 0.8 });
  b.fx.addEmitter({ x, y: y + 0.9, z, rate: 1, spec: { color: [0.09, 0.09, 0.12], color2: [0.05, 0.05, 0.07], size: 2, size2: 6, life: 3.5, gravity: -0.35, drag: 0.4, wobble: 0.35, alpha: 0.3, fadeIn: 0.2 }, spread: 0.2, vy: 0.4 });
  b.lights.add(x, y + 0.9, z, 0xff8a40, 7, 7, 0.3);
  b.fires.push({ x, y: y + 0.2, z, big: false });
  b.collide({ kind: 'c', x, z, r: 0.5, y0: y - 1, y1: y + 0.5 });
}

/** Jetsam's bed: dried kelp heaped under an old sail, a driftwood frame over it hung with more sail against the
 *  wall's drips. rot is the bed's length (toward its head). */
function castawayBed(b: Builder, x: number, z: number, rot: number) {
  const g = b.g(x, z), y = b.y(x, z), c = Math.cos(rot), s = Math.sin(rot);
  g.push().translate(x, y, z).rotateY(-rot);
  g.blob(0, 0.05, 0, 1.0, 0.18, 0.5, SHORE.wrack, 51, { kind: K.Leaves, flatBottom: true, jitter: 0.3 });
  g.box(-0.1, 0.16, 0, 1.5, 0.08, 0.85, SHORE.sail, { kind: K.Cloth });
  g.box(0.75, 0.16, 0, 0.3, 0.16, 0.5, SHORE.sailPatch, { kind: K.Cloth });
  g.pop();
  // The frame: two crooked poles leaning on the wall behind, a third across, sail over it.
  const back = (k: number): [number, number, number] => [x - s * 0.9 + c * k, y + 1.5, z + c * 0.9 + s * k];
  for (const k of [-0.75, 0.75]) g.sweep([[x + s * 0.55 + c * k, y - 0.05, z - c * 0.55 + s * k], [x + c * k, y + 0.9, z + s * k], back(k)], [0.045, 0.04, 0.035], SHORE.drift, { kind: K.Bark, seg: 4, lumpy: 0.2, seed: 60 + k * 10 });
  const [ax, ay, az] = back(-0.75), [bx, by, bz] = back(0.75);
  g.beam([ax, ay, az], [bx, by, bz], 0.04, SHORE.driftDark, { kind: K.Bark });
  g.quad([ax, ay, az], [bx, by, bz], [bx + s * 1.1, by - 0.75, bz - c * 1.1], [ax + s * 1.1, ay - 0.75, az - c * 1.1], SHORE.sailPatch, { kind: K.Cloth, wind: 0.2 });
  g.quad([ax + s * 1.1, ay - 0.75, az - c * 1.1], [bx + s * 1.1, by - 0.75, bz - c * 1.1], [bx, by, bz], [ax, ay, az], SHORE.sailPatch, { kind: K.Cloth, wind: 0.2 });
  b.collide({ kind: 'c', x, z, r: 0.6, y0: y - 1, y1: y + 0.4 });
}

/** A jar of the glowing weed: the castaway's lamp. */
function weedJar(b: Builder, x: number, y: number, z: number) {
  const g = b.g(x, z), gl = b.gl(x, z);
  g.cyl(x, y, z, 0.1, 0.12, 0.05, 8, '#5a6a68', { kind: K.Metal });
  gl.cyl(x, y + 0.05, z, 0.11, 0.09, 0.2, 8, [0.45, 1.9, 1.4], {});
  g.cyl(x, y + 0.25, z, 0.07, 0.07, 0.04, 8, '#6a4a30', { kind: K.Wood });
}

/** A line of fish drying between two driftwood stakes. */
function fishLine(b: Builder, a: Pt, c: Pt) {
  const g = b.g(a[0], a[1]), ya = b.y(a[0], a[1]), yc = b.y(c[0], c[1]);
  g.beam([a[0], ya - 0.1, a[1]], [a[0], ya + 1.35, a[1]], 0.045, SHORE.drift, { kind: K.Bark });
  g.beam([c[0], yc - 0.1, c[1]], [c[0], yc + 1.35, c[1]], 0.045, SHORE.drift, { kind: K.Bark });
  g.beam([a[0], ya + 1.3, a[1]], [c[0], yc + 1.3, c[1]], 0.01, '#8a7a5a');
  for (let k = 1; k < 6; k++) {
    const t = k / 6, x = a[0] + (c[0] - a[0]) * t, z = a[1] + (c[1] - a[1]) * t, y = ya + (yc - ya) * t + 1.27 - Math.sin(t * Math.PI) * 0.08;
    g.box(x - 0.04, y - 0.32, z - 0.02, 0.08, 0.3, 0.04, k % 2 ? '#8a8a7a' : '#9a8a6a', { wind: 0.4 });
    g.box(x - 0.06, y - 0.38, z - 0.02, 0.12, 0.07, 0.03, '#7a7a6a', { wind: 0.5 });
  }
  b.collide({ kind: 'c', x: a[0], z: a[1], r: 0.15, y0: ya - 1, y1: ya + 1.3 });
  b.collide({ kind: 'c', x: c[0], z: c[1], r: 0.15, y0: yc - 1, y1: yc + 1.3 });
}

/** The crew's things heaped on the cache's ledge: crates and kegs under a tarred sail, a coil of rope, a dark
 *  lantern, the crew's rag of a flag on a boathook. */
function crewCache(b: Builder, r: () => number) {
  const at = (u: number, v: number) => caveAt(SEA_CAVE, u, v);
  for (const [u, v, s] of [[7.6, 3.0, 0.7], [8.5, 3.2, 0.55], [8.1, 2.3, 0.5], [11.4, 2.7, 0.55]] as const) {
    const [x, z] = at(u, v);
    b.crate(x, z, s);
  }
  for (const [u, v] of [[9.2, 3.1], [11.9, 2.1]] as const) {
    const [x, z] = at(u, v);
    b.barrel(x, z);
  }
  // The tarred sail thrown over two of the crates.
  const [tx, tz] = at(8.0, 3.0), ty = b.y(tx, tz), g = b.g(tx, tz);
  g.push().translate(tx, ty, tz).rotateY(Math.PI / 4);
  g.box(0, 0.78, 0, 1.3, 0.05, 1.2, '#3a3428', { kind: K.Cloth });
  g.box(-0.62, 0.2, 0, 0.05, 0.6, 1.2, '#3a3428', { kind: K.Cloth, wind: 0.2 });
  g.pop();
  // Rope, lantern, the crew's flag on a boathook stuck in a crack.
  const [rx, rz] = at(9.5, 2.2), ry = b.y(rx, rz), d = b.d(rx, rz);
  for (let k = 0; k < 3; k++) d.cyl(rx, ry + k * 0.05, rz, 0.28 - k * 0.04, 0.28 - k * 0.04, 0.05, 10, '#8a7a5a', { cap: k === 2 });
  const [lx, lz] = at(10.9, 3.2), ly = b.y(lx, lz);
  g.cyl(lx, ly, lz, 0.1, 0.1, 0.28, 6, PAL.iron, { kind: K.Metal });
  const [fx, fz] = at(12.1, 2.9), fy = b.y(fx, fz);
  g.beam([fx, fy - 0.1, fz], [fx + 0.15, fy + 2.0, fz - 0.1], 0.03, PAL.woodDark, { kind: K.Wood });
  g.box(fx + 0.2, fy + 1.45, fz - 0.1, 0.5, 0.36, 0.02, '#a03028', { kind: K.Cloth, wind: 1.2 });
  void r;
}

// ---------- the sea cave ----------

/** Cut the sea cave into the north cliffs (once the outskirts are painted), lay the shingle ledge along their foot,
 *  and furnish it. */
function cutSeaCave(grid: Grid, b: Builder) {
  const r = mulberry32(3636);
  const roofCells: { x: number; z: number; ceil: number; top: number; t: number }[] = [];
  const walls: { x: number; z: number; nx: number; nz: number; floor: number }[] = [];
  const zoneAt = (x: number, z: number) => {
    const { u, v } = caveUV(SEA_CAVE, x + 0.5, z + 0.5);
    return { u, v, zone: seaCaveZone(u, v, (fbm(x * 0.4, z * 0.4, 2, 361) - 0.5) * 0.8) };
  };
  let x0 = 999, z0 = 999, x1 = -999, top = 0;
  for (let z = -14; z < 0; z++)
    for (let x = 108; x < 134; x++) {
      const { u, zone } = zoneAt(x, z);
      if (!zone) continue;
      const i = grid.i(x, z), h0 = grid.h[i];
      roofCells.push({ x, z, ceil: SEA_CAVE.ceil, top: Math.max(h0, SEA_CAVE.ceil + 1.5), t: grid.t[i] });
      grid.h[i] = SEA_CAVE_FLOOR(zone, u);
      grid.water[i] = grid.h[i] < 0 ? 0 : NONE;
      grid.t[i] = zone === 'channel' ? T.Silt : zone === 'wade' || zone === 'step' ? T.Gravel : fbm(x * 0.5, z * 0.5, 2, 363) > 0.6 ? T.Gravel : T.Rock;
      grid.noGrass[i] = 1;
      grid.dir[i] = -1;
      x0 = Math.min(x0, x);
      z0 = Math.min(z0, z);
      x1 = Math.max(x1, x + 1);
      top = Math.max(top, h0);
    }
  for (const c of roofCells)
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ox = c.x - nx, oz = c.z - nz;
      if (oz >= 0 || zoneAt(ox, oz).zone) continue;
      walls.push({ x: c.x + 0.5 - nx * 0.5, z: c.z + 0.5 - nz * 0.5, nx, nz, floor: grid.h[grid.i(c.x, c.z)] });
    }
  // The shingle ledge along the cliff's foot: wading-deep, here and there a hump of shingle out of the water, out to
  // where the cave's channel comes out.
  const p = new Painter(grid);
  p.each((x, z, i) => {
    const cx = x + 0.5, cz = z + 0.5, { v } = caveUV(SEA_CAVE, cx, cz);
    if (cz > LEDGE.z1 + (fbm(x * 0.3, z * 0.3, 2, 365) - 0.3) * 2 || v > -0.9 || grid.h[i] > 0.15) return;
    grid.h[i] = fbm(x * 0.4 + 3, z * 0.4, 2, 367) > 0.62 && v < -2.5 ? 0.1 : -0.3;
    grid.water[i] = grid.h[i] < 0 ? 0 : NONE;
    grid.t[i] = T.Gravel;
    grid.noGrass[i] = 1;
  }, LEDGE.x0, 0, SEA_CAVE.x + 4, 5);

  // The roof, lifting while the knight is inside (and the cave's front over its mouth, hung with weed).
  const s = b.structure('seacave', new THREE.Box3(new THREE.Vector3(x0, SEA_CAVE.ceil - 1.3, z0), new THREE.Vector3(x1, top + 0.5, 0)), [x0, z0, x1, -0.2], -1.5);
  roof(b, s, roofCells, r, 0.22);
  for (const c of roofCells) {
    if (c.z !== -1) continue;
    for (let k = 0; k < 3; k++) {
      const wx = c.x + r(), L = 0.4 + r() * 0.9;
      s.shell.box(wx, SEA_CAVE.ceil - L, -0.02, 0.06, L, 0.03, r() < 0.5 ? SHORE.wrack : SHORE.wrack2, { kind: K.Leaves, wind: 0.5 });
    }
    if (r() < 0.5) s.shell.blob(c.x + r(), SEA_CAVE.ceil + 0.1, -0.1, 0.4, 0.3, 0.3, CLIFF, Math.floor(r() * 999), { kind: K.Rock, jitter: 0.3 });
  }

  // Round the mouth, on the cliff's face outside and up the roof's front, weed glowing in a ragged ring, and boulders
  // fallen at its sides: the cave shows from along the shore. (What is on the roof's front lifts with it.)
  const mouthX0 = Math.min(...roofCells.filter((c) => c.z === -1).map((c) => c.x)), mouthX1 = Math.max(...roofCells.filter((c) => c.z === -1).map((c) => c.x)) + 1;
  for (const c of roofCells) if (c.z === -1) for (let k = 0; k < 3; k++) if (r() < 0.6) weed(b, c.x + r(), SEA_CAVE.ceil + 0.3 + r() * 1.8, 0, 0, 1, r, r() < 0.3 ? SEA.glowCyan : WEED, s.shellGlow);
  for (let x = mouthX0 - 4; x < mouthX1 + 4; x++) {
    if (x >= mouthX0 && x < mouthX1) continue;
    const near = 1 - Math.min(Math.abs(x + 0.5 - mouthX0), Math.abs(x + 0.5 - mouthX1)) / 4.5;
    for (let k = 0; k < 3; k++) if (r() < near) weed(b, x + r(), 0.5 + r() * (1 + near * 4), 0, 0, 1, r, r() < 0.3 ? SEA.glowCyan : WEED);
  }
  for (const [x, z, sc] of [[mouthX0 - 0.7, 0.5, 1.2], [mouthX0 - 1.8, 0.4, 0.8], [mouthX1 + 0.6, 0.6, 1.3], [mouthX1 + 1.7, 1.1, 0.7]] as const) seaRock(b, x, z, sc);
  const [mx, mz] = caveAt(SEA_CAVE, 1.2, -1.2);
  b.lights.add(mx, 1.6, mz, 0x50e0c0, 4, 7, 0.12);

  // The walls: weed glowing in stretches along the water line and up the rock; crystals by the castaway's fire.
  const glowAt = (x: number, z: number) => fbm(x * 0.35, z * 0.35, 2, 369);
  for (const w of walls) {
    if (glowAt(w.x, w.z) < 0.42) continue;
    const base = Math.max(w.floor, 0) + 0.25;
    for (let k = 0, n = 1 + Math.floor(r() * 3); k < n; k++) weed(b, w.x, base + r() * (SEA_CAVE.ceil - base - 0.6), w.z, w.nx, w.nz, r, r() < 0.3 ? SEA.glowCyan : WEED);
  }
  for (const [u, v, n] of [[6.6, -3.1, 5], [11.8, -2.4, 4], [12.9, -0.9, 3], [7.2, 3.4, 3]] as const) crystals(b, ...caveAt(SEA_CAVE, u, v), r, n);
  for (const [u, v, c, i] of [[4.5, 0.5, 0x50e0c0, 3], [11.5, 0.6, 0x50e0c0, 3], [12.2, -2, 0x7ab0ff, 2.5], [9.5, 3.4, 0x60c8e8, 2.5]] as const) {
    const [x, z] = caveAt(SEA_CAVE, u, v);
    b.lights.add(x, 1.8, z, c, i, 6, 0.12);
  }

  // Jetsam's shelf: his hearth and bed, a crate for a table with a jar of weed on it, fish drying, his tally of days.
  const at = (u: number, v: number) => caveAt(SEA_CAVE, u, v);
  hearth(b, ...FIRE_AT);
  castawayBed(b, ...at(11, -2.4), Math.PI * 0.75);
  {
    const [x, z] = at(7, -2.6);
    b.crate(x, z, 0.6);
    weedJar(b, x, b.y(x, z) + 0.6, z);
    const [jx, jz] = at(12.6, -1.6);
    weedJar(b, jx, b.y(jx, jz), jz);
  }
  fishLine(b, at(4.2, -2.7), at(5.9, -2.3));
  for (let k = 0; k < 8; k++) {
    const [x, z] = at(5 + r() * 7, -1.2 - r() * 1.6), d = b.d(x, z);
    d.blob(x, b.y(x, z) + 0.01, z, 0.08, 0.04, 0.06, r() < 0.6 ? SHORE.shell : SHORE.shellPink, Math.floor(r() * 999), { flatBottom: true });
  }
  driftwood(b, ...at(3.2, -2.4), 1.9, Math.PI * 0.25 + 0.3);
  {
    // The tally: strokes scratched into the wall behind his seat, in fives.
    const [x, z] = at(9.4, -3.9), y = b.y(x, z) + 1.1, d = b.d(x, z);
    for (let k = 0; k < 14; k++) {
      const a = (k - 7) * 0.13;
      d.box(x + a * R2, y + (k % 2) * 0.05, z - a * R2 + 0.05, 0.03, k % 5 === 4 ? 0.06 : 0.32, 0.03, '#2a2630');
    }
  }
  // A rod leaning by the water, a pail.
  {
    const [x, z] = at(4, -1.1), y = b.y(x, z), g = b.g(x, z);
    g.beam([x, y, z], [x + 1.4, y + 1.8, z - 0.6], 0.02, PAL.woodLight, { kind: K.Wood });
    g.cyl(x - 0.4, y, z + 0.3, 0.16, 0.18, 0.28, 8, '#6a5a48', { kind: K.Wood });
  }
  crewCache(b, r);
  // Rocks fallen along the shingle ledge, and weed on them.
  for (const [x, z, sc] of [[106.5, 2.8, 0.6], [110.2, 0.6, 0.5], [113.6, 2.9, 0.45], [117.4, 0.5, 0.55]] as const) seaRock(b, x, z, sc);
}

// ---------- the grotto ----------

/** Cut the grotto into the trench's north wall and dress it. */
function cutGrotto(grid: Grid, b: Builder) {
  const r = mulberry32(3737);
  const roofCells: { x: number; z: number; ceil: number; top: number; t: number }[] = [];
  const carved = new Set<number>();
  let x0 = 999, z0 = 999, x1 = -999, z1 = -999;
  for (let z = 94; z < 108; z++)
    for (let x = 70; x < 88; x++) {
      const { u, v } = caveUV(GROTTO, x + 0.5, z + 0.5), f = grottoFloor(u, v, (fbm(x * 0.45, z * 0.45, 2, 371) - 0.5) * 0.9);
      if (f === null) continue;
      const i = grid.i(x, z), h0 = grid.h[i];
      if (h0 <= f) continue;
      const ceil = grottoCeil(u);
      if (h0 > ceil && u >= -0.2) roofCells.push({ x, z, ceil, top: h0, t: grid.t[i] });
      grid.h[i] = f;
      carved.add(i);
      grid.t[i] = fbm(x * 0.6, z * 0.6, 2, 373) > 0.6 ? T.Gravel : T.Silt;
      grid.noGrass[i] = 1;
      x0 = Math.min(x0, x);
      z0 = Math.min(z0, z);
      x1 = Math.max(x1, x + 1);
      z1 = Math.max(z1, z + 1);
    }
  // The roof (it stands in for the reef's floor above, and nothing walks onto it from there).
  const s = b.structure('grotto', new THREE.Box3(new THREE.Vector3(x0, -6.5, z0), new THREE.Vector3(x1, -3.7, z1)), [x0, z0, x1, z1], -10.2);
  roof(b, s, roofCells, r, 0.35);
  for (const c of roofCells) b.collide({ kind: 'b', x0: c.x, z0: c.z, x1: c.x + 1, z1: c.z + 1, y0: c.ceil, y1: 50 });
  // Over its mouth, weed hanging down the trench wall; kelp either side.
  for (const c of roofCells) {
    const { u } = caveUV(GROTTO, c.x + 0.5, c.z + 0.5);
    if (u > 1.6) continue;
    for (let k = 0; k < 2; k++) s.shell.box(c.x + r(), c.ceil - 0.6, c.z + 0.6 + r() * 0.4, 0.05, 0.6 + r() * 0.5, 0.03, r() < 0.5 ? SEA.kelp : SEA.kelpDark, { kind: K.Leaves, wind: 3 });
  }
  // Inside: anemones glowing over the floor and the steps, coral, a giant clam's empty shell, the drowned diver who
  // hid his chest here and never came up (his bones, his brass helmet).
  const at = (u: number, v: number) => caveAt(GROTTO, u, v);
  for (const [u, v, sc, pink] of [[1.6, -1.4, 0.8, 0], [2.2, 1.5, 0.7, 1], [3.4, -2.1, 0.9, 1], [4.1, 2.3, 0.8, 0], [5.2, -1.9, 0.7, 0], [6.9, 1.9, 0.75, 1], [7.6, -0.9, 0.85, 0], [5.6, 2.5, 0.6, 1], [3.1, 0.9, 0.55, 0], [0.6, 1.9, 0.7, 1]] as const) {
    const [x, z] = at(u, v);
    anemone(b, x, z, sc, pink ? SEA.coralPink : SEA.coralTeal, pink ? SEA.glowPink : SEA.glowCyan);
  }
  branchCoral(b, ...at(4.6, -2.4), 0.8, SEA.coralOrange);
  seaFan(b, ...at(7.2, 1.2), 0.75, 0.6, SEA.coralPurple);
  brainCoral(b, ...at(3.8, 2.4), 0.5, SEA.coralYellow);
  {
    const [x, z] = at(5.6, -0.2), y = b.y(x, z);
    D.bones(b, x, z, 5, true);
    const g = b.g(x, z);
    g.blob(x + 0.45, y + 0.2, z - 0.2, 0.22, 0.22, 0.22, '#a8783a', 91, { kind: K.Metal, flatBottom: true, detail: 1 });
    b.gl(x, z).cyl(x + 0.45, y + 0.2, z - 0.01, 0.1, 0.1, 0.03, 8, [0.2, 0.5, 0.6], {});
  }
  // Its walls crusted with glowing weed and little anemones, thickest at the back; light enough to see it from the
  // trench as a mouth that breathes light.
  for (const i of carved) {
    const x = (i % grid.w) + grid.ox, z = Math.floor(i / grid.w) + grid.oz, f = grid.h[i];
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = grid.i(x - nx, z - nz);
      if (carved.has(j) || grid.h[j] < f + 2 || r() < 0.35) continue;
      const wx = x + 0.5 - nx * 0.5, wz = z + 0.5 - nz * 0.5, { u } = caveUV(GROTTO, wx, wz);
      for (let k = 0, n = 1 + Math.floor(r() * (u > 3 ? 4 : 2)); k < n; k++) weed(b, wx, f + 0.4 + r() * 2.4, wz, nx, nz, r, r() < 0.45 ? SEA.glowCyan : r() < 0.5 ? SEA.glowPink : WEED);
    }
  }
  // ...and round its mouth on the trench's wall outside.
  for (let z = Math.floor(GROTTO.z - 6); z < GROTTO.z + 4; z++)
    for (let x = Math.floor(GROTTO.x - 8); x < GROTTO.x + 8; x++) {
      const f = grid.h[grid.i(x, z)], near = 1 - Math.hypot(x + 0.5 - GROTTO.x, z + 0.5 - GROTTO.z) / 6.5;
      if (f > -10.5 || near <= 0) continue;
      for (const [nx, nz] of [[1, 0], [0, 1]]) {
        if (grid.h[grid.i(x - nx, z - nz)] < -6 || r() > near) continue;
        for (let k = 0, n = 1 + Math.floor(r() * 3); k < n; k++) weed(b, x + 0.5 - nx * 0.5, f + 0.6 + r() * 4.5, z + 0.5 - nz * 0.5, nx, nz, r, r() < 0.5 ? SEA.glowCyan : r() < 0.5 ? SEA.glowPink : WEED);
      }
    }
  for (const [u, v, c, k] of [[0.4, 0, 0x50d8e0, 7], [3.4, -0.6, 0x50e0c0, 6], [6.2, 0.4, 0xe070b0, 7]] as const) {
    const [x, z] = at(u, v);
    b.lights.add(x, grid.groundAt(x, z) + 1.8, z, c, k, 8, 0.15);
  }
}

// ---------- the blowhole ----------

/** The point of rock the blowhole is in: a low shelf of the strand's rock out into the shallows, a hole near its end,
 *  a cleft from the sea under it. */
function cutBlowhole(grid: Grid, b: Builder) {
  const r = mulberry32(3838);
  const p = new Painter(grid);
  p.each((x, z, i) => {
    const cx = x + 0.5, cz = z + 0.5, n = (fbm(x * 0.4, z * 0.4, 2, 381) - 0.5) * 1.6;
    // Longer along the shore than across it, reaching out toward the hole.
    const d = Math.hypot((cx - POINT.x) * 0.8, (cz - POINT.z) * 1.05) + n;
    if (d > POINT.r) return;
    grid.h[i] = d < POINT.r * 0.55 ? 0.8 : 0.5;
    grid.water[i] = NONE;
    grid.t[i] = T.Rock;
    grid.noGrass[i] = 1;
    grid.dir[i] = -1;
  }, POINT.x - 6, POINT.z - 6, POINT.x + 6, POINT.z + 6);
  const y = grid.groundAt(BLOWHOLE.x, BLOWHOLE.z), g = b.g(BLOWHOLE.x, BLOWHOLE.z), d = b.d(BLOWHOLE.x, BLOWHOLE.z);
  // The hole: a dark throat ringed with wet black rock, barnacles round its lip.
  g.cyl(BLOWHOLE.x, y - 0.02, BLOWHOLE.z, 0.42, 0.42, 0.03, 10, '#0c1216');
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + r() * 0.3;
    g.blob(BLOWHOLE.x + Math.cos(a) * 0.55, y + 0.04, BLOWHOLE.z + Math.sin(a) * 0.55, 0.22, 0.12, 0.18, k % 2 ? '#3a3a42' : SHORE.rockDark, Math.floor(r() * 999), { kind: K.Rock, flatBottom: true });
    if (k % 2) d.cyl(BLOWHOLE.x + Math.cos(a) * 0.72, y + 0.05, BLOWHOLE.z + Math.sin(a) * 0.72, 0.05, 0.03, 0.06, 6, SEA.barnacle);
  }
  // Boulders on the point (its landward side), wet weed down its seaward edge, rock pools.
  for (const [dx, dz, sc] of [[-2.6, -1.4, 0.8], [-1.6, 1.6, 0.6], [0.4, -2.3, 0.55], [-3.2, 0.6, 0.45]] as const) b.rock(POINT.x + dx, POINT.z + dz, sc);
  for (let k = 0; k < 10; k++) {
    const a = -0.9 + r() * 2.6, rr = POINT.r * (0.95 + r() * 0.2), x = POINT.x + Math.cos(a) * rr / 0.8, z = POINT.z + Math.sin(a) * rr / 1.05;
    d.blob(x, grid.groundAt(x, z) + 0.02, z, 0.3, 0.08, 0.22, r() < 0.5 ? SHORE.wrack : SHORE.wrack2, Math.floor(r() * 999), { kind: K.Leaves, flatBottom: true, jitter: 0.3 });
  }
  for (const [dx, dz] of [[-0.9, -0.6], [0.6, 1.4]] as const) {
    const x = POINT.x + dx, z = POINT.z + dz;
    d.cyl(x, grid.groundAt(x, z) + 0.005, z, 0.38, 0.38, 0.02, 9, '#2a4a5a');
  }
}

/** The way from the sandbar's path along the north-east shore to the cave: a trail through the dunes, past the
 *  blowhole's point; along the cliff's foot the old man's jars of weed on stakes show the way through the water. */
function trail(grid: Grid, b: Builder) {
  const p = new Painter(grid);
  p.path([[51, 27.5], [56, 23.5], [63, 18], [71, 12.4], [78.5, 7.4], [82.4, 5.2], [90, 2.3], [100, 1.5]], 1.4, T.Path, 0.4, 37, false);
  for (const x of [104, 109.5, 115, 119.6]) {
    const z = 2.6, y = grid.groundAt(x, z), g = b.g(x, z);
    g.beam([x, y - 0.3, z], [x + 0.05, y + 1.5, z], 0.05, SHORE.drift, { kind: K.Bark });
    weedJar(b, x + 0.05, y + 1.5, z);
    b.lights.add(x, y + 1.7, z, 0x60e0b0, 1.5, 4, 0.15);
  }
}

// ---------- the people and the data ----------

/** Jetsam the castaway, by his fire. (His talk, his hints and his trade: src/game/story/seacaves.ts.) */
function castaway(): NpcDef {
  return {
    id: 'jetsam', look: 'reefhermit', name: 'Jetsam the Castaway', x: HERMIT_AT[0], z: HERMIT_AT[1], pose: 'sit', heading: Math.atan2(FIRE_AT[0] - HERMIT_AT[0], FIRE_AT[1] - HERMIT_AT[1]), lines: [
      'A visitor. In thirty years, a visitor who is not a goblin. Sit, if you like. The rock is dry, mostly.',
      'The sea threw me in here off a ship that never came back for me. I stayed. Nobody asks me for anything.',
      'The crew row in at low water and dive to the back of the cave. What they bring, they leave past the deep water. I leave it be, and they leave me be.',
    ],
  };
}

/** Everything of group 36's on the Sunken Reef: the grotto and the blowhole now, the sea cave once the outskirts are
 *  painted (`afterOutskirts`), and the data the realm hands the game. `under` says whether a spot is under the sea. */
export function buildSeaCaves(b: Builder, grid: Grid, under: (x: number, z: number) => boolean) {
  const keep = b.rng;
  b.rng = mulberry32(3535);
  cutGrotto(grid, b);
  cutBlowhole(grid, b);
  trail(grid, b);
  b.rng = keep;
  const inSeaCave = (x: number, z: number) => z < 0 && z > -15 && x > 106 && x < 134 && !!seaCaveZone(caveUV(SEA_CAVE, x, z).u, caveUV(SEA_CAVE, x, z).v, 0.6);
  const inGrotto = (x: number, z: number) => {
    const { u, v } = caveUV(GROTTO, x, z);
    return grottoFloor(u, v, 0.4) !== null && grid.groundAt(x, z) > -11;
  };
  const enemies: EnemySpawn[] = [
    // The cache's watchman, a crew diver in the channel.
    { type: 'diver', x: caveAt(SEA_CAVE, 7.6, 0.5)[0], z: caveAt(SEA_CAVE, 7.6, 0.5)[1] },
  ];
  const objects: ObjDef[] = [
    // The crew's cache (tucked away, a diver's: 55), the drowned diver's chest in the grotto (hidden as a Moon Shard:
    // 90 and the bubble).
    { kind: 'chest', id: 'r3_seacache', x: CACHE_CHEST[0], z: CACHE_CHEST[1], rot: Math.PI * 1.25, coins: 55 },
    { kind: 'chest', id: 'r3_grotto', x: GROTTO_CHEST[0], z: GROTTO_CHEST[1], rot: Math.PI * 0.25, coins: 90, power: 'bubble' },
    { kind: 'lore', id: 'r3lore_cache', x: caveAt(SEA_CAVE, 7.0, 2.2)[0], z: caveAt(SEA_CAVE, 7.0, 2.2)[1], text: 'Chalked on a crate, in a goblin hand: NOT FOR THE TIDELORD. NOT FOR BRASSBELLY. OURS. And under it, smaller: the old man in the cave is harmless. Leave him his fish.' },
    { kind: 'lore', id: 'r3lore_grotto', x: caveAt(GROTTO, 4.6, 1.2)[0], z: caveAt(GROTTO, 4.6, 1.2)[1], text: 'Scratched on the diver\'s brass helmet: the reef keeps what it loves. I loved it more. Take the chest, whoever you are, and breathe for me.' },
    { kind: 'breakable', x: caveAt(SEA_CAVE, 12.5, 2.4)[0], z: caveAt(SEA_CAVE, 12.5, 2.4)[1], what: 'barrel' },
    { kind: 'breakable', x: caveAt(SEA_CAVE, 6.9, 2.9)[0], z: caveAt(SEA_CAVE, 6.9, 2.9)[1], what: 'crate' },
  ];
  const regions: RegionDef[] = [
    { name: 'The Castaway\'s Cave', music: 'wilds', amb: 'indoor', test: (x, z) => inSeaCave(x, z) },
    { name: 'The Glowing Grotto', music: 'hall', amb: 'fields', test: (x, z) => inGrotto(x, z) && under(x, z) },
  ];
  return {
    enemies, objects, regions, npcs: [castaway()],
    afterOutskirts: (g: Grid, bb: Builder) => {
      const k = bb.rng;
      bb.rng = mulberry32(3636);
      cutSeaCave(g, bb);
      bb.rng = k;
    },
  };
}
