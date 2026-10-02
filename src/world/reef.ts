import { K } from '../engine/materials';
import { fbm, mulberry32 } from '../engine/util';
import type { Builder } from './builder';
import { T, type Grid } from './grid';
import type { Pt } from './paint';
import type { EnemySpawn, NpcDef, ObjDef, RegionDef, TrialDef } from './realm';
import * as D from './details';
import { brainCoral, branchCoral, kelp, SEA, seaFan, seaRock } from './sea';

// ---------------------------------------------------------------------------
// The Sunken Reef's people, quests and secrets (group 34 of the realm 3 plan): the coral village going about
// its day (its harbourmaster, innkeeper, coral-smith, the pearl-diver whose son was taken, the tide-reader
// who gives hints, an old diver and a beachcomber with wares of their own); the coral shrine on the green that
// mends whatever carries the knight (the prototype's); the Whalebone Isle off the coral gardens, the realm's
// trial, where a giant clam keeps the Tide Pearl; Gull Rock on the trench's lip, the crew's diving rock, where
// the son is caged; three Moon Shards, chests paid by how hidden, lore. Floats on the water mark the ways
// out to the isle (the village's glass floats) and to the rock (the crew's tarred ones); secrets get none.
// The story's side of it is src/game/story/reef.ts.
// ---------------------------------------------------------------------------

/** The coral village's shelf (as in realm3.ts) and the angles of its five houses round its seaward side. */
const VILLAGE = { x: 37, z: 66 };
const HOUSES = [-52, -16, 22, 57, 92];
/** The coral shrine on the village green. */
export const SHRINE = { x: 38.6, z: 64.6 };
/** The coral-smith's bench on the green, between her house and the pearl-diver's, and where she stands at it. */
const BENCH = { x: 41.24, z: 70.24 }, SMITH = { x: 40.7, z: 69.7 };
/** The Whalebone Isle off the coral gardens: a flat top (the trial's ring), a beach, wading shallows round it. */
export const WHALE_ISLE = { x: 57, z: 88, r: 7.4 };
/** Gull Rock, the crew's diving rock on the trench's lip: a low rock, a beach, wading shallows round it. */
export const GULL_ROCK = { x: 121, z: 68.5, r: 2.6 };
/** Kip's cage on the rock's trench side. */
export const CAGE = { x: 122.3, z: 69.7 };
/** Where Kip swims for home when he's free (off the rock, down into the water toward the village). */
export const KIP_SWIM: Pt[] = [[118.6, 66.8], [114.5, 64.4], [110, 62.5]];
/** The Moon Shards: where the coral grows thickest (a bower in the gardens), the kelp's dark heart, the
 *  trench's floor. */
const BOWER = { x: 61.5, z: 61 };
const SHARDS: { id: string; x: number; z: number }[] = [
  { id: 'r3s_garden', x: BOWER.x, z: BOWER.z },
  { id: 'r3s_kelp', x: 99.5, z: 56.5 },
  { id: 'r3s_trench', x: 86, z: 106.4 },
];

/** Heights of the reef's own isles (NaN off them): the Whalebone Isle and Gull Rock. */
export function reefIsleHeight(x: number, z: number) {
  const n = (fbm(x * 0.3, z * 0.3, 2, 91) - 0.5) * 1.4;
  const w = Math.hypot(x - WHALE_ISLE.x, z - WHALE_ISLE.z) + n * 0.6;
  if (w < WHALE_ISLE.r) return 0.5;
  if (w < WHALE_ISLE.r + 1) return 0.1;
  if (w < WHALE_ISLE.r + 2.2) return -0.3;
  const k = Math.hypot(x - GULL_ROCK.x, z - GULL_ROCK.z) + n;
  if (k < GULL_ROCK.r) return 0.5;
  if (k < GULL_ROCK.r + 1) return 0.1;
  if (k < GULL_ROCK.r + 2.2) return -0.3;
  return NaN;
}

/** Is this spot clear of the reef's own places (for the realm's scatter of rocks, scrub and coral)? */
export function reefClear(x: number, z: number, rad: number) {
  return Math.hypot(x - WHALE_ISLE.x, z - WHALE_ISLE.z) > WHALE_ISLE.r + 2.6 + rad && Math.hypot(x - GULL_ROCK.x, z - GULL_ROCK.z) > GULL_ROCK.r + 3 + rad
    && Math.hypot(x - BOWER.x, z - BOWER.z) > 2.4 + rad;
}

// ---------- props ----------

const BONE = '#ece2c8', BONE_D = '#c8bca0', ROSE: [number, number, number] = [2.6, 0.8, 1.4];

/** The coral shrine: a cairn of reef stone grown over with coral, a basin of sea water in its top glowing rose
 *  (the prototype's colour), an arch of branching coral over it. */
function coralShrine(b: Builder, x: number, z: number) {
  const g = b.g(x, z), gl = b.gl(x, z), y = b.y(x, z);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    g.blob(x + Math.cos(a) * 0.62, y + 0.08, z + Math.sin(a) * 0.62, 0.32, 0.24, 0.3, k % 2 ? SEA.stone : SEA.stoneDark, 300 + k, { kind: K.Rock, flatBottom: true });
  }
  g.cyl(x, y, z, 0.66, 0.54, 0.6, 9, SEA.stoneDark, { kind: K.Rock });
  g.cyl(x, y + 0.6, z, 0.5, 0.6, 0.14, 10, SEA.stone, { kind: K.Rock });
  gl.cyl(x, y + 0.7, z, 0.44, 0.44, 0.03, 10, ROSE);
  // The arch: two arms of rose coral from either side of the cairn, meeting over the basin, glowing at the tips.
  const arm: [number, number, number][] = [];
  for (let k = 0; k <= 8; k++) {
    const a = (k / 8) * Math.PI;
    arm.push([x + Math.cos(a) * 0.72, y + 0.5 + Math.sin(a) * 1.25, z - Math.cos(a) * 0.18]);
  }
  g.sweep(arm, arm.map((_, k) => 0.1 - Math.abs(k - 4) * 0.008), SEA.coralPink, { seg: 6, lumpy: 0.2, seed: 77, kind: K.Rock });
  for (let k = 1; k < 8; k += 2) {
    const [px, py, pz] = arm[k];
    g.beam([px, py, pz], [px + (k < 4 ? -0.2 : 0.2), py + 0.3, pz + 0.12], 0.035, SEA.coralPink, { kind: K.Rock });
    gl.box(px + (k < 4 ? -0.2 : 0.2), py + 0.3, pz + 0.12, 0.07, 0.07, 0.07, ROSE);
  }
  branchCoral(b, x - 0.75, z + 0.5, 0.7, SEA.coralOrange);
  brainCoral(b, x + 0.8, z + 0.45, 0.5, SEA.coralYellow);
  b.lights.add(x, y + 1.3, z, 0xe86a8a, 3, 6, 0.2);
  b.fx.addEmitter({ x, y: y + 0.75, z, rate: 3, spec: { color: ROSE, color2: [1, 0.3, 0.6], size: 1, life: 2.4, gravity: -0.4, wobble: 0.2 }, spread: 0.35, vy: 0.3 });
  b.collide({ kind: 'c', x, z, r: 0.78, y0: y - 1, y1: y + 1.8 });
}

/** The coral-smith's bench: planks on trestles, coral laid out on it (rose fire coral, the orange kind),
 *  files and a grindstone, a basket of offcuts. */
function coralBench(b: Builder, x: number, z: number, rot: number) {
  const g = b.g(x, z), y = b.y(x, z);
  g.push().translate(x, y, z).rotateY(-rot);
  g.box(0, 0.72, 0, 1.6, 0.08, 0.7, '#7a5c40', { kind: K.Wood });
  for (const s of [-0.62, 0.62]) {
    g.box(s, 0, -0.22, 0.08, 0.72, 0.08, '#4e3826', { kind: K.Wood });
    g.box(s, 0, 0.22, 0.08, 0.72, 0.08, '#4e3826', { kind: K.Wood });
  }
  for (const [cx, cz, col] of [[-0.45, -0.1, SEA.coralPink], [-0.15, 0.15, SEA.coralOrange], [0.2, -0.12, SEA.coralPink]] as const) {
    g.beam([cx, 0.8, cz], [cx + 0.12, 0.98, cz + 0.05], 0.04, col, { kind: K.Rock });
    g.beam([cx, 0.8, cz], [cx - 0.1, 0.95, cz - 0.06], 0.03, col, { kind: K.Rock });
  }
  g.box(0.45, 0.8, 0.1, 0.32, 0.02, 0.05, '#8a8a92', { kind: K.Metal });
  g.box(0.5, 0.8, -0.15, 0.26, 0.02, 0.04, '#8a8a92', { kind: K.Metal });
  // The grindstone at the bench's end, on its frame.
  g.box(1.15, 0, 0, 0.36, 0.5, 0.3, '#4e3826', { kind: K.Wood });
  g.push().translate(1.15, 0.78, 0).rotateX(Math.PI / 2);
  g.cyl(0, -0.06, 0, 0.3, 0.3, 0.12, 12, '#8a8478', { kind: K.Rock });
  g.pop();
  g.cyl(-1.15, 0, 0.1, 0.24, 0.2, 0.32, 8, '#8a6a3a', { kind: K.Wood });
  g.pop();
  const c = Math.cos(rot), s = Math.sin(rot);
  b.collide({ kind: 'c', x: x - c * 0.35, z: z - s * 0.35, r: 0.5, y0: y - 1, y1: y + 0.9 });
  b.collide({ kind: 'c', x: x + c * 0.6, z: z + s * 0.6, r: 0.5, y0: y - 1, y1: y + 0.9 });
}

/** A float marking a way over the water: a glass ball glowing sea-green (the village's) or a tarred keg with
 *  a red rag (the crew's), on a line down to a stone on the floor. */
function markerFloat(b: Builder, x: number, z: number, crew: boolean) {
  const g = b.g(x, z), gl = b.gl(x, z), floor = b.y(x, z);
  g.beam([x, floor + 0.1, z], [x, -0.1, z], 0.015, '#8a7a5a');
  g.blob(x, floor + 0.1, z, 0.22, 0.16, 0.2, SEA.stoneDark, 61, { kind: K.Rock, flatBottom: true });
  if (crew) {
    g.cyl(x, -0.2, z, 0.26, 0.26, 0.42, 8, '#3a2e24', { kind: K.Wood, wind: 0.6 });
    g.cyl(x, 0.02, z, 0.27, 0.27, 0.05, 8, '#5a4a3a', { kind: K.Metal, cap: false, wind: 0.6 });
    g.beam([x, 0.2, z], [x, 0.85, z], 0.025, '#4e3826', { kind: K.Wood, wind: 0.8 });
    g.box(x + 0.15, 0.62, z, 0.28, 0.2, 0.02, '#a03028', { kind: K.Cloth, wind: 2 });
  } else {
    g.box(x - 0.2, -0.02, z - 0.03, 0.4, 0.06, 0.06, '#8a7a5a', { wind: 0.6 });
    gl.blob(x, 0.06, z, 0.2, 0.17, 0.2, [0.8, 2.4, 1.7], 93, { detail: 1, jitter: 0, wind: 0.6 });
  }
}

/** The whale's bones on the isle: its ribs stand round the ring, leaning in over it, its backbone curled round the
 *  far side, its skull at the ring's head. */
function whaleBones(b: Builder, x: number, z: number, R: number) {
  const n = 12;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + 0.13;
    // Gaps where the floats come ashore (north), toward the camera (south-east) and at the skull (west).
    if (k === 9 || k === 1 || k === 6) continue;
    const fx = x + Math.cos(a) * R, fz = z + Math.sin(a) * R, y = b.y(fx, fz), ix = -Math.cos(a), iz = -Math.sin(a);
    const h = 2.8 + ((k * 37) % 5) * 0.16, g = b.g(fx, fz);
    g.sweep([[fx, y - 0.2, fz], [fx + ix * 0.1, y + h * 0.4, fz + iz * 0.1], [fx + ix * 0.55, y + h * 0.78, fz + iz * 0.55], [fx + ix * 1.3, y + h * 0.97, fz + iz * 1.3], [fx + ix * 1.9, y + h * 0.9, fz + iz * 1.9]], [0.26, 0.22, 0.18, 0.13, 0.07], (i) => (i ? BONE : BONE_D), { seg: 7, lumpy: 0.12, seed: k, kind: K.Plaster });
    b.collide({ kind: 'c', x: fx, z: fz, r: 0.34, y0: y - 1, y1: y + 1.4 });
  }
  // The backbone, half buried, round the far side outside the ribs.
  for (let a = 2.1; a < 4.6; a += 0.17) {
    const vx = x + Math.cos(a) * (R + 0.7), vz = z + Math.sin(a) * (R + 0.7), vy = b.y(vx, vz), g = b.g(vx, vz);
    g.blob(vx, vy - 0.1, vz, 0.32, 0.3, 0.32, BONE, Math.floor(a * 100), { kind: K.Plaster, flatBottom: true });
    g.beam([vx, vy + 0.1, vz], [vx + Math.cos(a) * 0.5, vy + 0.55, vz + Math.sin(a) * 0.5], 0.08, BONE_D, { kind: K.Plaster });
  }
  // The skull, half sunk in the sand, its jaw bones reaching toward the ring.
  const sa = Math.PI * 1.02, sx = x + Math.cos(sa) * (R + 1.3), sz = z + Math.sin(sa) * (R + 1.3), sy = b.y(sx, sz), g = b.g(sx, sz);
  g.blob(sx, sy - 0.25, sz, 1.6, 0.95, 1.25, BONE, 71, { kind: K.Plaster, flatBottom: true, detail: 1 });
  for (const s of [-1, 1]) {
    g.blob(sx + 0.75, sy + 0.35, sz + s * 0.6, 0.24, 0.22, 0.14, '#2a2620', 72 + s, { kind: K.Rock });
    g.sweep([[sx + 1.0, sy, sz + s * 0.7], [sx + 2.1, sy + 0.25, sz + s * 0.85], [sx + 3.1, sy + 0.05, sz + s * 0.6]], [0.18, 0.14, 0.08], BONE, { seg: 6, lumpy: 0.1, seed: 80 + s, kind: K.Plaster });
  }
  b.collide({ kind: 'c', x: sx, z: sz, r: 1.35, y0: sy - 1, y1: sy + 0.9 });
}

/** A giant clam, open, ridged, a pearl's glow inside (set on the trial's altar). */
function giantClam(b: Builder, x: number, y: number, z: number, rot: number) {
  const g = b.g(x, z), gl = b.gl(x, z);
  g.push().translate(x, y, z).rotateY(-rot);
  g.blob(0, 0, 0, 0.55, 0.16, 0.4, '#a890b8', 51, { kind: K.Rock, flatBottom: true, detail: 1 });
  g.push().translate(0, 0.14, -0.3).rotateX(-0.9);
  g.blob(0, 0, 0.32, 0.55, 0.12, 0.38, '#c8b0d8', 52, { kind: K.Rock, detail: 1 });
  g.pop();
  for (let k = -2; k <= 2; k++) g.box(k * 0.2, 0.1, 0.36, 0.06, 0.06, 0.06, '#e0c8f0', { kind: K.Rock });
  g.pop();
  gl.blob(x, y + 0.18, z, 0.1, 0.1, 0.1, [2.2, 2.6, 3], 53, { detail: 1, jitter: 0 });
  b.lights.add(x, y + 0.6, z, 0xbfefff, 2, 4, 0.2);
}

/** The crew's winch on Gull Rock: an A-frame of driftwood, a drum of rope, a boom out over the water toward the
 *  trench, the rope hanging down into it with a basket on its end. */
function winch(b: Builder, x: number, z: number, rot: number) {
  const g = b.g(x, z), y = b.y(x, z), c = Math.cos(rot), s = Math.sin(rot);
  g.push().translate(x, y, z).rotateY(-rot);
  for (const side of [-1, 1]) {
    g.beam([-0.5, 0, side * 0.55], [0, 2.2, side * 0.12], 0.07, '#6a5a48', { kind: K.Wood });
    g.beam([0.5, 0, side * 0.55], [0, 2.2, side * 0.12], 0.07, '#6a5a48', { kind: K.Wood });
  }
  g.push().translate(0, 0.75, 0).rotateX(Math.PI / 2);
  g.cyl(0, -0.4, 0, 0.18, 0.18, 0.8, 8, '#8a7a5a', { kind: K.Cloth });
  g.pop();
  g.beam([0, 0.75, 0.45], [0.2, 0.55, 0.55], 0.03, '#3a2a1e', { kind: K.Wood });
  g.beam([-0.3, 2.1, 0], [2.6, 2.4, 0], 0.07, '#5a4a3a', { kind: K.Wood });
  g.pop();
  const ex = x + c * 2.5, ez = z + s * 2.5, floor = b.y(ex, ez);
  g.beam([ex, y + 2.35, ez], [ex, Math.max(floor + 0.6, -2.4), ez], 0.02, '#a08a5a');
  g.cyl(ex, Math.max(floor + 0.1, -2.9), ez, 0.22, 0.28, 0.5, 8, '#8a6a3a', { kind: K.Wood });
  b.collide({ kind: 'c', x, z, r: 0.55, y0: y - 1, y1: y + 2.2 });
}

/** A crate to sit on, or two. */
function seat(b: Builder, x: number, z: number) {
  const g = b.g(x, z), y = b.y(x, z);
  g.box(x, y, z, 0.5, 0.36, 0.42, '#7a5c40', { kind: K.Wood });
  g.box(x, y + 0.3, z, 0.52, 0.05, 0.44, '#5e4430', { kind: K.Wood });
}

// ---------- the people ----------

/** A spot by one of the houses: r from the village's middle along the house's angle (in degrees), and to one
 *  side of that. */
const at = (deg: number, r: number, side = 0): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [VILLAGE.x + Math.cos(a) * r - Math.sin(a) * side, VILLAGE.z + Math.sin(a) * r + Math.cos(a) * side];
};

function folk(): NpcDef[] {
  const [gx, gz] = at(HOUSES[0], 8.1), [ix, iz] = at(HOUSES[1], 6.9), [mx, mz] = at(HOUSES[3] + 7, 6.5), [kx, kz] = at(HOUSES[3] + 16, 6.1);
  return [
    // The coral village's folk: the harbourmaster on his porch, the innkeeper by her door, the coral-smith at
    // her bench, the pearl-diver waiting for her son.
    { id: 'gannet', look: 'reefmaster', name: 'Gannet the Harbourmaster', x: gx, z: gz, face: 1, lines: [
      'The tide took our harbour. We built on the coral instead.',
      'There was a kingdom under the bay once. It drowned in a night, and its lord with it, and he never let go of it.',
      'His crew row out from the lighthouse isle and dive the wrecks. Their salvager goes down in a suit of brass. You would need one like it: take his. The shore road runs east to the sandbar, and the sandbar out to their isle.',
    ] },
    { id: 'dulse', look: 'reefwife', name: 'Dulse the Innkeeper', x: ix, z: iz, face: 1, shop: 'flask', lines: [
      'Sit down, you are dripping on my floor. Everyone is, these days.',
      'I fill the Moon Flasks at the shrine on the green. Same moon, saltier water. A new flask costs coin, mind.',
    ] },
    { id: 'shale', look: 'reefsmith', name: 'Shale the Coral-smith', x: SMITH.x, z: SMITH.z, pose: 'work', heading: Math.PI / 4, shop: 'sword', upTo: 7, lines: [
      'No forge here, and no fire. Coral is filed, not forged.',
      'Fire coral, filed fine and set along the edge. It bites the way the reef bites a careless foot.',
    ] },
    { id: 'maren', look: 'reefdiver', name: 'Maren the Pearl-diver', x: mx, z: mz, face: 1, lines: [
      'My son was taken toward the deep trenches...',
      'The crew came for pearls, and took the boy who finds them. Kip can hold his breath longer than any of us.',
      'Their floats run out past the wreck from the lighthouse isle. I cannot follow them that far down.',
    ], after: ['Kip is home. He has not stopped talking since.', 'He says you broke that cage like it was driftwood.'] },
    { id: 'kiphome', look: 'reefboy', name: 'Kip', x: kx, z: kz, face: 1, hidden: true, lines: ['Mum says no more diving. I am going to dive anyway.', 'The glowing thing in the trench? I will show you when I am bigger.'] },
    // ...and going about their day: the tide-reader by the shrine, a child round the green, the net-mender at
    // the kelp racks, the old diver at the end of the jetty, the beachcomber on the strand.
    { id: 'tally', look: 'reefold', name: 'Old Tally the Tide-reader', x: SHRINE.x + 1.6, z: SHRINE.z - 1.2, pose: 'sit', heading: 0.3, lines: [
      'The tide says: what the crew bring up, they keep on the lighthouse isle. The sandbar walks you out to it.',
      'The tide says: where bubbles rise from the floor, there is air. Stand in them and breathe.',
      'The tide says: the currents know the way. Ride them, not against them.',
      'The tide says: a roaring column of bubbles carries a diver up. Step into it.',
      'The tide says: the shrine mends whatever carries you. Bring it home hurt.',
      'The tide says: the coral grows round what the sea wants to keep. Look where it grows thickest.',
    ] },
    { id: 'shrimp', look: 'reefchild', name: 'Shrimp', x: 35.8, z: 63.4, roam: [[35.8, 63.4], [35.2, 67.8], [38.2, 69.6], [41.8, 67.4], [40.4, 62.2]], pause: 0.9, speed: 2.7, pose: 'play', lines: [
      'Are you going to fight the Tidelord? Kip said he would. Then the goblins took Kip.',
      'I can hold my breath for a hundred. Kip can do two hundred.',
    ], after: ['Kip is back! He says the trench is full of eyes.', 'I can hold my breath for a hundred and one now.'] },
    { id: 'ling', look: 'reefmender', name: 'Ling the Net-mender', x: at(160, 4.9)[0], z: at(160, 4.9)[1], roam: [at(160, 4.9), at(185, 4.9), at(208, 4.9)], pause: 6, speed: 1.1, pose: 'work', heading: Math.PI * 0.95, lines: [
      'Kelp on the racks, nets on the rails. The sea gives, if you keep asking.',
      'Maren has not mended a net since Kip went. I do hers as well.',
    ] },
    { id: 'hake', look: 'reefdiver2', name: 'Old Hake the Diver', x: 56.2, z: 66.6, pose: 'sit', heading: 0, wares: ['bladder'], lines: [
      'Forty years I dived this reef on one breath. Now I dive it from the end of the jetty.',
      "A goblin's suit, is it? It leaks. Sew a fish's air bladder to the hose and you will last longer down there. I have a few, for a little coin.",
    ] },
    { id: 'flotsam', look: 'reefcomber', name: 'Flotsam the Beachcomber', x: 29.8, z: 58.6, roam: [[29.8, 58.6], [26.4, 63.2], [26.8, 69.6], [30.2, 74.6]], pause: 4, speed: 1.3, wares: ['lodestone'], lines: [
      'Everything the sea takes, it gives back somewhere. Mostly here, mostly broken.',
      'Found a lodestone in the drowned streets. Hang it on your belt and loose coins come to you from further off. Cheap, for a knight.',
    ] },
    // Kip, in the crew's cage on Gull Rock.
    { id: 'kip', look: 'reefboy', name: 'Kip', x: CAGE.x, z: CAGE.z, face: 1, caged: true, lines: [
      'You came all the way down for me? In that suit? It leaks, you know.',
      'They made me dive into the trench for them. There is something down there that glows, and it watches.',
      'I hid the best pearls from them. Have them. I am swimming home, and I will not even be out of breath.',
    ] },
  ];
}

/** Everything of group 34's on the Sunken Reef, built onto the realm: its props now, and the data the realm
 *  hands the game (people, chests, shards, lore, the trial, Gull Rock's guards, regions). `under` says whether
 *  a spot is under the sea. */
export function buildReef(b: Builder, grid: Grid, under: (x: number, z: number) => boolean) {
  const r = mulberry32(3434);
  const ground = (x: number, z: number) => grid.groundAt(x, z);
  // Gull Rock is rock, not sand.
  for (let z = Math.floor(GULL_ROCK.z - 4); z <= GULL_ROCK.z + 4; z++)
    for (let x = Math.floor(GULL_ROCK.x - 4); x <= GULL_ROCK.x + 4; x++) if (grid.h[grid.i(x, z)] >= 0 && Math.hypot(x + 0.5 - GULL_ROCK.x, z + 0.5 - GULL_ROCK.z) < 3.6) grid.t[grid.i(x, z)] = r() < 0.7 ? T.Rock : T.Gravel;

  // The village: the coral shrine on the green, the tide-reader's seat by it, the coral-smith's bench, the old
  // diver's seat on the jetty's end.
  coralShrine(b, SHRINE.x, SHRINE.z);
  seat(b, SHRINE.x + 1.6, SHRINE.z - 1.2);
  coralBench(b, BENCH.x, BENCH.z, (Math.PI * 3) / 4);
  // The village's floats out to the Whalebone Isle; the crew's from their yard on the lighthouse isle, past the
  // wreck, to Gull Rock.
  for (const z of [69.8, 73, 76.2]) markerFloat(b, 57.3 + (z - 73) * 0.05, z, false);
  for (const [x, z] of [[106.4, 43.4], [108.6, 47], [110.6, 50.8], [112.6, 54.4], [114.4, 58], [116.1, 61.5]] as Pt[]) markerFloat(b, x, z, true);

  // The Whalebone Isle: the whale's bones round the ring, the giant clam on the trial's altar, sea-wrack on
  // the beach.
  whaleBones(b, WHALE_ISLE.x, WHALE_ISLE.z, 7.5);
  giantClam(b, WHALE_ISLE.x, ground(WHALE_ISLE.x, WHALE_ISLE.z) + 0.97, WHALE_ISLE.z, 0.4);
  for (const a of [0.7, 2.2, 4.1, 5.3]) b.rock(WHALE_ISLE.x + Math.cos(a) * 8.6, WHALE_ISLE.z + Math.sin(a) * 8.6, 0.4 + r() * 0.3);
  for (const [a, len, rot] of [[0.35, 2.4, 1.2], [2.75, 2, -0.4], [4.4, 2.8, 0.3]]) D.fallenLog(b, WHALE_ISLE.x + Math.cos(a) * 8.1, WHALE_ISLE.z + Math.sin(a) * 8.1, len, rot);
  // Dune grass in tufts round the isle's rim, outside the ring.
  for (let z = Math.floor(WHALE_ISLE.z - 9); z <= WHALE_ISLE.z + 9; z++)
    for (let x = Math.floor(WHALE_ISLE.x - 9); x <= WHALE_ISLE.x + 9; x++) {
      const d = Math.hypot(x + 0.5 - WHALE_ISLE.x, z + 0.5 - WHALE_ISLE.z), i = grid.i(x, z);
      if (d > 6.6 && grid.h[i] > 0.3 && fbm(x * 0.4, z * 0.4, 2, 95) > 0.5) grid.t[i] = T.Grass;
    }

  // Gull Rock: the cage on its trench side, the winch over the water, the crew's heap of baskets and nets.
  winch(b, GULL_ROCK.x + 3, GULL_ROCK.z + 0.9, Math.PI / 6);
  b.crate(GULL_ROCK.x - 1.1, GULL_ROCK.z - 2.1, 0.6);
  for (const [dx, dz] of [[-0.6, -1.6], [0.9, -1.2]]) seaRock(b, GULL_ROCK.x + dx * 2.4, GULL_ROCK.z + dz * 2.4, 0.5);

  // Secrets with no path. A bower of tall coral in the gardens (a gap on its far side), a shard inside it.
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + 0.35;
    if (k === 5) continue;
    const x = BOWER.x + Math.cos(a) * 1.7, z = BOWER.z + Math.sin(a) * 1.7;
    if (k % 3 === 0) seaFan(b, x, z, 1.25, a + Math.PI / 2, SEA.coralPurple);
    else branchCoral(b, x, z, 1.35 + r() * 0.3, k % 2 ? SEA.coralPink : SEA.coralOrange);
  }
  // The kelp's heart grown thicker round its shard and its chest.
  for (let k = 0; k < 14; k++) {
    const a = r() * Math.PI * 2, d = 1.4 + r() * 2.6, x = 100.5 + Math.cos(a) * d, z = 55.3 + Math.sin(a) * d, h = ground(x, z);
    if (h < -2.5) kelp(b, x, z, Math.min(-h - 0.6, 4 + r() * 3), 2 + Math.floor(r() * 2));
  }
  // A fishing boat of the village's, sunk off the lighthouse isle; another on the reef south of the village.
  b.rowboat(118, ground(118, 14) + 0.05, 14, 0.5);
  b.rowboat(40.5, ground(40.5, 101) + 0.05, 101, -0.8);

  // ---------- data ----------
  const enemies: EnemySpawn[] = [
    // The crew on Gull Rock, guarding the cage.
    { type: 'goblin', x: GULL_ROCK.x - 0.8, z: GULL_ROCK.z - 0.3, group: 'gull' },
    { type: 'goblin', x: GULL_ROCK.x + 1, z: GULL_ROCK.z - 0.7, group: 'gull' },
    { type: 'shield', x: GULL_ROCK.x - 0.4, z: GULL_ROCK.z + 2.4, group: 'gull' },
    { type: 'archer', x: GULL_ROCK.x - 3.2, z: GULL_ROCK.z - 1.9, group: 'gull', guard: true },
  ];
  const objects: ObjDef[] = [
    { kind: 'cage', id: 'kipcage', x: CAGE.x, z: CAGE.z },
    ...SHARDS.map((s): ObjDef => ({ kind: 'shard', ...s })),
    { kind: 'lore', id: 'r3lore1', x: 34.9, z: 60.2, text: 'The coral grows around what the sea wants to keep. The reef\'s folk built on it, and it has kept them too.' },
    { kind: 'lore', id: 'r3lore2', x: 85.2, z: 89.6, text: 'A kingdom sleeps beneath these waves, and its lord never left.' },
    { kind: 'lore', id: 'r3lore3', x: WHALE_ISLE.x + 2.2, z: WHALE_ISLE.z - 7.1, text: 'The whale came ashore the night the sea rose, a pearl in its mouth. The reef\'s folk say the clam has kept the pearl ever since, and gives it only to whoever holds the ring.' },
    { kind: 'lore', id: 'r3lore4', x: GULL_ROCK.x + 2.4, z: GULL_ROCK.z - 1.1, text: 'Scratched into the rock by a child\'s hand: a tally of dives, forty marks long. Beside it, KIP.' },
    // Chests, paid by how hidden: in the open by the ways (25-35), tucked away (45-50), hidden (75), and
    // the deepest (120).
    { kind: 'chest', id: 'r3_camp', x: 33.2, z: 24.2, rot: 0.5, coins: 30 },
    { kind: 'chest', id: 'r3_bar', x: 70.6, z: 31.2, rot: 0.2, coins: 25 },
    { kind: 'chest', id: 'r3_shallows', x: 15.6, z: 97.4, rot: 0.9, coins: 30 },
    { kind: 'chest', id: 'r3_gardens', x: 50.8, z: 57.2, rot: 0.3, coins: 25 },
    { kind: 'chest', id: 'r3_gardens2', x: 47.6, z: 78.4, rot: -0.6, coins: 30 },
    { kind: 'chest', id: 'r3_reefboat', x: 41.6, z: 102.2, rot: -0.8, coins: 45 },
    { kind: 'chest', id: 'r3_cliffs', x: 66, z: 6.4, rot: 0, coins: 45 },
    { kind: 'chest', id: 'r3_street', x: 82.6, z: 78.4, rot: 0.37, coins: 35 },
    { kind: 'chest', id: 'r3_northst', x: 92.6, z: 77.6, rot: -1.5, coins: 35 },
    { kind: 'chest', id: 'r3_plaza', x: 94, z: 89.6, rot: 2.2, coins: 35 },
    { kind: 'chest', id: 'r3_kelpwest', x: 77, z: 55, rot: 1.1, coins: 45 },
    { kind: 'chest', id: 'r3_kelpsouth', x: 87.6, z: 66.4, rot: -0.3, coins: 45 },
    { kind: 'chest', id: 'r3_vent', x: 108.4, z: 71.6, rot: 0.6, coins: 45 },
    { kind: 'chest', id: 'r3_gull', x: GULL_ROCK.x - 2, z: GULL_ROCK.z + 1.1, rot: 0.8, coins: 45, power: 'giant' },
    { kind: 'chest', id: 'r3_skull', x: WHALE_ISLE.x - 6.87, z: WHALE_ISLE.z + 0.6, rot: Math.PI / 2, coins: 50 },
    { kind: 'chest', id: 'r3_neboat', x: 119.2, z: 15.6, rot: 0.5, coins: 50, power: 'magnet' },
    { kind: 'chest', id: 'r3_kelpheart', x: 101.6, z: 54.2, rot: -2.2, coins: 75, power: 'wind' },
    { kind: 'chest', id: 'r3_shiprock', x: 129.4, z: 42.6, rot: 2.4, coins: 50 },
    { kind: 'chest', id: 'r3_trenchend', x: 136.4, z: 65, rot: -2.4, coins: 75 },
    { kind: 'chest', id: 'r3_trench', x: 72.4, z: 108.2, rot: -0.4, coins: 120, power: 'giant' },
    // The crew's kegs on Gull Rock.
    { kind: 'breakable', x: GULL_ROCK.x - 2.5, z: GULL_ROCK.z - 0.9, what: 'barrel' },
    { kind: 'breakable', x: GULL_ROCK.x + 0.8, z: GULL_ROCK.z - 2.5, what: 'barrel' },
  ];
  // The Whalebone Isle's trial: the crew wade ashore for the pearl, wave on wave.
  const trial: TrialDef = {
    x: WHALE_ISLE.x,
    z: WHALE_ISLE.z,
    relic: 'tidepearl',
    quest: 'pearl',
    prompt: 'Open the giant clam',
    wake: ['The tide comes in', 'The crew wade ashore for the pearl. Hold the ring until the tide turns.'],
    win: ['The Tide Pearl', 'Relic won: whatever carries you takes one more hit. The clam gives up 100 coins in lesser pearls.'],
    purse: 100,
    waves: [
      [{ type: 'goblin' }, { type: 'goblin' }, { type: 'archer' }],
      [{ type: 'shield' }, { type: 'goblin' }, { type: 'archer' }, { type: 'shaman' }],
      [{ type: 'brute', elite: true }, { type: 'shield' }, { type: 'goblin' }, { type: 'archer' }],
    ],
  };
  const regions: RegionDef[] = [
    { name: 'The Whalebone Isle', music: 'wilds', amb: 'shore', test: (x, z) => Math.hypot(x - WHALE_ISLE.x, z - WHALE_ISLE.z) < WHALE_ISLE.r + 2.6 && !under(x, z) },
    { name: 'Gull Rock', music: 'wilds', amb: 'shore', test: (x, z) => Math.hypot(x - GULL_ROCK.x, z - GULL_ROCK.z) < 6 },
  ];
  return { npcs: folk(), enemies, objects, trial, regions };
}
