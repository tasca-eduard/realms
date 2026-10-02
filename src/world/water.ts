import * as THREE from 'three';
import type { Geo } from '../engine/geo';
import { K, shared } from '../engine/materials';
import { fbm, hash2, hexToLinear, mulberry32, smoothstep } from '../engine/util';
import type { Builder } from './builder';
import { Grid, NONE, S, T } from './grid';
import type { Pt } from './paint';

// Rivers, lakes and pools (every realm's but a sea's): banks that shelve down into the water instead of
// stepping sheer into it, a pale edge lapping at every shore, ripples and foam drifting downstream, white
// water at fords, falls and bridges, clear shallows over a stony, weedy bed, dark deeps that mirror the sky,
// and the moon's path and the lamps' light lying on the water in wavering streaks. (The Sunken Reef's sea is
// terrain.ts's clear water, its surf the shore life's.)

/** A stream's line, its points in the order the water runs, and how fast it runs (metres a second). */
export type Flow = { pts: Pt[]; speed: number };

type V3 = [number, number, number];

/** Ground whose bank shelves into the water (earth, sand, grass, gravel); paving, wood and walls stand sheer. */
const SOFT = new Set<number>([T.Grass, T.DarkGrass, T.Dirt, T.Path, T.Sand, T.Moss, T.Mud, T.Reeds, T.Gravel, T.Field, T.Bed]);

const EARTH = hexToLinear('#4a3b2c'), SAND = hexToLinear('#a69a78'), GRAVEL = hexToLinear('#6f6a64');
const GRASS = hexToLinear('#45683a'), BED = hexToLinear('#3c3a3a');

/** Is this cell open water (not ground standing out of it)? */
function wet(grid: Grid, x: number, z: number) {
  if (!grid.inside(x, z)) return false;
  const i = grid.i(x, z);
  return grid.water[i] !== NONE && grid.h[i] < grid.water[i] - 0.01;
}

/** How far up the bank the water's edge sits from a cell's side (0.2 to 0.6 m), the same on both cells that share a corner. */
const edgeIn = (x: number, z: number) => 0.14 + fbm(x * 0.55 + 3.1, z * 0.55, 2, 91) * 0.52;

/** The height of a low bank of soft ground beside water at level w (a cell it can shelve down from), or NONE. */
function lowBank(grid: Grid, x: number, z: number, w: number) {
  if (!grid.inside(x, z) || wet(grid, x, z)) return NONE;
  const j = grid.i(x, z);
  if (grid.dir[j] >= 0 || grid.solid[j] || grid.deck[j] !== NONE || grid.side[j] === S.Brick || grid.side[j] === S.Wood) return NONE;
  const t = grid.t[j], top = grid.h[j];
  if (top <= w + 0.02 || top > w + 0.8) return NONE;
  if (!SOFT.has(t) && !(t === T.Rock && top - w < 0.5)) return NONE;
  return top;
}

/** The bed under a corner of water: the shallowest of the water cells round it (so the banks' feet meet). */
function cornerBed(grid: Grid, px: number, pz: number, w: number) {
  let bed = -Infinity;
  for (const [ox, oz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
    const cx = px + ox, cz = pz + oz;
    if (wet(grid, cx, cz)) bed = Math.max(bed, grid.h[grid.i(cx, cz)]);
  }
  return bed === -Infinity ? w - 0.3 : Math.min(bed, w - 0.05);
}

/** A quad with its face turned toward `want` (its normal's side), per-corner colours. */
function face(g: Geo, p: V3[], c: V3[], want: V3, kind: number) {
  const e1 = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]], e2 = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
  let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  if (Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2]) < 1e-9) {
    const e3 = [p[3][0] - p[0][0], p[3][1] - p[0][1], p[3][2] - p[0][2]];
    n = [e2[1] * e3[2] - e2[2] * e3[1], e2[2] * e3[0] - e2[0] * e3[2], e2[0] * e3[1] - e2[1] * e3[0]];
  }
  if (n[0] * want[0] + n[1] * want[1] + n[2] * want[2] >= 0) g.quadColors(p[0], p[1], p[2], p[3], c[0], c[1], c[2], c[3], kind);
  else g.quadColors(p[0], p[3], p[2], p[1], c[0], c[3], c[2], c[1], kind);
}

const shade = (c: V3, k: number): V3 => [c[0] * k, c[1] * k, c[2] * k];

/** A bank's colours: its top (the ground's own), the wet line, and its foot under the water. */
function bankColours(t: number, x: number, z: number): [V3, V3, V3, number] {
  const j = 0.85 + hash2(Math.floor(x * 2), Math.floor(z * 2), 13) * 0.3;
  if (t === T.Sand) return [shade(SAND, 0.95 * j), shade(SAND, 0.62 * j), shade(BED, 0.9), K.Sand];
  if (t === T.Gravel || t === T.Rock) return [shade(GRAVEL, j), shade(GRAVEL, 0.6 * j), shade(BED, 0.9), K.Sand];
  const grassy = t === T.Grass || t === T.DarkGrass || t === T.Moss || t === T.Reeds;
  return [grassy ? shade(GRASS, 0.8 * j) : shade(EARTH, 1.05 * j), shade(EARTH, 0.6 * j), shade(BED, 0.85), K.Dirt];
}

/**
 * The banks of a cell of water: wherever low, soft ground stands beside it, a slope from the bank's top
 * edge down through the water's surface to the bed (in place of the sheer step the terrain draws), its
 * water line wandering, rounded at every point of land that juts into the water. Drawn into the
 * terrain's own chunks (no more draw calls); the ground underfoot is the grid's, as it always was.
 */
export function shoreBank(grid: Grid, g: Geo, x: number, z: number) {
  if (!wet(grid, x, z)) return;
  const i = grid.i(x, z), w = grid.water[i];
  if (grid.dir[i] >= 0) return;
  // How many cells of water run on from here in a direction (a narrow channel keeps its middle clear).
  const run = (ux: number, uz: number) => {
    let k = 1;
    while (k < 4 && wet(grid, x + ux * k, z + uz * k)) k++;
    return k;
  };
  const SLOPE = 1.1;
  const reach = (px: number, pz: number, cap: number): [number, number, number, number] => {
    const bed = cornerBed(grid, px, pz, w);
    // (In the water's inner corners the bank reaches further out, cutting the corner off.)
    let wetN = 0;
    for (const [ax, az] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) if (wet(grid, px + ax, pz + az)) wetN++;
    const e = edgeIn(px, pz) + (wetN === 1 ? 0.38 : 0);
    let R = Math.min(cap, e + (w - bed) * SLOPE);
    const rw = Math.min(e, R * 0.75);
    R = Math.max(R, rw + 0.05);
    return [rw, R, Math.max(bed, w - (R - rw) / SLOPE), bed];
  };
  const sides: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dz] of sides) {
    const top = lowBank(grid, x + dx, z + dz, w);
    if (top === NONE) continue;
    const ux = -dx, uz = -dz, cap = Math.min(0.95, run(ux, uz) * 0.42 - 0.12);
    const ends: [number, number][] = dx !== 0 ? [[dx > 0 ? x + 1 : x, z], [dx > 0 ? x + 1 : x, z + 1]] : [[x, dz > 0 ? z + 1 : z], [x + 1, dz > 0 ? z + 1 : z]];
    const [cTop, cWet, cFoot, kind] = bankColours(grid.t[grid.i(x + dx, z + dz)], x + dx, z + dz);
    const rows = ends.map(([px, pz]) => {
      const [rw, R, hb, bed] = reach(px, pz, cap);
      return {
        top: [px, top, pz] as V3,
        wl: [px + ux * rw, w - 0.04, pz + uz * rw] as V3,
        foot: [px + ux * R, hb, pz + uz * R] as V3,
        bed: [px + ux * R, bed - 0.02, pz + uz * R] as V3,
      };
    });
    const [a, b] = rows;
    face(g, [a.top, b.top, b.wl, a.wl], [cTop, cTop, cWet, cWet], [0, 1, 0], kind);
    face(g, [a.wl, b.wl, b.foot, a.foot], [cWet, cWet, cFoot, cFoot], [0, 1, 0], kind);
    if (a.foot[1] > a.bed[1] + 0.01 || b.foot[1] > b.bed[1] + 0.01) face(g, [a.foot, b.foot, b.bed, a.bed], [cFoot, cFoot, cFoot, cFoot], [ux, 0, uz], kind);
  }
  // A point of land jutting into the water at a corner: the slopes either side of it rounded off.
  for (const [sx, sz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const ddx = sx ? 1 : -1, ddz = sz ? 1 : -1;
    if (!wet(grid, x + ddx, z) || !wet(grid, x, z + ddz)) continue;
    const top = lowBank(grid, x + ddx, z + ddz, w);
    if (top === NONE) continue;
    const px = x + sx, pz = z + sz;
    const cap = Math.min(0.95, Math.min(run(0, -ddz), run(-ddx, 0)) * 0.42 - 0.12);
    const [rw, R, hb, bed] = reach(px, pz, cap);
    const [cTop, cWet, cFoot, kind] = bankColours(grid.t[grid.i(x + ddx, z + ddz)], x + ddx, z + ddz);
    const a0 = Math.atan2(-ddz, 0), a1 = Math.atan2(0, -ddx);
    let da = a1 - a0;
    if (da > Math.PI) da -= Math.PI * 2;
    if (da < -Math.PI) da += Math.PI * 2;
    const N = 4, apex: V3 = [px, top, pz];
    for (let k = 0; k < N; k++) {
      const t0 = a0 + (da * k) / N, t1 = a0 + (da * (k + 1)) / N;
      const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
      const w0: V3 = [px + c0 * rw, w - 0.04, pz + s0 * rw], w1: V3 = [px + c1 * rw, w - 0.04, pz + s1 * rw];
      const f0: V3 = [px + c0 * R, hb, pz + s0 * R], f1: V3 = [px + c1 * R, hb, pz + s1 * R];
      face(g, [apex, apex, w1, w0], [cTop, cTop, cWet, cWet], [0, 1, 0], kind);
      face(g, [w0, w1, f1, f0], [cWet, cWet, cFoot, cFoot], [0, 1, 0], kind);
      if (hb > bed + 0.01) face(g, [f0, f1, [f1[0], bed - 0.02, f1[2]], [f0[0], bed - 0.02, f0[2]]], [cFoot, cFoot, cFoot, cFoot], [(c0 + c1) / 2, 0, (s0 + s1) / 2], kind);
    }
  }
}

// ---------- the water's surface ----------

const VERT = /* glsl */ `
attribute float aDepth;
attribute float aShore;
attribute vec2 aFlow;
attribute float aWhite;
varying vec3 vW;
varying vec3 vV;
varying float vDepth;
varying float vShore;
varying vec2 vFlow;
varying float vWhite;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vec4 v = viewMatrix * w;
  vV = v.xyz;
  vDepth = aDepth;
  vShore = aShore;
  vFlow = aFlow;
  vWhite = aWhite;
  gl_Position = projectionMatrix * v;
}
`;

const FRAG = /* glsl */ `
#include <common>
#include <lights_pars_begin>
uniform float uTime;
uniform vec3 uCamPos, uCamFwd;
uniform vec3 uDeep, uShallow, uStone, uFoam;
varying vec3 vW;
varying vec3 vV;
varying float vDepth;
varying float vShore;
varying vec2 vFlow;
varying float vWhite;
float wh(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float wn(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(wh(i), wh(i + vec2(1, 0)), u.x), mix(wh(i + vec2(0, 1)), wh(i + vec2(1, 1)), u.x), u.y);
}
// Stones on the bed: the distance to the nearest stone's middle and the next, and which stone.
vec3 stones(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec2 c = vec2(float(x), float(y));
      vec2 o = c + vec2(wh(i + c), wh(i + c + 17.3)) * 0.8 + 0.1 - f;
      float d = length(o);
      if (d < d1) { d2 = d1; d1 = d; id = wh(i + c + 3.1); } else if (d < d2) d2 = d;
    }
  return vec3(d1, d2, id);
}
void main() {
  vec2 p = vW.xz;
  float speed = length(vFlow);
  vec2 fd = speed > 0.001 ? vFlow / speed : vec2(0.7071, 0.7071);
  vec2 side = vec2(-fd.y, fd.x);
  float run = clamp(speed, 0.0, 1.0);
  // The night's light on the water: the moon's colour for glints and foam, the sky's for what the still deeps mirror.
  vec3 moon = vec3(0.25, 0.3, 0.45), sky = vec3(0.06, 0.075, 0.12);
  #if NUM_DIR_LIGHTS > 0
    moon = directionalLights[0].color * 0.42;
  #endif
  #if NUM_HEMI_LIGHTS > 0
    sky = hemisphereLights[0].skyColor;
  #endif
  // Ripples carried by the current: two layers, each slid downstream a while and then begun again, faded
  // between so nothing stretches; still water only drifts.
  float ph0 = fract(uTime * 0.3), ph1 = fract(uTime * 0.3 + 0.5), mw = abs(1.0 - 2.0 * ph0);
  vec2 drift = vec2(uTime * 0.3, uTime * 0.1) * (1.0 - run);
  vec2 q0 = p - vFlow * ph0 * 3.33 + drift, q1 = p - vFlow * ph1 * 3.33 + drift + vec2(0.31, 0.57);
  float a = mix(wn(q0 * 1.3), wn(q1 * 1.3), mw);
  float b = mix(wn(q0 * 2.7 + 5.0), wn(q1 * 2.7 + 5.0), mw);
  float r = a * 0.6 + b * 0.4;
  // Deep water dark, a mirror for the sky; the shallows lighter, the bed showing through.
  float deep = smoothstep(0.1, 0.8, vDepth);
  vec3 col = mix(uShallow, uDeep, deep);
  col += sky * mix(0.08, 0.13, deep) * (1.0 - run * 0.5) * (0.85 + 0.3 * r);
  col += uShallow * (r - 0.5) * (0.5 + run * 0.9);
  // The bed: stones, and weed in patches streaming with the current.
  float clear = 1.0 - smoothstep(0.05, 0.75, vDepth);
  vec3 st = stones(p * 3.1);
  float gap = smoothstep(0.03, 0.14, st.y - st.x);
  vec3 bed = uStone * mix(0.5, 1.45, st.z) * (0.35 + 0.65 * gap) * (1.2 - st.x * 0.6);
  // (Stones in drifts, dark silt between them.)
  float stony = smoothstep(0.42, 0.62, wn(p * 0.55 + 3.0) * 0.7 + run * 0.35);
  bed = mix(uStone * vec3(0.32, 0.33, 0.26) * (0.8 + 0.4 * wn(p * 2.3)), bed, stony);
  vec2 pr = vec2(dot(p, fd), dot(p, side));
  float patchy = wn(p * 0.33 + 7.0);
  float strand = wn(vec2(pr.x * 1.1 - uTime * 0.5 * run, pr.y * 5.5 + sin(pr.x * 1.7 + uTime * 1.4) * 0.5));
  float weed = step(0.6, patchy) * step(0.52, strand) * smoothstep(0.08, 0.3, vDepth) * (1.0 - smoothstep(1.0, 1.8, vDepth));
  bed = mix(bed, vec3(0.05, 0.12, 0.06), weed * 0.85);
  bed *= moon * 0.6 + sky * 0.4;
  col = mix(col, bed, clear * 0.7);
  // The moon's path: a broken column of light on the water up the screen from where the knight stands,
  // crowded with glints (on running water it breaks up and dances).
  float ct = (vW.y - uCamPos.y) / min(uCamFwd.y, -0.01);
  vec2 focus = uCamPos.xz + uCamFwd.xz * ct;
  vec2 up = normalize(uCamFwd.xz), acr = vec2(-up.y, up.x);
  float along = dot(p - focus, up), across = dot(p - focus, acr);
  float wob = (wn(vec2(along * 0.5, uTime * 0.25)) - 0.5) * 1.6;
  float halfW = 1.0 + max(along, 0.0) * 0.09;
  float path = (1.0 - smoothstep(halfW * 0.45, halfW, abs(across + wob))) * smoothstep(-5.0, 1.5, along) * (1.0 - smoothstep(14.0, 28.0, along));
  float g1 = mix(wn(vec2(dot(q0, acr) * 2.4, dot(q0, up) * 8.0) + uTime * vec2(0.5, -0.8)), wn(vec2(dot(q1, acr) * 2.4, dot(q1, up) * 8.0) + uTime * vec2(0.5, -0.8)), mw);
  float g2 = wn(vec2(across * 1.1, along * 3.2) - vec2(uTime * 0.3, uTime * 0.45));
  float gv = g1 * g2 * (0.7 + r * 0.6);
  float glint = smoothstep(mix(0.6, 0.3, path), mix(0.74, 0.42, path), gv);
  glint = glint > 0.5 ? 1.0 : glint > 0.2 ? 0.45 : 0.0;
  col += moon * glint * mix(0.7, 1.8, path) * (1.0 - clear * 0.6);
  col += moon * path * (0.03 + 0.04 * r) * (1.0 - clear * 0.5);
  // The edge: a pale line lapping at every shore, up and back, and a thread of lace further out.
  float tex = wn(p * 3.6 + vec2(uTime * 0.3, -uTime * 0.2));
  float lph = wn(p * 0.18) * 6.283;
  float lap = 0.08 + 0.07 * sin(uTime * 1.5 + lph);
  float fringe = 1.0 - smoothstep(lap * 0.5, lap, vShore + (tex - 0.5) * 0.08);
  float lace = (1.0 - smoothstep(0.0, 0.035, abs(vShore - lap - 0.16 - 0.08 * sin(uTime * 0.9 + lph)))) * step(0.6, tex);
  float edge = max(fringe * (0.55 + 0.6 * tex), lace * 0.55);
  // Foam carried down the stream in streaks, and white water where it breaks (fords, falls, bridges).
  float s0 = wn(vec2(dot(q0, fd) * 0.8, dot(q0, side) * 4.5));
  float s1 = wn(vec2(dot(q1, fd) * 0.8, dot(q1, side) * 4.5) + 3.7);
  float streak = smoothstep(0.72, 0.8, mix(s0, s1, mw)) * smoothstep(0.12, 0.5, speed) * (0.5 + 0.4 * deep);
  float c0 = wn(q0 * 3.4 + uTime * 0.6), c1 = wn(q1 * 3.4 - uTime * 0.6 + 9.0);
  float churn = mix(c0, c1, mw);
  float white = smoothstep(0.45, 0.85, vWhite * (0.35 + churn * 0.9));
  float foam = max(max(edge, streak * 0.75), white);
  float fl = foam > 0.62 ? 0.78 : foam > 0.36 ? 0.32 : 0.0;
  col = mix(col, uFoam * (moon * 0.6 + sky * 0.4), fl);
  // The lamps' and windows' light laid on the water: each light's reflection a streak down the screen, wavering
  // and broken by the ripples.
  vec3 lit = vec3(0.0);
  #if NUM_POINT_LIGHTS > 0
    vec3 nV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
      vec3 lc = pointLights[i].color;
      if (lc.r + lc.g + lc.b < 0.02) continue;
      vec3 lp = pointLights[i].position;
      float h = dot(lp - vV, nV);
      if (h < 0.1) continue;
      vec3 m = lp - 2.0 * h * nV;
      vec2 d = vV.xy - m.xy;
      float len = 0.6 + h * 0.75;
      float fi = float(i);
      float wob2 = sin(d.y * 7.0 + uTime * 2.2 + fi) * 0.07 + (wn(vec2(d.y * 3.0 + fi * 7.0, uTime * 1.3)) - 0.5) * 0.22;
      float wid = 0.1 + 0.12 * (1.0 - smoothstep(0.0, len, abs(d.y)));
      float dash = step(0.38, wn(vec2(d.y * 6.5 - uTime * 1.1, fi * 3.0 + d.x * 0.6)));
      float s = (1.0 - smoothstep(wid * 0.5, wid, abs(d.x + wob2))) * (1.0 - smoothstep(len * 0.4, len, abs(d.y))) * dash;
      float near = 1.0 - smoothstep(pointLights[i].distance * 1.2, pointLights[i].distance * 2.6 + 4.0, length(lp - vV));
      lit += lc * s * near;
    }
  #endif
  col += lit * 0.22 * (1.0 - fl * 0.5);
  float alpha = mix(0.45, 0.95, deep);
  alpha = max(alpha, fl * 0.92);
  alpha = max(alpha, min(1.0, glint * 0.9 + length(lit) * 0.08));
  gl_FragColor = vec4(col, alpha);
}
`;

/** Each water cell's corner values: how deep, how far from the shore, the current, and white water. */
type Corner = { depth: number; shore: number; fx: number; fz: number; white: number };

/** The surface of every river, lake and pool (one mesh, one draw call, as before). */
export function buildInlandWater(grid: Grid, flows: Flow[] = []) {
  const ox = grid.ox, oz = grid.oz, W = grid.w, D = grid.d;
  const isWet = (x: number, z: number) => wet(grid, x, z);
  // The lines of the streams, measured along.
  const lines = flows.map((f) => {
    const cum = [0];
    for (let k = 1; k < f.pts.length; k++) cum.push(cum[k - 1] + Math.hypot(f.pts[k][0] - f.pts[k - 1][0], f.pts[k][1] - f.pts[k - 1][1]));
    return { ...f, cum };
  });
  const along = (l: (typeof lines)[number], s: number): Pt => {
    s = Math.max(0, Math.min(l.cum[l.cum.length - 1], s));
    let k = 1;
    while (k < l.cum.length - 1 && l.cum[k] < s) k++;
    const t = (s - l.cum[k - 1]) / Math.max(1e-6, l.cum[k] - l.cum[k - 1]);
    return [l.pts[k - 1][0] + (l.pts[k][0] - l.pts[k - 1][0]) * t, l.pts[k - 1][1] + (l.pts[k][1] - l.pts[k - 1][1]) * t];
  };
  /** The current at a point: along the nearest stream's line (its bends eased), strongest mid-stream. */
  const current = (px: number, pz: number): [number, number] => {
    let best = Infinity, bl: (typeof lines)[number] | null = null, bs = 0;
    for (const l of lines)
      for (let k = 1; k < l.pts.length; k++) {
        const [ax, az] = l.pts[k - 1], [bx, bz] = l.pts[k];
        const vx = bx - ax, vz = bz - az, len2 = vx * vx + vz * vz;
        const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / len2)) : 0;
        const d = Math.hypot(px - ax - vx * t, pz - az - vz * t);
        if (d < best) {
          best = d;
          bl = l;
          bs = l.cum[k - 1] + t * Math.sqrt(len2);
        }
      }
    if (!bl || best > 9) return [0, 0];
    const a = along(bl, bs - 2.5), b = along(bl, bs + 2.5);
    const dx = b[0] - a[0], dz = b[1] - a[1], n = Math.hypot(dx, dz) || 1;
    const k = bl.speed * (1 - smoothstep(4.5, 9, best));
    return [(dx / n) * k, (dz / n) * k];
  };
  // White water: at the foot of a fall (water a step and more higher close by) and at its lip, and round
  // the piers of a bridge over running water.
  const fallAt = (x: number, z: number, w: number) => {
    let v = 0;
    for (let dz = -3; dz <= 3; dz++)
      for (let dx = -3; dx <= 3; dx++) {
        if (!isWet(x + dx, z + dz)) continue;
        const w2 = grid.water[grid.i(x + dx, z + dz)], d = Math.hypot(dx, dz);
        if (w2 > w + 0.4) v = Math.max(v, 1 - d / 3.2);
        else if (w2 < w - 0.4 && d < 1.6) v = Math.max(v, 0.75);
      }
    return v;
  };
  const deckNear = (x: number, z: number) => {
    let best = 9;
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -2; dx <= 2; dx++) {
        const cx = x + dx, cz = z + dz;
        if (!grid.inside(cx, cz)) continue;
        const j = grid.i(cx, cz);
        if (grid.deck[j] !== NONE && grid.water[j] !== NONE) best = Math.min(best, Math.hypot(dx, dz));
      }
    return best;
  };
  // Per cell (cached): the fall's white water and the nearest bridge.
  const cellFall = new Float32Array(W * D).fill(-1), cellDeck = new Float32Array(W * D).fill(-1);
  const cellInfo = (x: number, z: number) => {
    const k = (z - oz) * W + (x - ox);
    if (cellFall[k] < 0) {
      cellFall[k] = isWet(x, z) ? fallAt(x, z, grid.water[grid.i(x, z)]) : 0;
      cellDeck[k] = isWet(x, z) ? deckNear(x, z) : 9;
    }
    return [cellFall[k], cellDeck[k]];
  };
  /** A wet cell touching a point (its index), or -1. */
  const wetAround = (px: number, pz: number) => {
    for (const [ax, az] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) {
      const cx = Math.floor(px + ax), cz = Math.floor(pz + az);
      if (isWet(cx, cz)) return grid.i(cx, cz);
    }
    return -1;
  };
  const SUB = 2, VW = W * SUB + 1;
  const cache = new Map<number, Corner>();
  const corner = (sx: number, sz: number): Corner => {
    const key = sz * VW + sx;
    let c = cache.get(key);
    if (c) return c;
    const px = ox + sx / SUB, pz = oz + sz / SUB;
    // Depth: the cells' depths at their middles, blended (the shore's land counting as none).
    let depth = 0, wsum = 0;
    for (let cz = Math.floor(pz - 0.5); cz <= Math.floor(pz - 0.5) + 1; cz++)
      for (let cx = Math.floor(px - 0.5); cx <= Math.floor(px - 0.5) + 1; cx++) {
        const wt = Math.max(0, 1 - Math.abs(cx + 0.5 - px)) * Math.max(0, 1 - Math.abs(cz + 0.5 - pz));
        if (wt <= 0) continue;
        wsum += wt;
        if (isWet(cx, cz)) {
          const j = grid.i(cx, cz);
          depth += (grid.water[j] - grid.h[j]) * wt;
        }
      }
    depth = wsum > 0 ? depth / wsum : 0;
    // The shore: the nearest dry cell (out to 3 m), less how far the bank shelves out over the water.
    const fx0 = Math.floor(px), fz0 = Math.floor(pz);
    let shore = 3, nearX = 0, nearZ = 0;
    for (let dz = -3; dz <= 3; dz++)
      for (let dx = -3; dx <= 3; dx++) {
        const cx = fx0 + dx, cz = fz0 + dz;
        if (isWet(cx, cz) || !grid.inside(cx, cz)) continue;
        const ex = Math.max(cx - px, 0, px - cx - 1), ez = Math.max(cz - pz, 0, pz - cz - 1), d = Math.hypot(ex, ez);
        if (d < shore) {
          shore = d;
          nearX = cx;
          nearZ = cz;
        }
      }
    const home = wetAround(px, pz);
    if (shore < 3 && home >= 0 && lowBank(grid, nearX, nearZ, grid.water[home]) !== NONE) shore -= Math.min(edgeIn(px, pz), 0.6);
    const [fx, fz] = current(px, pz);
    const sp = Math.hypot(fx, fz) * Math.max(0.3, Math.min(1, (shore + 0.4) / 1.6));
    const fk = Math.hypot(fx, fz) > 0 ? sp / Math.hypot(fx, fz) : 0;
    // White water: riffles where running water is shallow (the fords), falls, bridges.
    let white = 0;
    if (home >= 0) {
      const cx = (home % W) + ox, cz = Math.floor(home / W) + oz, cd = grid.water[home] - grid.h[home];
      const [fall, deck] = cellInfo(cx, cz);
      white = Math.max(smoothstep(0.24, 0.12, cd) * smoothstep(0.15, 0.5, sp), fall, sp > 0.15 ? (1 - smoothstep(0.6, 1.8, deck)) * 0.7 : 0);
    }
    c = { depth, shore, fx: fx * fk, fz: fz * fk, white };
    cache.set(key, c);
    return c;
  };
  const pos: number[] = [], aDepth: number[] = [], aShore: number[] = [], aFlow: number[] = [], aWhite: number[] = [];
  const put = (x: number, y: number, z: number, c: Corner) => {
    pos.push(x, y, z);
    aDepth.push(c.depth);
    aShore.push(c.shore);
    aFlow.push(c.fx, c.fz);
    aWhite.push(c.white);
  };
  for (let z = oz; z < oz + D; z++)
    for (let x = ox; x < ox + W; x++) {
      const i = grid.i(x, z), w = grid.water[i];
      if (w === NONE) continue;
      // (Open water far from any shore needs no finer mesh.)
      let far = true;
      for (let dz = -3; dz <= 3 && far; dz++) for (let dx = -3; dx <= 3 && far; dx++) if (!isWet(x + dx, z + dz)) far = false;
      const sub = far && Math.hypot(...current(x + 0.5, z + 0.5)) === 0 ? 1 : SUB;
      const step = SUB / sub;
      for (let qz = 0; qz < sub; qz++)
        for (let qx = 0; qx < sub; qx++) {
          const sx = (x - ox) * SUB + qx * step, sz = (z - oz) * SUB + qz * step;
          const x0 = ox + sx / SUB, z0 = oz + sz / SUB, x1 = x0 + 1 / sub, z1 = z0 + 1 / sub;
          const c00 = corner(sx, sz), c10 = corner(sx + step, sz), c11 = corner(sx + step, sz + step), c01 = corner(sx, sz + step);
          put(x0, w, z1, c01);
          put(x1, w, z1, c11);
          put(x1, w, z0, c10);
          put(x0, w, z1, c01);
          put(x1, w, z0, c10);
          put(x0, w, z0, c00);
        }
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aDepth', new THREE.Float32BufferAttribute(aDepth, 1));
  geo.setAttribute('aShore', new THREE.Float32BufferAttribute(aShore, 1));
  geo.setAttribute('aFlow', new THREE.Float32BufferAttribute(aFlow, 2));
  geo.setAttribute('aWhite', new THREE.Float32BufferAttribute(aWhite, 1));
  geo.computeBoundingSphere();
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.lights,
    {
      uDeep: { value: new THREE.Color(0.004, 0.011, 0.026) },
      uShallow: { value: new THREE.Color(0.035, 0.07, 0.1) },
      uStone: { value: new THREE.Color(0.32, 0.3, 0.27) },
      uFoam: { value: new THREE.Color(0.85, 0.9, 0.95) },
    },
  ]);
  // (The time and the camera are the game's, shared with every world material.)
  uniforms.uTime = shared.uTime;
  uniforms.uCamPos = shared.uCamPos;
  uniforms.uCamFwd = shared.uCamFwd;
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, lights: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  return mesh;
}

// ---------- the shores' dressing ----------

/**
 * Reeds standing in the still shallows and stones in the running ones, in patches along the shores
 * (never along a whole bank, never where a path, a jetty or a bridge meets the water). Its own dice. Says how
 * many clumps of reeds and stones it set.
 */
export function dressShores(b: Builder, grid: Grid, flows: Flow[] = [], seed = 86) {
  const keep = b.rng, r = (b.rng = mulberry32(seed));
  const runs = (x: number, z: number) => flows.some((f) => {
    for (let k = 1; k < f.pts.length; k++) {
      const [ax, az] = f.pts[k - 1], [bx, bz] = f.pts[k];
      const vx = bx - ax, vz = bz - az, len2 = vx * vx + vz * vz;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / len2)) : 0;
      if (Math.hypot(x - ax - vx * t, z - az - vz * t) < 5) return true;
    }
    return false;
  });
  const busy = (x: number, z: number) => {
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -2; dx <= 2; dx++) {
        const cx = x + dx, cz = z + dz;
        if (!grid.inside(cx, cz)) continue;
        const j = grid.i(cx, cz), t = grid.t[j];
        if (grid.deck[j] !== NONE || grid.solid[j] || t === T.Path || t === T.Cobble || t === T.Flag || t === T.Wood) return true;
      }
    return false;
  };
  const stone = ['#5d5a60', '#6c6862', '#4e4c52', '#7a756c'];
  let reeds = 0, stones = 0;
  for (let z = grid.oz + 1; z < grid.oz + grid.d - 1; z++)
    for (let x = grid.ox + 1; x < grid.ox + grid.w - 1; x++) {
      if (!wet(grid, x, z)) continue;
      const i = grid.i(x, z), w = grid.water[i], depth = w - grid.h[i];
      let banks = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (lowBank(grid, x + dx, z + dz, w) !== NONE) banks++;
      if (!banks || depth > 0.7 || busy(x, z)) continue;
      const patch = fbm(x * 0.13 + 40, z * 0.13, 2, seed);
      if (runs(x + 0.5, z + 0.5)) {
        // Stones in the running shallows, the water breaking white round them.
        if (patch < 0.56 || r() < 0.35) continue;
        const g = b.g(x, z);
        stones++;
        for (let k = 0, n = 1 + Math.floor(r() * 3); k < n; k++) {
          const sx = x + 0.15 + r() * 0.7, sz = z + 0.15 + r() * 0.7, s = 0.16 + r() * 0.2;
          g.blob(sx, w - 0.08, sz, s * 1.3, s * 0.55, s, stone[Math.floor(r() * stone.length)], Math.floor(r() * 999), { kind: K.Rock, jitter: 0.3, flatBottom: true });
        }
      } else if (patch > 0.6 && r() < 0.7) {
        // Reeds in the still shallows: clumps where the patches fall, a stem or two between.
        b.reeds(x + 0.3 + r() * 0.4, z + 0.3 + r() * 0.4, patch > 0.68 ? 7 + Math.floor(r() * 5) : 3, 0.45);
        reeds++;
      }
    }
  b.rng = keep;
  return { reeds, stones };
}
