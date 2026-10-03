import * as THREE from 'three';
import type { Grid } from '../world/grid';
import type { RegionDef, ZoneLight } from '../world/realm';

/**
 * Each place's own light (a region's `light`), painted into two small maps of the realm, one by night and one at
 * dawn: its colour cast and brightness, and how thick its ground mist lies. The atmosphere pass reads them under
 * every pixel, so a place keeps its light whether the knight stands in it or looks into it from next door, and
 * the maps are blurred so that neighbouring places blend over a few metres (as the prototype tinted each zone).
 */
export class ZoneLights {
  /** World units per texel. */
  readonly cell = 1;
  readonly size: number;
  readonly originX: number;
  readonly originZ: number;
  readonly night: THREE.DataTexture;
  readonly dawn: THREE.DataTexture;

  /** The maps for a realm, or null when none of its places has a light of its own. */
  static build(regions: RegionDef[], grid: Grid, w: number, d: number, pad: number) {
    return regions.some((r) => r.light) ? new ZoneLights(regions, grid, w, d, pad) : null;
  }

  private constructor(regions: RegionDef[], grid: Grid, w: number, d: number, pad: number) {
    this.originX = this.originZ = -pad;
    const n = (this.size = Math.ceil((Math.max(w, d) + pad * 2) / this.cell));
    // Each texel takes the light of the place its ground belongs to (the first region whose test holds there).
    const night = new Float32Array(n * n * 4), dawn = new Float32Array(n * n * 4);
    for (let tz = 0; tz < n; tz++)
      for (let tx = 0; tx < n; tx++) {
        const x = this.originX + (tx + 0.5) * this.cell, z = this.originZ + (tz + 0.5) * this.cell;
        const l: ZoneLight = regions.find((r) => r.test(x, z, grid.groundAt(x, z) + 0.1))?.light ?? {};
        const i = (tz * n + tx) * 4;
        put(night, i, l.tint, l.bright, l.mist);
        put(dawn, i, l.dawn?.tint, l.dawn?.bright, l.dawn?.mist ?? l.mist);
      }
    this.night = texture(blur(night, n), n);
    this.dawn = texture(blur(dawn, n), n);
  }

  get worldSize() {
    return this.size * this.cell;
  }
}

/** A texel: the cast times the brightness in RGB (1 is stored as 128, up to about 2), the mist in A (1 as 64, up to about 4). */
function put(a: Float32Array, i: number, tint: [number, number, number] = [1, 1, 1], bright = 1, mist = 1) {
  for (let c = 0; c < 3; c++) a[i + c] = tint[c] * bright * 128;
  a[i + 3] = mist * 64;
}

/** Two passes of a separable box blur (about four metres wide), so places fade into each other. */
function blur(src: Float32Array, n: number) {
  const R = 2, t = new Float32Array(src.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let z = 0; z < n; z++)
      for (let x = 0; x < n; x++)
        for (let c = 0; c < 4; c++) {
          let s = 0;
          for (let k = -R; k <= R; k++) s += src[(z * n + Math.min(n - 1, Math.max(0, x + k))) * 4 + c];
          t[(z * n + x) * 4 + c] = s / (R * 2 + 1);
        }
    for (let z = 0; z < n; z++)
      for (let x = 0; x < n; x++)
        for (let c = 0; c < 4; c++) {
          let s = 0;
          for (let k = -R; k <= R; k++) s += t[(Math.min(n - 1, Math.max(0, z + k)) * n + x) * 4 + c];
          src[(z * n + x) * 4 + c] = s / (R * 2 + 1);
        }
  }
  return src;
}

function texture(a: Float32Array, n: number) {
  const bytes = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) bytes[i] = Math.max(0, Math.min(255, Math.round(a[i])));
  const tex = new THREE.DataTexture(bytes, n, n, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
