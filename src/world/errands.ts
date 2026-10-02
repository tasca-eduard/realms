import { K } from '../engine/materials';
import { mulberry32 } from '../engine/util';
import type { Builder } from './builder';
import type { Grid } from './grid';
import type { Pt } from './paint';
import type { NpcDef } from './realm';
import { brainCoral, branchCoral, SEA, seaFan, seaRock } from './sea';

// ---------------------------------------------------------------------------
// The Sunken Reef's errands: small things to do, each with its own person or thing and its own reward
// (the story's side of them is src/game/story/errands.ts).
//   a message in a bottle   washed up on the beach west of the coral village: a map to an X of stones on the
//                           north dunes, where a chest is buried (strike the X to dig)
//   the current race        Pike, a diver lad on the jetty, bets the knight can't beat his time through a
//                           line of glowing rings off Gull Rock: along a current over the abyss, up the column
//                           of bubbles at the trench's end, back on a second current to the rock
//   glowing bait            Brill, fishing off the jetty, wants five glowing shrimp from the coral gardens;
//                           he pays, and mixes what's left into the knight's Moon Flasks (they heal more)
//   the lost diver          Cockle went down to the village's sunk boat off the lighthouse isle's far side and
//                           is stranded on a reef ledge out of air, in a bubble of his last breath: lead him to
//                           a column of bubbles, a vent or the shallows (his wife Merrow waits in the village)
//   the night raid          once the salvager's suit is won, the crew wade ashore at the village one night
// ---------------------------------------------------------------------------

/** The bottle, at the tide line on the beach west of the village. */
export const BOTTLE = { x: 21.6, z: 76.1 };
/** The X of stones on the north dunes, between the crew's camp and the cliffs, where the chest is buried. */
export const DIG = { x: 57.5, z: 15.5 };
/** The glowing shrimp, among the coral of the gardens off the jetty. */
export const SHRIMP: Pt[] = [[52.6, 60.6], [57.6, 56.8], [55.2, 70.8], [63.4, 72.6], [50.6, 76.2]];
/** Cockle's ledge: the edge of the reef shelf that rises east of the lighthouse isle, by the sunk boat. */
export const LEDGE = { x: 125.0, z: 25.2 };
/** Where Cockle and his wife stand in the village once he's home: the green's south-west, looking out to sea. */
export const WINKLE = { x: 34.6, z: 73.6 };
/** The coral village's middle (as in realm3.ts) and its houses' angles, for the raid. */
export const VILLAGE = { x: 37, z: 66 };
export const HOUSES = [-52, -16, 22, 57, 92];
/** Where the crew wade ashore on the night of the raid: the shallows between the houses, and the jetty. */
export const RAID: { type: 'goblin' | 'shield' | 'archer' | 'harpooner'; x: number; z: number }[] = [
  { type: 'harpooner', x: 45.6, z: 60.6 },
  { type: 'goblin', x: 51.6, z: 66.4 },
  { type: 'goblin', x: 48.2, z: 66.2 },
  { type: 'shield', x: 44.9, z: 72.6 },
  { type: 'harpooner', x: 33.2, z: 77.2 },
  { type: 'archer', x: 39.0, z: 56.0 },
];

/** The east column of bubbles out of the trench (realm3.ts's third), which the race climbs. */
const EAST_LIFT = { x: 132.5, z: 70.5 };
/** Its top, as the realm works it out: a little over the highest rim round it. */
function liftTop(grid: Grid, x: number, z: number) {
  let rim = -99;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 12)
    for (const d of [3.5, 4.5, 5.5]) {
      const h = grid.groundAt(x + Math.cos(a) * d, z + Math.sin(a) * d);
      if (h > -11 && h < 0) rim = Math.max(rim, h);
    }
  return rim + 0.8;
}

/** One of the race's rings: where its middle is, and the way through it. */
export interface RingDef {
  x: number;
  y: number;
  z: number;
  /** The way through it (a ring in a column lies flat: 0, 0). */
  dx: number;
  dz: number;
}

/** The race's currents: out along the trench over the abyss (in two straight runs that overlap at the bend, so
 *  that it never lets him drop at the corner), and back from the column's top to Gull Rock. */
function raceCurrents(grid: Grid) {
  const top = liftTop(grid, EAST_LIFT.x, EAST_LIFT.z);
  return [
    { pts: [[116.8, 75.6], [122.8, 77.2]] as Pt[], y: -3.2, r: 1.5, speed: 6.5 },
    // (It lets him go over the trench's floor short of the column, clear of the current back: he sinks, and walks in.)
    { pts: [[120.6, 77.4], [129.2, 72.9]] as Pt[], y: -3.2, r: 1.5, speed: 6.5 },
    // (From the column's middle: at its top the current has him at once, and takes him back to the rock.)
    { pts: [[EAST_LIFT.x, EAST_LIFT.z], [126.4, 70.6]] as Pt[], y: top + 0.8, r: 1.4, speed: 5.5 },
  ];
}

/** The rings: the start on the trench's lip west of Gull Rock, two in the first current, two in the column, one in
 *  the current back, the finish where it leaves him at the foot of Gull Rock. */
export function raceRings(grid: Grid): RingDef[] {
  const top = liftTop(grid, EAST_LIFT.x, EAST_LIFT.z), floor = grid.groundAt(EAST_LIFT.x, EAST_LIFT.z);
  const at = (x: number, z: number, dx: number, dz: number, y = grid.groundAt(x, z) + 1.3) => ({ x, y, z, dx, dz });
  return [
    at(116.0, 74.0, 0.5, 1),
    at(121.2, 76.8, 1, 0.27, -3.2),
    at(126.5, 74.3, 1, -0.52, -3.2),
    at(EAST_LIFT.x, EAST_LIFT.z, 0, 0, floor + (top - floor) * 0.45),
    at(EAST_LIFT.x, EAST_LIFT.z, 0, 0, top + 0.9),
    at(129.0, 70.56, -1, 0, top + 0.8),
    at(126.2, 70.6, -1, 0.1),
  ];
}

// ---------- props ----------

/** Pale beach stones laid in an X on the sand (the map's mark), half sunk, one or two kicked aside. */
function stoneX(b: Builder, x: number, z: number, rot: number) {
  const g = b.g(x, z), r = b.rng;
  for (const arm of [rot, rot + Math.PI / 2])
    for (let k = -3; k <= 3; k++) {
      if (!k && arm !== rot) continue;
      const d = k * 0.45 + (r() - 0.5) * 0.08, sx = x + Math.cos(arm) * d, sz = z + Math.sin(arm) * d, s = 0.2 + r() * 0.07;
      g.blob(sx, b.y(sx, sz) - 0.02, sz, s * 1.2, s * 0.65, s, k % 2 ? '#e8e2d0' : '#d4ccb4', Math.floor(r() * 999), { kind: K.Rock, flatBottom: true });
    }
  g.blob(x + 1.1, b.y(x + 1.1, z + 0.5) - 0.02, z + 0.5, 0.16, 0.1, 0.14, '#d8d2c0', 7, { kind: K.Rock, flatBottom: true });
}

/** The fisher's things on the jetty: a bucket, a creel, a coil of line, a spare rod laid along the planks. */
function fisherGear(b: Builder, x: number, z: number) {
  const g = b.g(x, z), y = b.y(x, z);
  g.cyl(x - 0.7, y, z + 0.1, 0.17, 0.2, 0.32, 8, '#6a5a48', { kind: K.Wood });
  g.cyl(x - 0.7, y + 0.3, z + 0.1, 0.2, 0.2, 0.03, 8, '#3a3a40', { kind: K.Metal, cap: false });
  g.cyl(x + 0.75, y, z + 0.05, 0.24, 0.2, 0.36, 7, '#9a7a4a', { kind: K.Wood });
  g.cyl(x + 0.75, y + 0.36, z + 0.05, 0.25, 0.25, 0.04, 7, '#7a5a34', { kind: K.Wood });
  g.cyl(x - 0.25, y, z - 0.5, 0.2, 0.2, 0.06, 10, '#b8a878', { kind: K.Cloth });
  g.beam([x - 1.4, y + 0.04, z - 0.3], [x + 0.4, y + 0.04, z - 0.55], 0.025, '#5a4430', { kind: K.Wood });
}

/** A glass float of the village's on a line down to a stone, glowing coral-rose: it marks the race's start. */
function raceFloat(b: Builder, x: number, z: number) {
  const g = b.g(x, z), gl = b.gl(x, z), floor = b.y(x, z);
  g.beam([x, floor + 0.1, z], [x, -0.1, z], 0.015, '#8a7a5a');
  g.blob(x, floor + 0.1, z, 0.22, 0.16, 0.2, SEA.stoneDark, 63, { kind: K.Rock, flatBottom: true });
  gl.blob(x, 0.06, z, 0.22, 0.18, 0.22, [2.2, 0.9, 1.2], 95, { detail: 1, jitter: 0, wind: 0.6 });
  g.box(x - 0.24, -0.02, z - 0.03, 0.48, 0.06, 0.06, '#8a7a5a', { wind: 0.6 });
}

/** Cockle's ledge: the reef shelf's edge crusted with coral behind him (to the north and east, out of the camera's
 *  way), his basket of shellfish dropped at his feet. */
function ledge(b: Builder, x: number, z: number) {
  const r = mulberry32(3838), keep = b.rng;
  b.rng = r;
  for (const [dx, dz, s] of [[-0.6, -2.1, 1.0], [0.9, -1.9, 0.8], [2.2, -1.2, 0.9], [-1.6, -1.5, 0.6]]) seaRock(b, x + dx, z + dz, s);
  branchCoral(b, x + 1.6, z - 2.3, 0.9, SEA.coralOrange);
  seaFan(b, x - 0.2, z - 2.8, 1.1, 0.4, SEA.coralPurple);
  brainCoral(b, x + 2.8, z - 0.2, 0.6);
  branchCoral(b, x - 2.4, z - 0.4, 0.6, SEA.coralPink);
  const g = b.g(x, z), y = b.y(x + 0.7, z + 0.6);
  g.cyl(x + 0.7, y - 0.05, z + 0.6, 0.24, 0.3, 0.34, 7, '#9a7a4a', { kind: K.Wood, rot: 0.3 });
  for (let k = 0; k < 4; k++) g.blob(x + 0.95 + k * 0.12, y + 0.04, z + 0.85 - k * 0.05, 0.08, 0.05, 0.07, '#5a5a6a', 40 + k, { kind: K.Rock });
  b.rng = keep;
}

// ---------- the people ----------

function people(): NpcDef[] {
  return [
    // On the jetty: Brill fishing off its south edge, Pike the diver lad by its root.
    { id: 'brill', look: 'reeffisher4', name: 'Brill the Fisher', x: 53.0, z: 67.1, pose: 'fish', heading: Math.PI / 2, lines: [
      'Nothing bites at night but the glowing kind, and the glowing kind only bite glowing bait.',
      'There are shrimp in the coral gardens that shine like lamps. Five would do me. I cannot dive any more, my ears go.',
    ], after: ['Fish are biting. Your flasks are glowing. Everyone wins.'] },
    { id: 'pike', look: 'reeflad2', name: 'Pike the Diver Lad', x: 47.4, z: 65.6, lines: [
      'You dive in THAT? In a goblin\'s suit? Bet you cannot beat my time.',
      'The race is off Gull Rock, past the wreck: glowing rings, on the trench\'s lip west of the rock. Ride the current over the abyss, up the column of bubbles at the trench\'s end, and back on the current to the rock.',
      'Swim through the first ring and the clock starts. Sixteen breaths, that is my time. Beat it and my winnings are yours.',
    ], after: ['You cheated. I do not know how, but you cheated.', 'Again? The rings are still lit. Go on, then.'] },
    // Merrow on the green's south-west, watching the sea for her husband; Cockle beside her once he's home.
    { id: 'merrow', look: 'reefwife2', name: 'Merrow the Diver\'s Wife', x: WINKLE.x, z: WINKLE.z, face: 1, pose: 'sit', heading: Math.PI / 2, lines: [
      'Cockle went down at first light, to the boat we lost off the lighthouse isle\'s far side. He wanted its nets back.',
      'He has not come up. He always comes up. He holds his breath longer than his temper.',
    ], after: ['He is home and dripping on my floor, and I have never been so glad of it.'] },
    { id: 'cocklehome', look: 'reefdiver3', name: 'Cockle the Diver', x: WINKLE.x - 1.1, z: WINKLE.z - 0.5, face: 1, hidden: true, lines: [
      'A bubble of my own breath, and it went smaller every time I looked at it. I am never diving again.',
      'Tomorrow, maybe. Not today.',
    ] },
    // Cockle on his ledge, under the sea.
    { id: 'cockle', look: 'reefdiver3', name: 'Cockle the Diver', x: LEDGE.x, z: LEDGE.z, face: 1, lines: [
      'Knight! I went after the boat\'s nets and my breath ran out. This bubble is all I have left of it.',
      'Get me to a column of bubbles, or a vent, or up into the shallows. I will follow you. Do not go fast.',
    ] },
  ];
}

/** Everything of the errands' on the Sunken Reef, built onto the realm: its props now, and the data the realm
 *  hands the game (its people and the race's currents). `under` says whether a spot is under the sea. */
export function buildErrands(b: Builder, grid: Grid, _under: (x: number, z: number) => boolean) {
  stoneX(b, DIG.x, DIG.z, 0.45);
  fisherGear(b, 53.0, 66.75);
  raceFloat(b, 116.0, 74.0);
  ledge(b, LEDGE.x, LEDGE.z);
  return { npcs: people(), currents: raceCurrents(grid) };
}
