import type { Geo } from '../engine/geo';
import { K } from '../engine/materials';
import { P } from '../engine/particles';
import type { Builder } from './builder';

// ---------------------------------------------------------------------------
// Props of the Sunken Reef: kelp, corals, anemones, barnacled rocks, the vents that breathe bubbles,
// and the stones of the drowned kingdom. Things that live sway with the swell (the wind weight, from
// nothing at the holdfast to most at the tips); corals' tips and anemones glow a little at night.
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

export const SEA = {
  kelp: '#8a8a3a',
  kelpDark: '#6a6a2a',
  kelpBlade: '#a09a44',
  coralPink: '#d0707a',
  coralOrange: '#dc8a4c',
  coralPurple: '#8a4a96',
  coralYellow: '#c4b058',
  coralTeal: '#3a9486',
  stone: '#7c8a8c',
  stoneDark: '#4c585e',
  barnacle: '#c8c2ac',
  glowCyan: [0.25, 1.15, 1.25] as RGB,
  glowPink: [1.25, 0.45, 0.85] as RGB,
};

/** A clump of kelp: tall strands with blades off them; the swell sways the tops, the holdfast stays. */
export function kelp(b: Builder, x: number, z: number, h = 4, n = 3) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  for (let k = 0; k < n; k++) {
    const a = r() * Math.PI * 2, d = k ? 0.25 + r() * 0.4 : 0;
    const sx = x + Math.cos(a) * d, sz = z + Math.sin(a) * d;
    const H = h * (0.65 + r() * 0.55), segs = 6, bend = r() * Math.PI * 2, lean = 0.25 + r() * 0.3;
    let px = sx, py = y - 0.05, pz = sz;
    for (let s = 0; s < segs; s++) {
      const t0 = s / segs, t1 = (s + 1) / segs;
      const nx = sx + Math.cos(bend) * Math.sin(t1 * 2.4) * lean, nz = sz + Math.sin(bend) * Math.sin(t1 * 2.4) * lean, ny = y + H * t1;
      const wind = t0 * 9;
      g.sweep([[px, py, pz], [nx, ny, nz]], [0.09 * (1 - t0 * 0.4), 0.09 * (1 - t1 * 0.4)], s % 2 ? SEA.kelp : SEA.kelpDark, { seg: 5, lumpy: 0, wind, kind: K.Leaves });
      // A long ribbon of a blade off the stem, to one side and then the other, drooping away; a float at its root.
      if (s > 0 && s < segs - 1) {
        const ba = bend + (s % 2 ? 1.4 : -1.4), L = 0.7 + r() * 0.5, bx = Math.cos(ba), bz = Math.sin(ba);
        g.sweep([[nx, ny, nz], [nx + bx * L * 0.45, ny + 0.14, nz + bz * L * 0.45], [nx + bx * L, ny - 0.2, nz + bz * L]], [0.12, 0.16, 0.06], SEA.kelpBlade, { seg: 4, lumpy: 0, wind: wind + 2, kind: K.Leaves, squash: 0.22 });
        g.blob(nx, ny, nz, 0.07, 0.07, 0.07, '#7a7a34', s * 7 + k, { wind: wind + 1 });
      }
      px = nx;
      py = ny;
      pz = nz;
    }
  }
}

/** Branching coral: forked arms reaching up and out, their tips glowing faintly. */
export function branchCoral(b: Builder, x: number, z: number, s = 1, col = SEA.coralPink, glow: RGB = SEA.glowPink) {
  const g = b.g(x, z), gl = b.gl(x, z), y = b.y(x, z), r = b.rng;
  const arms = 4 + Math.floor(r() * 3);
  for (let k = 0; k < arms; k++) {
    const a = (k / arms) * Math.PI * 2 + r() * 0.6, lean = 0.3 + r() * 0.4, L = (0.55 + r() * 0.5) * s;
    const ex = x + Math.cos(a) * lean * L, ez = z + Math.sin(a) * lean * L, ey = y + L;
    g.beam([x, y - 0.05, z], [ex, ey, ez], 0.065 * s, col, { kind: K.Rock });
    for (const f of [-0.5, 0.5]) {
      const fa = a + f, fl = L * (0.35 + r() * 0.25);
      const tx = ex + Math.cos(fa) * fl * 0.6, tz = ez + Math.sin(fa) * fl * 0.6, ty = ey + fl;
      g.beam([ex, ey, ez], [tx, ty, tz], 0.045 * s, col, { kind: K.Rock });
      gl.box(tx, ty - 0.02, tz, 0.06 * s, 0.06 * s, 0.06 * s, glow);
    }
  }
  if (s > 0.9) b.collide({ kind: 'c', x, z, r: 0.35 * s, y0: y - 1, y1: y + 1.2 * s });
}

/** A sea fan: a flat lattice fanned up from a short stem, broadside to the swell. */
export function seaFan(b: Builder, x: number, z: number, s = 1, rot = 0, col = SEA.coralPurple) {
  const g = b.g(x, z), y = b.y(x, z);
  g.push().translate(x, y, z).rotateY(rot);
  g.beam([0, -0.05, 0], [0, 0.25 * s, 0], 0.05 * s, col, { kind: K.Rock });
  const ribs = 7, R = 1.05 * s;
  const tip = (k: number, f: number): [number, number, number] => {
    const a = -1.05 + (k / (ribs - 1)) * 2.1;
    return [Math.sin(a) * R * f, 0.25 * s + Math.cos(a) * R * f, 0];
  };
  for (let k = 0; k < ribs; k++) g.beam([0, 0.25 * s, 0], tip(k, 1), 0.022 * s, col, { wind: 2 + k * 0.2, kind: K.Rock });
  // The lattice: bands across the ribs, with gaps.
  for (const f of [0.45, 0.7, 0.92])
    for (let k = 0; k < ribs - 1; k++) if ((k + Math.round(f * 10)) % 3 !== 0) g.beam(tip(k, f), tip(k + 1, f), 0.018 * s, col, { wind: 3, kind: K.Rock });
  g.pop();
}

/** Brain coral: a low dome, grooved. */
export function brainCoral(b: Builder, x: number, z: number, s = 1, col = SEA.coralYellow) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  g.blob(x, y + 0.18 * s, z, 0.55 * s, 0.38 * s, 0.5 * s, col, Math.floor(r() * 999), { kind: K.Rock, flatBottom: true, detail: 1, jitter: 0.08 });
  for (let k = 0; k < 4; k++) {
    g.push().translate(x, y + 0.42 * s, z).rotateY(k * 0.8 + r());
    g.box(0, 0, 0, 0.75 * s, 0.03, 0.04, '#7a6a34');
    g.pop();
  }
  b.collide({ kind: 'c', x, z, r: 0.45 * s, y0: y - 1, y1: y + 0.55 * s });
}

/** An anemone: short tentacles round a mouth, swaying; their tips glow. */
export function anemone(b: Builder, x: number, z: number, s = 1, col = SEA.coralTeal, glow: RGB = SEA.glowCyan) {
  const g = b.g(x, z), gl = b.gl(x, z), y = b.y(x, z), r = b.rng;
  g.cyl(x, y - 0.05, z, 0.2 * s, 0.24 * s, 0.25 * s, 7, '#5a3a4a', { kind: K.Rock });
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * Math.PI * 2 + r() * 0.3, d = 0.14 * s, L = (0.3 + r() * 0.2) * s;
    const bx = x + Math.cos(a) * d, bz = z + Math.sin(a) * d, tx = bx + Math.cos(a) * L * 0.5, tz = bz + Math.sin(a) * L * 0.5, ty = y + 0.25 * s + L;
    g.beam([bx, y + 0.2 * s, bz], [tx, ty, tz], 0.03 * s, col, { wind: 4, kind: K.Leaves });
    gl.box(tx, ty - 0.02, tz, 0.045 * s, 0.045 * s, 0.045 * s, glow, { wind: 4 });
  }
}

/** A rock of the sea floor crusted with barnacles. */
export function seaRock(b: Builder, x: number, z: number, s = 1) {
  b.rock(x, z, s);
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  for (let k = 0; k < 7; k++) {
    const a = r() * Math.PI * 2, d = (0.2 + r() * 0.3) * s;
    g.cyl(x + Math.cos(a) * d, y + (0.15 + r() * 0.3) * s, z + Math.sin(a) * d, 0.05 * s, 0.03 * s, 0.05 * s, 6, SEA.barnacle, { kind: K.Rock });
  }
}

/** A vent in the sea floor breathing a column of bubbles, a ring of stones round its mouth. */
export function bubbleVent(b: Builder, x: number, z: number, pocket = false) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + r() * 0.4;
    g.blob(x + Math.cos(a) * 0.55, y + 0.08, z + Math.sin(a) * 0.55, 0.22, 0.14, 0.2, k % 2 ? SEA.stone : SEA.stoneDark, Math.floor(r() * 999), { kind: K.Rock, flatBottom: true });
  }
  g.cyl(x, y - 0.02, z, 0.32, 0.32, 0.03, 8, '#1c2428');
  // An air pocket breathes a thick stream (a diver stands in it to fill his air).
  b.fx.addEmitter({ x, y: y + 0.1, z, rate: pocket ? 26 : 9, spec: P.seaBubble, spread: pocket ? 0.55 : 0.25, vy: pocket ? 1.8 : 1.4 });
  b.lights.add(x, y + 0.6, z, 0x60d0d8, 2, 4, 0.2);
}

/** A column of the drowned kingdom, whole or snapped off, barnacled, coral growing on its top. */
export function drownedColumn(b: Builder, x: number, z: number, h = 3.2, broken = false) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  const H = broken ? h * (0.35 + r() * 0.35) : h;
  g.box(x, y - 0.1, z, 0.95, 0.35, 0.95, SEA.stoneDark, { kind: K.Rock });
  g.cyl(x, y + 0.25, z, 0.36, 0.32, H - 0.25, 8, SEA.stone, { kind: K.Rock });
  if (!broken) g.box(x, y + H, z, 0.9, 0.3, 0.9, SEA.stone, { kind: K.Rock });
  for (let k = 0; k < 9; k++) {
    const a = r() * Math.PI * 2;
    g.cyl(x + Math.cos(a) * 0.36, y + 0.4 + r() * (H - 0.6), z + Math.sin(a) * 0.36, 0.05, 0.03, 0.05, 6, SEA.barnacle, { kind: K.Rock });
  }
  b.collide({ kind: 'c', x, z, r: 0.45, y0: y - 1, y1: y + H + (broken ? 0 : 0.3) });
}

/** The lighthouse on its rock: a whitewashed tower banded in red, a gallery, the lantern burning (a warm
 *  light seen across the water), a door at its foot. */
export function lighthouse(b: Builder, x: number, z: number) {
  const g = b.g(x, z), gl = b.gl(x, z), y = b.y(x, z);
  const H = 7.5, white = '#c8c2b2', red = '#9a3a32';
  g.cyl(x, y - 0.6, z, 1.6, 1.45, 1.1, 10, SEA.stoneDark, { kind: K.Rock });
  g.cyl(x, y + 0.5, z, 1.2, 0.82, H, 12, white, { kind: K.Brick });
  for (const t of [0.33, 0.66]) g.cyl(x, y + 0.5 + H * t, z, 1.2 - 0.38 * t + 0.03, 1.2 - 0.38 * (t + 0.08) + 0.03, H * 0.08, 12, red, { kind: K.Brick, cap: false });
  g.cyl(x, y + 0.5 + H, z, 1.15, 1.15, 0.16, 12, SEA.stoneDark, { kind: K.Rock });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.box(x + Math.cos(a) * 1.08, y + 0.66 + H, z + Math.sin(a) * 1.08, 0.05, 0.4, 0.05, '#3a3a44', { kind: K.Metal });
  }
  g.cyl(x, y + 0.66 + H + 0.38, z, 1.1, 1.1, 0.04, 12, '#3a3a44', { kind: K.Metal, cap: false });
  gl.cyl(x, y + 0.66 + H, z, 0.62, 0.62, 1.0, 8, [3.6, 2.6, 1.1], { kind: 0 });
  g.cyl(x, y + 1.66 + H, z, 0.78, 0, 0.8, 8, '#3a3a44', { kind: K.Metal });
  // The door, facing the yard.
  g.box(x + 0.62, y + 0.5, z + 0.7, 0.55, 1.2, 0.12, '#3a2a1e', { kind: K.Wood });
  b.lights.add(x, y + 1.2 + H, z, 0xffd27a, 9, 22, 0.04);
  b.collide({ kind: 'c', x, z, r: 1.35, y0: y - 2, y1: y + H + 2.5 });
}

/** What the salvagers have hauled up from the wrecks, heaped round the yard: kind 0 barrels and a crate,
 *  1 an anchor and chain on a heap of timbers, 2 a stack of crates under a tarp, 3 a rusted cannon. */
export function salvageHeap(b: Builder, x: number, z: number, kind: number, rot: number) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  if (kind === 0) {
    b.barrel(x, z);
    b.barrel(x + 0.65, z + 0.2);
    b.crate(x - 0.4, z + 0.6, 0.6);
    return;
  }
  g.push().translate(x, y, z).rotateY(rot);
  if (kind === 1) {
    for (let i = 0; i < 4; i++) g.box((r() - 0.5) * 0.6, 0.12 * i, (r() - 0.5) * 0.4, 1.6 + r() * 0.6, 0.14, 0.2, '#5a4632', { kind: K.Wood });
    g.box(0.1, 0.5, 0, 0.1, 1.1, 0.1, '#4a4a54', { kind: K.Metal });
    for (const s of [-1, 1]) g.beam([0.1, 0.5, 0], [0.1, 0.75, s * 0.42], 0.05, '#4a4a54', { kind: K.Metal });
    for (let i = 0; i < 6; i++) g.box(-0.3 - i * 0.16, 0.5, 0.25 + Math.sin(i) * 0.1, 0.14, 0.06, 0.08, '#5a5a62', { kind: K.Metal });
  } else if (kind === 2) {
    g.box(0, 0, 0, 0.7, 0.7, 0.7, '#7a5a3a', { kind: K.Wood });
    g.box(0.75, 0, 0.1, 0.6, 0.6, 0.6, '#6a4a30', { kind: K.Wood });
    g.box(0.3, 0.7, 0, 0.6, 0.5, 0.6, '#7a5a3a', { kind: K.Wood });
    g.box(0.35, 0.95, 0, 1.6, 0.06, 0.9, '#5a6650', { kind: K.Cloth, wind: 0.3 });
  } else {
    g.push().translate(0, 0.32, 0).rotateZ(Math.PI / 2 - 0.1);
    g.cyl(0, -0.8, 0, 0.2, 0.15, 1.6, 8, '#3a3e42', { kind: K.Metal });
    g.pop();
    for (const s of [-1, 1]) g.cyl(0.1, 0, s * 0.25, 0.22, 0.22, 0.08, 8, '#5a4632', { kind: K.Wood });
  }
  g.pop();
  b.collide({ kind: 'c', x: x + 0.2, z, r: 0.75, y0: y - 1, y1: y + 1 });
}

// ---------- the coral village ----------

/** A boardwalk from a to c at deckY, w wide: planks across it on posts down to the floor; walkable (its cells
 *  get a deck). */
export function boardwalk(b: Builder, a: [number, number], c: [number, number], w: number, deckY: number) {
  const g = b.g((a[0] + c[0]) / 2, (a[1] + c[1]) / 2), r = b.rng, grid = b.grid;
  const dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz), rot = Math.atan2(dz, dx);
  g.push().translate(a[0], deckY, a[1]).rotateY(-rot);
  for (let s = 0.2; s < len; s += 0.42) g.box(s, -0.12, (r() - 0.5) * 0.04, 0.38, 0.12, w * (0.94 + r() * 0.08), r() < 0.2 ? '#5e4430' : '#7a5c40', { kind: K.Wood, shade: 0.8 + r() * 0.3 });
  for (let s = 0.3; s < len; s += 1.7)
    for (const side of [-1, 1]) {
      const px = a[0] + Math.cos(rot) * s - Math.sin(rot) * side * w * 0.5, pz = a[1] + Math.sin(rot) * s + Math.cos(rot) * side * w * 0.5;
      const floor = b.y(px, pz) - 0.2;
      if (floor < deckY - 0.2) g.box(s, floor - deckY, side * w * 0.5, 0.16, deckY - floor - 0.05, 0.16, '#4e3826', { kind: K.Wood });
    }
  g.pop();
  for (let z = Math.floor(Math.min(a[1], c[1]) - w); z <= Math.ceil(Math.max(a[1], c[1]) + w); z++)
    for (let x = Math.floor(Math.min(a[0], c[0]) - w); x <= Math.ceil(Math.max(a[0], c[0]) + w); x++) {
      if (!grid.inside(x, z)) continue;
      const t = Math.max(0, Math.min(1, ((x + 0.5 - a[0]) * dx + (z + 0.5 - a[1]) * dz) / (len * len)));
      if (Math.hypot(x + 0.5 - (a[0] + dx * t), z + 0.5 - (a[1] + dz * t)) <= w / 2 + 0.2) {
        const i = grid.i(x, z);
        if (grid.h[i] < deckY) grid.deck[i] = deckY;
      }
    }
}

/** A fisher's house on stilts over the coral shallows: a plank hut painted in faded sea colours, a roof of
 *  dried kelp thatch, a porch toward `rot` (to the boardwalk), lit windows, a glass-float lantern by the door,
 *  nets hung on the porch rail. The hut is solid; its platform and porch are walkable. */
export function stiltHouse(b: Builder, x: number, z: number, rot: number, deckY = 0.9) {
  const g = b.g(x, z), gl = b.gl(x, z), r = b.rng, grid = b.grid;
  const paint = ['#4a8a8c', '#b86a5c', '#c8b890', '#5a7aa0', '#8a9a6a'][Math.floor(r() * 5)];
  const W = 2.8 + r() * 0.6, D = 2.4 + r() * 0.4, H = 1.9;
  g.push().translate(x, deckY, z).rotateY(-rot);
  // The platform on its stilts.
  g.box(0.5, -0.14, 0, W + 1.8, 0.14, D + 0.6, '#6e5038', { kind: K.Wood });
  for (const [sx, sz] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2], [W / 2 + 1.3, -D / 2], [W / 2 + 1.3, D / 2]]) g.box(sx, -3.4, sz, 0.2, 3.3, 0.2, '#4e3826', { kind: K.Wood });
  // The hut: planks, a darker skirting, the door to the porch (+x), a window either side.
  g.box(0, 0, 0, W, H, D, paint, { kind: K.Wood });
  g.box(0, 0, 0, W + 0.04, 0.22, D + 0.04, '#5a4230', { kind: K.Wood });
  g.box(W / 2 + 0.02, 0, 0, 0.06, 1.35, 0.7, '#3a2a1e', { kind: K.Wood });
  for (const s of [-1, 1]) {
    gl.box(s * 0.6, 1.0, D / 2 + 0.03, 0.42, 0.42, 0.02, [2.6, 1.7, 0.7], { kind: 0 });
    g.box(s * 0.6, 0.95, D / 2 + 0.04, 0.52, 0.06, 0.03, '#4e3826', { kind: K.Wood });
  }
  // The roof: dried kelp over a ridge, overhanging.
  g.gable(0, H, 0, W + 0.7, D + 0.7, 1.15, '#6a6a3a', '#5a4632', { kind: K.Thatch });
  // The porch rail, nets drying on it.
  g.box(W / 2 + 1.4, 0, 0, 0.08, 0.9, D + 0.5, '#4e3826', { kind: K.Wood });
  g.box(W / 2 + 1.42, 0.25, 0, 0.04, 0.6, D * 0.8, '#8a8a6a', { kind: K.Cloth, wind: 0.4 });
  g.pop();
  // A glass-float lantern by the door.
  const c = Math.cos(rot), s = Math.sin(rot);
  const lx = x + c * (W / 2 + 0.5) - s * (D / 2 + 0.1), lz = z + s * (W / 2 + 0.5) + c * (D / 2 + 0.1);
  g.box(lx, deckY, lz, 0.08, 1.6, 0.08, '#3a2a1e', { kind: K.Wood });
  gl.blob(lx, deckY + 1.72, lz, 0.13, 0.13, 0.13, [0.8, 2.4, 1.7], 91, { detail: 1, jitter: 0 });
  b.lights.add(lx, deckY + 1.9, lz, 0x8ae8c0, 2.4, 6, 0.15);
  // The platform and porch are deck; the hut is solid.
  for (let zz = Math.floor(z - 4); zz <= Math.ceil(z + 4); zz++)
    for (let xx = Math.floor(x - 4); xx <= Math.ceil(x + 4); xx++) {
      if (!grid.inside(xx, zz)) continue;
      const u = (xx + 0.5 - x) * c + (zz + 0.5 - z) * s, v = -(xx + 0.5 - x) * s + (zz + 0.5 - z) * c;
      if (u > -W / 2 - 0.4 && u < W / 2 + 1.8 && Math.abs(v) < D / 2 + 0.3) {
        const i = grid.i(xx, zz);
        if (grid.h[i] < deckY) grid.deck[i] = deckY;
      }
    }
  b.collide({ kind: 'c', x, z, r: Math.max(W, D) * 0.55, y0: deckY - 4, y1: deckY + H + 1.2 });
}

/** A post with a glass fishing float hung on it, glowing sea-green: the village's lamps. */
export function floatLantern(b: Builder, x: number, z: number, y?: number) {
  const g = b.g(x, z), gl = b.gl(x, z), y0 = y ?? b.y(x, z);
  g.box(x, y0, z, 0.1, 1.7, 0.1, '#3a2a1e', { kind: K.Wood });
  g.box(x + 0.2, y0 + 1.62, z, 0.45, 0.06, 0.06, '#3a2a1e', { kind: K.Wood });
  g.beam([x + 0.38, y0 + 1.62, z], [x + 0.38, y0 + 1.4, z], 0.012, '#8a7a5a');
  gl.blob(x + 0.38, y0 + 1.3, z, 0.12, 0.12, 0.12, [0.8, 2.4, 1.7], 93, { detail: 1, jitter: 0 });
  b.lights.add(x + 0.38, y0 + 1.4, z, 0x8ae8c0, 2, 5, 0.15);
}

/** A rack of kelp hung out to dry: two posts, three bars, strands that sway. */
export function dryingRack(b: Builder, x: number, z: number, rot: number) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  g.push().translate(x, y, z).rotateY(-rot);
  for (const s of [-1, 1]) g.box(s * 0.9, 0, 0, 0.1, 1.6, 0.1, '#4e3826', { kind: K.Wood });
  for (const h of [1.0, 1.3, 1.55]) {
    g.box(0, h, 0, 1.9, 0.05, 0.05, '#5e4430', { kind: K.Wood });
    for (let k = 0; k < 6; k++) g.box(-0.75 + k * 0.3 + (r() - 0.5) * 0.08, h - 0.55, (r() - 0.5) * 0.06, 0.1, 0.55, 0.02, r() < 0.5 ? SEA.kelp : SEA.kelpDark, { kind: K.Leaves, wind: 0.6 });
  }
  g.pop();
  b.collide({ kind: 'c', x, z, r: 0.5, y0: y - 1, y1: y + 1.6 });
}

// ---------- the drowned kingdom ----------

/** A stretch of the kingdom's walls (a house's footing): stone courses with a broken top, barnacled, coral on
 *  it here and there. */
export function ruinWall(b: Builder, x: number, z: number, len: number, rot: number, h = 1.6) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  const c = Math.cos(rot), s = Math.sin(rot);
  g.push().translate(x, y, z).rotateY(-rot);
  for (let a = -len / 2; a < len / 2 - 0.1; a += 0.62) {
    const hh = h * (0.45 + r() * 0.55);
    g.box(a + 0.31, -0.2, 0, 0.6, hh + 0.2, 0.55, r() < 0.5 ? SEA.stone : SEA.stoneDark, { kind: K.Brick });
    if (r() < 0.3) g.cyl(a + 0.31 + (r() - 0.5) * 0.3, hh * (0.3 + r() * 0.5), 0.29, 0.05, 0.03, 0.05, 6, SEA.barnacle, { kind: K.Rock });
  }
  g.pop();
  for (let a = -len / 2 + 0.3; a <= len / 2 - 0.3; a += 0.55) b.collide({ kind: 'c', x: x + c * a, z: z + s * a, r: 0.32, y0: y - 1, y1: y + h * 0.75 });
  if (r() < 0.5) branchCoral(b, x + c * (r() - 0.5) * len * 0.6, z + s * (r() - 0.5) * len * 0.6, 0.5 + r() * 0.3, r() < 0.5 ? SEA.coralPink : SEA.coralOrange);
}

/** An arch of the old town still standing: two piers and a round head of voussoirs, barnacled. */
export function drownedArch(b: Builder, x: number, z: number, rot: number, w = 2.6) {
  const g = b.g(x, z), y = b.y(x, z);
  const c = Math.cos(rot), s = Math.sin(rot);
  g.push().translate(x, y, z).rotateY(-rot);
  for (const side of [-1, 1]) g.box(side * (w / 2 + 0.3), 0, 0, 0.6, 2.4, 0.7, SEA.stone, { kind: K.Brick });
  for (let k = 0; k <= 8; k++) {
    const a = (k / 8) * Math.PI;
    g.push().translate(Math.cos(a) * (w / 2 + 0.3), 2.4 + Math.sin(a) * (w / 2 + 0.3), 0).rotateZ(a - Math.PI / 2);
    g.box(0, -0.25, 0, 0.42, 0.5, 0.7, k % 2 ? SEA.stoneDark : SEA.stone, { kind: K.Brick });
    g.pop();
  }
  g.pop();
  for (const side of [-1, 1]) b.collide({ kind: 'c', x: x + c * side * (w / 2 + 0.3), z: z + s * side * (w / 2 + 0.3), r: 0.45, y0: y - 1, y1: y + 2.6 + w / 2 });
}

/** A tower of the drowned kingdom: round, of big stones, a window or two, its top broken off (it breaks the
 *  surface where the floor is shallow enough). */
export function drownedTower(b: Builder, x: number, z: number, rad: number, h: number) {
  const g = b.g(x, z), gl = b.gl(x, z), y = b.y(x, z), r = b.rng;
  g.cyl(x, y - 0.3, z, rad + 0.25, rad + 0.1, 0.6, 12, SEA.stoneDark, { kind: K.Rock });
  g.cyl(x, y, z, rad, rad * 0.94, h, 12, SEA.stone, { kind: K.Brick, top: SEA.stoneDark });
  for (let i = 0; i < 12; i++) {
    if (r() < 0.35) continue;
    const a = (i / 12) * Math.PI * 2;
    g.box(x + Math.cos(a) * (rad * 0.9), y + h, z + Math.sin(a) * (rad * 0.9), 0.5, 0.25 + r() * 0.5, 0.5, SEA.stone, { kind: K.Brick });
  }
  for (const a of [0.6, 2.4]) gl.box(x + Math.cos(a) * (rad + 0.01), y + h * 0.55, z + Math.sin(a) * (rad + 0.01), 0.24, 0.6, 0.24, [0.04, 0.06, 0.08], { kind: 0 });
  for (let k = 0; k < 14; k++) {
    const a = r() * Math.PI * 2;
    g.cyl(x + Math.cos(a) * rad, y + 0.3 + r() * (h - 0.6), z + Math.sin(a) * rad, 0.06, 0.03, 0.06, 6, SEA.barnacle, { kind: K.Rock });
  }
  b.collide({ kind: 'c', x, z, r: rad + 0.1, y0: y - 1, y1: y + h });
}

/** A column of bubbles roaring up from a crack in the floor: it lifts a diver to its top (and gives him air). */
export function bubbleColumn(b: Builder, x: number, z: number) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + r() * 0.4;
    g.blob(x + Math.cos(a) * 1.0, y + 0.08, z + Math.sin(a) * 1.0, 0.3, 0.18, 0.26, k % 2 ? SEA.stone : SEA.stoneDark, Math.floor(r() * 999), { kind: K.Rock, flatBottom: true });
  }
  g.cyl(x, y - 0.02, z, 0.6, 0.6, 0.03, 10, '#141c20');
  b.fx.addEmitter({ x, y: y + 0.1, z, rate: 46, spec: P.seaBubble, spread: 1.3, vy: 3.4 });
  b.lights.add(x, y + 1, z, 0x60d0d8, 2.4, 5, 0.2);
}

// ---------- the sunken ship ----------

/**
 * The ship broken on its rock (keel along `a`, bow toward +a): its bow up on the rock shelf with its deck above
 * the water (walkable), the rest of its deck fallen in so the hold lies open; on the side toward the camera the
 * hull is stove in (a breach at the floor to swim in by), on the far side it still stands. At the stern its
 * cabin, a step up from the hold, its roof whole (air trapped under it). Returns where the story's things go:
 * the column of bubbles up from the hold onto the bow deck, the cabin's air, a chest on the deck, the
 * captain's chest in the cabin; where its fallen mast's heel rests, on the far side's gunwale.
 */
export function wreck(b: Builder, x: number, z: number, a: number) {
  const g = b.g(x, z), gl = b.gl(x, z), r = b.rng, grid = b.grid, y0 = b.y(x, z);
  const c = Math.cos(a), s = Math.sin(a);
  /** Ship (along the keel, across it toward the camera's side) to world. */
  const W = (u: number, v: number): [number, number] => [x + c * u - s * v, z + s * u + c * v];
  const L = 7.5, H = 3.5;
  const half = (u: number) => (u < 3 ? 2.3 : Math.max(0.3, 2.3 - ((u - 3) / (L - 3)) * 2));
  const wood = '#5a4230', woodD = '#3e2c20', woodL = '#7a5c40';
  // (Group 31: drawn as a hull, not a frame.) The hull: planked strake on strake from the keel, sunk in the silt, to
  // a sheer line rising toward the bow; round in the bilge, fine at the bow, the stem raked forward; weed-dark below
  // the water, weathered grey above it. The far side stands whole. The near side is stove in: the breach at the floor,
  // only the lowest strakes left along the hold, and under the bow deck a gash with the top strakes still over it.
  const sea = -y0;
  const sheer = (u: number) => H + 0.15 + 0.85 * Math.max(0, (u - 2.5) / (L - 1.9)) ** 2 + 0.35 * Math.max(0, (-u - 3.5) / (L - 3.5)) ** 2;
  const keelY = (u: number) => -1.5 + 2.6 * Math.max(0, (u - (L - 3.4)) / 3.4) ** 2;
  const ends = (t: number): [number, number] => [-L, L - 1 + 1.6 * Math.pow(t, 0.7)];
  const hull = (u: number, t: number, side: number): V3 => {
    const f = Math.pow(Math.min(1, Math.max(0, (ends(t)[1] - u) / 1.4)), 0.6), p = 3.6 - 2.2 * Math.max(0, (u - 2) / (L - 2)), ky = keelY(u);
    return [u, ky + (sheer(u) - ky) * t, side * (0.1 + (half(Math.min(u, L)) - 0.1) * (1 - Math.pow(1 - t, p)) * f)];
  };
  const gash = (u: number, y: number) => (Math.abs(u) < 1.4 ? y < -0.1 : u < -4.4 || y < 0.85 + ((u * 7.3) % 1) * 0.35 || (u > 2.7 && y > 1.95 && y < H + 0.25));
  g.push().translate(x, y0, z).rotateY(-a);
  planking(g, hull, ends, 14, 0.62, (y, k) => (y < sea - 0.35 ? (k % 2 ? '#3a3630' : '#46403a') : y < sea + 0.1 ? '#4a5a3c' : k % 2 ? '#86725a' : '#968066'), (side, _k, u, y) => y > -0.3 && (side < 0 ? r() > 0.04 || y < 0.6 || y > H - 0.4 : gash(u, y)));
  // The frames inside the planking (where it's gone, ribs; along the breach and the hold's near side, snapped off).
  for (let u = -L + 0.7; u < L - 0.6; u += 1.05)
    for (const side of [-1, 1]) {
      const ky = keelY(u), t0 = Math.max(0, (-0.2 - ky) / (sheer(u) - ky));
      let top = sheer(u);
      if (side > 0 && Math.abs(u) < 1.6) top = 0.3 + r() * 0.6;
      else if (side > 0 && u > -4.4 && u < 2.7) top = 1.3 + r() * 1.2;
      // (Not under the bow on the near side: nothing to hold up the gash there but its top strakes.)
      else if (side > 0 && u >= 2.7) continue;
      const t1 = (top - ky) / (sheer(u) - ky);
      const pts: V3[] = [];
      for (let i = 0; i <= 4; i++) {
        const [hu, hy, hv] = hull(u, t0 + ((t1 - t0) * i) / 4, side);
        pts.push([hu, hy, hv * 0.93]);
      }
      g.sweep(pts, [0.1, 0.09, 0.09, 0.08, 0.07], woodD, { kind: K.Wood, seg: 4, lumpy: 0.1, squash: 0.7 });
    }
  // The gunwale's cap along the far side, and the near side's where it still stands (at the stern).
  for (const side of [-1, 1]) {
    const pts: V3[] = [];
    for (let u = -L; u <= (side < 0 ? L + 0.5 : -4.2); u += 0.75) pts.push(hull(u, 1, side * 1.02));
    g.sweep(pts, pts.map(() => 0.08), woodD, { kind: K.Wood, seg: 4, lumpy: 0.05, squash: 0.6 });
  }
  // The stem, from the forefoot rising out of the silt, raked forward to its head; a stub of the bowsprit; the
  // transom across the stern.
  const stem: V3[] = [[L - 3.4, -1.2, 0]];
  for (const t of [0, 0.25, 0.5, 0.75, 1]) stem.push(hull(ends(t)[1] - 0.05, t, 0));
  stem.push([L + 0.75, sheer(L + 0.6) + 0.7, 0]);
  g.sweep(stem, stem.map((_, i) => 0.16 - i * 0.008), woodD, { kind: K.Wood, seg: 6, lumpy: 0.08 });
  g.sweep([[L + 0.5, sheer(L + 0.5) + 0.3, 0], [L + 1.6, sheer(L + 0.5) + 0.75, 0.04], [L + 2.4, sheer(L + 0.5) + 1.05, 0.1]], [0.14, 0.12, 0.09], wood, { kind: K.Wood, seg: 6, lumpy: 0.1 });
  for (let k = 3; k < 10; k++) {
    const p0 = hull(-L, k / 10, -1), p1 = hull(-L, (k + 1) / 10, -1);
    quad2(g, p0, [p0[0], p0[1], -p0[2]], [p1[0], p1[1], -p1[2]], p1, p0[1] < sea - 0.35 ? '#3a3630' : wood, { kind: K.Wood });
  }
  // The bow deck, above the water: its planks (broken off ragged where the deck fell in), a hatch, coils of rope; a
  // stump of the foremast.
  for (let u = 2.6; u < L - 0.3; u += 0.42) {
    const ky = keelY(u), w = hull(u, (H - ky) / (sheer(u) - ky), 1)[2], torn = u < 3.1 ? 0.35 + r() * 0.5 : 1;
    g.box(u, H, -w * (1 - torn), 0.4, 0.12, w * 2 * torn, woodL, { kind: K.Wood, shade: 0.85 + r() * 0.3 });
  }
  g.box(4.0, H + 0.12, -0.5, 0.9, 0.1, 0.8, woodD, { kind: K.Wood });
  g.box(4.0, H + 0.13, -0.5, 0.7, 0.1, 0.6, '#1c1814');
  g.cyl(6.1, H + 0.12, -0.25, 0.32, 0.3, 0.14, 8, '#6a5e48', { kind: K.Cloth });
  g.cyl(4.6, H, 0, 0.22, 0.18, 2.4, 8, woodD, { kind: K.Wood });
  // Midships the deck has fallen in: a beam still across, another snapped and hanging into the hold.
  g.box(-3.4, H - 0.1, 0, 0.18, 0.18, half(-3.4) * 2, woodD, { kind: K.Wood });
  g.beam([-1.2, H - 0.05, -2.2], [-1.2, H - 0.1, 0.2], 0.09, woodD, { kind: K.Wood });
  g.beam([-1.2, H - 0.1, 0.2], [-1.5, 1.4, -1.2], 0.08, woodD, { kind: K.Wood });
  // The stern cabin: its floor a step up, its walls (a doorway to the hold), its roof, a lantern still lit; light
  // in its windows, a rail round its roof.
  g.box(-5.9, 1.05, 0, 2.8, 0.15, 4.2, woodL, { kind: K.Wood });
  for (const side of [-1, 1]) g.box(-5.9, 1.2, side * 2.1, 2.8, 3.4, 0.14, '#7a6650', { kind: K.Wood });
  g.box(-7.35, 1.2, 0, 0.14, 3.4, 4.2, '#7a6650', { kind: K.Wood });
  for (const side of [-1, 1]) g.box(-4.5, 1.2, side * 1.35, 0.14, 3.4, 1.5, '#7a6650', { kind: K.Wood });
  g.box(-5.9, 4.6, 0, 3.2, 0.18, 4.6, '#6a5844', { kind: K.Wood });
  gl.box(-6.6, 2.6, -1.6, 0.16, 0.22, 0.16, [3.2, 2.2, 0.9], { kind: 0 });
  for (const u of [-6.6, -5.3]) {
    gl.box(u, 3.95, 2.18, 0.42, 0.42, 0.02, [1.9, 1.2, 0.45], { kind: 0 });
    g.box(u, 3.9, 2.19, 0.52, 0.06, 0.03, woodD, { kind: K.Wood });
  }
  for (const side of [-1, 1]) gl.box(-4.42, 3.3, side * 1.4, 0.02, 0.42, 0.36, [1.9, 1.2, 0.45], { kind: 0 });
  for (const v of [-1.2, 1.2]) gl.box(-7.43, 3.6, v, 0.02, 0.45, 0.5, [1.9, 1.2, 0.45], { kind: 0 });
  for (const [u, v] of [[-7.4, -2.2], [-7.4, 2.2], [-4.45, -2.2], [-4.45, 2.2], [-5.9, -2.25], [-5.9, 2.25]]) g.box(u, 4.78, v, 0.08, 0.45, 0.08, woodD, { kind: K.Wood });
  for (const side of [-1, 1]) g.box(-5.9, 5.2, side * 2.22, 3.0, 0.06, 0.06, woodD, { kind: K.Wood });
  // Weed hanging off it below the water, barnacles crusting it; rigging trailing from the bow over the side.
  for (let k = 0; k < 26; k++) {
    const u = -L + 0.4 + r() * (2 * L - 1.4), side = r() < 0.5 ? -1 : 1, ky = keelY(u), t = (r() * Math.min(sea - 0.4, 2.2) + 0.1 - ky) / (sheer(u) - ky);
    if (side > 0 && !gash(u, ky + (sheer(u) - ky) * t)) continue;
    const [hu, hy, hv] = hull(u, t, side);
    if (k % 3) g.cyl(hu, hy, hv + side * 0.03, 0.06, 0.035, 0.07, 6, SEA.barnacle, { kind: K.Rock });
    else g.sweep([[hu, hy + 0.1, hv + side * 0.05], [hu + 0.1, hy - 0.35, hv + side * 0.12], [hu - 0.05, hy - 0.8, hv + side * 0.1]], [0.07, 0.06, 0.02], SEA.kelpDark, { kind: K.Leaves, seg: 4, lumpy: 0, squash: 0.3, wind: 4 });
  }
  const rope = (p: V3[]) => g.sweep(p, p.map(() => 0.035), '#6a5e48', { seg: 4, lumpy: 0, wind: 2, cap: false });
  const sh = sheer(L + 0.5);
  rope([[L + 2.3, sh + 1.0, 0.1], [L + 2.0, sh + 0.2, 0.6], [L + 1.6, sh - 1.0, 1.2], [L + 1.2, sh - 2.6, 1.7]]);
  rope([[L + 0.7, sh + 0.6, 0], [L + 0.4, sh - 0.2, -0.8], [L, sh - 1.4, -1.6], [L - 0.5, sh - 3.2, -2.2]]);
  rope([[4.6, H + 2.3, 0.05], [4.4, H + 1.2, 1.4], [4.2, H - 0.2, 2.5], [3.9, H - 2.2, 3.1]]);
  g.pop();
  const [lx, lz] = W(-6.6, -1.6);
  b.lights.add(lx, y0 + 2.7, lz, 0xffc070, 3, 6, 0.1);
  // The hull's sides are solid (the breach and the doorway apart); the bow deck is walkable; the cabin's floor.
  for (let u = -L + 0.3; u < L; u += 0.6) {
    const w = half(u);
    const [fx, fz] = W(u, -w);
    b.collide({ kind: 'c', x: fx, z: fz, r: 0.35, y0: y0 - 1, y1: y0 + H + 0.2 });
    if (Math.abs(u) > 1.4) {
      const [nx, nz] = W(u, w);
      b.collide({ kind: 'c', x: nx, z: nz, r: 0.35, y0: y0 - 1, y1: y0 + (u < -4.4 ? H + 0.2 : 1.1) });
    }
  }
  for (const v of [-1.9, -1.2, 1.2, 1.9]) {
    const [cx2, cz2] = W(-7.3, v);
    b.collide({ kind: 'c', x: cx2, z: cz2, r: 0.35, y0: y0 - 1, y1: y0 + 4.8 });
  }
  for (const side of [-1, 1]) {
    const [dx, dz] = W(-4.5, side * 1.4);
    b.collide({ kind: 'c', x: dx, z: dz, r: 0.45, y0: y0 + 1, y1: y0 + 4.6 });
  }
  const deckY = y0 + H + 0.12, cabinY = y0 + 1.2;
  for (let zz = Math.floor(z - 9); zz <= Math.ceil(z + 9); zz++)
    for (let xx = Math.floor(x - 9); xx <= Math.ceil(x + 9); xx++) {
      if (!grid.inside(xx, zz)) continue;
      const px = xx + 0.5 - x, pz = zz + 0.5 - z, u = px * c + pz * s, v = -px * s + pz * c;
      const i = grid.i(xx, zz);
      if (u > 2.7 && u < L - 0.5 && Math.abs(v) < half(u) - 0.25) grid.deck[i] = deckY;
      else if (u > -7.1 && u < -4.7 && Math.abs(v) < 1.9) grid.h[i] = Math.max(grid.h[i], cabinY);
    }
  const at = (u: number, v: number) => {
    const [wx, wz] = W(u, v);
    return { x: wx, z: wz };
  };
  return { lift: at(1.6, 0), cabin: at(-5.9, 0), bowChest: { ...at(5.2, 0.6), rot: a + Math.PI / 2 }, cabinChest: { ...at(-6.5, 1.1), rot: a }, mast: { ...at(-0.4, -2.05), y: y0 + H + 0.4 } };
}

// ---------- the strand, the kelp forest, the wreck's mast (group 31) ----------

type V3 = [number, number, number];

/** A quad seen from both sides (the world's faces are one-sided): sailcloth, nets, blades of grass. */
function quad2(g: Geo, a: V3, b: V3, c: V3, d: V3, col: string, o: Parameters<Geo['quad']>[5] = {}) {
  g.quad(a, b, c, d, col, o);
  g.quad(d, c, b, a, col, o);
}

export const SHORE = {
  drift: '#948a78',
  driftDark: '#6e6556',
  wrack: '#3e3c22',
  wrack2: '#56502c',
  shell: '#ddd5c2',
  shellPink: '#d2a89a',
  marram: '#9aa66a',
  marramDry: '#c2b47c',
  rock: '#6e6a70',
  rockDark: '#57535e',
  sail: '#bcae8c',
  sailPatch: '#98886a',
  net: '#7a7660',
  cork: '#a87c48',
  kelp: '#8c7a30',
  kelpBlade: '#a8923c',
  kelpCrown: '#9a8836',
};

/** Driftwood: a trunk the sea has stripped and bleached, lying where the tide left it, knobbly and bent, the stubs
 *  of its roots at one end and of a branch or two along it. rot is its heading (toward the crown end). */
export function driftwood(b: Builder, x: number, z: number, len: number, rot: number) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng, c = Math.cos(rot), s = Math.sin(rot);
  const R = 0.1 + len * 0.035, steps = Math.max(4, Math.round(len / 0.45)), bend = (r() - 0.5) * 0.6, ph = r() * 6;
  const pts: V3[] = [], rad: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, a = (t - 0.5) * len, off = Math.sin(t * Math.PI) * bend * len * 0.22 + Math.sin(t * 7 + ph) * 0.05;
    const px = x + c * a - s * off, pz = z + s * a + c * off, rr = R * (1.15 - 0.6 * t) * (i && r() < 0.25 ? 1.15 : 1);
    pts.push([px, b.y(px, pz) + rr * 0.5, pz]);
    rad.push(rr);
  }
  g.sweep(pts, rad, (i) => (i % 3 === 1 ? SHORE.driftDark : SHORE.drift), { kind: K.Bark, seg: 6, lumpy: 0.25, seed: Math.floor(r() * 9999), squash: 0.85 });
  const [rx, ry, rz] = pts[0];
  for (let k = 0; k < 4; k++) {
    const a = rot + Math.PI + (r() - 0.5) * 2.6, L = (0.35 + r() * 0.4) * (R / 0.17), up = (r() - 0.3) * 0.5;
    g.sweep([[rx, ry, rz], [rx + Math.cos(a) * L * 0.55, ry + up * L, rz + Math.sin(a) * L * 0.55], [rx + Math.cos(a) * L, ry + (up - 0.3) * L, rz + Math.sin(a) * L]], [R * 0.55, R * 0.32, R * 0.08], SHORE.drift, { kind: K.Bark, seg: 4, lumpy: 0.2, seed: k + 7 });
  }
  for (let k = 0, n = 1 + Math.floor(r() * 2); k < n; k++) {
    const i = 1 + Math.floor(r() * (steps - 2)), [bx, by, bz] = pts[i], a = rot + (r() < 0.5 ? 1 : -1) * (0.5 + r() * 0.6), L = 0.4 + r() * 0.5;
    g.sweep([[bx, by, bz], [bx + Math.cos(a) * L, by + 0.15 + r() * 0.3, bz + Math.sin(a) * L]], [rad[i] * 0.45, rad[i] * 0.15], SHORE.drift, { kind: K.Bark, seg: 4, lumpy: 0.2, seed: k + 3 });
  }
  if (len > 1.8) for (let i = 1; i < steps; i += 2) b.collide({ kind: 'c', x: pts[i][0], z: pts[i][2], r: rad[i] + 0.05, y0: y - 1, y1: pts[i][1] + rad[i] });
}

/** Wrack along the tide line: a low windrow of washed-up kelp, strands of it flung out flat, shells, now and then a
 *  cork float off a net. Underfoot (no collider). */
export function wrack(b: Builder, x: number, z: number, len: number, rot: number) {
  const d = b.d(x, z), r = b.rng, c = Math.cos(rot), s = Math.sin(rot);
  const n = Math.max(2, Math.round(len / 0.6));
  for (let k = 0; k < n; k++) {
    const f = k / (n - 1), a = (f - 0.5) * len + (r() - 0.5) * 0.3, off = (r() - 0.5) * 0.45, sz = (0.45 + 0.55 * Math.sin(f * Math.PI)) * (0.7 + r() * 0.5);
    const px = x + c * a - s * off, pz = z + s * a + c * off;
    d.blob(px, b.y(px, pz) + 0.02, pz, 0.42 * sz, 0.14 * sz, 0.32 * sz, r() < 0.5 ? SHORE.wrack : SHORE.wrack2, Math.floor(r() * 999), { kind: K.Leaves, flatBottom: true, jitter: 0.35 });
  }
  for (let k = 0; k <= n; k++) {
    const a0 = (r() - 0.5) * len, side = r() < 0.6 ? 1 : -1, ang = rot + side * (1.2 + (r() - 0.5) * 0.9), L = 0.6 + r() * 0.8;
    const px = x + c * a0, pz = z + s * a0, mx = px + Math.cos(ang) * L * 0.5 + (r() - 0.5) * 0.2, mz = pz + Math.sin(ang) * L * 0.5, ex = px + Math.cos(ang) * L, ez = pz + Math.sin(ang) * L;
    d.sweep([[px, b.y(px, pz) + 0.06, pz], [mx, b.y(mx, mz) + 0.04, mz], [ex, b.y(ex, ez) + 0.03, ez]], [0.08, 0.11, 0.04], SHORE.wrack2, { kind: K.Leaves, seg: 4, lumpy: 0, squash: 0.2 });
  }
  for (let k = 0; k < n + 2; k++) {
    const a = (r() - 0.5) * (len + 1), off = (r() - 0.5) * 1.4, px = x + c * a - s * off, pz = z + s * a + c * off;
    d.blob(px, b.y(px, pz) + 0.01, pz, 0.07, 0.035, 0.055, r() < 0.65 ? SHORE.shell : SHORE.shellPink, Math.floor(r() * 999), { flatBottom: true, jitter: 0.1 });
  }
  if (r() < 0.3) d.blob(x + (r() - 0.5) * len * 0.6, b.y(x, z) + 0.12, z + (r() - 0.5) * 0.4, 0.12, 0.12, 0.12, SHORE.cork, Math.floor(r() * 999), { jitter: 0.05 });
}

/** A tuft of marram grass: stiff blades arching out of the sand, pale green going to straw. */
export function marram(b: Builder, x: number, z: number, s = 1) {
  const g = b.g(x, z), y = b.y(x, z) - 0.03, r = b.rng;
  const n = 14 + Math.floor(r() * 9), dry = r() * 0.5;
  for (let k = 0; k < n; k++) {
    const a = r() * Math.PI * 2, lean = 0.35 + r() * 0.55, H = (0.45 + r() * 0.4) * s, w = 0.065 * s;
    const bx = x + Math.cos(a) * 0.08 * s, bz = z + Math.sin(a) * 0.08 * s, ca = Math.cos(a), sa = Math.sin(a);
    const mx = bx + ca * lean * H * 0.4, mz = bz + sa * lean * H * 0.4, my = y + H * 0.62;
    const tx = bx + ca * lean * H * 1.15, tz = bz + sa * lean * H * 1.15, ty = y + H * (1 - lean * 0.35);
    const px = -sa * w, pz = ca * w, col = r() < 0.25 + dry ? SHORE.marramDry : SHORE.marram;
    quad2(g, [bx - px, y, bz - pz], [bx + px, y, bz + pz], [mx + px * 0.7, my, mz + pz * 0.7], [mx - px * 0.7, my, mz - pz * 0.7], col, { wind: 0.25, shade: 1.5 });
    g.tri([mx - px * 0.7, my, mz - pz * 0.7], [mx + px * 0.7, my, mz + pz * 0.7], [tx, ty, tz], col, { wind: 0.8, shade: 1.5 });
    g.tri([tx, ty, tz], [mx + px * 0.7, my, mz + pz * 0.7], [mx - px * 0.7, my, mz - pz * 0.7], col, { wind: 0.8, shade: 1.5 });
  }
}

/** A knoll of the coast's rock: a broad low mass, a second rising out of it a step higher, a broken top, boulders
 *  fallen round its foot. Solid. rot turns it. */
export function knoll(b: Builder, x: number, z: number, s = 1, rot = 0) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng, c = Math.cos(rot), sn = Math.sin(rot);
  const col = () => (r() < 0.5 ? SHORE.rock : SHORE.rockDark);
  const steps: [number, number, number, number, number, number][] = [
    [0, 0, 1.5, 0.55, 1.05, 0.05],
    [0.35, -0.2, 1.0, 0.55, 0.8, 0.5],
    [-0.25 + r() * 0.3, 0.15, 0.55, 0.4, 0.5, 0.95],
  ];
  for (const [u, v, rx, ry, rz, h] of steps) {
    g.push().translate(x + (c * u - sn * v) * s, y + h * s, z + (sn * u + c * v) * s).rotateY(-rot);
    g.blob(0, 0, 0, rx * s * (0.9 + r() * 0.2), ry * s, rz * s * (0.9 + r() * 0.2), col(), Math.floor(r() * 999), { kind: K.Rock, jitter: 0.25, flatBottom: true });
    g.pop();
  }
  for (let k = 0, n = 2 + Math.floor(r() * 4); k < n; k++) {
    const a = r() * Math.PI * 2, d = (1.5 + r() * 0.9) * s, bs = (0.18 + r() * 0.3) * s, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    g.blob(px, b.y(px, pz) + bs * 0.3, pz, bs * 1.2, bs, bs, col(), Math.floor(r() * 999), { kind: K.Rock, jitter: 0.3, flatBottom: true });
  }
  b.collide({ kind: 'c', x, z, r: 1.15 * s, y0: y - 1, y1: y + 1.2 * s });
}

/** The crew's tent: an old sail over a crooked spar on crossed oars, patched, sagging, pegged out with its guy ropes;
 *  a dark inside under its open end (toward +rot). */
export function sailTent(b: Builder, x: number, z: number, rot: number, w = 2.8) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng, H = 1.55, half = 1.3;
  g.push().translate(x, y, z).rotateY(-rot);
  for (const e of [-1, 1]) for (const s of [-1, 1]) g.beam([e * w * 0.5, -0.1, s * 0.45], [e * w * 0.5, H + 0.28, -s * 0.1], 0.04, '#5a4632', { kind: K.Wood });
  g.sweep([[-w * 0.5 - 0.3, H + 0.02, 0], [0, H - 0.1, 0.02], [w * 0.5 + 0.3, H + 0.04, 0]], [0.06, 0.055, 0.05], '#4e3826', { kind: K.Bark, seg: 5, lumpy: 0.15 });
  const sag = (u: number) => Math.sin((u / w + 0.5) * Math.PI) * 0.14;
  for (const s of [-1, 1])
    for (let i = 0; i < 4; i++) {
      const u0 = -w / 2 + (i / 4) * w, u1 = -w / 2 + ((i + 1) / 4) * w, foot = half * (1 + (r() - 0.5) * 0.08);
      quad2(g, [u0, H - sag(u0), 0], [u1, H - sag(u1), 0], [u1 + s * 0.05, 0.02, s * foot], [u0, 0.02, s * foot], r() < 0.3 ? SHORE.sailPatch : SHORE.sail, { kind: K.Cloth, wind: 0.12, shade: 0.85 + r() * 0.25 });
      // A patch sewn on here and there.
      if (r() < 0.35) quad2(g, [u0 + 0.15, H * 0.55 + 0.01, s * half * 0.46], [u0 + 0.5, H * 0.55 + 0.01, s * half * 0.46], [u0 + 0.5, H * 0.3 + 0.01, s * half * 0.71], [u0 + 0.15, H * 0.3 + 0.01, s * half * 0.71], '#7a6a52', { kind: K.Cloth });
    }
  g.tri([-w / 2, H - 0.02, 0], [-w / 2, 0.02, half], [-w / 2, 0.02, -half], SHORE.sailPatch, { kind: K.Cloth, wind: 0.1 });
  g.tri([-w / 2, 0.02, -half], [-w / 2, 0.02, half], [-w / 2, H - 0.02, 0], SHORE.sailPatch, { kind: K.Cloth, wind: 0.1 });
  g.box(0.1, 0.01, 0, w - 0.3, 0.02, half * 1.6, '#24201c');
  for (const e of [-1, 1]) for (const s of [-1, 1]) g.beam([e * w * 0.5, H + 0.15, 0], [e * (w * 0.5 + 1.1), 0.02, s * 0.9], 0.012, '#8a7a5a');
  g.pop();
  const c = Math.cos(rot), sn = Math.sin(rot);
  for (const u of [-w * 0.27, w * 0.27]) b.collide({ kind: 'c', x: x + c * u, z: z + sn * u, r: 1.05, y0: y - 1, y1: y + H });
}

/** A fishing net hung to dry between crooked poles from a to c, cork floats along its head rope, its foot trailing
 *  on the ground, a heap of it below. */
export function netRack(b: Builder, a: [number, number], c: [number, number]) {
  const g = b.g((a[0] + c[0]) / 2, (a[1] + c[1]) / 2), r = b.rng;
  const dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz), n = Math.max(2, Math.round(len / 1.9));
  const poles: V3[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, px = a[0] + dx * t + (r() - 0.5) * 0.15, pz = a[1] + dz * t + (r() - 0.5) * 0.15, y = b.y(px, pz), H = 1.75 + r() * 0.3;
    const lx = (r() - 0.5) * 0.18, lz = (r() - 0.5) * 0.18;
    g.sweep([[px, y - 0.2, pz], [px + lx * 0.4 + (r() - 0.5) * 0.05, y + H * 0.5, pz + lz * 0.4], [px + lx, y + H, pz + lz]], [0.06, 0.05, 0.04], SHORE.driftDark, { kind: K.Bark, seg: 5, lumpy: 0.2, seed: k + 11 });
    poles.push([px + lx, y + H - 0.08, pz + lz]);
    b.collide({ kind: 'c', x: px, z: pz, r: 0.15, y0: y - 1, y1: y + H });
  }
  for (let k = 0; k < n; k++) {
    const [ax, ay, az] = poles[k], [cx, cy, cz] = poles[k + 1], m = 5;
    for (let i = 0; i < m; i++) {
      const t0 = i / m, t1 = (i + 1) / m, s0 = Math.sin(t0 * Math.PI) * 0.22, s1 = Math.sin(t1 * Math.PI) * 0.22;
      const p0: V3 = [ax + (cx - ax) * t0, ay + (cy - ay) * t0 - s0, az + (cz - az) * t0], p1: V3 = [ax + (cx - ax) * t1, ay + (cy - ay) * t1 - s1, az + (cz - az) * t1];
      const f0 = Math.max(b.y(p0[0], p0[2]) + 0.1, p0[1] - 1.1 - r() * 0.3), f1 = Math.max(b.y(p1[0], p1[2]) + 0.1, p1[1] - 1.1 - r() * 0.3);
      quad2(g, p0, p1, [p1[0], f1, p1[2]], [p0[0], f0, p0[2]], SHORE.net, { kind: K.Cloth, wind: 0.35, shade: 0.8 + r() * 0.3 });
      if (i % 2 === 0) g.blob(p0[0], p0[1] + 0.02, p0[2], 0.08, 0.06, 0.08, SHORE.cork, Math.floor(r() * 999), { jitter: 0.05 });
    }
  }
  const hx = a[0] + dx * 0.5 - (dz / len) * 0.7, hz = a[1] + dz * 0.5 + (dx / len) * 0.7;
  g.blob(hx, b.y(hx, hz) + 0.12, hz, 0.7, 0.28, 0.5, SHORE.net, Math.floor(r() * 999), { kind: K.Cloth, flatBottom: true, jitter: 0.3 });
}

/**
 * A planked hull in local space (x along the keel, its bow toward +x; z across; y up), strake on strake from the keel
 * to the gunwale, each lapped a little over the one below. at(u, t, side) is the hull's point t of the way from keel
 * (0) to gunwale (1) at u along it; ends(t) how far aft and forward the strake at t runs (so they close onto the stem);
 * keep(side, k, u, y) whether that plank is still there (holes, a breach); col its colour.
 */
export function planking(g: Geo, at: (u: number, t: number, side: number) => V3, ends: (t: number) => [number, number], strakes: number, step: number, col: (y: number, k: number) => string, keep: (side: number, k: number, u: number, y: number) => boolean) {
  for (const side of [-1, 1])
    for (let k = 0; k < strakes; k++) {
      const t0 = k / strakes, t1 = (k + 1) / strakes, [a0, a1] = ends(t0), [b0, b1] = ends(t1);
      const n = Math.max(2, Math.ceil(Math.max(a1 - a0, b1 - b0) / step));
      for (let i = 0; i < n; i++) {
        const f0 = i / n, f1 = (i + 1) / n;
        const p00 = at(a0 + (a1 - a0) * f0, t0, side), p01 = at(a0 + (a1 - a0) * f1, t0, side);
        const p11 = at(b0 + (b1 - b0) * f1, t1, side), p10 = at(b0 + (b1 - b0) * f0, t1, side);
        if (!keep(side, k, (p00[0] + p01[0] + p10[0] + p11[0]) / 4, (p00[1] + p11[1]) / 2)) continue;
        // Outside, each plank's lower edge standing proud of the one below (lapped); inside, darker, a plank's
        // thickness in. (Faces are one-sided: each is wound to face its own way.)
        const c = col((p00[1] + p11[1]) / 2, k), shade = 0.88 + ((k * 7 + i * 3) % 5) * 0.05;
        const out = [p00, p01, p11, p10].map((p, j): V3 => [p[0], p[1], p[2] + side * (j < 2 ? 0.035 : 0)]), inn = [p00, p01, p11, p10].map((p): V3 => [p[0], p[1], p[2] - side * 0.04]);
        if (side > 0) g.quad(out[0], out[1], out[2], out[3], c, { kind: K.Wood, shade });
        else g.quad(out[3], out[2], out[1], out[0], c, { kind: K.Wood, shade });
        if (side > 0) g.quad(inn[3], inn[2], inn[1], inn[0], c, { kind: K.Wood, shade: shade * 0.6 });
        else g.quad(inn[0], inn[1], inn[2], inn[3], c, { kind: K.Wood, shade: shade * 0.6 });
      }
    }
}

/** The crew's longboat drawn up on the beach, heeled over on its bilge: clinker-built, oars along its thwarts, a
 *  furled sail in it. rot is its heading (toward its bow). */
export function longboat(b: Builder, x: number, z: number, rot: number) {
  const g = b.g(x, z), y = b.y(x, z), L = 2.7, B = 0.95, D = 0.8;
  g.push().translate(x, y + 0.3, z).rotateY(-rot).rotateX(0.2);
  const at = (u: number, t: number, side: number): V3 => {
    const f = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u) / (L + 0.35 * t), 2.2)), 0.55);
    return [u, -D * 0.55 + D * t + Math.pow(Math.abs(u) / L, 3) * 0.3, side * (0.06 + (B - 0.06) * (1 - Math.pow(1 - t, 2)) * f)];
  };
  planking(g, at, (t) => [-L - 0.35 * t, L + 0.35 * t], 5, 0.45, (_y, k) => (k % 2 ? '#5e4632' : '#6e5238'), () => true);
  g.sweep([[-L - 0.4, D * 0.5, 0], [-L + 0.3, -D * 0.5, 0], [L - 0.3, -D * 0.5, 0], [L + 0.4, D * 0.5, 0]], [0.06, 0.07, 0.07, 0.06], '#4e3826', { kind: K.Wood, seg: 4, lumpy: 0.05 });
  for (const u of [-1.2, 0, 1.2]) {
    const [, ty, tz] = at(u, 0.78, 1);
    g.box(u, ty - 0.05, 0, 0.22, 0.05, tz * 2, '#7a5c40', { kind: K.Wood });
  }
  for (const s of [-1, 1]) g.sweep([[-1.9, 0.1, s * 0.35], [0.2, 0.14, s * 0.38], [2.0, 0.12, s * 0.3]], [0.03, 0.03, 0.06], '#8a6a48', { kind: K.Wood, seg: 4, lumpy: 0.05, squash: 0.5 });
  g.sweep([[-1.3, 0.12, -0.1], [1.2, 0.16, 0.05]], [0.13, 0.11], SHORE.sail, { kind: K.Cloth, seg: 6, lumpy: 0.2 });
  g.pop();
  const c = Math.cos(rot), s = Math.sin(rot);
  for (const u of [-1.8, -0.6, 0.6, 1.8]) b.collide({ kind: 'c', x: x + c * u, z: z + s * u, r: 0.75, y0: y - 1, y1: y + 0.9 });
}

/** A stand of giant kelp, the forest's trees: stipes rising from one holdfast, wavering, a blade off them now and
 *  then; at the top they bow over with the swell and spread their fronds out flat beneath the surface, a canopy over
 *  the floor (foliage: dithered away round the knight). */
export function kelpStand(b: Builder, x: number, z: number, h: number, n = 4) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng, lean = 0.6 + (r() - 0.5) * 0.8;
  g.blob(x, y + 0.06, z, 0.32, 0.16, 0.32, SEA.kelpDark, Math.floor(r() * 999), { kind: K.Leaves, flatBottom: true, jitter: 0.3 });
  for (let k = 0; k < n; k++) {
    const a = r() * Math.PI * 2, d = 0.08 + r() * 0.25, sx = x + Math.cos(a) * d, sz = z + Math.sin(a) * d;
    const H = h * (0.72 + r() * 0.3), ph = r() * 6, segs = 5, bend = 0.5 + r() * 0.7;
    const pt = (t: number): V3 => {
      const off = Math.sin(t * 2.3 + ph) * 0.22 + t * t * bend;
      return [sx + Math.cos(lean) * off + Math.cos(ph) * t * 0.2, y + H * t, sz + Math.sin(lean) * off + Math.sin(ph) * t * 0.2];
    };
    for (let s = 0; s < segs; s++) {
      const t0 = s / segs, t1 = (s + 1) / segs, p0 = pt(t0), p1 = pt(t1);
      g.sweep([p0, p1], [0.075 - t0 * 0.03, 0.075 - t1 * 0.03], s % 2 ? SHORE.kelp : SEA.kelpDark, { seg: 4, lumpy: 0, wind: 1 + t0 * 8, kind: K.Leaves, cap: false });
      if (s > 0) {
        const ba = lean + (s % 2 ? 1.5 : -1.5) + (r() - 0.5) * 0.6, L = 0.6 + r() * 0.5, bx = Math.cos(ba), bz = Math.sin(ba);
        g.sweep([p1, [p1[0] + bx * L * 0.5, p1[1] + 0.1, p1[2] + bz * L * 0.5], [p1[0] + bx * L, p1[1] - 0.25, p1[2] + bz * L]], [0.13, 0.17, 0.05], SHORE.kelpBlade, { seg: 4, lumpy: 0, wind: 3 + t1 * 8, kind: K.Leaves, squash: 0.2 });
      }
    }
    // The fronds at the top, lying out flat under the surface, a float where they meet.
    const top = pt(1);
    for (let f = 0; f < 4; f++) {
      const fa = lean + (f - 1.5) * 0.9 + (r() - 0.5) * 0.5, L = 1.0 + r() * 0.9, fx = Math.cos(fa), fz = Math.sin(fa);
      g.sweep([top, [top[0] + fx * L * 0.5, top[1] + 0.12, top[2] + fz * L * 0.5], [top[0] + fx * L, top[1] + 0.05, top[2] + fz * L]], [0.16, 0.22, 0.07], f % 2 ? SHORE.kelpCrown : SHORE.kelpBlade, { seg: 4, lumpy: 0, wind: 10, kind: K.Leaves, squash: 0.18 });
    }
    g.blob(top[0], top[1] + 0.05, top[2], 0.12, 0.1, 0.12, '#7a7034', Math.floor(r() * 999), { wind: 10 });
  }
}

/** The ship's mainmast, snapped off and fallen over its side: from `heel` (on the gunwale) to `tip` (lying on the
 *  rock), its splintered foot, a yard still across it, rigging trailing off it into the water and a rag of its sail
 *  hanging down the rock. Where it lies low over the ground it's in the way. */
export function fallenMast(b: Builder, heel: V3, tip: V3) {
  const g = b.g(tip[0], tip[2]), r = b.rng, wood = '#5e4a36', dark = '#3e2c20';
  const dx = tip[0] - heel[0], dy = tip[1] - heel[1], dz = tip[2] - heel[2], len = Math.hypot(dx, dy, dz), steps = Math.round(len / 0.9);
  const pts: V3[] = [], rad: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([heel[0] + dx * t + Math.sin(t * 5) * 0.05, heel[1] + dy * t - Math.sin(t * Math.PI) * 0.1, heel[2] + dz * t]);
    rad.push(0.24 - 0.1 * t);
  }
  g.sweep(pts, rad, (i) => (i % 4 === 3 ? dark : wood), { kind: K.Wood, seg: 7, lumpy: 0.06, seed: 31 });
  // The splintered foot: long spikes of torn wood.
  const ux = dx / len, uy = dy / len, uz = dz / len, px = -uz, pz = ux;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2, ox = Math.cos(a) * 0.17, oy = Math.sin(a) * 0.17, L = 0.25 + r() * 0.35;
    g.beam([heel[0] + ox * px, heel[1] + oy, heel[2] + ox * pz], [heel[0] - ux * L + ox * px * 0.5, heel[1] - uy * L + oy * 0.5, heel[2] - uz * L + ox * pz * 0.5], 0.04, k % 2 ? wood : '#8a7458', { kind: K.Wood });
  }
  // A band of iron, the yard still across it near the top, and its rigging.
  const at = (t: number) => pts[Math.round(t * steps)];
  const [ix, iy, iz] = at(0.33);
  g.cyl(ix, iy - 0.26, iz, 0.27, 0.27, 0.1, 8, '#3a3a40', { kind: K.Metal, cap: false });
  const [yx, yy, yz] = at(0.78);
  g.sweep([[yx - px * 2.6, yy + 0.05, yz - pz * 2.6], [yx, yy + 0.3, yz], [yx + px * 1.4, yy + 0.12, yz + pz * 1.4]], [0.1, 0.13, 0.08], wood, { kind: K.Wood, seg: 6, lumpy: 0.06, seed: 33 });
  const rope = (a: V3, c: V3, droop: number) => {
    const m = 6, rp: V3[] = [];
    for (let i = 0; i <= m; i++) {
      const t = i / m;
      rp.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t - Math.sin(t * Math.PI) * droop, a[2] + (c[2] - a[2]) * t]);
    }
    g.sweep(rp, rp.map(() => 0.035), '#6a5e48', { seg: 4, lumpy: 0, wind: 1.5, cap: false });
  };
  for (let k = 0; k < 4; k++) {
    const p = at(0.3 + k * 0.17), a = r() * Math.PI * 2, d = 1.5 + r() * 1.6, ex = p[0] + Math.cos(a) * d, ez = p[2] + Math.sin(a) * d;
    rope(p, [ex, Math.min(p[1] - 1.8, b.y(ex, ez) + 0.1), ez], 0.3);
  }
  rope([yx - px * 2.5, yy, yz - pz * 2.5], [heel[0] - px * 0.2, heel[1] + 0.1, heel[2] - pz * 0.2], 0.9);
  // The rag of the sail off the yard, hanging down the rock's side into the water.
  for (let k = 0; k < 3; k++) {
    const a0 = -2.2 + k * 0.9, a1 = a0 + 0.85, drop = 1.2 + r() * 0.8, out = 0.6 + r() * 0.4;
    const q0: V3 = [yx + px * a0, yy, yz + pz * a0], q1: V3 = [yx + px * a1, yy, yz + pz * a1];
    quad2(g, q0, q1, [q1[0] + ux * out, q1[1] - drop, q1[2] + uz * out], [q0[0] + ux * out, q0[1] - drop * 0.8, q0[2] + uz * out], k === 1 ? SHORE.sailPatch : SHORE.sail, { kind: K.Cloth, wind: 0.6, shade: 0.8 + r() * 0.2 });
  }
  for (let i = 1; i < steps; i++) {
    const [qx, qy, qz] = pts[i];
    if (qy - b.y(qx, qz) < 2.2) b.collide({ kind: 'c', x: qx, z: qz, r: rad[i] + 0.1, y0: qy - rad[i] - 0.4, y1: qy + rad[i] });
  }
}
