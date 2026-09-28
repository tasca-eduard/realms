import * as THREE from 'three';
import { Geo, type Col, type ShapeOpts } from '../engine/geo';
import { glowMaterial, K, worldMaterial } from '../engine/materials';
import { LightPool, type LightSource } from '../engine/lights';
import { Particles, P, type Emitter } from '../engine/particles';
import { rand, type Rng } from '../engine/util';
import { Grid } from './grid';

export const PAL = {
  bark: '#4a3a2e',
  barkDark: '#3a2e25',
  pine: '#2a4a3c',
  pine2: '#325642',
  oak: '#3d5e33',
  oak2: '#4a6b36',
  dead: '#5d544c',
  rock: '#716d78',
  rockDark: '#5a5662',
  wood: '#6e4e34',
  woodDark: '#4e3826',
  woodLight: '#8a6a48',
  plaster: '#b8ac92',
  plaster2: '#a89a80',
  timber: '#4a3424',
  thatch: '#8a7448',
  slate: '#4a4a5c',
  slate2: '#3e4a5a',
  stone: '#8a8694',
  stoneDark: '#6a6674',
  iron: '#3a3a44',
  gold: '#c8a040',
  cloth: '#7a2a2a',
  goblinCloth: '#6a5a30',
};

/** Warm window / fire light colours (HDR, linear). */
export const GLOW = {
  window: [3.2, 1.9, 0.75] as [number, number, number],
  windowDim: [1.6, 0.9, 0.35] as [number, number, number],
  flame: [5, 2.6, 0.8] as [number, number, number],
  moon: [1.4, 1.7, 2.6] as [number, number, number],
  rune: [0.6, 1.6, 3.4] as [number, number, number],
  mushroom: [0.4, 1.8, 2.2] as [number, number, number],
  flower: [1.3, 1.4, 1.9] as [number, number, number],
  sinister: [2.8, 2.2, 0.5] as [number, number, number],
};

export interface Structure {
  name: string;
  core: Geo;
  shell: Geo;
  glow: Geo;
  shellGlow: Geo;
  box: THREE.Box3;
  /** Rectangle (x0, z0, x1, z1) that counts as "inside". */
  interior?: [number, number, number, number];
  interiorY?: number;
  meshes: THREE.Mesh[];
  shellMeshes: THREE.Mesh[];
  fade: number;
  shellFade: number;
  mats: THREE.MeshLambertMaterial[];
  shellMats: THREE.MeshLambertMaterial[];
  glowMats: THREE.Material[];
  shellGlowMats: THREE.Material[];
}

export class Builder {
  solid = new Map<number, Geo>();
  glow = new Map<number, Geo>();
  /** Small ground clutter (flowers, pebbles, crops): lit but casts no shadow. */
  detail = new Map<number, Geo>();
  structures: Structure[] = [];
  fires: { x: number; y: number; z: number; big: boolean }[] = [];
  /** Tops of dead trees: somewhere for an owl to sit. */
  perches: [number, number, number][] = [];
  constructor(public grid: Grid, public lights: LightPool, public fx: Particles, public rng: Rng, public chunk = 32) {}

  private key(x: number, z: number) {
    return Math.floor(x / this.chunk) * 1000 + Math.floor(z / this.chunk);
  }
  g(x: number, z: number) {
    const k = this.key(x, z);
    let g = this.solid.get(k);
    if (!g) this.solid.set(k, (g = new Geo()));
    return g;
  }
  /** Geometry for small clutter that shouldn't cost a shadow pass. */
  d(x: number, z: number) {
    const k = this.key(x, z);
    let g = this.detail.get(k);
    if (!g) this.detail.set(k, (g = new Geo()));
    return g;
  }
  gl(x: number, z: number) {
    const k = this.key(x, z);
    let g = this.glow.get(k);
    if (!g) this.glow.set(k, (g = new Geo(true)));
    return g;
  }
  /** When set, props sample this height and skip colliders (scenery beyond the map). */
  heightFn: ((x: number, z: number) => number) | null = null;
  y(x: number, z: number) {
    return this.heightFn ? this.heightFn(x, z) : this.grid.groundAt(x, z);
  }
  collide(c: Parameters<Grid['addCollider']>[0]) {
    if (!this.heightFn) this.grid.addCollider(c);
  }

  structure(name: string, box: THREE.Box3, interior?: [number, number, number, number], interiorY?: number): Structure {
    const s: Structure = {
      name, box, interior, interiorY,
      core: new Geo(), shell: new Geo(), glow: new Geo(true), shellGlow: new Geo(true),
      meshes: [], shellMeshes: [], fade: 1, shellFade: 1, mats: [], shellMats: [], glowMats: [], shellGlowMats: [],
    };
    this.structures.push(s);
    return s;
  }

  finish(scene: THREE.Object3D) {
    const mat = worldMaterial();
    const glowMat = glowMaterial();
    const group = new THREE.Group();
    group.name = 'props';
    for (const g of this.solid.values()) {
      if (!g.count) continue;
      const m = new THREE.Mesh(g.build(), mat);
      m.castShadow = m.receiveShadow = true;
      group.add(m);
    }
    for (const g of this.glow.values()) {
      if (!g.count) continue;
      group.add(new THREE.Mesh(g.build(), glowMat));
    }
    for (const g of this.detail.values()) {
      if (!g.count) continue;
      const m = new THREE.Mesh(g.build(), mat);
      m.receiveShadow = true;
      group.add(m);
    }
    for (const s of this.structures) {
      const add = (geo: Geo, glow: boolean, shell: boolean) => {
        if (!geo.count) return;
        const m = glow ? glowMaterial() : worldMaterial({ alphaHash: true });
        if (glow) m.transparent = true;
        const mesh = new THREE.Mesh(geo.build(), m);
        if (!glow) mesh.castShadow = mesh.receiveShadow = true;
        group.add(mesh);
        (shell ? s.shellMeshes : s.meshes).push(mesh);
        if (glow) (shell ? s.shellGlowMats : s.glowMats).push(m);
        else (shell ? s.shellMats : s.mats).push(m as THREE.MeshLambertMaterial);
      };
      add(s.core, false, false);
      add(s.shell, false, true);
      add(s.glow, true, false);
      add(s.shellGlow, true, true);
    }
    scene.add(group);
    return group;
  }

  // ---------- nature ----------

  pine(x: number, z: number, s = 1, yAt?: number) {
    const g = this.g(x, z), y = yAt ?? this.y(x, z), r = this.rng;
    g.cyl(x, y - 0.1, z, 0.13 * s, 0.09 * s, 1.0 * s, 5, PAL.bark, { kind: K.Bark });
    const layers = 4;
    const tone = r() < 0.5 ? PAL.pine : PAL.pine2;
    const rot = r() * 6;
    for (let i = 0; i < layers; i++) {
      const t = i / (layers - 1);
      const rb = (1.15 - t * 0.7) * s, h = (1.25 - t * 0.2) * s;
      g.cyl(x, y + (0.55 + i * 0.72) * s, z, rb, 0, h, 7, tone, { kind: K.Leaves, wind: 0.15 + t * 0.7, shade: 0.85 + t * 0.2, rot: rot + i });
    }
    if (yAt === undefined) this.collide({ kind: 'c', x, z, r: 0.28 * s, y0: y - 1, y1: y + 4 * s });
  }

  oak(x: number, z: number, s = 1) {
    const g = this.g(x, z), y = this.y(x, z), r = this.rng;
    g.cyl(x, y - 0.1, z, 0.22 * s, 0.14 * s, 1.6 * s, 6, PAL.bark, { kind: K.Bark });
    g.beam([x, y + 1.2 * s, z], [x + 0.6 * s, y + 1.9 * s, z + 0.2 * s], 0.07 * s, PAL.bark, { kind: K.Bark });
    g.beam([x, y + 1.1 * s, z], [x - 0.5 * s, y + 1.8 * s, z - 0.3 * s], 0.07 * s, PAL.bark, { kind: K.Bark });
    const tone = r() < 0.5 ? PAL.oak : PAL.oak2;
    const n = 3 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r();
      const d = i === 0 ? 0 : 0.55 * s;
      g.blob(x + Math.cos(a) * d, y + (2.2 + r() * 0.5) * s, z + Math.sin(a) * d, (0.85 + r() * 0.3) * s, (0.75 + r() * 0.2) * s, (0.85 + r() * 0.3) * s, tone, Math.floor(r() * 1000), {
        kind: K.Leaves, wind: 0.5, detail: 1, jitter: 0.18,
      });
    }
    this.collide({ kind: 'c', x, z, r: 0.32 * s, y0: y - 1, y1: y + 4 * s });
  }

  /** Returns the top of the trunk (a perch). */
  deadTree(x: number, z: number, s = 1): [number, number, number] {
    const g = this.g(x, z), y = this.y(x, z), r = this.rng;
    const lean = (r() - 0.5) * 0.3;
    const top: [number, number, number] = [x + lean, y + 2.2 * s, z + lean * 0.5];
    g.cyl(x, y - 0.1, z, 0.2 * s, 0.12 * s, 1.2 * s, 5, PAL.dead, { kind: K.Bark });
    g.beam([x, y + 1.0 * s, z], top, 0.1 * s, PAL.dead, { kind: K.Bark });
    const branch = (from: [number, number, number], len: number, depth: number) => {
      const a = r() * Math.PI * 2;
      const to: [number, number, number] = [from[0] + Math.cos(a) * len, from[1] + len * (0.4 + r() * 0.5), from[2] + Math.sin(a) * len];
      g.beam(from, to, (0.05 + depth * 0.02) * s, PAL.dead, { kind: K.Bark, wind: 0.15 });
      if (depth > 0) for (let i = 0; i < 2; i++) branch(to, len * 0.6, depth - 1);
    };
    for (let i = 0; i < 4; i++) branch([x + lean * 0.6, y + (1.2 + i * 0.3) * s, z], 0.8 * s, 1);
    branch(top, 0.6 * s, 1);
    this.collide({ kind: 'c', x, z, r: 0.25 * s, y0: y - 1, y1: y + 3 });
    if (!this.heightFn) this.perches.push(top);
    return top;
  }

  bush(x: number, z: number, s = 1, col: Col = PAL.oak) {
    const g = this.g(x, z), y = this.y(x, z), r = this.rng;
    g.blob(x, y + 0.3 * s, z, 0.6 * s, 0.45 * s, 0.6 * s, col, Math.floor(r() * 999), { kind: K.Leaves, wind: 0.3, detail: 1, flatBottom: true });
    if (r() < 0.6) g.blob(x + 0.35 * s, y + 0.25 * s, z + 0.2 * s, 0.4 * s, 0.35 * s, 0.4 * s, col, Math.floor(r() * 999), { kind: K.Leaves, wind: 0.3, shade: 0.9, flatBottom: true });
  }

  rock(x: number, z: number, s = 1, collide = true) {
    const g = this.g(x, z), y = this.y(x, z), r = this.rng;
    g.blob(x, y + 0.15 * s, z, 0.6 * s * (0.8 + r() * 0.4), 0.45 * s, 0.55 * s * (0.8 + r() * 0.4), r() < 0.5 ? PAL.rock : PAL.rockDark, Math.floor(r() * 999), {
      kind: K.Rock, jitter: 0.3, flatBottom: true,
    });
    if (collide && s > 0.5) this.collide({ kind: 'c', x, z, r: 0.5 * s, y0: y - 1, y1: y + 0.5 * s });
  }

  reeds(x: number, z: number, n = 7, spread = 0.7) {
    const g = this.g(x, z), r = this.rng;
    for (let i = 0; i < n; i++) {
      const fx = x + (r() - 0.5) * spread * 2, fz = z + (r() - 0.5) * spread * 2;
      const y = this.y(fx, fz) - 0.1;
      const h = 0.5 + r() * 0.7;
      g.push().translate(fx, y, fz).rotateZ((r() - 0.5) * 0.25).rotateX((r() - 0.5) * 0.25);
      g.box(0, 0, 0, 0.035, h, 0.035, r() < 0.5 ? '#5a6a3a' : '#6a7040', { wind: 0.9 });
      if (r() < 0.4) g.box(0, h - 0.18, 0, 0.07, 0.16, 0.07, '#5a3a22', { wind: 1 });
      g.pop();
    }
  }

  /** Dry-stone field wall along a polyline: knee high, irregular. */
  drystone(pts: [number, number][]) {
    const r = this.rng;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(len / 0.45));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        const y = this.y(x, z);
        const g = this.g(x, z);
        g.blob(x, y + 0.14, z, 0.3, 0.2, 0.3, r() < 0.5 ? PAL.rock : PAL.rockDark, Math.floor(r() * 9999), { kind: K.Rock, flatBottom: true, jitter: 0.3 });
        if (r() < 0.75) g.blob(x + (r() - 0.5) * 0.15, y + 0.42, z + (r() - 0.5) * 0.15, 0.24, 0.16, 0.24, PAL.rock, Math.floor(r() * 9999), { kind: K.Rock, jitter: 0.3, shade: 1.08 });
      }
      this.collide({ kind: 'b', x0: Math.min(ax, bx) - 0.3, z0: Math.min(az, bz) - 0.3, x1: Math.max(ax, bx) + 0.3, z1: Math.max(az, bz) + 0.3, y0: this.y(ax, az) - 1, y1: this.y(ax, az) + 0.7 });
    }
  }

  standingStone(x: number, z: number, h: number, rot: number) {
    const g = this.g(x, z), y = this.y(x, z), r = this.rng;
    g.push().translate(x, y - 0.2, z).rotateY(rot).rotateZ((r() - 0.5) * 0.12);
    g.box(0, 0, 0, 0.7, h, 0.35, r() < 0.5 ? PAL.stoneDark : PAL.rockDark, { kind: K.Rock });
    g.box(0.05, h * 0.3, 0.18, 0.4, h * 0.3, 0.02, '#4a5a3a', {});
    g.pop();
    this.collide({ kind: 'c', x, z, r: 0.4, y0: y - 1, y1: y + h });
  }

  rowboat(x: number, y: number, z: number, rot: number) {
    const g = this.g(x, z);
    g.push().translate(x, y, z).rotateY(rot);
    g.box(0, 0, 0, 2.2, 0.3, 0.9, PAL.woodDark, { kind: K.Wood });
    g.box(0, 0.3, 0.42, 2.0, 0.14, 0.08, PAL.wood, { kind: K.Wood });
    g.box(0, 0.3, -0.42, 2.0, 0.14, 0.08, PAL.wood, { kind: K.Wood });
    g.box(1.05, 0.2, 0, 0.3, 0.25, 0.6, PAL.wood, { kind: K.Wood });
    g.box(-1.05, 0.2, 0, 0.2, 0.2, 0.7, PAL.wood, { kind: K.Wood });
    g.box(0.2, 0.3, 0, 0.3, 0.06, 0.8, PAL.woodLight, { kind: K.Wood });
    g.beam([0.1, 0.4, 0.2], [-0.8, 0.1, 0.9], 0.03, PAL.woodLight);
    g.pop();
  }

  /** Wooden pier: a walkable deck over water from (x0,z) to (x1,z), width w along z. */
  pier(x0: number, x1: number, z: number, w: number, deckY: number) {
    const g = this.g((x0 + x1) / 2, z), r = this.rng;
    for (let x = Math.min(x0, x1); x < Math.max(x0, x1); x += 0.42) g.box(x + 0.2, deckY - 0.12, z, 0.38, 0.12, w, PAL.wood, { kind: K.Wood, shade: 0.8 + r() * 0.3 });
    for (let x = Math.min(x0, x1) + 0.3; x < Math.max(x0, x1); x += 1.6)
      for (const s of [-1, 1]) g.box(x, -1.6, z + (s * w) / 2, 0.16, deckY + 1.7, 0.16, PAL.woodDark, { kind: K.Wood });
    for (let cz = Math.floor(z - w / 2); cz < Math.ceil(z + w / 2); cz++)
      for (let cx = Math.floor(Math.min(x0, x1)); cx < Math.ceil(Math.max(x0, x1)); cx++) if (this.grid.inside(cx, cz)) this.grid.deck[this.grid.i(cx, cz)] = deckY;
  }

  moonflowers(x: number, z: number, n = 8, spread = 1.5) {
    const gl = this.gl(x, z), g = this.g(x, z), r = this.rng;
    for (let i = 0; i < n; i++) {
      const fx = x + (r() - 0.5) * spread * 2, fz = z + (r() - 0.5) * spread * 2;
      const y = this.y(fx, fz);
      const h = 0.15 + r() * 0.2;
      g.box(fx, y, fz, 0.03, h, 0.03, '#3e5a34', { kind: K.Plain, wind: 0.5 });
      gl.box(fx, y + h, fz, 0.08, 0.06, 0.08, GLOW.flower, { kind: 0, wind: 0.5 });
    }
  }

  mushrooms(x: number, z: number, n = 5, light = true) {
    const gl = this.gl(x, z), g = this.g(x, z), r = this.rng;
    for (let i = 0; i < n; i++) {
      const fx = x + (r() - 0.5) * 1.4, fz = z + (r() - 0.5) * 1.4;
      const y = this.y(fx, fz);
      const h = 0.08 + r() * 0.14, cr = 0.05 + r() * 0.06;
      g.box(fx, y, fz, 0.035, h, 0.035, '#b8b0a0');
      gl.cyl(fx, y + h, fz, cr, cr * 0.2, cr * 0.9, 5, GLOW.mushroom, {});
    }
    if (light) this.lights.add(x, this.y(x, z) + 0.4, z, 0x55c8ff, 0.8, 3, 0.05);
  }

  // ---------- village props ----------

  fence(pts: [number, number][], col: Col = PAL.woodDark) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(len / 1.1));
      for (let k = 0; k <= n; k++) {
        if (k === n && i < pts.length - 2) continue;
        const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n;
        this.g(x, z).box(x, this.y(x, z) - 0.05, z, 0.11, 0.85, 0.11, col, { kind: K.Wood, shade: 0.9 + this.rng() * 0.2 });
      }
      const g = this.g(ax, az);
      for (const h of [0.35, 0.68]) {
        g.beam([ax, this.y(ax, az) + h, az], [bx, this.y(bx, bz) + h, bz], 0.04, col, { kind: K.Wood });
      }
      this.collide({ kind: 'b', x0: Math.min(ax, bx) - 0.08, z0: Math.min(az, bz) - 0.08, x1: Math.max(ax, bx) + 0.08, z1: Math.max(az, bz) + 0.08, y0: this.y(ax, az) - 1, y1: this.y(ax, az) + 0.9 });
    }
  }

  lamp(x: number, z: number) {
    const g = this.g(x, z), gl = this.gl(x, z), y = this.y(x, z);
    g.box(x, y, z, 0.14, 2.3, 0.14, PAL.woodDark, { kind: K.Wood });
    g.box(x + 0.25, y + 2.2, z, 0.6, 0.08, 0.08, PAL.woodDark, { kind: K.Wood });
    g.box(x + 0.45, y + 1.75, z, 0.26, 0.05, 0.26, PAL.iron);
    g.pyramid(x + 0.45, y + 2.08, z, 0.3, 0.3, 0.14, PAL.iron);
    gl.box(x + 0.45, y + 1.8, z, 0.2, 0.28, 0.2, GLOW.window, { kind: 1 });
    this.lights.add(x + 0.45, y + 1.9, z, 0xffb060, 9, 8, 0.12);
    this.collide({ kind: 'c', x, z, r: 0.16, y0: y - 1, y1: y + 2.3 });
  }

  torch(x: number, y: number, z: number, strength = 1) {
    const g = this.g(x, z), gl = this.gl(x, z);
    g.box(x, y - 0.35, z, 0.07, 0.45, 0.07, PAL.woodDark, { kind: K.Wood });
    g.box(x, y - 0.02, z, 0.13, 0.1, 0.13, PAL.iron);
    gl.box(x, y + 0.08, z, 0.1, 0.16, 0.1, GLOW.flame, { kind: 1 });
    this.fx.addEmitter({ x, y: y + 0.12, z, rate: 14, spec: P.flame, spread: 0.08, vy: 0.4 });
    this.fx.addEmitter({ x, y: y + 0.2, z, rate: 0.8, spec: P.ember, spread: 0.1, vy: 0.5 });
    this.lights.add(x, y + 0.3, z, 0xff9a40, 10 * strength, 8 * Math.sqrt(strength), 0.3);
    this.fires.push({ x, y, z, big: false });
  }

  /** Torch on a post, standing on the ground. */
  standingTorch(x: number, z: number) {
    const y = this.y(x, z);
    this.g(x, z).box(x, y, z, 0.1, 1.3, 0.1, PAL.woodDark, { kind: K.Wood });
    this.torch(x, y + 1.6, z);
    this.collide({ kind: 'c', x, z, r: 0.12, y0: y - 1, y1: y + 1.6 });
  }

  brazier(x: number, z: number, big = false) {
    const g = this.g(x, z), gl = this.gl(x, z), y = this.y(x, z), s = big ? 1.3 : 1;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      g.beam([x + Math.cos(a) * 0.3 * s, y, z + Math.sin(a) * 0.3 * s], [x, y + 0.6 * s, z], 0.035, PAL.iron, { kind: K.Metal });
    }
    g.cyl(x, y + 0.55 * s, z, 0.22 * s, 0.38 * s, 0.3 * s, 8, PAL.iron, { kind: K.Metal, cap: false });
    gl.cyl(x, y + 0.75 * s, z, 0.3 * s, 0.2 * s, 0.12, 7, GLOW.flame, { kind: 1 });
    this.fx.addEmitter({ x, y: y + 0.95 * s, z, rate: 26 * s, spec: P.flame, spread: 0.35 * s, vy: 0.8 });
    this.fx.addEmitter({ x, y: y + 1.0 * s, z, rate: 2.5, spec: P.ember, spread: 0.3, vy: 0.9 });
    this.lights.add(x, y + 1.3 * s, z, 0xff8a38, 16 * s, 10 * s, 0.3);
    this.fires.push({ x, y: y + 0.9, z, big: true });
    this.collide({ kind: 'c', x, z, r: 0.35 * s, y0: y - 1, y1: y + 1 });
  }

  campfire(x: number, z: number, lit = true): { light: LightSource; emitters: Emitter[] } {
    const g = this.g(x, z), gl = this.gl(x, z), y = this.y(x, z), r = this.rng;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.blob(x + Math.cos(a) * 0.55, y + 0.05, z + Math.sin(a) * 0.55, 0.16, 0.12, 0.16, PAL.rockDark, Math.floor(r() * 999), { kind: K.Rock, flatBottom: true });
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      g.beam([x + Math.cos(a) * 0.4, y + 0.05, z + Math.sin(a) * 0.4], [x - Math.cos(a) * 0.05, y + 0.35, z - Math.sin(a) * 0.05], 0.06, PAL.barkDark, { kind: K.Bark });
    }
    gl.box(x, y + 0.02, z, 0.45, 0.06, 0.45, [2.5, 0.8, 0.2], { kind: 1 });
    const emitters = [
      this.fx.addEmitter({ x, y: y + 0.25, z, rate: 34, spec: P.flame, spread: 0.4, vy: 1.1, on: lit }),
      this.fx.addEmitter({ x, y: y + 0.4, z, rate: 3.5, spec: P.ember, spread: 0.3, vy: 1.2, on: lit }),
      this.fx.addEmitter({ x, y: y + 1.2, z, rate: 1.4, spec: P.smoke, spread: 0.3, vy: 0.5, on: lit }),
    ];
    const light = this.lights.add(x, y + 1.1, z, 0xff8030, 22, 12, 0.35);
    light.on = lit;
    light.level = lit ? 1 : 0;
    this.fires.push({ x, y: y + 0.3, z, big: true });
    this.collide({ kind: 'c', x, z, r: 0.6, y0: y - 1, y1: y + 0.6 });
    return { light, emitters };
  }

  well(x: number, z: number) {
    const g = this.g(x, z), y = this.y(x, z);
    g.cyl(x, y, z, 0.85, 0.85, 0.75, 10, PAL.stone, { kind: K.Brick, cap: false });
    g.cyl(x, y + 0.72, z, 0.72, 0.72, 0.04, 10, '#10141e', {});
    g.box(x - 0.8, y, z, 0.14, 2.0, 0.14, PAL.woodDark, { kind: K.Wood });
    g.box(x + 0.8, y, z, 0.14, 2.0, 0.14, PAL.woodDark, { kind: K.Wood });
    g.beam([x - 0.8, y + 1.7, z], [x + 0.8, y + 1.7, z], 0.05, PAL.wood, { kind: K.Wood });
    g.gable(x, y + 1.95, z, 2.1, 1.5, 0.65, PAL.thatch, PAL.thatch, { kind: K.Thatch });
    g.box(x + 0.1, y + 1.1, z, 0.2, 0.22, 0.2, PAL.wood, { kind: K.Wood });
    this.collide({ kind: 'c', x, z, r: 0.9, y0: y - 1, y1: y + 1 });
  }

  barrel(x: number, z: number, g0?: Geo) {
    const g = g0 ?? this.g(x, z), y = g0 ? 0 : this.y(x, z);
    g.cyl(x, y, z, 0.28, 0.3, 0.38, 8, PAL.wood, { kind: K.Wood, cap: false });
    g.cyl(x, y + 0.38, z, 0.3, 0.28, 0.38, 8, PAL.wood, { kind: K.Wood });
    g.cyl(x, y + 0.12, z, 0.3, 0.3, 0.05, 8, PAL.iron, { cap: false });
    g.cyl(x, y + 0.6, z, 0.3, 0.3, 0.05, 8, PAL.iron, { cap: false });
    if (!g0) this.collide({ kind: 'c', x, z, r: 0.3, y0: y - 1, y1: y + 0.8 });
  }

  crate(x: number, z: number, s = 0.7, g0?: Geo) {
    const g = g0 ?? this.g(x, z), y = g0 ? 0 : this.y(x, z);
    g.box(x, y, z, s, s, s, PAL.woodLight, { kind: K.Wood });
    g.box(x, y + s * 0.45, z, s + 0.02, s * 0.1, s + 0.02, PAL.woodDark, { kind: K.Wood });
    if (!g0) this.collide({ kind: 'b', x0: x - s / 2, z0: z - s / 2, x1: x + s / 2, z1: z + s / 2, y0: y - 1, y1: y + s });
  }

  hay(x: number, z: number, rot = 0) {
    const g = this.g(x, z), y = this.y(x, z);
    g.push().translate(x, y, z).rotateY(rot);
    g.box(0, 0, 0, 1.1, 0.6, 0.7, '#a08a50', { kind: K.Thatch });
    g.pop();
    this.collide({ kind: 'c', x, z, r: 0.5, y0: y - 1, y1: y + 0.6 });
  }

  cart(x: number, z: number, rot = 0) {
    const g = this.g(x, z), y = this.y(x, z);
    g.push().translate(x, y, z).rotateY(rot);
    g.box(0, 0.45, 0, 1.8, 0.12, 1.1, PAL.wood, { kind: K.Wood });
    g.box(0, 0.57, 0.5, 1.8, 0.35, 0.08, PAL.wood, { kind: K.Wood });
    g.box(0, 0.57, -0.5, 1.8, 0.35, 0.08, PAL.wood, { kind: K.Wood });
    g.box(-0.86, 0.57, 0, 0.08, 0.35, 1.1, PAL.wood, { kind: K.Wood });
    for (const s of [-1, 1]) {
      g.push().translate(0.2, 0.42, s * 0.62).rotateX(Math.PI / 2);
      g.cyl(0, -0.05, 0, 0.42, 0.42, 0.1, 8, PAL.woodDark, { kind: K.Wood });
      g.pop();
    }
    g.beam([0.9, 0.5, 0.3], [2.1, 0.25, 0.25], 0.05, PAL.woodDark, { kind: K.Wood });
    g.beam([0.9, 0.5, -0.3], [2.1, 0.25, -0.25], 0.05, PAL.woodDark, { kind: K.Wood });
    g.box(-0.2, 0.57, 0, 0.9, 0.3, 0.8, '#a08a50', { kind: K.Thatch });
    g.pop();
    this.collide({ kind: 'c', x, z, r: 0.95, y0: y - 1, y1: y + 1 });
  }

  grave(x: number, z: number, kind = 0) {
    const g = this.g(x, z), y = this.y(x, z), r = this.rng;
    g.push().translate(x, y, z).rotateY((r() - 0.5) * 0.3).rotateZ((r() - 0.5) * 0.25);
    if (kind === 0) {
      g.box(0, -0.1, 0, 0.5, 0.75, 0.14, PAL.stoneDark, { kind: K.Rock });
      g.cyl(0, 0.6, 0, 0.25, 0.25, 0.01, 6, PAL.stoneDark, { top: PAL.stoneDark });
    } else {
      g.box(0, -0.1, 0, 0.1, 1.0, 0.1, PAL.stoneDark, { kind: K.Rock });
      g.box(0, 0.55, 0, 0.5, 0.1, 0.1, PAL.stoneDark, { kind: K.Rock });
    }
    g.pop();
    g.blob(x, y, z + 0.6, 0.35, 0.12, 0.55, '#3a3228', Math.floor(r() * 999), { kind: K.Dirt, flatBottom: true });
    this.collide({ kind: 'c', x, z, r: 0.25, y0: y - 1, y1: y + 0.8 });
  }

  tent(x: number, z: number, rot: number, col: Col) {
    const g = this.g(x, z), y = this.y(x, z);
    g.push().translate(x, y, z).rotateY(rot);
    g.gable(0, 0, 0, 2.6, 2.2, 1.6, col, '#2a2420', { kind: K.Cloth });
    g.box(1.3, 0, 0, 0.08, 1.8, 0.08, PAL.woodDark);
    g.box(-1.3, 0, 0, 0.08, 1.8, 0.08, PAL.woodDark);
    g.pop();
    this.collide({ kind: 'c', x, z, r: 1.1, y0: y - 1, y1: y + 1.6 });
  }

  /** A hanging cloth banner. Pass g0 to draw it into a structure (so it fades with the wall). */
  banner(x: number, y: number, z: number, rot: number, col: Col, h = 1.4, g0?: Geo) {
    const g = g0 ?? this.g(x, z);
    g.push().translate(x, y, z).rotateY(rot);
    g.box(0, h - 0.05, 0, 0.8, 0.06, 0.06, PAL.woodDark);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      g.quad([-0.35, h - 0.05 - t1 * h, 0.02], [0.35, h - 0.05 - t1 * h, 0.02], [0.35, h - 0.05 - t0 * h, 0.02], [-0.35, h - 0.05 - t0 * h, 0.02], col, { kind: K.Cloth, wind: t1 * 0.9 });
    }
    // Crescent moon sigil.
    g.box(0, h * 0.5, 0.035, 0.22, 0.22, 0.01, '#c8b070', { wind: 0.45 });
    g.box(0.07, h * 0.52, 0.04, 0.16, 0.18, 0.01, col, { wind: 0.45 });
    g.pop();
  }

  sign(x: number, z: number, rot = 0) {
    const g = this.g(x, z), y = this.y(x, z);
    g.box(x, y, z, 0.1, 1.2, 0.1, PAL.woodDark, { kind: K.Wood });
    g.push().translate(x, y + 1.0, z).rotateY(rot);
    g.box(0.1, 0, 0.06, 0.8, 0.28, 0.06, PAL.woodLight, { kind: K.Wood });
    g.pop();
    this.collide({ kind: 'c', x, z, r: 0.12, y0: y - 1, y1: y + 1.2 });
  }

  bench(x: number, z: number, rot = 0, g0?: Geo, y0?: number) {
    const g = g0 ?? this.g(x, z), y = y0 ?? this.y(x, z);
    g.push().translate(x, y, z).rotateY(rot);
    g.box(0, 0.35, 0, 1.4, 0.07, 0.35, PAL.wood, { kind: K.Wood });
    g.box(-0.55, 0, 0, 0.08, 0.35, 0.3, PAL.woodDark);
    g.box(0.55, 0, 0, 0.08, 0.35, 0.3, PAL.woodDark);
    g.pop();
  }

  table(x: number, z: number, g0?: Geo, y0?: number) {
    const g = g0 ?? this.g(x, z), y = y0 ?? this.y(x, z);
    g.box(x, 0.72 + y, z, 1.5, 0.08, 0.9, PAL.woodLight, { kind: K.Wood });
    for (const [dx, dz] of [[-0.6, -0.35], [0.6, -0.35], [-0.6, 0.35], [0.6, 0.35]]) g.box(x + dx, y, z + dz, 0.08, 0.72, 0.08, PAL.woodDark);
    g.cyl(x - 0.3, y + 0.8, z + 0.1, 0.06, 0.06, 0.14, 5, '#8a8a90');
    g.cyl(x + 0.25, y + 0.8, z - 0.15, 0.06, 0.05, 0.12, 5, PAL.woodLight);
    this.collide({ kind: 'b', x0: x - 0.75, z0: z - 0.45, x1: x + 0.75, z1: z + 0.45, y0: y - 1, y1: y + 0.8 });
  }

  // ---------- buildings ----------

  /**
   * A village building. w along x, d along z. ridgeX: ridge runs along x.
   * Door on the +z side unless doorSide says otherwise (0:+x 1:+z 2:-x 3:-z).
   * walls: 'plaster' (timber-framed, painted in one of several washes) or 'stone'.
   * storeys: 2 adds a jettied, timber-framed upper floor. shed: a lean-to on that side.
   */
  house(
    x: number, z: number, w: number, d: number,
    opts: { ridgeX?: boolean; roof?: 'thatch' | 'slate'; wallH?: number; doorSide?: number; chimney?: boolean; lit?: number; name?: string; flowers?: boolean; walls?: 'plaster' | 'stone'; storeys?: 1 | 2; tint?: Col; shed?: number } = {},
  ) {
    const y = this.y(x, z) - 0.05;
    const two = opts.storeys === 2;
    const floorH = opts.wallH ?? 2.4;
    const J = two ? 0.3 : 0; // the upper floor juts out this far
    const wallH = two ? floorH + 2.2 : floorH;
    const ridgeX = opts.ridgeX ?? w >= d;
    const roofCol = opts.roof === 'slate' ? PAL.slate : PAL.thatch;
    const roofKind = opts.roof === 'slate' ? K.Slate : K.Thatch;
    const box = new THREE.Box3(new THREE.Vector3(x - w / 2 - 0.6 - J, y, z - d / 2 - 0.6 - J), new THREE.Vector3(x + w / 2 + 0.6 + J, y + wallH + 3, z + d / 2 + 0.6 + J));
    const s = this.structure(opts.name ?? 'house', box);
    const g = s.core, gl = s.glow, r = this.rng;
    const WASH = ['#b8ac92', '#a89a80', '#c4b49a', '#bca48c', '#c8c0ae', '#b0a48e', '#c4a890'];
    const plaster = opts.tint ?? WASH[Math.floor(r() * WASH.length)];
    const stone = opts.walls === 'stone';
    const stoneCol = r() < 0.5 ? PAL.stone : '#7e7a88';
    const shutterCol = ['#3a4a3a', '#4a3424', '#34405a', '#5a2a24'][Math.floor(r() * 4)];
    const T = PAL.timber, t = 0.1, wood = { kind: K.Wood };

    // Where the door and windows go on each face: [nx, nz, centre offset x, z, wall length].
    // It's late: most windows are dark, upstairs even more. opts.lit is how awake the house is.
    const lit = (opts.lit ?? 0.6) * 0.45;
    const doorSide = opts.doorSide ?? 1;
    const faces: [number, number, number, number, number][] = [
      [1, 0, w / 2, 0, d],
      [0, 1, 0, d / 2, w],
      [-1, 0, -w / 2, 0, d],
      [0, -1, 0, -d / 2, w],
    ];
    const openings = faces.map(([, , , , len], side) =>
      side === doorSide ? [0, ...(len > 3.2 ? [len * 0.3] : []), ...(len > 4.4 ? [-len * 0.3] : [])] : len > 2.5 ? (len > 4 ? [-len * 0.22, len * 0.22] : [0]) : [],
    );

    // Timber frame round a storey: posts, sill and head beams, and (on the faces the
    // street sees) studs between the openings with a brace in each end panel.
    const frame = (x0: number, z0: number, x1: number, z1: number, yb: number, h: number) => {
      for (const [cx, cz] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) g.box(cx, yb, cz, t * 1.6, h, t * 1.6, T, wood);
      for (const yy of [yb + 0.02, yb + h - 0.12]) {
        g.box((x0 + x1) / 2, yy, z1, x1 - x0, t, t * 0.8, T, wood);
        g.box(x1, yy, (z0 + z1) / 2, t * 0.8, t, z1 - z0, T, wood);
        g.box((x0 + x1) / 2, yy, z0, x1 - x0, t, t * 0.8, T, wood);
        g.box(x0, yy, (z0 + z1) / 2, t * 0.8, t, z1 - z0, T, wood);
      }
      const faceRuns: [number, number, number, number, number, number, number, number][] = [
        [x0, z1, x1, z1, 0, 0.03, 1, 1],
        [x1, z1, x1, z0, 0.03, 0, 0, -1],
      ];
      for (const [ax, az, bx, bz, ox, oz, side, sgn] of faceRuns) {
        const len = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.round(len / 1.1));
        const holes = openings[side];
        for (let k = 1; k < n; k++) {
          const f = k / n, off = f * len - len / 2;
          if (holes.some((o) => Math.abs(sgn * off - o) < 0.5)) continue;
          g.box(ax + (bx - ax) * f + ox, yb, az + (bz - az) * f + oz, ox ? 0.06 : t * 0.8, h, oz ? 0.06 : t * 0.8, T, wood);
        }
        const f1 = 1 / n;
        g.beam([ax + ox, yb + 0.12, az + oz], [ax + (bx - ax) * f1 + ox, yb + h - 0.15, az + (bz - az) * f1 + oz], 0.04, T, wood);
        g.beam([bx + ox, yb + 0.12, bz + oz], [bx - (bx - ax) * f1 + ox, yb + h - 0.15, bz - (bz - az) * f1 + oz], 0.04, T, wood);
      }
    };

    // Footing, ground floor, and the upper floor if there is one.
    g.box(x, y - 0.3, z, w + 0.14, 0.62, d + 0.14, PAL.stoneDark, { kind: K.Brick });
    g.box(x, y + 0.3, z, w, floorH - 0.3, d, stone ? stoneCol : plaster, { kind: stone ? K.Brick : K.Plaster });
    if (stone) {
      // Dressed corner stones.
      for (const [cx, cz] of [[1, 1], [1, -1], [-1, 1]])
        for (let q = 0; q < 5; q++) g.box(x + (cx * w) / 2, y + 0.3 + q * 0.42, z + (cz * d) / 2, q % 2 ? 0.34 : 0.26, 0.2, q % 2 ? 0.26 : 0.34, '#a8a4b0', { kind: K.Rock });
    } else frame(x - w / 2, z - d / 2, x + w / 2, z + d / 2, y + 0.3, floorH - 0.3);
    if (two) {
      const ux0 = x - w / 2 - J, ux1 = x + w / 2 + J, uz0 = z - d / 2 - J, uz1 = z + d / 2 + J, uy = y + floorH;
      g.box(x, uy, z, w + 2 * J, 0.16, d + 2 * J, T, wood);
      // Joist ends showing under the overhang.
      for (let q = ux0 + 0.3; q < ux1 - 0.2; q += 0.5) g.box(q, uy - 0.12, uz1 - 0.1, 0.1, 0.12, 0.3, T, wood);
      for (let q = uz0 + 0.3; q < uz1 - 0.2; q += 0.5) g.box(ux1 - 0.1, uy - 0.12, q, 0.3, 0.12, 0.1, T, wood);
      g.box(x, uy + 0.16, z, w + 2 * J, wallH - floorH - 0.16, d + 2 * J, plaster, { kind: K.Plaster });
      frame(ux0, uz0, ux1, uz1, uy + 0.16, wallH - floorH - 0.16);
    }

    // Roof, bargeboards and ridge.
    const rh = Math.min(w, d) * 0.55 + 0.4;
    g.push().translate(x, y + wallH, z);
    if (!ridgeX) g.rotateY(Math.PI / 2);
    const rw = (ridgeX ? w : d) + 2 * J, rd = (ridgeX ? d : w) + 2 * J;
    g.gable(0, 0, 0, rw + 0.5, rd + 0.9, rh, roofCol, stone && !two ? stoneCol : plaster, { kind: roofKind });
    g.box(0, rh - 0.08, 0, rw + 0.6, 0.16, opts.roof === 'slate' ? 0.14 : 0.3, opts.roof === 'slate' ? PAL.slate2 : '#6a5a38', { kind: opts.roof === 'slate' ? K.Slate : K.Thatch });
    for (const ex of [-(rw + 0.5) / 2 - 0.03, (rw + 0.5) / 2 + 0.03])
      for (const ez of [-1, 1]) g.beam([ex, -0.05, (ez * (rd + 0.9)) / 2], [ex, rh, 0], 0.05, T, wood);
    g.pop();
    // Moss on old thatch.
    if (opts.roof !== 'slate' && r() < 0.7) {
      const mz = ridgeX ? z + d / 4 + 0.2 : z, mx = ridgeX ? x + (r() - 0.5) * w * 0.5 : x + w / 4 + 0.2;
      g.blob(mx, y + wallH + rh * 0.45, mz, 0.5, 0.12, 0.4, '#4a5a34', Math.floor(r() * 999), { kind: K.Leaves });
    }
    // Chimney with a cap and pots.
    if (opts.chimney !== false) {
      const cx = x + (ridgeX ? w * 0.28 : 0.3), cz = z + (ridgeX ? -0.3 : d * 0.28);
      g.box(cx, y + wallH - 0.5, cz, 0.55, rh + 1.0, 0.55, stone ? stoneCol : PAL.stoneDark, { kind: K.Brick });
      g.box(cx, y + wallH + rh + 0.45, cz, 0.7, 0.12, 0.7, PAL.stoneDark, { kind: K.Brick });
      g.cyl(cx + 0.1, y + wallH + rh + 0.57, cz, 0.09, 0.08, 0.2, 6, '#8a5a3a');
      this.fx.addEmitter({ x: cx, y: y + wallH + rh + 0.8, z: cz, rate: 1.2, spec: P.smoke, spread: 0.2, vy: 0.45 });
    }

    // Doors and windows.
    faces.forEach(([nx, nz, ox, oz], side) => {
      const seen = nx > 0 || nz > 0;
      const along = nx !== 0 ? [0, 1] : [1, 0];
      const at = (off: number, jut: number, out: number): [number, number] => [x + ox + nx * (jut + out) + along[0] * off, z + oz + nz * (jut + out) + along[1] * off];
      // A box on this face: n thick along the wall's normal, a wide along the wall.
      const B = (px: number, py: number, pz: number, n: number, h: number, a: number, col: Col, o: ShapeOpts = {}) => g.box(px, py, pz, nx !== 0 ? n : a, h, nx !== 0 ? a : n, col, o);
      const frameCol = stone ? '#a8a4b0' : T;
      const win = (off: number, yy: number, jut: number, flowers: boolean) => {
        const [px, pz] = at(off, jut, 0.06), ww = 0.55, hh = 0.6;
        const on = r() < (jut > 0 ? lit * 0.5 : lit);
        gl.box(px, y + yy, pz, nx !== 0 ? 0.08 : ww, hh, nx !== 0 ? ww : 0.08, on ? (r() < 0.4 ? GLOW.windowDim : GLOW.window) : [0.03, 0.035, 0.06], { kind: 0 });
        const fc = jut === 0 ? frameCol : T;
        B(px + nx * 0.02, y + yy + hh - 0.02, pz + nz * 0.02, 0.07, 0.09, ww + 0.14, fc, wood);
        B(px + nx * 0.05, y + yy - 0.07, pz + nz * 0.05, 0.13, 0.08, ww + 0.16, fc, wood);
        B(px + nx * 0.03, y + yy, pz + nz * 0.03, 0.05, hh, 0.05, T);
        if (seen) {
          // Shutters folded back either side.
          for (const sg of [-1, 1]) {
            const [qx, qz] = at(off + sg * (ww / 2 + 0.13), jut, 0.08);
            B(qx, y + yy - 0.02, qz, 0.04, hh + 0.04, 0.22, shutterCol, wood);
          }
          if (flowers && (opts.flowers ?? true)) {
            const [bx, bz] = at(off, jut, 0.18);
            B(bx, y + yy - 0.2, bz, 0.18, 0.16, ww + 0.15, PAL.woodDark, wood);
            const cols = ['#c83a3a', '#e0c040', '#e8e4d8', '#d87aa0'];
            for (let f = 0; f < 5; f++) {
              const tt = (f / 4 - 0.5) * ww;
              g.blob(bx + along[0] * tt, y + yy - 0.02, bz + along[1] * tt, 0.07, 0.06, 0.07, f % 2 ? '#4a6a30' : cols[Math.floor(r() * cols.length)], Math.floor(r() * 999), { wind: 0.3 });
            }
          }
        }
        if (on) this.lights.add(px + nx * 0.6, y + yy + 0.3, pz + nz * 0.6, 0xffa050, 3.5, 4.5, 0.06);
      };
      openings[side].forEach((off) => {
        if (side === doorSide && off === 0) {
          const [px, pz] = at(0, 0, 0.06);
          B(px, y + 0.25, pz, 0.08, 1.6, 0.9, PAL.woodDark, wood);
          const [kx, kz] = at(0.28, 0, 0.1);
          B(kx, y + 0.95, kz, 0.04, 0.07, 0.07, '#c8a040');
          // Door frame, a stone step, and on the street side a little hood on brackets.
          for (const sg of [-1, 1]) {
            const [qx, qz] = at(sg * 0.52, 0, 0.08);
            B(qx, y + 0.2, qz, 0.1, 1.7, 0.12, frameCol, wood);
          }
          const [hx, hz] = at(0, 0, 0.08);
          B(hx, y + 1.85, hz, 0.1, 0.14, 1.2, frameCol, wood);
          const [stx, stz] = at(0, 0, 0.3);
          B(stx, y - 0.02, stz, 0.5, 0.14, 1.2, PAL.stoneDark, { kind: K.Flag });
          if (seen) {
            const [ax2, az2] = at(0, 0, 0.35);
            g.push().translate(ax2, y + 2.25, az2).rotateY(nx !== 0 ? Math.PI / 2 : 0).rotateX(0.45);
            g.box(0, 0, 0, 1.4, 0.06, 0.75, roofCol, { kind: roofKind });
            g.pop();
            for (const sg of [-1, 1]) {
              const [bx, bz] = at(sg * 0.6, 0, 0.06);
              const [ex, ez] = at(sg * 0.6, 0, 0.55);
              g.beam([bx, y + 1.75, bz], [ex, y + 2.12, ez], 0.035, T, wood);
            }
          }
        } else win(off, 1.0, 0, true);
        if (two) win(off, floorH + 0.9, J, false);
      });
    });

    // A lean-to against one side: a slope of boards on two posts, firewood under it.
    if (opts.shed !== undefined) {
      const [nx, nz, ox, oz, len] = faces[opts.shed];
      const along = nx !== 0 ? [0, 1] : [1, 0];
      const L = Math.min(len - 0.6, 2.6), D = 1.4;
      const cx = x + ox + nx * D / 2, cz = z + oz + nz * D / 2;
      g.push().translate(x + ox + nx * 0.02, y + 2.0, z + oz + nz * 0.02).rotateY(Math.atan2(nx, nz));
      g.quad([-L / 2, 0, 0], [L / 2, 0, 0], [L / 2, -0.55, D + 0.15], [-L / 2, -0.55, D + 0.15], PAL.woodDark, wood);
      g.quad([L / 2, 0, 0], [-L / 2, 0, 0], [-L / 2, -0.55, D + 0.15], [L / 2, -0.55, D + 0.15], PAL.woodDark, wood);
      g.pop();
      for (const sgn of [-1, 1]) g.box(cx + nx * D / 2 + along[0] * sgn * (L / 2 - 0.1), y, cz + nz * D / 2 + along[1] * sgn * (L / 2 - 0.1), 0.12, 1.45, 0.12, PAL.woodDark, wood);
      // Logs stacked under it.
      for (let row = 0; row < 3; row++)
        for (let k = 0; k < 6 - row * 2; k++) {
          const off = (k - (5 - row * 2) / 2) * 0.28;
          const lx = x + ox + nx * 0.45 + along[0] * off, lz = z + oz + nz * 0.45 + along[1] * off;
          g.push().translate(lx, y + 0.13 + row * 0.24, lz).rotateY(Math.atan2(nx, nz)).rotateX(Math.PI / 2);
          g.cyl(0, -0.35, 0, 0.12, 0.12, 0.7, 6, k % 2 ? PAL.bark : PAL.barkDark, { kind: K.Bark, top: '#a08a60' });
          g.pop();
        }
      const xs = [x + ox + along[0] * L / 2, x + ox - along[0] * L / 2, x + ox + nx * D + along[0] * L / 2, x + ox + nx * D - along[0] * L / 2];
      const zs = [z + oz + along[1] * L / 2, z + oz - along[1] * L / 2, z + oz + nz * D + along[1] * L / 2, z + oz + nz * D - along[1] * L / 2];
      this.collide({ kind: 'b', x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs), y0: y - 1, y1: y + 1.9 });
    }
    this.markSolid(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
    return s;
  }

  markSolid(x0: number, z0: number, x1: number, z1: number) {
    this.collide({ kind: 'b', x0, z0, x1, z1, y0: -50, y1: 50 });
  }

  // ---------- castle ----------

  /** Straight curtain wall between two axis-aligned points, with merlons on both edges. */
  wall(s: Structure, x0: number, z0: number, x1: number, z1: number, base: number, h: number, thick = 1.6, opts: { slits?: boolean; torches?: boolean; outerSign?: number; litSlits?: boolean } = {}) {
    const g = s.core;
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const sx = alongX ? len : thick, sz = alongX ? thick : len;
    g.box(cx, base - 2, cz, sx, h + 2, sz, PAL.stone, { kind: K.Brick, top: PAL.stoneDark });
    // Merlons on both edges.
    const n = Math.floor(len / 0.9);
    for (let i = 0; i < n; i += 2) {
      const t = -len / 2 + (i + 0.5) * (len / n);
      for (const side of [-1, 1]) {
        const mx = alongX ? cx + t : cx + side * (thick / 2 - 0.15);
        const mz = alongX ? cz + side * (thick / 2 - 0.15) : cz + t;
        g.box(mx, base + h, mz, alongX ? len / n : 0.3, 0.55, alongX ? 0.3 : len / n, PAL.stone, { kind: K.Brick });
      }
    }
    if (opts.slits) {
      const os = opts.outerSign ?? 1;
      for (let i = 1; i < Math.floor(len / 3); i++) {
        const t = -len / 2 + i * 3;
        const px = alongX ? cx + t : cx + os * (thick / 2 + 0.01);
        const pz = alongX ? cz + os * (thick / 2 + 0.01) : cz + t;
        g.box(px, base + h * 0.45, pz, alongX ? 0.12 : 0.04, 0.7, alongX ? 0.04 : 0.12, '#0c0c14');
        // Now and then a slit shows lamplight from the wall walk inside.
        if (opts.litSlits && i % 5 === 2) s.glow.box(px + (alongX ? 0 : os * 0.03), base + h * 0.45 + 0.12, pz + (alongX ? os * 0.03 : 0), alongX ? 0.07 : 0.02, 0.45, alongX ? 0.02 : 0.07, GLOW.windowDim, { kind: 1 });
      }
    }
    this.collide({ kind: 'b', x0: cx - sx / 2, z0: cz - sz / 2, x1: cx + sx / 2, z1: cz + sz / 2, y0: base - 5, y1: base + h + 1 });
  }

  roundTower(s: Structure, x: number, z: number, r: number, base: number, h: number, opts: { roof?: boolean; windows?: number; banner?: Col } = {}) {
    const g = s.core, gl = s.glow;
    g.cyl(x, base - 3, z, r + 0.1, r, h + 3, 12, PAL.stone, { kind: K.Brick, top: PAL.stoneDark });
    for (let i = 0; i < 12; i += 2) {
      const a = (i / 12) * Math.PI * 2;
      g.box(x + Math.cos(a) * (r - 0.15), base + h, z + Math.sin(a) * (r - 0.15), 0.45, 0.5, 0.45, PAL.stone, { kind: K.Brick });
    }
    if (opts.roof !== false) {
      g.cyl(x, base + h + 0.45, z, r + 0.35, 0, r * 2.2, 12, PAL.slate2, { kind: K.Slate });
      if (opts.banner) {
        g.box(x, base + h + 0.45 + r * 2.1, z, 0.06, 1.0, 0.06, PAL.iron);
        g.box(x + 0.3, base + h + 1.1 + r * 2.1, z, 0.55, 0.32, 0.03, opts.banner, { kind: K.Cloth, wind: 0.8 });
      }
    }
    g.cyl(x, base + h * 0.42, z, r + 0.14, r + 0.14, 0.22, 12, PAL.stoneDark, { kind: K.Brick });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.box(x + Math.cos(a) * (r + 0.04), base + h - 0.5, z + Math.sin(a) * (r + 0.04), 0.26, 0.45, 0.26, PAL.stoneDark, { kind: K.Brick });
    }
    for (const a of [0.2, 1.4]) g.box(x + Math.cos(a) * (r + 0.01), base + h * 0.2, z + Math.sin(a) * (r + 0.01), 0.1, 0.7, 0.1, '#0c0c14');
    const nw = opts.windows ?? 2;
    for (let i = 0; i < nw; i++) {
      const a = Math.PI * 0.25 + (i - (nw - 1) / 2) * 0.9;
      const wy = base + h * (0.55 + (i % 2) * 0.2);
      gl.box(x + Math.cos(a) * (r + 0.02), wy, z + Math.sin(a) * (r + 0.02), 0.22, 0.5, 0.22, i === 1 ? GLOW.window : i === 3 ? GLOW.windowDim : [0.03, 0.035, 0.06], { kind: 0 });
    }
    this.collide({ kind: 'c', x, z, r: r + 0.1, y0: base - 5, y1: base + h + 1 });
  }
}

export function scatter(r: Rng, n: number, x0: number, z0: number, x1: number, z1: number, fn: (x: number, z: number) => void) {
  for (let i = 0; i < n; i++) fn(rand(r, x0, x1), rand(r, z0, z1));
}
