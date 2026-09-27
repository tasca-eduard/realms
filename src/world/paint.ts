import { fbm } from '../engine/util';
import { Grid, NONE, T } from './grid';

export type Pt = [number, number];

export function insidePoly(poly: Pt[], x: number, z: number) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function distSeg(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

export function distLine(pts: Pt[], x: number, z: number) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distSeg(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  return d;
}

/** Signed distance to a polygon edge: negative inside. */
export function sdPoly(poly: Pt[], x: number, z: number) {
  const d = distLine([...poly, poly[0]], x, z);
  return insidePoly(poly, x, z) ? -d : d;
}

export class Painter {
  constructor(public g: Grid) {}

  each(fn: (x: number, z: number, i: number) => void, x0 = this.g.ox, z0 = this.g.oz, x1 = this.g.ox + this.g.w, z1 = this.g.oz + this.g.d) {
    const g = this.g;
    for (let z = Math.max(g.oz, Math.floor(z0)); z < Math.min(g.oz + g.d, Math.ceil(z1)); z++)
      for (let x = Math.max(g.ox, Math.floor(x0)); x < Math.min(g.ox + g.w, Math.ceil(x1)); x++) fn(x, z, g.i(x, z));
  }

  /** Paint a polygon with a noisy (organic) edge. */
  poly(poly: Pt[], set: { h?: number; t?: number; side?: number; noGrass?: boolean }, noise = 1.4, seed = 1) {
    const xs = poly.map((p) => p[0]), zs = poly.map((p) => p[1]);
    this.each(
      (x, z, i) => {
        const n = (fbm(x * 0.13 + seed * 7.3, z * 0.13 - seed * 3.1, 3, seed) - 0.5) * 2 * noise;
        if (sdPoly(poly, x + 0.5, z + 0.5) + n < 0) this.apply(i, set);
      },
      Math.min(...xs) - noise - 1, Math.min(...zs) - noise - 1, Math.max(...xs) + noise + 1, Math.max(...zs) + noise + 1,
    );
  }

  rect(x0: number, z0: number, x1: number, z1: number, set: { h?: number; t?: number; side?: number; solid?: boolean; noGrass?: boolean }) {
    this.each((_x, _z, i) => this.apply(i, set), x0, z0, x1, z1);
  }

  apply(i: number, set: { h?: number; t?: number; side?: number; solid?: boolean; noGrass?: boolean }) {
    const g = this.g;
    if (set.h !== undefined) {
      g.h[i] = set.h;
      g.dir[i] = -1;
      g.rise[i] = 0;
      g.steps[i] = 0;
    }
    if (set.t !== undefined) g.t[i] = set.t;
    if (set.side !== undefined) g.side[i] = set.side;
    if (set.solid !== undefined) g.solid[i] = set.solid ? 1 : 0;
    if (set.noGrass !== undefined) g.noGrass[i] = set.noGrass ? 1 : 0;
  }

  /** Road or trail along a polyline; only changes the ground type. */
  path(pts: Pt[], width: number, t: number, jitter = 0.5, seed = 3) {
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    this.each(
      (x, z, i) => {
        const n = (fbm(x * 0.3 + seed, z * 0.3, 2, seed) - 0.5) * 2 * jitter;
        if (distLine(pts, x + 0.5, z + 0.5) < width / 2 + n) {
          this.g.t[i] = t;
          this.g.noGrass[i] = 1;
        }
      },
      Math.min(...xs) - width, Math.min(...zs) - width, Math.max(...xs) + width, Math.max(...zs) + width,
    );
  }

  /** Flatten ground to height h along a polyline (for roads through hills). */
  flattenAlong(pts: Pt[], width: number, h: number) {
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    this.each(
      (x, z, i) => {
        if (distLine(pts, x + 0.5, z + 0.5) < width / 2) this.apply(i, { h });
      },
      Math.min(...xs) - width, Math.min(...zs) - width, Math.max(...xs) + width, Math.max(...zs) + width,
    );
  }

  /**
   * A ramp or stair over a rectangle of cells. dir: 0 +x, 1 +z, 2 -x, 3 -z (the direction it rises).
   */
  ramp(x0: number, z0: number, x1: number, z1: number, dir: number, h0: number, h1: number, steps = true, t?: number) {
    const len = dir === 0 || dir === 2 ? x1 - x0 : z1 - z0;
    const per = (h1 - h0) / len;
    this.each(
      (x, z, i) => {
        const k = dir === 0 ? x - x0 : dir === 2 ? x1 - 1 - x : dir === 1 ? z - z0 : z1 - 1 - z;
        this.g.h[i] = h0 + per * k;
        this.g.rise[i] = per;
        this.g.dir[i] = dir;
        this.g.steps[i] = steps ? 1 : 0;
        this.g.noGrass[i] = 1;
        if (t !== undefined) this.g.t[i] = t;
      },
      x0, z0, x1, z1,
    );
  }

  /** River or moat: cells within width/2 become water over a bed. */
  stream(pts: Pt[], width: number, level: number, bed: number, bank = 1.2, seed = 11) {
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    const g = this.g;
    this.each(
      (x, z, i) => {
        const n = (fbm(x * 0.2 + seed, z * 0.2, 2, seed) - 0.5) * 1.2;
        const d = distLine(pts, x + 0.5, z + 0.5) + n;
        if (d < width / 2) {
          const k = d / (width / 2);
          this.apply(i, { h: bed + (level - 0.28 - bed) * k * k, t: T.Bed, noGrass: true });
          g.water[i] = level;
        } else if (d < width / 2 + bank) {
          if (g.h[i] > level) {
            this.apply(i, { h: Math.min(g.h[i], level + 0.25), t: d < width / 2 + bank * 0.5 ? T.Mud : g.t[i] });
          }
        }
      },
      Math.min(...xs) - width - bank, Math.min(...zs) - width - bank, Math.max(...xs) + width + bank, Math.max(...zs) + width + bank,
    );
  }

  clearWater(x0: number, z0: number, x1: number, z1: number) {
    this.each((_x, _z, i) => (this.g.water[i] = NONE), x0, z0, x1, z1);
  }
}
