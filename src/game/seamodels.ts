import * as THREE from 'three';
import { Rig } from '../engine/rig';
import type { Geo } from '../engine/geo';
import { K } from '../engine/materials';
import { clamp } from '../engine/util';
import { FOES } from '../config';
import { GOB, goblinBody, goblinPose, Model, type Anim } from './models';

// The Sunken Reef's own foes, built from boxes like everyone else: the crew's divers and harpooners, and
// the sea's creatures (the Jelly, the crab, the eel, the pufferfish). Bold shapes and bright colours: they
// are seen from above, through the water.

const ease = (k: number) => k * k * (3 - 2 * k);
const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

/** What a sea foe's pose needs to know that its state and clock don't say (set each frame, see seafoes.ts):
 *  how far the eel is out of its den and where the den lies, where a diver's float bobs (offsets from the
 *  foe in the world), whether the harpoon has been thrown. */
export interface SeaLook {
  ext: number;
  den: { x: number; y: number; z: number };
  float: { x: number; y: number; z: number } | null;
  thrown: boolean;
}

export const seaLook = (): SeaLook => ({ ext: 0, den: { x: 0, y: 0, z: 0 }, float: null, thrown: false });

const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();

/** A world offset (from the foe) in its rig's own space: turned back by its heading, shrunk by its size. */
function local(r: Rig, x: number, y: number, z: number) {
  const c = Math.cos(-r.yaw), s = Math.sin(-r.yaw);
  return _v.set((x * c + z * s) / r.scale, y / r.scale, (-x * s + z * c) / r.scale);
}

// ---------- the crew's divers ----------

/** Odds and ends from the wrecks: the divers' helmets, hoses and floats. */
const GEAR = { tin: '#c4ced6', tinD: '#8a96a0', hoop: '#5a626a', woodD: '#5e4022', copper: '#f08a40', copperD: '#b05a28', copperL: '#ffc080', glass: '#e0faff', glassD: '#9ad8e4', brass: '#e0a838', hose: '#3a3430', cork: '#d8a860', red: '#e83a2a', white: '#f4f0e4' };

/**
 * A goblin diver: a bucket, a kettle or a fishbowl over its head (`kit` 0, 1, 2), lead weights on its belt,
 * a boathook, and a hose from its helmet up to a cork float bobbing on the surface over it (placed each
 * frame from `look.float`; hidden when its head is above the water).
 */
export function makeDiver(kit: number, look: SeaLook): Model {
  const r = new Rig({ shadow: 0.7 });
  goblinBody(r);
  r.part('head', (g, gl) => {
    if (kit === 0) {
      // A tin bucket upside down, two hoops, a slit cut out for the eyes, its handle swinging.
      g.cyl(0, -0.08, 0, 0.27, 0.23, 0.5, 9, GEAR.tin, { kind: K.Metal });
      g.cyl(0, 0.42, 0, 0.23, 0.2, 0.03, 9, GEAR.tinD, { kind: K.Metal });
      for (const y of [0.02, 0.3]) g.cyl(0, y, 0, y < 0.1 ? 0.275 : 0.245, y < 0.1 ? 0.27 : 0.24, 0.05, 9, GEAR.hoop, { kind: K.Metal });
      g.box(0, 0.13, 0.235, 0.26, 0.07, 0.04, '#120c08');
      for (const s of [-1, 1]) gl.box(s * 0.07, 0.15, 0.25, 0.045, 0.035, 0.01, GOB.eye);
      g.beam([-0.26, 0.2, 0], [0, 0.0, 0.3], 0.015, GEAR.hoop);
      g.beam([0.26, 0.2, 0], [0, 0.0, 0.3], 0.015, GEAR.hoop);
    } else if (kit === 1) {
      // A copper kettle: its spout for a snorkel, its handle arched over the top, a window riveted in front.
      g.blob(0, 0.17, 0, 0.29, 0.27, 0.29, GEAR.copper, 81, { kind: K.Metal, detail: 1, jitter: 0.04 });
      g.cyl(0, -0.08, 0, 0.27, 0.27, 0.08, 9, GEAR.copperD, { kind: K.Metal });
      g.cyl(0, 0.4, 0, 0.13, 0.08, 0.06, 8, GEAR.copperL, { kind: K.Metal });
      g.box(0, 0.46, 0, 0.06, 0.06, 0.06, '#3a2a20');
      g.beam([0.2, 0.15, 0.05], [0.44, 0.42, 0.2], 0.045, GEAR.copper, { kind: K.Metal });
      g.beam([0, 0.4, -0.2], [0, 0.6, 0], 0.025, '#3a2a20');
      g.beam([0, 0.6, 0], [0, 0.4, 0.2], 0.025, '#3a2a20');
      g.push().translate(0, 0.15, 0.26).rotateX(Math.PI / 2);
      g.cyl(0, 0, 0, 0.11, 0.11, 0.04, 9, GEAR.brass, { kind: K.Metal });
      g.cyl(0, 0.01, 0, 0.085, 0.085, 0.04, 9, '#14303a');
      g.pop();
      for (const s of [-1, 1]) gl.box(s * 0.04, 0.16, 0.305, 0.04, 0.035, 0.01, GOB.eye);
    } else {
      // A fishbowl: the goblin's own face inside the glass, a brass collar, the glass catching the light
      // (and a small fish going round its ears).
      g.cyl(0, -0.1, 0, 0.29, 0.29, 0.08, 10, GEAR.brass, { kind: K.Metal });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        const pts: [number, number, number][] = [[c * 0.28, -0.02, s * 0.28], [c * 0.34, 0.17, s * 0.34], [c * 0.28, 0.38, s * 0.28], [c * 0.1, 0.48, s * 0.1]];
        for (let k = 0; k < 3; k++) g.beam(pts[k], pts[k + 1], 0.022, i % 2 ? GEAR.glass : GEAR.glassD);
      }
      g.cyl(0, 0.16, 0, 0.345, 0.345, 0.03, 12, GEAR.glass, { cap: false });
      g.cyl(0, 0.46, 0, 0.12, 0.1, 0.03, 10, GEAR.glass);
      gl.box(-0.2, 0.32, 0.2, 0.06, 0.12, 0.02, [1.8, 2.6, 2.8]);
      gl.box(-0.25, 0.2, 0.17, 0.04, 0.08, 0.02, [1.4, 2.2, 2.4]);
      gl.box(0.18, 0.38, -0.18, 0.05, 0.08, 0.02, [1.2, 1.9, 2.1]);
      g.box(0.22, 0.05, 0.12, 0.08, 0.05, 0.03, '#f08a20');
      g.box(0.27, 0.05, 0.12, 0.03, 0.06, 0.03, '#f8b040');
    }
    // The hose's end, fixed to the top.
    g.cyl(0, kit === 2 ? 0.48 : 0.42, -0.04, 0.05, 0.05, 0.07, 6, GEAR.hose);
  });
  r.part('hips', (g) => {
    // A belt of lead weights to keep it down.
    g.box(0, -0.12, 0, 0.4, 0.06, 0.3, '#3a3020');
    for (const [x, z] of [[-0.15, 0.13], [0.15, 0.13], [0.2, -0.05], [-0.2, -0.05]]) g.box(x, -0.17, z, 0.09, 0.1, 0.07, '#5a5a62', { kind: K.Metal });
  });
  // A boathook: a pole with an iron hook and spike.
  r.part('handR', (g) => {
    g.box(0, -0.65, 0.02, 0.05, 1.2, 0.05, GEAR.woodD, { kind: K.Wood });
    g.box(0, -0.72, 0.02, 0.04, 0.14, 0.04, GEAR.hoop, { kind: K.Metal });
    g.beam([0, -0.68, 0.03], [0, -0.82, 0.16], 0.022, '#8a8a96', { kind: K.Metal });
    g.beam([0, -0.82, 0.16], [0, -0.7, 0.24], 0.02, '#8a8a96', { kind: K.Metal });
    g.cyl(0, -0.83, 0.02, 0.03, 0, 0.14, 4, '#a0a0aa', { rot: 0.4 });
  });
  // The hose (a unit long, stretched up to the float) and the float: cork, painted red and white on top.
  r.joint('hose', 'root', 0, kit === 2 ? 1.45 : 1.4, -0.04);
  r.part('hose', (g) => g.box(0, 0, 0, 0.055, 1, 0.055, GEAR.hose));
  r.joint('float', 'root', 0, 3, 0);
  r.part('float', (g, gl) => {
    g.cyl(0, -0.1, 0, 0.17, 0.19, 0.16, 8, GEAR.cork, { kind: K.Wood });
    g.cyl(0, 0.06, 0, 0.19, 0.1, 0.07, 8, GEAR.red);
    g.cyl(0, 0.13, 0, 0.09, 0.02, 0.05, 8, GEAR.white);
    gl.box(0, 0.17, 0, 0.05, 0.05, 0.05, [2.4, 0.7, 0.4]);
  });
  return new Model(r, (rig, a) => {
    goblinPose(rig, a, false);
    hoseTo(rig, look);
  }, 0.8);
}

/** The hose from the helmet up to the float on the surface (both hidden while the diver's head is in the air). */
function hoseTo(r: Rig, look: SeaLook) {
  const hose = r.j('hose'), float = r.j('float'), f = look.float;
  if (!f) {
    hose.scale.setScalar(1e-4);
    float.scale.setScalar(1e-4);
    return;
  }
  const to = local(r, f.x, f.y, f.z);
  float.position.copy(to);
  float.scale.setScalar(1 / r.scale);
  float.rotation.set(Math.sin(f.x * 3 + f.z) * 0.15, 0, Math.cos(f.x * 2 - f.z) * 0.15);
  const d = to.sub(hose.position), len = d.length();
  hose.quaternion.setFromUnitVectors(UP, d.normalize());
  hose.scale.set(1, Math.max(0.01, len - 0.05), 1);
}

/** The harpooner: a goblin in a fisherman's yellow sou'wester, a coil of line over its shoulder and a
 *  barbed harpoon (gone from its hand while it's out on the line). */
export function makeHarpooner(look: SeaLook): Model {
  const r = new Rig({ shadow: 0.7 });
  goblinBody(r);
  r.part('head', (g) => {
    const hat = '#e8b830', hatD = '#a87e18';
    g.push().translate(0, 0.27, -0.03).rotateX(-0.18);
    g.cyl(0, 0, 0, 0.36, 0.33, 0.04, 10, hat);
    g.cyl(0, 0.04, 0.02, 0.24, 0.2, 0.17, 9, hat);
    g.cyl(0, 0.04, 0.02, 0.245, 0.245, 0.04, 9, hatD);
    g.box(0, -0.02, -0.3, 0.4, 0.05, 0.16, hat);
    g.pop();
  });
  r.part('torso', (g) => {
    // The line, coiled over one shoulder and across the chest.
    for (let i = 0; i < 3; i++) g.box(0.06, 0.2 - i * 0.07, 0.15, 0.36, 0.045, 0.05, '#c8b88a');
    g.blob(0.24, 0.36, 0, 0.11, 0.07, 0.15, '#b8a878', 7);
  });
  r.joint('harpoon', 'handR', 0, -0.1, 0);
  r.part('harpoon', (g) => {
    g.box(0, -0.95, 0, 0.05, 1.55, 0.05, '#7a5a38', { kind: K.Wood });
    g.box(0, -1.05, 0, 0.07, 0.12, 0.07, '#4a4a54', { kind: K.Metal });
    g.cyl(0, -1.05, 0, 0.06, 0, -0.3, 4, '#b8bcc8', { kind: K.Metal });
    for (const s of [-1, 1]) g.beam([0, -1.2, 0], [s * 0.1, -1.08, 0], 0.018, '#b8bcc8');
    g.beam([0, 0.55, 0], [0.12, 0.7, 0.1], 0.015, '#c8b88a');
  });
  return new Model(r, (rig, a) => harpoonerPose(rig, a, look), 0.8);
}

function harpoonerPose(r: Rig, a: Anim, look: SeaLook) {
  const name = a.name === 'aim' || a.name === 'strike' || a.name === 'reel' ? 'idle' : a.name;
  goblinPose(r, { ...a, name }, false);
  r.j('harpoon').scale.setScalar(look.thrown ? 1e-4 : 1);
  const armR = r.j('armR'), armL = r.j('armL'), handR = r.j('handR');
  if (a.name === 'aim') {
    // Drawn back over the shoulder, the point toward the knight.
    const k = ease(seg(a.t, 0, 0.35));
    armR.rotation.x = mix(-0.4, 2.3, k);
    handR.rotation.x = mix(-0.9, -4.05, k);
    armL.rotation.x = -1.2 * k;
    armL.rotation.y = -0.3 * k;
    r.j('torso').rotation.y = -0.45 * k;
    r.j('torso').rotation.x = -0.1 * k;
  } else if (a.name === 'strike') {
    // The throw: the arm comes over and forward.
    const k = easeOut(seg(a.t, 0, 0.15));
    armR.rotation.x = mix(2.3, -1.5, k);
    handR.rotation.x = -0.2;
    r.j('torso').rotation.y = mix(-0.45, 0.3, k);
    r.j('torso').rotation.x = 0.4 * k;
  } else if (a.name === 'reel') {
    // Hauling the line in, hand over hand.
    const s = Math.sin(a.time * 16);
    armR.rotation.x = -1.2 + s * 0.45;
    armL.rotation.x = -1.2 - s * 0.45;
    armL.rotation.z = 0.1;
    handR.rotation.x = 0;
    r.j('torso').rotation.x = -0.25;
    r.j('hips').position.y -= 0.05;
  }
}

// ---------- the sea's own ----------

/** The prototype's Jelly: a pale cyan bell with a pink frill, two dark eyes, glowing trailing tentacles. It
 *  drifts at chest height (the foe's lift), pulsing; it squeezes before it lunges. */
export function makeJelly(): Model {
  const r = new Rig({ shadow: 0.75 });
  const body = '#8ff0ff', dark = '#3aa8c0', frill = '#e86a8a';
  r.joint('bell', 'root', 0, 0.05, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    r.joint('t' + i, 'bell', Math.cos(a) * 0.26, 0.02, Math.sin(a) * 0.26);
  }
  r.part('bell', (g, gl) => {
    g.blob(0, 0.08, 0, 0.44, 0.36, 0.44, body, 91, { detail: 1, jitter: 0.05, flatBottom: true });
    g.blob(0, 0.3, 0, 0.26, 0.16, 0.26, '#c8f8ff', 93, { jitter: 0.05 });
    g.cyl(0, -0.06, 0, 0.46, 0.4, 0.08, 12, frill);
    g.cyl(0, -0.1, 0, 0.36, 0.3, 0.06, 10, dark);
    for (const s of [-1, 1]) g.box(s * 0.13, 0.12, 0.38, 0.07, 0.08, 0.04, '#15132a');
    // Glowing spots on the bell, a glowing rim: it shows in the dark of the deep.
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      gl.box(Math.cos(a) * 0.2, 0.32, Math.sin(a) * 0.2, 0.06, 0.03, 0.06, [0.8, 2.6, 3.0]);
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      gl.box(Math.cos(a) * 0.44, -0.04, Math.sin(a) * 0.44, 0.05, 0.04, 0.05, [2.8, 0.9, 1.4]);
    }
  });
  for (let i = 0; i < 6; i++)
    r.part('t' + i, (g, gl) => {
      const len = i % 2 ? 0.75 : 0.6;
      g.box(0, -len, 0, 0.05, len, 0.05, i % 2 ? frill : body);
      g.box(0.03, -len * 0.6, 0.02, 0.04, len * 0.5, 0.04, dark);
      gl.box(0, -len - 0.06, 0, 0.06, 0.06, 0.06, [2.6, 1.0, 1.6]);
    });
  return new Model(r, jellyPose, 1);
}

function jellyPose(r: Rig, a: Anim) {
  const bell = r.j('bell');
  // The pulse: squeeze and open, faster as it closes in.
  const fast = a.name === 'windup' ? 3 : a.name === 'chase' ? 1.4 : 1;
  const k = Math.sin(a.time * 4.5 * fast + a.phase * 0.2);
  let sx = 1 + k * 0.08, sy = 1 - k * 0.1;
  if (a.name === 'windup') {
    const q = ease(seg(a.t, 0, 0.4));
    sx = mix(sx, 0.78, q);
    sy = mix(sy, 1.22, q);
  } else if (a.name === 'swoop') {
    sx = 1.15;
    sy = 0.8;
    bell.rotation.x = 0.55;
  } else if (a.name === 'stun') bell.rotation.z = Math.sin(a.time * 6) * 0.35;
  else if (a.name === 'hurt') bell.rotation.x = -0.4 * Math.max(0, 1 - a.t * 4);
  if (a.name === 'dead') {
    const q = easeOut(seg(a.t, 0, 0.6));
    sx = 1 + q * 0.4;
    sy = 1 - q * 0.75;
    bell.position.y -= q * 0.4;
  }
  bell.scale.set(sx, sy, sx);
  for (let i = 0; i < 6; i++) {
    const t = r.j('t' + i), w = a.time * 3 + i * 1.7;
    t.rotation.x = Math.sin(w) * 0.25 + (a.name === 'swoop' ? 1.0 : 0) - k * 0.15;
    t.rotation.z = Math.cos(w * 0.8) * 0.25;
  }
}

/** The crab: a red-orange shell, a great armoured claw it guards with (on its left) and a small one, six
 *  legs, eyes on stalks, a pale belly that shows when it's flipped. */
export function makeCrab(): Model {
  const r = new Rig({ shadow: 1.15 });
  const shell = '#ff5a2a', shellD = '#b83a1a', armour = '#e8481e', plate = '#ffa050', tip = '#fff0d0', belly = '#fff0d8';
  r.joint('body', 'root', 0, 0.34, 0);
  r.joint('clawL', 'body', 0.36, -0.04, 0.3);
  r.joint('pincerL', 'clawL', 0.1, 0.02, 0.36);
  r.joint('clawR', 'body', -0.36, -0.06, 0.28);
  for (let i = 0; i < 3; i++) {
    r.joint('legL' + i, 'body', 0.36, -0.06, 0.12 - i * 0.2);
    r.joint('legR' + i, 'body', -0.36, -0.06, 0.12 - i * 0.2);
  }
  r.part('body', (g, gl) => {
    g.blob(0, 0.02, 0, 0.52, 0.2, 0.4, shell, 101, { detail: 1, jitter: 0.06 });
    g.box(0, -0.16, 0, 0.82, 0.1, 0.58, shellD);
    g.box(0, -0.2, 0, 0.66, 0.05, 0.46, belly, { noBottom: false });
    // Spots and the ridge of the shell, the mouth.
    for (const [x, z, s] of [[-0.2, -0.05, 0.1], [0.18, 0.02, 0.12], [0, -0.2, 0.09], [0.05, 0.15, 0.07]] as const) g.box(x, 0.17, z, s, 0.05, s, plate);
    g.box(0, -0.06, 0.36, 0.28, 0.08, 0.05, '#5a1a10');
    // Eyes on stalks.
    for (const s of [-1, 1]) {
      g.beam([s * 0.1, 0.1, 0.3], [s * 0.14, 0.34, 0.34], 0.028, tip);
      g.box(s * 0.14, 0.32, 0.34, 0.09, 0.09, 0.09, '#141018');
      gl.box(s * 0.14 + 0.02, 0.39, 0.38, 0.03, 0.03, 0.01, [3, 3, 3]);
    }
  });
  // The armoured claw: an arm, a heavy plated hand, a pale-tipped pincer that opens.
  r.part('clawL', (g) => {
    g.beam([0, 0, 0], [0.08, 0.02, 0.2], 0.06, shellD);
    g.blob(0.08, 0.04, 0.32, 0.17, 0.14, 0.2, armour, 103, { jitter: 0.08 });
    g.box(0.08, 0.15, 0.3, 0.2, 0.05, 0.26, plate);
    g.box(0.02, -0.02, 0.5, 0.1, 0.1, 0.16, tip);
  });
  r.part('pincerL', (g) => {
    g.box(0, -0.04, 0.12, 0.08, 0.08, 0.26, armour);
    g.box(0, -0.04, 0.24, 0.07, 0.07, 0.08, tip);
  });
  r.part('clawR', (g) => {
    g.beam([0, 0, 0], [-0.06, 0.0, 0.18], 0.045, shellD);
    g.blob(-0.06, 0.02, 0.26, 0.1, 0.08, 0.13, armour, 105);
    g.box(-0.06, -0.01, 0.38, 0.07, 0.06, 0.1, tip);
  });
  for (let i = 0; i < 3; i++)
    for (const s of [1, -1]) {
      r.part((s > 0 ? 'legL' : 'legR') + i, (g) => {
        g.beam([0, 0, 0], [s * 0.26, 0.1, 0], 0.035, shell);
        g.beam([s * 0.26, 0.1, 0], [s * 0.4, -0.26, 0], 0.03, shellD);
        g.box(s * 0.4, -0.3, 0, 0.04, 0.06, 0.04, tip);
      });
    }
  return new Model(r, crabPose, 0.5);
}

function crabPose(r: Rig, a: Anim) {
  const body = r.j('body'), cl = r.j('clawL'), pl = r.j('pincerL'), cr = r.j('clawR');
  const sp = clamp(a.speed, 0, 1.3), s = Math.sin(a.phase * 2.2);
  // Scuttling: the legs on each side in turn.
  for (let i = 0; i < 3; i++) {
    const w = Math.sin(a.phase * 2.2 + i * 2.1);
    r.j('legL' + i).rotation.z = w * 0.45 * sp;
    r.j('legR' + i).rotation.z = -w * 0.45 * sp;
    r.j('legL' + i).rotation.y = Math.cos(a.phase * 2.2 + i * 2.1) * 0.3 * sp;
    r.j('legR' + i).rotation.y = Math.cos(a.phase * 2.2 + i * 2.1) * 0.3 * sp;
  }
  body.position.y += Math.abs(s) * 0.03 * sp + Math.sin(a.time * 2) * 0.01;
  body.rotation.z = s * 0.06 * sp;
  // On guard: the great claw held up before its face, the small one ready.
  cl.rotation.set(-0.35, -0.75, 0);
  cl.position.x -= 0.06;
  pl.rotation.y = 0.15 + Math.max(0, Math.sin(a.time * 3)) * 0.12;
  cr.rotation.set(-0.2, 0.3, 0);
  switch (a.name) {
    case 'windup': {
      // The claw goes up and opens wide.
      const k = ease(seg(a.t, 0, 0.35));
      cl.rotation.set(mix(-0.35, -1.25, k), mix(-0.75, -0.1, k), 0);
      pl.rotation.y = mix(0.15, 0.8, k);
      body.rotation.x = -0.15 * k;
      break;
    }
    case 'strike': {
      const k = easeOut(seg(a.t, 0, 0.08));
      cl.rotation.set(mix(-1.25, 0.15, k), mix(-0.1, 0.1, k), 0);
      pl.rotation.y = mix(0.8, 0, k);
      body.rotation.x = 0.12 * k;
      break;
    }
    case 'recover':
      // The claw still out in front, low: its guard is down.
      cl.rotation.set(0.15, 0.1, 0);
      pl.rotation.y = 0.05;
      break;
    case 'hurt':
      body.rotation.x = -0.25 * Math.max(0, 1 - a.t * 4);
      break;
    case 'stun':
    case 'dead': {
      // Flipped onto its back, legs waving (still, once dead).
      const k = easeOut(seg(a.t, 0, 0.25)), live = a.name === 'stun' ? 1 : 0;
      body.rotation.z = Math.PI * k;
      body.position.y += 0.1 * k + Math.sin(k * Math.PI) * 0.35;
      for (let i = 0; i < 3; i++) {
        r.j('legL' + i).rotation.z = 0.5 + Math.sin(a.time * 14 + i) * 0.5 * live;
        r.j('legR' + i).rotation.z = -0.5 - Math.sin(a.time * 14 + i + 1) * 0.5 * live;
      }
      cl.rotation.set(0.3, 0.2, Math.sin(a.time * 9) * 0.3 * live);
      if (a.name === 'stun' && a.t > 1.85) {
        // Rights itself.
        const q = ease(seg(a.t, 1.85, 2.2));
        body.rotation.z = Math.PI * (1 - q);
      }
      break;
    }
  }
}

/** The eel: a moray, green mottled with yellow, eyes glowing in the dark of its den (a ring of barnacled
 *  rock round a black hole, drawn where the den lies); its body runs back from its head into the den. */
export function makeEel(look: SeaLook): Model {
  const r = new Rig({ shadow: 0.6 });
  const skin = '#8ac83a', skinD = '#5a9a2a', mottle = '#f4e450', rock = '#6a6058', rockD = '#4a423a';
  r.joint('den', 'root', 0, 0, 0);
  r.joint('head', 'root', 0, 0.28, 0);
  r.joint('jaw', 'head', 0, -0.04, 0.05);
  for (let i = 0; i < 5; i++) r.joint('b' + i, 'root', 0, 0.22, -0.2 - i * 0.3);
  r.part('den', (g) => {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, d = 0.55 + (i % 3) * 0.06;
      g.blob(Math.cos(a) * d, 0.12, Math.sin(a) * d, 0.24, 0.2 + (i % 2) * 0.08, 0.22, i % 2 ? rock : rockD, 111 + i, { kind: K.Rock, flatBottom: true });
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      g.box(Math.cos(a) * 0.62, 0.3, Math.sin(a) * 0.62, 0.07, 0.05, 0.07, '#d8d0c0');
    }
    g.box(0, 0.01, 0, 0.82, 0.03, 0.82, '#06060a');
  });
  r.part('head', (g, gl) => {
    g.blob(0, 0, 0.14, 0.22, 0.19, 0.38, skin, 121, { jitter: 0.06 });
    g.box(0, 0.08, 0.14, 0.28, 0.07, 0.42, skinD);
    for (const [x, z] of [[-0.1, 0.02], [0.11, 0.22], [0.02, -0.12], [-0.12, 0.34], [0.12, -0.05]]) g.box(x, 0.16, z, 0.08, 0.03, 0.08, mottle);
    // The upper teeth.
    for (let i = 0; i < 5; i++) g.box(-0.1 + i * 0.05, -0.08, 0.42 - Math.abs(i - 2) * 0.04, 0.03, 0.07, 0.03, '#f0ece0');
    for (const s of [-1, 1]) gl.box(s * 0.14, 0.1, 0.32, 0.05, 0.06, 0.06, [3.2, 2.8, 0.4]);
  });
  r.part('jaw', (g) => {
    g.box(0, -0.1, 0.17, 0.26, 0.08, 0.38, skinD);
    for (let i = 0; i < 4; i++) g.box(-0.075 + i * 0.05, -0.03, 0.32, 0.03, 0.06, 0.03, '#f0ece0');
  });
  for (let i = 0; i < 5; i++)
    r.part('b' + i, (g) => {
      const w = 0.34 - i * 0.035;
      g.box(0, -w / 2, -0.5, w, w, 1, i % 2 ? skin : skinD);
      g.box(0, w / 2 - 0.01, -0.5, w * 0.4, 0.04, 0.9, mottle);
    });
  return new Model(r, (rig, a) => eelPose(rig, a, look), 1);
}

function eelPose(r: Rig, a: Anim, look: SeaLook) {
  const head = r.j('head'), jaw = r.j('jaw');
  // The den where it lies in the world, and the body from the head's neck back into it.
  const den = local(r, look.den.x, look.den.y, look.den.z).clone();
  r.j('den').position.copy(den);
  const hidden = clamp(1 - look.ext / 0.6, 0, 1);
  head.position.y -= hidden * 0.36;
  head.rotation.x = Math.sin(a.time * 2.5) * 0.08 - hidden * 0.3;
  head.rotation.y = Math.sin(a.time * 1.7) * 0.12 * (1 - hidden);
  jaw.rotation.x = 0.1 + Math.max(0, Math.sin(a.time * 3)) * 0.15;
  if (a.name === 'aim') jaw.rotation.x = 0.25 + Math.sin(a.time * 20) * 0.1;
  else if (a.name === 'strike') jaw.rotation.x = 0.7 * (1 - seg(a.t, 0.08, 0.2));
  else if (a.name === 'stun') head.rotation.z = Math.sin(a.time * 7) * 0.35;
  else if (a.name === 'dead') {
    head.rotation.z = easeOut(seg(a.t, 0, 0.4)) * 1.4;
    jaw.rotation.x = 0.5;
  }
  const nx = 0, ny = head.position.y - 0.06, nz = -0.18;
  const dx = den.x - nx, dz = den.z - nz, len = Math.hypot(dx, dz), n = 5;
  const ux = len > 1e-3 ? dx / len : 0, uz = len > 1e-3 ? dz / len : -1, part = len / n;
  for (let i = 0; i < n; i++) {
    const b = r.j('b' + i), k = i / n, wave = Math.sin(a.time * 6 - i * 1.3) * 0.08 * (1 - hidden) * Math.sin(k * Math.PI + 0.3);
    b.position.set(nx + ux * part * i - uz * wave, mix(ny, den.y + 0.12, k), nz + uz * part * i + ux * wave);
    b.rotation.set(0, Math.atan2(-ux, -uz), 0);
    b.scale.set(1, 1, Math.max(0.02, part + 0.04));
  }
}

/** The pufferfish: round, yellow with brown spots, big eyes, a pale belly. Swollen, it's a ball twice the
 *  size bristling with white spikes. */
export function makePuffer(): Model {
  const r = new Rig({ shadow: 0.6 });
  const skin = '#f0b030', spot = '#6a4418', belly = '#f6e8b8';
  r.joint('body', 'root', 0, 0.05, 0);
  r.joint('spikes', 'body', 0, 0, 0);
  r.joint('tail', 'body', 0, 0.02, -0.3);
  r.joint('finL', 'body', 0.26, 0, 0.04);
  r.joint('finR', 'body', -0.26, 0, 0.04);
  r.part('body', (g, gl) => {
    g.blob(0, 0, 0, 0.3, 0.27, 0.33, skin, 131, { detail: 1, jitter: 0.04 });
    g.blob(0, -0.1, 0.03, 0.24, 0.17, 0.27, belly, 133, { jitter: 0.04 });
    for (const [x, z] of [[-0.1, -0.1], [0.12, -0.04], [0, 0.08], [-0.15, 0.08], [0.1, -0.2], [0.16, 0.12]]) g.box(x, 0.24, z, 0.07, 0.05, 0.07, spot);
    for (const s of [-1, 1]) {
      g.box(s * 0.15, 0.08, 0.24, 0.13, 0.13, 0.1, '#f8f4ec');
      g.box(s * 0.16, 0.09, 0.29, 0.07, 0.08, 0.03, '#141018');
      gl.box(s * 0.14, 0.13, 0.305, 0.025, 0.025, 0.01, [3, 3, 3]);
    }
    g.box(0, -0.04, 0.32, 0.1, 0.07, 0.06, '#e0603a');
  });
  r.part('spikes', (g) => {
    for (let i = 0; i < 18; i++) {
      // Spread over the ball (a golden-angle spiral), pointing out.
      const y = 1 - (i + 0.5) / 9, rr = Math.sqrt(Math.max(0, 1 - y * y)), th = i * 2.4;
      if (y < -0.85) continue;
      const nx = Math.cos(th) * rr, nz = Math.sin(th) * rr;
      g.beam([nx * 0.26, y * 0.24, nz * 0.26], [nx * 0.48, y * 0.44, nz * 0.48], 0.03, i % 2 ? '#f4f0e0' : '#d8d0b8');
    }
  });
  r.part('tail', (g) => {
    g.box(0, -0.12, -0.12, 0.04, 0.26, 0.18, '#d89020');
    g.box(0, -0.05, -0.02, 0.06, 0.1, 0.08, skin);
  });
  r.part('finL', (g) => g.box(0.06, -0.04, 0, 0.12, 0.1, 0.03, '#d89020'));
  r.part('finR', (g) => g.box(-0.06, -0.04, 0, 0.12, 0.1, 0.03, '#d89020'));
  return new Model(r, pufferPose, 1);
}

/** How swollen a pufferfish is (0 small, 1 a spiky ball), from what it's doing. */
export function swelling(name: string, t: number, swellTime: number) {
  if (name === 'swell') return ease(seg(t, 0, swellTime));
  if (name === 'puffed') return 1;
  if (name === 'recover') return 1 - ease(seg(t, 0, 0.45));
  return 0;
}

function pufferPose(r: Rig, a: Anim) {
  const body = r.j('body'), k = swelling(a.name, a.t, FOES.puffer.windup);
  body.scale.setScalar(1 + 1.1 * k + (a.name === 'swell' ? Math.sin(a.time * 40) * 0.04 : 0));
  r.j('spikes').scale.setScalar(Math.max(1e-4, k));
  const sw = a.name === 'chase' || a.name === 'idle' || a.name === 'return' ? 1 : 0.4;
  r.j('tail').rotation.y = Math.sin(a.time * 9) * 0.5 * sw;
  r.j('finL').rotation.y = Math.sin(a.time * 14) * 0.6;
  r.j('finR').rotation.y = -Math.sin(a.time * 14) * 0.6;
  body.rotation.z = Math.sin(a.time * 1.6) * 0.08;
  if (a.name === 'recover' && a.t > 0.45) body.rotation.x = 0.25 + Math.sin(a.time * 3) * 0.08;
  if (a.name === 'hurt') body.rotation.x = -0.5 * Math.max(0, 1 - a.t * 4);
  if (a.name === 'stun') body.rotation.z = Math.sin(a.time * 7) * 0.4;
  if (a.name === 'dead') {
    body.rotation.z = easeOut(seg(a.t, 0, 0.5)) * Math.PI;
    body.position.y -= seg(a.t, 0, 0.8) * 0.3;
  }
}

/** The giant clam's colours (the prototype's lilac shells, pinker: under the water they turn blue). */
export const CLAM = { shell: '#d890c8', lid: '#f4c4ec', rib: '#a8609a', inside: '#7a2a5a' };

/** A giant clam's shell, the lower bowl or the lid: a fan of ribs from the hinge at its back (z -0.5) out to
 *  its mouth at the front (+z); the bowl holds the dark flesh the pearl lies on. */
export function clamShell(g: Geo, lid: boolean) {
  for (let i = 0; i < 7; i++) {
    const a = (i / 6 - 0.5) * 1.9, h = (lid ? 0.15 : 0.2) * (0.75 + 0.25 * Math.cos(a * 1.5));
    g.push().translate(0, 0, -0.5).rotateY(a);
    g.box(0, 0, 0.48, 0.3, h, 0.95, i % 2 ? (lid ? CLAM.lid : CLAM.shell) : CLAM.rib, { noBottom: false });
    g.pop();
  }
  if (!lid) g.blob(0, 0.2, -0.08, 0.5, 0.05, 0.36, CLAM.inside, 141, { jitter: 0.1 });
}
