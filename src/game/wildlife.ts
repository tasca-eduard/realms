import * as THREE from 'three';
import { MOBILE } from '../config';
import { Geo, type Col } from '../engine/geo';
import type { PSpec } from '../engine/particles';
import { angleLerp, clamp, damp, fbm, type Rng } from '../engine/util';
import { NONE } from '../world/grid';
import type { Game } from './game';

// ---------------------------------------------------------------------------
// The grammar of harmless life, shared by every realm: a group of creatures drawn as one instanced mesh (one
// draw), bent in its vertex shader (fish wag, wings beat and fold, legs swing, heads go down to graze), moved
// only near the camera and fewer of them on a phone. The Sunken Reef's fish, rays and jellies use it
// (sealife.ts); the land's and fresh water's ways of living are here too: flocks wheeling and perching, birds
// on the water, herds grazing and bolting, frogs on their pads, fish basking and rising, a wader in the
// shallows, a shy beast seen now and then, motes and moths in the air. Each realm brings its own creatures
// and says where they live (castlelife.ts, forestlife.ts).
// ---------------------------------------------------------------------------

export type V3 = [number, number, number];

/** How far from the camera's focus things still move and draw. */
export const RANGE = MOBILE ? 30 : 38;
/** Fewer of everything on a phone. */
export const FEW = MOBILE ? 0.55 : 1;

/** How much the glowing parts glow: all night, less once dawn comes. */
export const NIGHT = { value: 1 };

/** How each kind of body bends in its own space (aWind: how much a vertex bends; aPhase: its stroke, run on
 *  by how hard it swims, flies or walks; aPose, on the land's: wings open, a head down to graze, legs out). */
export const BEND = {
  // Fish: a wave running back along the body to the tail (the head at +z).
  wag: `transformed.x += sin(aPhase - position.z * 5.0) * aWind * 0.13;`,
  // Rays' wings and turtles' flippers: up and down and a little back, the wave running out to the tips.
  flap: `float fl = aPhase - abs(position.x) * 1.4;
         transformed.y += sin(fl) * aWind * 0.3;
         transformed.z -= cos(fl) * aWind * 0.1;`,
  // Jellies: the bell squeezes in at its rim and opens again; the tentacles (weights past 1) trail and sway.
  pulse: `float sq = max(0.0, sin(aPhase));
          if (aWind > 1.0) {
            float k = aWind - 1.0;
            transformed.x += sin(aPhase * 0.5 - position.y * 4.0) * k * 0.09;
            transformed.z += cos(aPhase * 0.4 - position.y * 3.0) * k * 0.07;
            transformed.y += sq * k * 0.08;
          } else {
            transformed.xz *= 1.0 - sq * aWind * 0.22;
            transformed.y += sq * aWind * 0.05;
          }`,
  // An octopus's arms: waves running out along each, curling up off the floor.
  curl: `float an = atan(position.z, position.x);
         transformed.y += (sin(aPhase + an * 3.0 - aWind * 5.0) * 0.5 + 0.5) * aWind * 0.14;
         transformed.xz *= 1.0 + sin(aPhase * 0.6 + an * 2.0) * aWind * 0.12;`,
  // A crab's legs: lifting by turns while it scuttles.
  scuttle: `transformed.y += max(0.0, sin(aPhase + position.z * 9.0 + sign(position.x) * 1.6)) * aWind * 0.12;`,
  // Birds and bats: the wings (weights out to the tips) beat up and down, the tips a little behind; folded
  // (aPose 0) they're drawn in along the back, tips trailing.
  fly: `float wb = sin(aPhase - aWind * 0.8);
        transformed.y += wb * aWind * 0.3 * aPose + (1.0 - aPose) * aWind * 0.05;
        transformed.x *= mix(1.0 - aWind * 0.84, 1.0, aPose);
        transformed.z -= (1.0 - aPose) * aWind * 0.14;`,
  // Beasts: the legs (weights: metres down from the hip) swing fore and aft, each diagonal pair together; the
  // neck and head (weights past 1: 1 and how far down that part goes, most at the nose) go down to the grass
  // with aPose.
  walk: `if (aWind > 1.0) {
           float k = aWind - 1.0;
           transformed.y -= aPose * k;
           transformed.z += aPose * k * 0.15;
         } else if (aWind > 0.0) {
           float st = aPhase + (position.x > 0.0 ? 0.0 : 3.1416) + (position.z > 0.0 ? 0.0 : 3.1416);
           transformed.z += sin(st) * aWind * 0.55;
           transformed.y += max(0.0, cos(st)) * aWind * 0.12;
         }`,
  // Hoppers: the hind legs (weights) thrown out behind in a leap (aPose). A frog's pad (weight -1) is drawn in
  // the same mesh: shown on the pad's own bodies (aPose -1), hidden on the frogs'.
  hop: `if (aWind < -0.5) {
         transformed *= step(aPose, -0.5);
       } else {
         transformed *= step(-0.5, aPose);
         transformed.z -= max(aPose, 0.0) * aWind * 0.3;
         transformed.y -= max(aPose, 0.0) * aWind * 0.06;
       }`,
};
export type Bend = keyof typeof BEND;
const POSED = new Set<Bend>(['fly', 'walk', 'hop']);

/** Lambert with the bend, a little light of its own (so the creatures read at night, the sea's through dark
 *  water) and the glowing parts (aKind 1) lit from inside at night. */
export function lifeMaterial(bend: Bend, self: number, parts = false) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = NIGHT;
    sh.uniforms.uSelf = { value: self };
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float aKind; attribute float aWind; attribute float aPhase;${POSED.has(bend) ? '\n         attribute float aPose;' : ''}${parts ? '\n         attribute float aPart; attribute float aBody;' : ''}
         varying float vGlow;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vGlow = aKind;
         ${BEND[bend]}${parts ? '\n         if (abs(aPart - aBody) > 0.5) transformed *= 0.0;' : ''}`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uNight; uniform float uSelf; varying float vGlow;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * (uSelf + vGlow * uNight);`);
  };
  mat.customProgramCacheKey = () => 'sealife-' + bend + (parts ? '-parts' : '');
  return mat;
}

/** A Geo built into a body, each vertex's bend weight worked out from where it lies (and the weight its shape
 *  was drawn with, as a mask). */
export function body(g: Geo, weight: (x: number, y: number, z: number, mask: number) => number) {
  const geo = g.build();
  const p = geo.getAttribute('position'), w = geo.getAttribute('aWind');
  for (let i = 0; i < p.count; i++) w.setX(i, weight(p.getX(i), p.getY(i), p.getZ(i), w.getX(i)));
  return geo;
}

/** Several bodies in one mesh, each vertex marked with which it belongs to (aPart): a Kind's instances each draw
 *  one of them. */
export function merged(geos: THREE.BufferGeometry[]) {
  const geo = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'color', 'aKind', 'aWind']) {
    const size = geos[0].getAttribute(k).itemSize, out = new Float32Array(geos.reduce((a, q) => a + q.getAttribute(k).array.length, 0));
    let o = 0;
    for (const q of geos) {
      out.set(q.getAttribute(k).array as Float32Array, o);
      o += q.getAttribute(k).array.length;
    }
    geo.setAttribute(k, new THREE.BufferAttribute(out, size));
  }
  const part = new Float32Array(geo.getAttribute('position').count);
  let o = 0;
  geos.forEach((q, i) => {
    part.fill(i, o, o + q.getAttribute('position').count);
    o += q.getAttribute('position').count;
  });
  geo.setAttribute('aPart', new THREE.BufferAttribute(part, 1));
  geo.computeBoundingSphere();
  return geo;
}

/** Two bodies in one (a frog and its pad): the second's weights all -1, to tell it apart in the bend. */
export function joined(a: THREE.BufferGeometry, b: THREE.BufferGeometry) {
  const geo = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'color', 'aKind', 'aWind']) {
    const A = a.getAttribute(k).array as Float32Array, B = b.getAttribute(k).array as Float32Array, out = new Float32Array(A.length + B.length);
    out.set(A);
    out.set(k === 'aWind' ? B.map(() => -1) : B, A.length);
    geo.setAttribute(k, new THREE.BufferAttribute(out, a.getAttribute(k).itemSize));
  }
  geo.computeBoundingSphere();
  return geo;
}

/** Places sorted into clumps by the square of the realm they fall in (so that each clump is a group of its own,
 *  moved and drawn only near the camera). */
export function clumps<P extends { x: number; z: number }>(pts: P[], cell = 24) {
  const by = new Map<number, P[]>();
  for (const p of pts) {
    const k = Math.floor(p.x / cell) * 1000 + Math.floor(p.z / cell);
    if (!by.has(k)) by.set(k, []);
    by.get(k)!.push(p);
  }
  return [...by.values()];
}

/** A triangle seen from both sides (fins, flippers, wings). */
export function both(g: Geo, a: V3, b: V3, c: V3, col: Col, kind = 0, wind = 0) {
  g.tri(a, b, c, col, { kind, wind });
  g.tri(a, c, b, col, { kind, wind });
}

/** A triangle turned to face up (or down) whichever way its corners come. */
export function up(g: Geo, a: V3, b: V3, c: V3, col: Col, down = false, kind = 0) {
  const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
  if (ny > 0 !== down) g.tri(a, b, c, col, { kind });
  else g.tri(a, c, b, col, { kind });
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

/** One group of creatures: an instanced mesh of `n` bodies with a stroke each (its own copy of the shared
 *  body's attributes, so that each group strokes on its own), and on the land's a pose each. */
export class Herd {
  mesh: THREE.InstancedMesh;
  phase: Float32Array;
  pose: Float32Array;
  /** Which of its bodies each draws, when the mesh holds several (see Kind). */
  body: Float32Array;
  private phaseAttr: THREE.InstancedBufferAttribute;
  private poseAttr: THREE.InstancedBufferAttribute | null = null;
  private bodyAttr: THREE.InstancedBufferAttribute | null = null;
  /** How far a body reaches from its middle (at size 1). */
  private reach: number;
  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, n: number, g: Game, tint: (i: number) => Col = () => '#ffffff', opts: { name?: string; pose?: boolean; parts?: boolean } = {}) {
    const own = new THREE.BufferGeometry();
    for (const k of Object.keys(geo.attributes)) own.setAttribute(k, geo.attributes[k]);
    this.phase = new Float32Array(n);
    for (let i = 0; i < n; i++) this.phase[i] = Math.random() * 6.3;
    this.phaseAttr = new THREE.InstancedBufferAttribute(this.phase, 1).setUsage(THREE.DynamicDrawUsage);
    own.setAttribute('aPhase', this.phaseAttr);
    this.pose = new Float32Array(opts.pose ? n : 0);
    if (opts.pose) {
      this.poseAttr = new THREE.InstancedBufferAttribute(this.pose, 1).setUsage(THREE.DynamicDrawUsage);
      own.setAttribute('aPose', this.poseAttr);
    }
    this.body = new Float32Array(opts.parts ? n : 0);
    if (opts.parts) {
      this.bodyAttr = new THREE.InstancedBufferAttribute(this.body, 1);
      own.setAttribute('aBody', this.bodyAttr);
    }
    this.mesh = new THREE.InstancedMesh(own, mat, n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // (Drawn only when some of its bodies are in view: see flush.)
    own.computeBoundingSphere();
    this.reach = own.boundingSphere!.radius + own.boundingSphere!.center.length();
    this.mesh.name = opts.name ?? 'sealife';
    for (let i = 0; i < n; i++) this.tint(i, tint(i));
    g.scene.add(this.mesh);
  }
  tint(i: number, c: Col) {
    if (Array.isArray(c)) _c.setRGB(c[0], c[1], c[2]);
    else _c.set(c);
    this.mesh.setColorAt(i, _c);
    this.mesh.instanceColor!.needsUpdate = true;
  }
  /** Place body i: where, which way it heads (yaw from +z), its nose up or down, its roll, its size. */
  set(i: number, x: number, y: number, z: number, yaw: number, pitch: number, roll: number, s: number) {
    _q.setFromEuler(_e.set(pitch, yaw, roll, 'YXZ'));
    _m.compose(_p.set(x, y, z), _q, _s.set(s, s, s));
    this.mesh.setMatrixAt(i, _m);
  }
  /** The same, quicker, for the many that don't roll (written straight into the instance's matrix:
   *  turned by yaw, then pitched). */
  setFast(i: number, x: number, y: number, z: number, yaw: number, pitch: number, s: number) {
    const e = this.mesh.instanceMatrix.array, o = i * 16, cy = Math.cos(yaw) * s, sy = Math.sin(yaw) * s, cp = Math.cos(pitch), sp = Math.sin(pitch);
    e[o] = cy;
    e[o + 1] = 0;
    e[o + 2] = -sy;
    e[o + 4] = sy * sp;
    e[o + 5] = cp * s;
    e[o + 6] = cy * sp;
    e[o + 8] = sy * cp;
    e[o + 9] = -sp * s;
    e[o + 10] = cy * cp;
    e[o + 12] = x;
    e[o + 13] = y;
    e[o + 14] = z;
    e[o + 15] = 1;
  }
  /** (only: the runs of bodies to bound, when the rest are far off and needn't be seen.) */
  flush(only?: [number, number][]) {
    this.mesh.instanceMatrix.needsUpdate = true;
    this.phaseAttr.needsUpdate = true;
    if (this.poseAttr) this.poseAttr.needsUpdate = true;
    if (this.bodyAttr) this.bodyAttr.needsUpdate = true;
    // A sphere round all its bodies, padded by a body's reach at the largest size, so that a group out of view
    // costs no draw (a shoal, a smack of jellies; one spread over the whole realm is drawn as before).
    const e = this.mesh.instanceMatrix.array, n = this.mesh.count * 16;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity, s = 0;
    for (const [a, b] of only ?? [[0, this.mesh.count]])
      for (let o = a * 16; o < b * 16; o += 16) {
        x0 = Math.min(x0, e[o + 12]);
        x1 = Math.max(x1, e[o + 12]);
        y0 = Math.min(y0, e[o + 13]);
        y1 = Math.max(y1, e[o + 13]);
        z0 = Math.min(z0, e[o + 14]);
        z1 = Math.max(z1, e[o + 14]);
        s = Math.max(s, e[o] * e[o] + e[o + 1] * e[o + 1] + e[o + 2] * e[o + 2], e[o + 4] * e[o + 4] + e[o + 5] * e[o + 5] + e[o + 6] * e[o + 6]);
      }
    if (!n || x0 > x1) return;
    const b = (this.mesh.boundingSphere ??= new THREE.Sphere());
    b.center.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    b.radius = Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2 + this.reach * Math.sqrt(s) + 0.5;
  }
}

/** What a group of creatures draws into: a herd of its own, or its share of its kind's (see Kind). */
export interface HerdLike {
  phase: Float32Array;
  pose: Float32Array;
  mesh: { visible: boolean };
  set(i: number, x: number, y: number, z: number, yaw: number, pitch: number, roll: number, s: number): void;
  setFast(i: number, x: number, y: number, z: number, yaw: number, pitch: number, s: number): void;
  tint(i: number, c: Col): void;
  flush(): void;
}
/** Hands a group its share of a kind: n bodies, tinted. */
export type Source = (n: number, tint?: (i: number) => Col) => HerdLike;

/** A group's share of its kind's herd: its own run of bodies in it (their strokes and poses views into the
 *  herd's), shown while the group is near the camera. */
class Slice implements HerdLike {
  phase: Float32Array;
  pose: Float32Array;
  mesh = { visible: true };
  dirty = true;
  constructor(private herd: Herd, public base: number, public n: number) {
    this.phase = herd.phase.subarray(base, base + n);
    this.pose = herd.pose.length ? herd.pose.subarray(base, base + n) : new Float32Array(n);
  }
  set(i: number, x: number, y: number, z: number, yaw: number, pitch: number, roll: number, s: number) {
    this.herd.set(this.base + i, x, y, z, yaw, pitch, roll, s);
  }
  setFast(i: number, x: number, y: number, z: number, yaw: number, pitch: number, s: number) {
    this.herd.setFast(this.base + i, x, y, z, yaw, pitch, s);
  }
  tint(i: number, c: Col) {
    this.herd.tint(this.base + i, c);
  }
  flush() {
    this.dirty = true;
  }
}

/** The creatures of a realm that bend the same way (all its birds, all its beasts): one instanced mesh, one draw,
 *  however many kinds, flocks and herds of them there are, each body drawing its own kind's shape out of the
 *  merged ones; drawn while any of them is near the camera. */
export class Kind {
  herd: Herd;
  private used = 0;
  private slices: Slice[] = [];
  constructor(geos: THREE.BufferGeometry[], bend: Bend, self: number, private cap: number, g: Game) {
    const parts = geos.length > 1;
    this.herd = new Herd(parts ? merged(geos) : geos[0], lifeMaterial(bend, self, parts), cap, g, () => '#ffffff', { name: 'wildlife', pose: POSED.has(bend), parts });
    this.herd.mesh.count = 0;
    this.herd.mesh.visible = false;
  }
  /** Hands out shares of the mesh drawing its part'th body. */
  part = (part: number): Source => (n, tint) => {
    n = Math.min(n, this.cap - this.used);
    const s = new Slice(this.herd, this.used, n);
    for (let i = 0; i < n; i++) {
      s.phase[i] = Math.random() * 6.3;
      if (this.herd.body.length) this.herd.body[this.used + i] = part;
      if (tint) s.tint(i, tint(i));
    }
    this.used += n;
    this.herd.mesh.count = this.used;
    this.slices.push(s);
    return s;
  };
  /** After every group has moved: shown if any is near, its bounds worked out again if any moved. */
  sync() {
    let on = false, dirty = false;
    for (const s of this.slices) {
      on ||= s.mesh.visible;
      dirty ||= s.dirty;
      s.dirty = false;
    }
    this.herd.mesh.visible = on && this.used > 0;
    // Bounded round the groups near the camera only: a kind whose near groups are out of view costs no draw.
    if (dirty && on) this.herd.flush(this.slices.filter((s) => s.mesh.visible).map((s): [number, number] => [s.base, s.base + s.n]));
  }
}

// ---------- what the land's life needs to know ----------

/** The ground and the water where a creature is. */
export class Land {
  constructor(public g: Game) {}
  ground(x: number, z: number) {
    return this.g.grid.groundAt(x, z);
  }
  /** The water's surface here (NONE on dry land). */
  water(x: number, z: number) {
    const w = this.g.grid.waterAt(x, z);
    return w !== NONE && w > this.g.grid.groundAt(x, z) ? w : NONE;
  }
  /** Open water at least `depth` deep. */
  wet(x: number, z: number, depth = 0.25) {
    const w = this.water(x, z);
    return w !== NONE && w - this.ground(x, z) >= depth;
  }
  /** Dry ground, not too steep to graze on (no step of more than `step` to a metre off on any side). */
  dry(x: number, z: number, step = 0.6) {
    if (this.water(x, z) !== NONE || x < 0.5 || z < 0.5 || x > this.g.realm.w - 0.5 || z > this.g.realm.d - 0.5) return false;
    const y = this.ground(x, z);
    for (const [dx, dz] of [[0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]]) if (Math.abs(this.ground(x + dx, z + dz) - y) > step) return false;
    return true;
  }
  /** Nothing standing within `rad` of (x, z) (a wall, a trunk, a rock), at the height of the ground there. */
  open(x: number, z: number, rad: number) {
    const y = this.ground(x, z);
    for (const c of this.g.grid.collidersNear(x, z)) {
      if (!c.on || c.y1 < y + 0.2 || c.y0 > y + 1.5) continue;
      if (c.kind === 'b' ? x > c.x0 - rad && x < c.x1 + rad && z > c.z0 - rad && z < c.z1 + rad : Math.hypot(x - c.x, z - c.z) < c.r + rad) return false;
    }
    return true;
  }
}

/** Water thrown up by something landing in it or leaving it; a ring spreading where a fish rose. */
const DROPS: PSpec = { color: [1.1, 1.3, 1.5], color2: [0.4, 0.5, 0.65], size: 1, life: 0.6, gravity: 9, drag: 0.8, alpha: 0.85 };
const RING: PSpec = { color: [0.75, 0.85, 1.0], color2: [0.25, 0.32, 0.45], size: 1, life: 1.5, drag: 1.4, alpha: 0.75, fadeIn: 0.04 };

/** A ring of light spreading on the water at (x, y, z), as where a fish rose or a frog went in. */
export function ring(g: Game, x: number, y: number, z: number, n = 14, speed = 0.9) {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + Math.random() * 0.2;
    g.fx.emit(RING, x + Math.cos(a) * 0.1, y + 0.02, z + Math.sin(a) * 0.1, Math.cos(a) * speed, 0, Math.sin(a) * speed);
  }
}

/** A splash: drops thrown up and a ring left behind. */
export function splash(g: Game, x: number, y: number, z: number, big = 1) {
  g.fx.burst(DROPS, x, y + 0.05, z, Math.round(8 * big), 1.1 * big, 2.2 * big);
  ring(g, x, y, z, Math.round(12 + 4 * big), 0.8 + big * 0.3);
}

/** Within r of the camera's focus (beyond RANGE and its own reach a group is out of view: it neither moves nor draws). */
const near = (g: Game, x: number, z: number, r: number) => Math.hypot(x - g.cam.focus.x, z - g.cam.focus.z) < r;

// ---------- flocks ----------

/** A circle a flock wheels round (its middle, its radius, its height). */
export interface Circle {
  x: number;
  z: number;
  r: number;
  y: number;
}
/** Somewhere a bird can sit (a merlon, a roof's ridge, a dead branch), and which way it faces there. */
export interface Perch {
  x: number;
  y: number;
  z: number;
  face?: number;
}

export interface FlockDef {
  n: number;
  size: number;
  circles: Circle[];
  perches?: Perch[];
  /** Share of the flock sitting to begin with. */
  perched?: number;
  /** How near the knight may come to a sitting bird before it goes up. */
  scare?: number;
  /** Its speed in the air (m/s), its wingbeats (radians a second). */
  speed?: number;
  beat?: number;
  /** Bats: flitting about their circles all night, never sitting; gone home by dawn. */
  flit?: boolean;
  tint?: (i: number) => Col;
}

class Bird {
  x = 0;
  y = 0;
  z = 0;
  yaw = 0;
  pitch = 0;
  roll = 0;
  state: 'circle' | 'fly' | 'perch' | 'flit' = 'circle';
  c = 0;
  a = 0;
  dir = 1;
  rad = 1;
  dy = 0;
  t = 0;
  flap = 0;
  open = 1;
  ph = 0;
  seed = 0;
  perch: Perch | null = null;
  goal: { x: number; y: number; z: number } | null = null;
}

/** Birds wheeling round their circles in bursts of wingbeats and glides, some sitting on perches about them and
 *  going up all together when the knight comes, to wheel a while and settle again; or bats flitting. */
export class Flock {
  herd: HerdLike;
  private birds: Bird[] = [];
  private taken = new Set<Perch>();
  private mid = { x: 0, z: 0, r: 0 };
  private speed: number;
  private beat: number;
  /** A burst of birds going up this frame (for whoever wants to hear it). */
  burst = 0;
  constructor(private def: FlockDef, src: Source, private r: Rng) {
    const n = Math.max(2, Math.round(def.n * FEW));
    this.speed = def.speed ?? 5;
    this.beat = def.beat ?? 14;
    this.herd = src(n, def.tint);
    const pts = [...def.circles.map((c) => [c.x, c.z, c.r]), ...(def.perches ?? []).map((p) => [p.x, p.z, 0])];
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const [x, z, rr] of pts) {
      x0 = Math.min(x0, x - rr);
      x1 = Math.max(x1, x + rr);
      z0 = Math.min(z0, z - rr);
      z1 = Math.max(z1, z + rr);
    }
    this.mid = { x: (x0 + x1) / 2, z: (z0 + z1) / 2, r: Math.hypot(x1 - x0, z1 - z0) / 2 };
    for (let i = 0; i < n; i++) {
      const b = new Bird();
      b.c = i % def.circles.length;
      b.a = r() * Math.PI * 2;
      b.dir = r() < 0.5 ? 1 : -1;
      b.rad = 0.65 + r() * 0.5;
      b.dy = (r() - 0.5) * 2.2;
      b.t = 6 + r() * 25;
      b.ph = r() * 6.3;
      b.seed = r() * 9;
      b.flap = r() * 2;
      const c = def.circles[b.c];
      if (def.flit) {
        b.state = 'flit';
        b.x = c.x + (r() - 0.5) * c.r;
        b.z = c.z + (r() - 0.5) * c.r;
        b.y = c.y + b.dy * 0.5;
      } else if (def.perches?.length && r() < (def.perched ?? 0.4)) {
        const p = this.free(c.x, c.z, 60);
        if (p) this.settle(b, p);
      }
      if (b.state === 'circle') this.circlePos(b, 0);
      this.birds.push(b);
    }
    this.birds.forEach((b, i) => this.draw(b, i));
    this.herd.flush();
  }

  /** How many are within r of (x, z). */
  count(x: number, z: number, r: number) {
    return this.herd.mesh.visible ? this.birds.filter((b) => Math.hypot(b.x - x, b.z - z) < r).length : 0;
  }

  private circlePos(b: Bird, dt: number) {
    const c = this.def.circles[b.c], R = c.r * b.rad;
    b.a += (b.dir * dt * this.speed) / R;
    b.x = c.x + Math.cos(b.a) * R;
    b.z = c.z + Math.sin(b.a) * R;
    b.y = c.y + b.dy + Math.sin(b.a * 2 + b.seed) * 0.5;
    b.yaw = Math.atan2(-Math.sin(b.a) * b.dir, Math.cos(b.a) * b.dir);
    b.roll = -b.dir * 0.35;
    b.pitch = 0;
  }
  private free(x: number, z: number, within: number, px = -999, pz = -999) {
    let best: Perch | null = null, bd = within;
    for (const p of this.def.perches ?? []) {
      if (this.taken.has(p) || Math.hypot(p.x - px, p.z - pz) < 9) continue;
      const d = Math.hypot(p.x - x, p.z - z) + this.r() * 8;
      if (d < bd) (best = p), (bd = d);
    }
    return best;
  }
  private settle(b: Bird, p: Perch) {
    b.state = 'perch';
    b.perch = p;
    this.taken.add(p);
    b.x = p.x;
    b.y = p.y;
    b.z = p.z;
    b.t = 25 + this.r() * 60;
    b.yaw = p.face ?? this.r() * Math.PI * 2;
    b.pitch = b.roll = 0;
    b.open = 0;
  }

  update(dt: number, g: Game) {
    this.burst = 0;
    const f = g.cam.focus, m = this.mid, on = Math.hypot(m.x - f.x, m.z - f.z) < RANGE + m.r && !(this.def.flit && g.dawn > 0.6);
    this.herd.mesh.visible = on;
    if (!on || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    const p = g.player, def = this.def, scare = def.scare ?? 5;
    this.birds.forEach((b, i) => {
      b.t -= dt;
      b.flap -= dt;
      if (b.state === 'flit') {
        // Flitting: making for somewhere in its circle, jinking off for somewhere else on a whim.
        const c = def.circles[b.c];
        if (!b.goal || Math.hypot(b.goal.x - b.x, b.goal.z - b.z) < 0.8 || this.r() < dt * 0.9) {
          const a = this.r() * Math.PI * 2, d = Math.sqrt(this.r()) * c.r;
          b.goal = { x: c.x + Math.cos(a) * d, y: c.y + (this.r() - 0.5) * 3, z: c.z + Math.sin(a) * d };
        }
        const want = Math.atan2(b.goal.x - b.x, b.goal.z - b.z), turn = Math.atan2(Math.sin(want - b.yaw), Math.cos(want - b.yaw));
        b.yaw += clamp(turn, -5 * dt, 5 * dt);
        b.roll = damp(b.roll, clamp(-turn, -0.7, 0.7), 6, dt);
        b.x += Math.sin(b.yaw) * this.speed * dt;
        b.z += Math.cos(b.yaw) * this.speed * dt;
        b.y = damp(b.y, Math.max(b.goal.y, g.grid.groundAt(b.x, b.z) + 1.2), 2, dt);
        b.ph += dt * this.beat;
        b.open = 1;
      } else if (b.state === 'circle') {
        this.circlePos(b, dt);
        if (b.t <= 0 && def.perches?.length) {
          const c = def.circles[b.c], to = this.free(c.x, c.z, c.r + 26, p.x, p.z);
          if (to) {
            b.state = 'fly';
            b.perch = to;
            b.goal = to;
            this.taken.add(to);
          } else b.t = 6 + this.r() * 12;
        }
      } else if (b.state === 'perch') {
        // Sitting: looking about, now and then a stoop to peck or preen.
        b.pitch = Math.pow(Math.max(0, Math.sin(g.time * 0.6 + b.seed * 5)), 12) * 0.6;
        if ((Math.hypot(p.x - b.x, p.z - b.z) < scare && Math.abs(p.y - b.y) < 11) || b.t <= 0) {
          // Up and away, back to the nearest circle (a bird or two behind the rest).
          let ci = 0, cd = Infinity;
          def.circles.forEach((c, k) => {
            const d = Math.hypot(c.x - b.x, c.z - b.z);
            if (d < cd) (cd = d), (ci = k);
          });
          const c = def.circles[ci];
          b.c = ci;
          b.a = Math.atan2(b.z - c.z, b.x - c.x) + b.dir * 0.5;
          if (b.perch) this.taken.delete(b.perch);
          b.perch = null;
          b.state = 'fly';
          b.goal = { x: c.x + Math.cos(b.a) * c.r * b.rad, y: c.y + b.dy, z: c.z + Math.sin(b.a) * c.r * b.rad };
          b.flap = 1.6 + this.r();
          if (b.t > 0) this.burst++;
        }
      } else if (b.goal) {
        // Flying to a perch (gliding down, beating as it lands) or up to its circle (beating).
        const dx = b.goal.x - b.x, dy = b.goal.y - b.y, dz = b.goal.z - b.z, d = Math.hypot(dx, dy, dz);
        const sp = b.perch ? Math.max(1.4, Math.min(this.speed, d * 1.4)) : this.speed * 1.2;
        if (d < 0.12) {
          if (b.perch) this.settle(b, b.perch);
          else {
            b.state = 'circle';
            b.t = 12 + this.r() * 30;
          }
        } else {
          const k = Math.min(1, (sp * dt) / d);
          b.x += dx * k;
          b.y += dy * k;
          b.z += dz * k;
          b.yaw = angleLerp(b.yaw, Math.atan2(dx, dz), Math.min(1, dt * 7));
          b.roll = damp(b.roll, 0, 4, dt);
          b.pitch = clamp(-dy / Math.max(0.5, Math.hypot(dx, dz)), -0.5, 0.5) * 0.6;
          if (dy > 0.2 || (b.perch && d < 1.6)) b.flap = Math.max(b.flap, 0.3);
        }
      }
      if (b.state !== 'perch' && b.state !== 'flit') {
        // Beating in bursts and gliding between, the wings held out.
        if (b.flap < -1.5 - (b.seed % 3)) b.flap = 0.7 + this.r() * 1.1;
        if (b.flap > 0 || Math.cos(b.ph - 1.1) < 0.93) b.ph += dt * this.beat * (b.flap > 0 ? 1 : 1.6);
        b.open = damp(b.open, 1, 12, dt);
      } else if (b.state === 'perch') b.open = damp(b.open, 0, 10, dt);
      this.draw(b, i);
    });
    this.herd.flush();
  }

  private draw(b: Bird, i: number) {
    this.herd.phase[i] = b.ph;
    this.herd.pose[i] = b.open;
    this.herd.set(i, b.x, b.y, b.z, b.yaw, b.pitch, b.roll, this.def.size);
  }
}

// ---------- birds on the water ----------

export interface SwimDef {
  n: number;
  size: number;
  /** The water they keep to: its middle and how far round it. */
  x: number;
  z: number;
  r: number;
  scare?: number;
  /** Swans: up off the water and away when the knight comes, beating along the surface, to land further off. */
  fly?: boolean;
  /** Ducks: up-ending now and then to feed (tail up). */
  dabble?: boolean;
  /** How deep the body sits. */
  sink?: number;
  tint?: (i: number) => Col;
}

class Paddler {
  x = 0;
  y = 0;
  z = 0;
  yaw = 0;
  pitch = 0;
  roll = 0;
  tx = 0;
  tz = 0;
  t = 0;
  state: 'paddle' | 'rest' | 'dabble' | 'flee' | 'run' | 'air' = 'rest';
  open = 0;
  ph = 0;
  sp = 0;
  air = 0;
  seed = 0;
}

/** Birds on the water: paddling about their patch in twos and threes, resting, ducks up-ending; away from the
 *  knight when he comes to the bank; swans running along the surface on beating wings and up, round and down
 *  again further off. */
export class Swimmers {
  herd: HerdLike;
  private all: Paddler[] = [];
  constructor(private def: SwimDef, src: Source, private land: Land, private r: Rng) {
    const n = Math.max(1, Math.round(def.n * FEW));
    this.herd = src(n, def.tint);
    for (let i = 0; i < n; i++) {
      const s = new Paddler();
      s.seed = r() * 9;
      const at = this.spot(def.x, def.z, def.r) ?? { x: def.x, z: def.z };
      // In twos and threes: the next one by the last.
      const by = i % 3 && this.all.length ? this.spot(this.all[this.all.length - 1].x, this.all[this.all.length - 1].z, 2) : null;
      s.x = (by ?? at).x;
      s.z = (by ?? at).z;
      s.tx = s.x;
      s.tz = s.z;
      s.yaw = r() * Math.PI * 2;
      s.t = r() * 6;
      s.y = this.surf(s.x, s.z);
      this.all.push(s);
      this.draw(s, i, 0);
    }
    this.herd.flush();
  }
  count(x: number, z: number, r: number) {
    return this.herd.mesh.visible ? this.all.filter((s) => Math.hypot(s.x - x, s.z - z) < r).length : 0;
  }
  private surf(x: number, z: number) {
    const w = this.land.water(x, z);
    return (w === NONE ? this.land.ground(x, z) : w) - (this.def.sink ?? 0.06) * this.def.size;
  }
  /** Open water within r of (x, z), not too near the bank. */
  private spot(x: number, z: number, r: number, awayX?: number, awayZ?: number) {
    for (let k = 0; k < 16; k++) {
      let a = this.r() * Math.PI * 2;
      if (awayX !== undefined && awayZ !== undefined && k < 10) a = Math.atan2(z - awayZ, x - awayX) + (this.r() - 0.5) * 1.6;
      const d = r * Math.sqrt(this.r()), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      if (Math.hypot(px - this.def.x, pz - this.def.z) > this.def.r * 1.4) continue;
      if (this.land.wet(px, pz, 0.15) && this.land.wet(px + 0.8, pz, 0.05) && this.land.wet(px - 0.8, pz, 0.05) && this.land.wet(px, pz + 0.8, 0.05) && this.land.wet(px, pz - 0.8, 0.05)) return { x: px, z: pz };
    }
    return null;
  }

  update(dt: number, g: Game) {
    const d = this.def, on = near(g, d.x, d.z, RANGE + d.r);
    this.herd.mesh.visible = on;
    if (!on || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    const p = g.player, scare = d.scare ?? 5;
    this.all.forEach((s, i) => {
      s.t -= dt;
      const pd = Math.hypot(p.x - s.x, p.z - s.z);
      if (pd < scare && s.state !== 'flee' && s.state !== 'run' && s.state !== 'air') {
        const to = this.spot(s.x, s.z, 9, p.x, p.z);
        if (d.fly && to) {
          // Away along the water into the wind of its own wings, then up.
          s.state = 'run';
          s.t = 1.5;
          s.yaw = Math.atan2(s.x - p.x, s.z - p.z);
          const far = this.spot(d.x, d.z, d.r, p.x, p.z) ?? to;
          s.tx = far.x;
          s.tz = far.z;
          g.audio.sfx('splash', s.x, s.z);
        } else if (to) {
          s.state = 'flee';
          s.tx = to.x;
          s.tz = to.z;
          s.t = 4;
        }
      }
      let speed = 0;
      if (s.state === 'rest' || s.state === 'dabble') {
        if (s.t <= 0) {
          const u = this.r();
          if (d.dabble && u < 0.35) {
            s.state = 'dabble';
            s.t = 1.5 + this.r() * 2;
          } else {
            const to = this.spot(s.x, s.z, 4);
            if (to) {
              s.state = 'paddle';
              s.tx = to.x;
              s.tz = to.z;
              s.t = 12;
            } else s.t = 2;
          }
        }
      } else if (s.state === 'paddle' || s.state === 'flee') {
        speed = s.state === 'flee' ? 1.5 : 0.35;
        if (Math.hypot(s.tx - s.x, s.tz - s.z) < 0.2 || s.t <= 0) {
          s.state = 'rest';
          s.t = 2 + this.r() * 6;
        }
      } else if (s.state === 'run') {
        // Beating along the surface, feet slapping it.
        s.sp = Math.min(5, s.sp + dt * 4);
        s.x += Math.sin(s.yaw) * s.sp * dt;
        s.z += Math.cos(s.yaw) * s.sp * dt;
        if (Math.random() < dt * 20) g.fx.emit(DROPS, s.x - Math.sin(s.yaw) * 0.4, s.y + 0.05, s.z - Math.cos(s.yaw) * 0.4, (Math.random() - 0.5) * 0.6, 1.6, (Math.random() - 0.5) * 0.6);
        if (s.t <= 0) {
          s.state = 'air';
          s.t = 30;
        }
      } else {
        // In the air: round to its new water, down onto it.
        const dx = s.tx - s.x, dz = s.tz - s.z, dist = Math.hypot(dx, dz);
        const turn = Math.atan2(Math.sin(Math.atan2(dx, dz) - s.yaw), Math.cos(Math.atan2(dx, dz) - s.yaw));
        s.yaw += clamp(turn, -1.2 * dt, 1.2 * dt);
        s.roll = damp(s.roll, clamp(-turn, -0.5, 0.5), 3, dt);
        s.x += Math.sin(s.yaw) * 5 * dt;
        s.z += Math.cos(s.yaw) * 5 * dt;
        s.air = damp(s.air, dist > 7 ? 3.2 : 0, dist > 7 ? 0.8 : 1.6, dt);
        if ((dist < 0.8 && s.air < 0.25) || s.t <= 0) {
          splash(g, s.x, this.surf(s.x, s.z), s.z, 1.3);
          g.audio.sfx('splash', s.x, s.z);
          s.state = 'rest';
          s.sp = s.air = s.roll = 0;
          s.t = 4;
          if (!this.land.wet(s.x, s.z, 0.1)) {
            const back = this.spot(d.x, d.z, d.r) ?? { x: d.x, z: d.z };
            s.x = back.x;
            s.z = back.z;
          }
        }
      }
      if (speed > 0) {
        const dx = s.tx - s.x, dz = s.tz - s.z, dist = Math.hypot(dx, dz);
        s.yaw = angleLerp(s.yaw, Math.atan2(dx, dz), Math.min(1, dt * 3));
        const v = Math.min(dist, speed * dt), nx = s.x + Math.sin(s.yaw) * v, nz = s.z + Math.cos(s.yaw) * v;
        if (this.land.wet(nx, nz, 0.08)) {
          s.x = nx;
          s.z = nz;
        } else s.state = 'rest';
        if (Math.random() < dt * speed * 1.5) ring(g, s.x - Math.sin(s.yaw) * 0.3 * d.size, this.surf(s.x, s.z) + (d.sink ?? 0.06) * d.size, s.z - Math.cos(s.yaw) * 0.3 * d.size, 6, 0.4);
      }
      const flying = s.state === 'run' || s.state === 'air';
      s.open = damp(s.open, flying ? 1 : 0, 10, dt);
      if (flying) s.ph += dt * 9;
      s.pitch = damp(s.pitch, s.state === 'dabble' ? 1.35 : s.state === 'air' ? -0.1 : 0, 6, dt);
      s.y = this.surf(s.x, s.z) + s.air + (flying ? 0.1 : Math.sin(g.time * 1.4 + s.seed) * 0.015);
      this.draw(s, i, dt);
    });
    this.herd.flush();
  }
  private draw(s: Paddler, i: number, _dt: number) {
    this.herd.phase[i] = s.ph;
    this.herd.pose[i] = s.open;
    this.herd.set(i, s.x, s.y, s.z, s.yaw, s.pitch, s.roll, this.def.size);
  }
}

// ---------- herds on the land ----------

export interface GrazeDef {
  /** The kinds in the herd (a stag among the hinds): each its body, how many, its size. */
  kinds: { src: Source; n: number; size: number; tint?: (i: number) => Col }[];
  x: number;
  z: number;
  /** How far from its middle the herd wanders. */
  r: number;
  walk: number;
  run: number;
  scare: number;
  /** beast: grazes head down, walks on four legs; bird (geese): waddles, opens its wings to run; hopper: bounds. */
  way: 'beast' | 'bird' | 'hopper';
  /** Where they may go besides (off the roads, out of the village). */
  keep?: (x: number, z: number) => boolean;
  /** How far they run from the knight. */
  flee?: number;
}

class Beast {
  x = 0;
  y = 0;
  z = 0;
  yaw = 0;
  roll = 0;
  tx = 0;
  tz = 0;
  t = 0;
  state: 'idle' | 'graze' | 'walk' | 'flee' = 'graze';
  pose = 0;
  ph = 0;
  hop = 0;
  constructor(public k: number, public i: number, public size: number) {}
}

/** A herd grazing its pasture (sheep, cows, deer, geese, rabbits): each wandering a little way at a time round the
 *  herd's middle, which drifts across the pasture; heads down to graze, up to look about; when the knight comes,
 *  those near him make off together and settle again further on. */
export class Grazers {
  herds: HerdLike[] = [];
  private all: Beast[] = [];
  private cx: number;
  private cz: number;
  private drift = 10;
  private spookT = 0;
  constructor(private def: GrazeDef, private land: Land, private r: Rng) {
    this.cx = def.x;
    this.cz = def.z;
    def.kinds.forEach((kind, k) => {
      const n = Math.max(1, Math.round(kind.n * (k ? 1 : FEW)));
      this.herds.push(kind.src(n, kind.tint));
      for (let i = 0; i < n; i++) {
        const b = new Beast(k, i, kind.size * (0.9 + r() * 0.2));
        const at = this.spot(def.x, def.z, def.r * 0.8) ?? { x: def.x, z: def.z };
        b.x = b.tx = at.x;
        b.z = b.tz = at.z;
        b.y = land.ground(b.x, b.z);
        b.yaw = r() * Math.PI * 2;
        b.t = r() * 5;
        b.pose = def.way === 'beast' && r() < 0.6 ? 1 : 0;
        this.all.push(b);
        this.draw(b);
      }
    });
    for (const h of this.herds) h.flush();
  }
  count(x: number, z: number, r: number) {
    return this.herds[0].mesh.visible ? this.all.filter((b) => Math.hypot(b.x - x, b.z - z) < r).length : 0;
  }
  private ok(x: number, z: number) {
    return this.land.dry(x, z) && (this.def.keep?.(x, z) ?? true) && this.land.open(x, z, 0.4);
  }
  private spot(x: number, z: number, r: number, awayX?: number, awayZ?: number, dist = 0) {
    for (let k = 0; k < 14; k++) {
      let px: number, pz: number;
      if (awayX !== undefined && awayZ !== undefined && k < 10) {
        const a = Math.atan2(z - awayZ, x - awayX) + (this.r() - 0.5) * (0.8 + k * 0.15);
        px = x + Math.cos(a) * dist * (0.7 + this.r() * 0.5);
        pz = z + Math.sin(a) * dist * (0.7 + this.r() * 0.5);
      } else {
        const a = this.r() * Math.PI * 2, d = r * Math.sqrt(this.r());
        px = x + Math.cos(a) * d;
        pz = z + Math.sin(a) * d;
      }
      if (Math.hypot(px - this.def.x, pz - this.def.z) > this.def.r * 1.3) continue;
      if (this.ok(px, pz)) return { x: px, z: pz };
    }
    return null;
  }

  update(dt: number, g: Game) {
    const d = this.def, on = near(g, this.cx, this.cz, RANGE + d.r);
    for (const h of this.herds) h.mesh.visible = on;
    if (!on || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    const p = g.player;
    // The herd's middle wanders across its pasture.
    this.drift -= dt;
    if (this.drift <= 0) {
      this.drift = 18 + this.r() * 20;
      const to = this.spot(d.x, d.z, d.r * 0.55);
      if (to) {
        this.cx = to.x;
        this.cz = to.z;
      }
    }
    // The knight comes at them: those near him make off together.
    let spooked = false;
    this.spookT -= dt;
    for (const b of this.all) if (b.state !== 'flee' && Math.hypot(p.x - b.x, p.z - b.z) < d.scare && Math.abs(p.y - b.y) < 3) spooked = this.spookT <= 0;
    if (spooked) {
      this.spookT = 1.2;
      let off = 0;
      const away = d.flee ?? 7;
      for (const b of this.all) {
        if (Math.hypot(p.x - b.x, p.z - b.z) > d.scare * 2) continue;
        const to = this.spot(b.x, b.z, 0, p.x, p.z, away);
        if (!to) continue;
        b.state = 'flee';
        b.tx = to.x;
        b.tz = to.z;
        b.t = 5;
        off++;
      }
      if (off) g.audio.sfx('rustle', p.x, p.z);
    }
    for (const b of this.all) {
      b.t -= dt;
      if (b.state !== 'flee' && b.t <= 0) {
        const u = this.r();
        if (u < 0.35) {
          const to = this.spot(this.cx, this.cz, d.r * 0.5);
          if (to) {
            b.state = 'walk';
            b.tx = to.x;
            b.tz = to.z;
            b.t = 10;
          }
        } else if (u < 0.8 && d.way !== 'hopper') {
          b.state = 'graze';
          b.t = 3 + this.r() * 6;
        } else {
          b.state = 'idle';
          b.t = 1.5 + this.r() * 3;
        }
      }
      let speed = 0;
      if (b.state === 'walk' || b.state === 'flee') {
        const dx = b.tx - b.x, dz = b.tz - b.z, dist = Math.hypot(dx, dz);
        if (dist < 0.2 || b.t <= 0) {
          b.state = b.state === 'flee' ? 'idle' : 'graze';
          b.t = b.state === 'idle' ? 2 + this.r() * 2 : 2 + this.r() * 5;
        } else {
          speed = b.state === 'flee' ? d.run : d.walk;
          b.yaw = angleLerp(b.yaw, Math.atan2(dx, dz), Math.min(1, dt * (b.state === 'flee' ? 8 : 4)));
          const v = Math.min(dist, speed * dt), body = { x: b.x, y: b.y, z: b.z, r: 0.3 * b.size };
          g.grid.move(body, (dx / dist) * v, (dz / dist) * v, 0.4, true);
          if (this.land.dry(body.x, body.z, 0.8) && (d.keep?.(body.x, body.z) ?? true)) {
            b.x = body.x;
            b.z = body.z;
          } else {
            b.state = 'idle';
            b.t = 1;
          }
        }
      }
      b.y = this.land.ground(b.x, b.z);
      if (d.way === 'beast') {
        b.pose = damp(b.pose, b.state === 'graze' ? 1 : 0, 3, dt);
        if (speed > 0) b.ph += (dt * speed * 7) / b.size;
        else b.ph = damp(b.ph, Math.round(b.ph / Math.PI) * Math.PI, 6, dt);
      } else if (d.way === 'bird') {
        b.pose = damp(b.pose, b.state === 'flee' ? 1 : 0, 8, dt);
        if (b.state === 'flee') b.ph += dt * 16;
        b.roll = speed > 0 ? Math.sin(g.time * 9 + b.i) * 0.14 : damp(b.roll, 0, 6, dt);
        b.hop = b.state === 'graze' ? 0.5 : 0;
      } else {
        if (speed > 0) b.ph += dt * (b.state === 'flee' ? 13 : 8);
        else b.ph = damp(b.ph, Math.ceil(b.ph / Math.PI) * Math.PI, 10, dt);
        const s = Math.abs(Math.sin(b.ph));
        b.y += s * 0.3 * b.size;
        b.pose = s;
      }
      this.draw(b);
    }
    for (const h of this.herds) h.flush();
  }
  private draw(b: Beast) {
    const h = this.herds[b.k];
    h.phase[b.i] = b.ph;
    h.pose[b.i] = b.pose;
    // (A goose stoops to crop the grass; a beast's head does that in its bend.)
    h.set(b.i, b.x, b.y, b.z, b.yaw, this.def.way === 'bird' ? b.hop * 0.9 : 0, b.roll, b.size);
  }
}

// ---------- frogs ----------

export interface FrogDef {
  /** Their pads: on still water near a bank. */
  spots: { x: number; z: number }[];
  size: number;
  padSize?: number;
  tint?: (i: number) => Col;
}

/** Frogs sitting on their lily pads (the pads float there, frog or no frog), throats going; off with a plop into
 *  the water when the knight comes near, back up on their pads once he's gone. */
export class Frogs {
  herd: HerdLike;
  private all: { hx: number; hz: number; x: number; y: number; z: number; yaw: number; state: 'sit' | 'leap' | 'gone'; t: number; fx: number; fz: number; tx: number; tz: number; seed: number }[] = [];
  constructor(private def: FrogDef, src: Source, private land: Land, r: Rng) {
    // (The frogs and their pads one mesh, from joined(): the frogs first, the pads after them.)
    const spots = def.spots.slice(0, Math.max(2, Math.round(def.spots.length * FEW))), n = spots.length;
    this.herd = src(n * 2, (i) => (i < n ? (def.tint?.(i) ?? '#ffffff') : (i - n) % 3 ? '#ffffff' : '#e0f0d0'));
    spots.forEach((s, i) => {
      const y = land.water(s.x, s.z) === NONE ? land.ground(s.x, s.z) : land.water(s.x, s.z);
      const f = { hx: s.x, hz: s.z, x: s.x, y: y + 0.02, z: s.z, yaw: r() * Math.PI * 2, state: 'sit' as const, t: 0, fx: 0, fz: 0, tx: 0, tz: 0, seed: r() * 9 };
      this.all.push(f);
      this.herd.pose[n + i] = -1;
      this.herd.set(n + i, s.x, y + 0.01, s.z, r() * Math.PI * 2, 0, 0, (def.padSize ?? 1) * (0.8 + r() * 0.4));
      this.herd.set(i, f.x, f.y, f.z, f.yaw, 0, 0, def.size);
    });
    this.herd.flush();
  }
  count(x: number, z: number, r: number) {
    return this.herd.mesh.visible ? this.all.filter((f) => f.state !== 'gone' && Math.hypot(f.x - x, f.z - z) < r).length : 0;
  }
  update(dt: number, g: Game) {
    const f0 = g.cam.focus, on = this.all.some((f) => Math.hypot(f.hx - f0.x, f.hz - f0.z) < RANGE);
    this.herd.mesh.visible = on;
    if (!on || dt <= 0) return;
    const p = g.player;
    this.all.forEach((f, i) => {
      f.t -= dt;
      const pd = Math.hypot(p.x - f.x, p.z - f.z);
      const surf = (x: number, z: number) => (this.land.water(x, z) === NONE ? this.land.ground(x, z) : this.land.water(x, z));
      let pose = 0, hide = false;
      if (f.state === 'sit') {
        if (pd < 3.4) {
          // Off the pad, away from the knight, into the water.
          const a = Math.atan2(f.z - p.z, f.x - p.x) + (Math.random() - 0.5) * 0.8;
          f.state = 'leap';
          f.t = 0;
          f.fx = f.x;
          f.fz = f.z;
          f.tx = f.x + Math.cos(a) * 1.3;
          f.tz = f.z + Math.sin(a) * 1.3;
          f.yaw = Math.atan2(f.tx - f.x, f.tz - f.z);
        } else if (Math.random() < dt * 0.05) f.yaw += (Math.random() - 0.5) * 1.2;
        // The throat going: a little swell and settle.
        this.herd.phase[i] = 0;
        f.y = surf(f.hx, f.hz) + 0.02 + Math.max(0, Math.sin(g.time * 3 + f.seed)) * 0.004;
      } else if (f.state === 'leap') {
        f.t += dt;
        const k = Math.min(1, f.t / 0.42);
        f.x = f.fx + (f.tx - f.fx) * k;
        f.z = f.fz + (f.tz - f.fz) * k;
        f.y = surf(f.hx, f.hz) + 0.02 + Math.sin(k * Math.PI) * 0.45 - k * 0.15;
        pose = 1;
        if (k >= 1) {
          splash(g, f.x, surf(f.x, f.z), f.z, 0.5);
          if (pd < 14) g.audio.sfx('splash', f.x, f.z);
          f.state = 'gone';
          f.t = 7 + Math.random() * 9;
        }
      } else {
        hide = true;
        if (f.t <= 0 && pd > 7) {
          // Back up on its pad, a ripple where it climbs out.
          f.state = 'sit';
          f.x = f.hx;
          f.z = f.hz;
          ring(g, f.x, surf(f.x, f.z), f.z, 8, 0.5);
        }
      }
      this.herd.pose[i] = pose;
      this.herd.set(i, f.x, f.y, f.z, f.yaw, f.state === 'leap' ? -0.4 : 0, 0, hide ? 0.0001 : this.def.size);
    });
    this.herd.flush();
  }
}

// ---------- fish in fresh water ----------

export interface FishDef {
  n: number;
  size: number;
  x: number;
  z: number;
  r: number;
  /** How far under the surface they swim (a carp basking with its back out: about its own height). */
  sink: number;
  /** Trout: holding against the current, facing up it (the way the water comes from). */
  upstream?: (x: number, z: number) => [number, number];
  speed?: number;
  tint?: (i: number) => Col;
}

/** Fish at the top of the water: carp cruising slowly with their backs out, turning away when the knight comes;
 *  trout holding in the current, slipping sideways to take something off the surface (a ring), darting off. */
export class Fishes {
  herd: HerdLike;
  private all: { x: number; z: number; y: number; yaw: number; tx: number; tz: number; t: number; scare: number; sp: number; size: number; dive: number }[] = [];
  constructor(private def: FishDef, src: Source, private land: Land, private r: Rng) {
    const n = Math.max(1, Math.round(def.n * FEW));
    this.herd = src(n, def.tint);
    for (let i = 0; i < n; i++) {
      const at = this.spot(def.x, def.z, def.r) ?? { x: def.x, z: def.z };
      const f = { x: at.x, z: at.z, y: 0, yaw: r() * 6.3, tx: at.x, tz: at.z, t: r() * 4, scare: 0, sp: 0, size: def.size * (0.8 + r() * 0.4), dive: 0 };
      f.y = this.top(f.x, f.z) - def.sink * f.size;
      this.all.push(f);
      this.herd.setFast(i, f.x, f.y, f.z, f.yaw, 0, f.size);
    }
    this.herd.flush();
  }
  count(x: number, z: number, r: number) {
    return this.herd.mesh.visible ? this.all.filter((f) => Math.hypot(f.x - x, f.z - z) < r).length : 0;
  }
  private top(x: number, z: number) {
    const w = this.land.water(x, z);
    return w === NONE ? this.land.ground(x, z) : w;
  }
  private spot(x: number, z: number, r: number, awayX?: number, awayZ?: number) {
    for (let k = 0; k < 14; k++) {
      let a = this.r() * Math.PI * 2;
      if (awayX !== undefined && awayZ !== undefined && k < 9) a = Math.atan2(z - awayZ, x - awayX) + (this.r() - 0.5) * 1.4;
      const d = r * Math.sqrt(this.r()), px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      if (Math.hypot(px - this.def.x, pz - this.def.z) <= this.def.r * 1.2 && this.land.wet(px, pz, 0.35)) return { x: px, z: pz };
    }
    return null;
  }
  update(dt: number, g: Game) {
    const d = this.def, on = near(g, d.x, d.z, RANGE + d.r);
    this.herd.mesh.visible = on;
    if (!on || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    const p = g.player;
    this.all.forEach((f, i) => {
      f.t -= dt;
      f.scare -= dt;
      if (f.scare <= 0 && Math.hypot(p.x - f.x, p.z - f.z) < 3) {
        f.scare = 3;
        const to = this.spot(f.x, f.z, 5, p.x, p.z);
        if (to) {
          f.tx = to.x;
          f.tz = to.z;
        }
        f.dive = 1;
      }
      if (f.t <= 0 && f.scare <= 0) {
        const to = d.upstream ? this.spot(f.x, f.z, 1.2) : this.spot(f.x, f.z, 4);
        if (to) {
          f.tx = to.x;
          f.tz = to.z;
        }
        f.t = d.upstream ? 2 + this.r() * 4 : 4 + this.r() * 6;
        f.dive = Math.max(0, f.dive - 0.5);
        // A trout takes something off the surface: a ring where it was.
        if (d.upstream && this.r() < 0.5) ring(g, f.x, this.top(f.x, f.z), f.z, 10, 0.6);
      }
      const dx = f.tx - f.x, dz = f.tz - f.z, dist = Math.hypot(dx, dz);
      const want = f.scare > 0 ? 2.6 : dist > 0.15 ? (d.speed ?? 0.4) : 0;
      f.sp = damp(f.sp, want, 3, dt);
      let face = dist > 0.15 ? Math.atan2(dx, dz) : f.yaw;
      if (d.upstream && f.scare <= 0) {
        const [ux, uz] = d.upstream(f.x, f.z);
        face = Math.atan2(ux, uz);
      }
      f.yaw = angleLerp(f.yaw, face, Math.min(1, dt * 3));
      if (dist > 0.05) {
        const v = Math.min(dist, f.sp * dt), nx = f.x + (dx / dist) * v, nz = f.z + (dz / dist) * v;
        if (this.land.wet(nx, nz, 0.3)) {
          f.x = nx;
          f.z = nz;
        } else f.tx = f.x;
      }
      f.y = damp(f.y, this.top(f.x, f.z) - d.sink * f.size - f.dive * 0.5, 3, dt);
      this.herd.phase[i] += dt * (2.5 + f.sp * 8);
      this.herd.setFast(i, f.x, f.y, f.z, f.yaw, 0, f.size);
    });
    this.herd.flush();
  }
}

/** Fish rising: every few seconds, somewhere on the water in view, a ring spreading where one took a fly off the
 *  surface; now and then one leaps clear and falls back with a splash. */
export class Risers {
  herd: HerdLike;
  private t = 2;
  private jumps: { t: number; dur: number; x0: number; z0: number; x1: number; z1: number; h: number; y: number }[] = [];
  constructor(private where: (x: number, z: number) => boolean, src: Source, private size: number, private land: Land, private every = 2.5) {
    this.herd = src(2);
    for (let i = 0; i < 2; i++) {
      this.jumps.push({ t: -1, dur: 1, x0: 0, z0: 0, x1: 0, z1: 0, h: 1, y: 0 });
      this.herd.setFast(i, 0, -50, 0, 0, 0, 0.0001);
    }
    this.herd.flush();
    this.herd.mesh.visible = false;
  }
  update(dt: number, g: Game) {
    if (dt <= 0) return;
    const f = g.cam.focus;
    this.t -= dt;
    if (this.t <= 0) {
      this.t = this.every * (0.4 + Math.random() * 1.2);
      for (let k = 0; k < 10; k++) {
        const x = f.x + (Math.random() - 0.5) * 34, z = f.z + (Math.random() - 0.5) * 34;
        if (!this.where(x, z) || !this.land.wet(x, z, 0.4)) continue;
        const y = this.land.water(x, z);
        ring(g, x, y, z, 14, 0.85);
        const j = this.jumps.find((q) => q.t < 0);
        if (j && Math.random() < 0.35) {
          const a = Math.random() * Math.PI * 2, L = 1 + Math.random() * 0.8, x1 = x + Math.cos(a) * L, z1 = z + Math.sin(a) * L;
          if (this.land.wet(x1, z1, 0.3)) Object.assign(j, { t: 0, dur: 0.6 + Math.random() * 0.25, x0: x, z0: z, x1, z1, h: 0.5 + Math.random() * 0.4, y });
          g.fx.burst(DROPS, x, y + 0.05, z, 6, 0.8, 2);
        }
        break;
      }
    }
    let any = false;
    this.jumps.forEach((j, i) => {
      if (j.t < 0) return;
      j.t += dt;
      const k = j.t / j.dur;
      if (k >= 1) {
        j.t = -1;
        splash(g, j.x1, j.y, j.z1, 0.7);
        if (Math.hypot(g.player.x - j.x1, g.player.z - j.z1) < 16) g.audio.sfx('splash', j.x1, j.z1);
        this.herd.setFast(i, 0, -50, 0, 0, 0, 0.0001);
        return;
      }
      any = true;
      const x = j.x0 + (j.x1 - j.x0) * k, z = j.z0 + (j.z1 - j.z0) * k, y = j.y - 0.15 + 4 * j.h * k * (1 - k);
      const slope = (4 * j.h * (1 - 2 * k)) / Math.hypot(j.x1 - j.x0, j.z1 - j.z0);
      this.herd.phase[i] += dt * 30;
      this.herd.setFast(i, x, y, z, Math.atan2(j.x1 - j.x0, j.z1 - j.z0), -Math.atan(slope), this.size);
    });
    this.herd.mesh.visible = any;
    if (any) this.herd.flush();
  }
}

// ---------- a wader ----------

/** A heron in the shallows: standing still as a post on its long legs, now and then a slow step and a stab at the
 *  water; up on great slow wingbeats when the knight comes near, legs trailing, off to another of its spots. */
export class Wader {
  herd: HerdLike;
  private x: number;
  private y: number;
  private z: number;
  private yaw: number;
  private pitch = 0;
  private state: 'stand' | 'stab' | 'fly' = 'stand';
  private t = 3;
  private open = 0;
  private ph = 0;
  private spot: number;
  private from = { x: 0, y: 0, z: 0 };
  private to = { x: 0, y: 0, z: 0 };
  constructor(private spots: { x: number; z: number; face?: number }[], src: Source, private size: number, private land: Land, private r: Rng) {
    this.herd = src(1);
    this.spot = Math.floor(r() * spots.length);
    const s = spots[this.spot];
    this.x = s.x;
    this.z = s.z;
    this.y = this.foot(s.x, s.z);
    this.yaw = s.face ?? r() * 6.3;
    this.draw();
  }
  count(x: number, z: number, r: number) {
    return this.herd.mesh.visible && Math.hypot(this.x - x, this.z - z) < r ? 1 : 0;
  }
  /** Where its feet are: on the bed of the shallows, the water up its legs (no deeper than its knees), or on the ground. */
  private foot(x: number, z: number) {
    const w = this.land.water(x, z);
    return w === NONE ? this.land.ground(x, z) : Math.max(this.land.ground(x, z), w - 0.3 * this.size);
  }
  update(dt: number, g: Game) {
    const on = near(g, this.x, this.z, RANGE);
    this.herd.mesh.visible = on;
    if (!on || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    const p = g.player;
    this.t -= dt;
    if (this.state !== 'fly' && Math.hypot(p.x - this.x, p.z - this.z) < 7.5 && Math.abs(p.y - this.y) < 3) {
      // Away to whichever of its spots lies furthest from the knight.
      let best = this.spot, far = -1;
      this.spots.forEach((s, k) => {
        const d = Math.hypot(s.x - p.x, s.z - p.z);
        if (k !== this.spot && d > far) (far = d), (best = k);
      });
      this.spot = best;
      const s = this.spots[best];
      this.state = 'fly';
      this.t = 0;
      this.from = { x: this.x, y: this.y, z: this.z };
      this.to = { x: s.x, y: this.foot(s.x, s.z), z: s.z };
      g.audio.sfx('rustle', this.x, this.z);
    }
    if (this.state === 'fly') {
      const L = Math.hypot(this.to.x - this.from.x, this.to.z - this.from.z), dur = Math.max(2.5, L / 4.5);
      this.t += dt;
      const k = Math.min(1, this.t / dur), e = k * k * (3 - 2 * k);
      this.x = this.from.x + (this.to.x - this.from.x) * e;
      this.z = this.from.z + (this.to.z - this.from.z) * e;
      this.y = this.from.y + (this.to.y - this.from.y) * e + Math.sin(k * Math.PI) * Math.min(6, 2 + L * 0.15);
      this.yaw = angleLerp(this.yaw, Math.atan2(this.to.x - this.from.x, this.to.z - this.from.z), Math.min(1, dt * 4));
      this.open = damp(this.open, k < 0.92 ? 1 : 0, 6, dt);
      this.ph += dt * 6.5;
      this.pitch = damp(this.pitch, -0.15, 4, dt);
      if (k >= 1) {
        this.state = 'stand';
        this.t = 4 + this.r() * 4;
        this.yaw = this.spots[this.spot].face ?? this.yaw;
      }
    } else if (this.state === 'stab') {
      // A stab at the water: the body tips forward and comes up again.
      const k = 1 - this.t / 0.7;
      this.pitch = Math.sin(clamp(k, 0, 1) * Math.PI) * 0.75;
      if (k > 0.45 && k < 0.5 && this.land.water(this.x, this.z) !== NONE) ring(g, this.x + Math.sin(this.yaw) * 0.9 * this.size, this.land.water(this.x, this.z), this.z + Math.cos(this.yaw) * 0.9 * this.size, 8, 0.5);
      if (this.t <= 0) {
        this.state = 'stand';
        this.t = 3 + this.r() * 6;
      }
    } else {
      this.open = damp(this.open, 0, 6, dt);
      this.pitch = damp(this.pitch, 0, 4, dt);
      if (this.t <= 0) {
        if (this.r() < 0.6) {
          this.state = 'stab';
          this.t = 0.7;
        } else {
          // A slow step or two along the shallows, and a turn.
          const a = this.yaw + (this.r() - 0.5) * 1.2, nx = this.x + Math.sin(a) * 0.6, nz = this.z + Math.cos(a) * 0.6;
          if (Math.hypot(nx - this.spots[this.spot].x, nz - this.spots[this.spot].z) < 2.5 && Math.abs(this.foot(nx, nz) - this.y) < 0.6) {
            this.x = nx;
            this.z = nz;
            this.y = this.foot(nx, nz);
          }
          this.yaw = a;
          this.t = 2 + this.r() * 5;
        }
      }
    }
    this.draw();
  }
  private draw() {
    this.herd.phase[0] = this.ph;
    this.herd.pose[0] = this.open;
    this.herd.set(0, this.x, this.y, this.z, this.yaw, this.pitch, 0, this.size);
    this.herd.flush();
  }
}

// ---------- a shy beast ----------

export interface ShyDef {
  /** Where it may be found (one of them, when it's about at all). */
  spots: { x: number; z: number }[];
  size: number;
  /** The chance it's about when the knight comes near one of its spots. */
  chance: number;
  scare: number;
  run: number;
  /** A badger: off to its sett when startled, and gone into it; else it bolts and is lost among the trees. */
  den?: { x: number; z: number };
}

/** One shy beast, seen rarely: grazing (or snuffling) at one of its spots; when the knight comes near it lifts
 *  its head, then bolts (to its den, or away into the trees) and is gone, to be about somewhere else much later. */
export class Shy {
  herd: HerdLike;
  private x = 0;
  private y = 0;
  private z = 0;
  private yaw = 0;
  private state: 'away' | 'graze' | 'alert' | 'bolt' = 'away';
  private t = 0;
  private ph = 0;
  private pose = 0;
  private fade = 0;
  private tx = 0;
  private tz = 0;
  constructor(private def: ShyDef, src: Source, private land: Land, private r: Rng) {
    this.herd = src(1);
    this.herd.set(0, 0, -50, 0, 0, 0, 0, 0.0001);
    this.herd.flush();
    this.herd.mesh.visible = false;
  }
  count(x: number, z: number, r: number) {
    return this.state !== 'away' && Math.hypot(this.x - x, this.z - z) < r ? 1 : 0;
  }
  /** Out at the spot nearest (x, z) now (the realm's tests and the debug keys). */
  show(x: number, z: number) {
    let best = this.def.spots[0];
    for (const s of this.def.spots) if (Math.hypot(s.x - x, s.z - z) < Math.hypot(best.x - x, best.z - z)) best = s;
    this.appear(best.x, best.z);
  }
  private appear(x: number, z: number) {
    this.x = x;
    this.z = z;
    this.y = this.land.ground(x, z);
    this.yaw = this.r() * Math.PI * 2;
    this.state = 'graze';
    this.t = 3;
    this.fade = 1;
  }
  update(dt: number, g: Game) {
    if (dt <= 0) return;
    dt = Math.min(dt, 0.1);
    const p = g.player, d = this.def;
    if (this.state === 'away') {
      // Now and then, at a spot the knight is coming toward but can't yet see, it may be about.
      this.t -= dt;
      if (this.t > 0) return;
      this.t = 6;
      for (const s of d.spots) {
        const pd = Math.hypot(s.x - p.x, s.z - p.z);
        if (pd > 24 && pd < 34 && this.r() < d.chance) {
          this.appear(s.x, s.z);
          break;
        }
      }
      if (this.state === 'away') return;
    }
    const pd = Math.hypot(p.x - this.x, p.z - this.z);
    this.t -= dt;
    let speed = 0;
    if (this.state === 'graze') {
      this.pose = damp(this.pose, Math.sin(g.time * 0.4) > -0.3 ? 1 : 0, 2, dt);
      this.yaw += Math.sin(g.time * 0.2) * dt * 0.2;
      if (pd < d.scare) {
        this.state = 'alert';
        this.t = d.den ? 0.4 : 0.9;
        this.yaw = angleLerp(this.yaw, Math.atan2(p.x - this.x, p.z - this.z), 0.6);
      } else if (pd > 60) {
        this.state = 'away';
        this.t = 20;
      }
    } else if (this.state === 'alert') {
      this.pose = damp(this.pose, 0, 8, dt);
      if (this.t <= 0) {
        this.state = 'bolt';
        this.t = d.den ? 6 : 3;
        g.audio.sfx('rustle', this.x, this.z);
        if (d.den) {
          this.tx = d.den.x;
          this.tz = d.den.z;
        } else {
          const a = Math.atan2(this.z - p.z, this.x - p.x);
          this.tx = this.x + Math.cos(a) * 30;
          this.tz = this.z + Math.sin(a) * 30;
        }
      }
    } else {
      speed = d.run;
      const dx = this.tx - this.x, dz = this.tz - this.z, dist = Math.hypot(dx, dz);
      this.yaw = angleLerp(this.yaw, Math.atan2(dx, dz), Math.min(1, dt * 6));
      const body = { x: this.x, y: this.y, z: this.z, r: 0.3 };
      g.grid.move(body, Math.sin(this.yaw) * speed * dt, Math.cos(this.yaw) * speed * dt, 0.6, true);
      this.x = body.x;
      this.z = body.z;
      // Lost among the trees (or down into its sett): it fades out, and won't be about again for a long while.
      if (this.t < 1 || dist < 0.4) this.fade = damp(this.fade, 0, 5, dt);
      if (this.fade < 0.05 || this.t <= -1) {
        this.state = 'away';
        this.t = 50 + this.r() * 60;
        this.herd.mesh.visible = false;
        return;
      }
    }
    this.y = this.land.ground(this.x, this.z);
    if (speed > 0) this.ph += (dt * speed * 6) / d.size;
    this.herd.phase[0] = this.ph;
    this.herd.pose[0] = this.pose;
    this.herd.mesh.visible = near(g, this.x, this.z, RANGE);
    this.herd.set(0, this.x, this.y, this.z, this.yaw, 0, 0, d.size * this.fade);
    this.herd.flush();
  }
}

// ---------- motes in the air ----------

/** A kind of mote drifting in the air near the camera: where it's found, how many a second, how high. */
export interface Drift {
  spec: PSpec;
  /** How many a second, over the whole view. */
  rate: number;
  where: (x: number, z: number) => boolean;
  /** Height over the ground (or the water) it starts at. */
  y0: number;
  y1: number;
  /** Over water only (midges, mist), or anywhere. */
  water?: boolean;
  vel?: V3;
  /** Only at night (fading out with the dawn). */
  night?: boolean;
  /** Clumped by a patch noise (above this many the patch is thick). */
  patch?: number;
}

/** The motes, moths at the lamps, everything that hangs in the air near the camera. */
export class Motes {
  private acc: number[];
  private lamps: { x: number; y: number; z: number }[] = [];
  private lampT = 0;
  private lampAcc = 0;
  constructor(private list: Drift[], private land: Land, private moth?: PSpec) {
    this.acc = list.map(() => Math.random());
  }
  update(dt: number, g: Game) {
    if (dt <= 0) return;
    const f = g.cam.focus, k = MOBILE ? 0.5 : 1;
    this.list.forEach((d, i) => {
      this.acc[i] += dt * d.rate * k * (d.night ? 1 - g.dawn * 0.9 : 1);
      for (let n = 0; this.acc[i] >= 1 && n < 30; n++) {
        this.acc[i] -= 1;
        const x = f.x + (Math.random() - 0.5) * 36, z = f.z + (Math.random() - 0.5) * 36;
        if (!d.where(x, z)) continue;
        if (d.patch !== undefined && fbm(x * 0.09 + 11, z * 0.09, 2, 77) < d.patch) continue;
        const w = this.land.water(x, z);
        if (d.water ? w === NONE : false) continue;
        const base = w !== NONE ? w : this.land.ground(x, z), v = d.vel ?? [0, 0, 0];
        g.fx.emit(d.spec, x, base + d.y0 + Math.random() * (d.y1 - d.y0), z, v[0] * (0.6 + Math.random() * 0.8), v[1], v[2] * (0.6 + Math.random() * 0.8), 0.7 + Math.random() * 0.6);
      }
      if (this.acc[i] > 1) this.acc[i] = 0;
    });
    // Moths at every lamp near the camera: the warm lights low over the ground (the lamps on their posts, the
    // lanterns, the lit windows).
    if (!this.moth) return;
    this.lampT -= dt;
    if (this.lampT <= 0) {
      this.lampT = 1;
      this.lamps = g.lights.sources
        .filter((s) => s.on && s.level > 0.5 && s.color.r > s.color.b * 1.5 && Math.abs(s.x - f.x) + Math.abs(s.z - f.z) < 30 && s.y - this.land.ground(s.x, s.z) < 5)
        .map((s) => ({ x: s.x, y: s.y, z: s.z }));
    }
    if (!this.lamps.length) return;
    this.lampAcc += dt * this.lamps.length * 1.4 * k * (1 - g.dawn * 0.9);
    for (; this.lampAcc >= 1; this.lampAcc--) {
      const l = this.lamps[Math.floor(Math.random() * this.lamps.length)], a = Math.random() * Math.PI * 2, rr = 0.25 + Math.random() * 0.6;
      g.fx.emit(this.moth, l.x + Math.cos(a) * rr, l.y - 0.2 + Math.random() * 0.7, l.z + Math.sin(a) * rr, 0, 0, 0, 0.5 + Math.random() * 0.5);
    }
  }
}

/** Anything of the life that is told to move each frame and can say how many of it are near a place. */
export interface Living {
  update(dt: number, g: Game): void;
  count?(x: number, z: number, r: number): number;
}

/** A realm's life put together: its groups, moved each frame (from the realm's story) and counted for the checks. */
export class Wildlife {
  protected all: Living[] = [];
  protected kinds: Kind[] = [];
  protected land!: Land;
  built = false;
  /** The realm's creatures that bend one way, drawn in one instanced mesh of up to cap bodies: a source for each
   *  body (each kind), its groups taking their share. */
  protected kind(g: Game, bend: Bend, self: number, cap: number, ...geos: THREE.BufferGeometry[]) {
    const k = new Kind(geos, bend, self, cap, g);
    this.kinds.push(k);
    return geos.map((_, i) => k.part(i));
  }
  /** How many creatures (of every kind) are within r of (x, z) and drawn. */
  count(x: number, z: number, r: number) {
    let n = 0;
    for (const l of this.all) n += l.count?.(x, z, r) ?? 0;
    return n;
  }
  update(g: Game, dt: number) {
    if (!this.built) return;
    NIGHT.value = 1 - g.dawn * 0.85;
    for (const l of this.all) l.update(dt, g);
    for (const k of this.kinds) k.sync();
  }
}
