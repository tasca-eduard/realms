import * as THREE from 'three';
import { Geo } from '../engine/geo';
import { glowMaterial, K, worldMaterial } from '../engine/materials';
import { P } from '../engine/particles';
import type { LightSource } from '../engine/lights';
import { PAL, GLOW } from '../world/builder';
import type { Game } from './game';

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
        this.cd = 3.5 + Math.random() * 2.5;
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
