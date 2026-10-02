import * as THREE from 'three';
import { Geo } from '../engine/geo';
import { glowMaterial, K, worldMaterial } from '../engine/materials';
import { P } from '../engine/particles';
import type { LightSource } from '../engine/lights';
import type { Collider } from '../world/grid';
import type { Game } from './game';
import type { Interactable } from './objects';

// ---------------------------------------------------------------------------
// The way into the Tidelord's drowned palace (the Sunken Reef): the drowned kingdom's great bell, hung in its
// plaza, that once opened the palace's floodgate (struck with a blow, it tolls, and across the trench the gate
// rises); the floodgate itself, which slams shut behind the knight when the Tidelord wakes; and the dawn that
// comes down through the water into his hall once he's fallen.
// ---------------------------------------------------------------------------

const BRONZE = '#6a8a4a', BRONZE_D = '#4a6236', BRONZE_L = '#c8b060', BARNACLE = '#c8c2ac';

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

/**
 * The sunken bell: a great bronze bell, green with age, hanging from its beam in the drowned plaza (the frame
 * is the realm's). A blow rings it: it swings and tolls, a ring of bubbles runs out from it. Rung once, it has
 * done its work (the story opens the floodgate); it still tolls if struck.
 */
export class SunkenBell implements Interactable {
  y: number;
  radius = 3;
  rung = false;
  private group: THREE.Group;
  private swing = 0;
  private swingV = 0;
  private light: LightSource;
  private struckBy: Set<object> | null = null;
  /** (x, z) under the beam; `top` the beam's height above the floor. */
  constructor(public x: number, public z: number, private top: number, g: Game, private onRing: () => void) {
    this.y = g.grid.groundAt(x, z);
    const H = 1.75;
    this.group = meshOf((m, gl) => {
      // Crown loops on the beam, the shoulder, the waist flaring to the lip, bands round it, the clapper.
      m.box(0, -0.22, 0, 0.12, 0.22, 0.34, BRONZE_D, { kind: K.Metal });
      m.blob(0, -0.38, 0, 0.5, 0.26, 0.5, BRONZE, 91, { kind: K.Metal, jitter: 0.02 });
      m.cyl(0, -H, 0, 0.95, 0.52, H - 0.3, 14, BRONZE, { kind: K.Metal });
      m.cyl(0, -H - 0.04, 0, 1.02, 0.97, 0.16, 14, BRONZE_D, { kind: K.Metal });
      for (const t of [0.25, 0.7]) m.cyl(0, -H + (H - 0.3) * t, 0, 0.96 - 0.43 * t + 0.03, 0.96 - 0.43 * (t + 0.05) + 0.03, 0.09, 14, BRONZE_L, { kind: K.Metal, cap: false });
      m.box(0, -H - 0.3, 0, 0.06, 0.95, 0.06, '#3a3a40', { kind: K.Metal });
      m.blob(0, -H - 0.36, 0, 0.14, 0.14, 0.14, '#3a3a40', 93, { kind: K.Metal });
      // Barnacles and a little coral where the sea has had it all these years.
      for (let k = 0; k < 16; k++) {
        const a = k * 2.4, yy = -H + 0.15 + ((k * 7) % 10) * 0.12, rr = 0.96 - 0.43 * ((yy + H) / (H - 0.3)) + 0.02;
        m.cyl(Math.cos(a) * rr, yy, Math.sin(a) * rr, 0.045, 0.025, 0.04, 5, BARNACLE, { kind: K.Rock });
      }
      m.beam([0.2, -0.45, 0.28], [0.32, -0.15, 0.38], 0.03, '#c8483a');
      // A faint glow in its runes (the old kingdom's seal on its waist), so it's seen from afar.
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        gl.box(Math.cos(a) * 0.8, -H + 0.62, Math.sin(a) * 0.8, 0.13, 0.2, 0.13, [0.9, 2.6, 1.9], { kind: 0 });
      }
    });
    this.group.position.set(x, this.y + top, z);
    g.scene.add(this.group);
    this.light = g.lights.add(x, this.y + 1.2, z, 0x9ae8c0, 3.4, 7, 0.1);
    // (It hangs clear of the floor, but a knight can't walk through it.)
    const c: Collider = g.grid.addCollider({ kind: 'c', x, z, r: 0.95, y0: this.y + top - H - 0.2, y1: this.y + top });
    void c;
  }
  prompt() {
    return this.rung ? null : '!The drowned kingdom\'s great bell. Strike it.';
  }
  interact() {}
  /** Struck: it swings away from the blow and tolls. */
  ring(g: Game, fx: number, fz: number) {
    this.swingV += 2.6 * Math.sign(fz || fx || 1);
    g.audio.sfx('toll', this.x, this.z);
    g.audio.sfx('clang', this.x, this.z);
    g.shake(0.35);
    this.light.level = 3;
    // A ring of bubbles running out from it.
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * Math.PI * 2;
      g.fx.emit(P.seaBubble, this.x + Math.cos(a) * 0.9, this.y + this.top - 1.2, this.z + Math.sin(a) * 0.9, Math.cos(a) * 3.5, 0.6, Math.sin(a) * 3.5);
    }
    if (!this.rung) {
      this.rung = true;
      this.onRing();
    }
  }
  setRung() {
    this.rung = true;
  }
  update(dt: number, g: Game) {
    // A blow from the knight's sword (a swing at it, a spin, a dash or a plunge beside it) rings it, once a blow.
    const p = g.player, dx = this.x - p.x, dz = this.z - p.z, d = Math.hypot(dx, dz);
    const swinging = (p.state === 'attack' && p.t > 0.08 && p.t < 0.26) || p.state === 'spin' || p.state === 'stab' || p.state === 'dash' || p.state === 'plunge';
    if (!swinging) this.struckBy = null;
    else if (p.alive && !g.flying && this.struckBy !== p.swingHits && d < 2.6 && Math.abs(p.y - this.y) < 1.6 && (p.state !== 'attack' || (dx * p.fx + dz * p.fz) / (d || 1) > 0)) {
      this.struckBy = p.swingHits;
      this.ring(g, p.fx, p.fz);
    }
    // It swings back and forth, slowing (the water holds it).
    this.swingV += -this.swing * 9 * dt;
    this.swingV *= Math.exp(-0.9 * dt);
    this.swing += this.swingV * dt;
    this.group.rotation.x = this.swing * 0.35;
    this.light.level += ((this.rung ? 0.6 : 1) - this.light.level) * Math.min(1, dt * 2);
    if (!this.rung && Math.random() < dt * 1.5) g.fx.emit(P.seaBubble, this.x + (Math.random() - 0.5) * 1.2, this.y + this.top - 1.4, this.z + (Math.random() - 0.5) * 1.2, 0, 0.5, 0);
  }
}

/**
 * The palace's floodgate: a bronze grille in a gateway (along z through (x, z), `w` wide), shut until the bell
 * is rung and the crew on the landing (who hold its winch) are beaten; then it rises into its towers. It stands in for the arena's door (the same open/setOpen/update): when
 * the Tidelord wakes it drops shut behind the knight, and a lost fight lifts it again.
 */
export class Floodgate implements Interactable {
  open = false;
  t = 0; // 0 shut, 1 risen
  y: number;
  radius = 3.2;
  collider: Collider;
  private leaf: THREE.Group;
  private lift: number;
  constructor(public x: number, public z: number, public w: number, h: number, g: Game) {
    this.y = g.grid.groundAt(x, z);
    this.lift = h + 0.2;
    this.leaf = meshOf((m, gl) => {
      // Upright bars, bands across, spikes along the foot; barnacles on it, weed caught in it.
      const n = Math.round(w / 0.36);
      for (let i = 0; i <= n; i++) m.box(0, 0, -w / 2 + (i / n) * w, 0.12, h, 0.09, i % 4 ? BRONZE : BRONZE_D, { kind: K.Metal });
      for (const yy of [0.25, h * 0.5, h - 0.2]) m.box(0, yy, 0, 0.22, 0.18, w + 0.1, BRONZE_D, { kind: K.Metal });
      for (let i = 0; i <= n; i++) m.cyl(0, -0.25, -w / 2 + (i / n) * w, 0.02, 0.07, 0.25, 5, BRONZE_L, { kind: K.Metal });
      for (let k = 0; k < 14; k++) m.cyl(0.07, 0.3 + ((k * 5) % 11) * (h / 12), -w / 2 + ((k * 7) % 13) * (w / 13), 0.04, 0.025, 0.035, 5, BARNACLE, { kind: K.Rock });
      for (let k = 0; k < 4; k++) m.box(0.08, h * (0.3 + 0.15 * k), -w / 2 + 0.6 + k * 0.9, 0.04, 0.5, 0.12, '#5a6a2a', { kind: K.Leaves });
      // The kingdom's seal on the middle band: dark until the bell has rung.
      gl.box(0.12, h * 0.5 - 0.15, 0, 0.04, 0.5, 0.5, [0.1, 0.35, 0.32], { kind: 0 });
    });
    this.leaf.position.set(x, this.y, z);
    g.scene.add(this.leaf);
    this.collider = g.grid.addCollider({ kind: 'b', x0: x - 0.45, z0: z - w / 2, x1: x + 0.45, z1: z + w / 2, y0: this.y - 1, y1: this.y + h });
  }
  prompt(g: Game) {
    const f = g.save.data.flags;
    return this.open || (f.bell && f.garrison) ? null : !f.bell ? '!The floodgate is shut fast. They say the kingdom\'s great bell once opened it.' : "!The Tidelord's crew on the landing hold the floodgate's winch. Beat them.";
  }
  interact() {}
  setOpen(open: boolean, g: Game, instant = false) {
    if (this.open === open) return;
    this.open = open;
    this.collider.on = !open;
    if (instant) {
      this.t = open ? 1 : 0;
      return;
    }
    if (open) g.audio.sfx('chains', this.x, this.z);
    else {
      g.audio.sfx('doorSlam', this.x, this.z);
      g.shake(0.5);
    }
    g.fx.burst(P.seaBubble, this.x, this.y + 0.4, this.z, 30, 3, 1.5);
    g.fx.burst(P.dust, this.x, this.y + 0.2, this.z, 16, 2.5);
  }
  /** The bell rung while the crew still hold its winch: it jerks in its towers, rattling, and holds. */
  strain(g: Game) {
    if (this.open) return;
    this.shudder = 1.8;
    g.audio.sfx('chains', this.x, this.z);
    g.fx.burst(P.seaBubble, this.x, this.y + 0.4, this.z, 24, 3, 1.5);
    g.fx.burst(P.dust, this.x, this.y + this.lift, this.z, 12, 2);
  }
  private shudder = 0;
  update(dt: number) {
    // It grinds up slowly, and drops fast.
    const target = this.open ? 1 : 0;
    this.t += Math.sign(target - this.t) * Math.min(Math.abs(target - this.t), dt * (this.open ? 0.4 : 3));
    const k = this.open ? this.t * this.t * (3 - 2 * this.t) : this.t;
    this.shudder = Math.max(0, this.shudder - dt);
    this.leaf.position.y = this.y + this.lift * k + 0.3 * Math.min(1, this.shudder) * Math.abs(Math.sin(this.shudder * 20));
  }
}

/**
 * The dawn come down through the water into the Tidelord's hall: shafts of morning light slanting from the
 * surface to the floor over the rect (x0, z0)-(x1, z1), motes drifting in them. They brighten over a few seconds.
 */
export class DawnShafts {
  private mats: THREE.MeshBasicMaterial[] = [];
  private k = 0;
  private group = new THREE.Group();
  constructor(private x0: number, private z0: number, private x1: number, private z1: number, private floor: number, private surface: number, g: Game, instant = false) {
    // Soft all round: brightest at the top and down its middle, fading out at its sides and at the floor.
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 64;
    const ctx = c.getContext('2d')!, img = ctx.createImageData(32, 64);
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 32; x++) {
        const v = y < 40 ? 1 - (y / 40) * 0.4 : 0.6 * (1 - (y - 40) / 24), u = Math.exp(-(((x - 15.5) / 8) ** 2));
        const i = (y * 32 + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(255 * v * u);
      }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    const H = surface - floor + 0.5;
    for (let i = 0; i < 7; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.6, 1.35, 0.9), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      this.mats.push(mat);
      const wdt = 1.6 + (i % 3) * 0.8;
      const x = x0 + ((i * 0.37 + 0.12) % 1) * (x1 - x0), z = z0 + ((i * 0.61 + 0.2) % 1) * (z1 - z0);
      for (const rot of [Math.PI / 4, -Math.PI / 4]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(wdt, H), mat);
        m.position.set(x, floor + H / 2, z);
        // (Slanting a little, as the low sun comes in.)
        m.rotation.set(0, rot, 0.12, 'YXZ');
        m.renderOrder = 3;
        this.group.add(m);
      }
    }
    g.scene.add(this.group);
    if (instant) this.k = 1;
    this.apply();
  }
  private apply() {
    for (const [i, m] of this.mats.entries()) m.opacity = this.k * (0.2 + (i % 3) * 0.07);
  }
  update(dt: number, g: Game) {
    if (this.k < 1) {
      this.k = Math.min(1, this.k + dt / 4);
      this.apply();
    }
    if (Math.random() < dt * 10) g.fx.emit(P.mote, this.x0 + Math.random() * (this.x1 - this.x0), this.floor + 0.5 + Math.random() * (this.surface - this.floor - 1), this.z0 + Math.random() * (this.z1 - this.z0), 0, -0.1, 0);
  }
}
