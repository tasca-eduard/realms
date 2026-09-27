import * as THREE from 'three';
import { Geo, type Col } from '../engine/geo';
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
  structures: Structure[] = [];
  fires: { x: number; y: number; z: number; big: boolean }[] = [];
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

  deadTree(x: number, z: number, s = 1) {
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

  mushrooms(x: number, z: number, n = 5) {
    const gl = this.gl(x, z), g = this.g(x, z), r = this.rng;
    for (let i = 0; i < n; i++) {
      const fx = x + (r() - 0.5) * 1.4, fz = z + (r() - 0.5) * 1.4;
      const y = this.y(fx, fz);
      const h = 0.08 + r() * 0.14, cr = 0.05 + r() * 0.06;
      g.box(fx, y, fz, 0.035, h, 0.035, '#b8b0a0');
      gl.cyl(fx, y + h, fz, cr, cr * 0.2, cr * 0.9, 5, GLOW.mushroom, {});
    }
    this.lights.add(x, this.y(x, z) + 0.4, z, 0x55c8ff, 0.8, 3, 0.05);
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

  banner(x: number, y: number, z: number, rot: number, col: Col, h = 1.4) {
    const g = this.g(x, z);
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
   * Timber-framed cottage. w along x, d along z. ridgeX: ridge runs along x.
   * Door on the +z side unless doorSide says otherwise (0:+x 1:+z 2:-x 3:-z).
   */
  house(x: number, z: number, w: number, d: number, opts: { ridgeX?: boolean; roof?: 'thatch' | 'slate'; wallH?: number; doorSide?: number; chimney?: boolean; lit?: number; name?: string } = {}) {
    const y = this.y(x, z) - 0.05;
    const wallH = opts.wallH ?? 2.4;
    const ridgeX = opts.ridgeX ?? w >= d;
    const roofCol = opts.roof === 'slate' ? PAL.slate : PAL.thatch;
    const roofKind = opts.roof === 'slate' ? K.Slate : K.Thatch;
    const box = new THREE.Box3(new THREE.Vector3(x - w / 2 - 0.5, y, z - d / 2 - 0.5), new THREE.Vector3(x + w / 2 + 0.5, y + wallH + 2.6, z + d / 2 + 0.5));
    const s = this.structure(opts.name ?? 'house', box);
    const g = s.core, gl = s.glow, r = this.rng;
    const plaster = r() < 0.5 ? PAL.plaster : PAL.plaster2;
    // Stone footing and walls.
    g.box(x, y - 0.3, z, w + 0.1, 0.55, d + 0.1, PAL.stoneDark, { kind: K.Brick });
    g.box(x, y + 0.25, z, w, wallH - 0.25, d, plaster, { kind: K.Plaster });
    // Timber frame: corner posts, sill and top beams, a brace per wall.
    const T = PAL.timber, t = 0.1;
    for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.box(x + (cx * w) / 2, y + 0.2, z + (cz * d) / 2, t * 1.6, wallH - 0.2, t * 1.6, T, { kind: K.Wood });
    for (const yy of [0.25, wallH - 0.12, wallH * 0.52]) {
      g.box(x, y + yy, z + d / 2, w, t, t * 0.8, T, { kind: K.Wood });
      g.box(x, y + yy, z - d / 2, w, t, t * 0.8, T, { kind: K.Wood });
      g.box(x + w / 2, y + yy, z, t * 0.8, t, d, T, { kind: K.Wood });
      g.box(x - w / 2, y + yy, z, t * 0.8, t, d, T, { kind: K.Wood });
    }
    // Roof.
    const rh = Math.min(w, d) * 0.55 + 0.4;
    g.push().translate(x, y + wallH, z);
    if (!ridgeX) g.rotateY(Math.PI / 2);
    const rw = ridgeX ? w : d, rd = ridgeX ? d : w;
    g.gable(0, 0, 0, rw + 0.5, rd + 0.9, rh, roofCol, plaster, { kind: roofKind });
    g.box(0, rh - 0.06, 0, rw + 0.6, 0.12, 0.14, PAL.timber, { kind: K.Wood });
    g.pop();
    // Chimney.
    if (opts.chimney !== false) {
      const cx = x + (ridgeX ? w * 0.28 : 0.3), cz = z + (ridgeX ? -0.3 : d * 0.28);
      g.box(cx, y + wallH - 0.5, cz, 0.5, rh + 1.0, 0.5, PAL.stoneDark, { kind: K.Brick });
      this.fx.addEmitter({ x: cx, y: y + wallH + rh + 0.6, z: cz, rate: 1.2, spec: P.smoke, spread: 0.2, vy: 0.45 });
    }
    // Door and windows on each wall.
    const lit = opts.lit ?? 0.7;
    const doorSide = opts.doorSide ?? 1;
    const faces: [number, number, number, number, number][] = [
      // nx, nz, center offset x, z, wall length
      [1, 0, w / 2, 0, d],
      [0, 1, 0, d / 2, w],
      [-1, 0, -w / 2, 0, d],
      [0, -1, 0, -d / 2, w],
    ];
    faces.forEach(([nx, nz, ox, oz, len], side) => {
      const fx = x + ox + nx * 0.06, fz = z + oz + nz * 0.06;
      const along = nx !== 0 ? [0, 1] : [1, 0];
      const put = (off: number, yy: number, ww: number, hh: number, glow: boolean) => {
        const px = fx + along[0] * off, pz = fz + along[1] * off;
        const sx = nx !== 0 ? 0.08 : ww, sz = nx !== 0 ? ww : 0.08;
        if (glow) {
          const on = r() < lit;
          gl.box(px, y + yy, pz, sx, hh, sz, on ? GLOW.window : [0.03, 0.035, 0.06], { kind: 0 });
          g.box(px + nx * 0.02, y + yy + hh / 2 - 0.03, pz + nz * 0.02, nx !== 0 ? 0.06 : ww + 0.1, 0.07, nx !== 0 ? ww + 0.1 : 0.06, T);
          g.box(px + nx * 0.02, y + yy - 0.05, pz + nz * 0.02, nx !== 0 ? 0.1 : ww + 0.16, 0.08, nx !== 0 ? ww + 0.16 : 0.1, T);
          g.box(px + nx * 0.03, y + yy, pz + nz * 0.03, nx !== 0 ? 0.05 : 0.05, hh, nx !== 0 ? 0.05 : 0.05, T);
          if (on) this.lights.add(px + nx * 0.6, y + yy + 0.3, pz + nz * 0.6, 0xffa050, 3.5, 4.5, 0.06);
        } else {
          g.box(px, y + yy, pz, sx, hh, sz, PAL.woodDark, { kind: K.Wood });
        }
      };
      if (side === doorSide) {
        put(0, 0.25, 0.85, 1.55, false);
        if (len > 3.2) put(len * 0.3, 1.0, 0.55, 0.6, true);
        if (len > 4.4) put(-len * 0.3, 1.0, 0.55, 0.6, true);
      } else if (len > 2.5) {
        put(len > 4 ? -len * 0.22 : 0, 1.0, 0.55, 0.6, true);
        if (len > 4) put(len * 0.22, 1.0, 0.55, 0.6, true);
      }
    });
    this.markSolid(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
    return s;
  }

  markSolid(x0: number, z0: number, x1: number, z1: number) {
    this.collide({ kind: 'b', x0, z0, x1, z1, y0: -50, y1: 50 });
  }

  // ---------- castle ----------

  /** Straight curtain wall between two axis-aligned points, with merlons on both edges. */
  wall(s: Structure, x0: number, z0: number, x1: number, z1: number, base: number, h: number, thick = 1.6, opts: { slits?: boolean; torches?: boolean; outerSign?: number } = {}) {
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
    const nw = opts.windows ?? 2;
    for (let i = 0; i < nw; i++) {
      const a = Math.PI * 0.25 + (i - (nw - 1) / 2) * 0.9;
      const wy = base + h * (0.55 + (i % 2) * 0.2);
      gl.box(x + Math.cos(a) * (r + 0.02), wy, z + Math.sin(a) * (r + 0.02), 0.22, 0.5, 0.22, i % 2 ? GLOW.windowDim : GLOW.window, { kind: 0 });
    }
    this.collide({ kind: 'c', x, z, r: r + 0.1, y0: base - 5, y1: base + h + 1 });
  }
}

export function scatter(r: Rng, n: number, x0: number, z0: number, x1: number, z1: number, fn: (x: number, z: number) => void) {
  for (let i = 0; i < n; i++) fn(rand(r, x0, x1), rand(r, z0, z1));
}
