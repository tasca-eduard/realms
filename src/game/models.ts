import { Rig } from '../engine/rig';
import type { Geo } from '../engine/geo';
import { K } from '../engine/materials';
import { clamp } from '../engine/util';
import { LOOKS, type Look } from './assets';

// Character models built from boxes, animated procedurally.
// Joint convention: local forward +z, up +y, right hand on -x.
// rotation.x > 0 swings a hanging limb backward / leans a torso forward.

export interface Anim {
  name: string;
  t: number;
  time: number;
  speed: number;
  phase: number;
  /** Knight swing index or similar variant. */
  v?: number;
  dur?: number;
}

type PoseFn = (r: Rig, a: Anim) => void;

const ease = (k: number) => k * k * (3 - 2 * k);
const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

export class Model {
  phase = 0;
  speed = 0;
  private lx = NaN;
  private lz = NaN;
  constructor(public rig: Rig, private poseFn: PoseFn, private stride = 1.1) {
    rig.build();
  }

  animate(dt: number, x: number, z: number, name: string, t: number, time: number, extra: Partial<Anim> = {}) {
    if (!Number.isNaN(this.lx) && dt > 0) {
      const d = Math.hypot(x - this.lx, z - this.lz);
      const v = d / dt;
      this.speed += (clamp(v / 4.5, 0, 1.3) - this.speed) * Math.min(1, dt * 12);
      this.phase += (d / this.stride) * Math.PI;
    }
    this.lx = x;
    this.lz = z;
    this.rig.reset();
    this.poseFn(this.rig, { name, t, time, speed: this.speed, phase: this.phase, ...extra });
  }
}

// ---------- shared humanoid gait ----------

function gait(r: Rig, a: Anim, o: { leg?: number; arm?: number; bob?: number; lean?: number; hunch?: number } = {}) {
  const s = Math.sin(a.phase), sp = clamp(a.speed, 0, 1.2);
  const leg = (o.leg ?? 0.85) * sp, arm = (o.arm ?? 0.6) * sp;
  r.j('legR').rotation.x = s * leg;
  r.j('legL').rotation.x = -s * leg;
  r.j('armR').rotation.x += -s * arm;
  r.j('armL').rotation.x += s * arm;
  r.j('hips').position.y += Math.abs(Math.cos(a.phase)) * (o.bob ?? 0.07) * sp - 0.03 * sp;
  r.j('torso').rotation.x += (o.lean ?? 0.14) * sp + (o.hunch ?? 0);
  r.j('torso').rotation.y += s * 0.12 * sp;
  // Breathing when still.
  const br = Math.sin(a.time * 2.2) * (1 - Math.min(1, sp * 3));
  r.j('torso').position.y += br * 0.012;
  r.j('head').rotation.x += br * 0.03;
}

function fallDown(r: Rig, a: Anim, hipH: number) {
  const k = easeOut(seg(a.t, 0, 0.45));
  r.j('hips').rotation.x = -1.45 * k;
  r.j('hips').position.y = mix(hipH, 0.22, k);
  r.j('armR').rotation.z = -0.9 * k;
  r.j('armL').rotation.z = 0.9 * k;
  r.j('legR').rotation.x = -0.3 * k;
  r.j('head').rotation.x = -0.4 * k;
}

// ---------- the knight ----------

const KN = {
  light: '#c9d3e6',
  mid: '#8f9bb6',
  dark: '#5b6584',
  blue: '#2c62b0',
  blueDark: '#1e4178',
  gold: '#feae34',
  red: '#e43b44',
  blade: '#eef2fa',
  boot: '#3a3450',
};

export function makeKnight(silhouette = true): Model {
  const r = new Rig({ silhouette, shadow: 0.85 });
  r.joint('hips', 'root', 0, 0.95, 0);
  r.joint('legR', 'hips', -0.12, 0, 0);
  r.joint('legL', 'hips', 0.12, 0, 0);
  r.joint('torso', 'hips', 0, 0.04, 0);
  r.joint('head', 'torso', 0, 0.6, 0.01);
  r.joint('cape', 'torso', 0, 0.56, -0.17);
  r.joint('armR', 'torso', -0.31, 0.5, 0);
  r.joint('handR', 'armR', 0, -0.56, 0.02);
  r.joint('armL', 'torso', 0.31, 0.5, 0);
  r.joint('handL', 'armL', 0, -0.5, 0);

  const leg = (g: Geo) => {
    g.box(0, -0.95, 0, 0.17, 0.95, 0.2, KN.mid);
    g.box(0, -0.52, 0.015, 0.19, 0.12, 0.2, KN.light);
    g.box(0, -0.95, 0.03, 0.19, 0.17, 0.27, KN.boot);
  };
  r.part('legR', leg);
  r.part('legL', leg);
  r.part('hips', (g) => {
    g.box(0, -0.22, 0, 0.46, 0.28, 0.3, KN.dark);
    g.box(0, -0.3, 0.1, 0.26, 0.34, 0.12, KN.blue);
  });
  r.part('torso', (g) => {
    g.box(0, 0, 0, 0.46, 0.6, 0.3, KN.light);
    g.box(0, -0.02, 0.1, 0.34, 0.58, 0.12, KN.blue);
    g.box(0, 0.24, 0.155, 0.08, 0.16, 0.02, KN.gold);
    g.box(0, 0.3, 0.155, 0.2, 0.05, 0.02, KN.gold);
    g.box(0, 0.02, 0, 0.48, 0.07, 0.32, KN.gold);
    for (const s of [-1, 1]) g.box(s * 0.27, 0.42, 0, 0.2, 0.15, 0.3, KN.light);
  });
  r.part('cape', (g) => {
    g.box(0, -0.88, 0, 0.44, 0.88, 0.05, KN.blueDark);
  });
  r.part('head', (g, gl) => {
    g.box(0, 0, 0, 0.32, 0.35, 0.34, KN.light);
    g.box(0, 0.13, 0.171, 0.24, 0.05, 0.01, '#0a0a14');
    g.box(0, 0.0, 0.172, 0.05, 0.28, 0.02, KN.mid);
    g.box(0, 0.35, -0.05, 0.07, 0.11, 0.3, KN.red);
    g.box(0, 0.24, -0.25, 0.07, 0.2, 0.1, KN.red);
    gl.box(0, 0.13, 0.178, 0.12, 0.02, 0.005, [0.6, 0.8, 1.6]);
  });
  const arm = (g: Geo) => {
    g.box(0, -0.5, 0, 0.13, 0.5, 0.14, KN.mid);
    g.box(0, -0.62, 0, 0.15, 0.15, 0.16, KN.dark);
  };
  r.part('armR', arm);
  r.part('armL', arm);
  r.part('handR', (g) => {
    g.box(0, -0.12, 0, 0.05, 0.2, 0.05, '#4a3424');
    g.box(0, 0.06, 0, 0.07, 0.07, 0.07, KN.gold);
    g.box(0, -0.16, 0, 0.26, 0.05, 0.07, KN.gold);
    g.box(0, -1.08, 0, 0.065, 0.92, 0.03, KN.blade);
    g.box(0, -1.08, 0.016, 0.02, 0.9, 0.005, '#b8c4dc');
  });
  r.part('handL', (g) => {
    // Kite shield strapped on the forearm, facing outward (+x).
    g.box(0.1, -0.35, 0, 0.05, 0.55, 0.46, KN.blue);
    g.box(0.1, -0.52, 0, 0.05, 0.2, 0.3, KN.blue);
    g.box(0.11, -0.4, 0, 0.05, 0.45, 0.07, KN.gold);
    g.box(0.11, -0.2, 0, 0.05, 0.07, 0.34, KN.gold);
    g.box(0.12, 0.18, 0, 0.04, 0.04, 0.48, KN.gold);
  });
  return new Model(r, knightPose, 1.25);
}

function knightIdleArms(r: Rig) {
  r.j('armR').rotation.x = -0.35;
  r.j('armR').rotation.z = -0.12;
  r.j('handR').rotation.x = -1.15;
  r.j('armL').rotation.x = -0.25;
  r.j('armL').rotation.z = 0.2;
}

function knightPose(r: Rig, a: Anim) {
  const cape = r.j('cape');
  cape.rotation.x = -0.1 - a.speed * 0.5 - Math.sin(a.time * 3) * 0.04;
  switch (a.name) {
    case 'idle':
    case 'run':
      knightIdleArms(r);
      gait(r, a, { arm: 0.5 });
      break;
    case 'attack0':
    case 'attack1': {
      // Horizontal slashes: forehand right-to-left, then backhand.
      const dur = a.dur ?? 0.34;
      const k = a.t / dur;
      const wind = ease(seg(k, 0, 0.22)), sw = easeOut(seg(k, 0.24, 0.55)), back = ease(seg(k, 0.7, 1));
      const fore = a.name === 'attack0';
      const y0 = fore ? -1.5 : 1.3, y1 = fore ? 1.25 : -1.45;
      const arm = r.j('armR');
      arm.rotation.x = mix(-0.35, fore ? -1.55 : -1.4, wind) * (1 - back) + -0.35 * back;
      arm.rotation.y = mix(mix(0, y0, wind), y1, sw) * (1 - back);
      r.j('handR').rotation.x = mix(-1.15, -0.1, wind) * (1 - back) + -1.15 * back;
      r.j('torso').rotation.y = mix(mix(0, fore ? -0.55 : 0.5, wind), fore ? 0.55 : -0.5, sw) * (1 - back);
      r.j('torso').rotation.x = 0.15 * sw * (1 - back);
      r.j('armL').rotation.x = -0.4;
      r.j('armL').rotation.z = 0.35;
      r.j('legR').rotation.x = -0.35 * wind;
      r.j('legL').rotation.x = 0.3 * wind;
      r.j('hips').position.y -= 0.06 * wind;
      break;
    }
    case 'attack2': {
      // Overhead finisher with a small hop.
      const dur = a.dur ?? 0.42;
      const k = a.t / dur;
      const wind = ease(seg(k, 0, 0.3)), sw = easeOut(seg(k, 0.3, 0.52)), back = ease(seg(k, 0.75, 1));
      const arm = r.j('armR');
      arm.rotation.x = mix(mix(-0.35, -3.0, wind), -0.55, sw) * (1 - back) + -0.35 * back;
      arm.rotation.y = -0.25 * (1 - back);
      r.j('armL').rotation.x = mix(-0.25, -2.6, wind) * (1 - sw) + -0.3 * sw;
      r.j('handR').rotation.x = mix(-1.15, -0.2, wind) * (1 - back) + -1.15 * back;
      r.j('torso').rotation.x = mix(-0.25 * wind, 0.45, sw) * (1 - back);
      r.j('hips').position.y += Math.sin(seg(k, 0.1, 0.5) * Math.PI) * 0.25 - 0.12 * sw * (1 - back);
      r.j('legR').rotation.x = -0.6 * sw * (1 - back);
      r.j('legL').rotation.x = 0.45 * sw * (1 - back);
      break;
    }
    case 'roll': {
      const k = clamp(a.t / (a.dur ?? 0.36), 0, 1);
      const hips = r.j('hips');
      hips.rotation.x = ease(k) * Math.PI * 2;
      hips.position.y = mix(0.95, 0.5, Math.sin(k * Math.PI));
      const tuck = Math.sin(k * Math.PI);
      r.j('legR').rotation.x = -1.6 * tuck;
      r.j('legL').rotation.x = -1.4 * tuck;
      r.j('armR').rotation.x = -1.2 * tuck;
      r.j('armL').rotation.x = -1.2 * tuck;
      r.j('handR').rotation.x = -1.15;
      r.j('head').rotation.x = 0.4 * tuck;
      cape.rotation.x = -0.3;
      break;
    }
    case 'block':
    case 'blockHit': {
      const hit = a.name === 'blockHit' ? Math.max(0, 1 - a.t * 5) : 0;
      r.j('armL').rotation.x = -1.25;
      r.j('armL').rotation.y = -1.05;
      r.j('armR').rotation.x = -0.2;
      r.j('armR').rotation.z = -0.3;
      r.j('handR').rotation.x = -1.4;
      r.j('hips').position.y -= 0.08;
      r.j('legR').rotation.x = 0.25;
      r.j('legL').rotation.x = -0.25;
      r.j('torso').rotation.x = 0.08 - hit * 0.3;
      r.j('torso').rotation.y = -0.2;
      gait(r, { ...a, speed: a.speed * 0.5 }, { arm: 0 });
      break;
    }
    case 'hurt': {
      const k = Math.max(0, 1 - a.t * 3);
      knightIdleArms(r);
      r.j('torso').rotation.x = -0.4 * k;
      r.j('head').rotation.x = -0.3 * k;
      r.j('armR').rotation.z = -0.7 * k;
      r.j('armL').rotation.z = 0.7 * k;
      break;
    }
    case 'dead':
      knightIdleArms(r);
      fallDown(r, a, 0.95);
      break;
    case 'drink': {
      const k = ease(seg(a.t, 0, 0.3)) * (1 - ease(seg(a.t, 0.7, 0.9)));
      knightIdleArms(r);
      r.j('armL').rotation.x = -2.3 * k;
      r.j('armL').rotation.y = -0.9 * k;
      r.j('head').rotation.x = -0.3 * k;
      break;
    }
    case 'rest': {
      const k = ease(seg(a.t, 0, 0.5));
      r.j('hips').position.y = mix(0.95, 0.55, k);
      r.j('legR').rotation.x = -1.45 * k;
      r.j('legL').rotation.x = 0.9 * k;
      r.j('torso').rotation.x = 0.15 * k;
      r.j('armR').rotation.x = -0.9 * k;
      r.j('handR').rotation.x = 0.4 * k;
      r.j('armL').rotation.x = -0.2;
      r.j('armL').rotation.z = 0.2;
      r.j('head').rotation.x = 0.35 * k;
      break;
    }
    case 'fall':
      knightIdleArms(r);
      r.j('armR').rotation.z = -0.6;
      r.j('armL').rotation.z = 0.6;
      r.j('legR').rotation.x = -0.4;
      r.j('legL').rotation.x = 0.2;
      break;
    case 'dazed': {
      // Reeling: head lolls, arms drop, knees buckle.
      knightIdleArms(r);
      const w = Math.sin(a.time * 9);
      r.j('head').rotation.z = w * 0.3;
      r.j('head').rotation.x = 0.25;
      r.j('torso').rotation.z = -w * 0.12;
      r.j('torso').rotation.x = 0.2;
      r.j('armR').rotation.x = 0.1;
      r.j('armL').rotation.x = 0.1;
      r.j('armL').rotation.y = 0;
      r.j('hips').position.y -= 0.1;
      r.j('legR').rotation.x = -0.25;
      r.j('legL').rotation.x = 0.2;
      break;
    }
    case 'down': {
      // Knocked flat on the back, then scrambling up.
      knightIdleArms(r);
      const dur = a.dur ?? 0.85;
      const fall = easeOut(seg(a.t, 0, 0.18)), rise = ease(seg(a.t, dur - 0.3, dur));
      const k = fall * (1 - rise);
      r.j('hips').rotation.x = -1.45 * k;
      r.j('hips').position.y = mix(0.95, 0.22, k);
      r.j('armR').rotation.z = -0.9 * k;
      r.j('armL').rotation.z = 0.9 * k;
      r.j('legR').rotation.x = -0.5 * k;
      r.j('head').rotation.x = -0.4 * k;
      break;
    }
    case 'charge': {
      // Sword drawn back low, weight down, ready to whirl.
      const k = ease(seg(a.t, 0, 0.2));
      r.j('hips').position.y -= 0.12 * k;
      r.j('torso').rotation.y = -0.6 * k;
      r.j('torso').rotation.x = 0.2 * k;
      r.j('armR').rotation.x = 0.5 * k - 0.35 * (1 - k);
      r.j('armR').rotation.y = -0.7 * k;
      r.j('handR').rotation.x = mix(-1.15, -0.4, k);
      r.j('armL').rotation.x = -0.5;
      r.j('armL').rotation.z = 0.5;
      r.j('legR').rotation.x = 0.35 * k;
      r.j('legL').rotation.x = -0.35 * k;
      r.j('head').rotation.x += Math.sin(a.time * 30) * 0.02 * k;
      break;
    }
    case 'spin':
      // Sword held straight out to the side; the body turns in player.ts.
      r.j('armR').rotation.x = -1.57;
      r.j('armR').rotation.y = -1.45;
      r.j('handR').rotation.x = -0.05;
      r.j('armL').rotation.x = -1.2;
      r.j('armL').rotation.y = 1.2;
      r.j('hips').position.y -= 0.1;
      r.j('legR').rotation.z = 0.25;
      r.j('legL').rotation.z = -0.25;
      break;
    case 'stab':
      // Falling, sword pointing straight down.
      r.j('armR').rotation.x = 0.05;
      r.j('handR').rotation.x = 0;
      r.j('armL').rotation.x = -2.2;
      r.j('armL').rotation.z = 0.4;
      r.j('legR').rotation.x = -0.9;
      r.j('legL').rotation.x = -0.6;
      r.j('torso').rotation.x = 0.3;
      r.j('head').rotation.x = 0.4;
      cape.rotation.x = -1.2;
      break;
    case 'land': {
      const k = 1 - seg(a.t, 0, 0.28);
      r.j('hips').position.y -= 0.35 * k;
      r.j('armR').rotation.x = 0.2;
      r.j('handR').rotation.x = 0.1;
      r.j('legR').rotation.x = -0.8 * k;
      r.j('legL').rotation.x = 0.6 * k;
      r.j('torso').rotation.x = 0.5 * k;
      break;
    }
    case 'ride':
    case 'rideAtk': {
      // Astride the warhorse: legs either side, reins in the shield hand.
      r.j('legR').rotation.x = -0.45;
      r.j('legL').rotation.x = -0.45;
      r.j('legR').rotation.z = -0.55;
      r.j('legL').rotation.z = 0.55;
      r.j('armL').rotation.x = -0.9;
      r.j('armL').rotation.y = -0.4;
      r.j('torso').rotation.x = 0.1 + a.speed * 0.15;
      cape.rotation.x = -0.4 - a.speed * 0.6;
      if (a.name === 'ride') {
        r.j('armR').rotation.x = -0.5;
        r.j('armR').rotation.z = -0.2;
        r.j('handR').rotation.x = -1.1;
      } else {
        const k = clamp(a.t / (a.dur ?? 0.35), 0, 1);
        const w = ease(seg(k, 0, 0.3)), sw = easeOut(seg(k, 0.3, 0.6));
        r.j('armR').rotation.x = mix(-0.5, -1.5, w);
        r.j('armR').rotation.y = mix(mix(0, -1.4, w), 1.2, sw);
        r.j('handR').rotation.x = mix(-1.1, -0.1, w);
        r.j('torso').rotation.y = mix(-0.4 * w, 0.5, sw);
      }
      break;
    }
    case 'dash':
    case 'airdash':
      r.j('torso').rotation.x = 0.55;
      r.j('armR').rotation.x = -1.55;
      r.j('armR').rotation.y = 0.15;
      r.j('handR').rotation.x = -0.05;
      r.j('armL').rotation.x = 0.6;
      r.j('legR').rotation.x = -0.5;
      r.j('legL').rotation.x = 0.8;
      cape.rotation.x = -1.3;
      break;
  }
}

// ---------- goblins ----------

/** The goblins' colours (switched per realm, see setFoePalette). */
const GOB = { skin: '#5a9e3a', skinDark: '#3b6b2a', skinLight: '#8ccf5a', cloth: '#733e39', clothDark: '#4a2622', leather: '#6a4a2a', eye: [1.5, 1.1, 0.2] as [number, number, number] };

function goblinBody(r: Rig, opts: { king?: boolean } = {}) {
  r.joint('hips', 'root', 0, 0.55, 0);
  r.joint('legR', 'hips', -0.1, 0, 0);
  r.joint('legL', 'hips', 0.1, 0, 0);
  r.joint('torso', 'hips', 0, 0.02, 0);
  r.joint('head', 'torso', 0, 0.4, 0.07);
  r.joint('armR', 'torso', -0.24, 0.36, 0.02);
  r.joint('handR', 'armR', 0, -0.44, 0);
  r.joint('armL', 'torso', 0.24, 0.36, 0.02);
  r.joint('handL', 'armL', 0, -0.44, 0);
  const leg = (g: Geo) => {
    g.box(0, -0.55, 0, 0.11, 0.55, 0.12, GOB.skinDark);
    g.box(0, -0.55, 0.05, 0.14, 0.08, 0.22, GOB.skinDark);
  };
  r.part('legR', leg);
  r.part('legL', leg);
  r.part('hips', (g) => {
    g.box(0, -0.22, 0, 0.36, 0.26, 0.26, GOB.cloth);
    g.box(0, -0.3, 0.1, 0.16, 0.2, 0.08, GOB.clothDark);
  });
  r.part('torso', (g) => {
    g.box(0, 0, 0, 0.38, 0.42, 0.26, GOB.skin);
    g.box(0, 0.04, 0, opts.king ? 0.44 : 0.4, 0.3, 0.28, opts.king ? '#5a2a3a' : GOB.leather);
    g.box(0, 0.02, 0.1, 0.18, 0.24, 0.1, GOB.skin);
  });
  r.part('head', (g, gl) => {
    g.box(0, 0, 0, 0.42, 0.34, 0.38, GOB.skin);
    g.box(0, 0.08, 0.2, 0.1, 0.12, 0.1, GOB.skinDark);
    g.box(0, 0.01, 0.19, 0.22, 0.04, 0.02, '#1a1010');
    g.box(-0.06, -0.01, 0.195, 0.03, 0.05, 0.02, '#e8e0c8');
    g.box(0.07, -0.01, 0.195, 0.03, 0.05, 0.02, '#e8e0c8');
    for (const s of [-1, 1]) {
      g.push().translate(s * 0.2, 0.2, -0.02).rotateZ(s * -0.5);
      g.box(s * 0.14, -0.05, 0, 0.3, 0.1, 0.12, GOB.skin);
      g.box(s * 0.14, -0.04, 0.01, 0.2, 0.05, 0.1, GOB.skinLight);
      g.pop();
    }
    g.box(0, 0.24, 0.17, 0.36, 0.05, 0.04, GOB.skinDark);
    for (const s of [-1, 1]) gl.box(s * 0.09, 0.18, 0.192, 0.05, 0.04, 0.01, GOB.eye);
  });
  const arm = (g: Geo) => {
    g.box(0, -0.44, 0, 0.1, 0.44, 0.11, GOB.skin);
    g.box(0, -0.5, 0, 0.12, 0.1, 0.12, GOB.skinDark);
  };
  r.part('armR', arm);
  r.part('armL', arm);
}

export function makeGoblin(shield: boolean): Model {
  const r = new Rig({ shadow: 0.7 });
  goblinBody(r);
  r.part('handR', (g) => {
    g.box(0, -0.14, 0, 0.05, 0.2, 0.05, '#4a3424');
    g.box(0, -0.52, 0.04, 0.04, 0.4, 0.17, '#8a8a96');
    g.box(0, -0.52, 0.12, 0.045, 0.4, 0.02, '#c0c0cc');
  });
  if (shield)
    r.part('handL', (g) => {
      g.push().rotateZ(Math.PI / 2);
      g.cyl(-0.25, -0.1, 0, 0.3, 0.3, 0.07, 8, '#7a5a38');
      g.cyl(-0.25, -0.12, 0, 0.1, 0.08, 0.1, 6, '#6a6a74');
      g.pop();
      g.box(0.08, -0.52, 0, 0.02, 0.5, 0.06, '#4a3424');
    });
  return new Model(r, (rig, a) => goblinPose(rig, a, shield), 0.8);
}

// ---------- goblin kinds ----------

/** The hammer brute: a head taller, iron-capped, with a great maul. */
export function makeBrute(): Model {
  const r = new Rig({ shadow: 1.0 });
  goblinBody(r);
  r.part('head', (g) => {
    g.box(0, 0.2, 0, 0.46, 0.18, 0.42, '#5a5a66', { kind: K.Metal });
    g.box(0, 0.08, 0.2, 0.08, 0.2, 0.06, '#5a5a66', { kind: K.Metal });
    g.box(0, 0.36, 0, 0.1, 0.08, 0.3, '#7a7a88', { kind: K.Metal });
  });
  r.part('torso', (g) => {
    g.box(0, 0.02, 0.02, 0.44, 0.34, 0.3, '#4a3a2e', { kind: K.Wood });
    for (const s of [-1, 1]) g.box(s * 0.26, 0.36, 0, 0.18, 0.12, 0.3, '#5a5a66', { kind: K.Metal });
  });
  r.part('handR', (g) => {
    g.box(0, -0.4, 0, 0.07, 1.05, 0.07, '#4a3424', { kind: K.Wood });
    g.box(0, -0.98, 0, 0.26, 0.3, 0.46, '#5a5a66', { kind: K.Metal });
    g.box(0, -0.98, 0, 0.3, 0.12, 0.5, '#3a3a44', { kind: K.Metal });
  });
  const m = new Model(r, brutePose, 0.9);
  r.scale = 1.4;
  return m;
}

function brutePose(r: Rig, a: Anim) {
  goblinPose(r, a, false);
  // Both hands on the haft for the overhead smash.
  if (a.name === 'windup' || a.name === 'strike') {
    r.j('armL').rotation.x = r.j('armR').rotation.x;
    r.j('armL').rotation.y = -0.35;
    r.j('armL').rotation.z = 0;
  } else {
    r.j('armR').rotation.x = -0.15;
    r.j('handR').rotation.x = -0.2;
  }
}

/** The firepot thrower: a satchel of clay pots, one always in hand. */
export function makeBomber(): Model {
  const r = new Rig({ shadow: 0.7 });
  goblinBody(r);
  r.part('head', (g) => {
    g.box(0, 0.2, -0.02, 0.44, 0.1, 0.4, '#6a4a2a', { kind: K.Cloth });
    g.box(0, 0.26, -0.02, 0.3, 0.12, 0.3, '#6a4a2a', { kind: K.Cloth });
  });
  r.part('hips', (g) => {
    g.box(0.2, -0.28, 0.02, 0.14, 0.2, 0.22, '#5a3a22', { kind: K.Cloth });
    g.cyl(0.21, -0.14, 0.06, 0.07, 0.05, 0.1, 6, '#8a5a3a');
    g.cyl(0.21, -0.14, -0.05, 0.07, 0.05, 0.1, 6, '#8a5a3a');
  });
  r.part('handR', (g, gl) => {
    g.cyl(0, -0.2, 0, 0.12, 0.09, 0.16, 7, '#8a5a3a');
    g.cyl(0, -0.04, 0, 0.09, 0.05, 0.06, 6, '#6a4028');
    gl.box(0, 0.04, 0, 0.04, 0.08, 0.04, [4, 2, 0.6], { kind: 1 });
  });
  return new Model(r, (rig, a) => {
    const name = a.name === 'aim' ? 'windup' : a.name;
    goblinPose(rig, { ...a, name }, false);
  }, 0.8);
}

/** The bog darter: a reed hood and a long blowpipe. */
export function makeDarter(): Model {
  const r = new Rig({ shadow: 0.7 });
  goblinBody(r);
  r.part('head', (g) => {
    g.box(0, 0.12, -0.04, 0.48, 0.3, 0.44, '#3e5232', { kind: K.Thatch });
    g.box(0, -0.06, -0.16, 0.48, 0.3, 0.14, '#3e5232', { kind: K.Thatch });
  });
  r.part('handR', (g) => {
    g.box(0, -0.3, 0, 0.04, 0.9, 0.04, '#6a7040', { kind: K.Wood });
    g.box(0, -0.72, 0, 0.06, 0.06, 0.06, '#4a3424');
  });
  return new Model(r, darterPose, 0.8);
}

function darterPose(r: Rig, a: Anim) {
  goblinPose(r, { ...a, name: a.name === 'aim' || a.name === 'strike' ? 'idle' : a.name }, false);
  if (a.name === 'aim' || a.name === 'strike') {
    // Pipe to the lips, pointed at the knight.
    r.j('armR').rotation.x = -1.5;
    r.j('armR').rotation.y = 0.35;
    r.j('handR').rotation.x = 0;
    r.j('armL').rotation.x = -1.4;
    r.j('armL').rotation.y = -0.2;
    r.j('torso').rotation.x = 0.1;
    if (a.name === 'strike') r.j('head').rotation.x = -0.15;
  } else {
    r.j('armR').rotation.x = -0.2;
    r.j('handR').rotation.x = -0.4;
  }
}

/** The shaman: a bone mask, feathers, a staff crowned with a glowing skull. */
export function makeShaman(): Model {
  const r = new Rig({ shadow: 0.7 });
  goblinBody(r);
  r.part('head', (g) => {
    g.box(0, 0.02, 0.2, 0.36, 0.3, 0.04, '#d8d0b8');
    g.box(-0.08, 0.06, 0.225, 0.07, 0.05, 0.01, '#1a1010');
    g.box(0.08, 0.06, 0.225, 0.07, 0.05, 0.01, '#1a1010');
    for (const [x, c, h] of [[-0.12, '#c83030', 0.4], [0, '#e0b040', 0.5], [0.12, '#3a8a5a', 0.38]] as [number, string, number][]) {
      g.push().translate(x, 0.2, -0.05).rotateZ(x * -1.5);
      g.box(0, h / 2, 0, 0.05, h, 0.03, c, { wind: 0.4 });
      g.pop();
    }
  });
  r.part('hips', (g) => {
    g.box(0, -0.42, 0, 0.44, 0.42, 0.32, '#3a4a3a', { kind: K.Cloth });
  });
  r.part('handR', (g, gl) => {
    g.box(0, -0.2, 0, 0.05, 1.5, 0.05, '#5a4030', { kind: K.Wood });
    g.box(0, 0.6, 0, 0.16, 0.16, 0.16, '#d8d0b8');
    gl.box(0, 0.62, 0.085, 0.1, 0.05, 0.01, [0.5, 3.2, 0.9]);
    for (const s of [-1, 1]) g.box(s * 0.1, 0.45, 0, 0.02, 0.2, 0.02, '#c83030', { wind: 0.6 });
  });
  return new Model(r, shamanPose, 0.8);
}

function shamanPose(r: Rig, a: Anim) {
  goblinPose(r, { ...a, name: a.name === 'chant' ? 'idle' : a.name }, false);
  r.j('armR').rotation.x = -0.35;
  r.j('handR').rotation.x = 0.35;
  if (a.name === 'chant') {
    // Staff and arms raised, swaying with the song.
    const k = Math.min(1, a.t / 0.3);
    r.j('armR').rotation.x = -2.6 * k;
    r.j('handR').rotation.x = 0.3;
    r.j('armL').rotation.x = -2.4 * k;
    r.j('armL').rotation.z = 0.5;
    r.j('torso').rotation.x = -0.25 * k;
    r.j('torso').rotation.z = Math.sin(a.time * 8) * 0.12;
    r.j('hips').position.y += Math.abs(Math.sin(a.time * 8)) * 0.05;
  }
}

function goblinPose(r: Rig, a: Anim, shield: boolean) {
  const armL = r.j('armL');
  r.j('armR').rotation.x = -0.4;
  r.j('handR').rotation.x = -0.9;
  armL.rotation.x = -0.2;
  armL.rotation.z = 0.3;
  if (shield) {
    armL.rotation.x = -1.25;
    armL.rotation.y = -0.95;
  }
  gait(r, a, { hunch: 0.35, leg: 1, arm: shield ? 0.3 : 0.7, bob: 0.09 });
  switch (a.name) {
    case 'alert': {
      const k = Math.sin(clamp(a.t / 0.35, 0, 1) * Math.PI);
      r.j('hips').position.y += k * 0.2;
      r.j('armR').rotation.x = -1.8 * k;
      break;
    }
    case 'windup': {
      const k = ease(seg(a.t, 0, 0.35));
      r.j('armR').rotation.x = mix(-0.4, -2.9, k);
      r.j('handR').rotation.x = mix(-0.9, -0.3, k);
      r.j('torso').rotation.x = 0.35 - 0.35 * k;
      r.j('torso').rotation.y = -0.3 * k;
      r.j('hips').position.y -= 0.05 * k;
      r.j('head').rotation.x = -0.1 * k;
      break;
    }
    case 'strike': {
      const k = easeOut(seg(a.t, 0, 0.1));
      r.j('armR').rotation.x = mix(-2.9, -0.35, k);
      r.j('handR').rotation.x = -0.3;
      r.j('torso').rotation.x = mix(0, 0.6, k);
      r.j('torso').rotation.y = mix(-0.3, 0.2, k);
      r.j('legR').rotation.x = -0.4 * k;
      r.j('legL').rotation.x = 0.35 * k;
      break;
    }
    case 'recover':
      r.j('armR').rotation.x = -0.35;
      r.j('torso').rotation.x = 0.5 * (1 - seg(a.t, 0, 0.5));
      break;
    case 'hurt': {
      const k = Math.max(0, 1 - a.t * 3.5);
      r.j('torso').rotation.x = 0.35 - 0.7 * k;
      r.j('head').rotation.x = -0.4 * k;
      r.j('armR').rotation.z = -0.6 * k;
      armL.rotation.z = 0.8 * k;
      break;
    }
    case 'stun': {
      r.j('torso').rotation.x = 0.1;
      r.j('head').rotation.z = Math.sin(a.time * 7) * 0.25;
      r.j('torso').rotation.z = Math.sin(a.time * 3.5) * 0.12;
      r.j('armR').rotation.x = 0.1;
      armL.rotation.x = 0.1;
      armL.rotation.y = 0;
      break;
    }
    case 'dead':
      fallDown(r, a, 0.55);
      break;
  }
}

// ---------- skeleton archer ----------

/** The skeleton archers' colours (switched per realm, see setFoePalette). */
const ARCH = { bone: '#d8d0b8', boneD: '#a89f88', hood: '#4a3f7a', hoodD: '#342c5c', eye: [3.4, 0.5, 0.5] as [number, number, number] };

export function makeArcher(): Model {
  const r = new Rig({ shadow: 0.6 });
  r.joint('hips', 'root', 0, 0.82, 0);
  r.joint('legR', 'hips', -0.1, 0, 0);
  r.joint('legL', 'hips', 0.1, 0, 0);
  r.joint('torso', 'hips', 0, 0.02, 0);
  r.joint('head', 'torso', 0, 0.55, 0.03);
  r.joint('cloak', 'torso', 0, 0.5, -0.12);
  r.joint('armR', 'torso', -0.22, 0.46, 0);
  r.joint('handR', 'armR', 0, -0.5, 0);
  r.joint('armL', 'torso', 0.22, 0.46, 0);
  r.joint('handL', 'armL', 0, -0.5, 0);
  const leg = (g: Geo) => {
    g.box(0, -0.82, 0, 0.07, 0.82, 0.07, ARCH.bone);
    g.box(0, -0.45, 0, 0.1, 0.07, 0.1, ARCH.boneD);
    g.box(0, -0.82, 0.04, 0.1, 0.05, 0.18, ARCH.boneD);
  };
  r.part('legR', leg);
  r.part('legL', leg);
  r.part('hips', (g) => {
    g.box(0, -0.1, 0, 0.3, 0.12, 0.16, ARCH.boneD);
    g.box(0, -0.35, 0.02, 0.36, 0.4, 0.24, ARCH.hoodD);
  });
  r.part('torso', (g) => {
    g.box(0, 0, 0, 0.06, 0.55, 0.06, ARCH.bone);
    for (let i = 0; i < 4; i++) g.box(0, 0.18 + i * 0.08, 0.02, 0.3 - i * 0.02, 0.035, 0.18, ARCH.bone);
    g.box(0, 0.4, 0, 0.42, 0.14, 0.24, ARCH.hood);
  });
  r.part('cloak', (g) => {
    g.box(0, -0.75, 0, 0.42, 0.75, 0.04, ARCH.hoodD);
    g.box(-0.14, -0.9, 0, 0.1, 0.15, 0.04, ARCH.hoodD);
    g.box(0.12, -0.85, 0, 0.1, 0.1, 0.04, ARCH.hoodD);
  });
  r.part('head', (g, gl) => {
    g.box(0, 0, 0, 0.24, 0.26, 0.26, ARCH.bone);
    g.box(0, -0.06, 0.04, 0.18, 0.08, 0.2, ARCH.boneD);
    g.box(0, 0.08, 0.131, 0.18, 0.07, 0.01, '#140c14');
    for (const s of [-1, 1]) gl.box(s * 0.055, 0.1, 0.135, 0.04, 0.04, 0.01, ARCH.eye);
    // Hood.
    g.box(0, 0.12, -0.04, 0.32, 0.22, 0.32, ARCH.hood);
    g.box(0, -0.08, -0.12, 0.32, 0.22, 0.12, ARCH.hood);
    for (const s of [-1, 1]) g.box(s * 0.15, -0.04, 0.02, 0.03, 0.24, 0.24, ARCH.hood);
  });
  const arm = (g: Geo) => g.box(0, -0.5, 0, 0.06, 0.5, 0.06, ARCH.bone);
  r.part('armR', arm);
  r.part('armL', arm);
  r.part('handL', (g) => {
    // Bow: limbs run along local z so it stands upright when the arm points forward.
    g.box(0, -0.02, 0, 0.05, 0.05, 0.16, '#4a3424');
    g.push().translate(0, 0, 0.08).rotateX(0.35);
    g.box(0, -0.02, 0.25, 0.035, 0.035, 0.5, '#6a4a2a');
    g.pop();
    g.push().translate(0, 0, -0.08).rotateX(-0.35);
    g.box(0, -0.02, -0.25, 0.035, 0.035, 0.5, '#6a4a2a');
    g.pop();
    g.box(0, -0.22, 0, 0.01, 0.01, 1.0, '#d8d8e0');
  });
  return new Model(r, archerPose, 0.9);
}

function archerPose(r: Rig, a: Anim) {
  r.j('armR').rotation.x = -0.15;
  r.j('armL').rotation.x = -0.5;
  r.j('armL').rotation.z = 0.15;
  r.j('cloak').rotation.x = -0.05 - a.speed * 0.4 + Math.sin(a.time * 2.5) * 0.05;
  gait(r, a, { hunch: 0.08, arm: 0.4 });
  switch (a.name) {
    case 'aim':
    case 'strike': {
      const k = a.name === 'aim' ? ease(seg(a.t, 0, 0.35)) : 1;
      const draw = a.name === 'aim' ? seg(a.t, 0.3, 0.9) : 0;
      r.j('armL').rotation.x = mix(-0.5, -1.57, k);
      r.j('armL').rotation.y = -0.1 * k;
      r.j('armR').rotation.x = mix(-0.15, -1.5, k);
      r.j('armR').rotation.y = mix(0, 0.55 + 0.35 * draw, k);
      r.j('torso').rotation.y = -0.35 * k;
      r.j('head').rotation.y = 0.3 * k;
      if (a.name === 'strike') r.j('armR').rotation.y = -0.4;
      break;
    }
    case 'hurt': {
      const k = Math.max(0, 1 - a.t * 3.5);
      r.j('torso').rotation.x = -0.5 * k;
      r.j('head').rotation.x = -0.4 * k;
      break;
    }
    case 'stun':
      r.j('head').rotation.z = Math.sin(a.time * 7) * 0.3;
      break;
    case 'dead':
      fallDown(r, a, 0.82);
      break;
  }
}

// ---------- bat ----------

export function makeBat(): Model {
  const r = new Rig({ shadow: 0.45 });
  r.joint('body', 'root', 0, 0, 0);
  r.joint('wingL', 'body', 0.1, 0.05, 0);
  r.joint('wingR', 'body', -0.1, 0.05, 0);
  const fur = '#3a2a3a', skin = '#4a3444';
  r.part('body', (g, gl) => {
    g.blob(0, 0, 0, 0.16, 0.18, 0.16, fur, 3, { detail: 1 });
    g.box(0, 0.12, 0.08, 0.2, 0.14, 0.16, fur);
    for (const s of [-1, 1]) {
      g.push().translate(s * 0.07, 0.24, 0.08).rotateZ(s * -0.3);
      g.box(0, 0, 0, 0.06, 0.12, 0.04, skin);
      g.pop();
    }
    for (const s of [-1, 1]) gl.box(s * 0.05, 0.16, 0.165, 0.035, 0.03, 0.01, [3.6, 0.6, 0.5]);
    g.box(0, 0.08, 0.165, 0.06, 0.02, 0.01, '#e8e0c8');
  });
  const wing = (s: number) => (g: Geo) => {
    g.box(s * 0.28, -0.01, -0.02, 0.56, 0.02, 0.3, skin);
    g.box(s * 0.5, -0.01, -0.1, 0.18, 0.02, 0.2, skin);
    g.box(s * 0.3, 0.0, 0.1, 0.6, 0.03, 0.03, fur);
  };
  r.part('wingL', wing(1));
  r.part('wingR', wing(-1));
  return new Model(r, (rig, a) => {
    const fast = a.name === 'windup' ? 2 : 1;
    const f = Math.sin(a.time * 17 * fast);
    rig.j('wingL').rotation.z = f * 0.9;
    rig.j('wingR').rotation.z = -f * 0.9;
    rig.j('body').position.y = -f * 0.05;
    if (a.name === 'swoop') {
      rig.j('body').rotation.x = 0.6;
      rig.j('wingL').rotation.z = -0.5;
      rig.j('wingR').rotation.z = 0.5;
    }
    if (a.name === 'dead') {
      rig.j('body').rotation.z = a.t * 8;
      rig.j('body').position.y = -a.t * 2.5;
    }
  });
}

// ---------- armored boar ----------

interface BoarLook { body: string; dark: string; light: string; armor: string; armorD: string; spikes: string; thorny?: boolean }
const ARMORED_BOAR: BoarLook = { body: '#6b4a3a', dark: '#4a3226', light: '#8a6a58', armor: '#8b9bb4', armorD: '#5a6680', spikes: '#c8ccd8' };

export function makeBoar(look: BoarLook = ARMORED_BOAR): Model {
  const r = new Rig({ shadow: 1.2 });
  const { body, dark, light, armor, armorD } = look;
  r.joint('body', 'root', 0, 0.62, 0);
  r.joint('head', 'body', 0, -0.05, 0.58);
  r.joint('legFR', 'body', -0.2, -0.28, 0.36);
  r.joint('legFL', 'body', 0.2, -0.28, 0.36);
  r.joint('legBR', 'body', -0.2, -0.28, -0.36);
  r.joint('legBL', 'body', 0.2, -0.28, -0.36);
  r.part('body', (g) => {
    g.box(0, -0.3, 0, 0.62, 0.58, 1.15, body);
    g.box(0, -0.32, 0.02, 0.5, 0.12, 1.0, light);
    g.box(0, 0.2, -0.05, 0.68, 0.14, 0.9, armor);
    g.box(-0.33, -0.05, -0.05, 0.05, 0.3, 0.86, armorD);
    g.box(0.33, -0.05, -0.05, 0.05, 0.3, 0.86, armorD);
    if (look.thorny) {
      // A hedge of thorns down the back and flanks, bone-pale at the tips.
      for (let i = 0; i < 18; i++) {
        const t = (i % 6) / 5, side = Math.floor(i / 6) - 1;
        g.push().translate(side * 0.2, 0.3 - Math.abs(side) * 0.08, -0.45 + t * 0.85).rotateZ(-side * 0.5).rotateX(-0.3);
        g.cyl(0, 0, 0, 0.05, 0, 0.3, 4, armorD);
        g.box(0, 0.26, 0, 0.03, 0.08, 0.03, look.spikes);
        g.pop();
      }
    } else for (let i = 0; i < 4; i++) g.cyl(0, 0.34, -0.35 + i * 0.25, 0.06, 0, 0.14, 4, look.spikes);
    g.box(0, 0.05, 0.45, 0.2, 0.22, 0.3, dark);
    g.box(0, -0.05, -0.62, 0.05, 0.05, 0.2, dark);
  });
  r.part('head', (g, gl) => {
    g.box(0, -0.25, 0.1, 0.44, 0.44, 0.42, body);
    g.box(0, -0.12, 0.13, 0.48, 0.2, 0.36, armor);
    g.box(0, -0.25, 0.38, 0.26, 0.2, 0.14, light);
    g.box(0, -0.2, 0.455, 0.2, 0.08, 0.01, '#2a1a14');
    for (const s of [-1, 1]) {
      g.push().translate(s * 0.14, -0.2, 0.42).rotateX(-0.6);
      g.box(0, 0, 0, 0.05, 0.22, 0.05, '#e8e2d4');
      g.pop();
      g.push().translate(s * 0.18, 0.15, 0.05).rotateZ(s * -0.4);
      g.box(0, 0, 0, 0.08, 0.14, 0.06, dark);
      g.pop();
      gl.box(s * 0.12, -0.02, 0.315, 0.06, 0.04, 0.01, [3.6, 0.6, 0.5]);
    }
  });
  const leg = (g: Geo) => {
    g.box(0, -0.34, 0, 0.14, 0.34, 0.16, dark);
    g.box(0, -0.36, 0.02, 0.15, 0.08, 0.18, '#2a1e18');
  };
  for (const l of ['legFR', 'legFL', 'legBR', 'legBL']) r.part(l, leg);
  return new Model(r, boarPose, 0.7);
}

function boarPose(r: Rig, a: Anim) {
  const s = Math.sin(a.phase * (a.name === 'charge' ? 1 : 1)), sp = clamp(a.speed, 0, 1.3);
  r.j('legFR').rotation.x = s * 0.8 * sp;
  r.j('legBL').rotation.x = s * 0.8 * sp;
  r.j('legFL').rotation.x = -s * 0.8 * sp;
  r.j('legBR').rotation.x = -s * 0.8 * sp;
  r.j('body').position.y += Math.abs(Math.cos(a.phase)) * 0.06 * sp;
  r.j('head').rotation.x = Math.sin(a.time * 2) * 0.05;
  switch (a.name) {
    case 'paw':
      r.j('legFR').rotation.x = Math.sin(a.t * 18) * 0.6 - 0.3;
      r.j('head').rotation.x = 0.35;
      r.j('body').rotation.x = 0.1;
      break;
    case 'charge':
      r.j('head').rotation.x = 0.3;
      r.j('body').rotation.x = 0.08;
      break;
    case 'stun':
      r.j('head').rotation.x = 0.5;
      r.j('head').rotation.z = Math.sin(a.time * 6) * 0.3;
      r.j('body').position.y -= 0.12;
      break;
    case 'hurt':
      r.j('head').rotation.x = -0.3 * Math.max(0, 1 - a.t * 4);
      break;
    case 'dead': {
      const k = easeOut(seg(a.t, 0, 0.4));
      r.j('body').rotation.z = 1.5 * k;
      r.j('body').position.y = mix(0.62, 0.35, k);
      break;
    }
  }
}


// ---------- each realm's colours for its goblins, archers and beasts ----------

/** Realm 1's colours, kept so a realm can switch back. */
const CASTLE_GOB = { ...GOB };
const CASTLE_ARCH = { ...ARCH };
/** The Old Wood's goblins (the prototype's forest greens, mossy cloth) and its moss-grown archers. */
const FOREST_GOB = { skin: '#7ab04a', skinDark: '#4a7a2a', skinLight: '#a8d870', cloth: '#4a5a2a', clothDark: '#2e3a1a', leather: '#5a3a26', eye: [2.4, 2.6, 0.5] as [number, number, number] };
const FOREST_ARCH = { bone: '#c8c8a0', boneD: '#8a9068', hood: '#2f5a2e', hoodD: '#1f3d20', eye: [2.6, 2.8, 0.6] as [number, number, number] };

/** Colour the foes built from now on for a realm (called before any are made). */
export function setFoePalette(realm: string) {
  Object.assign(GOB, realm === 'forest' ? FOREST_GOB : CASTLE_GOB);
  Object.assign(ARCH, realm === 'forest' ? FOREST_ARCH : CASTLE_ARCH);
}

// ---------- the Old Wood's own foes ----------

/**
 * The Thorn Spitter: a rooted pod on a thorny stem that rears back and spits hard seeds,
 * and snaps at anything that comes close. It never moves.
 */
export function makeSpitter(): Model {
  const r = new Rig({ shadow: 0.7 });
  const body = '#4a8a3a', dark = '#2f5a26', mouth = '#e43b44', spike = '#e8f060';
  r.joint('stem', 'root', 0, 0.1, 0);
  r.joint('head', 'stem', 0, 0.85, 0);
  r.joint('jaw', 'head', 0, -0.02, 0.12);
  r.joint('base', 'root', 0, 0, 0);
  r.part('base', (g) => {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.push().translate(Math.cos(a) * 0.3, 0.06, Math.sin(a) * 0.3).rotateY(-a).rotateZ(0.5);
      g.box(0, 0, 0, 0.5, 0.06, 0.2, i % 2 ? body : dark, { kind: K.Leaves });
      g.pop();
    }
    g.blob(0, 0.05, 0, 0.26, 0.14, 0.26, '#5a3a26', 3, { flatBottom: true });
  });
  r.part('stem', (g) => {
    g.cyl(0, 0, 0, 0.1, 0.08, 0.9, 6, dark, { kind: K.Leaves });
    for (let i = 0; i < 4; i++) g.box(0.1 * (i % 2 ? 1 : -1), 0.2 + i * 0.18, 0, 0.1, 0.03, 0.03, spike);
  });
  r.part('head', (g, gl) => {
    g.blob(0, 0.15, -0.05, 0.3, 0.26, 0.32, body, 7, { detail: 1 });
    g.box(0, 0.05, 0.14, 0.34, 0.1, 0.2, dark);
    for (let i = 0; i < 5; i++) g.box(-0.2 + i * 0.1, 0.42, -0.08, 0.04, 0.12, 0.04, spike);
    // The upper lip and its teeth; the eyes above.
    g.box(0, 0.08, 0.28, 0.28, 0.06, 0.12, mouth);
    for (let i = 0; i < 4; i++) g.box(-0.09 + i * 0.06, 0.03, 0.33, 0.025, 0.06, 0.025, '#e8e2d4');
    for (const s of [-1, 1]) gl.box(s * 0.1, 0.24, 0.24, 0.05, 0.05, 0.02, [2.6, 2.8, 0.6]);
  });
  r.part('jaw', (g) => {
    g.box(0, -0.06, 0.12, 0.26, 0.06, 0.22, body);
    g.box(0, -0.02, 0.14, 0.22, 0.03, 0.16, mouth);
    for (let i = 0; i < 4; i++) g.box(-0.09 + i * 0.06, 0.0, 0.22, 0.025, 0.06, 0.025, '#e8e2d4');
  });
  return new Model(r, (rig, a) => {
    const sway = Math.sin(a.time * 1.6) * 0.08;
    rig.j('stem').rotation.z = sway;
    rig.j('stem').rotation.x = 0;
    rig.j('head').rotation.x = 0;
    rig.j('jaw').rotation.x = 0.1 + Math.max(0, Math.sin(a.time * 3)) * 0.1;
    switch (a.name) {
      case 'aim':
      case 'windup': {
        const k = ease(seg(a.t, 0, 0.35));
        rig.j('stem').rotation.x = -0.45 * k;
        rig.j('head').rotation.x = -0.3 * k;
        rig.j('jaw').rotation.x = 0.6 * k;
        break;
      }
      case 'strike': {
        const k = 1 - ease(seg(a.t, 0, 0.3));
        rig.j('stem').rotation.x = 0.35 * k;
        rig.j('head').rotation.x = 0.2 * k;
        rig.j('jaw').rotation.x = 0.8 * k;
        break;
      }
      case 'hurt':
        rig.j('stem').rotation.x = -0.4 * Math.max(0, 1 - a.t * 4);
        break;
      case 'stun':
        rig.j('stem').rotation.z = Math.sin(a.time * 8) * 0.3;
        break;
      case 'dead': {
        const k = easeOut(seg(a.t, 0, 0.5));
        rig.j('stem').rotation.x = 1.3 * k;
        rig.j('jaw').rotation.x = 0.5 * k;
        break;
      }
    }
  }, 0.6);
}

/** The snarer: a goblin with a coil of rope and a bola, whose throws hold you fast. */
export function makeSnarer(): Model {
  const r = new Rig({ shadow: 0.7 });
  goblinBody(r);
  r.part('head', (g) => {
    // A hood of netting.
    g.box(0, 0.16, -0.04, 0.46, 0.2, 0.42, '#6a6040', { kind: K.Cloth });
    for (let i = 0; i < 4; i++) g.box(-0.18 + i * 0.12, 0.1, 0.19, 0.02, 0.2, 0.02, '#8a7a5a');
  });
  r.part('torso', (g) => {
    // A coil of rope across the chest.
    for (let i = 0; i < 3; i++) g.box(0, 0.12 - i * 0.06, 0.15, 0.42, 0.04, 0.05, '#8a7a5a');
  });
  r.part('handR', (g) => {
    g.box(0, -0.2, 0, 0.02, 0.4, 0.02, '#8a7a5a');
    g.blob(0.08, -0.42, 0, 0.07, 0.07, 0.07, '#5a5a66', 5);
    g.blob(-0.08, -0.4, 0.04, 0.07, 0.07, 0.07, '#5a5a66', 6);
  });
  return new Model(r, (rig, a) => {
    const name = a.name === 'aim' ? 'windup' : a.name;
    goblinPose(rig, { ...a, name }, false);
    // The bola whirls overhead while it takes aim.
    if (a.name === 'aim') rig.j('handR').rotation.y = a.time * 18;
  }, 0.8);
}

/** The thornback: a wild boar whose back has grown into a hedge of the Warden's thorns. */
export function makeThornback(): Model {
  const m = makeBoar({ body: '#5a4a32', dark: '#3a2e20', light: '#7a6a48', armor: '#4a5e2a', armorD: '#35451f', spikes: '#e8e2d4', thorny: true });
  return m;
}

// ---------- the Goblin King ----------

export function makeKing(): Model {
  const r = new Rig({ shadow: 1.1 });
  goblinBody(r, { king: true });
  r.joint('cape', 'torso', 0, 0.4, -0.15);
  r.part('cape', (g) => {
    g.box(0, -0.9, 0, 0.5, 0.9, 0.05, '#7a1f2a');
    g.box(0, -0.05, 0.02, 0.52, 0.1, 0.1, '#e8e0d0');
  });
  r.part('head', (g, gl) => {
    // Crown.
    g.box(0, 0.32, 0, 0.36, 0.1, 0.32, '#e0b040');
    for (const [x, z] of [[-0.15, 0.13], [0.15, 0.13], [-0.15, -0.13], [0.15, -0.13], [0, 0.14], [0, -0.14]]) g.box(x, 0.42, z, 0.06, 0.1, 0.06, '#e0b040');
    gl.box(0, 0.35, 0.165, 0.06, 0.05, 0.01, [3.6, 0.4, 0.5]);
    gl.box(-0.1, 0.35, 0.165, 0.04, 0.04, 0.01, [0.6, 1.4, 3.6]);
    gl.box(0.1, 0.35, 0.165, 0.04, 0.04, 0.01, [0.6, 1.4, 3.6]);
  });
  r.part('torso', (g) => {
    g.box(0, -0.08, 0.12, 0.34, 0.3, 0.14, GOB.skin);
    for (const s of [-1, 1]) g.box(s * 0.25, 0.33, 0, 0.16, 0.12, 0.28, '#e0b040');
  });
  r.part('handR', (g) => {
    // Spiked club.
    g.box(0, -0.2, 0, 0.07, 0.3, 0.07, '#4a3424');
    g.cyl(0, -0.95, 0, 0.09, 0.16, 0.75, 6, '#5a3e26');
    for (let i = 0; i < 6; i++) {
      const aa = (i / 6) * Math.PI * 2;
      g.box(Math.cos(aa) * 0.16, -0.95 + 0.15 + (i % 3) * 0.2, Math.sin(aa) * 0.16, 0.05, 0.05, 0.05, '#c0c0cc');
    }
  });
  const m = new Model(r, kingPose, 0.9);
  r.scale = 1.9;
  return m;
}

function kingPose(r: Rig, a: Anim) {
  const cape = r.j('cape');
  cape.rotation.x = -0.12 - a.speed * 0.5 + Math.sin(a.time * 2) * 0.03;
  r.j('armR').rotation.x = -0.4;
  r.j('handR').rotation.x = -0.7;
  r.j('armL').rotation.z = 0.35;
  gait(r, a, { hunch: 0.25, leg: 0.8, arm: 0.4, bob: 0.1 });
  switch (a.name) {
    case 'sleep': {
      // Slumped on the throne, snoring.
      r.j('hips').position.y = 0.36;
      r.j('legR').rotation.x = -1.4;
      r.j('legL').rotation.x = -1.3;
      r.j('torso').rotation.x = 0.3 + Math.sin(a.time * 1.2) * 0.04;
      r.j('head').rotation.x = 0.5;
      r.j('armR').rotation.x = -0.6;
      r.j('handR').rotation.x = 0.4;
      break;
    }
    case 'wake': {
      const k = ease(seg(a.t, 0, 0.6));
      r.j('hips').position.y = mix(0.36, 0.55, k);
      r.j('legR').rotation.x = -1.4 * (1 - k);
      r.j('legL').rotation.x = -1.3 * (1 - k);
      r.j('armR').rotation.x = mix(-0.6, -2.8, seg(a.t, 0.5, 1));
      r.j('armL').rotation.x = mix(-0.2, -2.6, seg(a.t, 0.5, 1));
      r.j('head').rotation.x = mix(0.5, -0.4, k);
      break;
    }
    case 'windup':
    case 'summon': {
      const k = ease(seg(a.t, 0, 0.4));
      r.j('armR').rotation.x = mix(-0.4, -3.0, k);
      r.j('armL').rotation.x = mix(0, -2.8, k);
      r.j('torso').rotation.x = mix(0.25, -0.25, k);
      r.j('head').rotation.x = -0.3 * k;
      if (a.name === 'summon') r.j('hips').position.y += Math.abs(Math.sin(a.t * 8)) * 0.05;
      break;
    }
    case 'slam': {
      const k = easeOut(seg(a.t, 0, 0.08));
      r.j('armR').rotation.x = mix(-3.0, -0.3, k);
      r.j('armL').rotation.x = mix(-2.8, -0.4, k);
      r.j('torso').rotation.x = mix(-0.25, 0.7, k);
      r.j('hips').position.y -= 0.12 * k;
      r.j('legR').rotation.x = -0.5 * k;
      r.j('legL').rotation.x = 0.4 * k;
      break;
    }
    case 'paw':
      r.j('hips').position.y -= 0.08;
      r.j('torso').rotation.x = 0.6;
      r.j('armR').rotation.x = 0.6;
      r.j('head').rotation.x = -0.3;
      r.j('legR').rotation.x = Math.sin(a.t * 14) * 0.3;
      break;
    case 'charge':
      r.j('torso').rotation.x = 0.75;
      r.j('armR').rotation.x = 0.8;
      r.j('armL').rotation.x = 0.6;
      r.j('head').rotation.x = -0.4;
      break;
    case 'jump': {
      const k = seg(a.t, 0, 0.25);
      r.j('hips').position.y -= 0.15 * k;
      r.j('legR').rotation.x = -0.9 * k;
      r.j('legL').rotation.x = -0.7 * k;
      r.j('armR').rotation.x = -3.0 * k;
      r.j('armL').rotation.x = -2.8 * k;
      break;
    }
    case 'stun':
      r.j('hips').position.y = 0.38;
      r.j('legR').rotation.x = -1.3;
      r.j('legL').rotation.x = -1.1;
      r.j('torso').rotation.x = -0.2;
      r.j('head').rotation.z = Math.sin(a.time * 5) * 0.35;
      r.j('armR').rotation.z = -0.8;
      r.j('armL').rotation.z = 0.8;
      break;
    case 'dead':
      fallDown(r, a, 0.55);
      break;
  }
}

// ---------- the Thorn Warden ----------

/**
 * The Old Wood's tyrant (the prototype drew it with the bone archers' body): a bone archer
 * three times a man's height, grown over with bark, moss and thorns, a crown of thorn-antlers
 * and a longbow of living wood.
 */
export function makeWarden(): Model {
  const r = new Rig({ shadow: 0.9 });
  const bark = '#4a3a2a', barkD = '#33281c', moss = '#4a6a2e', thorn = '#c8c0a0', bone = ARCH.bone, boneD = ARCH.boneD;
  r.joint('hips', 'root', 0, 0.86, 0);
  r.joint('legR', 'hips', -0.12, 0, 0);
  r.joint('legL', 'hips', 0.12, 0, 0);
  r.joint('torso', 'hips', 0, 0.02, 0);
  r.joint('head', 'torso', 0, 0.6, 0.04);
  r.joint('cloak', 'torso', 0, 0.55, -0.14);
  r.joint('armR', 'torso', -0.26, 0.5, 0);
  r.joint('handR', 'armR', 0, -0.55, 0);
  r.joint('armL', 'torso', 0.26, 0.5, 0);
  r.joint('handL', 'armL', 0, -0.55, 0);
  const leg = (g: Geo) => {
    g.box(0, -0.86, 0, 0.08, 0.86, 0.08, bone);
    g.box(0, -0.62, 0, 0.16, 0.34, 0.16, bark);
    g.box(0, -0.86, 0.04, 0.16, 0.08, 0.24, barkD);
    g.box(0.06, -0.5, 0.07, 0.03, 0.08, 0.03, thorn);
  };
  r.part('legR', leg);
  r.part('legL', leg);
  r.part('hips', (g) => {
    g.box(0, -0.12, 0, 0.34, 0.14, 0.18, boneD);
    g.box(0, -0.42, 0.02, 0.42, 0.44, 0.26, barkD);
    for (let i = 0; i < 5; i++) g.box(-0.18 + i * 0.09, -0.62, 0.1, 0.06, 0.2, 0.04, i % 2 ? moss : bark);
  });
  r.part('torso', (g, gl) => {
    g.box(0, 0, 0, 0.07, 0.6, 0.07, bone);
    for (let i = 0; i < 4; i++) g.box(0, 0.2 + i * 0.09, 0.02, 0.34 - i * 0.02, 0.04, 0.2, bone);
    // Bark plates over the ribs, moss on the shoulders, thorns.
    g.box(-0.12, 0.3, 0.1, 0.12, 0.3, 0.05, bark);
    g.box(0.13, 0.26, 0.1, 0.1, 0.26, 0.05, barkD);
    g.box(0, 0.47, 0, 0.5, 0.14, 0.28, bark);
    g.box(-0.2, 0.55, 0, 0.14, 0.06, 0.26, moss);
    g.box(0.21, 0.55, 0, 0.12, 0.06, 0.24, moss);
    for (const [x, y, z] of [[-0.22, 0.6, 0.05], [0.24, 0.6, -0.04], [0.1, 0.4, 0.13], [-0.05, 0.2, 0.13]]) g.box(x, y, z, 0.03, 0.12, 0.03, thorn);
    // A green heart-light between the ribs.
    gl.box(0, 0.32, 0.03, 0.08, 0.08, 0.06, [0.8, 2.6, 0.6]);
  });
  r.part('cloak', (g) => {
    g.box(0, -0.85, 0, 0.5, 0.85, 0.05, barkD);
    for (let i = 0; i < 5; i++) g.box(-0.2 + i * 0.1, -0.95 - (i % 2) * 0.1, 0, 0.08, 0.14, 0.05, i % 2 ? moss : barkD);
  });
  r.part('head', (g, gl) => {
    g.box(0, 0, 0, 0.26, 0.28, 0.28, bone);
    g.box(0, -0.07, 0.05, 0.2, 0.08, 0.2, boneD);
    g.box(0, 0.08, 0.141, 0.2, 0.08, 0.01, '#140c14');
    for (const s of [-1, 1]) gl.box(s * 0.06, 0.1, 0.145, 0.045, 0.045, 0.01, [0.9, 3.0, 0.7]);
    // Hood of bark, and a crown of thorn-antlers.
    g.box(0, 0.14, -0.05, 0.34, 0.22, 0.34, bark);
    g.box(0, -0.06, -0.14, 0.34, 0.24, 0.12, barkD);
    for (const s of [-1, 1]) {
      g.beam([s * 0.1, 0.24, 0], [s * 0.3, 0.62, -0.04], 0.03, barkD);
      g.beam([s * 0.22, 0.44, -0.02], [s * 0.4, 0.5, 0.06], 0.02, barkD);
      g.beam([s * 0.26, 0.52, -0.03], [s * 0.26, 0.74, -0.1], 0.02, barkD);
      g.box(s * 0.3, 0.62, -0.04, 0.03, 0.06, 0.03, thorn);
    }
  });
  const arm = (g: Geo) => {
    g.box(0, -0.55, 0, 0.07, 0.55, 0.07, bone);
    g.box(0, -0.2, 0, 0.12, 0.18, 0.12, bark);
  };
  r.part('armR', arm);
  r.part('armL', arm);
  r.part('handL', (g, gl) => {
    // The longbow: living wood with leaves, a glowing string.
    g.box(0, -0.02, 0, 0.06, 0.06, 0.2, barkD);
    g.push().translate(0, 0, 0.1).rotateX(0.32);
    g.box(0, -0.02, 0.36, 0.045, 0.045, 0.72, '#5a4028');
    g.box(0.03, -0.02, 0.5, 0.08, 0.05, 0.06, moss);
    g.pop();
    g.push().translate(0, 0, -0.1).rotateX(-0.32);
    g.box(0, -0.02, -0.36, 0.045, 0.045, 0.72, '#5a4028');
    g.box(0.03, -0.02, -0.5, 0.08, 0.05, 0.06, moss);
    g.pop();
    gl.box(0, -0.28, 0, 0.012, 0.012, 1.42, [0.8, 2.2, 0.6]);
  });
  const m = new Model(r, wardenPose, 0.9);
  r.scale = 2.1;
  return m;
}

function wardenPose(r: Rig, a: Anim) {
  r.j('armR').rotation.x = -0.15;
  r.j('armL').rotation.x = -0.5;
  r.j('armL').rotation.z = 0.15;
  r.j('cloak').rotation.x = -0.05 - a.speed * 0.4 + Math.sin(a.time * 2) * 0.05;
  gait(r, a, { hunch: 0.12, arm: 0.35, leg: 0.7 });
  switch (a.name) {
    case 'sleep':
      // Rooted: kneeling, head bowed, the bow planted like a staff.
      r.j('hips').position.y = 0.5;
      r.j('legR').rotation.x = -1.5;
      r.j('legL').rotation.x = 0.2;
      r.j('torso').rotation.x = 0.35 + Math.sin(a.time * 0.9) * 0.02;
      r.j('head').rotation.x = 0.6;
      r.j('armL').rotation.x = -0.9;
      break;
    case 'wake': {
      const k = ease(seg(a.t, 0, 0.8));
      r.j('hips').position.y = mix(0.5, 0.86, k);
      r.j('legR').rotation.x = -1.5 * (1 - k);
      r.j('legL').rotation.x = 0.2 * (1 - k);
      r.j('torso').rotation.x = mix(0.35, -0.2, k);
      r.j('head').rotation.x = mix(0.6, -0.35, k);
      r.j('armR').rotation.x = mix(-0.15, -2.6, seg(a.t, 0.6, 1));
      break;
    }
    case 'aim': {
      // Volley: bow up, a long draw.
      const k = ease(seg(a.t, 0, 0.3)), draw = seg(a.t, 0.2, 0.6);
      r.j('armL').rotation.x = mix(-0.5, -1.57, k);
      r.j('armR').rotation.x = mix(-0.15, -1.5, k);
      r.j('armR').rotation.y = mix(0, 0.55 + 0.4 * draw, k);
      r.j('torso').rotation.y = -0.35 * k;
      r.j('head').rotation.y = 0.3 * k;
      break;
    }
    case 'windup': {
      // Rain: the bow raised to the sky.
      const k = ease(seg(a.t, 0, 0.35));
      r.j('armL').rotation.x = mix(-0.5, -2.9, k);
      r.j('armR').rotation.x = mix(-0.15, -2.7, k);
      r.j('armR').rotation.y = 0.5 * k;
      r.j('torso').rotation.x = -0.25 * k;
      r.j('head').rotation.x = -0.5 * k;
      break;
    }
    case 'summon':
    case 'slam': {
      // Summon: arms wide; roots: the bow driven into the ground.
      const k = ease(seg(a.t, 0, 0.4));
      if (a.name === 'summon') {
        r.j('armR').rotation.z = -1.3 * k;
        r.j('armL').rotation.z = 1.3 * k;
        r.j('head').rotation.x = -0.3 * k;
        r.j('hips').position.y += Math.abs(Math.sin(a.t * 7)) * 0.03;
      } else {
        r.j('armL').rotation.x = mix(-0.5, -2.6, seg(a.t, 0, 0.3)) + 2.2 * easeOut(seg(a.t, 0.45, 0.55));
        r.j('torso').rotation.x = 0.5 * seg(a.t, 0.45, 0.55);
        r.j('hips').position.y -= 0.12 * seg(a.t, 0.45, 0.55);
      }
      break;
    }
    case 'windupM':
    case 'strike': {
      // A swipe with the bow when the knight gets too close.
      const k = a.name === 'strike' ? easeOut(seg(a.t, 0, 0.1)) : 0;
      r.j('armL').rotation.x = mix(-2.2, 0.2, k);
      r.j('armL').rotation.z = mix(0.9, -0.4, k);
      r.j('torso').rotation.y = mix(0.5, -0.5, k);
      break;
    }
    case 'hurt':
      r.j('torso').rotation.x = -0.3;
      r.j('head').rotation.x = -0.3;
      break;
    case 'vault': {
      // Crouched to spring, then tucked in the air.
      const c = a.t < 0.3 ? ease(seg(a.t, 0, 0.3)) : 1 - ease(seg(a.t, 0.55, 0.85));
      r.j('hips').position.y -= 0.25 * c;
      r.j('legR').rotation.x = -0.9 * c;
      r.j('legL').rotation.x = -0.7 * c;
      r.j('torso').rotation.x = 0.35 * c;
      r.j('armL').rotation.x = -0.6 * c;
      break;
    }
    case 'stun':
      r.j('hips').position.y = 0.55;
      r.j('legR').rotation.x = -1.2;
      r.j('torso').rotation.x = 0.4;
      r.j('head').rotation.z = Math.sin(a.time * 5) * 0.35;
      r.j('armL').rotation.x = -0.2;
      break;
    case 'dead':
      fallDown(r, a, 0.6);
      break;
  }
}

// ---------- the warhorse ----------

export function makeHorse(): Model {
  const r = new Rig({ shadow: 1.5 });
  const coat = '#5a3a28', dark = '#3a2418', mane = '#1a1410', hoof = '#2a2420';
  r.joint('body', 'root', 0, 1.12, 0);
  r.joint('neck', 'body', 0, 0.18, 0.78);
  r.joint('head', 'neck', 0, 0.62, 0.22);
  r.joint('tail', 'body', 0, 0.12, -0.92);
  r.joint('saddle', 'body', 0, 0.3, 0.02);
  for (const [n, x, z] of [['legFL', 0.22, 0.62], ['legFR', -0.22, 0.62], ['legBL', 0.22, -0.66], ['legBR', -0.22, -0.66]] as [string, number, number][]) r.joint(n, 'body', x, -0.12, z);
  r.part('body', (g) => {
    g.box(0, -0.3, 0, 0.62, 0.62, 1.9, coat);
    g.box(0, -0.34, 0, 0.56, 0.12, 1.7, dark);
    // Barding: a blue caparison with gold trim, the knight's colours.
    g.box(0, -0.18, 0, 0.66, 0.46, 1.1, '#2c62b0');
    g.box(0, -0.2, 0, 0.67, 0.06, 1.12, '#feae34');
    g.box(0, 0.28, 0.05, 0.5, 0.1, 0.62, '#4a3424');
    g.box(0, 0.33, -0.22, 0.46, 0.14, 0.1, '#4a3424');
  });
  r.part('neck', (g) => {
    g.push().rotateX(-0.55);
    g.box(0, 0, 0, 0.34, 0.8, 0.42, coat);
    g.box(0, 0.05, -0.2, 0.1, 0.78, 0.1, mane);
    g.pop();
  });
  r.part('head', (g, gl) => {
    g.box(0, -0.18, 0.12, 0.3, 0.3, 0.62, coat);
    g.box(0, -0.2, 0.4, 0.24, 0.24, 0.12, dark);
    g.box(0, -0.06, 0.2, 0.08, 0.1, 0.5, '#e8e0d0');
    for (const s of [-1, 1]) {
      g.box(s * 0.1, 0.02, -0.12, 0.06, 0.16, 0.06, coat);
      g.box(s * 0.155, -0.08, 0.05, 0.02, 0.05, 0.05, '#0a0808');
    }
    g.box(0, -0.2, -0.05, 0.34, 0.08, 0.08, '#4a3424');
    gl.box(0, -0.1, 0.44, 0.02, 0.02, 0.02, [0.2, 0.2, 0.2]);
  });
  r.part('tail', (g) => {
    g.push().rotateX(0.5);
    g.box(0, -0.7, 0, 0.14, 0.72, 0.1, mane);
    g.pop();
  });
  const leg = (g: Geo) => {
    g.box(0, -0.98, 0, 0.14, 0.98, 0.16, coat);
    g.box(0, -1.0, 0.01, 0.16, 0.14, 0.18, hoof);
    g.box(0, -0.86, 0.01, 0.16, 0.1, 0.18, '#d8d0c0');
  };
  for (const l of ['legFL', 'legFR', 'legBL', 'legBR']) r.part(l, leg);
  return new Model(r, horsePose, 1.6);
}

// ---------- the Thornstag ----------

/**
 * The Thornstag, the Old Wood's great beast (the prototype's second mount): the
 * warhorse's frame, so it rides the same, but slimmer and taller, with a pale belly,
 * antlers grown over with the Warden's thorns, and a mossy saddle-cloth.
 */
export function makeStag(): Model {
  const r = new Rig({ shadow: 1.4 });
  const coat = '#8a5a36', dark = '#5e3a22', belly = '#e8dcc0', antler = '#e8dcb0', thorn = '#4a5e2a', hoof = '#2a2420';
  r.joint('body', 'root', 0, 1.2, 0);
  r.joint('neck', 'body', 0, 0.2, 0.72);
  r.joint('head', 'neck', 0, 0.7, 0.2);
  r.joint('tail', 'body', 0, 0.1, -0.82);
  r.joint('saddle', 'body', 0, 0.26, 0.02);
  for (const [n, x, z] of [['legFL', 0.18, 0.58], ['legFR', -0.18, 0.58], ['legBL', 0.18, -0.6], ['legBR', -0.18, -0.6]] as [string, number, number][]) r.joint(n, 'body', x, -0.1, z);
  r.part('body', (g) => {
    g.box(0, -0.28, 0, 0.52, 0.56, 1.7, coat);
    g.box(0, -0.52, 0, 0.44, 0.1, 1.5, belly);
    // A saddle-cloth of moss and bark, fern fronds hanging from it.
    g.box(0, -0.14, 0, 0.56, 0.4, 0.9, '#44603a', { kind: K.Cloth });
    g.box(0, 0.24, 0.05, 0.44, 0.1, 0.56, '#5a3a26');
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) g.box(s * 0.29, -0.42, -0.3 + k * 0.3, 0.02, 0.22, 0.1, '#5a8a3a', { wind: 0.5 });
  });
  r.part('neck', (g) => {
    g.push().rotateX(-0.45);
    g.box(0, 0, 0, 0.28, 0.82, 0.34, coat);
    g.box(0, -0.05, 0.14, 0.2, 0.6, 0.1, belly);
    g.pop();
  });
  r.part('head', (g, gl) => {
    g.box(0, -0.14, 0.1, 0.26, 0.26, 0.52, coat);
    g.box(0, -0.18, 0.36, 0.2, 0.18, 0.1, dark);
    for (const s of [-1, 1]) {
      g.box(s * 0.16, 0.02, -0.08, 0.14, 0.06, 0.1, coat); // ears
      g.box(s * 0.135, -0.06, 0.12, 0.02, 0.05, 0.05, '#0a0808');
      // Antlers: a beam up and out, tines forward, thorns and berries grown into them.
      const base: [number, number, number] = [s * 0.08, 0.05, -0.02];
      const mid: [number, number, number] = [s * 0.34, 0.5, -0.12];
      const tip: [number, number, number] = [s * 0.5, 0.95, -0.02];
      g.beam(base, mid, 0.035, antler);
      g.beam(mid, tip, 0.03, antler);
      g.beam(mid, [s * 0.3, 0.72, 0.18], 0.025, antler);
      g.beam([s * 0.44, 0.78, -0.06], [s * 0.62, 0.86, 0.14], 0.022, antler);
      g.beam([s * 0.2, 0.28, -0.07], [s * 0.36, 0.62, 0.02], 0.028, thorn);
      g.box(s * 0.28, 0.46, -0.08, 0.06, 0.06, 0.06, '#d02a3a');
      gl.box(s * 0.4, 0.7, -0.08, 0.05, 0.05, 0.05, [1.6, 2.2, 0.5]);
    }
  });
  r.part('tail', (g) => {
    g.push().rotateX(0.9);
    g.box(0, -0.18, 0, 0.14, 0.2, 0.08, belly);
    g.pop();
  });
  const leg = (g: Geo) => {
    g.box(0, -1.06, 0, 0.11, 1.06, 0.13, coat);
    g.box(0, -1.08, 0.01, 0.12, 0.1, 0.15, hoof);
  };
  for (const l of ['legFL', 'legFR', 'legBL', 'legBR']) r.part(l, leg);
  return new Model(r, horsePose, 1.6);
}

function horsePose(r: Rig, a: Anim) {
  const sp = clamp(a.speed, 0, 1.6);
  const gallop = sp > 0.9;
  const s = Math.sin(a.phase), c = Math.cos(a.phase);
  // Trot: diagonal pairs. Gallop: front and back pairs, with the body rocking.
  const amp = 0.55 * Math.min(1, sp * 1.2);
  if (gallop) {
    r.j('legFL').rotation.x = -s * 0.8;
    r.j('legFR').rotation.x = -Math.sin(a.phase + 0.5) * 0.8;
    r.j('legBL').rotation.x = Math.sin(a.phase + 1.6) * 0.8;
    r.j('legBR').rotation.x = Math.sin(a.phase + 2.1) * 0.8;
    r.j('body').rotation.x = c * 0.08;
    r.j('neck').rotation.x = -c * 0.12;
  } else {
    r.j('legFL').rotation.x = s * amp;
    r.j('legBR').rotation.x = s * amp;
    r.j('legFR').rotation.x = -s * amp;
    r.j('legBL').rotation.x = -s * amp;
  }
  r.j('body').position.y += Math.abs(c) * 0.08 * Math.min(1, sp);
  r.j('tail').rotation.x = -0.2 - sp * 0.4 + Math.sin(a.time * 3) * 0.08;
  r.j('tail').rotation.z = Math.sin(a.time * 1.7) * 0.15;
  // Idle: breathing, an ear-flick nod, and now and then a graze.
  if (sp < 0.1 && a.name === 'idle') {
    const graze = Math.max(0, Math.sin(a.time * 0.35) - 0.6) * 2.5;
    r.j('neck').rotation.x = graze * 0.9 + Math.sin(a.time * 1.1) * 0.03;
    r.j('head').rotation.x = graze * 0.4;
  }
  switch (a.name) {
    case 'rear': {
      // Up on the hind legs, forelegs pawing, then down hard.
      const k = Math.sin(clamp(a.t / 0.35, 0, 1) * Math.PI);
      r.j('body').rotation.x = -0.7 * k;
      r.j('body').position.y += 0.55 * k;
      r.j('legFL').rotation.x = -1.1 * k + Math.sin(a.t * 30) * 0.3 * k;
      r.j('legFR').rotation.x = -0.9 * k - Math.sin(a.t * 30) * 0.3 * k;
      r.j('legBL').rotation.x = 0.55 * k;
      r.j('legBR').rotation.x = 0.55 * k;
      r.j('neck').rotation.x = -0.4 * k;
      break;
    }
    case 'kick': {
      const k = Math.sin(clamp(a.t / 0.35, 0, 1) * Math.PI);
      r.j('body').rotation.x = -0.35 * k;
      r.j('body').position.y += 0.25 * k;
      r.j('legFL').rotation.x = -1.3 * k;
      r.j('legFR').rotation.x = -1.0 * k;
      break;
    }
    case 'charge':
      r.j('neck').rotation.x = 0.35;
      r.j('head').rotation.x = 0.2;
      break;
    case 'hurt':
      r.j('neck').rotation.x = -0.5 * Math.max(0, 1 - a.t * 3);
      break;
  }
}

// ---------- critters ----------

export function makeChicken(): Model {
  const r = new Rig({ shadow: 0.35 });
  r.joint('body', 'root', 0, 0.16, 0);
  r.joint('head', 'body', 0, 0.14, 0.12);
  r.joint('legL', 'root', 0.04, 0.16, 0);
  r.joint('legR', 'root', -0.04, 0.16, 0);
  const white = '#e8e2d4', red = '#c8302a', yellow = '#e0a030';
  r.part('body', (g) => {
    g.box(0, 0, 0, 0.18, 0.16, 0.24, white);
    g.box(0, 0.06, -0.14, 0.12, 0.12, 0.06, white);
  });
  r.part('head', (g) => {
    g.box(0, 0, 0, 0.1, 0.12, 0.1, white);
    g.box(0, 0.1, 0.01, 0.03, 0.05, 0.08, red);
    g.box(0, 0.04, 0.07, 0.04, 0.03, 0.05, yellow);
    g.box(0, 0.0, 0.05, 0.03, 0.04, 0.02, red);
  });
  const leg = (g: Geo) => g.box(0, -0.16, 0, 0.02, 0.16, 0.02, yellow);
  r.part('legL', leg);
  r.part('legR', leg);
  return new Model(r, (rig, a) => {
    const s = Math.sin(a.phase * 2);
    rig.j('legL').rotation.x = s * 0.7 * Math.min(1, a.speed * 3);
    rig.j('legR').rotation.x = -s * 0.7 * Math.min(1, a.speed * 3);
    if (a.name === 'peck') rig.j('head').rotation.x = Math.max(0, Math.sin(a.t * 12)) * 1.1;
    if (a.name === 'flee') rig.j('body').position.y += Math.abs(Math.sin(a.time * 20)) * 0.06;
  }, 0.25);
}

export function makeRabbit(): Model {
  const r = new Rig({ shadow: 0.3 });
  r.joint('body', 'root', 0, 0.12, 0);
  const fur = '#8a7058', light = '#c8b8a0';
  r.part('body', (g, gl) => {
    g.box(0, -0.06, 0, 0.16, 0.16, 0.26, fur);
    g.box(0, 0.04, 0.12, 0.12, 0.12, 0.12, fur);
    g.box(-0.03, 0.14, 0.1, 0.03, 0.14, 0.03, fur);
    g.box(0.03, 0.14, 0.1, 0.03, 0.14, 0.03, fur);
    g.box(0, -0.02, -0.15, 0.07, 0.07, 0.05, light);
    gl.box(0.05, 0.1, 0.18, 0.01, 0.02, 0.01, [0.3, 0.2, 0.2]);
  });
  return new Model(r, (rig, a) => {
    // Hops: the body bobs up and pitches with each bound.
    const hop = a.speed > 0.05 ? Math.abs(Math.sin(a.phase)) : 0;
    rig.j('body').position.y += hop * 0.18;
    rig.j('body').rotation.x = hop * -0.25;
  }, 0.35);
}

export function makeSquirrel(): Model {
  const r = new Rig({ shadow: 0.22 });
  r.joint('body', 'root', 0, 0.08, 0);
  r.joint('tail', 'body', 0, 0.02, -0.1);
  const fur = '#8a4a28', light = '#c8a080';
  r.part('body', (g, gl) => {
    g.box(0, -0.04, 0, 0.1, 0.1, 0.18, fur);
    g.box(0, 0.03, 0.09, 0.08, 0.08, 0.08, fur);
    g.box(-0.025, 0.1, 0.08, 0.025, 0.04, 0.02, fur);
    g.box(0.025, 0.1, 0.08, 0.025, 0.04, 0.02, fur);
    g.box(0, -0.03, 0.06, 0.06, 0.05, 0.08, light);
    gl.box(0.035, 0.07, 0.13, 0.01, 0.015, 0.01, [0.25, 0.2, 0.2]);
  });
  r.part('tail', (g) => {
    g.box(0, 0, -0.04, 0.08, 0.1, 0.08, '#a05a30');
    g.box(0, 0.1, -0.08, 0.1, 0.12, 0.08, '#a05a30');
    g.box(0, 0.2, -0.04, 0.09, 0.08, 0.08, '#b8703a');
  });
  return new Model(r, (rig, a) => {
    const hop = a.speed > 0.05 ? Math.abs(Math.sin(a.phase)) : 0;
    rig.j('body').position.y += hop * 0.1;
    rig.j('body').rotation.x = hop * -0.3;
    rig.j('tail').rotation.x = -0.2 + Math.sin(a.time * 3) * 0.1 + hop * 0.4;
    if (a.name === 'peck') rig.j('body').rotation.x = -0.5 + Math.sin(a.t * 10) * 0.05;
  }, 0.3);
}

/** Four-legged critters share a trot: diagonal legs swing together. */
function quadGait(rig: Rig, a: Anim, swing: number) {
  const s = Math.sin(a.phase), k = Math.min(1, a.speed * 2) * swing;
  rig.j('legFL').rotation.x = s * k;
  rig.j('legBR').rotation.x = s * k;
  rig.j('legFR').rotation.x = -s * k;
  rig.j('legBL').rotation.x = -s * k;
}

export function makeFox(): Model {
  const r = new Rig({ shadow: 0.45 });
  r.joint('body', 'root', 0, 0.3, 0);
  r.joint('head', 'body', 0, 0.06, 0.24);
  r.joint('tail', 'body', 0, 0.02, -0.24);
  for (const [n, x, z] of [['legFL', 0.06, 0.15], ['legFR', -0.06, 0.15], ['legBL', 0.06, -0.15], ['legBR', -0.06, -0.15]] as [string, number, number][]) r.joint(n, 'root', x, 0.26, z);
  const fur = '#b8582a', white = '#e8e2d4', dark = '#2a2020';
  r.part('body', (g) => {
    g.box(0, -0.08, 0, 0.18, 0.16, 0.46, fur);
    g.box(0, -0.09, 0.08, 0.12, 0.05, 0.25, white);
  });
  r.part('head', (g, gl) => {
    g.box(0, -0.06, 0, 0.16, 0.14, 0.14, fur);
    g.box(0, -0.07, 0.11, 0.08, 0.07, 0.12, white);
    g.box(0, -0.05, 0.17, 0.03, 0.03, 0.02, dark);
    for (const s of [-1, 1]) g.box(s * 0.05, 0.08, -0.02, 0.05, 0.08, 0.03, fur);
    gl.box(0.045, 0.0, 0.07, 0.015, 0.015, 0.01, [1.8, 1.4, 0.4]);
    gl.box(-0.045, 0.0, 0.07, 0.015, 0.015, 0.01, [1.8, 1.4, 0.4]);
  });
  r.part('tail', (g) => {
    g.box(0, -0.06, -0.14, 0.1, 0.1, 0.3, fur);
    g.box(0, -0.05, -0.32, 0.09, 0.09, 0.08, white);
  });
  const leg = (g: Geo) => g.box(0, -0.26, 0, 0.04, 0.26, 0.04, dark);
  for (const n of ['legFL', 'legFR', 'legBL', 'legBR']) r.part(n, leg);
  return new Model(r, (rig, a) => {
    quadGait(rig, a, a.name === 'flee' ? 0.9 : 0.55);
    rig.j('body').position.y += Math.abs(Math.cos(a.phase)) * 0.03 * Math.min(1, a.speed * 2);
    rig.j('tail').rotation.x = -0.25 + Math.sin(a.time * 2.5) * 0.08;
    rig.j('tail').rotation.y = Math.sin(a.time * 1.7) * 0.25;
    if (a.name === 'peck') rig.j('head').rotation.x = 0.6 + Math.sin(a.t * 6) * 0.1;
  }, 0.55);
}

export function makeDeer(): Model {
  const r = new Rig({ shadow: 0.7 });
  r.joint('body', 'root', 0, 0.72, 0);
  r.joint('neck', 'body', 0, 0.08, 0.34);
  r.joint('head', 'neck', 0, 0.36, 0.08);
  for (const [n, x, z] of [['legFL', 0.1, 0.3], ['legFR', -0.1, 0.3], ['legBL', 0.1, -0.3], ['legBR', -0.1, -0.3]] as [string, number, number][]) r.joint(n, 'root', x, 0.68, z);
  const fur = '#7a5a3a', dark = '#4a3424', white = '#d8ccb8', antler = '#c8b890';
  r.part('body', (g) => {
    g.box(0, -0.16, 0, 0.3, 0.32, 0.8, fur);
    g.box(0, -0.12, -0.41, 0.2, 0.18, 0.04, white);
    g.box(0, -0.02, -0.43, 0.06, 0.1, 0.05, white);
  });
  r.part('neck', (g) => {
    g.push().rotateX(-0.45);
    g.box(0, 0, 0, 0.14, 0.42, 0.16, fur);
    g.pop();
  });
  r.part('head', (g, gl) => {
    g.box(0, -0.05, 0.03, 0.14, 0.14, 0.2, fur);
    g.box(0, -0.06, 0.16, 0.09, 0.08, 0.1, dark);
    for (const s of [-1, 1]) {
      g.box(s * 0.09, 0.07, -0.02, 0.07, 0.05, 0.03, fur);
      g.beam([s * 0.04, 0.08, 0], [s * 0.2, 0.42, -0.05], 0.018, antler);
      g.beam([s * 0.13, 0.25, -0.03], [s * 0.1, 0.4, 0.08], 0.015, antler);
      g.beam([s * 0.17, 0.35, -0.04], [s * 0.3, 0.48, -0.02], 0.014, antler);
    }
    gl.box(0.07, 0.02, 0.08, 0.012, 0.015, 0.01, [0.4, 0.4, 0.45]);
    gl.box(-0.07, 0.02, 0.08, 0.012, 0.015, 0.01, [0.4, 0.4, 0.45]);
  });
  const leg = (g: Geo) => {
    g.box(0, -0.4, 0, 0.07, 0.4, 0.08, fur);
    g.box(0, -0.68, 0, 0.045, 0.3, 0.045, dark);
  };
  for (const n of ['legFL', 'legFR', 'legBL', 'legBR']) r.part(n, leg);
  return new Model(r, (rig, a) => {
    const fleeing = a.name === 'flee';
    quadGait(rig, a, fleeing ? 0.8 : 0.4);
    // Bounding when it bolts.
    if (fleeing && a.speed > 0.2) {
      const b = Math.abs(Math.sin(a.phase * 0.5));
      rig.j('body').position.y += b * 0.18;
      rig.j('body').rotation.x = Math.sin(a.phase * 0.5) * 0.15;
    }
    rig.j('neck').rotation.x = a.name === 'peck' ? 1.15 : fleeing ? -0.1 : 0.05 * Math.sin(a.time * 0.7);
    if (a.name === 'peck') rig.j('head').rotation.x = 0.3 + Math.sin(a.t * 3) * 0.08;
    if (a.name === 'idle') rig.j('head').rotation.y = Math.sin(a.time * 0.5) * 0.5;
  }, 0.9);
}

export function makeOwl(): Model {
  const r = new Rig({ shadow: 0.25 });
  r.joint('body', 'root', 0, 0.0, 0);
  r.joint('head', 'body', 0, 0.28, 0);
  r.joint('wingL', 'body', 0.1, 0.24, -0.02);
  r.joint('wingR', 'body', -0.1, 0.24, -0.02);
  const brown = '#6a5a48', chest = '#a89478', dark = '#3a3028';
  r.part('body', (g) => {
    g.box(0, 0, 0, 0.2, 0.28, 0.18, brown);
    g.box(0, 0.03, 0.08, 0.14, 0.2, 0.03, chest);
    g.box(0, -0.05, -0.1, 0.1, 0.1, 0.06, dark);
    g.box(-0.04, -0.02, 0.07, 0.03, 0.04, 0.04, '#c8a040');
    g.box(0.04, -0.02, 0.07, 0.03, 0.04, 0.04, '#c8a040');
  });
  r.part('head', (g, gl) => {
    g.box(0, 0, 0, 0.19, 0.16, 0.17, brown);
    g.box(0, 0.02, 0.085, 0.15, 0.11, 0.02, chest);
    for (const s of [-1, 1]) g.box(s * 0.07, 0.16, -0.01, 0.04, 0.07, 0.04, brown);
    g.box(0, 0.02, 0.1, 0.025, 0.04, 0.03, dark);
    gl.box(0.04, 0.06, 0.098, 0.035, 0.035, 0.01, [3.0, 2.3, 0.4]);
    gl.box(-0.04, 0.06, 0.098, 0.035, 0.035, 0.01, [3.0, 2.3, 0.4]);
  });
  const wing = (s: number) => (g: Geo) => g.box(s * 0.02, -0.22, 0, 0.04, 0.24, 0.16, dark);
  r.part('wingL', wing(1));
  r.part('wingR', wing(-1));
  return new Model(r, (rig, a) => {
    if (a.name === 'fly') {
      const f = Math.sin(a.time * 22);
      rig.j('wingL').rotation.z = 1.2 + f * 0.9;
      rig.j('wingR').rotation.z = -1.2 - f * 0.9;
      rig.j('body').rotation.x = 0.5;
    } else {
      // Perched: the head turns to watch (v = head yaw), with the odd blink-bob.
      rig.j('head').rotation.y = a.v ?? 0;
      rig.j('head').rotation.z = Math.sin(a.time * 0.8) * 0.12;
      rig.j('body').position.y += Math.sin(a.time * 1.3) * 0.005;
    }
  }, 1);
}

// ---------- villagers ----------

export function makeVillager(lookName: string): Model {
  const L: Look = LOOKS[lookName] ?? LOOKS.woman;
  const r = new Rig({ shadow: 0.6 });
  const legLen = L.dress ? 0.7 : 0.78;
  r.joint('hips', 'root', 0, legLen, 0);
  r.joint('legR', 'hips', -0.1, 0, 0);
  r.joint('legL', 'hips', 0.1, 0, 0);
  r.joint('torso', 'hips', 0, 0.02, 0);
  r.joint('head', 'torso', 0, 0.55, 0.02);
  r.joint('armR', 'torso', -0.24, 0.48, 0);
  r.joint('armL', 'torso', 0.24, 0.48, 0);
  const leg = (g: Geo) => {
    g.box(0, -legLen, 0, 0.13, legLen, 0.14, L.pants);
    g.box(0, -legLen, 0.03, 0.14, 0.12, 0.2, L.boots);
  };
  r.part('legR', leg);
  r.part('legL', leg);
  r.part('hips', (g) => {
    if (L.dress) g.cyl(0, -legLen + 0.12, 0, 0.3, 0.2, legLen - 0.1, 8, L.cloth);
    else g.box(0, -0.15, 0, 0.34, 0.18, 0.24, L.pants);
  });
  r.part('torso', (g) => {
    g.box(0, 0, 0, 0.36, 0.55, 0.24, L.cloth);
    g.box(0, 0.02, 0, 0.38, 0.06, 0.26, '#3a2a1a');
    if (L.apron) g.box(0, -0.3, 0.11, 0.3, 0.72, 0.06, L.apron);
  });
  r.part('head', (g) => {
    g.box(0, 0, 0, 0.26, 0.28, 0.26, L.skin);
    g.box(-0.06, 0.12, 0.131, 0.04, 0.04, 0.01, '#1a1420');
    g.box(0.06, 0.12, 0.131, 0.04, 0.04, 0.01, '#1a1420');
    if (!L.bald) {
      g.box(0, 0.2, -0.02, 0.28, 0.1, 0.3, L.hair);
      g.box(0, 0.02, -0.12, 0.28, 0.2, 0.06, L.hair);
      if (L.longHair) g.box(0, -0.2, -0.12, 0.28, 0.3, 0.06, L.hair);
    } else g.box(0, 0.08, -0.12, 0.28, 0.08, 0.04, L.hair);
    if (L.beard) g.box(0, -0.06, 0.1, 0.24, 0.14, 0.08, L.beard);
    if (L.hat === 'hood') {
      g.box(0, 0.12, -0.03, 0.32, 0.22, 0.32, L.hatCol!);
      g.box(0, -0.1, -0.13, 0.32, 0.24, 0.1, L.hatCol!);
    } else if (L.hat === 'helmet') {
      g.box(0, 0.18, 0, 0.3, 0.14, 0.3, L.hatCol!);
      g.box(0, 0.3, 0, 0.14, 0.06, 0.14, L.hatCol!);
    }
  });
  const arm = (g: Geo) => {
    g.box(0, -0.46, 0, 0.1, 0.46, 0.11, L.cloth2);
    g.box(0, -0.54, 0, 0.09, 0.09, 0.09, L.skin);
  };
  r.part('armR', (g) => {
    arm(g);
    // A fishing rod (held out and up when fishing, the arm raised), its line hanging to the water.
    if (L.prop === 'rod') {
      g.beam([0, -0.54, 0.02], [0, -1.58, 1.61], 0.018, '#6a4a2a');
      g.beam([0, -1.58, 1.61], [0, -2.25, 0.36], 0.006, '#d8d8c8');
    }
  });
  r.part('armL', (g) => {
    arm(g);
    if (L.prop === 'basket') {
      g.box(0, -0.78, 0.04, 0.3, 0.2, 0.24, '#8a6a3a');
      g.box(0, -0.6, 0.04, 0.03, 0.1, 0.2, '#6a4a2a');
      g.box(0, -0.66, 0.04, 0.24, 0.05, 0.18, '#7a2a3a');
    }
  });
  if (L.prop === 'sack') r.part('torso', (g) => g.box(0, 0.04, -0.24, 0.34, 0.44, 0.22, '#8a7a5a'));
  const m = new Model(r, villagerPose, 0.9);
  r.scale = L.h < 18 ? 0.72 : L.h < 20 ? 0.88 : 1;
  return m;
}

function villagerPose(r: Rig, a: Anim) {
  r.j('armR').rotation.z = -0.08;
  r.j('armL').rotation.z = 0.08;
  gait(r, a, { hunch: 0.04, arm: 0.6 });
  if (a.name === 'talk') {
    r.j('armR').rotation.x = -0.9 + Math.sin(a.time * 4) * 0.25;
    r.j('armR').rotation.z = -0.3;
    r.j('head').rotation.x = Math.sin(a.time * 3) * 0.06;
  }
  if (a.name === 'cheer') {
    const k = Math.abs(Math.sin(a.time * 5));
    r.j('armR').rotation.x = -2.8;
    r.j('armL').rotation.x = -2.8;
    r.j('hips').position.y += k * 0.12;
  }
  // Sitting (by the fire, on the jetty): low, legs out in front.
  if (a.name === 'sit' || a.name === 'fish') {
    r.j('hips').position.y *= 0.52;
    r.j('legR').rotation.x = -1.45;
    r.j('legL').rotation.x = -1.3;
    r.j('armR').rotation.x = -0.45;
    r.j('armL').rotation.x = -0.4;
    r.j('head').rotation.x = Math.sin(a.time * 0.4) * 0.08;
  }
  if (a.name === 'fish') {
    r.j('armR').rotation.x = -1.1 + Math.sin(a.time * 0.7) * 0.04;
    r.j('armL').rotation.x = -0.95;
  }
  // Bent to a task (washing at the shore, weeding): arms working.
  if (a.name === 'work') {
    const k = Math.sin(a.time * 3);
    r.j('hips').position.y -= 0.14;
    r.j('torso').rotation.x = 0.6 + k * 0.08;
    r.j('armR').rotation.x = -0.9 + k * 0.5;
    r.j('armL').rotation.x = -0.8 - k * 0.4;
  }
  // A child at play: hopping, arms flung up.
  if (a.name === 'play') {
    const k = Math.abs(Math.sin(a.time * 6));
    r.j('hips').position.y += k * 0.16;
    r.j('armR').rotation.x = -1.9 * k;
    r.j('armL').rotation.x = -1.2 * (1 - k);
  }
  if (a.name === 'captive') {
    r.j('hips').position.y *= 0.62;
    r.j('legR').rotation.x = -1.4;
    r.j('legL').rotation.x = -1.2;
    r.j('torso').rotation.x = 0.4;
    r.j('head').rotation.x = 0.3;
  }
}
