import { Geo } from '../engine/geo';
import type { PSpec } from '../engine/particles';
import { clamp, fbm, mulberry32 } from '../engine/util';
import { NONE, T } from '../world/grid';
import { insidePoly, type Pt } from '../world/paint';
import type { Game } from './game';
import { body, both, clumps, Flock, joined, Frogs, Grazers, Land, Motes, Risers, Shy, Swimmers, Wader, Wildlife, type Perch, type V3 } from './wildlife';

// ---------------------------------------------------------------------------
// The Moonlit Keep's own life (the grammar is wildlife.ts): crows wheeling round the keep's towers and sitting on
// its battlements, going up all together when the knight comes; bats flitting over the barrows and out of the
// Hollow; mute swans on Mirrormere that run along the water and fly when he comes, mallards on the lake, the
// moat and the marsh pools; a grey heron at the ford; common frogs on the lily pads of the marsh and the lake;
// roach rising in rings; a flock of black-faced sheep on the meadows, two cows by the homestead, white geese by
// the stream; moths at every lamp, glow-worms in Blackpine, moths and thistledown over the fields, midges over
// the water, sallow lights over the marsh, the tavern's warm motes; and, seen rarely, the white hart.
// ---------------------------------------------------------------------------

const C = {
  crow: '#2a2a36', crowSheen: '#3c3c5c', crowWing: '#242430', bill: '#101014',
  bat: '#5a4032', batWing: '#3a2a30',
  swan: '#eeece6', swanShade: '#d4d2cc', swanBill: '#e07a30', knob: '#141414',
  drake: '#8e8e94', breast: '#6a3a2a', head: '#1e6a42', collar: '#f0f0f0', rump: '#1a1a1e', duckBill: '#d8c040', duckWing: '#7a7268', speculum: '#3a50c8',
  goose: '#ecebe4', gooseWing: '#c8c8c4', gooseBill: '#e8822a',
  heron: '#8a929e', heronBack: '#a8b0ba', heronNeck: '#dcdee0', heronBlack: '#22222a', heronBill: '#d8b040', heronLeg: '#8a7a4a',
  wool: '#d8d0bc', woolShade: '#bcb4a2', face: '#2a2420',
  cow: '#1c1c20', patch: '#e8e6e0', horn: '#d8ccb0', udder: '#d89a90',
  hart: '#e6e8f0', hartShade: '#c8ccd8',
  frog: '#6a7238', blotch: '#3a3c20', belly: '#c8c090', pad: '#2c5a2c', padRim: '#3a6a34', lily: '#f0eef4',
  roach: '#d8e0e4', roachBack: '#3a4a50', roachFin: '#c83a2a',
};

/** The village (as realm1.ts lays it out): the grazers keep out of it. */
const VILLAGE: Pt[] = [[54, 46], [100, 44], [108, 56], [104, 66], [96, 71], [86, 73], [74, 79], [62, 84], [54, 80], [50, 66]];
/** Blackpine (as realm1.ts draws it): glow-worms on its floor. */
const WOODS: Pt[] = [[58, 0], [120, 0], [120, 58], [110, 56], [102, 48], [90, 45], [76, 43], [62, 42], [58, 36]];

/** Moths: pale, fluttering, catching the lamplight. */
const MOTH: PSpec = { color: [2.4, 2.3, 1.9], color2: [1.4, 1.3, 1.1], size: 1, life: 4, wobble: 1.2, gravity: -0.02, fadeIn: 0.2, blink: true };
/** Moths over the moonlit grass, dimmer than at the lamps. */
const FIELD_MOTH: PSpec = { color: [1.5, 1.5, 1.7], color2: [0.8, 0.8, 1.0], size: 1, life: 6, wobble: 1.1, gravity: -0.03, fadeIn: 0.3, blink: true, alpha: 0.85 };
/** Thistledown drifting on the night air over the fields. */
const DOWN: PSpec = { color: [0.75, 0.78, 0.9], color2: [0.45, 0.48, 0.6], size: 1, life: 9, wobble: 0.35, gravity: 0.02, drag: 0.1, fadeIn: 0.5, alpha: 0.7 };
/** Glow-worms on Blackpine's floor: still green lights, slowly waxing and waning. */
const GLOWWORM: PSpec = { color: [1.2, 3.6, 1.0], color2: [0.6, 2.2, 0.5], size: 1, life: 8, fadeIn: 0.4, blink: true, alpha: 0.9 };
/** Midges dancing over the water. */
const MIDGE: PSpec = { color: [0.9, 1.0, 1.2], color2: [0.5, 0.55, 0.7], size: 1, life: 2.2, wobble: 1.8, fadeIn: 0.2, alpha: 0.55 };
/** Sallow lights over the marsh. */
const SALLOW: PSpec = { color: [2.2, 2.6, 1.0], color2: [0.8, 1.2, 0.4], size: 2, size2: 1, life: 5, wobble: 0.5, gravity: -0.05, drag: 0.8, fadeIn: 0.4 };
/** The tavern's warmth: gold motes drifting up out of its door and windows. */
const WARM: PSpec = { color: [3.2, 1.9, 0.7], color2: [1.4, 0.6, 0.15], size: 1, life: 3.5, wobble: 0.45, gravity: -0.18, drag: 0.6, fadeIn: 0.2 };

// ---------- the bodies ----------

const eyes = (g: Geo, x: number, y: number, z: number, s = 0.012) => {
  for (const k of [-1, 1]) g.box(k * x, y, z, s, s, s, [0.5, 0.5, 0.58]);
};

/** A carrion crow, its feet at 0, its heavy bill to +z: glossy black, a squared tail, broad fingered wings (their
 *  weight out to the tips). */
function crowBody() {
  const g = new Geo(), y = 0.15;
  g.sweep([[0, y - 0.01, -0.17], [0, y, -0.06], [0, y + 0.01, 0.07], [0, y + 0.04, 0.14]], [0.035, 0.07, 0.068, 0.045], (i) => (i === 2 ? C.crowSheen : C.crow), { seg: 6, lumpy: 0.05, squash: 0.85 });
  g.blob(0, y + 0.07, 0.19, 0.05, 0.05, 0.06, C.crow, 3, { detail: 1, jitter: 0.04 });
  g.box(0, y + 0.045, 0.255, 0.028, 0.034, 0.085, C.bill);
  eyes(g, 0.04, y + 0.08, 0.21);
  both(g, [-0.035, y, -0.15], [0.035, y, -0.15], [0.065, y - 0.02, -0.34], C.crow);
  both(g, [-0.035, y, -0.15], [0.065, y - 0.02, -0.34], [-0.065, y - 0.02, -0.34], C.crow);
  for (const s of [-1, 1]) {
    g.beam([s * 0.025, y - 0.05, 0], [s * 0.03, 0.0, 0.01], 0.012, '#1a1a1e');
    g.box(s * 0.03, 0, 0.03, 0.02, 0.01, 0.06, '#1a1a1e');
    both(g, [s * 0.05, y + 0.04, 0.08], [s * 0.26, y + 0.04, 0.05], [s * 0.26, y + 0.04, -0.12], C.crowWing);
    both(g, [s * 0.05, y + 0.04, 0.08], [s * 0.26, y + 0.04, -0.12], [s * 0.05, y + 0.04, -0.08], C.crowWing);
    both(g, [s * 0.26, y + 0.04, 0.05], [s * 0.44, y + 0.04, -0.02], [s * 0.26, y + 0.04, -0.12], C.crow);
    both(g, [s * 0.4, y + 0.04, -0.01], [s * 0.48, y + 0.04, -0.07], [s * 0.36, y + 0.04, -0.09], C.crow);
  }
  return body(g, (x) => clamp((Math.abs(x) - 0.055) / 0.4, 0, 1));
}

/** A noctule bat about its middle: a furry brown body, big ears, wings of dark skin stretched to the fingers. */
function batBody() {
  const g = new Geo();
  g.blob(0, 0, 0, 0.04, 0.035, 0.07, C.bat, 4, { detail: 1, jitter: 0.05 });
  g.blob(0, 0.012, 0.07, 0.03, 0.028, 0.03, C.bat, 5, { detail: 0, jitter: 0.04 });
  for (const s of [-1, 1]) {
    both(g, [s * 0.012, 0.03, 0.07], [s * 0.03, 0.075, 0.075], [s * 0.028, 0.03, 0.055], C.batWing);
    both(g, [s * 0.03, 0, 0.04], [s * 0.12, 0.012, 0.06], [s * 0.1, 0, -0.06], C.batWing);
    both(g, [s * 0.12, 0.012, 0.06], [s * 0.22, 0, 0.0], [s * 0.1, 0, -0.06], C.batWing);
    both(g, [s * 0.03, 0, 0.04], [s * 0.1, 0, -0.06], [s * 0.03, 0, -0.05], C.batWing);
    g.beam([s * 0.03, 0.005, 0.045], [s * 0.21, 0.004, 0.0], 0.006, C.bat);
  }
  return body(g, (x) => clamp((Math.abs(x) - 0.03) / 0.19, 0, 1));
}

/** A mute swan at the waterline: a big white body, its wings arched over the back (folded: drawn in by the
 *  bend), the long neck in its S, the orange bill with its black knob. */
function swanBody() {
  const g = new Geo();
  g.blob(0, 0.13, -0.05, 0.3, 0.2, 0.55, C.swan, 5, { detail: 1, jitter: 0.03, flatBottom: true });
  g.blob(0, 0.22, -0.18, 0.2, 0.11, 0.32, C.swanShade, 6, { detail: 1, jitter: 0.04 });
  g.sweep([[0, 0.18, 0.36], [0, 0.42, 0.46], [0, 0.62, 0.42], [0, 0.74, 0.5]], [0.07, 0.055, 0.05, 0.045], C.swan, { seg: 6, lumpy: 0.02 });
  g.blob(0, 0.76, 0.56, 0.05, 0.05, 0.08, C.swan, 7, { detail: 0, jitter: 0.03 });
  g.box(0, 0.72, 0.66, 0.04, 0.035, 0.1, C.swanBill);
  g.box(0, 0.75, 0.6, 0.032, 0.035, 0.035, C.knob);
  eyes(g, 0.045, 0.77, 0.57, 0.015);
  both(g, [-0.08, 0.2, -0.55], [0.08, 0.2, -0.55], [0, 0.28, -0.7], C.swanShade);
  for (const s of [-1, 1]) {
    both(g, [s * 0.18, 0.27, 0.28], [s * 0.65, 0.31, 0.2], [s * 0.62, 0.29, -0.3], C.swan);
    both(g, [s * 0.18, 0.27, 0.28], [s * 0.62, 0.29, -0.3], [s * 0.16, 0.25, -0.32], C.swan);
    both(g, [s * 0.65, 0.31, 0.2], [s * 1.15, 0.31, -0.05], [s * 0.62, 0.29, -0.3], C.swanShade);
  }
  return body(g, (x) => clamp((Math.abs(x) - 0.18) / 0.97, 0, 1));
}

/** A mallard drake at the waterline (the ducks are the same bird tinted brown): grey body, chestnut breast, green
 *  head, white collar, yellow bill, the blue flash on the wing. */
function mallardBody() {
  const g = new Geo();
  g.blob(0, 0.07, -0.02, 0.13, 0.09, 0.24, C.drake, 8, { detail: 1, jitter: 0.03, flatBottom: true });
  g.blob(0, 0.1, 0.14, 0.1, 0.08, 0.09, C.breast, 9, { detail: 0, jitter: 0.03 });
  g.blob(0, 0.1, -0.2, 0.08, 0.06, 0.08, C.rump, 10, { detail: 0 });
  g.beam([0, 0.12, 0.14], [0, 0.2, 0.19], 0.04, C.head);
  g.box(0, 0.15, 0.17, 0.085, 0.02, 0.075, C.collar);
  g.blob(0, 0.22, 0.2, 0.055, 0.055, 0.065, C.head, 11, { detail: 0, jitter: 0.03 });
  g.box(0, 0.205, 0.28, 0.036, 0.022, 0.075, C.duckBill);
  eyes(g, 0.05, 0.235, 0.21, 0.01);
  both(g, [-0.03, 0.12, -0.25], [0.03, 0.12, -0.25], [0, 0.16, -0.33], '#e8e8e8');
  for (const s of [-1, 1]) {
    both(g, [s * 0.09, 0.15, 0.1], [s * 0.3, 0.16, 0.0], [s * 0.26, 0.15, -0.14], C.duckWing);
    both(g, [s * 0.09, 0.15, 0.1], [s * 0.26, 0.15, -0.14], [s * 0.08, 0.14, -0.16], C.duckWing);
    both(g, [s * 0.14, 0.152, -0.02], [s * 0.24, 0.155, -0.06], [s * 0.15, 0.15, -0.12], C.speculum);
    both(g, [s * 0.3, 0.16, 0.0], [s * 0.44, 0.16, -0.1], [s * 0.26, 0.15, -0.14], '#5a5650');
  }
  return body(g, (x) => clamp((Math.abs(x) - 0.09) / 0.36, 0, 1));
}

/** A white farm goose, its feet at 0: a heavy white body, an upright neck, the orange bill with its knob, orange
 *  legs; its wings (opened when it runs from the knight) grey-white. */
function gooseBody() {
  const g = new Geo();
  g.blob(0, 0.32, -0.04, 0.17, 0.15, 0.3, C.goose, 12, { detail: 1, jitter: 0.03 });
  g.blob(0, 0.26, -0.1, 0.15, 0.1, 0.22, C.goose, 13, { detail: 0, jitter: 0.03 });
  g.sweep([[0, 0.38, 0.2], [0, 0.52, 0.26], [0, 0.64, 0.26]], [0.065, 0.05, 0.045], C.goose, { seg: 6 });
  g.blob(0, 0.67, 0.3, 0.05, 0.05, 0.07, C.goose, 14, { detail: 0 });
  g.box(0, 0.64, 0.38, 0.04, 0.04, 0.09, C.gooseBill);
  g.box(0, 0.68, 0.35, 0.03, 0.03, 0.03, C.gooseBill);
  eyes(g, 0.045, 0.69, 0.31, 0.012);
  both(g, [-0.06, 0.34, -0.32], [0.06, 0.34, -0.32], [0, 0.4, -0.42], C.goose);
  for (const s of [-1, 1]) {
    g.beam([s * 0.05, 0.2, 0], [s * 0.05, 0.0, 0.02], 0.022, C.gooseBill);
    g.box(s * 0.05, 0, 0.06, 0.06, 0.012, 0.08, C.gooseBill);
    both(g, [s * 0.12, 0.42, 0.14], [s * 0.42, 0.44, 0.04], [s * 0.38, 0.42, -0.24], C.gooseWing);
    both(g, [s * 0.12, 0.42, 0.14], [s * 0.38, 0.42, -0.24], [s * 0.11, 0.41, -0.26], C.gooseWing);
    both(g, [s * 0.42, 0.44, 0.04], [s * 0.75, 0.44, -0.12], [s * 0.38, 0.42, -0.24], C.goose);
  }
  return body(g, (x) => clamp((Math.abs(x) - 0.12) / 0.63, 0, 1));
}

/** A grey heron, its feet at 0: long yellow-grey legs, a grey body hunched, the white neck folded in its S, the
 *  black plume and stripe, the yellow dagger of a bill; broad grey wings edged black. */
function heronBody() {
  const g = new Geo();
  for (const s of [-1, 1]) {
    g.beam([s * 0.05, 0.72, -0.02], [s * 0.06, 0.32, 0.01], 0.022, C.heronLeg);
    g.beam([s * 0.06, 0.32, 0.01], [s * 0.06, 0.0, 0.02], 0.018, C.heronLeg);
    g.box(s * 0.06, 0, 0.07, 0.04, 0.012, 0.14, C.heronLeg);
  }
  g.push().translate(0, 0.86, -0.02).rotateX(0.35);
  g.blob(0, 0, 0, 0.13, 0.13, 0.27, C.heron, 15, { detail: 1, jitter: 0.04 });
  g.pop();
  g.blob(0, 0.9, -0.12, 0.11, 0.08, 0.2, C.heronBack, 16, { detail: 0, jitter: 0.05 });
  g.sweep([[0, 0.94, 0.16], [0, 1.06, 0.12], [0, 1.16, 0.2], [0, 1.22, 0.29]], [0.045, 0.04, 0.035, 0.035], C.heronNeck, { seg: 6 });
  g.blob(0, 1.25, 0.33, 0.045, 0.045, 0.06, C.heronNeck, 17, { detail: 0 });
  g.box(0, 1.28, 0.3, 0.05, 0.02, 0.1, C.heronBlack);
  g.beam([0, 1.28, 0.27], [0, 1.24, 0.12], 0.01, C.heronBlack);
  g.box(0, 1.235, 0.45, 0.022, 0.028, 0.2, C.heronBill);
  eyes(g, 0.04, 1.26, 0.35, 0.014);
  for (const s of [-1, 1]) {
    both(g, [s * 0.12, 0.98, 0.2], [s * 0.5, 1.0, 0.12], [s * 0.48, 0.98, -0.26], C.heronBack);
    both(g, [s * 0.12, 0.98, 0.2], [s * 0.48, 0.98, -0.26], [s * 0.1, 0.96, -0.28], C.heron);
    both(g, [s * 0.5, 1.0, 0.12], [s * 0.92, 0.99, -0.02], [s * 0.48, 0.98, -0.26], C.heronBlack);
  }
  return body(g, (x, y) => (y > 0.9 ? clamp((Math.abs(x) - 0.12) / 0.8, 0, 1) : 0));
}

/** A black-faced sheep, its feet at 0: a lumpy fleece, the dark face and ears (the head and neck weighted to go
 *  down to the grass), dark legs (weighted to swing). */
function sheepBody() {
  const g = new Geo();
  g.blob(0, 0.56, -0.02, 0.27, 0.22, 0.38, C.wool, 18, { detail: 1, jitter: 0.12 });
  g.blob(0, 0.5, -0.24, 0.22, 0.2, 0.2, C.woolShade, 19, { detail: 1, jitter: 0.12 });
  g.blob(0, 0.68, 0.3, 0.13, 0.12, 0.12, C.wool, 20, { detail: 0, jitter: 0.1, wind: 2 });
  g.blob(0, 0.62, 0.42, 0.075, 0.1, 0.12, C.face, 21, { detail: 0, jitter: 0.05, wind: 2 });
  for (const s of [-1, 1]) {
    g.box(s * 0.1, 0.68, 0.38, 0.1, 0.03, 0.05, C.face, { wind: 2 });
    g.box(s * 0.04, 0.66, 0.5, 0.012, 0.012, 0.012, [0.5, 0.48, 0.42], { wind: 2 });
    for (const z of [0.2, -0.24]) g.beam([s * 0.12, 0.4, z], [s * 0.12, 0.0, z + 0.02], 0.035, C.face, { wind: 1 });
  }
  return body(g, (_x, y, z, m) => (m > 1.5 ? 1 + clamp((z - 0.24) / 0.3, 0, 1) * 0.6 : m > 0.5 ? Math.max(0, 0.4 - y) : 0));
}

/** A cow, its feet at 0: black with white patches (the other tinted red-brown), the white face, short horns, the
 *  pink udder, a tail. */
function cowBody() {
  const g = new Geo();
  g.blob(0, 0.95, 0, 0.36, 0.34, 0.75, C.cow, 22, { detail: 1, jitter: 0.04 });
  for (const [x, y, z, r] of [[0.28, 1.05, 0.2, 0.2], [-0.3, 0.95, -0.3, 0.22], [0.15, 1.2, -0.45, 0.18], [-0.2, 1.18, 0.35, 0.16]] as const) g.blob(x, y, z, r * 0.6, r, r * 1.2, C.patch, 23 + x * 10, { detail: 0, jitter: 0.05 });
  g.blob(0, 0.62, -0.25, 0.16, 0.08, 0.14, C.udder, 27, { detail: 0 });
  g.beam([0, 1.15, -0.72], [0, 0.55, -0.82], 0.03, C.cow);
  g.blob(0, 1.05, 0.82, 0.18, 0.18, 0.18, C.cow, 28, { detail: 0, jitter: 0.04, wind: 2 });
  g.box(0, 0.88, 1.0, 0.24, 0.3, 0.2, C.patch, { wind: 2 });
  g.box(0, 0.8, 1.1, 0.22, 0.14, 0.06, '#c89a90', { wind: 2 });
  for (const s of [-1, 1]) {
    g.beam([s * 0.12, 1.2, 0.86], [s * 0.26, 1.3, 0.84], 0.025, C.horn, { wind: 2 });
    g.box(s * 0.2, 1.08, 0.86, 0.14, 0.05, 0.06, C.cow, { wind: 2 });
    g.box(s * 0.08, 1.06, 1.05, 0.02, 0.02, 0.02, [0.45, 0.42, 0.4], { wind: 2 });
    for (const z of [0.5, -0.5]) g.beam([s * 0.22, 0.72, z], [s * 0.22, 0.0, z + 0.03], 0.07, z > 0 ? C.cow : C.patch, { wind: 1 });
  }
  return body(g, (_x, y, z, m) => (m > 1.5 ? 1 + clamp((z - 0.68) / 0.4, 0, 1) * 0.95 : m > 0.5 ? Math.max(0, 0.72 - y) : 0));
}

/** The white hart, its feet at 0: a pale stag, its antlers lit from within with the moon's cold blue. */
function hartBody() {
  const g = new Geo(), glow: V3 = [0.8, 1.5, 3.2];
  g.blob(0, 1.08, 0, 0.21, 0.25, 0.58, C.hart, 30, { detail: 1, jitter: 0.03 });
  g.blob(0, 1.1, 0.42, 0.17, 0.22, 0.17, C.hart, 31, { detail: 0, wind: 2 });
  g.sweep([[0, 1.2, 0.48], [0, 1.45, 0.6], [0, 1.6, 0.66]], [0.11, 0.09, 0.08], C.hart, { seg: 6, wind: 2 });
  g.blob(0, 1.66, 0.74, 0.08, 0.08, 0.13, C.hart, 32, { detail: 0, wind: 2 });
  g.box(0, 1.61, 0.86, 0.07, 0.07, 0.08, C.hartShade, { wind: 2 });
  for (const s of [-1, 1]) {
    g.box(s * 0.075, 1.75, 0.68, 0.1, 0.04, 0.05, C.hartShade, { wind: 2 });
    g.box(s * 0.05, 1.69, 0.8, 0.016, 0.016, 0.016, [0.3, 0.3, 0.4], { wind: 2 });
    // The antlers: a beam up and back, tines off it, all glowing.
    const a: V3 = [s * 0.05, 1.74, 0.72], b2: V3 = [s * 0.22, 2.1, 0.62], c: V3 = [s * 0.3, 2.42, 0.52];
    g.beam(a, b2, 0.022, glow, { kind: 1, wind: 3 });
    g.beam(b2, c, 0.018, glow, { kind: 1, wind: 3 });
    g.beam([s * 0.12, 1.9, 0.68], [s * 0.14, 2.05, 0.84], 0.014, glow, { kind: 1, wind: 3 });
    g.beam(b2, [s * 0.3, 2.2, 0.78], 0.014, glow, { kind: 1, wind: 3 });
    g.beam(c, [s * 0.42, 2.52, 0.6], 0.012, glow, { kind: 1, wind: 3 });
    g.beam(c, [s * 0.26, 2.6, 0.42], 0.012, glow, { kind: 1, wind: 3 });
    for (const z of [0.42, -0.42]) {
      g.beam([s * 0.12, 0.9, z], [s * 0.12, 0.42, z + (z > 0 ? 0.02 : -0.04)], 0.045, C.hart, { wind: 1 });
      g.beam([s * 0.12, 0.42, z + (z > 0 ? 0.02 : -0.04)], [s * 0.12, 0.0, z + 0.02], 0.03, C.hartShade, { wind: 1 });
    }
  }
  g.blob(0, 1.1, -0.6, 0.06, 0.08, 0.06, '#f8f8ff', 33, { detail: 0 });
  return body(g, (_x, y, z, m) => (m > 2.5 ? 2.1 : m > 1.5 ? 1 + clamp((z - 0.4) / 0.45, 0, 1) * 1.5 : m > 0.5 ? Math.max(0, 0.9 - y) : 0));
}

/** A common frog on its pad: olive, dark-blotched, gold-eyed; its hind legs folded under it (weighted to kick out
 *  behind in a leap). */
function frogBody() {
  const g = new Geo();
  g.blob(0, 0.035, -0.005, 0.045, 0.03, 0.06, C.frog, 34, { detail: 1, jitter: 0.05, flatBottom: true });
  g.blob(0, 0.04, 0.05, 0.038, 0.026, 0.035, C.frog, 35, { detail: 0, jitter: 0.04 });
  for (const [x, z] of [[0.02, -0.02], [-0.025, 0.0], [0.0, -0.04]] as const) g.box(x, 0.062, z, 0.018, 0.006, 0.016, C.blotch);
  for (const s of [-1, 1]) {
    g.box(s * 0.024, 0.064, 0.06, 0.016, 0.016, 0.016, [1.4, 1.1, 0.35], { kind: 1 });
    g.beam([s * 0.03, 0.02, 0.04], [s * 0.045, 0.0, 0.07], 0.007, C.frog);
    g.beam([s * 0.035, 0.02, -0.04], [s * 0.07, 0.02, -0.005], 0.012, C.frog, { wind: 1 });
    g.beam([s * 0.07, 0.02, -0.005], [s * 0.06, 0.008, -0.07], 0.009, C.frog, { wind: 1 });
    g.box(s * 0.07, 0.004, -0.085, 0.03, 0.006, 0.03, C.belly, { wind: 1 });
  }
  return body(g, (_x, _y, z, m) => m * clamp((0.03 - z) / 0.12, 0, 1));
}

/** A lily pad, its notch and a water lily half open on it, faintly bright in the moonlight. */
function padBody() {
  const g = new Geo(), n = 10, R = 0.3;
  for (let k = 1; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
    g.tri([0, 0, 0], [Math.cos(a1) * R, 0, Math.sin(a1) * R], [Math.cos(a0) * R, 0, Math.sin(a0) * R], k % 2 ? C.pad : C.padRim);
  }
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    g.push().translate(0.1, 0.03, 0.06).rotateY(a);
    g.tri([0, 0, 0], [0.025, 0.05, 0.05], [-0.025, 0.05, 0.05], [1.2, 1.18, 1.3], { kind: 1 });
    g.pop();
  }
  g.box(0.1, 0.02, 0.06, 0.03, 0.03, 0.03, [1.6, 1.3, 0.4], { kind: 1 });
  return body(g, () => 0);
}

/** A roach: slim and silver, a dark back, red fins and a red eye. */
function roachBody() {
  const g = new Geo(), zs = [-0.3, -0.18, -0.02, 0.14, 0.3, 0.42], rs = [0.02, 0.05, 0.075, 0.075, 0.055, 0.02];
  g.sweep(zs.map((z): V3 => [0, 0, z]), rs, C.roach, { seg: 5, lumpy: 0, squash: [1.4, 1.5, 1.6, 1.6, 1.4, 1.2] });
  g.sweep(zs.slice(1, 5).map((z, i): V3 => [0, rs[i + 1] * 1.1, z]), rs.slice(1, 5).map((r) => r * 0.5), C.roachBack, { seg: 5, lumpy: 0, squash: 0.6 });
  both(g, [0, 0.02, -0.29], [0, 0.14, -0.46], [0, 0.01, -0.38], C.roachFin);
  both(g, [0, -0.02, -0.29], [0, 0.0, -0.38], [0, -0.14, -0.46], C.roachFin);
  both(g, [0, 0.11, 0.12], [0, 0.2, -0.02], [0, 0.11, -0.06], C.roachFin);
  for (const s of [-1, 1]) g.box(s * 0.04, 0.02, 0.32, 0.02, 0.025, 0.025, [0.7, 0.1, 0.08]);
  return body(g, (_x, _y, z) => Math.pow(clamp((0.2 - z) / 0.72, 0, 1), 1.3));
}

// ---------- where they live ----------

/** The keep's walls (as realm1.ts builds them: their tops at 9 m, merlons 0.55 m above): where the crows sit,
 *  mostly on the sides the camera sees (the south wall, the east walls), and the donjon's crenels. */
function battlements(): Perch[] {
  const out: Perch[] = [];
  const merlon = (x0: number, x1: number, at: number, alongX: boolean, side: number, face: number) => {
    const len = x1 - x0, n = Math.floor(len / 0.9);
    for (let i = 0; i < n; i += 4) {
      const t = x0 + (i + 0.5) * (len / n);
      out.push(alongX ? { x: t, y: 9.55, z: at + side * 0.65, face } : { x: at + side * 0.65, y: 9.55, z: t, face });
    }
  };
  merlon(16, 44, 40, true, 1, 0);
  merlon(16, 44, 8, true, -1, Math.PI);
  merlon(10, 21, 46, false, 1, Math.PI / 2);
  merlon(28, 38, 46, false, 1, Math.PI / 2);
  for (const t of [-2.6, -0.85, 0.9, 2.65]) {
    out.push({ x: 17.3, y: 20.6, z: 8.5 + t, face: Math.PI / 2 });
    out.push({ x: 14.5 + t, y: 20.6, z: 11.3, face: 0 });
  }
  return out;
}

/** Realm 1's life (see the top of this file), made when the realm is (the realm's story holds it, see
 *  story/castle.ts) and moved each frame from the story's tick. */
export class KeepLife extends Wildlife {
  private hart: Shy | null = null;
  apply(g: Game) {
    if (this.built) return;
    this.built = true;
    const r = mulberry32(8787), land = (this.land = new Land(g)), grid = g.grid;
    // All the realm's birds and bats in one instanced mesh, all its beasts in another, the frogs and their pads,
    // the fish: four draws at most, however many flocks and herds (each body draws its own kind's shape).
    const [crow, bat, swan, duck, goose, heron] = this.kind(g, 'fly', 0.25, 90, crowBody(), batBody(), swanBody(), mallardBody(), gooseBody(), heronBody());
    const [sheep, cow, hart] = this.kind(g, 'walk', 0.22, 31, sheepBody(), cowBody(), hartBody());
    const [frogs] = this.kind(g, 'hop', 0.25, 48, joined(frogBody(), padBody()));
    const [roach] = this.kind(g, 'wag', 0.35, 2, roachBody());
    // The crows: round the donjon's top, the corner towers and the gatehouse; half of them on the battlements.
    this.all.push(
      new Flock({ n: 26, size: 1.35, perched: 0.5, scare: 6, speed: 4.5, beat: 15, perches: battlements(), circles: [{ x: 14.5, z: 8.5, r: 7, y: 24 }, { x: 46, z: 40, r: 4.5, y: 14 }, { x: 46, z: 8, r: 4.5, y: 14 }, { x: 46, z: 24.5, r: 5, y: 12.5 }, { x: 30, z: 40, r: 6, y: 11.5 }] }, crow, r),
    );
    // Bats over the barrows and the graveyard, and out of the Hollow's mouth.
    this.all.push(new Flock({ n: 10, size: 1.9, flit: true, speed: 4.2, beat: 30, circles: [{ x: 19.5, z: 73, r: 6, y: 3.2 }, { x: 17, z: 81, r: 5, y: 3 }, { x: 36, z: 77, r: 6, y: 3.8 }] }, bat, r));
    this.all.push(new Flock({ n: 6, size: 1.9, flit: true, speed: 4.6, beat: 30, circles: [{ x: 33, z: 60, r: 4.5, y: 2.6 }, { x: 28, z: 64, r: 5, y: 3.4 }] }, bat, r));
    // Mute swans and mallards on Mirrormere; mallards on the moat and the marsh pools.
    const hen = (i: number) => (i % 2 ? ([0.92, 0.72, 0.5] as V3) : '#ffffff');
    this.all.push(new Swimmers({ n: 3, size: 1, x: 3, z: 96, r: 9, scare: 6.5, fly: true, sink: 0.05 }, swan, land, r));
    this.all.push(new Swimmers({ n: 2, size: 1, x: 4, z: 112, r: 7, scare: 6.5, fly: true, sink: 0.05 }, swan, land, r));
    this.all.push(new Swimmers({ n: 6, size: 1.15, x: 7, z: 104, r: 7, dabble: true, tint: hen }, duck, land, r));
    this.all.push(new Swimmers({ n: 5, size: 1.15, x: 49, z: 32, r: 12, dabble: true, tint: hen }, duck, land, r));
    this.all.push(new Swimmers({ n: 4, size: 1.15, x: 28, z: 114, r: 7, dabble: true, tint: hen }, duck, land, r));
    this.all.push(new Swimmers({ n: 4, size: 1.15, x: 50, z: 113, r: 7, dabble: true, tint: hen }, duck, land, r));
    // The heron, up and down the stream about the ford, and out at the marsh.
    this.all.push(new Wader([{ x: 73.4, z: 96 }, { x: 66.5, z: 108.5 }, { x: 78.5, z: 88.8 }, { x: 84.5, z: 82 }], heron, 1.25, land, r));
    // White geese grazing the stream's banks below the village and by the ford; sheep on the meadows; two
    // cows by the homestead.
    const pasture = (x: number, z: number) => !insidePoly(VILLAGE, x, z) && grid.typeAt(x, z) !== T.Path && grid.typeAt(x, z) !== T.Cobble && grid.typeAt(x, z) !== T.Flag && grid.typeAt(x, z) !== T.Field;
    this.all.push(new Grazers({ kinds: [{ src: goose, n: 5, size: 1 }], x: 75, z: 99, r: 4.5, walk: 0.5, run: 2.6, scare: 4, way: 'bird', flee: 5, keep: pasture }, land, r));
    this.all.push(new Grazers({ kinds: [{ src: goose, n: 4, size: 1 }], x: 92, z: 82, r: 4, walk: 0.5, run: 2.6, scare: 4, way: 'bird', flee: 5, keep: pasture }, land, r));
    const fleece = (i: number) => (i % 5 === 3 ? ([0.62, 0.58, 0.54] as V3) : i % 3 ? '#ffffff' : ([0.94, 0.9, 0.84] as V3));
    this.all.push(new Grazers({ kinds: [{ src: sheep, n: 11, size: 1, tint: fleece }], x: 99, z: 84, r: 8, walk: 0.55, run: 3.6, scare: 5, way: 'beast', flee: 8, keep: pasture }, land, r));
    this.all.push(new Grazers({ kinds: [{ src: sheep, n: 8, size: 1, tint: fleece }], x: 57, z: 96, r: 7, walk: 0.55, run: 3.6, scare: 5, way: 'beast', flee: 8, keep: pasture }, land, r));
    this.all.push(new Grazers({ kinds: [{ src: sheep, n: 7, size: 1, tint: fleece }], x: 112, z: 104, r: 5.5, walk: 0.55, run: 3.6, scare: 5, way: 'beast', flee: 7, keep: pasture }, land, r));
    this.all.push(new Grazers({ kinds: [{ src: cow, n: 2, size: 1, tint: (i) => (i ? ([0.75, 0.42, 0.26] as V3) : '#ffffff') }], x: 95, z: 100, r: 3.5, walk: 0.4, run: 1.8, scare: 3, way: 'beast', flee: 4, keep: pasture }, land, r));
    // Frogs on the lily pads of the marsh pools and Mirrormere's shallows, in clumps.
    const spots: { x: number; z: number }[] = [];
    for (let k = 0; k < 4000 && spots.length < 22; k++) {
      const x = r() * 64 - 6, z = 80 + r() * 42;
      if (!(z > 104 || x < 14) || !land.wet(x, z, 0.12) || fbm(x * 0.12, z * 0.12, 2, 909) < 0.5) continue;
      let bank = false;
      for (let a = 0; a < 8 && !bank; a++) if (land.water(x + Math.cos(a * 0.785) * 1.6, z + Math.sin(a * 0.785) * 1.6) === NONE) bank = true;
      if (!bank || spots.some((s) => Math.hypot(s.x - x, s.z - z) < 1.6)) continue;
      spots.push({ x, z });
    }
    for (const c of clumps(spots)) this.all.push(new Frogs({ spots: c, size: 1.9, padSize: 1.3 }, frogs, land, r));
    // Roach rising all over the still water and the stream.
    this.all.push(new Risers(() => true, roach, 0.55, land, 1.6));
    // The white hart, rare: in Blackpine's glades, among the barrows, by the Seven Stones.
    this.hart = new Shy({ spots: [{ x: 80, z: 31 }, { x: 106, z: 40 }, { x: 23.6, z: 84 }, { x: 112, z: 79 }, { x: 60, z: 30 }], size: 1, chance: 0.12, scare: 12, run: 8 }, (n) => hart(n, () => [1.5, 1.5, 1.6]), land, r);
    this.all.push(this.hart);
    // The air: moths at every lamp and over the moonlit grass, thistledown over the fields, midges over the
    // water, glow-worms on Blackpine's floor, sallow lights over the marsh, the tavern's warmth.
    const grass = (x: number, z: number) => {
      const t = grid.typeAt(x, z);
      return t === T.Grass || t === T.Field || t === T.DarkGrass || t === T.Reeds || t === T.Mud;
    };
    this.all.push(
      new Motes(
        [
          { spec: FIELD_MOTH, rate: 16, where: (x, z) => grass(x, z) && !insidePoly(WOODS, x, z), y0: 0.25, y1: 1.6, night: true, patch: 0.4 },
          { spec: DOWN, rate: 12, where: (x, z) => grass(x, z) && !insidePoly(WOODS, x, z) && z > 44, y0: 0.4, y1: 2.6, vel: [0.35, 0.02, 0.18] },
          { spec: MIDGE, rate: 75, where: () => true, y0: 0.15, y1: 1.2, water: true, patch: 0.32, night: true },
          { spec: GLOWWORM, rate: 34, where: (x, z) => insidePoly(WOODS, x, z) && grid.typeAt(x, z) !== T.Path && grid.typeAt(x, z) !== T.Dirt, y0: 0.03, y1: 0.12, night: true, patch: 0.45 },
          { spec: SALLOW, rate: 6, where: (x, z) => z > 104 && x < 62, y0: 0.4, y1: 1.6, night: true },
          { spec: WARM, rate: 7, where: (x, z) => x > 71 && x < 83 && z > 49 && z < 58.5, y0: 0.6, y1: 2.6 },
        ],
        land,
        MOTH,
      ),
    );
  }
  /** The white hart, out at its spot nearest (x, z) (for the checks and the shots). */
  showHart(x: number, z: number) {
    this.hart?.show(x, z);
  }
}

