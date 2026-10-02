import * as THREE from 'three';
import { PLAYER } from '../config';
import { Geo } from '../engine/geo';
import { glowMaterial, K, worldMaterial } from '../engine/materials';
import { P, type PSpec } from '../engine/particles';
import { Rig } from '../engine/rig';
import { clamp } from '../engine/util';
import type { Pt } from '../world/paint';
import type { Enemy } from './enemies';
import type { Game } from './game';
import { Model, type Anim } from './models';
import { Mount } from './mount';
import type { Player } from './player';

// ---------------------------------------------------------------------------
// The Tide Serpent: the Sunken Reef's great beast (the prototype's third mount: "Swims (tap jump in the
// air)"). The crew hold it in their nets in a pool off the sandbar, their lines staked out on the sand
// round it; cut free, it carries the knight across the sea, anywhere the water is deep, and once he wears
// the salvager's diving suit, down through it: at the surface a tap of jump leaps out of the water and,
// in the suit, plunges under; below, each tap is a stroke up and it sinks between strokes. A shadow and
// a ring on the sea floor under it show how high it swims. Its moves are the prototype's: Bubble shot
// (attack), Bubble shell (guard: the next hit bursts it, not him), Whirlpool (special: a vortex that
// drags foes in and wears them down).
// ---------------------------------------------------------------------------

/** How it swims (the prototype's: 1.15 times the knight's speed, a stroke for each tap of jump in the
 *  water, costing stamina). */
const SWIM = {
  /** Across the water and through it, times the knight's running speed (6 m/s); how quickly it gets going,
   *  and how it glides to a stop. */
  speed: 1.15,
  accel: 9,
  coast: 3.5,
  /** How fast it turns (radians a second). */
  turn: 5.5,
  /** Its belly this far under the surface when it floats there (the knight rides dry). */
  float: 0.45,
  /** Each tap of jump below the surface: this much speed upward (taps in quick succession add up to riseMax),
   *  for this much stamina. */
  stroke: 3.6,
  riseMax: 5,
  strokeCost: 8,
  /** Between strokes it settles into sinking at `sink` m/s; rising it slows by `settle` m/s², plunging by `drag`. */
  sink: 1.4,
  settle: 4.5,
  drag: 9,
  /** At the surface a tap of jump leaps out of the water (`leap` m/s up, falling at `gravity` out of it);
   *  coming up faster than `breach` it leaps clear by itself. */
  leap: 6.2,
  gravity: 16,
  breach: 4.2,
  /** The knight out of air on its back: it carries him up by itself. */
  carry: 1.8,
};

/** Its moves: damage times the knight's sword. */
const MOVES = {
  /** Bubble shot: one every `every` s, flying `speed` m/s (slower under the water) for `life` s. */
  shot: { dmg: 0.8, kb: 5, speed: 9, life: 1.1, every: 0.45 },
  /** Whirlpool: drifts forward for `life` s, drags in what's within r and hurts it every `tick` s. */
  whirl: { cost: 50, life: 2.6, r: 2.3, drift: 1.6, pull: 2.6, tick: 0.35, dmg: 0.35 },
  /** Bubble shell: up for `time` s, or until the next hit bursts it. */
  shell: { cost: 30, need: 25, time: 2 },
};

/** From its back the knight steps off onto ground up to this much higher than it (from the surface, a ledge a
 *  metre out of the water), within reach of its side; and from there gets back on (the reach of an E press). */
const STEP_OFF = 1.45;
const STEP_REACH = 2.4;
/** The highest ground above the sea's surface he gets on and off it from (src/game/reach.ts). */
export const SERPENT_LIP = STEP_OFF - SWIM.float;

const COL = {
  body: '#2a9d8f', dark: '#1d6f66', belly: '#bde8d8', fin: '#e86a8a', finDark: '#b04a6a',
  saddle: '#733e39', trim: '#feae34', eye: [3.2, 2.0, 0.45] as [number, number, number],
  stake: '#5a3e26', rope: '#a08a5a', cork: '#c8a060',
};

const SPRAY: PSpec = { color: [0.75, 0.95, 1.2], color2: [0.4, 0.6, 0.85], size: 1, size2: 2, life: 0.6, gravity: 9, drag: 1 };
const FROTH: PSpec = { color: [0.8, 1.3, 1.5], color2: [0.5, 0.9, 1.1], size: 2, size2: 1, life: 0.9, gravity: -0.4, drag: 2, alpha: 0.8 };
const GLINT: PSpec = { color: [1.4, 2.6, 3.0], color2: [0.6, 1.4, 1.8], size: 1, life: 0.45, gravity: -1, drag: 2 };

type V3 = [number, number, number];
/** A fin: a flat triangle, seen from both sides. */
function fin(g: Geo, a: V3, b: V3, c: V3, col: string) {
  g.tri(a, b, c, col);
  g.tri(a, c, b, col);
}

// ---------- the model ----------

/**
 * The Tide Serpent: a long sea serpent, teal above and pale beneath, pink fins down its back, a frilled head
 * held high on its neck and amber eyes; a red saddle with a gold trim girthed round it (the prototype's).
 * Its root lies at its belly; it swims with a wave running down it to the tail.
 */
export function makeSerpent(): Model {
  const r = new Rig({ shadow: 1.7 });
  r.joint('body', 'root', 0, 0.44, 0);
  r.joint('saddle', 'body', 0, 0.44, 0.02);
  r.joint('neck', 'body', 0, 0.04, 0.66);
  r.joint('head', 'neck', 0, 1.12, 0.54);
  r.joint('jaw', 'head', 0, -0.08, -0.02);
  r.joint('t1', 'body', 0, -0.02, -0.62);
  r.joint('t2', 't1', 0, -0.02, -0.76);
  r.joint('t3', 't2', 0, 0, -0.7);
  r.joint('t4', 't3', 0, 0, -0.6);
  r.part('body', (g) => {
    g.sweep([[0, 0, -0.72], [0, 0.02, 0], [0, 0.02, 0.76]], [0.44, 0.5, 0.44], COL.body, { seg: 8, lumpy: 0.04, squash: 0.85, cap: false });
    g.box(0, -0.46, 0.02, 0.56, 0.1, 1.3, COL.belly);
    // The saddle and its girth, gold at the pommel.
    g.box(0, 0.36, 0.02, 0.5, 0.1, 0.62, COL.saddle, { kind: K.Cloth });
    g.box(0, 0.4, -0.27, 0.46, 0.14, 0.08, COL.saddle, { kind: K.Cloth });
    g.box(0, 0.4, 0.3, 0.32, 0.12, 0.07, COL.trim, { kind: K.Metal });
    g.box(0, -0.38, 0.02, 0.96, 0.78, 0.1, COL.saddle, { kind: K.Cloth });
    for (const s of [-1, 1]) {
      g.box(s * 0.48, -0.02, 0.02, 0.03, 0.12, 0.12, COL.trim, { kind: K.Metal });
      // Fins at its shoulders.
      fin(g, [s * 0.4, -0.1, 0.48], [s * 1.0, -0.3, 0.14], [s * 0.42, -0.18, 0.04], COL.fin);
    }
    fin(g, [0, 0.34, -0.46], [0, 0.66, -0.68], [0, 0.32, -0.74], COL.fin);
  });
  r.part('neck', (g) => {
    g.sweep([[0, -0.04, -0.16], [0, 0.34, 0.12], [0, 0.78, 0.38], [0, 1.16, 0.54]], [0.42, 0.36, 0.3, 0.25], COL.body, { seg: 8, lumpy: 0.04 });
    // A pale throat, and a fin down the back of the neck.
    g.beam([0, 0.08, 0.2], [0, 0.96, 0.68], 0.13, COL.belly);
    fin(g, [0, 0.54, 0.08], [0, 1.0, -0.18], [0, 1.12, 0.32], COL.fin);
  });
  r.part('head', (g, gl) => {
    // A long head with a horse's snout, a crest and frills behind the jaw.
    g.box(0, -0.12, 0.12, 0.4, 0.32, 0.64, COL.body);
    g.box(0, -0.08, 0.5, 0.3, 0.24, 0.24, COL.body);
    g.box(0, 0.18, 0.02, 0.34, 0.06, 0.32, COL.dark);
    for (const s of [-1, 1]) {
      gl.box(s * 0.205, 0.05, 0.16, 0.02, 0.08, 0.1, COL.eye);
      g.box(s * 0.1, 0.1, 0.6, 0.03, 0.03, 0.03, '#0a1418');
      fin(g, [s * 0.18, 0.02, -0.12], [s * 0.48, 0.18, -0.36], [s * 0.2, -0.14, -0.16], COL.finDark);
    }
    fin(g, [0, 0.22, 0.2], [0, 0.48, -0.16], [0, 0.22, -0.18], COL.fin);
  });
  r.part('jaw', (g) => {
    g.box(0, -0.12, 0.24, 0.34, 0.1, 0.56, COL.belly);
    for (const s of [-1, 1]) g.box(s * 0.11, -0.03, 0.46, 0.03, 0.05, 0.03, '#f0f0e0');
  });
  const tail: [string, number, number, number][] = [['t1', 0.76, 0.44, 0.36], ['t2', 0.7, 0.36, 0.26], ['t3', 0.6, 0.26, 0.16]];
  for (const [j, len, r0, r1] of tail)
    r.part(j, (g) => {
      g.sweep([[0, 0, 0.1], [0, -0.01, -len - 0.02]], [r0, r1], COL.body, { seg: 8, lumpy: 0.04, squash: 0.85, cap: false });
      g.box(0, -r1 * 0.95, -len / 2, r1 * 1.1, 0.06, len, COL.belly);
      fin(g, [0, r0 * 0.75, -0.08], [0, r0 * 0.75 + 0.3, -len * 0.5], [0, r1 * 0.8, -len * 0.8], COL.fin);
    });
  r.part('t4', (g) => {
    g.sweep([[0, 0, 0.08], [0, 0, -0.38]], [0.16, 0.06], COL.body, { seg: 6 });
    // The tail fin, a pink fan.
    fin(g, [0, 0.02, -0.08], [0, 0.58, -0.72], [0, 0.04, -0.52], COL.fin);
    fin(g, [0, -0.02, -0.08], [0, -0.46, -0.68], [0, 0.0, -0.52], COL.finDark);
  });
  return new Model(r, serpentPose, 1.4);
}

function serpentPose(r: Rig, a: Anim) {
  const sp = clamp(a.speed, 0, 1.3), t = a.time;
  // A wave runs down it from the shoulders to the tail, wider toward the tail and the faster it swims.
  const w = a.phase * 0.8 + t * (1.4 + sp * 2.5), amp = 0.08 + sp * 0.22;
  r.j('body').rotation.y = Math.sin(w) * amp * 0.25;
  r.j('t1').rotation.y = Math.sin(w - 0.9) * amp * 0.7;
  r.j('t2').rotation.y = Math.sin(w - 1.8) * amp;
  r.j('t3').rotation.y = Math.sin(w - 2.7) * amp * 1.3;
  r.j('t4').rotation.y = Math.sin(w - 3.6) * amp * 1.6;
  r.j('neck').rotation.y = -Math.sin(w) * amp * 0.35;
  // Bobbing and breathing; head forward when it swims fast; nose up rising, down diving (Anim.v).
  r.j('body').position.y += Math.sin(t * 1.7) * 0.04;
  r.j('neck').rotation.x = Math.sin(t * 1.1) * 0.05 + sp * 0.12;
  r.j('head').rotation.x = -sp * 0.1;
  r.j('body').rotation.x = a.v ?? 0;
  const k = (d: number) => Math.sin(clamp(a.t / d, 0, 1) * Math.PI);
  switch (a.name) {
    case 'shot':
      // Head thrust forward, jaws open: a bubble spat out.
      r.j('neck').rotation.x += 0.45 * k(0.3);
      r.j('head').rotation.x -= 0.2 * k(0.3);
      r.j('jaw').rotation.x = 0.7 * k(0.3);
      break;
    case 'whirl':
      // It coils and spins the water: tail curled round, head up.
      for (const [j, c] of [['t1', 0.5], ['t2', 0.7], ['t3', 0.8], ['t4', 0.9]] as [string, number][]) r.j(j).rotation.y += c * k(0.6);
      r.j('neck').rotation.x -= 0.35 * k(0.6);
      r.j('jaw').rotation.x = 0.4 * k(0.6);
      break;
    case 'shell':
      r.j('neck').rotation.x -= 0.3 * k(0.4);
      r.j('jaw').rotation.x = 0.3 * k(0.4);
      break;
    case 'hurt':
      r.j('neck').rotation.x -= 0.5 * Math.max(0, 1 - a.t * 3);
      break;
    case 'net': {
      // Thrashing in the nets.
      const f = t * 7;
      for (const [j, c] of [['t1', 0.35], ['t2', 0.5], ['t3', 0.6], ['t4', 0.7]] as [string, number][]) r.j(j).rotation.y = Math.sin(f - c * 4) * c;
      r.j('neck').rotation.x = -0.25 + Math.sin(t * 4.3) * 0.3;
      r.j('neck').rotation.z = Math.sin(t * 2.9) * 0.35;
      r.j('jaw').rotation.x = Math.max(0, Math.sin(t * 3.1)) * 0.6;
      break;
    }
  }
}

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

const glowMat = (r: number, g: number, b: number, opacity: number) =>
  new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

/** The nearest spot of open sea to (x, z) within r, deep enough to swim and clear round about (null: none). */
export function nearestSea(g: Game, x: number, z: number, r: number) {
  const grid = g.grid, fall = g.seaPhys.fallY + 1;
  const open = (cx: number, cz: number) =>
    cx >= 0 && cz >= 0 && cx < g.realm.w && cz < g.realm.d && grid.isDeep(cx, cz) && grid.groundAt(cx + 0.5, cz + 0.5) > fall && !grid.solid[grid.i(cx, cz)];
  let best: { x: number; z: number } | null = null, bd = Infinity;
  for (let dz = -Math.ceil(r); dz <= Math.ceil(r); dz++)
    for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
      const cx = Math.floor(x) + dx, cz = Math.floor(z) + dz, d = Math.hypot(cx + 0.5 - x, cz + 0.5 - z);
      if (d > r || d >= bd || !open(cx, cz) || !open(cx + 1, cz) || !open(cx - 1, cz) || !open(cx, cz + 1) || !open(cx, cz - 1)) continue;
      best = { x: cx + 0.5, z: cz + 0.5 };
      bd = d;
    }
  return best;
}

// ---------- its moves ----------

interface Bubble {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  dx: number;
  dz: number;
  t: number;
}

interface Whirl {
  group: THREE.Group;
  rings: THREE.Mesh[];
  x: number;
  y: number;
  z: number;
  dx: number;
  dz: number;
  t: number;
  tick: Map<Enemy, number>;
}

let bubbleGeo: THREE.BufferGeometry | null = null;
let bubbleMat: THREE.MeshBasicMaterial | null = null;

// ---------- the beast ----------

/**
 * The freed Tide Serpent. Left alone it floats where the knight got off (or, left below the surface, rests on
 * the sea floor); thrown off its back, he's left in the water and it dives away, back later. Ridden, the
 * knight's controls drive it (swim, called from Player.updateRiding), and his x, y and z are its.
 */
export class TideSerpent extends Mount {
  /** At the surface, under it, or leaping out of it. */
  private move: 'surface' | 'under' | 'air' = 'surface';
  /** Its last move (for its pose), and how long ago. */
  private act: 'shot' | 'whirl' | 'shell' | 'hurt' | '' = '';
  private actT = 9;
  private shotT = 9;
  /** Seconds the bubble shell has left (the next hit bursts it). */
  shell = 0;
  private pitch = 0;
  private ring: THREE.Mesh;
  private shellMesh: THREE.Mesh;
  private bubbles: Bubble[] = [];
  private whirls: Whirl[] = [];
  private fleeTo: { x: number; z: number } | null = null;
  /** Swimming over to the knight (just freed). */
  private comeTo: { x: number; z: number } | null = null;
  private warnT = -9;
  private wakeT = 0;
  private told = false;

  constructor(x: number, z: number, g: Game, model?: Model) {
    super(x, z, g, 'serpent', model ?? makeSerpent());
    this.radius = 3;
    this.y = this.floatY(g);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.84, 1, 40), glowMat(0.45, 1.5, 1.7, 0.6));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.renderOrder = 3;
    this.ring.visible = false;
    this.shellMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), glowMat(0.3, 0.9, 1.2, 0.22));
    this.shellMesh.visible = false;
    g.scene.add(this.ring, this.shellMesh);
  }

  get name() {
    return 'Tide Serpent';
  }
  get called() {
    return 'Tide Serpent';
  }

  /** Where it waits goes into the save: after a reload or a journey it is still there, not back by its old pen. */
  private keepHome(g: Game) {
    g.save.data.spots.serpent = [Math.round(this.home.x * 10) / 10, Math.round(this.home.z * 10) / 10];
  }

  /** Where its belly lies when it floats at the surface. */
  private floatY(g: Game) {
    return (g.realm.sea?.surface ?? 0) - SWIM.float;
  }

  /** Come to a spot (the knight rested at a moonfire): to the open sea nearest it, if there's any near. */
  arriveAt(x: number, z: number, g: Game) {
    if (this.ridden) return;
    const s = nearestSea(g, x, z, 12);
    if (!s) return;
    this.x = s.x;
    this.z = s.z;
    this.y = this.floatY(g);
    this.home = { ...s };
    this.keepHome(g);
    this.state = 'idle';
    this.hp = this.maxHp;
    this.move = 'surface';
    this.comeTo = null;
  }

  /** The knight is thrown: it dives away and comes back rested later. */
  bolt(g: Game) {
    this.ridden = false;
    this.state = 'flee';
    this.t = 0;
    const dx = this.x - g.player.x || 1, dz = this.z - g.player.z, l = Math.hypot(dx, dz) || 1;
    this.fleeTo = { x: this.x + (dx / l) * 12, z: this.z + (dz / l) * 12 };
    g.audio.sfx('serpent', this.x, this.z);
  }

  /** Just freed: it swims over to wherever the knight stands by its pool. */
  come(x: number, z: number, g: Game) {
    this.comeTo = nearestSea(g, x, z, 4.5);
  }

  /** Posed and placed by the rider: returns the saddle's world position. */
  ride(dt: number, g: Game, x: number, y: number, z: number, fx: number, fz: number, name: string, t: number, gy: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.fx = fx;
    this.fz = fz;
    const rig = this.model.rig;
    rig.face(fx, fz, dt, 6);
    this.model.animate(dt, x, z, name, t, g.time, { v: this.pitch });
    rig.place(g.cam, x, y, z, gy, true);
    rig.root.updateMatrixWorld(true);
    return rig.j('saddle').getWorldPosition(new THREE.Vector3());
  }

  update(dt: number, g: Game) {
    this.updateMoves(dt, g);
    this.shell = Math.max(0, this.shell - dt);
    // (A knight who died on its back isn't riding it any more.)
    if (this.ridden && g.player.riding === this && g.player.alive) return;
    this.ring.visible = false;
    this.shellMesh.visible = false;
    if (this.ridden) {
      this.ridden = false;
      this.state = 'idle';
      this.home = { x: this.x, z: this.z };
      this.keepHome(g);
    }
    this.t += dt;
    this.pitch *= Math.max(0, 1 - dt * 4);
    const top = this.floatY(g), floor = g.grid.groundAt(this.x, this.z);
    let moving = false;
    const swimTo = (to: { x: number; z: number }, speed: number) => {
      const dx = to.x - this.x, dz = to.z - this.z, d = Math.hypot(dx, dz);
      if (d < 0.3) return true;
      this.fx = dx / d;
      this.fz = dz / d;
      const body = { x: this.x, y: this.y, z: this.z, r: 0.55, aquatic: true };
      g.grid.move(body, this.fx * Math.min(d, speed * dt), this.fz * Math.min(d, speed * dt), 0.5);
      this.x = body.x;
      this.z = body.z;
      moving = true;
      return false;
    };
    switch (this.state) {
      case 'flee':
        if (this.fleeTo) swimTo(this.fleeTo, 7);
        this.y = Math.max(floor + 0.2, this.y - dt * 2);
        if (Math.random() < dt * 30) g.fx.emit(FROTH, this.x, this.y + 0.6, this.z, 0, 1, 0);
        if (this.t > 1.8) {
          this.state = 'gone';
          this.away = 25;
          this.model.rig.root.visible = false;
          this.model.rig.shadow.visible = false;
        }
        break;
      case 'gone':
        this.away -= dt;
        if (this.away <= 0) {
          this.arriveAt(this.home.x, this.home.z, g);
          this.state = 'idle';
          this.model.rig.root.visible = true;
          g.pop(this, `your ${this.called} returns`, '#feae34');
        }
        return;
      default:
        if (this.comeTo && swimTo(this.comeTo, 3)) {
          this.home = { ...this.comeTo };
          this.keepHome(g);
          this.comeTo = null;
        }
        // Left below the surface it settles onto the sea floor; at the surface it floats.
        if (this.y < top - 0.05) this.y = Math.max(floor + 0.15, this.y - dt * 1.2);
        else this.y = top;
    }
    // Keep the knight from walking through it.
    const p = g.player;
    if (!p.riding && Math.abs(p.y - this.y) < 1.6) {
      const dx = p.x - this.x, dz = p.z - this.z, rr = p.r + 0.6;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        p.x = this.x + (dx / d) * rr;
        p.z = this.z + (dz / d) * rr;
      }
    }
    const rig = this.model.rig;
    rig.face(this.fx, this.fz, dt, 3);
    const bob = this.y >= top - 0.05 ? Math.sin(g.time * 1.8) * 0.05 : 0;
    this.model.animate(dt, this.x, this.z, moving ? 'swim' : 'idle', this.t, g.time, { v: this.pitch });
    rig.place(g.cam, this.x, this.y + bob, this.z, floor, this.state !== 'gone');
  }

  // ---------- ridden ----------

  /** On its back: the knight's controls drive it. (Player.updateRiding hands over; his x, y, z, vy are its.) */
  swim(p: Player, dt: number, g: Game, wx: number, wz: number, moving: boolean) {
    const inp = g.input, grid = g.grid;
    const top = this.floatY(g);
    this.comeTo = null;
    if (!this.told) {
      this.told = true;
      if (g.firstTime('serpent')) {
        // (Two tips, one after the other: how it swims, then its moves.)
        // (On a phone, its buttons as the pause menu names them: the arrow, the sword, the shield, the star.)
        const k = (a: 'jump' | 'attack' | 'guard' | 'special') => `<kbd>${inp.label(a)}</kbd>`, touch = inp.usingTouch;
        g.ui.hint(`On the serpent, ${touch ? 'the arrow button' : k('jump')} leaps out of the water (in a diving suit, it dives). Under the water each tap swims up; it sinks between them.`, 7);
        g.after(7.5, () => g.ui.hint(touch ? "The serpent's moves: the sword, a bubble shot; the shield, a bubble shell; the star, a whirlpool." : `The serpent's moves: ${k('attack')} bubble shot, ${k('guard')} bubble shell, ${k('special')} whirlpool.`, 6));
      }
    }
    this.actT += dt;
    this.shotT += dt;
    if (g.controlsEnabled) {
      if (inp.hit('interact')) {
        p.dismount(g);
        if (p.riding !== this) return;
      }
      if (inp.hit('attack') && this.shotT >= MOVES.shot.every) this.shoot(p, g);
      else if (inp.hit('guard')) this.raiseShell(p, g);
      else if (inp.hit('special')) this.whirlpool(p, g, top);
      else if (inp.hit('jump')) this.stroke(p, g, top);
      else if (inp.hit('heal')) {
        if (p.flasks > 0 && p.needsFlask) {
          p.quaff(g);
          g.fx.burst(P.heal, p.x, p.y + 1.6, p.z, 18, 1.2, 1.5);
        } else p.noNeed(g);
      }
    }

    // Steering: it turns like the warhorse, its facing swinging round rather than snapping.
    let tx = 0, tz = 0;
    if (moving && this.move !== 'air') {
      const want = Math.atan2(wx, wz), cur = Math.atan2(p.fx, p.fz);
      let d = want - cur;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const na = cur + clamp(d, -SWIM.turn * dt, SWIM.turn * dt);
      p.fx = Math.sin(na);
      p.fz = Math.cos(na);
      tx = p.fx;
      tz = p.fz;
    }
    const speed = moving ? PLAYER.runSpeed * SWIM.speed * (this.act === 'whirl' && this.actT < 0.5 ? 0.3 : 1) : 0;
    const a = (moving ? SWIM.accel : SWIM.coast) * (this.move === 'air' ? 0.3 : 1);
    p.vx += clamp(tx * speed - p.vx, -a * dt, a * dt);
    p.vz += clamp(tz * speed - p.vz, -a * dt, a * dt);

    // Through the water: deep water only (a reef wall in front, ground higher than it can step, stops it;
    // it swims up over it), and never out past the map's edge into the open sea.
    const body = { x: p.x, y: p.y, z: p.z, r: 0.55, aquatic: true };
    grid.move(body, p.vx * dt, p.vz * dt, 0.5);
    const W = g.realm.w, D = g.realm.d, e = 0.6;
    if (body.x < e || body.z < e || body.x > W - e || body.z > D - e) {
      body.x = clamp(body.x, e, W - e);
      body.z = clamp(body.z, e, D - e);
      if (body.x <= e || body.x >= W - e) p.vx = 0;
      if (body.z <= e || body.z >= D - e) p.vz = 0;
      this.turnBack(p, g);
    }
    p.x = body.x;
    p.z = body.z;
    for (const f of g.enemies) {
      if (!f.solid) continue;
      const dx = p.x - f.x, dz = p.z - f.z, rr = 0.55 + f.r;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6 && Math.abs(f.y - p.y) < 1.5) {
        const d = Math.sqrt(d2), push = (rr - d) * 0.6;
        p.x += (dx / d) * push;
        p.z += (dz / d) * push;
      }
    }

    // Up and down: floating at the surface, leaping out of it, or below it, sinking between strokes.
    const floor = grid.groundAt(p.x, p.z), bottom = Math.max(floor, g.seaPhys.fallY + 1);
    switch (this.move) {
      case 'surface':
        p.vy = 0;
        p.y = top;
        break;
      case 'air':
        p.vy -= SWIM.gravity * dt;
        p.y += p.vy * dt;
        if (p.y <= top && p.vy < 0) this.splashDown(p, g, top);
        break;
      case 'under': {
        // (Out of air, or with no suit to dive in, it carries him up.)
        const target = p.breathless || !p.dives ? SWIM.carry : -SWIM.sink;
        const k = p.vy < target ? SWIM.drag : SWIM.settle;
        p.vy += clamp(target - p.vy, -k * dt, k * dt);
        p.y += p.vy * dt;
        if (p.y >= top) {
          if (p.vy > SWIM.breach) {
            this.move = 'air';
            p.vy = Math.min(p.vy, SWIM.leap);
          } else {
            this.move = 'surface';
            p.y = top;
            p.vy = 0;
          }
          g.audio.sfx('splash', p.x, p.z);
          g.fx.burst(SPRAY, p.x, top + 0.45, p.z, 12, 2, 2.5);
        }
        break;
      }
    }
    // The sea floor (and never down into the bottomless deep).
    if (p.y < bottom) {
      p.y = bottom;
      p.vy = Math.max(p.vy, 0);
    }
    p.onGround = this.move === 'surface' || p.y <= bottom + 0.01;
    this.pitch += (clamp(this.move === 'surface' ? 0 : -p.vy * 0.11, -0.5, 0.5) - this.pitch) * Math.min(1, dt * 6);

    // A wake at the surface, bubbles below it.
    const sp = Math.hypot(p.vx, p.vz);
    this.wakeT -= dt * (0.5 + sp);
    if (this.wakeT <= 0) {
      this.wakeT = 0.25;
      if (this.move === 'surface' && sp > 1) {
        for (const s of [-1, 1]) g.fx.emit(SPRAY, p.x - p.fx * 0.6 + p.fz * s * 0.5, top + 0.47, p.z - p.fz * 0.6 - p.fx * s * 0.5, p.fz * s * 0.8, 1.2, -p.fx * s * 0.8);
      } else if (this.move === 'under') g.fx.emit(P.seaBubble, p.x + p.fx * 0.9, p.y + 1.2, p.z + p.fz * 0.9, 0, 1, 0);
    }

    // Posed: the serpent, then the knight in its saddle; the ring and the shadow on the floor under it.
    const anim = this.act && this.actT < 0.7 ? this.act : sp > 0.3 ? 'swim' : 'idle';
    const bob = this.move === 'surface' ? Math.sin(g.time * 1.8) * 0.05 : 0;
    const saddle = this.ride(dt, g, p.x, p.y + bob, p.z, p.fx, p.fz, anim, this.actT, floor);
    const rig = p.rig;
    rig.face(p.fx, p.fz, dt, 8);
    p.model.animate(dt, p.x, p.z, 'ride', p.rideT, g.time, { dur: 0.4 });
    rig.place(g.cam, saddle.x, saddle.y - 0.9, saddle.z, floor, true);
    rig.root.rotation.x = this.bodyPitch;
    rig.flash = 0;
    rig.tint.setRGB(1, 1, 1);
    // The ring on the floor straight below: wider and fainter the higher it swims.
    const h = clamp(p.y - floor, 0, 12);
    this.ring.visible = true;
    this.ring.position.set(p.x, floor + 0.05, p.z);
    this.ring.scale.setScalar(0.8 + h * 0.11);
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.65 - h * 0.025;
    this.shellMesh.visible = this.shell > 0;
    if (this.shell > 0) {
      const wob = Math.sin(g.time * 6) * 0.05, fade = Math.min(1, this.shell / 0.3);
      this.shellMesh.position.set(p.x + p.fx * 0.2, p.y + 1.0, p.z + p.fz * 0.2);
      this.shellMesh.scale.set(1.45 + wob, 1.3 - wob, 1.45 + wob);
      (this.shellMesh.material as THREE.MeshBasicMaterial).opacity = (0.2 + 0.06 * Math.sin(g.time * 9)) * fade;
      if (Math.random() < dt * 10) g.fx.emit(GLINT, p.x + (Math.random() - 0.5) * 2.4, p.y + 0.3 + Math.random() * 1.6, p.z + (Math.random() - 0.5) * 2.4, 0, 0.4, 0);
    }
  }

  /**
   * Where the knight gets off (Player.dismount): onto ground beside it no higher than a step off its back (a
   * ledge, the shore); else, in the diving suit, into the water beside it (he sinks to the floor); else
   * nowhere (null: he stays on), unless he's thrown, when the sea washes him back to where he last stood.
   */
  landing(p: Player, g: Game, thrown: boolean): { x: number; y: number; z: number } | null {
    const grid = g.grid;
    let best: { x: number; y: number; z: number } | null = null, bs = Infinity;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a);
      for (const d of [0.9, 1.3, 1.8, STEP_REACH]) {
        const x = p.x + cx * d, z = p.z + cz * d, ix = Math.floor(x), iz = Math.floor(z);
        if (!grid.inside(ix, iz) || grid.solid[grid.i(ix, iz)] || grid.isDeep(ix, iz)) continue;
        const top = grid.groundAt(x, z);
        if (top > p.y + STEP_OFF || top < p.y - 3 || !grid.lineClear(p.x, p.z, x, z, Math.max(p.y, top) + 0.2)) break;
        const clear = !grid.collidersNear(x, z).some((c) => c.on && c.y1 > top + 0.3 && c.y0 < top + 1.6 && (c.kind === 'c' ? Math.hypot(x - c.x, z - c.z) < c.r + 0.3 : x > c.x0 - 0.3 && x < c.x1 + 0.3 && z > c.z0 - 0.3 && z < c.z1 + 0.3));
        if (!clear) continue;
        // The nearest, and of two as near the one he faces.
        const score = d - 0.5 * (cx * p.fx + cz * p.fz);
        if (score < bs) {
          bs = score;
          best = { x, y: top, z };
        }
        break;
      }
    }
    // (Without the suit he'd sink in his armour; over the bottomless deep there'd be nothing to stand on.)
    const bottomless = grid.groundAt(p.x, p.z) < g.seaPhys.fallY;
    if (!best && (!p.dives || bottomless) && !thrown && !g.flying && p.alive) {
      if (g.time - this.warnT > 2) {
        this.warnT = g.time;
        g.pop(p, bottomless ? 'nothing to stand on down there' : "you'd sink in your armour: find a shore", '#9ad8ff');
      }
      return null;
    }
    this.ring.visible = false;
    this.shellMesh.visible = false;
    this.shell = 0;
    if (best) return best;
    if (!p.dives && thrown && !g.flying && p.alive) {
      // Thrown into deep water in his armour: the sea washes him back to where he last stood (a heart, as a fall).
      g.fellOut();
      return { x: p.lastSafe.x, y: grid.groundAt(p.lastSafe.x, p.lastSafe.z), z: p.lastSafe.z };
    }
    // Into the water at its side.
    const x = p.x - p.fz * 0.9, z = p.z + p.fx * 0.9, open = grid.isDeep(Math.floor(x), Math.floor(z));
    return { x: open ? x : p.x, y: p.y, z: open ? z : p.z };
  }

  /** Jump: at the surface a leap; below it a stroke up (costing stamina). */
  private stroke(p: Player, g: Game, top: number) {
    if (this.move === 'air') return;
    if (this.move === 'surface') {
      this.move = 'air';
      p.vy = SWIM.leap;
      p.y = top + 0.02;
      g.audio.sfx('splash', p.x, p.z);
      g.fx.burst(SPRAY, p.x, top + 0.45, p.z, 14, 2, 3);
      return;
    }
    if (p.stamina < SWIM.strokeCost) {
      if (g.time - this.warnT > 1) {
        this.warnT = g.time;
        g.pop(p, 'tired', '#b9b3dc');
        g.audio.sfx('guard');
      }
      return;
    }
    p.stamina -= SWIM.strokeCost;
    p.staminaWait = 0.3;
    p.vy = Math.min(SWIM.riseMax, Math.max(p.vy, 0) + SWIM.stroke);
    g.audio.sfx('stroke', p.x, p.z);
    for (let i = 0; i < 5; i++) g.fx.emit(P.seaBubble, p.x + (Math.random() - 0.5) * 1.2, p.y + 0.3, p.z + (Math.random() - 0.5) * 1.2, 0, 0.6, 0);
  }

  /** Back down into the water from a leap: under it in the diving suit, else back up to float. */
  private splashDown(p: Player, g: Game, top: number) {
    g.audio.sfx('splash', p.x, p.z);
    g.fx.burst(SPRAY, p.x, top + 0.45, p.z, 18, 2.5, 3);
    if (p.dives) {
      this.move = 'under';
      return;
    }
    this.move = 'surface';
    p.y = top;
    p.vy = 0;
    if (g.firstTime('serpent-suit')) g.ui.hint("Without a diving suit the serpent won't take you under: in your armour you'd sink like a stone. (The goblins out on the lighthouse isle dive somehow.)", 7);
    else if (g.time - this.warnT > 5) {
      this.warnT = g.time;
      g.pop(p, 'no diving suit: it keeps you up', '#9ad8ff');
    }
  }

  /** At the map's edge it won't swim on out to the open sea (and the way to the next realm isn't open yet). */
  private turnBack(p: Player, g: Game) {
    if (g.time - this.warnT < 3) return;
    this.warnT = g.time;
    g.pop(p, g.region?.name === 'The Dune Strait' ? 'not yet: the way east is shut' : 'the serpent turns back from the open sea', '#9ad8ff');
  }

  /** Bubble shot: a bubble spat toward where the knight aims. */
  private shoot(p: Player, g: Game) {
    this.shotT = 0;
    this.act = 'shot';
    this.actT = 0;
    const l = Math.hypot(p.aim.x, p.aim.y) || 1, dx = p.aim.x / l, dz = p.aim.y / l;
    p.fx = dx;
    p.fz = dz;
    if (!bubbleGeo) bubbleGeo = new THREE.IcosahedronGeometry(0.22, 1);
    if (!bubbleMat) bubbleMat = glowMat(0.55, 1.4, 1.7, 0.75);
    const mesh = new THREE.Mesh(bubbleGeo, bubbleMat);
    const b: Bubble = { mesh, x: p.x + dx * 1.3, y: p.y + 1.3, z: p.z + dz * 1.3, dx, dz, t: 0 };
    mesh.position.set(b.x, b.y, b.z);
    g.scene.add(mesh);
    this.bubbles.push(b);
    g.audio.sfx('bubbleShot', p.x, p.z);
  }

  /** Bubble shell: a bubble round them both that the next hit bursts instead of landing. */
  private raiseShell(p: Player, g: Game) {
    if (this.shell > 0) return;
    if (p.stamina < MOVES.shell.need) {
      g.pop(p, 'tired', '#b9b3dc');
      g.audio.sfx('guard');
      return;
    }
    p.useStamina(MOVES.shell.cost);
    this.shell = MOVES.shell.time;
    this.act = 'shell';
    this.actT = 0;
    g.audio.sfx('shell', p.x, p.z);
    g.fx.burst(FROTH, p.x, p.y + 1, p.z, 16, 2, 1);
  }

  /** A blow reaches the knight on its back: the shell, if up, takes it whole and bursts. */
  burst(p: Player, g: Game) {
    if (this.shell <= 0) return false;
    this.shell = 0;
    this.shellMesh.visible = false;
    p.iframes = Math.max(p.iframes, 0.4);
    g.audio.sfx('pop', p.x, p.z);
    g.fx.burst(FROTH, p.x, p.y + 1, p.z, 26, 3.5, 1.5);
    return true;
  }

  /** Whirlpool: a vortex in front of it, drifting on the way it faces. */
  private whirlpool(p: Player, g: Game, top: number) {
    if (p.energy < MOVES.whirl.cost) {
      g.pop(p, 'not enough energy', '#5ad1ff');
      return;
    }
    p.energy -= MOVES.whirl.cost;
    this.act = 'whirl';
    this.actT = 0;
    const group = new THREE.Group(), rings: THREE.Mesh[] = [];
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.72, 1, 36, 1, 0, Math.PI * 1.6), glowMat(0.35, 1.1 + k * 0.2, 1.4 + k * 0.2, 0.5));
      m.rotation.x = -Math.PI / 2;
      m.position.y = k * 0.45;
      m.scale.setScalar(MOVES.whirl.r * (1 - k * 0.3));
      group.add(m);
      rings.push(m);
    }
    // At the surface it spins the water there; below, round about the serpent's height.
    const y = this.move === 'under' ? p.y + 0.3 : top + 0.25;
    const w: Whirl = { group, rings, x: p.x + p.fx * 2.2, y, z: p.z + p.fz * 2.2, dx: p.fx, dz: p.fz, t: 0, tick: new Map() };
    group.position.set(w.x, w.y, w.z);
    g.scene.add(group);
    this.whirls.push(w);
    g.audio.sfx('whirl', w.x, w.z);
  }

  /** Its bubbles and whirlpools, ridden or not (they run their course). */
  private updateMoves(dt: number, g: Game) {
    const p = g.player;
    for (const b of this.bubbles) {
      b.t += dt;
      const k = MOVES.shot.speed * g.shotsAt(b.y) * dt;
      const nx = b.x + b.dx * k, nz = b.z + b.dz * k;
      let gone = b.t > MOVES.shot.life || !g.grid.lineClear(b.x, b.z, nx, nz, b.y - 0.9);
      b.x = nx;
      b.z = nz;
      if (!gone)
        for (const e of g.enemies) {
          if (!e.alive || Math.hypot(e.x - b.x, e.z - b.z) > e.r + 0.3) continue;
          const ey = e.y + (e.flying ? -1 : 0);
          if (b.y < ey - 0.3 || b.y > ey + e.height + 0.3) continue;
          if (e.takeHit(MOVES.shot.dmg * p.damage, b.dx, b.dz, MOVES.shot.kb, false, g) !== 'blocked') {
            g.landed(e, false);
            p.energy = Math.min(100, p.energy + 4);
          }
          gone = true;
          break;
        }
      b.mesh.position.set(b.x, b.y + Math.sin(b.t * 14) * 0.04, b.z);
      b.mesh.scale.setScalar(1 + Math.sin(b.t * 20) * 0.08);
      if (Math.random() < dt * 20) g.fx.emit(P.seaBubble, b.x, b.y, b.z, 0, 0.3, 0, 0.4);
      if (gone) {
        b.t = 99;
        g.scene.remove(b.mesh);
        g.fx.burst(FROTH, b.x, b.y, b.z, 10, 2, 0.5);
        g.audio.sfx('pop', b.x, b.z);
      }
    }
    this.bubbles = this.bubbles.filter((b) => b.t < 99);
    const W = MOVES.whirl;
    for (const w of this.whirls) {
      w.t += dt;
      const nx = w.x + w.dx * W.drift * dt, nz = w.z + w.dz * W.drift * dt;
      if (g.grid.lineClear(w.x, w.z, nx, nz, w.y - 0.5)) {
        w.x = nx;
        w.z = nz;
      }
      const grow = Math.min(1, w.t / 0.25) * Math.min(1, (W.life - w.t) / 0.4);
      w.group.position.set(w.x, w.y, w.z);
      w.group.scale.setScalar(Math.max(0.01, grow));
      w.rings.forEach((m, k) => (m.rotation.z = w.t * (5 + k * 3)));
      for (let i = 0; i < 2; i++) {
        const a = w.t * 9 + Math.random() * Math.PI * 2, r = W.r * (0.3 + Math.random() * 0.7);
        g.fx.emit(FROTH, w.x + Math.cos(a) * r, w.y + Math.random() * 1.2, w.z + Math.sin(a) * r, -Math.sin(a) * 3, 0.6, Math.cos(a) * 3, 0.6);
      }
      g.combat.deflectArrows(w.x, w.z, W.r);
      for (const e of g.enemies) {
        if (!e.alive || e.isBoss) continue;
        const dx = w.x - e.x, dz = w.z - e.z, d = Math.hypot(dx, dz);
        if (d > W.r + e.r || Math.abs(e.y - w.y) > 2.5) continue;
        // Dragged round and in.
        if (d > 0.3) g.grid.move(e, (dx / d) * W.pull * dt + (-dz / d) * W.pull * 0.5 * dt, (dz / d) * W.pull * dt + (dx / d) * W.pull * 0.5 * dt, 0.45);
        // Worn down a little at a time (only its first touch counts toward a combo, and gives energy back).
        const first = !w.tick.has(e), next = (w.tick.get(e) ?? 0) - dt;
        w.tick.set(e, next);
        if (next > 0) continue;
        w.tick.set(e, W.tick);
        if (e.takeHit(W.dmg * p.damage, -dx / (d || 1), -dz / (d || 1), 0, false, g) !== 'blocked' && first) {
          g.landed(e, false);
          p.energy = Math.min(100, p.energy + 4);
        }
      }
      if (w.t >= W.life) {
        g.scene.remove(w.group);
        for (const m of w.rings) {
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
      }
    }
    this.whirls = this.whirls.filter((w) => w.t < W.life);
  }
}

// ---------- its prison: the crew's nets ----------

/** Where the crew hold it: the pool's middle and the stakes their nets' lines are tied to. */
export interface NetsDef {
  id: string;
  x: number;
  z: number;
  stakes: Pt[];
}

/**
 * The crew's catch: the serpent netted in a pool, the net's lines staked out on the sand round it (the stag's
 * thorn knots, at sea). A blow at a stake cuts its line; when all are cut it bursts free and is the knight's.
 * Its guard are the foes placed with group 'serpent'. The quest starts when he comes near.
 */
export class SerpentPen {
  serpent: TideSerpent | null = null;
  private beast: Model | null = null;
  private net: THREE.Group | null = null;
  private lines: (THREE.Group | null)[] = [];
  private stakes: { x: number; y: number; z: number }[] = [];
  private y: number;

  constructor(private def: NetsDef, g: Game) {
    const sea = g.realm.sea?.surface ?? 0;
    this.y = sea - SWIM.float;
    const freed = g.save.data.mounts.includes('serpent');
    for (const [sx, sz] of def.stakes) {
      const y = g.grid.groundAt(sx, sz);
      this.stakes.push({ x: sx, y, z: sz });
      const post = meshOf((m) => {
        // A post driven into the sand, a coil of line round it, a cork float hung on it.
        m.push().translate(sx, y, sz).rotateZ(0.12).rotateX(-0.08);
        m.cyl(0, -0.3, 0, 0.1, 0.07, 1.7, 6, COL.stake, { kind: K.Wood });
        m.cyl(0, 0.85, 0, 0.13, 0.13, 0.16, 7, COL.rope, { kind: K.Cloth });
        m.blob(0.16, 1.05, 0, 0.1, 0.13, 0.1, COL.cork, 31, { kind: K.Wood });
        m.pop();
      });
      g.scene.add(post);
      g.grid.addCollider({ kind: 'c', x: sx, z: sz, r: 0.16, y0: y - 1, y1: y + 1.4 });
    }
    if (freed) {
      // (Waiting where the knight left it, if he rode it off.)
      const s = this.addSerpent(g), at = g.save.data.spots.serpent;
      if (at) s.arriveAt(at[0], at[1], g);
      return;
    }
    // The beast, thrashing; the net over it, floats round its edge; its lines out to the stakes.
    this.beast = makeSerpent();
    this.beast.rig.addTo(g.scene);
    this.beast.rig.face(-0.6, 0.8, 0);
    this.net = meshOf((m) => {
      const R = 2.3, H = 1.7;
      const at = (a: number, k: number): V3 => [def.x + Math.cos(a) * R * Math.sin(k * Math.PI / 2 + 0.1), sea + H * Math.cos(k * Math.PI / 2) - 0.1, def.z + Math.sin(a) * R * Math.sin(k * Math.PI / 2 + 0.1)];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        for (let k = 0; k < 4; k++) m.beam(at(a, k / 4), at(a, (k + 1) / 4), 0.025, COL.rope);
      }
      for (let k = 1; k <= 4; k++)
        for (let i = 0; i < 12; i++) m.beam(at((i / 12) * Math.PI * 2, k / 4), at(((i + 1) / 12) * Math.PI * 2, k / 4), 0.025, COL.rope);
      for (let i = 0; i < 12; i++) {
        const [x, , z] = at((i / 12) * Math.PI * 2 + 0.26, 1);
        m.blob(x, sea - 0.02, z, 0.13, 0.1, 0.13, COL.cork, 40 + i, { kind: K.Wood });
      }
    });
    g.scene.add(this.net);
    for (const s of this.stakes) {
      const a = Math.atan2(s.z - def.z, s.x - def.x);
      const ex = def.x + Math.cos(a) * 2.3, ez = def.z + Math.sin(a) * 2.3;
      const line = meshOf((m) => m.beam([ex, sea, ez], [s.x, s.y + 1.05, s.z], 0.035, COL.rope));
      g.scene.add(line);
      this.lines.push(line);
    }
  }

  /** The realm's nets, if it has any (the Sunken Reef's). */
  static make(g: Game) {
    const def = g.realm.objects.find((o) => o.kind === 'nets');
    return def && def.kind === 'nets' ? new SerpentPen(def, g) : null;
  }

  get freed() {
    return !this.beast;
  }
  get left() {
    return this.lines.filter((l) => l).length;
  }

  /** A blow lands somewhere: does it reach a stake? (Its line is cut.) */
  struck(g: Game, hit: (it: object, x: number, y: number, z: number, r: number) => boolean) {
    if (this.freed) return;
    this.stakes.forEach((s, i) => {
      if (this.lines[i] && hit(s, s.x, s.y, s.z, 0.6)) this.cut(i, g);
    });
  }

  private cut(i: number, g: Game) {
    const s = this.stakes[i];
    g.scene.remove(this.lines[i]!);
    this.lines[i] = null;
    g.quest('serpent', 0);
    g.audio.sfx('lineSnap', s.x, s.z);
    g.fx.burst(P.splinter, s.x, s.y + 1, s.z, 10, 2, 2);
    g.fx.burst(SPRAY, (s.x + this.def.x) / 2, this.y + 0.5, (s.z + this.def.z) / 2, 10, 2, 2);
    const left = this.left;
    if (left > 0) g.pop({ x: this.def.x, y: this.y, z: this.def.z }, `${left} to go`, '#bfefff');
    else this.free(g);
  }

  /** The last line is cut: the net falls away and the serpent bursts free, the knight's to ride. */
  private free(g: Game) {
    const d = this.def;
    if (this.net) g.scene.remove(this.net);
    this.net = null;
    if (!g.save.data.mounts.includes('serpent')) g.save.data.mounts.push('serpent');
    const s = this.addSerpent(g, this.beast!);
    this.beast = null;
    s.come(g.player.x, g.player.z, g);
    g.audio.sfx('serpent', d.x, d.z);
    g.audio.sfx('splash', d.x, d.z);
    g.fx.burst(SPRAY, d.x, this.y + 0.6, d.z, 50, 4, 5);
    g.fx.burst(FROTH, d.x, this.y + 0.6, d.z, 30, 3, 2);
    g.shake(0.4);
    g.pipe.flash = 0.15;
    g.pipe.flashColor.setRGB(0.5, 0.95, 1);
    g.ui.toast('The Tide Serpent is free', 'It will carry you across the sea, and in a diving suit down through it.', 4);
    g.quest('serpent', 1);
    g.writeSave();
  }

  /** The freed serpent, waiting in its pool (barding counts for it as for every mount). */
  private addSerpent(g: Game, model?: Model) {
    const s = new TideSerpent(this.def.x, this.def.z, g, model);
    s.maxHp = s.hp = 3 + (g.player.kit.barding ?? 0) + (g.save.data.relics.includes('tidepearl') ? 1 : 0);
    s.fx = -0.6;
    s.fz = 0.8;
    g.mounts.push(s);
    g.interactables.push(s);
    this.serpent = s;
    return s;
  }

  update(dt: number, g: Game) {
    const b = this.beast;
    if (!b) return;
    b.animate(dt, this.def.x, this.def.z, 'net', g.time, g.time);
    b.rig.place(g.cam, this.def.x, this.y + Math.sin(g.time * 2.3) * 0.08, this.def.z, g.grid.groundAt(this.def.x, this.def.z), true);
    if (Math.random() < dt * 6) g.fx.emit(SPRAY, this.def.x + (Math.random() - 0.5) * 3, this.y + 0.5, this.def.z + (Math.random() - 0.5) * 3, 0, 2, 0);
    const p = g.player;
    if (g.save.data.quests.serpent === undefined && !g.flying && Math.hypot(p.x - this.def.x, p.z - this.def.z) < 15) g.quest('serpent', 0);
  }
}
