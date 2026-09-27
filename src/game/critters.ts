import { makeChicken, makeRabbit, type Model } from './models';
import type { Game } from './game';

// Small harmless life: chickens scratching in a yard, rabbits in the grass.
// They wander inside their patch and scatter when the knight runs at them.

export interface CritterDef {
  kind: 'chicken' | 'rabbit';
  x: number;
  z: number;
  /** Patch they stay inside: x0, z0, x1, z1. */
  area: [number, number, number, number];
}

export class Critter {
  x: number;
  y: number;
  z: number;
  fx = 1;
  fz = 0;
  model: Model;
  private target: { x: number; z: number } | null = null;
  private t = Math.random() * 3;
  private state: 'idle' | 'walk' | 'peck' | 'flee' = 'idle';

  constructor(public def: CritterDef, g: Game) {
    this.x = def.x;
    this.z = def.z;
    this.y = g.grid.groundAt(def.x, def.z);
    this.model = def.kind === 'chicken' ? makeChicken() : makeRabbit();
    this.model.rig.addTo(g.scene);
    this.model.rig.face(Math.random() - 0.5, Math.random() - 0.5, 0);
  }

  private pick() {
    const [x0, z0, x1, z1] = this.def.area;
    this.target = { x: x0 + Math.random() * (x1 - x0), z: z0 + Math.random() * (z1 - z0) };
  }

  update(dt: number, g: Game) {
    // Only animate near the camera.
    if (Math.abs(this.x - g.cam.focus.x) + Math.abs(this.z - g.cam.focus.z) > 40) return;
    this.t -= dt;
    const p = g.player;
    const pd = Math.hypot(p.x - this.x, p.z - this.z);
    const scare = this.def.kind === 'rabbit' ? 4.5 : 2.2;
    if (pd < scare && (this.state !== 'flee' || this.t <= 0)) {
      // Run away from the knight, staying in the patch.
      const [x0, z0, x1, z1] = this.def.area;
      const ax = this.x - p.x, az = this.z - p.z, l = Math.hypot(ax, az) || 1;
      this.target = { x: Math.min(x1, Math.max(x0, this.x + (ax / l) * 3)), z: Math.min(z1, Math.max(z0, this.z + (az / l) * 3)) };
      if (this.state !== 'flee') g.audio.sfx(this.def.kind === 'chicken' ? 'cluck' : 'rustle', this.x, this.z);
      this.state = 'flee';
      this.t = 0.8;
    } else if (this.t <= 0) {
      const r = Math.random();
      if (r < 0.45) {
        this.pick();
        this.state = 'walk';
        this.t = 3;
      } else if (r < 0.75 && this.def.kind === 'chicken') {
        this.state = 'peck';
        this.t = 1 + Math.random();
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
        speed = this.state === 'flee' ? (this.def.kind === 'rabbit' ? 5 : 3) : this.def.kind === 'rabbit' ? 1.6 : 0.8;
        this.fx = dx / d;
        this.fz = dz / d;
        const body = { x: this.x, y: this.y, z: this.z, r: 0.15 };
        g.grid.move(body, this.fx * speed * dt, this.fz * speed * dt, 0.3, true);
        this.x = body.x;
        this.z = body.z;
        this.y = g.grid.groundAt(this.x, this.z);
      }
    }
    const rig = this.model.rig;
    rig.face(this.fx, this.fz, dt, 10);
    this.model.animate(dt, this.x, this.z, this.state, 1.5 - this.t, g.time);
    rig.place(g.cam, this.x, this.y, this.z, this.y, true);
  }
}
