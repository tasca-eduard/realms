import * as THREE from 'three';
import type { Geo } from '../engine/geo';
import { K } from '../engine/materials';
import { P } from '../engine/particles';
import { hash2, mulberry32 } from '../engine/util';
import { GLOW, PAL, type Builder } from './builder';
import type { Grid } from './grid';

// ---------------------------------------------------------------------------
// Props of the Old Wood (Whisperwood): the Warden's thorns, the Great Tree.
// Realm 1 uses them too, where the Old Wood reaches into Blackpine.
// ---------------------------------------------------------------------------

export const WOOD = {
  // The prototype's thorn colours: green canes, bone-pale thorns, red berries.
  thorn: '#4a5e2a',
  thornDark: '#35451f',
  thornTip: '#e8e2d4',
  berry: '#d02a3a',
  leaf: '#2f5a26',
  leaf2: '#3b6b2a',
  bark: '#4a3a2c',
  barkDark: '#33281f',
  moss: '#44603a',
  glow: [1.6, 2.2, 0.5] as [number, number, number],
};

/**
 * A tangle of the Warden's briar about `h` high: arching canes studded with pale thorns,
 * dark leaves, red berries, and (sap) a few beads of faintly glowing sap. No collider.
 */
export function bramble(b: Builder, x: number, z: number, s = 1, h = 1.6, sap = false) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  const canes = 6 + Math.floor(r() * 4);
  for (let i = 0; i < canes; i++) {
    const a = r() * Math.PI * 2, reach = (0.5 + r() * 0.6) * s;
    const top: [number, number, number] = [x + Math.cos(a) * reach * 0.4, y + h * (0.6 + r() * 0.5) * s, z + Math.sin(a) * reach * 0.4];
    const end: [number, number, number] = [x + Math.cos(a) * reach * 1.3, y + h * 0.15 * s, z + Math.sin(a) * reach * 1.3];
    const base: [number, number, number] = [x + (r() - 0.5) * 0.3 * s, y - 0.05, z + (r() - 0.5) * 0.3 * s];
    const col = r() < 0.5 ? WOOD.thorn : WOOD.thornDark;
    g.beam(base, top, 0.08 * s, col, { kind: K.Bark, wind: 0.1 });
    g.beam(top, end, 0.065 * s, col, { kind: K.Bark, wind: 0.2 });
    // Thorns along both halves of the arch.
    for (let k = 1; k < 7; k++) {
      const t = k / 7, [a0, a1] = t < 0.5 ? [base, top] : [top, end], u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
      const px = a0[0] + (a1[0] - a0[0]) * u, py = a0[1] + (a1[1] - a0[1]) * u, pz = a0[2] + (a1[2] - a0[2]) * u;
      g.box(px + (k % 2 ? 0.06 : -0.06) * s, py + 0.04, pz, 0.045 * s, 0.16 * s, 0.045 * s, WOOD.thornTip, { wind: 0.2 });
    }
  }
  for (let i = 0; i < 4; i++) {
    const a = r() * Math.PI * 2, d = r() * 0.5 * s;
    g.blob(x + Math.cos(a) * d, y + h * (0.25 + r() * 0.55) * s, z + Math.sin(a) * d, 0.45 * s, 0.35 * s, 0.45 * s, r() < 0.5 ? WOOD.leaf : WOOD.leaf2, Math.floor(r() * 999), { kind: K.Leaves, wind: 0.3, jitter: 0.25 });
  }
  for (let i = 0; i < 5; i++) if (r() < 0.8) g.box(x + (r() - 0.5) * s, y + (0.3 + r() * h * 0.8) * s, z + (r() - 0.5) * s, 0.09, 0.09, 0.09, WOOD.berry);
  if (sap) for (let i = 0; i < 2; i++) b.gl(x, z).box(x + (r() - 0.5) * 0.8 * s, y + (0.5 + r() * h * 0.7) * s, z + (r() - 0.5) * 0.8 * s, 0.07, 0.07, 0.07, WOOD.glow, {});
}

type V3 = [number, number, number];

// ---------------------------------------------------------------------------
// Living wood: trunks, roots and boughs as knobbly tubes that taper, lean, wander and fork (never
// a straight post or a square beam). Each plant rolls its own dice from where it stands, so the
// realm's dice (and everything placed after it) don't shift.
// ---------------------------------------------------------------------------

/** A plant's own dice, from where it stands. */
export const diceAt = (x: number, z: number, k = 0) => mulberry32(Math.floor(hash2(Math.round(x * 10), Math.round(z * 10), 917 + k) * 2147483647));

/**
 * A trunk from under the ground up `h`: `rb` round at the foot and flaring wider in its lowest
 * metre or so (`flare`), `rt` at the top; it leans (`lean` metres off at the top, curving over)
 * and wanders a little as it rises (straight up to `straight`), knobbly. Returns its middle at a
 * height (to grow boughs from).
 */
export function trunkUp(g: Geo, x: number, y: number, z: number, rb: number, rt: number, h: number, col: string, d: () => number, o: { seg?: number; lean?: number; sway?: number; flare?: number; lumpy?: number; straight?: number; wind?: number } = {}) {
  const steps = Math.max(6, Math.round(h / 1.1)), la = d() * Math.PI * 2, lean = o.lean ?? 0, sway = o.sway ?? 0.1, flare = o.flare ?? 0.3;
  const pts: V3[] = [], rad: number[] = [];
  let sx = 0, sz = 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, hh = -0.6 + (h + 0.6) * t;
    if (hh > (o.straight ?? 0.5)) {
      sx += (d() - 0.5) * sway;
      sz += (d() - 0.5) * sway;
    }
    const off = lean * Math.pow(Math.max(0, hh) / h, 1.7);
    pts.push([x + Math.cos(la) * off + sx, y + hh, z + Math.sin(la) * off + sz]);
    rad.push((rb + (rt - rb) * t) * (1 + flare * Math.pow(Math.max(0, 1 - Math.max(0, hh) / 1.4), 2)));
  }
  g.sweep(pts, rad, col, { kind: K.Bark, seg: o.seg ?? 10, lumpy: o.lumpy ?? 0.09, seed: Math.floor(d() * 9999), wind: o.wind });
  return (hy: number): V3 => {
    const f = Math.max(0, Math.min(steps - 1e-3, ((hy - y + 0.6) / (h + 0.6)) * steps)), i = Math.floor(f), u = f - i;
    return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, hy, pts[i][2] + (pts[i + 1][2] - pts[i][2]) * u];
  };
}

/**
 * A root from (sx, sz), `h0` above the ground there, out along heading `a`: it arches down to the
 * ground, runs on half-sunk, wandering and thinning, and dives in `reach` further out; thick ones
 * fork. `thick` is its radius at the start. Where it arches high off the ground it's in the way
 * (a collider), so it's never walked through.
 */
export function rootFrom(b: Builder, g: Geo, sx: number, sz: number, a: number, reach: number, thick: number, h0: number, col: string, d: () => number, fork = true) {
  const steps = Math.max(4, Math.round(reach / 0.5));
  const pts: V3[] = [], rad: number[] = [], heads: number[] = [];
  let an = a, px = sx, pz = sz;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (i > 0) {
      an += (d() - 0.5) * 0.32;
      px += (Math.cos(an) * reach) / steps;
      pz += (Math.sin(an) * reach) / steps;
    }
    const r = thick * (1 - 0.8 * Math.pow(t, 0.8)) * (i > 0 && d() < 0.2 ? 1.15 : 1);
    const lift = h0 * Math.pow(Math.max(0, 1 - t * 1.8), 2) + r * 0.3 - (t > 0.78 ? (t - 0.78) * 5 * r : 0);
    pts.push([px, b.y(px, pz) + lift, pz]);
    rad.push(r);
    heads.push(an);
  }
  g.sweep(pts, rad, col, { kind: K.Bark, seg: thick > 0.3 ? 7 : 5, lumpy: 0.2, seed: Math.floor(d() * 9999), squash: 0.8 });
  for (let i = 0; i < steps; i++) {
    const [qx, qy, qz] = pts[i];
    if (qy + rad[i] * 0.8 - b.y(qx, qz) > 0.75 && rad[i] > 0.2) b.collide({ kind: 'c', x: qx, z: qz, r: rad[i] * 0.85, y0: qy - 3, y1: qy + rad[i] * 0.8 });
  }
  if (fork && thick > 0.24) {
    const k = Math.max(2, Math.floor(steps * (0.3 + d() * 0.25))), side = d() < 0.5 ? -1 : 1;
    const [fx, fy, fz] = pts[k];
    rootFrom(b, g, fx, fz, heads[k] + side * (0.55 + d() * 0.4), reach * (0.35 + d() * 0.2), rad[k] * 0.62, Math.max(0, fy - b.y(fx, fz) - rad[k] * 0.3), col, d, false);
  }
}

/** A root out of a trunk: from `rt` off its middle (x, z), `h0` up its bark. */
export function rootOut(b: Builder, g: Geo, x: number, z: number, a: number, rt: number, reach: number, thick: number, h0: number, col: string, d: () => number, fork = true) {
  rootFrom(b, g, x + Math.cos(a) * rt, z + Math.sin(a) * rt, a, reach, thick, h0, col, d, fork);
}

/** The path of a bough from `from` to `to`: bowed (it dips, then lifts toward its tip), wobbling, tapering r0 to r1. */
export function boughPath(from: V3, to: V3, r0: number, r1: number, d: () => number, steps = 5, bow = 0.12) {
  const L = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const w1 = [d() - 0.5, d() - 0.5, d() - 0.5], w2 = [d() - 0.5, d() - 0.5, d() - 0.5];
  const pts: V3[] = [], rad: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, s1 = Math.sin(t * Math.PI) * L * 0.16, s2 = Math.sin(t * Math.PI * 2) * L * 0.08;
    pts.push([
      from[0] + (to[0] - from[0]) * t + w1[0] * s1 + w2[0] * s2,
      from[1] + (to[1] - from[1]) * t - Math.sin(t * Math.PI) * bow * L + w1[1] * s1 * 0.5,
      from[2] + (to[2] - from[2]) * t + w1[2] * s1 + w2[2] * s2,
    ]);
    rad.push(r0 + (r1 - r0) * Math.pow(t, 0.9));
  }
  return { pts, rad };
}

/** A bough drawn whole. */
export function bough(g: Geo, from: V3, to: V3, r0: number, r1: number, col: string, d: () => number, wind = 0) {
  const { pts, rad } = boughPath(from, to, r0, r1, d, Math.max(3, Math.round(Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]) / 0.9)));
  g.sweep(pts, rad, col, { kind: K.Bark, seg: r0 > 0.25 ? 7 : 5, lumpy: 0.12, seed: Math.floor(d() * 9999), wind });
}

/** Moss hugging a trunk's north side, in lumps from the ground up to `h`. */
function trunkMoss(g: Geo, at: (h: number) => V3, y: number, rAt: (h: number) => number, h: number, d: () => number) {
  for (let k = 0; k < 4; k++) {
    const hy = y + 0.2 + (h * k) / 4 + d() * 0.3, [cx, , cz] = at(hy), r = rAt(hy - y);
    g.blob(cx + (d() - 0.5) * r * 0.5, hy, cz - r * 0.9, r * 0.55, 0.35 + d() * 0.25, r * 0.28, k % 2 ? WOOD.moss : '#3d5a33', Math.floor(d() * 999), { kind: K.Grass, jitter: 0.3 });
  }
}

/**
 * A great withered oak of the Warden's heights: a thick grey trunk on buttress roots, heavy bare
 * limbs twisting out and forking, grey-green moss hanging from their ends.
 */
export function witheredOak(b: Builder, x: number, z: number, s = 1) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng, d = diceAt(x, z, 1);
  const bark = r() < 0.5 ? PAL.dead : '#5e564c';
  const rootA: number[] = [];
  for (let i = 0; i < 5; i++) rootA.push((i / 5) * Math.PI * 2 + r() * 0.8);
  const top: V3 = [x + (r() - 0.5) * 0.7 * s, y + 3.5 * s, z + (r() - 0.5) * 0.7 * s];
  // The trunk: thick and gnarled, straight up and then over toward its top, where the limbs spring.
  const tp: V3[] = [], tr: number[] = [];
  for (let i = 0; i <= 7; i++) {
    const t = i / 7, hy = -0.4 + (3.5 * s + 0.4) * t, k = Math.max(0, Math.min(1, (hy - 1.2 * s) / (2.3 * s)));
    tp.push([x + (top[0] - x) * k * k * (3 - 2 * k) + (i > 1 && i < 7 ? (d() - 0.5) * 0.12 * s : 0), y + hy, z + (top[2] - z) * k * k * (3 - 2 * k) + (i > 1 && i < 7 ? (d() - 0.5) * 0.12 * s : 0)]);
    tr.push((0.58 - 0.26 * t) * s * (1 + 0.35 * Math.pow(Math.max(0, 1 - Math.max(0, hy) / 1.1), 2)) * (i === 3 || i === 5 ? 1.12 : 1));
  }
  g.sweep(tp, tr, bark, { kind: K.Bark, seg: 8, lumpy: 0.16, seed: Math.floor(d() * 9999) });
  for (const a of rootA) rootOut(b, g, x, z, a, 0.35 * s, 1.3 * s, 0.2 * s, 0.8 * s, bark, d);
  const limb = (from: V3, a: number, len: number, rad: number, depth: number) => {
    const to: V3 = [from[0] + Math.cos(a) * len, from[1] + len * (0.2 + r() * 0.5), from[2] + Math.sin(a) * len];
    bough(g, from, to, rad * 1.1, rad * 0.62, bark, d, depth < 2 ? 0.06 : 0);
    if (depth > 0) for (let k = 0; k < 2; k++) limb(to, a + (r() - 0.5) * 1.7, len * 0.62, rad * 0.62, depth - 1);
    else if (r() < 0.55) g.beam(to, [to[0] + (r() - 0.5) * 0.1, to[1] - 0.45 - r() * 0.8, to[2]], 0.035, r() < 0.5 ? '#5a6a4a' : '#6a7458', { wind: 0.6 });
  };
  const n = 3 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const k = 0.55 + (i / n) * 0.4;
    limb([x + (top[0] - x) * k, y + (1.8 + (3.5 - 1.8) * k) * s, z + (top[2] - z) * k], (i / n) * Math.PI * 2 + r() * 0.9, 1.6 * s, 0.17 * s, 2);
  }
  limb(top, r() * Math.PI * 2, 1.1 * s, 0.14 * s, 1);
  b.collide({ kind: 'c', x, z, r: 0.55 * s, y0: y - 1, y1: y + 4 * s });
}

/** A dead shrub: a clump of bare grey twigs (no collider: the knight pushes through it). */
export function deadShrub(b: Builder, x: number, z: number, s = 1) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  const n = 6 + Math.floor(r() * 6);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, len = (0.4 + r() * 0.5) * s, col = r() < 0.5 ? PAL.dead : '#6a5a48';
    const base: V3 = [x + (r() - 0.5) * 0.3 * s, y - 0.02, z + (r() - 0.5) * 0.3 * s];
    const tip: V3 = [base[0] + Math.cos(a) * len * 0.6, y + len * (0.6 + r() * 0.6), base[2] + Math.sin(a) * len * 0.6];
    g.beam(base, tip, 0.022 * s, col, { kind: K.Bark, wind: 0.35 });
    const mid: V3 = [(base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2, (base[2] + tip[2]) / 2];
    g.beam(mid, [mid[0] + Math.cos(a + 1.1) * len * 0.3, mid[1] + len * 0.28, mid[2] + Math.sin(a + 1.1) * len * 0.3], 0.015 * s, col, { wind: 0.45 });
  }
}

/**
 * A thorn creeper running low over the ground along pts: a cane arching in and out of the soil,
 * thorns along it, the odd leaf and berry, a glowing bud at its tip (the Warden's thorns spreading).
 */
export function thornCreeper(b: Builder, pts: [number, number][], s = 1) {
  if (pts.length < 2) return;
  const [x0, z0] = pts[0], g = b.g(x0, z0), gl = b.gl(x0, z0), r = b.rng;
  let prev: V3 | null = null;
  const n = pts.length;
  pts.forEach(([x, z], i) => {
    const taper = 1 - i / n;
    const p: V3 = [x, b.y(x, z) + 0.03 + Math.abs(Math.sin(i * 0.8 + r() * 0.6)) * 0.3 * s * (0.35 + taper * 0.65), z];
    if (prev) {
      g.beam(prev, p, (0.03 + 0.05 * taper) * s, i % 3 ? WOOD.thorn : WOOD.thornDark, { kind: K.Bark });
      const m: V3 = [(prev[0] + p[0]) / 2, (prev[1] + p[1]) / 2, (prev[2] + p[2]) / 2];
      g.box(m[0] + (i % 2 ? 0.05 : -0.05), m[1] + 0.05, m[2], 0.035, 0.12, 0.035, WOOD.thornTip);
      if (r() < 0.12) g.blob(m[0], m[1] + 0.08, m[2], 0.18 * s, 0.12 * s, 0.18 * s, r() < 0.5 ? WOOD.leaf : WOOD.leaf2, Math.floor(r() * 999), { kind: K.Leaves, jitter: 0.3 });
      if (r() < 0.05) g.box(m[0], m[1] + 0.12, m[2], 0.07, 0.07, 0.07, WOOD.berry);
    }
    prev = p;
  });
  if (prev) gl.box((prev as V3)[0], (prev as V3)[1] + 0.06, (prev as V3)[2], 0.08, 0.08, 0.08, WOOD.glow, {});
}

/** Thorn canes spiralling up a trunk (radius rad) to height h. */
export function thornClimb(b: Builder, x: number, z: number, rad: number, h: number) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  for (let c = 0; c < 2; c++) {
    let a = r() * Math.PI * 2, prev: V3 = [x + Math.cos(a) * rad, y, z + Math.sin(a) * rad];
    for (let k = 1; k <= 10; k++) {
      a += 0.75 + r() * 0.3;
      const p: V3 = [x + Math.cos(a) * rad, y + (k / 10) * h, z + Math.sin(a) * rad];
      g.beam(prev, p, 0.035, c ? WOOD.thorn : WOOD.thornDark, { kind: K.Bark });
      g.box(p[0] + Math.cos(a) * 0.06, p[1], p[2] + Math.sin(a) * 0.06, 0.035, 0.11, 0.035, WOOD.thornTip);
      prev = p;
    }
  }
}

/** A wall of briar along a line, solid to walk into (a real, visible thicket). */
export function thicket(b: Builder, pts: [number, number][], h = 1.8, depth = 1.2, step = 0.8) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az);
    for (let d = 0; d < len; d += step) {
      const x = ax + ((bx - ax) * d) / len + (b.rng() - 0.5) * 0.3, z = az + ((bz - az) * d) / len + (b.rng() - 0.5) * 0.3;
      bramble(b, x, z, 0.9 + b.rng() * 0.5, h, b.rng() < 0.3);
    }
    const nx = -(bz - az) / len, nz = (bx - ax) / len;
    // One collider per segment: a box around the line.
    const x0 = Math.min(ax, bx) - Math.abs(nx) * depth / 2, x1 = Math.max(ax, bx) + Math.abs(nx) * depth / 2;
    const z0 = Math.min(az, bz) - Math.abs(nz) * depth / 2, z1 = Math.max(az, bz) + Math.abs(nz) * depth / 2;
    const y = b.y((ax + bx) / 2, (az + bz) / 2);
    b.collide({ kind: 'b', x0, z0, x1, z1, y0: y - 3, y1: y + h + 2 });
  }
}

/**
 * A giant mushroom of the Old Wood's dells: a pale stem, a broad cap, a ring of glow beneath it.
 * `light` adds a lamp of its glow (give it to every other one: lights are dear).
 */
export function giantMushroom(b: Builder, x: number, z: number, s = 1, light = false) {
  const g = b.g(x, z), gl = b.gl(x, z), y = b.y(x, z), r = b.rng;
  const h = (1.8 + r() * 1.3) * s, cap = (1 + r() * 0.45) * s;
  g.cyl(x, y - 0.1, z, 0.24 * s, 0.16 * s, h, 7, '#d8cfb8', { kind: K.Bark });
  g.blob(x, y + h, z, cap, 0.42 * s, cap, r() < 0.5 ? '#6a3a7a' : '#3a4a8a', Math.floor(r() * 999), { kind: K.Leaves, jitter: 0.12, flatBottom: true });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + r();
    g.box(x + Math.cos(a) * cap * 0.55, y + h + 0.3 * s, z + Math.sin(a) * cap * 0.55, 0.14 * s, 0.05, 0.14 * s, '#e8e0d0');
  }
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    gl.box(x + Math.cos(a) * cap * 0.62, y + h - 0.05, z + Math.sin(a) * cap * 0.62, 0.12 * s, 0.04, 0.12 * s, [0.6, 1.4, 2.6], {});
  }
  if (light) b.lights.add(x, y + h - 0.5, z, 0x80a0ff, 2.5, 3.5 * s, 0.1);
  b.collide({ kind: 'c', x, z, r: 0.26 * s, y0: y - 1, y1: y + h });
}

/**
 * The Great Tree of the Old Wood: a trunk as wide as a tower, roots like walls, and a
 * crown lit by glowing seed-pods (the landmark the prototype drew on Whisperwood's horizon).
 */
export function greatTree(b: Builder, x: number, z: number, s = 1, o: { clearToward?: number } = {}) {
  const g = b.g(x, z), gl = b.gl(x, z), y = b.y(x, z), r = b.rng, d = diceAt(x, z, 3);
  // A vast gnarled trunk, leaning a little, flaring at its foot.
  const at = trunkUp(g, x, y - 0.4, z, 2.6 * s, 1.5 * s, 18.4 * s, WOOD.bark, d, { seg: 14, lean: 0.9 * s, sway: 0.22, flare: 0.22, lumpy: 0.1, straight: 2 });
  b.collide({ kind: 'c', x, z, r: 2.5 * s, y0: y - 2, y1: y + 20 * s });
  trunkMoss(g, at, y, (h) => 2.6 * s - 1.1 * s * Math.min(1, h / (18 * s)), 4 * s, d);
  // Great roots leaving the trunk high up, arching down and running out over the ground, forking
  // (none toward `clearToward`, where its arena's own roots are).
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r() * 0.4;
    if (o.clearToward !== undefined && Math.abs(Math.atan2(Math.sin(a - o.clearToward), Math.cos(a - o.clearToward))) < 1.15) continue;
    rootOut(b, g, x, z, a, 2.2 * s, 4.2 * s, 0.75 * s, 2.6 * s, WOOD.barkDark, d);
  }
  // Great limbs, and the crown on them (a structure that fades when it hides the knight).
  const cs = b.structure('great crown', new THREE.Box3(new THREE.Vector3(x - 11 * s, y + 10 * s, z - 11 * s), new THREE.Vector3(x + 11 * s, y + 28 * s, z + 11 * s)));
  const crown: [number, number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + r() * 0.5, from = y + (12 + r() * 4) * s;
    const to: [number, number, number] = [x + Math.cos(a) * 7 * s, from + (4 + r() * 3) * s, z + Math.sin(a) * 7 * s];
    bough(cs.core, at(from), to, 0.85 * s, 0.35 * s, WOOD.bark, d);
    crown.push(to);
  }
  crown.push([x, y + 24 * s, z]);
  for (const [cx, cy, cz] of crown)
    for (let k = 0; k < 4; k++)
      cs.core.blob(cx + (r() - 0.5) * 4 * s, cy + (k === 3 ? 1 : (r() - 0.4) * 1.5) * s, cz + (r() - 0.5) * 4 * s, (2 + r() * 1) * s, (1.5 + r() * 0.6) * s, (2 + r() * 1) * s, b.tone('great', x, z, k === 3 ? '#4a7a34' : r() < 0.5 ? WOOD.leaf : WOOD.leaf2), Math.floor(r() * 999), { kind: K.Leaves, wind: 0.15, jitter: 0.3, detail: 1 });
  // Glowing seed-pods hanging in the crown.
  for (let i = 0; i < 16; i++) {
    const [cx, cy, cz] = crown[i % crown.length];
    cs.glow.box(cx + (r() - 0.5) * 5 * s, cy - (1 + r() * 2) * s, cz + (r() - 0.5) * 5 * s, 0.35 * s, 0.45 * s, 0.35 * s, WOOD.glow, {});
  }
  b.lights.add(x, y + 20 * s, z, 0xd8f070, 14, 22 * s, 0.1);
  // Low down, where the camera sees them: pods hanging from the roots and the first limbs,
  // glowing seeds drifting down, and their light on the trunk.
  for (let i = 0; i < 10; i++) {
    const a = r() * Math.PI * 2, d = (2.4 + r() * 2.2) * s;
    gl.box(x + Math.cos(a) * d, y + (1 + r() * 4) * s, z + Math.sin(a) * d, 0.28 * s, 0.38 * s, 0.28 * s, WOOD.glow, {});
  }
  b.fx.addEmitter({ x, y: y + 6 * s, z, rate: 4, spec: P.firefly, spread: 5 * s, vy: -0.15 });
  b.lights.add(x + 2.5 * s, y + 3 * s, z + 2.5 * s, 0xd8f070, 8, 10 * s, 0.15);
}

/**
 * One of Hollowbough's home trees: a giant whose trunk is a dwelling. A door in the bark at
 * ground level (facing `face`, radians round the trunk: 0 is +x), round windows lit up the
 * trunk, a stone chimney out of the bark, lanterns in the roots; and, when `treehouse`, a hut
 * on a platform up in the crown (decor, fading with the crown when it hides the knight).
 * Returns the doorstep (where its keeper stands) and the treehouse platform's centre.
 */
export function homeTree(b: Builder, x: number, z: number, s = 1, o: { face: number; treehouse?: boolean; chimney?: boolean; tint?: string } = { face: Math.PI / 4 }) {
  const g = b.g(x, z), gl = b.gl(x, z), y = b.y(x, z), r = b.rng, d = diceAt(x, z, 4);
  const R = 1.9 * s, H = 9 * s, bark = o.tint ?? WOOD.bark;
  // The trunk: straight where the doors and windows are, gnarled above; buttress roots arching out
  // of it (none across the door); moss up its north side.
  const at = trunkUp(g, x, y + 0.1, z, R, R * 0.72, H - 0.1, bark, d, { seg: 12, sway: 0.16, flare: 0.16, lumpy: 0.045, straight: 6.4 * s });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.25 + r() * 0.3;
    if (Math.abs(Math.atan2(Math.sin(a - o.face), Math.cos(a - o.face))) < 0.55) continue; // not across the door
    rootOut(b, g, x, z, a, R * 0.8, 1.7 * s, 0.46 * s, 1.9 * s, WOOD.barkDark, d);
  }
  // The trunk's radius at a height (it tapers), and something on its bark facing `a` at height h
  // (local +z points out of the trunk), in the plain geometry and in the glow.
  const rAt = (h: number) => R - R * 0.28 * Math.min(1, h / H);
  trunkMoss(g, at, y, rAt, 3.2 * s, d);
  const onBark = (geo: typeof g, a: number, h: number, out = 0) => geo.push().translate(x + Math.cos(a) * (rAt(h) + out), y + h, z + Math.sin(a) * (rAt(h) + out)).rotateY(Math.PI / 2 - a);
  // The door: a lit arch in a frame of pale wood, the plank door ajar, a little shingled hood
  // over it, a stone step.
  onBark(g, o.face, 0, -0.08);
  g.box(0, 0, 0.1, 1.3, 2.05, 0.2, PAL.woodLight, { kind: K.Wood });
  g.box(0, 0.02, 0.2, 1.0, 1.8, 0.06, '#241a12', {});
  g.box(0.42, 0.02, 0.45, 0.08, 1.75, 0.55, PAL.wood, { kind: K.Wood });
  for (const sd of [-1, 1]) {
    g.push().translate(sd * 0.42, 2.25, 0.5).rotateZ(sd * -0.55);
    g.box(0, 0, 0, 0.95, 0.08, 0.8, '#6a4a30', { kind: K.Wood });
    g.pop();
  }
  g.box(0, -0.18, 0.75, 1.3, 0.2, 0.7, PAL.stone, { kind: K.Flag });
  g.pop();
  onBark(gl, o.face, 0, -0.08);
  gl.box(0, 0.1, 0.24, 0.84, 1.6, 0.02, [1.9, 1.15, 0.45], {});
  gl.pop();
  const dx = Math.cos(o.face), dz = Math.sin(o.face);
  b.lights.add(x + dx * (R + 1.2), y + 1.2, z + dz * (R + 1.2), 0xffa050, 5, 5, 0.25);
  // Windows up the trunk: a frame, shutters open either side, a soft lit pane, a sill.
  const wins: [number, number][] = [[o.face + 0.75, 2.7 * s], [o.face - 0.65, 4.3 * s], [o.face + 0.2, 5.8 * s], [o.face - 1.35, 2.4 * s]];
  for (const [a, h] of wins) {
    onBark(g, a, h, -0.04);
    g.box(0, 0, 0.06, 0.62, 0.62, 0.1, PAL.woodDark, { kind: K.Wood });
    for (const sd of [-0.46, 0.46]) g.box(sd, 0.02, 0.12, 0.26, 0.56, 0.05, '#5a3a22', { kind: K.Wood });
    g.box(0, -0.06, 0.2, 0.7, 0.07, 0.22, PAL.wood, { kind: K.Wood });
    g.pop();
    onBark(gl, a, h, -0.04);
    gl.box(0, 0.06, 0.12, 0.44, 0.46, 0.02, [1.7, 1.05, 0.42], {});
    gl.pop();
  }
  // A lantern hung from a root by the door.
  const la = o.face + 0.9, lx = x + Math.cos(la) * (R + 1.1), lz = z + Math.sin(la) * (R + 1.1);
  g.beam([x + Math.cos(la) * R * 0.8, y + 2.6, z + Math.sin(la) * R * 0.8], [lx, y + 2.2, lz], 0.06, WOOD.barkDark, { kind: K.Bark });
  g.beam([lx, y + 2.2, lz], [lx, y + 1.75, lz], 0.012, '#8a7a5a');
  gl.box(lx, y + 1.6, lz, 0.2, 0.28, 0.2, GLOW.window, {});
  b.lights.add(lx, y + 1.5, lz, 0xffa050, 4, 5, 0.2);
  // A stone chimney out of the bark on the far side, smoking.
  if (o.chimney !== false) {
    const ca = o.face + Math.PI + 0.5, cx = x + Math.cos(ca) * (R + 0.3), cz = z + Math.sin(ca) * (R + 0.3);
    g.box(cx, y + 5.2 * s, cz, 0.5, 2.4, 0.5, PAL.stoneDark, { kind: K.Brick });
    b.fx.addEmitter({ x: cx, y: y + 7.8 * s, z: cz, rate: 0.8, spec: P.smoke, spread: 0.15, vy: 0.4 });
  }
  b.collide({ kind: 'c', x, z, r: R + 0.35, y0: y - 2, y1: y + H + 4 });
  // The crown (and the treehouse in it) fades when it hides the knight.
  const top = y + H, span = 7 * s;
  const cs = b.structure('crown', new THREE.Box3(new THREE.Vector3(x - span, y + 5.5 * s, z - span), new THREE.Vector3(x + span, top + 6 * s, z + span)));
  const crown: [number, number, number][] = [[x, top + 2.5 * s, z]];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + r() * 0.5, from = y + (6.5 + r() * 2) * s;
    const to: [number, number, number] = [x + Math.cos(a) * 5 * s, from + (2 + r() * 1.5) * s, z + Math.sin(a) * 5 * s];
    bough(cs.core, at(from), to, 0.5 * s, 0.2 * s, bark, d);
    crown.push(to);
  }
  for (const [cx, cy, cz] of crown)
    for (let k = 0; k < 3; k++)
      cs.core.blob(cx + (r() - 0.5) * 3 * s, cy + (r() - 0.3) * 1.2 * s, cz + (r() - 0.5) * 3 * s, (1.9 + r() * 0.8) * s, (1.4 + r() * 0.5) * s, (1.9 + r() * 0.8) * s, b.tone('home', x, z, r() < 0.5 ? WOOD.leaf : WOOD.leaf2), Math.floor(r() * 999), { kind: K.Leaves, wind: 0.2, jitter: 0.3, detail: 1 });
  let deck: [number, number, number] | null = null;
  if (o.treehouse) {
    // A plank platform round the trunk, a round hut with a thatched cone on the near side, a
    // rail, a rope ladder hanging down toward the door.
    const py = y + 6.4 * s, pr = R + 1.7;
    deck = [x, py, z];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      cs.core.push().translate(x + Math.cos(a) * (R + 0.8), py, z + Math.sin(a) * (R + 0.8)).rotateY(Math.PI / 2 - a);
      cs.core.box(0, -0.1, 0, 0.8, 0.12, pr - R + 0.1, i % 3 ? PAL.wood : PAL.woodDark, { kind: K.Wood });
      cs.core.pop();
      if (i % 2 === 0) cs.core.beam([x + Math.cos(a) * pr, py, z + Math.sin(a) * pr], [x + Math.cos(a) * pr, py + 0.85, z + Math.sin(a) * pr], 0.04, PAL.woodDark, { kind: K.Wood });
      cs.core.beam([x + Math.cos(a) * pr, py + 0.85, z + Math.sin(a) * pr], [x + Math.cos(a + Math.PI / 8) * pr, py + 0.85, z + Math.sin(a + Math.PI / 8) * pr], 0.03, '#8a7a5a');
      if (i % 4 === 1) cs.core.beam([x + Math.cos(a) * R * 0.9, py - 1.6, z + Math.sin(a) * R * 0.9], [x + Math.cos(a) * pr, py - 0.1, z + Math.sin(a) * pr], 0.1, WOOD.barkDark, { kind: K.Bark });
    }
    const ha = o.face + 0.35, hx = x + Math.cos(ha) * (R + 0.9), hz = z + Math.sin(ha) * (R + 0.9);
    cs.core.cyl(hx, py, hz, 1.05, 1.05, 1.5, 9, '#8a7658', { kind: K.Wood });
    cs.core.cyl(hx, py + 1.45, hz, 1.45, 0, 1.4, 9, '#9a8450', { kind: K.Grass });
    cs.glow.box(hx + Math.cos(o.face) * 1.02, py + 0.8, hz + Math.sin(o.face) * 1.02, 0.36, 0.4, 0.36, GLOW.window, {});
    b.lights.add(hx + Math.cos(o.face) * 1.6, py + 0.9, hz + Math.sin(o.face) * 1.6, 0xffa050, 3, 4, 0.25);
    const ra = o.face - 0.5;
    for (const side of [-0.18, 0.18]) {
      const px = x + Math.cos(ra) * pr + Math.cos(ra + Math.PI / 2) * side, pz = z + Math.sin(ra) * pr + Math.sin(ra + Math.PI / 2) * side;
      cs.core.beam([px, py, pz], [px, y + 2.4, pz], 0.015, '#8a7a5a', { wind: 0.3 });
    }
    for (let k = y + 2.6; k < py; k += 0.45) {
      const px = x + Math.cos(ra) * pr, pz = z + Math.sin(ra) * pr;
      cs.core.box(px, k, pz, 0.4, 0.04, 0.05, PAL.wood, { kind: K.Wood });
    }
  }
  return { door: { x: x + dx * (R + 1.05), z: z + dz * (R + 1.05) }, deck };
}

/**
 * One of the Old Wood's giant oaks: a trunk two strides wide, buttress roots, a few great
 * limbs and a crown well above the rooftops. The trunk is solid.
 */
export function giantOak(b: Builder, x: number, z: number, s = 1, pods = 0) {
  const g = b.g(x, z), gl = b.gl(x, z), y = b.y(x, z), r = b.rng, d = diceAt(x, z, 2);
  const rb = 0.95 * s;
  // A gnarled trunk, leaning and wandering, flaring at its foot; buttress roots; moss up its north side.
  const at = trunkUp(g, x, y, z, rb, rb * 0.62, 8.5 * s, WOOD.bark, d, { seg: 10, lean: 0.45 * s, sway: 0.12, flare: 0.3, lumpy: 0.1 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r() * 0.6;
    rootOut(b, g, x, z, a, rb * 0.75, rb * 1.8, 0.3 * s, 1.4 * s, WOOD.barkDark, d);
  }
  trunkMoss(g, at, y, (h) => rb - rb * 0.38 * Math.min(1, h / (8.5 * s)), 2.5 * s, d);
  // The crown is its own structure: it fades when it stands between the camera and the
  // knight, like a roof (a crown this high would otherwise hide half the screen).
  const top = y + 9.5 * s, span = 4.8 * s;
  const cs = b.structure('crown', new THREE.Box3(new THREE.Vector3(x - span, y + 5 * s, z - span), new THREE.Vector3(x + span, top + 2.2 * s, z + span)));
  const crown: [number, number, number][] = [[x, top, z]];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + r() * 0.7, from = y + (5.5 + r() * 2) * s;
    const to: [number, number, number] = [x + Math.cos(a) * 3.2 * s, from + (1.8 + r() * 1.2) * s, z + Math.sin(a) * 3.2 * s];
    // (Its first stretch plain, the rest part of the crown, fading with it.)
    const { pts, rad } = boughPath(at(from), to, 0.34 * s, 0.14 * s, d, 6);
    g.sweep(pts.slice(0, 3), rad.slice(0, 3), WOOD.bark, { kind: K.Bark, seg: 7, lumpy: 0.12, seed: i + 11 });
    cs.core.sweep(pts.slice(2), rad.slice(2), WOOD.bark, { kind: K.Bark, seg: 7, lumpy: 0.12, seed: i + 11, first: 2 });
    crown.push(to);
  }
  // Leaf clusters: several smaller ones per limb, lighter on top, so it reads as foliage.
  for (const [cx, cy, cz] of crown)
    for (let k = 0; k < 3; k++) {
      const up = k === 2;
      cs.core.blob(cx + (r() - 0.5) * 2 * s, cy + (up ? 0.6 : -0.2 + r() * 0.4) * s, cz + (r() - 0.5) * 2 * s, (1.1 + r() * 0.5) * s, (0.8 + r() * 0.3) * s, (1.1 + r() * 0.5) * s, b.tone('giant', x, z, up ? '#4a7a34' : r() < 0.5 ? WOOD.leaf : WOOD.leaf2), Math.floor(r() * 999), { kind: K.Leaves, wind: 0.2, jitter: 0.3, detail: 1 });
    }
  for (let i = 0; i < pods; i++) {
    const [cx, cy, cz] = crown[i % crown.length];
    cs.glow.box(cx + (r() - 0.5) * 3 * s, cy - (1 + r() * 1.5) * s, cz + (r() - 0.5) * 3 * s, 0.22, 0.3, 0.22, WOOD.glow, {});
  }
  b.collide({ kind: 'c', x, z, r: rb * 1.05, y0: y - 2, y1: y + 12 });
  void gl;
}

/**
 * A rope bridge from a to b at deck height y: planks you walk on (deck cells), posts at
 * each end, rope hand-rails, and rails you can't fall through. Over water or a drop only:
 * nothing can walk under a deck. Run it along a cell boundary (an integer x or z) so the
 * planks cover the two cells between the rails.
 */
export function ropeBridge(b: Builder, grid: Grid, ax: number, az: number, bx: number, bz: number, y: number, w = 1.6) {
  const len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len, nx = -dz, nz = dx;
  // Deck cells: every cell whose centre lies on the span.
  for (let cz = Math.floor(Math.min(az, bz) - w); cz <= Math.ceil(Math.max(az, bz) + w); cz++)
    for (let cx = Math.floor(Math.min(ax, bx) - w); cx <= Math.ceil(Math.max(ax, bx) + w); cx++) {
      if (!grid.inside(cx, cz)) continue;
      const px = cx + 0.5 - ax, pz = cz + 0.5 - az, along = px * dx + pz * dz, across = px * nx + pz * nz;
      if (along >= -0.2 && along <= len + 0.2 && Math.abs(across) < w / 2 + 0.05) grid.deck[grid.i(cx, cz)] = y;
    }
  const g = b.g((ax + bx) / 2, (az + bz) / 2), r = b.rng;
  const yaw = Math.atan2(dx, dz);
  for (let s = 0.2; s < len; s += 0.42) {
    const sag = Math.sin((s / len) * Math.PI) * 0.12;
    g.push().translate(ax + dx * s, y - 0.1 - sag, az + dz * s).rotateY(yaw);
    g.box((r() - 0.5) * 0.08, 0, 0, w - 0.1 + (r() - 0.5) * 0.15, 0.08, 0.36, r() < 0.3 ? PAL.woodDark : PAL.wood, { kind: K.Wood, shade: 0.8 + r() * 0.3 });
    g.pop();
  }
  for (const side of [-1, 1]) {
    const ox = nx * side * (w / 2), oz = nz * side * (w / 2);
    for (const [px, pz] of [[ax, az], [bx, bz]]) g.box(px + ox, y - 0.4, pz + oz, 0.14, 1.5, 0.14, PAL.woodDark, { kind: K.Wood });
    // The hand-rope sags between the posts, with ties down to the deck.
    const n = Math.max(2, Math.round(len / 1.5));
    let prev: [number, number, number] = [ax + ox, y + 0.95, az + oz];
    for (let k = 1; k <= n; k++) {
      const t = k / n, sag = Math.sin(t * Math.PI) * 0.3;
      const p: [number, number, number] = [ax + dx * len * t + ox, y + 0.95 - sag, az + dz * len * t + oz];
      g.beam(prev, p, 0.025, '#8a7a5a', { wind: 0.3 });
      if (k < n) g.beam(p, [p[0], y - 0.1 - Math.sin(t * Math.PI) * 0.12, p[2]], 0.012, '#8a7a5a', { wind: 0.3 });
      prev = p;
    }
    // Rails: posts every half metre, too close to slip between.
    for (let s = 0; s <= len; s += 0.5) {
      const px = ax + dx * s + ox, pz = az + dz * s + oz;
      b.collide({ kind: 'c', x: px, z: pz, r: 0.18, y0: y - 1, y1: y + 1.4 });
    }
  }
}
