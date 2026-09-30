import * as THREE from 'three';
import { Geo } from '../engine/geo';
import { glowMaterial, K, worldMaterial } from '../engine/materials';
import { P } from '../engine/particles';
import type { LightSource } from '../engine/lights';
import { PAL, GLOW } from '../world/builder';
import type { Game } from './game';
import { arrowGeometry } from './combat';
import { HAZARDS } from '../config';

/** An arrow slit high in a tower: it glints, then looses an arrow at the knight. */
export class ArrowSlit {
  private cd = 2 + Math.random() * 3;
  private aim = 0;
  private glint: THREE.Mesh;
  constructor(public x: number, public y: number, public z: number, g: Game) {
    this.glint = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.2, 1.6) }));
    this.glint.position.set(x, y, z);
    this.glint.visible = false;
    g.scene.add(this.glint);
  }
  update(dt: number, g: Game) {
    const p = g.player;
    if (g.victory || !p.alive) {
      this.glint.visible = false;
      return;
    }
    const d = Math.hypot(p.x - this.x, p.z - this.z);
    if (this.aim > 0) {
      this.aim -= dt;
      this.glint.visible = Math.floor(this.aim * 14) % 2 === 0;
      if (this.aim <= 0) {
        this.glint.visible = false;
        g.combat.shootFrom(this.x, this.y, this.z, p.x + p.vx * 0.25, p.y + 0.9, p.z + p.vz * 0.25);
        this.cd = 5 + Math.random() * 3;
      }
      return;
    }
    this.cd -= dt;
    if (this.cd > 0 || d > 14 || d < 2.5 || !g.clearBetween(this.x, this.z, p.x, p.z, p.y + 0.9, 0.8)) return;
    this.aim = 0.85;
    g.audio.sfx('glint', this.x, this.z);
  }
}

/** A chandelier over the throne hall. The Goblin King's crashes can bring it down. */
export class Chandelier {
  group: THREE.Group;
  y0: number;
  y: number;
  vy = 0;
  state: 'hang' | 'warn' | 'fall' | 'down' = 'hang';
  t = 0;
  light: LightSource;
  private ring: THREE.Mesh;
  constructor(public x: number, public z: number, public floor: number, g: Game) {
    this.y0 = this.y = floor + 4.2;
    const m = new Geo(), gl = new Geo(true);
    m.cyl(0, 0, 0, 0.9, 0.9, 0.12, 8, PAL.iron, { kind: K.Metal, cap: false });
    for (let i = 0; i < 4; i++) m.beam([0, 0.1, 0], [Math.cos(i * 1.57) * 0.85, 0.08, Math.sin(i * 1.57) * 0.85], 0.03, PAL.iron);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      m.box(Math.cos(a) * 0.9, 0.1, Math.sin(a) * 0.9, 0.05, 0.1, 0.05, '#e8e0d0');
      gl.box(Math.cos(a) * 0.9, 0.2, Math.sin(a) * 0.9, 0.06, 0.12, 0.06, GLOW.flame, { kind: 1 });
    }
    this.group = new THREE.Group();
    const mesh = new THREE.Mesh(m.build(), worldMaterial());
    mesh.castShadow = true;
    this.group.add(mesh, new THREE.Mesh(gl.build(), glowMaterial()));
    // The chain up to the rafters.
    const chain = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.8, 0.05), new THREE.MeshLambertMaterial({ color: 0x3a3a44 }));
    chain.position.y = 1.0;
    chain.name = 'chain';
    this.group.add(chain);
    this.group.position.set(x, this.y, z);
    g.scene.add(this.group);
    this.light = g.lights.add(x, this.y - 0.3, z, 0xffb060, 10, 9, 0.12);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.5, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.6, 0.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.set(x, floor + 0.05, z);
    this.ring.visible = false;
    g.scene.add(this.ring);
  }

  /** Hang it back up (the knight fell in the boss fight and tries again). */
  reset() {
    this.state = 'hang';
    this.y = this.y0;
    this.vy = 0;
    this.group.position.y = this.y0;
    this.group.rotation.set(0, 0, 0);
    this.group.getObjectByName('chain')!.visible = true;
    this.ring.visible = false;
    this.light.y = this.y0 - 0.3;
    this.light.intensity = 10;
    this.light.flicker = 0.12;
  }

  drop(g: Game) {
    if (this.state !== 'hang') return;
    this.state = 'warn';
    this.t = 0;
    this.ring.visible = true;
    g.audio.sfx('chains', this.x, this.z);
    for (let i = 0; i < 12; i++) g.fx.emit(P.dust, this.x + (Math.random() - 0.5), this.y + 1.5, this.z + (Math.random() - 0.5), 0, -1, 0);
  }

  update(dt: number, g: Game) {
    this.t += dt;
    if (this.state === 'hang') {
      this.group.rotation.z = Math.sin(g.time * 0.9 + this.x) * 0.02;
      return;
    }
    if (this.state === 'warn') {
      (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.4 * Math.sin(this.t * 25);
      this.group.rotation.z = Math.sin(this.t * 30) * 0.06;
      if (this.t > 0.9) {
        this.state = 'fall';
        this.group.getObjectByName('chain')!.visible = false;
      }
      return;
    }
    if (this.state === 'fall') {
      this.vy -= 30 * dt;
      this.y += this.vy * dt;
      if (this.y <= this.floor + 0.05) {
        this.y = this.floor + 0.05;
        this.state = 'down';
        this.ring.visible = false;
        this.group.rotation.set(0.25, 0, 0.18);
        this.light.intensity = 3;
        this.light.flicker = 0.6;
        g.shake(0.7);
        g.audio.sfx('slam', this.x, this.z);
        g.audio.sfx('break', this.x, this.z);
        g.fx.burst(P.flame, this.x, this.y + 0.3, this.z, 30, 3, 3);
        g.fx.burst(P.puff, this.x, this.y + 0.3, this.z, 14, 3);
        g.chandelierImpact(this.x, this.z, this.floor);
      }
      this.group.position.y = this.y;
      this.light.y = this.y + 0.2;
    }
  }
}

/**
 * A snare trap in the grass: a steel loop that glints now and then. Step in it and it
 * bites (a heart) and holds you fast (Snared). A blow springs it safely.
 */
export class SnareTrap {
  armed = true;
  y: number;
  private jaws: THREE.Group;
  private glint: THREE.Mesh;
  private t = Math.random() * 3;
  constructor(public x: number, public z: number, g: Game) {
    this.y = g.grid.groundAt(x, z);
    const m = new Geo();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      m.box(Math.cos(a) * 0.32, 0.02, Math.sin(a) * 0.32, 0.06, 0.03, 0.06, PAL.iron, { kind: K.Metal });
      m.box(Math.cos(a) * 0.26, 0.07, Math.sin(a) * 0.26, 0.03, 0.09, 0.03, '#8a8a96', { kind: K.Metal });
    }
    m.box(0, 0.02, 0, 0.14, 0.03, 0.14, PAL.iron, { kind: K.Metal });
    this.jaws = new THREE.Group();
    this.jaws.add(new THREE.Mesh(m.build(), worldMaterial()));
    this.jaws.position.set(x, this.y, z);
    g.scene.add(this.jaws);
    this.glint = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 3.6) }));
    this.glint.position.set(x + 0.2, this.y + 0.1, z);
    this.glint.visible = false;
    g.scene.add(this.glint);
  }
  /** Something struck it: it snaps shut on nothing. */
  spring(g: Game) {
    if (!this.armed) return;
    this.armed = false;
    this.jaws.scale.set(0.55, 2.2, 0.55);
    this.glint.visible = false;
    g.audio.sfx('clang', this.x, this.z);
    g.fx.burst(P.spark, this.x, this.y + 0.2, this.z, 8, 2, 1.5);
    g.pop({ x: this.x, y: this.y, z: this.z }, 'sprung', '#c0c0cc');
  }
  update(dt: number, g: Game) {
    if (!this.armed) return;
    this.t += dt;
    const k = this.t % 3.2;
    this.glint.visible = k < 0.12;
    const p = g.player;
    if (!p.alive || !p.onGround || p.riding || Math.hypot(p.x - this.x, p.z - this.z) > 0.5 || Math.abs(p.y - this.y) > 0.4) return;
    this.armed = false;
    this.jaws.scale.set(0.55, 2.2, 0.55);
    this.glint.visible = false;
    g.audio.sfx('shieldBreak', this.x, this.z);
    g.snareBites(this.x, this.z);
  }
}

/**
 * A strip of the Thorn Ravine's floor where thorns burst up in turn: a rustle and a few
 * sprouting tips, then a hedge of spikes for a moment. Caught in it: a heart and a shove.
 */
/**
 * A spot the Thorn Warden has marked: a ring glows on the ground, then arrows rain onto it
 * (blockable with a raised shield) or roots burst up through it (not). Either costs a heart.
 */
export class WardenMark {
  done = false;
  private t = 0;
  private hit = false;
  private ring: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  /** A disc growing out to the ring as the moment comes (full: it lands). */
  private fill: THREE.Mesh;
  private fillMat: THREE.MeshBasicMaterial;
  private spikes: THREE.Group | null = null;
  private arrows: THREE.Mesh[] = [];
  y: number;
  constructor(public x: number, public z: number, public kind: 'rain' | 'roots', private delay: number, g: Game) {
    this.y = g.grid.groundAt(x, z);
    // (Drawn over everything, so a root or a trunk between it and the camera can't hide it. The
    // ring's inside edge is where it strikes: 1 m round.)
    const col = kind === 'rain' ? new THREE.Color(3, 0.6, 0.3) : new THREE.Color(1.2, 2.6, 0.5);
    this.mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.98, 1.16, 32), this.mat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.set(x, this.y + 0.06, z);
    this.ring.renderOrder = 5;
    g.scene.add(this.ring);
    this.fillMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
    this.fill = new THREE.Mesh(new THREE.CircleGeometry(0.98, 28), this.fillMat);
    this.fill.rotation.x = -Math.PI / 2;
    this.fill.position.set(x, this.y + 0.05, z);
    this.fill.scale.setScalar(0.01);
    this.fill.renderOrder = 5;
    g.scene.add(this.fill);
    if (kind === 'roots') {
      const m = new Geo();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2, rr = i === 0 ? 0 : 0.35 + Math.random() * 0.4, h = 1.1 + Math.random() * 0.8;
        m.cyl(Math.cos(a) * rr, -0.2, Math.sin(a) * rr, 0.13, 0, h, 5, i % 2 ? '#4a3a2a' : '#35451f', { kind: K.Bark });
        m.box(Math.cos(a) * rr, h * 0.5, Math.sin(a) * rr, 0.05, 0.14, 0.05, '#e8e2d4');
      }
      this.spikes = new THREE.Group();
      const mesh = new THREE.Mesh(m.build(), worldMaterial());
      mesh.castShadow = true;
      this.spikes.add(mesh);
      this.spikes.position.set(x, this.y, z);
      this.spikes.scale.y = 0.02;
      this.spikes.visible = false;
      g.scene.add(this.spikes);
    }
  }
  /** Its arrows have fallen, or its roots burst. */
  get landed() {
    return this.hit;
  }
  update(dt: number, g: Game) {
    if (this.done) return;
    this.t += dt;
    const k = Math.min(1, this.t / this.delay);
    this.mat.opacity = this.hit ? Math.max(0, 0.95 - (this.t - this.delay) * 2) : 0.45 + 0.5 * k;
    this.ring.scale.setScalar(1 + Math.sin(g.time * 24) * 0.025 * k);
    this.fill.scale.setScalar(Math.max(0.01, k));
    this.fillMat.opacity = this.hit ? Math.max(0, 0.4 - (this.t - this.delay) * 1.2) : 0.14 + 0.26 * k;
    if (this.kind === 'roots' && this.spikes && this.t < this.delay && Math.random() < dt * 20) g.fx.emit(P.dust, this.x + (Math.random() - 0.5), this.y + 0.1, this.z + (Math.random() - 0.5), 0, 1, 0);
    // Arrows in flight, the last moment before they land.
    if (this.kind === 'rain' && this.t > this.delay - 0.2 && !this.arrows.length) {
      for (let i = 0; i < 3; i++) {
        const a = new THREE.Mesh(arrowGeometry(), worldMaterial());
        a.rotation.x = Math.PI / 2;
        a.userData.off = [(Math.random() - 0.5) * 1.1, (Math.random() - 0.5) * 1.1];
        g.scene.add(a);
        this.arrows.push(a);
      }
    }
    for (const a of this.arrows) {
      const f = Math.min(1, (this.t - (this.delay - 0.2)) / 0.2);
      const [ox, oz] = a.userData.off as number[];
      a.position.set(this.x + ox, this.y + 7 * (1 - f) + 0.35, this.z + oz);
    }
    if (!this.hit && this.t >= this.delay) {
      this.hit = true;
      if (this.kind === 'rain') {
        g.audio.sfx('arrowThunk', this.x, this.z);
        g.fx.burst(P.dust, this.x, this.y + 0.2, this.z, 8, 1.2);
      } else {
        g.audio.sfx('thorns', this.x, this.z);
        g.fx.burst(P.splinter, this.x, this.y + 0.3, this.z, 10, 1, 2);
        if (this.spikes) this.spikes.visible = true;
      }
      g.wardenMarkLands(this);
    }
    if (this.spikes && this.t >= this.delay) {
      const u = (this.t - this.delay) / 0.9;
      this.spikes.scale.y = u < 0.12 ? Math.max(0.02, u / 0.12) : u > 0.7 ? Math.max(0.02, (1 - u) / 0.3) : 1;
    }
    if (this.t > this.delay + (this.kind === 'rain' ? 0.6 : 0.9)) this.remove(g);
  }
  remove(g: Game) {
    if (this.done) return;
    this.done = true;
    g.scene.remove(this.ring);
    this.ring.geometry.dispose();
    this.mat.dispose();
    g.scene.remove(this.fill);
    this.fill.geometry.dispose();
    this.fillMat.dispose();
    if (this.spikes) g.scene.remove(this.spikes);
    for (const a of this.arrows) g.scene.remove(a);
  }
}

export class ThornBurst {
  private spikes: THREE.Group;
  private y: number;
  private t: number;
  state: 'low' | 'warn' | 'up' = 'low';
  private hitThis = false;
  constructor(public x: number, public z: number, public w: number, public d: number, phase: number, g: Game) {
    this.y = g.grid.groundAt(x, z);
    this.t = phase;
    const m = new Geo();
    for (let i = 0; i < Math.round(w * d * 2.2); i++) {
      const px = (Math.random() - 0.5) * w, pz = (Math.random() - 0.5) * d, h = 0.9 + Math.random() * 0.8;
      m.cyl(px, 0, pz, 0.09, 0, h, 4, Math.random() < 0.5 ? '#4a5e2a' : '#35451f', { kind: K.Bark });
      m.box(px, h * 0.55, pz, 0.04, 0.12, 0.04, '#e8e2d4');
    }
    this.spikes = new THREE.Group();
    const mesh = new THREE.Mesh(m.build(), worldMaterial());
    mesh.castShadow = true;
    this.spikes.add(mesh);
    this.spikes.position.set(x, this.y, z);
    this.spikes.scale.y = 0.04;
    g.scene.add(this.spikes);
  }
  update(dt: number, g: Game) {
    const C = HAZARDS.thornCycle, W = HAZARDS.thornWarn, U = HAZARDS.thornUp;
    this.t = (this.t + dt) % C;
    const k = this.t;
    const prev = this.state;
    this.state = k > C - U ? 'up' : k > C - U - W ? 'warn' : 'low';
    let sy = 0.04;
    if (this.state === 'warn') {
      sy = 0.12 + Math.sin(g.time * 40) * 0.03;
      if (Math.random() < dt * 30) g.fx.emit(P.leaf, this.x + (Math.random() - 0.5) * this.w, this.y + 0.2, this.z + (Math.random() - 0.5) * this.d, 0, 1.2, 0);
      if (prev === 'low') g.audio.sfx('rustle', this.x, this.z);
    } else if (this.state === 'up') {
      const u = (k - (C - U)) / U;
      sy = u < 0.12 ? u / 0.12 : u > 0.8 ? (1 - u) / 0.2 : 1;
      if (prev !== 'up') {
        this.hitThis = false;
        g.audio.sfx('thorns', this.x, this.z);
        g.fx.burst(P.splinter, this.x, this.y + 0.3, this.z, 10, this.w / 2, 2);
      }
      const p = g.player;
      if (!this.hitThis && sy > 0.5 && p.alive && Math.abs(p.x - this.x) < this.w / 2 + 0.2 && Math.abs(p.z - this.z) < this.d / 2 + 0.2 && p.y - this.y < 1.2) {
        this.hitThis = true;
        g.thornsHit(this.x, this.z);
      }
      // Foes caught in it are hurt too.
      if (sy > 0.5)
        for (const e of g.enemies)
          if (e.alive && !e.flying && Math.abs(e.x - this.x) < this.w / 2 && Math.abs(e.z - this.z) < this.d / 2 && !this.hitFoes.has(e)) {
            this.hitFoes.add(e);
            e.prick(2, g);
          }
    }
    if (this.state !== 'up') this.hitFoes.clear();
    this.spikes.scale.y = Math.max(0.04, sy);
  }
  private hitFoes = new Set<object>();
}
