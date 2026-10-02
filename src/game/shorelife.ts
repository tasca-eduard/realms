import * as THREE from 'three';
import { Geo } from '../engine/geo';
import { glowMaterial, K, shared, worldMaterial } from '../engine/materials';
import type { PSpec } from '../engine/particles';
import { Rig } from '../engine/rig';
import { clamp, fbm, mulberry32 } from '../engine/util';
import { NONE, T } from '../world/grid';
import { shoreLife, type HaulOut, type Perch } from '../world/shorelife';
import type { Game } from './game';
import { Model } from './models';

// ---------------------------------------------------------------------------
// Life on the Sunken Reef's shore and surface, so that the coast is alive at night: gulls wheeling over the
// strand, the lighthouse, the wreck's rock and the village, landing on posts, rocks and roofs and taking off
// when the knight comes near; seals basking on the skerries, sliding into the water when he comes at them and
// hauling out again once he's gone; crabs scuttling on the beaches; surf lapping along every shore and breaking
// over the sandbar, spray against the cliffs and the rocks; fish leaping; once the lamp burns, fishermen's boats
// out, a lantern on each, a fisherman rowing and casting; driftwood and floats bobbing on the swell; moths over the
// dune grass; mist over the water at the edges. Where it all sits is src/world/shorelife.ts; the realm's story
// (story/aqua.ts) applies it and ticks it. Cheap: only what's near the camera moves.
// ---------------------------------------------------------------------------

/** How near the camera's focus things are moved (as the critters: a diamond, |dx| + |dz|). */
const NEAR = 44;

const C = {
  gull: '#e8e8e2', gullGrey: '#9aa2ac', gullTip: '#26262c', beak: '#e0b040', beakSpot: '#c03a2a', gullLeg: '#d89a50',
  seal: '#9a9284', sealDark: '#625a52', sealBelly: '#c8bca8',
  crab: '#cdb48a', crabTop: '#e6d6b2', crabLeg: '#a8936c',
  hull: '#5a4632', hullDark: '#3e2e22', thwart: '#7a6048', oilskin: '#c8a03a', oilskinDark: '#9a7a2a', skin: '#c89a78', beard: '#a8a49c', rod: '#4a3a2a',
  fish: '#b8c8cc', fishBack: '#4a6478', fishFin: '#7a8a94',
  drift: '#948a78', driftDark: '#6e6556', cork: '#a87c48', rope: '#8a7a5a', barrel: '#6a4a2e', hoop: '#3a3a40',
};

/** Spray thrown up where a wave meets rock; foam left on the water; drops off a leaping fish. */
const SPRAY: PSpec = { color: [1.8, 2.1, 2.3], color2: [0.6, 0.8, 1.0], size: 2, size2: 1, life: 0.9, gravity: 8, drag: 0.6 };
/** The spume a breaking wave throws off a rock face: soft pale puffs hanging a moment. */
const SPUME: PSpec = { color: [0.75, 0.85, 0.9], color2: [0.4, 0.48, 0.55], size: 3, size2: 7, life: 1.2, gravity: 1.2, drag: 2.2, alpha: 0.55, soft: true };
const FROTH: PSpec = { color: [0.85, 0.95, 1.0], color2: [0.45, 0.55, 0.6], size: 2, size2: 4, life: 1.1, gravity: -0.1, drag: 3, alpha: 0.65, soft: true };
/** Moths over the dune grass and round the lanterns: pale, fluttering, catching the light. */
const MOTH: PSpec = { color: [2.6, 2.3, 1.5], color2: [1.6, 1.4, 0.9], size: 1, life: 6, wobble: 1.1, gravity: -0.02, fadeIn: 0.2, blink: true };

type V3 = [number, number, number];
const fin = (g: Geo, a: V3, b: V3, c: V3, col: string) => {
  g.tri(a, b, c, col);
  g.tri(a, c, b, col);
};

// ---------- the creatures ----------

/** A herring gull: white, grey-mantled, black wingtips, a yellow bill with its red spot. Perched its wings fold
 *  along its back; flying it flaps in bursts and glides with its wings crooked; v banks it, dur pitches it. */
function makeGull(): Model {
  const r = new Rig({ shadow: 0.3 });
  r.joint('body', 'root', 0, 0.2, 0);
  r.joint('head', 'body', 0, 0.06, 0.15);
  r.joint('legs', 'body', 0, -0.07, 0.01);
  for (const s of [1, -1]) {
    const w = s > 0 ? 'L' : 'R';
    r.joint('wing' + w, 'body', s * 0.06, 0.03, 0.03);
    r.joint('tip' + w, 'wing' + w, s * 0.3, 0, 0);
  }
  r.part('body', (g) => {
    g.box(0, -0.07, 0, 0.14, 0.13, 0.3, C.gull);
    g.box(0, -0.03, -0.2, 0.1, 0.05, 0.12, C.gullGrey);
    g.box(0, 0.05, -0.05, 0.13, 0.025, 0.2, C.gullGrey);
  });
  r.part('head', (g, gl) => {
    g.box(0, -0.03, 0.02, 0.1, 0.1, 0.12, C.gull);
    g.box(0, -0.01, 0.12, 0.035, 0.035, 0.09, C.beak);
    g.box(0, -0.035, 0.145, 0.03, 0.02, 0.02, C.beakSpot);
    for (const s of [-1, 1]) gl.box(s * 0.051, 0.02, 0.05, 0.01, 0.018, 0.018, [0.04, 0.04, 0.04]);
  });
  r.part('legs', (g) => {
    for (const s of [-1, 1]) g.box(s * 0.03, -0.13, 0.02, 0.02, 0.13, 0.02, C.gullLeg);
  });
  for (const s of [1, -1]) {
    const w = s > 0 ? 'L' : 'R';
    r.part('wing' + w, (g) => g.box(s * 0.15, -0.012, -0.02, 0.3, 0.025, 0.16, C.gullGrey));
    r.part('tip' + w, (g) => {
      g.box(s * 0.11, -0.01, -0.04, 0.22, 0.02, 0.11, C.gullGrey);
      g.box(s * 0.26, -0.01, -0.05, 0.1, 0.02, 0.08, C.gullTip);
    });
  }
  return new Model(r, (rig, a) => {
    const body = rig.j('body'), L = rig.j('wingL'), R = rig.j('wingR'), tL = rig.j('tipL'), tR = rig.j('tipR');
    const folded = a.name === 'perch';
    tL.scale.setScalar(folded ? 0.4 : 1);
    tR.scale.setScalar(folded ? 0.4 : 1);
    rig.j('legs').scale.setScalar(folded || a.name === 'land' ? 1 : 0.01);
    if (folded) {
      L.rotation.y = 1.45;
      R.rotation.y = -1.45;
      L.rotation.z = -0.2;
      R.rotation.z = 0.2;
      // Looking about, the odd bob of the head.
      rig.j('head').rotation.y = Math.sin(a.time * 0.7 + a.phase) * 0.6;
      rig.j('head').rotation.x = Math.max(0, Math.sin(a.time * 1.9 + a.phase * 3)) * 0.25;
      return;
    }
    body.rotation.z = a.v ?? 0;
    body.rotation.x = a.dur ?? 0;
    if (a.name === 'flap' || a.name === 'land') {
      const ph = a.time * (a.name === 'land' ? 13 : 9) + a.phase;
      L.rotation.z = 0.15 + Math.sin(ph) * 0.75;
      tL.rotation.z = Math.sin(ph - 0.8) * 0.5;
      R.rotation.z = -L.rotation.z;
      tR.rotation.z = -tL.rotation.z;
    } else {
      // Gliding: wings held out, crooked at the wrist, rocking a little.
      L.rotation.z = 0.2 + Math.sin(a.time * 2 + a.phase) * 0.05;
      tL.rotation.z = -0.25;
      R.rotation.z = -L.rotation.z;
      tR.rotation.z = 0.25;
    }
  }, 1);
}

/** A grey seal: a long spotted body, a round head with a dog's muzzle, front flippers, its hind flippers paired. */
function makeSeal(): Model {
  const r = new Rig({ shadow: 1 });
  r.joint('body', 'root', 0, 0.2, 0);
  r.joint('head', 'body', 0, 0.04, 0.42);
  r.joint('tail', 'body', 0, -0.03, -0.44);
  r.joint('finL', 'body', 0.18, -0.12, 0.2);
  r.joint('finR', 'body', -0.18, -0.12, 0.2);
  r.part('body', (g) => {
    g.sweep([[0, -0.03, -0.46], [0, 0, -0.2], [0, 0.02, 0.12], [0, 0.03, 0.44]], [0.11, 0.24, 0.27, 0.17], C.seal, { seg: 7, lumpy: 0.06, squash: 0.78, seed: 5 });
    g.box(0, -0.2, 0, 0.32, 0.05, 0.62, C.sealBelly);
    for (const [x, z, s] of [[0.08, 0.1, 0.07], [-0.1, -0.12, 0.06], [0.04, -0.28, 0.05], [-0.05, 0.28, 0.05], [0.13, -0.05, 0.04]]) g.box(x, 0.17 - Math.abs(x) * 0.6, z, s * 1.4, 0.03, s, C.sealDark);
  });
  r.part('head', (g, gl) => {
    g.blob(0, 0.04, 0.04, 0.15, 0.14, 0.16, C.seal, 17, { detail: 1, jitter: 0.06 });
    g.box(0, -0.02, 0.18, 0.12, 0.1, 0.1, C.seal);
    g.box(0, 0.0, 0.235, 0.06, 0.04, 0.02, '#1e1a18');
    for (const s of [-1, 1]) gl.box(s * 0.07, 0.08, 0.15, 0.03, 0.03, 0.02, [0.03, 0.03, 0.03]);
  });
  r.part('tail', (g) => {
    for (const s of [-1, 1]) {
      g.push().rotateY(s * 0.25);
      g.box(s * 0.05, -0.02, -0.12, 0.08, 0.03, 0.24, C.sealDark);
      g.pop();
    }
  });
  for (const s of [1, -1]) r.part(s > 0 ? 'finL' : 'finR', (g) => g.box(s * 0.04, -0.02, -0.02, 0.07, 0.03, 0.16, C.sealDark));
  return new Model(r, (rig, a) => {
    const head = rig.j('head'), tail = rig.j('tail'), body = rig.j('body');
    const ph = a.phase;
    if (a.name === 'bask') {
      // Lying out on its rock: the head rests and lifts, now and then head and tail curl up together (a banana).
      const curl = Math.max(0, Math.sin(a.time * 0.25 + ph * 7)) ** 3;
      head.rotation.x = 0.2 - Math.max(0, Math.sin(a.time * 0.5 + ph)) * 0.45 - curl * 0.4;
      tail.rotation.x = -0.05 - curl * 0.6;
      head.rotation.y = Math.sin(a.time * 0.3 + ph * 2) * 0.4;
      body.position.y += Math.sin(a.time * 1.4) * 0.006;
    } else if (a.name === 'alert') {
      head.rotation.x = -0.7;
      body.rotation.x = -0.15;
    } else if (a.name === 'slide') {
      body.rotation.x = 0.15;
      body.position.y += Math.abs(Math.sin(a.time * 9)) * 0.05;
      rig.j('finL').rotation.x = Math.sin(a.time * 9) * 0.7;
      rig.j('finR').rotation.x = -Math.sin(a.time * 9) * 0.7;
    } else {
      // Swimming at the surface: the head held up out of the water, the tail sculling.
      head.rotation.x = -0.75;
      body.rotation.x = -0.12;
      tail.rotation.y = Math.sin(a.time * 4 + ph) * 0.45;
      body.position.y += Math.sin(a.time * 1.6 + ph) * 0.03;
    }
  }, 1);
}

/** A shore crab, a ghost crab: small, a broad pale sand-tan shell, dark eyes on stalks, two claws held up, legs
 *  splayed (nothing like the sea's big red-orange crab foe with its armoured claw). It walks sideways. */
function makeCrab(): Model {
  const r = new Rig({ shadow: 0.3 });
  r.joint('body', 'root', 0, 0.08, 0);
  r.joint('clawL', 'body', 0.1, 0.0, 0.1);
  r.joint('clawR', 'body', -0.1, 0.0, 0.1);
  r.joint('legsL', 'body', 0.12, -0.01, -0.02);
  r.joint('legsR', 'body', -0.12, -0.01, -0.02);
  r.part('body', (g, gl) => {
    g.box(0, -0.03, 0, 0.26, 0.08, 0.18, C.crab, { top: C.crabTop });
    for (const s of [-1, 1]) {
      g.box(s * 0.04, 0.04, 0.07, 0.02, 0.06, 0.02, C.crab);
      gl.box(s * 0.04, 0.1, 0.07, 0.03, 0.03, 0.03, [0.05, 0.04, 0.04]);
    }
  });
  for (const s of [1, -1]) {
    r.part(s > 0 ? 'clawL' : 'clawR', (g) => {
      g.box(s * 0.02, -0.02, 0.04, 0.05, 0.04, 0.08, C.crab);
      g.box(s * 0.03, -0.03, 0.1, 0.08, 0.07, 0.08, C.crabTop);
    });
    r.part(s > 0 ? 'legsL' : 'legsR', (g) => {
      for (const z of [-0.07, 0, 0.07]) g.beam([0, 0, z], [s * 0.13, -0.1, z * 1.3], 0.012, C.crabLeg);
    });
  }
  return new Model(r, (rig, a) => {
    const s = Math.sin(a.phase * 2), k = Math.min(1, a.speed * 4);
    rig.j('legsL').rotation.z = s * 0.45 * k;
    rig.j('legsR').rotation.z = s * 0.45 * k;
    rig.j('body').position.y += Math.abs(s) * 0.015 * k;
    // Claws up and snapping when it stands its ground; waved now and then at rest.
    const wave = a.name === 'idle' ? Math.max(0, Math.sin(a.time * 1.3 + a.t * 5)) : 0;
    rig.j('clawL').rotation.x = -0.3 - wave * 0.6 + Math.sin(a.time * 14) * 0.1 * wave;
    rig.j('clawR').rotation.x = -0.3 - wave * 0.4;
  }, 0.18);
}

/** A fishing boat: a clinker hull with a coloured strake, thwarts, a net heaped in the bow, a lantern on a pole at
 *  the stern; a fisherman in oilskins and a sou'wester, his rod in his right hand, the oars in their rowlocks.
 *  Rowing ('row') the oars sweep; fishing he turns to the side and casts ('cast', t from 0) or waits ('wait'). */
function makeBoat(stripe: string): Model {
  const r = new Rig({ shadow: 1.6 });
  r.joint('hull', 'root', 0, 0, 0);
  r.joint('man', 'hull', 0, 0.12, -0.3);
  r.joint('head', 'man', 0, 0.62, 0);
  r.joint('armR', 'man', -0.21, 0.52, 0);
  r.joint('armL', 'man', 0.21, 0.52, 0);
  r.joint('rod', 'armR', 0, -0.4, 0.04);
  r.joint('tip', 'rod', 0, 0, 2.1);
  r.joint('oarL', 'hull', 0.52, 0.32, 0.25);
  r.joint('oarR', 'hull', -0.52, 0.32, 0.25);
  r.part('hull', (g, gl) => {
    g.box(0, -0.2, 0, 0.8, 0.14, 2.3, C.hullDark, { kind: K.Wood });
    for (const s of [-1, 1]) {
      g.box(s * 0.48, -0.12, -0.15, 0.08, 0.4, 2.0, C.hull, { kind: K.Wood });
      g.box(s * 0.5, 0.12, -0.15, 0.09, 0.08, 2.0, stripe, { kind: K.Wood });
      g.push().translate(s * 0.27, 0, 1.12).rotateY(s * 0.62);
      g.box(0, -0.12, 0, 0.08, 0.42, 0.66, C.hull, { kind: K.Wood });
      g.box(0, 0.12, 0, 0.09, 0.08, 0.66, stripe, { kind: K.Wood });
      g.pop();
    }
    g.box(0, -0.14, -1.17, 1.0, 0.42, 0.08, C.hull, { kind: K.Wood });
    g.box(0, -0.06, 1.38, 0.1, 0.5, 0.1, C.hullDark, { kind: K.Wood });
    for (const z of [0.25, -0.3, -0.95]) g.box(0, 0.04, z, 0.9, 0.05, 0.22, C.thwart, { kind: K.Wood });
    // The net heaped in the bow, a basket of the catch.
    g.blob(0, 0.0, 0.85, 0.32, 0.12, 0.3, '#6a6a52', 41, { kind: K.Cloth, flatBottom: true });
    g.cyl(0.2, -0.06, 0.4, 0.15, 0.17, 0.2, 7, '#8a7040', { kind: K.Wood });
    for (const s of [-1, 1]) g.box(0.2 + s * 0.05, 0.12, 0.4 + s * 0.03, 0.05, 0.03, 0.14, C.fish);
    // The lantern on its pole at the stern.
    g.box(0.36, -0.1, -1.05, 0.05, 1.6, 0.05, C.hullDark, { kind: K.Wood });
    g.box(0.36, 1.48, -0.92, 0.04, 0.04, 0.3, C.hullDark, { kind: K.Wood });
    g.box(0.36, 1.12, -0.8, 0.16, 0.04, 0.16, '#2a2a30', { kind: K.Metal });
    g.box(0.36, 1.4, -0.8, 0.18, 0.04, 0.18, '#2a2a30', { kind: K.Metal });
    gl.box(0.36, 1.16, -0.8, 0.13, 0.24, 0.13, [3.4, 2.2, 0.9], { kind: 1 });
  });
  r.part('man', (g) => {
    g.box(0, 0.06, 0, 0.36, 0.5, 0.24, C.oilskin, { kind: K.Cloth });
    for (const s of [-1, 1]) g.box(s * 0.1, 0.0, 0.2, 0.13, 0.13, 0.4, C.oilskinDark, { kind: K.Cloth });
  });
  r.part('head', (g) => {
    g.box(0, -0.06, 0, 0.2, 0.2, 0.2, C.skin);
    g.box(0, -0.1, 0.07, 0.18, 0.1, 0.08, C.beard);
    g.box(0, 0.11, -0.02, 0.36, 0.03, 0.36, C.oilskin, { kind: K.Cloth });
    g.box(0, 0.12, 0, 0.22, 0.1, 0.22, C.oilskin, { kind: K.Cloth });
  });
  for (const s of [1, -1]) r.part(s > 0 ? 'armL' : 'armR', (g) => g.box(0, -0.42, 0, 0.1, 0.44, 0.1, C.oilskin, { kind: K.Cloth }));
  r.part('rod', (g) => g.beam([0, 0, -0.2], [0, 0, 2.1], 0.016, C.rod));
  for (const s of [1, -1])
    r.part(s > 0 ? 'oarL' : 'oarR', (g) => {
      g.beam([-s * 0.45, 0.12, 0], [s * 1.25, -0.42, 0], 0.025, C.thwart);
      g.push().translate(s * 1.15, -0.39, 0).rotateZ(-s * 0.3);
      g.box(0, -0.02, 0, 0.36, 0.04, 0.16, C.thwart, { kind: K.Wood });
      g.pop();
    });
  return new Model(r, (rig, a) => {
    const t = a.time, man = rig.j('man'), arm = rig.j('armR'), rod = rig.j('rod');
    // The hull rides the swell.
    rig.j('hull').rotation.z = Math.sin(t * 1.3 + a.phase) * 0.06;
    rig.j('hull').rotation.x = Math.sin(t * 0.9 + a.phase * 2) * 0.04;
    if (a.name === 'row') {
      const ph = t * 2.2;
      for (const [n, s] of [['oarL', 1], ['oarR', -1]] as const) {
        rig.j(n).rotation.y = s * Math.sin(ph) * 0.5;
        rig.j(n).rotation.z = s * Math.cos(ph) * 0.14;
      }
      man.rotation.x = Math.sin(ph) * 0.22;
      arm.rotation.x = rig.j('armL').rotation.x = -1.3 + Math.sin(ph) * 0.35;
      rod.rotation.x = 1.2;
      rod.scale.setScalar(0.01);
      return;
    }
    rod.scale.setScalar(1);
    // Fishing: the oars shipped along the gunwales, the man turned to the side.
    rig.j('oarL').rotation.y = -1.3;
    rig.j('oarR').rotation.y = 1.3;
    man.rotation.y = -1.35;
    rig.j('armL').rotation.x = -0.9;
    rig.j('armL').rotation.z = -0.5;
    if (a.name === 'cast') {
      // Back over the shoulder, then the whip forward.
      const k = a.t;
      const back = k < 0.55 ? Math.min(1, k / 0.45) : Math.max(0, 1 - (k - 0.55) / 0.15);
      arm.rotation.x = -1.1 - back * 1.8;
      rod.rotation.x = -0.25 - back * 0.4;
    } else {
      arm.rotation.x = -1.0 + Math.sin(t * 0.8 + a.phase) * 0.05 - (a.v ?? 0) * 0.5;
      rod.rotation.x = -0.35 - (a.v ?? 0) * 0.6;
    }
  }, 1);
}

/** A fish leaping: silver, dark-backed, its tail beating. dur pitches it along its arc. */
function makeFish(): Model {
  const r = new Rig({ shadow: 0.3 });
  r.joint('body', 'root', 0, 0, 0);
  r.joint('tail', 'body', 0, 0, -0.15);
  r.part('body', (g, gl) => {
    g.box(0, -0.05, 0, 0.07, 0.11, 0.3, C.fish, { top: C.fishBack });
    g.box(0, 0.05, 0.0, 0.06, 0.02, 0.24, C.fishBack);
    fin(g, [0, 0.07, 0.04], [0, 0.13, -0.04], [0, 0.07, -0.08], C.fishFin);
    for (const s of [-1, 1]) gl.box(s * 0.036, 0.01, 0.1, 0.005, 0.025, 0.025, [0.05, 0.05, 0.05]);
  });
  r.part('tail', (g) => fin(g, [0, 0, 0.02], [0, 0.09, -0.12], [0, -0.09, -0.12], C.fishFin));
  return new Model(r, (rig, a) => {
    rig.j('tail').rotation.y = Math.sin(a.time * 28) * 0.55;
    rig.j('body').rotation.x = a.dur ?? 0;
  }, 1);
}

// ---------- the gulls ----------

/** Where the gulls wheel: over the crew's camp on the strand, round the lighthouse's lamp, over the wreck's rock,
 *  the village's jetty, the sandbar. */
const FLOCKS: { x: number; z: number; r: number; y: number }[] = [
  { x: 38, z: 31, r: 6.5, y: 7.5 },
  { x: 97, z: 29.5, r: 5, y: 12.5 },
  { x: 123, z: 47, r: 5.5, y: 7 },
  { x: 49, z: 66, r: 5, y: 7 },
  { x: 70, z: 29, r: 6, y: 6.5 },
];

class Gull {
  x = 0;
  y = 0;
  z = 0;
  model = makeGull();
  state: 'circle' | 'fly' | 'perch' = 'circle';
  /** On its circle: the angle, which way round, its own radius and height. */
  a = Math.random() * Math.PI * 2;
  dir = Math.random() < 0.5 ? 1 : -1;
  rad = 0.8 + Math.random() * 0.5;
  dy = (Math.random() - 0.5) * 2.5;
  t = 0;
  perch: Perch | null = null;
  /** Where it's flying to: a perch (to land), or back to its flock's circle. */
  goal: { x: number; y: number; z: number } | null = null;
  bank = 0;
  pitch = 0;
  flapT = Math.random() * 3;
  ph = Math.random() * 9;
  constructor(public flock: number, g: Game) {
    this.model.rig.scale = 1.2;
    this.model.rig.addTo(g.scene);
    this.model.rig.setCastShadow(false);
    this.t = 10 + Math.random() * 25;
    this.circlePos(0);
  }
  circlePos(dt: number) {
    const f = FLOCKS[this.flock];
    this.a += this.dir * dt * (5.2 / (f.r * this.rad));
    this.x = f.x + Math.cos(this.a) * f.r * this.rad;
    this.z = f.z + Math.sin(this.a) * f.r * this.rad;
    this.y = f.y + this.dy + Math.sin(this.a * 2 + this.ph) * 0.6;
  }
}

// ---------- the seals ----------

class Seal {
  x: number;
  y: number;
  z: number;
  model = makeSeal();
  state: 'bask' | 'alert' | 'slide' | 'swim' | 'haul' = 'bask';
  t = 0;
  /** Where it swims to, once in the water. */
  to: { x: number; z: number } | null = null;
  wet = 0;
  constructor(public spot: HaulOut, g: Game) {
    this.x = spot.x;
    this.y = spot.y;
    this.z = spot.z;
    this.model.rig.scale = 1.45;
    this.model.rig.addTo(g.scene);
    this.model.phase = Math.random() * 9;
    // Lying along its rock, the head toward the water mostly.
    const a = Math.atan2(spot.wz - spot.z, spot.wx - spot.x) + (Math.random() - 0.5) * 1.6;
    this.model.rig.face(Math.cos(a), Math.sin(a), 0);
  }
}

// ---------- the crabs ----------

class Crab {
  x: number;
  y: number;
  z: number;
  model = makeCrab();
  state: 'idle' | 'walk' | 'flee' | 'hidden' = 'idle';
  t = Math.random() * 3;
  to: { x: number; z: number } | null = null;
  fx = 1;
  fz = 0;
  constructor(public home: { x: number; z: number; wx: number; wz: number }, g: Game) {
    this.x = home.x + (Math.random() - 0.5) * 1.5;
    this.z = home.z + (Math.random() - 0.5) * 1.5;
    this.y = g.grid.groundAt(this.x, this.z);
    this.model.rig.scale = 1;
    this.model.rig.addTo(g.scene);
    this.model.rig.setCastShadow(false);
  }
}

// ---------- the boats ----------

/** The fishermen's rounds: slow loops out on open water (x, z, radii), clear of the isles and the shallows: over the
 *  kelp south of the sandbar, off the village's south shore, beyond the lighthouse isle. */
const ROUNDS: { x: number; z: number; rx: number; rz: number; dir: number; stripe: string }[] = [
  { x: 79, z: 48, rx: 6, rz: 3.5, dir: 1, stripe: '#3a6a8a' },
  { x: 36, z: 97, rx: 7, rz: 4, dir: -1, stripe: '#8a3a32' },
  { x: 116, z: 20, rx: 8, rz: 4.5, dir: 1, stripe: '#4a7a5a' },
];

class Boat {
  x = 0;
  z = 0;
  y = 0;
  model: Model;
  a = Math.random() * Math.PI * 2;
  speed = 0;
  state: 'row' | 'cast' | 'wait' | 'reel' = 'row';
  t = 0;
  /** How long it rows before it stops to fish. */
  go = 15 + Math.random() * 15;
  /** Out fishing: only once the lamp burns and the fleet that waited for it is home (see putOut). */
  out = false;
  light;
  line: THREE.Line;
  float: THREE.Mesh;
  bob = { x: 0, z: 0, from: new THREE.Vector3(), out: 0, bite: 0 };
  tip = new THREE.Vector3();
  constructor(public round: (typeof ROUNDS)[number], g: Game, floatGeo: THREE.BufferGeometry, mat: THREE.Material) {
    this.model = makeBoat(round.stripe);
    this.model.rig.scale = 1.35;
    this.model.rig.addTo(g.scene);
    this.model.rig.setCastShadow(false);
    this.light = g.lights.add(0, 1, 0, 0xffb060, 5, 8, 0.3);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: new THREE.Color(0.55, 0.55, 0.5) }));
    this.line.frustumCulled = false;
    this.line.visible = false;
    this.float = new THREE.Mesh(floatGeo, mat);
    this.float.visible = false;
    g.scene.add(this.line, this.float);
  }
  /** Its place on its round at angle a. */
  at(a: number) {
    const r = this.round;
    return { x: r.x + Math.cos(a) * r.rx, z: r.z + Math.sin(a) * r.rz };
  }
}

// ---------- the flotsam ----------

interface Drift { mesh: THREE.Object3D; x: number; z: number; ph: number; sink: number; spin: number }

/** A piece of flotsam, built about its middle with the waterline at 0: kind 0 a bleached log, 1 a glass float in its
 *  net, 2 a string of cork floats, 3 a barrel, 4 a broken crate. */
function flotsam(kind: number, r: () => number, solid: THREE.Material, glow: THREE.Material) {
  const g = new Geo(), gl = new Geo(true);
  if (kind === 0) {
    const L = 1.6 + r() * 1.8, R = 0.13 + r() * 0.08, pts: V3[] = [], rad: number[] = [];
    for (let i = 0; i <= 5; i++) {
      pts.push([(i / 5 - 0.5) * L, Math.sin(i * 1.3) * 0.03, Math.sin(i * 0.9 + 1) * 0.08]);
      rad.push(R * (1.1 - (i / 5) * 0.5));
    }
    g.sweep(pts, rad, (i) => (i % 2 ? C.driftDark : C.drift), { kind: K.Bark, seg: 6, lumpy: 0.25, seed: Math.floor(r() * 999), squash: 0.85 });
    g.sweep([[-L / 2, 0, 0], [-L / 2 - 0.3, 0.1, 0.22], [-L / 2 - 0.5, 0.05, 0.4]], [R * 0.5, R * 0.3, R * 0.08], C.drift, { kind: K.Bark, seg: 4, lumpy: 0.2 });
  } else if (kind === 1) {
    gl.blob(0, 0.1, 0, 0.2, 0.2, 0.2, [0.35, 1.3, 0.95], 93, { detail: 1, jitter: 0 });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      g.beam([Math.cos(a) * 0.21, -0.06, Math.sin(a) * 0.21], [Math.cos(a) * 0.15, 0.27, Math.sin(a) * 0.15], 0.012, C.rope);
    }
    g.beam([0.2, 0, 0], [0.55, -0.05, 0.2], 0.012, C.rope);
  } else if (kind === 2) {
    const n = 3 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const x = (k - (n - 1) / 2) * 0.45, z = Math.sin(k * 1.7) * 0.15;
      g.blob(x, 0.02, z, 0.13, 0.09, 0.11, C.cork, 50 + k, { kind: K.Wood });
      if (k) g.beam([x - 0.45, 0, Math.sin((k - 1) * 1.7) * 0.15], [x, 0, z], 0.012, C.rope);
    }
  } else if (kind === 3) {
    g.push().rotateZ(Math.PI / 2);
    g.cyl(0, -0.4, 0, 0.26, 0.26, 0.8, 9, C.barrel, { kind: K.Wood });
    for (const y of [-0.3, 0.22]) g.cyl(0, y, 0, 0.275, 0.275, 0.07, 9, C.hoop, { kind: K.Metal, cap: false });
    g.pop();
  } else {
    g.box(0, -0.2, 0, 0.62, 0.32, 0.55, '#7a5e3c', { kind: K.Wood });
    g.box(0.05, 0.12, 0.05, 0.5, 0.04, 0.12, '#8a6a44', { kind: K.Wood });
    g.box(-0.1, 0.12, -0.15, 0.4, 0.04, 0.12, '#6a4e30', { kind: K.Wood });
  }
  const group = new THREE.Group();
  if (g.count) {
    const m = new THREE.Mesh(g.build(), solid);
    m.receiveShadow = true;
    group.add(m);
  }
  if (gl.count) group.add(new THREE.Mesh(gl.build(), glow));
  return group;
}

// ---------- the surf and the mist ----------

const SURF_VERT = /* glsl */ `
attribute float aS; attribute float aL; attribute float aB;
varying vec2 vP; varying float vS; varying float vL; varying float vB;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xz; vS = aS; vL = aL; vB = aB;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const NOISE = /* glsl */ `
float h1(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h1(i), h1(i + vec2(1, 0)), u.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), u.x), u.y);
}
`;

const SURF_FRAG = /* glsl */ `
uniform float uTime;
varying vec2 vP; varying float vS; varying float vL; varying float vB;
${NOISE}
void main() {
  // Each stretch of shore keeps its own time: the waves don't all come in at once.
  float ph = n2(vP * 0.07) * 1.6 + n2(vP * 0.23 + 3.0) * 0.3;
  float tex = n2(vP * vec2(2.6, 2.2) + vec2(uTime * 0.25, -uTime * 0.18));
  // Breakers: a line of foam rolls in over the lip of the shallows (and the sandbar from either side), widening
  // and breaking up as it runs in, a lace left behind it.
  float tb = fract(uTime / 6.5 + ph);
  float front = mix(2.3, -1.9, tb);
  float wb = mix(0.16, 0.42, tb);
  float fade = smoothstep(2.4, 1.3, front) * (1.0 - smoothstep(-0.7, -1.9, front));
  float breaker = (1.0 - smoothstep(0.0, wb, abs(vS - front))) * fade * smoothstep(0.25, 0.6, tex);
  float lace = step(front, vS) * (1.0 - smoothstep(0.0, 1.1, vS - front)) * fade * 0.55 * step(0.55, tex);
  // The wash: up to the waterline quickly, back slowly, fading; a fringe of foam always at the edge.
  float tw = fract(uTime / 4.3 + ph * 1.3);
  float reach = tw < 0.35 ? mix(1.5, 0.04, sqrt(tw / 0.35)) : mix(0.04, 0.9, (tw - 0.35) / 0.65);
  float wash = (1.0 - smoothstep(0.0, 0.2, abs(vL - reach))) * (tw < 0.35 ? 1.0 : 1.0 - (tw - 0.35) / 0.65) * step(vL, 1.6);
  float fringe = (1.0 - smoothstep(0.06, 0.2 + 0.12 * sin(uTime * 1.3 + ph * 9.0), vL));
  float f = max(max(breaker, lace), max(wash, fringe * 0.8)) * (0.55 + 0.7 * tex);
  // Two crisp levels of foam, pixel-sharp.
  float a = f > 0.62 ? 0.75 : f > 0.38 ? 0.3 : 0.0;
  if (a <= 0.0) discard;
  gl_FragColor = vec4(vec3(0.7, 0.8, 0.86) * vB, a);
}
`;

const MIST_FRAG = /* glsl */ `
uniform float uTime; uniform float uLayer;
varying vec2 vP; varying float vS; varying float vL; varying float vB;
${NOISE}
float fb(vec2 p) { return n2(p) * 0.55 + n2(p * 2.1 + 7.0) * 0.3 + n2(p * 4.3 - 3.0) * 0.15; }
void main() {
  vec2 q = vP * 0.16 + vec2(uTime * 0.05 + uLayer * 5.0, uTime * 0.018);
  float n = fb(q + fb(q * 0.6 - uTime * 0.01) * 0.8);
  float d = clamp(vS, 0.0, 1.0);
  float m = smoothstep(0.6 - d * 0.22, 0.85 - d * 0.12, n) * d;
  // Quantised to a few levels (the game's pixel look), dithered between.
  ivec2 bp = ivec2(mod(gl_FragCoord.xy, 4.0));
  int bi = bp.x + bp.y * 4;
  float bm[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  float lv = floor(m * 4.0 + (bm[bi] + 0.5) / 16.0) / 4.0;
  if (lv <= 0.0) discard;
  gl_FragColor = vec4(vec3(0.42, 0.5, 0.6) * min(vB, 1.9), lv * 0.36);
}
`;

// ---------- the coast's life ----------

export class ShoreLife {
  private gulls: Gull[] = [];
  private seals: Seal[] = [];
  private crabs: Crab[] = [];
  private boats: Boat[] = [];
  private drift: Drift[] = [];
  private fish: { model: Model; t: number; dur: number; x0: number; z0: number; x1: number; z1: number; h: number }[] = [];
  /** Where waves throw spray: the foot of every rock face standing in the sea (x, z, the way out to the water). */
  private spray: { x: number; z: number; nx: number; nz: number }[] = [];
  private nearSpray: { x: number; z: number; nx: number; nz: number }[] = [];
  private sprayT = 0;
  private fishT = 3;
  private cryT = 3;
  private moths: { x: number; z: number }[] = [];
  private built = false;
  /** The perches and haul-outs it was built with (src/world/shorelife.ts). */
  life = shoreLife;
  private sea = 0;

  apply(g: Game) {
    if (this.built || !g.realm.sea) return;
    this.built = true;
    this.sea = g.realm.sea.surface;
    const life = (this.life = shoreLife);
    const solid = worldMaterial(), glow = glowMaterial();
    this.surf(g);
    this.mist(g);
    // The gulls: some perched (on posts and rocks round each flock), the rest wheeling.
    const taken = new Set<Perch>();
    for (let i = 0; i < 22; i++) {
      const gull = new Gull(i % FLOCKS.length, g);
      if (i % 3 === 0) {
        const f = FLOCKS[gull.flock], p = this.freePerch(f.x, f.z, 24, taken);
        if (p) this.settle(gull, p, taken);
      }
      this.gulls.push(gull);
    }
    for (const s of life.seals) this.seals.push(new Seal(s, g));
    this.crabSpots(g);
    for (const r of ROUNDS) if (this.roundClear(g, r)) this.boats.push(new Boat(r, g, new THREE.SphereGeometry(0.1, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.35, 0.25) })));
    for (const b of this.boats) {
      const p = b.at(b.a);
      b.x = p.x;
      b.z = p.z;
      // The lamp lit before (a reload, a journey): the fleet's home and they're out fishing; else none yet.
      b.out = !!g.save.data.flags.lampLit;
      b.light.on = b.out;
      b.light.level = b.out ? 1 : 0;
    }
    this.flotsam(g, solid, glow);
    for (let k = 0; k < 2; k++) {
      const model = makeFish();
      model.rig.scale = 1.7;
      model.rig.addTo(g.scene);
      model.rig.root.visible = model.rig.shadow.visible = false;
      this.fish.push({ model, t: -1, dur: 1, x0: 0, z0: 0, x1: 0, z1: 0, h: 1 });
    }
    this.placeAll(g);
    // Where the moths fly: over the dune grass (the marram's patches, as realm3.ts grows them, and the turf among them).
    const grid = g.grid;
    for (let z = 1; z < g.realm.d - 1; z += 2)
      for (let x = 1; x < g.realm.w - 1; x += 2) {
        const cx = x + 0.5, cz = z + 0.5, h = grid.groundAt(cx, cz);
        if (grid.waterAt(cx, cz) !== NONE || h < 0.05 || h > 2.6) continue;
        if (grid.typeAt(cx, cz) === T.Grass || fbm(cx * 0.1 + 3, cz * 0.1, 2, 57) > 0.58) this.moths.push({ x: cx, z: cz });
      }
  }

  // ---------- building ----------

  /** Everything in its place to begin with (those far from the knight only move once he comes near). */
  private placeAll(g: Game) {
    for (const gl of this.gulls) {
      gl.model.animate(0, gl.x, gl.z, gl.state === 'perch' ? 'perch' : 'glide', 0, 0, { phase: gl.ph });
      gl.model.rig.place(g.cam, gl.x, gl.y, gl.z, gl.y, true);
      gl.model.rig.shadow.visible = false;
    }
    for (const s of this.seals) {
      s.model.animate(0, s.x, s.z, 'bask', 0, 0);
      s.model.rig.place(g.cam, s.x, s.y, s.z, s.y, true);
      s.model.rig.setCastShadow(false); // (a basking seal needs no moon shadow until the knight comes near)
    }
    for (const c of this.crabs) {
      c.model.animate(0, c.x, c.z, 'idle', 0, 0);
      c.model.rig.place(g.cam, c.x, c.y, c.z, c.y, true);
    }
    for (const b of this.boats) {
      b.model.animate(0, b.x, b.z, 'row', 0, 0);
      b.model.rig.place(g.cam, b.x, this.sea - 0.18, b.z, 0, b.out);
      b.model.rig.shadow.visible = false;
    }
  }

  /** The surf: a skin of foam over the water near every shore, its lines drawn by the shader from two distances
   *  kept at each corner: across the lip of the shallows (aS: out from it positive, in over it negative) and up to
   *  the waterline (aL); and the spray points, the foot of every rock face standing in the sea. */
  private surf(g: Game) {
    const grid = g.grid, sea = this.sea, floor = g.realm.sea!.deep;
    const rocks = shoreLife.rocks;
    const W = grid.w, D = grid.d, ox = grid.ox, oz = grid.oz;
    const land = new Uint8Array(W * D), deep = new Uint8Array(W * D);
    for (let z = 0; z < D; z++)
      for (let x = 0; x < W; x++) {
        const i = z * W + x, gi = grid.i(x + ox, z + oz);
        land[i] = grid.water[gi] === NONE || grid.h[gi] >= sea ? 1 : 0;
        deep[i] = !land[i] && grid.h[gi] <= -0.5 ? 1 : 0;
      }
    const at = (x: number, z: number) => (x < 0 || z < 0 || x >= W || z >= D ? -1 : z * W + x);
    const isLand = (i: number) => land[i] === 1, isShoal = (i: number) => deep[i] === 0, isDeep = (i: number) => deep[i] === 1;
    // Which cells have any of a kind within three cells at all (the kind grown by three, along the rows and then the
    // columns): elsewhere nothing need be measured.
    const grow = (test: (i: number) => boolean) => {
      const row = new Uint8Array(W * D), out = new Uint8Array(W * D);
      for (let z = 0; z < D; z++)
        for (let x = 0; x < W; x++) for (let k = Math.max(0, x - 3); k <= Math.min(W - 1, x + 3) && !row[z * W + x]; k++) if (test(z * W + k)) row[z * W + x] = 1;
      for (let z = 0; z < D; z++)
        for (let x = 0; x < W; x++) for (let k = Math.max(0, z - 3); k <= Math.min(D - 1, z + 3) && !out[z * W + x]; k++) if (row[k * W + x]) out[z * W + x] = 1;
      return out;
    };
    const nearLand = grow(isLand), near = grow(isShoal), nearDeep = grow(isDeep);
    for (const r of rocks)
      for (let z = Math.floor(r.z - r.r - 4); z <= r.z + r.r + 4; z++) for (let x = Math.floor(r.x - r.r - 4); x <= r.x + r.r + 4; x++) if (at(x - ox, z - oz) >= 0) near[at(x - ox, z - oz)] = 1;
    // The distance from a point to the nearest cell of a kind (land / shallow-or-land / deep), out to 3 m.
    const dist = (px: number, pz: number, test: (i: number) => boolean, mask: Uint8Array) => {
      let best = 3;
      const cx = Math.floor(px - ox), cz = Math.floor(pz - oz), ci = at(cx, cz);
      if (ci < 0 || !mask[ci]) return best;
      for (let dz = -3; dz <= 3; dz++)
        for (let dx = -3; dx <= 3; dx++) {
          const i = at(cx + dx, cz + dz);
          if (i < 0 || !test(i)) continue;
          const x0 = cx + dx + ox, z0 = cz + dz + oz;
          const ex = Math.max(x0 - px, 0, px - x0 - 1), ez = Math.max(z0 - pz, 0, pz - z0 - 1), d = Math.hypot(ex, ez);
          if (d < best) best = d;
        }
      return best;
    };
    const rockDist = (px: number, pz: number) => {
      let best = 3;
      for (const r of rocks) best = Math.min(best, Math.max(0, Math.hypot(px - r.x, pz - r.z) - r.r));
      return best;
    };
    // Each quarter-cell corner once.
    const SUB = 2, VW = W * SUB + 1;
    const cache = new Map<number, [number, number, number]>();
    const corner = (sx: number, sz: number) => {
      const key = sz * VW + sx;
      let v = cache.get(key);
      if (!v) {
        const px = ox + sx / SUB, pz = oz + sz / SUB, rd = rockDist(px, pz);
        const dl = Math.min(dist(px, pz, isLand, nearLand), rd), ds = Math.min(dist(px, pz, isShoal, near), rd);
        const s = ds > 0 ? ds : -dist(px, pz, isDeep, nearDeep);
        // Brighter where the sea floor is deep under it (the last pass shades what's under the water toward the deep).
        const fl = grid.groundAt(px, pz), shallow = clamp((fl - floor) / Math.max(1, sea - floor), 0, 1);
        v = [s, dl, 1 / (1 - Math.min(0.75, 0.12 + (1 - shallow) * 0.7))];
        cache.set(key, v);
      }
      return v;
    };
    const pos: number[] = [], aS: number[] = [], aL: number[] = [], aB: number[] = [];
    const y = sea + 0.025;
    for (let z = 0; z < D; z++)
      for (let x = 0; x < W; x++) {
        const i = z * W + x;
        if (land[i]) continue;
        const cx = x + ox + 0.5, cz = z + oz + 0.5;
        // (Out in the open sea, and in the middle of broad shallows far from the shore and the lip, no foam ever shows.)
        if (deep[i] && (!near[i] || Math.min(dist(cx, cz, isShoal, near), rockDist(cx, cz)) > 2.9)) continue;
        if (!deep[i] && !nearLand[i] && !nearDeep[i]) continue;
        for (let qz = 0; qz < SUB; qz++)
          for (let qx = 0; qx < SUB; qx++) {
            const sx = x * SUB + qx, sz = z * SUB + qz;
            const c = [corner(sx, sz + 1), corner(sx + 1, sz + 1), corner(sx + 1, sz), corner(sx, sz)];
            const p: [number, number][] = [[sx, sz + 1], [sx + 1, sz + 1], [sx + 1, sz], [sx, sz]];
            for (const k of [0, 1, 2, 0, 2, 3]) {
              pos.push(ox + p[k][0] / SUB, y, oz + p[k][1] / SUB);
              aS.push(c[k][0]);
              aL.push(c[k][1]);
              aB.push(c[k][2]);
            }
          }
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1));
    geo.setAttribute('aL', new THREE.Float32BufferAttribute(aL, 1));
    geo.setAttribute('aB', new THREE.Float32BufferAttribute(aB, 1));
    geo.computeBoundingSphere();
    const mat = new THREE.ShaderMaterial({ vertexShader: SURF_VERT, fragmentShader: SURF_FRAG, uniforms: { uTime: shared.uTime }, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 2;
    g.scene.add(mesh);
    // Spray: water at the foot of a face of rock a metre and more high (the sea cliffs, the lighthouse's rock, the
    // ship's rock), and round the rocks standing in the sea.
    for (let z = 1; z < D - 1; z++)
      for (let x = 1; x < W - 1; x++) {
        const i = z * W + x;
        if (land[i]) continue;
        const gi = grid.i(x + ox, z + oz);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = at(x + dx, z + dz);
          if (n < 0 || !land[n] || grid.h[grid.i(x + dx + ox, z + dz + oz)] < sea + 1.2 || grid.h[gi] > -0.2) continue;
          if ((x * 7 + z * 13) % 2) continue;
          this.spray.push({ x: x + ox + 0.5 + dx * 0.45, z: z + oz + 0.5 + dz * 0.45, nx: -dx, nz: -dz });
        }
      }
    for (const r of rocks)
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        this.spray.push({ x: r.x + Math.cos(a) * r.r, z: r.z + Math.sin(a) * r.r, nx: Math.cos(a), nz: Math.sin(a) });
      }
  }

  /** Mist over the water at the edges: banks of it lying on the open sea along the near (south and east) edges, and
   *  at the foot of the sea cliffs along the far ones, thickening outward; two layers drifting at their own pace. */
  private mist(g: Game) {
    const grid = g.grid, sea = this.sea, floor = g.realm.sea!.deep, W = g.realm.w, D = g.realm.d;
    // Each bank: its rectangle, and the side it thickens toward (+1: the far end of x or z, -1: the near end).
    const banks: { x0: number; z0: number; x1: number; z1: number; axis: 'x' | 'z'; out: number; depth: number }[] = [
      { x0: -8, z0: D - 12, x1: W + 8, z1: D + 14, axis: 'z', out: 1, depth: 14 },
      { x0: W - 12, z0: -8, x1: W + 14, z1: D - 12, axis: 'x', out: 1, depth: 14 },
      { x0: 82, z0: -8, x1: W - 12, z1: 8, axis: 'z', out: -1, depth: 10 },
      { x0: -8, z0: 76, x1: 8, z1: D - 12, axis: 'x', out: -1, depth: 10 },
    ];
    for (const [layer, y] of [[0, sea + 0.3], [1, sea + 1.1]] as const) {
      const pos: number[] = [], aS: number[] = [], aL: number[] = [], aB: number[] = [];
      for (const k of banks) {
        const STEP = 2;
        const thick = (x: number, z: number) => {
          const u = k.axis === 'z' ? z : x, lo = k.axis === 'z' ? k.z0 : k.x0, hi = k.axis === 'z' ? k.z1 : k.x1;
          // 0 at the inner side, 1 at the edge of the realm and beyond, a ragged inner edge.
          const e = k.out > 0 ? (u - lo) / k.depth : (hi - u) / k.depth;
          const v = k.axis === 'z' ? x : z, alo = k.axis === 'z' ? k.x0 : k.z0, ahi = k.axis === 'z' ? k.x1 : k.z1;
          const ends = clamp(Math.min(v - alo, ahi - v) / 6, 0, 1);
          const wet = grid.inside(Math.floor(x), Math.floor(z)) && grid.waterAt(x, z) !== NONE ? 1 : 0.35;
          return clamp(e * 1.4 + (fbm(x * 0.1, z * 0.1, 2, 97 + layer) - 0.5) * 0.6, 0, 1) * ends * wet;
        };
        const boost = (x: number, z: number) => {
          if (!grid.inside(Math.floor(x), Math.floor(z))) return 1.5;
          const fl = grid.groundAt(x, z);
          if (fl >= sea) return 1;
          const shallow = clamp((fl - floor) / Math.max(1, sea - floor), 0, 1);
          return 1 / (1 - Math.min(0.75, 0.12 + (1 - shallow) * 0.7));
        };
        for (let z = k.z0; z < k.z1; z += STEP)
          for (let x = k.x0; x < k.x1; x += STEP) {
            const c: V3[] = [[x, y, z + STEP], [x + STEP, y, z + STEP], [x + STEP, y, z], [x, y, z]];
            const t = c.map(([cx, , cz]) => thick(cx, cz));
            if (Math.max(...t) <= 0.02) continue;
            for (const n of [0, 1, 2, 0, 2, 3]) {
              pos.push(...c[n]);
              aS.push(t[n]);
              aL.push(0);
              aB.push(boost(c[n][0], c[n][2]));
            }
          }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1));
      geo.setAttribute('aL', new THREE.Float32BufferAttribute(aL, 1));
      geo.setAttribute('aB', new THREE.Float32BufferAttribute(aB, 1));
      geo.computeBoundingSphere();
      const mat = new THREE.ShaderMaterial({ vertexShader: SURF_VERT, fragmentShader: MIST_FRAG, uniforms: { uTime: shared.uTime, uLayer: { value: layer } }, transparent: true, depthWrite: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 3 + layer;
      g.scene.add(mesh);
    }
  }

  /** Is a fisherman's round all open water, deep enough and clear of land? */
  private roundClear(g: Game, r: (typeof ROUNDS)[number]) {
    const grid = g.grid;
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2, x = r.x + Math.cos(a) * r.rx, z = r.z + Math.sin(a) * r.rz;
      for (const [dx, dz] of [[0, 0], [2.2, 0], [-2.2, 0], [0, 2.2], [0, -2.2]]) if (grid.waterAt(x + dx, z + dz) === NONE || grid.groundAt(x + dx, z + dz) > -0.8) return false;
    }
    return true;
  }

  /** The crabs' beaches: sand just above the waterline, in patches, well apart; two or three crabs on each, and the
   *  way down to the water from it. */
  private crabSpots(g: Game) {
    const grid = g.grid, r = mulberry32(3636), spots: { x: number; z: number; wx: number; wz: number }[] = [];
    for (let z = 2; z < g.realm.d - 2; z += 1.5)
      for (let x = 2; x < g.realm.w - 2; x += 1.5) {
        const cx = x + r(), cz = z + r(), h = grid.groundAt(cx, cz);
        if (grid.waterAt(cx, cz) !== NONE || h <= 0 || h > 0.6 || grid.typeAt(cx, cz) !== T.Sand || fbm(cx * 0.08, cz * 0.08, 2, 101) < 0.5) continue;
        if (spots.some((s) => Math.hypot(s.x - cx, s.z - cz) < 11) || Math.hypot(cx - 12, cz - 12) < 8) continue;
        let w: { x: number; z: number } | null = null;
        for (let k = 0; k < 12 && !w; k++) {
          const a = (k / 12) * Math.PI * 2, wx = cx + Math.cos(a) * 1.8, wz = cz + Math.sin(a) * 1.8;
          if (grid.waterAt(wx, wz) !== NONE) w = { x: wx, z: wz };
        }
        if (!w || r() < 0.35) continue;
        spots.push({ x: cx, z: cz, wx: w.x, wz: w.z });
      }
    for (const s of spots) for (let k = 0, n = 2 + Math.floor(r() * 2); k < n; k++) this.crabs.push(new Crab(s, g));
  }

  /** Flotsam riding the swell off the shores: logs, floats, a barrel, a crate, here and there in the shallows and
   *  just beyond them (in patches, well apart). */
  private flotsam(g: Game, solid: THREE.Material, glow: THREE.Material) {
    const grid = g.grid, r = mulberry32(3737), placed: { x: number; z: number }[] = [];
    for (let k = 0; k < 900 && placed.length < 26; k++) {
      const x = 2 + r() * (g.realm.w - 4), z = 2 + r() * (g.realm.d - 4), h = grid.groundAt(x, z);
      if (grid.waterAt(x, z) === NONE || h > -0.25 || h < -3.5 || fbm(x * 0.06, z * 0.06, 2, 103) < 0.45) continue;
      let near = false;
      for (let a = 0; a < 8; a++) if (grid.waterAt(x + Math.cos(a * 0.785) * 4.5, z + Math.sin(a * 0.785) * 4.5) === NONE) near = true;
      for (let a = 0; a < 8; a++) if (grid.waterAt(x + Math.cos(a * 0.785) * 1.3, z + Math.sin(a * 0.785) * 1.3) === NONE) near = false;
      if (!near || placed.some((p) => Math.hypot(p.x - x, p.z - z) < 8) || Math.hypot(x - 79, z - 37.6) < 6 || (x > 43 && x < 58 && Math.abs(z - 66.4) < 3)) continue;
      placed.push({ x, z });
      const u = r(), kind = u < 0.34 ? 0 : u < 0.56 ? 1 : u < 0.76 ? 2 : u < 0.88 ? 3 : 4;
      const mesh = flotsam(kind, r, solid, glow);
      mesh.position.set(x, this.sea, z);
      mesh.rotation.y = r() * Math.PI * 2;
      g.scene.add(mesh);
      this.drift.push({ mesh, x, z, ph: r() * 9, sink: kind === 0 ? 0.06 : kind === 3 ? 0.08 : kind === 4 ? 0.12 : 0.04, spin: (r() - 0.5) * 0.1 });
    }
  }

  // ---------- perches ----------

  private freePerch(x: number, z: number, within: number, taken: Set<Perch>) {
    let best: Perch | null = null, bd = within;
    for (const p of shoreLife.perches) {
      if (taken.has(p)) continue;
      const d = Math.hypot(p.x - x, p.z - z) + Math.random() * 6;
      if (d < bd) (best = p), (bd = d);
    }
    return best;
  }
  private settle(gull: Gull, p: Perch, taken: Set<Perch>) {
    gull.state = 'perch';
    gull.perch = p;
    taken.add(p);
    gull.x = p.x;
    gull.y = p.y;
    gull.z = p.z;
    gull.t = 30 + Math.random() * 60;
    gull.model.rig.face(Math.random() - 0.5, Math.random() - 0.5, 0);
  }

  // ---------- every frame ----------

  update(dt: number, g: Game) {
    if (!this.built) return;
    dt = Math.min(dt, 0.1);
    const fx = g.cam.focus.x, fz = g.cam.focus.z;
    const near = (x: number, z: number, r = NEAR) => Math.abs(x - fx) + Math.abs(z - fz) < r;
    const taken = new Set<Perch>();
    for (const gl of this.gulls) if (gl.perch && gl.state !== 'circle') taken.add(gl.perch);
    for (const gl of this.gulls) this.gull(gl, dt, g, near(gl.x, gl.z), taken);
    // Now and then one of the gulls wheeling near the knight cries.
    this.cryT -= dt;
    if (this.cryT <= 0) {
      this.cryT = 3 + Math.random() * 6;
      const near2 = this.gulls.filter((k) => k.state !== 'perch' && near(k.x, k.z, 26));
      if (near2.length) {
        const k = near2[Math.floor(Math.random() * near2.length)];
        g.audio.sfx('gull', k.x, k.z);
      }
    }
    for (const s of this.seals) if (near(s.x, s.z)) this.seal(s, dt, g);
    for (const c of this.crabs) if (near(c.x, c.z, 34)) this.crab(c, dt, g);
    for (const b of this.boats) this.boat(b, dt, g, near(b.x, b.z));
    const t = g.time;
    for (const d of this.drift) {
      if (!near(d.x, d.z, 36)) continue;
      // Riding the swell: up and down, rocking, wandering a little round where it floats.
      const m = d.mesh;
      m.position.set(d.x + Math.sin(t * 0.13 + d.ph) * 0.5, this.sea - d.sink + Math.sin(t * 1.25 + d.ph) * 0.06 + Math.sin(t * 0.55 + d.ph * 2) * 0.04, d.z + Math.cos(t * 0.11 + d.ph) * 0.5);
      m.rotation.x = Math.sin(t * 1.1 + d.ph) * 0.08;
      m.rotation.z = Math.sin(t * 0.9 + d.ph * 3) * 0.1;
      m.rotation.y += d.spin * dt;
    }
    this.surfSpray(dt, g, fx, fz);
    this.leap(dt, g, fx, fz);
    // Moths over the dune grass near the knight.
    for (let k = 0; k < 6; k++) {
      if (!this.moths.length || Math.random() > dt * 8) continue;
      const m = this.moths[Math.floor(Math.random() * this.moths.length)];
      if (!near(m.x, m.z, 30)) continue;
      const x = m.x + (Math.random() - 0.5) * 2, z = m.z + (Math.random() - 0.5) * 2;
      g.fx.emit(MOTH, x, g.grid.groundAt(x, z) + 0.3 + Math.random() * 1.3, z, 0, 0, 0);
    }
  }

  private gull(gl: Gull, dt: number, g: Game, isNear: boolean, taken: Set<Perch>) {
    const rig = gl.model.rig, p = g.player;
    gl.t -= dt;
    gl.flapT -= dt;
    if (gl.state === 'circle') {
      gl.circlePos(dt);
      // Bank into the turn; a burst of wingbeats now and then, gliding between.
      gl.bank = gl.dir * 0.4;
      gl.pitch = 0;
      rig.face(-Math.sin(gl.a) * gl.dir, Math.cos(gl.a) * gl.dir, dt, 6);
      if (gl.t <= 0) {
        const f = FLOCKS[gl.flock], to = this.freePerch(f.x, f.z, 22, taken);
        if (to && Math.hypot(p.x - to.x, p.z - to.z) > 7) {
          gl.state = 'fly';
          gl.perch = to;
          gl.goal = to;
          taken.add(to);
        } else gl.t = 8 + Math.random() * 15;
      }
    } else if (gl.state === 'perch') {
      const pd = Math.hypot(p.x - gl.x, p.z - gl.z);
      if ((pd < 4.5 && Math.abs(p.y - gl.y) < 4) || gl.t <= 0) {
        // Up and away, back to the nearest flock's circle.
        if (pd < 6) {
          g.audio.sfx('rustle', gl.x, gl.z);
          if (Math.random() < 0.6) g.audio.sfx('gull', gl.x, gl.z);
        }
        let fi = 0, fd = Infinity;
        FLOCKS.forEach((f, i) => {
          const d = Math.hypot(f.x - gl.x, f.z - gl.z);
          if (d < fd) (fd = d), (fi = i);
        });
        gl.flock = fi;
        const f = FLOCKS[fi];
        gl.a = Math.atan2(gl.z - f.z, gl.x - f.x) + gl.dir * 0.6;
        gl.state = 'fly';
        gl.perch = null;
        gl.goal = { x: f.x + Math.cos(gl.a) * f.r * gl.rad, y: f.y + gl.dy, z: f.z + Math.sin(gl.a) * f.r * gl.rad };
        gl.flapT = 1.4;
      }
    } else if (gl.goal) {
      // Flying to a perch (gliding down, flapping as it lands) or back up to its circle (flapping).
      const dx = gl.goal.x - gl.x, dy = gl.goal.y - gl.y, dz = gl.goal.z - gl.z, d = Math.hypot(dx, dy, dz);
      const sp = gl.perch ? Math.max(1.6, Math.min(6, d * 1.4)) : 6.5;
      if (d < 0.12) {
        if (gl.perch) this.settle(gl, gl.perch, taken);
        else {
          gl.state = 'circle';
          gl.t = 15 + Math.random() * 30;
        }
      } else {
        const k = Math.min(1, (sp * dt) / d);
        gl.x += dx * k;
        gl.y += dy * k;
        gl.z += dz * k;
        rig.face(dx, dz, dt, 7);
        gl.bank = 0;
        gl.pitch = clamp(-dy / Math.max(0.5, Math.hypot(dx, dz)), -0.5, 0.5) * 0.6;
        if (dy > 0.3) gl.flapT = Math.max(gl.flapT, 0.3);
      }
    }
    if (!isNear) return;
    const perched = gl.state === 'perch', landing = gl.state === 'fly' && !!gl.perch && Math.hypot(gl.goal!.x - gl.x, gl.goal!.z - gl.z) < 1.6;
    if (gl.flapT < -2 - Math.random() * 3) gl.flapT = 0.8 + Math.random() * 1.2;
    const name = perched ? 'perch' : landing ? 'land' : gl.flapT > 0 ? 'flap' : 'glide';
    gl.model.animate(dt, gl.x, gl.z, name, gl.t, g.time, { v: gl.bank, dur: gl.pitch, phase: gl.ph });
    rig.place(g.cam, gl.x, gl.y, gl.z, perched ? gl.y : g.grid.groundAt(gl.x, gl.z), true);
    rig.shadow.visible = false;
  }

  private seal(s: Seal, dt: number, g: Game) {
    const p = g.player, rig = s.model.rig, sp = s.spot, grid = g.grid;
    s.t += dt;
    const pd = Math.hypot(p.x - s.x, p.z - s.z), near = pd < 7 && Math.abs(p.y - s.y) < 4;
    const swimY = this.sea - 0.42;
    let name: string = s.state;
    if (s.state === 'bask') {
      s.x = sp.x;
      s.y = sp.y;
      s.z = sp.z;
      if (near) {
        s.state = 'alert';
        s.t = 0;
        g.audio.sfx('seal', s.x, s.z);
      } else if (pd < 22 && Math.random() < dt * 0.04) g.audio.sfx('seal', s.x, s.z);
    } else if (s.state === 'alert') {
      if (s.t > 0.55) {
        s.state = 'slide';
        s.t = 0;
      }
    } else if (s.state === 'slide' || s.state === 'haul') {
      // Down off its rock into the water (or back up out of it), a lollop at a time.
      const k = Math.min(1, s.t / (s.state === 'slide' ? 1.1 : 1.6)), out = s.state === 'slide';
      const a = out ? sp : { x: sp.wx, y: swimY, z: sp.wz }, b = out ? { x: sp.wx, y: swimY, z: sp.wz } : sp;
      s.x = a.x + (b.x - a.x) * k;
      s.z = a.z + (b.z - a.z) * k;
      s.y = a.y + (b.y - a.y) * (out ? k * k : Math.sqrt(k));
      rig.face(b.x - a.x, b.z - a.z, dt, 8);
      name = 'slide';
      if (k >= 1) {
        if (out) {
          g.fx.burst(SPRAY, s.x, this.sea + 0.1, s.z, 16, 2.2, 3);
          g.fx.burst(FROTH, s.x, this.sea + 0.05, s.z, 8, 1.2, 0.2);
          g.audio.sfx('splash', s.x, s.z);
          s.state = 'swim';
          s.wet = 0;
          s.to = null;
        } else s.state = 'bask';
        s.t = 0;
      }
    } else {
      // In the water: away from the knight; once he's gone a while, back to its rock.
      s.wet += dt;
      const home = Math.hypot(p.x - sp.x, p.z - sp.z) > 13;
      if (s.wet > 12 && home && !s.to) s.to = { x: sp.wx, z: sp.wz };
      if (!s.to || (pd < 4.5 && Math.hypot(s.to.x - sp.wx, s.to.z - sp.wz) < 0.1)) s.to = this.swimAway(g, s.x, s.z, p.x, p.z);
      const dx = s.to.x - s.x, dz = s.to.z - s.z, d = Math.hypot(dx, dz);
      if (d > 0.2) {
        const v = Math.min(d, (pd < 6 ? 2.6 : 1.5) * dt), nx = s.x + (dx / d) * v, nz = s.z + (dz / d) * v;
        if (grid.waterAt(nx, nz) !== NONE && grid.groundAt(nx, nz) < -0.45) {
          s.x = nx;
          s.z = nz;
        } else s.to = null;
        rig.face(dx, dz, dt, 4);
      } else if (Math.hypot(s.x - sp.wx, s.z - sp.wz) < 0.3 && home) {
        s.state = 'haul';
        s.t = 0;
      } else if (Math.random() < dt * 0.3) s.to = null;
      s.y = swimY;
      if (Math.random() < dt * 1.5) g.fx.emit(FROTH, s.x - Math.sin(rig.yaw) * 0.7, this.sea + 0.02, s.z - Math.cos(rig.yaw) * 0.7, 0, 0, 0);
    }
    s.model.animate(dt, s.x, s.z, name, s.t, g.time);
    rig.setCastShadow(Math.hypot(p.x - s.x, p.z - s.z) < 10);
    rig.place(g.cam, s.x, s.y, s.z, s.y, true);
    rig.shadow.visible = s.state === 'bask' || s.state === 'alert';
  }

  /** Somewhere in open water 5 to 9 m off, away from the knight if he's near. */
  private swimAway(g: Game, x: number, z: number, px: number, pz: number) {
    const grid = g.grid, away = Math.atan2(z - pz, x - px);
    for (let k = 0; k < 12; k++) {
      const a = away + (Math.random() - 0.5) * (1.4 + k * 0.4), d = 5 + Math.random() * 4, tx = x + Math.cos(a) * d, tz = z + Math.sin(a) * d;
      const mx = (x + tx) / 2, mz = (z + tz) / 2;
      if (tx < 1 || tz < 1 || tx > g.realm.w - 1 || tz > g.realm.d - 1) continue;
      if (grid.waterAt(tx, tz) !== NONE && grid.groundAt(tx, tz) < -0.8 && grid.waterAt(mx, mz) !== NONE && grid.groundAt(mx, mz) < -0.6) return { x: tx, z: tz };
    }
    return { x, z };
  }

  private crab(c: Crab, dt: number, g: Game) {
    const p = g.player, rig = c.model.rig, h = c.home;
    c.t -= dt;
    const pd = Math.hypot(p.x - c.x, p.z - c.z);
    if (c.state === 'hidden') {
      // Under the water (or the sand) until the knight's gone, then out again.
      if (c.t <= 0 && Math.hypot(p.x - h.x, p.z - h.z) > 8) {
        c.state = 'idle';
        c.x = h.x + (Math.random() - 0.5) * 1.5;
        c.z = h.z + (Math.random() - 0.5) * 1.5;
        c.y = g.grid.groundAt(c.x, c.z);
        c.t = 1;
      } else {
        rig.root.visible = rig.shadow.visible = false;
        return;
      }
    }
    if (pd < 3.2 && c.state !== 'flee') {
      c.state = 'flee';
      c.to = { x: h.wx + (Math.random() - 0.5), z: h.wz + (Math.random() - 0.5) };
      g.audio.sfx('rustle', c.x, c.z);
    } else if (c.t <= 0 && c.state !== 'flee') {
      if (Math.random() < 0.55) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * 1.8;
        c.to = { x: h.x + Math.cos(a) * d, z: h.z + Math.sin(a) * d };
        c.state = 'walk';
        c.t = 3;
      } else {
        c.state = 'idle';
        c.t = 1 + Math.random() * 3;
      }
    }
    if ((c.state === 'walk' || c.state === 'flee') && c.to) {
      const dx = c.to.x - c.x, dz = c.to.z - c.z, d = Math.hypot(dx, dz);
      if (d < 0.08) {
        if (c.state === 'flee') {
          // Into the water and gone.
          g.fx.burst(FROTH, c.x, this.sea + 0.03, c.z, 4, 0.6, 0.1);
          c.state = 'hidden';
          c.t = 8 + Math.random() * 8;
          rig.root.visible = rig.shadow.visible = false;
          return;
        }
        c.state = 'idle';
        c.t = 0.5 + Math.random() * 2;
      } else {
        const v = Math.min(d, (c.state === 'flee' ? 3.4 : 0.7) * dt);
        c.x += (dx / d) * v;
        c.z += (dz / d) * v;
        c.y = Math.max(g.grid.groundAt(c.x, c.z), this.sea - 0.25);
        // Sideways: its side to the way it goes.
        c.fx = -dz / d;
        c.fz = dx / d;
      }
    }
    rig.face(c.fx, c.fz, dt, 10);
    c.model.animate(dt, c.x, c.z, c.state, c.t, g.time);
    rig.place(g.cam, c.x, c.y, c.z, c.y, true);
  }

  /** No fishers on the night sea while the lighthouse is dark: old Wick's three boats wait out past the reef for
   *  its light (story/lighthouse.ts), and these stay ashore. Once it burns and the fleet's home (Ness, its fisher,
   *  up from the jetty), they put out to fish, each where the knight isn't looking. */
  private putOut(b: Boat, g: Game, isNear: boolean) {
    if (isNear || !g.save.data.flags.lampLit || !g.npc('ness')?.visible) return false;
    b.out = true;
    b.model.rig.root.visible = true;
    b.light.on = true;
    b.light.level = 1;
    return true;
  }

  private boat(b: Boat, dt: number, g: Game, isNear: boolean) {
    if (!b.out && !this.putOut(b, g, isNear)) return;
    const r = b.round, rig = b.model.rig;
    b.t += dt;
    // Rowing round: easing to a stop to fish, casting, waiting on a bite, reeling in, rowing on.
    const want = b.state === 'row' ? 0.85 : 0;
    b.speed += (want - b.speed) * Math.min(1, dt * 0.6);
    const mean = (r.rx + r.rz) / 2;
    b.a += (r.dir * b.speed * dt) / mean;
    const p = b.at(b.a), ahead = b.at(b.a + r.dir * 0.05);
    b.x = p.x;
    b.z = p.z;
    if (b.speed > 0.05 || b.state === 'row') rig.face(ahead.x - p.x, ahead.z - p.z, dt, 2);
    b.y = this.sea - 0.18 + Math.sin(g.time * 1.1 + r.x) * 0.04;
    if (b.state === 'row' && b.t > b.go && b.speed > 0.5) {
      b.state = 'cast';
      b.t = -2.5;
    } else if (b.state === 'cast' && b.t > 1) {
      b.state = 'wait';
      b.t = 0;
      b.bob.bite = 7 + Math.random() * 10;
    } else if (b.state === 'wait' && b.t > b.bob.bite + 1.2) {
      b.state = 'reel';
      b.t = 0;
    } else if (b.state === 'reel' && b.t > 1.2) {
      b.line.visible = b.float.visible = false;
      if (Math.random() < 0.5) {
        b.state = 'cast';
        b.t = -1;
      } else {
        b.state = 'row';
        b.t = 0;
        b.go = 18 + Math.random() * 22;
      }
    }
    // The lantern goes with it.
    const yaw = rig.yaw, c = Math.cos(yaw), s = Math.sin(yaw);
    b.light.x = b.x + c * 0.36 + s * -0.8;
    b.light.z = b.z - s * 0.36 + c * -0.8;
    b.light.y = b.y + 1.3;
    if (!isNear) return;
    const casting = b.state === 'cast' && b.t >= 0;
    const name = b.state === 'row' ? 'row' : casting ? 'cast' : 'wait';
    const bite = b.state === 'wait' && b.t > b.bob.bite ? 1 : b.state === 'reel' ? 1 : 0;
    b.model.animate(dt, b.x, b.z, name, Math.max(0, b.t), g.time, { v: bite, phase: r.x });
    rig.place(g.cam, b.x, b.y, b.z, b.y, true);
    rig.shadow.visible = false;
    if (b.speed > 0.3 && Math.random() < dt * 6) {
      const side = Math.random() < 0.5 ? 1 : -1;
      g.fx.emit(FROTH, b.x - s * 1.2 + c * side * 0.5, this.sea + 0.03, b.z - c * 1.2 - s * side * 0.5, -s * 0.3, 0, -c * 0.3);
    }
    if (Math.random() < dt * 1.2) g.fx.emit(MOTH, b.light.x + (Math.random() - 0.5) * 0.6, b.light.y + Math.random() * 0.4, b.light.z + (Math.random() - 0.5) * 0.6, 0, 0, 0, 0.6);
    // The line from the rod's tip to the float.
    rig.root.updateMatrixWorld(true);
    rig.j('tip').getWorldPosition(b.tip);
    if (b.state === 'cast' && b.t >= 0.6) {
      // Out it flies, over the side he faces.
      const k = Math.min(1, (b.t - 0.6) / 0.45);
      if (!b.line.visible) {
        b.bob.from.copy(b.tip);
        const a = yaw - 1.35, d = 4.5 + Math.random() * 1.5;
        b.bob.x = b.x + Math.sin(a) * d;
        b.bob.z = b.z + Math.cos(a) * d;
        b.line.visible = b.float.visible = true;
      }
      b.float.position.set(b.bob.from.x + (b.bob.x - b.bob.from.x) * k, b.bob.from.y + (this.sea - b.bob.from.y) * k + Math.sin(k * Math.PI) * 1.2, b.bob.from.z + (b.bob.z - b.bob.from.z) * k);
      if (k >= 1 && b.bob.out < 1) g.fx.burst(SPRAY, b.bob.x, this.sea + 0.05, b.bob.z, 6, 1, 1.5);
      b.bob.out = k;
    } else if (b.state === 'wait' || b.state === 'reel') {
      b.bob.out = 0;
      const bite = b.state === 'wait' && b.t > b.bob.bite;
      if (bite && Math.random() < dt * 8) g.fx.emit(SPRAY, b.bob.x, this.sea + 0.05, b.bob.z, (Math.random() - 0.5) * 1.5, 1.5, (Math.random() - 0.5) * 1.5);
      const k = b.state === 'reel' ? Math.min(1, b.t / 1.1) : 0;
      b.float.position.set(b.bob.x + (b.tip.x - b.bob.x) * k, this.sea + 0.03 + Math.sin(g.time * 2.4) * 0.03 - (bite ? 0.08 + Math.abs(Math.sin(g.time * 13)) * 0.06 : 0) + (b.tip.y - this.sea) * k * k, b.bob.z + (b.tip.z - b.bob.z) * k);
    }
    if (b.line.visible) {
      const a = b.line.geometry.getAttribute('position') as THREE.BufferAttribute;
      a.setXYZ(0, b.tip.x, b.tip.y, b.tip.z);
      a.setXYZ(1, b.float.position.x, b.float.position.y + 0.04, b.float.position.z);
      a.needsUpdate = true;
    }
  }

  /** Waves on the rocks: spray thrown up at the foot of the cliffs and round the rocks near the knight, in sets
   *  (the swell comes in in sevens). */
  private surfSpray(dt: number, g: Game, fx: number, fz: number) {
    this.sprayT -= dt;
    if (this.sprayT <= 0) {
      this.sprayT = 0.5;
      this.nearSpray = this.spray.filter((s) => Math.abs(s.x - fx) + Math.abs(s.z - fz) < 34);
    }
    if (!this.nearSpray.length) return;
    const set = Math.max(0, Math.sin((g.time * Math.PI * 2) / 7.5)) ** 2;
    const rate = (0.6 + set * 5) * Math.min(1, this.nearSpray.length / 12);
    if (Math.random() > dt * rate) return;
    const s = this.nearSpray[Math.floor(Math.random() * this.nearSpray.length)];
    const y = this.sea + 0.1, n = 16 + Math.floor(set * 24);
    for (let k = 0; k < n; k++) {
      const out = 0.4 + Math.random() * 1.8, side = (Math.random() - 0.5) * 2;
      g.fx.emit(SPRAY, s.x + (Math.random() - 0.5) * 1.2, y, s.z + (Math.random() - 0.5) * 1.2, s.nx * out - s.nz * side, 3.5 + Math.random() * 4 + set * 2.5, s.nz * out + s.nx * side, 0.7 + Math.random() * 0.6);
    }
    for (let k = 0; k < 4 + set * 6; k++) g.fx.emit(SPUME, s.x + (Math.random() - 0.5) * 1.4, y + 0.3 + Math.random() * 1.2, s.z + (Math.random() - 0.5) * 1.4, s.nx * 0.8, 1.5 + Math.random() * 2, s.nz * 0.8);
    for (let k = 0; k < 5; k++) g.fx.emit(FROTH, s.x + s.nx * (0.3 + Math.random()), y - 0.05, s.z + s.nz * (0.3 + Math.random()), s.nx * 0.6, 0.1, s.nz * 0.6);
  }

  /** Now and then a fish leaps out of deep water near the knight, with a splash going out and coming down. */
  private leap(dt: number, g: Game, fx: number, fz: number) {
    const grid = g.grid;
    this.fishT -= dt;
    if (this.fishT <= 0) {
      this.fishT = 1.5 + Math.random() * 3.5;
      const f = this.fish.find((k) => k.t < 0);
      if (f) {
        for (let k = 0; k < 8; k++) {
          const a = Math.random() * Math.PI * 2, d = 5 + Math.random() * 15, x = fx + Math.cos(a) * d, z = fz + Math.sin(a) * d;
          const dir = Math.random() * Math.PI * 2, L = 1.6 + Math.random() * 1.4, x1 = x + Math.cos(dir) * L, z1 = z + Math.sin(dir) * L;
          if (grid.waterAt(x, z) === NONE || grid.groundAt(x, z) > -1.2 || grid.waterAt(x1, z1) === NONE || grid.groundAt(x1, z1) > -1.2) continue;
          Object.assign(f, { t: 0, dur: 0.75 + Math.random() * 0.35, x0: x, z0: z, x1, z1, h: 0.8 + Math.random() * 0.7 });
          f.model.rig.face(x1 - x, z1 - z, 0);
          f.model.rig.root.visible = true;
          g.fx.burst(SPRAY, x, this.sea + 0.05, z, 10, 1.4, 2.6);
          break;
        }
      }
    }
    for (const f of this.fish) {
      if (f.t < 0) continue;
      f.t += dt;
      const k = f.t / f.dur;
      if (k >= 1) {
        f.t = -1;
        f.model.rig.root.visible = false;
        g.fx.burst(SPRAY, f.x1, this.sea + 0.05, f.z1, 14, 1.8, 2.8);
        for (let i = 0; i < 6; i++) g.fx.emit(FROTH, f.x1 + (Math.random() - 0.5) * 0.4, this.sea + 0.03, f.z1 + (Math.random() - 0.5) * 0.4, 0, 0, 0);
        g.audio.sfx('splash', f.x1, f.z1);
        continue;
      }
      const x = f.x0 + (f.x1 - f.x0) * k, z = f.z0 + (f.z1 - f.z0) * k, y = this.sea - 0.25 + 4 * f.h * k * (1 - k);
      const slope = (4 * f.h * (1 - 2 * k)) / Math.hypot(f.x1 - f.x0, f.z1 - f.z0);
      f.model.animate(dt, x, z, 'leap', f.t, g.time, { dur: -Math.atan(slope) });
      f.model.rig.place(g.cam, x, y, z, y, true);
      f.model.rig.shadow.visible = false;
    }
  }
}

