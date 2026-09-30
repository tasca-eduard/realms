import * as THREE from 'three';
import { EFFECTS, PLAYER } from '../config';
import { P } from '../engine/particles';
import { clamp } from '../engine/util';
import { makeKnight, type Model } from './models';
import type { Game } from './game';
import type { Mount } from './mount';

// The knight's moveset, ported from the prototype to isometric:
//   attack: 3-hit combo (slash, backhand, overhead finisher that breaks shields)
//   hold attack: charge, release for a spin (blue when full: two hits, wider)
//   attack in the air: down-stab, bounces off whatever it hits
//   guard: tap to roll, hold to block (drains stamina), press just before a hit
//          to parry (stuns, slow motion, refunds); in the air, a dodge-dash
//   special (50 energy): dash strike when moving, sword wave when standing,
//          plunge with a shockwave when in the air
//   jump, drink a flask

type State =
  | 'idle' | 'run' | 'attack' | 'charge' | 'spin' | 'roll' | 'airdash' | 'block' | 'hurt' | 'dead'
  | 'drink' | 'rest' | 'stab' | 'dash' | 'wave' | 'plunge' | 'dazed' | 'down';

/** Status effects: seconds left on each (burn counts down to the moment it hurts). */
export type Effect = 'maim' | 'daze' | 'burn' | 'poison' | 'snare';

interface Swing {
  anim: string;
  dur: number;
  hit: [number, number];
  dmg: number;
  kb: number;
  lunge: number;
  reach: number;
  arc: number;
  finisher?: boolean;
}

const SWINGS: Swing[] = [
  { anim: 'attack0', dur: 0.36, hit: [0.09, 0.2], dmg: 1, kb: 4, lunge: 3.2, reach: 1.8, arc: 0.3 },
  { anim: 'attack1', dur: 0.34, hit: [0.09, 0.19], dmg: 1.1, kb: 4.5, lunge: 3.2, reach: 1.8, arc: 0.3 },
  { anim: 'attack2', dur: 0.46, hit: [0.14, 0.25], dmg: 1.6, kb: 8, lunge: 7, reach: 2.1, arc: 0.55, finisher: true },
];

const CHARGE_MIN = 0.4, CHARGE_FULL = 0.8;
const SPECIAL_COST = 50;

export type HitResult = 'hit' | 'blocked' | 'parried' | 'dodged' | 'ignored' | 'bubbled';
export type PowerKind = 'fire' | 'wind' | 'magnet' | 'bubble' | 'giant';

export const POWERS: Record<PowerKind, { name: string; desc: string; col: string }> = {
  fire: { name: 'Fire Blade', desc: '+50% damage', col: '#ff8a3c' },
  wind: { name: 'Wind Boots', desc: 'Jump again in the air', col: '#b8f0ff' },
  magnet: { name: 'Magnet', desc: 'Coins fly to you', col: '#feae34' },
  bubble: { name: 'Bubble', desc: 'Blocks the next 2 hits', col: '#5ad1ff' },
  giant: { name: 'Giant Slash', desc: '+60% reach', col: '#e0b0ff' },
};

interface StrikeOpts {
  cx: number;
  cz: number;
  reach: number;
  /** Cosine limit of the arc around facing; -2 for all round. */
  arc: number;
  dmg: number;
  kb: number;
  set: Set<object>;
  breaks?: boolean;
  /** A warhorse's charge: the only thing that tears through the Warden's thorns. */
  charge?: boolean;
  radial?: boolean;
  yLo?: number;
  yHi?: number;
}

export class Player {
  x = 0;
  y = 0;
  z = 0;
  r = PLAYER.radius;
  vx = 0;
  vz = 0;
  vy = 0;
  fx = 1;
  fz = 0;
  hp: number = PLAYER.hearts;
  maxHp: number = PLAYER.hearts;
  stamina: number = PLAYER.stamina;
  maxStamina: number = PLAYER.stamina;
  staminaWait = 0;
  energy = 100;
  flasks = 3;
  flasksMax = 3;
  swordLevel = 0;
  coins = 0;
  /** Relic: blocking costs less. */
  crest = false;
  state: State = 'idle';
  t = 0;
  combo = 0;
  queued = false;
  atkHeld = 0;
  swingHits = new Set<object>();
  iframes = 0;
  blockPressed = -10;
  guardBroken = 0;
  model: Model;
  onGround = true;
  lastStep = 0;
  blockHitT = 9;
  healed = false;
  rollDir = new THREE.Vector2();
  aim = new THREE.Vector2(1, 0);
  lastSafe = { x: 0, z: 0 };
  deathT = 0;
  airDodged = false;
  windUsed = false;
  spinFull = false;
  spinHits = 0;
  plungePhase: 'hang' | 'dive' | 'land' = 'hang';
  power: { kind: PowerKind; t: number; hits: number } | null = null;
  private tiredT = 0;
  effects: Record<Effect, number> = { maim: 0, daze: 0, burn: 0, poison: 0, snare: 0 };
  /** Max duration of each running effect, for the HUD bars. */
  effectMax: Record<Effect, number> = { maim: 1, daze: 1, burn: 1, poison: 1, snare: 1 };
  private dazeImmune = 0;
  // Riding.
  riding: Mount | null = null;
  rideState: 'ride' | 'kick' | 'rear' | 'charge' | 'gore' | 'shield' | 'burst' = 'ride';
  /** The Thornstag's second leap, used until it lands. */
  private stagLeapt = false;
  /** Climbing vines up a cliff face. */
  climbing = false;
  rideT = 0;
  private trampled = new Map<object, number>();
  private insideWarned = 0;

  constructor() {
    this.model = makeKnight(true);
  }
  get rig() {
    return this.model.rig;
  }
  get alive() {
    return this.state !== 'dead';
  }
  get busy() {
    const s = this.state;
    return s !== 'idle' && s !== 'run' && s !== 'block';
  }
  /** A flask helps: hurt, or carrying something it cures. */
  get needsFlask() {
    const e = this.effects;
    return this.hp < this.maxHp || e.maim > 0 || e.poison > 0 || e.burn > 0 || e.snare > 0;
  }
  /** Drink effects shared by foot and saddle: two hearts back, maim, poison and burn gone. */
  private quaff(g: Game) {
    this.flasks--;
    this.hp = Math.min(this.maxHp, this.hp + 2);
    const e = this.effects;
    if (e.maim > 0 || e.poison > 0 || e.burn > 0 || e.snare > 0) g.pop(this, 'cured', '#8ef0a0');
    e.maim = e.poison = e.burn = e.snare = 0;
    g.audio.sfx('heal');
    g.ui.pulseHearts();
  }
  private noNeedT = -9;
  /** Pressed the flask with nothing to heal or cure: say so instead of doing nothing. */
  private noNeed(g: Game) {
    if (g.time - this.noNeedT < 1.5) return;
    this.noNeedT = g.time;
    g.pop(this, this.flasks > 0 ? 'not hurt' : 'no flasks left', '#b9b3dc');
  }
  powerOn(k: PowerKind) {
    return !!this.power && this.power.kind === k && this.power.t > 0;
  }
  get damage() {
    // Realm 1's smith gives +25% a level (to 3); the Old Wood's thorn-smith +15% a level after that.
    const L = this.swordLevel;
    return (1 + Math.min(3, L) * 0.25 + Math.max(0, L - 3) * 0.15) * (this.powerOn('fire') ? 1.5 : 1);
  }
  get reachMul() {
    return this.powerOn('giant') ? 1.6 : 1;
  }

  place(x: number, z: number, g: Game) {
    this.x = x;
    this.z = z;
    this.y = g.grid.groundAt(x, z);
    this.vx = this.vz = this.vy = 0;
    this.lastSafe = { x, z };
  }

  private setState(s: State) {
    this.state = s;
    this.t = 0;
  }

  useStamina(n: number) {
    this.stamina = Math.max(0, this.stamina - n);
    this.staminaWait = PLAYER.staminaDelay;
  }

  private tired(g: Game) {
    if (this.tiredT > 0) return;
    this.tiredT = 0.8;
    g.pop(this, 'tired', '#b9b3dc');
    g.audio.sfx('guard');
  }

  update(dt: number, g: Game) {
    const inp = g.input;
    this.t += dt;
    this.blockHitT += dt;
    this.tiredT -= dt;
    this.iframes = Math.max(0, this.iframes - dt);
    this.guardBroken = Math.max(0, this.guardBroken - dt);
    this.staminaWait -= dt;
    if (this.staminaWait <= 0 && this.state !== 'block' && this.state !== 'roll') this.stamina = Math.min(this.maxStamina, this.stamina + PLAYER.staminaRegen * dt * (this.effects.poison > 0 ? EFFECTS.poisonRegen : 1));
    this.energy = Math.min(100, this.energy + 3 * dt);
    if (this.power) {
      this.power.t -= dt;
      if (this.power.t <= 0) {
        g.pop(this, `${POWERS[this.power.kind].name} faded`, '#8a82a3');
        this.power = null;
      } else if (this.power.kind === 'fire' && Math.random() < dt * 20) {
        g.fx.emit(P.ember, this.x + this.fx * 0.8, this.y + 1.0 + Math.random() * 0.4, this.z + this.fz * 0.8, 0, 1, 0, 0.4);
      }
    }
    this.atkHeld = inp.held('attack') ? this.atkHeld + dt : 0;
    this.updateEffects(g.worldFrozen ? 0 : dt, g);
    if (this.riding && this.alive) return this.updateRiding(dt, g);

    const controls = g.controlsEnabled;
    const mv = controls ? inp.move() : { x: 0, y: 0 };
    const cam = g.cam;
    const wx = cam.groundRight.x * mv.x + cam.groundUp.x * mv.y;
    const wz = cam.groundRight.z * mv.x + cam.groundUp.z * mv.y;
    const moving = Math.hypot(wx, wz) > 0.1;
    this.updateAim(g, wx, wz, moving);
    const moveDir = (): [number, number] => (moving ? [wx, wz] : [this.aim.x, this.aim.y]);

    let speed = 0;
    let tvx = 0, tvz = 0;

    // ---------- starting actions ----------
    if (controls && this.alive) {
      const free = !this.busy;
      if (this.onGround && free) {
        if (inp.hit('guard') && this.guardBroken <= 0 && this.state !== 'block') this.raiseGuard(g);
        if (this.state === 'block' && !inp.held('guard')) {
          // A quick tap rolls; a hold just lowers the shield.
          if (g.time - this.blockPressed < PLAYER.tapTime) this.tryRoll(g, ...moveDir());
          else this.setState('idle');
        }
        if (this.state !== 'block' && this.state !== 'roll') {
          if (inp.hit('special')) this.trySpecial(g, moving && this.effects.snare <= 0, moveDir());
          else if (inp.hit('jump')) this.jump(g);
          else if (inp.hit('attack')) this.startSwing(0, g);
          else if (inp.hit('heal')) {
            if (this.flasks > 0 && this.needsFlask) {
              this.setState('drink');
              this.healed = false;
              g.audio.sfx('drink');
            } else this.noNeed(g);
          }
        }
      } else if (!this.onGround && (free || this.state === 'stab')) {
        if (inp.hit('special')) this.trySpecial(g, moving, moveDir());
        else if (inp.hit('guard') && !this.airDodged) this.airDash(g, ...moveDir());
        else if (inp.hit('jump') && this.powerOn('wind') && !this.windUsed) {
          this.windUsed = true;
          this.jump(g);
          g.fx.burst(P.mote, this.x, this.y, this.z, 10, 1.5);
        } else if (inp.hit('attack') && this.state !== 'stab') this.startStab(g);
      }
    }

    // ---------- state behaviour ----------
    switch (this.state) {
      case 'idle':
      case 'run': {
        if (moving) {
          speed = PLAYER.runSpeed;
          tvx = wx;
          tvz = wz;
          const l = Math.hypot(wx, wz);
          this.fx = wx / l;
          this.fz = wz / l;
          if (this.state !== 'run') this.setState('run');
          const step = Math.floor(this.model.phase / Math.PI);
          if (step !== this.lastStep && this.onGround) g.footstep(this.x, this.z);
          this.lastStep = step;
        } else if (this.state !== 'idle') this.setState('idle');
        if (inp.mouseAim && !moving) {
          this.fx = this.aim.x;
          this.fz = this.aim.y;
        }
        break;
      }
      case 'block': {
        this.fx = this.aim.x;
        this.fz = this.aim.y;
        if (moving) {
          speed = PLAYER.runSpeed * PLAYER.blockSpeed;
          tvx = wx;
          tvz = wz;
        }
        // Holding the shield up is tiring.
        if (this.t > PLAYER.tapTime) {
          this.stamina -= 14 * dt * (this.crest ? 0.7 : 1);
          this.staminaWait = 0.4;
          if (this.stamina <= 0) {
            this.stamina = 0;
            this.guardBroken = 0.6;
            this.setState('idle');
            this.tired(g);
          }
        }
        break;
      }
      case 'attack': {
        const s = SWINGS[this.combo];
        const k = this.t;
        if (k >= s.hit[0] && k <= s.hit[1]) {
          speed = s.lunge;
          tvx = this.fx;
          tvz = this.fz;
          this.strike(g, { cx: this.x, cz: this.z, reach: s.reach * this.reachMul, arc: s.arc, dmg: s.dmg * this.damage, kb: s.kb, set: this.swingHits, breaks: s.finisher });
        } else if (k < s.hit[0]) {
          speed = 1;
          tvx = this.fx;
          tvz = this.fz;
        }
        if (controls && inp.hit('attack') && k > s.dur * 0.25 && this.combo < 2) this.queued = true;
        if (controls && k > s.hit[1]) {
          if (inp.hit('guard') && this.onGround) {
            this.combo = 0;
            this.raiseGuard(g);
            break;
          }
          if (inp.hit('special') && this.energy >= SPECIAL_COST) {
            this.combo = 0;
            this.trySpecial(g, moving, moveDir());
            break;
          }
        }
        if (k >= s.dur) {
          if (this.queued && this.combo < 2) this.startSwing(this.combo + 1, g);
          else if (controls && inp.held('attack') && this.atkHeld > 0.22 && this.onGround) {
            this.combo = 0;
            this.setState('charge');
            g.audio.sfx('guard');
          } else {
            this.combo = 0;
            this.setState('idle');
          }
        }
        break;
      }
      case 'charge': {
        // Slow walk while winding up; release to spin.
        this.fx = this.aim.x;
        this.fz = this.aim.y;
        if (moving) {
          speed = PLAYER.runSpeed * 0.4;
          tvx = wx;
          tvz = wz;
        }
        const full = this.t >= CHARGE_FULL;
        if (full && this.t - dt < CHARGE_FULL) {
          g.audio.sfx('charged');
          g.fx.burst(P.bluespark, this.x, this.y + 1, this.z, 16, 2, 2);
        }
        if (Math.random() < dt * 25) g.fx.emit(full ? P.bluespark : P.coinGlint, this.x + (Math.random() - 0.5), this.y + Math.random() * 1.6, this.z + (Math.random() - 0.5), 0, 1.2, 0, 0.6);
        if (!controls || !inp.held('attack')) {
          if (this.t >= CHARGE_MIN) this.startSpin(g, full);
          else this.setState('idle');
        } else if (inp.hit('guard')) this.raiseGuard(g);
        break;
      }
      case 'spin': {
        const at = this.spinFull ? [0.08, 0.3] : [0.1];
        const dur = this.spinFull ? 0.57 : 0.32;
        if (this.spinHits < at.length && this.t >= at[this.spinHits]) {
          this.spinHits++;
          this.swingHits.clear();
          const R = (this.spinFull ? 2.5 : 2.0) * this.reachMul;
          this.strike(g, { cx: this.x, cz: this.z, reach: R, arc: -2, dmg: (this.spinFull ? 1.6 : 1.1) * this.damage, kb: this.spinFull ? 9 : 6, set: this.swingHits, breaks: this.spinFull, radial: true });
          g.combat.deflectArrows(this.x, this.z, R);
          g.shake(0.35);
          g.audio.sfx('swingHeavy');
        }
        if (Math.random() < 0.7) {
          const a = Math.random() * Math.PI * 2, r = this.spinFull ? 2.2 : 1.8;
          g.fx.emit(this.spinFull ? P.bluespark : P.coinGlint, this.x + Math.cos(a) * r, this.y + 1.0, this.z + Math.sin(a) * r, -Math.sin(a) * 3, 0.5, Math.cos(a) * 3, 0.5);
        }
        if (this.t >= dur) this.setState('idle');
        break;
      }
      case 'stab': {
        // Sword down, falling fast; bounce off anything it lands on.
        this.vy = Math.min(this.vy, -11);
        tvx = this.vx;
        tvz = this.vz;
        speed = 0.5;
        for (const e of g.enemies) {
          if (!e.alive || this.swingHits.has(e)) continue;
          const d = Math.hypot(e.x - this.x, e.z - this.z);
          if (d > 0.9 + e.r || this.y > e.y + e.height + 0.3 || this.y < e.y - 0.4) continue;
          this.swingHits.add(e);
          const res = e.takeHit(1.25 * this.damage, (e.x - this.x) / (d || 1), (e.z - this.z) / (d || 1), 2, false, g);
          if (res !== 'blocked') g.landed(e, false);
          this.vy = 8.5;
          this.y += 0.05;
          this.airDodged = false;
          this.windUsed = false;
          this.setState('idle');
          g.hitstop(0.05);
          g.audio.sfx('pogo');
          g.fx.burst(P.spark, this.x, this.y, this.z, 10, 3, 2);
          break;
        }
        for (const b of g.breakables) {
          if (b.broken || Math.hypot(b.x - this.x, b.z - this.z) > 0.9 || this.y > b.y + 0.9) continue;
          g.breakObject(b, 0, 0);
          this.vy = 7;
          this.setState('idle');
          break;
        }
        if (this.state === 'stab' && (this.onGround || this.t > 1.2)) {
          this.setState('idle');
          g.fx.burst(P.dust, this.x, this.y + 0.05, this.z, 6, 1.5);
        }
        break;
      }
      case 'roll': {
        const k = this.t / PLAYER.rollTime;
        speed = PLAYER.rollSpeed * (1 - k * 0.65);
        tvx = this.rollDir.x;
        tvz = this.rollDir.y;
        if (this.t > 0.06 && Math.random() < 0.5) g.fx.emit(P.dust, this.x, this.y + 0.1, this.z, 0, 0.3, 0);
        if (this.t >= PLAYER.rollTime) this.setState('idle');
        break;
      }
      case 'airdash': {
        speed = this.t < 0.2 ? 11 : 3;
        tvx = this.rollDir.x;
        tvz = this.rollDir.y;
        if (this.t < 0.2) this.vy = Math.max(this.vy, 0.5);
        if (Math.random() < 0.8) g.fx.emit(P.mote, this.x, this.y + 0.9, this.z, 0, 0, 0, 0.2);
        if (this.t >= 0.3 || (this.onGround && this.t > 0.1)) this.setState('idle');
        break;
      }
      case 'dash': {
        const go = this.t < 0.22;
        speed = go ? 15 : 2;
        tvx = this.rollDir.x;
        tvz = this.rollDir.y;
        if (go) {
          this.strike(g, { cx: this.x + this.rollDir.x * 0.4, cz: this.z + this.rollDir.y * 0.4, reach: 1.2 * this.reachMul, arc: -2, dmg: 2.2 * this.damage, kb: 8, set: this.swingHits, breaks: true, radial: true });
          g.combat.deflectArrows(this.x, this.z, 1.4);
          g.fx.emit(P.bluespark, this.x, this.y + 0.8 + Math.random() * 0.6, this.z, 0, 0.5, 0, 0.4);
        }
        if (this.t >= 0.36) this.setState('idle');
        break;
      }
      case 'wave': {
        if (this.t >= 0.12 && !this.healed) {
          this.healed = true;
          g.combat.swordWave(this.x + this.fx * 0.6, this.y + 1.0, this.z + this.fz * 0.6, this.fx, this.fz, 1.8 * this.damage);
          g.shake(0.2);
        }
        if (this.t >= 0.42) this.setState('idle');
        break;
      }
      case 'plunge': {
        if (this.plungePhase === 'hang') {
          this.vy = 0.3;
          if (this.t > 0.12) this.plungePhase = 'dive';
        } else if (this.plungePhase === 'dive') {
          this.vy = -26;
          g.fx.emit(P.bluespark, this.x, this.y + 1, this.z, 0, 2, 0, 0.3);
          if (this.onGround) {
            this.plungePhase = 'land';
            this.t = 0;
            this.swingHits.clear();
            this.strike(g, { cx: this.x, cz: this.z, reach: 2.8 * this.reachMul, arc: -2, dmg: 2 * this.damage, kb: 10, set: this.swingHits, breaks: true, radial: true, yLo: -1, yHi: 2.5 });
            g.combat.deflectArrows(this.x, this.z, 3);
            g.playerShockwave(this.x, this.y, this.z);
          }
        } else if (this.t > 0.28) this.setState('idle');
        break;
      }
      case 'hurt':
        if (this.t > 0.32) this.setState('idle');
        break;
      case 'dazed':
      case 'down': {
        const dur = this.state === 'down' ? EFFECTS.downTime : EFFECTS.dazeTime;
        if (this.state === 'dazed') {
          // Stars circle the helmet.
          const a = g.time * 7;
          if (Math.random() < dt * 30) g.fx.emit(P.coinGlint, this.x + Math.cos(a) * 0.35, this.y + 2.05, this.z + Math.sin(a) * 0.35, 0, 0.2, 0, 0.3);
        }
        if (this.t >= dur) {
          this.effects.daze = 0;
          this.dazeImmune = EFFECTS.dazeImmune;
          this.setState('idle');
        }
        break;
      }
      case 'drink': {
        if (!this.healed && this.t > 0.55) {
          this.healed = true;
          this.quaff(g);
          g.fx.burst(P.heal, this.x, this.y + 0.8, this.z, 18, 1.2, 1.5);
        }
        if (this.t > 0.9) this.setState('idle');
        break;
      }
      case 'rest':
        break;
      case 'dead':
        this.deathT += dt;
        break;
    }

    if (this.effects.maim > 0 && (this.state === 'run' || this.state === 'block' || this.state === 'charge')) speed *= EFFECTS.maimSlow;
    if (this.effects.snare > 0) speed = 0;

    // Wading through shallow water slows the knight (and puts out flames).
    const wt = g.grid.waterAt(this.x, this.z);
    const wading = this.onGround && wt > g.grid.groundAt(this.x, this.z) + 0.05;
    if (wading && this.effects.burn > 0) this.extinguish(g, 'steam');
    if (wading) {
      speed *= this.state === 'roll' || this.state === 'dash' ? 0.8 : 0.62;
      if (speed > 0.5 && Math.random() < dt * 14) g.fx.emit(P.splash, this.x, wt + 0.05, this.z, (Math.random() - 0.5) * 2, 2 + Math.random() * 2, (Math.random() - 0.5) * 2);
    }

    // Velocity toward target.
    const stateful = this.state === 'roll' || this.state === 'attack' || this.state === 'dash' || this.state === 'airdash';
    const txv = tvx * speed, tzv = tvz * speed;
    const a = stateful ? 60 : speed > 0 ? PLAYER.accel : this.onGround ? PLAYER.friction : 6;
    this.vx += clamp(txv - this.vx, -a * dt, a * dt);
    this.vz += clamp(tzv - this.vz, -a * dt, a * dt);
    if (this.state === 'hurt') {
      this.vx *= Math.exp(-6 * dt);
      this.vz *= Math.exp(-6 * dt);
    }

    const grid = g.grid;
    grid.move(this, this.vx * dt, this.vz * dt, PLAYER.stepUp);
    // Push out of living enemies (rolls and dashes pass through).
    if (this.state !== 'roll' && this.state !== 'dash' && this.state !== 'airdash')
      for (const e of g.enemies) {
        if (!e.solid) continue;
        const dx = this.x - e.x, dz = this.z - e.z, rr = this.r + e.r;
        const d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-6 && Math.abs(e.y - this.y) < 1.5) {
          const d = Math.sqrt(d2), push = (rr - d) * 0.6;
          this.x += (dx / d) * push;
          this.z += (dz / d) * push;
        }
      }
    for (const n of g.npcs) {
      if (!n.visible) continue;
      const dx = this.x - n.x, dz = this.z - n.z, rr = this.r + 0.3;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        this.x = n.x + (dx / d) * rr;
        this.z = n.z + (dz / d) * rr;
      }
    }

    // Ground and falling (not while climbing vines).
    const gy = grid.groundAt(this.x, this.z);
    if (this.climb(dt, g)) {
      /* on the vines */
    } else if (this.y - gy > 0.5 || this.vy > 0 || this.state === 'plunge' && this.plungePhase !== 'land') {
      this.onGround = false;
      if (this.state !== 'airdash' || this.t > 0.2) this.vy -= PLAYER.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= gy) {
        const hard = this.vy < -12 && this.state !== 'plunge';
        this.y = gy;
        this.vy = 0;
        this.onGround = true;
        this.airDodged = false;
        this.windUsed = false;
        g.fx.burst(P.dust, this.x, gy + 0.05, this.z, hard ? 10 : 5, 1.5);
        g.audio.sfx(hard ? 'landHard' : 'land');
        if (hard) g.shake(0.35);
      }
    } else {
      this.y = gy;
      this.vy = 0;
      this.onGround = true;
      // Safe footing: never the floor of a gorge or chasm (landing there while the fall fades
      // out mustn't become the place you're put back).
      if (this.state !== 'roll' && !wading && gy > -5) this.lastSafe = { x: this.x, z: this.z };
    }
    // Fell somewhere deep (the gorge): back to the last safe footing.
    if (this.y < -7 && this.alive) g.fellOut();

    this.pose(dt, g, gy);
  }

  private pose(dt: number, g: Game, gy: number) {
    const rig = this.model.rig;
    const snap = this.state === 'attack' || this.state === 'block' || this.state === 'charge' || this.state === 'dash' || this.state === 'wave';
    rig.face(this.fx, this.fz, dt, snap ? 30 : 16);
    let name: string = this.state === 'run' ? 'idle' : this.state;
    let dur: number | undefined;
    let t = this.t;
    if (this.state === 'attack') {
      name = SWINGS[this.combo].anim;
      dur = SWINGS[this.combo].dur;
    } else if (this.state === 'roll') dur = PLAYER.rollTime;
    else if (this.state === 'block') {
      t = this.blockHitT;
      if (this.blockHitT < 0.25) name = 'blockHit';
    } else if (this.state === 'wave') {
      name = 'attack2';
      dur = 0.3;
    } else if (this.state === 'plunge') name = this.plungePhase === 'land' ? 'land' : 'stab';
    else if (this.state === 'down') dur = EFFECTS.downTime;
    if (!this.onGround && (this.state === 'idle' || this.state === 'run' || this.state === 'hurt')) name = 'fall';
    this.model.animate(dt, this.x, this.z, name, t, g.time, { dur, v: this.spinFull ? 1 : 0 });
    const blink = this.iframes > 0 && this.state !== 'roll' && this.state !== 'dead' && this.state !== 'dash' && Math.floor(g.time * 20) % 2 === 0;
    const charged = this.state === 'charge' && this.t >= CHARGE_FULL;
    rig.flash = this.state === 'hurt' && this.t < 0.08 ? 1 : charged ? 0.25 + 0.15 * Math.sin(g.time * 20) : 0;
    const bubble = this.powerOn('bubble');
    const burn = this.effects.burn > 0 ? 0.25 + 0.2 * Math.sin(g.time * 30) : 0;
    const pois = this.effects.poison > 0 ? 0.25 : 0;
    rig.tint.setRGB(
      (this.state === 'hurt' ? 1 : bubble ? 0.85 : 1) + burn - pois * 0.4,
      (this.state === 'hurt' ? 0.7 : 1) + burn * 0.3 + pois * 0.2,
      (this.state === 'hurt' ? 0.7 : bubble ? 1.25 : 1) - burn * 0.5 - pois * 0.4,
    );
    rig.place(g.cam, this.x, this.y, this.z, gy, !blink);
    // The spin turns the whole body.
    if (this.state === 'spin') rig.root.rotation.y = rig.yaw + Math.min(1, this.t / (this.spinFull ? 0.5 : 0.3)) * Math.PI * 2 * (this.spinFull ? 2 : 1);
  }

  private updateAim(g: Game, wx: number, wz: number, moving: boolean) {
    const inp = g.input, cam = g.cam;
    // The mouse on desktop; the right stick on a pad; on touch, the nearest
    // foe roughly where the stick points (or where the knight faces).
    if (inp.mouseAim && g.mouseGround) {
      const dx = g.mouseGround.x - this.x, dz = g.mouseGround.z - this.z;
      const l = Math.hypot(dx, dz);
      if (l > 0.2) this.aim.set(dx / l, dz / l);
    } else if (Math.hypot(inp.padAim.x, inp.padAim.y) > 0.4) {
      const ax = cam.groundRight.x * inp.padAim.x + cam.groundUp.x * inp.padAim.y;
      const az = cam.groundRight.z * inp.padAim.x + cam.groundUp.z * inp.padAim.y;
      const l = Math.hypot(ax, az);
      this.aim.set(ax / l, az / l);
    } else {
      const l = Math.hypot(wx, wz);
      const px = moving ? wx / l : this.fx, pz = moving ? wz / l : this.fz;
      let best = Infinity;
      this.aim.set(px, pz);
      for (const e of g.enemies) {
        if (!e.alive || Math.abs(e.y - this.y) > 2) continue;
        const dx = e.x - this.x, dz = e.z - this.z, d = Math.hypot(dx, dz);
        if (d > 4.5 || d < 0.01) continue;
        const score = d - 2.2 * ((dx * px + dz * pz) / d);
        if (score < best) {
          best = score;
          this.aim.set(dx / d, dz / d);
        }
      }
    }
  }

  // ---------- riding ----------

  private dismountedAt = -9;

  mount(m: Mount, g: Game) {
    // The same E press that got you off must not put you straight back on.
    if (this.busy || !this.onGround || g.time - this.dismountedAt < 0.4) return;
    this.riding = m;
    m.ridden = true;
    g.lastMount = m;
    this.rideState = 'ride';
    this.rideT = 0;
    this.x = m.x;
    this.z = m.z;
    this.y = g.grid.groundAt(m.x, m.z);
    this.fx = m.fx;
    this.fz = m.fz;
    this.r = 0.55;
    this.vx = this.vz = 0;
    this.setState('idle');
    g.audio.sfx(m.kind === 'stag' ? 'bellow' : 'neigh', m.x, m.z);
    g.fx.burst(P.dust, m.x, this.y + 0.1, m.z, 8, 2);
  }

  dismount(g: Game, thrown = false) {
    const m = this.riding;
    if (!m) return;
    this.riding = null;
    this.dismountedAt = g.time;
    this.r = PLAYER.radius;
    this.rig.root.rotation.x = 0;
    // Step off to the side (or get flung).
    const sx = -this.fz, sz = this.fx;
    const body = { x: this.x, y: this.y, z: this.z, r: this.r };
    g.grid.move(body, sx * 1.1, sz * 1.1, PLAYER.stepUp);
    this.x = body.x;
    this.z = body.z;
    this.y = g.grid.groundAt(this.x, this.z);
    if (thrown) {
      this.vx = sx * 6;
      this.vz = sz * 6;
      this.vy = 5;
      this.setState('hurt');
      m.bolt(g);
    } else {
      m.ridden = false;
      m.home = { x: m.x, z: m.z };
      m.state = 'idle';
      m.t = 0;
    }
  }

  private updateRiding(dt: number, g: Game) {
    const m = this.riding!;
    const inp = g.input;
    const controls = g.controlsEnabled;
    const mv = controls ? inp.move() : { x: 0, y: 0 };
    const cam = g.cam;
    const wx = cam.groundRight.x * mv.x + cam.groundUp.x * mv.y;
    const wz = cam.groundRight.z * mv.x + cam.groundUp.z * mv.y;
    const moving = Math.hypot(wx, wz) > 0.1;
    this.updateAim(g, wx, wz, moving);
    this.rideT += dt;

    const stag = m.kind === 'stag';
    if (controls && this.rideState === 'ride' && stag) {
      // The Thornstag: antler gore, thorn shield, thorn burst, and a second leap in the air.
      if (inp.hit('interact')) return this.dismount(g);
      if (inp.hit('attack')) this.stagMove('gore', g);
      else if (inp.hit('guard')) {
        if (this.stamina < 25) this.tired(g);
        else {
          this.useStamina(25);
          this.stagMove('shield', g);
          this.iframes = Math.max(this.iframes, 0.5);
        }
      } else if (inp.hit('special')) {
        if (this.energy < SPECIAL_COST) g.pop(this, 'not enough energy', '#5ad1ff');
        else {
          this.energy -= SPECIAL_COST;
          this.stagMove('burst', g);
        }
      } else if (inp.hit('jump') && (this.onGround || !this.stagLeapt)) {
        if (!this.onGround) {
          this.stagLeapt = true;
          g.fx.burst(P.leaf, this.x, this.y + 0.3, this.z, 10, 1.2, 2);
        }
        this.vy = PLAYER.jumpSpeed * (this.onGround ? 1.05 : 0.95);
        this.onGround = false;
        this.y += 0.02;
        g.audio.sfx('jump');
      } else if (inp.hit('heal')) {
        if (this.flasks > 0 && this.needsFlask) {
          this.quaff(g);
          g.fx.burst(P.heal, this.x, this.y + 1.6, this.z, 18, 1.2, 1.5);
        } else this.noNeed(g);
      }
    } else if (controls && this.rideState === 'ride') {
      if (inp.hit('interact')) return this.dismount(g);
      if (inp.hit('attack')) {
        this.rideState = 'kick';
        this.rideT = 0;
        this.swingHits.clear();
        g.audio.sfx('swing');
      } else if (inp.hit('guard') && this.onGround) {
        if (this.stamina < 30) this.tired(g);
        else {
          this.useStamina(30);
          this.rideState = 'rear';
          this.rideT = 0;
          this.iframes = Math.max(this.iframes, 0.4);
          this.swingHits.clear();
          g.audio.sfx('neigh', this.x, this.z);
        }
      } else if (inp.hit('special')) {
        if (this.energy < SPECIAL_COST) g.pop(this, 'not enough energy', '#5ad1ff');
        else {
          this.energy -= SPECIAL_COST;
          this.rideState = 'charge';
          this.rideT = 0;
          this.swingHits.clear();
          if (moving) {
            const l = Math.hypot(wx, wz);
            this.fx = wx / l;
            this.fz = wz / l;
          }
          g.audio.sfx('charge');
        }
      } else if (inp.hit('jump') && this.onGround) {
        this.vy = PLAYER.jumpSpeed * 1.05;
        this.onGround = false;
        this.y += 0.02;
        g.audio.sfx('jump');
      } else if (inp.hit('heal')) {
        if (this.flasks > 0 && this.needsFlask) {
          this.quaff(g);
          g.fx.burst(P.heal, this.x, this.y + 1.6, this.z, 18, 1.2, 1.5);
        } else this.noNeed(g);
      }
    }

    let speed = 0, tx = 0, tz = 0, accel = 12;
    switch (this.rideState) {
      case 'ride':
        if (moving) {
          speed = PLAYER.runSpeed * (stag ? 1.3 : 1.45);
          tx = wx;
          tz = wz;
          // Turn like a horse: the facing swings round rather than snapping.
          const want = Math.atan2(wx, wz), cur = Math.atan2(this.fx, this.fz);
          let d = want - cur;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          const na = cur + Math.max(-7 * dt, Math.min(7 * dt, d));
          this.fx = Math.sin(na);
          this.fz = Math.cos(na);
          tx = this.fx;
          tz = this.fz;
        }
        break;
      case 'kick':
        speed = 2;
        tx = this.fx;
        tz = this.fz;
        if (this.rideT >= 0.12 && this.rideT < 0.22)
          this.strike(g, { cx: this.x + this.fx * 1.1, cz: this.z + this.fz * 1.1, reach: 1.7 * this.reachMul, arc: 0.1, dmg: 1.4 * this.damage, kb: 8, set: this.swingHits });
        if (this.rideT >= 0.4) this.rideState = 'ride';
        break;
      case 'rear':
        if (this.rideT >= 0.35 && this.rideT - dt < 0.35) {
          this.strike(g, { cx: this.x + this.fx * 0.8, cz: this.z + this.fz * 0.8, reach: 2.3 * this.reachMul, arc: -2, dmg: 1.2 * this.damage, kb: 8, set: this.swingHits, radial: true });
          g.audio.sfx('thud', this.x, this.z);
          g.shake(0.45);
          g.fx.burst(P.puff, this.x + this.fx, this.y + 0.1, this.z + this.fz, 12, 3);
        }
        if (this.rideT >= 0.55) this.rideState = 'ride';
        break;
      case 'gore':
        // Head down, antlers first.
        speed = this.rideT < 0.25 ? 6 : 1;
        tx = this.fx;
        tz = this.fz;
        if (this.rideT >= 0.1 && this.rideT < 0.24)
          this.strike(g, { cx: this.x + this.fx * 1.3, cz: this.z + this.fz * 1.3, reach: 1.9 * this.reachMul, arc: 0.25, dmg: 1.6 * this.damage, kb: 10, set: this.swingHits });
        if (this.rideT >= 0.45) this.rideState = 'ride';
        break;
      case 'shield':
        // Thorns burst out all round: arrows and darts are knocked away, and whatever is close is pricked.
        speed = 1;
        g.combat.deflectArrows(this.x, this.z, 2.4);
        if (this.rideT < 0.1) this.strike(g, { cx: this.x, cz: this.z, reach: 1.9 * this.reachMul, arc: -2, dmg: 0.6 * this.damage, kb: 7, set: this.swingHits, radial: true });
        if (Math.random() < dt * 40) g.fx.emit(P.leaf, this.x + (Math.random() - 0.5) * 3, this.y + 0.5 + Math.random(), this.z + (Math.random() - 0.5) * 3, 0, 0.5, 0);
        if (this.rideT >= 0.9) this.rideState = 'ride';
        break;
      case 'burst':
        // Thorns rise from the ground in a ring round the stag.
        speed = 0;
        if (this.rideT >= 0.25 && this.rideT - dt < 0.25) {
          this.strike(g, { cx: this.x, cz: this.z, reach: 3 * this.reachMul, arc: -2, dmg: 2.2 * this.damage, kb: 10, set: this.swingHits, breaks: true, radial: true });
          g.audio.sfx('thorns', this.x, this.z);
          g.shake(0.5);
          for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            g.fx.emit(P.splinter, this.x + Math.cos(a) * 2.4, this.y + 0.2, this.z + Math.sin(a) * 2.4, Math.cos(a) * 2, 4, Math.sin(a) * 2);
          }
          g.fx.burst(P.leaf, this.x, this.y + 0.5, this.z, 20, 2.5, 3);
        }
        if (this.rideT >= 0.65) this.rideState = 'ride';
        break;
      case 'charge':
        speed = this.rideT < 0.8 ? 12 : 3;
        tx = this.fx;
        tz = this.fz;
        accel = 40;
        if (this.rideT < 0.8) {
          this.strike(g, { cx: this.x + this.fx * 1.0, cz: this.z + this.fz * 1.0, reach: 1.4 * this.reachMul, arc: -2, dmg: 2 * this.damage, kb: 11, set: this.swingHits, breaks: true, charge: true, radial: true });
          g.combat.deflectArrows(this.x, this.z, 1.8);
          if (Math.random() < 0.8) g.fx.emit(P.dust, this.x, this.y + 0.1, this.z, 0, 0.6, 0);
        }
        if (this.rideT >= 0.95) this.rideState = 'ride';
        break;
    }

    // Wading slows even a horse, and puts out flames.
    const wt = g.grid.waterAt(this.x, this.z);
    if (this.onGround && wt > g.grid.groundAt(this.x, this.z) + 0.05) {
      speed *= 0.8;
      if (this.effects.burn > 0) this.extinguish(g, 'steam');
    }

    const a = accel;
    this.vx += clamp(tx * speed - this.vx, -a * dt, a * dt);
    this.vz += clamp(tz * speed - this.vz, -a * dt, a * dt);
    const bx = this.x, bz = this.z;
    g.grid.move(this, this.vx * dt, this.vz * dt, PLAYER.stepUp);
    // Horses stay out of houses and halls.
    if (g.insideStructure(this.x, this.z, this.y)) {
      this.x = bx;
      this.z = bz;
      this.vx = this.vz = 0;
      if (g.time - this.insideWarned > 3) {
        this.insideWarned = g.time;
        g.pop(this, `the ${m.called} will not go inside`, '#ebe8f7');
      }
    }

    // Running down foes: a trample at a gallop.
    const sp = Math.hypot(this.vx, this.vz);
    if (sp > 5 && this.rideState === 'ride')
      for (const e of g.enemies) {
        if (!e.alive || e.flying) continue;
        const d = Math.hypot(e.x - this.x, e.z - this.z);
        if (d > this.r + e.r + 0.35 || Math.abs(e.y - this.y) > 1.2) continue;
        if ((this.trampled.get(e) ?? -9) > g.time - 0.7) continue;
        this.trampled.set(e, g.time);
        if (e.takeHit(0.8 * this.damage, this.vx / sp, this.vz / sp, 8, false, g) !== 'blocked') {
          g.landed(e, false);
          this.energy = Math.min(100, this.energy + 6);
        }
        g.shake(0.3);
      }

    // Ground and falling.
    const gy = g.grid.groundAt(this.x, this.z);
    if (this.y - gy > 0.5 || this.vy > 0) {
      this.onGround = false;
      this.vy -= PLAYER.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= gy) {
        this.y = gy;
        this.vy = 0;
        this.onGround = true;
        this.stagLeapt = false;
        g.audio.sfx('landHard');
        g.fx.burst(P.dust, this.x, gy + 0.05, this.z, 8, 1.8);
      }
    } else {
      this.y = gy;
      this.vy = 0;
      this.onGround = true;
      if (gy > -5) this.lastSafe = { x: this.x, z: this.z };
    }
    if (this.y < -7) {
      this.dismount(g);
      g.fellOut();
      return;
    }
    // Hoofbeats.
    const step = Math.floor(m.model.phase / Math.PI);
    if (step !== this.lastStep && this.onGround && sp > 1) g.footstep(this.x, this.z);
    this.lastStep = step;

    const horseAnim = this.rideState === 'kick' ? 'kick' : this.rideState === 'rear' || this.rideState === 'shield' || this.rideState === 'burst' ? 'rear' : this.rideState === 'charge' || this.rideState === 'gore' ? 'charge' : sp > 0.3 ? 'walk' : 'idle';
    const saddle = m.ride(dt, g, this.x, this.y, this.z, this.fx, this.fz, horseAnim, this.rideT, gy);
    const rig = this.rig;
    rig.face(this.fx, this.fz, dt, 8);
    this.model.animate(dt, this.x, this.z, this.rideState === 'kick' ? 'rideAtk' : 'ride', this.rideT, g.time, { dur: 0.4 });
    rig.place(g.cam, saddle.x, saddle.y - 0.9, saddle.z, gy, true);
    rig.root.rotation.x = m.bodyPitch;
    rig.flash = 0;
    rig.tint.setRGB(1, 1, 1);
  }

  // ---------- actions ----------

  /** Start one of the Thornstag's moves. */
  private stagMove(state: 'gore' | 'shield' | 'burst', g: Game) {
    this.rideState = state;
    this.rideT = 0;
    this.swingHits.clear();
    g.audio.sfx(state === 'gore' ? 'swing' : 'bellow', this.x, this.z);
  }

  /**
   * Vines on a cliff face: hold jump against them and the knight climbs; at the top he
   * steps off onto the ledge. Returns true while climbing (the fall is skipped).
   */
  private climb(dt: number, g: Game) {
    const vines = g.realm.vines;
    this.climbing = false;
    if (!vines || this.riding || !g.input.held('jump') || !g.controlsEnabled) return false;
    for (const v of vines) {
      const along = v.alongX ? this.x - v.x : this.z - v.z;
      const out = (this.x - v.x) * v.nx + (this.z - v.z) * v.nz;
      if (Math.abs(along) > v.w / 2 || out < 0 || out > 0.75 || this.y >= v.top - 0.02 || this.y < v.top - 7) continue;
      this.climbing = true;
      this.vy = 0;
      this.onGround = false;
      this.y = Math.min(v.top, this.y + 3.2 * dt);
      this.fx = -v.nx;
      this.fz = -v.nz;
      if (Math.random() < dt * 6) g.fx.emit(P.leaf, this.x, this.y + 1, this.z, 0, -0.5, 0);
      if (this.y >= v.top - 0.05) {
        // Over the lip and onto the ledge.
        this.x -= v.nx * 0.8;
        this.z -= v.nz * 0.8;
        this.y = v.top;
        this.onGround = true;
        this.climbing = false;
        g.audio.sfx('land');
      }
      return true;
    }
    return false;
  }

  private heldFastT = -9;
  /** Snared: the rope holds, whatever you try. */
  private heldFast(g: Game) {
    if (g.time - this.heldFastT < 0.8) return;
    this.heldFastT = g.time;
    g.pop(this, 'held fast!', '#d8c8a0');
  }

  private raiseGuard(g: Game) {
    this.setState('block');
    this.blockPressed = g.time;
    g.audio.sfx('guard');
  }

  private jump(g: Game) {
    if (this.effects.snare > 0) return this.heldFast(g);
    this.vy = PLAYER.jumpSpeed;
    this.onGround = false;
    this.y += 0.02;
    g.audio.sfx('jump');
    g.fx.burst(P.dust, this.x, this.y + 0.05, this.z, 4, 1);
  }

  private dirOf(dx: number, dz: number) {
    const l = Math.hypot(dx, dz) || 1;
    this.rollDir.set(dx / l, dz / l);
    this.fx = this.rollDir.x;
    this.fz = this.rollDir.y;
    this.rig.face(this.fx, this.fz, 0);
  }

  private tryRoll(g: Game, dx: number, dz: number) {
    if (this.effects.snare > 0) {
      this.setState('idle');
      return this.heldFast(g);
    }
    if (this.stamina < 25) {
      this.setState('idle');
      this.tired(g);
      return;
    }
    this.dirOf(dx, dz);
    this.useStamina(PLAYER.rollCost);
    this.iframes = PLAYER.rollIFrames;
    this.setState('roll');
    this.combo = 0;
    g.audio.sfx('roll');
    if (this.effects.burn > 0) this.extinguish(g, 'roll');
  }

  private airDash(g: Game, dx: number, dz: number) {
    if (this.stamina < 25) return this.tired(g);
    this.airDodged = true;
    this.dirOf(dx, dz);
    this.useStamina(PLAYER.rollCost);
    this.iframes = 0.22;
    this.vy = Math.max(this.vy, 1);
    this.setState('airdash');
    g.audio.sfx('roll');
  }

  private startSwing(i: number, g: Game) {
    this.combo = i;
    this.queued = false;
    this.swingHits.clear();
    this.fx = this.aim.x;
    this.fz = this.aim.y;
    this.setState('attack');
    this.rig.face(this.fx, this.fz, 0);
    g.swoosh(this, i);
    g.audio.sfx(i === 2 ? 'swingHeavy' : 'swing');
  }

  private startSpin(g: Game, full: boolean) {
    this.spinFull = full;
    this.spinHits = 0;
    this.swingHits.clear();
    this.setState('spin');
    g.swoosh(this, full ? 4 : 3);
    g.audio.sfx('spin');
    g.fx.burst(full ? P.bluespark : P.coinGlint, this.x, this.y + 1, this.z, 16, 3, 1);
  }

  private startStab(g: Game) {
    this.swingHits.clear();
    this.setState('stab');
    g.audio.sfx('swing');
  }

  private trySpecial(g: Game, moving: boolean, [dx, dz]: [number, number]) {
    if (this.energy < SPECIAL_COST) {
      g.pop(this, 'not enough energy', '#5ad1ff');
      return;
    }
    this.energy -= SPECIAL_COST;
    this.swingHits.clear();
    this.healed = false;
    g.fx.burst(P.bluespark, this.x, this.y + 1, this.z, 14, 2.5, 1.5);
    if (!this.onGround) {
      this.plungePhase = 'hang';
      this.setState('plunge');
      g.audio.sfx('plunge');
    } else if (moving) {
      this.dirOf(g.input.mouseAim ? this.aim.x : dx, g.input.mouseAim ? this.aim.y : dz);
      this.iframes = 0.3;
      this.setState('dash');
      g.audio.sfx('dash');
    } else {
      this.fx = this.aim.x;
      this.fz = this.aim.y;
      this.rig.face(this.fx, this.fz, 0);
      this.setState('wave');
      g.audio.sfx('wave');
    }
  }

  /** Hit every foe (and pot, and the cage) in an area. Returns how many were hit. */
  private strike(g: Game, o: StrikeOpts) {
    let n = 0;
    const inArea = (tx: number, ty: number, tz: number, tr: number) => {
      const dx = tx - o.cx, dz = tz - o.cz;
      const d = Math.hypot(dx, dz);
      if (d > o.reach + tr || ty < this.y + (o.yLo ?? -1.6) || ty > this.y + (o.yHi ?? 1.6)) return false;
      if (!g.clearBetween(this.x, this.z, tx, tz, Math.max(this.y, ty) + 0.3, tr + 0.25)) return false;
      if (o.arc < -1 || d < 0.5 + tr) return true;
      return (dx * this.fx + dz * this.fz) / d > o.arc - 0.2;
    };
    for (const e of g.enemies) {
      if (!e.alive || o.set.has(e)) continue;
      if (!inArea(e.x, e.y + (e.flying ? -1 : 0), e.z, e.r)) continue;
      o.set.add(e);
      let kx = this.fx, kz = this.fz;
      if (o.radial) {
        const d = Math.hypot(e.x - o.cx, e.z - o.cz) || 1;
        kx = (e.x - o.cx) / d;
        kz = (e.z - o.cz) / d;
      }
      const res = e.takeHit(o.dmg, kx, kz, o.kb, !!o.breaks, g);
      if (res === 'blocked') {
        g.hitstop(0.05);
        g.audio.sfx('clang');
        g.fx.burst(P.spark, e.x - this.fx * 0.3, e.y + 0.8, e.z - this.fz * 0.3, 10, 4, 2);
        this.vx -= this.fx * 3;
        this.vz -= this.fz * 3;
      } else {
        n++;
        g.landed(e, !!o.breaks);
        this.energy = Math.min(100, this.energy + 8);
      }
    }
    for (const b of g.breakables) {
      if (b.broken || o.set.has(b)) continue;
      if (!inArea(b.x, b.y, b.z, 0.35)) continue;
      o.set.add(b);
      g.breakObject(b, this.fx, this.fz);
    }
    for (const w of g.crackedWalls) {
      if (w.broken || o.set.has(w)) continue;
      const wdx = w.x - o.cx, wdz = w.z - o.cz, wd = Math.hypot(wdx, wdz);
      if (wd > o.reach + 1.2 || Math.abs(w.y - this.y) > 1.5) continue;
      if (o.arc > -1 && wd > 0.6 && (wdx * this.fx + wdz * this.fz) / wd < o.arc - 0.35) continue;
      o.set.add(w);
      if (o.breaks) g.breakWall(w);
      else w.chip(g, this.fx, this.fz);
    }
    for (const h of g.hedges) {
      if (h.broken || o.set.has(h)) continue;
      // Near the hedge's line, within its width.
      const along = h.alongX ? o.cx - h.x : o.cz - h.z, across = h.alongX ? o.cz - h.z : o.cx - h.x;
      if (Math.abs(along) > h.w / 2 + 0.3 || Math.abs(across) > o.reach + 0.9 || Math.abs(h.y - this.y) > 1.5) continue;
      o.set.add(h);
      if (o.charge) g.breakHedge(h);
      else h.hold(g, this.fx, this.fz);
    }
    for (const t of g.snareTraps) if (t.armed && inArea(t.x, t.y, t.z, 0.4)) t.spring(g);
    for (const b of g.bindings)
      if (!b.freed && !o.set.has(b) && inArea(b.x, b.y, b.z, 1.4)) {
        o.set.add(b);
        b.cut(g);
      }
    const cage = g.cage;
    if (cage && !cage.open && !o.set.has(cage) && inArea(cage.x, cage.y, cage.z, 0.8)) {
      o.set.add(cage);
      g.hitCage();
    }
    if (n > 0) {
      g.hitstop(o.breaks ? 0.1 : 0.06);
      g.shake(o.breaks ? 0.45 : 0.3);
    }
    return n;
  }

  /** An enemy attack reaches the knight. */
  hurt(dmg: number, fromX: number, fromZ: number, g: Game, opts: { unblockable?: boolean; kb?: number; guardCost?: number; force?: boolean } = {}): HitResult {
    if (!this.alive || g.godMode) return 'ignored';
    if (this.iframes > 0 && !opts.force) return this.state === 'roll' || this.state === 'dash' || this.state === 'airdash' ? 'dodged' : 'ignored';
    const dx = this.x - fromX, dz = this.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    const nx = dx / d, nz = dz / d;
    if (this.state === 'block' && !opts.unblockable) {
      const facing = -(nx * this.fx + nz * this.fz);
      if (facing > 0.1) {
        if (g.time - this.blockPressed < PLAYER.parryWindow) {
          // A clean parry costs nothing and gives back.
          this.stamina = Math.min(this.maxStamina, this.stamina + 25);
          this.energy = Math.min(100, this.energy + 20);
          return 'parried';
        }
        this.useStamina(PLAYER.blockCost * (this.crest ? 0.7 : 1) * (opts.guardCost ?? 1));
        this.vx += nx * 4;
        this.vz += nz * 4;
        this.blockHitT = 0;
        if (this.stamina <= 0) {
          this.guardBroken = 0.9;
          this.setState('hurt');
          g.audio.sfx('guardBreak');
        }
        return 'blocked';
      }
    }
    if (this.riding) {
      const m = this.riding;
      m.hp -= dmg;
      this.iframes = 0.7;
      this.vx += nx * 3;
      this.vz += nz * 3;
      g.audio.sfx('neigh', this.x, this.z);
      if (m.hp <= 0) this.dismount(g, true);
      return 'hit';
    }
    if (this.power && this.power.kind === 'bubble' && this.power.hits > 0) {
      this.power.hits--;
      if (this.power.hits <= 0) this.power.t = 0.01;
      this.iframes = 0.5;
      return 'bubbled';
    }
    this.hp = Math.max(0, this.hp - dmg);
    const kb = opts.kb ?? 7;
    this.vx = nx * kb;
    this.vz = nz * kb;
    this.iframes = PLAYER.hurtIFrames;
    this.combo = 0;
    if (this.hp <= 0) {
      this.setState('dead');
      this.deathT = 0;
    } else this.setState('hurt');
    return 'hit';
  }

  // ---------- status effects ----------

  private updateEffects(dt: number, g: Game) {
    const e = this.effects;
    this.dazeImmune = Math.max(0, this.dazeImmune - dt);
    if (e.maim > 0) {
      e.maim = Math.max(0, e.maim - dt);
      if (Math.random() < dt * 4) g.fx.emit(P.drip, this.x + (Math.random() - 0.5) * 0.3, this.y + 0.5, this.z + (Math.random() - 0.5) * 0.3, 0, 0, 0);
    }
    if (e.snare > 0) {
      e.snare = Math.max(0, e.snare - dt);
      this.vx *= 0.5;
      this.vz *= 0.5;
    }
    if (e.poison > 0) {
      e.poison = Math.max(0, e.poison - dt);
      if (Math.random() < dt * 8) g.fx.emit(P.bubble, this.x + (Math.random() - 0.5) * 0.6, this.y + 0.6 + Math.random() * 1.2, this.z + (Math.random() - 0.5) * 0.6, 0, 0.7, 0);
    }
    if (e.burn > 0 && this.alive) {
      if (this.state !== 'dazed' && this.state !== 'down') e.burn -= dt;
      if (Math.random() < dt * 40) g.fx.emit(P.flame, this.x + (Math.random() - 0.5) * 0.5, this.y + 0.3 + Math.random() * 1.4, this.z + (Math.random() - 0.5) * 0.5, 0, 0.6, 0);
      if (e.burn <= 0) {
        e.burn = 0;
        if (!g.godMode) {
          const res = this.hurt(1, this.x - this.fx, this.z - this.fz, g, { unblockable: true, kb: 2, force: true });
          g.afterHit(res, this.x, this.z, null);
          g.pop(this, 'burned!', '#ff9a50');
        }
      }
    }
    e.daze = this.state === 'dazed' || this.state === 'down' ? Math.max(0, e.daze - dt) : 0;
  }

  /** Something bad happens to the knight. Returns false if it didn't take. */
  afflict(kind: Effect, g: Game, opts: { down?: boolean; time?: number } = {}) {
    if (!this.alive || g.godMode) return false;
    const e = this.effects;
    if (kind === 'daze') {
      // The horse takes the blow; a fresh daze can't follow right after another.
      if (this.riding || this.dazeImmune > 0 || this.state === 'dazed' || this.state === 'down') return false;
      const t = opts.down ? EFFECTS.downTime : EFFECTS.dazeTime;
      e.daze = this.effectMax.daze = t;
      this.dazeImmune = t + EFFECTS.dazeImmune;
      this.combo = 0;
      this.setState(opts.down ? 'down' : 'dazed');
      this.vx *= 0.3;
      this.vz *= 0.3;
      g.pop(this, opts.down ? 'knocked down!' : 'dazed!', '#fff0a0');
      g.audio.sfx('daze', this.x, this.z);
      g.effectTip('daze');
      return true;
    }
    if (kind === 'burn') {
      if (e.burn > 0) return false;
      e.burn = this.effectMax.burn = EFFECTS.burnFuse;
      g.pop(this, 'on fire! roll!', '#ff9a50');
      g.audio.sfx('ignite', this.x, this.z);
      g.effectTip('burn');
      return true;
    }
    if (kind === 'snare' && this.riding) return false; // the horse tears free
    const t = opts.time ?? (kind === 'maim' ? EFFECTS.maimTime : kind === 'snare' ? EFFECTS.snareTime : EFFECTS.poisonTime);
    const fresh = e[kind] <= 0;
    e[kind] = Math.max(e[kind], t);
    this.effectMax[kind] = Math.max(e[kind], this.effectMax[kind] * (fresh ? 0 : 1));
    if (fresh) {
      const words = { maim: ['maimed!', '#ff8a8a', 'maim'], poison: ['poisoned!', '#9ef07a', 'poison'], snare: ['snared!', '#d8c8a0', 'clang'] } as Record<string, [string, string, string]>;
      const [txt, col, sfx] = words[kind];
      g.pop(this, txt, col);
      g.audio.sfx(sfx, this.x, this.z);
      g.effectTip(kind);
    }
    return true;
  }

  extinguish(g: Game, how: 'roll' | 'steam') {
    this.effects.burn = 0;
    g.pop(this, 'put out', '#b8d8ff');
    g.audio.sfx('extinguish', this.x, this.z);
    g.fx.burst(P.puff, this.x, this.y + 0.8, this.z, how === 'steam' ? 12 : 6, 1.5);
  }

  cureAll() {
    this.effects.maim = this.effects.poison = this.effects.burn = this.effects.daze = this.effects.snare = 0;
  }

  /**
   * A nuisance hit (bat swoops, darts): no hearts lost, but it shoves the
   * knight, costs stamina and interrupts whatever he was doing.
   */
  harass(fromX: number, fromZ: number, g: Game, opts: { kb?: number; stamina?: number } = {}): HitResult {
    if (!this.alive || g.godMode) return 'ignored';
    if (this.iframes > 0) return this.state === 'roll' || this.state === 'dash' || this.state === 'airdash' ? 'dodged' : 'ignored';
    const dx = this.x - fromX, dz = this.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    const nx = dx / d, nz = dz / d;
    if (this.state === 'block' && -(nx * this.fx + nz * this.fz) > 0.1) {
      this.useStamina(5);
      this.blockHitT = 0;
      return 'blocked';
    }
    const kb = opts.kb ?? 4;
    this.vx += nx * kb;
    this.vz += nz * kb;
    this.useStamina(opts.stamina ?? 0);
    this.iframes = 0.35;
    if (!this.riding && (this.state === 'drink' || this.state === 'charge' || this.state === 'attack' || this.state === 'idle' || this.state === 'run')) {
      if (this.state === 'drink' && !this.healed) g.pop(this, 'interrupted! (flask kept)', '#b8d8ff');
      this.combo = 0;
      this.setState('hurt');
      this.t = 0.2;
    }
    return 'hit';
  }

  givePower(kind: PowerKind) {
    this.power = { kind, t: 20, hits: kind === 'bubble' ? 2 : 0 };
  }

  die() {
    this.setState('dead');
    this.deathT = 0;
  }
  rest() {
    this.setState('rest');
  }
  standUp() {
    this.setState('idle');
  }
  revive() {
    this.cureAll();
    this.riding = null;
    this.r = PLAYER.radius;
    this.hp = this.maxHp;
    this.stamina = this.maxStamina;
    this.energy = 100;
    this.flasks = this.flasksMax;
    this.iframes = 1.5;
    this.power = null;
    this.setState('idle');
  }
}
