import * as THREE from 'three';
import { Geo } from '../engine/geo';
import { K, shared } from '../engine/materials';
import { fbm, hash2, hexToLinear, valueNoise } from '../engine/util';
import { DIRS, Grid, NONE, S, T } from './grid';

type V3 = [number, number, number];

// Albedo per ground type: [colour, pattern kind]. Night lighting does the rest.
const TOP: Record<number, [string, number]> = {
  [T.Grass]: ['#4f7a3c', K.Grass],
  [T.DarkGrass]: ['#3d6334', K.Grass],
  [T.Dirt]: ['#76603f', K.Dirt],
  [T.Path]: ['#8a7550', K.Path],
  [T.Cobble]: ['#77737e', K.Cobble],
  [T.Flag]: ['#7c7888', K.Flag],
  [T.Sand]: ['#a69a78', K.Sand],
  [T.Wood]: ['#7a5536', K.Wood],
  [T.Bed]: ['#3c3a3a', K.Sand],
  [T.Moss]: ['#4b6440', K.Grass],
  [T.Gravel]: ['#6f6a64', K.Sand],
  [T.Floor]: ['#6a6570', K.Flag],
  [T.Carpet]: ['#7a2833', K.Cloth],
  [T.Mud]: ['#4a3b2c', K.Dirt],
  [T.Rock]: ['#6a6670', K.Rock],
  [T.Snow]: ['#c8d0e4', K.Sand],
  [T.Field]: ['#5a4a30', K.Furrow],
  [T.Reeds]: ['#4a5a36', K.Grass],
};

const SIDE: Record<number, [string, number]> = {
  [S.Rock]: ['#5d5966', K.Rock],
  [S.Dirt]: ['#5c4a36', K.Dirt],
  [S.Brick]: ['#6c6878', K.Brick],
  [S.Wood]: ['#5e4430', K.Wood],
};

function tint(base: [number, number, number], x: number, z: number, type: number): V3 {
  const n = fbm(x * 0.09, z * 0.09, 3, 5);
  const j = hash2(Math.floor(x), Math.floor(z), 9) * 0.08;
  let k = 0.82 + n * 0.36 + j;
  let r = base[0] * k, g = base[1] * k, b = base[2] * k;
  if (type === T.Grass || type === T.DarkGrass || type === T.Moss) {
    // Patches of drier, yellower grass.
    const dry = valueNoise(x * 0.05 + 10, z * 0.05 - 4, 3);
    const t = Math.max(0, dry - 0.55) * 1.6;
    r += t * 0.06;
    g += t * 0.02;
    b -= t * 0.01;
  }
  return [r, g, b];
}

export function buildTerrain(grid: Grid, chunk: number, material: THREE.Material) {
  const group = new THREE.Group();
  group.name = 'terrain';
  const zEnd = grid.oz + grid.d, xEnd = grid.ox + grid.w;
  for (let cz0 = grid.oz; cz0 < zEnd; cz0 += chunk)
    for (let cx0 = grid.ox; cx0 < xEnd; cx0 += chunk) {
      const g = new Geo();
      for (let z = cz0; z < Math.min(zEnd, cz0 + chunk); z++)
        for (let x = cx0; x < Math.min(xEnd, cx0 + chunk); x++) cell(grid, g, x, z);
      if (!g.count) continue;
      const mesh = new THREE.Mesh(g.build(), material);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      group.add(mesh);
    }
  return group;
}

function cell(grid: Grid, g: Geo, x: number, z: number) {
  const i = grid.i(x, z);
  const type = grid.t[i];
  const [hex, kind] = TOP[type] ?? TOP[T.Grass];
  const base = hexToLinear(hex);
  const dir = grid.dir[i];

  if (dir >= 0 && grid.steps[i]) {
    stairs(grid, g, x, z, base, kind);
    return;
  }
  const c = [0, 1, 2, 3].map((k) => grid.corner(x, z, k));
  const p: V3[] = [
    [x, c[0], z],
    [x + 1, c[1], z],
    [x + 1, c[2], z + 1],
    [x, c[3], z + 1],
  ];
  const col = p.map((v) => tint(base, v[0], v[2], type));
  // Quad order for an upward normal: (x0,z1) (x1,z1) (x1,z0) (x0,z0)
  g.quadColors(p[3], p[2], p[1], p[0], col[3], col[2], col[1], col[0], kind);
  sides(grid, g, x, z, (k) => c[k]);
}

/** Emit cliff faces toward lower neighbours. top(k) gives this cell's corner heights. */
function sides(grid: Grid, g: Geo, x: number, z: number, top: (corner: number) => number) {
  const i = grid.i(x, z);
  const [shex, skind] = SIDE[grid.side[i]] ?? SIDE[S.Rock];
  const sc = hexToLinear(shex);
  // For each edge: our two corners, and the matching corners on the neighbour.
  // pa -> pb runs so that (pb - pa) x up points outward.
  const edges: { n: [number, number]; a: number; b: number; na: number; nb: number; pa: V3; pb: V3 }[] = [
    { n: [1, 0], a: 2, b: 1, na: 3, nb: 0, pa: [x + 1, 0, z + 1], pb: [x + 1, 0, z] },
    { n: [0, 1], a: 3, b: 2, na: 0, nb: 1, pa: [x, 0, z + 1], pb: [x + 1, 0, z + 1] },
    { n: [-1, 0], a: 0, b: 3, na: 1, nb: 2, pa: [x, 0, z], pb: [x, 0, z + 1] },
    { n: [0, -1], a: 1, b: 0, na: 2, nb: 3, pa: [x + 1, 0, z], pb: [x, 0, z] },
  ];
  for (const e of edges) {
    const nx = x + e.n[0], nz = z + e.n[1];
    const ta = top(e.a), tb = top(e.b);
    let ba: number, bb: number;
    if (!grid.inside(nx, nz)) {
      ba = bb = -6;
    } else {
      ba = grid.corner(nx, nz, e.na);
      bb = grid.corner(nx, nz, e.nb);
      if (grid.dir[grid.i(nx, nz)] >= 0 && grid.steps[grid.i(nx, nz)]) {
        // Stepped neighbour: use its lowest point on this edge so no gaps show.
        ba = bb = Math.min(ba, bb, grid.h[grid.i(nx, nz)]);
      }
    }
    if (ta <= ba + 0.001 && tb <= bb + 0.001) continue;
    ba = Math.min(ba, ta);
    bb = Math.min(bb, tb);
    const A: V3 = [e.pa[0], ba, e.pa[2]], B: V3 = [e.pb[0], bb, e.pb[2]];
    const C: V3 = [e.pb[0], tb, e.pb[2]], D: V3 = [e.pa[0], ta, e.pa[2]];
    const shade = 0.85 + hash2(x * 3 + e.n[0], z * 5 + e.n[1], 4) * 0.2;
    const cc: V3 = [sc[0] * shade, sc[1] * shade, sc[2] * shade];
    // A tall face gets a darker foot so cliffs read as deep.
    const dark: V3 = [cc[0] * 0.7, cc[1] * 0.7, cc[2] * 0.75];
    g.quadColors(A, B, C, D, ba < ta - 1.5 ? dark : cc, bb < tb - 1.5 ? dark : cc, cc, cc, skind);
    // Grass lip: a thin band of the top colour along grassy cliff edges.
    const t = grid.t[i];
    if ((t === T.Grass || t === T.DarkGrass || t === T.Moss) && ta - ba > 0.3) {
      const lip = 0.12;
      const gc = tint(hexToLinear(TOP[t][0]), x, z, t);
      const gd: V3 = [gc[0] * 0.8, gc[1] * 0.8, gc[2] * 0.8];
      const o = 0.02;
      const off: V3 = [e.n[0] * o, 0, e.n[1] * o];
      g.quadColors(
        [D[0] + off[0], ta - lip, D[2] + off[2]],
        [C[0] + off[0], tb - lip, C[2] + off[2]],
        [C[0] + off[0], tb + 0.001, C[2] + off[2]],
        [D[0] + off[0], ta + 0.001, D[2] + off[2]],
        gd, gd, gc, gc, K.Grass,
      );
    }
  }
}

function stairs(grid: Grid, g: Geo, x: number, z: number, base: [number, number, number], kind: number) {
  const i = grid.i(x, z);
  const d = grid.dir[i], h0 = grid.h[i], rise = grid.rise[i];
  const n = Math.max(2, Math.round(Math.abs(rise) / 0.25));
  const dx = DIRS[d][0];
  const col = tint(base, x, z, grid.t[i]);
  const riserCol: V3 = [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8];
  for (let s = 0; s < n; s++) {
    const t0 = s / n, t1 = (s + 1) / n;
    const hTop = h0 + rise * t1;
    const hPrev = h0 + rise * t0;
    // Step footprint in cell space along direction.
    const seg = (t: number) => (d === 0 || d === 1 ? t : 1 - t);
    let x0 = x, x1 = x + 1, z0 = z, z1 = z + 1;
    if (dx !== 0) {
      const a = x + seg(t0), b = x + seg(t1);
      x0 = Math.min(a, b);
      x1 = Math.max(a, b);
    } else {
      const a = z + seg(t0), b = z + seg(t1);
      z0 = Math.min(a, b);
      z1 = Math.max(a, b);
    }
    g.quadColors([x0, hTop, z1], [x1, hTop, z1], [x1, hTop, z0], [x0, hTop, z0], col, col, col, col, kind);
    // Riser faces the low side.
    const lo = hPrev - (s === 0 ? 3 : 0);
    if (d === 0) g.quadColors([x0, lo, z0], [x0, lo, z1], [x0, hTop, z1], [x0, hTop, z0], riserCol, riserCol, riserCol, riserCol, kind);
    if (d === 2) g.quadColors([x1, lo, z1], [x1, lo, z0], [x1, hTop, z0], [x1, hTop, z1], riserCol, riserCol, riserCol, riserCol, kind);
    if (d === 1) g.quadColors([x1, lo, z0], [x0, lo, z0], [x0, hTop, z0], [x1, hTop, z0], riserCol, riserCol, riserCol, riserCol, kind);
    if (d === 3) g.quadColors([x0, lo, z1], [x1, lo, z1], [x1, hTop, z1], [x0, hTop, z1], riserCol, riserCol, riserCol, riserCol, kind);
    // Lateral sides toward lower neighbours.
    const lat: [number, number][] = dx !== 0 ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
    for (const [lx, lz] of lat) {
      const nx = x + lx, nz = z + lz;
      const nb = grid.inside(nx, nz) ? grid.cellTop(nx, nz, (x0 + x1) / 2 + lx, (z0 + z1) / 2 + lz) : -6;
      if (nb >= hTop - 0.01) continue;
      const sc = hexToLinear(SIDE[grid.side[i]]?.[0] ?? SIDE[S.Rock][0]);
      if (lz === 1) g.quadColors([x0, nb, z1], [x1, nb, z1], [x1, hTop, z1], [x0, hTop, z1], sc, sc, sc, sc, K.Brick);
      if (lz === -1) g.quadColors([x1, nb, z0], [x0, nb, z0], [x0, hTop, z0], [x1, hTop, z0], sc, sc, sc, sc, K.Brick);
      if (lx === 1) g.quadColors([x1, nb, z1], [x1, nb, z0], [x1, hTop, z0], [x1, hTop, z1], sc, sc, sc, sc, K.Brick);
      if (lx === -1) g.quadColors([x0, nb, z0], [x0, nb, z1], [x0, hTop, z1], [x0, hTop, z0], sc, sc, sc, sc, K.Brick);
    }
  }
}

// ---------- water ----------

const WATER_VERT = /* glsl */ `
attribute float aDepth;
varying vec3 vW;
varying float vDepth;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vDepth = aDepth;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const WATER_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uDeep, uShallow, uMoon, uWade;
varying vec3 vW;
varying float vDepth;
float wh(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float wn(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(wh(i), wh(i + vec2(1, 0)), u.x), mix(wh(i + vec2(0, 1)), wh(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  vec2 p = vW.xz;
  float a = wn(p * 1.3 + vec2(uTime * 0.35, uTime * 0.12));
  float b = wn(p * 2.7 - vec2(uTime * 0.2, -uTime * 0.31));
  float r = a * 0.6 + b * 0.4;
  vec3 col = mix(uDeep, uShallow, r * 0.6);
  // Moonlight glints: sparse bright specks that drift with the ripples.
  float g = wn(p * 5.0 + vec2(uTime * 0.6, uTime * 0.25)) * wn(p * 1.7 - vec2(uTime * 0.13, 0.0));
  float glint = smoothstep(0.62, 0.8, g * r * 1.6);
  // A broad soft moon sheen across the water.
  float sheen = smoothstep(0.55, 0.9, wn(p * 0.25 + uTime * 0.02));
  col += uMoon * (glint * 1.8 + sheen * 0.08);
  // Foam-ish lines.
  float line = smoothstep(0.47, 0.5, a) * smoothstep(0.53, 0.5, a);
  col += uShallow * line * 0.5;
  // Shallow water (wadeable) is lighter and clear; deep water is dark.
  float wade = 1.0 - step(0.55, vDepth);
  col = mix(col, uWade * (0.85 + 0.3 * r) + uMoon * glint * 1.2, wade * 0.75);
  gl_FragColor = vec4(col, mix(0.9, 0.5, wade));
}
`;

export function buildWater(grid: Grid) {
  const pos: number[] = [];
  const depth: number[] = [];
  for (let z = grid.oz; z < grid.oz + grid.d; z++)
    for (let x = grid.ox; x < grid.ox + grid.w; x++) {
      const i = grid.i(x, z);
      const w = grid.water[i];
      if (w === NONE) continue;
      pos.push(x, w, z + 1, x + 1, w, z + 1, x + 1, w, z, x, w, z + 1, x + 1, w, z, x, w, z);
      const dp = w - grid.h[i];
      for (let k = 0; k < 6; k++) depth.push(dp);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aDepth', new THREE.Float32BufferAttribute(depth, 1));
  geo.computeBoundingSphere();
  const mat = new THREE.ShaderMaterial({
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    transparent: true,
    uniforms: {
      uTime: shared.uTime,
      uDeep: { value: new THREE.Color(0.006, 0.014, 0.03) },
      uShallow: { value: new THREE.Color(0.03, 0.06, 0.1) },
      uMoon: { value: new THREE.Color(0.55, 0.65, 0.95) },
      uWade: { value: new THREE.Color(0.06, 0.1, 0.13) },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  return mesh;
}
