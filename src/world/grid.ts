import { clamp } from '../engine/util';

/** Ground types. Each maps to a colour and a surface pattern. */
export const T = {
  Grass: 0,
  Dirt: 1,
  Path: 2,
  Cobble: 3,
  Flag: 4,
  Sand: 5,
  Wood: 6,
  Bed: 7, // stream / moat bed
  Moss: 8,
  Gravel: 9,
  Floor: 10, // castle floor
  Carpet: 11,
  DarkGrass: 12,
  Mud: 13,
  Rock: 14,
  Snow: 15,
  Field: 16,
  Reeds: 17,
  // The Sunken Reef's own: coral rubble, dark silt in the deep, seagrass meadows.
  Coral: 18,
  Silt: 19,
  Seagrass: 20,
} as const;
export type TileType = (typeof T)[keyof typeof T];

/** Side (cliff) styles. */
export const S = { Rock: 0, Dirt: 1, Brick: 2, Wood: 3 } as const;

export const NONE = -999;

/** Water deeper than this cannot be walked (or jumped) into. */
export const DEEP = 0.55;

const bucketKey = (x: number, z: number) => (z + 2048) * 4096 + (x + 2048);

/** Direction a ramp rises toward: 0 +x, 1 +z, 2 -x, 3 -z. */
export const DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

export interface Body {
  x: number;
  y: number;
  z: number;
  r: number;
  /** Walks into deep water and along the bottom (a diver: the knight in his dive helm, goblin divers). */
  dives?: boolean;
  /** Lives in the water and never leaves it (the sea's creatures). */
  aquatic?: boolean;
}

export interface Collider {
  kind: 'c' | 'b';
  x: number;
  z: number;
  r: number;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** Height range the collider occupies. */
  y0: number;
  y1: number;
  on: boolean;
  tag?: string;
}

export class Grid {
  h: Float32Array;
  t: Uint8Array;
  solid: Uint8Array;
  rise: Float32Array;
  dir: Int8Array;
  steps: Uint8Array;
  water: Float32Array;
  side: Uint8Array;
  noGrass: Uint8Array;
  /** Walkable deck (bridges) over a cell; NONE when absent. */
  deck: Float32Array;
  private buckets = new Map<number, Collider[]>();
  colliders: Collider[] = [];

  /** The grid covers cells ox..ox+w-1 by oz..oz+d-1 (it may start below zero). */
  constructor(public w: number, public d: number, public ox = 0, public oz = 0) {
    const n = w * d;
    this.h = new Float32Array(n);
    this.t = new Uint8Array(n);
    this.solid = new Uint8Array(n);
    this.rise = new Float32Array(n);
    this.dir = new Int8Array(n).fill(-1);
    this.steps = new Uint8Array(n);
    this.water = new Float32Array(n).fill(NONE);
    this.side = new Uint8Array(n);
    this.noGrass = new Uint8Array(n);
    this.deck = new Float32Array(n).fill(NONE);
  }

  inside(x: number, z: number) {
    return x >= this.ox && z >= this.oz && x < this.ox + this.w && z < this.oz + this.d;
  }
  i(x: number, z: number) {
    return (z - this.oz) * this.w + (x - this.ox);
  }

  /** Is this cell water too deep to wade? */
  isDeep(cx: number, cz: number) {
    const i = this.i(cx, cz);
    const w = this.water[i];
    return w !== NONE && this.deck[i] === NONE && w - this.h[i] > DEEP;
  }

  /** Walkable height of a cell at a point inside (or clamped to) it. */
  cellTop(cx: number, cz: number, px: number, pz: number) {
    const dk = this.deck[this.i(cx, cz)];
    if (dk !== NONE) return dk;
    return this.surf(cx, cz, px, pz);
  }

  /** Terrain surface height (ignores decks). */
  surf(cx: number, cz: number, px: number, pz: number) {
    const i = this.i(cx, cz);
    const d = this.dir[i];
    if (d < 0) return this.h[i];
    const fx = clamp(px - cx, 0, 1), fz = clamp(pz - cz, 0, 1);
    const t = d === 0 ? fx : d === 1 ? fz : d === 2 ? 1 - fx : 1 - fz;
    return this.h[i] + this.rise[i] * t;
  }

  /** Height of a cell corner (0: x0z0, 1: x1z0, 2: x1z1, 3: x0z1). */
  corner(cx: number, cz: number, c: number) {
    const px = cx + (c === 1 || c === 2 ? 1 : 0), pz = cz + (c >= 2 ? 1 : 0);
    return this.surf(cx, cz, px, pz);
  }

  groundAt(x: number, z: number) {
    const cx = Math.floor(x), cz = Math.floor(z);
    if (!this.inside(cx, cz)) return -5;
    return this.cellTop(cx, cz, x, z);
  }

  typeAt(x: number, z: number) {
    const cx = Math.floor(x), cz = Math.floor(z);
    if (!this.inside(cx, cz)) return T.Rock;
    return this.t[this.i(cx, cz)];
  }

  waterAt(x: number, z: number) {
    const cx = Math.floor(x), cz = Math.floor(z);
    if (!this.inside(cx, cz)) return NONE;
    return this.water[this.i(cx, cz)];
  }

  addCollider(c: Partial<Collider> & { kind: 'c' | 'b' }) {
    const col: Collider = { x: 0, z: 0, r: 0, x0: 0, z0: 0, x1: 0, z1: 0, y0: -50, y1: 50, on: true, ...c };
    if (col.kind === 'c') {
      col.x0 = col.x - col.r;
      col.x1 = col.x + col.r;
      col.z0 = col.z - col.r;
      col.z1 = col.z + col.r;
    }
    this.colliders.push(col);
    for (let z = Math.floor(col.z0); z <= Math.floor(col.z1); z++)
      for (let x = Math.floor(col.x0); x <= Math.floor(col.x1); x++) {
        const k = bucketKey(x, z);
        let b = this.buckets.get(k);
        if (!b) this.buckets.set(k, (b = []));
        b.push(col);
      }
    return col;
  }

  /** Does this cell stop a body at height y? */
  blocks(cx: number, cz: number, b: Body, stepUp: number, noDrop: boolean) {
    if (!this.inside(cx, cz)) return true;
    const i = this.i(cx, cz);
    if (this.solid[i]) return true;
    const top = this.cellTop(cx, cz, clamp(b.x, cx, cx + 1), clamp(b.z, cz, cz + 1));
    if (top > b.y + stepUp) return true;
    if (noDrop && top < b.y - 0.6) return true;
    const w = this.water[i];
    const deep = w !== NONE && this.deck[i] === NONE && w - top > DEEP;
    if (deep ? !b.dives && !b.aquatic : b.aquatic) return true;
    return false;
  }

  /** Move a body with collision, sliding along walls. */
  move(b: Body, dx: number, dz: number, stepUp: number, noDrop = false) {
    const len = Math.hypot(dx, dz);
    const n = Math.max(1, Math.ceil(len / 0.12));
    const sx = dx / n, sz = dz / n;
    let hit = false;
    for (let s = 0; s < n; s++) {
      b.x += sx;
      if (this.resolve(b, stepUp, noDrop)) hit = true;
      b.z += sz;
      if (this.resolve(b, stepUp, noDrop)) hit = true;
    }
    return hit;
  }

  private pushOutBox(b: Body, x0: number, z0: number, x1: number, z1: number) {
    const qx = clamp(b.x, x0, x1), qz = clamp(b.z, z0, z1);
    let dx = b.x - qx, dz = b.z - qz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= b.r * b.r) return false;
    if (d2 > 1e-10) {
      const d = Math.sqrt(d2);
      b.x += (dx / d) * (b.r - d);
      b.z += (dz / d) * (b.r - d);
    } else {
      // Centre inside the box: push out along the shallowest axis.
      const l = b.x - x0, r = x1 - b.x, u = b.z - z0, dd = z1 - b.z;
      const m = Math.min(l, r, u, dd);
      if (m === l) b.x = x0 - b.r;
      else if (m === r) b.x = x1 + b.r;
      else if (m === u) b.z = z0 - b.r;
      else b.z = z1 + b.r;
    }
    return true;
  }

  resolve(b: Body, stepUp: number, noDrop: boolean) {
    let hit = false;
    const x0 = Math.floor(b.x - b.r), x1 = Math.floor(b.x + b.r);
    const z0 = Math.floor(b.z - b.r), z1 = Math.floor(b.z + b.r);
    for (let cz = z0; cz <= z1; cz++)
      for (let cx = x0; cx <= x1; cx++) {
        if (cx === Math.floor(b.x) && cz === Math.floor(b.z) && !this.solidAt(cx, cz)) continue;
        if (this.blocks(cx, cz, b, stepUp, noDrop) && this.pushOutBox(b, cx, cz, cx + 1, cz + 1)) hit = true;
      }
    const seen = new Set<Collider>();
    for (let cz = z0; cz <= z1; cz++)
      for (let cx = x0; cx <= x1; cx++) {
        const list = this.buckets.get(bucketKey(cx, cz));
        if (!list) continue;
        for (const c of list) {
          if (!c.on || seen.has(c)) continue;
          seen.add(c);
          if (b.y >= c.y1 - 0.05 || b.y + 1.6 <= c.y0) continue;
          if (c.kind === 'b') {
            if (this.pushOutBox(b, c.x0, c.z0, c.x1, c.z1)) hit = true;
          } else {
            const dx = b.x - c.x, dz = b.z - c.z, rr = b.r + c.r;
            const d2 = dx * dx + dz * dz;
            if (d2 < rr * rr) {
              const d = Math.sqrt(d2) || 1e-4;
              b.x = c.x + (dx / d) * rr;
              b.z = c.z + (dz / d) * rr;
              hit = true;
            }
          }
        }
      }
    return hit;
  }

  private solidAt(cx: number, cz: number) {
    return !this.inside(cx, cz) || this.solid[this.i(cx, cz)] === 1;
  }

  /** Colliders near a point (for line-of-sight and projectiles). */
  collidersNear(x: number, z: number) {
    return this.buckets.get(bucketKey(Math.floor(x), Math.floor(z))) ?? [];
  }

  /** True when a straight line at height y is clear of walls and raised ground. */
  lineClear(ax: number, az: number, bx: number, bz: number, y: number) {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.ceil(len / 0.3);
    for (let s = 1; s < n; s++) {
      const t = s / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      const cx = Math.floor(x), cz = Math.floor(z);
      if (!this.inside(cx, cz)) return false;
      const i = this.i(cx, cz);
      if (this.solid[i]) return false;
      if (this.cellTop(cx, cz, x, z) > y + 0.9) return false;
      for (const c of this.collidersNear(x, z)) {
        if (!c.on || c.y1 < y + 1.1) continue; // knee-high walls and fences do not block sight
        if (c.kind === 'b' ? x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 : (x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) return false;
      }
    }
    return true;
  }
}
