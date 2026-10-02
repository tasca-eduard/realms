import * as THREE from 'three';
import { Geo } from '../../engine/geo';
import type { LightSource } from '../../engine/lights';
import { glowMaterial, K, worldMaterial } from '../../engine/materials';
import { P, type PSpec } from '../../engine/particles';
import { BOTTLE, DIG, HOUSES, raceRings, RAID, SHRIMP, VILLAGE, type RingDef } from '../../world/errands';
import type { RegionDef } from '../../world/realm';
import { Enemy } from '../enemies';
import type { Game } from '../game';
import { Chest, type Interactable, type Npc } from '../objects';

function meshOf(build: (g: Geo, gl: Geo) => void) {
  const g = new Geo(), gl = new Geo(true);
  build(g, gl);
  const group = new THREE.Group();
  if (g.count) {
    const m = new THREE.Mesh(g.build(), worldMaterial());
    m.castShadow = m.receiveShadow = true;
    group.add(m);
  }
  if (gl.count) group.add(new THREE.Mesh(gl.build(), glowMaterial()));
  return group;
}

/** A bubble's skin: clear in the middle, bright round its rim (the camera looks straight on: a view along z). */
const bubbleMat = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uCol: { value: new THREE.Color(0.55, 1.25, 1.45) }, uK: { value: 1 } },
    vertexShader: 'varying vec3 vN; void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uCol; uniform float uK; varying vec3 vN; void main() { float f = pow(1.0 - abs(normalize(vN).z), 3.0); gl_FragColor = vec4(uCol * (f * 0.95 + 0.03) * uK, 1.0); }',
  });

const glowMat = (r: number, g: number, b: number, opacity: number) =>
  new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

/** Sand thrown up by a blow at the X. */
const SAND: PSpec = { color: [0.55, 0.5, 0.4], color2: [0.35, 0.32, 0.26], size: 1, life: 0.8, gravity: 9, drag: 1.5 };
/** The glowing shrimp's own light, drifting off it. */
const SHRIMP_MOTE: PSpec = { color: [2.6, 1.0, 0.8], color2: [1.2, 0.3, 0.3], size: 1, life: 1.4, gravity: -0.5, wobble: 0.3 };
/** The race's rings: lit sea-green, the next one bright, those passed gold. */
const RING = { idle: [0.25, 0.8, 0.9], next: [1.0, 2.6, 2.8], done: [2.4, 1.7, 0.5] } as const;
/** How long Pike's best time is (the knight must beat it), in breaths (seconds). */
const RACE_TIME = 16;
/** How long Cockle's bubble lasts once he sets off (it holds while he keeps still), and when the knight shares air. */
const BUBBLE = 35, SHARED = 25, SHARE_COST = 15;

// ---------- a message in a bottle ----------

/** The bottle on the beach: green glass on its side, half in the wet sand, a rolled map inside catching the moon. */
class Bottle implements Interactable {
  x = BOTTLE.x;
  z = BOTTLE.z;
  y: number;
  radius = 1.6;
  taken = false;
  private group: THREE.Group;
  private light: LightSource;
  constructor(g: Game, private onTake: () => void) {
    this.y = g.grid.groundAt(this.x, this.z);
    this.group = meshOf((m, gl) => {
      for (const s of [m, gl]) s.push().translate(0, 0.09, 0).rotateY(0.7).rotateZ(Math.PI / 2 + 0.15);
      m.cyl(0, -0.2, 0, 0.1, 0.1, 0.28, 8, '#2e6a52');
      m.cyl(0, 0.08, 0, 0.1, 0.045, 0.08, 8, '#2e6a52');
      m.cyl(0, 0.16, 0, 0.045, 0.045, 0.1, 8, '#2e6a52');
      m.cyl(0, 0.26, 0, 0.042, 0.05, 0.06, 6, '#8a6a3a', { kind: K.Wood });
      gl.cyl(0, -0.15, 0, 0.06, 0.06, 0.22, 6, [1.5, 1.3, 0.8]);
      m.pop();
      gl.pop();
    });
    this.group.position.set(this.x, this.y - 0.03, this.z);
    this.group.scale.setScalar(1.6);
    g.scene.add(this.group);
    this.light = g.lights.add(this.x, this.y + 0.7, this.z, 0x9ff0d0, 2.5, 4, 0.2);
  }
  prompt() {
    return this.taken ? null : 'Pick up the bottle';
  }
  interact(g: Game) {
    if (this.taken) return;
    this.remove(g);
    g.audio.sfx('glint', this.x, this.z);
    this.onTake();
  }
  update(dt: number, g: Game) {
    if (!this.taken && Math.random() < dt * 3) g.fx.emit(P.coinGlint, this.x + (Math.random() - 0.5) * 0.4, this.y + 0.15, this.z + (Math.random() - 0.5) * 0.4, 0, 0.4, 0);
  }
  remove(g: Game) {
    this.taken = true;
    g.scene.remove(this.group);
    g.lights.remove(this.light);
  }
}

/** The map from the bottle, drawn on a card from the land itself: the coast in ink, the camp, the lighthouse, the
 *  village, a dotted way from the camp out onto the dunes, and the X. (Drawn into the lore card under its text.) */
function showMap(g: Game) {
  g.ui.lore('A bottle stoppered with wax, and in it a map drawn in squid ink. North of the crew\'s camp, out on the dunes, an X, and under it: "Where the stones cross. Dig."', true);
  const txt = document.querySelector('#lore .txt');
  if (!txt) return;
  const W = g.realm.w, D = g.realm.d, S = 3;
  const c = document.createElement('canvas');
  c.width = W * S;
  c.height = D * S;
  const k = c.getContext('2d')!;
  const land = (x: number, z: number) => x < 0 || z < 0 || x >= W || z >= D || g.grid.groundAt(x + 0.5, z + 0.5) >= 0;
  k.fillStyle = '#ad9668';
  k.fillRect(0, 0, c.width, c.height);
  for (let z = 0; z < D; z++)
    for (let x = 0; x < W; x++) {
      if (!land(x, z)) continue;
      const coast = !land(x + 1, z) || !land(x - 1, z) || !land(x, z + 1) || !land(x, z - 1);
      k.fillStyle = coast ? '#4a3420' : (x * 7 + z * 13) % 11 === 0 ? '#dccaa0' : '#e8d8ae';
      k.fillRect(x * S, z * S, S, S);
    }
  // Waves on the sea, stains on the paper.
  k.strokeStyle = 'rgba(74,52,32,0.45)';
  k.lineWidth = 1;
  for (let i = 0; i < 70; i++) {
    const x = (i * 97) % W, z = (i * 53 + 7) % D;
    if (land(x, z) || land(x + 3, z)) continue;
    k.beginPath();
    k.moveTo(x * S, z * S);
    k.quadraticCurveTo(x * S + 4, z * S - 3, x * S + 8, z * S);
    k.stroke();
  }
  for (const [x, z, r] of [[30, 80, 40], [110, 20, 28], [70, 100, 34]]) {
    const gr = k.createRadialGradient(x * S, z * S, 0, x * S, z * S, r * S * 0.5);
    gr.addColorStop(0, 'rgba(120,80,40,0.18)');
    gr.addColorStop(1, 'rgba(120,80,40,0)');
    k.fillStyle = gr;
    k.fillRect(0, 0, c.width, c.height);
  }
  k.fillStyle = '#4a3420';
  k.strokeStyle = '#4a3420';
  // The camp (a tent), the lighthouse (a tower on its rock), the village (houses round the green).
  const tent = (x: number, z: number) => {
    k.beginPath();
    k.moveTo(x * S - 7, z * S + 5);
    k.lineTo(x * S, z * S - 6);
    k.lineTo(x * S + 7, z * S + 5);
    k.closePath();
    k.fill();
  };
  tent(36, 25);
  k.fillRect(97 * S - 3, 29.5 * S - 14, 6, 14);
  k.fillRect(97 * S - 5, 29.5 * S - 16, 10, 3);
  for (const deg of HOUSES) {
    const a = (deg * Math.PI) / 180;
    k.fillRect((VILLAGE.x + Math.cos(a) * 10.6) * S - 3, (VILLAGE.z + Math.sin(a) * 10.6) * S - 3, 6, 6);
  }
  // The way: dots from the camp out onto the dunes, then the X, a ring round it.
  k.setLineDash([3, 4]);
  k.lineWidth = 2;
  k.beginPath();
  k.moveTo(38 * S, 22 * S);
  k.quadraticCurveTo(46 * S, 12 * S, DIG.x * S - 8, DIG.z * S + 2);
  k.stroke();
  k.setLineDash([]);
  k.strokeStyle = '#8a1a14';
  k.lineWidth = 4;
  const X = DIG.x * S, Z = DIG.z * S;
  k.beginPath();
  k.moveTo(X - 9, Z - 9);
  k.lineTo(X + 9, Z + 9);
  k.moveTo(X + 9, Z - 9);
  k.lineTo(X - 9, Z + 9);
  k.stroke();
  k.lineWidth = 1.5;
  k.beginPath();
  k.arc(X, Z, 15, 0, Math.PI * 2);
  k.stroke();
  // North, at the top.
  k.fillStyle = '#4a3420';
  k.font = 'bold 16px serif';
  k.fillText('N', c.width - 22, 22);
  k.beginPath();
  k.moveTo(c.width - 16, 26);
  k.lineTo(c.width - 21, 40);
  k.lineTo(c.width - 11, 40);
  k.closePath();
  k.fill();
  k.lineWidth = 3;
  k.strokeRect(1.5, 1.5, c.width - 3, c.height - 3);
  c.style.cssText = 'display:block;margin:16px auto 0;width:min(420px,78vw);border-radius:4px;box-shadow:0 6px 30px #000;transform:rotate(-1.2deg)';
  txt.appendChild(c);
}

// ---------- the X of stones ----------

/** The X on the dunes: three blows dig it out, and the chest the map's maker buried comes up out of the sand. */
class DigSpot implements Interactable {
  x = DIG.x;
  z = DIG.z;
  y: number;
  radius = 1.8;
  blows = 0;
  dug = false;
  chest: Chest | null = null;
  private riseT = 1;
  constructor(g: Game) {
    this.y = g.grid.groundAt(this.x, this.z);
  }
  prompt() {
    return this.dug ? null : '!Pale stones laid in an X. Strike the sand to dig.';
  }
  interact() {}
  /** A blow at the X: sand flies; the third digs the chest out. */
  strike(g: Game, done: () => void) {
    this.blows++;
    g.audio.sfx('thud', this.x, this.z);
    g.fx.burst(SAND, this.x, this.y + 0.2, this.z, 18, 3, 4);
    g.fx.burst(P.dust, this.x, this.y + 0.1, this.z, 6, 1);
    if (this.blows < 3) {
      g.pop({ x: this.x, y: this.y, z: this.z }, this.blows === 1 ? 'something under the sand...' : 'wood! keep digging', '#e8d8a8');
      return;
    }
    this.open(g, false);
    g.audio.sfx('chestOpen', this.x, this.z);
    g.shake(0.25);
    done();
  }
  /** The hole, and the chest in it (rising out of the sand, or already there). */
  open(g: Game, instant: boolean) {
    this.dug = true;
    const hole = meshOf((m) => {
      m.cyl(0, 0.005, 0, 0.95, 0.95, 0.02, 12, '#2a2418');
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + 0.3;
        m.blob(Math.cos(a) * 1.25, -0.05, Math.sin(a) * 1.25, 0.42, 0.22, 0.32, '#8a7e64', 20 + k, { kind: K.Rock, flatBottom: true });
      }
    });
    hole.position.set(this.x, this.y, this.z);
    g.scene.add(hole);
    const c = new Chest('r3_dig', this.x, this.z, 0.45, 75, g);
    g.chests.push(c);
    g.interactables.push(c);
    if (g.save.data.chests.includes(c.id)) c.setOpen(true);
    this.chest = c;
    this.riseT = instant ? 1 : 0;
    if (!instant) c.group.position.y = this.y - 0.7;
  }
  update(dt: number) {
    if (!this.chest || this.riseT >= 1) return;
    this.riseT = Math.min(1, this.riseT + dt * 1.2);
    this.chest.group.position.y = this.y - 0.7 * (1 - this.riseT) ** 2;
  }
}

// ---------- glowing shrimp ----------

/** A glowing shrimp among the coral: curled, lit like a lamp, bobbing; the knight takes it as he passes. */
class GlowShrimp {
  y: number;
  taken = false;
  private group: THREE.Group;
  private light: LightSource;
  private t = Math.random() * 6;
  constructor(public i: number, public x: number, public z: number, g: Game) {
    this.y = g.grid.groundAt(x, z) + 0.7;
    this.group = meshOf((_m, gl) => {
      for (let k = 0; k < 6; k++) {
        const a = -0.4 + k * 0.5, r = 0.2 - k * 0.012;
        gl.blob(Math.cos(a) * r, Math.sin(a) * r * 0.6, 0, 0.075 - k * 0.007, 0.065 - k * 0.006, 0.07, [2.6, 0.95 + k * 0.08, 0.7], 30 + k, { detail: 1, jitter: 0 });
      }
      gl.beam([0.2, 0.04, 0], [0.48, 0.22, 0.1], 0.01, [2.2, 1.6, 1.2]);
      gl.beam([0.2, 0.04, 0], [0.46, 0.16, -0.12], 0.01, [2.2, 1.6, 1.2]);
    });
    this.group.scale.setScalar(1.8);
    this.group.position.set(x, this.y, z);
    g.scene.add(this.group);
    this.light = g.lights.add(x, this.y + 0.3, z, 0xff8a70, 2.6, 3.6, 0.15);
  }
  update(dt: number, g: Game, take: (s: GlowShrimp) => void) {
    if (this.taken) return;
    this.t += dt;
    this.group.position.y = this.y + Math.sin(this.t * 1.8) * 0.12;
    this.group.rotation.y = Math.sin(this.t * 0.6) * 1.2;
    if (Math.random() < dt * 4) g.fx.emit(SHRIMP_MOTE, this.x + (Math.random() - 0.5) * 0.4, this.y, this.z + (Math.random() - 0.5) * 0.4, 0, 0.2, 0);
    const p = g.player;
    if (p.alive && !g.flying && Math.hypot(p.x - this.x, p.z - this.z) < 1.1 && Math.abs(p.y + 0.6 - this.y) < 1.4) take(this);
  }
  remove(g: Game) {
    this.taken = true;
    g.scene.remove(this.group);
    g.lights.remove(this.light);
  }
}

// ---------- the current race ----------

/** Pike's race: a line of glowing rings off Gull Rock; through the first, the clock runs till the last. */
class Race {
  state: 'off' | 'ready' | 'run' = 'off';
  next = 0;
  t = 0;
  private rings: { d: RingDef; mat: THREE.MeshBasicMaterial; mesh: THREE.Mesh }[] = [];
  private light: LightSource;
  constructor(g: Game) {
    const geo = new THREE.TorusGeometry(1.05, 0.08, 6, 28);
    for (const d of raceRings(g.grid)) {
      const mat = glowMat(RING.idle[0], RING.idle[1], RING.idle[2], 0.25);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(d.x, d.y, d.z);
      if (!d.dx && !d.dz) mesh.rotation.x = Math.PI / 2;
      else mesh.rotation.y = Math.atan2(d.dx, d.dz);
      g.scene.add(mesh);
      this.rings.push({ d, mat, mesh });
    }
    const r0 = this.rings[0].d;
    this.light = g.lights.add(r0.x, r0.y, r0.z, 0x60e0e8, 0, 5, 0.1);
  }
  update(dt: number, g: Game, won: () => void) {
    const p = g.player, n = this.rings.length;
    const pulse = 0.5 + 0.5 * Math.sin(g.time * 6);
    this.rings.forEach((r, i) => {
      const passed = this.state === 'run' && i < this.next, next = this.state !== 'off' && i === this.next;
      const col = passed ? RING.done : next ? RING.next : RING.idle;
      r.mat.color.setRGB(col[0], col[1], col[2]);
      r.mat.opacity = passed ? 0.5 : next ? 0.55 + 0.4 * pulse : this.state === 'off' ? 0.22 : 0.4;
      r.mesh.rotation.z += dt * (next ? 1.5 : 0.3);
    });
    const nr = this.rings[Math.min(this.next, n - 1)].d;
    this.light.x = nr.x;
    this.light.y = nr.y;
    this.light.z = nr.z;
    this.light.intensity = this.state === 'off' ? 0 : 3 + pulse * 2;
    if (this.state === 'off') return;
    if (Math.random() < dt * 8) g.fx.emit(P.seaBubble, nr.x + (Math.random() - 0.5) * 1.6, nr.y - 0.8, nr.z + (Math.random() - 0.5) * 1.6, 0, 0.6, 0);
    const through = Math.hypot(p.x - nr.x, p.y + 0.9 - nr.y, p.z - nr.z) < 1.5 && p.alive;
    if (this.state === 'ready') {
      if (!through) return;
      this.state = 'run';
      this.t = 0;
      this.next = 1;
      g.audio.sfx('rune', nr.x, nr.z);
      g.fx.burst(P.bluespark, nr.x, nr.y, nr.z, 20, 3, 1);
      g.ui.toast('The current race', `Through all ${n} rings in ${RACE_TIME} breaths`, 2);
      return;
    }
    this.t += dt;
    const left = RACE_TIME - this.t;
    g.ui.objective(`Current race: ${Math.max(0, left).toFixed(1)} &middot; ring ${this.next + 1} of ${n}`);
    if (left <= 0 || !p.alive || Math.hypot(p.x - nr.x, p.z - nr.z) > 45) {
      this.reset(g);
      g.audio.sfx('wave');
      g.ui.toast('Too slow', 'Back to the first ring, by Gull Rock', 2.6);
      return;
    }
    if (!through) return;
    g.audio.sfx(this.next === n - 1 ? 'victory' : 'blip', nr.x, nr.z);
    g.fx.burst(P.bluespark, nr.x, nr.y, nr.z, 16, 3, 1);
    g.pop({ x: nr.x, y: nr.y - 1.5, z: nr.z }, `${this.t.toFixed(1)}`, '#bfefff');
    this.next++;
    if (this.next < n) return;
    this.reset(g);
    won();
  }
  get time() {
    return this.t;
  }
  reset(g: Game) {
    this.state = 'ready';
    this.next = 0;
    g.refreshQuests();
  }
}

// ---------- the errands ----------

/**
 * The Sunken Reef's errands (see src/world/errands.ts): the message in a bottle and the chest under the X, Brill's
 * glowing bait (a lasting perk: each Moon Flask heals one more heart), Pike's current race, Cockle the lost diver
 * in the bubble of his last breath, and the crew's night raid on the village once the salvager's suit is won. The
 * realm's story (aqua.ts) hands its moments here.
 */
export class ReefErrands {
  private built = false;
  private bottle: Bottle | null = null;
  private dig: DigSpot | null = null;
  private shrimp: GlowShrimp[] = [];
  private race: Race | null = null;
  /** Cockle: stranded (his bubble holding while he keeps still), following the knight, out of breath, or saved. */
  private cockle: 'stranded' | 'follow' | 'breathless' | 'saved' = 'stranded';
  private bubble: THREE.Mesh | null = null;
  private bubbleAir = BUBBLE;
  /** The night raid: its foes while it's on, the villagers who ran indoors (and how fast they walk usually). */
  private raid: Enemy[] | null = null;
  private raidEnd = 0;
  private hid = new Map<Npc, number | undefined>();
  private lastRegion = '';

  apply(g: Game) {
    const f = g.save.data.flags;
    if (!this.built) {
      this.built = true;
      if (!f.bottleFound) {
        this.bottle = new Bottle(g, () => this.readBottle(g));
        g.interactables.push(this.bottle);
      }
      this.dig = new DigSpot(g);
      g.interactables.push(this.dig);
      if (f.treasureDug) this.dig.open(g, true);
      SHRIMP.forEach(([x, z], i) => {
        if (!f[`glowshrimp${i + 1}`]) this.shrimp.push(new GlowShrimp(i + 1, x, z, g));
      });
      this.race = new Race(g);
      const ck = g.npc('cockle');
      if (ck) {
        this.bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), bubbleMat());
        g.scene.add(this.bubble);
      }
    }
    if (g.save.data.quests.currentrace !== undefined && this.race?.state === 'off') this.race.state = 'ready';
    if (f.cockleSaved) this.homeCockle(g);
  }

  /** The knight took the bottle from the sand: the map. */
  private readBottle(g: Game) {
    g.save.data.flags.bottleFound = true;
    showMap(g);
    g.quest('bottlemap', 0);
    g.writeSave();
  }

  onRegion(g: Game, r: RegionDef) {
    const was = this.lastRegion, f = g.save.data.flags;
    this.lastRegion = r.name;
    // The crew come for the village on the knight's first homecoming after he took their salvager's suit (walking
    // in from elsewhere: not on waking at its moonfire).
    if (r.name === 'The Coral Village' && was && was !== r.name && f.costume && !f.raidDone && !f.boss && !this.raid && !g.victory) this.startRaid(g);
  }

  /** A blow lands: the X of stones on the dunes. */
  struck(g: Game, hit: (it: object, x: number, y: number, z: number, r: number) => boolean) {
    const d = this.dig;
    if (!d || d.dug || !hit(d, d.x, d.y + 0.3, d.z, 1.0)) return;
    d.strike(g, () => {
      g.save.data.flags.treasureDug = true;
      g.ui.toast('Buried treasure', 'The chest from the map, dug out of the dunes', 3);
      g.quest('bottlemap', 1);
      g.writeSave();
    });
  }

  /** Someone is spoken to: the lines to say, 'handled', or null (not one of the errands'). */
  talk(g: Game, n: Npc, lines: string[]): string[] | 'handled' | null {
    const id = n.def.id, f = g.save.data.flags, q = g.save.data.quests;
    if (g.victory) return null;
    switch (id) {
      // Hints: the beachcomber has seen the bottle glint; the net-mender knows the crew will come.
      case 'flotsam':
        if (!f.bottleFound) return [...lines, 'Something has been glinting at the tide line west of the village, down past the dunes. Glass. My back will not bend that far today.'];
        if (!f.treasureDug) return [lines[0], 'A map in a bottle? Then dig where it says. With that sword, if you must.'];
        return null;
      case 'ling':
        if (f.costume && !f.raidDone) return [...lines, 'You took the salvager\'s suit? The crew will not swallow that. One of these nights they will wade ashore here. Mind the shallows.'];
        if (f.raidDone) return [lines[0], 'They ran like crabs from a gull. I mended the nets they cut before breakfast.'];
        return null;
      // (Their own lines, never the ones everyone switches to once Kip is home.)
      case 'brill':
        return this.brill(g, n, n.def.lines);
      case 'pike':
        if (f.raceWon) return n.def.after!;
        g.quest('currentrace', 0);
        if (this.race && this.race.state === 'off') this.race.state = 'ready';
        return n.def.lines;
      case 'merrow':
        if (!f.cockleSaved) {
          g.quest('lostdiver', 0);
          return n.def.lines;
        }
        if ((q.lostdiver ?? 0) < 2) {
          g.ui.say(n.name, [...n.def.after!, 'Take these. He found them the day we met, and he says you have earned them more than me. He is wrong, but take them.'], () => {
            g.talking = null;
            g.player.coins += 40;
            g.audio.sfx('coin');
            g.ui.toast('40 coins', 'the pearls Cockle courted Merrow with');
            g.quest('lostdiver', 2);
          });
          return 'handled';
        }
        return n.def.after!;
      case 'cockle':
        return this.talkCockle(g, n, n.def.lines);
    }
    return null;
  }

  /** Brill on the jetty: how many shrimp so far; with all five, his pay and the shrimp in the knight's flasks. */
  private brill(g: Game, n: Npc, lines: string[]): string[] | 'handled' {
    const f = g.save.data.flags, have = SHRIMP.filter((_, i) => f[`glowshrimp${i + 1}`]).length;
    if (f.baitPaid) return n.def.after!;
    if (have < SHRIMP.length) {
      g.quest('glowbait', 0);
      return have ? [`${have} of five. They glow brighter in the dark, the shrimp. Like me.`, lines[1]] : lines;
    }
    g.ui.say(n.name, ['Five! Look at them shine. That is a week of fishing.', 'Here, for your trouble. And give me your flasks: a pinch of shrimp in the moonwater and it does twice the good. Old fisher\'s trick.'], () => {
      g.talking = null;
      f.baitPaid = true;
      g.player.coins += 30;
      g.player.kit.glowshrimp = 1;
      g.audio.sfx('power');
      g.ui.toast('Glowshrimp in your flasks', 'Each Moon Flask heals one more heart. And 30 coins.', 4);
      g.quest('glowbait', 2);
      g.writeSave();
    });
    return 'handled';
  }

  /** Cockle on his ledge: the first talk sets him following; out of breath, the knight shares his own air. */
  private talkCockle(g: Game, n: Npc, lines: string[]): string[] | 'handled' {
    const p = g.player;
    g.quest('lostdiver', 0);
    if (this.cockle === 'stranded') {
      this.cockle = 'follow';
      this.bubbleAir = BUBBLE;
      return lines;
    }
    if (this.cockle === 'follow') return ['Keep going, I am right behind you. Mostly.'];
    // Out of breath: a breath from the knight's own suit fills his bubble again (if the knight has one to spare).
    g.talking = null;
    if (p.air < SHARE_COST + 2) {
      g.bubbleAt(n, 'You are as empty as I am! Find air first.');
      return 'handled';
    }
    p.air -= SHARE_COST;
    this.cockle = 'follow';
    this.bubbleAir = SHARED;
    g.audio.sfx('gulp', n.x, n.z);
    g.fx.burst(P.seaBubble, n.x, n.y + 1.4, n.z, 16, 1.5, 1);
    g.bubbleAt(n, 'Ahh. Thank you. Go on, slower this time.');
    return 'handled';
  }

  /** Cockle is home (or was already): gone from the ledge, by his wife on the green. */
  private homeCockle(g: Game) {
    this.cockle = 'saved';
    const ck = g.npc('cockle'), home = g.npc('cocklehome');
    if (ck) ck.visible = false;
    if (home) home.visible = true;
    if (this.bubble) this.bubble.visible = false;
  }

  /** Cockle follows the knight; his bubble shrinks as he goes, and he's safe in a column, a vent or the shallows. */
  private updateCockle(dt: number, g: Game) {
    const ck = g.npc('cockle'), b = this.bubble;
    if (!ck || !b || this.cockle === 'saved') return;
    const p = g.player, frozen = g.worldFrozen;
    const k = this.cockle === 'stranded' ? 1 : this.cockle === 'breathless' ? 0 : this.bubbleAir / BUBBLE;
    b.visible = k > 0.02;
    b.scale.setScalar((0.55 + 0.6 * k) * (1 + Math.sin(g.time * 3) * 0.03));
    b.position.set(ck.x, ck.y + 1.0, ck.z);
    (b.material as THREE.ShaderMaterial).uniforms.uK.value = 0.5 + 0.5 * k;
    if (Math.random() < dt * 3) g.fx.emit(P.seaBubble, ck.x + (Math.random() - 0.5) * 0.8, ck.y + 1.6, ck.z + (Math.random() - 0.5) * 0.8, 0, 0.6, 0);
    if (this.cockle !== 'follow' || frozen) return;
    // Air for him: a vent's stream, a column of bubbles, or ground shallow enough to stand with his head out.
    const sea = g.realm.sea!;
    const air = g.grid.groundAt(ck.x, ck.z) > -1.0 || [...(sea.pockets ?? []), ...(sea.lifts ?? [])].some((a) => Math.hypot(ck.x - a.x, ck.z - a.z) < a.r + 0.5);
    if (air) {
      this.homeCockle(g);
      ck.visible = true;
      b.visible = false;
      ck.walkTo = null;
      g.fx.burst(P.seaBubble, ck.x, ck.y + 1, ck.z, 30, 2, 2);
      g.audio.sfx('gulp', ck.x, ck.z);
      g.bubbleAt(ck, 'Air! Air, air, air. I am going home.');
      g.ui.toast('Cockle breathes again', 'He is off home to the village. Merrow will want to know.', 3.5);
      g.save.data.flags.cockleSaved = true;
      g.quest('lostdiver', 1);
      g.writeSave();
      g.after(2.5, () => {
        g.fx.burst(P.seaBubble, ck.x, ck.y + 1, ck.z, 20, 1.5, 2);
        ck.visible = false;
      });
      return;
    }
    this.bubbleAir -= dt;
    if (this.bubbleAir <= 0) {
      this.cockle = 'breathless';
      ck.walkTo = null;
      g.fx.burst(P.seaBubble, ck.x, ck.y + 1, ck.z, 24, 2, 1.5);
      g.audio.sfx('pop', ck.x, ck.z);
      g.bubbleAt(ck, 'My bubble... Knight, a breath, please!');
      return;
    }
    if (this.bubbleAir < 8 && Math.random() < dt * 0.3) g.bubbleAt(ck, 'Hurry...');
    // Keep close behind the knight (a little back from him, not under his feet).
    const dx = p.x - ck.x, dz = p.z - ck.z, d = Math.hypot(dx, dz);
    ck.walkTo = d > 2.2 ? { x: p.x - (dx / d) * 1.6, z: p.z - (dz / d) * 1.6 } : null;
  }

  // ---------- the night raid ----------

  private startRaid(g: Game) {
    g.audio.sfx('alert');
    g.audio.sfx('roar', VILLAGE.x + 8, VILLAGE.z);
    g.shake(0.25);
    g.ui.toast('Night raid!', 'The crew wade ashore at the coral village. Drive them off.', 4);
    g.quest('nightraid', 0);
    this.raid = RAID.map((s) => {
      const e = new Enemy(s.type, s.x, s.z, g, 'raid');
      e.state = 'chase';
      e.model.rig.addTo(g.scene);
      g.enemies.push(e);
      g.fx.burst(P.splash, s.x, g.grid.groundAt(s.x, s.z) + 0.3, s.z, 16, 2, 3);
      return e;
    });
    // The villagers run indoors: each to the nearest house's porch, then in.
    const doors = HOUSES.map((deg) => {
      const a = (deg * Math.PI) / 180;
      return { x: VILLAGE.x + Math.cos(a) * 8.4, z: VILLAGE.z + Math.sin(a) * 8.4 };
    });
    for (const n of g.npcs) {
      if (!n.visible || n.def.caged || n.def.id === 'cockle' || Math.hypot(n.x - VILLAGE.x, n.z - VILLAGE.z) > 24) continue;
      const door = doors.reduce((a, b) => (Math.hypot(b.x - n.x, b.z - n.z) < Math.hypot(a.x - n.x, a.z - n.z) ? b : a));
      this.hid.set(n, n.def.speed);
      n.def.speed = 4.4;
      n.walkTo = { ...door };
      n.route = [];
    }
  }

  private updateRaid(dt: number, g: Game) {
    for (const [n] of this.hid)
      if (n.visible && (!n.walkTo || Math.hypot(n.walkTo.x - n.x, n.walkTo.z - n.z) < 0.3)) {
        n.visible = false;
        g.fx.burst(P.dust, n.x, n.y + 0.3, n.z, 4, 1);
      }
    if (!this.raid || this.raid.some((e) => e.alive)) return;
    this.raidEnd += dt;
    if (this.raidEnd < 1.5) return;
    // All down: the village comes out again, and thanks the knight.
    this.raid = null;
    this.raidEnd = 0;
    const f = g.save.data.flags;
    f.raidDone = true;
    for (const [n, speed] of this.hid) {
      n.def.speed = speed;
      n.walkTo = null;
      n.route = [];
      n.x = n.def.x;
      n.z = n.def.z;
      n.y = g.grid.groundAt(n.x, n.z) + (n.def.perch ?? 0);
      n.visible = true;
    }
    this.hid.clear();
    const p = g.player, gannet = g.npc('gannet');
    if (gannet) g.bubbleAt(gannet, 'They ran! Three cheers for the knight in the leaky suit!');
    p.coins += 50;
    g.combat.coins(p.x, p.y + 1, p.z, 50, true);
    g.audio.sfx('victory');
    g.ui.toast('The crew are driven off', 'The village gives you 50 coins: all it can spare, and more', 4);
    g.quest('nightraid', 1);
    g.writeSave();
  }

  tick(g: Game, dt: number) {
    const f = g.save.data.flags;
    this.bottle?.update(dt, g);
    this.dig?.update(dt);
    for (const s of this.shrimp)
      s.update(dt, g, (sh) => {
        sh.remove(g);
        f[`glowshrimp${sh.i}`] = true;
        const have = SHRIMP.filter((_, i) => f[`glowshrimp${i + 1}`]).length;
        g.audio.sfx('pop', sh.x, sh.z);
        g.audio.sfx('coin');
        g.fx.burst(SHRIMP_MOTE, sh.x, sh.y, sh.z, 16, 1.5, 1);
        g.pop(g.player, `glowing shrimp ${have}/${SHRIMP.length}`, '#ffb090');
        g.quest('glowbait', have >= SHRIMP.length ? 1 : 0);
        g.writeSave();
      });
    this.shrimp = this.shrimp.filter((s) => !s.taken);
    this.race?.update(dt, g, () => {
      const t = this.race!.time;
      if (f.raceWon) {
        g.ui.toast('Through every ring', `${t.toFixed(1)} breaths. Pike will not believe it twice.`, 3);
        return;
      }
      f.raceWon = true;
      g.player.coins += 50;
      g.combat.coins(g.player.x, g.player.y + 1, g.player.z, 50, true);
      g.ui.toast('You beat Pike\'s time', `${t.toFixed(1)} breaths. His winnings are yours: 50 coins.`, 4);
      g.quest('currentrace', 1);
      g.writeSave();
    });
    this.updateCockle(dt, g);
    this.updateRaid(dt, g);
  }

  /** What the errands' people say once the sea is free (undefined: not one of theirs). */
  victoryLine(id: string): string | undefined {
    const L: Record<string, string> = {
      brill: 'Daylight, and the fish are still biting. I did not know they could.',
      wrasse: 'Race you to the trench again. In daylight I will win.',
      winkle: 'He wants to dive the palace now. Over my body, I said. He said that was the idea.',
      cocklehome: 'I can see the bottom from the jetty. Forty years and I never could.',
    };
    return L[id];
  }
}
