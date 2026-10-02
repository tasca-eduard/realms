import { K } from '../engine/materials';
import { fbm } from '../engine/util';
import { PAL, type Builder } from './builder';
import * as D from './details';
import { Grid, NONE, S, T } from './grid';
import { Painter } from './paint';
import type { BorderDef } from './realm';
import { deadShrub, diceAt, WOOD } from './wood';

// ---------------------------------------------------------------------------
// The Sea Stair: the old way down from Whisperwood to the Sunken Reef, cut down the sea cliff.
//
// In Whisperwood, past the Withered Wood, the heights end at a cliff over a cove of the sea, and the
// stair runs down the cove's north face (the cliff over it, the water below). A rockfall broke its head:
// two great blocks came down across it, a gap between them where the steps fell away to the rocks. They
// stand 2.1 m over the heights: too high for a knight (his jump and the step at its top reach about
// 1.8 m) or a warhorse, while the Thornstag's second leap gets up onto them (2.8 m), and from one to the
// other over the gap. Below them a landing, two flights down the face, the turn, and the last flight
// down to the water (out of the realm). Coming back up the way, the stag waits below the rockfall, the
// warhorse above it.
//
// In the Reef the same stair comes down the sea cliff in the north-west corner, onto the strand.
// ---------------------------------------------------------------------------

/** Whisperwood's heights (the Withered Wood's floor), and the sea in the cove below the cliff. */
const WOOD_TOP = 5;
const WOOD_SEA = 0.5;
/** The stair's lane along the cove's north face: cells z 32 to 34, roomy enough for the stag (the face north
 *  of it, the cove south). */
const LANE = { z0: 32, z1: 35 };
/** The rockfall at the head of the stair: the two blocks, the gap between, how high the blocks stand. */
const BLOCK1 = { x0: -3, x1: 0 };
const GAP = { x0: -5, x1: -3 };
const BLOCK2 = { x0: -8, x1: -5 };
const BLOCK_H = 2.1;
/** The rocks at the bottom of the gap: below where a fall is a fall (a heart lost, back where you stood). */
const GAP_FLOOR = -4.5;
/** Below it: a landing, two flights down the face, the landing at the turn, the last flight south into the sea. */
const LANDING = { x0: -10, x1: -8 };
const FLIGHTS = [{ x0: -13, x1: -10, h0: 3.5, h1: WOOD_TOP }, { x0: -16, x1: -13, h0: 2, h1: 3.5 }];
const TURN = { x0: -19, x1: -16, h: 2 };
const LAST = { z0: 35, z1: 38, h0: WOOD_SEA, h1: 2 };
/** The cove: from the cliff's foot under the stair to its low south shore, between the turn and the heights;
 *  out of its south-west corner a narrow sea gate between the cliffs, toward the open sea. */
const COVE = { x0: -19, x1: 0, z0: 35, z1: 51 };
const GATE = { x0: -26, z0: 41, z1: 44 };
/** The cove's south shore at x: low rocky ground the camera looks over at the stair (still too high to
 *  climb out of the Whisper's end, even on the stag). Under the heights the water reaches past their last
 *  low cell (z 46), so the shore never touches them. */
const coveShore = (x: number) => Math.max(x > -4 ? 47 : 0, 46 + Math.round((fbm(x * 0.3, 4.7, 2, 241) - 0.5) * 3));
/** A block's top: 2.1 m over the heights, a little uneven (the cells facing over the gap level, to leap between). */
const blockTop = (x: number, z: number) => WOOD_TOP + BLOCK_H + (x === GAP.x0 - 1 || x === GAP.x1 ? 0.1 : ((x * 7 + z * 5) & 3) * 0.06);

/** Whisperwood's end of the way: walking on down the last flight sets off; coming back, the knight comes
 *  out on the flights below the rockfall, the stag on the landing under it, the warhorse at the top. */
export const WOOD_STAIR: BorderDef = {
  id: 'seastair', to: 'aqua', arrive: 'seastair', x: -17.5, z: 36.7, r: 1.3,
  out: { x: -14.4, z: 33.5, fx: 1, fz: 0 }, card: ['The Old Wood', 'The Sunken Reef'],
  leap: { stag: { x: -9.2, z: 33.5 }, horse: { x: 1.8, z: 36 } },
};
/** The way's head on the heights (the path ends there), and the region it makes. */
export const WOOD_STAIR_HEAD = { x: 0.4, z: 33.5 };
export const onWoodStair = (x: number, z: number) => x < 0.5 && z > LANE.z0 - 1.5 && z < LAST.z1;
/** Where the outskirts' trees keep off: the cove, the stair, the low shore across, the sea gate, and the ridge
 *  beyond the shore by the Whisper's end (its trees stood in the camera's view of the cove). All of it was dry
 *  ground before, where a tree could stand. */
export const woodStairBare = (x: number, z: number) =>
  (x > COVE.x0 - 1.5 && x < 0 && z > LANE.z0 - 1 && z < COVE.z1) || (x >= GATE.x0 && x <= COVE.x0 - 1.5 && z > GATE.z0 - 1 && z < GATE.z1 + 1) ||
  (x >= -4 && x < 0 && z >= COVE.z1 && z < COVE.z1 + 1);

/** Paint the cove and the stair over Whisperwood's outskirts (after they are painted). */
export function paintWoodStair(grid: Grid) {
  const p = new Painter(grid);
  const sea = (i: number) => {
    p.apply(i, { h: WOOD_SEA - 5, t: T.Bed, side: S.Rock, noGrass: true });
    grid.water[i] = WOOD_SEA;
  };
  // The cove: deep water from the cliffs' feet to the low shore across (the Whisper's end left as it is),
  // and the sea gate out of it.
  p.each((x, z, i) => {
    if (grid.water[i] !== NONE) return;
    if (z < coveShore(x)) sea(i);
    else {
      const n = fbm(x * 0.4, z * 0.4, 2, 243);
      p.apply(i, { h: 5 + Math.round(n * 3) * 0.5, t: n > 0.62 ? T.Rock : T.DarkGrass, side: S.Rock, noGrass: false });
    }
  }, COVE.x0, COVE.z0, COVE.x1, COVE.z1);
  p.each((_x, _z, i) => sea(i), GATE.x0, GATE.z0, COVE.x0, GATE.z1);
  // The rockfall: the two blocks across the lane, the gap between them down to the rocks.
  p.each((x, z, i) => {
    if (x >= GAP.x0 && x < GAP.x1) p.apply(i, { h: GAP_FLOOR, t: T.Gravel, side: S.Rock, noGrass: true });
    else p.apply(i, { h: blockTop(x, z), t: T.Rock, side: S.Rock, noGrass: true });
  }, BLOCK2.x0, LANE.z0, BLOCK1.x1, LANE.z1);
  // Below it the landing, the flights down the face, the turn, and the last flight down into the water.
  p.rect(LANDING.x0, LANE.z0, LANDING.x1, LANE.z1, { h: WOOD_TOP, t: T.Rock, side: S.Rock, noGrass: true });
  for (const f of FLIGHTS) p.ramp(f.x0, LANE.z0, f.x1, LANE.z1, 0, f.h0, f.h1, true, T.Rock);
  p.rect(TURN.x0, LANE.z0, TURN.x1, LANE.z1, { h: TURN.h, t: T.Moss, side: S.Rock, noGrass: true });
  p.ramp(TURN.x0, LAST.z0, TURN.x1, LAST.z1, 3, LAST.h0, LAST.h1, true, T.Rock);
  p.each((_x, _z, i) => (grid.water[i] = NONE), TURN.x0, LAST.z0, TURN.x1, LAST.z1);
  // The face over the stair: never less than 3.5 m over the lane beside it and at a slant (nothing climbs
  // out, not even the stag leaping from the blocks), and bare rock above the rockfall, where they broke away.
  p.each((x, z, i) => {
    let top = 0;
    for (let lx = Math.max(TURN.x0, x - 1); lx <= Math.min(-1, x + 1); lx++)
      for (let lz = LANE.z0; lz < LANE.z1; lz++) {
        const j = grid.i(lx, lz);
        top = Math.max(top, grid.h[j] + Math.max(0, grid.rise[j]));
      }
    if (grid.h[i] < top + 3.5) grid.h[i] = Math.ceil(top + 3.5) + ((x * 5 + z * 3) & 3) * 0.5;
    if (x >= BLOCK2.x0 - 1 && z >= LANE.z0 - 2) grid.t[i] = T.Rock;
  }, TURN.x0, LANE.z0 - 4, 0, LANE.z0);
}

/** What lies on the stair and round the cove (placed last, so nothing else shifts). */
export function dressWoodStair(b: Builder, grid: Grid) {
  const d = diceAt(-9, 33, 3);
  const mid = (LANE.z0 + LANE.z1) / 2;
  // The blocks: great slabs lying askew across the lane (the rock you stand on inside them), with smaller
  // ones fallen against their feet on the way up to them, and shards of the broken steps at the gap's edges.
  for (const [k, blk] of [BLOCK1, BLOCK2].entries()) {
    const cx = (blk.x0 + blk.x1) / 2, top = WOOD_TOP + BLOCK_H + 0.1, base = WOOD_TOP - 0.8, g = b.g(cx, mid);
    g.push().translate(cx, base, mid).rotateY(k ? -0.15 : 0.2).rotateX(k ? 0.05 : -0.04).rotateZ(k ? -0.03 : 0.04);
    g.box(0, 0, 0, blk.x1 - blk.x0 + 0.45, top - base, LANE.z1 - LANE.z0 + 0.7, k ? PAL.rockDark : PAL.rock, { kind: K.Rock, top: '#8a8690' });
    g.pop();
    for (const [fz, s] of [[0.12, 0.75], [0.62, 0.6], [0.9, 0.5]] as [number, number][]) {
      const x = k ? blk.x0 - 0.15 : blk.x1 + 0.15, z = LANE.z0 + (LANE.z1 - LANE.z0) * fz;
      b.g(x, z).blob(x, WOOD_TOP - 0.3, z, 0.8 * s, 0.9 * s, 0.7 * s, PAL.rockDark, 40 + k * 7 + Math.round(fz * 10), { kind: K.Rock, jitter: 0.25 });
    }
    const edge = k ? blk.x1 : blk.x0;
    for (let j = 0; j < 3; j++) {
      const z = LANE.z0 + 0.4 + j * 1.1 + (d() - 0.5) * 0.3;
      b.g(edge, z).blob(edge + (k ? 0.15 : -0.15), WOOD_TOP + 0.6 + d() * 0.9, z, 0.35, 0.3 + d() * 0.3, 0.3, PAL.rock, 70 + j + k * 5, { kind: K.Rock, jitter: 0.3 });
    }
  }
  // Pieces of the head's last steps on the heights before the first block.
  for (let j = 0; j < 3; j++) b.rock(0.6 + d() * 0.8, LANE.z0 + 0.2 + d() * 1.6, 0.2 + d() * 0.2, false);
  // The gap: a broken step wedged across it, rubble at the bottom; the sea's glimmer coming up through it.
  {
    const g = b.g(GAP.x0 + 1, mid);
    g.push().translate(GAP.x0 + 1, WOOD_TOP - 2.4, mid + 0.1).rotateY(0.3).rotateZ(0.55);
    g.box(0, 0, 0, 1.9, 0.32, 1.5, PAL.rock, { kind: K.Rock });
    g.pop();
    for (let j = 0; j < 4; j++) {
      const x = GAP.x0 + 0.3 + d() * 1.4, z = LANE.z0 + 0.2 + d() * (LANE.z1 - LANE.z0 - 0.4);
      b.g(x, z).blob(x, GAP_FLOOR + 0.3, z, 0.4 + d() * 0.3, 0.35, 0.4 + d() * 0.3, PAL.rockDark, 60 + j, { kind: K.Rock, jitter: 0.3 });
    }
  }
  b.lights.add(GAP.x0 + 1, WOOD_TOP - 0.5, LANE.z1 - 0.3, 0x6ad0d0, 3, 6, 0.25);
  // Blocks fallen into the cove under the rockfall, standing out of the water, the sea breaking round them.
  for (const [x, z, s] of [[-2.4, 35.4, 1.3], [-6.6, 35.9, 1.6], [-4.4, 37.6, 1], [-9.6, 35.2, 0.9], [-1.6, 39.4, 0.9], [-12.6, 36.6, 0.7]] as [number, number, number][]) {
    b.g(x, z).blob(x, WOOD_SEA - 0.3, z, 1.1 * s, 1.15 * s, 0.95 * s, s > 1.2 ? PAL.rock : PAL.rockDark, Math.round(x * 13 + z), { kind: K.Rock, jitter: 0.25 });
    b.gl(x, z).box(x + 0.15, WOOD_SEA + 0.01, z + 0.95 * s, 1.5 * s, 0.03, 0.14, '#9fc8c8', { kind: 0 });
  }
  // Surf along the cliffs' feet, in stretches.
  for (let x = COVE.x0 + 2.3; x < -0.5; x += 1.7 + d() * 1.4) b.gl(x, LANE.z1).box(x, WOOD_SEA + 0.01, LANE.z1 + 0.18, 0.9 + d() * 0.9, 0.03, 0.12, '#9fc8c8', { kind: 0 });
  for (let z = LANE.z1 + 0.8; z < 46; z += 1.9 + d() * 1.5) b.gl(-0.2, z).box(-0.22, WOOD_SEA + 0.01, z, 0.12, 0.03, 0.8 + d() * 0.8, '#9fc8c8', { kind: 0 });
  // The steps' worn edges, pale against the dark rock (the steps go down away from the camera, their
  // risers out of sight: the edges show where each one drops).
  for (const f of FLIGHTS)
    for (let x = f.x0; x < f.x1; x++) {
      const h0 = f.h0 + ((f.h1 - f.h0) / (f.x1 - f.x0)) * (x - f.x0);
      for (const s of [0, 0.5]) b.g(x + s, mid).box(x + s + 0.06, h0 + (s + 0.5) * 0.5 - 0.02, mid, 0.12, 0.04, LANE.z1 - LANE.z0 - 0.15, '#9a96a0', { kind: K.Rock });
    }
  // Roots and moss hanging down the stair's own face over the water, in stretches.
  for (let x = TURN.x1; x < BLOCK2.x0; x++) {
    const u = d();
    if (u > 0.5) continue;
    const top = grid.groundAt(x + 0.5, LANE.z1 - 0.5), gg = b.g(x + 0.5, LANE.z1);
    for (let k = 0; k < 2; k++) {
      const ax = x + 0.25 + k * 0.45, len = Math.min(top - WOOD_SEA - 0.4, 0.8 + d() * 1.8);
      gg.beam([ax, top + 0.03, LANE.z1 - 0.02], [ax + (d() - 0.5) * 0.3, top - len, LANE.z1 + 0.06], 0.03, k ? '#5a4430' : '#46382a', { kind: K.Bark, wind: 0.2 });
    }
    if (u < 0.25) gg.box(x + 0.5, top - 0.5 - u * 2, LANE.z1 + 0.03, 0.7, 0.45 + u, 0.05, WOOD.moss, { kind: K.Grass });
  }
  // Moss, ferns and moonflowers on the landings, a dead shrub in a crack, pebbles down the steps.
  D.fern(b, LANDING.x0 + 0.5, LANE.z0 + 0.4, 0.8);
  D.fern(b, TURN.x0 + 0.5, LANE.z0 + 0.5, 1);
  b.moonflowers(LANDING.x0 + 0.6, LANE.z0 + 0.5, 4, 0.4);
  b.moonflowers(TURN.x0 + 0.7, LANE.z0 + 0.6, 5, 0.5);
  deadShrub(b, LANDING.x1 - 0.4, LANE.z0 + 0.3, 0.7);
  for (const f of FLIGHTS) {
    D.pebbles(b, (f.x0 + f.x1) / 2, mid + (d() - 0.5), 3);
    // Pale toadstools in the cracks against the face, a few glimmers down the way.
    b.mushrooms(f.x0 + 0.8 + d() * 1.2, LANE.z0 + 0.25, 4, false);
  }
  // Roots and moss down the face over the stair, in stretches with bare rock between (none where the rock broke).
  for (let x = TURN.x0; x < BLOCK2.x0 - 1; x++) {
    const u = d(), top = grid.h[grid.i(x, LANE.z0 - 1)], foot = grid.groundAt(x + 0.5, LANE.z0 + 0.5);
    if (u > 0.55) continue;
    const gg = b.g(x + 0.5, LANE.z0);
    for (let k = 0; k < 3; k++) {
      const ax = x + 0.2 + k * 0.3, len = Math.min(top - foot - 0.4, 1.2 + d() * 2.4);
      gg.beam([ax, top + 0.05, LANE.z0 + 0.03], [ax + (d() - 0.5) * 0.3, top - len, LANE.z0 + 0.1], 0.035, k % 2 ? '#5a4430' : '#46382a', { kind: K.Bark, wind: 0.15 });
    }
    if (u < 0.3) gg.box(x + 0.5, top - 0.6 - u * 2, LANE.z0 + 0.04, 0.8, 0.5 + u, 0.06, WOOD.moss, { kind: K.Grass });
  }
  // The sea's light at the turn, where the stair goes down out of the wood.
  b.lights.add(TURN.x0 + 1, TURN.h + 1.4, LAST.z0 + 0.6, 0x6ad0d0, 4, 8, 0.2);
}

// ---------------------------------------------------------------------------
// The Reef's end: the lane along the north cliff's foot (cells z -2 and -1) from the cleft at its head
// (x -3 to 0, in the corner) east down to the strand (x 11). Its steps start from the strand's own height
// there, so it meets the ground however the strand is shaped.
// ---------------------------------------------------------------------------
const REEF_LANE = { z0: -2, z1: 0 };
const REEF_HEAD = { x0: -3, x1: 0 };
const REEF_FOOT = 11;
/** A step down the lane (m per cell); the cleft climbs on a little past the head. */
const REEF_STEP = 0.55;

/** The Reef's end of the way: walking up into the cleft at the head sets off; coming down, the knight
 *  comes out at the top of the stair, looking down it to the strand. */
export const REEF_STAIR: BorderDef = {
  id: 'seastair', to: 'forest', arrive: 'seastair', x: -1.6, z: -1, r: 1.2,
  out: { x: 1.6, z: -1, fx: 1, fz: 0 }, card: ['The Sunken Reef', 'The Old Wood'],
};
/** Where the outskirts' scrub keeps off: the stair and its cleft. */
export const reefStairBare = (x: number, z: number) => x > REEF_HEAD.x0 - 0.5 && x < REEF_FOOT + 0.5 && z > REEF_LANE.z0 - 0.4 && z < REEF_LANE.z1;

/** Cut the stair into the Reef's north-west cliff (after the outskirts are painted). */
export function paintReefStair(grid: Grid) {
  const p = new Painter(grid);
  const foot = Math.max(grid.h[grid.i(REEF_FOOT, 0)], 0.5), top = foot + REEF_STEP * (REEF_FOOT - REEF_HEAD.x1);
  p.ramp(REEF_HEAD.x1, REEF_LANE.z0, REEF_FOOT, REEF_LANE.z1, 2, foot, top, true, T.Rock);
  p.ramp(REEF_HEAD.x0, REEF_LANE.z0, REEF_HEAD.x1, REEF_LANE.z1, 2, top, top + 1.2, true, T.Rock);
  // The cliff over the lane and round the cleft: never less than 3 m over the steps.
  p.each((x, z, i) => {
    if (z >= REEF_LANE.z0 && z < REEF_LANE.z1 && x >= REEF_HEAD.x0) return;
    const lx = Math.min(REEF_FOOT - 1, Math.max(REEF_HEAD.x0, x)), j = grid.i(lx, REEF_LANE.z0);
    const over = grid.h[j] + Math.max(0, grid.rise[j]) + 3;
    if ((x < 0 || z < 0) && grid.h[i] < over) grid.h[i] = Math.ceil(over);
  }, REEF_HEAD.x0 - 1, REEF_LANE.z0 - 2, REEF_FOOT, REEF_LANE.z1 + 1);
}

/** What lies about the Reef's stair (placed last, so nothing else shifts). */
export function dressReefStair(b: Builder, grid: Grid) {
  const d = diceAt(4, -1, 5);
  // Fallen stones at its foot on the strand, and a weathered one on the steps.
  for (const [x, z, s] of [[REEF_FOOT + 0.9, 1.6, 0.6], [REEF_FOOT - 1.6, 0.6, 0.35], [REEF_FOOT + 2.1, 0.5, 0.4], [5.2, -1.6, 0.3]] as [number, number, number][]) b.rock(x, z, s, s > 0.5);
  // Scrub along the cliff's lip over the stair, in stretches.
  for (let x = REEF_HEAD.x0; x < REEF_FOOT; x += 1.3) {
    const u = d();
    if (u > 0.45) continue;
    const z = REEF_LANE.z0 - 0.6 - d() * 0.8;
    if (grid.groundAt(x, z) > 2) b.bush(x + d() * 0.6, z, 0.5 + u, '#4a5a3a');
  }
  // The wood's light coming down the cleft at its head.
  b.lights.add(REEF_HEAD.x0 + 1.2, grid.groundAt(REEF_HEAD.x0 + 1.5, -1) + 1.4, -1, 0x9ad070, 3, 6, 0.25);
}
