import * as THREE from 'three';
import { K } from '../engine/materials';
import { P, type PSpec } from '../engine/particles';
import type { Col, Geo } from '../engine/geo';
import { Builder, GLOW, PAL, type Structure } from './builder';
import { NONE, T, type Grid } from './grid';
import type { Pt } from './paint';

// Small set dressing: the details that make a place feel lived in (or died in).
// Everything is sized to read at 18 render pixels per metre: shape, colour and
// light first, trinkets never.

const MOSS = '#4a5e3a';
const BONE = '#8e887a';
const CHAR = '#241e1a';
const CANDLE: [number, number, number] = [4.2, 2.6, 1.0];
/** Faces the fixed camera never sees; skipped on tiny props. */
const BACK = { skip: { nx: true, nz: true } };
const EMBER: [number, number, number] = [2.2, 0.55, 0.1];
/** Pale smoke that still reads against the night (dark smoke vanishes). */
const ASH: PSpec = { color: [0.3, 0.3, 0.34], color2: [0.14, 0.14, 0.17], size: 4, size2: 11, life: 6, gravity: -0.45, drag: 0.4, wobble: 0.4, alpha: 0.45, fadeIn: 0.2, soft: true };

// ---------- the graveyard ----------

export type Stone = 'slab' | 'round' | 'cross' | 'celtic' | 'obelisk' | 'broken' | 'small';

/** A headstone with its grave mound in front (local +z, turned by rot). */
export function headstone(b: Builder, x: number, z: number, kind: Stone, rot = 0, opts: { candles?: boolean; mound?: boolean } = {}) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  const col = r() < 0.6 ? PAL.stone : '#7c7888';
  const o = { kind: K.Rock, shade: 0.95 + r() * 0.3 };
  g.push().translate(x, y, z).rotateY(rot);
  if (opts.mound !== false) g.blob(0, 0, 0.62, 0.32, 0.1, 0.5, '#3a3228', Math.floor(r() * 999), { kind: K.Dirt, flatBottom: true });
  g.rotateY((r() - 0.5) * 0.2).rotateZ(kind === 'broken' ? 0 : (r() - 0.5) * 0.22).rotateX((r() - 0.5) * 0.12);
  let top = 0.8;
  switch (kind) {
    case 'slab':
      g.box(0, -0.1, 0, 0.55, 0.85, 0.14, col, o);
      g.box(0, 0.72, 0, 0.45, 0.08, 0.15, col, o);
      break;
    case 'round':
      g.box(0, -0.1, 0, 0.5, 0.65, 0.14, col, o);
      g.push().translate(0, 0.55, 0).rotateX(Math.PI / 2);
      g.cyl(0, -0.07, 0, 0.25, 0.25, 0.14, 8, col, o);
      g.pop();
      break;
    case 'small':
      g.box(0, -0.1, 0, 0.36, 0.45, 0.12, col, o);
      top = 0.35;
      break;
    case 'cross':
      g.box(0, -0.1, 0, 0.12, 1.1, 0.12, col, o);
      g.box(0, 0.62, 0, 0.52, 0.11, 0.12, col, o);
      top = 1.0;
      break;
    case 'celtic': {
      g.box(0, -0.1, 0, 0.3, 0.3, 0.2, col, o);
      g.box(0, 0.15, 0, 0.13, 1.05, 0.12, col, o);
      g.box(0, 0.8, 0, 0.56, 0.12, 0.12, col, o);
      // The ring round the crossing.
      for (let i = 0; i < 8; i++) {
        const a0 = (i / 8) * Math.PI * 2, a1 = ((i + 1) / 8) * Math.PI * 2, R = 0.2;
        g.beam([Math.cos(a0) * R, 0.86 + Math.sin(a0) * R, 0], [Math.cos(a1) * R, 0.86 + Math.sin(a1) * R, 0], 0.03, col, o);
      }
      top = 1.15;
      break;
    }
    case 'obelisk':
      g.box(0, -0.1, 0, 0.5, 0.3, 0.5, col, o);
      g.cyl(0, 0.2, 0, 0.19, 0.12, 1.15, 4, col, { ...o, rot: Math.PI / 4 });
      g.pyramid(0, 1.35, 0, 0.17, 0.17, 0.18, col, o);
      top = 1.5;
      break;
    case 'broken':
      g.box(0, -0.1, 0, 0.5, 0.42, 0.14, col, o);
      g.box(-0.1, 0.32, 0, 0.3, 0.08, 0.14, col, o);
      top = 0.4;
      break;
  }
  // Moss creeping up the foot of old stones.
  if (r() < 0.55) g.box(0, -0.05, 0.075, 0.3, 0.12 + r() * 0.12, 0.02, MOSS, { kind: K.Grass });
  g.pop();
  if (kind === 'broken') {
    // The snapped-off top lies in the grass beside it.
    g.push().translate(x, y, z).rotateY(rot + 0.6 + r());
    g.box(0.45, 0.0, 0.2, 0.45, 0.12, 0.3, col, o);
    g.pop();
  }
  if (opts.candles) {
    const fx = Math.sin(rot), fz = Math.cos(rot);
    candles(b, x + fx * 0.22, y, z + fz * 0.22, 1 + Math.floor(r() * 3));
  }
  b.collide({ kind: 'c', x, z, r: kind === 'obelisk' ? 0.3 : 0.25, y0: y - 1, y1: y + top });
}

/** Tallow candles left on a grave: glow only (no real light), they read as specks of warmth. */
export function candles(b: Builder, x: number, y: number, z: number, n = 2) {
  const g = b.d(x, z), gl = b.gl(x, z), r = b.rng;
  for (let i = 0; i < n; i++) {
    const cx = x + (r() - 0.5) * 0.3, cz = z + (r() - 0.5) * 0.18, h = 0.1 + r() * 0.12;
    g.box(cx, y, cz, 0.06, h, 0.06, '#d8d0b8');
    gl.box(cx, y + h, cz, 0.06, 0.1, 0.06, CANDLE, { kind: 1 });
  }
}

/** A little iron lantern set on the ground. */
export function groundLantern(b: Builder, x: number, z: number, light = true) {
  const g = b.g(x, z), gl = b.gl(x, z), y = b.y(x, z);
  g.box(x, y, z, 0.24, 0.04, 0.24, PAL.iron, { kind: K.Metal });
  for (const [dx, dz] of [[-0.1, -0.1], [0.1, -0.1], [0.1, 0.1], [-0.1, 0.1]]) g.box(x + dx, y, z + dz, 0.03, 0.3, 0.03, PAL.iron);
  gl.box(x, y + 0.05, z, 0.14, 0.2, 0.14, GLOW.window, { kind: 1 });
  g.pyramid(x, y + 0.3, z, 0.28, 0.28, 0.12, PAL.iron, { kind: K.Metal });
  g.beam([x - 0.06, y + 0.42, z], [x + 0.06, y + 0.42, z], 0.012, PAL.iron);
  if (light) b.lights.add(x, y + 0.45, z, 0xffb060, 3, 4, 0.15);
}

/** A stone coffin above ground; the lid may have been pushed askew. rot: multiples of pi/2. */
export function sarcophagus(b: Builder, x: number, z: number, rot = 0, askew = false) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  g.push().translate(x, y, z).rotateY(rot);
  g.box(0, -0.05, 0, 2.0, 0.22, 0.95, PAL.stoneDark, { kind: K.Brick });
  g.box(0, 0.17, 0, 1.8, 0.5, 0.78, PAL.stone, { kind: K.Rock, shade: 0.9 + r() * 0.15 });
  if (askew) {
    g.box(0, 0.67, 0, 1.6, 0.03, 0.62, '#0a0a10');
    g.push().translate(0.25, 0.67, 0.22).rotateY(0.28).rotateZ(-0.05);
  } else g.push().translate(0, 0.67, 0);
  g.box(0, 0, 0, 1.9, 0.14, 0.88, PAL.stoneDark, { kind: K.Rock });
  // A cross carved in the lid.
  g.box(0, 0.14, 0, 1.2, 0.03, 0.1, PAL.stone);
  g.box(-0.3, 0.14, 0, 0.1, 0.03, 0.5, PAL.stone);
  g.pop();
  g.box(0.5, 0.17, 0.4, 0.5, 0.14, 0.02, MOSS, { kind: K.Grass });
  g.pop();
  const alongX = Math.abs(Math.cos(rot)) > 0.5;
  const hx = alongX ? 1.0 : 0.48, hz = alongX ? 0.48 : 1.0;
  b.collide({ kind: 'b', x0: x - hx, z0: z - hz, x1: x + hx, z1: z + hz, y0: y - 1, y1: y + 0.85 });
}

/** A family plot: knee-high iron railings round a rectangle. */
export function ironRailing(b: Builder, x0: number, z0: number, x1: number, z1: number) {
  const pts: Pt[] = [[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.round(len / 0.28));
    const y = b.y(ax, az), g = b.g(ax, az);
    for (let k = 0; k < n; k++) {
      const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      const corner = k === 0;
      g.box(x, y, z, corner ? 0.08 : 0.035, corner ? 0.75 : 0.62, corner ? 0.08 : 0.035, PAL.iron, { kind: K.Metal });
      if (corner) g.box(x, y + 0.75, z, 0.1, 0.1, 0.1, PAL.iron, { kind: K.Metal });
      else g.pyramid(x, y + 0.62, z, 0.07, 0.07, 0.1, PAL.iron);
    }
    for (const h of [0.18, 0.52]) g.beam([ax, y + h, az], [bx, y + h, bz], 0.02, PAL.iron, { kind: K.Metal });
    b.collide({ kind: 'b', x0: Math.min(ax, bx) - 0.06, z0: Math.min(az, bz) - 0.06, x1: Math.max(ax, bx) + 0.06, z1: Math.max(az, bz) + 0.06, y0: y - 1, y1: y + 0.7 });
  }
}

/** A weeping angel on a plinth, hands folded. Faces local +z. */
export function angelStatue(b: Builder, x: number, z: number, rot = 0) {
  const g = b.g(x, z), y = b.y(x, z);
  const st = PAL.stone, o = { kind: K.Rock };
  g.push().translate(x, y, z).rotateY(rot);
  g.box(0, -0.1, 0, 0.95, 0.55, 0.95, PAL.stoneDark, { kind: K.Brick });
  g.box(0, 0.45, 0, 0.75, 0.15, 0.75, PAL.stoneDark, { kind: K.Brick });
  g.cyl(0, 0.6, 0, 0.3, 0.17, 0.95, 7, st, o);
  g.box(0, 1.5, 0, 0.3, 0.38, 0.2, st, o);
  g.box(0, 1.9, 0.02, 0.19, 0.2, 0.19, st, o);
  // Head bowed, hands together at the chest.
  g.beam([-0.16, 1.82, 0], [-0.03, 1.6, 0.16], 0.04, st, o);
  g.beam([0.16, 1.82, 0], [0.03, 1.6, 0.16], 0.04, st, o);
  // Wings folded behind, tips drooping.
  for (const s of [-1, 1]) {
    g.push().translate(s * 0.12, 1.85, -0.12).rotateY(s * 0.5).rotateZ(s * -0.25);
    g.box(s * 0.12, -1.05, 0, 0.1, 1.15, 0.36, st, o);
    g.pop();
  }
  g.box(0, 0.6, 0.18, 0.25, 0.35, 0.02, MOSS, { kind: K.Grass });
  g.pop();
  b.collide({ kind: 'c', x, z, r: 0.55, y0: y - 1, y1: y + 2.2 });
}

/** A freshly dug grave: a dark hole, the spoil heaped beside it, a spade left standing. */
export function openGrave(b: Builder, x: number, z: number, rot = 0) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  g.push().translate(x, y, z).rotateY(rot);
  g.box(0, 0.005, 0, 0.8, 0.02, 1.55, '#08060a');
  for (const [dx, dz, sx, sz] of [[0, 0.8, 0.95, 0.12], [0, -0.8, 0.95, 0.12], [0.46, 0, 0.12, 1.55], [-0.46, 0, 0.12, 1.55]]) g.box(dx, 0, dz, sx, 0.06, sz, '#4a3a28', { kind: K.Dirt });
  g.blob(0.95, 0.12, 0.1, 0.45, 0.32, 0.75, '#4a3a28', Math.floor(r() * 999), { kind: K.Dirt, flatBottom: true, jitter: 0.3 });
  // The spade, stuck in the heap.
  g.beam([0.95, 0.25, 0.2], [1.05, 1.1, 0.35], 0.025, PAL.woodLight, { kind: K.Wood });
  g.push().translate(0.94, 0.18, 0.19).rotateZ(-0.1);
  g.box(0, 0, 0, 0.2, 0.26, 0.03, '#8a8a94', { kind: K.Metal });
  g.pop();
  g.box(1.06, 1.08, 0.35, 0.14, 0.04, 0.04, PAL.woodDark);
  g.pop();
  bones(b, x - Math.cos(rot) * 0.8, z + Math.sin(rot) * 0.9, 3, true);
  const c = Math.abs(Math.cos(rot)) > 0.5;
  b.collide({ kind: 'b', x0: x - (c ? 0.45 : 0.8), z0: z - (c ? 0.8 : 0.45), x1: x + (c ? 0.45 : 0.8), z1: z + (c ? 0.8 : 0.45), y0: y - 1, y1: y + 0.5 });
  b.collide({ kind: 'c', x: x + Math.cos(rot) * 0.95, z: z - Math.sin(rot) * 0.95, r: 0.45, y0: y - 1, y1: y + 0.45 });
}

/** A few bones in the grass, maybe a skull. */
export function bones(b: Builder, x: number, z: number, n = 3, skull = false) {
  const g = b.d(x, z), y = b.y(x, z), r = b.rng;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI, l = 0.12 + r() * 0.14, bx = x + (r() - 0.5) * 0.9, bz = z + (r() - 0.5) * 0.9;
    g.beam([bx - Math.cos(a) * l / 2, y + 0.02, bz - Math.sin(a) * l / 2], [bx + Math.cos(a) * l / 2, y + 0.02, bz + Math.sin(a) * l / 2], 0.018, BONE);
  }
  if (skull) {
    g.push().translate(x + 0.2, y, z + 0.1).rotateY(r() * 6);
    g.box(0, 0, 0, 0.15, 0.13, 0.17, BONE);
    g.box(-0.035, 0.05, 0.086, 0.04, 0.04, 0.01, '#141018');
    g.box(0.035, 0.05, 0.086, 0.04, 0.04, 0.01, '#141018');
    g.box(0, -0.02, 0.05, 0.1, 0.04, 0.08, BONE, { shade: 0.9 });
    g.pop();
  }
}

/** Weathered picket fence: some boards leaning, some gone, a few lying in the grass. */
export function picketFence(b: Builder, pts: Pt[], broken = 0.12) {
  const r = b.rng;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bx - ax, bz - az);
    const y = b.y(ax, az), g = b.g(ax, az);
    // Local frame: +z runs along the fence.
    g.push().translate(ax, y, az).rotateY(ang);
    const posts = Math.max(1, Math.round(len / 1.5));
    for (let k = 0; k <= posts; k++) g.box(0, -0.05, (k / posts) * len, 0.12, 1.05, 0.12, PAL.woodDark, { kind: K.Wood });
    for (const h of [0.28, 0.78]) g.box(0.06, h, len / 2, 0.04, 0.07, len, '#5a4a3a', { kind: K.Wood });
    for (let d = 0.12; d < len - 0.05; d += 0.19) {
      const q = r();
      if (q < broken * 0.5) {
        // Gone: maybe lying at the foot of the fence.
        if (r() < 0.5) g.box(0.35 + r() * 0.3, 0.01, d, 0.09, 0.03, 0.8, '#5e4e3c', { kind: K.Wood });
        continue;
      }
      const h = 0.85 + r() * 0.2 - (q < broken ? 0.35 : 0);
      g.push().translate(0.1, -0.02, d).rotateX(q < broken * 1.5 ? (r() - 0.5) * 0.5 : (r() - 0.5) * 0.06);
      g.box(0, 0, 0, 0.03, h, 0.1, '#6a5a48', { kind: K.Wood, shade: 0.75 + r() * 0.35 });
      g.pop();
    }
    g.pop();
    b.collide({ kind: 'b', x0: Math.min(ax, bx) - 0.1, z0: Math.min(az, bz) - 0.1, x1: Math.max(ax, bx) + 0.1, z1: Math.max(az, bz) + 0.1, y0: y - 1, y1: y + 1.0 });
  }
}

/** A lych-gate: a little roofed gateway over a graveyard entrance. The opening runs along z. */
export function lychGate(b: Builder, x: number, z: number, w: number) {
  const g = b.g(x, z), y = b.y(x, z);
  for (const s of [-1, 1]) {
    g.box(x, y - 0.05, z + s * w / 2, 0.2, 2.45, 0.2, PAL.woodDark, { kind: K.Wood });
    g.box(x, y - 0.05, z + s * w / 2, 0.34, 0.3, 0.34, PAL.stoneDark, { kind: K.Brick });
    b.collide({ kind: 'c', x, z: z + s * w / 2, r: 0.18, y0: y - 1, y1: y + 3 });
  }
  g.box(x, y + 2.3, z, 0.24, 0.16, w + 0.5, PAL.woodDark, { kind: K.Wood });
  g.beam([x, y + 1.9, z - w / 2], [x, y + 2.3, z - w / 2 + 0.5], 0.05, PAL.woodDark, { kind: K.Wood });
  g.beam([x, y + 1.9, z + w / 2], [x, y + 2.3, z + w / 2 - 0.5], 0.05, PAL.woodDark, { kind: K.Wood });
  g.push().translate(x, y + 2.45, z).rotateY(Math.PI / 2);
  g.gable(0, 0, 0, w + 0.9, 1.5, 0.75, PAL.slate, PAL.woodDark, { kind: K.Slate });
  g.pop();
  // A lantern hangs under the ridge.
  g.beam([x, y + 2.3, z], [x, y + 2.05, z], 0.012, PAL.iron);
  g.box(x, y + 1.78, z, 0.2, 0.26, 0.2, PAL.iron, { kind: K.Metal });
  b.gl(x, z).box(x, y + 1.8, z, 0.14, 0.2, 0.14, GLOW.window, { kind: 1 });
  b.lights.add(x, y + 1.7, z, 0xffb060, 5, 6, 0.15);
}

/** An old burial mound, its entrance sealed with a slab. The doorway is at local +x. */
export function barrow(b: Builder, x: number, z: number, len: number, wid: number, rot = 0) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  const H = 1.5;
  g.push().translate(x, y, z).rotateY(rot);
  for (let i = 0; i < 4; i++) {
    const t = -len / 2 + (i + 0.5) * (len / 4);
    const k = 1 - Math.abs(t) / (len * 0.75);
    g.blob(t, 0, (r() - 0.5) * 0.3, len / 3.2, H * (0.7 + k * 0.4), wid / 2, i % 2 ? '#3e6334' : '#46693a', Math.floor(r() * 999), { kind: K.Grass, detail: 1, jitter: 0.12, flatBottom: true });
  }
  // Kerb stones round the foot.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.blob(Math.cos(a) * (len / 2 + 0.25), 0.08, Math.sin(a) * (wid / 2 + 0.2), 0.2, 0.18, 0.2, r() < 0.5 ? PAL.rock : PAL.rockDark, Math.floor(r() * 999), { kind: K.Rock, flatBottom: true });
  }
  // The doorway: two uprights, a lintel, and the sealing slab.
  const dx = len / 2 + 0.1;
  for (const s of [-1, 1]) g.box(dx, -0.1, s * 0.62, 0.4, 1.35, 0.32, PAL.stoneDark, { kind: K.Rock });
  g.box(dx, 1.22, 0, 0.5, 0.32, 1.7, PAL.stoneDark, { kind: K.Rock });
  g.box(dx + 0.05, -0.05, 0, 0.14, 1.28, 0.95, PAL.rockDark, { kind: K.Rock });
  // Faint runes on the slab: something still keeps the dead in.
  const gl = b.gl(x, z);
  gl.push().translate(x, y, z).rotateY(rot);
  for (let i = 0; i < 3; i++) gl.box(dx + 0.13, 0.3 + i * 0.3, (i - 1) * 0.14, 0.03, 0.2, 0.09, [0.5, 1.3, 2.8], {});
  gl.pop();
  g.pop();
  // Colliders: a row of circles along the mound.
  const cx = Math.cos(rot), sz = -Math.sin(rot);
  for (const t of [-len / 3, 0, len / 3]) b.collide({ kind: 'c', x: x + cx * t, z: z + sz * t, r: wid / 2, y0: y - 1, y1: y + H });
  b.collide({ kind: 'c', x: x + cx * dx, z: z + sz * dx, r: 0.6, y0: y - 1, y1: y + H });
}

/** A great stone arch: two uprights and a lintel, runes glowing down the stones, wisps in the gap. Faces local +z. */
export function stoneArch(b: Builder, x: number, z: number, rot = 0) {
  const g = b.g(x, z), gl = b.gl(x, z), y = b.y(x, z), r = b.rng;
  const rune: [number, number, number] = [0.6, 1.5, 3.2];
  g.push().translate(x, y, z).rotateY(rot);
  for (const s of [-1, 1]) {
    g.box(s * 0.95, -0.25, 0, 0.6, 2.75, 0.55, r() < 0.5 ? PAL.stoneDark : PAL.rockDark, { kind: K.Rock });
    g.box(s * 0.95, 0.1, 0.285, 0.42, 0.55, 0.02, MOSS, { kind: K.Grass });
  }
  g.box(0, 2.4, 0, 2.9, 0.52, 0.66, PAL.stoneDark, { kind: K.Rock });
  g.box(0.35, 2.92, 0, 1.5, 0.06, 0.52, MOSS, { kind: K.Grass });
  g.pop();
  gl.push().translate(x, y, z).rotateY(rot);
  for (const s of [-1, 1])
    for (let i = 0; i < 4; i++) {
      gl.box(s * 0.95, 0.45 + i * 0.45, 0.285, 0.14, 0.22, 0.02, rune, {});
      gl.box(s * 0.64, 0.35 + i * 0.45, 0, 0.02, 0.22, 0.12, rune, {});
    }
  for (let i = 0; i < 4; i++) gl.box(-0.6 + i * 0.4, 2.63, 0.335, 0.16, 0.14, 0.02, rune, {});
  gl.pop();
  const cs = Math.cos(rot), sn = Math.sin(rot);
  for (const s of [-1, 1]) b.collide({ kind: 'c', x: x + s * 0.95 * cs, z: z - s * 0.95 * sn, r: 0.38, y0: y - 1, y1: y + 2.6 });
  b.lights.add(x + sn * 0.6, y + 1.3, z + cs * 0.6, 0x5a90ff, 7, 7, 0.15);
  b.fx.addEmitter({ x, y: y + 0.3, z, rate: 1.4, spec: P.wisp, spread: 1.4, vy: 0.25 });
  b.moonflowers(x + sn * 0.9, z + cs * 0.9, 12, 1.5);
}

/** Three standing stones under a tilted capstone. */
export function dolmen(b: Builder, x: number, z: number, rot = 0) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  const legs: Pt[] = [[-0.75, -0.45], [0.75, -0.45], [0, 0.65]];
  g.push().translate(x, y, z).rotateY(rot);
  for (const [lx, lz] of legs) {
    g.push().translate(lx, -0.15, lz).rotateZ((r() - 0.5) * 0.1);
    g.box(0, 0, 0, 0.45, 1.55, 0.35, r() < 0.5 ? PAL.stoneDark : PAL.rockDark, { kind: K.Rock });
    g.box(0, 0.1, 0.18, 0.3, 0.4, 0.02, MOSS, { kind: K.Grass });
    g.pop();
  }
  g.push().translate(0, 1.55, 0).rotateZ(0.12).rotateX(-0.08);
  g.blob(0, 0, 0, 1.3, 0.28, 1.0, PAL.stoneDark, Math.floor(r() * 999), { kind: K.Rock, jitter: 0.15 });
  g.box(0.2, 0.22, 0.1, 0.8, 0.05, 0.6, MOSS, { kind: K.Grass });
  g.pop();
  g.pop();
  const cs = Math.cos(rot), sn = Math.sin(rot);
  for (const [lx, lz] of legs) b.collide({ kind: 'c', x: x + lx * cs + lz * sn, z: z - lx * sn + lz * cs, r: 0.3, y0: y - 1, y1: y + 2 });
  b.lights.add(x, y + 0.4, z, 0x6aa0ff, 2, 4, 0.1);
}

// ---------- village and homestead ----------

/** An iron bracket with a painted board hanging from it. The bracket juts out along local +z. */
export function hangingSign(g: Geo, x: number, y: number, z: number, rot: number, icon: 'mug' | 'anvil') {
  g.push().translate(x, y, z).rotateY(rot);
  g.beam([0, 0, 0], [0, 0, 0.85], 0.03, PAL.iron, { kind: K.Metal });
  g.beam([0, -0.45, 0], [0, -0.02, 0.5], 0.02, PAL.iron);
  for (const cz of [0.2, 0.7]) g.beam([0, -0.02, cz], [0, -0.14, cz], 0.012, PAL.iron);
  g.box(0, -0.62, 0.45, 0.05, 0.5, 0.66, PAL.woodDark, { kind: K.Wood });
  g.box(0, -0.58, 0.45, 0.07, 0.42, 0.56, PAL.woodLight, { kind: K.Wood });
  for (const s of [-1, 1]) {
    const f = s * 0.04;
    if (icon === 'mug') {
      g.box(f, -0.52, 0.42, 0.02, 0.22, 0.16, '#c8a040');
      g.box(f, -0.33, 0.42, 0.02, 0.07, 0.19, '#e8e2d4');
      g.box(f, -0.46, 0.55, 0.02, 0.12, 0.05, '#c8a040');
    } else {
      g.box(f, -0.44, 0.42, 0.02, 0.07, 0.34, '#2a2a34');
      g.box(f, -0.51, 0.44, 0.02, 0.08, 0.1, '#2a2a34');
      g.box(f, -0.56, 0.44, 0.02, 0.05, 0.22, '#2a2a34');
    }
  }
  g.pop();
}

/** A smith's anvil on a stump, a hammer resting on it. */
export function anvil(b: Builder, x: number, z: number, rot = 0) {
  const g = b.g(x, z), y = b.y(x, z);
  g.push().translate(x, y, z).rotateY(rot);
  g.cyl(0, -0.05, 0, 0.3, 0.27, 0.5, 7, PAL.bark, { kind: K.Bark, top: '#8a7050' });
  g.box(0, 0.45, 0, 0.26, 0.1, 0.36, PAL.iron, { kind: K.Metal });
  g.box(0, 0.55, 0, 0.16, 0.12, 0.26, PAL.iron, { kind: K.Metal });
  g.box(0, 0.67, 0, 0.26, 0.12, 0.5, '#4a4a56', { kind: K.Metal });
  g.push().translate(0, 0.73, 0.25).rotateX(Math.PI / 2);
  g.cyl(0, 0, 0, 0.07, 0, 0.26, 5, '#4a4a56', { kind: K.Metal });
  g.pop();
  g.beam([0.05, 0.8, -0.12], [0.05, 0.8, 0.12], 0.02, PAL.woodLight);
  g.box(0.05, 0.79, -0.14, 0.07, 0.07, 0.1, '#2a2a34');
  g.pop();
  b.collide({ kind: 'c', x, z, r: 0.35, y0: y - 1, y1: y + 0.9 });
}

/** A plank water trough, moonlight on the water. */
export function trough(b: Builder, x: number, z: number, rot = 0) {
  const g = b.g(x, z), y = b.y(x, z);
  g.push().translate(x, y, z).rotateY(rot);
  g.box(0, 0, 0, 1.4, 0.5, 0.55, PAL.wood, { kind: K.Wood });
  g.box(0, 0.44, 0, 1.26, 0.03, 0.41, '#142230');
  for (const s of [-1, 1]) g.box(s * 0.6, 0, 0, 0.08, 0.55, 0.6, PAL.woodDark, { kind: K.Wood });
  g.pop();
  const gl = b.gl(x, z);
  gl.push().translate(x, y, z).rotateY(rot);
  gl.box(0.2, 0.475, 0.05, 0.4, 0.01, 0.08, [0.35, 0.45, 0.7], {});
  gl.pop();
  const c = Math.abs(Math.cos(rot)) > 0.5;
  b.collide({ kind: 'b', x0: x - (c ? 0.7 : 0.28), z0: z - (c ? 0.28 : 0.7), x1: x + (c ? 0.7 : 0.28), z1: z + (c ? 0.28 : 0.7), y0: y - 1, y1: y + 0.55 });
}

/** A carpenter's bench with a saw, a mallet and offcuts. */
export function workbench(b: Builder, x: number, z: number, rot = 0) {
  const g = b.g(x, z), y = b.y(x, z);
  g.push().translate(x, y, z).rotateY(rot);
  g.box(0, 0.78, 0, 1.6, 0.1, 0.62, PAL.woodLight, { kind: K.Wood });
  for (const [lx, lz] of [[-0.7, -0.24], [0.7, -0.24], [0.7, 0.24], [-0.7, 0.24]]) g.box(lx, 0, lz, 0.1, 0.78, 0.1, PAL.woodDark, { kind: K.Wood });
  g.box(0, 0.22, 0, 1.4, 0.05, 0.5, PAL.wood, { kind: K.Wood });
  g.box(0, 0.27, 0.05, 0.9, 0.08, 0.2, PAL.woodLight, { kind: K.Wood });
  // Saw, mallet, a plank in the vise.
  g.box(-0.35, 0.89, 0.05, 0.5, 0.01, 0.14, '#9a9aa4', { kind: K.Metal });
  g.box(-0.66, 0.88, 0.05, 0.12, 0.06, 0.08, PAL.woodDark);
  g.box(0.35, 0.88, -0.1, 0.16, 0.1, 0.1, PAL.woodDark);
  g.beam([0.35, 0.93, -0.05], [0.4, 0.92, 0.2], 0.02, PAL.woodLight);
  g.box(0.72, 0.88, 0.05, 0.14, 0.16, 0.2, PAL.iron);
  g.box(0.95, 0.88, 0.05, 0.6, 0.05, 0.16, PAL.woodLight, { kind: K.Wood });
  g.pop();
  const c = Math.abs(Math.cos(rot)) > 0.5;
  b.collide({ kind: 'b', x0: x - (c ? 0.85 : 0.35), z0: z - (c ? 0.35 : 0.85), x1: x + (c ? 0.85 : 0.35), z1: z + (c ? 0.35 : 0.85), y0: y - 1, y1: y + 1 });
}

/** A market stall under a striped awning, produce on the counter. Serves toward local +z. */
export function marketStall(b: Builder, x: number, z: number, rot = 0) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  g.push().translate(x, y, z).rotateY(rot);
  g.box(0, 0, 0, 2.1, 0.85, 0.8, PAL.wood, { kind: K.Wood });
  g.box(0, 0.85, 0, 2.2, 0.06, 0.9, PAL.woodLight, { kind: K.Wood });
  for (const [px, pz] of [[-1.05, 0.42], [1.05, 0.42], [-1.05, -0.45], [1.05, -0.45]]) g.box(px, 0, pz, 0.09, pz > 0 ? 2.1 : 2.4, 0.09, PAL.woodDark, { kind: K.Wood });
  // Striped awning, sloping toward the customer.
  const n = 7;
  for (let i = 0; i < n; i++) {
    const x0 = -1.15 + (i * 2.3) / n, x1 = -1.15 + ((i + 1) * 2.3) / n;
    g.quad([x0, 2.1, 0.75], [x1, 2.1, 0.75], [x1, 2.4, -0.5], [x0, 2.4, -0.5], i % 2 ? '#c8b890' : '#8a2a2a', { kind: K.Cloth, wind: 0.25 });
    g.quad([x0, 2.4, -0.5], [x1, 2.4, -0.5], [x1, 2.1, 0.75], [x0, 2.1, 0.75], i % 2 ? '#c8b890' : '#8a2a2a', { kind: K.Cloth, wind: 0.25 });
    g.box((x0 + x1) / 2, 1.95, 0.75, x1 - x0, 0.16, 0.02, i % 2 ? '#8a2a2a' : '#c8b890', { kind: K.Cloth, wind: 0.5 });
  }
  // Baskets of apples, cabbages and gourds.
  const goods: [number, Col][] = [[-0.65, '#a83030'], [0.0, '#5a8a3a'], [0.65, '#c87020']];
  for (const [bx, col] of goods) {
    g.box(bx, 0.91, 0.05, 0.5, 0.14, 0.4, PAL.woodDark, { kind: K.Wood });
    for (let k = 0; k < 5; k++) g.blob(bx + (r() - 0.5) * 0.3, 1.07, 0.05 + (r() - 0.5) * 0.2, 0.09, 0.08, 0.09, col, Math.floor(r() * 999), {});
  }
  g.pop();
  b.crate(x + Math.cos(rot) * 1.5, z - Math.sin(rot) * 1.5, 0.55);
  const c = Math.abs(Math.cos(rot)) > 0.5;
  b.collide({ kind: 'b', x0: x - (c ? 1.1 : 0.45), z0: z - (c ? 0.45 : 1.1), x1: x + (c ? 1.1 : 0.45), z1: z + (c ? 0.45 : 1.1), y0: y - 1, y1: y + 2 });
  b.lights.add(x, y + 1.8, z, 0xffb060, 3, 4, 0.12);
  b.gl(x, z).box(x, y + 1.65, z, 0.14, 0.18, 0.14, GLOW.window, { kind: 1 });
}

/** A rail for tying horses, a bucket at its foot. The rail runs along local x. */
export function hitchingPost(b: Builder, x: number, z: number, rot = 0) {
  const g = b.g(x, z), y = b.y(x, z);
  g.push().translate(x, y, z).rotateY(rot);
  for (const s of [-1, 1]) g.box(s * 0.9, -0.05, 0, 0.14, 1.05, 0.14, PAL.woodDark, { kind: K.Wood });
  g.beam([-1.0, 0.92, 0], [1.0, 0.92, 0], 0.05, PAL.wood, { kind: K.Wood });
  g.beam([0.3, 0.9, 0], [0.4, 0.45, 0.05], 0.015, '#a09070');
  g.cyl(-0.4, 0, 0.35, 0.16, 0.19, 0.3, 7, PAL.wood, { kind: K.Wood, top: '#142230' });
  g.pop();
  const cs = Math.cos(rot), sn = Math.sin(rot);
  for (const s of [-1, 1]) b.collide({ kind: 'c', x: x + s * 0.9 * cs, z: z - s * 0.9 * sn, r: 0.12, y0: y - 1, y1: y + 1 });
}

/** Knee-high post with a little lantern: marks a road after dark. */
export function postLantern(b: Builder, x: number, z: number) {
  const g = b.g(x, z), y = b.y(x, z);
  g.box(x, y - 0.05, z, 0.12, 1.2, 0.12, PAL.woodDark, { kind: K.Wood });
  g.box(x, y + 1.15, z, 0.2, 0.05, 0.2, PAL.iron, { kind: K.Metal });
  g.pyramid(x, y + 1.43, z, 0.24, 0.24, 0.12, PAL.iron, { kind: K.Metal });
  b.gl(x, z).box(x, y + 1.2, z, 0.13, 0.22, 0.13, GLOW.window, { kind: 1 });
  b.lights.add(x, y + 1.3, z, 0xffb060, 3.5, 5, 0.15);
  b.collide({ kind: 'c', x, z, r: 0.1, y0: y - 1, y1: y + 1.4 });
}

/** Pebbles and small stones along the edges of a path. */
export function edgeStones(b: Builder, grid: Grid, line: Pt[], width: number) {
  const r = b.rng;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i], [bx, bz] = line[i + 1];
    const len = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / len, nz = (bx - ax) / len;
    for (let d = 0.3; d < len; d += 0.75) {
      const px = ax + ((bx - ax) * d) / len, pz = az + ((bz - az) * d) / len;
      for (const s of [-1, 1]) {
        if (r() > 0.4) continue;
        const off = width / 2 + 0.05 + r() * 0.3;
        const x = px + nx * s * off, z = pz + nz * s * off;
        const cx = Math.floor(x), cz = Math.floor(z);
        if (!grid.inside(cx, cz)) continue;
        const t = grid.t[grid.i(cx, cz)];
        if (grid.water[grid.i(cx, cz)] !== NONE || (t !== T.Grass && t !== T.DarkGrass && t !== T.Moss && t !== T.Path)) continue;
        if (Math.abs(grid.groundAt(x, z) - grid.groundAt(px, pz)) > 0.05) continue;
        const sz = 0.1 + r() * 0.12;
        b.d(x, z).blob(x, grid.groundAt(x, z) + 0.02, z, sz, sz * 0.55, sz * (0.8 + r() * 0.4), r() < 0.4 ? PAL.stone : r() < 0.7 ? PAL.rock : PAL.rockDark, Math.floor(r() * 999), { kind: K.Rock, flatBottom: true });
      }
    }
  }
}

/**
 * The village chapel: a stone nave with lancet windows and a rose window, and a
 * bell tower at the west end with the door in its foot (facing +z).
 */
export function chapel(b: Builder, x: number, z: number): Structure {
  const y = b.y(x, z) - 0.05, W = 6.6, D = 4.2, H = 3.4;
  const s = b.structure('chapel', new THREE.Box3(new THREE.Vector3(x - W / 2 - 0.8, y, z - D / 2 - 0.8), new THREE.Vector3(x + W / 2 + 0.8, y + 10, z + D / 2 + 0.8)));
  const g = s.core, gl = s.glow, st = PAL.stone, o = { kind: K.Brick };
  const warm: [number, number, number] = [2.8, 1.8, 0.8];
  g.box(x, y - 0.3, z, W + 0.2, 0.6, D + 0.2, PAL.stoneDark, o);
  g.box(x, y + 0.3, z, W, H - 0.3, D, st, o);
  // Nave roof from the tower east.
  const n0 = x - W / 2 + 2.2, n1 = x + W / 2;
  g.push().translate((n0 + n1) / 2, y + H, z);
  g.gable(0, 0, 0, n1 - n0 + 0.5, D + 0.8, 2.4, PAL.slate, st, { kind: K.Slate });
  g.box(0, 2.3, 0, n1 - n0 + 0.6, 0.14, 0.14, PAL.slate2, { kind: K.Slate });
  g.pop();
  // Buttresses and tall lancet windows along the south wall.
  for (const bx of [n0 + 0.2, n0 + 2.1, n1 - 0.1]) g.box(bx, y, z + D / 2 + 0.2, 0.4, H - 0.6, 0.4, PAL.stoneDark, o);
  for (const wx of [n0 + 1.15, n0 + 3.1]) {
    gl.box(wx, y + 1.0, z + D / 2 + 0.02, 0.36, 1.4, 0.06, wx > n0 + 2 ? warm : [0.03, 0.035, 0.06], { kind: 1 });
    g.pyramid(wx, y + 2.4, z + D / 2 + 0.03, 0.46, 0.08, 0.3, '#a8a4b0');
    g.box(wx, y + 0.92, z + D / 2 + 0.06, 0.5, 0.09, 0.12, '#a8a4b0');
    if (wx > n0 + 2) b.lights.add(wx, y + 1.6, z + D / 2 + 0.8, 0xffa050, 3, 4.5, 0.1);
  }
  // A rose window in the east gable.
  gl.push().translate(n1 + 0.04, y + H + 0.85, z).rotateZ(Math.PI / 2);
  gl.cyl(0, 0, 0, 0.42, 0.42, 0.04, 8, [1.0, 0.65, 0.3], { kind: 1 });
  gl.pop();
  g.push().translate(n1 + 0.02, y + H + 0.85, z).rotateZ(Math.PI / 2);
  g.cyl(0, 0, 0, 0.55, 0.55, 0.03, 8, '#a8a4b0', { cap: false });
  g.pop();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    g.beam([n1 + 0.07, y + H + 0.85 - Math.sin(a) * 0.42, z - Math.cos(a) * 0.42], [n1 + 0.07, y + H + 0.85 + Math.sin(a) * 0.42, z + Math.cos(a) * 0.42], 0.025, '#6a6674');
  }
  // The bell tower: a belfry with the bell showing, a pyramid spire, a moon on top.
  const tx = x - W / 2 + 1.1, TH = 7.2;
  g.box(tx, y - 0.3, z, 2.3, TH + 0.3, 2.3, st, o);
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1]]) for (let q = 0; q < 9; q++) g.box(tx + dx * 1.15, y + q * 0.75, z + dz * 1.15, q % 2 ? 0.34 : 0.26, 0.28, q % 2 ? 0.26 : 0.34, '#a8a4b0', { kind: K.Rock });
  g.box(tx, y + TH - 0.1, z, 2.6, 0.2, 2.6, PAL.stoneDark, o);
  g.box(tx + 1.16, y + 5.0, z, 0.02, 1.3, 0.8, '#0a0a12');
  g.box(tx, y + 5.0, z + 1.16, 0.8, 1.3, 0.02, '#0a0a12');
  g.cyl(tx + 0.4, y + 5.25, z + 0.4, 0.34, 0.2, 0.55, 8, '#8a6a30', { kind: K.Metal });
  g.pyramid(tx, y + TH + 0.1, z, 2.7, 2.7, 2.6, PAL.slate2, { kind: K.Slate });
  g.box(tx, y + TH + 2.6, z, 0.08, 0.7, 0.08, PAL.iron);
  g.box(tx, y + TH + 3.2, z, 0.05, 0.34, 0.3, '#c8a040', { kind: K.Metal });
  // The door in the tower's foot, with a lantern.
  g.box(tx, y + 0.1, z + 1.16, 1.0, 1.9, 0.06, PAL.woodDark, { kind: K.Wood });
  g.pyramid(tx, y + 2.0, z + 1.17, 1.2, 0.1, 0.4, '#a8a4b0');
  for (const s2 of [-1, 1]) g.box(tx + s2 * 0.58, y, z + 1.19, 0.16, 2.0, 0.1, '#a8a4b0');
  g.box(tx, y - 0.05, z + 1.5, 1.4, 0.14, 0.6, PAL.stoneDark, { kind: K.Flag });
  gl.box(tx + 0.8, y + 1.6, z + 1.3, 0.14, 0.2, 0.14, GLOW.window, { kind: 1 });
  b.lights.add(tx + 0.8, y + 1.6, z + 1.8, 0xffb060, 4, 5, 0.12);
  b.markSolid(x - W / 2, z - D / 2, x + W / 2, z + D / 2);
  return s;
}

/** The smith's open forge: a lean-to off a wall of the smithy (dir: +1 east, -1 west), tools hung on the wall. */
export function forgeLeanTo(b: Builder, s: Structure, wallX: number, z0: number, z1: number, dir = -1) {
  const g = s.core, y = b.y(wallX + dir, (z0 + z1) / 2) - 0.05, x0 = wallX + dir * 2.2;
  for (const w of [1, -1]) {
    const A: [number, number, number] = [wallX, y + 2.45, w > 0 ? z0 : z1], B: [number, number, number] = [wallX, y + 2.45, w > 0 ? z1 : z0];
    const C: [number, number, number] = [x0 + dir * 0.25, y + 1.95, w > 0 ? z1 : z0], Dd: [number, number, number] = [x0 + dir * 0.25, y + 1.95, w > 0 ? z0 : z1];
    g.quad(A, B, C, Dd, PAL.woodDark, { kind: K.Wood });
  }
  for (const pz of [z0 + 0.15, z1 - 0.15]) {
    g.box(x0, y, pz, 0.16, 2.0, 0.16, PAL.woodDark, { kind: K.Wood });
    b.collide({ kind: 'c', x: x0, z: pz, r: 0.12, y0: y - 1, y1: y + 2 });
  }
  // Tongs and hammers on the wall, a rack of bar iron, a coal heap.
  for (let i = 0; i < 4; i++) g.beam([wallX + dir * 0.06, y + 1.9, z0 + 0.8 + i * 0.35], [wallX + dir * 0.06, y + 1.35, z0 + 0.85 + i * 0.35], 0.02, PAL.iron);
  g.box(wallX + dir * 0.1, y + 1.3, z0 + 1.0, 0.1, 0.12, 0.2, '#2a2a34');
  for (let i = 0; i < 5; i++) g.beam([wallX + dir * 0.25, y + 0.1, z1 - 0.4 - i * 0.08], [wallX + dir * 0.12, y + 1.3, z1 - 0.4 - i * 0.08], 0.02, '#4a4a56');
  g.blob(wallX + dir * 0.6, y + 0.1, z1 - 0.9, 0.45, 0.25, 0.4, '#1a1a1e', 77, { kind: K.Rock, flatBottom: true });
}

// ---------- nature ----------

/** A silver birch: pale trunk with dark marks, a light airy crown. */
export function birch(b: Builder, x: number, z: number, s = 1) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  const lean = (r() - 0.5) * 0.15;
  g.push().translate(x, y, z).rotateZ(lean);
  g.cyl(0, -0.1, 0, 0.11 * s, 0.06 * s, 2.9 * s, 6, '#d8d4c8', { kind: K.Plain });
  for (let i = 0; i < 7; i++) {
    const h = (0.3 + r() * 2.3) * s, a = r() * Math.PI * 2;
    g.box(Math.cos(a) * 0.08 * s, h, Math.sin(a) * 0.08 * s, 0.1 * s, 0.035, 0.1 * s, '#2a2622');
  }
  g.beam([0, 1.8 * s, 0], [0.5 * s, 2.5 * s, 0.1 * s], 0.03 * s, '#c8c4b8');
  g.beam([0, 2.1 * s, 0], [-0.4 * s, 2.7 * s, -0.2 * s], 0.03 * s, '#c8c4b8');
  const tone = r() < 0.5 ? '#6a8a3e' : '#7a9444';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + r();
    const d = i === 0 ? 0 : 0.4 * s;
    g.blob(Math.cos(a) * d, (2.5 + r() * 0.7) * s, Math.sin(a) * d, (0.55 + r() * 0.2) * s, (0.7 + r() * 0.2) * s, (0.55 + r() * 0.2) * s, tone, Math.floor(r() * 999), { kind: K.Leaves, wind: 0.6, jitter: 0.2 });
  }
  g.pop();
  b.collide({ kind: 'c', x, z, r: 0.18 * s, y0: y - 1, y1: y + 4 * s });
}

/** An old tree stump, pale where it was cut. */
export function stump(b: Builder, x: number, z: number, s = 1) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  g.cyl(x, y - 0.05, z, 0.3 * s, 0.26 * s, 0.38 * s, 7, PAL.bark, { kind: K.Bark, top: '#a08a60' });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + r();
    g.beam([x + Math.cos(a) * 0.2 * s, y + 0.12 * s, z + Math.sin(a) * 0.2 * s], [x + Math.cos(a) * 0.5 * s, y - 0.02, z + Math.sin(a) * 0.5 * s], 0.06 * s, PAL.bark, { kind: K.Bark });
  }
  if (r() < 0.4) b.mushrooms(x + 0.3, z + 0.2, 3);
  b.collide({ kind: 'c', x, z, r: 0.3 * s, y0: y - 1, y1: y + 0.4 * s });
}

/** A fallen trunk, mossy on top. rot turns it about y. */
export function fallenLog(b: Builder, x: number, z: number, len: number, rot = 0) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng, R = 0.24;
  g.push().translate(x, y + R * 0.8, z).rotateY(rot).rotateZ(Math.PI / 2);
  g.cyl(0, -len / 2, 0, R, R * 0.85, len, 7, PAL.bark, { kind: K.Bark, top: '#9a8058' });
  g.push().rotateZ(Math.PI);
  g.cyl(0, len / 2 - 0.01, 0, R, R, 0.01, 7, '#9a8058', {});
  g.pop();
  g.pop();
  g.push().translate(x, y, z).rotateY(rot);
  g.box(0, R * 1.75, 0, len * 0.7, 0.05, R * 0.9, MOSS, { kind: K.Grass });
  g.beam([len * 0.2, R, 0], [len * 0.28, R + 0.45, 0.25], 0.04, PAL.bark, { kind: K.Bark });
  g.beam([-len * 0.15, R, 0], [-len * 0.2, R + 0.3, -0.3], 0.035, PAL.bark, { kind: K.Bark });
  g.pop();
  if (r() < 0.5) b.mushrooms(x + Math.sin(rot) * 0.35, z + Math.cos(rot) * 0.35, 3);
  const cs = Math.cos(rot), sn = Math.sin(rot);
  for (let t = -len / 2 + R; t <= len / 2 - R + 0.01; t += R * 1.6) b.collide({ kind: 'c', x: x + cs * t, z: z - sn * t, r: R + 0.04, y0: y - 1, y1: y + R * 1.8 });
}

const FLOWERS: Record<string, Col[]> = {
  meadow: ['#e8e4d8', '#e0c040', '#9a6ac8', '#e8e4d8', '#d87aa0'],
  purple: ['#7a4aa8', '#9a6ac8', '#6a5ab8', '#b88ad8'],
  yellow: ['#e0c040', '#f0d060', '#e8e4d8'],
};

/** A clump of wild flowers: tall purple spikes, white and yellow heads. */
export function wildflowers(b: Builder, x: number, z: number, n = 10, spread = 1, palette: keyof typeof FLOWERS = 'meadow') {
  const g = b.d(x, z), gl = b.gl(x, z), r = b.rng, cols = FLOWERS[palette];
  for (let i = 0; i < n; i++) {
    const fx = x + (r() - 0.5) * spread * 2, fz = z + (r() - 0.5) * spread * 2;
    if (b.grid.waterAt(fx, fz) !== NONE) continue;
    const y = b.y(fx, fz), col = cols[Math.floor(r() * cols.length)];
    const spike = col === '#7a4aa8' || col === '#9a6ac8' || col === '#6a5ab8';
    const h = spike ? 0.35 + r() * 0.25 : 0.15 + r() * 0.15;
    g.box(fx, y, fz, 0.025, h, 0.025, '#3e5a34', BACK);
    if (spike) gl.box(fx, y + h * 0.55, fz, 0.08, h * 0.5, 0.08, col, { shade: 0.3, ...BACK });
    else gl.box(fx, y + h, fz, 0.1, 0.06, 0.1, col, { shade: 0.3, ...BACK });
  }
}

/** Lily pads floating on still water, a few white flowers among them. */
export function lilyPads(b: Builder, x: number, z: number, n = 6, spread = 1.2) {
  const g = b.d(x, z), gl = b.gl(x, z), r = b.rng, grid = b.grid;
  for (let i = 0; i < n; i++) {
    const fx = x + (r() - 0.5) * spread * 2, fz = z + (r() - 0.5) * spread * 2;
    const w = grid.waterAt(fx, fz);
    if (w === NONE || w - grid.groundAt(fx, fz) < 0.15) continue;
    const rad = 0.16 + r() * 0.14;
    g.cyl(fx, w + 0.005, fz, rad, rad, 0.015, 7, r() < 0.5 ? '#3a6a34' : '#4a7a3a', { rot: r() * 6 });
    if (r() < 0.35) {
      gl.box(fx + 0.03, w + 0.02, fz, 0.1, 0.05, 0.1, [1.5, 1.5, 1.4], {});
      gl.box(fx + 0.03, w + 0.06, fz, 0.04, 0.02, 0.04, [1.8, 1.4, 0.4], {});
    }
  }
}

/** A fern: a ring of arching fronds, two-sided so it reads from any angle. */
export function fern(b: Builder, x: number, z: number, s = 1) {
  const g = b.d(x, z), y = b.y(x, z), r = b.rng;
  const col = r() < 0.5 ? '#3e6a34' : '#4a7a3a';
  const n = 5 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.5, len = (0.45 + r() * 0.25) * s;
    const ex = Math.cos(a) * len, ez = Math.sin(a) * len;
    const wx = -Math.sin(a) * 0.09 * s, wz = Math.cos(a) * 0.09 * s;
    const my = y + (0.28 + r() * 0.1) * s;
    const A: [number, number, number] = [x, y, z], C: [number, number, number] = [x + ex, y + 0.1 * s, z + ez];
    const L: [number, number, number] = [x + ex * 0.5 - wx, my, z + ez * 0.5 - wz], R: [number, number, number] = [x + ex * 0.5 + wx, my, z + ez * 0.5 + wz];
    g.quad(A, L, C, R, col, { kind: K.Leaves, wind: 0.5 });
    g.quad(A, R, C, L, col, { kind: K.Leaves, wind: 0.5 });
  }
}

/** A few loose stones in the grass. */
export function pebbles(b: Builder, x: number, z: number, n = 3) {
  const g = b.d(x, z), r = b.rng;
  for (let i = 0; i < n; i++) {
    const px = x + (r() - 0.5) * 0.9, pz = z + (r() - 0.5) * 0.9, s = 0.08 + r() * 0.1;
    g.blob(px, b.y(px, pz) + 0.01, pz, s, s * 0.6, s * (0.8 + r() * 0.4), r() < 0.4 ? PAL.stone : r() < 0.7 ? PAL.rock : PAL.rockDark, Math.floor(r() * 999), { kind: K.Rock, flatBottom: true });
  }
}

/**
 * Dress the whole world, not just the landmarks: every field, wood, marsh and
 * upland cell (inside the realm and out to the edges) gets its share of flowers,
 * ferns, loose stones, stumps, fallen logs and mushrooms, by what grows there.
 * ok(x, z, solid) says where things may go (solid: it has a collider).
 */
export function dressWorld(b: Builder, grid: Grid, r: () => number, density: number, ok: (x: number, z: number, kind: 'soft' | 'solid' | 'tree') => boolean, patch?: (x: number, z: number) => number) {
  const clear = (x: number, z: number, rad: number) =>
    !grid.collidersNear(x, z).some((c) => c.on && (c.kind === 'c' ? Math.hypot(x - c.x, z - c.z) < c.r + rad : x > c.x0 - rad && x < c.x1 + rad && z > c.z0 - rad && z < c.z1 + rad));
  const flat = (x: number, z: number, rad: number) => {
    const h = grid.groundAt(x, z);
    for (const [dx, dz] of [[rad, 0], [-rad, 0], [0, rad], [0, -rad]]) {
      if (Math.abs(grid.groundAt(x + dx, z + dz) - h) > 0.1 || grid.waterAt(x + dx, z + dz) !== NONE) return false;
    }
    return true;
  };
  const S = 2.5;
  for (let z = grid.oz + 1; z < grid.oz + grid.d - 2; z += S)
    for (let x = grid.ox + 1; x < grid.ox + grid.w - 2; x += S) {
      // Always draw the same numbers per sample, so one change doesn't reshuffle the rest.
      // (patch, 0..1: where things grow thick and where the ground stays open, so the detail comes
      // in clumps; without it, spread evenly.)
      const px = x + r() * S, pz = z + r() * S, pick0 = r(), roll = pick0 / density / (patch ? 0.2 + 1.6 * patch(px, pz) : 1), pick = r(), size = r();
      const cx = Math.floor(px), cz = Math.floor(pz);
      if (!grid.inside(cx, cz)) continue;
      const i = grid.i(cx, cz), t = grid.t[i];
      if (grid.water[i] !== NONE || grid.dir[i] >= 0 || grid.deck[i] !== NONE || grid.noGrass[i] && t !== T.Mud) continue;
      const biome = t === T.DarkGrass ? 'wood' : t === T.Grass ? (grid.h[i] >= 3.5 ? 'high' : 'field') : t === T.Mud || t === T.Reeds ? 'marsh' : null;
      if (!biome) continue;
      const soft = (rad: number) => ok(px, pz, 'soft') && clear(px, pz, rad);
      const hard = (rad: number) => ok(px, pz, 'solid') && clear(px, pz, rad + 0.3) && flat(px, pz, rad);
      const tree = () => ok(px, pz, 'tree') && clear(px, pz, 1.4) && flat(px, pz, 0.6);
      const flowers = (pal: 'meadow' | 'purple' | 'yellow') => soft(0.3) && wildflowers(b, px, pz, 5 + Math.floor(size * 6), 0.5 + size * 0.5, pal);
      const palette = pick < 0.5 ? 'meadow' : pick < 0.75 ? 'purple' : 'yellow';
      if (biome === 'field') {
        if (roll < 0.2) flowers(palette);
        else if (roll < 0.24) soft(0.4) && fern(b, px, pz, 0.8 + size * 0.4);
        else if (roll < 0.3) soft(0.3) && pebbles(b, px, pz, 2 + Math.floor(size * 3));
        else if (roll < 0.315) hard(0.5) && stump(b, px, pz, 0.7 + size * 0.5);
        else if (roll < 0.325) hard(1.4) && fallenLog(b, px, pz, 2.2 + size, pick * Math.PI);
        else if (roll < 0.365) ok(px, pz, 'tree') && soft(0.6) && b.bush(px, pz, 0.6 + size * 0.5);
        else if (roll < 0.377) tree() && (pick < 0.55 ? b.oak(px, pz, 0.8 + size * 0.4) : birch(b, px, pz, 0.8 + size * 0.4));
      } else if (biome === 'wood') {
        if (roll < 0.28) soft(0.4) && fern(b, px, pz, 0.8 + size * 0.5);
        else if (roll < 0.32) soft(0.4) && b.mushrooms(px, pz, 3 + Math.floor(size * 4), false);
        else if (roll < 0.37) hard(0.5) && stump(b, px, pz, 0.7 + size * 0.5);
        else if (roll < 0.4) hard(1.4) && fallenLog(b, px, pz, 2.2 + size * 1.2, pick * Math.PI);
        else if (roll < 0.43) flowers('purple');
      } else if (biome === 'high') {
        if (roll < 0.14) flowers(palette);
        else if (roll < 0.24) soft(0.3) && pebbles(b, px, pz, 2 + Math.floor(size * 3));
        else if (roll < 0.27) ok(px, pz, 'tree') && soft(0.6) && b.bush(px, pz, 0.6 + size * 0.4);
      } else {
        if (roll < 0.12) soft(0.4) && b.reeds(px, pz, 6, 0.6);
        else if (roll < 0.17) flowers('yellow');
        else if (roll < 0.19) hard(1.4) && fallenLog(b, px, pz, 2 + size, pick * Math.PI);
      }
    }
}

// ---------- goblin camp ----------

/** A goblin war drum on stubby legs, sticks resting on the hide. */
export function warDrum(b: Builder, x: number, z: number) {
  const g = b.g(x, z), y = b.y(x, z);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    g.beam([x + Math.cos(a) * 0.4, y, z + Math.sin(a) * 0.4], [x + Math.cos(a) * 0.3, y + 0.3, z + Math.sin(a) * 0.3], 0.04, PAL.woodDark);
  }
  g.cyl(x, y + 0.25, z, 0.45, 0.5, 0.6, 9, '#6a3020', { kind: K.Wood, top: '#b09a70' });
  for (let i = 0; i < 9; i++) {
    const a0 = (i / 9) * Math.PI * 2, a1 = ((i + 0.5) / 9) * Math.PI * 2;
    g.beam([x + Math.cos(a0) * 0.51, y + 0.3, z + Math.sin(a0) * 0.51], [x + Math.cos(a1) * 0.47, y + 0.82, z + Math.sin(a1) * 0.47], 0.015, '#c8b890');
  }
  g.beam([x - 0.2, y + 0.87, z - 0.1], [x + 0.3, y + 0.9, z + 0.2], 0.025, PAL.woodLight);
  g.beam([x - 0.1, y + 0.87, z + 0.25], [x + 0.25, y + 0.9, z - 0.2], 0.025, PAL.woodLight);
  b.collide({ kind: 'c', x, z, r: 0.5, y0: y - 1, y1: y + 0.9 });
}

/** An A-frame hung with skulls and antlers. The frame runs along local x. */
export function trophyRack(b: Builder, x: number, z: number, rot = 0) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  g.push().translate(x, y, z).rotateY(rot);
  for (const s of [-1, 1]) {
    g.beam([s * 0.9, 0, -0.35], [s * 0.9, 1.8, 0], 0.05, PAL.woodDark, { kind: K.Wood });
    g.beam([s * 0.9, 0, 0.35], [s * 0.9, 1.8, 0], 0.05, PAL.woodDark, { kind: K.Wood });
  }
  g.beam([-1.0, 1.75, 0], [1.0, 1.75, 0], 0.05, PAL.woodDark, { kind: K.Wood });
  for (let i = 0; i < 4; i++) {
    const hx = -0.6 + i * 0.4, drop = 0.3 + r() * 0.3;
    g.beam([hx, 1.75, 0], [hx, 1.75 - drop, 0], 0.012, '#a09070');
    if (i % 2 === 0) {
      g.box(hx, 1.55 - drop, 0, 0.16, 0.15, 0.18, BONE);
      g.box(hx - 0.04, 1.62 - drop, 0.09, 0.04, 0.04, 0.01, '#141018');
      g.box(hx + 0.04, 1.62 - drop, 0.09, 0.04, 0.04, 0.01, '#141018');
    } else {
      g.box(hx, 1.6 - drop, 0, 0.06, 0.1, 0.06, BONE);
      for (const s of [-1, 1]) {
        g.beam([hx, 1.68 - drop, 0], [hx + s * 0.22, 1.9 - drop, 0.05], 0.018, '#b8a888');
        g.beam([hx + s * 0.12, 1.78 - drop, 0.02], [hx + s * 0.1, 1.95 - drop, 0.1], 0.015, '#b8a888');
      }
    }
  }
  g.pop();
  const cs = Math.cos(rot), sn = Math.sin(rot);
  for (const s of [-1, 1]) b.collide({ kind: 'c', x: x + s * 0.9 * cs, z: z - s * 0.9 * sn, r: 0.35, y0: y - 1, y1: y + 1.8 });
}

/** A ragged goblin standard: a pole, a skull on top, torn cloth daubed with a red hand. */
export function goblinStandard(b: Builder, x: number, z: number, col: Col = PAL.goblinCloth) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  g.box(x, y, z, 0.1, 2.9, 0.1, PAL.woodDark, { kind: K.Wood });
  g.box(x, y + 2.9, z, 0.18, 0.17, 0.2, BONE);
  g.box(x + 0.01, y + 2.97, z + 0.1, 0.1, 0.04, 0.01, '#141018');
  g.box(x, y + 2.55, z, 0.9, 0.05, 0.05, PAL.woodDark);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const x0 = -0.4 + (i * 0.8) / n, x1 = -0.4 + ((i + 1) * 0.8) / n;
    const bot = 1.2 + r() * 0.35;
    g.push().translate(x, y, z);
    g.quad([x0, bot, 0.03], [x1, bot, 0.03], [x1, 2.52, 0.03], [x0, 2.52, 0.03], col, { kind: K.Cloth, wind: 0.8 });
    g.quad([x1, bot, 0.03], [x0, bot, 0.03], [x0, 2.52, 0.03], [x1, 2.52, 0.03], col, { kind: K.Cloth, wind: 0.8 });
    g.pop();
  }
  // The red hand.
  g.box(x, y + 1.9, z + 0.045, 0.2, 0.22, 0.01, '#8a1a14', { wind: 0.5 });
  for (let k = 0; k < 4; k++) g.box(x - 0.08 + k * 0.055, y + 2.12, z + 0.045, 0.035, 0.1, 0.01, '#8a1a14', { wind: 0.55 });
  b.collide({ kind: 'c', x, z, r: 0.12, y0: y - 1, y1: y + 3 });
}

/** Spears stacked in a cone. */
export function spearStack(b: Builder, x: number, z: number) {
  const g = b.g(x, z), y = b.y(x, z);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const fx = x + Math.cos(a) * 0.5, fz = z + Math.sin(a) * 0.5;
    g.beam([fx, y, fz], [x - Math.cos(a) * 0.15, y + 1.9, z - Math.sin(a) * 0.15], 0.025, PAL.woodLight);
    g.beam([x - Math.cos(a) * 0.15, y + 1.9, z - Math.sin(a) * 0.15], [x - Math.cos(a) * 0.2, y + 2.15, z - Math.sin(a) * 0.2], 0.035, '#8a8a94');
  }
  b.collide({ kind: 'c', x, z, r: 0.5, y0: y - 1, y1: y + 2 });
}

// ---------- the raided farm ----------

/** Crops in rows matching the furrows: wheat or cabbages. skip(x, z) leaves trampled or burned gaps. */
export function crops(b: Builder, x0: number, z0: number, x1: number, z1: number, kind: 'wheat' | 'cabbage', skip: (x: number, z: number) => boolean) {
  const r = b.rng;
  // The furrow pattern puts crop lines where fract(x * 1.6) is 0.45..1.
  for (let n = Math.ceil(x0 * 1.6); (n + 0.725) / 1.6 < x1 - 0.2; n++) {
    const x = (n + 0.725) / 1.6;
    for (let z = z0 + 0.35; z < z1 - 0.3; z += kind === 'wheat' ? 0.32 : 0.5) {
      const px = x + (r() - 0.5) * 0.06, pz = z + (r() - 0.5) * 0.1;
      if (skip(px, pz)) {
        if (r() < 0.25) b.d(px, pz).box(px, b.y(px, pz), pz, 0.04, 0.08 + r() * 0.1, 0.04, CHAR, BACK);
        continue;
      }
      const g = b.d(px, pz), y = b.y(px, pz);
      if (kind === 'wheat') {
        const h = 0.4 + r() * 0.15, col = r() < 0.5 ? '#b8a850' : '#a8a048';
        g.box(px, y, pz, 0.05, h, 0.04, col, { wind: 0.9, ...BACK });
        g.box(px, y + h, pz, 0.08, 0.12, 0.07, '#d8c070', { wind: 1, ...BACK });
      } else {
        g.blob(px, y + 0.1, pz, 0.15, 0.11, 0.15, r() < 0.5 ? '#5a8a3a' : '#4a7a34', Math.floor(r() * 999), { kind: K.Leaves, flatBottom: true });
      }
    }
  }
}

/** What's left of a barn after the goblins came: two charred walls, a fallen roof, still smoking. */
export function burnedBarn(b: Builder, x: number, z: number) {
  const g = b.g(x, z), gl = b.gl(x, z), y = b.y(x, z), r = b.rng;
  const W = 5, D = 4, x0 = x - W / 2, z0 = z - D / 2;
  // Stone footing all round.
  for (const [cx, cz, sx, sz] of [[x, z0, W, 0.35], [x, z0 + D, W, 0.35], [x0, z, 0.35, D], [x0 + W, z, 0.35, D]]) g.box(cx, y - 0.05, cz, sx, 0.3, sz, PAL.stoneDark, { kind: K.Brick });
  // Back (north) and west walls still stand, charred and gapped.
  for (let k = 0; k <= 5; k++) g.box(x0 + (k * W) / 5, y, z0, 0.18, k % 2 ? 1.8 + r() : 2.6, 0.18, CHAR, { kind: K.Wood });
  for (let px = x0 + 0.1; px < x0 + W - 0.2; px += 0.3) if (r() < 0.75) g.box(px, y + 0.2, z0 - 0.05, 0.28, 0.6 + r() * 1.4, 0.06, r() < 0.5 ? CHAR : '#3a2c22', { kind: K.Wood });
  for (let k = 0; k <= 4; k++) g.box(x0, y, z0 + (k * D) / 4, 0.18, k === 0 ? 2.6 : 1.2 + r() * 1.2, 0.18, CHAR, { kind: K.Wood });
  for (let pz = z0 + 0.1; pz < z0 + D - 0.4; pz += 0.3) if (r() < 0.6) g.box(x0 - 0.05, y + 0.2, pz, 0.06, 0.4 + r() * 1.1, 0.28, r() < 0.5 ? CHAR : '#3a2c22', { kind: K.Wood });
  // Two lone posts on the open sides, a rafter still leaning on one.
  g.box(x0 + W, y, z0 + D, 0.18, 1.6, 0.18, CHAR, { kind: K.Wood });
  g.box(x0 + W, y, z0, 0.18, 2.3, 0.18, CHAR, { kind: K.Wood });
  g.beam([x0 + 0.2, y + 2.5, z0 + 0.2], [x0 + W - 0.3, y + 0.1, z0 + D * 0.6], 0.08, CHAR, { kind: K.Wood });
  g.beam([x0 + W, y + 2.2, z0], [x0 + 2, y + 0.1, z0 + D - 0.4], 0.07, CHAR, { kind: K.Wood });
  // The roof came down inside: a sloped slab of burned thatch and planks.
  g.push().translate(x - 0.3, y + 0.35, z + 0.2).rotateZ(0.32).rotateY(0.15);
  g.box(0, 0, 0, 3.0, 0.14, 2.4, '#3a3024', { kind: K.Thatch });
  g.pop();
  g.blob(x + 0.9, y + 0.1, z + 0.6, 0.9, 0.35, 0.7, '#2a2420', Math.floor(r() * 999), { kind: K.Dirt, flatBottom: true, jitter: 0.35 });
  // Embers glowing in the ash.
  for (let i = 0; i < 16; i++) {
    const s = 0.05 + r() * 0.08;
    gl.box(x - 1.4 + r() * 3.2, y + 0.12 + r() * 0.35, z - 1.2 + r() * 2.6, s, 0.03, s * (0.6 + r()), EMBER, { kind: 1 });
  }
  b.fx.addEmitter({ x: x + 0.4, y: y + 0.6, z: z + 0.4, rate: 1.8, spec: ASH, spread: 1.2, vy: 0.55 });
  b.fx.addEmitter({ x: x - 0.6, y: y + 0.5, z: z - 0.2, rate: 1.0, spec: ASH, spread: 0.8, vy: 0.45 });
  b.fx.addEmitter({ x, y: y + 0.4, z: z + 0.3, rate: 1.2, spec: P.ember, spread: 1.4, vy: 0.6 });
  b.lights.add(x + 0.3, y + 0.6, z + 0.4, 0xff6a20, 4, 6, 0.45);
  b.fires.push({ x, y, z, big: false });
  b.collide({ kind: 'b', x0: x0 - 0.1, z0: z0 - 0.15, x1: x0 + W + 0.1, z1: z0 + 0.15, y0: y - 1, y1: y + 2.6 });
  b.collide({ kind: 'b', x0: x0 - 0.15, z0: z0, x1: x0 + 0.15, z1: z0 + D, y0: y - 1, y1: y + 2.6 });
  b.collide({ kind: 'c', x: x + 0.7, z: z + 0.5, r: 1.0, y0: y - 1, y1: y + 0.9 });
  b.collide({ kind: 'c', x: x0 + W, z: z0 + D, r: 0.15, y0: y - 1, y1: y + 1.6 });
}

/** A goblin stew pot on a tripod over a fire. */
export function cauldron(b: Builder, x: number, z: number) {
  const g = b.g(x, z), y = b.y(x, z);
  b.campfire(x, z);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    g.beam([x + Math.cos(a) * 0.85, y, z + Math.sin(a) * 0.85], [x, y + 1.7, z], 0.04, PAL.woodDark, { kind: K.Wood });
  }
  g.beam([x, y + 1.7, z], [x, y + 1.1, z], 0.015, PAL.iron);
  g.cyl(x, y + 0.5, z, 0.3, 0.42, 0.28, 9, '#2a2a30', { kind: K.Metal });
  g.cyl(x, y + 0.78, z, 0.42, 0.38, 0.2, 9, '#2a2a30', { kind: K.Metal, top: '#4a3a1a' });
  b.fx.addEmitter({ x, y: y + 1.1, z, rate: 1.1, spec: ASH, spread: 0.3, vy: 0.4 });
}
