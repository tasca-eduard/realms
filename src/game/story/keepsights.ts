import * as THREE from 'three';
import { Geo } from '../../engine/geo';
import type { LightSource } from '../../engine/lights';
import { glowMaterial, K, worldMaterial } from '../../engine/materials';
import { P, type Emitter, type PSpec } from '../../engine/particles';
import { fbm, mulberry32 } from '../../engine/util';
import { GLOW, PAL } from '../../world/builder';
import { BEACON, BOAT_WAY, FARM, STONES, WHEEL, stoneAt } from '../../world/keepsights';
import type { Pt } from '../../world/paint';
import type { Enemy } from '../enemies';
import type { Game } from '../game';

// ---------------------------------------------------------------------------
// The Moonlit Keep's set pieces that move or change with the story (group 89; what stands still is drawn by
// src/world/keepsights.ts): the mill wheel turning in its race, the keep's beacon (moon-blue while the Goblin
// King holds the keep, gold at dawn), the Seven Stones' runes waking in turn round the ring (all burning once the
// trial is won), the raided farm smouldering until its raiders are beaten and mended after (once the knight is
// away from it, or at the next load), and the night fisher's lantern boat drifting round the isle.
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

const BEACON_BLUE: RGB = [1.3, 2.3, 5.2];
const BEACON_GOLD: RGB = [5.2, 3.0, 0.9];
const BLUE_FLAME: PSpec = { color: [1.4, 2.5, 5.8], color2: [0.25, 0.55, 2.0], size: 2, size2: 1, life: 0.6, gravity: -2.6, drag: 2, fadeIn: 0.05 };
const BLUE_EMBER: PSpec = { color: [1.2, 2.2, 4.8], color2: [0.3, 0.6, 1.8], size: 1, life: 2.4, gravity: -0.8, drag: 0.6, wobble: 0.5 };
/** White water churned up by the wheel's paddles. */
const FOAM: PSpec = { color: [0.9, 0.98, 1.15], color2: [0.45, 0.52, 0.65], size: 2, size2: 3, life: 1.1, gravity: 1.5, drag: 2.5, wobble: 0.2, alpha: 0.7 };
/** Pale smoke off the smouldering barn and fields. */
const PALE_SMOKE: PSpec = { color: [0.34, 0.33, 0.37], color2: [0.2, 0.2, 0.24], size: 3, size2: 10, life: 6, gravity: -0.3, drag: 0.4, wobble: 0.4, alpha: 0.3, fadeIn: 0.25, soft: true };
const EMBER_GLOW: RGB = [3.0, 1.0, 0.25];

function meshOf(build: (g: Geo, gl: Geo) => void, glowMat?: THREE.Material) {
  const g = new Geo(), gl = new Geo(true);
  build(g, gl);
  const group = new THREE.Group();
  if (g.count) {
    const m = new THREE.Mesh(g.build(), worldMaterial());
    m.castShadow = m.receiveShadow = true;
    group.add(m);
  }
  if (gl.count) group.add(new THREE.Mesh(gl.build(), glowMat ?? glowMaterial()));
  return group;
}

/** A round soft glow (the beacon's halo, a lantern's), seen the same from every side. */
function halo(color: THREE.ColorRepresentation, size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!, grad = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.4)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grad;
  x.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.set(size, size, 1);
  return s;
}

/** Each stone's rune: a few strokes cut in its face (a different one on each). */
const RUNES: [number, number, number, number][][] = [
  [[0, 0, 0, 0.42], [0, 0.42, 0.16, 0.28], [0, 0.28, 0.16, 0.14]],
  [[0, 0, 0, 0.42], [-0.14, 0.42, 0, 0.26], [0.14, 0.42, 0, 0.26]],
  [[-0.1, 0, -0.1, 0.42], [0.1, 0, 0.1, 0.42], [-0.1, 0.3, 0.1, 0.14]],
  [[0, 0, 0, 0.42], [0, 0.42, 0.15, 0.32], [0, 0.22, 0.15, 0.12]],
  [[-0.14, 0, 0.14, 0.42], [0.14, 0, -0.14, 0.42]],
  [[0, 0, 0, 0.42], [-0.14, 0.14, 0, 0.3], [0.14, 0.14, 0, 0.3]],
  [[-0.12, 0.42, 0.12, 0], [-0.12, 0, 0.12, 0.42], [-0.12, 0.21, 0.12, 0.21]],
];

/** The raiders still hold the farm. */
const raided = (g: Game) => (g.save.data.quests.farm ?? 0) < 1;

export class KeepSights {
  private t = 0;
  // The mill.
  private wheel: THREE.Group | null = null;
  private wheelOn = true;
  private foam: Emitter[] = [];
  // The beacon.
  private flame: THREE.MeshBasicMaterial | null = null;
  private beaconHalo: THREE.Sprite | null = null;
  private beaconLight: LightSource | null = null;
  private beaconFire: Emitter[] = [];
  private gold = false;
  // The stones.
  private runes: THREE.MeshBasicMaterial[] = [];
  private runeLight: LightSource | null = null;
  private runeSparks: Emitter | null = null;
  // The farm.
  private smoulder: { group: THREE.Group; emitters: Emitter[] } | null = null;
  private mended: THREE.Group | null = null;
  private mendDue = false;
  // The boat.
  private boat: THREE.Group | null = null;
  private boatLight: LightSource | null = null;
  private boatLen = 0;

  apply(g: Game) {
    if (!this.wheel) this.build(g);
    if (raided(g)) this.setFarm(g, false);
    else this.mend(g);
  }

  /** Stop the wheel or set it turning again (the miller's errand). */
  setWheel(on: boolean) {
    this.wheelOn = on;
    for (const e of this.foam) e.on = on;
  }

  onKill(g: Game, e: Enemy) {
    // The last raider falls: the fires die down now, and the Harrows come home once the knight has gone on.
    if (e.group === 'farm' && !g.enemies.some((o) => o.alive && o.group === 'farm')) this.mendDue = true;
  }

  victoryLine(id: string): string | undefined {
    const L: Record<string, string> = {
      miller: 'Bread for the whole village this morning, and the first loaf for you.',
      wat: 'Daylight! Now I can see what I am hammering.',
      edda: 'The sun on the new thatch. It looks like gold, does it not?',
    };
    return L[id];
  }

  tick(g: Game, dt: number) {
    this.t += dt;
    const t = this.t;
    // The wheel: its foot moves with the water (down the race, toward +z).
    if (this.wheel && this.wheelOn) this.wheel.rotation.x -= dt * 0.8;
    // The beacon: moon-blue while the King holds the keep, gold as the dawn comes.
    if (this.flame) {
      const k = g.dawn, c = this.flame.color;
      c.setRGB(BEACON_BLUE[0] + (BEACON_GOLD[0] - BEACON_BLUE[0]) * k, BEACON_BLUE[1] + (BEACON_GOLD[1] - BEACON_BLUE[1]) * k, BEACON_BLUE[2] + (BEACON_GOLD[2] - BEACON_BLUE[2]) * k);
      const flick = 0.92 + 0.08 * Math.sin(t * 11) * Math.sin(t * 7.3);
      this.beaconHalo!.material.color.setRGB(c.r * 0.16 * flick, c.g * 0.16 * flick, c.b * 0.16 * flick);
      this.beaconLight!.color.setRGB(c.r / 5.2, c.g / 5.2, c.b / 5.2);
      const gold = k > 0.5;
      if (gold !== this.gold) {
        this.gold = gold;
        this.beaconFire[0].spec = gold ? P.flame : BLUE_FLAME;
        this.beaconFire[1].spec = gold ? P.ember : BLUE_EMBER;
      }
    }
    // The runes: a light going round the ring, one stone after another; once the trial is won, all burn.
    if (this.runes.length) {
      const won = (g.save.data.quests.stones ?? 0) >= 1, n = this.runes.length, ph = (t * 1.1) % n;
      let best = 0, bi = 0;
      this.runes.forEach((m, i) => {
        let d = Math.abs(ph - i);
        d = Math.min(d, n - d);
        const v = won ? 0.85 + 0.15 * Math.sin(t * 1.3 + i) : 0.14 + 1.5 * Math.max(0, 1 - d / 1.3) ** 2;
        m.color.setScalar(v);
        if (v > best) (best = v), (bi = i);
      });
      const s = stoneAt(bi), y = g.grid.groundAt(s.x, s.z);
      this.runeLight!.x = s.x;
      this.runeLight!.z = s.z;
      this.runeLight!.y = y + 1.4;
      this.runeLight!.intensity = won ? 6 : 2 + best * 3;
      this.runeSparks!.x = s.x;
      this.runeSparks!.z = s.z;
      this.runeSparks!.y = y + 1.3;
    }
    // The farm: mended once the raiders are gone and the knight is well away (never in front of him).
    if (this.mendDue && Math.hypot(g.player.x - FARM.x, g.player.z - FARM.z) > 30) this.mend(g);
    else if (this.mendDue && this.smoulder) for (const e of this.smoulder.emitters) e.rate = Math.max(0.15, e.rate - dt * 0.05);
    // The boat: drifting along the far side of the isle and back, rocking a little.
    if (this.boat) {
      const s = (t * 0.32) % (this.boatLen * 2), along = s < this.boatLen ? s : this.boatLen * 2 - s;
      const [x, z, dx, dz] = pointOn(BOAT_WAY, along), back = s >= this.boatLen;
      this.boat.position.set(x, -0.38 + Math.sin(t * 1.3) * 0.03, z);
      this.boat.rotation.set(Math.sin(t * 0.9) * 0.04, Math.atan2(back ? dz : -dz, back ? -dx : dx), Math.sin(t * 1.1) * 0.05);
      const lx = this.boat.position.x + Math.cos(this.boat.rotation.y) * -0.9, lz = this.boat.position.z - Math.sin(this.boat.rotation.y) * -0.9;
      this.boatLight!.x = lx;
      this.boatLight!.z = lz;
    }
  }

  // ---------- built once a load ----------

  private build(g: Game) {
    // The mill wheel: two rims of short boards, spokes and paddles between them, on an axle along x.
    this.wheel = meshOf((m) => {
      const R = WHEEL.r, W = WHEEL.w / 2, n = 12;
      m.push().rotateZ(Math.PI / 2);
      m.cyl(0, -W - 0.9, 0, 0.12, 0.12, WHEEL.w + 2.3, 8, PAL.woodDark, { kind: K.Wood });
      m.cyl(0, -W - 0.05, 0, 0.32, 0.32, WHEEL.w + 0.1, 8, PAL.wood, { kind: K.Wood });
      m.pop();
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2, a2 = ((k + 1) / n) * Math.PI * 2;
        for (const sx of [-W, W]) {
          m.beam([sx, Math.cos(a) * R, Math.sin(a) * R], [sx, Math.cos(a2) * R, Math.sin(a2) * R], 0.06, PAL.wood, { kind: K.Wood });
          if (k % 2 === 0) m.beam([sx, 0, 0], [sx, Math.cos(a) * R, Math.sin(a) * R], 0.045, PAL.woodDark, { kind: K.Wood });
        }
        m.push().rotateX(-a);
        m.box(0, R - 0.42, 0, WHEEL.w + 0.08, 0.5, 0.06, k % 3 ? PAL.wood : PAL.woodLight, { kind: K.Wood });
        m.pop();
      }
    });
    this.wheel.position.set(WHEEL.x, WHEEL.y, WHEEL.z);
    g.scene.add(this.wheel);
    // Foam where the paddles bite and leave the water, and drops falling off them as they rise.
    const fz = WHEEL.z, wy = -0.3;
    this.foam = [
      g.fx.addEmitter({ x: WHEEL.x, y: wy, z: fz - 0.7, rate: 7, spec: P.splash, spread: 0.3, vy: 1.3 }),
      g.fx.addEmitter({ x: WHEEL.x, y: wy, z: fz + 0.8, rate: 9, spec: FOAM, spread: 0.35, vy: 0.9 }),
      g.fx.addEmitter({ x: WHEEL.x, y: wy + 0.05, z: fz + 2.2, rate: 4, spec: FOAM, spread: 0.5, vy: 0.3 }),
      g.fx.addEmitter({ x: WHEEL.x, y: WHEEL.y + 0.6, z: fz + 1.25, rate: 9, spec: P.fall, spread: 0.3, vy: 0 }),
    ];

    // The beacon's fire: the flame's colour is the material's, so it can turn from blue to gold.
    this.flame = new THREE.MeshBasicMaterial({ vertexColors: true });
    const { x, y, z } = BEACON;
    const fire = meshOf((_m, gl) => {
      gl.cyl(0, 0, 0, 0.55, 0.12, 0.9, 7, [1, 1, 1], { kind: 1 });
      gl.cyl(0, 0.2, 0, 0.32, 0.03, 1.3, 6, [1.2, 1.2, 1.2], { kind: 1 });
    }, this.flame);
    fire.position.set(x, y + 1.6, z);
    g.scene.add(fire);
    this.beaconHalo = halo(0xffffff, 6.5);
    this.beaconHalo.position.set(x, y + 2.3, z);
    g.scene.add(this.beaconHalo);
    this.beaconLight = g.lights.add(x + 0.8, y + 2, z, 0x5080ff, 14, 13, 0.2);
    this.beaconFire = [
      g.fx.addEmitter({ x, y: y + 1.9, z, rate: 30, spec: BLUE_FLAME, spread: 0.45, vy: 1.2 }),
      g.fx.addEmitter({ x, y: y + 2.2, z, rate: 4, spec: BLUE_EMBER, spread: 0.4, vy: 1.6 }),
    ];

    // The runes, one mesh each so each can wake on its own, cut on the face the camera sees.
    for (let i = 0; i < STONES.n; i++) {
      const s = stoneAt(i), gy = g.grid.groundAt(s.x, s.z), side = Math.sin(s.a) + Math.cos(s.a) >= 0 ? 1 : -1;
      const mat = glowMaterial();
      const rune = meshOf((_m, gl) => {
        gl.push().translate(s.x, gy - 0.2, s.z).rotateY(s.a);
        for (const [x0, y0, x1, y1] of RUNES[i]) {
          const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
          gl.push().translate((x0 + x1) / 2, 1.0 + (y0 + y1) / 2, side * 0.185).rotateZ(ang);
          gl.box(0, -0.025, 0, len + 0.04, 0.05, 0.02, GLOW.rune, {});
          gl.pop();
        }
        gl.pop();
      }, mat);
      g.scene.add(rune);
      this.runes.push(mat);
    }
    this.runeLight = g.lights.add(STONES.x, 1.4, STONES.z, 0x6aa8ff, 4, 5, 0.1);
    this.runeSparks = g.fx.addEmitter({ x: STONES.x, y: 1.3, z: STONES.z, rate: 5, spec: P.rune, spread: 0.35, vy: 0.3 });

    this.buildFarm(g);

    // The night fisher: a small boat, a hooded fisher with his rod out, a lantern on a pole at the stern.
    this.boat = meshOf((m, gl) => {
      m.box(0, -0.12, 0, 2.3, 0.4, 0.95, PAL.woodDark, { kind: K.Wood });
      for (const s of [-1, 1]) m.box(0, 0.25, s * 0.45, 2.1, 0.12, 0.08, PAL.wood, { kind: K.Wood });
      m.box(1.15, 0.05, 0, 0.3, 0.3, 0.6, PAL.wood, { kind: K.Wood });
      m.box(0.15, 0.2, 0, 0.32, 0.06, 0.86, PAL.woodLight, { kind: K.Wood });
      // The fisher, sitting, hood up.
      m.box(0.15, 0.26, 0, 0.36, 0.5, 0.42, '#4a4a5e', { kind: K.Cloth });
      m.box(0.15, 0.76, 0, 0.28, 0.3, 0.3, '#3e3e52', { kind: K.Cloth });
      m.box(0.25, 0.8, 0, 0.1, 0.16, 0.18, '#d8a888');
      m.beam([0.3, 0.55, 0.15], [1.9, 1.6, 1.2], 0.018, PAL.woodDark);
      // The lantern's pole and the lantern.
      m.box(-0.95, 0.1, 0, 0.07, 1.4, 0.07, PAL.woodDark, { kind: K.Wood });
      m.box(-0.95, 1.5, 0.1, 0.07, 0.07, 0.3, PAL.woodDark, { kind: K.Wood });
      m.box(-0.95, 1.12, 0.22, 0.2, 0.04, 0.2, PAL.iron);
      m.pyramid(-0.95, 1.4, 0.22, 0.24, 0.24, 0.12, PAL.iron, { kind: K.Metal });
      gl.box(-0.95, 1.16, 0.22, 0.15, 0.24, 0.15, GLOW.window, { kind: 1 });
    });
    const lamp = halo(0xffb060, 1.6);
    lamp.material.color.setRGB(0.5, 0.32, 0.12);
    lamp.position.set(-0.95, 1.28, 0.22);
    this.boat.add(lamp);
    g.scene.add(this.boat);
    this.boatLight = g.lights.add(BOAT_WAY[0][0], 0.9, BOAT_WAY[0][1], 0xffa050, 6, 7, 0.15);
    this.boatLen = BOAT_WAY.slice(1).reduce((s, q, k) => s + Math.hypot(q[0] - BOAT_WAY[k][0], q[1] - BOAT_WAY[k][1]), 0);
  }

  private buildFarm(g: Game) {
    const grid = g.grid, d = mulberry32(8991);
    // Smouldering: embers in the burned patches of the fields and in the barn's ash, pale smoke going up.
    const emitters: Emitter[] = [];
    const embers = meshOf((_m, gl) => {
      for (const [x0, x1] of [[70.6, 83.4], [88.6, 99.8]] as Pt[])
        for (let z = 112.3; z < 119.6; z += 0.9)
          for (let x = x0; x < x1; x += 0.9) {
            const px = x + d() * 0.6, pz = z + d() * 0.6;
            if (fbm(px * 0.35, pz * 0.35, 2, 97) < 0.6 || d() < 0.2) continue;
            const y = grid.groundAt(px, pz), s = 0.06 + d() * 0.1;
            gl.box(px, y + 0.02, pz, s * 1.4, 0.04, s * (0.8 + d()), EMBER_GLOW, { kind: 1 });
            gl.box(px + 0.2, y + 0.02, pz - 0.15, s, 0.03, s, [1.8, 0.45, 0.1], { kind: 1 });
            const roll = d();
            if (roll < 0.3) emitters.push(g.fx.addEmitter({ x: px, y: y + 0.2, z: pz, rate: 1.4, spec: P.ember, spread: 0.5, vy: 0.5 }));
            else if (roll < 0.42) emitters.push(g.fx.addEmitter({ x: px, y: y + 0.4, z: pz, rate: 0.9, spec: PALE_SMOKE, spread: 0.6, vy: 0.5 }));
            else if (roll < 0.47) emitters.push(g.fx.addEmitter({ x: px, y: y + 0.08, z: pz, rate: 6, spec: P.flame, spread: 0.15, vy: 0.3 }));
          }
    });
    g.scene.add(embers);
    const by = grid.groundAt(FARM.x, FARM.z);
    for (const [ox, oz, rate] of [[0.4, 0.4, 2.6], [-0.9, -0.3, 1.8], [1.4, -0.8, 1.4], [-1.8, 1.2, 1.0]] as [number, number, number][])
      emitters.push(g.fx.addEmitter({ x: FARM.x + ox, y: by + 0.8, z: FARM.z + oz, rate, spec: PALE_SMOKE, spread: 0.7, vy: 0.7 }));
    for (const [ox, oz] of [[0.9, 0.6], [-0.7, 1.1], [1.6, -0.4]] as Pt[]) emitters.push(g.fx.addEmitter({ x: FARM.x + ox, y: by + 0.15, z: FARM.z + oz, rate: 10, spec: P.flame, spread: 0.25, vy: 0.5 }));
    this.smoulder = { group: embers, emitters };

    // Mended: the barn's frame raised again in new timber, scaffolding on its far sides, lanterns round the
    // yard, a stack of planks, a sawhorse, a ladder.
    this.mended = meshOf((m, gl) => {
      const x0 = FARM.x - 2.5, z0 = FARM.z - 2, X1 = FARM.x + 2.5, Z1 = FARM.z + 2, y = by, NEW = '#b08a5a', NEW2 = '#9a7448';
      for (const [px, pz] of [[x0, z0], [X1, z0], [x0, Z1], [X1, Z1], [FARM.x, z0], [FARM.x, Z1], [x0, FARM.z], [X1, FARM.z]] as Pt[]) m.box(px + 0.12, y, pz + 0.12, 0.2, 2.8, 0.2, NEW, { kind: K.Wood });
      for (const [ax, az, bx, bz] of [[x0, z0, X1, z0], [x0, Z1, X1, Z1], [x0, z0, x0, Z1], [X1, z0, X1, Z1]]) m.beam([ax + 0.12, y + 2.8, az + 0.12], [bx + 0.12, y + 2.8, bz + 0.12], 0.1, NEW2, { kind: K.Wood });
      // Rafters up on the back half, the ridge beam on them; new floorboards over the ash.
      for (let k = 0; k <= 4; k++) {
        const px = x0 + 0.12 + k * 1.25;
        m.beam([px, y + 2.8, z0 + 0.12], [px, y + 4.3, FARM.z + 0.12], 0.07, NEW, { kind: K.Wood });
        if (k % 2 === 0) m.beam([px, y + 4.3, FARM.z + 0.12], [px, y + 2.8, Z1 + 0.12], 0.07, NEW, { kind: K.Wood });
      }
      m.beam([x0 + 0.12, y + 4.3, FARM.z + 0.12], [X1 + 0.12, y + 4.3, FARM.z + 0.12], 0.09, NEW2, { kind: K.Wood });
      for (let pz = z0 + 0.4; pz < Z1 - 0.2; pz += 0.42) m.box(FARM.x + 0.1, y + 0.08, pz, 4.6, 0.06, 0.38, d() < 0.5 ? NEW : NEW2, { kind: K.Wood });
      // Scaffolding along the north and west walls: poles, ledgers, a plank walk.
      for (let k = 0; k <= 3; k++) {
        const px = x0 + k * 1.67;
        m.box(px, y, z0 - 0.8, 0.08, 3.6, 0.08, PAL.woodDark, { kind: K.Wood });
      }
      for (const hy of [1.4, 2.7]) {
        m.beam([x0, y + hy, z0 - 0.8], [X1, y + hy, z0 - 0.8], 0.04, PAL.woodDark, { kind: K.Wood });
        m.box(FARM.x, y + hy, z0 - 0.45, 5, 0.05, 0.6, NEW2, { kind: K.Wood });
      }
      for (let k = 0; k <= 2; k++) m.box(x0 - 0.8, y, z0 + k * 2, 0.08, 3.6, 0.08, PAL.woodDark, { kind: K.Wood });
      m.beam([x0 - 0.8, y + 1.4, z0], [x0 - 0.8, y + 1.4, Z1], 0.04, PAL.woodDark, { kind: K.Wood });
      m.box(x0 - 0.45, y + 1.4, FARM.z, 0.6, 0.05, 4, NEW2, { kind: K.Wood });
      // A ladder up to the plank walk.
      m.beam([X1 + 0.6, y, z0 - 0.3], [X1 - 0.1, y + 2.9, z0 - 0.7], 0.035, NEW, { kind: K.Wood });
      m.beam([X1 + 0.9, y, z0 - 0.0], [X1 + 0.2, y + 2.9, z0 - 0.4], 0.035, NEW, { kind: K.Wood });
      // New planks stacked by the barn, a sawhorse with a board on it, sheaves of new thatch.
      for (let k = 0; k < 5; k++) m.box(FARM.x + 3.6, y + 0.06 + k * 0.08, FARM.z + 2.6 + (k % 2) * 0.05, 0.5, 0.07, 3, k % 2 ? NEW : NEW2, { kind: K.Wood });
      for (const s of [-1, 1]) {
        m.beam([102.6 + s * 0.35, y, 113.9 - 0.25], [102.6 + s * 0.35, y + 0.7, 113.9], 0.035, PAL.woodDark, { kind: K.Wood });
        m.beam([102.6 + s * 0.35, y, 113.9 + 0.25], [102.6 + s * 0.35, y + 0.7, 113.9], 0.035, PAL.woodDark, { kind: K.Wood });
      }
      m.box(102.6, y + 0.7, 113.9, 1.6, 0.06, 0.3, NEW, { kind: K.Wood });
      for (const [tx, tz] of [[108.8, 113.4], [109.2, 114.1], [108.5, 114.5]] as Pt[]) m.cyl(tx, y, tz, 0.26, 0.18, 0.7, 7, PAL.thatch, { kind: K.Thatch });
      // Lanterns on posts round the yard, so nobody comes creeping back.
      for (const [lx, lz] of [[102.4, 112.2], [108.6, 117.4], [100.8, 116.8], [104.4, 119.2]] as Pt[]) {
        const ly = grid.groundAt(lx, lz);
        m.box(lx, ly, lz, 0.1, 1.5, 0.1, PAL.woodDark, { kind: K.Wood });
        m.box(lx, ly + 1.48, lz + 0.15, 0.06, 0.06, 0.35, PAL.woodDark, { kind: K.Wood });
        m.pyramid(lx, ly + 1.55, lz + 0.3, 0.22, 0.22, 0.1, PAL.iron, { kind: K.Metal });
        gl.box(lx, ly + 1.27, lz + 0.3, 0.14, 0.22, 0.14, GLOW.window, { kind: 1 });
      }
    });
    this.mended.visible = false;
    g.scene.add(this.mended);
  }

  /** The smoulder shows while the raiders hold the farm; the mended farm once they're gone. */
  private setFarm(g: Game, mended: boolean) {
    this.smoulder!.group.visible = !mended;
    for (const e of this.smoulder!.emitters) e.on = !mended;
    this.mended!.visible = mended;
    for (const id of ['wat', 'edda']) {
      const n = g.npc(id);
      if (n) n.visible = mended;
    }
    if (!mended) return;
    // The barn's own ash and embers die down (the burned shell drawn with the realm).
    for (const e of g.fx.emitters) if (Math.hypot(e.x - FARM.x, e.z - FARM.z) < 2) e.on = false;
    for (const s of g.lights.sources) if (Math.hypot(s.x - FARM.x - 0.3, s.z - FARM.z - 0.4) < 0.2) s.on = false;
    for (const [lx, lz] of [[102.4, 112.2], [108.6, 117.4], [100.8, 116.8], [104.4, 119.2]] as Pt[]) g.lights.add(lx, g.grid.groundAt(lx, lz) + 1.4, lz + 0.3, 0xffb060, 3.5, 5, 0.15);
  }

  private mend(g: Game) {
    this.mendDue = false;
    if (this.mended!.visible) return;
    this.setFarm(g, true);
  }
}

/** A point `s` metres along a line, and the line's direction there. */
function pointOn(line: Pt[], s: number): [number, number, number, number] {
  for (let k = 1; k < line.length; k++) {
    const [ax, az] = line[k - 1], [bx, bz] = line[k], len = Math.hypot(bx - ax, bz - az);
    if (s <= len || k === line.length - 1) {
      const f = Math.min(1, s / len);
      return [ax + (bx - ax) * f, az + (bz - az) * f, (bx - ax) / len, (bz - az) / len];
    }
    s -= len;
  }
  return [line[0][0], line[0][1], 1, 0];
}
