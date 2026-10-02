import * as THREE from 'three';
import { FOES } from '../config';
import { P, type PSpec } from '../engine/particles';
import type { LightSource } from '../engine/lights';
import { Rig } from '../engine/rig';
import { clamp } from '../engine/util';
import type { EnemyType } from '../world/realm';
import { DEN, GROTTO } from '../world/inkgrotto';
import type { Enemy } from './enemies';
import type { Game } from './game';
import { Model, type Anim } from './models';

// ---------------------------------------------------------------------------
// Old Inkarm, the octopus of the Ink Grotto (realm 3's second mini-boss under the sea; its lair is
// src/world/inkgrotto.ts). It lies before its den and never leaves it: it fights with its arms, one attack at a
// time, each shown before it lands.
//   slam   an arm rises out of the floor and crashes down along a line (the line fills on the floor for 1.2 s);
//          below half its strength the arms come two in turn, and some from the side across the knight's place
//   grab   a ring fills under the knight (1.2 s); still in it, an arm bursts up and holds him: mash attack to tear
//          free (and its arms go down), or it squeezes (a heart) and throws him
//   ink    it swells (1 s), then clouds the grotto with ink: the screen goes dark a moment
// Its arms shield its body: blows only land while they're down (after a slam, or a grab torn free), and then
// it shows it, slumped and pale. The fight runs while the knight is in the grotto; a vent at its west end
// gives him air.
// ---------------------------------------------------------------------------

const F = FOES.inkarm;
/** The striking arm: segments, each this long, tapering from the root's radius. */
const SEG = 0.82, NSEG = 10, ARM_R = 0.42;
const SKIN = '#c23a66', SKIN_D = '#82264e', SKIN_M = '#a8305a', SPOT = '#f08aa4', BELLY = '#f0b4c0', SUCKER = '#ffe0e4', SUCKER_D = '#c88894';
/** The ink: thick, dark, slow to clear. */
const INK: PSpec = { color: [0.05, 0.02, 0.08], color2: [0.12, 0.04, 0.16], size: 6, size2: 15, life: 2.8, drag: 1.6, gravity: -0.12, wobble: 0.3, alpha: 0.85, fadeIn: 0.05, soft: true };
const INK_SPLASH: PSpec = { color: [0.08, 0.03, 0.12], color2: [0.16, 0.05, 0.2], size: 3, size2: 7, life: 0.9, drag: 3, gravity: -0.2, alpha: 0.8, soft: true };
/** Silt thrown up where an arm bursts out of the floor or crashes onto it. */
const SILT: PSpec = { color: [0.3, 0.28, 0.32], color2: [0.16, 0.15, 0.2], size: 4, size2: 9, life: 1.1, drag: 3.5, gravity: -0.3, alpha: 0.6, soft: true };

const ease = (k: number) => k * k * (3 - 2 * k);
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const inLairXZ = (x: number, z: number, m = 0) => x > GROTTO.x0 + m && x < GROTTO.x1 - m && z > GROTTO.z0 + m && z < GROTTO.z1 - m;

// ---------- the octopus ----------

/** What its pose shows (the behaviour sets it, eased): arms raised to guard, slumped down, curled asleep, the
 *  mantle swelling with ink, its eye open, a thrash. */
interface InkLook {
  guard: number;
  down: number;
  curl: number;
  swell: number;
  eye: number;
  thrash: number;
}

/** The arms round its body: where each starts, which way it points. */
const ARMS = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2 + Math.PI / 8);
const LENS = [0.7, 0.62, 0.55, 0.48, 0.4], RADS = [0.3, 0.24, 0.18, 0.13, 0.085, 0.04];

/** Old Inkarm: a great purple-red octopus, its mantle wrinkled and spotted, eight arms with pale suckers under
 *  them, one eye glowing amber, the other an old scar. */
function makeInkarm(look: InkLook): Model {
  const r = new Rig({ shadow: 3.4 });
  r.joint('body', 'root', 0, 0.75, 0);
  r.joint('mantle', 'body', 0, 0.35, -0.42);
  r.joint('eyeL', 'body', 0.52, 0.3, 0.5);
  r.joint('eyeR', 'body', -0.52, 0.3, 0.5);
  ARMS.forEach((a, i) => {
    r.joint(`a${i}_0`, 'body', Math.sin(a) * 0.6, -0.42, Math.cos(a) * 0.6);
    for (let k = 1; k < LENS.length; k++) r.joint(`a${i}_${k}`, `a${i}_${k - 1}`, 0, 0, LENS[k - 1]);
  });
  r.part('body', (g) => {
    g.blob(0, 0, 0.1, 0.95, 0.72, 0.85, SKIN, 501, { detail: 1, jitter: 0.08 });
    // The web between its arms, darker; the brows over its eyes.
    g.blob(0, -0.42, 0, 1.05, 0.24, 1.05, SKIN_D, 503, { jitter: 0.1 });
    for (const s of [-1, 1]) g.blob(s * 0.5, 0.52, 0.42, 0.34, 0.14, 0.26, SKIN_D, 505 + s, { jitter: 0.15 });
    for (let k = 0; k < 9; k++) {
      const a = k * 2.4, h = 0.1 + (k % 3) * 0.18;
      g.blob(Math.sin(a) * 0.75, h, Math.cos(a) * 0.6, 0.12, 0.06, 0.12, SPOT, 510 + k);
    }
    // Its siphon, on its right side.
    g.push().translate(-0.82, -0.05, -0.1).rotateZ(1.1);
    g.cyl(0, 0, 0, 0.17, 0.12, 0.42, 8, SKIN_D);
    g.pop();
  });
  r.part('mantle', (g) => {
    g.blob(0, 0.55, -0.3, 0.95, 1.15, 1.2, SKIN, 521, { detail: 1, jitter: 0.12 });
    g.blob(0, 0.2, -0.05, 0.8, 0.55, 0.9, SKIN, 523, { jitter: 0.1 });
    for (let k = 0; k < 12; k++) {
      const a = k * 2.1, h = 0.2 + (k % 4) * 0.32;
      g.blob(Math.sin(a) * 0.82 * (1.05 - h * 0.35), h + 0.15, -0.3 + Math.cos(a) * 1.0 * (1.05 - h * 0.35), 0.14, 0.09, 0.14, k % 3 ? SPOT : SKIN_D, 530 + k);
    }
  });
  // The eye that glows: amber, a black bar of a pupil; the other shut under an old scar.
  r.part('eyeL', (g, gl) => {
    g.blob(0, 0, 0, 0.27, 0.27, 0.24, '#e8d8a0', 541, { detail: 1, jitter: 0 });
    gl.blob(0.03, 0, 0.12, 0.22, 0.22, 0.15, [4, 2.5, 0.5], 543, { detail: 1, jitter: 0 });
    g.box(0.03, -0.035, 0.24, 0.24, 0.07, 0.04, '#120810');
  });
  r.part('eyeR', (g) => {
    g.blob(0, 0, 0, 0.26, 0.2, 0.22, SKIN_D, 551, { jitter: 0.2 });
    g.beam([-0.2, 0.22, 0.14], [0.16, -0.24, 0.2], 0.035, BELLY);
    g.beam([0.18, 0.2, 0.12], [0.02, 0.0, 0.22], 0.025, BELLY);
  });
  ARMS.forEach((_, i) => {
    for (let k = 0; k < LENS.length; k++)
      r.part(`a${i}_${k}`, (g) => {
        const L = LENS[k], r0 = RADS[k], r1 = RADS[k + 1];
        g.sweep([[0, 0, -0.04], [0, 0, L + 0.03]], [r0, r1], k % 2 ? SKIN : SKIN_M, { seg: 7, lumpy: 0.06, cap: k === LENS.length - 1 });
        // Pale suckers under it, two by two.
        for (let s = 0; s < 2; s++) {
          const zz = L * (0.28 + s * 0.45), rr = mix(r0, r1, zz / L);
          for (const sx of [-1, 1]) {
            g.cyl(sx * rr * 0.42, -rr * 0.98, zz, rr * 0.34, rr * 0.3, 0.05, 6, SUCKER);
            g.cyl(sx * rr * 0.42, -rr * 1.0, zz, rr * 0.16, rr * 0.16, 0.02, 5, SUCKER_D);
          }
        }
        if (k < 3) g.blob(0, r0 * 0.75, L * 0.5, r0 * 0.35, r0 * 0.15, r0 * 0.4, SPOT, 560 + i * 5 + k);
      });
  });
  const m = new Model(r, (rig, a) => inkPose(rig, a, look), 2);
  r.scale = 1.25;
  return m;
}

function inkPose(r: Rig, a: Anim, look: InkLook) {
  const t = a.time, dead = a.name === 'dead';
  const breathe = Math.sin(t * 1.3);
  const body = r.j('body'), mantle = r.j('mantle');
  body.position.y += breathe * 0.04 - look.down * 0.22 - (dead ? Math.min(1, a.t * 1.5) * 0.4 : 0);
  body.rotation.x = 0.06 + look.down * 0.28 - look.guard * 0.08 + Math.sin(t * 13) * 0.05 * look.thrash;
  body.rotation.z = Math.sin(t * 9) * 0.06 * look.thrash;
  const sw = (1 + breathe * 0.04) * (1 + look.swell * 0.38);
  mantle.scale.set(sw, sw * (1 + look.swell * 0.1), sw);
  mantle.rotation.x = -0.15 + look.down * 0.35 + look.curl * 0.25;
  const eye = dead ? 0.05 : look.eye;
  r.j('eyeL').scale.set(1, 0.1 + 0.9 * eye, 1);
  ARMS.forEach((a0, i) => {
    const front = Math.cos(a0), ph = i * 1.37;
    // Relaxed: planted on the floor, tips curling up, writhing.
    const rel = [0.2, 0.05, -0.12, -0.28, -0.42];
    // Guarding: the front arms raised in a cage before its face, curling in over it; the rest planted.
    const grd = front > 0.2 ? [-1.15, 0.32, 0.42, 0.5, 0.55] : [0.12, 0.05, -0.1, -0.2, -0.3];
    // Down: sprawled flat on the floor, limp. Asleep: coiled under it.
    const dwn = [0.42, -0.3, -0.12, 0, 0.02];
    const cur = [0.32, 0.55, 0.65, 0.72, 0.72];
    const wr = 0.16 * (1 - look.down * 0.8) * (1 - look.curl * 0.7) + look.thrash * 0.35;
    const spread = mix(1, front > 0.2 ? 0.55 : 1, look.guard);
    for (let k = 0; k < LENS.length; k++) {
      const j = r.j(`a${i}_${k}`);
      let x = mix(rel[k], grd[k], look.guard);
      x = mix(x, dwn[k], look.down);
      x = mix(x, cur[k], look.curl);
      x += Math.sin(t * (1.6 + look.thrash * 6) + ph + k * 0.8) * wr;
      j.rotation.x = x;
      if (k === 0) j.rotation.y = a0 * spread + Math.sin(t * 0.7 + ph) * 0.12 * (1 - look.down);
      else j.rotation.y = Math.sin(t * 1.1 + ph + k) * wr * 0.6;
    }
  });
}

// ---------- the arms that come up out of the floor ----------

/** One of its great arms, coming up through the floor where it strikes: rising and rearing over its line,
 *  crashing down along it, lying there, sinking back; or bursting up round the knight and holding him. */
class Arm {
  rig: Rig;
  mode: 'off' | 'rise' | 'slam' | 'lie' | 'sink' | 'grab' = 'off';
  t = 0;
  x = 0;
  z = 0;
  yaw = 0;
  /** How long it lies once down. */
  lie = 0;
  /** Its pose when a slam (or a fall) began, to fall from. */
  private from = { p: -Math.PI / 2, b: 0.2, y: 0 };
  /** The struggle: a shudder each time the knight fights it. */
  shake = 0;
  constructor(g: Game) {
    const r = (this.rig = new Rig({ shadow: 1 }));
    for (let k = 0; k < NSEG; k++) r.joint(`s${k}`, k ? `s${k - 1}` : 'root', 0, 0, k ? SEG : 0);
    for (let k = 0; k < NSEG; k++)
      r.part(`s${k}`, (g2) => {
        const r0 = ARM_R * (1 - k / NSEG) + 0.05, r1 = ARM_R * (1 - (k + 1) / NSEG) + 0.05;
        g2.sweep([[0, 0, -0.06], [0, 0, SEG + 0.04]], [r0, r1], k % 2 ? SKIN : SKIN_M, { seg: 8, lumpy: 0.06, cap: k === NSEG - 1 });
        g2.blob(0, 0, 0, r0 * 1.02, r0, r0 * 1.02, SKIN, 600 + k, { jitter: 0.04 });
        for (let s = 0; s < 3; s++) {
          const zz = SEG * (0.15 + s * 0.33), rr = mix(r0, r1, zz / SEG);
          for (const sx of [-1, 1]) {
            g2.cyl(sx * rr * 0.42, -rr * 0.98, zz, rr * 0.32, rr * 0.28, 0.06, 6, SUCKER);
            g2.cyl(sx * rr * 0.42, -rr * 1.01, zz, rr * 0.15, rr * 0.15, 0.03, 5, SUCKER_D);
          }
        }
        if (k % 2 === 0) g2.blob(0, r0 * 0.8, SEG * 0.5, r0 * 0.3, r0 * 0.12, r0 * 0.36, SPOT, 620 + k);
      });
    r.build();
    r.addTo(g.scene);
    // (Its rest pose lies flat; risen, it's far outside the bounds that pose gives it.)
    r.root.traverse((o) => (o.frustumCulled = false));
    r.shadow.visible = false;
    r.root.visible = false;
    r.root.rotation.order = 'YXZ';
  }
  /** Comes up out of the floor at (x, z), to strike toward `yaw`. */
  start(mode: 'rise' | 'grab', x: number, z: number, yaw: number) {
    this.mode = mode;
    this.t = 0;
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.shake = 0;
  }
  /** Falls flat from wherever it is, along its line, and lies there. */
  fall(lie: number) {
    const s0 = this.rig.j('s0'), s3 = this.rig.j('s3');
    this.from = { p: s0.rotation.x, b: s3.rotation.x, y: this.rig.root.position.y };
    this.mode = 'slam';
    this.t = 0;
    this.lie = lie;
  }
  sink() {
    if (this.mode === 'off') return;
    this.from.y = this.rig.root.position.y;
    this.mode = 'sink';
    this.t = 0;
  }
  hide() {
    this.mode = 'off';
    this.rig.root.visible = false;
  }
  get busy() {
    return this.mode !== 'off' && this.mode !== 'sink';
  }
  update(dt: number, time: number, g: Game) {
    if (this.mode === 'off') return;
    this.t += dt;
    this.shake = Math.max(0, this.shake - dt * 4);
    const r = this.rig, floor = GROTTO.floor, W = F.windup;
    r.reset();
    r.root.visible = true;
    r.root.rotation.set(0, this.yaw, 0);
    let y = floor + 0.28, p0 = 0, bend = 0, sway = 0;
    if (this.mode === 'rise') {
      // Up out of the floor, rearing over its line, swaying; at the last it draws back to strike.
      const up = ease(clamp(this.t / 0.35, 0, 1)), back = ease(clamp((this.t - (W - 0.35)) / 0.35, 0, 1));
      y = floor - 3.4 * (1 - up);
      p0 = -Math.PI / 2 - 0.3 * back + Math.sin(time * 2.2) * 0.06;
      bend = 0.2 + 0.08 * back;
      sway = 0.12;
      r.flash = back > 0 ? 0.35 + 0.35 * Math.sin(time * 40) : 0;
    } else if (this.mode === 'slam') {
      // Crashing down along the line (or falling limp, torn from the knight).
      const k = clamp(this.t / 0.16, 0, 1) ** 2;
      y = mix(this.from.y, floor + 0.28, k);
      p0 = mix(this.from.p, 0.03, k);
      bend = mix(this.from.b, 0, k);
      r.flash = 0;
      if (this.t >= 0.16) {
        this.mode = 'lie';
        this.t = 0;
      }
    } else if (this.mode === 'lie') {
      p0 = 0.03;
      bend = Math.sin(time * 7) * 0.02 * Math.max(0, 1 - this.t * 0.5);
      sway = 0.03;
      if (this.t > this.lie) this.sink();
    } else if (this.mode === 'sink') {
      // Dragged back down into the floor's cracks.
      p0 = 0.03;
      y = this.from.y - 2.2 * ease(clamp(this.t / 0.7, 0, 1));
      if (this.t > 0.7) return this.hide();
    } else if (this.mode === 'grab') {
      // Burst up behind the knight and curled over and round him; it shudders as he fights it.
      const up = ease(clamp(this.t / 0.18, 0, 1));
      y = floor - 2.6 * (1 - up);
      p0 = -Math.PI / 2 + 0.1;
      const sh = Math.sin(time * 45) * 0.12 * this.shake;
      for (let k = 1; k < NSEG; k++) {
        const j = r.j(`s${k}`);
        if (k <= 3) j.rotation.x = [0, 0.42, 0.62, 0.72][k] + sh;
        else {
          j.rotation.x = 0.18;
          j.rotation.y = 0.95 + sh;
        }
      }
      r.root.position.set(this.x, y, this.z);
      r.j('s0').rotation.x = p0 + Math.sin(time * 3) * 0.04;
      return;
    }
    r.root.position.set(this.x, y, this.z);
    r.j('s0').rotation.x = p0;
    for (let k = 1; k < NSEG; k++) {
      const j = r.j(`s${k}`);
      j.rotation.x = bend * (this.mode === 'rise' ? 1 + k * 0.08 : 1);
      j.rotation.y = Math.sin(time * 2.4 + k * 0.7) * sway;
    }
    void g;
  }
  dispose(g: Game) {
    this.rig.dispose(g.scene);
  }
}

// ---------- telegraphs ----------

const markMat = (o: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.7, 0.25), transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide });

/** A strip on the floor where an arm will crash down, filling from its root to its tip as the moment nears. */
class FillLine {
  group = new THREE.Group();
  private area: THREE.Mesh;
  private fill: THREE.Mesh;
  private edges: THREE.Mesh[] = [];
  private areaMat = markMat(0.18);
  private fillMat = markMat(0.3);
  private edgeMat = markMat(0.6);
  constructor(g: Game) {
    const strip = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
    this.area = new THREE.Mesh(strip, this.areaMat);
    this.fill = new THREE.Mesh(strip, this.fillMat);
    this.group.add(this.area, this.fill);
    for (let k = 0; k < 2; k++) {
      const e = new THREE.Mesh(strip, this.edgeMat);
      this.edges.push(e);
      this.group.add(e);
    }
    this.group.traverse((o) => (o.renderOrder = 5));
    this.group.visible = false;
    g.scene.add(this.group);
  }
  show(x: number, z: number, yaw: number, len: number, w: number, k: number, time: number) {
    const gr = this.group;
    gr.visible = true;
    gr.position.set(x, GROTTO.floor + 0.07, z);
    gr.rotation.set(0, yaw, 0);
    this.area.scale.set(w, 1, len);
    this.fill.scale.set(w * 0.9, 1, Math.max(0.01, len * clamp(k, 0, 1)));
    this.edges.forEach((e, i) => {
      e.scale.set(0.09, 1, len);
      e.position.x = (i ? 1 : -1) * (w / 2);
    });
    this.edgeMat.opacity = 0.5 + 0.35 * Math.sin(time * 18);
  }
  hide() {
    this.group.visible = false;
  }
  dispose(g: Game) {
    g.scene.remove(this.group);
    for (const m of [this.areaMat, this.fillMat, this.edgeMat]) m.dispose();
  }
}

/** A ring on the floor round the knight, a disc filling it: an arm is coming up through it. */
class FillRing {
  group = new THREE.Group();
  private ringMat = markMat(0.5);
  private fillMat = markMat(0.22);
  private fill: THREE.Mesh;
  constructor(g: Game) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(F.ring - 0.12, F.ring + 0.04, 36).rotateX(-Math.PI / 2), this.ringMat);
    this.fill = new THREE.Mesh(new THREE.CircleGeometry(F.ring - 0.12, 30).rotateX(-Math.PI / 2), this.fillMat);
    this.group.add(ring, this.fill);
    this.group.traverse((o) => (o.renderOrder = 5));
    this.group.visible = false;
    g.scene.add(this.group);
  }
  show(x: number, z: number, k: number, time: number) {
    this.group.visible = true;
    this.group.position.set(x, GROTTO.floor + 0.07, z);
    this.fill.scale.setScalar(Math.max(0.01, clamp(k, 0, 1)));
    this.ringMat.opacity = 0.45 + 0.35 * Math.sin(time * 18);
  }
  hide() {
    this.group.visible = false;
  }
  dispose(g: Game) {
    g.scene.remove(this.group);
    this.ringMat.dispose();
    this.fillMat.dispose();
  }
}

// ---------- the fight ----------

type Phase = 'sleep' | 'wake' | 'guard' | 'slam' | 'grab' | 'held' | 'swell' | 'down' | 'recover';

/**
 * Old Inkarm's ways (the Enemy runs it: see `ink` there). It keeps its own phase; the Enemy's state follows it
 * (for its pose, its tint while it's open, the world's reset).
 */
export class Inkarm {
  look: InkLook = { guard: 0, down: 0, curl: 1, swell: 0, eye: 0.15, thrash: 0 };
  model: Model;
  phase: Phase = 'sleep';
  private t = 0;
  private arms: Arm[] = [];
  private line: FillLine | null = null;
  private ring: FillRing | null = null;
  /** The slam coming: its arm, where it rises, which way, how long. */
  private strike: { arm: Arm; x: number; z: number; yaw: number; ux: number; uz: number; len: number } | null = null;
  /** More slams to come in this volley (two in turn, below half its strength). */
  private volley = 0;
  /** The grab: where its ring lies; the knight's struggle. */
  private grabAt = { x: 0, z: 0 };
  private grabArm: Arm | null = null;
  private mashes = 0;
  /** Attacks so far, and when it last grabbed and inked (it mixes them). */
  private count = 0;
  private lastGrab = 0;
  private lastInk = 0;
  private gap = 1;
  private enraged = false;
  /** Time the knight has been out of the grotto (it settles back to sleep). */
  private outT = 0;
  /** Seconds of ink left in the water. */
  private inkT = 0;
  private eyeLight: LightSource | null = null;
  private popT = -9;
  private fresh = true;

  static of(type: EnemyType, e: Enemy) {
    return type === 'inkarm' ? new Inkarm(e) : undefined;
  }

  constructor(private e: Enemy) {
    this.model = makeInkarm(this.look);
    e.aquatic = true;
  }

  /** Its body can be struck: an arm of its lies down on the floor (or it's slumped, spent). */
  get open() {
    return this.phase === 'down' || (this.phase !== 'held' && this.phase !== 'grab' && this.arms.some((a) => a.mode === 'lie'));
  }

  private knightIn(g: Game) {
    const p = g.player, G = GROTTO;
    return p.alive && !g.flying && p.x > G.x0 - 0.3 && p.x < G.x1 + 0.3 && p.z > G.z0 - 1.8 && p.z < G.z1 + 0.2 && p.y < G.floor + 3.2 && p.y > G.floor - 1.5;
  }

  private set(p: Phase, state: Parameters<Enemy['set']>[0]) {
    this.phase = p;
    this.t = 0;
    this.e.set(state);
  }

  private freeArm(g: Game) {
    while (this.arms.length < 2) this.arms.push(new Arm(g));
    return this.arms.find((a) => a.mode === 'off') ?? this.arms.find((a) => a.mode === 'sink') ?? this.arms[0];
  }

  update(dt: number, g: Game, d: number) {
    const e = this.e, p = g.player, L = this.look;
    void d;
    if (this.fresh) {
      // (Never golden: its worth is in its den.)
      this.fresh = false;
      e.golden = false;
      e.hp = e.maxHp = F.hp * (g.realm.foeHp ?? 1);
      this.eyeLight = g.lights.add(e.x, e.y + 2, e.z + 1, 0xffb040, 0, 7, 0.1);
    }
    // The world reset (the knight fell): back to its den, asleep.
    if (e.state === 'idle' && this.phase !== 'sleep') this.cancel(g);
    e.telegraph = 0;
    this.t += dt;
    this.inkT = Math.max(0, this.inkT - dt);
    const inside = this.knightIn(g);
    if (this.phase !== 'sleep' && this.phase !== 'held') {
      this.outT = inside ? 0 : this.outT + dt;
      if (!inside) this.calm(g);
      if (this.outT > 6) {
        this.set('sleep', 'idle');
        this.outT = 0;
      }
    }
    if (this.phase !== 'down' && this.phase !== 'sleep') e.faceTo(p.x, p.z);

    switch (this.phase) {
      case 'sleep':
        if (inside) {
          this.set('wake', 'alert');
          g.audio.sfx('roar', e.x, e.z);
          g.audio.sfx('squelch', e.x, e.z);
          g.shake(0.5);
          g.fx.burst(P.seaBubble, e.x, e.y + 1.5, e.z, 30, 3, 2);
          g.fx.burst(SILT, e.x, e.y + 0.3, e.z, 24, 4, 0.5);
        }
        break;
      case 'wake':
        if (this.t > 1.4) this.toGuard(0.5);
        break;
      case 'guard':
        if (this.t > this.gap && inside) this.next(g);
        break;
      case 'slam':
        this.slamTick(g);
        break;
      case 'grab':
        this.grabTick(g);
        break;
      case 'held':
        this.heldTick(g);
        break;
      case 'swell':
        e.telegraph = this.t > F.swell - 0.35 ? 1 : 0;
        if (Math.random() < dt * 14) g.fx.emit(P.seaBubble, e.x + (Math.random() - 0.5) * 2, e.y + 2.4, e.z + (Math.random() - 0.5) * 2, 0, 1.4, 0);
        if (this.t >= F.swell) this.squirt(g);
        break;
      case 'down':
        if (this.t > this.downT && !this.arms.some((a) => a.mode === 'lie' || a.mode === 'slam')) this.set('recover', 'recover');
        break;
      case 'recover':
        if (this.t > 0.6) this.toGuard(this.enraged ? F.gapEnraged : F.gap);
        break;
    }
    // An arm lying down opens its body (the Enemy's 'stun': it shows pale, and blows land).
    if (this.open && e.state !== 'stun' && this.phase !== 'down') e.set('stun');
    if (!this.open && e.state === 'stun' && this.phase !== 'down') e.set(this.phase === 'slam' ? 'windup' : 'chase');

    for (const a of this.arms) a.update(dt, g.time, g);
    this.inkScreen(g);

    // Its look, eased toward what it's doing.
    const k = Math.min(1, dt * 5);
    const open = this.open, asleep = this.phase === 'sleep';
    L.curl += ((asleep ? 1 : 0) - L.curl) * Math.min(1, dt * (asleep ? 1.2 : 4));
    L.down += ((open ? 1 : 0) - L.down) * k;
    L.guard += ((!asleep && !open && this.phase !== 'wake' ? 1 : 0) - L.guard) * k;
    L.swell += ((this.phase === 'swell' ? ease(clamp(this.t / F.swell, 0, 1)) : 0) - L.swell) * Math.min(1, dt * 9);
    L.eye += ((asleep ? 0.15 : open ? 0.35 : 1) - L.eye) * k;
    L.thrash = Math.max(0, L.thrash - dt * 2);
    if (this.eyeLight) {
      const s = this.e.model.rig.scale, c = Math.cos(e.model.rig.yaw), sn = Math.sin(e.model.rig.yaw);
      this.eyeLight.x = e.x + (sn * 0.9 + c * 0.6) * s;
      this.eyeLight.z = e.z + (c * 0.9 - sn * 0.6) * s;
      this.eyeLight.y = e.y + 1.4 * s;
      this.eyeLight.intensity = 3.2 * L.eye * L.eye;
    }
  }

  /** How long its arms stay down (shorter below half its strength). */
  private get downT() {
    return this.enraged ? F.downEnraged : F.down;
  }

  private toGuard(gap: number) {
    this.gap = gap;
    this.set('guard', 'chase');
  }

  /** The knight left the grotto: whatever was coming is called off. */
  private calm(g: Game) {
    if (this.phase === 'slam' || this.phase === 'grab' || this.phase === 'swell') {
      this.line?.hide();
      this.ring?.hide();
      this.strike?.arm.sink();
      this.strike = null;
      this.volley = 0;
      this.toGuard(1);
    }
    void g;
  }

  /** Its next attack: mostly slams; a grab now and then (never close to its body); ink, now and then more. */
  private next(g: Game) {
    const p = g.player;
    this.count++;
    const far = Math.hypot(p.x - DEN.x, p.z - DEN.z) > 2.6;
    if (this.count - this.lastGrab >= 3 && far && Math.random() < 0.5) return this.startGrab(g);
    if (this.count - this.lastInk >= (this.enraged ? 3 : 5) && Math.random() < 0.55) return this.startSwell(g);
    this.volley = this.enraged && Math.random() < 0.6 ? 1 : 0;
    this.startSlam(g);
  }

  // ---------- slam ----------

  private startSlam(g: Game) {
    const p = g.player;
    let tx = p.x - DEN.x, tz = p.z - DEN.z;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    let bx = 0, bz = 0, ux = 0, uz = 0, ok = false;
    // Below half its strength, some come from the side, across the knight's place.
    if (this.enraged && Math.random() < 0.45) {
      for (const side of Math.random() < 0.5 ? [1, -1] : [-1, 1]) {
        bx = p.x - tz * side * 3.6;
        bz = p.z + tx * side * 3.6;
        if (inLairXZ(bx, bz, 0.6) && Math.hypot(bx - DEN.x, bz - DEN.z) > 2) {
          ux = tz * side;
          uz = -tx * side;
          ok = true;
          break;
        }
      }
    }
    if (!ok) {
      // Up through the floor before its den, out through the knight's place (a little to one side or other).
      const a = Math.atan2(tx, tz) + (Math.random() - 0.5) * 0.7;
      bx = DEN.x + Math.sin(a) * 2.3;
      bz = DEN.z + Math.cos(a) * 2.3;
      let dx = p.x - bx, dz = p.z - bz;
      const dl = Math.hypot(dx, dz);
      if (dl < 1.2) [dx, dz] = [Math.sin(a), Math.cos(a)];
      const l = Math.hypot(dx, dz);
      ux = dx / l;
      uz = dz / l;
    }
    // As long as the grotto lets it be (a little out over the mouth).
    let len = 1.5;
    while (len < NSEG * SEG - 0.2) {
      const x = bx + ux * (len + 0.3), z = bz + uz * (len + 0.3);
      if (!(x > GROTTO.x0 + 0.2 && x < GROTTO.x1 - 0.2 && z > GROTTO.z0 + 0.2 && z < GROTTO.z1 + 1.6)) break;
      len += 0.25;
    }
    const arm = this.freeArm(g);
    const yaw = Math.atan2(ux, uz);
    arm.start('rise', bx, bz, yaw);
    this.strike = { arm, x: bx, z: bz, yaw, ux, uz, len };
    this.line ??= new FillLine(g);
    this.set('slam', 'windup');
    g.audio.sfx('squelch', bx, bz);
    g.fx.burst(SILT, bx, GROTTO.floor + 0.2, bz, 20, 3.5, 1);
  }

  private slamTick(g: Game) {
    const s = this.strike, p = g.player, e = this.e;
    if (!s) return this.toGuard(0.6);
    const W = F.windup;
    if (!this.open) e.telegraph = this.t > W - 0.35 ? 1 : 0;
    this.line!.show(s.x, s.z, s.yaw, s.len, F.slamW, this.t / W, g.time);
    if (this.t < W) {
      if (Math.random() < 0.3) g.fx.emit(SILT, s.x + (Math.random() - 0.5), GROTTO.floor + 0.2, s.z + (Math.random() - 0.5), 0, 0.6, 0);
      return;
    }
    // Down it comes.
    this.line!.hide();
    s.arm.fall(this.downT + (this.volley ? W + 0.2 : 0));
    this.strike = null;
    g.audio.sfx('slam', s.x + s.ux * s.len * 0.5, s.z + s.uz * s.len * 0.5);
    g.audio.sfx('thud', s.x, s.z);
    g.shake(0.55);
    for (let k = 0; k <= 8; k++) g.fx.burst(SILT, s.x + s.ux * s.len * (k / 8), GROTTO.floor + 0.2, s.z + s.uz * s.len * (k / 8), 4, 3, 0.8);
    // Anyone on its line (not jumping clear of it) is struck, and thrown off it to the side he stood.
    const along = (p.x - s.x) * s.ux + (p.z - s.z) * s.uz, across = (p.x - s.x) * s.uz - (p.z - s.z) * s.ux;
    if (along > -0.4 && along < s.len + 0.3 && Math.abs(across) < F.slamW / 2 + 0.12 && p.y < GROTTO.floor + 1.3) {
      const ax = s.x + s.ux * along, az = s.z + s.uz * along;
      const res = p.hurt(1, ax - s.uz * Math.sign(across || 1) * 0.1, az + s.ux * Math.sign(across || 1) * 0.1, g, { unblockable: true, kb: 7 });
      g.afterHit(res, ax, az, e);
    }
    if (this.volley > 0) {
      // The next of the volley, aimed at where the knight is now.
      this.volley--;
      this.startSlam(g);
      return;
    }
    this.set('down', 'stun');
  }

  // ---------- grab ----------

  private startGrab(g: Game) {
    const p = g.player;
    this.lastGrab = this.count;
    this.grabAt = { x: p.x, z: p.z };
    this.ring ??= new FillRing(g);
    this.set('grab', 'aim');
    g.audio.sfx('creak', p.x, p.z);
  }

  private grabTick(g: Game) {
    const p = g.player, e = this.e, W = F.windup, a = this.grabAt;
    e.telegraph = this.t > W - 0.35 ? 1 : 0;
    this.ring!.show(a.x, a.z, this.t / W, g.time);
    if (Math.random() < 0.35) g.fx.emit(SILT, a.x + (Math.random() - 0.5) * 1.6, GROTTO.floor + 0.15, a.z + (Math.random() - 0.5) * 1.6, 0, 0.8, 0);
    if (this.t < W) return;
    this.ring!.hide();
    // Up it bursts, from the den's side of the ring.
    let dx = a.x - DEN.x, dz = a.z - DEN.z;
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    const arm = (this.grabArm = this.freeArm(g));
    g.audio.sfx('squelch', a.x, a.z);
    g.fx.burst(SILT, a.x, GROTTO.floor + 0.2, a.z, 26, 4, 1.2);
    const caught = Math.hypot(p.x - a.x, p.z - a.z) < F.ring + 0.1 && p.y < GROTTO.floor + 1.4 && p.alive && !p.riding && p.iframes <= 0 && !g.godMode;
    if (!caught) {
      // Missed: it rears up empty over the ring a moment and goes back down.
      arm.start('rise', a.x - dx * 0.7, a.z - dz * 0.7, Math.atan2(dx, dz));
      arm.t = 0.4;
      g.after(0.5, () => arm.sink());
      return this.toGuard(this.enraged ? F.gapEnraged : F.gap);
    }
    arm.start('grab', p.x - dx * 0.75, p.z - dz * 0.75, Math.atan2(dx, dz));
    this.grabAt = { x: p.x, z: p.z };
    this.mashes = 0;
    this.set('held', 'reel');
    g.pop(p, 'seized!', '#e8a8c8');
    g.audio.sfx('reel', p.x, p.z);
    g.shake(0.4);
    if (g.settings.hints && g.firstTime('inkarm-grab')) {
      const how = g.input.usingTouch ? 'tap the sword' : `press <kbd>${g.input.label('attack')}</kbd>`;
      g.ui.hint(`Seized! Fight it: ${how} again and again to tear free.`, 6);
    }
  }

  private heldTick(g: Game) {
    const p = g.player, e = this.e, a = this.grabAt, arm = this.grabArm!;
    // Held fast where it caught him: he can't walk, jump or roll, only fight it.
    p.effects.snare = Math.max(p.effects.snare, 0.15);
    p.x = a.x;
    p.z = a.z;
    p.vx = p.vz = 0;
    if (g.input.hit('attack')) {
      this.mashes++;
      arm.shake = 1;
      g.audio.sfx('squelch', p.x, p.z);
      g.fx.burst(INK_SPLASH, p.x, p.y + 1, p.z, 6, 2, 1);
      g.pop(p, this.mashes >= F.mash ? 'free!' : 'struggle!', '#e8d8a0');
    }
    if (!p.alive) {
      arm.sink();
      this.grabArm = null;
      return this.toGuard(F.gap);
    }
    if (this.mashes >= F.mash) {
      // Torn free: the arm drops limp, and its body is open.
      p.effects.snare = 0;
      arm.fall(this.downT);
      this.grabArm = null;
      g.shake(0.3);
      this.look.thrash = 0.6;
      this.set('down', 'stun');
      return;
    }
    if (this.t >= F.hold) {
      // It squeezes, and throws him.
      p.effects.snare = 0;
      const res = p.hurt(1, e.x, e.z, g, { unblockable: true, kb: 9, force: true });
      g.afterHit(res, p.x, p.z, e);
      arm.sink();
      this.grabArm = null;
      this.set('recover', 'recover');
    }
  }

  // ---------- ink ----------

  private startSwell(g: Game) {
    this.lastInk = this.count;
    this.set('swell', 'swell');
    g.audio.sfx('gulp', this.e.x, this.e.z);
  }

  private squirt(g: Game) {
    const e = this.e;
    this.inkT = F.ink;
    g.audio.sfx('puff', e.x, e.z);
    g.audio.sfx('steam', e.x, e.z);
    // A great cloud from its siphon, spreading through the grotto.
    for (let k = 0; k < 90; k++) {
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 6;
      g.fx.emit(INK, e.x + Math.cos(a) * 0.8, e.y + 0.8 + Math.random() * 1.2, e.z + Math.sin(a) * 0.8, Math.cos(a) * sp, Math.random() * 1.5, Math.sin(a) * sp);
    }
    for (let k = 0; k < 40; k++) g.fx.emit(INK, GROTTO.x0 + Math.random() * (GROTTO.x1 - GROTTO.x0), GROTTO.floor + 0.5 + Math.random() * 2.5, GROTTO.z0 + Math.random() * (GROTTO.z1 - GROTTO.z0), 0, 0.2, 0, 1.4);
    this.look.thrash = 0.5;
    this.toGuard(0.9);
  }

  /** The ink darkens the screen while it hangs in the water (and the knight is in it). */
  private inkScreen(g: Game) {
    if (this.inkT <= 0 || !this.knightIn(g)) return;
    const left = this.inkT, k = left > F.ink - 0.3 ? (F.ink - left) / 0.3 : left < 1.4 ? left / 1.4 : 1;
    g.pipe.narrow = Math.max(g.pipe.narrow, 0.95 * k);
    g.pipe.flash = Math.max(g.pipe.flash, 0.55 * k);
    g.pipe.flashColor.setRGB(0.03, 0.0, 0.06);
  }

  // ---------- struck, felled, reset ----------

  /** The knight's blow: its arms take it unless they're down. */
  hit(dmg: number, dx: number, dz: number, finisher: boolean, g: Game): 'hit' | 'blocked' {
    const e = this.e;
    if (!this.open) {
      this.look.thrash = Math.max(this.look.thrash, 0.25);
      if (this.phase === 'sleep') this.outT = 0;
      if (g.time - this.popT > 2) {
        this.popT = g.time;
        g.pop(e, 'its arms shield it', '#c8b0d8');
      }
      if (g.settings.hints && g.firstTime('inkarm-guard'))
        g.ui.hint('Its arms shield its body. Step off the line an arm rises over, and when it has crashed down, strike the body: its arms are down.', 8);
      return 'blocked';
    }
    e.hp -= dmg * (finisher ? 1.15 : 1);
    e.flashT = 0.1;
    this.look.thrash = Math.max(this.look.thrash, 0.4);
    g.fx.burst(P.spark, e.x - dx * 0.8, e.y + 1, e.z - dz * 0.8, 6, 3.5, 2);
    g.fx.burst(INK_SPLASH, e.x - dx * 1.2, e.y + 1.1, e.z - dz * 1.2, 10, 2.5, 1.2);
    g.audio.sfx('hit', e.x, e.z);
    g.audio.sfx('squelch', e.x, e.z);
    if (e.hp <= 0) {
      e.die(g);
      return 'hit';
    }
    if (!this.enraged && e.hp < e.maxHp * 0.5) {
      // Below half: it thrashes, inks, and its arms come faster, two by two.
      this.enraged = true;
      this.look.thrash = 1.2;
      g.pop(e, 'Old Inkarm thrashes!', '#e8a8c8');
      g.audio.sfx('roar', e.x, e.z);
      g.shake(0.5);
      for (let k = 0; k < 30; k++) g.fx.emit(INK, e.x + (Math.random() - 0.5) * 2, e.y + 1 + Math.random(), e.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 4, Math.random(), (Math.random() - 0.5) * 4);
    }
    return 'hit';
  }

  /** Felled: it sags into a last great cloud of ink and sinks into its den. */
  died(g: Game) {
    const e = this.e;
    this.cancel(g);
    for (const a of this.arms) a.dispose(g);
    this.arms = [];
    this.line?.dispose(g);
    this.ring?.dispose(g);
    this.line = null;
    this.ring = null;
    if (this.eyeLight) g.lights.remove(this.eyeLight);
    this.eyeLight = null;
    this.look.thrash = 1.5;
    g.shake(0.8);
    g.audio.sfx('roar', e.x, e.z);
    g.audio.sfx('steam', e.x, e.z);
    for (let k = 0; k < 120; k++) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 5;
      g.fx.emit(INK, e.x + Math.cos(a) * 1.2, e.y + 0.5 + Math.random() * 2, e.z + Math.sin(a) * 1.2, Math.cos(a) * sp, 0.3 + Math.random() * 1.5, Math.sin(a) * sp);
    }
    g.fx.burst(P.seaBubble, e.x, e.y + 1.5, e.z, 40, 3, 2.5);
  }

  /** The world resets (or it's gone): arms back under the floor, marks gone, asleep in its den. */
  cancel(g: Game) {
    if (this.phase === 'held') g.player.effects.snare = 0;
    for (const a of this.arms) a.hide();
    this.line?.hide();
    this.ring?.hide();
    this.strike = null;
    this.grabArm = null;
    this.volley = 0;
    this.inkT = 0;
    this.enraged = false;
    this.phase = 'sleep';
    this.t = 0;
    this.outT = 0;
    void g;
  }
}

/** The Kraken's Ink (the power in Old Inkarm's chest): a blow that lands blinds the foe a moment, as a parry
 *  does (not a realm's tyrant). */
export function inkBlow(e: Enemy, g: Game) {
  if (!e.alive || e.isBoss || e.state === 'stun' || e.type === 'inkarm') return;
  e.parried(g);
  g.fx.burst(INK_SPLASH, e.x, e.y + 0.9, e.z, 12, 2.5, 1);
}
