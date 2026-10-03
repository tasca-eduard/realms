import { K } from '../engine/materials';
import { mulberry32 } from '../engine/util';
import type { CritterDef } from '../game/critters';
import { PAL, type Builder } from './builder';
import type { Grid } from './grid';
import type { Pt } from './paint';
import type { EnemySpawn, NpcDef } from './realm';

// ---------------------------------------------------------------------------
// Keepsfoot lived in (group 88): the village going about its night under the taken keep. The watch walks his
// round over the bridge with a lantern; Garrow hammers at his anvil and his boy works the bellows; two children
// chase round the well; an old couple sit on the bench by the square; the lamplighter goes from lamp to lamp
// with his pole; an angler sits on the bridge; washing hangs on a line on the stream bank; a drinker sits outside
// the Crescent & Crown; a girl feeds the hens behind Pip's house; the stallholder minds her stall, the carter
// hauls sacks to the tavern, a lad of the village watch paces the foot of the north road, the chapel's chaplain
// sweeps its step, a woman carries water from the well. Lanterns are strung from the well's roof to the houses
// round the square and across the street. Gnasher's camp is at its business before the fight: a boar on a spit
// over the fire, two goblins dicing on an upturned crate, a drummer at the war drum.
// What moves and what changes with the story (the feast after Tam comes home, lanterns up the north road once
// the drawbridge falls, everyone out in the square at dawn) is src/game/story/keepsfoot.ts.
// ---------------------------------------------------------------------------

/** The well in the middle of the square (as in realm1.ts), and the ridge ends of its little roof. */
export const WELL = { x: 78, z: 64.5 };
const RIDGE: [Pt, Pt] = [[77.0, 64.5], [79.0, 64.5]];
/** The feast table set out in front of the tavern once Tam is home: along x, benches either side. */
export const FEAST = { x0: 75.6, x1: 79.2, z: 60.8 };
/** The bench the drinker sits on, against the tavern's front right of its door. */
const DRINK = { x: 79.6, z: 57.65 };
/** The washing line on the stream bank below the street, and the tub. */
const LINE: [Pt, Pt] = [[84.3, 74.2], [87.9, 74.8]];
const TUB = { x: 85.2, z: 75.8 };
/** The hen-house behind Pip's house, and the yard its hens keep to. */
const COOP = { x: 67.0, z: 75.2 };
const HENS: [number, number, number, number] = [66.4, 72.2, 70.4, 74.5];
/** Where the angler sits on the bridge, and his float on the stream in front of him. */
export const ANGLER = { x: 93.55, z: 79.6, heading: 0 };
export const FLOAT = { x: 95.5, z: 79.6 };
/** The lamps round the square and down the street (realm1.ts), each lamp's head (it hangs 0.45 m off the post)
 *  and the spot the lamplighter stands at to reach it with his pole. */
export const LAMP_STOPS: { at: Pt; head: Pt }[] = [
  { at: [74.3, 59.6], head: [73.95, 58.8] },
  { at: [83.6, 61.6], head: [83.95, 60.5] },
  { at: [84.0, 67.5], head: [84.95, 68.8] },
  { at: [88.3, 72.4], head: [88.95, 73.5] },
  { at: [73.5, 66.6], head: [72.95, 68.5] },
];
/** Gnasher's camp (as in realm1.ts): the fire with its spit, the dicers' crate, the war drum. */
export const SPIT = { x: 95, z: 27 };
export const DICE = { x: 91.6, z: 26.4 };
export const DRUM = { x: 97.6, z: 29.4 };
/** The camp's goblins at their business: two dicing, one at the drum. Appended to the realm's foes (a foe's index
 *  is its save id) and posed by the story while they haven't seen the knight. */
export const BUSINESS: { spawn: EnemySpawn; role: 'dice' | 'drum'; face: Pt }[] = [
  { spawn: { type: 'goblin', x: 90.7, z: 27.0, group: 'camp' }, role: 'dice', face: [DICE.x, DICE.z] },
  { spawn: { type: 'goblin', x: 92.5, z: 25.8, group: 'camp' }, role: 'dice', face: [DICE.x, DICE.z] },
  { spawn: { type: 'goblin', x: 96.75, z: 28.65, group: 'camp' }, role: 'drum', face: [DRUM.x, DRUM.z] },
];
/** Lanterns the village hangs up the north road, toward Blackpine, once the drawbridge is down. */
export const NORTH_LANTERNS: Pt[] = [
  [86.4, 57.8], [83.5, 55.2], [87.6, 52.6], [84.1, 49.8], [87.4, 45.2], [83.9, 43.0], [87.7, 40.4], [85.2, 37.4], [90.2, 36.0], [88.2, 32.6],
];

/** Who holds what (the story hangs it in their right hand). */
export const HELD: Record<string, 'lantern' | 'pole' | 'hammer' | 'spear' | 'broom' | 'bucket'> = {
  kfwatch: 'lantern', kflamp: 'pole', smith: 'hammer', kfmilitia: 'spear', kfpriest: 'broom', kfwater: 'bucket',
};

const sit = Math.PI / 2;

/** Keepsfoot's people about their night (the five who were there already are in realm1.ts). */
function people(): NpcDef[] {
  const [a0, a60, a120, a180, a240, a300] = [0, 60, 120, 180, 240, 300].map((d): Pt => [WELL.x + Math.cos((d * Math.PI) / 180) * 1.6, WELL.z + Math.sin((d * Math.PI) / 180) * 1.6]);
  const S = LAMP_STOPS.map((s) => s.at);
  return [
    { id: 'kfwatch', look: 'kfwatch', name: 'Old Hob of the Watch', x: 83.4, z: 69.8, speed: 1.1, pause: 2.6,
      roam: [[83.4, 69.8], [88.0, 70.6], [92.6, 72.4], [92.6, 75.6], [92.6, 78.6], [92.6, 82.6], [92.6, 78.6], [92.6, 75.6], [92.6, 72.4], [88.0, 70.6]], lines: [
        'Hob of the Watch. Somebody has to walk the bridge at night, and the young ones went up the north road and did not come back.',
        'Goblins come down out of Blackpine for the sheep. They do not come over the bridge. Not while my lantern is lit.',
      ] },
    { id: 'kfboy', look: 'kfboy', name: 'Wat the Smith\'s Boy', x: 94.6, z: 68.9, pose: 'work', heading: -1.71, lines: [
      'Bellows. Up, down, up, down. Garrow says I will be a smith when I can do it in my sleep. I nearly can.',
      'He is making nails tonight. The goblins pulled half the doors in Keepsfoot off their hinges.',
    ] },
    { id: 'kfnell', look: 'kfnell', name: 'Nell', x: a0[0], z: a0[1], speed: 2.4, pause: 0.5, pose: 'play', roam: [a0, a60, a120, a180, a240, a300], lines: [
      'Dickon cannot catch me. Nobody can catch me. Not even a goblin.',
      'We are allowed as far as the well. Round and round is still as far as the well.',
    ] },
    { id: 'kfdickon', look: 'kfdickon', name: 'Dickon', x: a180[0], z: a180[1], speed: 2.4, pause: 0.5, pose: 'play', roam: [a180, a240, a300, a0, a60, a120], lines: [
      'I am nearly catching her. Watch.',
      'When I am big I will have a sword like yours. And a horse. And a moon on my shield.',
    ] },
    { id: 'kfaldous', look: 'kfaldous', name: 'Old Aldous', x: 74.5, z: 62.15, pose: 'sit', heading: 0, lines: [
      'Sixty years on this bench, and the keep was always lit up there. Now look at it. Dark as a pocket.',
      'I carried the old king\'s banner once, at the Mirrow. I was thinner then. So was the banner.',
    ] },
    { id: 'kfmabel', look: 'kfmabel', name: 'Old Mabel', x: 74.5, z: 62.85, pose: 'sit', heading: 0, lines: [
      'Do not mind Aldous. He tells the banner story to the well when there is nobody else.',
      'We sit out every night. If the goblins want our bench, they can ask.',
    ] },
    { id: 'kflamp', look: 'kflamp', name: 'Jory the Lamplighter', x: S[0][0], z: S[0][1], speed: 1.3, pause: 3.2,
      roam: [S[0], [78.4, 58.7], S[1], S[2], S[3], S[2], S[4], [73.0, 64.0]], lines: [
        'Every lamp in Keepsfoot, every night since the keep fell. Goblins do not like a lit street.',
        'Oil is dear and wicks are dearer. But a dark village is a village that has given up.',
      ] },
    { id: 'kfangler', look: 'kfangler', name: 'Osric the Angler', x: ANGLER.x, z: ANGLER.z, pose: 'fish', heading: ANGLER.heading, lines: [
      'Trout come up under the bridge for the lamplight. So do I.',
      'The stream runs down from the keep\'s hills. Some nights it tastes of goblin. I throw those ones back.',
    ] },
    { id: 'kfwasher', look: 'kfwasher', name: 'Edda the Washerwoman', x: 85.2, z: 74.95, speed: 1.2, pause: 5, pose: 'work', heading: Math.PI / 2,
      roam: [[85.2, 74.95], [85.3, 73.65], [87.0, 73.95]], lines: [
        'Washing by moonlight. It dries just as well, and nobody sees your mending.',
        'That blue one is Garrow\'s. Do not tell him it was pink before I got it.',
      ] },
    { id: 'kfdrinker', look: 'kfdrinker', name: 'Rufus', x: DRINK.x - 0.3, z: DRINK.z, pose: 'sit', heading: sit, lines: [
      'Brannoc put me out. Again. So I drink out here. It is a free village. Well. It was.',
      'I would fight the Goblin King myself, if he came down here. He does not come down here. Coward.',
    ] },
    { id: 'kfhens', look: 'kfhens', name: 'Bess', x: 69.1, z: 72.6, pose: 'work', heading: 2.5, lines: [
      'That is Duchess, that is Crumb, and that one pecks. Do not put your hand near that one.',
      'They have not laid since the goblins came. Mum says they are frightened. I am feeding them up.',
    ] },
    { id: 'kfstall', look: 'kfstall', name: 'Agnes at the Stall', x: 75.75, z: 68.4, speed: 0.8, pause: 6, pose: 'work', heading: Math.PI,
      roam: [[75.75, 68.4], [75.75, 70.0]], lines: [
        'Apples, cabbages, a gourd or two. The goblins took the good ones, so these are the brave ones.',
        'The apples come from the old Kings\' Orchard, behind the keep. Nobody dares pick there now. These are last year\'s.',
      ] },
    { id: 'kfcarter', look: 'kfcarter', name: 'Godric the Carter', x: 72.6, z: 71.0, speed: 1.3, pause: 2.5,
      roam: [[72.6, 71.0], [73.2, 65.2], [73.6, 60.4], [76.9, 58.1], [73.6, 60.4], [73.2, 65.2]], lines: [
        'Flour for Brannoc. Last of the mill\'s. The road south is burned, so this is all there is.',
        'Sack, tavern, sack, tavern. My back has a song about it. It is not a happy song.',
      ] },
    { id: 'kfmilitia', look: 'kfmilitia', name: 'Cole of the Village Watch', x: 84.6, z: 48.4, speed: 1.0, pause: 4,
      roam: [[84.6, 48.4], [87.4, 47.8]], lines: [
        'The north road goes up the steps into Blackpine. Goblins on it. I am to shout if any come down.',
        'I have practised the shout. Old Hob says it is a good shout. Hob is deaf.',
      ] },
    { id: 'kfpriest', look: 'kfpriest', name: 'Cuthbert the Chaplain', x: 94.3, z: 54.3, speed: 0.7, pause: 4, pose: 'work', heading: 2.2,
      roam: [[94.3, 54.3], [96.0, 54.5]], lines: [
        'The chapel stays open. The moon does not keep hours, and neither do we.',
        'I light a candle for everyone who goes up the north road. Yours will be lit tonight.',
      ] },
    { id: 'kfwater', look: 'kfwater', name: 'Alys', x: 80.25, z: 63.6, speed: 1.2, pause: 3.5,
      roam: [[80.25, 63.6], [82.6, 62.4], [86.4, 59.5], [82.6, 62.4]], lines: [
        'Water from the well, before the children fall in it. They will, one day.',
        'My man is a carpenter. The goblins keep breaking doors, so he keeps busy.',
      ] },
  ];
}

// ---------- small things ----------

/** A rope from a to b sagging `sag` at its middle, strung with little paper lanterns: warm, moon-blue, warm,
 *  violet... (glowing on their own: no light sources). */
function lanternString(b: Builder, a: [number, number, number], c: [number, number, number], sag: number, k0: number) {
  const L = Math.hypot(c[0] - a[0], c[2] - a[2]), n = Math.max(4, Math.round(L / 0.85)), g = b.g(a[0], a[2]);
  const at = (t: number): [number, number, number] => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (c[2] - a[2]) * t];
  const seg = 12;
  for (let i = 0; i < seg; i++) g.beam(at(i / seg), at((i + 1) / seg), 0.012, '#2a2420');
  const COLS: [number, number, number][] = [[2.6, 1.5, 0.55], [0.9, 1.3, 2.6], [2.6, 1.5, 0.55], [1.9, 0.9, 2.2]];
  for (let k = 1; k < n; k++) {
    const [x, y, z] = at(k / n), col = COLS[(k + k0) % COLS.length], gl = b.gl(x, z);
    g.beam([x, y, z], [x, y - 0.1, z], 0.006, '#2a2420');
    g.box(x, y - 0.13, z, 0.15, 0.03, 0.15, '#3a2e24');
    gl.box(x, y - 0.32, z, 0.13, 0.19, 0.13, col, { kind: 1 });
  }
}

/** A plain bench like the square's, with a tankard and a jug on it. */
function drinkersBench(b: Builder, x: number, z: number) {
  b.bench(x, z, 0);
  const g = b.g(x, z), y = b.y(x, z);
  g.cyl(x + 0.45, y + 0.42, z, 0.07, 0.07, 0.15, 7, '#8a8a90', { kind: K.Metal });
  g.box(x + 0.55, y + 0.5, z, 0.03, 0.08, 0.06, '#8a8a90');
  g.cyl(x - 0.95, y, z + 0.05, 0.13, 0.16, 0.34, 7, '#9a6a3a', { top: '#5a3a1e' });
}

/** A washing line between two posts, the wash pegged out on it (it stirs in the wind), a tub and a basket. */
function washing(b: Builder, a: Pt, c: Pt, tub: { x: number; z: number }) {
  const g = b.g(a[0], a[1]), y = b.y(a[0], a[1]), r = b.rng;
  for (const [x, z] of [a, c]) {
    g.box(x, b.y(x, z) - 0.05, z, 0.09, 1.85, 0.09, PAL.woodDark, { kind: K.Wood });
    b.collide({ kind: 'c', x, z, r: 0.1, y0: y - 1, y1: y + 1.8 });
  }
  const top = (t: number) => y + 1.72 - 0.18 * 4 * t * (1 - t);
  g.beam([a[0], top(0), a[1]], [c[0], top(1), c[1]], 0.008, '#d8d0c0');
  const rot = Math.atan2(c[0] - a[0], c[1] - a[1]);
  const WASH = ['#d8d0c0', '#4a6a9a', '#c8b890', '#7a4a8a', '#e0d8c8', '#8a3a3a', '#5a6a9a'];
  for (let t = 0.1; t < 0.92; t += 0.15 + r() * 0.06) {
    const x = a[0] + (c[0] - a[0]) * t, z = a[1] + (c[1] - a[1]) * t, w = 0.35 + r() * 0.35, h = 0.4 + r() * 0.4;
    g.push().translate(x, top(t), z).rotateY(rot + Math.PI / 2);
    g.box(0, -h, 0, w, h, 0.02, WASH[Math.floor(r() * WASH.length)], { kind: K.Cloth, wind: 0.9 });
    g.pop();
  }
  // The tub on its stool, suds on the water; a basket of wet things.
  const ty = b.y(tub.x, tub.z);
  g.cyl(tub.x, ty, tub.z, 0.36, 0.42, 0.42, 9, PAL.wood, { kind: K.Wood, cap: false });
  g.cyl(tub.x, ty + 0.36, tub.z, 0.39, 0.39, 0.02, 9, '#5a6a80');
  for (let k = 0; k < 5; k++) g.blob(tub.x + (r() - 0.5) * 0.4, ty + 0.4, tub.z + (r() - 0.5) * 0.4, 0.08, 0.04, 0.08, '#e0e4ec', 600 + k, { jitter: 0.2 });
  b.collide({ kind: 'c', x: tub.x, z: tub.z, r: 0.42, y0: ty - 1, y1: ty + 0.45 });
  const bx = c[0] - 0.6, bz = c[1] + 0.5, by = b.y(bx, bz);
  g.cyl(bx, by, bz, 0.24, 0.28, 0.26, 8, '#8a6a3a', { kind: K.Thatch });
  g.blob(bx, by + 0.26, bz, 0.22, 0.08, 0.22, '#c8c0b0', 611, { jitter: 0.2 });
}

/** A hen-house of boards with a thatch roof and a ramp, a feed trough, grain scattered in the yard. */
function henHouse(b: Builder, x: number, z: number) {
  const g = b.g(x, z), d = b.d(x, z), y = b.y(x, z), r = b.rng;
  g.box(x, y, z, 1.4, 0.85, 1.0, PAL.wood, { kind: K.Wood });
  g.push().translate(x, y + 0.85, z);
  g.gable(0, 0, 0, 1.6, 1.2, 0.5, PAL.thatch, PAL.wood, { kind: K.Thatch });
  g.pop();
  g.box(x + 0.3, y + 0.05, z - 0.51, 0.3, 0.32, 0.02, '#1a1410');
  g.beam([x + 0.3, y + 0.02, z - 1.1], [x + 0.3, y + 0.28, z - 0.53], 0.08, PAL.woodLight, { kind: K.Wood });
  b.collide({ kind: 'b', x0: x - 0.7, z0: z - 0.5, x1: x + 0.7, z1: z + 0.5, y0: y - 1, y1: y + 1.3 });
  g.box(x - 1.25, y, z - 0.9, 0.9, 0.2, 0.3, PAL.woodDark, { kind: K.Wood });
  g.box(x - 1.25, y + 0.18, z - 0.9, 0.8, 0.02, 0.22, '#c8a860');
  for (let k = 0; k < 40; k++) d.box(x - 1 + r() * 3.6, y + 0.01, z - 2.8 + r() * 2.2, 0.04, 0.01, 0.04, '#d8c080');
}

/** A spit over Gnasher's fire: two forked posts (the boar itself turns on it: the story's). */
function spitPosts(b: Builder, x: number, z: number) {
  const g = b.g(x, z), y = b.y(x, z);
  for (const s of [-1, 1]) {
    const px = x + s * 1.05;
    g.beam([px, y - 0.05, z], [px, y + 1.05, z], 0.05, PAL.barkDark, { kind: K.Bark });
    g.beam([px, y + 0.95, z], [px - s * 0.12, y + 1.25, z + 0.05], 0.03, PAL.barkDark, { kind: K.Bark });
    g.beam([px, y + 0.95, z], [px + s * 0.12, y + 1.25, z - 0.05], 0.03, PAL.barkDark, { kind: K.Bark });
    b.collide({ kind: 'c', x: px, z, r: 0.1, y0: y - 1, y1: y + 1.2 });
  }
  // A crank at one end, a dripping-pan under it.
  g.beam([x + 1.2, y + 1.08, z], [x + 1.2, y + 0.82, z + 0.12], 0.025, PAL.iron);
  g.cyl(x, y + 0.02, z + 0.75, 0.3, 0.32, 0.06, 8, PAL.iron, { kind: K.Metal });
}

/** The dicers' upturned crate: a cloth over it, the stakes in a heap (bones, a ring, coppers). */
function diceCrate(b: Builder, x: number, z: number) {
  const g = b.g(x, z), d = b.d(x, z), y = b.y(x, z), r = b.rng;
  g.box(x, y, z, 0.62, 0.42, 0.55, PAL.woodLight, { kind: K.Wood });
  g.box(x, y + 0.42, z, 0.5, 0.01, 0.46, '#6a2a1a', { kind: K.Cloth });
  for (let k = 0; k < 6; k++) d.box(x - 0.18 + r() * 0.16, y + 0.44, z + 0.08 + r() * 0.1, 0.05, 0.015, 0.05, k % 3 ? '#c8a040' : '#8a6a3a');
  d.box(x + 0.18, y + 0.44, z - 0.14, 0.06, 0.03, 0.04, '#d8d0b8');
  b.collide({ kind: 'b', x0: x - 0.31, z0: z - 0.28, x1: x + 0.31, z1: z + 0.28, y0: y - 1, y1: y + 0.45 });
}

/** The smith's boy's bellows, its nose at the brazier. */
function bellows(b: Builder, x: number, z: number, rot: number) {
  const g = b.g(x, z), y = b.y(x, z);
  g.push().translate(x, y + 0.25, z).rotateY(rot);
  g.box(0, 0, 0, 0.5, 0.06, 0.34, PAL.wood, { kind: K.Wood });
  g.box(0, 0.12, 0, 0.46, 0.12, 0.3, '#5a3a2a', { kind: K.Cloth });
  g.box(0, 0.24, 0, 0.5, 0.05, 0.34, PAL.wood, { kind: K.Wood });
  g.beam([0.25, 0.1, 0], [0.55, 0.06, 0], 0.03, PAL.iron);
  g.beam([-0.25, 0.26, 0], [-0.5, 0.42, 0], 0.025, PAL.woodDark);
  g.pop();
  g.box(x, y, z, 0.1, 0.25, 0.1, PAL.woodDark);
}

// ---------- the village ----------

/** Keepsfoot's night, built onto realm 1: its props now, and its people, the camp's goblins at their business and
 *  the hens. `folk` are the people already placed (realm1.ts): Garrow turns to his anvil, Brannoc to his counter. */
export function buildKeepsfoot(b: Builder, grid: Grid, folk: NpcDef[]) {
  const keep = b.rng;
  b.rng = mulberry32(8808);
  const y = (x: number, z: number) => grid.groundAt(x, z);

  // Lanterns strung from the well's roof to the houses round the square, across the north road, and across the
  // street from the smithy to the lamps on the stream side.
  const [rw, re] = RIDGE, wy = y(WELL.x, WELL.z) + 2.58;
  const strings: [[number, number, number], [number, number, number], number][] = [
    [[rw[0], wy, rw[1]], [70.85, y(70, 61.8) + 3.6, 61.8], 0.5],
    [[rw[0], wy, rw[1]], [75.0, 4.0, 57.05], 0.55],
    [[re[0], wy, re[1]], [81.0, 4.0, 57.05], 0.55],
    [[re[0], wy, re[1]], [88.12, y(88, 65.6) + 2.3, 65.6], 0.6],
    [[re[0], wy, re[1]], [79.6, y(79.6, 72.4) + 2.3, 72.42], 0.5],
    [[rw[0], wy, rw[1]], [69.8, y(69.8, 68.4) + 2.3, 68.4], 0.5],
    [[81.8, 4.0, 57.05], [86.7, y(86.7, 58.4) + 3.6, 58.4], 0.45],
    [[89.6, y(89.6, 68.8) + 2.3, 68.75], [88.5, y(88.5, 73.5) + 2.25, 73.5], 0.3],
    [[93.0, y(93.0, 68.8) + 2.3, 68.75], [95.2, y(95.2, 73.4) + 2.25, 73.4], 0.3],
  ];
  strings.forEach(([a, c, sag], k) => lanternString(b, a, c, sag, k));

  // The drinker's bench by the tavern door; the washing on the bank below the street; the hen-house behind Pip's house; the
  // boy's bellows at the forge's brazier; the angler's creel and bait-pot on the bridge.
  drinkersBench(b, DRINK.x, DRINK.z);
  washing(b, LINE[0], LINE[1], TUB);
  henHouse(b, COOP.x, COOP.z);
  bellows(b, 94.55, 68.25, Math.PI / 2 + 0.15);
  {
    const x = ANGLER.x - 0.35, z = ANGLER.z + 0.65, g = b.g(x, z), yy = y(x, z);
    g.cyl(x, yy, z, 0.2, 0.22, 0.3, 8, '#8a6a3a', { kind: K.Thatch, top: '#5a4a2a' });
    g.cyl(x, yy, z - 1.25, 0.1, 0.12, 0.14, 7, '#6a6a70', { kind: K.Metal });
  }

  // Gnasher's camp at its business: the spit over the fire, the dicers' crate.
  spitPosts(b, SPIT.x, SPIT.z);
  diceCrate(b, DICE.x, DICE.z);

  b.rng = keep;

  // Garrow turns to his anvil (the story swings his hammer and throws the sparks); Brannoc wipes down his counter.
  const smith = folk.find((n) => n.id === 'smith'), keeper = folk.find((n) => n.id === 'keeper');
  if (smith) Object.assign(smith, { pose: 'work', heading: Math.atan2(65.5 - smith.z, 94.4 - smith.x) });
  if (keeper) Object.assign(keeper, { pose: 'work', heading: Math.PI / 2 });

  const critters: CritterDef[] = [[67.4, 73.1], [68.3, 73.8], [69.6, 73.4], [67.0, 72.6]].map(([x, z]): CritterDef => ({ kind: 'chicken', x, z, area: HENS }));
  return { npcs: people(), enemies: BUSINESS.map((o) => o.spawn), critters };
}
