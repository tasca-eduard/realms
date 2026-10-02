import { makeChicken, makeDeer, makeFox, makeOwl, makeRabbit, makeSquirrel, type Model } from './models';
import type { Game } from './game';

// Small harmless life: chickens scratching in a yard, rabbits and squirrels in
// the grass, a fox on the prowl, deer at the wood's edge, owls on dead trees.
// They wander inside their patch and scatter when the knight comes at them.

export type CritterKind = 'chicken' | 'rabbit' | 'squirrel' | 'fox' | 'deer' | 'owl';

export interface CritterDef {
  kind: CritterKind;
  x: number;
  z: number;
  /** Patch they stay inside: x0, z0, x1, z1. */
  area: [number, number, number, number];
  /** Owls: the height of their perch. */
  perch?: number;
}

/** How close the knight may come, how fast they walk and run, whether they stop to graze. */
const KIND: Record<CritterKind, { scare: number; walk: number; run: number; graze: boolean; sound: 'cluck' | 'rustle' }> = {
  chicken: { scare: 2.2, walk: 0.8, run: 3, graze: true, sound: 'cluck' },
  rabbit: { scare: 4.5, walk: 1.6, run: 5, graze: false, sound: 'rustle' },
  squirrel: { scare: 3.5, walk: 1.8, run: 6, graze: true, sound: 'rustle' },
  fox: { scare: 6, walk: 1.2, run: 5.5, graze: true, sound: 'rustle' },
  deer: { scare: 7.5, walk: 0.9, run: 7, graze: true, sound: 'rustle' },
  owl: { scare: 3.2, walk: 0, run: 4, graze: false, sound: 'rustle' },
};

const MAKE: Record<CritterKind, () => Model> = {
  chicken: makeChicken, rabbit: makeRabbit, squirrel: makeSquirrel, fox: makeFox, deer: makeDeer, owl: makeOwl,
};

export class Critter {
  x: number;
  y: number;
  z: number;
  fx = 1;
  fz = 0;
  model: Model;
  private target: { x: number; z: number } | null = null;
  private t = Math.random() * 3;
  private state: 'idle' | 'walk' | 'peck' | 'flee' | 'fly' | 'gone' = 'idle';
  private head = 0;

  constructor(public def: CritterDef, g: Game) {
    this.x = def.x;
    this.z = def.z;
    this.y = def.perch ?? g.grid.groundAt(def.x, def.z);
    this.model = MAKE[def.kind]();
    this.model.rig.addTo(g.scene);
    if (def.kind === 'owl') {
      this.fx = 0.7;
      this.fz = 0.7;
      this.model.rig.scale = 1.6;
    }
    this.model.rig.face(def.kind === 'owl' ? 0.7 : Math.random() - 0.5, def.kind === 'owl' ? 0.7 : Math.random() - 0.5, 0);
    // (Set where it stands from the start: one never yet near the camera would wait at the world's origin, drawn
    // whenever the view takes in that corner.)
    this.model.rig.place(g.cam, this.x, this.y, this.z, g.grid.groundAt(this.x, this.z), true);
  }

  private pick() {
    const [x0, z0, x1, z1] = this.def.area;
    this.target = { x: x0 + Math.random() * (x1 - x0), z: z0 + Math.random() * (z1 - z0) };
  }

  update(dt: number, g: Game) {
    // Only animate near the camera.
    if (Math.abs(this.x - g.cam.focus.x) + Math.abs(this.z - g.cam.focus.z) > 40) return;
    this.model.rig.setCastShadow(Math.hypot(g.player.x - this.x, g.player.z - this.z) < 10);
    if (this.def.kind === 'owl') return this.owl(dt, g);
    const k = KIND[this.def.kind];
    this.t -= dt;
    const p = g.player;
    const pd = Math.hypot(p.x - this.x, p.z - this.z);
    if (pd < k.scare && (this.state !== 'flee' || this.t <= 0)) {
      // Run away from the knight, staying in the patch.
      const [x0, z0, x1, z1] = this.def.area;
      const ax = this.x - p.x, az = this.z - p.z, l = Math.hypot(ax, az) || 1;
      const run = this.def.kind === 'deer' ? 6 : 3;
      this.target = { x: Math.min(x1, Math.max(x0, this.x + (ax / l) * run)), z: Math.min(z1, Math.max(z0, this.z + (az / l) * run)) };
      if (this.state !== 'flee') g.audio.sfx(k.sound, this.x, this.z);
      this.state = 'flee';
      this.t = 0.8;
    } else if (this.t <= 0) {
      const r = Math.random();
      if (r < 0.45) {
        this.pick();
        this.state = 'walk';
        this.t = 3;
      } else if (r < 0.75 && k.graze) {
        this.state = 'peck';
        this.t = 1 + Math.random() * (this.def.kind === 'deer' ? 4 : 1);
      } else {
        this.state = 'idle';
        this.t = 1 + Math.random() * 2;
      }
    }
    let speed = 0;
    if ((this.state === 'walk' || this.state === 'flee') && this.target) {
      const dx = this.target.x - this.x, dz = this.target.z - this.z, d = Math.hypot(dx, dz);
      if (d < 0.15) {
        this.state = 'idle';
        this.target = null;
      } else {
        speed = this.state === 'flee' ? k.run : k.walk;
        this.fx = dx / d;
        this.fz = dz / d;
        const body = { x: this.x, y: this.y, z: this.z, r: this.def.kind === 'deer' ? 0.35 : 0.15 };
        g.grid.move(body, this.fx * speed * dt, this.fz * speed * dt, 0.3, true);
        this.x = body.x;
        this.z = body.z;
        this.y = g.grid.groundAt(this.x, this.z);
      }
    }
    const rig = this.model.rig;
    rig.face(this.fx, this.fz, dt, this.def.kind === 'deer' ? 5 : 10);
    this.model.animate(dt, this.x, this.z, this.state, 1.5 - this.t, g.time);
    rig.place(g.cam, this.x, this.y, this.z, this.y, true);
  }

  /** Owls sit and watch. Come too close and they flap off, to come back once you've gone. */
  private owl(dt: number, g: Game) {
    const p = g.player, d = this.def, rig = this.model.rig;
    const pd = Math.hypot(p.x - d.x, p.z - d.z);
    this.t += dt;
    if (this.state === 'gone') {
      if (this.t > 25 && pd > 16) {
        this.state = 'idle';
        this.x = d.x;
        this.z = d.z;
        this.y = d.perch!;
      }
      rig.place(g.cam, this.x, this.y, this.z, g.grid.groundAt(this.x, this.z), false);
      return;
    }
    if (this.state === 'fly') {
      this.x += this.fx * 4 * dt;
      this.z += this.fz * 4 * dt;
      this.y += 1.4 * dt;
      if (this.t > 3) {
        this.state = 'gone';
        this.t = 0;
      }
    } else if (pd < KIND.owl.scare && Math.abs(p.y - this.y) < 4) {
      this.state = 'fly';
      this.t = 0;
      const ax = d.x - p.x, az = d.z - p.z, l = Math.hypot(ax, az) || 1;
      this.fx = ax / l;
      this.fz = az / l;
      g.audio.sfx('rustle', this.x, this.z);
    } else {
      // Watch the knight: the head turns, the body mostly doesn't.
      const want = Math.atan2(p.x - this.x, p.z - this.z) - rig.yaw;
      const wrapped = Math.atan2(Math.sin(want), Math.cos(want));
      this.head += (Math.max(-1.6, Math.min(1.6, wrapped)) - this.head) * Math.min(1, dt * 3);
    }
    rig.face(this.fx, this.fz, dt, 3);
    this.model.animate(dt, this.x, this.z, this.state === 'fly' ? 'fly' : 'idle', this.t, g.time, { v: this.head });
    rig.place(g.cam, this.x, this.y, this.z, g.grid.groundAt(this.x, this.z), true);
  }
}
