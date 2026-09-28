import * as THREE from 'three';
import { Geo } from '../engine/geo';
import { glowMaterial, K, worldMaterial } from '../engine/materials';
import { P, type PSpec, type Emitter } from '../engine/particles';
import type { LightSource } from '../engine/lights';
import { PAL, GLOW } from '../world/builder';
import type { Collider } from '../world/grid';
import { makeVillager, type Model } from './models';
import type { Game } from './game';
import type { NpcDef } from '../world/realm1';
import type { PowerKind } from './player';

const MOONFLAME: PSpec = { color: [2.2, 3.2, 5.5], color2: [0.3, 0.6, 2.2], size: 2, size2: 1, life: 0.7, gravity: -2.4, drag: 2, fadeIn: 0.05 };
const MOONMOTE: PSpec = { color: [1.5, 2.2, 4], color2: [0.3, 0.5, 1.5], size: 1, life: 2.2, gravity: -0.6, wobble: 0.4 };

function meshOf(build: (g: Geo, gl: Geo) => void) {
  const g = new Geo(), gl = new Geo(true);
  build(g, gl);
  const group = new THREE.Group();
  if (g.count) {
    const m = new THREE.Mesh(g.build(), worldMaterial());
    m.castShadow = m.receiveShadow = true;
    group.add(m);
  }
  if (gl.count) group.add(new THREE.Mesh(gl.build(), glowMaterial()));
  return group;
}

export interface Interactable {
  x: number;
  y: number;
  z: number;
  radius: number;
  prompt(g: Game): string | null;
  interact(g: Game): void;
}

// ---------- moonfire (rest point) ----------

export class Moonfire implements Interactable {
  y: number;
  radius = 1.7;
  lit = false;
  light: LightSource;
  emitters: Emitter[] = [];
  group: THREE.Group;
  constructor(public id: string, public name: string, public x: number, public z: number, g: Game) {
    this.y = g.grid.groundAt(x, z);
    const hearth = id === 'hearth';
    this.group = hearth
      ? new THREE.Group()
      : meshOf((m) => {
          m.cyl(0, 0, 0, 0.75, 0.7, 0.25, 8, PAL.stoneDark, { kind: K.Brick });
          m.cyl(0, 0.25, 0, 0.35, 0.3, 0.5, 8, PAL.stone, { kind: K.Rock });
          m.cyl(0, 0.75, 0, 0.35, 0.55, 0.25, 8, PAL.stone, { kind: K.Brick, cap: false });
          m.cyl(0, 0.9, 0, 0.45, 0.45, 0.02, 8, '#141828');
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + 0.4;
            m.box(Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95, 0.22, 0.5 + (i % 2) * 0.3, 0.22, PAL.stoneDark, { kind: K.Rock });
          }
        });
    this.group.position.set(x, this.y, z);
    g.scene.add(this.group);
    if (!hearth) g.grid.addCollider({ kind: 'c', x, z, r: 0.6, y0: this.y - 1, y1: this.y + 1 });
    this.light = g.lights.add(x, this.y + 1.5, z, hearth ? 0xff8a38 : 0x9ab8ff, 0, 10, 0.2);
    this.light.level = 0;
    if (!hearth) {
      this.emitters.push(g.fx.addEmitter({ x, y: this.y + 1.0, z, rate: 22, spec: MOONFLAME, spread: 0.35, vy: 0.9, on: false }));
      this.emitters.push(g.fx.addEmitter({ x, y: this.y + 1.2, z, rate: 2, spec: MOONMOTE, spread: 0.4, vy: 0.6, on: false }));
    }
  }
  setLit(on: boolean, g: Game) {
    this.lit = on;
    for (const e of this.emitters) e.on = on;
    this.light.intensity = this.id === 'hearth' ? 0 : 14;
    this.light.on = on && this.id !== 'hearth';
    this.light.level = on && this.id !== 'hearth' ? 1 : 0;
    void g;
  }
  prompt(g: Game) {
    if (g.enemiesNear(this.x, this.z, 9)) return '!Enemies are near';
    if (this.id === 'hearth') return 'Rest by the hearth';
    return this.lit ? 'Rest at the moonfire' : 'Light the moonfire';
  }
  interact(g: Game) {
    if (g.enemiesNear(this.x, this.z, 9)) return;
    g.rest(this);
  }
}

// ---------- chest ----------

export class Chest implements Interactable {
  y: number;
  radius = 1.4;
  open = false;
  lid: THREE.Group;
  group: THREE.Group;
  openT = 0;
  power?: PowerKind;
  constructor(public id: string, public x: number, public z: number, rot: number, public coins: number, g: Game) {
    this.y = g.grid.groundAt(x, z);
    this.group = meshOf((m) => {
      m.box(0, 0, 0, 1.0, 0.5, 0.65, PAL.wood, { kind: K.Wood });
      for (const bx of [-0.35, 0.35]) m.box(bx, 0, 0, 0.1, 0.52, 0.67, PAL.gold, { kind: K.Metal });
      m.box(0, 0.05, 0, 0.9, 0.44, 0.55, '#1a1008');
    });
    this.lid = meshOf((m) => {
      m.box(0, 0, 0.3, 1.02, 0.12, 0.67, PAL.wood, { kind: K.Wood });
      m.box(0, 0.1, 0.3, 1.0, 0.1, 0.55, PAL.wood, { kind: K.Wood });
      for (const bx of [-0.35, 0.35]) m.box(bx, 0, 0.3, 0.1, 0.22, 0.69, PAL.gold, { kind: K.Metal });
      m.box(0, -0.02, 0.63, 0.14, 0.18, 0.04, PAL.gold, { kind: K.Metal });
    });
    this.lid.position.set(0, 0.5, -0.32);
    this.group.add(this.lid);
    this.group.position.set(x, this.y, z);
    this.group.rotation.y = rot;
    g.scene.add(this.group);
    g.grid.addCollider({ kind: 'c', x, z, r: 0.5, y0: this.y - 1, y1: this.y + 0.7 });
  }
  setOpen(done: boolean) {
    this.open = done;
    this.lid.rotation.x = done ? -1.9 : 0;
    this.openT = done ? 1 : 0;
  }
  prompt() {
    return this.open ? null : 'Open';
  }
  interact(g: Game) {
    if (this.open) return;
    this.open = true;
    g.openChest(this);
  }
  update(dt: number) {
    if (this.open && this.openT < 1) {
      this.openT = Math.min(1, this.openT + dt * 2.2);
      const k = 1 - Math.pow(1 - this.openT, 3);
      this.lid.rotation.x = -1.9 * k;
    }
  }
}

// ---------- lore stone ----------

export class LoreStone implements Interactable {
  y: number;
  radius = 1.6;
  group: THREE.Group;
  constructor(public id: string, public x: number, public z: number, public text: string, g: Game) {
    this.y = g.grid.groundAt(x, z);
    this.group = meshOf((m, gl) => {
      m.cyl(0, -0.1, 0, 0.42, 0.28, 1.9, 5, PAL.stoneDark, { kind: K.Rock, rot: 0.3 });
      m.blob(0, 0, 0, 0.7, 0.2, 0.6, PAL.rockDark, 7, { kind: K.Rock, flatBottom: true });
      for (let i = 0; i < 4; i++) gl.box(0.2, 0.5 + i * 0.3, 0.33, 0.12, 0.05 + (i % 2) * 0.06, 0.05, GLOW.rune, {});
    });
    this.group.position.set(x, this.y, z);
    this.group.rotation.y = 0.8;
    g.scene.add(this.group);
    g.fx.addEmitter({ x, y: this.y + 0.9, z, rate: 1.2, spec: P.rune, spread: 0.6, vy: 0.2 });
    g.lights.add(x + 0.5, this.y + 1, z + 0.5, 0x6aa0ff, 2.5, 4, 0.08);
    g.grid.addCollider({ kind: 'c', x, z, r: 0.45, y0: this.y - 1, y1: this.y + 2 });
  }
  prompt() {
    return 'Read';
  }
  interact(g: Game) {
    g.ui.lore(this.text);
    g.audio.sfx('rune');
    g.save.read(this.id);
  }
}

// ---------- sign ----------

export class Sign implements Interactable {
  y: number;
  radius = 1.4;
  constructor(public x: number, public z: number, public text: string, g: Game) {
    this.y = g.grid.groundAt(x, z);
  }
  prompt() {
    return 'Read sign';
  }
  interact(g: Game) {
    g.ui.lore(this.text, true);
  }
}

// ---------- winch lever and drawbridge ----------

export class Drawbridge {
  group: THREE.Group;
  deckGroup: THREE.Group;
  down = false;
  t = 0;
  collider: Collider;
  constructor(public x0: number, public z0: number, public x1: number, public z1: number, public deck: number, g: Game) {
    const len = x1 - x0, w = z1 - z0;
    this.group = new THREE.Group();
    this.deckGroup = meshOf((m) => {
      for (let i = 0; i < 7; i++) m.box(len / 2, -0.25, -w / 2 + (i + 0.5) * (w / 7), len, 0.22, w / 7 - 0.04, PAL.wood, { kind: K.Wood, shade: 0.85 + Math.random() * 0.25 });
      for (const bx of [0.4, len / 2, len - 0.4]) m.box(bx, -0.36, 0, 0.18, 0.12, w, PAL.iron, { kind: K.Metal });
      m.box(len - 0.1, -0.2, -w / 2 + 0.1, 0.12, 0.12, 0.12, PAL.iron);
      m.box(len - 0.1, -0.2, w / 2 - 0.1, 0.12, 0.12, 0.12, PAL.iron);
    });
    this.group.add(this.deckGroup);
    this.group.position.set(x0 - 0.3, deck, (z0 + z1) / 2);
    this.deckGroup.rotation.z = Math.PI / 2 - 0.08;
    g.scene.add(this.group);
    // Raised: a wall across the gate.
    this.collider = g.grid.addCollider({ kind: 'b', x0: x0 - 0.8, z0, x1: x0 + 0.2, z1, y0: -5, y1: 20 });
  }
  lower(g: Game, instant = false) {
    if (this.down) return;
    this.down = true;
    if (instant) this.t = 1;
    this.collider.on = false;
    for (let z = this.z0; z < this.z1; z++) for (let x = this.x0; x < this.x1; x++) g.grid.deck[g.grid.i(x, z)] = this.deck;
    if (!instant) g.audio.sfx('chains');
  }
  update(dt: number, g: Game) {
    if (!this.down || this.t >= 1) {
      if (this.t >= 1) this.deckGroup.rotation.z = 0;
      return;
    }
    const before = this.t;
    this.t = Math.min(1, this.t + dt * 0.45);
    const k = this.t * this.t;
    this.deckGroup.rotation.z = (Math.PI / 2 - 0.08) * (1 - k);
    if (before < 1 && this.t >= 1) {
      g.shake(0.7);
      g.audio.sfx('bridgeSlam');
      for (let i = 0; i < 20; i++) g.fx.emit(P.puff, this.x0 + Math.random() * (this.x1 - this.x0), this.deck, this.z0 + Math.random() * (this.z1 - this.z0), 0, 0.5, 0);
      for (let i = 0; i < 16; i++) g.fx.emit(P.splash, this.x1 - 0.5, this.deck - 0.8, this.z0 + Math.random() * 3, (Math.random() - 0.5) * 3, 4, (Math.random() - 0.5) * 3);
    }
  }
}

export class Lever implements Interactable {
  y: number;
  radius = 1.4;
  pulled = false;
  handle: THREE.Group;
  t = 0;
  constructor(public id: string, public x: number, public z: number, g: Game) {
    this.y = g.grid.groundAt(x, z);
    const base = meshOf((m) => {
      m.box(0, 0, 0, 0.8, 0.5, 0.6, PAL.stoneDark, { kind: K.Brick });
      m.cyl(0, 0.5, 0, 0.18, 0.18, 0.1, 6, PAL.iron);
    });
    base.position.set(x, this.y, z);
    this.handle = meshOf((m) => {
      m.box(0, 0, 0, 0.08, 0.9, 0.08, PAL.woodDark, { kind: K.Wood });
      m.box(0, 0.85, 0, 0.14, 0.18, 0.14, PAL.iron);
    });
    this.handle.position.set(0, 0.55, 0);
    this.handle.rotation.x = -0.7;
    base.add(this.handle);
    g.scene.add(base);
    g.grid.addCollider({ kind: 'b', x0: x - 0.4, z0: z - 0.3, x1: x + 0.4, z1: z + 0.3, y0: this.y - 1, y1: this.y + 1 });
  }
  setPulled() {
    this.pulled = true;
    this.t = 1;
    this.handle.rotation.x = 0.7;
  }
  prompt() {
    return this.pulled ? null : 'Pull the winch lever';
  }
  interact(g: Game) {
    if (this.pulled) return;
    this.pulled = true;
    g.audio.sfx('lever');
    g.pullLever();
  }
  update(dt: number) {
    if (this.pulled && this.t < 1) {
      this.t = Math.min(1, this.t + dt * 3);
      this.handle.rotation.x = -0.7 + 1.4 * this.t;
    }
  }
}

// ---------- the captive's cage ----------

export class Cage {
  y: number;
  hp = 3;
  open = false;
  group: THREE.Group;
  collider: Collider;
  flash = 0;
  constructor(public x: number, public z: number, g: Game) {
    this.y = g.grid.groundAt(x, z);
    this.group = meshOf((m) => {
      m.box(0, 0, 0, 1.6, 0.12, 1.6, PAL.iron, { kind: K.Metal });
      m.box(0, 1.9, 0, 1.6, 0.1, 1.6, PAL.iron, { kind: K.Metal });
      for (let i = 0; i < 6; i++) {
        const t = -0.75 + i * 0.3;
        for (const [bx, bz] of [[t, -0.75], [t, 0.75], [-0.75, t], [0.75, t]]) m.box(bx, 0.1, bz, 0.05, 1.8, 0.05, PAL.iron, { kind: K.Metal });
      }
      m.box(0, 2.0, 0, 0.1, 0.8, 0.1, PAL.woodDark);
    });
    this.group.position.set(x, this.y, z);
    g.scene.add(this.group);
    this.collider = g.grid.addCollider({ kind: 'b', x0: x - 0.85, z0: z - 0.85, x1: x + 0.85, z1: z + 0.85, y0: this.y - 1, y1: this.y + 2 });
  }
  breakOpen(g: Game, instant = false) {
    this.open = true;
    this.collider.on = false;
    g.scene.remove(this.group);
    if (!instant) {
      g.fx.burst(P.spark, this.x, this.y + 1, this.z, 30, 5, 3);
      for (let i = 0; i < 20; i++) g.fx.emit(P.splinter, this.x, this.y + 1, this.z, (Math.random() - 0.5) * 6, 3 + Math.random() * 3, (Math.random() - 0.5) * 6);
    }
  }
}

// ---------- the great hall doors ----------

export class HallDoor {
  left: THREE.Group;
  right: THREE.Group;
  open = false;
  t = 0;
  collider: Collider;
  y: number;
  constructor(public x: number, public z: number, y: number, g: Game) {
    this.y = y;
    const leaf = () =>
      meshOf((m) => {
        m.box(0, 0, 0.75, 0.16, 3.3, 1.5, PAL.woodDark, { kind: K.Wood });
        for (const yy of [0.5, 1.6, 2.7]) m.box(0.05, yy, 0.75, 0.2, 0.12, 1.5, PAL.iron, { kind: K.Metal });
        m.box(0.12, 1.5, 1.3, 0.1, 0.2, 0.1, PAL.gold, { kind: K.Metal });
      });
    this.left = leaf();
    this.left.position.set(x - 0.25, y, z - 1.5);
    this.right = leaf();
    this.right.position.set(x - 0.25, y, z + 1.5);
    this.right.rotation.y = Math.PI;
    g.scene.add(this.left, this.right);
    this.collider = g.grid.addCollider({ kind: 'b', x0: x - 0.5, z0: z - 1.6, x1: x + 0.1, z1: z + 1.6, y0: y - 1, y1: y + 4 });
  }
  setOpen(open: boolean, g: Game, instant = false) {
    if (this.open === open) return;
    this.open = open;
    this.collider.on = !open;
    if (instant) this.t = open ? 1 : 0;
    g.audio.sfx(open ? 'doorOpen' : 'doorSlam');
  }
  update(dt: number) {
    const target = this.open ? 1 : 0;
    this.t += Math.sign(target - this.t) * Math.min(Math.abs(target - this.t), dt * (this.open ? 0.8 : 3));
    const k = this.t * this.t * (3 - 2 * this.t);
    this.left.rotation.y = k * 1.5;
    this.right.rotation.y = Math.PI - k * 1.5;
  }
}

// ---------- moon shard ----------

export class Shard {
  y: number;
  taken = false;
  mesh: THREE.Mesh;
  light: LightSource;
  t = Math.random() * 6;
  constructor(public id: string, public x: number, public z: number, g: Game) {
    this.y = g.grid.groundAt(x, z) + 0.9;
    this.mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.2, 3.6) }));
    this.mesh.scale.set(0.7, 1.3, 0.7);
    this.mesh.position.set(x, this.y, z);
    g.scene.add(this.mesh);
    this.light = g.lights.add(x, this.y + 0.4, z, 0x9ab8ff, 5, 5, 0.15);
  }
  update(dt: number, g: Game) {
    if (this.taken) return;
    this.t += dt;
    this.mesh.rotation.y += dt * 1.5;
    this.mesh.position.y = this.y + Math.sin(this.t * 2) * 0.12;
    if (Math.random() < dt * 6) g.fx.emit(P.rune, this.x + (Math.random() - 0.5) * 0.6, this.y - 0.3, this.z + (Math.random() - 0.5) * 0.6, 0, 0.5, 0);
    const p = g.player;
    if (p.alive && Math.hypot(p.x - this.x, p.z - this.z) < 0.9 && Math.abs(p.y + 0.9 - this.y) < 1.4) g.takeShard(this);
  }
  remove(g: Game) {
    this.taken = true;
    g.scene.remove(this.mesh);
    this.light.on = false;
    this.light.level = 0;
  }
}

// ---------- cracked wall (secret) ----------

/** A crumbling stone wall that a heavy blow (finisher, full spin, dash, plunge) breaks open. */
export class CrackedWall implements Interactable {
  y: number;
  radius = 2.6;
  broken = false;
  prompt() {
    return this.broken ? null : '!Light seeps through the cracks. A heavy blow could break this.';
  }
  interact() {}
  group: THREE.Group;
  collider: Collider;
  constructor(public id: string, public x: number, public z: number, alongX: boolean, g: Game) {
    this.y = g.grid.groundAt(x, z);
    this.group = meshOf((m, gl) => {
      const w = 2.2;
      for (let row = 0; row < 5; row++)
        for (let k = 0; k < 4; k++) {
          const off = -w / 2 + (k + (row % 2) * 0.5) * (w / 4);
          if (off > w / 2 - 0.1) continue;
          const sx = alongX ? w / 4 - 0.04 : 0.5, sz = alongX ? 0.5 : w / 4 - 0.04;
          m.box(alongX ? off + w / 8 : 0, row * 0.5, alongX ? 0 : off + w / 8, sx, 0.48, sz, (row + k) % 3 ? PAL.stoneDark : PAL.rockDark, { kind: K.Rock, shade: 0.8 + Math.random() * 0.25 });
        }
      // Blue light from the crystals inside leaks through a jagged crack.
      const crack: [number, number, number][] = [[0.1, 2.2, 0.06], [0.2, 1.9, 0.05], [0.05, 1.6, 0.06], [0.25, 1.3, 0.05], [0.1, 1.0, 0.06], [-0.05, 0.7, 0.05], [-0.3, 0.55, 0.05], [0.15, 0.4, 0.05], [-0.5, 1.4, 0.04], [-0.35, 1.5, 0.05], [0.55, 0.9, 0.04]];
      for (const [o, y, w] of crack) gl.box(alongX ? o : 0.27, y, alongX ? 0.27 : o, alongX ? 0.14 : w, 0.22, alongX ? w : 0.14, [0.9, 1.8, 3.4], {});
      // Moss along the foot.
      m.box(0, 0.02, alongX ? 0.28 : 0, alongX ? 2.2 : 0.1, 0.18, alongX ? 0.08 : 2.2, '#3e5a34', { kind: K.Grass });
    });
    this.group.position.set(x, this.y, z);
    g.scene.add(this.group);
    this.glow = g.lights.add(x, this.y + 1.2, z + (alongX ? 0.8 : 0), 0x6aa0ff, 2.5, 3, 0.2);
    this.collider = g.grid.addCollider(alongX
      ? { kind: 'b', x0: x - 1.1, z0: z - 0.3, x1: x + 1.1, z1: z + 0.3, y0: this.y - 1, y1: this.y + 3 }
      : { kind: 'b', x0: x - 0.3, z0: z - 1.1, x1: x + 0.3, z1: z + 1.1, y0: this.y - 1, y1: this.y + 3 });
  }
  glow: LightSource;
  private chipT = -9;
  /** A blow too light to break it. */
  chip(g: Game, dx: number, dz: number) {
    g.audio.sfx('clang', this.x, this.z);
    g.fx.burst(P.spark, this.x - dx * 0.4, this.y + 1.1, this.z - dz * 0.4, 8, 3, 2);
    for (let i = 0; i < 6; i++) g.fx.emit(P.splinter, this.x + (Math.random() - 0.5) * 1.5, this.y + 0.5 + Math.random() * 1.5, this.z, (Math.random() - 0.5) * 2, 1 + Math.random() * 2, 1);
    g.shake(0.15);
    this.group.position.x = this.x + (Math.random() - 0.5) * 0.06;
    setTimeout(() => this.group.position.set(this.x, this.y, this.z), 80);
    if (g.time - this.chipT > 2.5) {
      this.chipT = g.time;
      g.pop(this, 'the stone cracks... strike harder!', '#b8d8ff');
      g.ui.hint(g.input.usingTouch ? 'Heavy blows break walls: the third hit of a combo, a full charged spin, a dash strike or a plunge.' : `Heavy blows break walls: the third hit of a combo, a full charged spin (hold ${g.input.label('attack')}), a dash strike or plunge (${g.input.label('special')}).`, 6);
    }
  }
  smash(g: Game, instant = false) {
    this.broken = true;
    this.collider.on = false;
    this.glow.on = false;
    this.glow.level = 0;
    g.scene.remove(this.group);
    if (instant) return;
    for (let i = 0; i < 30; i++) g.fx.emit(P.splinter, this.x + (Math.random() - 0.5) * 2, this.y + Math.random() * 2, this.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 6, 2 + Math.random() * 4, (Math.random() - 0.5) * 6);
    g.fx.burst(P.puff, this.x, this.y + 1, this.z, 14, 3);
  }
}

// ---------- breakables ----------

export class Breakable {
  y: number;
  broken = false;
  group: THREE.Group;
  collider: Collider;
  constructor(public x: number, public z: number, public what: 'pot' | 'crate' | 'barrel', g: Game) {
    this.y = g.grid.groundAt(x, z);
    const tone = 0.85 + Math.random() * 0.3;
    this.group = meshOf((m) => {
      if (what === 'pot') {
        m.cyl(0, 0, 0, 0.2, 0.3, 0.3, 7, '#8a5a3a', { shade: tone });
        m.cyl(0, 0.3, 0, 0.3, 0.16, 0.2, 7, '#8a5a3a', { shade: tone, cap: false });
        m.cyl(0, 0.5, 0, 0.14, 0.17, 0.08, 7, '#6a4028', { shade: tone });
      } else if (what === 'crate') {
        m.box(0, 0, 0, 0.62, 0.62, 0.62, PAL.woodLight, { kind: K.Wood, shade: tone });
        m.box(0, 0.28, 0, 0.64, 0.07, 0.64, PAL.woodDark, { kind: K.Wood });
      } else {
        m.cyl(0, 0, 0, 0.27, 0.3, 0.36, 8, PAL.wood, { kind: K.Wood, cap: false, shade: tone });
        m.cyl(0, 0.36, 0, 0.3, 0.27, 0.36, 8, PAL.wood, { kind: K.Wood, shade: tone });
        m.cyl(0, 0.1, 0, 0.29, 0.29, 0.05, 8, PAL.iron, { cap: false });
        m.cyl(0, 0.58, 0, 0.29, 0.29, 0.05, 8, PAL.iron, { cap: false });
      }
    });
    this.group.position.set(x, this.y, z);
    this.group.rotation.y = Math.random() * Math.PI;
    g.scene.add(this.group);
    this.collider = g.grid.addCollider({ kind: 'c', x, z, r: 0.3, y0: this.y - 1, y1: this.y + 0.7 });
  }
}

// ---------- windmill ----------

export class Windmill {
  sails: THREE.Group;
  constructor(x: number, z: number, g: Game) {
    const y = g.grid.groundAt(x, z);
    const tower = meshOf((m) => {
      m.cyl(0, -0.3, 0, 1.9, 1.3, 6.3, 8, PAL.plaster2, { kind: K.Plaster, rot: 0.39 });
      m.cyl(0, 6.0, 0, 1.7, 0, 1.8, 8, PAL.thatch, { kind: K.Thatch, rot: 0.39 });
      m.box(0.2, 0, 1.55, 0.9, 1.6, 0.2, PAL.woodDark, { kind: K.Wood });
      m.box(1.2, 0, 1.0, 0.1, 0.1, 0.1, PAL.woodDark);
    });
    tower.position.set(x, y, z);
    const win = meshOf((_m, gl) => {
      gl.box(0.9, 3.4, 1.05, 0.4, 0.5, 0.06, GLOW.window, {});
      gl.box(-0.2, 2.4, 1.55, 0.35, 0.45, 0.06, GLOW.windowDim, {});
    });
    tower.add(win);
    g.lights.add(x + 1.3, y + 3.3, z + 1.4, 0xffa050, 3, 4.5, 0.05);
    this.sails = meshOf((m) => {
      m.box(0, -0.25, -0.25, 0.4, 0.5, 0.5, PAL.woodDark, { kind: K.Wood });
      for (let i = 0; i < 4; i++) {
        m.push().rotateX((i * Math.PI) / 2);
        m.box(0.1, 0, -0.08, 0.1, 4.2, 0.12, PAL.woodDark, { kind: K.Wood });
        for (let k = 0; k < 4; k++) m.box(0.14, 1.0 + k * 0.85, 0.35, 0.04, 0.75, 0.8, '#b8ac92', { kind: K.Cloth });
        m.pop();
      }
    });
    const hub = new THREE.Group();
    hub.position.set(x + 1.25, y + 5.1, z + 1.25);
    hub.rotation.y = -Math.PI / 4;
    hub.add(this.sails);
    g.scene.add(tower, hub);
    g.grid.addCollider({ kind: 'c', x, z, r: 1.8, y0: y - 1, y1: y + 8 });
  }
  update(dt: number) {
    this.sails.rotation.x += dt * 0.5;
  }
}

// ---------- villagers ----------

export class Npc implements Interactable {
  x: number;
  y: number;
  z: number;
  radius = 2.1;
  model: Model;
  visible: boolean;
  walkTo: { x: number; z: number } | null = null;
  /** Further stops after walkTo, followed in order. */
  route: { x: number; z: number }[] = [];
  fx = 0.7;
  fz = 0.7;
  t = 0;
  constructor(public def: NpcDef, g: Game) {
    this.x = def.x;
    this.z = def.z;
    this.y = g.grid.groundAt(def.x, def.z);
    this.model = makeVillager(def.look);
    this.model.rig.addTo(g.scene);
    this.model.rig.face(this.fx, this.fz, 0);
    this.visible = !def.hidden;
  }
  get name() {
    return this.def.name;
  }
  prompt() {
    const n = this.def.name.split(' ');
    return this.visible ? `Talk to ${n[0] === 'Old' ? n.slice(0, 2).join(' ') : n[0]}` : null;
  }
  interact(g: Game) {
    g.talkTo(this);
  }
  update(dt: number, g: Game) {
    this.t += dt;
    const p = g.player;
    if (this.walkTo) {
      const dx = this.walkTo.x - this.x, dz = this.walkTo.z - this.z, d = Math.hypot(dx, dz);
      if (d < 0.2) this.walkTo = this.route.shift() ?? null;
      else {
        this.x += (dx / d) * 3.2 * dt;
        this.z += (dz / d) * 3.2 * dt;
        this.y = g.grid.groundAt(this.x, this.z);
        this.fx = dx / d;
        this.fz = dz / d;
      }
    } else if (Math.hypot(p.x - this.x, p.z - this.z) < 4.5) {
      const dx = p.x - this.x, dz = p.z - this.z, d = Math.hypot(dx, dz) || 1;
      this.fx = dx / d;
      this.fz = dz / d;
    }
    this.model.rig.setCastShadow(Math.hypot(p.x - this.x, p.z - this.z) < 16);
    const caged = this.def.id === 'brother' && g.cage && !g.cage.open;
    const name = caged ? 'captive' : g.talking === this ? 'talk' : g.victory ? 'cheer' : 'idle';
    const rig = this.model.rig;
    rig.face(this.fx, this.fz, dt, 6);
    this.model.animate(dt, this.x, this.z, name, this.t, g.time + this.x);
    rig.place(g.cam, this.x, this.y, this.z, this.y, this.visible);
  }
}
