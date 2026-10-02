import * as THREE from 'three';
import { K } from '../engine/materials';
import { fbm, mulberry32 } from '../engine/util';
import type { Builder } from './builder';
import type { Geo } from '../engine/geo';
import { S, T, type Grid } from './grid';
import { Painter, insidePoly, type Pt } from './paint';
import type { EnemySpawn, ObjDef, RegionDef } from './realm';
import { WHALE_ISLE } from './reef';
import * as D from './details';
import { anemone, bubbleColumn, bubbleVent, kelp, SEA, seaFan, seaRock } from './sea';

// ---------------------------------------------------------------------------
// The Ink Grotto (realm 3's second mini-boss under the sea): a cavern in the trench's north wall, west of the
// drowned kingdom (and west of the little grotto in src/world/seacaves.ts, which it keeps clear of). An outcrop
// of black rock rises off the shelf at the trench's lip; under its roof a hollow a step below the shelf, its mouth
// open south over the trench (a column of bubbles comes up to it from the trench's floor), a cleft in its east
// face onto the shelf, where a trail of pale shell-grit comes along the kingdom's south-west edge from the vent. In the hollow lies Old Inkarm, the octopus the
// reef's divers have feared for forty years (src/game/inkarm.ts), before the niche where it keeps what shines.
// Its roof and east face lift away while the knight is inside (as the Hollow's do in realm 1); the north and
// west walls are the outcrop itself. A vent at the hollow's west end breathes air. The story's side of it is
// src/game/story/grotto.ts.
// ---------------------------------------------------------------------------

/** The grotto's floor: a hollow a step below the shelf, walled north and west by the outcrop, its mouth open
 *  south onto the trench, a cleft east onto the shelf. The rectangle is its roof's (and the fight's). */
export const GROTTO = { x0: 60, z0: 97.6, x1: 71.2, z1: 105, floor: -5.3 };
/** The underside of its roof. */
const ROOF = GROTTO.floor + 4.1;
/** Where Old Inkarm lies, before its den in the back wall (the hoard's niche behind it). */
export const DEN = { x: 65.6, z: 99.5 };
const NICHE = { x: 65.8, z: 96.5 };
/** The cleft in the east face, onto the shelf (between these z). */
const CLEFT = { z0: 98.4, z1: 100.8 };
/** The air vent at the hollow's west end; the column of bubbles up from the trench's floor to the mouth. */
const VENT = { x: 61.4, z: 103 };
const COLUMN = { x: 67.5, z: 106.4 };
/** The drowned kingdom's outline (as in realm3.ts): the outcrop keeps off its terrace. */
const KINGDOM: Pt[] = [[70, 79], [86, 72], [104, 74], [113, 83], [106, 93], [88, 99], [72, 93]];
/** The trail of shell-grit from the vent by the kingdom's south-west edge to the cleft (north of the little grotto's
 *  roof). */
const TRAIL: Pt[] = [[78.8, 95.6], [75.2, 95.7], [72.9, 97.3], [72.3, 99.6]];
const LORE = { x: 72.5, z: 96.4 };

const ROCK = '#46404f', ROCK_D = '#2c2834', ROCK_L = '#625a70', INK = '#120c18', GOLD = '#e8b84a', GOLD_D = '#a87a2a';
const BRASS = '#b8862e';

/** Inside the hollow (or its niche): its floor. */
function hollow(x: number, z: number) {
  const G = GROTTO;
  return (x > G.x0 && x < G.x1 && z > G.z0 && z < G.z1) || Math.hypot(x - NICHE.x, (z - NICHE.z) * 1.3) < 1.55;
}

/** A heap of what the octopus has hauled into its niche: gold coins in a drift, goblets, a crown, a drowned
 *  knight's helm, pearls glowing among it. */
function hoard(b: Builder, x: number, z: number) {
  const g = b.g(x, z), gl = b.gl(x, z), y = b.y(x, z), r = b.rng;
  g.blob(x, y, z, 1.25, 0.42, 0.85, GOLD_D, 411, { kind: K.Metal, flatBottom: true, jitter: 0.2 });
  for (let k = 0; k < 26; k++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 1.25, cx = x + Math.cos(a) * d, cz = z + Math.sin(a) * d * 0.7;
    g.cyl(cx, y + 0.34 * (1 - d / 1.4) + r() * 0.06, cz, 0.09, 0.09, 0.025, 7, r() < 0.7 ? GOLD : GOLD_D, { kind: K.Metal });
  }
  for (let k = 0; k < 9; k++) {
    const a = r() * Math.PI * 2, d = 1.2 + r() * 0.7;
    g.cyl(x + Math.cos(a) * d, y, z + Math.sin(a) * d * 0.8, 0.09, 0.09, 0.025, 7, GOLD, { kind: K.Metal });
  }
  // Two goblets, one on its side; a crown askew on the heap.
  for (const [gx, gz, lay] of [[x - 0.7, z + 0.35, 0], [x + 0.85, z + 0.1, 1]] as const) {
    g.push().translate(gx, y + 0.12, gz).rotateZ(lay ? 1.4 : 0);
    g.cyl(0, 0, 0, 0.1, 0.07, 0.04, 8, GOLD, { kind: K.Metal });
    g.cyl(0, 0.04, 0, 0.03, 0.03, 0.16, 6, GOLD, { kind: K.Metal });
    g.cyl(0, 0.2, 0, 0.06, 0.12, 0.16, 8, GOLD, { kind: K.Metal });
    g.pop();
  }
  g.push().translate(x + 0.15, y + 0.4, z - 0.05).rotateZ(0.3).rotateX(-0.2);
  g.cyl(0, 0, 0, 0.2, 0.22, 0.1, 10, GOLD, { kind: K.Metal, cap: false });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    g.beam([Math.cos(a) * 0.21, 0.08, Math.sin(a) * 0.21], [Math.cos(a) * 0.23, 0.22, Math.sin(a) * 0.23], 0.025, GOLD, { kind: K.Metal });
    gl.box(Math.cos(a) * 0.21, 0.04, Math.sin(a) * 0.21, 0.04, 0.04, 0.04, [2.6, 0.4, 0.5]);
  }
  g.pop();
  // A drowned knight's helm, rusted, half sunk in the gold.
  g.blob(x - 0.3, y + 0.32, z - 0.3, 0.2, 0.22, 0.2, '#6a5a4e', 415, { kind: K.Metal, jitter: 0.05 });
  g.box(x - 0.3, y + 0.34, z - 0.12, 0.2, 0.04, 0.02, '#1a1418');
  // Pearls glowing among the coins.
  for (let k = 0; k < 7; k++) {
    const a = r() * Math.PI * 2, d = r() * 1.1;
    gl.blob(x + Math.cos(a) * d, y + 0.3 * (1 - d / 1.3) + 0.05, z + Math.sin(a) * d * 0.7, 0.06, 0.06, 0.06, [2.4, 2.2, 2.6], 420 + k, { detail: 1, jitter: 0 });
  }
  b.lights.add(x, y + 0.9, z + 0.6, 0xffc060, 2.2, 4, 0.1);
}

/** A diver who came for the hoard: a brass helm on its side, its glass broken, bones scattered round it. */
function lostDiver(b: Builder, x: number, z: number, rot: number) {
  const g = b.g(x, z), y = b.y(x, z);
  g.push().translate(x, y + 0.22, z).rotateY(rot).rotateZ(1.2);
  g.blob(0, 0, 0, 0.26, 0.25, 0.26, BRASS, 431, { kind: K.Metal, detail: 1, jitter: 0.03 });
  g.cyl(0, -0.24, 0, 0.27, 0.25, 0.08, 10, '#8a5e1e', { kind: K.Metal });
  g.push().translate(0, 0.05, 0.22).rotateX(Math.PI / 2);
  g.cyl(0, 0, 0, 0.11, 0.11, 0.05, 10, '#e0b050', { kind: K.Metal });
  g.cyl(0, 0.012, 0, 0.09, 0.09, 0.045, 10, '#0c1418');
  g.pop();
  g.pop();
  D.bones(b, x + 0.5, z + 0.3, 5, true);
}

/** Ink spilled on the floor, soaked into the silt. */
function inkStain(b: Builder, x: number, z: number, s: number, seed: number) {
  const d = b.d(x, z), y = b.y(x, z);
  d.blob(x, y - 0.06, z, s, 0.1, s * 0.75, INK, seed, { flatBottom: true, jitter: 0.35 });
}

/** A strand of kelp drawn into a structure's shell (it lifts away with the roof). */
function shellKelp(g: Geo, x: number, y: number, z: number, h: number, r: () => number) {
  const lean = (r() - 0.5) * 0.5, n = Math.max(3, Math.round(h / 0.5));
  let px = x, py = y, pz = z;
  for (let k = 0; k < n; k++) {
    const nx = x + lean * (k + 1) * 0.12 + Math.sin(k * 0.9) * 0.08, ny = y + (h / n) * (k + 1), nz = z + Math.cos(k * 0.7) * 0.06;
    g.beam([px, py, pz], [nx, ny, nz], 0.035, SEA.kelp, { kind: K.Leaves, wind: 0.6 + k * 0.25 });
    if (k % 2) g.box(nx, ny - 0.1, nz, 0.28, 0.05, 0.12, SEA.kelpBlade, { kind: K.Leaves, wind: 0.8 + k * 0.25 });
    [px, py, pz] = [nx, ny, nz];
  }
}

export function buildInkGrotto(b: Builder, grid: Grid, under: (x: number, z: number) => boolean) {
  const keep = b.rng, r = (b.rng = mulberry32(7373));
  const G = GROTTO, p = new Painter(grid);

  // ---------- the hollow, the outcrop, the mouth ----------
  for (let z = 90; z < 110; z++)
    for (let x = 54; x < 81; x++) {
      const cx = x + 0.5, cz = z + 0.5, i = grid.i(x, z);
      // (Clear of the kingdom's terrace and the Whalebone Isle's shallows.)
      if (insidePoly(KINGDOM, cx, cz) || Math.hypot(cx - WHALE_ISLE.x, cz - WHALE_ISLE.z) < WHALE_ISLE.r + 2.5) continue;
      const n = fbm(cx * 0.35, cz * 0.35, 2, 141) - 0.5, crag = fbm(cx * 0.6 + 4, cz * 0.6, 2, 143);
      if (hollow(cx, cz)) {
        // The floor: black silt, ink soaked into it, gravel where the arms have scoured it.
        grid.h[i] = G.floor;
        grid.t[i] = crag > 0.62 ? T.Gravel : T.Silt;
      } else if (cz >= G.z1 && cx > G.x0 - 0.5 && cx < G.x1 + 0.8) {
        // Below the mouth the wall drops sheer to the trench's floor.
        grid.h[i] = -12;
        grid.t[i] = T.Silt;
      } else if ((cz < G.z0 || cx < G.x0) && cx > G.x0 - 3.2 + n * 1.6 && cx < G.x1 + 0.6 && cz > G.z0 - 3.2 + n * 1.6 && cz < G.z1 + 0.2) {
        // The outcrop: black rock in crags a metre or two under the surface.
        grid.h[i] = -1.3 - 0.4 * Math.floor(crag * 2.6);
        grid.t[i] = T.Rock;
      } else continue;
      grid.side[i] = S.Rock;
      grid.water[i] = 0;
      grid.noGrass[i] = 1;
    }
  // The trail of shell-grit along the trench's lip (off the kingdom's flagstones).
  p.each((x, z, i) => {
    if (insidePoly(KINGDOM, x + 0.5, z + 0.5) || grid.h[i] < -4.6) return;
    const w = (fbm(x * 0.3 + 9, z * 0.3, 2, 147) - 0.5) * 0.8;
    let d = 99;
    for (let k = 0; k < TRAIL.length - 1; k++) {
      const [ax, az] = TRAIL[k], [bx, bz] = TRAIL[k + 1], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x + 0.5 - ax) * dx + (z + 0.5 - az) * dz) / (dx * dx + dz * dz)));
      d = Math.min(d, Math.hypot(x + 0.5 - ax - dx * t, z + 0.5 - az - dz * t));
    }
    if (d < 0.8 + w) {
      grid.t[i] = T.Gravel;
      grid.noGrass[i] = 1;
    }
  }, 70, 93, 81, 101);

  // ---------- the roof and the east face (they lift away while the knight is inside) ----------
  const box = new THREE.Box3(new THREE.Vector3(G.x0 - 1, G.floor - 0.5, G.z0 - 1), new THREE.Vector3(G.x1 + 1.2, ROOF + 1.4, G.z1 + 1.2));
  const s = b.structure('inkgrotto', box, [G.x0, G.z0 - 1.6, G.x1 + 0.2, G.z1], G.floor);
  const sh = s.shell, sg = s.shellGlow;
  const rock = (x: number, y: number, z: number, rx: number, ry: number, rz: number) =>
    sh.blob(x, y, z, rx, ry, rz, r() < 0.4 ? ROCK_D : r() < 0.5 ? ROCK : ROCK_L, Math.floor(r() * 999), { kind: K.Rock, jitter: 0.3 });
  // The roof: a slab of black rock over the hollow, lumpy on top, flush with the outcrop's crags at its back.
  sh.box((G.x0 + G.x1) / 2, ROOF, (G.z0 + G.z1) / 2 - 0.2, G.x1 - G.x0 + 1.4, 0.4, G.z1 - G.z0 + 1.2, ROCK_D, { kind: K.Rock, top: ROCK });
  for (let z = G.z0 - 0.4; z < G.z1 + 0.4; z += 1.9)
    for (let x = G.x0 - 0.2; x < G.x1 + 0.6; x += 2.1) rock(x + (r() - 0.5) * 0.8, ROOF + 0.15, z + (r() - 0.5) * 0.6, 1.1 + r() * 0.5, 0.3 + r() * 0.25, 1.0 + r() * 0.4);
  // Crags along its back, higher, where it meets the outcrop.
  for (let x = G.x0 + 0.4; x < G.x1; x += 1.7 + r() * 0.8) rock(x, ROOF + 0.4, G.z0 + 0.2 + r() * 0.9, 0.8 + r() * 0.4, 0.55 + r() * 0.3, 0.7 + r() * 0.3);
  // The dark of the cave behind its mouth and its cleft (seen from outside; gone with the roof inside).
  sh.box((G.x0 + G.x1) / 2, G.floor - 0.3, G.z1 - 0.3, G.x1 - G.x0, ROOF - G.floor + 0.2, 0.12, '#07050a');
  sh.box(G.x1 - 0.25, G.floor - 0.3, (CLEFT.z0 + CLEFT.z1) / 2, 0.12, ROOF - G.floor + 0.2, CLEFT.z1 - CLEFT.z0 + 0.4, '#07050a');
  // Along the mouth a heavy lip of rock hangs low, stone teeth under it; more teeth inside.
  for (let x = G.x0 - 0.3; x < G.x1 + 0.6; x += 1.5) {
    rock(x, ROOF - 0.35, G.z1 + 0.05, 0.9 + r() * 0.4, 0.75 + r() * 0.3, 0.7);
    if (r() < 0.6) sh.cyl(x + (r() - 0.5) * 0.8, ROOF - 0.7, G.z1 - 0.1 + (r() - 0.5) * 0.4, 0.16 + r() * 0.1, 0, -(0.6 + r() * 0.8), 5, ROCK_D, { kind: K.Rock });
  }
  // Glowing things hang in strings from the lip (they show the mouth from far off, through the murk).
  for (let x = G.x0 + 0.5; x < G.x1 - 0.3; x += 0.7 + r() * 0.6) {
    const n = 1 + Math.floor(r() * 3), zz = G.z1 + 0.05 + (r() - 0.5) * 0.3;
    for (let k = 0; k < n; k++) sg.box(x, ROOF - 0.9 - k * 0.32 - r() * 0.1, zz, 0.09, 0.09, 0.09, r() < 0.6 ? [1.6, 0.6, 2.6] : [2.4, 0.7, 1.4]);
  }
  for (let z = CLEFT.z0 + 0.3; z < CLEFT.z1; z += 0.8) sg.box(G.x1 + 0.4, ROOF - 0.9 - r() * 0.4, z, 0.09, 0.09, 0.09, [1.6, 0.6, 2.6]);
  for (let k = 0; k < 9; k++) sh.cyl(G.x0 + 1 + r() * (G.x1 - G.x0 - 2), ROOF, G.z0 + 0.6 + r() * (G.z1 - G.z0 - 1.5), 0.2 + r() * 0.12, 0, -(0.5 + r() * 0.7), 5, ROCK_D, { kind: K.Rock });
  // The east face, the cleft through it onto the shelf (a lintel over it), and on the roof kelp, a sea fan, glows.
  for (const [z0, z1] of [[G.z0 - 1.2, CLEFT.z0], [CLEFT.z1, G.z1 + 0.3]]) {
    sh.box(G.x1 + 0.3, G.floor - 0.4, (z0 + z1) / 2, 1.0, ROOF - G.floor + 0.6, z1 - z0, ROCK_D, { kind: K.Rock, top: ROCK });
    for (let z = z0 + 0.4; z < z1; z += 1.1)
      for (const y of [G.floor + 0.6, G.floor + 2, ROOF - 0.4]) rock(G.x1 + 0.4 + (r() - 0.5) * 0.3, y, z, 0.6 + r() * 0.25, 0.75, 0.55 + r() * 0.2);
    b.collide({ kind: 'b', x0: G.x1 - 0.1, z0, x1: G.x1 + 0.85, z1, y0: G.floor - 1, y1: ROOF + 1 });
  }
  for (let z = CLEFT.z0 - 0.2; z < CLEFT.z1 + 0.4; z += 0.9) rock(G.x1 + 0.4, ROOF - 0.5, z, 0.65, 0.6, 0.55);
  for (const [x, z] of [[61.8, 99.6], [68.4, 98.6], [70.2, 103.2], [64.4, 103.6]]) shellKelp(sh, x, ROOF + 0.45, z, 0.8 + r() * 0.7, r);
  for (const [x, z] of [[62.9, 102.2], [66.8, 102.6], [69.6, 100.2]]) {
    sh.cyl(x, ROOF + 0.4, z, 0.16, 0.2, 0.18, 7, '#5a3a4a', { kind: K.Rock });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      sh.beam([x, ROOF + 0.55, z], [x + Math.cos(a) * 0.3, ROOF + 0.85, z + Math.sin(a) * 0.3], 0.035, SEA.coralPurple, { wind: 0.8 });
      sg.box(x + Math.cos(a) * 0.3, ROOF + 0.85, z + Math.sin(a) * 0.3, 0.05, 0.05, 0.05, SEA.glowPink);
    }
  }
  // Nothing walks or swims over the roof.
  b.collide({ kind: 'b', x0: G.x0 - 0.5, z0: G.z0 - 0.6, x1: G.x1 + 0.9, z1: G.z1 + 0.3, y0: ROOF - 0.1, y1: 4 });

  // ---------- inside: the den, the hoard, the vent, those who came before ----------
  hoard(b, NICHE.x, NICHE.z - 0.2);
  // The niche's mouth framed by two crags.
  for (const sx of [-1, 1]) {
    const g = b.g(NICHE.x + sx * 1.7, G.z0), y = G.floor;
    g.blob(NICHE.x + sx * 1.75, y + 0.5, G.z0 + 0.15, 0.55, 0.9, 0.5, ROCK, 451 + sx, { kind: K.Rock, jitter: 0.25, flatBottom: true });
  }
  inkStain(b, DEN.x - 0.6, DEN.z + 1.6, 1.6, 461);
  inkStain(b, 62.6, 101.2, 0.9, 462);
  inkStain(b, 69.6, 102.6, 1.1, 463);
  inkStain(b, 66.8, 104.4, 0.8, 464);
  // The vent at the west end (air), ringed with stones; the column of bubbles from the trench's floor to the mouth.
  bubbleVent(b, VENT.x, VENT.z, true);
  bubbleColumn(b, COLUMN.x, COLUMN.z);
  // Those who came before: divers' helms and bones by the walls; a snapped harpoon; an anchor dragged in.
  lostDiver(b, 60.7, 100.4, 0.6);
  lostDiver(b, 69.6, 98.3, 2.2);
  lostDiver(b, 63.6, 104.3, -1);
  {
    const g = b.g(69.6, 103.9), y = G.floor;
    g.beam([68.6, y + 0.05, 104.3], [70.4, y + 0.1, 103.6], 0.04, '#6a5038', { kind: K.Wood });
    g.beam([70.4, y + 0.1, 103.6], [70.8, y + 0.12, 103.45], 0.06, '#8a8a92', { kind: K.Metal });
    // The anchor, its fluke in the silt.
    g.push().translate(62.6, y + 0.05, 98.3).rotateY(0.7).rotateZ(1.3);
    g.box(-0.06, 0, -0.06, 0.12, 1.4, 0.12, '#4a4a54', { kind: K.Metal });
    g.box(-0.4, 1.25, -0.05, 0.8, 0.1, 0.1, '#4a4a54', { kind: K.Metal });
    g.beam([0, 0.05, 0], [-0.45, 0.35, 0], 0.07, '#4a4a54', { kind: K.Metal });
    g.beam([0, 0.05, 0], [0.45, 0.35, 0], 0.07, '#4a4a54', { kind: K.Metal });
    g.pop();
  }
  // At the walls' foot: barnacled rocks, anemones glowing, sea fans; a dim violet light under the roof.
  for (const [x, z, s0] of [[60.5, 98.3, 0.9], [60.5, 104.4, 0.7], [70.6, 98.1, 0.8], [63.4, 98.0, 0.75], [68.4, 98.0, 0.85]]) seaRock(b, x, z, s0);
  for (const [x, z] of [[60.6, 101.6], [60.5, 103.9], [62.2, 97.9], [69.4, 97.9], [70.6, 102.2]]) anemone(b, x, z, 0.6 + r() * 0.3, r() < 0.5 ? SEA.coralPurple : SEA.coralPink, r() < 0.5 ? SEA.glowPink : SEA.glowCyan);
  seaFan(b, 70.6, 103.6, 0.8, 0.3, SEA.coralPurple);
  seaFan(b, 60.6, 99.4, 0.7, 1.4, SEA.coralPink);
  b.lights.add(65.6, G.floor + 3, 102.6, 0x8a5ad8, 2, 9, 0.15);
  b.lights.add(65.6, G.floor + 2.4, G.z1 + 0.8, 0xa060e0, 2.4, 6, 0.2);

  // ---------- outside: the outcrop's crags, kelp round it, the way in ----------
  for (let k = 0; k < 26; k++) {
    const x = G.x0 - 3 + r() * (G.x1 - G.x0 + 3.5), z = G.z0 - 3.2 + r() * 3.2, h = b.y(x, z);
    if (h < -2.2 || h > -1 || grid.typeAt(x, z) !== T.Rock) continue;
    const g = b.g(x, z), sz = 0.5 + r() * 0.6;
    g.blob(x, h + 0.1, z, sz * 1.2, sz * 0.8, sz, r() < 0.5 ? ROCK : ROCK_D, Math.floor(r() * 999), { kind: K.Rock, jitter: 0.35, flatBottom: true });
  }
  for (let k = 0; k < 22; k++) {
    const x = G.x0 - 3 + r() * 3, z = G.z0 + r() * (G.z1 - G.z0), h = b.y(x, z);
    if (h < -2.2 || h > -1 || grid.typeAt(x, z) !== T.Rock) continue;
    const g = b.g(x, z), sz = 0.5 + r() * 0.5;
    g.blob(x, h + 0.1, z, sz, sz * 0.8, sz * 1.2, r() < 0.5 ? ROCK : ROCK_D, Math.floor(r() * 999), { kind: K.Rock, jitter: 0.35, flatBottom: true });
  }
  // Kelp in clumps on the shelf round the outcrop (none in front of the mouth), a sea fan or two on its crags.
  for (const [x, z, h] of [[55.4, 101.5, 2.2], [55.6, 104.4, 2.8], [69.5, 94.4, 2.4], [73.4, 94.3, 2], [57.2, 106.2, 2.4]]) {
    const gh = b.y(x, z);
    if (gh < -1.5) kelp(b, x, z, Math.min(-gh - 0.6, h + r()), 2 + Math.floor(r() * 2));
  }
  for (const [x, z] of [[63.4, 95.4], [67.6, 95.1], [70.4, 96.4]]) if (grid.typeAt(x, z) === T.Rock) seaFan(b, x, z, 0.8, r() * Math.PI, r() < 0.5 ? SEA.coralPurple : SEA.coralPink);
  // By the cleft: a broken boathook and a diver's float washed against the rock, ink streaked out over the shelf.
  {
    const g = b.g(72.7, 98.3), y = b.y(72.7, 98.3);
    g.beam([72.1, y + 0.05, 98], [73.3, y + 0.08, 98.6], 0.035, '#6a5038', { kind: K.Wood });
    g.cyl(73.5, y, 97.7, 0.18, 0.18, 0.3, 8, '#3a2e24', { kind: K.Wood });
    inkStain(b, 72.1, 99.6, 0.7, 466);
  }

  b.rng = keep;
  const enemies: EnemySpawn[] = [
    // Old Inkarm in its den (src/game/inkarm.ts).
    { type: 'inkarm', x: DEN.x, z: DEN.z, group: 'inkarm' },
  ];
  const objects: ObjDef[] = [
    { kind: 'lore', id: 'r3lore_ink', x: LORE.x, z: LORE.z, text: 'Cut into the rock with a diver\'s knife: DO NOT GO IN. Under it, in another hand: SHE KEEPS WHAT SHINES. Under that, a mark like a hand with eight fingers, in ink the sea has not washed off in forty years.' },
    // What it keeps, in the niche behind its den.
    { kind: 'chest', id: 'r3_inkhoard', x: NICHE.x, z: NICHE.z + 0.75, rot: 0.15, coins: 55 },
  ];
  const regions: RegionDef[] = [
    { name: 'The Ink Grotto', music: 'hall', amb: 'grotto', test: (x, z) => x > G.x0 - 0.5 && x < G.x1 + 0.6 && z > G.z0 - 1.8 && z < G.z1 + 0.3 && under(x, z) && grid.groundAt(x, z) < G.floor + 0.5 },
  ];
  return {
    enemies,
    objects,
    regions,
    /** The vent's air in the hollow. */
    pockets: [{ x: VENT.x, z: VENT.z, r: 1.4 }],
    /** The column of bubbles from the trench's floor up to the mouth. */
    lifts: [{ x: COLUMN.x, z: COLUMN.z, r: 1.2, top: G.floor + 0.6 }],
  };
}
