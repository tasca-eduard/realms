import * as THREE from 'three';

const VERT = /* glsl */ `
attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
uniform vec2 uRes;
varying float vAlpha; varying vec3 vColor; varying float vSize;
void main() {
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  float s = max(1.0, floor(aSize + 0.5));
  // Snap to the pixel grid so particles are crisp squares.
  vec2 px = (p.xy / p.w * 0.5 + 0.5) * uRes;
  px = (mod(s, 2.0) > 0.5) ? floor(px) + 0.5 : floor(px + 0.5);
  p.xy = ((px / uRes) * 2.0 - 1.0) * p.w;
  gl_Position = p;
  gl_PointSize = aAlpha <= 0.0 ? 0.0 : s;
  vAlpha = aAlpha; vColor = aColor; vSize = s;
}
`;

const FRAG = /* glsl */ `
uniform float uSoft;
varying float vAlpha; varying vec3 vColor; varying float vSize;
void main() {
  if (vSize > 2.5) {
    vec2 q = gl_PointCoord - 0.5;
    float d = dot(q, q) * 4.0;
    if (d > 1.0) discard;
    if (uSoft > 0.5) { gl_FragColor = vec4(vColor, vAlpha * (d < 0.45 ? 1.0 : 0.6)); return; }
  }
  gl_FragColor = vec4(vColor, vAlpha);
}
`;

export interface PSpec {
  color: [number, number, number];
  color2?: [number, number, number];
  size: number;
  size2?: number;
  life: number;
  gravity?: number;
  drag?: number;
  wobble?: number;
  fadeIn?: number;
  alpha?: number;
  /** Firefly-style blinking. */
  blink?: boolean;
}

class Pool {
  n: number;
  points: THREE.Points;
  pos: Float32Array;
  col: Float32Array;
  size: Float32Array;
  alpha: Float32Array;
  vel: Float32Array;
  life: Float32Array;
  max: Float32Array;
  spec: (PSpec | null)[];
  seed: Float32Array;
  cursor = 0;
  mat: THREE.ShaderMaterial;

  constructor(n: number, additive: boolean) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n);
    this.seed = new Float32Array(n);
    this.spec = new Array(n).fill(null);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uRes: { value: new THREE.Vector2(640, 360) }, uSoft: { value: additive ? 0 : 1 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 4 : 3;
  }

  spawn(s: PSpec, x: number, y: number, z: number, vx: number, vy: number, vz: number, lifeMul = 1) {
    // Find a free slot, else overwrite the oldest-ish one at the cursor.
    let i = -1;
    for (let k = 0; k < 64; k++) {
      const j = (this.cursor + k) % this.n;
      if (this.life[j] <= 0) {
        i = j;
        break;
      }
    }
    if (i < 0) i = this.cursor;
    this.cursor = (i + 1) % this.n;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.max[i] = this.life[i] = s.life * lifeMul;
    this.spec[i] = s;
    this.seed[i] = Math.random() * 100;
  }

  update(dt: number, time: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      const s = this.spec[i]!;
      this.life[i] -= dt;
      const t = 1 - this.life[i] / this.max[i];
      const drag = s.drag ?? 0;
      const k = Math.exp(-drag * dt);
      this.vel[i * 3] *= k;
      this.vel[i * 3 + 2] *= k;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - (s.gravity ?? 0) * dt;
      const wob = s.wobble ?? 0;
      const sd = this.seed[i];
      this.pos[i * 3] += (this.vel[i * 3] + (wob ? Math.sin(time * 1.3 + sd) * wob : 0)) * dt;
      this.pos[i * 3 + 1] += (this.vel[i * 3 + 1] + (wob ? Math.sin(time * 0.9 + sd * 2) * wob * 0.4 : 0)) * dt;
      this.pos[i * 3 + 2] += (this.vel[i * 3 + 2] + (wob ? Math.cos(time * 1.1 + sd * 3) * wob : 0)) * dt;
      const c2 = s.color2 ?? s.color;
      for (let c = 0; c < 3; c++) this.col[i * 3 + c] = s.color[c] + (c2[c] - s.color[c]) * t;
      this.size[i] = s.size + ((s.size2 ?? s.size) - s.size) * t;
      const fi = s.fadeIn ?? 0.1;
      let a = (s.alpha ?? 1) * Math.min(1, t / Math.max(fi, 1e-3)) * Math.min(1, (1 - t) / 0.3);
      if (s.blink) a *= Math.max(0, Math.sin(time * 1.7 + sd * 5) * 0.8 + 0.35);
      this.alpha[i] = Math.max(0, a);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
  }
}

export const P = {
  flame: { color: [4.5, 2.2, 0.6], color2: [1.4, 0.25, 0.05], size: 2, size2: 1, life: 0.45, gravity: -2.2, drag: 2, fadeIn: 0.05 },
  ember: { color: [3.2, 1.3, 0.3], color2: [1.2, 0.2, 0.05], size: 1, life: 1.8, gravity: -0.6, drag: 0.6, wobble: 0.5 },
  spark: { color: [5, 4, 2.5], color2: [2, 0.8, 0.2], size: 1, life: 0.35, gravity: 9, drag: 3, fadeIn: 0.01 },
  bluespark: { color: [2.5, 3.5, 6], color2: [0.4, 0.8, 2.5], size: 1, life: 0.4, gravity: 4, drag: 3, fadeIn: 0.01 },
  firefly: { color: [2.2, 3.0, 0.7], size: 1, life: 9, wobble: 0.6, fadeIn: 0.2, blink: true },
  rune: { color: [0.8, 1.8, 3.6], color2: [0.2, 0.5, 1.6], size: 1, life: 2.5, gravity: -0.35, wobble: 0.15 },
  coinGlint: { color: [4, 3.2, 1.2], size: 1, life: 0.5, gravity: -0.5 },
  heal: { color: [1.2, 3.5, 1.5], color2: [0.3, 1.2, 0.5], size: 1, life: 1.2, gravity: -1.4, wobble: 0.4 },
  dust: { color: [0.2, 0.19, 0.2], color2: [0.12, 0.12, 0.14], size: 3, size2: 5, life: 0.6, drag: 4, gravity: -0.4, alpha: 0.5 },
  smoke: { color: [0.09, 0.09, 0.12], color2: [0.05, 0.05, 0.07], size: 3, size2: 8, life: 5, gravity: -0.35, drag: 0.4, wobble: 0.35, alpha: 0.35, fadeIn: 0.2 },
  puff: { color: [0.35, 0.34, 0.4], color2: [0.15, 0.15, 0.2], size: 4, size2: 7, life: 0.7, drag: 5, gravity: -0.8, alpha: 0.6 },
  blood: { color: [0.25, 0.4, 0.08], size: 1, life: 0.6, gravity: 12, drag: 1.5 },
  splinter: { color: [0.35, 0.24, 0.14], size: 1, life: 0.9, gravity: 14, drag: 1.2 },
  leaf: { color: [0.2, 0.26, 0.08], color2: [0.16, 0.14, 0.05], size: 1, life: 6, gravity: 0.5, drag: 1.5, wobble: 0.8 },
  splash: { color: [0.5, 0.65, 0.9], size: 1, life: 0.5, gravity: 10, drag: 1 },
  mote: { color: [0.8, 0.85, 1.2], size: 1, life: 6, wobble: 0.2, gravity: -0.03, alpha: 0.6, fadeIn: 0.3 },
  drip: { color: [0.55, 0.05, 0.05], size: 1, life: 0.6, gravity: 9, fadeIn: 0.01 },
  bubble: { color: [0.5, 1.6, 0.3], color2: [0.2, 0.7, 0.1], size: 1, size2: 2, life: 0.9, gravity: -1, wobble: 0.3 },
  heal2: { color: [0.4, 2.8, 0.6], color2: [0.2, 1.2, 0.3], size: 1, life: 1, gravity: -1.8, wobble: 0.3 },
  haste: { color: [3.2, 0.8, 0.4], color2: [1, 0.2, 0.1], size: 1, life: 0.5, gravity: -1.5 },
} satisfies Record<string, PSpec>;

export interface Emitter {
  x: number;
  y: number;
  z: number;
  rate: number;
  spec: PSpec;
  spread: number;
  vy?: number;
  on: boolean;
  acc: number;
  glow?: boolean;
}

export class Particles {
  glow = new Pool(3000, true);
  soft = new Pool(1500, false);
  emitters: Emitter[] = [];
  group = new THREE.Group();

  constructor() {
    this.group.add(this.glow.points, this.soft.points);
  }

  setRes(w: number, h: number) {
    this.glow.mat.uniforms.uRes.value.set(w, h);
    this.soft.mat.uniforms.uRes.value.set(w, h);
  }

  private poolFor(s: PSpec) {
    return s === P.dust || s === P.smoke || s === P.puff ? this.soft : this.glow;
  }

  emit(s: PSpec, x: number, y: number, z: number, vx = 0, vy = 0, vz = 0, lifeMul = 1) {
    this.poolFor(s).spawn(s, x, y, z, vx, vy, vz, lifeMul);
  }

  burst(s: PSpec, x: number, y: number, z: number, n: number, speed: number, up = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.6);
      this.emit(s, x, y, z, Math.cos(a) * sp, up * (0.5 + Math.random()), Math.sin(a) * sp, 0.7 + Math.random() * 0.6);
    }
  }

  addEmitter(e: Omit<Emitter, 'acc' | 'on'> & { on?: boolean }) {
    const em: Emitter = { acc: Math.random(), on: true, ...e };
    this.emitters.push(em);
    return em;
  }

  update(dt: number, time: number, cx: number, cz: number, range = 34) {
    const r2 = range * range;
    for (const e of this.emitters) {
      if (!e.on) continue;
      const dx = e.x - cx, dz = e.z - cz;
      if (dx * dx + dz * dz > r2) continue;
      e.acc += e.rate * dt;
      while (e.acc >= 1) {
        e.acc -= 1;
        const s = e.spread;
        this.emit(
          e.spec,
          e.x + (Math.random() - 0.5) * s,
          e.y + Math.random() * s * 0.3,
          e.z + (Math.random() - 0.5) * s,
          (Math.random() - 0.5) * 0.3,
          e.vy ?? 0,
          (Math.random() - 0.5) * 0.3,
          0.7 + Math.random() * 0.6,
        );
      }
    }
    this.glow.update(dt, time);
    this.soft.update(dt, time);
  }
}
