import { K } from '../engine/materials';
import { P } from '../engine/particles';
import type { Rng } from '../engine/util';
import { MOBILE } from '../config';
import type { CritterDef, CritterKind } from '../game/critters';
import { PAL, GLOW, type Builder, type Structure } from './builder';
import { Grid, NONE } from './grid';
import { distLine, type Pt } from './paint';
import * as D from './details';

// ---------------------------------------------------------------------------
// What every realm's map provides, and the layout helpers realms share.
// ---------------------------------------------------------------------------

/** Realm ids follow the prototype's eight realms, in order. */
export type RealmId = 'castle' | 'forest' | 'aqua';

export type EnemyType = 'goblin' | 'shield' | 'archer' | 'bat' | 'boar' | 'brute' | 'bomber' | 'darter' | 'shaman' | 'king' | 'spitter' | 'snarer' | 'thornback' | 'warden' | 'salvager' | 'tidelord'
  | 'diver' | 'harpooner' | 'jelly' | 'crab' | 'eel' | 'puffer' | 'inkarm';

export interface EnemySpawn {
  type: EnemyType;
  x: number;
  z: number;
  group?: string;
  /** Archers that hold position. */
  guard?: boolean;
  /** Bigger, tougher, drops a power-up. */
  elite?: boolean;
  /** Keeps its kind's shared look where the realm gives that kind its own (the Bat Roost's bats among Whisperwood's rooks). */
  plain?: boolean;
  /** Lies hidden in a bush and bursts out when the knight passes close (the Old Grove's goblins). */
  ambush?: boolean;
  /** Retired from the realm (kept in the list so later save ids don't shift). */
  off?: boolean;
}

export interface NpcDef {
  id: string;
  look: string;
  name: string;
  x: number;
  z: number;
  face?: -1 | 1;
  lines: string[];
  /** Extra lines after the captive is rescued. */
  after?: string[];
  shop?: 'flask' | 'sword';
  /** Wares this one sells besides (see WARES in src/game/wares.ts). */
  wares?: string[];
  /** The sword shop's top level here (realm 1's smith stops at 3). */
  upTo?: number;
  /** Sits this high above the ground (the owl on the inn's roof). */
  perch?: number;
  hidden?: boolean;
  /** Sits locked in the realm's cage until it is broken open. */
  caged?: boolean;
  /** Going about the day: walks round these spots in turn, stopping a while (`pause` s) at each. */
  roam?: [number, number][];
  pause?: number;
  /** How fast it walks (m/s). */
  speed?: number;
  /** What it does when it's not walking or talking, and which way it faces then (radians). */
  pose?: 'sit' | 'fish' | 'work' | 'play';
  heading?: number;
}

export type ObjDef =
  | { kind: 'moonfire'; id: string; name: string; x: number; z: number; indoor?: boolean }
  | { kind: 'chest'; id: string; x: number; z: number; rot: number; coins: number; power?: 'fire' | 'wind' | 'magnet' | 'bubble' | 'giant' }
  | { kind: 'lore'; id: string; x: number; z: number; text: string }
  | { kind: 'lever'; id: string; x: number; z: number; look?: 'lever' | 'heart' }
  /** A living thorn gate: 'wall' opens when the realm's lever (heart) is pulled; 'arena' is the arena's door. */
  | { kind: 'thornGate'; id: string; x: number; z: number; w: number; alongX: boolean; role: 'wall' | 'arena' }
  | { kind: 'drawbridge'; x0: number; z0: number; x1: number; z1: number; deck: number }
  | { kind: 'cage'; id: string; x: number; z: number }
  | { kind: 'hallDoor'; x: number; z: number; y: number }
  | { kind: 'breakable'; x: number; z: number; what: 'pot' | 'crate' | 'barrel' }
  | { kind: 'windmill'; x: number; z: number }
  | { kind: 'sign'; x: number; z: number; text: string }
  | { kind: 'shard'; id: string; x: number; z: number }
  | { kind: 'cracked'; id: string; x: number; z: number; alongX: boolean }
  /** Thorn knots binding a great beast: strike them all and it's free (and yours to ride). */
  | { kind: 'bindings'; id: string; x: number; z: number; mount: 'stag' }
  /** The crew's nets holding a great sea beast (the Tide Serpent) in a pool at (x, z): cut the lines at their
   *  stakes and it's free (src/game/serpent.ts). */
  | { kind: 'nets'; id: string; x: number; z: number; stakes: Pt[] }
  /** The Old Wood's thorns across a way: only a charging warhorse breaks through (or, by: 'stag', only the Thornstag's thorn burst). */
  | { kind: 'thorns'; id: string; x: number; z: number; alongX: boolean; w: number; by?: 'stag' };

/** A realm's relic trial: an altar, a sealed ring, three waves, a relic and a purse. */
export interface TrialDef {
  x: number;
  z: number;
  /** Relic id it gives (see Game.relic). */
  relic: string;
  /** Quest moved to step 0 when the trial starts and 1 when it is won. */
  quest: string;
  prompt: string;
  /** Toasts when it wakes and when it is won. */
  wake: [string, string];
  win: [string, string];
  /** Coins it pays once, when won (its foes drop nothing). */
  purse: number;
  waves: { type: EnemyType; elite?: boolean }[][];
}

/** A way to a neighbouring realm. Walking into (x, z) within r sets off; `out` is where you come out when you arrive through it. */
export interface BorderDef {
  id: string;
  to: RealmId;
  /** The border's id on the other side. */
  arrive: string;
  x: number;
  z: number;
  r: number;
  out: { x: number; z: number; fx: number; fz: number };
  /** The travel card: "from → to". */
  card: [string, string];
  /** A way only the Thornstag's leap crosses (the Sea Stair's rockfall): coming back through it the stag
   *  waits where it carried him to, the warhorse where the way begins (it couldn't follow). */
  leap?: { stag: { x: number; z: number }; horse: { x: number; z: number } };
}

export interface RegionDef {
  name: string;
  music: string;
  test: (x: number, z: number, y: number) => boolean;
  /** Wind strength and ambience flavour. */
  amb?: 'fields' | 'village' | 'woods' | 'keep' | 'indoor' | 'road';
  quiet?: boolean;
}

export interface RealmData {
  id: RealmId;
  /** Size of the playable map in cells (the grid reaches further, into the outskirts). */
  w: number;
  d: number;
  /** Where the warhorse waits (null: no land beasts here; under the sea they stay above it). */
  horse: { x: number; z: number } | null;
  /** A sea: its surface (the light comes down from it), how deep the floor goes, and air pockets below it
   *  (vents' streams of bubbles, where a diver's air fills again). */
  sea?: {
    surface: number;
    deep: number;
    pockets?: { x: number; z: number; r: number }[];
    /** Currents: streams r round a line at height y that carry a diver along it at `speed`, floating. */
    currents?: { pts: Pt[]; y: number; r: number; speed: number }[];
    /** Columns of bubbles that lift a diver from the floor up to `top` (and give him air on the way). */
    lifts?: { x: number; z: number; r: number; top: number }[];
  };
  /** The realm's relic trial. */
  trial?: TrialDef;
  grid: Grid;
  builder: Builder;
  start: { x: number; z: number };
  enemies: EnemySpawn[];
  npcs: NpcDef[];
  objects: ObjDef[];
  regions: RegionDef[];
  waterPoints: [number, number][];
  grassDensity: (x: number, z: number) => number;
  grassScale: (x: number, z: number) => number;
  fireflyZones: { x: number; z: number; r: number }[];
  critters: CritterDef[];
  /** Things placed once the land beyond the map edge exists. */
  afterOutskirts: (grid: Grid, b: Builder) => void;
  /** Arrow slits that shoot at the knight: [x, y, z]. */
  slits?: [number, number, number][];
  /** Vines up a cliff face: hold jump against them to climb. The face runs along x (alongX) or z
   *  through (x, z) for w, from its foot up to `top`; (nx, nz) points out from the face. */
  vines?: { x: number; z: number; w: number; alongX: boolean; top: number; nx: number; nz: number }[];
  /** Where the realm's freed beast (the Thornstag) waits, when it isn't with you. */
  stagHome?: { x: number; z: number };
  /** Snare traps hidden in the grass. */
  snares?: Pt[];
  /** Strips of ground where thorns burst up in turn: centre, width (x), depth (z), phase. */
  thornBursts?: { x: number; z: number; w: number; d: number; ph: number }[];
  /** Giant clams on the sea floor: they snap shut on whoever stands in them; struck open, a pearl. */
  clams?: Pt[];
  /** Chandeliers over the boss's hall. */
  chandeliers?: { x: number; z: number; floor: number }[];
  /** How much tougher the realm's foes are than their kind (health; not the tyrant, tuned alone):
   *  the knight comes on with a better sword, and the foes should still take as many blows. */
  foeHp?: number;
  /** The boss's hall: walking in (above y) starts the fight; summoned guards appear at `summons`. */
  arena?: { x0: number; z0: number; x1: number; z1: number; y: number; summons: Pt[]; dust: [number, number, number, number, number]; mountOut?: Pt };
  /** A war drum that beats while its group lives. */
  drums?: { x: number; z: number; group: string };
  /** The inn: its tune leaks out into the street. */
  inn?: { x: number; z: number; region: string };
  /** Where the camera drifts behind the title screen, and where the model viewer stands. */
  titleView: { x: number; z: number };
  /** Where the character viewer (?viewer) lines the models up. */
  viewer?: Pt;
  /** Debug keys 1 to 7 jump here. */
  debugSpots: Pt[];
  /** Ways to the neighbouring realms. */
  borders?: BorderDef[];
  /** Landmarks seen from afar: their ground is never under the mist of unexplored land. */
  landmarks?: { x: number; z: number; r: number }[];
  /** Structures the story needs to reach (kept for reference). */
  structures?: Record<string, Structure>;
}

/** Ground tests used while laying a realm out. `roads` are kept clear of props. */
export class MapKit {
  constructor(public grid: Grid, public roads: Pt[][]) {}

  nearRoad(x: number, z: number, d: number) {
    return this.roads.some((l) => distLine(l, x, z) < d);
  }

  /** Level ground (within 0.1) for rad around the point, and dry. */
  flatAround(x: number, z: number, rad: number) {
    const g = this.grid, h = g.groundAt(x, z);
    for (const [dx, dz] of [[rad, 0], [-rad, 0], [0, rad], [0, -rad]]) if (Math.abs(g.groundAt(x + dx, z + dz) - h) > 0.1) return false;
    return g.waterAt(x, z) === NONE;
  }

  /** No collider within rad. */
  clearOf(x: number, z: number, rad: number) {
    return !this.grid.collidersNear(x, z).some((c) => c.on && (c.kind === 'c' ? Math.hypot(x - c.x, z - c.z) < c.r + rad : x > c.x0 - rad && x < c.x1 + rad && z > c.z0 - rad && z < c.z1 + rad));
  }

  /** Room for something of radius rad: off the roads, flat and clear. */
  room(x: number, z: number, rad: number) {
    return !this.nearRoad(x, z, rad + 1.2) && this.flatAround(x, z, rad) && this.clearOf(x, z, rad);
  }

  /** Point s units along a line, with the line's left-hand normal. */
  static along(line: Pt[], s: number): [number, number, number, number] {
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, az] = line[i], [bx, bz] = line[i + 1], len = Math.hypot(bx - ax, bz - az);
      if (s <= len) return [ax + ((bx - ax) * s) / len, az + ((bz - az) * s) / len, -(bz - az) / len, (bx - ax) / len];
      s -= len;
    }
    const [x, z] = line[line.length - 1];
    return [x, z, 0, 1];
  }

  /** Post lanterns beside a road at the given distances along it, alternating sides. */
  lanterns(b: Builder, line: Pt[], stops: number[], off: number) {
    stops.forEach((s, i) => {
      const [x, z, nx, nz] = MapKit.along(line, s);
      for (const side of i % 2 ? [1, -1] : [-1, 1]) {
        const lx = x + nx * off * side, lz = z + nz * off * side;
        if (this.grid.waterAt(lx, lz) !== NONE || !this.flatAround(lx, lz, 0.3) || !this.clearOf(lx, lz, 0.9)) continue;
        D.postLantern(b, lx, lz);
        break;
      }
    });
  }
}

/** Scatter trees over a box where ok() allows. */
export function forest(b: Builder, r: Rng, x0: number, z0: number, x1: number, z1: number, density: number, ok: (x: number, z: number) => boolean, kind: 'pine' | 'mixed') {
  for (let z = z0; z < z1; z += 1.7)
    for (let x = x0; x < x1; x += 1.7) {
      if (r() > density * 1.9) continue;
      const tx = x + r() * 1.5, tz = z + r() * 1.5;
      if (!ok(tx, tz)) continue;
      const k = r();
      if (kind === 'pine' || k < 0.55) b.pine(tx, tz, 0.9 + r() * 0.6);
      else if (k < 0.8) b.oak(tx, tz, 0.9 + r() * 0.4);
      else b.bush(tx, tz, 0.9);
    }
}

/** A torch in an iron bracket on a wall, drawn into the wall's structure so it fades with it. */
export function wallTorch(b: Builder, s: Structure, x: number, y: number, z: number, nx: number, nz: number) {
  s.core.beam([x - nx * 0.25, y - 0.4, z - nz * 0.25], [x, y - 0.15, z], 0.03, PAL.iron, { kind: K.Metal });
  s.core.box(x, y - 0.35, z, 0.07, 0.45, 0.07, PAL.woodDark, { kind: K.Wood });
  s.core.box(x, y - 0.02, z, 0.13, 0.1, 0.13, PAL.iron);
  s.glow.box(x, y + 0.08, z, 0.1, 0.16, 0.1, GLOW.flame, { kind: 1 });
  b.fx.addEmitter({ x, y: y + 0.12, z, rate: 14, spec: P.flame, spread: 0.08, vy: 0.4 });
  b.fx.addEmitter({ x, y: y + 0.2, z, rate: 0.8, spec: P.ember, spread: 0.1, vy: 0.5 });
  b.lights.add(x + nx * 0.3, y + 0.3, z + nz * 0.3, 0xff9a40, 10, 8, 0.3);
  b.fires.push({ x, y, z, big: false });
}

/** Sample points on water, for the ambience of running and lapping water. */
export function waterPoints(grid: Grid, w: number, d: number) {
  const out: [number, number][] = [];
  for (let z = 0; z < d; z += 2) for (let x = 0; x < w; x += 2) if (grid.water[grid.i(x, z)] !== NONE) out.push([x + 0.5, z + 0.5]);
  return out;
}

export interface DressOpts {
  w: number;
  d: number;
  /** Where scenery may go: 'soft' (flowers), 'solid' (has a collider), 'tree'. */
  fits: (x: number, z: number, kind: 'soft' | 'solid' | 'tree') => boolean;
  /** Still water, where lily pads float. */
  still: (x: number, z: number) => boolean;
  /** Extra wildlife spread over the realm: kind, how many, the ground types it lives on. */
  wild: [CritterKind, number, number[]][];
  /** No wildlife here (villages). */
  noWild?: (x: number, z: number) => boolean;
  /** The realm's critter list; wildlife and owls are added to it. */
  critters: CritterDef[];
  /** Runs right after the scatter pass (paths beyond the map edge, say). */
  afterScatter?: () => void;
  /** Where detail grows thick (1) and where the ground stays open (0); absent, it's spread evenly. */
  patch?: (x: number, z: number) => number;
}

/**
 * Detail everywhere, not just at the landmarks: the scatter pass (flowers, ferns,
 * stones, stumps, logs), lily pads on still water, wildlife placed where it fits,
 * and owls on some of the dead trees.
 */
export function dressRealm(bb: Builder, g: Grid, r: Rng, o: DressOpts) {
  D.dressWorld(bb, g, r, MOBILE ? 0.5 : 1, o.fits, o.patch);
  o.afterScatter?.();
  for (let z = g.oz; z < g.oz + g.d; z += 3)
    for (let x = g.ox; x < g.ox + g.w; x += 3) {
      const px = x + r() * 3, pz = z + r() * 3, roll = r();
      if (!o.still(px, pz) || roll > (MOBILE ? 0.12 : 0.22) || g.waterAt(px, pz) === NONE) continue;
      D.lilyPads(bb, px, pz, 3 + Math.floor(r() * 3), 0.9);
    }
  const critters = o.critters;
  const clear = (x: number, z: number, rad: number) => {
    const body = { x, y: g.groundAt(x, z), z, r: rad };
    g.resolve(body, 0.3, true);
    return Math.hypot(body.x - x, body.z - z) < 0.01;
  };
  for (const [kind, n0, ground] of o.wild) {
    // Phones get fewer: each animal is several draw calls.
    const n = MOBILE ? Math.ceil(n0 * 0.5) : n0;
    let placed = 0;
    for (let tries = 0; tries < 500 && placed < n; tries++) {
      const x = 4 + r() * (o.w - 8), z = 4 + r() * (o.d - 8);
      if (!ground.includes(g.typeAt(x, z)) || g.waterAt(x, z) !== NONE || o.noWild?.(x, z) || !o.fits(x, z, 'solid')) continue;
      if (critters.some((c) => c.kind === kind && Math.hypot(c.x - x, c.z - z) < 20) || !clear(x, z, kind === 'deer' ? 0.5 : 0.3)) continue;
      critters.push({ kind, x, z, area: [x - 4, z - 4, x + 4, z + 4] });
      placed++;
    }
  }
  // An owl on some of the dead trees, well apart.
  for (const [px, py, pz] of bb.perches) {
    const owls = critters.filter((c) => c.kind === 'owl');
    if (owls.length >= (MOBILE ? 4 : 6)) break;
    if (px < 2 || pz < 2 || px > o.w - 2 || pz > o.d - 2 || owls.some((ow) => Math.hypot(ow.x - px, ow.z - pz) < 22)) continue;
    critters.push({ kind: 'owl', x: px, z: pz, perch: py, area: [0, 0, 0, 0] });
  }
}
