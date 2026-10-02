import * as THREE from 'three';
import { P } from '../engine/particles';
import { makeHorse, makeStag, type Model } from './models';
import type { Game } from './game';
import type { Interactable } from './objects';

export type MountKind = 'horse' | 'stag' | 'serpent';

/**
 * A mount: the warhorse, or the Thornstag once it's freed (the Tide Serpent, which swims, is its own: see
 * src/game/serpent.ts). Left alone it grazes and wanders near where you left it. Ridden,
 * the knight's controls drive it (see Player.updateRiding). It has its own
 * health: hits taken while riding land on the horse first, and if it runs out
 * the knight is thrown and the horse bolts home to recover.
 */
export class Mount implements Interactable {
  x: number;
  y: number;
  z: number;
  radius = 2;
  fx = 1;
  fz = 0;
  hp = 3;
  maxHp = 3;
  model: Model;
  home: { x: number; z: number };
  ridden = false;
  state: 'idle' | 'wander' | 'flee' | 'gone' = 'idle';
  t = 0;
  away = 0;
  private target: { x: number; z: number } | null = null;
  constructor(x: number, z: number, g: Game, public kind: MountKind = 'horse', model?: Model) {
    this.x = x;
    this.z = z;
    this.y = g.grid.groundAt(x, z);
    this.home = { x, z };
    this.model = model ?? (kind === 'stag' ? makeStag() : makeHorse());
    this.model.rig.addTo(g.scene);
    this.model.rig.face(-0.7, 0.7, 0);
  }

  get name(): string {
    return this.kind === 'stag' ? 'Thornstag' : 'Warhorse';
  }
  /** Lower case, for sentences ("your warhorse", "the Thornstag"). */
  get called(): string {
    return this.kind === 'stag' ? 'Thornstag' : 'warhorse';
  }

  prompt() {
    return this.ridden || this.state === 'gone' || this.state === 'flee' ? null : `Ride the ${this.called}`;
  }
  interact(g: Game) {
    g.player.mount(this, g);
  }

  /** The knight is thrown: the horse bolts off and comes back rested later. */
  bolt(g: Game) {
    this.ridden = false;
    this.state = 'flee';
    this.t = 0;
    const dx = this.x - g.player.x || 1, dz = this.z - g.player.z;
    const l = Math.hypot(dx, dz) || 1;
    this.target = { x: this.x + (dx / l) * 14, z: this.z + (dz / l) * 14 };
    g.audio.sfx(this.kind === 'stag' ? 'bellow' : 'neigh', this.x, this.z);
  }

  /** Come to a spot (the knight rested at a moonfire far away). */
  arriveAt(x: number, z: number, g: Game) {
    if (this.ridden) return;
    this.x = x;
    this.z = z;
    this.y = g.grid.groundAt(x, z);
    this.home = { x, z };
    this.state = 'idle';
    this.hp = this.maxHp;
  }

  update(dt: number, g: Game) {
    if (this.ridden && g.player.riding === this) return;
    // (A knight who died in the saddle isn't riding any more: it waits where he fell.)
    if (this.ridden) {
      this.ridden = false;
      this.home = { x: this.x, z: this.z };
      this.state = 'idle';
    }
    this.t += dt;
    let moving = false, speed = 0;
    switch (this.state) {
      case 'idle':
        if (this.t > 5 + Math.random() * 5) {
          const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 3;
          this.target = { x: this.home.x + Math.cos(a) * r, z: this.home.z + Math.sin(a) * r };
          this.state = 'wander';
          this.t = 0;
        }
        break;
      case 'wander':
      case 'flee': {
        if (!this.target) break;
        const dx = this.target.x - this.x, dz = this.target.z - this.z, d = Math.hypot(dx, dz);
        speed = this.state === 'flee' ? 8 : 1.4;
        if (d < 0.3 || this.t > 6) {
          if (this.state === 'flee') {
            this.state = 'gone';
            this.away = 25;
            this.model.rig.root.visible = false;
            this.model.rig.shadow.visible = false;
          } else this.state = 'idle';
          this.t = 0;
          this.target = null;
          break;
        }
        moving = true;
        this.fx = dx / d;
        this.fz = dz / d;
        const body = { x: this.x, y: this.y, z: this.z, r: 0.55 };
        g.grid.move(body, this.fx * speed * dt, this.fz * speed * dt, 0.45, true);
        this.x = body.x;
        this.z = body.z;
        this.y = g.grid.groundAt(this.x, this.z);
        break;
      }
      case 'gone':
        this.away -= dt;
        if (this.away <= 0) {
          this.arriveAt(this.home.x, this.home.z, g);
          this.model.rig.root.visible = true;
          g.pop(this, `your ${this.called} returns`, '#feae34');
        }
        return;
    }
    // Keep the knight from walking through it.
    const p = g.player;
    if (!p.riding) {
      const dx = p.x - this.x, dz = p.z - this.z, rr = p.r + 0.6;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        p.x = this.x + (dx / d) * rr;
        p.z = this.z + (dz / d) * rr;
      }
    }
    const rig = this.model.rig;
    rig.face(this.fx, this.fz, dt, 5);
    this.model.animate(dt, this.x, this.z, moving ? 'walk' : 'idle', this.t, g.time);
    rig.place(g.cam, this.x, this.y, this.z, this.y, this.state !== 'gone');
    if (moving && this.state === 'flee' && Math.random() < 0.5) g.fx.emit(P.dust, this.x, this.y + 0.1, this.z, 0, 0.4, 0);
  }

  /** Posed and placed by the rider. Returns the saddle's world position. */
  ride(dt: number, g: Game, x: number, y: number, z: number, fx: number, fz: number, name: string, t: number, gy: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.fx = fx;
    this.fz = fz;
    const rig = this.model.rig;
    rig.face(fx, fz, dt, 8);
    this.model.animate(dt, x, z, name, t, g.time);
    rig.place(g.cam, x, y, z, gy, true);
    rig.root.updateMatrixWorld(true);
    return rig.j('saddle').getWorldPosition(new THREE.Vector3());
  }

  get bodyPitch() {
    return this.model.rig.j('body').rotation.x;
  }
}
