import * as THREE from 'three';
import { FOES, HAZARDS, PLAYER } from '../config';
import { Geo } from '../engine/geo';
import { worldMaterial } from '../engine/materials';
import { P } from '../engine/particles';
import { clamp } from '../engine/util';
import type { EnemyType } from '../world/realm';
import { Enemy } from './enemies';
import type { Game } from './game';
import type { Model } from './models';
import { clamShell, makeCrab, makeDiver, makeEel, makeHarpooner, makeJelly, makePuffer, seaLook, swelling } from './seamodels';

// ---------------------------------------------------------------------------
// The Sunken Reef's own foes (the realm 3 plan, group 32). On land and in the shallows the Tidelord's crew:
// goblin divers in bucket, kettle and fishbowl helmets (their floats bob on the surface over them) and
// harpooners whose harpoons reel the knight in. Below, the sea's own creatures: the Jelly (the prototype's:
// felled, it splits in two), the crab (guards with its claw until a heavy blow flips it), the eel (lunges
// from its den), the pufferfish (swells into spikes; strike it small). And the giant clams on the sea floor.
// Every attack shows before it lands: a flash, a line on the ground fixed before it flies, a ring filling.
// ---------------------------------------------------------------------------

const KINDS: EnemyType[] = ['diver', 'harpooner', 'jelly', 'crab', 'eel', 'puffer'];

/** The knight, doing something that frees him from a harpoon's line: rolling clear, or cutting it. */
const ROLLS = ['roll', 'dash', 'airdash'];
const SWINGS = ['attack', 'spin', 'stab', 'plunge', 'wave'];

/** Moves a sea creature through the water: over reef steps a floating jump would climb, never out of deep
 *  water (it's aquatic), and not down into the abyss. Returns how far it went. */
function swim(e: Enemy, g: Game, dx: number, dz: number, speed: number, dt: number) {
  const l = Math.hypot(dx, dz);
  if (l < 0.01) return 0;
  if (e.elite) speed *= 1.15;
  speed *= e.tempo;
  const bx = e.x, bz = e.z;
  g.grid.move(e, (dx / l) * speed * dt, (dz / l) * speed * dt, 1.3, false);
  if (g.grid.groundAt(e.x, e.z) < e.y - 2.5) {
    e.x = bx;
    e.z = bz;
  }
  return Math.hypot(e.x - bx, e.z - bz);
}

/** A harpoon on its line: flying, in the knight (reeling him in), or coming back to the thrower's hand. */
interface Harpoon {
  mode: 'fly' | 'hooked' | 'back';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  flown: number;
  mesh: THREE.Mesh;
}

/** The harpooner's line on the ground while it takes aim: faint, following the knight; bright once it holds
 *  still (as the Warden's volley shows). */
const SIGHT = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.5, 0.25), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
const SIGHT_HELD = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 0.9, 0.35), transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });

let harpoonGeo: THREE.BufferGeometry | null = null;
let lineGeo: THREE.BufferGeometry | null = null;
let seaMat: THREE.Material | null = null;
const mat = () => (seaMat ??= worldMaterial());
/** A harpoon along +x: a thick shaft, an iron head with barbs (bigger than an arrow: it shows from above). */
function harpoonGeometry() {
  if (harpoonGeo) return harpoonGeo;
  const g = new Geo();
  g.box(-0.2, -0.04, 0, 1.1, 0.08, 0.08, '#7a5a38');
  g.box(0.42, -0.06, 0, 0.16, 0.12, 0.12, '#4a4a54');
  g.box(0.58, -0.05, 0, 0.22, 0.1, 0.1, '#c8ccd8');
  for (const s of [-1, 1]) g.beam([0.5, 0, 0], [0.38, 0, s * 0.14], 0.025, '#c8ccd8');
  return (harpoonGeo = g.build());
}
/** The line: a unit long, up +y (stretched between its ends). */
function lineGeometry() {
  if (lineGeo) return lineGeo;
  const g = new Geo();
  g.box(0, 0, 0, 0.06, 1, 0.06, '#d8c898');
  return (lineGeo = g.build());
}
const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/** A ring on the floor round a blow that's coming, a disc filling it as the moment nears (drawn over
 *  everything, like the Warden's marks): a clam about to snap, a pufferfish about to burst. */
class FillRing {
  private ring: THREE.Mesh;
  private fill: THREE.Mesh;
  private ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.7, 0.25), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
  private fillMat = this.ringMat.clone();
  constructor(r: number, g: Game) {
    this.fillMat.opacity = 0.2;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.12, r + 0.04, 32), this.ringMat);
    this.fill = new THREE.Mesh(new THREE.CircleGeometry(r - 0.12, 28), this.fillMat);
    for (const m of [this.ring, this.fill]) {
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 5;
      m.visible = false;
      g.scene.add(m);
    }
  }
  get visible() {
    return this.ring.visible;
  }
  /** Shown at (x, y, z), filled `k` of the way. */
  show(x: number, y: number, z: number, k: number, g: Game) {
    this.ring.visible = this.fill.visible = true;
    this.ring.position.set(x, y + 0.07, z);
    this.fill.position.set(x, y + 0.06, z);
    this.fill.scale.setScalar(Math.max(0.01, Math.min(1, k)));
    this.ringMat.opacity = 0.45 + 0.35 * Math.sin(g.time * 18);
  }
  hide() {
    this.ring.visible = this.fill.visible = false;
  }
  remove(g: Game) {
    g.scene.remove(this.ring, this.fill);
    for (const m of [this.ring, this.fill]) m.geometry.dispose();
    this.ringMat.dispose();
    this.fillMat.dispose();
  }
}

/**
 * What one of the Sunken Reef's own foes keeps between frames, and how it fights (the Enemy runs it: see
 * `sea` there). Divers fight as goblins do; the rest each have their ways here.
 */
export class SeaFoe {
  look = seaLook();
  model: Model;
  /** One of the two little Jellies a big one splits into. */
  small = false;
  /** A diver's float, where it bobs on the surface (it trails after the diver). */
  private float: { x: number; z: number } | null = null;
  /** Where an attack was aimed (fixed a moment before it goes), and how far it reaches. */
  private aim = 0;
  private reach = 0;
  private harpoon: Harpoon | null = null;
  private line: THREE.Mesh | null = null;
  /** The harpooner's aim on the ground, and the height of the ground it's drawn on (where the knight stood). */
  private sight: THREE.Mesh | null = null;
  private sightY = 0;
  private hookedT = 0;
  /** The crab's scuttle: which way, and for how long more. */
  private side = 1;
  private sideT = 0;
  /** The pufferfish's spikes prick a knight who touches it, now and then; the ring its spikes will fill. */
  private prickT = 0;
  private ring: FillRing | null = null;
  private seenOnce = false;

  static of(type: EnemyType, e: Enemy) {
    return KINDS.includes(type) ? new SeaFoe(e) : undefined;
  }

  constructor(private e: Enemy) {
    const t = e.type;
    if (t === 'diver') e.dives = true;
    else if (t !== 'harpooner') e.aquatic = true;
    // (Divers wear what the wrecks gave them: where each stands picks its helmet.)
    const kit = Math.abs(Math.floor(e.x * 7 + e.z * 13)) % 3;
    this.model =
      t === 'diver' ? makeDiver(kit, this.look)
      : t === 'harpooner' ? makeHarpooner(this.look)
      : t === 'jelly' ? makeJelly()
      : t === 'crab' ? makeCrab()
      : t === 'eel' ? makeEel(this.look)
      : makePuffer();
    if (t === 'eel') this.look.ext = 0.15;
    if (t === 'jelly' || t === 'puffer') this.model.rig.lift = t === 'jelly' ? FOES.jelly.hover : 0.8;
  }

  /** Rough standing height (for blows from above): a hovering creature reaches up past its body. */
  get height() {
    const t = this.e.type;
    return t === 'jelly' ? (this.small ? 1.2 : 1.6) : t === 'puffer' ? 1.5 : t === 'crab' ? 0.75 : t === 'eel' ? 0.6 : 1.3;
  }

  /** A little Jelly, split from a big one. */
  makeSmall(g: Game) {
    const e = this.e;
    this.small = true;
    e.golden = false;
    e.hp = e.maxHp = FOES.jelly.smallHp * (g.realm.foeHp ?? 1);
    e.r *= 0.65;
    e.model.rig.scale *= 0.6;
  }

  update(dt: number, g: Game, d: number) {
    const t = this.e.type;
    if (t === 'harpooner') this.harpooner(dt, g, d);
    else if (t === 'jelly') this.jelly(dt, g, d);
    else if (t === 'crab') this.crab(dt, g, d);
    else if (t === 'eel') this.eel(dt, g, d);
    else if (t === 'puffer') this.puffer(dt, g, d);
  }

  /** Before the model is posed: how high it swims, where a diver's float bobs, where the eel's den lies. */
  pose(g: Game, dt: number) {
    const e = this.e, rig = e.model.rig, t = e.type, sea = g.realm.sea;
    if (t === 'jelly' || t === 'puffer') {
      // Drifting in the water at the knight's chest, bobbing; lower in a lunge, winded or dying.
      const base = t === 'jelly' ? FOES.jelly.hover * (this.small ? 0.8 : 1) : 0.8;
      const want = e.state === 'dead' ? 0.25 : e.state === 'swoop' ? base - 0.25 : t === 'puffer' && e.state === 'recover' && e.t > 0.45 ? base - 0.3 : base;
      const bob = Math.sin(g.time * 1.8 + e.bob) * 0.1;
      rig.lift += (want + bob - rig.lift) * Math.min(1, dt * 4);
    } else if (t === 'diver') {
      // The float on the surface over a diver whose head is under it (it trails behind as the diver walks).
      const top = e.y + 1.45 * rig.scale;
      if (sea && e.state !== 'dead' && top < sea.surface - 0.05 && g.grid.waterAt(e.x, e.z) > -100) {
        const tx = e.x - e.fx * 0.5, tz = e.z - e.fz * 0.5;
        if (!this.float) this.float = { x: tx, z: tz };
        const k = Math.min(1, dt * 2.5);
        this.float.x += (tx - this.float.x) * k;
        this.float.z += (tz - this.float.z) * k;
        this.look.float = { x: this.float.x - e.x, y: sea.surface + Math.sin(g.time * 2.4 + e.bob) * 0.05 - 0.02 - e.y, z: this.float.z - e.z };
        // (And a trail of bubbles up from its helmet.)
        if (Math.random() < dt * 2) g.fx.emit(P.seaBubble, e.x - e.fz * 0.1, top, e.z + e.fx * 0.1, 0, 1.2, 0);
      } else {
        this.float = null;
        this.look.float = null;
      }
    } else if (t === 'eel') this.look.den = { x: e.home.x - e.x, y: g.grid.groundAt(e.home.x, e.home.z) - e.y, z: e.home.z - e.z };
    else if (t === 'harpooner') this.look.thrown = !!this.harpoon;
  }

  /**
   * The knight's blow lands, before anything else: a crab's claw turns it from the front (a heavy blow flips
   * the crab instead); an eel in its den is out of reach; a swollen pufferfish's spikes take most of it, and
   * prick. Returns what came of it, or null for a blow taken as any foe takes one.
   */
  hit(dmg: number, dx: number, dz: number, kb: number, finisher: boolean, g: Game): 'hit' | 'blocked' | null {
    const e = this.e, t = e.type;
    if (t === 'crab' && e.state !== 'stun' && e.state !== 'strike' && e.state !== 'recover' && -(dx * e.fx + dz * e.fz) > 0.2) {
      if (finisher) {
        // A heavy blow knocks the claw aside and the crab over: on its back, belly up, for a while.
        e.set('stun');
        e.vx = dx * kb * 0.5;
        e.vz = dz * kb * 0.5;
        e.flashT = 0.1;
        g.audio.sfx('shieldBreak', e.x, e.z);
        g.fx.burst(P.spark, e.x, e.y + 0.5, e.z, 12, 3.5, 2);
        g.pop(e, 'flipped!', '#ffd0a0');
        return 'hit';
      }
      e.vx = dx * 1.5;
      e.vz = dz * 1.5;
      this.tip(g, 'crab');
      return 'blocked';
    }
    if (t === 'eel' && e.state === 'hide') {
      this.tip(g, 'eel');
      return 'blocked';
    }
    if (t === 'puffer' && swelling(e.state, e.t, FOES.puffer.windup) >= 0.5) {
      e.hp -= dmg * FOES.puffer.spiked;
      e.flashT = 0.1;
      g.fx.burst(P.spark, e.x, e.y + e.model.rig.lift, e.z, 8, 3, 2);
      g.audio.sfx('clang', e.x, e.z);
      this.prick(g);
      this.tip(g, 'puffer');
      if (e.hp <= 0) e.die(g);
      return 'hit';
    }
    return null;
  }

  /** Felled: a big Jelly splits in two little ones; a harpoon out on its line goes slack. */
  died(g: Game) {
    const e = this.e;
    this.cancel(g);
    if (e.type === 'jelly' && !this.small) {
      // (A moment later, so the blow that felled it can't cut the little ones down too.)
      g.after(0.2, () => {
        g.audio.sfx('squelch', e.x, e.z);
        g.fx.burst(P.seaBubble, e.x, e.y + 0.9, e.z, 16, 2, 1);
        for (const s of [-1, 1]) {
          let x = e.x - e.fz * s * 0.7, z = e.z + e.fx * s * 0.7;
          if (!g.grid.inside(Math.floor(x), Math.floor(z)) || !g.grid.isDeep(Math.floor(x), Math.floor(z))) [x, z] = [e.x, e.z];
          const j = new Enemy('jelly', x, z, g, e.group);
          j.sea!.makeSmall(g);
          j.state = 'recover';
          j.cooldown = 0.6;
          j.vx = -e.fz * s * 4;
          j.vz = e.fx * s * 4;
          j.model.rig.lift = 0.6;
          j.model.rig.addTo(g.scene);
          g.enemies.push(j);
        }
      });
    }
  }

  /** The world resets, or the foe goes: a harpoon and its line are gone. */
  cancel(g: Game) {
    this.drop(g);
    this.ring?.remove(g);
    this.ring = null;
    if (this.sight) g.scene.remove(this.sight);
    this.sight = null;
  }

  private tip(g: Game, kind: 'crab' | 'eel' | 'puffer' | 'harpoon') {
    if (!g.settings.hints || !g.firstTime('sea-' + kind)) return;
    const touch = g.input.usingTouch, guard = touch ? 'tap the shield' : `tap <kbd>${g.input.label('guard')}</kbd>`;
    const tips = {
      crab: 'Its claw turns your blows from the front. Get round it (it turns slowly), strike while its claw is out after a pinch, or flip it with a heavy blow: the last of a combo.',
      eel: 'Nothing reaches an eel in its den. Let it lunge (step off its line), then strike it before it pulls back.',
      puffer: 'Swollen, its spikes take your blows and prick back. Back off until it goes down, then strike it small.',
      harpoon: `Hooked: you're being reeled in. Swing to cut the line, or ${guard} to roll free.`,
    };
    g.ui.hint(tips[kind], 7);
  }

  // ---------- the harpooner ----------

  /** Keeps its distance; takes aim (the line on the ground follows the knight, then holds still before the
   *  throw); a harpoon that strikes home hooks him and the harpooner hauls him in. */
  private harpooner(dt: number, g: Game, d: number) {
    const e = this.e, p = g.player, F = FOES.harpooner;
    e.telegraph = 0;
    this.harpoonTick(dt, g);
    if (this.sight) this.sight.visible = e.state === 'aim';
    switch (e.state) {
      case 'idle':
        if (e.sees(g, F.aggro)) {
          e.set('alert');
          g.alert(e);
        }
        break;
      case 'alert':
        e.faceTo(p.x, p.z);
        if (e.t > 0.4) e.set('chase');
        break;
      case 'chase':
      case 'retreat': {
        if (!p.alive || d > F.aggro + 6 || Math.hypot(e.x - e.home.x, e.z - e.home.z) > 20) {
          e.set(e.guard ? 'idle' : 'return');
          break;
        }
        e.faceTo(p.x, p.z);
        if (!e.guard && d < 3.4) {
          e.walk(g, e.x - p.x, e.z - p.z, F.speed, dt);
          e.state = 'retreat';
        } else if (!e.guard && d > F.reach - 1) {
          e.walk(g, p.x - e.x, p.z - e.z, F.speed, dt);
          e.state = 'chase';
        } else if (e.cooldown <= 0 && !this.harpoon && e.sees(g, F.reach + 1)) e.set('aim');
        break;
      }
      case 'aim': {
        const wind = F.windup / e.tempo, locked = e.t >= wind - F.lock;
        if (!locked) {
          e.faceTo(p.x, p.z);
          this.aim = Math.atan2(p.z - e.z, p.x - e.x);
          this.reach = clamp(d + 1.5, 3, F.reach + 1);
          this.sightY = p.y;
        }
        e.telegraph = e.t > wind - 0.4 ? 1 : 0;
        this.showSight(g, locked);
        if (e.t >= wind) {
          this.throwHarpoon(g);
          e.set('strike');
        }
        break;
      }
      case 'strike':
        // Watching it fly (see harpoonTick: hooked, it hauls; missed, it winds the line in).
        if (!this.harpoon || this.harpoon.mode === 'back') {
          e.set('recover');
          e.cooldown = F.cooldown[0] + Math.random() * (F.cooldown[1] - F.cooldown[0]);
        }
        break;
      case 'reel':
        e.faceTo(p.x, p.z);
        break;
      case 'recover':
        if (e.t > 0.6) e.set('chase');
        break;
      case 'return': {
        const dx = e.home.x - e.x, dz = e.home.z - e.z;
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.25 * dt);
        if (e.sees(g, F.aggro) && e.inPatch(g, 20)) e.set('chase');
        else if (Math.hypot(dx, dz) < 0.6 || e.t > 8) e.set('idle');
        else {
          e.faceTo(e.home.x, e.home.z);
          e.walk(g, dx, dz, F.speed * 0.7, dt);
        }
        break;
      }
      case 'hurt':
        if (e.t > 0.35) e.set('chase');
        break;
      case 'stun':
        if (e.t > 1.2) e.set('chase');
        break;
    }
  }

  /** The aim's line on the ground, at the knight's level (he may stand a step above or below). */
  private showSight(g: Game, held: boolean) {
    const e = this.e, a = this.aim, L = this.reach;
    if (!this.sight) {
      this.sight = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.14), SIGHT);
      this.sight.renderOrder = 6;
      g.scene.add(this.sight);
    }
    const m = this.sight;
    m.visible = true;
    m.material = held ? SIGHT_HELD : SIGHT;
    if (!held) SIGHT.opacity = 0.22 + 0.12 * Math.sin(g.time * 18);
    m.scale.x = L;
    m.position.set(e.x + (Math.cos(a) * L) / 2, this.sightY + 0.08, e.z + (Math.sin(a) * L) / 2);
    m.rotation.set(-Math.PI / 2, -a, 0, 'YXZ');
  }

  private hand() {
    const e = this.e;
    return _b.set(e.x + e.fx * 0.35 - e.fz * 0.2, e.y + 1.2 * e.model.rig.scale, e.z + e.fz * 0.35 + e.fx * 0.2);
  }

  private throwHarpoon(g: Game) {
    const e = this.e, p = g.player, F = FOES.harpooner, h = this.hand();
    const sp = F.speedShot * g.shotsAt(h.y), cx = Math.cos(this.aim), cz = Math.sin(this.aim);
    // Level with the knight's chest by the end of the line.
    const vy = ((p.y + 0.9 - h.y) / Math.max(1, this.reach)) * sp;
    const mesh = new THREE.Mesh(harpoonGeometry(), mat());
    mesh.castShadow = true;
    g.scene.add(mesh);
    this.line = new THREE.Mesh(lineGeometry(), mat());
    g.scene.add(this.line);
    this.harpoon = { mode: 'fly', x: h.x, y: h.y, z: h.z, vx: cx * sp, vy, vz: cz * sp, flown: 0, mesh };
    g.audio.sfx('throw', e.x, e.z);
    g.audio.sfx('reel', e.x, e.z);
  }

  /** The harpoon: in flight it strikes the knight (blocked by a shield, rolled through), the ground or a
   *  wall; in the knight it hauls him in, until he's close, he rolls or cuts the line, or time's up; then
   *  it comes back to the hand. */
  private harpoonTick(dt: number, g: Game) {
    const h = this.harpoon, e = this.e, p = g.player, F = FOES.harpooner;
    if (!h) return;
    if (h.mode === 'fly') {
      const nx = h.x + h.vx * dt, ny = h.y + h.vy * dt, nz = h.z + h.vz * dt;
      h.flown += Math.hypot(nx - h.x, nz - h.z);
      const wall = !g.grid.lineClear(h.x, h.z, nx, nz, ny - 0.9) || g.grid.groundAt(nx, nz) > ny;
      [h.x, h.y, h.z] = [nx, ny, nz];
      if (p.alive && Math.hypot(p.x - h.x, p.z - h.z) < 0.5 && h.y > p.y && h.y < p.y + 1.7) {
        const res = p.hurt(1, e.x, e.z, g, { kb: 0.5 });
        if (res !== 'dodged' && res !== 'ignored') {
          g.afterHit(res, h.x, h.z, e);
          if (res === 'hit' && p.alive && !p.riding && e.state === 'strike') {
            h.mode = 'hooked';
            this.hookedT = 0;
            e.set('reel');
            g.pop(p, 'hooked!', '#e8d8a0');
            g.audio.sfx('reel', p.x, p.z);
            this.tip(g, 'harpoon');
          } else {
            h.mode = 'back';
            g.fx.burst(P.spark, h.x, h.y, h.z, 8, 3, 2);
          }
        }
      }
      if (h.mode === 'fly' && (wall || h.flown > this.reach + 0.5)) {
        h.mode = 'back';
        g.audio.sfx('arrowThunk', h.x, h.z);
        g.fx.burst(P.seaBubble, h.x, h.y, h.z, 4, 1);
      }
    } else if (h.mode === 'hooked') {
      this.hookedT += dt;
      const dx = e.x - p.x, dz = e.z - p.z, dd = Math.hypot(dx, dz);
      const rolled = ROLLS.includes(p.state), cut = SWINGS.includes(p.state);
      if (e.state !== 'reel' || !p.alive || g.flying || rolled || cut || this.hookedT > F.pullTime || dd <= F.pullStop + 0.05
        || !g.grid.lineClear(e.x, e.z, p.x, p.z, Math.max(e.y, p.y) + 0.3)) {
        if (p.alive && (rolled || cut)) g.pop(p, cut ? 'line cut!' : 'free!', '#e8d8a0');
        h.mode = 'back';
        if (e.state === 'reel') {
          e.set('recover');
          e.cooldown = F.cooldown[0] + Math.random() * (F.cooldown[1] - F.cooldown[0]);
        }
      } else {
        // Hauled in (he can't walk against it).
        const step = Math.min(dd - F.pullStop, F.pull * dt);
        g.grid.move(p, (dx / dd) * step, (dz / dd) * step, PLAYER.stepUp);
        p.vx = p.vz = 0;
        h.x = p.x;
        h.y = p.y + 0.9;
        h.z = p.z;
        if (Math.random() < dt * 8) g.audio.sfx('reel', e.x, e.z);
      }
    } else {
      // Wound back in.
      const a = this.hand(), dx = a.x - h.x, dy = a.y - h.y, dz = a.z - h.z, dd = Math.hypot(dx, dy, dz);
      if (dd < 0.4 || e.state === 'dead') return this.drop(g);
      const s = Math.min(dd, 10 * dt) / dd;
      h.x += dx * s;
      h.y += dy * s;
      h.z += dz * s;
    }
    // The harpoon points along its flight (or back along the line), the line runs from the hand to it.
    const a = this.hand();
    const fx = h.mode === 'fly' ? h.vx : h.x - a.x, fz = h.mode === 'fly' ? h.vz : h.z - a.z;
    h.mesh.position.set(h.x, h.y, h.z);
    h.mesh.rotation.set(0, -Math.atan2(fz, fx), h.mode === 'fly' ? Math.atan2(h.vy, Math.hypot(h.vx, h.vz)) : 0, 'YZX');
    if (this.line) {
      _a.set(h.x, h.y, h.z).sub(a);
      const len = _a.length();
      this.line.position.copy(a);
      this.line.quaternion.setFromUnitVectors(UP, _a.normalize());
      this.line.scale.set(1, Math.max(0.01, len), 1);
    }
  }

  /** The harpoon and its line, gone. */
  private drop(g: Game) {
    if (this.harpoon) g.scene.remove(this.harpoon.mesh);
    if (this.line) g.scene.remove(this.line);
    this.harpoon = null;
    this.line = null;
  }

  // ---------- the Jelly ----------

  /** Drifts after the knight in pulses; close, it squeezes (it flashes; its aim fixed a moment before) and
   *  lunges, stinging what it touches: a big one a heart, a little one poison. */
  private jelly(dt: number, g: Game, d: number) {
    const e = this.e, p = g.player, F = FOES.jelly, small = this.small;
    e.telegraph = 0;
    const speed = F.speed * (small ? 1.5 : 1);
    switch (e.state) {
      case 'idle': {
        const a = g.time * 0.4 + e.bob;
        swim(e, g, e.home.x + Math.cos(a) * 1.5 - e.x, e.home.z + Math.sin(a * 1.3) * 1.5 - e.z, 0.6, dt);
        if (e.sees(g, F.aggro) && e.inPatch(g, 18)) {
          e.set('chase');
          g.alert(e);
        }
        break;
      }
      case 'chase': {
        if (!p.alive || Math.hypot(e.x - e.home.x, e.z - e.home.z) > 16) {
          e.set('return');
          break;
        }
        e.faceTo(p.x, p.z);
        const push = 0.4 + 0.6 * Math.max(0, Math.sin(g.time * 6.3 + e.bob));
        if (d > F.reach * 0.6) swim(e, g, p.x - e.x, p.z - e.z, speed * push, dt);
        if (d < F.reach && e.cooldown <= 0) e.set('windup');
        break;
      }
      case 'windup': {
        const wind = (small ? 0.55 : F.windup) / e.tempo;
        if (e.t < wind - F.lock) {
          e.faceTo(p.x, p.z);
          this.aim = Math.atan2(p.z - e.z, p.x - e.x);
        }
        e.telegraph = e.t > wind - 0.4 ? 1 : 0;
        if (e.t >= wind) {
          e.set('swoop');
          e.chargeDir.set(Math.cos(this.aim), Math.sin(this.aim));
          g.audio.sfx('squelch', e.x, e.z);
        }
        break;
      }
      case 'swoop': {
        const moved = swim(e, g, e.chargeDir.x, e.chargeDir.y, F.lunge, dt);
        if (!e.struck && Math.hypot(p.x - e.x, p.z - e.z) < e.r + p.r + 0.3 && Math.abs(p.y - e.y) < 1.5) {
          e.struck = true;
          this.sting(g);
        }
        if (e.t > 0.35 || (e.t > 0.08 && moved < F.lunge * dt * 0.3)) {
          e.set('recover');
          e.cooldown = 1.2 + Math.random() * 0.8;
        }
        break;
      }
      case 'recover':
        if (e.t > 0.6) e.set('chase');
        break;
      case 'return': {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.25 * dt);
        if (e.sees(g, F.aggro) && e.inPatch(g, 16)) e.set('chase');
        else if (Math.hypot(e.home.x - e.x, e.home.z - e.z) < 0.8 || e.t > 8) e.set('idle');
        else swim(e, g, e.home.x - e.x, e.home.z - e.z, speed, dt);
        break;
      }
      case 'hurt':
        if (e.t > 0.3) e.set('chase');
        break;
      case 'stun':
        if (e.t > 1.3) e.set('chase');
        break;
      default:
        e.set('chase');
    }
  }

  private sting(g: Game) {
    const e = this.e, p = g.player;
    if (!this.small) {
      if (g.enemyHitsPlayer(e, 1, { kb: 6 }) === 'hit') g.pop(p, 'stung!', '#8ff0ff');
      return;
    }
    const res = p.harass(e.x, e.z, g, { kb: 3, stamina: 8 });
    if (res === 'blocked') g.audio.sfx('guard', e.x, e.z);
    if (res === 'hit') p.afflict('poison', g);
  }

  // ---------- the crab ----------

  /** Turns toward a point, no faster than `rate` (radians a second). */
  private turnTo(x: number, z: number, rate: number, dt: number) {
    const e = this.e, want = Math.atan2(z - e.z, x - e.x), cur = Math.atan2(e.fz, e.fx);
    let diff = want - cur;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const a = cur + clamp(diff, -rate * dt, rate * dt);
    e.fx = Math.cos(a);
    e.fz = Math.sin(a);
  }

  /** Faces the knight claw first (turning slowly) and scuttles sideways round him, edging in; in reach and
   *  square on, it raises the claw (it flashes) and pinches. On its back it can do nothing. */
  private crab(dt: number, g: Game, d: number) {
    const e = this.e, p = g.player, F = FOES.crab;
    e.telegraph = 0;
    switch (e.state) {
      case 'idle':
        if (e.sees(g, F.aggro)) {
          e.set('alert');
          g.alert(e);
        }
        break;
      case 'alert':
        this.turnTo(p.x, p.z, F.turn, dt);
        if (e.t > 0.35) e.set('chase');
        break;
      case 'chase': {
        if (!p.alive || Math.hypot(e.x - e.home.x, e.z - e.home.z) > 18) {
          e.set('return');
          break;
        }
        this.turnTo(p.x, p.z, F.turn, dt);
        this.sideT -= dt;
        if (this.sideT <= 0) {
          this.side = -this.side;
          this.sideT = 0.9 + Math.random() * 1.1;
        }
        const tx = p.x - e.x, tz = p.z - e.z, tl = Math.hypot(tx, tz) || 1;
        const inward = d > F.reach + 0.15 ? 0.8 : d < F.reach - 0.45 ? -0.5 : 0;
        const moved = swim(e, g, -e.fz * this.side + (tx / tl) * inward, e.fx * this.side + (tz / tl) * inward, F.speed, dt);
        if (moved < F.speed * dt * 0.3) this.sideT = 0;
        if (d < F.reach + 0.25 && e.cooldown <= 0 && (tx * e.fx + tz * e.fz) / tl > 0.8) e.set('windup');
        break;
      }
      case 'windup': {
        const wind = F.windup / e.tempo;
        // (It stops turning just before the pinch: a step aside and it misses.)
        if (e.t < wind - 0.3) this.turnTo(p.x, p.z, F.turn * 1.5, dt);
        e.telegraph = e.t > wind - 0.35 ? 1 : 0;
        if (e.t >= wind) {
          e.set('strike');
          g.audio.sfx('enemySwing', e.x, e.z);
        }
        break;
      }
      case 'strike': {
        if (e.t < 0.12) swim(e, g, e.fx, e.fz, 3.5, dt);
        if (!e.struck && e.t > 0.06) {
          e.struck = true;
          g.audio.sfx('snap', e.x, e.z);
          const dx = p.x - e.x, dz = p.z - e.z, dd = Math.hypot(dx, dz);
          const lands = dd < F.reach + p.r + 0.25 && (dx * e.fx + dz * e.fz) / (dd || 1) > 0.3 && Math.abs(p.y - e.y) < 1.2;
          if (lands && g.enemyHitsPlayer(e, 1, { kb: 6 }) === 'hit' && p.alive && Math.random() < F.maimChance) p.afflict('maim', g);
        }
        if (e.t > 0.3) {
          e.set('recover');
          e.cooldown = 1.1 + Math.random() * 0.6;
        }
        break;
      }
      case 'recover':
        if (e.t > 0.55) e.set('chase');
        break;
      case 'stun':
        // On its back, legs waving (it rights itself as it ends).
        if (e.t > F.flipTime) {
          e.set('chase');
          e.cooldown = 0.6;
        }
        break;
      case 'hurt':
        if (e.t > 0.3) e.set('chase');
        break;
      case 'return': {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.25 * dt);
        if (e.sees(g, F.aggro) && e.inPatch(g, 18)) e.set('chase');
        else if (Math.hypot(e.home.x - e.x, e.home.z - e.z) < 0.6 || e.t > 8) e.set('idle');
        else {
          this.turnTo(e.home.x, e.home.z, F.turn * 2, dt);
          swim(e, g, e.home.x - e.x, e.home.z - e.z, F.speed * 0.6, dt);
        }
        break;
      }
      default:
        e.set('chase');
    }
  }

  // ---------- the eel ----------

  /** How far it can lunge along its heading: through deep water, over its own level of the floor, nothing in
   *  the way. */
  private room(g: Game) {
    const e = this.e, den = e.home, y = g.grid.groundAt(den.x, den.z);
    let L = 0.6;
    while (L < FOES.eel.reach) {
      const x = den.x + e.fx * (L + 0.25), z = den.z + e.fz * (L + 0.25);
      if (!g.grid.inside(Math.floor(x), Math.floor(z)) || !g.grid.isDeep(Math.floor(x), Math.floor(z)) || Math.abs(g.grid.groundAt(x, z) - y) > 0.6
        || !g.grid.lineClear(den.x, den.z, x, z, y + 0.4)) break;
      L += 0.25;
    }
    return L;
  }

  /** Lies in its den (its eyes glow in the dark of it) watching; the knight in reach, it pokes its head out
   *  (it flashes; a line on the ground shows where it will go, fixed a moment before), lunges along it and
   *  bites, stays out a while (the time to strike it), and pulls back in. Struck, it flinches and pulls back. */
  private eel(dt: number, g: Game, d: number) {
    const e = this.e, p = g.player, F = FOES.eel, den = e.home;
    e.telegraph = 0;
    e.vx = e.vz = 0;
    let ext = this.look.ext;
    switch (e.state) {
      case 'aim': {
        const wind = F.windup / e.tempo, locked = e.t >= wind - F.lock;
        if (!locked) {
          e.faceTo(p.x, p.z);
          this.reach = clamp(Math.hypot(p.x - den.x, p.z - den.z) + 0.6, 1.4, this.room(g));
        }
        ext += (0.55 - ext) * Math.min(1, dt * 6);
        e.telegraph = e.t > wind - 0.4 ? 1 : 0;
        g.combat.aimFan(e, Math.atan2(e.fz, e.fx), 1, 0, Math.max(0.3, this.reach - ext), locked);
        if (e.t >= wind) {
          e.set('strike');
          g.audio.sfx('enemySwing', e.x, e.z);
        }
        break;
      }
      case 'strike': {
        ext = 0.55 + (this.reach - 0.55) * Math.min(1, e.t / 0.15);
        if (!e.struck && e.t > 0.04) {
          // Anything along its body from the den to its jaws.
          const vx = p.x - den.x, vz = p.z - den.z, along = clamp(vx * e.fx + vz * e.fz, 0, ext);
          const off = Math.hypot(vx - e.fx * along, vz - e.fz * along);
          if (off < 0.5 + p.r && Math.abs(p.y - e.y) < 1.3) {
            e.struck = true;
            g.audio.sfx('snap', p.x, p.z);
            g.enemyHitsPlayer(e, 1, { kb: 7 });
          }
        }
        if (e.t > 0.2) e.set('recover');
        break;
      }
      case 'recover':
        // Out and open to a blow, swaying, jaws working; then back in.
        if (e.t > F.out) e.set('retreat');
        break;
      case 'hurt':
      case 'retreat': {
        // (Struck, it flinches a moment, still out: a quick second blow lands too. Then back in.)
        if (e.state === 'hurt' && e.t < 0.3) break;
        const T = e.state === 'hurt' ? 0.22 : 0.35, t = e.state === 'hurt' ? e.t - 0.3 : e.t;
        ext = Math.max(0.15, ext - (this.reach / T) * dt);
        if (t >= T || ext <= 0.15) {
          e.cooldown = e.state === 'hurt' ? 1.6 : F.cooldown;
          e.set('hide');
        }
        break;
      }
      case 'stun':
        // Parried: dazed, out of its den.
        if (e.t > 1.4) e.set('retreat');
        break;
      default: {
        // In the den, watching the knight come.
        if (e.state !== 'hide') e.set('hide');
        ext += (0.15 - ext) * Math.min(1, dt * 5);
        if (p.alive && d < 9 && !g.flying) e.faceTo(p.x, p.z);
        if (e.cooldown <= 0 && Math.hypot(p.x - den.x, p.z - den.z) < F.reach + 0.4 && e.sees(g, F.aggro)) {
          if (!this.seenOnce) g.alert(e);
          this.seenOnce = true;
          e.set('aim');
        }
      }
    }
    this.look.ext = ext;
    e.x = den.x + e.fx * ext;
    e.z = den.z + e.fz * ext;
  }

  // ---------- the pufferfish ----------

  /** A pufferfish's spikes prick the knight: no heart, a shove and his breath. */
  private prick(g: Game) {
    const e = this.e, p = g.player;
    if (!p.alive || p.riding) return;
    if (p.harass(e.x, e.z, g, { kb: 5, stamina: 12 }) === 'hit') g.pop(p, 'spines!', '#f4f0e0');
  }

  /** Drifts after the knight; close, it swells (it grows and flashes) and its spikes burst out round it (a
   *  heart); swollen it drifts after him, pricking at a touch; then it goes down, winded: strike it now. */
  private puffer(dt: number, g: Game, d: number) {
    const e = this.e, p = g.player, F = FOES.puffer;
    e.telegraph = 0;
    e.r = F.r * (1 + 1.1 * swelling(e.state, e.t, F.windup)) * (e.elite ? 1.3 : 1);
    this.prickT -= dt;
    if (e.state !== 'swell') this.ring?.hide();
    switch (e.state) {
      case 'idle': {
        const a = g.time * 0.5 + e.bob;
        swim(e, g, e.home.x + Math.cos(a) * 1.2 - e.x, e.home.z + Math.sin(a) * 1.2 - e.z, 0.5, dt);
        if (e.sees(g, F.aggro) && e.inPatch(g, 16)) {
          e.set('chase');
          g.alert(e);
        }
        break;
      }
      case 'chase':
        if (!p.alive || Math.hypot(e.x - e.home.x, e.z - e.home.z) > 14) {
          e.set('return');
          break;
        }
        e.faceTo(p.x, p.z);
        if (d > 1.2) swim(e, g, p.x - e.x, p.z - e.z, F.speed, dt);
        if (d < F.reach && e.cooldown <= 0) {
          e.set('swell');
          g.audio.sfx('puff', e.x, e.z);
        }
        break;
      case 'swell':
        e.faceTo(p.x, p.z);
        e.telegraph = e.t > F.windup - 0.45 ? 1 : 0;
        (this.ring ??= new FillRing(F.spikeR, g)).show(e.x, e.y, e.z, e.t / F.windup, g);
        if (e.t >= F.windup / e.tempo) {
          e.set('puffed');
          g.audio.sfx('snap', e.x, e.z);
          g.fx.burst(P.seaBubble, e.x, e.y + e.model.rig.lift, e.z, 14, 2.5, 1);
          if (Math.hypot(p.x - e.x, p.z - e.z) < F.spikeR + p.r && Math.abs(p.y - e.y) < 1.5) g.enemyHitsPlayer(e, 1, { kb: 8 });
        }
        break;
      case 'puffed':
        if (d > 1.2) swim(e, g, p.x - e.x, p.z - e.z, 0.5, dt);
        if (this.prickT <= 0 && d < F.spikeR * 0.8 + p.r && Math.abs(p.y - e.y) < 1.5) {
          this.prickT = 0.8;
          this.prick(g);
        }
        if (e.t > F.puffed) {
          e.set('recover');
          g.audio.sfx('squelch', e.x, e.z);
        }
        break;
      case 'recover':
        // Going down, then winded: small, low and slow.
        if (e.t > 0.45 + F.winded) {
          e.set('chase');
          e.cooldown = 0.3;
        }
        break;
      case 'return': {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.25 * dt);
        if (e.sees(g, F.aggro) && e.inPatch(g, 14)) e.set('chase');
        else if (Math.hypot(e.home.x - e.x, e.home.z - e.z) < 0.8 || e.t > 8) e.set('idle');
        else swim(e, g, e.home.x - e.x, e.home.z - e.z, F.speed, dt);
        break;
      }
      case 'hurt':
        if (e.t > 0.3) e.set('chase');
        break;
      case 'stun':
        if (e.t > 1.3) e.set('chase');
        break;
      default:
        e.set('chase');
    }
  }
}

// ---------- giant clams ----------

let clamGeo: { shell: THREE.BufferGeometry; lid: THREE.BufferGeometry } | null = null;

/**
 * A giant clam on the sea floor (the prototype's): it lies open, its pearl glowing inside; now and then
 * (and at once when the knight steps into it) a ring fills round it as it creaks, and it snaps shut on
 * whoever stands in it (a heart; a roll gets out). Struck while open, it gives up its pearl (once) and
 * flinches shut. Shut, it opens again after a while.
 */
export class GiantClam {
  y: number;
  pearl: boolean;
  private phase: 'open' | 'warn' | 'shut' = 'open';
  private t: number;
  private open = 1;
  private group = new THREE.Group();
  private lid = new THREE.Group();
  private gem: THREE.Mesh;
  private mark: FillRing;
  private key: string;

  constructor(public x: number, public z: number, g: Game) {
    this.y = g.grid.groundAt(x, z);
    this.key = `pearl@${Math.round(x)},${Math.round(z)}`;
    this.pearl = !g.save.data.flags[this.key];
    this.t = Math.random() * HAZARDS.clamOpen;
    if (!clamGeo) {
      const s = new Geo(), l = new Geo();
      clamShell(s, false);
      clamShell(l, true);
      clamGeo = { shell: s.build(), lid: l.build() };
    }
    const shell = new THREE.Mesh(clamGeo.shell, mat());
    shell.castShadow = shell.receiveShadow = true;
    const lid = new THREE.Mesh(clamGeo.lid, mat());
    lid.castShadow = true;
    lid.position.z = 0.5;
    this.lid.add(lid);
    this.lid.position.set(0, 0.19, -0.5);
    this.gem = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.3, 2.6) }));
    this.gem.position.set(0, 0.32, -0.05);
    this.gem.visible = this.pearl;
    this.group.add(shell, this.lid, this.gem);
    this.group.position.set(x, this.y, z);
    this.group.scale.setScalar(1.25);
    // Its mouth toward the open sea (away from the shore), turned a little each.
    this.group.rotation.y = Math.atan2(1, 1) + (Math.sin(x * 3.1 + z * 1.7) * 0.6);
    g.scene.add(this.group);
    this.mark = new FillRing(HAZARDS.clamR, g);
  }

  /** Is the knight in its jaws? */
  private inside(g: Game) {
    const p = g.player;
    return p.alive && Math.hypot(p.x - this.x, p.z - this.z) < HAZARDS.clamR && Math.abs(p.y - this.y) < 1.2;
  }

  update(dt: number, g: Game) {
    this.t += dt;
    const H = HAZARDS;
    if (this.phase === 'open' && (this.t > H.clamOpen || this.inside(g))) {
      this.phase = 'warn';
      this.t = 0;
      g.audio.sfx('creak', this.x, this.z);
    } else if (this.phase === 'warn' && this.t >= H.clamWarn) this.snap(g, true);
    else if (this.phase === 'shut' && this.t > H.clamShut) {
      this.phase = 'open';
      this.t = 0;
      g.fx.burst(P.seaBubble, this.x, this.y + 0.3, this.z, 6, 1);
    }
    // The lid: up when open, quivering as the ring fills, down when shut.
    const want = this.phase === 'shut' ? 0 : 1;
    this.open += (want - this.open) * Math.min(1, dt * (want ? 4 : 30));
    const quiver = this.phase === 'warn' ? Math.sin(g.time * 40) * 0.05 * (0.3 + this.t / H.clamWarn) : 0;
    this.lid.rotation.x = -(0.95 * this.open + quiver);
    if (this.phase === 'warn') {
      this.mark.show(this.x, this.y, this.z, this.t / H.clamWarn, g);
      if (Math.random() < dt * 10) g.fx.emit(P.seaBubble, this.x + (Math.random() - 0.5) * 0.6, this.y + 0.3, this.z + (Math.random() - 0.5) * 0.6, 0, 0.8, 0);
    }
    this.gem.visible = this.pearl && this.open > 0.3;
    if (this.gem.visible && Math.random() < dt * 1.5) g.fx.emit(P.coinGlint, this.x, this.y + 0.45, this.z, 0, 0.4, 0);
  }

  /** It snaps shut: on the knight, if he's in it (and `bites`). */
  private snap(g: Game, bites: boolean) {
    this.phase = 'shut';
    this.t = 0;
    this.mark.hide();
    g.audio.sfx('snap', this.x, this.z);
    g.audio.sfx('thud', this.x, this.z);
    g.fx.burst(P.seaBubble, this.x, this.y + 0.3, this.z, 12, 2, 1);
    g.fx.burst(P.dust, this.x, this.y + 0.1, this.z, 6, 1.5);
    if (!bites || !this.inside(g)) return;
    const p = g.player;
    const res = p.hurt(1, this.x, this.z, g, { unblockable: true, kb: 8 });
    g.afterHit(res, this.x, this.z, null);
    if (res === 'hit') g.pop(p, 'snap!', '#e0c8f0');
    if (g.settings.hints && g.firstTime('clam')) g.ui.hint('Giant clams snap shut on whoever stands in them: the ring warns you. Strike one while it\'s open for its pearl.', 7);
  }

  /** The knight's blow: open, it gives up its pearl (once) and flinches shut; shut, it clangs. */
  strike(g: Game) {
    if (this.phase === 'shut') {
      g.audio.sfx('clang', this.x, this.z);
      g.fx.burst(P.spark, this.x, this.y + 0.3, this.z, 6, 2, 1);
      return;
    }
    if (this.pearl) {
      this.pearl = false;
      g.save.data.flags[this.key] = true;
      g.combat.coins(this.x, this.y + 0.5, this.z, HAZARDS.clamPearl);
      g.audio.sfx('glint', this.x, this.z);
      g.pop({ x: this.x, y: this.y + 0.6, z: this.z }, 'a pearl!', '#f4ecff');
    }
    this.snap(g, false);
  }
}
