import * as THREE from 'three';
import { hexToLinear, hash2 } from './util';

export type Col = string | number | [number, number, number];

const toCol = (c: Col): [number, number, number] => (Array.isArray(c) ? c : hexToLinear(c));

const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const _n = new THREE.Vector3();
const _e1 = new THREE.Vector3();
const _e2 = new THREE.Vector3();

type V3 = [number, number, number];

export interface ShapeOpts {
  kind?: number;
  wind?: number;
  /** Multiply the colour by this (for per-object variation). */
  shade?: number;
  /** For boxes: separate colour for the top face. */
  top?: Col;
  /** For boxes: skip the bottom face (default true). */
  noBottom?: boolean;
  /** For boxes: skip specific faces. */
  skip?: Partial<Record<'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz', boolean>>;
}

/**
 * Accumulates flat-shaded triangles with colour, pattern kind and wind weight.
 * A transform stack lets props be built in local space.
 */
export class Geo {
  p: number[] = [];
  n: number[] = [];
  c: number[] = [];
  k: number[] = [];
  w: number[] = [];
  private stack: THREE.Matrix4[] = [];
  m = new THREE.Matrix4();
  private nm = new THREE.Matrix3();
  /** When true, colours are used as given (for HDR glow). */
  constructor(public raw = false) {}

  get count() {
    return this.p.length / 3;
  }

  push() {
    this.stack.push(this.m.clone());
    return this;
  }
  pop() {
    this.m = this.stack.pop()!;
    return this;
  }
  translate(x: number, y: number, z: number) {
    this.m.multiply(new THREE.Matrix4().makeTranslation(x, y, z));
    return this;
  }
  rotateY(a: number) {
    this.m.multiply(new THREE.Matrix4().makeRotationY(a));
    return this;
  }
  rotateX(a: number) {
    this.m.multiply(new THREE.Matrix4().makeRotationX(a));
    return this;
  }
  rotateZ(a: number) {
    this.m.multiply(new THREE.Matrix4().makeRotationZ(a));
    return this;
  }
  scale(x: number, y: number, z: number) {
    this.m.multiply(new THREE.Matrix4().makeScale(x, y, z));
    return this;
  }

  private col(c: Col, shade = 1): V3 {
    const v = this.raw ? (Array.isArray(c) ? c : toCol(c)) : toCol(c);
    return [v[0] * shade, v[1] * shade, v[2] * shade];
  }

  /** Triangle in local space (counter-clockwise when seen from the front). */
  tri(a: V3, b: V3, c: V3, col: Col, o: ShapeOpts = {}) {
    _a.set(a[0], a[1], a[2]).applyMatrix4(this.m);
    _b.set(b[0], b[1], b[2]).applyMatrix4(this.m);
    _c.set(c[0], c[1], c[2]).applyMatrix4(this.m);
    _e1.subVectors(_b, _a);
    _e2.subVectors(_c, _a);
    _n.crossVectors(_e1, _e2).normalize();
    const cc = this.col(col, o.shade ?? 1);
    const kind = o.kind ?? 0, wind = o.wind ?? 0;
    for (const v of [_a, _b, _c]) {
      this.p.push(v.x, v.y, v.z);
      this.n.push(_n.x, _n.y, _n.z);
      this.c.push(cc[0], cc[1], cc[2]);
      this.k.push(kind);
      this.w.push(wind);
    }
  }

  /** Quad a-b-c-d counter-clockwise from the front. */
  quad(a: V3, b: V3, c: V3, d: V3, col: Col, o: ShapeOpts = {}) {
    this.tri(a, b, c, col, o);
    this.tri(a, c, d, col, o);
  }

  /** Quad with per-corner colours (used by terrain for soft colour variation). */
  quadColors(a: V3, b: V3, c: V3, d: V3, ca: V3, cb: V3, cc: V3, cd: V3, kind: number, wind = 0) {
    const pts = [a, b, c, a, c, d];
    const cols = [ca, cb, cc, ca, cc, cd];
    _a.set(a[0], a[1], a[2]).applyMatrix4(this.m);
    _b.set(b[0], b[1], b[2]).applyMatrix4(this.m);
    _c.set(c[0], c[1], c[2]).applyMatrix4(this.m);
    _d.set(d[0], d[1], d[2]).applyMatrix4(this.m);
    _e1.subVectors(_b, _a);
    _e2.subVectors(_c, _a);
    _n.crossVectors(_e1, _e2).normalize();
    for (let i = 0; i < 6; i++) {
      _v.set(pts[i][0], pts[i][1], pts[i][2]).applyMatrix4(this.m);
      this.p.push(_v.x, _v.y, _v.z);
      this.n.push(_n.x, _n.y, _n.z);
      this.c.push(cols[i][0], cols[i][1], cols[i][2]);
      this.k.push(kind);
      this.w.push(wind);
    }
  }

  /** Axis-aligned box standing on (x, y, z): sx wide, sy tall, sz deep. */
  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, col: Col, o: ShapeOpts = {}) {
    const x0 = x - sx / 2, x1 = x + sx / 2, y0 = y, y1 = y + sy, z0 = z - sz / 2, z1 = z + sz / 2;
    const sk = o.skip ?? {};
    const topCol = o.top ?? col;
    if (!sk.py) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], topCol, o);
    if (!sk.pz) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col, o);
    if (!sk.nz) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], col, o);
    if (!sk.px) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], col, o);
    if (!sk.nx) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col, o);
    if (o.noBottom === false && !sk.ny) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], col, o);
  }

  /**
   * Gable roof. Ridge runs along local x. Base is w (x) by d (z) at y, ridge h above.
   */
  gable(x: number, y: number, z: number, w: number, d: number, h: number, col: Col, gableCol: Col, o: ShapeOpts = {}) {
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, yt = y + h;
    this.quad([x0, y, z1], [x1, y, z1], [x1, yt, z], [x0, yt, z], col, o);
    this.quad([x1, y, z0], [x0, y, z0], [x0, yt, z], [x1, yt, z], col, o);
    const go = { ...o, kind: o.kind === undefined ? 0 : (gableCol === col ? o.kind : 13) };
    this.tri([x1, y, z1], [x1, y, z0], [x1, yt, z], gableCol, go);
    this.tri([x0, y, z0], [x0, y, z1], [x0, yt, z], gableCol, go);
  }

  /** Four-sided pyramid roof (for towers). */
  pyramid(x: number, y: number, z: number, w: number, d: number, h: number, col: Col, o: ShapeOpts = {}) {
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, t: V3 = [x, y + h, z];
    this.tri([x0, y, z1], [x1, y, z1], t, col, o);
    this.tri([x1, y, z1], [x1, y, z0], t, col, o);
    this.tri([x1, y, z0], [x0, y, z0], t, col, o);
    this.tri([x0, y, z0], [x0, y, z1], t, col, o);
  }

  /** Low-poly cylinder / cone / frustum standing on (x, y, z). */
  cyl(x: number, y: number, z: number, rb: number, rt: number, h: number, seg: number, col: Col, o: ShapeOpts & { cap?: boolean; rot?: number } = {}) {
    const rot = o.rot ?? 0;
    for (let i = 0; i < seg; i++) {
      const a0 = rot + (i / seg) * Math.PI * 2, a1 = rot + ((i + 1) / seg) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      if (rt > 0.0001) {
        this.quad([x + c0 * rb, y, z + s0 * rb], [x + c0 * rt, y + h, z + s0 * rt], [x + c1 * rt, y + h, z + s1 * rt], [x + c1 * rb, y, z + s1 * rb], col, o);
        if (o.cap !== false) this.tri([x, y + h, z], [x + c1 * rt, y + h, z + s1 * rt], [x + c0 * rt, y + h, z + s0 * rt], o.top ?? col, o);
      } else {
        this.tri([x + c0 * rb, y, z + s0 * rb], [x, y + h, z], [x + c1 * rb, y, z + s1 * rb], col, o);
      }
    }
  }

  /** Lumpy low-poly blob (rocks, bushes, tree canopies). */
  blob(x: number, y: number, z: number, rx: number, ry: number, rz: number, col: Col, seed: number, o: ShapeOpts & { detail?: number; jitter?: number; flatBottom?: boolean } = {}) {
    const g = new THREE.IcosahedronGeometry(1, o.detail ?? 0);
    const pos = g.getAttribute('position');
    const j = o.jitter ?? 0.22;
    const pts: V3[] = [];
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
      const hsh = hash2(Math.round(px * 1000) + seed * 13, Math.round(py * 1000) + Math.round(pz * 1000) * 7, seed);
      const k = 1 + (hsh - 0.5) * 2 * j;
      let yy = py * k * ry;
      if (o.flatBottom && yy < -ry * 0.35) yy = -ry * 0.35;
      pts.push([x + px * k * rx, y + yy, z + pz * k * rz]);
    }
    const idx = g.getIndex();
    const tri = (a: number, b: number, c: number) => {
      const sh = 0.9 + hash2(a + seed, b * 3 + c, seed) * 0.2;
      this.tri(pts[a], pts[b], pts[c], col, { ...o, shade: (o.shade ?? 1) * sh });
    };
    if (idx) for (let i = 0; i < idx.count; i += 3) tri(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
    else for (let i = 0; i < pos.count; i += 3) tri(i, i + 1, i + 2);
    g.dispose();
  }

  /** Thin beam between two points with a square section (branches, chains, ropes). */
  beam(a: V3, b: V3, r: number, col: Col, o: ShapeOpts = {}) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const dir = B.clone().sub(A);
    const len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    this.push();
    this.m.multiply(new THREE.Matrix4().compose(A, q, new THREE.Vector3(1, 1, 1)));
    this.box(0, 0, 0, r * 2, len, r * 2, col, o);
    this.pop();
  }

  append(o: Geo) {
    this.p.push(...o.p);
    this.n.push(...o.n);
    this.c.push(...o.c);
    this.k.push(...o.k);
    this.w.push(...o.w);
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aKind', new THREE.Float32BufferAttribute(this.k, 1));
    g.setAttribute('aWind', new THREE.Float32BufferAttribute(this.w, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }

  /** Normal-matrix helper kept for callers that transform normals by hand. */
  normalMatrix() {
    return this.nm.getNormalMatrix(this.m);
  }
}
