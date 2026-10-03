import { Geo } from '../engine/geo';
import type { PSpec } from '../engine/particles';
import { clamp, fbm, mulberry32 } from '../engine/util';
import { NONE, T } from '../world/grid';
import { distLine, insidePoly, type Pt } from '../world/paint';
import type { Game } from './game';
import { body, both, clumps, Fishes, Flock, joined, Frogs, Grazers, Land, Motes, Risers, Shy, Swimmers, Wader, Wildlife, type Perch, type V3 } from './wildlife';

// ---------------------------------------------------------------------------
// Whisperwood's own life (the grammar is wildlife.ts): rooks wheeling over Rookfall and the Rookery, settling to
// walk the ground and going up all at once; long-eared bats flitting out from the Roost over the East Woods; a
// night heron hunched at the Heartpool's edge; wood ducks on the Heartpool and the Blackwater; golden carp
// basking with their backs out; brown trout holding in the Whisper and the brook, rising in rings; tree frogs on
// the lily pads; a herd of red deer with its stag on the Deer Meadow; rabbits at their warrens by the lanes; a
// badger at the Old Grove's edge; gold fireflies in every glade beside the wood's cyan lights, luna moths at the
// lanterns and over the meadows, midges over the water; and, seen rarely, the white hart of the old wood.
// ---------------------------------------------------------------------------

const C = {
  rook: '#262434', rookSheen: '#3e3460', rookFace: '#b8b4ae', rookBill: '#2a2a30',
  bat: '#7a5a40', batBelly: '#a88a68', batWing: '#5a4034', ear: '#8a6a50',
  nhCap: '#1e2430', nhBack: '#2a3442', nhWing: '#8a929c', nhBelly: '#dcdcd8', nhLeg: '#c8b040',
  wdBody: '#b89a6a', wdBreast: '#7a3428', wdHead: '#1e5a4a', wdCrest: '#4a2a6a', wdStripe: '#f0f0f0', wdBill: '#c83a2a', wdWing: '#4a4a5a',
  carp: '#c8902a', carpScale: '#a87020', carpBelly: '#e8c878', carpFin: '#a85a28',
  trout: '#7a6a44', troutBack: '#4a4430', troutBelly: '#d8d0b0', troutSpot: '#2a2418', troutRed: '#c84a2a',
  tfrog: '#4ab83a', tfrogBelly: '#d8e8a0', pad: '#3a7a34', padRim: '#4a8a3a', bloom: '#f0b8d0',
  hind: '#8a4e2c', hindDark: '#6a3a20', rump: '#e0d0b0', stagMane: '#5a3420', antler: '#c8b898',
  rabbit: '#7a6a58', rabbitBelly: '#c8b8a0', tail: '#f0f0ea',
  badger: '#8a8a88', badgerDark: '#2a2a2c', stripe: '#f0f0ec',
  hart: '#ecefe6', hartShade: '#cdd4c4', moss: '#4a7a3a',
};

/** The Whisper and the brook (as realm2.ts lays them), both running east: the trout face back up them. */
const RIVER: Pt[] = [[-6, 53.5], [6, 57], [16, 55.2], [24, 50.8], [32, 48.6], [40, 50.8], [48, 52.4], [56, 52.4], [64, 50], [72, 48.4], [80, 50.6], [90.5, 50]];
const BROOK: Pt[] = [[-6, 115.5], [10, 118], [22, 116], [34, 113.8], [46, 115.5], [58, 117.8], [70, 116], [82, 114.6], [94, 116.6], [106, 117.4], [112, 116.8], [119.5, 117]];
const DEER_MEADOW: Pt[] = [[75, 69], [86, 67.5], [92, 74], [90, 86.5], [81, 90.5], [74, 85]];
const MOSSFEN: Pt[] = [[6, 96], [26, 97], [34, 106], [30, 113], [8, 113], [5, 104]];
/** The glades: the Ring of Oaks, Old Nettle's, the stag's thicket, the dell, the Gatherers' clearing, the green,
 *  the Deer Meadow, the Mirror Pool, the kilns, the Old Grove's openings, the shrine, the Warden's seat. */
const GLADES: [number, number, number][] = [
  [22, 66, 8], [20, 87, 7], [11, 73, 6], [11, 89.6, 6], [46, 43, 7], [58.6, 79, 6], [83, 78, 10], [109, 73.5, 6], [45, 104, 7], [75, 106, 8], [92, 104, 6], [65, 30, 5], [17, 4, 5], [61, 112.6, 5], [30, 82, 5],
];

/** Fireflies of the wood, gold beside its cyan lights. */
const GOLDFLY: PSpec = { color: [3.4, 2.5, 0.5], color2: [2.2, 1.4, 0.2], size: 1, life: 8, wobble: 0.6, fadeIn: 0.25, blink: true };
/** Luna moths: pale green, at the lanterns and over the meadows. */
const LUNA: PSpec = { color: [1.7, 2.6, 1.6], color2: [1.0, 1.6, 0.9], size: 1, life: 4.5, wobble: 1.2, gravity: -0.02, fadeIn: 0.2, blink: true };
/** Seeds and spores of the old wood drifting down through the night air. */
const SPORE: PSpec = { color: [0.7, 0.85, 0.65], color2: [0.4, 0.5, 0.38], size: 1, life: 9, wobble: 0.4, gravity: 0.03, drag: 0.2, fadeIn: 0.5, alpha: 0.65 };
const MIDGE: PSpec = { color: [0.9, 1.1, 0.9], color2: [0.5, 0.6, 0.5], size: 1, life: 2.2, wobble: 1.8, fadeIn: 0.2, alpha: 0.55 };

// ---------- the bodies ----------

const eyes = (g: Geo, x: number, y: number, z: number, s = 0.012, col: V3 = [0.5, 0.5, 0.56], kind = 0) => {
  for (const k of [-1, 1]) g.box(k * x, y, z, s, s, s, col, { kind });
};

/** A rook, its feet at 0: black with a purple sheen, the bare grey-white face at the root of its bill, a peaked
 *  crown, shaggy thighs, a wedge of a tail, long fingered wings. */
function rookBody() {
  const g = new Geo(), y = 0.17;
  g.sweep([[0, y - 0.02, -0.18], [0, y, -0.05], [0, y + 0.02, 0.08], [0, y + 0.05, 0.15]], [0.035, 0.072, 0.07, 0.048], (i) => (i === 1 ? C.rookSheen : C.rook), { seg: 6, lumpy: 0.06, squash: 0.85 });
  g.blob(0, y + 0.09, 0.2, 0.048, 0.055, 0.058, C.rook, 41, { detail: 1, jitter: 0.05 });
  g.box(0, y + 0.13, 0.19, 0.03, 0.03, 0.04, C.rook);
  g.box(0, y + 0.07, 0.25, 0.05, 0.045, 0.04, C.rookFace);
  g.box(0, y + 0.06, 0.3, 0.024, 0.03, 0.08, C.rookBill);
  eyes(g, 0.038, y + 0.1, 0.22);
  // The wedge of a tail.
  both(g, [-0.03, y - 0.01, -0.16], [0.03, y - 0.01, -0.16], [0, y - 0.03, -0.38], C.rook);
  both(g, [-0.03, y - 0.01, -0.16], [-0.06, y - 0.03, -0.32], [0, y - 0.03, -0.38], C.rook);
  both(g, [0.03, y - 0.01, -0.16], [0, y - 0.03, -0.38], [0.06, y - 0.03, -0.32], C.rook);
  for (const s of [-1, 1]) {
    g.blob(s * 0.035, y - 0.06, -0.01, 0.025, 0.035, 0.03, C.rook, 42 + s, { detail: 0, jitter: 0.15 });
    g.beam([s * 0.03, y - 0.08, 0], [s * 0.03, 0.0, 0.015], 0.011, '#1a1a1e');
    g.box(s * 0.03, 0, 0.035, 0.02, 0.01, 0.06, '#1a1a1e');
    both(g, [s * 0.05, y + 0.04, 0.09], [s * 0.24, y + 0.05, 0.04], [s * 0.24, y + 0.04, -0.13], C.rookSheen);
    both(g, [s * 0.05, y + 0.04, 0.09], [s * 0.24, y + 0.04, -0.13], [s * 0.05, y + 0.04, -0.09], C.rook);
    for (let k = 0; k < 3; k++) both(g, [s * 0.24, y + 0.05, 0.03 - k * 0.05], [s * (0.48 - k * 0.03), y + 0.05, -0.02 - k * 0.05], [s * 0.24, y + 0.04, -0.03 - k * 0.05], C.rook);
  }
  return body(g, (x) => clamp((Math.abs(x) - 0.055) / 0.42, 0, 1));
}

/** A brown long-eared bat about its middle: ears near as long as its body, a pale belly, wings of thin brown
 *  skin with the finger bones showing. */
function batBody() {
  const g = new Geo();
  g.blob(0, 0, 0, 0.04, 0.035, 0.065, C.bat, 43, { detail: 1, jitter: 0.05 });
  g.box(0, -0.03, 0, 0.05, 0.01, 0.08, C.batBelly);
  g.blob(0, 0.012, 0.065, 0.028, 0.026, 0.028, C.bat, 44, { detail: 0, jitter: 0.04 });
  for (const s of [-1, 1]) {
    both(g, [s * 0.01, 0.03, 0.06], [s * 0.045, 0.1, 0.02], [s * 0.03, 0.03, 0.08], C.ear);
    both(g, [s * 0.03, 0, 0.035], [s * 0.13, 0.015, 0.055], [s * 0.11, 0, -0.06], C.batWing);
    both(g, [s * 0.13, 0.015, 0.055], [s * 0.24, 0, -0.01], [s * 0.11, 0, -0.06], C.batWing);
    both(g, [s * 0.03, 0, 0.035], [s * 0.11, 0, -0.06], [s * 0.03, 0, -0.06], C.batWing);
    for (const [ex, ez] of [[0.24, -0.01], [0.19, -0.05], [0.12, -0.06]] as const) g.beam([s * 0.12, 0.012, 0.05], [s * ex, 0.004, ez], 0.005, C.bat);
  }
  return body(g, (x) => clamp((Math.abs(x) - 0.03) / 0.21, 0, 1));
}

/** A black-crowned night heron, its feet at 0: stocky and short-necked, black cap and back, grey wings, white
 *  face and breast, a red eye, white plumes off the nape, short yellow legs. */
function nightHeronBody() {
  const g = new Geo();
  for (const s of [-1, 1]) {
    g.beam([s * 0.05, 0.38, 0], [s * 0.055, 0.0, 0.03], 0.02, C.nhLeg);
    g.box(s * 0.055, 0, 0.08, 0.04, 0.012, 0.12, C.nhLeg);
  }
  g.push().translate(0, 0.52, -0.02).rotateX(0.25);
  g.blob(0, 0, 0, 0.14, 0.15, 0.26, C.nhBelly, 45, { detail: 1, jitter: 0.04 });
  g.pop();
  g.blob(0, 0.6, -0.08, 0.13, 0.08, 0.22, C.nhBack, 46, { detail: 0, jitter: 0.04 });
  g.blob(0, 0.68, 0.2, 0.08, 0.08, 0.09, C.nhBelly, 47, { detail: 0 });
  g.box(0, 0.75, 0.19, 0.1, 0.04, 0.12, C.nhCap);
  g.box(0, 0.67, 0.3, 0.03, 0.032, 0.14, C.nhCap);
  g.beam([0, 0.74, 0.12], [0, 0.6, -0.12], 0.008, '#f0f0f0');
  eyes(g, 0.05, 0.7, 0.24, 0.016, [1.6, 0.2, 0.15], 1);
  for (const s of [-1, 1]) {
    both(g, [s * 0.12, 0.64, 0.18], [s * 0.48, 0.66, 0.1], [s * 0.46, 0.64, -0.24], C.nhWing);
    both(g, [s * 0.12, 0.64, 0.18], [s * 0.46, 0.64, -0.24], [s * 0.1, 0.62, -0.26], C.nhBack);
    both(g, [s * 0.48, 0.66, 0.1], [s * 0.82, 0.65, -0.04], [s * 0.46, 0.64, -0.24], C.nhWing);
  }
  return body(g, (x, y) => (y > 0.58 ? clamp((Math.abs(x) - 0.12) / 0.7, 0, 1) : 0));
}

/** A wood duck drake at the waterline (the ducks tinted grey-brown): the crested green-and-purple head with its
 *  white bridles, red eye and bill, chestnut breast, buff flanks, dark wings. */
function woodDuckBody() {
  const g = new Geo();
  g.blob(0, 0.07, -0.03, 0.12, 0.085, 0.23, C.wdBody, 48, { detail: 1, jitter: 0.03, flatBottom: true });
  g.blob(0, 0.1, 0.13, 0.09, 0.08, 0.08, C.wdBreast, 49, { detail: 0, jitter: 0.03 });
  g.box(0, 0.12, 0.1, 0.16, 0.08, 0.02, C.wdStripe);
  g.beam([0, 0.12, 0.13], [0, 0.2, 0.18], 0.038, C.wdHead);
  g.blob(0, 0.22, 0.19, 0.05, 0.055, 0.06, C.wdHead, 50, { detail: 0, jitter: 0.03 });
  g.blob(0, 0.23, 0.12, 0.035, 0.04, 0.07, C.wdCrest, 51, { detail: 0 });
  g.box(0, 0.25, 0.17, 0.11, 0.012, 0.09, C.wdStripe);
  g.box(0, 0.205, 0.265, 0.03, 0.022, 0.06, C.wdBill);
  eyes(g, 0.048, 0.225, 0.21, 0.014, [1.4, 0.25, 0.15], 1);
  both(g, [-0.03, 0.11, -0.24], [0.03, 0.11, -0.24], [0, 0.14, -0.36], C.wdWing);
  for (const s of [-1, 1]) {
    both(g, [s * 0.08, 0.14, 0.09], [s * 0.3, 0.15, -0.01], [s * 0.25, 0.14, -0.15], C.wdWing);
    both(g, [s * 0.08, 0.14, 0.09], [s * 0.25, 0.14, -0.15], [s * 0.07, 0.13, -0.17], C.wdWing);
    both(g, [s * 0.3, 0.15, -0.01], [s * 0.43, 0.15, -0.11], [s * 0.25, 0.14, -0.15], '#3a5a8a');
  }
  return body(g, (x) => clamp((Math.abs(x) - 0.08) / 0.36, 0, 1));
}

/** A golden carp: deep-bodied, bronze-gold, big scales in rows, barbels at its lips, a long fin down its back. */
function carpBody() {
  const g = new Geo(), zs = [-0.32, -0.22, -0.06, 0.1, 0.25, 0.38, 0.44], rs = [0.025, 0.06, 0.095, 0.1, 0.085, 0.05, 0.02];
  g.sweep(zs.map((z): V3 => [0, 0, z]), rs, (i) => (i % 2 ? C.carpScale : C.carp), { seg: 6, lumpy: 0, squash: [1.4, 1.6, 1.75, 1.75, 1.6, 1.3, 1] });
  g.box(0, -0.13, 0.05, 0.08, 0.03, 0.3, C.carpBelly);
  both(g, [0, 0.15, 0.22], [0, 0.26, 0.12], [0, 0.17, -0.2], C.carpFin);
  both(g, [0, 0.17, -0.2], [0, 0.26, 0.12], [0, 0.22, -0.18], C.carpFin);
  both(g, [0, 0.03, -0.3], [0, 0.18, -0.5], [0, 0.0, -0.42], C.carpFin);
  both(g, [0, -0.03, -0.3], [0, 0.0, -0.42], [0, -0.18, -0.5], C.carpFin);
  for (const s of [-1, 1]) {
    g.beam([s * 0.015, -0.02, 0.43], [s * 0.05, -0.06, 0.48], 0.006, C.carpFin);
    g.box(s * 0.045, 0.04, 0.36, 0.02, 0.025, 0.025, [0.1, 0.08, 0.05]);
    both(g, [s * 0.08, -0.06, 0.2], [s * 0.17, -0.12, 0.1], [s * 0.08, -0.08, 0.1], C.carpFin);
  }
  return body(g, (_x, _y, z) => Math.pow(clamp((0.2 - z) / 0.72, 0, 1), 1.3));
}

/** A brown trout: slim, olive-brown above, buttery below, dark spots and a few red ones. */
function troutBody() {
  const g = new Geo(), zs = [-0.3, -0.18, -0.03, 0.12, 0.28, 0.4, 0.46], rs = [0.02, 0.045, 0.065, 0.07, 0.06, 0.04, 0.015];
  g.sweep(zs.map((z): V3 => [0, 0, z]), rs, C.trout, { seg: 5, lumpy: 0, squash: [1.3, 1.35, 1.4, 1.45, 1.35, 1.2, 1] });
  g.sweep(zs.slice(1, 6).map((z, i): V3 => [0, rs[i + 1] * 0.95, z]), rs.slice(1, 6).map((r) => r * 0.55), C.troutBack, { seg: 5, lumpy: 0, squash: 0.6 });
  g.box(0, -0.075, 0.08, 0.06, 0.02, 0.36, C.troutBelly);
  for (const [x, y, z, col] of [[0.05, 0.04, 0.1, C.troutSpot], [-0.05, 0.03, -0.02, C.troutSpot], [0.05, 0.0, -0.1, C.troutRed], [-0.05, 0.05, 0.2, C.troutSpot], [0.04, 0.05, 0.28, C.troutSpot], [-0.05, -0.01, 0.06, C.troutRed]] as const) g.box(x, y, z, 0.012, 0.02, 0.02, col);
  both(g, [0, 0.02, -0.29], [0, 0.13, -0.46], [0, 0.0, -0.4], C.troutBack);
  both(g, [0, -0.02, -0.29], [0, 0.0, -0.4], [0, -0.13, -0.46], C.troutBack);
  both(g, [0, 0.09, 0.14], [0, 0.17, 0.02], [0, 0.09, -0.04], C.troutBack);
  for (const s of [-1, 1]) g.box(s * 0.038, 0.02, 0.36, 0.018, 0.022, 0.022, [0.08, 0.06, 0.04]);
  return body(g, (_x, _y, z) => Math.pow(clamp((0.2 - z) / 0.72, 0, 1), 1.3));
}

/** A tree frog on its pad: bright leaf-green, a pale throat, big gold eyes, round toe pads; long hind legs folded
 *  (weighted to kick out behind in a leap). */
function treeFrogBody() {
  const g = new Geo();
  g.blob(0, 0.035, -0.01, 0.04, 0.03, 0.055, C.tfrog, 52, { detail: 1, jitter: 0.04, flatBottom: true });
  g.blob(0, 0.035, 0.045, 0.036, 0.024, 0.032, C.tfrog, 53, { detail: 0, jitter: 0.03 });
  g.box(0, 0.015, 0.06, 0.04, 0.012, 0.03, C.tfrogBelly);
  for (const s of [-1, 1]) {
    g.box(s * 0.026, 0.065, 0.058, 0.022, 0.022, 0.022, [1.8, 1.2, 0.2], { kind: 1 });
    g.box(s * 0.028, 0.068, 0.068, 0.008, 0.012, 0.004, [0.05, 0.05, 0.05]);
    g.beam([s * 0.028, 0.02, 0.04], [s * 0.05, 0.0, 0.075], 0.006, C.tfrog);
    g.box(s * 0.05, 0.003, 0.078, 0.012, 0.006, 0.012, C.tfrogBelly);
    g.beam([s * 0.03, 0.02, -0.035], [s * 0.075, 0.025, 0.0], 0.011, C.tfrog, { wind: 1 });
    g.beam([s * 0.075, 0.025, 0.0], [s * 0.06, 0.008, -0.075], 0.008, C.tfrog, { wind: 1 });
    g.box(s * 0.066, 0.004, -0.088, 0.014, 0.006, 0.014, C.tfrogBelly, { wind: 1 });
  }
  return body(g, (_x, _y, z, m) => m * clamp((0.03 - z) / 0.12, 0, 1));
}

/** One of the Heartpool's lily pads: round and bright, ribbed, a pink water lily on some (the pads tinted). */
function padBody() {
  const g = new Geo(), n = 12, R = 0.32;
  for (let k = 0; k < n; k++) {
    if (k === 3) continue;
    const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
    g.tri([0, 0, 0], [Math.cos(a1) * R, 0, Math.sin(a1) * R], [Math.cos(a0) * R, 0, Math.sin(a0) * R], k % 3 ? C.pad : C.padRim);
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    g.push().translate(-0.12, 0.02, -0.08).rotateY(a);
    g.tri([0, 0, 0], [0.03, 0.06, 0.055], [-0.03, 0.06, 0.055], C.bloom);
    g.pop();
  }
  g.box(-0.12, 0.02, -0.08, 0.035, 0.035, 0.035, [1.8, 1.4, 0.3], { kind: 1 });
  return body(g, () => 0);
}

/** A red deer, its feet at 0: a hind, red-brown with a pale rump; or the stag, bigger, a dark shaggy mane and a
 *  great spread of antlers. */
function deerBody(stag: boolean) {
  const g = new Geo(), coat = stag ? C.hindDark : C.hind;
  g.blob(0, 1.0, 0, 0.21, 0.24, 0.56, coat, 54, { detail: 1, jitter: 0.03 });
  g.blob(0, 1.02, -0.5, 0.13, 0.14, 0.08, C.rump, 55, { detail: 0 });
  if (stag) g.blob(0, 1.08, 0.42, 0.19, 0.24, 0.18, C.stagMane, 56, { detail: 0, jitter: 0.12, wind: 2 });
  g.sweep([[0, 1.12, 0.44], [0, 1.36, 0.56], [0, 1.52, 0.62]], [0.1, 0.085, 0.075], coat, { seg: 6, wind: 2 });
  g.blob(0, 1.56, 0.7, 0.075, 0.075, 0.12, coat, 57, { detail: 0, wind: 2 });
  g.box(0, 1.52, 0.82, 0.065, 0.065, 0.08, C.hindDark, { wind: 2 });
  for (const s of [-1, 1]) {
    g.box(s * 0.08, 1.66, 0.64, 0.1, 0.05, 0.04, coat, { wind: 2 });
    g.box(s * 0.05, 1.6, 0.76, 0.015, 0.015, 0.015, [0.2, 0.18, 0.15], { wind: 2 });
    if (stag) {
      const a: V3 = [s * 0.05, 1.66, 0.66], b: V3 = [s * 0.24, 2.0, 0.56], c: V3 = [s * 0.34, 2.32, 0.42];
      g.beam(a, b, 0.024, C.antler, { wind: 3 });
      g.beam(b, c, 0.02, C.antler, { wind: 3 });
      g.beam([s * 0.12, 1.8, 0.63], [s * 0.15, 1.92, 0.82], 0.014, C.antler, { wind: 3 });
      g.beam(b, [s * 0.32, 2.12, 0.74], 0.014, C.antler, { wind: 3 });
      g.beam(c, [s * 0.46, 2.4, 0.5], 0.012, C.antler, { wind: 3 });
      g.beam(c, [s * 0.32, 2.5, 0.3], 0.012, C.antler, { wind: 3 });
      g.beam(c, [s * 0.4, 2.48, 0.42], 0.012, C.antler, { wind: 3 });
    }
    for (const z of [0.4, -0.4]) {
      g.beam([s * 0.11, 0.84, z], [s * 0.11, 0.4, z + (z > 0 ? 0.02 : -0.04)], 0.045, coat, { wind: 1 });
      g.beam([s * 0.11, 0.4, z + (z > 0 ? 0.02 : -0.04)], [s * 0.11, 0.0, z + 0.02], 0.028, C.hindDark, { wind: 1 });
    }
  }
  return body(g, (_x, y, z, m) => (m > 2.5 ? 2.05 : m > 1.5 ? 1 + clamp((z - 0.38) / 0.45, 0, 1) * 1.45 : m > 0.5 ? Math.max(0, 0.84 - y) : 0));
}

/** A rabbit, its feet at 0: grey-brown, a pale belly, long ears, the white scut; its long hind feet weighted to
 *  kick out behind as it bounds. */
function rabbitBody() {
  const g = new Geo();
  g.blob(0, 0.14, -0.03, 0.09, 0.1, 0.15, C.rabbit, 58, { detail: 1, jitter: 0.04 });
  g.blob(0, 0.2, 0.12, 0.06, 0.06, 0.07, C.rabbit, 59, { detail: 0, jitter: 0.03 });
  g.box(0, 0.08, 0.02, 0.1, 0.04, 0.16, C.rabbitBelly);
  g.blob(0, 0.15, -0.18, 0.035, 0.035, 0.03, C.tail, 60, { detail: 0 });
  for (const s of [-1, 1]) {
    g.box(s * 0.025, 0.3, 0.1, 0.025, 0.14, 0.04, C.rabbit);
    g.box(s * 0.035, 0.22, 0.17, 0.014, 0.014, 0.014, [0.08, 0.06, 0.05]);
    g.box(s * 0.04, 0.03, 0.1, 0.025, 0.06, 0.03, C.rabbit);
    g.box(s * 0.06, 0.02, -0.06, 0.035, 0.04, 0.14, C.rabbit, { wind: 1 });
  }
  return body(g, (_x, _y, z, m) => m * clamp((0.0 - z) / 0.12, 0, 1));
}

/** A badger, its feet at 0: low and broad, grey, black legs, the striped black-and-white face. */
function badgerBody() {
  const g = new Geo();
  g.blob(0, 0.26, -0.04, 0.2, 0.15, 0.34, C.badger, 61, { detail: 1, jitter: 0.08 });
  g.blob(0, 0.22, 0.3, 0.1, 0.09, 0.13, C.stripe, 62, { detail: 0, wind: 2 });
  g.box(0, 0.25, 0.36, 0.1, 0.05, 0.14, C.badgerDark, { wind: 2 });
  g.box(0, 0.29, 0.34, 0.04, 0.05, 0.16, C.stripe, { wind: 2 });
  g.box(0, 0.19, 0.44, 0.04, 0.04, 0.04, C.badgerDark, { wind: 2 });
  for (const s of [-1, 1]) {
    g.box(s * 0.06, 0.28, 0.32, 0.03, 0.06, 0.12, C.badgerDark, { wind: 2 });
    for (const z of [0.18, -0.24]) g.beam([s * 0.12, 0.2, z], [s * 0.12, 0.0, z + 0.02], 0.05, C.badgerDark, { wind: 1 });
  }
  return body(g, (_x, y, z, m) => (m > 1.5 ? 1 + clamp((z - 0.24) / 0.22, 0, 1) * 0.12 : m > 0.5 ? Math.max(0, 0.2 - y) : 0));
}

/** The white hart of the old wood, its feet at 0: pale, its antlers branching like a tree's boughs, lit gold-
 *  green from within, moss hanging from them. */
function hartBody() {
  const g = new Geo(), glow: V3 = [1.6, 2.6, 0.7], leaf: V3 = [0.9, 2.2, 0.6];
  g.blob(0, 1.06, 0, 0.21, 0.25, 0.58, C.hart, 63, { detail: 1, jitter: 0.03 });
  g.blob(0, 1.1, 0.42, 0.17, 0.22, 0.17, C.hart, 64, { detail: 0, wind: 2 });
  g.sweep([[0, 1.2, 0.48], [0, 1.45, 0.6], [0, 1.6, 0.66]], [0.11, 0.09, 0.08], C.hart, { seg: 6, wind: 2 });
  g.blob(0, 1.66, 0.74, 0.08, 0.08, 0.13, C.hart, 65, { detail: 0, wind: 2 });
  g.box(0, 1.61, 0.86, 0.07, 0.07, 0.08, C.hartShade, { wind: 2 });
  for (const s of [-1, 1]) {
    g.box(s * 0.075, 1.75, 0.68, 0.1, 0.04, 0.05, C.hartShade, { wind: 2 });
    g.box(s * 0.05, 1.69, 0.8, 0.016, 0.016, 0.016, [0.2, 0.3, 0.15], { wind: 2 });
    const a: V3 = [s * 0.05, 1.74, 0.72], b: V3 = [s * 0.2, 2.05, 0.66], c: V3 = [s * 0.36, 2.3, 0.6], d: V3 = [s * 0.3, 2.5, 0.44];
    g.beam(a, b, 0.024, glow, { kind: 1, wind: 3 });
    g.beam(b, c, 0.02, glow, { kind: 1, wind: 3 });
    g.beam(b, d, 0.018, glow, { kind: 1, wind: 3 });
    for (const [p, q] of [[c, [s * 0.52, 2.42, 0.66]], [c, [s * 0.44, 2.2, 0.8]], [d, [s * 0.36, 2.66, 0.36]], [d, [s * 0.2, 2.62, 0.5]]] as [V3, V3][]) {
      g.beam(p, q, 0.012, glow, { kind: 1, wind: 3 });
      g.box(q[0], q[1], q[2], 0.06, 0.03, 0.06, leaf, { kind: 1, wind: 3 });
    }
    g.beam([s * 0.3, 2.22, 0.62], [s * 0.3, 1.95, 0.62], 0.016, C.moss, { wind: 3 });
    for (const z of [0.42, -0.42]) {
      g.beam([s * 0.12, 0.88, z], [s * 0.12, 0.42, z + (z > 0 ? 0.02 : -0.04)], 0.045, C.hart, { wind: 1 });
      g.beam([s * 0.12, 0.42, z + (z > 0 ? 0.02 : -0.04)], [s * 0.12, 0.0, z + 0.02], 0.03, C.hartShade, { wind: 1 });
    }
  }
  return body(g, (_x, y, z, m) => (m > 2.5 ? 2.1 : m > 1.5 ? 1 + clamp((z - 0.4) / 0.45, 0, 1) * 1.5 : m > 0.5 ? Math.max(0, 0.88 - y) : 0));
}

// ---------- where they live ----------

/** Which way is up a stream from (x, z): back along the nearest stretch of it. */
function upstream(line: Pt[]) {
  return (x: number, z: number): [number, number] => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < line.length - 1; i++) {
      const d = distLine([line[i], line[i + 1]], x, z);
      if (d < bd) (bd = d), (best = i);
    }
    const [ax, az] = line[best], [bx, bz] = line[best + 1], l = Math.hypot(bx - ax, bz - az) || 1;
    return [(ax - bx) / l, (az - bz) / l];
  };
}

/** Realm 2's life (see the top of this file), made when the realm is (the realm's story holds it, see
 *  story/forest.ts) and moved each frame from the story's tick. */
export class WoodLife extends Wildlife {
  private hart: Shy | null = null;
  apply(g: Game) {
    if (this.built) return;
    this.built = true;
    const r = mulberry32(8788), land = (this.land = new Land(g)), grid = g.grid;
    const at = (x: number, z: number, h: number) => grid.groundAt(x, z) + h;
    // All the wood's birds and bats in one instanced mesh, all its beasts in another, the frogs (their pads) and the
    // rabbits, the fish: four draws at most, however many flocks and herds (each body draws its own kind's shape).
    const [rook, bat, duck, heron] = this.kind(g, 'fly', 0.25, 70, rookBody(), batBody(), woodDuckBody(), nightHeronBody());
    const [hind, stag, badger, hart] = this.kind(g, 'walk', 0.22, 10, deerBody(false), deerBody(true), badgerBody(), hartBody());
    const [frogs, rabbit] = this.kind(g, 'hop', 0.24, 84, joined(treeFrogBody(), padBody()), rabbitBody());
    const [carp, trout] = this.kind(g, 'wag', 0.32, 54, carpBody(), troutBody());
    // Ground the rooks walk round the Rookery and along Rookfall's western rim.
    const ground = (cx: number, cz: number, rad: number, n: number) => {
      const out: Perch[] = [];
      for (let k = 0; k < n * 8 && out.length < n; k++) {
        const a = r() * Math.PI * 2, d = rad * Math.sqrt(r()), x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (land.dry(x, z, 0.4) && land.open(x, z, 0.3) && !out.some((p) => Math.hypot(p.x - x, p.z - z) < 0.9)) out.push({ x, y: grid.groundAt(x, z), z });
      }
      return out;
    };
    this.all.push(
      new Flock({ n: 22, size: 1.35, perched: 0.45, scare: 5.5, speed: 4.5, beat: 14, perches: [...ground(93.5, 13, 6, 10), ...ground(87, 34, 4, 6), ...ground(104, 26, 4, 5)], circles: [{ x: 93.5, z: 12, r: 6, y: at(93.5, 12, 9) }, { x: 95, z: 33, r: 7, y: at(88, 33, 7) }, { x: 95, z: 45, r: 5.5, y: at(88, 45, 6) }] }, rook, r),
    );
    // Long-eared bats out of the Roost, over the East Woods and Rookfall's bridge.
    this.all.push(new Flock({ n: 14, size: 1.9, flit: true, speed: 4.2, beat: 32, circles: [{ x: 110, z: 10, r: 5, y: at(110, 10, 4) }, { x: 104, z: 20, r: 7, y: at(104, 20, 5) }, { x: 100, z: 31, r: 6, y: at(100, 31, 4.5) }] }, bat, r));
    // Wood ducks on the Heartpool and the Blackwater; golden carp basking; trout in the Whisper and the brook.
    const hen = (i: number) => (i % 2 ? ([0.7, 0.66, 0.6] as V3) : '#ffffff');
    for (const [x, z, rr, n] of [[64, 66, 6, 5], [45, 81, 5, 4], [47, 67, 6, 4], [67, 79, 5, 3], [55, 30, 9, 5], [70, 27, 6, 4]] as const)
      this.all.push(new Swimmers({ n, size: 1.15, x, z, r: rr, dabble: true, tint: hen }, duck, land, r));
    for (const [x, z, rr, n] of [[60, 69, 9, 5], [47, 79, 5, 3], [109, 73.5, 4, 4], [50, 28, 9, 4], [66, 33, 6, 3]] as const)
      this.all.push(new Fishes({ n, size: 1.1, x, z, r: rr, sink: 0.12, speed: 0.35, tint: (i) => (i % 3 === 1 ? ([1.1, 0.75, 0.5] as V3) : i % 3 === 2 ? ([0.8, 0.8, 0.75] as V3) : '#ffffff') }, carp, land, r));
    for (const [x, z, line] of [[22, 51.5, RIVER], [44, 51.4, RIVER], [60, 51.6, RIVER], [76, 49.6, RIVER], [100, 117, BROOK], [64, 117, BROOK], [28, 115, BROOK]] as const)
      this.all.push(new Fishes({ n: 4, size: 0.9, x, z, r: 3.5, sink: 0.08, speed: 0.5, upstream: upstream(line as Pt[]) }, trout, land, r));
    this.all.push(new Risers((x, z) => !(x > 86 && x < 102 && z < 60), trout, 0.75, land, 1.8));
    // The night heron, at the Heartpool's edges and the Blackwater's.
    const shallows: { x: number; z: number; face?: number }[] = [];
    for (let k = 0; k < 3000 && shallows.length < 5; k++) {
      const [cx, cz, rad] = shallows.length < 4 ? [56, 74, 18] : [56, 30, 14];
      const x = cx + (r() - 0.5) * 2 * rad, z = cz + (r() - 0.5) * 2 * rad, w = land.water(x, z);
      if (w === NONE || w - land.ground(x, z) > 0.45 || shallows.some((s) => Math.hypot(s.x - x, s.z - z) < 9)) continue;
      shallows.push({ x, z });
    }
    if (shallows.length > 1) this.all.push(new Wader(shallows, heron, 1.25, land, r));
    // Tree frogs on the lily pads of the Heartpool, the Mossfen and the Blackwater.
    const pads: { x: number; z: number }[] = [];
    for (let k = 0; k < 6000 && pads.length < 26; k++) {
      const x = 4 + r() * 76, z = 18 + r() * 98;
      if (!land.wet(x, z, 0.1) || fbm(x * 0.12, z * 0.12, 2, 919) < 0.48 || distLine(RIVER, x, z) < 4 || distLine(BROOK, x, z) < 4) continue;
      let bank = false;
      for (let a = 0; a < 8 && !bank; a++) if (land.water(x + Math.cos(a * 0.785) * 1.6, z + Math.sin(a * 0.785) * 1.6) === NONE) bank = true;
      if (!bank || pads.some((s) => Math.hypot(s.x - x, s.z - z) < 1.6)) continue;
      pads.push({ x, z });
    }
    for (const c of clumps(pads)) this.all.push(new Frogs({ spots: c, size: 1.9, padSize: 1.25, tint: (i) => (i % 4 === 1 ? ([0.75, 0.95, 0.4] as V3) : '#ffffff') }, frogs, land, r));
    // The red deer on their meadow, the stag among the hinds; rabbits at their warrens; the badger.
    const wild = (x: number, z: number) => grid.typeAt(x, z) !== T.Path && grid.typeAt(x, z) !== T.Wood;
    this.all.push(
      new Grazers({ kinds: [{ src: hind, n: 7, size: 1 }, { src: stag, n: 1, size: 1.15 }], x: 83, z: 78, r: 8.5, walk: 0.8, run: 6.5, scare: 9, way: 'beast', flee: 10, keep: (x, z) => insidePoly(DEER_MEADOW, x, z) || Math.hypot(x - 83, z - 78) < 7 }, land, r),
    );
    for (const [x, z] of [[104, 106], [82, 99], [29, 80], [68, 44.5], [40, 97], [109, 88]] as const)
      this.all.push(new Grazers({ kinds: [{ src: rabbit, n: 5, size: 1.25, tint: (i) => (i % 3 === 2 ? ([0.8, 0.75, 0.7] as V3) : '#ffffff') }], x, z, r: 4.5, walk: 1.4, run: 4.5, scare: 4.5, way: 'hopper', flee: 5, keep: wild }, land, r));
    this.all.push(new Shy({ spots: [{ x: 70, z: 108 }, { x: 80, z: 110 }, { x: 95, z: 107 }, { x: 40, z: 100 }], size: 1.3, chance: 0.5, scare: 5, run: 3.2 }, badger, land, r));
    this.hart = new Shy({ spots: [{ x: 22, z: 86 }, { x: 80, z: 71 }, { x: 106, z: 82 }, { x: 20, z: 104 }, { x: 46, z: 44 }], size: 1, chance: 0.12, scare: 12, run: 8 }, (n) => hart(n, () => [1.5, 1.5, 1.5]), land, r);
    this.all.push(this.hart);
    // The air: gold fireflies in every glade (and here and there through the wood), luna moths at the lanterns
    // and over the meadows, seeds and spores drifting down, midges over the water.
    const glade = (x: number, z: number) => GLADES.some(([gx, gz, gr]) => (x - gx) ** 2 + (z - gz) ** 2 < gr * gr);
    this.all.push(
      new Motes(
        [
          { spec: GOLDFLY, rate: 16, where: glade, y0: 0.3, y1: 1.8, night: true },
          { spec: GOLDFLY, rate: 20, where: (x, z) => !glade(x, z) && land.water(x, z) === NONE, y0: 0.3, y1: 2.2, night: true, patch: 0.46 },
          { spec: LUNA, rate: 8, where: (x, z) => insidePoly(DEER_MEADOW, x, z) || insidePoly(MOSSFEN, x, z) || glade(x, z), y0: 0.3, y1: 1.6, night: true },
          { spec: SPORE, rate: 9, where: (x, z) => land.water(x, z) === NONE, y0: 1, y1: 4, vel: [0.12, -0.05, 0.08] },
          { spec: MIDGE, rate: 55, where: () => true, y0: 0.15, y1: 1.2, water: true, patch: 0.42, night: true },
        ],
        land,
        LUNA,
      ),
    );
  }
  /** The white hart, out at its spot nearest (x, z) (for the checks and the shots). */
  showHart(x: number, z: number) {
    this.hart?.show(x, z);
  }
}
