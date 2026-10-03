import * as THREE from 'three';
import { Geo } from '../engine/geo';
import type { LightPool } from '../engine/lights';
import { K } from '../engine/materials';
import { P, type Particles } from '../engine/particles';
import { mulberry32 } from '../engine/util';
import { GLOW, PAL, type Builder } from './builder';
import * as D from './details';
import { NONE, type Grid } from './grid';
import { distLine, type Pt } from './paint';
import type { NpcDef, RegionDef } from './realm';
import { boughPath, diceAt, homeTree, rootOut, trunkUp, WOOD } from './wood';
import { WOOD_ZONES } from './lightzones';

// ---------------------------------------------------------------------------
// Hollowbough lived in (group 93): the inn tree's hollow made a room you walk into (the Owl and Acorn: a
// counter with Moss behind it, the hearth, a round table, a lute by the fire, the Moon Flasks glowing on their
// shelf); children on a rope swing on the north shore; Granny Yarrow telling the old tales to her listeners on
// the west shore; Kestrel the lookout up in the elder's treehouse; Old Elm carving by the road east; the
// weaver's loom at Old Sorrel's door; foragers coming home down the lanes; Linden the lamplighter round the
// lakeside lanterns; Rush drawing water. Four trees round the village scarred by the Warden's thorns (green
// again once the Thorn Heart is torn out), and lantern posts up every lane out of the village (dark while the
// Warden holds the wood; lit, and strung with garlands, once he falls). Everything placed where the game camera
// sees it (rays from the camera, the crowns counted solid). What moves and what changes with the story is
// src/game/story/hollowlife.ts.
// ---------------------------------------------------------------------------

type V3 = [number, number, number];

/** The inn's hollow: a room in the swollen foot of the inn tree (set by innTree). */
export interface InnRoom {
  x: number;
  z: number;
  y: number;
  /** Which way its doorway faces (radians round the trunk). */
  face: number;
  /** Its walls' middle radius, and the floor's radius inside them. */
  wall: number;
  floor: number;
  name: string;
}

/** What the village's story needs of what was built (set each time the realm is built). */
export const HOLLOW: {
  inn: InnRoom | null;
  /** The rope swing: where its ropes hang from, how long they are, which way it swings (radians). */
  swing: { x: number; y: number; z: number; len: number; dir: number } | null;
  /** The weaver's loom: the middle of its cloth, which way it faces, how wide. */
  loom: { x: number; y: number; z: number; rot: number; w: number } | null;
  /** The thorn-scarred trees: their foot, trunk radius, where their boughs end. */
  scarred: { x: number; y: number; z: number; r: number; h: number; tips: V3[] }[];
  /** The lane lanterns: where each hangs, the lane it belongs to and its side of it. */
  lamps: { x: number; y: number; z: number; lane: number }[];
} = { inn: null, swing: null, loom: null, scarred: [], lamps: [] };

/** The inn's name, over its door and as its region. */
export const INN_NAME = 'The Owl and Acorn';

// Where things stand (from a map of what the game camera sees over Hollowbough, 2026-10-03: the Heart Oak's
// crown and the home trees' hide much of the north-west shore and the south shore; these are in the open).
/** The swing tree on the north shore, between the lakeside path and the Whisper. */
const SWING_TREE = { x: 50.2, z: 56.0 };
/** Granny Yarrow's storytelling spot on the west shore, and which way she faces. */
const TALE = { x: 33.2, z: 72.1, face: 0.2 };
/** Old Elm's carving block by the road east, below the lookout's tree. */
const CARVE = { x: 82.4, z: 63.0 };
/** The thorn-scarred trees: west shore, north shore, by the road east, south of the bay. */
const SCARRED: [number, number, number][] = [[29.6, 66.2, 1], [61.4, 55.5, 0.9], [86.8, 62.2, 1.05], [48.4, 97.8, 0.95]];

const BARK = WOOD.bark, BARK_D = WOOD.barkDark;
/** The inn's room by angle from its doorway (radians round it): the counter at the back (Moss behind it), the kegs,
 *  the hearth, the lutenist's seat by it, the round table and its two regulars across from them. (All in the
 *  camera's view: the Old Grove's first oak, which stood on its line, moved a little east; see realm2.ts.) */
const ROOM = { counter: Math.PI, kegs: [Math.PI + 0.75, Math.PI + 0.98], hearth: Math.PI - 1.25, lute: Math.PI - 2.05, table: -1.3, sitters: [-0.75, -1.85] };
const LANTERN_FRAME = '#2e2a24', LANTERN_DARK = '#3a3428';

// ---------- the inn's hollow ----------

/**
 * The inn tree, its foot swollen into a round room you walk into through an open doorway: bark walls of great
 * ridges (the half toward the camera fades while the knight is inside, as a roof does), a cone of bark over it
 * up to the trunk, windows lit warm, the hearth's chimney up the bark. Its crown and treehouse are homeTree's own,
 * drawn the same as ever (its dice drawn the same, so nothing placed after it moves); the trunk above the room
 * follows the same line up to them. Returns what homeTree does (the doorstep, the treehouse's deck).
 */
export function innTree(b: Builder, grid: Grid, x: number, z: number, s: number, face: number) {
  // The crown and treehouse, on a builder that keeps only its structures (the plain trunk, door, windows,
  // roots, lights and smoke go nowhere: the hollow draws its own).
  const junk = new Geo(), junkGl = new Geo(true);
  const crownOnly = Object.create(b) as Builder;
  crownOnly.g = () => junk;
  crownOnly.gl = () => junkGl;
  crownOnly.d = () => junk;
  crownOnly.collide = () => {};
  crownOnly.lights = { add: () => ({ on: true, level: 1 }) } as unknown as LightPool;
  crownOnly.fx = { addEmitter: () => {} } as unknown as Particles;
  const made = homeTree(crownOnly, x, z, s, { face, treehouse: true, chimney: true });

  const y = grid.groundAt(x, z), R = 1.9 * s, H = 9 * s, d = diceAt(x, z, 31);
  const WALL = 2.75, THICK = 0.36, HR = 2.9, FLOOR = WALL - THICK - 0.05;
  HOLLOW.inn = { x, z, y, face, wall: WALL, floor: FLOOR, name: INN_NAME };
  const room = b.structure('inn', new THREE.Box3(new THREE.Vector3(x - WALL - 0.6, y - 0.5, z - WALL - 0.6), new THREE.Vector3(x + WALL + 0.6, y + HR + 1.8, z + WALL + 0.6)), [x - 2.15, z - 2.15, x + 2.15, z + 2.15], y);
  const core = room.core, shell = room.shell, g = b.g(x, z), gl = b.gl(x, z);
  // (The half of the room toward the camera is its shell.)
  const near = (a: number) => Math.cos(a - Math.PI / 4) > -0.15;
  const pt = (a: number, r: number, h: number): V3 => [x + Math.cos(a) * r, y + h, z + Math.sin(a) * r];

  // The trunk above the room, along the line homeTree's trunk takes (the same dice), up into its crown.
  const at = trunkUp(junk, x, y + 0.1, z, R, R * 0.72, H - 0.1, BARK, diceAt(x, z, 4), { seg: 12, sway: 0.16, flare: 0.16, lumpy: 0.045, straight: 6.4 * s });
  const up: V3[] = [], upR: number[] = [];
  for (let h = HR + 0.4; h <= H + 0.01; h += (H - HR - 0.4) / 6) {
    up.push(at(y + h));
    upR.push(R - R * 0.28 * Math.min(1, h / H));
  }
  g.sweep(up, upR, BARK, { kind: K.Bark, seg: 12, lumpy: 0.05, seed: 3101 });
  // The bark shoulders over the room up to the trunk (shell: it fades with the walls).
  shell.cyl(x, y + HR - 0.2, z, WALL + 0.3, R * 0.95, 1.9, 14, BARK_D, { kind: K.Bark, rot: d() });
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + d() * 0.5;
    shell.beam(pt(a, WALL + 0.15, HR - 0.1), pt(a + 0.1, R * 0.9, HR + 1.6), 0.22, k % 2 ? BARK : BARK_D, { kind: K.Bark });
  }
  // Moss on the shoulders' north side, ferns growing out of it.
  for (let k = 0; k < 4; k++) {
    const a = -Math.PI / 2 + (k - 1.5) * 0.45, [mx, my, mz] = pt(a, WALL - 0.2, HR + 0.6);
    shell.blob(mx, my, mz, 0.7, 0.32, 0.5, k % 2 ? WOOD.moss : '#3d5a33', 3110 + k, { kind: K.Grass, jitter: 0.3 });
  }

  // The walls: great ridges of bark standing round the room, leaning in a little at the top, the doorway open
  // between two of them.
  const DOOR = 0.42, N = 23, step = (Math.PI * 2 - DOOR * 2) / (N - 1);
  for (let k = 0; k < N; k++) {
    const a = face + DOOR + k * step, geo = near(a) ? shell : core, w = d();
    const r0 = THICK * (0.95 + w * 0.25);
    geo.sweep([pt(a, WALL + 0.1, -0.4), pt(a + (w - 0.5) * 0.05, WALL + 0.02, HR * 0.5), pt(a, WALL - 0.25, HR + 0.15)], [r0 * 1.15, r0, r0 * 0.85], k % 3 ? BARK : BARK_D, { kind: K.Bark, seg: 6, lumpy: 0.14, seed: 3120 + k });
    b.collide({ kind: 'c', x: x + Math.cos(a) * WALL, z: z + Math.sin(a) * WALL, r: THICK, y0: y - 1, y1: y + HR + 2 });
  }
  // The lining within: smooth pale heartwood, warm in the firelight (on the far side only: the near side fades).
  for (let k = 0; k < 16; k++) {
    const a = face + Math.PI * 0.32 + (k / 15) * Math.PI * 1.36;
    if (near(a)) continue;
    core.push().translate(x + Math.cos(a) * (WALL - THICK - 0.02), y, z + Math.sin(a) * (WALL - THICK - 0.02)).rotateY(Math.PI / 2 - a);
    core.box(0, 0, 0, 1.0, HR - 0.2, 0.06, k % 2 ? '#8a6a48' : '#7a5a3c', { kind: K.Wood });
    core.pop();
  }
  // Over the doorway: a lintel of living wood, the bark above it to the shoulders; a hood of shingles; a stone
  // step; the door swung back against the wall outside; the inn's sign, a mug, hung from a root over the lane.
  const lintel = boughPath(pt(face - DOOR - 0.05, WALL, 2.0), pt(face + DOOR + 0.05, WALL, 2.0), 0.24, 0.24, d, 4, -0.08);
  shell.sweep(lintel.pts, lintel.rad, BARK_D, { kind: K.Bark, seg: 6, lumpy: 0.12, seed: 3150 });
  shell.push().translate(...pt(face, WALL, 2.1)).rotateY(Math.PI / 2 - face);
  shell.box(0, 0, 0, 1.6, HR - 2.0, 0.5, BARK, { kind: K.Bark });
  for (const sd of [-1, 1]) {
    shell.push().translate(sd * 0.45, 0.2, 0.45).rotateZ(sd * -0.55);
    shell.box(0, 0, 0, 1.0, 0.08, 0.7, '#6a4a30', { kind: K.Wood });
    shell.pop();
  }
  shell.pop();
  g.push().translate(...pt(face, WALL + 0.35, 0)).rotateY(Math.PI / 2 - face);
  g.box(0, -0.18, 0.2, 1.4, 0.2, 0.7, PAL.stone, { kind: K.Flag });
  g.box(-1.05, 0.02, 0.15, 0.08, 1.85, 0.75, PAL.wood, { kind: K.Wood });
  g.box(-1.05, 0.9, 0.2, 0.1, 0.06, 0.6, '#3a2a1a');
  g.pop();
  {
    const sa = face + DOOR + 0.35, [sx, , sz] = pt(sa, WALL + 0.9, 0);
    g.beam(pt(sa, WALL - 0.1, 2.5), [sx, y + 2.75, sz], 0.09, BARK_D, { kind: K.Bark });
    D.hangingSign(g, sx, y + 2.6, sz, -sa, 'mug');
  }
  // Windows lit warm in the walls (they fade with the shell), and two up the trunk above.
  for (const [ra, h] of [[0.85, 1.25], [-0.95, 1.35], [-1.6, 1.2]] as [number, number][]) {
    const a = face + ra, geo = near(a) ? shell : core, glo = near(a) ? room.shellGlow : room.glow;
    geo.push().translate(...pt(a, WALL + THICK * 0.7, h)).rotateY(Math.PI / 2 - a);
    geo.box(0, 0, 0.0, 0.7, 0.7, 0.12, PAL.woodDark, { kind: K.Wood });
    geo.box(0, -0.08, 0.1, 0.8, 0.08, 0.2, PAL.wood, { kind: K.Wood });
    geo.pop();
    glo.push().translate(...pt(a, WALL + THICK * 0.7, h)).rotateY(Math.PI / 2 - a);
    glo.box(0, 0.08, 0.07, 0.5, 0.5, 0.02, GLOW.window, {});
    glo.pop();
  }
  for (const [ra, h] of [[-0.65, 4.3 * s], [0.2, 5.8 * s]] as [number, number][]) {
    const a = face + ra, [cx, , cz] = at(y + h), rr = R - R * 0.28 * (h / H) - 0.04;
    g.push().translate(cx + Math.cos(a) * rr, y + h, cz + Math.sin(a) * rr).rotateY(Math.PI / 2 - a);
    g.box(0, 0, 0.06, 0.62, 0.62, 0.1, PAL.woodDark, { kind: K.Wood });
    for (const sd of [-0.46, 0.46]) g.box(sd, 0.02, 0.12, 0.26, 0.56, 0.05, '#5a3a22', { kind: K.Wood });
    g.pop();
    gl.push().translate(cx + Math.cos(a) * rr, y + h, cz + Math.sin(a) * rr).rotateY(Math.PI / 2 - a);
    gl.box(0, 0.06, 0.12, 0.44, 0.46, 0.02, [1.7, 1.05, 0.42], {});
    gl.pop();
  }
  // A lantern by the door, the light out of the doorway, and the treehouse's own (homeTree's went with the rest).
  {
    const la = face - DOOR - 0.3, [lx, , lz] = pt(la, WALL + 0.8, 0);
    g.beam(pt(la, WALL - 0.1, 2.4), [lx, y + 2.2, lz], 0.07, BARK_D, { kind: K.Bark });
    g.beam([lx, y + 2.2, lz], [lx, y + 1.85, lz], 0.012, '#8a7a5a');
    gl.box(lx, y + 1.6, lz, 0.22, 0.3, 0.22, GLOW.window, {});
    b.lights.add(lx, y + 1.5, lz, 0xffa050, 4, 5, 0.2);
    const [dx, , dz] = pt(face, WALL + 1.3, 0);
    b.lights.add(dx, y + 1.2, dz, 0xffa050, 5, 5, 0.25);
    const ha = face + 0.35, hx = x + Math.cos(ha) * (R + 0.9), hz = z + Math.sin(ha) * (R + 0.9);
    b.lights.add(hx + Math.cos(face) * 1.6, y + 6.4 * s + 0.9, hz + Math.sin(face) * 1.6, 0xffa050, 3, 4, 0.25);
  }
  // Roots out of the foot, short (the kilns lane runs close by on the west, the doorway faces the road).
  for (const ra of [1.25, 2.0, 2.6, -1.3, -2.1]) {
    const a = face + ra;
    if (Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) < 0.7) continue;
    rootOut(b, g, x, z, a, WALL, 1.2, 0.3, 0.9, BARK_D, d, false);
  }

  // Within: a floor of boards (a deck, so nothing grows through it), a rug.
  for (let cz = Math.floor(z - FLOOR); cz <= Math.ceil(z + FLOOR); cz++)
    for (let cx = Math.floor(x - FLOOR); cx <= Math.ceil(x + FLOOR); cx++)
      if (Math.hypot(cx + 0.5 - x, cz + 0.5 - z) < FLOOR - 0.2) {
        const i = grid.i(cx, cz);
        grid.deck[i] = y + 0.05;
        grid.noGrass[i] = 1;
      }
  core.push().translate(x, y, z).rotateY(-face);
  for (let k = -6; k <= 6; k++) {
    const w = Math.sqrt(Math.max(0, FLOOR * FLOOR - (k * 0.4) ** 2)) * 2;
    core.box(0, -0.05, k * 0.4, w, 0.1, 0.38, k % 3 ? '#6e5038' : '#5e4430', { kind: K.Wood });
  }
  core.box(0.3, 0.05, 0, 2.6, 0.012, 1.2, '#5a3a5a', { kind: K.Cloth });
  core.box(0.3, 0.055, 0, 2.4, 0.012, 1.0, '#8a6a3a', { kind: K.Cloth });
  core.pop();
  // The counter at the back on the left, curved with the wall: Moss's side of it against the wall; kegs at its end; behind
  // it a shelf of Moon Flasks glowing pale blue (she fills them from the Heartpool), jars and cups.
  const back = face + ROOM.counter;
  for (const ra of [-0.42, 0, 0.42]) {
    const a = back + ra, [cx, , cz] = pt(a, 1.35, 0);
    core.push().translate(cx, y, cz).rotateY(Math.PI / 2 - a);
    core.box(0, 0, 0, 0.62, 1.0, 0.5, '#6e4e34', { kind: K.Wood, top: '#8a6a48' });
    core.box(0, 0.05, 0.27, 0.6, 0.06, 0.04, PAL.woodDark, { kind: K.Wood });
    core.pop();
    b.collide({ kind: 'c', x: cx, z: cz, r: 0.33, y0: y - 1, y1: y + 1.1 });
  }
  core.cyl(...pt(back - 0.2, 1.35, 1.0), 0.07, 0.06, 0.16, 6, PAL.gold);
  core.cyl(...pt(back + 0.25, 1.35, 1.0), 0.06, 0.05, 0.14, 6, '#8a8a90');
  for (const ra of ROOM.kegs) {
    const [kx, , kz] = pt(face + ra, 2.0, 0);
    core.push().translate(0, y, 0);
    b.barrel(kx, kz, core);
    core.pop();
    b.collide({ kind: 'c', x: kx, z: kz, r: 0.3, y0: y - 1, y1: y + 0.9 });
  }
  for (const sh of [1.25, 1.75]) {
    for (let k = 0; k < 7; k++) {
      const a = back - 0.42 + k * 0.14, [bx, by, bz] = pt(a, WALL - THICK - 0.18, sh + 0.05);
      if (k % 2 === 0) room.glow.box(bx, by, bz, 0.09, 0.2, 0.09, GLOW.moon, {});
      else core.cyl(bx, by, bz, 0.06, 0.05, 0.16 + (k % 3) * 0.05, 6, ['#6a4a2a', '#4a5a3a', '#8a8a6a'][k % 3]);
    }
    core.push().translate(...pt(back, WALL - THICK - 0.18, sh)).rotateY(Math.PI / 2 - back);
    core.box(0, 0, 0, 1.1, 0.05, 0.28, PAL.woodDark, { kind: K.Wood });
    core.pop();
  }
  b.lights.add(...pt(back, WALL - 0.7, 1.6), 0x9ab8ff, 1.6, 3, 0.1);
  // The hearth on the left as you come in: river stones round a fire that is always in, a kettle on its hob;
  // the smoke goes up a stone chimney outside, up the bark.
  const ha = face + ROOM.hearth, [hx, , hz] = pt(ha, 2.15, 0);
  core.push().translate(hx, y, hz).rotateY(Math.PI / 2 - ha);
  core.box(0, 0, 0, 1.3, 1.3, 0.55, PAL.stoneDark, { kind: K.Brick });
  core.box(0, 0, -0.29, 0.8, 0.85, 0.04, '#0a0808');
  core.box(0, 1.25, -0.05, 1.5, 0.1, 0.7, PAL.woodDark, { kind: K.Wood });
  core.cyl(0.45, 1.35, 0, 0.1, 0.08, 0.18, 6, '#3a3a40');
  core.pop();
  room.glow.box(...pt(ha, 1.85, 0.05), 0.4, 0.3, 0.4, GLOW.flame, { kind: 1 });
  b.fx.addEmitter({ x: x + Math.cos(ha) * 1.85, y: y + 0.3, z: z + Math.sin(ha) * 1.85, rate: 14, spec: { color: [4.5, 2.2, 0.6], color2: [1.4, 0.25, 0.05], size: 2, size2: 1, life: 0.45, gravity: -2.2, drag: 2, fadeIn: 0.05 }, spread: 0.3, vy: 0.5 });
  b.lights.add(...pt(ha, 1.2, 1.0), 0xff8a38, 10, 6, 0.3);
  b.fires.push({ x: x + Math.cos(ha) * 1.85, y: y + 0.3, z: z + Math.sin(ha) * 1.85, big: false });
  b.collide({ kind: 'c', x: hx, z: hz, r: 0.55, y0: y - 1, y1: y + 1.5 });
  {
    const [cx, , cz] = pt(ha, R + 0.35, 0);
    g.box(cx, y + HR + 0.6, cz, 0.55, 3.4, 0.55, PAL.stoneDark, { kind: K.Brick });
    g.box(cx, y + HR + 3.95, cz, 0.7, 0.12, 0.7, '#55525c', { kind: K.Brick });
    b.fx.addEmitter({ x: cx, y: y + HR + 4.3, z: cz, rate: 1.1, spec: P.smoke, spread: 0.2, vy: 0.4 });
  }
  // A round table of a single slice of oak on the right, two stools; two lanterns hung from the roof's ribs.
  {
    const ta = face + ROOM.table, [tx, , tz] = pt(ta, 1.35, 0);
    core.cyl(tx, y, tz, 0.16, 0.12, 0.7, 7, BARK, { kind: K.Bark });
    core.cyl(tx, y + 0.7, tz, 0.55, 0.55, 0.09, 12, '#9a7a52', { kind: K.Wood, top: '#b08a5a' });
    core.cyl(tx + 0.15, y + 0.79, tz - 0.1, 0.05, 0.04, 0.12, 6, PAL.woodLight);
    core.cyl(tx - 0.2, y + 0.79, tz + 0.12, 0.05, 0.05, 0.13, 6, '#8a8a90');
    room.glow.box(tx, y + 0.8, tz + 0.05, 0.05, 0.1, 0.05, GLOW.flame, { kind: 1 });
    b.lights.add(tx, y + 1.3, tz, 0xffa050, 2.2, 3.5, 0.2);
    b.collide({ kind: 'c', x: tx, z: tz, r: 0.55, y0: y - 1, y1: y + 0.85 });
    for (const sa of ROOM.sitters) core.cyl(...pt(face + sa, 1.7, 0), 0.2, 0.18, 0.42, 7, PAL.wood, { kind: K.Wood });
  }
  for (const ra of [Math.PI / 2 + 0.2, -Math.PI / 2 - 0.3]) {
    const [lx, , lz] = pt(face + ra, 1.2, 0);
    core.beam([lx, y + HR + 0.3, lz], [lx, y + 2.3, lz], 0.01, '#8a7a5a');
    room.glow.box(lx, y + 2.05, lz, 0.18, 0.24, 0.18, GLOW.window, {});
    b.lights.add(lx, y + 1.9, lz, 0xffa050, 2, 4, 0.15);
  }
  return made;
}

/** A builder that draws a tree's trunk and roots into a structure of their own, so they fade as a crown does while
 *  they stand between the camera and the knight (the Old Grove's first oak, on the camera's line to the inn's room).
 *  Its crown, colliders and dice are the tree's as ever. */
export function trunkFades(b: Builder, x: number, z: number, h: number) {
  const y = b.y(x, z), s = b.structure('trunk', new THREE.Box3(new THREE.Vector3(x - 1.7, y - 1, z - 1.7), new THREE.Vector3(x + 1.7, y + h, z + 1.7)));
  const fb = Object.create(b) as Builder;
  fb.g = () => s.core;
  fb.d = () => s.core;
  fb.gl = () => s.glow;
  return fb;
}

// ---------- the village's things ----------

/** A rope swing's tree: a stout oak whose great low bough reaches out over the bank, a crown above it (fading
 *  when it hides the knight), the ropes' knots on the bough. Returns where the ropes hang from. */
function swingTree(b: Builder, x: number, z: number, dir: number): V3 {
  const g = b.g(x, z), y = b.y(x, z), d = diceAt(x, z, 41);
  const at = trunkUp(g, x, y, z, 0.62, 0.4, 6.2, BARK, d, { seg: 9, lean: 0.4, sway: 0.12, flare: 0.35, lumpy: 0.1 });
  for (const a of [1.9, 3.4, 4.6, 5.6]) rootOut(b, g, x, z, a + dir, 0.5, 1.4, 0.2, 0.6, BARK_D, d, false);
  b.collide({ kind: 'c', x, z, r: 0.7, y0: y - 1, y1: y + 6 });
  // The swing bough: out level from the trunk at four metres, a little up at its end.
  const from = at(y + 3.6), to: V3 = [x + Math.cos(dir) * 4.8, y + 4.4, z + Math.sin(dir) * 4.8];
  const { pts, rad } = boughPath(from, to, 0.3, 0.12, d, 7, 0.04);
  g.sweep(pts, rad, BARK, { kind: K.Bark, seg: 7, lumpy: 0.12, seed: 4101 });
  // Where along it the ropes hang (three and a half metres out, under the bough).
  let best = pts[0], bd = 1e9;
  for (const p of pts) {
    const e = Math.abs(Math.hypot(p[0] - x, p[2] - z) - 3.5);
    if (e < bd) [bd, best] = [e, p];
  }
  const pivot: V3 = [best[0], best[1] - 0.16, best[2]];
  for (const sd of [-1, 1]) {
    const kx = pivot[0] - Math.sin(dir) * sd * 0.28, kz = pivot[2] + Math.cos(dir) * sd * 0.28;
    g.box(kx - 0.06, pivot[1] - 0.02, kz - 0.06, 0.12, 0.22, 0.12, '#a08a5a');
  }
  // The crown: over the trunk and back from the bough (so the swing stays in the open), fading like the others.
  const cs = b.structure('crown', new THREE.Box3(new THREE.Vector3(x - 5, y + 4.6, z - 5), new THREE.Vector3(x + 5, y + 10, z + 5)));
  const tips: V3[] = [];
  for (let k = 0; k < 4; k++) {
    const a = dir + Math.PI * 0.6 + k * 0.85 + d() * 0.3, f = at(y + 4.4 + k * 0.4);
    const t: V3 = [x + Math.cos(a) * 2.6, y + 6.4 + d() * 1.2, z + Math.sin(a) * 2.6];
    const bp = boughPath(f, t, 0.2, 0.08, d, 4);
    cs.core.sweep(bp.pts, bp.rad, BARK, { kind: K.Bark, seg: 5, lumpy: 0.12, seed: 4110 + k });
    tips.push(t);
  }
  tips.push([at(y + 6.2)[0], y + 7.4, at(y + 6.2)[2]], [x + Math.cos(dir) * 3.2, y + 6.0, z + Math.sin(dir) * 3.2]);
  for (const [cx, cy, cz] of tips)
    for (let k = 0; k < 2; k++)
      cs.core.blob(cx + (d() - 0.5) * 1.6, cy + (d() - 0.3) * 0.8, cz + (d() - 0.5) * 1.6, 1.3 + d() * 0.5, 0.9 + d() * 0.3, 1.3 + d() * 0.5, d() < 0.5 ? WOOD.leaf : WOOD.leaf2, 4120 + k + Math.floor(cx * 7), { kind: K.Leaves, wind: 0.2, jitter: 0.3, detail: 1 });
  // A worn patch of earth under the swing, and a second, older rope cut short on the bough.
  b.d(x, z).box(pivot[0] - 0.9, y - 0.03, pivot[2] - 0.5, 1.8, 0.04, 1.0, '#5a4a32', { kind: K.Grass });
  const [ox, oy, oz] = pts[2];
  g.beam([ox, oy - 0.15, oz], [ox + 0.05, oy - 0.95, oz], 0.025, '#8a7a5a', { wind: 0.4 });
  return pivot;
}

/** A tree scarred by the Warden's thorns: a trunk and bare-looking boughs here (the leaves, or the thorns and the
 *  dead leaves, are the story's: they change when the Thorn Heart is torn out). */
function scarredTree(b: Builder, x: number, z: number, s: number) {
  const g = b.g(x, z), y = b.y(x, z), d = diceAt(x, z, 43), h = 4.6 * s, r = 0.42 * s;
  const at = trunkUp(g, x, y, z, r, r * 0.6, h, '#4a4038', d, { seg: 8, lean: 0.35, sway: 0.14, flare: 0.3, lumpy: 0.12 });
  b.collide({ kind: 'c', x, z, r: r + 0.1, y0: y - 1, y1: y + h });
  for (const a of [0.6, 2.4, 4.1]) rootOut(b, g, x, z, a + d(), r * 0.8, 1.0 * s, 0.14 * s, 0.4, BARK_D, d, false);
  const tips: V3[] = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + d() * 0.6, f = at(y + h * (0.55 + d() * 0.3));
    const t: V3 = [x + Math.cos(a) * 2.1 * s, f[1] + (1.1 + d() * 1.0) * s, z + Math.sin(a) * 2.1 * s];
    const bp = boughPath(f, t, 0.15 * s, 0.05, d, 4);
    g.sweep(bp.pts, bp.rad, '#4a4038', { kind: K.Bark, seg: 5, lumpy: 0.14, seed: 4300 + k + Math.floor(x) });
    tips.push(t);
  }
  tips.push([at(y + h)[0], y + h + 0.6 * s, at(y + h)[2]]);
  HOLLOW.scarred.push({ x, y, z, r, h: h * 0.75, tips });
}

/** A lantern post up a lane: a crooked pole of hazel, an arm out over the way, a lantern hung from it (dark
 *  glass while the Warden holds the wood: the story lights it). */
function lanePost(b: Builder, x: number, z: number, ax: number, az: number, lane: number) {
  const g = b.g(x, z), y = b.y(x, z), r = b.rng;
  const kx = x + (r() - 0.5) * 0.12, kz = z + (r() - 0.5) * 0.12, top: V3 = [x + ax * 0.08, y + 2.7, z + az * 0.08];
  g.beam([x, y - 0.1, z], [kx, y + 1.3, kz], 0.07, '#5a4430', { kind: K.Bark });
  g.beam([kx, y + 1.3, kz], top, 0.06, '#5a4430', { kind: K.Bark });
  const end: V3 = [x + ax * 0.6, y + 2.75, z + az * 0.6];
  g.beam([top[0], top[1] - 0.15, top[2]], end, 0.04, '#5a4430', { kind: K.Bark });
  const lx = end[0], lz = end[2], ly = y + 2.2;
  g.beam(end, [lx, ly + 0.32, lz], 0.01, '#8a7a5a');
  g.box(lx, ly + 0.28, lz, 0.26, 0.05, 0.26, LANTERN_FRAME);
  g.pyramid(lx, ly + 0.33, lz, 0.24, 0.24, 0.12, LANTERN_FRAME);
  g.box(lx, ly - 0.04, lz, 0.24, 0.05, 0.24, LANTERN_FRAME);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.box(lx + sx * 0.11, ly, lz + sz * 0.11, 0.025, 0.28, 0.025, LANTERN_FRAME);
  g.box(lx, ly + 0.01, lz, 0.17, 0.25, 0.17, LANTERN_DARK);
  b.collide({ kind: 'c', x, z, r: 0.12, y0: y - 1, y1: y + 2.6 });
  HOLLOW.lamps.push({ x: lx, y: ly + 0.01, z: lz, lane });
}

/** The weaver's loom: an upright frame of pale ash, the warp threads strung, the cloth woven up from the bottom
 *  (spider silk and nettle thread: grey-white, faintly shining), a bench before it. (rot: the way the weaver
 *  faces it.) */
function loom(b: Builder, x: number, z: number, rot: number) {
  const g = b.g(x, z), y = b.y(x, z), W = 1.5;
  g.push().translate(x, y, z).rotateY(Math.PI / 2 - rot);
  for (const sd of [-1, 1]) {
    g.box(sd * W * 0.5, 0, 0, 0.1, 1.75, 0.12, '#a08a62', { kind: K.Wood });
    g.box(sd * W * 0.5, 0, -0.25, 0.08, 0.08, 0.5, '#8a7450', { kind: K.Wood });
  }
  for (const h of [0.35, 1.62]) g.box(0, h, 0, W + 0.1, 0.09, 0.1, '#8a7450', { kind: K.Wood });
  g.box(0, 1.2, 0.08, W - 0.1, 0.06, 0.06, '#6a5a3a', { kind: K.Wood });
  for (let k = 0; k < 15; k++) g.box(-W * 0.45 + (k * W * 0.9) / 14, 0.85, 0, 0.012, 0.8, 0.012, '#d8d4c8');
  g.box(0, 0.42, 0.005, W * 0.9, 0.45, 0.02, '#c8c8c0', { kind: K.Cloth });
  for (let k = 0; k < 4; k++) g.box(0, 0.47 + k * 0.1, 0.02, W * 0.9, 0.012, 0.012, k % 2 ? '#8a9a7a' : '#b8b0a0');
  g.pop();
  b.gl(x, z).push().translate(x, y, z).rotateY(Math.PI / 2 - rot);
  b.gl(x, z).box(0, 0.88, 0.01, W * 0.9, 0.01, 0.01, [0.9, 1.0, 1.1], {});
  b.gl(x, z).pop();
  b.collide({ kind: 'c', x: x - Math.sin(rot) * 0.45, z: z + Math.cos(rot) * 0.45, r: 0.4, y0: y - 1, y1: y + 1.8 });
  b.collide({ kind: 'c', x: x + Math.sin(rot) * 0.45, z: z - Math.cos(rot) * 0.45, r: 0.4, y0: y - 1, y1: y + 1.8 });
  HOLLOW.loom = { x, y: y + 0.9, z, rot, w: W * 0.9 };
}

/** Old Elm's carving block: a stump with a half-carved stag on it, shavings, his tools, and a plank on two logs
 *  with what he has finished (an owl, a fox, a hedgehog, a stag). */
function carving(b: Builder, x: number, z: number, rot: number) {
  const g = b.g(x, z), d = b.d(x, z), y = b.y(x, z), r = b.rng;
  const c = Math.cos(rot), s = Math.sin(rot), at = (u: number, v: number): Pt => [x + c * u - s * v, z + s * u + c * v];
  const [bx, bz] = at(0.8, 0);
  g.cyl(bx, y - 0.05, bz, 0.4, 0.36, 0.55, 8, BARK, { kind: K.Bark, top: '#b09a70' });
  b.collide({ kind: 'c', x: bx, z: bz, r: 0.4, y0: y - 1, y1: y + 0.6 });
  // The stag coming out of a log: its body still part block, its head and one antler free.
  g.push().translate(bx, y + 0.5, bz).rotateY(-rot);
  g.box(-0.18, 0, -0.1, 0.36, 0.22, 0.2, '#c8a878', { kind: K.Wood });
  g.blob(0.04, 0.3, 0, 0.18, 0.1, 0.08, '#d8b888', 4401, { jitter: 0.1 });
  g.beam([0.18, 0.32, 0], [0.26, 0.5, 0], 0.035, '#d8b888');
  g.blob(0.27, 0.53, 0, 0.06, 0.05, 0.045, '#d8b888', 4402, { jitter: 0.1 });
  g.beam([0.27, 0.58, 0.02], [0.22, 0.72, 0.08], 0.012, '#c8a878');
  g.beam([0.27, 0.58, -0.02], [0.33, 0.7, -0.06], 0.012, '#c8a878');
  g.pop();
  for (let k = 0; k < 26; k++) {
    const a = r() * Math.PI * 2, rr = 0.2 + r() * 1.1, [sx, sz] = [bx + Math.cos(a) * rr, bz + Math.sin(a) * rr];
    d.box(sx, y + 0.005, sz, 0.08 + r() * 0.06, 0.012, 0.03, r() < 0.5 ? '#d8c098' : '#c8a878');
  }
  // The finished ones on their plank.
  const [px, pz] = at(0.3, -1.3);
  for (const sd of [-0.55, 0.55]) {
    const [lx, lz] = [px + c * sd, pz + s * sd];
    g.cyl(lx, y - 0.05, lz, 0.18, 0.16, 0.4, 7, BARK, { kind: K.Bark, top: '#a08a60' });
  }
  g.push().translate(px, y + 0.35, pz).rotateY(-rot);
  g.box(0, 0, 0, 1.5, 0.06, 0.34, PAL.wood, { kind: K.Wood });
  // An owl, a fox curled up, a hedgehog, a little stag.
  g.blob(-0.5, 0.15, 0, 0.08, 0.12, 0.08, '#b89868', 4410, { jitter: 0.05 });
  g.box(-0.55, 0.25, -0.02, 0.03, 0.04, 0.03, '#b89868');
  g.box(-0.45, 0.25, -0.02, 0.03, 0.04, 0.03, '#b89868');
  g.blob(-0.15, 0.08, 0, 0.13, 0.07, 0.1, '#c88a58', 4411, { jitter: 0.08, flatBottom: true });
  g.blob(0.15, 0.06, 0, 0.09, 0.06, 0.07, '#8a6a48', 4412, { jitter: 0.25, flatBottom: true });
  g.box(0.42, 0.03, -0.03, 0.18, 0.1, 0.06, '#c8a878');
  g.beam([0.5, 0.12, 0], [0.56, 0.24, 0], 0.025, '#c8a878');
  g.beam([0.56, 0.24, 0], [0.52, 0.34, 0.04], 0.01, '#c8a878');
  g.pop();
  b.collide({ kind: 'b', x0: Math.min(px - c * 0.8, px + c * 0.8) - 0.2, z0: Math.min(pz - s * 0.8, pz + s * 0.8) - 0.2, x1: Math.max(px - c * 0.8, px + c * 0.8) + 0.2, z1: Math.max(pz - s * 0.8, pz + s * 0.8) + 0.2, y0: y - 1, y1: y + 0.6 });
  // A mallet and a gouge on the block's edge; a pile of seasoning logs behind him.
  g.box(bx - 0.25, y + 0.5, bz + 0.2, 0.3, 0.06, 0.06, PAL.woodDark, { kind: K.Wood });
  g.box(bx - 0.3, y + 0.5, bz + 0.2, 0.1, 0.1, 0.1, '#6a5a40', { kind: K.Wood });
  for (let k = 0; k < 4; k++) {
    const u = -1.4 + (k % 3) * 0.3, ly = y + 0.14 + (k > 2 ? 0.26 : 0), [ax, az] = at(u, -0.3), [bx2, bz2] = at(u, 1.1);
    g.beam([ax, ly, az], [bx2, ly, bz2], 0.14, k % 2 ? '#6a4a30' : PAL.woodDark, { kind: K.Bark });
  }
  const [wx, wz] = at(-1.1, 0.4);
  b.collide({ kind: 'c', x: wx, z: wz, r: 0.75, y0: y - 1, y1: y + 0.6 });
}

/** Granny Yarrow's spot: a mossy log at her back, a lantern on a crook stuck in the ground, a jar of glow-worms
 *  (Whisperwood's own green light) at her side, a basket of her mending. */
function tellingSpot(b: Builder, x: number, z: number, face: number) {
  const g = b.g(x, z), gl = b.gl(x, z), y = b.y(x, z);
  D.fallenLog(b, x - Math.cos(face) * 0.75, z - Math.sin(face) * 0.75, 2.2, face + Math.PI / 2);
  const cx = x + Math.cos(face + 1.35) * 1.0, cz = z + Math.sin(face + 1.35) * 1.0;
  g.beam([cx, y - 0.1, cz], [cx + 0.05, y + 1.5, cz], 0.045, '#5a4430', { kind: K.Bark });
  g.beam([cx + 0.05, y + 1.5, cz], [cx + Math.cos(face) * 0.35, y + 1.75, cz + Math.sin(face) * 0.35], 0.035, '#5a4430', { kind: K.Bark });
  const lx = cx + Math.cos(face) * 0.38, lz = cz + Math.sin(face) * 0.38;
  g.beam([lx, y + 1.74, lz], [lx, y + 1.5, lz], 0.01, '#8a7a5a');
  g.box(lx, y + 1.46, lz, 0.2, 0.04, 0.2, LANTERN_FRAME);
  gl.box(lx, y + 1.22, lz, 0.16, 0.24, 0.16, GLOW.window, {});
  b.lights.add(lx, y + 1.3, lz, 0xffa050, 4, 6, 0.2);
  b.collide({ kind: 'c', x: cx, z: cz, r: 0.12, y0: y - 1, y1: y + 1.6 });
  const jx = x + Math.cos(face - 1.3) * 0.7, jz = z + Math.sin(face - 1.3) * 0.7;
  g.cyl(jx, y, jz, 0.11, 0.1, 0.24, 7, '#3a4a3a');
  gl.box(jx, y + 0.04, jz, 0.15, 0.16, 0.15, WOOD.glow, {});
  b.lights.add(jx, y + 0.5, jz, 0xc8e070, 1.6, 3, 0.2);
  const kx = x + Math.cos(face - 2.0) * 0.8, kz = z + Math.sin(face - 2.0) * 0.8;
  g.cyl(kx, y, kz, 0.24, 0.28, 0.28, 8, '#8a6a3a', { kind: K.Thatch });
  g.blob(kx, y + 0.3, kz, 0.2, 0.08, 0.2, '#7a5a8a', 4501, { kind: K.Cloth });
}

/** A crooked pole stuck in the bank by the swing for a mark ("over the pole and you've won"), and a jar left on a
 *  stone by the water (Rush's). */
function bankThings(b: Builder, x: number, z: number) {
  const g = b.g(x, z), y = b.y(x, z);
  g.cyl(x, y, z, 0.16, 0.13, 0.32, 7, '#6a5a48');
  g.cyl(x + 0.4, y, z + 0.2, 0.14, 0.12, 0.28, 7, '#7a6a4a');
  b.rock(x - 0.3, z + 0.5, 0.35, false);
}

// ---------- the people ----------

/** Who lives the village's day: names, looks, lines in the Old Wood's voice. (News as the knight's deeds get
 *  about, and the words once the Warden falls, are the story's.) */
function people(v: { swing: V3; swingDir: number; tale: typeof TALE; carve: Pt; elder: { x: number; z: number; deck: number }; byLake: (a: number, out: number) => Pt; inn: InnRoom; lanes: Pt[][] }): NpcDef[] {
  const { inn, byLake } = v;
  const room = (ra: number, r: number): Pt => [inn.x + Math.cos(inn.face + ra) * r, inn.z + Math.sin(inn.face + ra) * r];
  const toward = (from: Pt, to: Pt) => Math.atan2(to[1] - from[1], to[0] - from[0]);
  // Granny Yarrow's listeners, in a half-ring before her, facing her.
  const T = v.tale, listen = (k: number): Pt => [T.x + Math.cos(T.face + (k - 1) * 0.72) * 1.75, T.z + Math.sin(T.face + (k - 1) * 0.72) * 1.75];
  const ring = (as: number[], out = 2.4): Pt[] => as.map((a) => byLake(a, out));
  // The lamplighter's round of the lakeside lanterns, north round by the east to the south-west, and back.
  const lamps = ring([-1.72, -1.4, -1.05, -0.7, -0.35, 0, 0.35, 0.7, 1.05, 1.35, 1.7]);
  lamps.push(...lamps.slice(1, -1).reverse());
  const [westLane, , eastRoad] = v.lanes;
  // Fern home from the herbwife's glade's edge with her basket, to the bay shore to wash what she picked.
  const fern: Pt[] = [[30.8, 80.6], [33, 80.5], ...westLane.slice(0, 2).reverse(), byLake(2.92, 0.5)];
  fern.push(...fern.slice(1, -1).reverse());
  // Hob in from the High Canopy's edge with a sack of beechmast, to the north-east shore.
  const hob: Pt[] = [[90.2, 66.4], ...eastRoad.slice(0, 3).reverse(), byLake(-0.62, 2.4)];
  hob.push(...hob.slice(1, -1).reverse());
  // Sloe up the road from the Old Grove with mushrooms for the inn's pot, to its yard.
  const sloe: Pt[] = [[73.8, 97.9], [69.5, 95.6], [65, 95.3], [62.2, 100.6]];
  sloe.push(...sloe.slice(1, -1).reverse());
  // Rush to the water's edge with her buckets, up to the swing, and back.
  const rush: Pt[] = [byLake(-1.5, 0.45), [55.6, 57.4], [57.6, 56.4]];
  // Midge after moths round the storytelling, never still.
  const midge: Pt[] = [[30.6, 69.4], [31.4, 74.6], [35.8, 75.6], [37.2, 69.4], [33.2, 68.2], [29.8, 72.2]];
  const [cx, cz] = v.carve;
  const lookout: Pt = [v.elder.x + Math.cos(Math.PI / 4) * 3.4, v.elder.z + Math.sin(Math.PI / 4) * 3.4];
  return [
    // The rope swing on the north shore.
    { id: 'clover', look: 'woodswing', name: 'Clover', x: v.swing[0], z: v.swing[2], pose: 'sit', heading: v.swingDir, lines: [
      'Higher! Watch, sir knight, watch me! I nearly touch the leaves!',
      'Grandad Elm tied this rope when my mother was little. It has held everybody. Even Bram.',
    ] },
    { id: 'nutkin', look: 'woodnut', name: 'Nutkin', x: v.swing[0] - 1.2, z: v.swing[2] + 1.5, pose: 'play', heading: v.swingDir - Math.PI * 0.35, lines: [
      'It is my go next. It was my go last time too, but Clover says that one did not count.',
      'If you jump off at the top you land in the nettles. I know. Do not ask how I know.',
    ] },
    // Granny Yarrow and her listeners on the west shore.
    { id: 'yarrow', look: 'woodteller', name: 'Granny Yarrow', x: T.x, z: T.z, pose: 'sit', heading: T.face, lines: [
      'Sit, sit, there is room on the grass. I am telling them how the Warden came to keep the wood.',
      'The Old Wood is older than the kingdom, child. It remembers everything. Even the bits we would rather it forgot.',
      'The Warden was a guardian once. Something twisted it. Thorns grow where a keeper stops caring.',
    ] },
    { id: 'acorn', look: 'woodacorn', name: 'Acorn', x: listen(0)[0], z: listen(0)[1], pose: 'sit', heading: toward(listen(0), [T.x, T.z]), lines: [
      'Shh! She is at the good bit. The bit with the lantern of green fire.',
      'I am not scared. My feet are just cold.',
    ] },
    { id: 'teasel', look: 'woodteasel', name: 'Teasel', x: listen(1)[0], z: listen(1)[1], pose: 'sit', heading: toward(listen(1), [T.x, T.z]), lines: [
      'Granny tells it different every night. Last night the Warden had antlers.',
      'Are you in a story? You look like you are in a story.',
    ] },
    { id: 'woad', look: 'woodwoad', name: 'Woad', x: listen(2)[0], z: listen(2)[1], pose: 'sit', heading: toward(listen(2), [T.x, T.z]), lines: [
      'I came to fetch the little ones home. That was an hour ago.',
      'She told me this one when I was small. The ending was happier then.',
    ] },
    { id: 'midge', look: 'woodmidge', name: 'Midge', x: midge[0][0], z: midge[0][1], roam: midge, pause: 0.7, speed: 2.6, pose: 'play', lines: [
      'I am catching moths for my jar. The big pale ones. They are too quick at night.',
      'Granny says moths are the wood\'s dreams. Then the wood dreams of flapping a lot.',
    ] },
    // Kestrel up in the elder's treehouse, keeping watch.
    { id: 'kestrel', look: 'woodlookout', name: 'Kestrel of the Watch', x: lookout[0], z: lookout[1], perch: v.elder.deck, heading: Math.PI / 4, lines: [
      'Up here, sir knight! I can see clear over the canopy to the Warden\'s heights. Not that I like what I see.',
      'Rowan watches the bridge, I watch the wood. Between us, not a goblin gets past. Mostly.',
    ] },
    // Old Elm at his carving by the road east.
    { id: 'elm', look: 'woodcarver', name: 'Old Elm the Carver', x: cx, z: cz, pose: 'work', heading: 0, lines: [
      'Fallen wood only. A carver who cuts a living tree in Whisperwood does not carve for long.',
      'The stag is for the Reeve. It is taking a while. Stags are mostly legs, and legs break.',
    ] },
    // The foragers coming home.
    { id: 'fern', look: 'woodfern', name: 'Fern', x: fern[0][0], z: fern[0][1], roam: fern, pause: 4, speed: 1.4, pose: 'work', lines: [
      'Woundwort and wood sorrel, from by Old Nettle\'s glade. She lets me pick if I bring her the gossip.',
      'I keep to the deer paths. Goblins are noisy walkers. You hear them before they see you.',
    ] },
    { id: 'hob', look: 'woodhob', name: 'Hob', x: hob[0][0], z: hob[0][1], roam: hob, pause: 4, speed: 1.3, pose: 'work', lines: [
      'Beechmast. The giants up in the High Canopy drop it by the sackful. Nobody else goes up there.',
      'Roast it on the fire and it tastes of autumn. Raw, it tastes of regret.',
    ] },
    { id: 'sloe', look: 'woodsloe', name: 'Sloe', x: sloe[0][0], z: sloe[0][1], roam: sloe, pause: 4, speed: 1.4, pose: 'work', lines: [
      'Chanterelles for Moss\'s pot. She pays in stew, which is better than coin out here.',
      'The Old Grove\'s bushes rustle when there is no wind. I pick from the other side of the road.',
    ] },
    // The lamplighter round the lakeside lanterns, and Rush at the water.
    { id: 'linden', look: 'woodlamp', name: 'Linden the Lamplighter', x: lamps[0][0], z: lamps[0][1], roam: lamps, pause: 2.6, speed: 1.3, lines: [
      'I keep the lakeside lit. Not the lanes, not while the Warden is up there. A lit lane draws goblins like moths.',
      'Moth-oil burns cleanest. Do not ask Midge where it comes from.',
    ] },
    { id: 'rush', look: 'woodrush', name: 'Rush', x: rush[0][0], z: rush[0][1], roam: rush, pause: 4.5, speed: 1.2, pose: 'work', lines: [
      'Heartpool water for the weaver\'s dye-pots. She will have nothing from the river: it runs past the Warden\'s heights.',
      'Two buckets there, two buckets back. I should have married the miller in Blackpine.',
    ] },
    // The Owl and Acorn's evening: a lute by the fire, two regulars at the round table.
    { id: 'robin', look: 'woodlute', name: 'Robin the Lutenist', x: room(ROOM.lute, 1.7)[0], z: room(ROOM.lute, 1.7)[1], pose: 'sit', heading: toward(room(ROOM.lute, 1.7), room(0, 1.2)), lines: [
      'A song, sir knight? I know "The Oak That Would Not Bow", "The Warden\'s Lantern" and "Moss Has Watered the Ale". Two of them are true.',
      'The owl outside sings along. Badly, but on the beat.',
    ] },
    { id: 'thistle', look: 'woodthistle', name: 'Old Thistle', x: room(ROOM.sitters[0], 1.7)[0], z: room(ROOM.sitters[0], 1.7)[1], pose: 'sit', heading: toward(room(ROOM.sitters[0], 1.7), room(ROOM.table, 1.35)), lines: [
      'Forty years I have sat at this table. The table was a tree for four hundred before that. We get on.',
      'Moss keeps the good elderflower under the counter. For the end of the world, she says.',
    ] },
    { id: 'burl', look: 'woodburl', name: 'Burl', x: room(ROOM.sitters[1], 1.7)[0], z: room(ROOM.sitters[1], 1.7)[1], pose: 'sit', heading: toward(room(ROOM.sitters[1], 1.7), room(ROOM.table, 1.35)), lines: [
      'I was a woodcutter. Then the thorns came. Now I am a woodsitter.',
      'Thistle cheats at knucklebones. I have never caught him, which proves it.',
    ] },
  ];
}

/** Hollowbough's day, built onto the village: its props now; its people, the inn's room as a region and the inn's
 *  voices to hand to the realm. Runs after the village and the wood are placed (the dice are its own). */
export function buildHollowLife(b: Builder, grid: Grid, v: {
  /** realm2's byLake: a point `out` metres beyond the Heartpool's shore at angle a. */
  byLake: (a: number, out: number) => Pt;
  /** Where the weaver sits at her door, and which way she faces. */
  weaver: { x: number; z: number; face: number };
  /** The elder's tree, whose treehouse the lookout keeps: its middle, its deck's height over the ground. */
  elder: { x: number; z: number; deck: number };
  /** The lanes out of the village, each from its village end: west, to the kilns, east, the road in. */
  lanes: Pt[][];
}) {
  const keep = b.rng;
  b.rng = mulberry32(9393);
  HOLLOW.swing = null;
  HOLLOW.loom = null;
  HOLLOW.scarred = [];
  HOLLOW.lamps = [];
  const inn = HOLLOW.inn!;
  try {
    // The rope swing, swinging along the shore (east-west).
    const dir = 0, pivot = swingTree(b, SWING_TREE.x, SWING_TREE.z, dir);
    HOLLOW.swing = { x: pivot[0], y: pivot[1], z: pivot[2], len: pivot[1] - b.y(pivot[0], pivot[2]) - 0.75, dir };
    bankThings(b, pivot[0] + 2.8, pivot[2] + 1.9);
    // The storytelling, the carving, the loom at the weaver's door.
    tellingSpot(b, TALE.x, TALE.z, TALE.face);
    carving(b, CARVE.x, CARVE.z, 0);
    loom(b, v.weaver.x + Math.cos(v.weaver.face) * 0.95, v.weaver.z + Math.sin(v.weaver.face) * 0.95, v.weaver.face);
    // The thorn-scarred trees.
    for (const [x, z, s] of SCARRED) scarredTree(b, x, z, s);
    // Lantern posts up the lanes: every four and a half metres, either side by turns, out to the wood's edge.
    const clear = (x: number, z: number) => {
      const i = grid.i(Math.floor(x), Math.floor(z));
      if (grid.water[i] !== NONE || grid.deck[i] !== NONE) return false;
      if (Math.abs(grid.groundAt(x, z) - grid.groundAt(x + 0.6, z + 0.6)) > 0.2) return false;
      if (v.lanes.some((l) => distLine(l, x, z) < 1.15)) return false;
      return !grid.collidersNear(x, z).concat(grid.collidersNear(x + 1, z), grid.collidersNear(x - 1, z), grid.collidersNear(x, z + 1), grid.collidersNear(x, z - 1)).some((c) => c.on && (c.kind === 'c' ? Math.hypot(x - c.x, z - c.z) < c.r + 0.7 : x > c.x0 - 0.7 && x < c.x1 + 0.7 && z > c.z0 - 0.7 && z < c.z1 + 0.7));
    };
    const reach = [24, 14, 22, 18];
    v.lanes.forEach((lane, li) => {
      let side = li % 2 ? 1 : -1;
      for (let sAt = 2.5; sAt < reach[li]; sAt += 4.5) {
        let at = 0, rest = sAt, k = 0;
        for (; k < lane.length - 1; k++) {
          const len = Math.hypot(lane[k + 1][0] - lane[k][0], lane[k + 1][1] - lane[k][1]);
          if (rest <= len) { at = rest / len; break; }
          rest -= len;
        }
        if (k >= lane.length - 1) break;
        const [ax, az] = lane[k], [bx, bz] = lane[k + 1], len = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / len, nz = (bx - ax) / len;
        const px = ax + (bx - ax) * at + nx * side * 1.55, pz = az + (bz - az) * at + nz * side * 1.55;
        if (clear(px, pz)) lanePost(b, px, pz, -nx * side, -nz * side, li);
        side = -side;
      }
    });
  } finally {
    b.rng = keep;
  }
  const npcs = people({ swing: [HOLLOW.swing!.x, 0, HOLLOW.swing!.z], swingDir: HOLLOW.swing!.dir, tale: TALE, carve: [CARVE.x - 0.05, CARVE.z], elder: v.elder, byLake: v.byLake, inn, lanes: v.lanes });
  const regions: RegionDef[] = [
    { name: INN_NAME, music: 'tavern', amb: 'indoor', light: WOOD_ZONES.indoor, test: (x, z) => Math.hypot(x - inn.x, z - inn.z) < inn.floor },
  ];
  // Moss keeps her inn from behind its counter now.
  const keeper: Pt = [inn.x + Math.cos(inn.face + ROOM.counter) * 2.05, inn.z + Math.sin(inn.face + ROOM.counter) * 2.05];
  return { npcs, regions, keeper, inn: { x: inn.x + Math.cos(inn.face) * inn.wall, z: inn.z + Math.sin(inn.face) * inn.wall, region: INN_NAME, chatter: true } };
}
