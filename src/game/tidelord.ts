import * as THREE from 'three';
import { FOES, PLAYER } from '../config';
import { P } from '../engine/particles';
import type { Enemy } from './enemies';
import type { Game } from './game';
import { HALL } from '../world/realm3';

// ---------------------------------------------------------------------------
// The Tidelord (the Sunken Reef's tyrant): the prototype's charge, orbs and slam, fought on the floor of his
// drowned throne hall, 6 m under the sea. Everything he does shows before it lands and comes one at a time:
//   charge   head down, his lane drawn on the floor from him toward the knight, following him, then fixed a
//            moment before he goes; he runs it to its end (into a wall, and he's dazed)
//   orbs     dark water gathers over his trident into orbs that drift after the knight, slower than he walks;
//            a blow cuts one down (a breath of air in it); he starts nothing new while they're about
//   slam     a crouch, then up he goes (slow, as the sea makes him) and down onto the spot marked under the
//            knight when he left the floor, the mark filling till he lands; a wave runs out over the floor (jump it)
//   sweep    too close, his trident sweeps round in front of him: its reach shown on the floor, filling as he
//            draws back, his aim held a moment before it comes
//   summon   his crew called in (a new pair only once the last are down)
// Enraged at half health, the tide turns: a current sweeps the hall's floor, carrying the knight and the orbs,
// and every few seconds it turns a quarter (it runs toward the far walls, north or west: never into the low walls on
// the camera's side, where it would pin the knight out of sight), its new way shown on the floor before it does.
// ---------------------------------------------------------------------------

const T = FOES.tidelord;
type St = Enemy['state'];

const CALM = ['charge', 'orbs', 'slam', 'charge', 'summon', 'slam', 'orbs'];
const ENRAGED = ['charge', 'slam', 'orbs', 'charge', 'slam', 'summon', 'orbs'];
const ease = (k: number) => k * k * (3 - 2 * k);
const go = (e: Enemy, s: St) => {
  e.state = s;
  e.t = 0;
  e.struck = false;
};
const face = (e: Enemy, x: number, z: number) => {
  const dx = x - e.x, dz = z - e.z, l = Math.hypot(dx, dz);
  if (l > 0.01) {
    e.fx = dx / l;
    e.fz = dz / l;
  }
};

/** Marks are drawn over everything, so nothing between them and the camera can hide one. */
const markMat = (col: THREE.Color, opacity: number) =>
  new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide });

interface Orb {
  core: THREE.Mesh;
  shell: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t: number;
  /** Gathering over the trident (harmless) until it's loosed. */
  loose: boolean;
  dead: boolean;
}
interface SlamMark {
  x: number;
  z: number;
  y: number;
  t: number;
  delay: number;
  ring: THREE.Mesh;
  fill: THREE.Mesh;
  reach: THREE.Mesh;
  landed: boolean;
}
interface Wave {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  r: number;
  hit: boolean;
  delay: number;
}

/** What the Tidelord has loosed in his hall, and the hall's tide. One per game. */
class TideHall {
  orbs: Orb[] = [];
  marks: SlamMark[] = [];
  waves: Wave[] = [];
  /** The charge's lane: where he will run (angle and length), and whether it's fixed. */
  lane: THREE.Mesh;
  laneMat = markMat(new THREE.Color(0.5, 1.6, 1.9), 0.2);
  laneLockMat = markMat(new THREE.Color(2.4, 1.0, 0.5), 0.5);
  aim = 0;
  len = 6;
  /** His last move was the sweep (the next comes from his round of moves, however close the knight is). */
  swept = false;
  /** The sweep's reach on the floor: the half-ring before him, filling as he draws back. */
  sweep: THREE.Mesh;
  sweepFill: THREE.Mesh;
  /** The tide (enraged): its way, the way it will turn to, seconds till it turns, how strong it runs now. */
  tide = { on: false, ang: -Math.PI / 2, next: -Math.PI / 2, t: 0, k: 0, warned: false };
  arrows: THREE.Mesh[] = [];
  arrowMat = markMat(new THREE.Color(0.6, 1.8, 2.0), 0);
  orbCore = new THREE.IcosahedronGeometry(0.2, 1);
  orbShell = new THREE.IcosahedronGeometry(0.4, 1);
  orbCoreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 2.4, 2.8) });
  orbShellMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.08, 0.3, 0.38), transparent: true, opacity: 0.7, depthWrite: false });
  constructor(private g: Game) {
    this.lane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.laneMat);
    this.lane.renderOrder = 6;
    this.lane.visible = false;
    g.scene.add(this.lane);
    const col = new THREE.Color(2.6, 1.0, 0.45), R = T.reach;
    this.sweep = new THREE.Mesh(new THREE.RingGeometry(R - 0.14, R, 32, 1, -Math.PI / 2, Math.PI), markMat(col, 0.45));
    this.sweepFill = new THREE.Mesh(new THREE.CircleGeometry(R - 0.14, 32, -Math.PI / 2, Math.PI), markMat(col, 0.18));
    for (const m of [this.sweep, this.sweepFill]) {
      m.renderOrder = 5;
      m.visible = false;
      g.scene.add(m);
    }
    // The tide's arrows: chevrons laid over the hall's floor.
    const s = new THREE.Shape();
    s.moveTo(0.55, 0);
    s.lineTo(-0.35, 0.5);
    s.lineTo(-0.15, 0);
    s.lineTo(-0.35, -0.5);
    s.closePath();
    const geo = new THREE.ShapeGeometry(s);
    for (let i = 0; i < 3; i++)
      for (let k = 0; k < 3; k++) {
        const m = new THREE.Mesh(geo, this.arrowMat);
        m.position.set(HALL.x0 + ((i + 0.5) / 3) * (HALL.x1 - HALL.x0), HALL.y + 0.08, HALL.z0 + ((k + 0.5) / 3) * (HALL.z1 - HALL.z0));
        m.rotation.order = 'YXZ';
        m.renderOrder = 4;
        m.visible = false;
        g.scene.add(m);
        this.arrows.push(m);
      }
  }

  /** Anything of his still to land or still about: he starts nothing new till it's done. */
  get busy() {
    return this.orbs.length > 0 || this.marks.length > 0 || this.waves.length > 0;
  }

  showLane(e: Enemy, locked: boolean) {
    const m = this.lane, y = this.g.grid.groundAt(e.x, e.z) + 0.07;
    m.visible = true;
    m.material = locked ? this.laneLockMat : this.laneMat;
    m.scale.set(this.len, (e.r + 0.15) * 2, 1);
    m.position.set(e.x + (Math.cos(this.aim) * this.len) / 2, y, e.z + (Math.sin(this.aim) * this.len) / 2);
    m.rotation.set(-Math.PI / 2, -this.aim, 0, 'YXZ');
    if (!locked) this.laneMat.opacity = 0.16 + 0.1 * Math.sin(this.g.time * 18);
  }
  hideLane() {
    this.lane.visible = false;
  }

  /** The sweep's reach before him, filling (k from 0 to 1) till it comes round. */
  showSweep(e: Enemy, k: number) {
    const y = this.g.grid.groundAt(e.x, e.z) + 0.07, a = Math.atan2(e.fz, e.fx);
    for (const m of [this.sweep, this.sweepFill]) {
      m.visible = true;
      m.position.set(e.x, y, e.z);
      m.rotation.set(-Math.PI / 2, -a, 0, 'YXZ');
    }
    this.sweepFill.scale.setScalar(Math.max(0.01, k));
    (this.sweep.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.5 * k;
  }
  hideSweep() {
    this.sweep.visible = this.sweepFill.visible = false;
  }

  /** The lane runs on past the knight by a few metres, or to the wall (less his own breadth). */
  laneTo(e: Enemy, d: number) {
    const cx = Math.cos(this.aim), cz = Math.sin(this.aim);
    let wall = 99;
    if (cx > 1e-3) wall = Math.min(wall, (HALL.x1 - e.x) / cx);
    if (cx < -1e-3) wall = Math.min(wall, (HALL.x0 - e.x) / cx);
    if (cz > 1e-3) wall = Math.min(wall, (HALL.z1 - e.z) / cz);
    if (cz < -1e-3) wall = Math.min(wall, (HALL.z0 - e.z) / cz);
    return Math.max(2, Math.min(d + 4, wall - e.r * 0.5));
  }

  gather(e: Enemy, n: number) {
    for (let k = 0; k < n; k++) {
      const a = Math.atan2(e.fz, e.fx) + Math.PI / 2 + ((k - (n - 1) / 2) / Math.max(1, n - 1)) * Math.PI;
      const o: Orb = {
        core: new THREE.Mesh(this.orbCore, this.orbCoreMat),
        shell: new THREE.Mesh(this.orbShell, this.orbShellMat),
        x: e.x + Math.cos(a) * 1.3,
        y: e.y + 3.4 + (k % 2) * 0.4,
        z: e.z + Math.sin(a) * 1.3,
        vx: 0,
        vy: 0,
        vz: 0,
        t: 0,
        loose: false,
        dead: false,
      };
      o.core.scale.setScalar(0.01);
      o.shell.scale.setScalar(0.01);
      this.g.scene.add(o.core, o.shell);
      this.orbs.push(o);
    }
  }
  loose() {
    for (const o of this.orbs) o.loose = true;
  }

  slam(x: number, z: number, delay: number) {
    const g = this.g, y = g.grid.groundAt(x, z);
    const col = new THREE.Color(2.6, 1.0, 0.45);
    const ring = new THREE.Mesh(new THREE.RingGeometry(T.slamR - 0.16, T.slamR, 40), markMat(col, 0.45));
    const fill = new THREE.Mesh(new THREE.CircleGeometry(T.slamR - 0.16, 36), markMat(col, 0.16));
    // (How far its wave will run: faint, so the knight knows to jump it.)
    const reach = new THREE.Mesh(new THREE.RingGeometry(T.waveR - 0.08, T.waveR, 64), markMat(new THREE.Color(1.4, 1.6, 1.5), 0.12));
    for (const m of [ring, fill, reach]) {
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y + 0.06, z);
      m.renderOrder = 5;
      g.scene.add(m);
    }
    fill.scale.setScalar(0.01);
    this.marks.push({ x, z, y, t: 0, delay, ring, fill, reach, landed: false });
  }

  wave(x: number, y: number, z: number, delay = 0) {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 56), markMat(new THREE.Color(1.6, 1.9, 1.7), 0.8));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y + 0.1, z);
    mesh.renderOrder = 5;
    mesh.visible = false;
    this.g.scene.add(mesh);
    this.waves.push({ mesh, x, y, z, r: T.slamR * 0.8, hit: false, delay });
  }

  startTide() {
    const td = this.tide;
    if (td.on) return;
    td.on = true;
    td.ang = td.next = -Math.PI / 2;
    td.t = T.tideEvery;
    td.k = 0;
    td.warned = false;
    this.g.audio.sfx('surge');
  }

  /** The way the tide runs now (m/s along x and z). */
  get flow() {
    const td = this.tide, v = td.on ? td.k * T.tide : 0;
    return { x: Math.cos(td.ang) * v, z: Math.sin(td.ang) * v };
  }

  update(dt: number, boss: Enemy | null) {
    const g = this.g, p = g.player, a = HALL, floor = HALL.y;
    // ---------- the tide ----------
    const td = this.tide;
    if (td.on) {
      td.t -= dt;
      if (td.t <= T.tideWarn && !td.warned) {
        // Its new way shows on the floor: a quarter turn, north to west and back.
        td.warned = true;
        td.next = td.ang === -Math.PI / 2 ? Math.PI : -Math.PI / 2;
        g.audio.sfx('surge');
      }
      if (td.t <= 0) {
        td.ang = td.next;
        td.t = T.tideEvery;
        td.warned = false;
      }
      // (It slackens as it turns, then runs again.)
      const want = td.warned && td.t < 0.45 ? 0.25 : 1;
      td.k += (want - td.k) * Math.min(1, dt * 3);
      const f = this.flow;
      const inHall = p.x > a.x0 && p.x < a.x1 && p.z > a.z0 && p.z < a.z1 && p.y < floor + 4;
      if (p.alive && inHall && !g.flying) g.grid.move(p, f.x * dt, f.z * dt, PLAYER.stepUp);
      // Specks and sand streaming with it.
      for (let k = 0; k < 2; k++)
        if (Math.random() < dt * 30) {
          const x = a.x0 + Math.random() * (a.x1 - a.x0), z = a.z0 + Math.random() * (a.z1 - a.z0);
          g.fx.emit(P.stream, x, floor + 0.1 + Math.random() * 1.6, z, f.x * 2.2, 0, f.z * 2.2);
        }
      if (Math.random() < dt * 14) g.fx.emit(P.dust, a.x0 + Math.random() * (a.x1 - a.x0), floor + 0.1, a.z0 + Math.random() * (a.z1 - a.z0), f.x * 1.5, 0.1, f.z * 1.5);
      // The arrows: faint while it runs, bright and swinging round to the new way while it's about to turn.
      const show = td.warned ? 1 - Math.max(0, td.t - (T.tideWarn - 0.35)) / 0.35 : 0;
      const turnK = td.warned ? Math.min(1, (T.tideWarn - td.t) / 0.5) : 0;
      const ang = td.ang + Math.atan2(Math.sin(td.next - td.ang), Math.cos(td.next - td.ang)) * turnK;
      this.arrowMat.opacity = 0.1 + 0.4 * show * (0.75 + 0.25 * Math.sin(g.time * 16));
      for (const m of this.arrows) {
        m.visible = true;
        m.rotation.set(-Math.PI / 2, -ang, 0, 'YXZ');
      }
    } else for (const m of this.arrows) m.visible = false;

    // ---------- the orbs ----------
    const sp = boss?.enraged ? 1.25 : 1, f = this.flow;
    const swinging = (p.state === 'attack' && p.t > 0.07 && p.t < 0.28) || p.state === 'spin' || p.state === 'stab' || p.state === 'dash' || p.state === 'plunge';
    for (const o of this.orbs) {
      o.t += dt;
      const grow = Math.min(1, o.t / 0.5);
      o.core.scale.setScalar(Math.max(0.01, grow));
      o.shell.scale.setScalar(Math.max(0.01, grow * (1 + Math.sin(g.time * 7 + o.x) * 0.06)));
      if (o.loose) {
        // After the knight's chest, slower than he walks and slow to turn; the tide carries them too.
        const tx = p.x - o.x, ty = p.y + 1.0 - o.y, tz = p.z - o.z, l = Math.hypot(tx, ty, tz) || 1, v = T.orbSpeed * sp;
        const k = Math.min(1, dt * 1.6);
        o.vx += ((tx / l) * v - o.vx) * k;
        o.vy += ((ty / l) * v - o.vy) * k;
        o.vz += ((tz / l) * v - o.vz) * k;
        // (They keep apart.)
        for (const q of this.orbs)
          if (q !== o) {
            const dx = o.x - q.x, dz = o.z - q.z, dd = Math.hypot(dx, dz);
            if (dd < 0.9 && dd > 1e-3) {
              o.vx += (dx / dd) * dt * 3;
              o.vz += (dz / dd) * dt * 3;
            }
          }
        o.x = Math.min(a.x1 - 0.3, Math.max(a.x0 + 0.3, o.x + (o.vx + f.x) * dt));
        o.y = Math.max(floor + 0.6, o.y + o.vy * dt);
        o.z = Math.min(a.z1 - 0.3, Math.max(a.z0 + 0.3, o.z + (o.vz + f.z) * dt));
        const dx = o.x - p.x, dz = o.z - p.z, dd = Math.hypot(dx, dz);
        // A blow cuts it down (and there's a breath of air in it).
        if (swinging && p.alive && dd < 2.0 && Math.abs(o.y - (p.y + 1)) < 1.5 && (p.state !== 'attack' || (dx * p.fx + dz * p.fz) / (dd || 1) > 0.1)) {
          this.burst(o, true);
          continue;
        }
        if (p.alive && dd < 0.62 && Math.abs(o.y - (p.y + 1)) < 0.85) {
          const res = p.hurt(1, o.x, o.z, g, { kb: 5 });
          g.afterHit(res, o.x, o.z, null);
          if (res === 'hit') g.pop(p, 'drowning!', '#7ad8e8');
          if (res !== 'ignored') this.burst(o, false);
          continue;
        }
        if (o.t > T.orbLife) this.burst(o, false);
      } else if (boss) {
        // Gathering over his trident.
        o.y += Math.sin(g.time * 3 + o.x) * dt * 0.2;
      }
      if (Math.random() < dt * 8) g.fx.emit(P.seaBubble, o.x, o.y, o.z, 0, 0.6, 0);
      o.core.position.set(o.x, o.y, o.z);
      o.shell.position.set(o.x, o.y, o.z);
    }
    this.orbs = this.orbs.filter((o) => !o.dead);

    // ---------- the slam's marks ----------
    for (const m of this.marks) {
      m.t += dt;
      const k = Math.min(1, m.t / m.delay);
      (m.ring.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.5 * k;
      m.ring.scale.setScalar(1 + Math.sin(g.time * 24) * 0.02 * k);
      m.fill.scale.setScalar(Math.max(0.01, k));
      (m.fill.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.26 * k;
      (m.reach.material as THREE.MeshBasicMaterial).opacity = 0.06 + 0.12 * k;
    }
    // ---------- the waves ----------
    for (const w of this.waves) {
      if (w.delay > 0) {
        w.delay -= dt;
        continue;
      }
      w.mesh.visible = true;
      w.r += T.waveSpeed * dt;
      w.mesh.scale.set(w.r, w.r, 1);
      (w.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - w.r / T.waveR));
      for (let k = 0; k < 3; k++) {
        const an = Math.random() * Math.PI * 2;
        g.fx.emit(P.dust, w.x + Math.cos(an) * w.r, w.y + 0.15, w.z + Math.sin(an) * w.r, Math.cos(an) * 2, 0.6, Math.sin(an) * 2);
      }
      if (!w.hit && p.alive && p.onGround && Math.abs(p.y - w.y) < 0.6 && Math.abs(Math.hypot(p.x - w.x, p.z - w.z) - w.r) < 0.5) {
        w.hit = true;
        const res = p.hurt(1, w.x, w.z, g, { unblockable: true, kb: 8 });
        g.afterHit(res, w.x, w.z, null);
        if (res === 'hit') g.pop(p, 'swept!', '#bfe8e0');
      }
    }
    this.waves = this.waves.filter((w) => {
      if (w.r < T.waveR) return true;
      g.scene.remove(w.mesh);
      w.mesh.geometry.dispose();
      (w.mesh.material as THREE.Material).dispose();
      return false;
    });
  }

  /** The slam lands: its marks go. */
  landMarks() {
    for (const m of this.marks) this.dropMark(m);
    this.marks = [];
  }
  private dropMark(m: SlamMark) {
    for (const mesh of [m.ring, m.fill, m.reach]) {
      this.g.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }

  burst(o: Orb, cut: boolean) {
    const g = this.g, p = g.player;
    o.dead = true;
    g.scene.remove(o.core, o.shell);
    g.fx.burst(P.seaBubble, o.x, o.y, o.z, cut ? 16 : 8, 2.2, 1.5);
    if (cut) {
      g.audio.sfx('parry', o.x, o.z);
      g.audio.sfx('gulp', o.x, o.z);
      // (A breath of air in it.)
      if (p.dives && p.under) p.air = Math.min(p.airMax, p.air + 4);
    }
  }

  /** Everything gone: the fight's over or lost. */
  clear() {
    for (const o of this.orbs) {
      o.dead = true;
      this.g.scene.remove(o.core, o.shell);
    }
    this.orbs = [];
    this.landMarks();
    for (const w of this.waves) {
      this.g.scene.remove(w.mesh);
      w.mesh.geometry.dispose();
      (w.mesh.material as THREE.Material).dispose();
    }
    this.waves = [];
    this.hideLane();
    this.hideSweep();
    this.tide.on = false;
    this.tide.k = 0;
    for (const m of this.arrows) m.visible = false;
  }
}

const halls = new WeakMap<Game, TideHall>();
/** The Tidelord's hall (what he's loosed in it, and its tide). */
export function tideHall(g: Game) {
  let h = halls.get(g);
  if (!h) {
    halls.set(g, (h = new TideHall(g)));
    // (For the checks in tests/.)
    const hall = h;
    (window as unknown as { __tideHall: () => TideHall }).__tideHall = () => hall;
  }
  return h;
}

/** Every frame of play (the realm's story calls it): what he's loosed moves; the fight over or lost, it's gone. */
export function tideHallTick(g: Game, dt: number) {
  const h = halls.get(g);
  if (!h) return;
  const b = g.boss;
  if (!g.bossActive || !b || !b.alive) {
    if (h.busy || h.tide.on || h.lane.visible || h.sweep.visible) h.clear();
    return;
  }
  h.update(g.ui.dialogOpen || g.cutscene ? 0 : dt, b);
}

/** Walks him over the floor (his own pace, round whatever's in the way). */
function stride(e: Enemy, g: Game, dx: number, dz: number, speed: number, dt: number) {
  const l = Math.hypot(dx, dz);
  if (l < 0.01) return;
  g.grid.move(e, (dx / l) * speed * dt, (dz / l) * speed * dt, 0.45, true);
}

export function tidelordUpdate(e: Enemy, dt: number, g: Game, d: number) {
  const p = g.player, h = tideHall(g), sp = e.enraged ? 1.2 : 1;
  e.telegraph = 0;
  // Enraged, the tide turns. (A lane or a sweep's reach shows only while it's coming.)
  if (e.state !== 'paw' && e.state !== 'charge') h.hideLane();
  if (e.state !== 'windup') h.hideSweep();
  if (e.enraged && !h.tide.on && g.bossActive) h.startTide();
  switch (e.state) {
    case 'sleep':
      // On his throne, looking down his hall.
      e.fx = 0;
      e.fz = 1;
      break;
    case 'wake':
      face(e, p.x, p.z);
      if (e.t > 1.4) go(e, 'chase');
      break;
    case 'chase': {
      face(e, p.x, p.z);
      if (!p.alive) break;
      const busy = h.busy;
      // Too close: the trident sweeps (not while his orbs are still about; never twice running).
      if (d < 2.5 && e.cooldown <= 0.6 && !busy && !h.swept) {
        h.swept = true;
        go(e, 'windup');
        break;
      }
      if (e.cooldown <= 0 && !busy) {
        const moves = e.enraged ? ENRAGED : CALM;
        let m = moves[e.moveIdx++ % moves.length];
        // (A new pair only once the last are down.)
        if (m === 'summon' && e.summoned.some((s) => s.alive)) m = 'orbs';
        h.swept = false;
        go(e, m === 'charge' ? 'paw' : m === 'orbs' ? 'chant' : m === 'slam' ? 'jump' : 'summon');
        if (m === 'charge') {
          h.aim = Math.atan2(p.z - e.z, p.x - e.x);
          h.len = h.laneTo(e, d);
        }
        if (m === 'slam') e.jumpFrom.set(e.x, e.y, e.z);
        break;
      }
      // Wading after the knight; slower while his orbs are out (he's steering them).
      if (d > 2.2) stride(e, g, p.x - e.x, p.z - e.z, T.speed * sp * (busy ? 0.45 : 1), dt);
      break;
    }
    case 'windup': {
      // The sweep: the trident drawn far back, its reach on the floor before him filling; he turns after the
      // knight, then holds his aim a moment before it comes round. Inside the half-ring as it does, a heart.
      const W = T.windup;
      if (e.t < W - T.laneLock) face(e, p.x, p.z);
      e.telegraph = 1;
      h.showSweep(e, e.t / W);
      if (e.t > W) {
        go(e, 'strike');
        h.hideSweep();
        g.audio.sfx('enemySwing', e.x, e.z);
        g.fx.burst(P.seaBubble, e.x + e.fx * 1.6, e.y + 1.2, e.z + e.fz * 1.6, 14, 2.5, 0.5);
        const dx = p.x - e.x, dz = p.z - e.z, dd = Math.hypot(dx, dz);
        if (dd < T.reach + p.r && (dx * e.fx + dz * e.fz) / (dd || 1) > -0.1 && Math.abs(p.y - e.y) < 2) g.enemyHitsPlayer(e, 1, { kb: 11 });
      }
      break;
    }
    case 'strike':
      if (e.t > 0.45) {
        go(e, 'recover');
        e.cooldown = Math.max(e.cooldown, 1.0 / sp);
      }
      break;
    case 'paw': {
      // The charge: his lane follows the knight, then it's fixed, and a moment later he goes.
      const follow = e.enraged ? T.laneFollow * 0.8 : T.laneFollow;
      if (e.t < follow) {
        h.aim = Math.atan2(p.z - e.z, p.x - e.x);
        h.len = h.laneTo(e, d);
        face(e, p.x, p.z);
      }
      e.telegraph = e.t > follow ? 1 : 0;
      h.showLane(e, e.t >= follow);
      if (Math.random() < 0.4) g.fx.emit(P.dust, e.x - e.fx * 0.8, e.y + 0.1, e.z - e.fz * 0.8, -e.fx, 0.5, -e.fz);
      if (e.t > follow + T.laneLock) {
        go(e, 'charge');
        e.chargeDir.set(Math.cos(h.aim), Math.sin(h.aim));
        e.fx = e.chargeDir.x;
        e.fz = e.chargeDir.y;
        g.audio.sfx('roar', e.x, e.z);
      }
      break;
    }
    case 'charge': {
      const bx = e.x, bz = e.z, v = T.chargeSpeed * sp;
      h.showLane(e, true);
      g.grid.move(e, e.chargeDir.x * v * dt, e.chargeDir.y * v * dt, 0.45, true);
      const moved = Math.hypot(e.x - bx, e.z - bz);
      h.len = Math.max(0.5, h.len - moved);
      g.fx.emit(P.seaBubble, e.x - e.fx * 0.6, e.y + 0.8 + Math.random(), e.z - e.fz * 0.6, -e.fx, 0.8, -e.fz);
      if (Math.random() < 0.6) g.fx.emit(P.dust, e.x, e.y + 0.1, e.z, 0, 0.5, 0);
      // (His lane is as broad as he is: touching it, the knight is in his way.)
      if (!e.struck && d < e.r + 0.15 + p.r && Math.abs(p.y - e.y) < 1.8) {
        e.struck = true;
        g.enemyHitsPlayer(e, 1, { kb: 13, guardCost: 2.5 });
      }
      const blocked = moved < v * dt * 0.4 && e.t > 0.1;
      if (blocked || h.len <= 0.55 || e.t > 2.4) {
        h.hideLane();
        // Into the wall: he's dazed a while (the knight's moment).
        if (blocked || (h.len <= 0.55 && wallAhead(e))) {
          go(e, 'stun');
          g.shake(0.6);
          g.audio.sfx('thud', e.x, e.z);
          g.fx.burst(P.dust, e.x + e.fx * 0.9, e.y + 0.8, e.z + e.fz * 0.9, 18, 3);
          g.chandelierShake();
        } else go(e, 'recover');
        e.cooldown = 1.3 / sp;
      }
      break;
    }
    case 'chant':
      // Drowning orbs gather over the trident, then drift loose.
      face(e, p.x, p.z);
      e.telegraph = 1;
      if (!e.struck && e.t > 0.25) {
        e.struck = true;
        h.gather(e, T.orbs);
        g.audio.sfx('chant', e.x, e.z);
      }
      if (e.t > 0.95) {
        h.loose();
        g.audio.sfx('blink', e.x, e.z);
        go(e, 'recover');
        e.cooldown = 1.0 / sp;
      }
      break;
    case 'jump': {
      // The slam: a crouch (he flashes), then up, and down on the spot marked under the knight as he left the floor.
      const CROUCH = 0.4, AIR = T.slamDelay * (e.enraged ? 0.93 : 1);
      if (e.t < CROUCH) {
        face(e, p.x, p.z);
        e.telegraph = 1;
        break;
      }
      if (!e.struck) {
        e.struck = true;
        const tx = Math.min(HALL.x1 - 1, Math.max(HALL.x0 + 1, p.x)), tz = Math.min(HALL.z1 - 1, Math.max(HALL.z0 + 1, p.z));
        e.jumpTo.set(tx, g.grid.groundAt(tx, tz), tz);
        h.slam(tx, tz, AIR);
        g.audio.sfx('bossJump', e.x, e.z);
        g.fx.burst(P.seaBubble, e.x, e.y + 0.3, e.z, 20, 2.5, 1.5);
      }
      const k = Math.min(1, (e.t - CROUCH) / AIR);
      // (Up fast, a long hang, down hard: the sea's slow fall, then his weight.)
      const u = k < 0.75 ? ease(k / 0.75) * 0.85 : 0.85 + 0.15 * ((k - 0.75) / 0.25);
      e.x = e.jumpFrom.x + (e.jumpTo.x - e.jumpFrom.x) * u;
      e.z = e.jumpFrom.z + (e.jumpTo.z - e.jumpFrom.z) * u;
      e.model.rig.lift = k < 0.4 ? Math.sin((k / 0.4) * Math.PI / 2) * 4 : k < 0.8 ? 4 : 4 * (1 - (k - 0.8) / 0.2);
      if (k >= 1) {
        e.model.rig.lift = 0;
        g.grid.resolve(e, 0.45, true);
        go(e, 'slam');
        h.landMarks();
        g.audio.sfx('slam', e.x, e.z);
        g.shake(0.8);
        g.fx.burst(P.puff, e.x, e.y + 0.2, e.z, 18, 4);
        g.fx.burst(P.seaBubble, e.x, e.y + 0.3, e.z, 30, 4, 2);
        if (Math.hypot(p.x - e.jumpTo.x, p.z - e.jumpTo.z) < T.slamR + p.r && Math.abs(p.y - e.y) < 1.6) g.enemyHitsPlayer(e, 1, { kb: 11, unblockable: true });
        h.wave(e.x, e.y, e.z);
        // (Enraged, a second wave a second later: time to land from the first jump and jump again.)
        if (e.enraged) h.wave(e.x, e.y, e.z, 1.0);
        g.chandelierShake();
      }
      break;
    }
    case 'slam':
      if (e.t > 0.7) {
        go(e, 'recover');
        e.cooldown = 1.4 / sp;
      }
      break;
    case 'summon':
      e.telegraph = 1;
      if (e.t > 0.9) {
        g.bossSummon(e);
        go(e, 'recover');
        e.cooldown = 1.6;
      }
      break;
    case 'recover':
      if (e.t > 0.7) go(e, 'chase');
      break;
    case 'stun':
      if (e.t > 1.7) {
        go(e, 'chase');
        e.cooldown = 0.6;
      }
      break;
    default:
      go(e, 'chase');
  }
}

/** Is a wall right before him (the charge's end at the hall's edge)? */
function wallAhead(e: Enemy) {
  const x = e.x + e.fx * (e.r + 0.5), z = e.z + e.fz * (e.r + 0.5);
  return x < HALL.x0 || x > HALL.x1 || z < HALL.z0 || z > HALL.z1;
}
