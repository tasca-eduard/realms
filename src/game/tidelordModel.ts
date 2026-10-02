import { Rig } from '../engine/rig';
import type { Geo } from '../engine/geo';
import { K } from '../engine/materials';
import { clamp } from '../engine/util';
import { Model, type Anim } from './models';

// ---------------------------------------------------------------------------
// The Tidelord, the Sunken Reef's tyrant (the prototype drew him with the goblins' body): a goblin lord grown
// huge in the deep, his skin gone blue-green and crusted with barnacles, a crown of red coral, a cloak of kelp,
// a beard of weed, and a bronze trident green with age whose tines glow like the deep's own lights.
// ---------------------------------------------------------------------------

const C = {
  skin: '#3a8a8a',
  skinDark: '#25605e',
  skinLight: '#6ab8ae',
  scale: '#2a5a6a',
  barnacle: '#c8c2ac',
  coral: '#c8483a',
  coralD: '#9a3028',
  kelp: '#5a6a2a',
  kelpD: '#3e4a1c',
  bronze: '#5a8a6a',
  bronzeD: '#3a6450',
  pearl: '#e8e4f0',
  eye: [0.4, 2.6, 3.0] as [number, number, number],
  tine: [0.5, 2.2, 2.8] as [number, number, number],
};

const ease = (k: number) => k * k * (3 - 2 * k);
const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

export function makeTidelord(): Model {
  const r = new Rig({ shadow: 1.2 });
  r.joint('hips', 'root', 0, 0.6, 0);
  r.joint('legR', 'hips', -0.12, 0, 0);
  r.joint('legL', 'hips', 0.12, 0, 0);
  r.joint('torso', 'hips', 0, 0.02, 0);
  r.joint('head', 'torso', 0, 0.46, 0.08);
  r.joint('cloak', 'torso', 0, 0.44, -0.16);
  r.joint('armR', 'torso', -0.3, 0.4, 0.02);
  r.joint('handR', 'armR', 0, -0.5, 0);
  r.joint('armL', 'torso', 0.3, 0.4, 0.02);
  r.joint('handL', 'armL', 0, -0.5, 0);
  const barnacles = (g: Geo, pts: [number, number, number][]) => {
    for (const [x, y, z] of pts) g.cyl(x, y, z, 0.035, 0.02, 0.035, 5, C.barnacle, { kind: K.Rock });
  };
  const leg = (g: Geo) => {
    g.box(0, -0.6, 0, 0.14, 0.6, 0.15, C.skinDark);
    g.box(0, -0.6, 0.06, 0.18, 0.08, 0.26, C.skinDark);
    // Webbed toes.
    for (const s of [-1, 0, 1]) g.box(s * 0.06, -0.6, 0.2, 0.04, 0.04, 0.08, C.skin);
    barnacles(g, [[0.06, -0.3, 0.07], [-0.05, -0.45, 0.07]]);
  };
  r.part('legR', leg);
  r.part('legL', leg);
  r.part('hips', (g) => {
    // A kilt of fish scales, a belt with a pearl clasp.
    g.box(0, -0.3, 0, 0.44, 0.34, 0.3, C.scale, { kind: K.Metal });
    for (let i = 0; i < 6; i++) g.box(-0.2 + i * 0.08, -0.42, 0.14, 0.06, 0.14, 0.03, i % 2 ? C.scale : C.bronzeD);
    g.box(0, -0.08, 0, 0.48, 0.07, 0.32, C.bronzeD, { kind: K.Metal });
    g.box(0, -0.1, 0.16, 0.08, 0.08, 0.03, C.pearl);
  });
  r.part('torso', (g) => {
    g.box(0, 0, 0, 0.5, 0.48, 0.34, C.skin);
    g.box(0, 0.06, 0.12, 0.3, 0.3, 0.1, C.skinLight);
    // Shoulder plates of a great shell, barnacled.
    for (const s of [-1, 1]) {
      g.blob(s * 0.3, 0.42, 0, 0.18, 0.1, 0.2, C.bronze, 41 + s, { kind: K.Metal });
      barnacles(g, [[s * 0.33, 0.5, 0.06], [s * 0.26, 0.48, -0.08]]);
    }
    barnacles(g, [[0.12, 0.2, 0.17], [-0.16, 0.08, 0.17], [0.04, 0.32, 0.17]]);
  });
  r.part('cloak', (g) => {
    // Kelp, hanging in strands to his heels and waving with the swell.
    for (let i = 0; i < 7; i++) {
      const x = -0.27 + i * 0.09, l = 0.95 + (i % 3) * 0.12;
      g.box(x, -l, 0, 0.08, l, 0.04, i % 2 ? C.kelp : C.kelpD, { kind: K.Leaves, wind: 0.6 });
    }
  });
  r.part('head', (g, gl) => {
    g.box(0, 0, 0, 0.48, 0.38, 0.42, C.skin);
    g.box(0, 0.1, 0.22, 0.12, 0.13, 0.1, C.skinDark);
    g.box(0, 0.0, 0.215, 0.26, 0.05, 0.02, '#0e1a1c');
    for (const s of [-1, 1]) g.box(s * 0.08, -0.01, 0.22, 0.04, 0.06, 0.02, '#e8e0c8');
    // Fin-ears, swept back.
    for (const s of [-1, 1]) {
      g.push().translate(s * 0.24, 0.18, -0.04).rotateZ(s * -0.35);
      g.box(s * 0.14, -0.08, 0, 0.3, 0.16, 0.06, C.skinDark);
      for (let k = 0; k < 3; k++) g.box(s * (0.06 + k * 0.08), -0.02, 0.0, 0.02, 0.14, 0.07, C.skinLight);
      g.pop();
    }
    g.box(0, 0.27, 0.19, 0.4, 0.05, 0.04, C.skinDark);
    for (const s of [-1, 1]) gl.box(s * 0.1, 0.19, 0.212, 0.06, 0.045, 0.01, C.eye);
    // A beard of weed.
    for (let i = 0; i < 5; i++) g.box(-0.14 + i * 0.07, -0.26 - (i % 2) * 0.06, 0.18, 0.05, 0.26 + (i % 2) * 0.06, 0.04, i % 2 ? C.kelp : C.kelpD, { kind: K.Leaves, wind: 0.4 });
    // A crown of red coral.
    g.box(0, 0.36, 0, 0.42, 0.06, 0.38, C.bronzeD, { kind: K.Metal });
    for (const [x, z, h] of [[-0.17, 0.12, 0.32], [0.17, 0.12, 0.3], [0, 0.17, 0.42], [-0.15, -0.12, 0.26], [0.15, -0.12, 0.28]]) {
      g.beam([x, 0.4, z], [x * 1.3, 0.4 + h, z], 0.035, C.coral);
      g.beam([x * 1.15, 0.4 + h * 0.55, z], [x * 1.15 + (x > 0 ? 0.1 : -0.1), 0.4 + h * 0.8, z], 0.025, C.coralD);
    }
    gl.box(0, 0.42, 0.2, 0.07, 0.07, 0.02, [2.6, 2.4, 2.8]);
  });
  const arm = (g: Geo) => {
    g.box(0, -0.5, 0, 0.13, 0.5, 0.14, C.skin);
    g.box(0, -0.56, 0, 0.16, 0.12, 0.16, C.skinDark);
    g.box(0, -0.2, 0, 0.17, 0.08, 0.17, C.bronzeD, { kind: K.Metal });
  };
  r.part('armR', arm);
  r.part('armL', arm);
  r.part('handR', (g, gl) => {
    // The trident: a long bronze shaft, a crossbar, three barbed tines that glow.
    g.box(0, -1.55, 0, 0.06, 2.6, 0.06, C.bronze, { kind: K.Metal });
    g.push().translate(0, 1.05, 0);
    g.box(0, 0, 0, 0.5, 0.07, 0.07, C.bronzeD, { kind: K.Metal });
    for (const s of [-1, 0, 1]) {
      g.box(s * 0.22, 0, 0, 0.05, s ? 0.42 : 0.55, 0.05, C.bronze, { kind: K.Metal });
      gl.box(s * 0.22, s ? 0.36 : 0.48, 0, 0.07, 0.12, 0.07, C.tine);
    }
    g.pop();
    // A pearl set where the shaft meets the tines.
    gl.box(0, 0.97, 0, 0.1, 0.1, 0.1, [1.6, 1.7, 2.0]);
  });
  const m = new Model(r, tidelordPose, 1.0);
  r.scale = 2.0;
  return m;
}

function tidelordPose(r: Rig, a: Anim) {
  const sp = clamp(a.speed, 0, 1.2), s = Math.sin(a.phase);
  // Holding the trident upright at his side; the cloak and beard drifting with the swell.
  r.j('armR').rotation.x = -0.35;
  r.j('handR').rotation.x = 0.35;
  r.j('armL').rotation.z = 0.25;
  r.j('cloak').rotation.x = -0.1 - sp * 0.35 + Math.sin(a.time * 1.4) * 0.08;
  r.j('legR').rotation.x = s * 0.7 * sp;
  r.j('legL').rotation.x = -s * 0.7 * sp;
  r.j('armL').rotation.x = s * 0.4 * sp;
  r.j('hips').position.y += Math.abs(Math.cos(a.phase)) * 0.08 * sp + Math.sin(a.time * 1.6) * 0.02;
  r.j('torso').rotation.x = 0.2 + 0.12 * sp;
  r.j('head').rotation.x = -0.12;
  switch (a.name) {
    case 'sleep':
      // Slumped on his throne, the trident across his knees, his beard stirring as he breathes.
      r.j('hips').position.y = 0.42;
      r.j('legR').rotation.x = -1.45;
      r.j('legL').rotation.x = -1.35;
      r.j('torso').rotation.x = 0.28 + Math.sin(a.time * 1.1) * 0.04;
      r.j('head').rotation.x = 0.45;
      r.j('armR').rotation.x = -0.9;
      r.j('handR').rotation.set(0.2, 0, 1.4);
      r.j('armL').rotation.x = -0.7;
      break;
    case 'wake': {
      const k = ease(seg(a.t, 0, 0.7));
      r.j('hips').position.y = mix(0.42, 0.6, k);
      r.j('legR').rotation.x = -1.45 * (1 - k);
      r.j('legL').rotation.x = -1.35 * (1 - k);
      r.j('head').rotation.x = mix(0.45, -0.45, k);
      // The trident raised high as he rises.
      r.j('armR').rotation.x = mix(-0.9, -2.9, seg(a.t, 0.5, 1.1));
      r.j('armL').rotation.x = mix(-0.7, -2.4, seg(a.t, 0.6, 1.2));
      break;
    }
    case 'windup': {
      // The sweep, drawn back.
      const k = ease(seg(a.t, 0, 0.45));
      r.j('torso').rotation.y = 0.7 * k;
      r.j('armR').rotation.x = mix(-0.35, -1.6, k);
      r.j('armR').rotation.z = -0.6 * k;
      r.j('handR').rotation.x = mix(0.35, 1.2, k);
      r.j('hips').position.y -= 0.06 * k;
      break;
    }
    case 'strike': {
      // ...and swept round in front of him.
      const k = easeOut(seg(a.t, 0, 0.12));
      r.j('torso').rotation.y = mix(0.7, -0.8, k);
      r.j('armR').rotation.x = -1.5;
      r.j('armR').rotation.z = mix(-0.6, 0.5, k);
      r.j('handR').rotation.x = 1.3;
      r.j('torso').rotation.x = 0.35;
      break;
    }
    case 'paw':
      // The charge, coming: crouched low, the trident levelled at the knight like a lance.
      r.j('hips').position.y -= 0.12;
      r.j('torso').rotation.x = 0.65;
      r.j('head').rotation.x = -0.5;
      r.j('armR').rotation.x = -1.2;
      r.j('handR').rotation.x = 1.5;
      r.j('legR').rotation.x = -0.5 + Math.sin(a.t * 12) * 0.12;
      r.j('legL').rotation.x = 0.4;
      break;
    case 'charge':
      r.j('torso').rotation.x = 0.85;
      r.j('head').rotation.x = -0.6;
      r.j('armR').rotation.x = -1.35;
      r.j('handR').rotation.x = 1.55;
      r.j('armL').rotation.x = 0.7;
      r.j('legR').rotation.x = Math.sin(a.time * 14) * 0.8;
      r.j('legL').rotation.x = -Math.sin(a.time * 14) * 0.8;
      break;
    case 'chant': {
      // Drowning orbs: the trident raised high, the free hand beckoning the water.
      const k = ease(seg(a.t, 0, 0.3));
      r.j('armR').rotation.x = mix(-0.35, -3.0, k);
      r.j('handR').rotation.x = mix(0.35, 0, k);
      r.j('armL').rotation.x = -1.4 * k + Math.sin(a.time * 6) * 0.15;
      r.j('armL').rotation.z = 0.6;
      r.j('torso').rotation.x = mix(0.2, -0.2, k);
      r.j('head').rotation.x = -0.4 * k;
      break;
    }
    case 'jump': {
      // The slam: a crouch, then up with both hands on the trident over his head.
      const k = seg(a.t, 0, 0.35);
      r.j('hips').position.y -= 0.18 * k * (a.t < 0.4 ? 1 : 0);
      r.j('legR').rotation.x = a.t < 0.4 ? -0.9 * k : -0.5;
      r.j('legL').rotation.x = a.t < 0.4 ? -0.7 * k : 0.3;
      r.j('armR').rotation.x = -3.0 * k;
      r.j('armL').rotation.x = -2.8 * k;
      r.j('handR').rotation.x = 0;
      r.j('torso').rotation.x = -0.2 * k;
      break;
    }
    case 'slam': {
      const k = easeOut(seg(a.t, 0, 0.1));
      r.j('armR').rotation.x = mix(-3.0, -0.9, k);
      r.j('armL').rotation.x = mix(-2.8, -0.8, k);
      r.j('handR').rotation.x = mix(0, 1.2, k);
      r.j('torso').rotation.x = mix(-0.2, 0.75, k);
      r.j('hips').position.y -= 0.16 * k;
      r.j('legR').rotation.x = -0.6 * k;
      r.j('legL').rotation.x = 0.5 * k;
      break;
    }
    case 'summon': {
      // "Crew! To me!": arms flung wide, the trident shaken.
      const k = ease(seg(a.t, 0, 0.3));
      r.j('armR').rotation.x = -2.4 * k;
      r.j('armR').rotation.z = -0.5 * k;
      r.j('armL').rotation.z = 1.4 * k;
      r.j('head').rotation.x = -0.5 * k;
      r.j('hips').position.y += Math.abs(Math.sin(a.t * 9)) * 0.05;
      break;
    }
    case 'stun':
      // Dazed against the wall he ran into.
      r.j('hips').position.y = 0.4;
      r.j('legR').rotation.x = -1.3;
      r.j('legL').rotation.x = -1.1;
      r.j('torso').rotation.x = -0.25;
      r.j('head').rotation.z = Math.sin(a.time * 5) * 0.35;
      r.j('armR').rotation.z = -0.8;
      r.j('armL').rotation.z = 0.8;
      break;
    case 'dead': {
      const k = easeOut(seg(a.t, 0, 0.6));
      r.j('hips').rotation.x = -1.45 * k;
      r.j('hips').position.y = mix(0.6, 0.24, k);
      r.j('armR').rotation.z = -0.9 * k;
      r.j('armL').rotation.z = 0.9 * k;
      r.j('head').rotation.x = -0.4 * k;
      break;
    }
  }
}
