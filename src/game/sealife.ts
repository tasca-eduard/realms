import * as THREE from 'three';
import { MOBILE } from '../config';
import { Geo, type Col } from '../engine/geo';
import type { PSpec } from '../engine/particles';
import { angleLerp, clamp, damp, fbm, mulberry32, type Rng } from '../engine/util';
import { NONE, T } from '../world/grid';
import type { Game } from './game';

// ---------------------------------------------------------------------------
// The Sunken Reef's harmless life, so that the sea is alive wherever the knight dives (none of it fights, none
// of it stands in his way): schools of small fish that wheel about their patch and scatter when he swims at
// them (bright reef fish over the coral gardens, silver shoals in the kelp, dark lantern-fish with glowing
// spots round the drowned kingdom's columns and towers, snappers round the wreck, fry in the shallows);
// rays gliding low over the sand; sea turtles cruising long rounds, up to the surface now and then for a
// breath; octopuses in the kingdom's ruins changing colour, jetting off in a puff of ink when he comes close;
// small crabs scuttling sideways in the shallows; jellyfish drifting under the surface, glowing at night;
// motes of plankton glowing in the dark of the deep (brightest in his wake). What lies on the floor and
// doesn't move is src/world/seabed.ts.
// Cheap enough for phones: each group is one instanced mesh (one draw), bent in its vertex shader (fish wag,
// wings and flippers flap, bells pulse, arms curl, legs scuttle), and only the groups near the camera move
// or draw.
// ---------------------------------------------------------------------------

type V3 = [number, number, number];

/** How far from the camera's focus things still move and draw. */
const RANGE = MOBILE ? 30 : 38;
/** Fewer of everything on a phone. */
const FEW = MOBILE ? 0.55 : 1;

/** How much the glowing parts glow: all night, less once dawn comes. */
const NIGHT = { value: 1 };

/** How each kind of body bends in its own space (aWind: how much a vertex bends; aPhase: its stroke, run on
 *  by how hard it swims). */
const BEND = {
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
};
type Bend = keyof typeof BEND;

/** Lambert with the bend, a little light of its own (so the sea's creatures read through dark water) and
 *  the glowing parts (aKind 1) lit from inside at night. */
function lifeMaterial(bend: Bend, self: number) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = NIGHT;
    sh.uniforms.uSelf = { value: self };
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float aKind; attribute float aWind; attribute float aPhase;
         varying float vGlow;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vGlow = aKind;
         ${BEND[bend]}`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uNight; uniform float uSelf; varying float vGlow;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * (uSelf + vGlow * uNight);`);
  };
  mat.customProgramCacheKey = () => 'sealife-' + bend;
  return mat;
}

/** A Geo built into a body, each vertex's bend weight worked out from where it lies (and the weight its shape
 *  was drawn with, as a mask). */
function body(g: Geo, weight: (x: number, y: number, z: number, mask: number) => number) {
  const geo = g.build();
  const p = geo.getAttribute('position'), w = geo.getAttribute('aWind');
  for (let i = 0; i < p.count; i++) w.setX(i, weight(p.getX(i), p.getY(i), p.getZ(i), w.getX(i)));
  return geo;
}

/** A triangle seen from both sides (fins, flippers, wings). */
function both(g: Geo, a: V3, b: V3, c: V3, col: Col, kind = 0, wind = 0) {
  g.tri(a, b, c, col, { kind, wind });
  g.tri(a, c, b, col, { kind, wind });
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

/** One group of creatures: an instanced mesh of `n` bodies with a stroke each (its own copy of the shared
 *  body's attributes, so that each group strokes on its own). */
class Herd {
  mesh: THREE.InstancedMesh;
  phase: Float32Array;
  private phaseAttr: THREE.InstancedBufferAttribute;
  /** How far a body reaches from its middle (at size 1). */
  private reach: number;
  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, n: number, g: Game, tint: (i: number) => Col = () => '#ffffff') {
    const own = new THREE.BufferGeometry();
    for (const k of Object.keys(geo.attributes)) own.setAttribute(k, geo.attributes[k]);
    this.phase = new Float32Array(n);
    for (let i = 0; i < n; i++) this.phase[i] = Math.random() * 6.3;
    this.phaseAttr = new THREE.InstancedBufferAttribute(this.phase, 1).setUsage(THREE.DynamicDrawUsage);
    own.setAttribute('aPhase', this.phaseAttr);
    this.mesh = new THREE.InstancedMesh(own, mat, n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // (Drawn only when some of its bodies are in view: see flush.)
    own.computeBoundingSphere();
    this.reach = own.boundingSphere!.radius + own.boundingSphere!.center.length();
    this.mesh.name = 'sealife';
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
  flush() {
    this.mesh.instanceMatrix.needsUpdate = true;
    this.phaseAttr.needsUpdate = true;
    // A sphere round all its bodies, padded by a body's reach at the largest size, so that a group out of view
    // costs no draw (a shoal, a smack of jellies; one spread over the whole realm is drawn as before).
    const e = this.mesh.instanceMatrix.array, n = this.mesh.count * 16;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity, s = 0;
    for (let o = 0; o < n; o += 16) {
      x0 = Math.min(x0, e[o + 12]);
      x1 = Math.max(x1, e[o + 12]);
      y0 = Math.min(y0, e[o + 13]);
      y1 = Math.max(y1, e[o + 13]);
      z0 = Math.min(z0, e[o + 14]);
      z1 = Math.max(z1, e[o + 14]);
      s = Math.max(s, e[o] * e[o] + e[o + 1] * e[o + 1] + e[o + 2] * e[o + 2], e[o + 4] * e[o + 4] + e[o + 5] * e[o + 5] + e[o + 6] * e[o + 6]);
    }
    if (!n) return;
    const b = (this.mesh.boundingSphere ??= new THREE.Sphere());
    b.center.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    b.radius = Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2 + this.reach * Math.sqrt(s) + 0.5;
  }
}

// ---------- the bodies ----------

interface FishLook {
  /** deep: a tall, thin reef fish; slim: a shoaling fish, long and silver. */
  shape: 'deep' | 'slim';
  body: string;
  /** Bands across the body, tail to snout ('x' in `bands`), or the back (slim). */
  alt: string;
  bands: string;
  fin: string;
  /** Glowing spots along the flanks (lantern-fish), and a glow in the eyes. */
  spots?: V3;
  eye?: V3;
}

const LOOKS = {
  // The gardens' reef fish.
  butterfly: { shape: 'deep', body: '#ffd83a', alt: '#20202a', bands: '....x.', fin: '#fff0a0' },
  tang: { shape: 'deep', body: '#3a8cff', alt: '#18204a', bands: '.x..x.', fin: '#ffd830' },
  clown: { shape: 'deep', body: '#ff7414', alt: '#fff8f0', bands: '.x..x.', fin: '#ff9a40' },
  damsel: { shape: 'deep', body: '#40c8ff', alt: '#2a80f0', bands: 'x.....', fin: '#fff060' },
  anthias: { shape: 'deep', body: '#ff5aa8', alt: '#ffa030', bands: '..x...', fin: '#ffb0d8' },
  grunt: { shape: 'deep', body: '#f8d848', alt: '#3a78e0', bands: '.x.x.x', fin: '#f8e890' },
  // The kelp's silver shoals, the wreck's snappers, the shallows' fry.
  silver: { shape: 'slim', body: '#e8f4fa', alt: '#2a5a70', bands: '', fin: '#c0d8e0' },
  snapper: { shape: 'slim', body: '#c8d4e4', alt: '#f0c030', bands: '', fin: '#f0d050' },
  fry: { shape: 'slim', body: '#e0ecd8', alt: '#7a9070', bands: '', fin: '#d0dcc8' },
  garibaldi: { shape: 'deep', body: '#ff6410', alt: '#ff8a30', bands: '', fin: '#ff7a20' },
  // The kingdom's lantern-fish and the trench's hatchet-fish: dark, glowing spots, eyes catching the light.
  lantern: { shape: 'slim', body: '#6a70b0', alt: '#30346a', bands: '', fin: '#8080c0', spots: [0.6, 2.2, 2.6], eye: [1.4, 2, 2.4] },
  hatchet: { shape: 'deep', body: '#a0b0c8', alt: '#4a5068', bands: '', fin: '#8090b0', spots: [0.7, 2.4, 4], eye: [1.6, 2.2, 2.6] },
} satisfies Record<string, FishLook>;
type FishKind = keyof typeof LOOKS;

const bodies = new Map<string, THREE.BufferGeometry>();

/** A fish a unit long, its snout at +z: a body swept tail to snout (banded), a tail fin, a fin on its back and
 *  one under it, two small fins at its sides, eyes. */
function fishBody(kind: FishKind) {
  const have = bodies.get(kind);
  if (have) return have;
  const L: FishLook = LOOKS[kind], g = new Geo(), deep = L.shape === 'deep';
  const zs = deep ? [-0.31, -0.25, -0.13, 0, 0.15, 0.3, 0.42] : [-0.3, -0.2, -0.05, 0.12, 0.3, 0.42, 0.48];
  const rs = deep ? [0.025, 0.045, 0.07, 0.085, 0.085, 0.065, 0.02] : [0.02, 0.04, 0.065, 0.075, 0.065, 0.04, 0.015];
  const sq = deep ? [1.6, 2.4, 3.2, 3.6, 3.4, 2.6, 1.4] : [1.3, 1.3, 1.35, 1.4, 1.35, 1.2, 1];
  const pts = zs.map((z): V3 => [0, 0, z]);
  g.sweep(pts, rs, (i) => (L.bands[i] === 'x' ? L.alt : L.body), { seg: 5, lumpy: 0, squash: sq });
  if (!deep) {
    // The dark back of a shoaling fish (the snapper's yellow stripe).
    g.sweep(zs.slice(1, 6).map((z, i): V3 => [0, rs[i + 1] * sq[i + 1] * 0.62, z]), rs.slice(1, 6).map((r) => r * 0.6), L.alt, { seg: 5, lumpy: 0, squash: 0.65 });
  }
  const hAt = (k: number) => rs[k] * sq[k];
  // The tail: a fan (forked on the shoaling fish).
  const tz = zs[0] + 0.01, tw = deep ? 0.21 : 0.16;
  if (deep) {
    both(g, [0, 0.04, tz], [0, tw, -0.52], [0, 0, -0.47], L.fin);
    both(g, [0, -0.04, tz], [0, 0, -0.47], [0, -tw, -0.52], L.fin);
    both(g, [0, 0.04, tz], [0, 0, -0.47], [0, -0.04, tz], L.fin);
  } else {
    both(g, [0, 0.025, tz], [0, tw, -0.5], [0, 0.01, -0.4], L.fin);
    both(g, [0, -0.025, tz], [0, -0.01, -0.4], [0, -tw, -0.5], L.fin);
  }
  // A fin along the back, a smaller one under the belly, a small one at each side behind the head.
  both(g, [0, hAt(4) * 0.9, zs[4]], [0, hAt(3) * (deep ? 1.35 : 1.6), zs[2] + 0.02], [0, hAt(2) * 0.85, zs[1]], L.fin);
  both(g, [0, -hAt(3) * 0.9, zs[3]], [0, -hAt(2) * (deep ? 1.3 : 1.4), zs[1]], [0, -hAt(1) * 0.8, zs[1] - 0.02], L.fin);
  for (const s of [-1, 1]) both(g, [s * rs[4] * 0.9, -0.01, zs[4] - 0.04], [s * (rs[4] + 0.1), -0.06, zs[3] - 0.06], [s * rs[3] * 0.9, -0.04, zs[3]], L.fin);
  // The eyes (glowing on the fish of the deep), and the lantern-fish's rows of lights.
  const ez = deep ? 0.29 : 0.38, ey = deep ? 0.07 : 0.025, ew = rs[5] * 0.85;
  for (const s of [-1, 1]) {
    g.box(s * ew, ey - 0.025, ez, 0.03, 0.05, 0.05, L.eye ?? '#0c0c12', { kind: L.eye ? 1 : 0 });
    if (L.spots)
      for (const k of [1, 3, 4]) g.box(s * rs[k] * 0.85, -hAt(k) * 0.45, zs[k], 0.04, 0.04, 0.05, L.spots, { kind: 1 });
  }
  const geo = body(g, (_x, _y, z) => Math.pow(clamp((0.2 - z) / 0.72, 0, 1), 1.3));
  bodies.set(kind, geo);
  return geo;
}

/** A ray two units across, its nose at +z: a flat diamond of wings rising to a ridge down its middle (dark
 *  above, pale beneath), spots on its back, eyes, a long thin tail. */
function rayBody(top: string, spot: string, belly: string) {
  const g = new Geo(), N = 8;
  const at = (u: number) => {
    const a = Math.abs(u);
    return { x: u, f: 0.55 - 0.6 * Math.pow(a, 0.9), b: -0.38 + 0.33 * a, m: 0.12 - 0.08 * a, y: 0.07 * (1 - a) };
  };
  for (let i = 0; i < N; i++) {
    const A = at(-1 + (i / N) * 2), B = at(-1 + ((i + 1) / N) * 2);
    // The top, from the leading edge up to the ridge and down to the trailing edge; the belly flat.
    const af: V3 = [A.x, 0, A.f], bf: V3 = [B.x, 0, B.f], am: V3 = [A.x, A.y, A.m], bm: V3 = [B.x, B.y, B.m], ab: V3 = [A.x, 0, A.b], bb: V3 = [B.x, 0, B.b];
    up(g, af, bf, bm, top);
    up(g, af, bm, am, top);
    up(g, am, bm, bb, top);
    up(g, am, bb, ab, top);
    up(g, af, ab, bb, belly, true);
    up(g, af, bb, bf, belly, true);
  }
  // Pale spots on its back, a little proud of it.
  for (const [x, z] of [[-0.45, 0.05], [0.45, 0.05], [-0.25, -0.12], [0.25, -0.12], [-0.62, -0.08], [0.62, -0.08], [0, -0.22], [-0.15, 0.2], [0.15, 0.2]] as const)
    g.box(x, 0.065 * (1 - Math.abs(x)) - 0.01, z, 0.07, 0.025, 0.07, spot);
  for (const s of [-1, 1]) g.box(s * 0.1, 0.06, 0.3, 0.05, 0.05, 0.05, '#101016');
  g.beam([0, 0.02, -0.36], [0, 0.03, -1.35], 0.018, top);
  return body(g, (x) => Math.pow(Math.abs(x), 1.3));
}

/** A triangle turned to face up (or down) whichever way its corners come. */
function up(g: Geo, a: V3, b: V3, c: V3, col: Col, down = false, kind = 0) {
  const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
  if (ny > 0 !== down) g.tri(a, b, c, col, { kind });
  else g.tri(a, c, b, col, { kind });
}

/** A sea turtle about a unit long, its head at +z: a domed shell (its plates picked out), a pale belly, a head
 *  with dark eyes, long front flippers and short hind ones (the flippers drawn with a weight, so they row). */
function turtleBody() {
  const g = new Geo();
  g.blob(0, 0.04, -0.02, 0.36, 0.15, 0.46, '#5e6a34', 5, { detail: 1, jitter: 0.04, flatBottom: true });
  // The plates: a row down the middle, a row each side.
  for (const [x, z, s] of [[0, 0.2, 0.11], [0, 0, 0.12], [0, -0.2, 0.11], [-0.17, 0.12, 0.09], [0.17, 0.12, 0.09], [-0.18, -0.12, 0.09], [0.18, -0.12, 0.09]] as const)
    g.blob(x, 0.13 - Math.abs(x) * 0.35, z, s, 0.035, s * 1.1, '#8a7a3a', 11, { detail: 0, jitter: 0.05 });
  g.box(0, -0.02, -0.02, 0.5, 0.04, 0.7, '#e0d090', { noBottom: false });
  g.blob(0, 0.04, 0.52, 0.1, 0.085, 0.13, '#9aa06a', 7, { detail: 0, jitter: 0.05 });
  for (const s of [-1, 1]) g.box(s * 0.07, 0.06, 0.58, 0.03, 0.03, 0.04, '#101010');
  // Front flippers, long and swept back; hind flippers, short.
  for (const s of [-1, 1]) {
    both(g, [s * 0.26, 0.02, 0.3], [s * 0.9, -0.02, -0.02], [s * 0.3, 0.01, 0.1], '#7a8a4e', 0, 1);
    both(g, [s * 0.3, 0.01, 0.1], [s * 0.9, -0.02, -0.02], [s * 0.62, 0.0, -0.06], '#6a7a42', 0, 1);
    both(g, [s * 0.2, 0.0, -0.36], [s * 0.42, -0.02, -0.56], [s * 0.14, 0.0, -0.46], '#6a7a42', 0, 0.5);
  }
  both(g, [-0.04, 0.01, -0.46], [0.04, 0.01, -0.46], [0, 0.0, -0.6], '#6a7a42');
  return body(g, (x, _y, _z, mask) => mask * clamp((Math.abs(x) - 0.18) / 0.6, 0, 1));
}

/** A small jellyfish a unit high: a bell (pale, its four rings and its rim lit), frilled arms and long
 *  tentacles trailing under it, glowing. */
function jellyBody(bell: string, glow: V3, arm: V3) {
  const g = new Geo(), R = 0.3, H = 0.22, rings = 4, seg = 9;
  const ring = (k: number): V3[] => {
    const t = k / rings, a = t * Math.PI * 0.5, r = R * Math.sin(a) * (1 + 0.08 * t), y = H * Math.cos(a);
    return Array.from({ length: seg }, (_, i): V3 => [Math.cos((i / seg) * Math.PI * 2) * r, y, Math.sin((i / seg) * Math.PI * 2) * r]);
  };
  for (let k = 0; k < rings; k++) {
    const A = ring(k), B = ring(k + 1);
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg, col = k === rings - 1 ? glow : bell, kind = k === rings - 1 ? 1 : 0;
      if (k === 0) g.tri(A[i], B[j], B[i], col, { kind });
      else {
        g.tri(A[i], B[j], B[i], col, { kind });
        g.tri(A[i], A[j], B[j], col, { kind });
      }
    }
  }
  // The four rings seen through the top of the bell, glowing.
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    g.box(Math.cos(a) * 0.1, H * 0.86, Math.sin(a) * 0.1, 0.07, 0.03, 0.07, arm, { kind: 1 });
  }
  // The underside, and the arms and tentacles hanging from it.
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2, r = R * 1.08;
    g.tri([0, 0.02, 0], [Math.cos(a0) * r, 0, Math.sin(a0) * r], [Math.cos(a1) * r, 0, Math.sin(a1) * r], bell);
  }
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    g.beam([Math.cos(a) * 0.04, 0.02, Math.sin(a) * 0.04], [Math.cos(a) * 0.08, -0.45, Math.sin(a) * 0.08], 0.025, arm, { kind: 1 });
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.2;
    g.beam([Math.cos(a) * R, 0.01, Math.sin(a) * R], [Math.cos(a) * R * 0.8, -0.75, Math.sin(a) * R * 0.8], 0.008, glow, { kind: 1 });
  }
  return body(g, (_x, y) => (y < -0.005 ? 1 + clamp(-y / 0.75, 0, 1) : clamp(1 - y / H, 0, 1)));
}

/** An octopus, its arms a metre and a half across, its head toward +z: a bulb of a mantle, eyes, eight arms
 *  curling out over the floor. Pale, mottled, so that its colour is all the tint it's given. */
function octopusBody() {
  const g = new Geo();
  g.blob(0, 0.4, -0.1, 0.2, 0.26, 0.24, '#f0f0f0', 3, { detail: 1, jitter: 0.08 });
  g.blob(0, 0.2, 0.05, 0.18, 0.14, 0.17, '#e4e4e4', 4, { detail: 1, jitter: 0.06 });
  for (const [x, y, z] of [[0.1, 0.48, -0.15], [-0.08, 0.38, -0.25], [0.04, 0.55, -0.05], [-0.12, 0.3, -0.05]] as const) g.box(x, y, z, 0.06, 0.04, 0.06, '#a8a8a8');
  for (const s of [-1, 1]) {
    g.blob(s * 0.12, 0.27, 0.12, 0.05, 0.05, 0.05, '#f8f0c0', 6);
    g.box(s * 0.155, 0.255, 0.14, 0.02, 0.025, 0.05, '#101010');
  }
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * Math.PI * 2 + 0.2, curl = (k % 2 ? 1 : -1) * (0.5 + (k % 3) * 0.2), pts: V3[] = [];
    for (const [d, y, t] of [[0.1, 0.13, 0], [0.3, 0.06, 0.15], [0.5, 0.05, 0.4], [0.66, 0.08, 0.7], [0.74, 0.16, 1]] as const) {
      const a = a0 + curl * t * t;
      pts.push([Math.cos(a) * d, y, Math.sin(a) * d]);
    }
    g.sweep(pts, [0.06, 0.045, 0.03, 0.018, 0.008], k % 2 ? '#e8e8e8' : '#dcdcdc', { seg: 5, lumpy: 0.1, wind: 1 });
  }
  return body(g, (x, _y, z, mask) => mask * clamp((Math.hypot(x, z) - 0.1) / 0.65, 0, 1));
}

/** A small crab a unit across with its legs out, facing +z (it walks sideways, along x): a flat shell, eyes on
 *  stalks, six legs (they lift by turns), two little claws. Pale, for its tint. */
function crabBody() {
  const g = new Geo(), leg = '#e0e0e0';
  g.blob(0, 0.16, 0, 0.3, 0.13, 0.24, '#f4f4f4', 9, { detail: 1, jitter: 0.05, flatBottom: true });
  g.blob(0, 0.24, -0.02, 0.2, 0.06, 0.15, '#ffffff', 10, { detail: 0, jitter: 0.05 });
  for (const s of [-1, 1]) {
    g.beam([s * 0.08, 0.22, 0.16], [s * 0.09, 0.34, 0.2], 0.015, '#303030');
    g.box(s * 0.09, 0.33, 0.2, 0.045, 0.045, 0.045, '#101010');
    for (const z0 of [0.1, -0.02, -0.14]) {
      const knee: V3 = [s * 0.46, 0.24, z0 * 1.4], foot: V3 = [s * 0.6, 0.0, z0 * 1.8];
      g.beam([s * 0.24, 0.13, z0], knee, 0.025, leg, { wind: 1 });
      g.beam(knee, foot, 0.02, leg, { wind: 1 });
    }
    g.beam([s * 0.18, 0.14, 0.18], [s * 0.3, 0.17, 0.36], 0.03, leg, { wind: 0.4 });
    g.box(s * 0.3, 0.13, 0.42, 0.12, 0.09, 0.14, '#f0f0f0', { wind: 0.4 });
  }
  return body(g, (_x, _y, _z, mask) => mask);
}

// ---------- where things are ----------

/** The schools: their kind, the middle of their patch (r round it; `ring`: keep this far out of its middle),
 *  how many, how high they swim (near the floor, mid-water, near the surface), how loose. By zone: the coral
 *  gardens' reef fish, the kelp's shoals, the kingdom's lantern-fish (round the plaza's columns, not through
 *  its middle; round the towers), the wreck's snappers, the trench's hatchet-fish, the shallows' fry, the
 *  reef flats and the open sea north of the sandbar. (`open`: they keep to the kelp's clearings, where they
 *  can be seen, not under its canopy.) */
const SCHOOLS: { kind: FishKind; x: number; z: number; r: number; n: number; band: 'floor' | 'mid' | 'top'; ring?: number; loose?: number; size?: number; open?: boolean }[] = [
  // The coral gardens.
  { kind: 'butterfly', x: 57, z: 58, r: 5, n: 26, band: 'floor' },
  { kind: 'tang', x: 60, z: 75, r: 5, n: 24, band: 'mid' },
  { kind: 'clown', x: 49, z: 79, r: 3.5, n: 10, band: 'floor', loose: 1.3 },
  { kind: 'damsel', x: 43, z: 84, r: 3.5, n: 36, band: 'floor', size: 0.3 },
  { kind: 'anthias', x: 63, z: 63, r: 4, n: 36, band: 'mid', size: 0.32 },
  { kind: 'grunt', x: 51, z: 73, r: 4, n: 22, band: 'floor' },
  { kind: 'damsel', x: 64, z: 81, r: 3, n: 24, band: 'floor', size: 0.3 },
  { kind: 'anthias', x: 67, z: 91, r: 3, n: 24, band: 'mid', size: 0.3 },
  // The kelp forest: silver shoals through its clearings, a few garibaldi.
  { kind: 'silver', x: 72, z: 52, r: 7, n: 40, band: 'mid', open: true },
  { kind: 'silver', x: 84, z: 47, r: 7, n: 44, band: 'mid', open: true },
  { kind: 'silver', x: 96, z: 58, r: 6, n: 36, band: 'mid', open: true },
  { kind: 'silver', x: 76, z: 63, r: 6, n: 36, band: 'mid', open: true },
  { kind: 'garibaldi', x: 90, z: 52, r: 5, n: 6, band: 'floor', loose: 2.2, size: 0.58, open: true },
  // The drowned kingdom: round the plaza's columns, round the towers, down its streets.
  { kind: 'lantern', x: 90, z: 86, r: 9, n: 30, band: 'floor', ring: 5.5 },
  { kind: 'lantern', x: 75.5, z: 80.5, r: 4, n: 24, band: 'floor' },
  { kind: 'lantern', x: 100.5, z: 77.5, r: 4, n: 24, band: 'floor' },
  { kind: 'lantern', x: 99, z: 90, r: 4, n: 20, band: 'floor' },
  { kind: 'hatchet', x: 82, z: 76, r: 4, n: 16, band: 'mid' },
  // The wreck's snappers; the trench's hatchet-fish, low on its floor.
  { kind: 'snapper', x: 121, z: 50, r: 6, n: 30, band: 'mid' },
  { kind: 'hatchet', x: 98, z: 102, r: 5, n: 24, band: 'floor' },
  { kind: 'hatchet', x: 134, z: 66, r: 5, n: 24, band: 'floor' },
  { kind: 'hatchet', x: 68, z: 109, r: 5, n: 20, band: 'floor' },
  // The reef flats to the south-west, the shallows, the open sea north of the sandbar, Gull Rock.
  { kind: 'grunt', x: 25, z: 95, r: 6, n: 20, band: 'floor' },
  { kind: 'fry', x: 38, z: 88, r: 5, n: 36, band: 'top', size: 0.27 },
  { kind: 'silver', x: 42, z: 103, r: 6, n: 30, band: 'mid' },
  { kind: 'silver', x: 92, z: 16, r: 8, n: 40, band: 'mid' },
  { kind: 'fry', x: 85, z: 24, r: 4, n: 30, band: 'top', size: 0.27 },
  { kind: 'butterfly', x: 110, z: 26, r: 4, n: 14, band: 'floor' },
  { kind: 'tang', x: 115, z: 63, r: 4, n: 16, band: 'mid' },
  { kind: 'fry', x: 66, z: 47, r: 3.5, n: 26, band: 'top', size: 0.26 },
];

/** Rays over the sand: their patch, their colours (a stingray, brown; an eagle ray, dark with white spots). */
const RAYS: { x: number; z: number; r: number; eagle?: boolean }[] = [
  { x: 33, z: 92, r: 8 },
  { x: 36, z: 102, r: 7, eagle: true },
  { x: 70, z: 98, r: 5 },
  { x: 100, z: 14, r: 10, eagle: true },
  { x: 80, z: 56, r: 6 },
  { x: 112, z: 60, r: 5, eagle: true },
  { x: 118, z: 12, r: 8 },
];

/** The turtles' rounds: through the gardens, along the kelp's edge, out over the reef flats and back; round
 *  the open sea north of the sandbar. Every third stop they come up for a breath. */
const ROUNDS: [number, number][][] = [
  [[56, 58], [66, 52], [80, 46], [97, 46], [104, 57], [88, 67], [70, 70], [64, 84], [66, 96], [48, 98], [30, 100], [40, 88], [46, 74]],
  [[98, 12], [114, 6], [130, 10], [134, 24], [120, 28], [106, 22]],
];

/** Jellies near the surface: where each smack drifts, its colours. */
const SMACKS: { x: number; z: number; r: number; n: number; bell: string; glow: V3; arm: V3 }[] = [
  { x: 73, z: 54, r: 4, n: 8, bell: '#c8d0ff', glow: [0.9, 1.2, 2.6], arm: [1.6, 0.7, 2.2] },
  { x: 108, z: 99, r: 5, n: 10, bell: '#f0c8f0', glow: [2.2, 0.8, 2], arm: [2.4, 1.2, 1.6] },
  { x: 130, z: 74, r: 4, n: 8, bell: '#c8f0f0', glow: [0.6, 2.2, 2.2], arm: [1, 2, 1.4] },
  { x: 97, z: 22, r: 5, n: 9, bell: '#c8d0ff', glow: [0.9, 1.2, 2.6], arm: [1.6, 0.7, 2.2] },
  { x: 104, z: 83, r: 4, n: 7, bell: '#f0c8f0', glow: [2.2, 0.8, 2], arm: [2.4, 1.2, 1.6] },
  { x: 30, z: 104, r: 5, n: 8, bell: '#c8f0f0', glow: [0.6, 2.2, 2.2], arm: [1, 2, 1.4] },
  { x: 82, z: 104, r: 5, n: 8, bell: '#c8d0ff', glow: [0.9, 1.2, 2.6], arm: [1.6, 0.7, 2.2] },
];

/** The drowned kingdom's streets (as realm3.ts lays them): the octopuses' dens are along their walls. */
const STREETS: [V2, V2][] = [[[75, 81], [84, 84.5]], [[96, 88.5], [106, 91]], [[89, 74.5], [89.5, 80]], [[90.5, 92.5], [89, 98]]];
type V2 = [number, number];

/** What the crabs and the octopuses keep out of (the palace, its landing and its hall out to the map's
 *  south-east corner, and the plaza's middle are kept for the Tidelord's hall and the bell; the serpent's pen;
 *  the village's shelf; the salvage yard). */
const KEEP: { x: number; z: number; r: number }[] = [
  { x: 122, z: 99, r: 10 },
  { x: 90, z: 86, r: 4.5 },
  { x: 79, z: 37.6, r: 6 },
  { x: 37, z: 66, r: 10.5 },
  { x: 100, z: 35, r: 8.5 },
];

const OCTO = { camo: ['#7a7a66', '#6a7a6c', '#8a7a5a', '#5a6458'], show: ['#d8482a', '#ec8a2a', '#a8489c', '#e8d4b0', '#c83a5c'] };
/** The shallows' small crabs: blue-violet, all of them (the beach's are pale sand-tan, the crab foe big and red-orange). */
const CRABS = ['#6a7cf0', '#8a6ae8', '#5a8ef0', '#7a64dc', '#9a80f0', '#6670e0'];

/** Ink an octopus leaves behind it. */
const INK: PSpec = { color: [0.02, 0.02, 0.05], color2: [0.04, 0.04, 0.08], size: 4, size2: 10, life: 2.4, drag: 2.5, wobble: 0.3, alpha: 0.75, soft: true, fadeIn: 0.05 };
/** Plankton glowing in the deep, and flaring in the knight's wake. */
const PLANKTON: PSpec = { color: [0.5, 2.6, 2.2], color2: [0.2, 1.1, 1.8], size: 1, life: 5, wobble: 0.3, gravity: -0.03, drag: 1, fadeIn: 0.3, blink: true, alpha: 0.9 };
const PLANKTON_BIG: PSpec = { ...PLANKTON, size: 2, color: [0.4, 2.2, 2.6] };
const WAKE: PSpec = { color: [0.7, 2.8, 2.6], color2: [0.2, 1, 1.5], size: 1, life: 1.4, wobble: 0.4, drag: 2.5, fadeIn: 0.05, alpha: 0.95 };

// ---------- the swimmers ----------

/** What the swimmers need to know about the sea where they are. */
class Water {
  constructor(private g: Game) {}
  get surface() {
    return this.g.realm.sea?.surface ?? 0;
  }
  ground(x: number, z: number) {
    return this.g.grid.groundAt(x, z);
  }
  /** Sea here, at least `depth` deep, and not the abyss. */
  ok(x: number, z: number, depth: number) {
    const gy = this.g.grid.groundAt(x, z);
    return this.g.grid.waterAt(x, z) !== NONE && gy < this.surface - depth && gy > -14;
  }
  /** Kept clear of the palace, the plaza's middle and the rest (crabs, jellies). */
  kept(x: number, z: number) {
    return KEEP.some((k) => Math.hypot(x - k.x, z - k.z) < k.r) || (x > 112 && z > 86);
  }
  /** Nothing standing within `rad` of (x, z) (a column, a wall, a rock). */
  open(x: number, z: number, rad: number) {
    for (const [px, pz] of [[x, z], [x - rad, z], [x + rad, z], [x, z - rad], [x, z + rad]])
      for (const c of this.g.grid.collidersNear(px, pz)) {
        if (!c.on) continue;
        if (c.kind === 'b' ? x > c.x0 - rad && x < c.x1 + rad && z > c.z0 - rad && z < c.z1 + rad : Math.hypot(x - c.x, z - c.z) < c.r + rad) return false;
      }
    return true;
  }
  /** A rock (a low, round thing standing on the floor) within `rad` of (x, z). */
  rock(x: number, z: number, rad: number) {
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++)
        for (const c of this.g.grid.collidersNear(x + dx * rad, z + dz * rad))
          if (c.on && c.kind === 'c' && c.r < 0.8 && c.y1 - c.y0 < 2.5 && Math.hypot(x - c.x, z - c.z) < rad + c.r) return true;
    return false;
  }
}

/** A school of fish: a middle that wanders its patch (wheeling now and then), each fish keeping its own
 *  place in the shoal round it; when the knight swims at it the shoal bursts apart and makes off, and
 *  gathers again. */
class School {
  herd: Herd;
  private n: number;
  private cx: number;
  private cy: number;
  private cz: number;
  private yaw: number;
  private speed: number;
  private tx = 0;
  private ty = 0;
  private tz = 0;
  private wheel: number;
  private scare = 0;
  private pos: Float32Array;
  private vel: Float32Array;
  private slot: Float32Array;
  private size: Float32Array;
  private yaws: Float32Array;
  /** The floor under each fish (looked up a quarter of them a frame). */
  private floor: Float32Array;
  private frame = 0;
  /** Time saved up while it's far enough off to move every other frame. */
  private owed = 0;
  private spread: number;
  private cruise: number;
  private depth: number;

  constructor(private def: (typeof SCHOOLS)[number], private w: Water, g: Game, private r: Rng) {
    this.n = Math.max(4, Math.round(def.n * FEW));
    const n = this.n, slim = LOOKS[def.kind].shape === 'slim', size = def.size ?? (slim ? 0.5 : 0.46);
    this.herd = new Herd(fishBody(def.kind), lifeMaterial('wag', 0.75), n, g, () => {
      const k = 0.85 + r() * 0.3;
      return [k, k, k];
    });
    this.spread = (0.45 + Math.sqrt(def.n) * 0.22) * (def.loose ?? 1) * (size / 0.42);
    this.cruise = slim ? 1.5 : 1.1;
    this.depth = def.kind === 'fry' ? 0.8 : 1.2;
    this.cx = def.x;
    this.cz = def.z;
    this.cy = w.surface - 1;
    this.yaw = r() * Math.PI * 2;
    this.speed = this.cruise;
    this.wheel = 4 + r() * 8;
    this.pick();
    this.cy = this.ty;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.slot = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.yaws = new Float32Array(n);
    this.floor = new Float32Array(n).fill(-99);
    const S = this.spread;
    for (let i = 0; i < n; i++) {
      // Each fish's place in the shoal: anywhere in a lozenge longer than it's wide, flatter than both.
      let x = 0, y = 0, z = 0;
      do {
        x = r() * 2 - 1;
        y = r() * 2 - 1;
        z = r() * 2 - 1;
      } while (x * x + y * y + z * z > 1);
      this.slot.set([x * S * 0.8, y * S * 0.2, z * S * 1.3], i * 3);
      this.pos.set([this.cx + x * S, this.cy + y * S * 0.2, this.cz + z * S], i * 3);
      this.size[i] = size * (0.85 + r() * 0.3);
      this.yaws[i] = this.yaw;
      this.herd.setFast(i, this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2], this.yaw, 0, this.size[i]);
    }
    this.herd.flush();
  }

  /** Somewhere new in the patch to make for (away from the knight, if he's after them). */
  private pick(fromX?: number, fromZ?: number) {
    const d = this.def, r = this.r, w = this.w;
    for (let k = 0; k < 14; k++) {
      let x: number, z: number;
      if (fromX !== undefined && fromZ !== undefined && k < 8) {
        const a = Math.atan2(this.cz - fromZ, this.cx - fromX) + (r() - 0.5) * 1.6;
        x = this.cx + Math.cos(a) * (6 + r() * 4);
        z = this.cz + Math.sin(a) * (6 + r() * 4);
        if (Math.hypot(x - d.x, z - d.z) > d.r * 1.6 + 3) continue;
      } else {
        const a = r() * Math.PI * 2, rr = (d.ring ?? 0) + Math.sqrt(r()) * (d.r - (d.ring ?? 0));
        x = d.x + Math.cos(a) * rr;
        z = d.z + Math.sin(a) * rr;
      }
      if (!w.ok(x, z, this.depth) || (d.ring && Math.hypot(x - d.x, z - d.z) < d.ring)) continue;
      // (The kelp's groves, as realm3.ts grows them: thick where this is high.)
      if (d.open && k < 10 && fbm(x * 0.09, z * 0.09, 2, 53) > 0.46) continue;
      this.tx = x;
      this.tz = z;
      this.ty = this.heightAt(x, z);
      return;
    }
    this.tx = d.x;
    this.tz = d.z;
    this.ty = this.heightAt(d.x, d.z);
  }

  /** How high they swim over (x, z), by their band. */
  private heightAt(x: number, z: number) {
    const gy = this.w.ground(x, z), sy = this.spread * 0.2, lo = gy + 0.35 + sy, hi = this.w.surface - 0.3 - sy;
    if (hi <= lo) return (lo + hi) / 2;
    const r = this.r();
    return this.def.band === 'floor' ? lo + r * Math.min(1.4, hi - lo) : this.def.band === 'top' ? hi - r * Math.min(1, hi - lo) : lo + (hi - lo) * (0.3 + r * 0.4);
  }

  update(dt: number, g: Game) {
    const f = g.cam.focus, far = Math.hypot(this.cx - f.x, this.cz - f.z), on = far < RANGE + this.spread;
    this.herd.mesh.visible = on;
    if (!on || dt <= 0) return;
    // Toward the edge of the view, every other frame is enough.
    this.frame++;
    if (far > RANGE * 0.6 && this.frame % 2) {
      this.owed += dt;
      return;
    }
    dt = Math.min(0.1, dt + this.owed);
    this.owed = 0;
    const p = g.player, kx = p.x, ky = p.y + 0.9, kz = p.z, w = this.w, n = this.n, t = g.time;
    // The knight comes at the shoal: it bursts apart, every fish darting off, and makes off together.
    if (this.scare <= 0 && Math.hypot(this.cx - kx, (this.cy - ky) * 1.4, this.cz - kz) < this.spread + 2.6) {
      this.scare = 2.8;
      this.pick(kx, kz);
      for (let i = 0; i < n; i++) {
        const o = i * 3, ax = this.pos[o] - kx, ay = this.pos[o + 1] - ky, az = this.pos[o + 2] - kz, l = Math.hypot(ax, ay, az) || 1, k = (2.5 + this.r() * 2.5) / l;
        this.vel[o] += ax * k;
        this.vel[o + 1] += ay * k * 0.5;
        this.vel[o + 2] += az * k;
      }
    }
    this.scare -= dt;
    // Now and then it wheels about for somewhere else in its patch.
    this.wheel -= dt;
    if (this.wheel <= 0) {
      this.wheel = 5 + this.r() * 9;
      this.pick();
    }
    const dx = this.tx - this.cx, dz = this.tz - this.cz;
    if (Math.hypot(dx, dz) < 1.2) this.pick();
    const scared = this.scare > 0;
    let turn = Math.atan2(dx, dz) - this.yaw;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    const rate = scared ? 2.6 : 1;
    this.yaw += clamp(turn, -rate * dt, rate * dt);
    this.speed = damp(this.speed, this.cruise * (scared ? 2.6 : 1), 3, dt);
    const nx = this.cx + Math.sin(this.yaw) * this.speed * dt, nz = this.cz + Math.cos(this.yaw) * this.speed * dt;
    if (w.ok(nx, nz, this.depth * 0.8)) {
      this.cx = nx;
      this.cz = nz;
    } else {
      // Shallows or rock ahead: round about.
      this.yaw += Math.PI * 0.8 * dt;
      if (this.r() < dt * 2) this.pick();
    }
    const gy = w.ground(this.cx, this.cz), sy = this.spread * 0.2;
    this.cy = clamp(damp(this.cy, this.ty, 0.7, dt), gy + 0.3 + sy, Math.max(gy + 0.3 + sy, w.surface - 0.3 - sy));
    // Each fish makes for its place in the shoal (turned with the shoal's heading, drifting a little), darts
    // from the knight if he's close, keeps off the floor and under the surface.
    const cs = Math.cos(this.yaw), sn = Math.sin(this.yaw), K = this.scare > 1.8 ? 0.5 : 2.6, Dm = 2.2, vmax = this.cruise * 4, S = this.spread;
    for (let i = 0; i < n; i++) {
      const o = i * 3, sx = this.slot[o], sy2 = this.slot[o + 1], sz = this.slot[o + 2];
      const wx = Math.sin(t * 0.8 + i * 1.7) * 0.2 * S, wy = Math.sin(t * 1.3 + i) * 0.08 * S, wz = Math.cos(t * 0.7 + i * 2.3) * 0.2 * S;
      let px = this.pos[o], py = this.pos[o + 1], pz = this.pos[o + 2];
      let vx = this.vel[o], vy = this.vel[o + 1], vz = this.vel[o + 2];
      let ax = (this.cx + sx * cs + sz * sn + wx - px) * K - vx * Dm;
      let ay = (this.cy + sy2 + wy - py) * K - vy * Dm;
      let az = (this.cz - sx * sn + sz * cs + wz - pz) * K - vz * Dm;
      const kdx = px - kx, kdy = py - ky, kdz = pz - kz, kd = Math.sqrt(kdx * kdx + kdy * kdy + kdz * kdz);
      if (kd < 2.4 && kd > 0.01) {
        const push = ((1 - kd / 2.4) * 30) / kd;
        ax += kdx * push;
        ay += kdy * push * 0.4;
        az += kdz * push;
      }
      vx += ax * dt;
      vy += ay * dt;
      vz += az * dt;
      const sp = Math.sqrt(vx * vx + vy * vy + vz * vz);
      if (sp > vmax) {
        vx *= vmax / sp;
        vy *= vmax / sp;
        vz *= vmax / sp;
      }
      px += vx * dt;
      py += vy * dt;
      pz += vz * dt;
      if ((i + this.frame) % 4 === 0 || this.floor[i] < -98) this.floor[i] = w.ground(px, pz);
      const floor = this.floor[i] + 0.15;
      if (py < floor) {
        py = floor;
        vy = Math.max(0, vy);
      }
      if (py > w.surface - 0.12) {
        py = w.surface - 0.12;
        vy = Math.min(0, vy);
      }
      this.pos[o] = px;
      this.pos[o + 1] = py;
      this.pos[o + 2] = pz;
      this.vel[o] = vx;
      this.vel[o + 1] = vy;
      this.vel[o + 2] = vz;
      const h = Math.sqrt(vx * vx + vz * vz);
      if (h > 0.06) this.yaws[i] = angleLerp(this.yaws[i], Math.atan2(vx, vz), Math.min(1, dt * 10));
      this.herd.phase[i] += dt * (7 + Math.min(sp, 6) * 7);
      this.herd.setFast(i, px, py, pz, this.yaws[i], clamp(-Math.atan2(vy, h + 0.3), -0.6, 0.6), this.size[i]);
    }
    this.herd.flush();
  }
}

/** One that swims alone: a ray low over the sand of its patch, or a turtle on its round. */
interface Glider {
  x: number;
  y: number;
  z: number;
  yaw: number;
  roll: number;
  pitch: number;
  speed: number;
  tx: number;
  ty: number;
  tz: number;
  scare: number;
  size: number;
  /** A ray's patch; a turtle's round and the stop it makes for. */
  home: { x: number; z: number; r: number };
  round?: [number, number][];
  leg: number;
}

/** Rays gliding low over the sand, banking as they turn, off in a hurry when the knight comes at them. */
class Rays {
  herd: Herd;
  private eagles: Herd;
  private all: Glider[] = [];
  constructor(private w: Water, g: Game, private r: Rng) {
    const brown = rayBody('#6a5a48', '#9a8a70', '#e8e0d0'), eagle = rayBody('#262c40', '#e8eef4', '#f0f0f0');
    // (Two looks, two groups: the stingrays and the eagle rays.)
    const mat = lifeMaterial('flap', 0.3);
    const defs = RAYS.slice(0, Math.max(3, Math.round(RAYS.length * FEW)));
    this.herd = new Herd(brown, mat, defs.filter((d) => !d.eagle).length, g);
    this.eagles = new Herd(eagle, mat, defs.filter((d) => d.eagle).length, g);
    for (const d of defs) {
      const it: Glider = { x: d.x, y: 0, z: d.z, yaw: r() * 6.3, roll: 0, pitch: 0, speed: 0.9, tx: d.x, ty: 0, tz: d.z, scare: 0, size: 0.7 + r() * 0.35, home: d, leg: d.eagle ? 1 : 0 };
      this.pick(it);
      it.x = it.tx;
      it.z = it.tz;
      it.y = w.ground(it.x, it.z) + 0.45;
      (it.leg ? this.eagles : this.herd).set(this.all.filter((o) => o.leg === it.leg).length, it.x, it.y, it.z, it.yaw, 0, 0, it.size);
      this.all.push(it);
    }
    this.herd.flush();
    this.eagles.flush();
  }

  private pick(it: Glider, fromX?: number, fromZ?: number) {
    for (let k = 0; k < 12; k++) {
      const a = fromX !== undefined && fromZ !== undefined ? Math.atan2(it.z - fromZ, it.x - fromX) + (this.r() - 0.5) * 1.2 : this.r() * Math.PI * 2;
      const d = fromX !== undefined ? 7 : Math.sqrt(this.r()) * it.home.r;
      const x = (fromX !== undefined ? it.x : it.home.x) + Math.cos(a) * d, z = (fromX !== undefined ? it.z : it.home.z) + Math.sin(a) * d;
      if (!this.w.ok(x, z, 1.1) || Math.hypot(x - it.home.x, z - it.home.z) > it.home.r + 6) continue;
      it.tx = x;
      it.tz = z;
      return;
    }
    it.tx = it.home.x;
    it.tz = it.home.z;
  }

  update(dt: number, g: Game) {
    if (dt <= 0) return;
    const f = g.cam.focus, p = g.player, w = this.w;
    let bi = 0, ei = 0;
    for (const it of this.all) {
      const herd = it.leg ? this.eagles : this.herd, i = it.leg ? ei++ : bi++;
      if (Math.hypot(it.x - f.x, it.z - f.z) > RANGE + 4) continue;
      if (it.scare <= 0 && Math.hypot(it.x - p.x, it.y - p.y - 0.6, it.z - p.z) < 3.4) {
        it.scare = 2.5;
        this.pick(it, p.x, p.z);
      }
      it.scare -= dt;
      const dx = it.tx - it.x, dz = it.tz - it.z;
      if (Math.hypot(dx, dz) < 1.5) this.pick(it);
      let turn = Math.atan2(dx, dz) - it.yaw;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      const rate = it.scare > 0 ? 1.8 : 0.45, step = clamp(turn, -rate * dt, rate * dt);
      it.yaw += step;
      it.roll = damp(it.roll, clamp((-step / Math.max(dt, 1e-3)) * 0.6, -0.5, 0.5), 3, dt);
      it.speed = damp(it.speed, it.scare > 0 ? 3.2 : 0.9, 2, dt);
      const nx = it.x + Math.sin(it.yaw) * it.speed * dt, nz = it.z + Math.cos(it.yaw) * it.speed * dt;
      if (w.ok(nx, nz, 0.9)) {
        it.x = nx;
        it.z = nz;
      } else this.pick(it);
      // Low over the floor, rising and settling with it.
      const want = Math.min(w.ground(it.x, it.z) + 0.45 + Math.sin(g.time * 0.4 + it.size * 9) * 0.15, w.surface - 0.4), oy = it.y;
      it.y = damp(it.y, want, 1.5, dt);
      it.pitch = damp(it.pitch, clamp(-(it.y - oy) / Math.max(dt, 1e-3) * 0.4, -0.4, 0.4), 4, dt);
      herd.phase[i] += dt * (1.3 + it.speed * 1.1);
      herd.set(i, it.x, it.y, it.z, it.yaw, it.pitch, it.roll, it.size);
    }
    this.herd.flush();
    this.eagles.flush();
  }
}

/** Sea turtles cruising their rounds in mid-water, rowing with their flippers; every third stop up to the
 *  surface for a breath; hurrying on when the knight comes close. */
class Turtles {
  herd: Herd;
  private all: Glider[] = [];
  constructor(private w: Water, g: Game) {
    this.herd = new Herd(turtleBody(), lifeMaterial('flap', 0.28), ROUNDS.length, g);
    ROUNDS.forEach((round, k) => {
      const [x, z] = round[0];
      const it: Glider = { x, y: w.surface - 1.5, z, yaw: 0, roll: 0, pitch: 0, speed: 0.8, tx: x, ty: 0, tz: z, scare: 0, size: k ? 1.2 : 1.05, home: { x, z, r: 0 }, round, leg: 0 };
      this.next(it);
      this.herd.set(k, it.x, it.y, it.z, it.yaw, 0, 0, it.size);
      this.all.push(it);
    });
    this.herd.flush();
  }
  private next(it: Glider) {
    const round = it.round!;
    it.leg = (it.leg + 1) % round.length;
    [it.tx, it.tz] = round[it.leg];
    const gy = this.w.ground(it.tx, it.tz), s = this.w.surface;
    it.ty = it.leg % 3 === 0 ? s - 0.3 : Math.max(gy + 1.1, Math.min(s - 1, gy + (s - gy) * 0.5));
  }
  update(dt: number, g: Game) {
    if (dt <= 0) return;
    const f = g.cam.focus, p = g.player, w = this.w;
    this.all.forEach((it, i) => {
      // (Far from the camera they keep on round all the same, only cheaply: no bending, no drawing to do.)
      const near = Math.hypot(it.x - f.x, it.z - f.z) < RANGE + 4;
      if (near && it.scare <= 0 && Math.hypot(it.x - p.x, it.y - p.y - 0.6, it.z - p.z) < 3) it.scare = 2.2;
      it.scare -= dt;
      const dx = it.tx - it.x, dz = it.tz - it.z;
      if (Math.hypot(dx, dz) < 2) this.next(it);
      let turn = Math.atan2(dx, dz) - it.yaw;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      const step = clamp(turn, -0.6 * dt, 0.6 * dt);
      it.yaw += step;
      it.roll = damp(it.roll, clamp((-step / Math.max(dt, 1e-3)) * 0.5, -0.4, 0.4), 3, dt);
      it.speed = damp(it.speed, it.scare > 0 ? 2.2 : 0.8, 2, dt);
      it.x += Math.sin(it.yaw) * it.speed * dt;
      it.z += Math.cos(it.yaw) * it.speed * dt;
      const gy = w.ground(it.x, it.z), oy = it.y;
      it.y = clamp(damp(it.y, it.ty, 0.5, dt), gy + 0.5, w.surface - 0.25);
      it.pitch = damp(it.pitch, clamp((-(it.y - oy) / Math.max(dt, 1e-3)) * 0.5, -0.5, 0.5), 3, dt);
      if (!near) return;
      this.herd.phase[i] += dt * (1.6 + it.speed * 1.4);
      this.herd.set(i, it.x, it.y, it.z, it.yaw, it.pitch, it.roll, it.size);
    });
    this.herd.flush();
  }
}

/** A smack of small jellyfish drifting under the surface: each bell pulsing (a push up, a slow sink), the lot
 *  carried about their patch by the swell, glowing at night. */
class Smack {
  herd: Herd;
  private n: number;
  private pos: Float32Array;
  private drift: Float32Array;
  private size: Float32Array;
  constructor(private def: (typeof SMACKS)[number], private w: Water, g: Game, r: Rng) {
    this.n = Math.max(3, Math.round(def.n * FEW));
    this.herd = new Herd(jellyBody(def.bell, def.glow, def.arm), lifeMaterial('pulse', 0.4), this.n, g);
    this.pos = new Float32Array(this.n * 3);
    this.drift = new Float32Array(this.n * 2);
    this.size = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * def.r;
      this.pos.set([def.x + Math.cos(a) * d, w.surface - 0.5 - r() * 1.2, def.z + Math.sin(a) * d], i * 3);
      this.size[i] = 0.35 + r() * 0.25;
      this.herd.set(i, this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2], 0, 0, 0, this.size[i]);
    }
    this.herd.flush();
  }
  update(dt: number, g: Game) {
    const f = g.cam.focus, d = this.def, on = Math.hypot(d.x - f.x, d.z - f.z) < RANGE + d.r;
    this.herd.mesh.visible = on;
    if (!on || dt <= 0) return;
    const w = this.w, t = g.time, p = g.player;
    for (let i = 0; i < this.n; i++) {
      const o = i * 3, ph = (this.herd.phase[i] += dt * (1.6 + (i % 3) * 0.35));
      let x = this.pos[o], y = this.pos[o + 1], z = this.pos[o + 2];
      // The swell carries them round; past the edge of their patch they're drawn back in; the knight's
      // passing pushes them gently aside.
      let vx = Math.sin(t * 0.11 + i * 1.3) * 0.12 + (d.x - x) * 0.03, vz = Math.cos(t * 0.09 + i * 0.7) * 0.12 + (d.z - z) * 0.03;
      const kd = Math.hypot(x - p.x, z - p.z);
      if (kd < 1.6 && Math.abs(y - p.y - 1) < 1.5) {
        vx += ((x - p.x) / (kd + 0.1)) * 0.8;
        vz += ((z - p.z) / (kd + 0.1)) * 0.8;
      }
      this.drift[i * 2] = damp(this.drift[i * 2], vx, 1, dt);
      this.drift[i * 2 + 1] = damp(this.drift[i * 2 + 1], vz, 1, dt);
      x += this.drift[i * 2] * dt;
      z += this.drift[i * 2 + 1] * dt;
      y += (Math.max(0, Math.sin(ph)) * 0.32 - 0.12) * dt;
      y = clamp(y, Math.max(w.ground(x, z) + 0.9, w.surface - 2.4), w.surface - 0.35);
      this.pos[o] = x;
      this.pos[o + 1] = y;
      this.pos[o + 2] = z;
      this.herd.set(i, x, y, z, ph * 0.05 + i, this.drift[i * 2 + 1] * 0.8, -this.drift[i * 2] * 0.8, this.size[i]);
    }
    this.herd.flush();
  }
}

/** An octopus in the kingdom's ruins: it sits by a wall, its colour changing (stone-grey to hide, then red,
 *  orange, purple), until the knight comes close: then it flushes dark, leaves a cloud of ink and jets off to
 *  another den along the walls, arms trailing. */
class Octopus {
  herd: Herd;
  private x: number;
  private y: number;
  private z: number;
  private yaw: number;
  private pitch = 0;
  private state: 'sit' | 'jet' = 'sit';
  private t = 0;
  private hold: number;
  private from: V3 = [0, 0, 0];
  private to: V3 = [0, 0, 0];
  private col = new THREE.Color('#7a7a66');
  private want = new THREE.Color('#7a7a66');
  private den: number;
  constructor(private dens: V2[], private w: Water, g: Game, private r: Rng) {
    this.herd = new Herd(octopusBody(), lifeMaterial('curl', 0.3), 1, g);
    this.den = Math.floor(r() * dens.length);
    [this.x, this.z] = dens[this.den];
    this.y = w.ground(this.x, this.z);
    this.yaw = r() * 6.3;
    this.hold = 2 + r() * 3;
    this.herd.set(0, this.x, this.y + 0.02, this.z, this.yaw, 0, 0, 1);
    this.herd.flush();
  }
  update(dt: number, g: Game) {
    const f = g.cam.focus, on = Math.hypot(this.x - f.x, this.z - f.z) < RANGE;
    this.herd.mesh.visible = on;
    if (!on || dt <= 0) return;
    const p = g.player;
    this.t += dt;
    if (this.state === 'sit') {
      this.hold -= dt;
      if (this.hold <= 0) {
        // A new colour: mostly the stones' (it hides), now and then a show.
        const set = this.r() < 0.55 ? OCTO.show : OCTO.camo;
        this.want.set(set[Math.floor(this.r() * set.length)]);
        this.hold = 2.5 + this.r() * 3.5;
      }
      this.col.lerp(this.want, Math.min(1, dt * 1.2));
      this.yaw += Math.sin(g.time * 0.3) * dt * 0.2;
      this.pitch = damp(this.pitch, 0, 3, dt);
      this.y = damp(this.y, this.w.ground(this.x, this.z), 4, dt);
      this.herd.phase[0] += dt * 0.9;
      if (Math.hypot(this.x - p.x, this.y - p.y, this.z - p.z) < 3.6) this.flee(g);
    } else {
      const k = clamp(this.t / 1.6, 0, 1), e = k * k * (3 - 2 * k);
      this.x = this.from[0] + (this.to[0] - this.from[0]) * e;
      this.z = this.from[2] + (this.to[2] - this.from[2]) * e;
      this.y = this.from[1] + (this.to[1] - this.from[1]) * e + Math.sin(k * Math.PI) * 1.4;
      this.pitch = damp(this.pitch, k < 0.85 ? 1.35 : 0, 6, dt);
      this.herd.phase[0] += dt * 4;
      this.col.lerp(this.want, Math.min(1, dt * 0.8));
      if (k >= 1) {
        this.state = 'sit';
        this.want.set(OCTO.camo[Math.floor(this.r() * OCTO.camo.length)]);
        this.hold = 3 + this.r() * 3;
      }
    }
    this.herd.tint(0, [this.col.r, this.col.g, this.col.b]);
    this.herd.set(0, this.x, this.y + 0.02, this.z, this.yaw, this.pitch, 0, 1);
    this.herd.flush();
  }
  /** Off, in a cloud of ink, to whichever of a few dens lies furthest from the knight. */
  private flee(g: Game) {
    const p = g.player;
    let best = this.den, far = -1;
    for (let k = 0; k < 4; k++) {
      const i = Math.floor(this.r() * this.dens.length), d = Math.hypot(this.dens[i][0] - p.x, this.dens[i][1] - p.z);
      if (i !== this.den && d > far) (best = i), (far = d);
    }
    if (best === this.den) return;
    this.den = best;
    this.state = 'jet';
    this.t = 0;
    this.from = [this.x, this.y, this.z];
    const [x, z] = this.dens[best];
    this.to = [x, this.w.ground(x, z), z];
    this.yaw = Math.atan2(x - this.x, z - this.z);
    this.col.set('#4a0e10');
    this.want.set('#e8dcc8');
    for (let k = 0; k < 16; k++) g.fx.emit(INK, this.x + (Math.random() - 0.5) * 0.5, this.y + 0.4 + Math.random() * 0.3, this.z + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 1.6, Math.random() * 0.5, (Math.random() - 0.5) * 1.6);
  }
}

/** Small crabs in the shallows, in clumps by the rocks there (where there are no rocks, on the open sand): they
 *  rest, turn, scuttle sideways a little way and rest again, never far from home; the knight's coming sends them
 *  scuttling off fast. */
class Crabs {
  herd: Herd;
  private all: { hx: number; hz: number; x: number; z: number; y: number; yaw: number; want: number; dir: number; state: 'rest' | 'run'; t: number; fast: boolean; size: number }[] = [];
  constructor(private w: Water, g: Game, private r: Rng) {
    const max = Math.round(44 * FEW);
    for (let k = 0; k < 1400 && this.all.length < max; k++) {
      const x = 2 + r() * 136, z = 2 + r() * 106, gy = w.ground(x, z), t = g.grid.typeAt(x, z);
      if (g.grid.waterAt(x, z) === NONE || gy > -0.25 || gy < -1.9 || w.kept(x, z)) continue;
      if (k < 1000 ? !w.rock(x, z, 1.8) || !w.open(x, z, 0.3) : fbm(x * 0.09 + 4, z * 0.09, 2, 311) < 0.56) continue;
      if (t !== T.Sand && t !== T.Gravel && t !== T.Coral && t !== T.Seagrass) continue;
      for (let c = 0, m = 2 + Math.floor(r() * 3); c < m && this.all.length < max; c++) {
        const cx = x + (r() - 0.5) * 2.5, cz = z + (r() - 0.5) * 2.5, cy = w.ground(cx, cz);
        if (g.grid.waterAt(cx, cz) === NONE || cy > -0.2 || !w.open(cx, cz, 0.25)) continue;
        this.all.push({ hx: cx, hz: cz, x: cx, z: cz, y: cy, yaw: r() * 6.3, want: 0, dir: 1, state: 'rest', t: r() * 3, fast: false, size: 0.4 + r() * 0.14 });
        this.all[this.all.length - 1].want = this.all[this.all.length - 1].yaw;
      }
    }
    this.herd = new Herd(crabBody(), lifeMaterial('scuttle', 0.3), Math.max(1, this.all.length), g, (i) => CRABS[i % CRABS.length]);
    this.all.forEach((c, i) => this.herd.set(i, c.x, c.y, c.z, c.yaw, 0, 0, c.size));
    this.herd.flush();
  }
  update(dt: number, g: Game) {
    if (dt <= 0) return;
    const f = g.cam.focus, p = g.player, w = this.w;
    this.all.forEach((c, i) => {
      if (Math.abs(c.x - f.x) + Math.abs(c.z - f.z) > RANGE * 1.3) return;
      c.t -= dt;
      const kd = Math.hypot(c.x - p.x, c.z - p.z);
      if (kd < 2.6 && Math.abs(c.y - p.y) < 2.5 && !(c.state === 'run' && c.fast)) {
        // Off sideways, whichever side is away from the knight (turning a little toward it as it goes).
        const ax = (c.x - p.x) / (kd || 1), az = (c.z - p.z) / (kd || 1), side = Math.cos(c.yaw) * ax - Math.sin(c.yaw) * az;
        c.dir = side >= 0 ? 1 : -1;
        c.want = Math.atan2(-az * c.dir, ax * c.dir);
        c.state = 'run';
        c.fast = true;
        c.t = 0.9;
      } else if (c.t <= 0) {
        if (c.state === 'run' || this.r() < 0.4) {
          c.state = 'rest';
          c.fast = false;
          c.t = 1 + this.r() * 3;
          if (this.r() < 0.4) c.want = c.yaw + (this.r() - 0.5) * 1.6;
        } else {
          // A little way sideways, back toward home if it's strayed.
          const lx = Math.cos(c.yaw), lz = -Math.sin(c.yaw), hx = c.hx - c.x, hz = c.hz - c.z;
          c.dir = Math.hypot(hx, hz) > 2.5 ? (lx * hx + lz * hz >= 0 ? 1 : -1) : this.r() < 0.5 ? 1 : -1;
          c.state = 'run';
          c.t = 0.35 + this.r() * 0.7;
        }
      }
      c.yaw = angleLerp(c.yaw, c.want, Math.min(1, dt * 5));
      if (c.state === 'run') {
        const sp = c.fast ? 3.4 : 1.6, lx = Math.cos(c.yaw), lz = -Math.sin(c.yaw);
        const nx = c.x + lx * c.dir * sp * dt, nz = c.z + lz * c.dir * sp * dt;
        if (g.grid.waterAt(nx, nz) !== NONE && w.ground(nx, nz) < -0.15) {
          c.x = nx;
          c.z = nz;
        } else c.dir = -c.dir;
        this.herd.phase[i] += dt * sp * 10;
      }
      c.y = damp(c.y, w.ground(c.x, c.z), 10, dt);
      this.herd.set(i, c.x, c.y, c.z, c.yaw, 0, 0, c.size);
    });
    this.herd.flush();
  }
}

/** All the sea's harmless life, made when the realm is (the realm's story holds it, see aqua.ts) and moved
 *  each frame from the story's tick. */
export class SeaLife {
  private schools: School[] = [];
  private smacks: Smack[] = [];
  private rays: Rays;
  private turtles: Turtles;
  private octopuses: Octopus[] = [];
  private crabs: Crabs;
  private w: Water;
  private motes = 0;
  private lx = 0;
  private lz = 0;

  constructor(g: Game) {
    const r = mulberry32(4141), w = (this.w = new Water(g));
    for (const d of SCHOOLS) this.schools.push(new School(d, w, g, r));
    for (const d of SMACKS) this.smacks.push(new Smack(d, w, g, r));
    this.rays = new Rays(w, g, r);
    this.turtles = new Turtles(w, g);
    // Two octopuses, each with the dens along the walls of two of the kingdom's streets (the north-west's and
    // the north's, the east's and the south's): at the foot of the wall on the street's far side, so that the
    // wall is behind them and nothing hides them from the camera.
    const dens = (streets: [V2, V2][]) => {
      const out: V2[] = [];
      for (const [a, c] of streets) {
        const dx = c[0] - a[0], dz = c[1] - a[1], l = Math.hypot(dx, dz), side = -dz + dx > 0 ? -1 : 1, nx = (-dz / l) * side, nz = (dx / l) * side;
        for (const t of [0.15, 0.4, 0.65, 0.9]) {
          const x = a[0] + dx * t + nx * 1.3, z = a[1] + dz * t + nz * 1.3;
          if (w.ok(x, z, 3) && !w.kept(x, z) && w.open(x, z, 0.45)) out.push([x, z]);
        }
      }
      return out;
    };
    for (const set of [dens([STREETS[0], STREETS[2]]), dens([STREETS[1], STREETS[3]])]) if (set.length > 1) this.octopuses.push(new Octopus(set, w, g, r));
    this.crabs = new Crabs(w, g, r);
    this.lx = g.player.x;
    this.lz = g.player.z;
  }

  update(g: Game, dt: number) {
    NIGHT.value = 1 - g.dawn * 0.85;
    for (const s of this.schools) s.update(dt, g);
    for (const s of this.smacks) s.update(dt, g);
    this.rays.update(dt, g);
    this.turtles.update(dt, g);
    for (const o of this.octopuses) o.update(dt, g);
    this.crabs.update(dt, g);
    this.plankton(g, dt);
  }

  /** Motes of plankton glowing in the dark of the deep round the camera (the trench, the kingdom, the open
   *  sea's floor), flaring up in the knight's wake as he swims through them. */
  private plankton(g: Game, dt: number) {
    if (dt <= 0) return;
    const w = this.w, f = g.cam.focus, p = g.player, night = NIGHT.value;
    this.motes += dt * (MOBILE ? 18 : 42) * night;
    for (; this.motes >= 1; this.motes--) {
      const x = f.x + (Math.random() - 0.5) * 36, z = f.z + (Math.random() - 0.5) * 36, gy = w.ground(x, z);
      if (gy > -4.2 || g.grid.waterAt(x, z) === NONE) continue;
      const top = w.surface - 0.8, y = Math.max(gy, -14) + 0.3 + Math.pow(Math.random(), 1.6) * Math.max(0.5, top - Math.max(gy, -14) - 0.3);
      g.fx.emit(Math.random() < 0.3 ? PLANKTON_BIG : PLANKTON, x, y, z, 0, 0, 0, 0.7 + Math.random() * 0.6);
    }
    const moved = Math.hypot(p.x - this.lx, p.z - this.lz);
    this.lx = p.x;
    this.lz = p.z;
    if (p.under && moved > dt * 0.8 && w.ground(p.x, p.z) < -4.2 && Math.random() < dt * 16 * night) {
      const a = Math.random() * Math.PI * 2;
      g.fx.emit(WAKE, p.x + Math.cos(a) * 0.6, p.y + 0.3 + Math.random() * 1.2, p.z + Math.sin(a) * 0.6, Math.cos(a) * 0.4, 0.1, Math.sin(a) * 0.4);
    }
  }
}
