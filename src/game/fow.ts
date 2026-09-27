import * as THREE from 'three';

/**
 * Fog of war: a low-res map of what the knight has seen. Unexplored ground is
 * drawn under drifting mist by the atmosphere pass.
 */
export class FogOfWar {
  /** World units per texel. */
  readonly cell = 2;
  readonly size: number;
  readonly originX: number;
  readonly originZ: number;
  data: Uint8Array;
  /** Blurred copy shown on screen, so the edge of the fog is a wide, soft gradient. */
  private view: Uint8Array;
  private tmp: Float32Array;
  tex: THREE.DataTexture;
  private dirty = false;

  constructor(mapW: number, mapD: number, pad: number) {
    this.originX = -pad;
    this.originZ = -pad;
    this.size = Math.ceil((Math.max(mapW, mapD) + pad * 2) / this.cell);
    this.data = new Uint8Array(this.size * this.size);
    this.view = new Uint8Array(this.size * this.size);
    this.tmp = new Float32Array(this.size * this.size);
    this.tex = new THREE.DataTexture(this.view, this.size, this.size, THREE.RedFormat, THREE.UnsignedByteType);
    this.tex.magFilter = THREE.LinearFilter;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.wrapS = this.tex.wrapT = THREE.ClampToEdgeWrapping;
    this.tex.needsUpdate = true;
  }

  get worldSize() {
    return this.size * this.cell;
  }

  reveal(x: number, z: number, radius: number) {
    const c = this.cell;
    const cx = (x - this.originX) / c, cz = (z - this.originZ) / c;
    const r = radius / c, soft = 5 / c;
    const x0 = Math.max(0, Math.floor(cx - r - 1)), x1 = Math.min(this.size - 1, Math.ceil(cx + r + 1));
    const z0 = Math.max(0, Math.floor(cz - r - 1)), z1 = Math.min(this.size - 1, Math.ceil(cz + r + 1));
    for (let tz = z0; tz <= z1; tz++)
      for (let tx = x0; tx <= x1; tx++) {
        const d = Math.hypot(tx + 0.5 - cx, tz + 0.5 - cz);
        const v = Math.round(255 * Math.min(1, Math.max(0, (r - d) / soft)));
        const i = tz * this.size + tx;
        if (v > this.data[i]) {
          this.data[i] = v;
          this.dirty = true;
        }
      }
  }

  revealAll() {
    this.data.fill(255);
    this.dirty = true;
  }

  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    // Two passes of a separable box blur approximate a gaussian.
    const n = this.size, R = 2;
    const src = new Float32Array(this.data);
    const t = this.tmp;
    for (let pass = 0; pass < 2; pass++) {
      for (let z = 0; z < n; z++)
        for (let x = 0; x < n; x++) {
          let s = 0;
          for (let k = -R; k <= R; k++) s += src[z * n + Math.min(n - 1, Math.max(0, x + k))];
          t[z * n + x] = s / (R * 2 + 1);
        }
      for (let z = 0; z < n; z++)
        for (let x = 0; x < n; x++) {
          let s = 0;
          for (let k = -R; k <= R; k++) s += t[Math.min(n - 1, Math.max(0, z + k)) * n + x];
          src[z * n + x] = s / (R * 2 + 1);
        }
    }
    for (let i = 0; i < src.length; i++) this.view[i] = src[i];
    this.tex.needsUpdate = true;
  }

  /** Compact save string: one bit per texel. */
  serialize() {
    const bits = new Uint8Array(Math.ceil(this.data.length / 8));
    for (let i = 0; i < this.data.length; i++) if (this.data[i] > 127) bits[i >> 3] |= 1 << (i & 7);
    let s = '';
    for (const b of bits) s += String.fromCharCode(b);
    return btoa(s);
  }

  load(str: string) {
    try {
      const s = atob(str);
      for (let i = 0; i < this.data.length; i++) this.data[i] = (s.charCodeAt(i >> 3) >> (i & 7)) & 1 ? 255 : 0;
      this.dirty = true;
    } catch {
      /* bad data: start unexplored */
    }
  }
}
