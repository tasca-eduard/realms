import * as THREE from 'three';
import { FOES } from '../config';
import { P } from '../engine/particles';
import { clamp } from '../engine/util';
import { makeArcher, makeBat, makeBoar, makeBomber, makeBrute, makeDarter, makeGoblin, makeKing, makeShaman, type Model } from './models';
import type { Game } from './game';
import type { EnemyType } from '../world/realm1';

type St = 'idle' | 'alert' | 'chase' | 'windup' | 'strike' | 'recover' | 'hurt' | 'stun' | 'dead' | 'aim' | 'retreat' | 'swoop' | 'paw' | 'charge' | 'return'
  | 'slam' | 'summon' | 'sleep' | 'wake' | 'jump' | 'flee' | 'chant' | 'blink';

interface Spec {
  hp: number;
  r: number;
  speed: number;
  aggro: number;
  reach: number;
  windup: number;
  coins: readonly [number, number];
}

// All the numbers live in config.ts (FOES) so balance is tuned in one place.
const SPECS = FOES as unknown as Record<EnemyType, Spec>;

export class Enemy {
  x: number;
  y: number;
  z: number;
  r: number;
  hp: number;
  maxHp: number;
  state: St = 'idle';
  t = 0;
  animT = Math.random() * 3;
  fx = -1;
  fz = 0;
  vx = 0;
  vz = 0;
  home: { x: number; z: number };
  model: Model;
  spec: Spec;
  flashT = 0;
  cooldown = 0;
  struck = false;
  shieldUp: boolean;
  flying: boolean;
  bob = Math.random() * 10;
  chargeDir = new THREE.Vector2();
  sideStep = 0;
  deathT = 0;
  removed = false;
  telegraph = 0;
  // Boss only.
  enraged = false;
  moveIdx = 0;
  summoned: Enemy[] = [];
  jumpFrom = new THREE.Vector3();
  jumpTo = new THREE.Vector3();

  golden = false;
  elite = false;
  /** Bats: some steal coins, then flee with them. */
  thief = false;
  loot = 0;
  escapeT = 0;
  /** Shaman's war-chant: faster feet, quicker blows. */
  hasteT = 0;
  blinkCd = 0;
  private armorPopT = -9;
  /** Where a firepot is headed (set when the thrower takes aim). */
  potTarget = new THREE.Vector2();
  private potRing: THREE.Mesh | null = null;
  /** Index in the realm's enemy list for placed foes; undefined for summoned ones. */
  spawnId?: number;

  constructor(public type: EnemyType, x: number, z: number, g: Game, public group?: string, public guard = false, elite = false) {
    this.spec = SPECS[type];
    this.x = x;
    this.z = z;
    this.y = g.grid.groundAt(x, z);
    this.r = this.spec.r;
    this.hp = this.maxHp = this.spec.hp;
    this.home = { x, z };
    this.shieldUp = type === 'shield';
    this.flying = type === 'bat';
    this.model =
      type === 'goblin' ? makeGoblin(false)
      : type === 'shield' ? makeGoblin(true)
      : type === 'archer' ? makeArcher()
      : type === 'bat' ? makeBat()
      : type === 'boar' ? makeBoar()
      : type === 'brute' ? makeBrute()
      : type === 'bomber' ? makeBomber()
      : type === 'darter' ? makeDarter()
      : type === 'shaman' ? makeShaman()
      : makeKing();
    this.fx = -0.7;
    this.fz = -0.7;
    this.model.rig.face(this.fx, this.fz, 0);
    // Elites: bigger and tougher, and they carry a power-up. Golden foes: rare, rich.
    if (elite) {
      this.elite = true;
      this.hp = this.maxHp = this.spec.hp * 3;
      this.r *= 1.3;
      this.model.rig.scale *= 1.35;
    } else if (type !== 'king' && Math.random() < 0.08) {
      this.golden = true;
      this.hp = this.maxHp = Math.ceil(this.spec.hp * 1.5);
    }
    // Seen through trees and walls whenever the knight has line of sight.
    this.model.rig.enableSilhouette(new THREE.Color(1.2, 0.32, 0.22), 2);
    this.model.rig.showSilhouette(false);
    if (type === 'bat') this.thief = Math.random() < FOES.bat.thiefChance;
    if (type === 'king') {
      this.state = 'sleep';
      this.fx = 1;
      this.fz = 0;
      this.model.rig.face(1, 0, 0);
    }
    if (this.flying) this.y += 1.3;
  }

  get alive() {
    return this.state !== 'dead';
  }
  /** Rough standing height, for attacks from above. */
  get height() {
    const base = this.type === 'king' ? 2.6 : this.type === 'boar' ? 1.1 : this.type === 'bat' ? 0.5 : this.type === 'archer' ? 1.7 : this.type === 'brute' ? 1.8 : 1.3;
    return base * this.model.rig.scale;
  }
  get solid() {
    return this.alive && !this.flying;
  }

  private set(s: St) {
    this.state = s;
    this.t = 0;
    this.struck = false;
  }

  /** Is the knight close enough to this foe's home to be worth chasing? */
  private inPatch(g: Game, leash: number) {
    return Math.hypot(g.player.x - this.home.x, g.player.z - this.home.z) < leash - 4;
  }

  private distTo(g: Game) {
    return Math.hypot(g.player.x - this.x, g.player.z - this.z);
  }

  private faceTo(x: number, z: number) {
    const dx = x - this.x, dz = z - this.z, l = Math.hypot(dx, dz);
    if (l > 0.01) {
      this.fx = dx / l;
      this.fz = dz / l;
    }
  }

  private sees(g: Game, range: number) {
    const p = g.player;
    if (!p.alive) return false;
    const d = this.distTo(g);
    if (d > range) return false;
    if (Math.abs(p.y - this.y) > 3.5 && !this.flying) return false;
    return g.grid.lineClear(this.x, this.z, p.x, p.z, Math.max(this.y, p.y) - (this.flying ? 1.3 : 0));
  }

  /** How much faster this foe acts (the shaman's chant). */
  get tempo() {
    return this.hasteT > 0 ? 1.35 : 1;
  }

  private walk(g: Game, dx: number, dz: number, speed: number, dt: number) {
    if (this.elite) speed *= 1.15;
    speed *= this.tempo;
    const l = Math.hypot(dx, dz);
    if (l < 0.01) return;
    let mx = (dx / l) * speed * dt, mz = (dz / l) * speed * dt;
    if (this.sideStep !== 0) {
      const s = Math.sign(this.sideStep);
      [mx, mz] = [mx * 0.3 - mz * s, mz * 0.3 + mx * s];
      this.sideStep -= dt * s;
      if (Math.abs(this.sideStep) < 0.05 || Math.sign(this.sideStep) !== s) this.sideStep = 0;
    }
    const bx = this.x, bz = this.z;
    if (this.flying) {
      this.x += mx;
      this.z += mz;
    } else {
      g.grid.move(this, mx, mz, 0.45, true);
      const moved = Math.hypot(this.x - bx, this.z - bz);
      if (moved < speed * dt * 0.3 && this.sideStep === 0) this.sideStep = (Math.random() < 0.5 ? -1 : 1) * 0.6;
    }
  }

  update(dt: number, g: Game) {
    this.t += dt;
    this.animT += dt;
    this.flashT = Math.max(0, this.flashT - dt);
    this.cooldown = Math.max(0, this.cooldown - dt * this.tempo);
    this.blinkCd = Math.max(0, this.blinkCd - dt);
    if (this.hasteT > 0) {
      this.hasteT -= dt;
      if (Math.random() < dt * 12) g.fx.emit(P.haste, this.x + (Math.random() - 0.5) * 0.5, this.y + 0.4 + Math.random(), this.z + (Math.random() - 0.5) * 0.5, 0, 0.5, 0);
    }
    const p = g.player;
    const d = this.distTo(g);

    if (this.state === 'dead') {
      this.deathT += dt;
      if (this.deathT > (this.type === 'king' ? 3 : 0.9)) this.removed = true;
      this.render(g, dt);
      return;
    }

    // Knockback.
    if (Math.abs(this.vx) + Math.abs(this.vz) > 0.05) {
      if (this.flying) {
        this.x += this.vx * dt;
        this.z += this.vz * dt;
      } else g.grid.move(this, this.vx * dt, this.vz * dt, 0.45, true);
      const k = Math.exp(-9 * dt);
      this.vx *= k;
      this.vz *= k;
    }

    if (this.type === 'king') this.bossUpdate(dt, g, d);
    else if (this.type === 'bat') this.batUpdate(dt, g, d);
    else if (this.type === 'shaman') this.shamanUpdate(dt, g, d);
    else if (this.type === 'archer' || this.type === 'bomber' || this.type === 'darter') this.archerUpdate(dt, g, d);
    else if (this.type === 'boar') this.boarUpdate(dt, g, d);
    else this.meleeUpdate(dt, g, d);

    // Keep off each other.
    if (!this.flying)
      for (const o of g.enemies) {
        if (o === this || !o.solid) continue;
        const dx = this.x - o.x, dz = this.z - o.z, rr = this.r + o.r;
        const d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-6) {
          const dd = Math.sqrt(d2), push = (rr - dd) * 0.5;
          g.grid.move(this, (dx / dd) * push, (dz / dd) * push, 0.45, true);
        }
      }
    if (!this.flying) this.y = g.grid.groundAt(this.x, this.z);
    void p;

    this.render(g, dt);
  }

  private seenT = 0;
  private seen = false;

  private render(g: Game, dt: number) {
    const rig = this.model.rig;
    // Line of sight from the knight's eyes, re-checked a few times a second.
    this.seenT -= dt;
    if (this.seenT <= 0) {
      this.seenT = 0.15 + Math.random() * 0.05;
      const p = g.player;
      const d = Math.hypot(p.x - this.x, p.z - this.z);
      this.seen = this.alive && p.alive && d < 18 && g.grid.lineClear(p.x, p.z, this.x, this.z, Math.max(p.y, this.y - (this.flying ? 1.3 : 0)) + 0.6);
    }
    rig.showSilhouette(this.seen);
    if (rig.silMat) {
      const tel = this.telegraph > 0 ? 0.5 + 0.5 * Math.sin(g.time * 40) : 0;
      rig.silMat.color.setRGB(0.85 + tel * 1.6, 0.12 + tel * 1.3, 0.08 + tel * 0.3);
      rig.silMat.opacity = 0.6 + tel * 0.3;
    }
    if (this.state !== 'dead' && this.state !== 'stun' && this.state !== 'charge') rig.face(this.fx, this.fz, dt, this.type === 'king' ? 6 : 10);
    this.model.animate(dt, this.x, this.z, this.state, this.t, g.time);
    const tel = this.telegraph > 0 ? 0.3 + 0.3 * Math.sin(g.time * 40) : 0;
    const dying = this.state === 'dead' ? Math.max(0, 1 - this.deathT * 4) : 0;
    rig.flash = Math.max(this.flashT > 0 ? 1 : 0, tel, dying);
    const gy = this.flying ? g.grid.groundAt(this.x, this.z) : this.y;
    const by = this.flying ? this.y + Math.sin(g.time * 5 + this.bob) * 0.12 : this.y;
    // Sink into the ground once fallen.
    const sink = this.state === 'dead' && !this.flying ? Math.max(0, this.deathT - 0.5) * 0.8 : 0;
    rig.place(g.cam, this.x, by - sink, this.z, gy, true);
    if (this.state === 'stun') rig.tint.setRGB(0.75, 0.82, 1.25);
    else if (this.golden) rig.tint.setRGB(1.7, 1.3, 0.45);
    else if (this.elite) rig.tint.setRGB(1.15, 0.8, 0.8);
    else if (this.hasteT > 0) rig.tint.setRGB(1.3, 0.85, 0.8);
    else rig.tint.setRGB(1, 1, 1);
    if (this.golden && this.alive && Math.random() < dt * 4) g.fx.emit(P.coinGlint, this.x + (Math.random() - 0.5) * 0.6, this.y + Math.random() * 1.4, this.z + (Math.random() - 0.5) * 0.6, 0, 0.6, 0);
  }

  // ---------- behaviours ----------

  private meleeUpdate(dt: number, g: Game, d: number) {
    const p = g.player;
    const spec = this.spec;
    this.telegraph = 0;
    switch (this.state) {
      case 'idle':
        if (this.sees(g, spec.aggro)) {
          this.set('alert');
          g.alert(this);
        } else if (this.t > 2.5 && Math.random() < 0.01) this.set('return');
        break;
      case 'return': {
        const dx = this.home.x - this.x, dz = this.home.z - this.z;
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25 * dt);
        if (this.sees(g, spec.aggro) && this.inPatch(g, 20)) this.set('chase');
        else if (Math.hypot(dx, dz) < 0.6 || this.t > 6) this.set('idle');
        else {
          this.faceTo(this.home.x, this.home.z);
          this.walk(g, dx, dz, spec.speed * 0.5, dt);
        }
        break;
      }
      case 'alert':
        this.faceTo(p.x, p.z);
        if (this.t > 0.35) this.set('chase');
        break;
      case 'chase': {
        if (!p.alive || Math.hypot(this.x - this.home.x, this.z - this.home.z) > 20) {
          this.set('return');
          break;
        }
        this.faceTo(p.x, p.z);
        if (d < spec.reach + 0.1 && this.cooldown <= 0) {
          this.set('windup');
          break;
        }
        // Circle a little when others are closer, so they don't all pile in.
        const crowd = g.enemies.filter((e) => e !== this && e.alive && e.state === 'windup').length;
        const want = crowd > 1 ? 2.4 : spec.reach * 0.8;
        if (d > want) this.walk(g, p.x - this.x, p.z - this.z, spec.speed, dt);
        break;
      }
      case 'windup': {
        const wind = spec.windup / this.tempo;
        // The brute stops turning just before the blow: step aside and it misses.
        if (this.type !== 'brute' || this.t < wind - 0.35) this.faceTo(p.x, p.z);
        this.telegraph = this.t > wind - (this.type === 'brute' ? 0.4 : 0.25) ? 1 : 0;
        if (this.t >= wind) {
          this.set('strike');
          g.audio.sfx(this.type === 'brute' ? 'swingHeavy' : 'enemySwing', this.x, this.z);
        }
        break;
      }
      case 'strike': {
        const brute = this.type === 'brute';
        if (this.t < 0.14) this.walk(g, this.fx, this.fz, brute ? 3 : 5, dt);
        if (!this.struck && this.t > (brute ? 0.1 : 0.05)) {
          this.struck = true;
          const dx = p.x - this.x, dz = p.z - this.z, dd = Math.hypot(dx, dz);
          const lands = dd < spec.reach + p.r + 0.2 && (dx * this.fx + dz * this.fz) / (dd || 1) > (brute ? 0.4 : 0.2) && Math.abs(p.y - this.y) < 1.2 && g.clearBetween(this.x, this.z, p.x, p.z, Math.max(p.y, this.y) + 0.3, 0.6);
          if (brute) g.hammerImpact(this);
          if (lands && brute) g.bruteHits(this);
          else if (lands) g.enemyHitsPlayer(this, 1);
        }
        if (this.t > (brute ? 0.45 : 0.3)) {
          this.set('recover');
          this.cooldown = brute ? 1.2 + Math.random() * 0.6 : 0.6 + Math.random() * 0.6;
        }
        break;
      }
      case 'recover':
        if (this.t > (this.type === 'brute' ? 0.9 : 0.55)) this.set('chase');
        break;
      case 'hurt':
        if (this.t > 0.32) this.set('chase');
        break;
      case 'stun':
        if (this.t > (this.type === 'brute' ? 1.9 : 1.3)) this.set('chase');
        break;
    }
  }

  private archerUpdate(dt: number, g: Game, d: number) {
    const p = g.player;
    this.telegraph = 0;
    switch (this.state) {
      case 'idle':
        if (this.sees(g, this.spec.aggro)) {
          this.set('alert');
          g.alert(this);
        }
        break;
      case 'alert':
        this.faceTo(p.x, p.z);
        if (this.t > 0.4) this.set('chase');
        break;
      case 'chase':
      case 'retreat': {
        const strayed = Math.hypot(this.x - this.home.x, this.z - this.home.z) > 20;
        if (!p.alive || d > this.spec.aggro + 6 || strayed) {
          this.set(this.guard ? 'idle' : 'return');
          break;
        }
        this.faceTo(p.x, p.z);
        if (!this.guard && d < (this.type === 'bomber' ? 4.5 : 3.6)) {
          this.walk(g, this.x - p.x, this.z - p.z, this.spec.speed, dt);
          this.state = 'retreat';
        } else if (!this.guard && d > (this.type === 'bomber' ? 7.5 : 8.5)) {
          this.walk(g, p.x - this.x, p.z - this.z, this.spec.speed, dt);
          this.state = 'chase';
        } else if (this.cooldown <= 0 && this.sees(g, this.spec.aggro + 2)) {
          this.set('aim');
          if (this.type === 'bomber') {
            // Lob it where the knight is heading; a ring marks the spot.
            this.potTarget.set(p.x + clamp(p.vx * 0.6, -2.5, 2.5), p.z + clamp(p.vz * 0.6, -2.5, 2.5));
            this.potRing = g.combat.markTarget(this.potTarget.x, this.potTarget.y);
          }
        }
        break;
      }
      case 'aim': {
        const wind = this.spec.windup / this.tempo;
        this.faceTo(this.type === 'bomber' ? this.potTarget.x : p.x, this.type === 'bomber' ? this.potTarget.y : p.z);
        this.telegraph = this.t > wind - 0.4 ? 1 : 0;
        if (this.type !== 'bomber') g.aimLine(this);
        if (this.t >= wind) {
          this.set('strike');
          if (this.type === 'bomber') {
            g.combat.throwPot(this, this.potTarget.x, this.potTarget.y, this.potRing);
            this.potRing = null;
          } else if (this.type === 'darter') g.combat.shootDart(this, p.x, p.y + 0.8, p.z);
          else g.shootArrow(this, p.x, p.y + 0.8, p.z);
        }
        break;
      }
      case 'strike':
        if (this.t > 0.3) {
          this.set('chase');
          this.cooldown = this.type === 'bomber' ? 2.4 + Math.random() : this.type === 'darter' ? 1.6 + Math.random() * 0.6 : 1.3 + Math.random() * 0.8;
        }
        break;
      case 'return': {
        const dx = this.home.x - this.x, dz = this.home.z - this.z;
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25 * dt);
        if (this.sees(g, this.spec.aggro) && this.inPatch(g, 20)) this.set('chase');
        else if (Math.hypot(dx, dz) < 0.6 || this.t > 8) this.set('idle');
        else {
          this.faceTo(this.home.x, this.home.z);
          this.walk(g, dx, dz, this.spec.speed * 0.7, dt);
        }
        break;
      }
      case 'hurt':
        if (this.t > 0.35) this.set('chase');
        break;
      case 'stun':
        if (this.t > 1.2) this.set('chase');
        break;
    }
  }

  private shamanUpdate(dt: number, g: Game, d: number) {
    const p = g.player;
    this.telegraph = 0;
    switch (this.state) {
      case 'idle':
        if (this.sees(g, this.spec.aggro)) {
          this.set('alert');
          g.alert(this);
        }
        break;
      case 'alert':
        this.faceTo(p.x, p.z);
        if (this.t > 0.4) this.set('chase');
        break;
      case 'chase':
      case 'retreat': {
        if (!p.alive || Math.hypot(this.x - this.home.x, this.z - this.home.z) > 22) {
          this.set('return');
          break;
        }
        this.faceTo(p.x, p.z);
        // Too close: vanish in a puff and reappear further off.
        if (d < 3.2 && this.blinkCd <= 0 && g.shamanBlink(this)) {
          this.blinkCd = 4;
          break;
        }
        if (d < 5.5) this.walk(g, this.x - p.x, this.z - p.z, this.spec.speed, dt);
        else if (d > 9) this.walk(g, p.x - this.x, p.z - this.z, this.spec.speed, dt);
        if (this.cooldown <= 0) this.set('chant');
        break;
      }
      case 'chant':
        this.telegraph = this.t > 0.6 ? 1 : 0;
        if (Math.random() < dt * 20) g.fx.emit(P.heal2, this.x + (Math.random() - 0.5) * 2, this.y + 0.2, this.z + (Math.random() - 0.5) * 2, 0, 1.5, 0);
        if (this.t >= this.spec.windup) {
          g.shamanChant(this);
          this.set('chase');
          this.cooldown = 5.5;
        }
        break;
      case 'return': {
        const dx = this.home.x - this.x, dz = this.home.z - this.z;
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25 * dt);
        this.faceTo(this.home.x, this.home.z);
        this.walk(g, dx, dz, this.spec.speed, dt);
        if (Math.hypot(dx, dz) < 0.8 || this.t > 6) this.set('idle');
        break;
      }
      case 'hurt':
        if (this.t > 0.3) this.set('chase');
        break;
      case 'stun':
        if (this.t > 1.3) this.set('chase');
        break;
    }
  }

  private batUpdate(dt: number, g: Game, d: number) {
    const p = g.player;
    this.telegraph = 0;
    const baseY = g.grid.groundAt(this.x, this.z) + 1.3;
    switch (this.state) {
      case 'idle': {
        const a = g.time * 0.8 + this.bob;
        const tx = this.home.x + Math.cos(a) * 2, tz = this.home.z + Math.sin(a * 1.3) * 2;
        this.faceTo(tx, tz);
        this.walk(g, tx - this.x, tz - this.z, 1.5, dt);
        this.y += (baseY - this.y) * Math.min(1, dt * 3);
        if (this.sees(g, this.spec.aggro) && this.inPatch(g, 18)) {
          this.set('chase');
          g.audio.sfx('bat', this.x, this.z);
        }
        break;
      }
      case 'chase': {
        if (!p.alive || Math.hypot(this.x - this.home.x, this.z - this.home.z) > 18) {
          this.set('idle');
          break;
        }
        const a = g.time * 1.6 + this.bob;
        const tx = p.x + Math.cos(a) * 3, tz = p.z + Math.sin(a) * 3;
        this.faceTo(p.x, p.z);
        this.walk(g, tx - this.x, tz - this.z, this.spec.speed, dt);
        this.y += (p.y + 1.4 - this.y) * Math.min(1, dt * 3);
        if (this.cooldown <= 0 && d < 4.5) this.set('windup');
        break;
      }
      case 'windup':
        this.faceTo(p.x, p.z);
        this.telegraph = 1;
        this.animT += dt * 2;
        if (this.t > 0.45) {
          this.set('swoop');
          this.chargeDir.set(p.x - this.x, p.z - this.z).normalize();
          g.audio.sfx('bat', this.x, this.z);
        }
        break;
      case 'swoop': {
        this.walk(g, this.chargeDir.x, this.chargeDir.y, 8.5, dt);
        this.y += (p.y + 0.9 - this.y) * Math.min(1, dt * 8);
        if (!this.struck && d < 0.8) {
          this.struck = true;
          if (g.batHits(this)) break;
        }
        if (this.t > 0.5) {
          this.set('chase');
          this.cooldown = 1.4 + Math.random();
        }
        break;
      }
      case 'flee': {
        // Off with the loot: away from the knight and up out of reach.
        const ax = this.x - p.x, az = this.z - p.z, l = Math.hypot(ax, az) || 1;
        this.faceTo(this.x + ax, this.z + az);
        this.walk(g, ax / l, az / l, 5.5, dt);
        this.y += (g.grid.groundAt(this.x, this.z) + 2.4 - this.y) * Math.min(1, dt * 2);
        if (Math.random() < dt * 10) g.fx.emit(P.coinGlint, this.x, this.y, this.z, 0, -0.5, 0);
        this.escapeT = d > 12 ? this.escapeT + dt : 0;
        if (this.escapeT > 2.5) g.batEscaped(this);
        break;
      }
      case 'hurt':
      case 'stun':
        if (this.t > 0.35) this.set(this.loot > 0 ? 'flee' : 'chase');
        break;
    }
  }

  private boarUpdate(dt: number, g: Game, d: number) {
    const p = g.player;
    this.telegraph = 0;
    switch (this.state) {
      case 'idle':
        if (this.sees(g, this.spec.aggro)) {
          this.set('alert');
          g.alert(this);
          g.audio.sfx('boar', this.x, this.z);
        }
        break;
      case 'alert':
        this.faceTo(p.x, p.z);
        if (this.t > 0.4) this.set('chase');
        break;
      case 'chase':
        if (!p.alive || Math.hypot(this.x - this.home.x, this.z - this.home.z) > 22) {
          this.set('return');
          break;
        }
        this.faceTo(p.x, p.z);
        if (d > 7) this.walk(g, p.x - this.x, p.z - this.z, this.spec.speed, dt);
        else if (this.cooldown <= 0) this.set('paw');
        break;
      case 'return': {
        const dx = this.home.x - this.x, dz = this.home.z - this.z;
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25 * dt);
        this.faceTo(this.home.x, this.home.z);
        this.walk(g, dx, dz, this.spec.speed, dt);
        if (Math.hypot(dx, dz) < 1 || this.t > 6) this.set('idle');
        break;
      }
      case 'paw':
        this.faceTo(p.x, p.z);
        this.telegraph = this.t > 0.5 ? 1 : 0;
        if (Math.random() < 0.3) g.fx.emit(P.dust, this.x - this.fx * 0.4, this.y + 0.1, this.z - this.fz * 0.4, -this.fx, 0.5, -this.fz);
        if (this.t >= this.spec.windup) {
          this.set('charge');
          this.chargeDir.set(this.fx, this.fz);
          g.audio.sfx('boar', this.x, this.z);
        }
        break;
      case 'charge': {
        const bx = this.x, bz = this.z;
        g.grid.move(this, this.chargeDir.x * 9.5 * dt, this.chargeDir.y * 9.5 * dt, 0.45, true);
        const moved = Math.hypot(this.x - bx, this.z - bz);
        if (Math.random() < 0.6) g.fx.emit(P.dust, this.x, this.y + 0.1, this.z, 0, 0.4, 0);
        if (!this.struck && d < this.r + p.r + 0.3 && Math.abs(p.y - this.y) < 1) {
          this.struck = true;
          if (g.enemyHitsPlayer(this, 1, { kb: 12 }) === 'hit' && p.alive) p.afflict('daze', g, { down: true });
        }
        if (moved < 9.5 * dt * 0.4 && this.t > 0.1) {
          this.set('stun');
          g.shake(0.4);
          g.audio.sfx('thud', this.x, this.z);
          g.fx.burst(P.dust, this.x + this.chargeDir.x * 0.5, this.y + 0.3, this.z + this.chargeDir.y * 0.5, 12, 3, 1);
        } else if (this.t > 1.5) {
          this.set('recover');
          this.cooldown = 1;
        }
        break;
      }
      case 'recover':
        if (this.t > 0.7) this.set('chase');
        break;
      case 'stun':
        if (Math.random() < 0.1) g.fx.emit(P.coinGlint, this.x + (Math.random() - 0.5) * 0.6, this.y + 1.1, this.z + (Math.random() - 0.5) * 0.6, 0, 0.3, 0);
        if (this.t > 1.8) {
          this.set('chase');
          this.cooldown = 0.8;
        }
        break;
      case 'hurt':
        if (this.t > 0.25) this.set('chase');
        break;
    }
  }

  private bossUpdate(dt: number, g: Game, d: number) {
    const p = g.player;
    this.telegraph = 0;
    const sp = this.enraged ? 1.35 : 1;
    switch (this.state) {
      case 'sleep':
        break;
      case 'wake':
        this.faceTo(p.x, p.z);
        if (this.t > 1.2) this.set('chase');
        break;
      case 'chase': {
        this.faceTo(p.x, p.z);
        if (!p.alive) break;
        if (this.cooldown <= 0) {
          const moves = this.enraged ? ['charge', 'slam', 'charge', 'summon', 'slam', 'jump'] : ['slam', 'charge', 'summon', 'charge', 'slam', 'jump'];
          const m = moves[this.moveIdx++ % moves.length];
          const alive = this.summoned.filter((e) => e.alive).length;
          if (m === 'summon' && alive >= 2) this.set('windup');
          else if (m === 'charge') this.set('paw');
          else if (m === 'slam') this.set(d < 3.5 ? 'windup' : 'jump');
          else if (m === 'jump') this.set('jump');
          else this.set('summon');
          if ((this.state as St) === 'jump') {
            this.jumpFrom.set(this.x, this.y, this.z);
            this.jumpTo.set(p.x, p.y, p.z);
            g.audio.sfx('bossJump', this.x, this.z);
          }
          break;
        }
        if (d > 2.2) this.walk(g, p.x - this.x, p.z - this.z, this.spec.speed * sp, dt);
        break;
      }
      case 'windup':
        // Close-range smash.
        this.faceTo(p.x, p.z);
        this.telegraph = 1;
        if (this.t > 0.7 / sp) {
          this.set('slam');
          g.bossSlam(this, false);
        }
        break;
      case 'slam':
        if (this.t > 0.6) {
          this.set('recover');
          this.cooldown = 1.2 / sp;
        }
        break;
      case 'jump': {
        // Leap onto the knight's position, then a shockwave.
        const T = 0.9 / sp;
        const k = Math.min(1, this.t / T);
        if (this.t < 0.25) {
          this.telegraph = 1;
          this.jumpTo.set(p.x, p.y, p.z);
          break;
        }
        const kk = Math.min(1, (this.t - 0.25) / (T - 0.25));
        this.x = this.jumpFrom.x + (this.jumpTo.x - this.jumpFrom.x) * kk;
        this.z = this.jumpFrom.z + (this.jumpTo.z - this.jumpFrom.z) * kk;
        this.model.rig.lift = Math.sin(kk * Math.PI) * 3.2;
        g.grid.resolve(this, 0.45, true);
        if (k >= 1 || kk >= 1) {
          this.model.rig.lift = 0;
          this.set('slam');
          g.bossSlam(this, true);
        }
        break;
      }
      case 'paw':
        this.faceTo(p.x, p.z);
        this.telegraph = this.t > 0.4 ? 1 : 0;
        if (Math.random() < 0.4) g.fx.emit(P.dust, this.x - this.fx * 0.7, this.y + 0.1, this.z - this.fz * 0.7, -this.fx, 0.6, -this.fz);
        if (this.t > 0.8 / sp) {
          this.set('charge');
          this.chargeDir.set(this.fx, this.fz);
          g.audio.sfx('roar', this.x, this.z);
        }
        break;
      case 'charge': {
        const bx = this.x, bz = this.z;
        const v = 10.5 * sp;
        g.grid.move(this, this.chargeDir.x * v * dt, this.chargeDir.y * v * dt, 0.45, true);
        const moved = Math.hypot(this.x - bx, this.z - bz);
        if (Math.random() < 0.7) g.fx.emit(P.dust, this.x, this.y + 0.1, this.z, 0, 0.5, 0);
        if (!this.struck && d < this.r + p.r + 0.4) {
          this.struck = true;
          if (g.enemyHitsPlayer(this, 1, { kb: 14 }) === 'hit' && p.alive) p.afflict('daze', g, { down: true });
        }
        if ((moved < v * dt * 0.4 && this.t > 0.12) || this.t > 1.6) {
          const wall = this.t <= 1.6;
          this.set(wall ? 'stun' : 'recover');
          this.cooldown = 1;
          if (wall) {
            g.shake(0.6);
            g.audio.sfx('thud', this.x, this.z);
            g.chandelierShake();
          }
        }
        break;
      }
      case 'summon':
        this.telegraph = 1;
        if (this.t > 0.9) {
          g.bossSummon(this);
          this.set('recover');
          this.cooldown = 1.5;
        }
        break;
      case 'recover':
        if (this.t > 0.6) this.set('chase');
        break;
      case 'stun':
        if (this.t > 1.8) {
          this.set('chase');
          this.cooldown = 0.6;
        }
        break;
      case 'hurt':
        this.set('chase');
        break;
    }
  }

  wake(g: Game) {
    if (this.state === 'sleep') {
      this.set('wake');
      this.cooldown = 1.5;
      void g;
    }
  }

  /** The knight's sword connects. */
  takeHit(dmg: number, dx: number, dz: number, kb: number, finisher: boolean, g: Game): 'hit' | 'blocked' {
    if (!this.alive || this.state === 'sleep') return 'blocked';
    // Shield goblins block from the front until a finisher breaks the shield.
    if (this.shieldUp && this.state !== 'stun' && this.state !== 'strike') {
      const front = -(dx * this.fx + dz * this.fz);
      if (front > 0.25) {
        if (finisher) {
          this.shieldUp = false;
          this.model.rig.j('handL').visible = false;
          g.audio.sfx('shieldBreak', this.x, this.z);
          g.fx.burst(P.splinter, this.x, this.y + 0.8, this.z, 16, 4, 3);
          this.vx = dx * kb;
          this.vz = dz * kb;
          this.set('stun');
          return 'hit';
        }
        this.vx = dx * 2;
        this.vz = dz * 2;
        return 'blocked';
      }
    }
    let mult = 1;
    if (this.state === 'stun') mult = 1.5;
    if (this.type === 'boar' && this.state !== 'stun') mult = 0.5;
    if (this.type === 'king' && this.state !== 'stun') mult = 0.8;
    this.hp -= dmg * mult;
    this.flashT = 0.1;
    const heavy = this.type === 'king' || this.type === 'boar';
    this.vx = dx * kb * (heavy ? 0.2 : 1);
    this.vz = dz * kb * (heavy ? 0.2 : 1);
    g.fx.burst(P.spark, this.x - dx * 0.2, this.y + (this.flying ? 0 : 0.8), this.z - dz * 0.2, 6, 3.5, 2);
    g.fx.burst(this.type === 'archer' ? P.splinter : P.blood, this.x, this.y + (this.flying ? 0 : 0.7), this.z, 6, 2.5, 2.5);
    g.audio.sfx(this.type === 'archer' ? 'boneHit' : 'hit', this.x, this.z);
    if (this.hp <= 0) {
      this.die(g);
      return 'hit';
    }
    if (this.type === 'king') {
      g.ui.bossHp(this.hp / this.maxHp);
      if (!this.enraged && this.hp < this.maxHp * 0.5) {
        this.enraged = true;
        g.bossEnrage(this);
      }
      return 'hit';
    }
    if (this.potRing) {
      g.combat.clearMark(this.potRing);
      this.potRing = null;
    }
    // Interrupts unless mid-charge, and brutes shrug off blows while they wind up.
    const armored = this.type === 'brute' && (this.state === 'windup' || this.state === 'strike');
    if (armored && g.time - this.armorPopT > 2) {
      this.armorPopT = g.time;
      g.pop(this, 'unflinching', '#c0c0cc');
    }
    if (!armored && this.state !== 'charge' && this.state !== 'stun' && !(this.type === 'boar' && this.state === 'paw')) {
      this.set('hurt');
      this.cooldown = Math.max(this.cooldown, 0.3);
    }
    if (this.state === 'idle') this.set('chase');
    return 'hit';
  }

  parried(g: Game) {
    this.set('stun');
    this.vx = -this.fx * 4;
    this.vz = -this.fz * 4;
    void g;
  }

  /** Drop any half-finished throw (used when the world resets). */
  cancelAim(g: Game) {
    if (this.potRing) g.combat.clearMark(this.potRing);
    this.potRing = null;
    this.hasteT = 0;
  }

  /** Take fire damage (standing in burning ground). */
  scorch(dmg: number, g: Game) {
    if (!this.alive || this.state === 'sleep') return;
    this.hp -= dmg;
    this.flashT = 0.1;
    g.fx.burst(P.flame, this.x, this.y + 0.6, this.z, 6, 1, 1.5);
    if (this.hp <= 0) this.die(g);
    else if (this.state === 'idle') this.set('chase');
  }

  /** Vanish without a death: no coins, no quest progress. */
  despawn(g: Game) {
    this.cancelAim(g);
    this.state = 'dead';
    this.t = 0;
    this.deathT = 0;
    g.fx.burst(P.puff, this.x, this.y + 0.5, this.z, 8, 2);
  }

  die(g: Game) {
    if (this.potRing) {
      g.combat.clearMark(this.potRing);
      this.potRing = null;
    }
    this.state = 'dead';
    this.t = 0;
    this.deathT = 0;
    g.onEnemyDeath(this);
  }

  get coinDrop() {
    const [a, b] = this.spec.coins;
    const n = a + Math.floor(Math.random() * (b - a + 1));
    return (this.golden ? n * 10 : this.elite ? n * 3 : n) + this.loot;
  }
}

export function clampToArena(e: Enemy, x0: number, z0: number, x1: number, z1: number) {
  e.x = clamp(e.x, x0, x1);
  e.z = clamp(e.z, z0, z1);
}
