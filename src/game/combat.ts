import * as THREE from 'three';
import { Geo } from '../engine/geo';
import { worldMaterial } from '../engine/materials';
import { SpriteActor } from '../engine/sprites';
import { P } from '../engine/particles';
import { coinFrame, HEART_FRAME } from './assets';
import type { Game } from './game';
import type { Enemy } from './enemies';
import type { PowerKind } from './player';
import type { LightSource } from '../engine/lights';
import { FOES } from '../config';

// ---------- arrows ----------

let arrowGeo: THREE.BufferGeometry | null = null;
function arrowGeometry() {
  if (arrowGeo) return arrowGeo;
  const g = new Geo();
  g.box(0, -0.025, 0, 0.62, 0.05, 0.05, '#8a6a48');
  g.box(0.33, -0.04, 0, 0.1, 0.08, 0.08, '#b0b0c0');
  g.box(-0.28, -0.05, 0, 0.12, 0.1, 0.02, '#d8d0c0');
  arrowGeo = g.build();
  return arrowGeo;
}

export interface Arrow {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t: number;
  stuck: number;
  dead: boolean;
  from: Enemy | null;
  kind: 'arrow' | 'dart';
}

export interface Pot {
  mesh: THREE.Mesh;
  ring: THREE.Mesh | null;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t: number;
  T: number;
  tx: number;
  tz: number;
}

export interface Fire {
  x: number;
  y: number;
  z: number;
  r: number;
  t: number;
  life: number;
  light: LightSource;
  tick: number;
}

let dartGeo: THREE.BufferGeometry | null = null;
function dartGeometry() {
  if (dartGeo) return dartGeo;
  const g = new Geo();
  g.box(0, -0.015, 0, 0.3, 0.03, 0.03, '#c8c0a0');
  g.box(-0.14, -0.03, 0, 0.06, 0.06, 0.06, '#6a9a3a');
  dartGeo = g.build();
  return dartGeo;
}

export interface Wave {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  r: number;
  max: number;
  speed: number;
  hit: boolean;
}

export interface Pickup {
  kind: 'coin' | 'heart';
  sprite: SpriteActor;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t: number;
  value: number;
  dead: boolean;
  /** Already paid (a chest's coins): flies straight to the knight, worth nothing on arrival. */
  home?: boolean;
}

export interface SwordWave {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  dx: number;
  dz: number;
  t: number;
  dmg: number;
  hit: Set<object>;
}

export interface PowerOrb {
  mesh: THREE.Mesh;
  kind: PowerKind;
  x: number;
  y: number;
  z: number;
  t: number;
  light: LightSource;
}

const ORB_COL: Record<PowerKind, [number, number, number]> = {
  fire: [3.4, 1.4, 0.4], wind: [1.6, 2.8, 3.2], magnet: [3.2, 2.4, 0.6], bubble: [0.8, 2.2, 3.6], giant: [2.6, 1.6, 3.4],
};

export class Combat {
  pots: Pot[] = [];
  fires: Fire[] = [];
  private ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.7, 0.25), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  orbs: PowerOrb[] = [];
  swordWaves: SwordWave[] = [];
  arrows: Arrow[] = [];
  waves: Wave[] = [];
  pickups: Pickup[] = [];
  private mat = worldMaterial();
  private waveMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 1.6, 0.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  aimLines = new Map<Enemy, THREE.Mesh>();
  private aimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.3, 0.2), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  private aimSeen = new Set<Enemy>();

  constructor(private g: Game) {}

  /** An arrow from a fixed point (arrow slits). */
  shootFrom(sx: number, sy: number, sz: number, tx: number, ty: number, tz: number) {
    const dx = tx - sx, dy = ty - sy, dz = tz - sz;
    const d = Math.hypot(dx, dz) || 1;
    const speed = 14;
    const t = d / speed;
    const mesh = new THREE.Mesh(arrowGeometry(), this.mat);
    mesh.castShadow = true;
    this.g.scene.add(mesh);
    this.arrows.push({ mesh, x: sx, y: sy, z: sz, vx: (dx / d) * speed, vy: dy / t + 0.5 * 6 * t, vz: (dz / d) * speed, t: 0, stuck: 0, dead: false, from: null, kind: 'arrow' });
    this.g.audio.sfx('bow', sx, sz);
  }

  shoot(from: Enemy, tx: number, ty: number, tz: number) {
    const sx = from.x + from.fx * 0.4, sy = from.y + 0.9, sz = from.z + from.fz * 0.4;
    const dx = tx - sx, dy = ty - sy, dz = tz - sz;
    const d = Math.hypot(dx, dz) || 1;
    const speed = 12.5;
    const t = d / speed;
    const mesh = new THREE.Mesh(arrowGeometry(), this.mat);
    mesh.castShadow = true;
    this.g.scene.add(mesh);
    this.arrows.push({ mesh, x: sx, y: sy, z: sz, vx: (dx / d) * speed, vy: dy / t + 0.5 * 6 * t, vz: (dz / d) * speed, t: 0, stuck: 0, dead: false, from, kind: 'arrow' });
    this.g.audio.sfx('bow', sx, sz);
  }

  wave(x: number, y: number, z: number, max: number, speed = 7.5) {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), this.waveMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y + 0.08, z);
    this.g.scene.add(mesh);
    this.waves.push({ mesh, x, y, z, r: 0.4, max, speed, hit: false });
  }

  coins(x: number, y: number, z: number, total: number, paid = false) {
    let left = total;
    while (left > 0) {
      const v = left >= 25 ? 5 : 1;
      left -= v;
      const k = this.spawnPickup('coin', x, y, z, paid ? 0 : v);
      k.home = paid;
    }
  }

  spawnPickup(kind: 'coin' | 'heart', x: number, y: number, z: number, value = 1) {
    const sprite = new SpriteActor(this.g.assets.pickups, { glow: 0.9, shadowSize: 0.25, shared: true });
    sprite.mesh.castShadow = false;
    sprite.addTo(this.g.scene);
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 2.2;
    const k: Pickup = { kind, sprite, x, y: y + 0.4, z, vx: Math.cos(a) * s, vy: 4 + Math.random() * 3, vz: Math.sin(a) * s, t: 0, value, dead: false };
    this.pickups.push(k);
    return k;
  }

  /** The sword wave special: a crescent that flies forward and cuts through foes. */
  swordWave(x: number, y: number, z: number, dx: number, dz: number, dmg: number) {
    const geo = new THREE.RingGeometry(0.7, 1.05, 16, 1, -1.1, 2.2);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 2.2, 3.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.set(-Math.PI / 2, 0, Math.atan2(-dz, dx), 'YXZ');
    mesh.rotation.order = 'XYZ';
    mesh.rotation.set(-Math.PI / 2, 0, Math.atan2(-dz, dx));
    this.g.scene.add(mesh);
    this.swordWaves.push({ mesh, x, y, z, dx, dz, t: 0, dmg, hit: new Set() });
  }

  /** A floating power-up orb. Random kind unless given. */
  powerOrb(x: number, y: number, z: number, kind?: PowerKind) {
    const kinds: PowerKind[] = ['fire', 'wind', 'magnet', 'bubble', 'giant'];
    const k = kind ?? kinds[Math.floor(Math.random() * kinds.length)];
    const c = ORB_COL[k];
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0], c[1], c[2]) }));
    this.g.scene.add(mesh);
    const light = this.g.lights.add(x, y + 0.5, z, new THREE.Color(c[0] / 4, c[1] / 4, c[2] / 4).getHex(), 4, 4, 0.2);
    this.orbs.push({ mesh, kind: k, x, y, z, t: 0, light });
  }

  /** A poison dart from a blowpipe: fast and flat. */
  shootDart(from: Enemy, tx: number, ty: number, tz: number) {
    const sx = from.x + from.fx * 0.5, sy = from.y + 1.0, sz = from.z + from.fz * 0.5;
    const dx = tx - sx, dy = ty - sy, dz = tz - sz;
    const d = Math.hypot(dx, dz) || 1;
    const speed = 17;
    const t = d / speed;
    const mesh = new THREE.Mesh(dartGeometry(), this.mat);
    this.g.scene.add(mesh);
    this.arrows.push({ mesh, x: sx, y: sy, z: sz, vx: (dx / d) * speed, vy: dy / t + 0.5 * 6 * t, vz: (dz / d) * speed, t: 0, stuck: 0, dead: false, from, kind: 'dart' });
    this.g.audio.sfx('blowpipe', sx, sz);
  }

  /** A pulsing ring on the ground where something is about to land. */
  markTarget(x: number, z: number) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.3, 32), this.ringMat.clone());
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, this.g.grid.groundAt(x, z) + 0.06, z);
    ring.renderOrder = 5;
    this.g.scene.add(ring);
    return ring;
  }

  clearMark(ring: THREE.Mesh) {
    this.g.scene.remove(ring);
    ring.geometry.dispose();
    (ring.material as THREE.Material).dispose();
  }

  /** Lob a firepot in an arc onto a spot. */
  throwPot(from: Enemy, tx: number, tz: number, ring: THREE.Mesh | null) {
    const sx = from.x + from.fx * 0.4, sy = from.y + 1.4, sz = from.z + from.fz * 0.4;
    const ty = this.g.grid.groundAt(tx, tz);
    const T = 0.85, G = 18;
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshLambertMaterial({ color: 0x8a5a3a, emissive: new THREE.Color(0.4, 0.15, 0.02) }));
    mesh.castShadow = true;
    this.g.scene.add(mesh);
    this.pots.push({ mesh, ring: ring ?? this.markTarget(tx, tz), x: sx, y: sy, z: sz, vx: (tx - sx) / T, vy: (ty - sy) / T + 0.5 * G * T, vz: (tz - sz) / T, t: 0, T, tx, tz });
    this.g.audio.sfx('throw', sx, sz);
  }

  /** Burning ground: sets the knight alight, scorches foes standing in it. */
  fire(x: number, z: number) {
    const y = this.g.grid.groundAt(x, z);
    // Water puts it straight out.
    if (this.g.grid.waterAt(x, z) > y - 0.1) {
      this.g.fx.burst(P.puff, x, y + 0.3, z, 10, 2);
      this.g.audio.sfx('extinguish', x, z);
      return;
    }
    const light = this.g.lights.add(x, y + 0.8, z, 0xff7a30, 10, 6, 0.4);
    this.fires.push({ x, y, z, r: FOES.bomber.fireRadius, t: 0, life: FOES.bomber.fireTime, light, tick: 0 });
    this.g.fx.burst(P.flame, x, y + 0.3, z, 30, 3, 2);
    this.g.audio.sfx('potBreak', x, z);
  }

  /** Knock arrows out of the air around a point. */
  deflectArrows(x: number, z: number, r: number) {
    for (const a of this.arrows) {
      if (a.dead || a.stuck > 0) continue;
      if (Math.hypot(a.x - x, a.z - z) < r) {
        a.dead = true;
        this.g.fx.burst(P.bluespark, a.x, a.y, a.z, 6, 3, 1);
        this.g.audio.sfx('parry', a.x, a.z);
      }
    }
  }

  aim(e: Enemy) {
    this.aimSeen.add(e);
    let m = this.aimLines.get(e);
    if (!m) {
      m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.06), this.aimMat);
      m.rotation.order = 'YXZ';
      this.g.scene.add(m);
      this.aimLines.set(e, m);
    }
    const p = this.g.player;
    const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz);
    m.visible = true;
    m.scale.x = d;
    m.position.set((p.x + e.x) / 2, Math.max(p.y, e.y) + 0.06, (p.z + e.z) / 2);
    m.rotation.set(-Math.PI / 2, -Math.atan2(dz, dx), 0, 'YXZ');
    m.rotation.x = -Math.PI / 2;
    (m.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.25 * Math.sin(this.g.time * 30);
  }

  update(dt: number) {
    const g = this.g, p = g.player, grid = g.grid;
    for (const pot of this.pots) {
      pot.t += dt;
      pot.vy -= 18 * dt;
      pot.x += pot.vx * dt;
      pot.y += pot.vy * dt;
      pot.z += pot.vz * dt;
      pot.mesh.position.set(pot.x, pot.y, pot.z);
      pot.mesh.rotation.x += dt * 9;
      if (pot.ring) (pot.ring.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.4 * Math.sin(g.time * 18);
      if (Math.random() < 0.6) g.fx.emit(P.ember, pot.x, pot.y, pot.z, 0, 0.3, 0, 0.3);
      if (pot.t >= pot.T || (pot.t > 0.2 && pot.y <= grid.groundAt(pot.x, pot.z))) {
        pot.t = -1;
        this.fire(pot.tx, pot.tz);
      }
    }
    this.pots = this.pots.filter((pot) => {
      if (pot.t >= 0) return true;
      g.scene.remove(pot.mesh);
      pot.mesh.geometry.dispose();
      (pot.mesh.material as THREE.Material).dispose();
      if (pot.ring) this.clearMark(pot.ring);
      return false;
    });
    for (const f of this.fires) {
      f.t += dt;
      const fade = Math.min(1, (f.life - f.t) / 0.6);
      f.light.level = Math.max(0, fade);
      for (let k = 0; k < 3; k++)
        if (Math.random() < dt * 30 * fade) {
          const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * f.r;
          g.fx.emit(P.flame, f.x + Math.cos(a) * r, f.y + 0.1, f.z + Math.sin(a) * r, 0, 0.8, 0, 0.8);
        }
      if (Math.random() < dt * 3) g.fx.emit(P.smoke, f.x, f.y + 1, f.z, 0, 0.5, 0);
      // The knight catches fire standing in it.
      if (p.alive && p.onGround && Math.hypot(p.x - f.x, p.z - f.z) < f.r && Math.abs(p.y - f.y) < 0.8 && fade > 0.3) p.afflict('burn', g);
      // Foes scorch too (the throwers know better than to stand in it).
      f.tick -= dt;
      if (f.tick <= 0) {
        f.tick = 1;
        for (const e of g.enemies)
          if (e.alive && !e.flying && e.type !== 'bomber' && e.type !== 'king' && Math.hypot(e.x - f.x, e.z - f.z) < f.r + e.r * 0.5) e.scorch(1, g);
      }
    }
    this.fires = this.fires.filter((f) => {
      if (f.t < f.life) return true;
      this.g.lights.remove(f.light);
      return false;
    });
    for (const o of this.orbs) {
      o.t += dt;
      const gy = grid.groundAt(o.x, o.z) + 0.7;
      o.y += (gy - o.y) * Math.min(1, dt * 4);
      const by = o.y + Math.sin(o.t * 3) * 0.12;
      o.mesh.position.set(o.x, by, o.z);
      o.mesh.rotation.y += dt * 2;
      o.mesh.rotation.x += dt * 1.3;
      o.light.x = o.x;
      o.light.y = by + 0.3;
      o.light.z = o.z;
      if (Math.random() < dt * 10) g.fx.emit(P.mote, o.x + (Math.random() - 0.5) * 0.4, by, o.z + (Math.random() - 0.5) * 0.4, 0, 0.8, 0, 0.5);
      if (o.t > 0.4 && p.alive && Math.hypot(p.x - o.x, p.z - o.z) < 0.8 && Math.abs(p.y + 0.8 - by) < 1.5) {
        o.t = -1;
        g.takePower(o.kind, o.x, by, o.z);
      }
    }
    this.orbs = this.orbs.filter((o) => {
      if (o.t >= 0) return true;
      g.scene.remove(o.mesh);
      o.mesh.geometry.dispose();
      (o.mesh.material as THREE.Material).dispose();
      this.g.lights.remove(o.light);
      return false;
    });
    for (const w of this.swordWaves) {
      w.t += dt;
      w.x += w.dx * 12 * dt;
      w.z += w.dz * 12 * dt;
      w.mesh.position.set(w.x, w.y, w.z);
      (w.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - w.t / 0.9);
      for (const e of g.enemies) {
        if (!e.alive || w.hit.has(e) || Math.hypot(e.x - w.x, e.z - w.z) > 1.1 + e.r || Math.abs(e.y + (e.flying ? -1 : 0) - (w.y - 1)) > 1.6) continue;
        w.hit.add(e);
        if (e.takeHit(w.dmg, w.dx, w.dz, 6, false, g) !== 'blocked') {
          g.landed(e, false);
          p.energy = Math.min(100, p.energy + 4);
        }
      }
      for (const b of g.breakables) if (!b.broken && Math.hypot(b.x - w.x, b.z - w.z) < 1) g.breakObject(b, w.dx, w.dz);
      this.deflectArrows(w.x, w.z, 1.1);
      if (Math.random() < 0.8) g.fx.emit(P.bluespark, w.x + (Math.random() - 0.5), w.y, w.z + (Math.random() - 0.5), 0, 0.5, 0, 0.3);
      // Walls stop it.
      if (!g.grid.lineClear(w.x - w.dx * 0.3, w.z - w.dz * 0.3, w.x + w.dx * 0.3, w.z + w.dz * 0.3, w.y - 1)) w.t = 99;
    }
    this.swordWaves = this.swordWaves.filter((w) => {
      const done = w.t > 0.9;
      if (done) {
        g.scene.remove(w.mesh);
        w.mesh.geometry.dispose();
        (w.mesh.material as THREE.Material).dispose();
      }
      return !done;
    });
    for (const [e, m] of this.aimLines) {
      if (e.removed || !e.alive) {
        g.scene.remove(m);
        m.geometry.dispose();
        this.aimLines.delete(e);
      } else if (!this.aimSeen.has(e)) m.visible = false;
    }
    this.aimSeen.clear();

    for (const a of this.arrows) {
      a.t += dt;
      if (a.stuck > 0) {
        a.stuck -= dt;
        if (a.stuck <= 0) a.dead = true;
        continue;
      }
      a.vy -= 6 * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.z += a.vz * dt;
      a.mesh.position.set(a.x, a.y, a.z);
      a.mesh.rotation.set(0, -Math.atan2(a.vz, a.vx), Math.atan2(a.vy, Math.hypot(a.vx, a.vz)), 'YZX');
      // Player.
      if (p.alive && Math.hypot(p.x - a.x, p.z - a.z) < 0.45 && a.y > p.y && a.y < p.y + 1.7) {
        const res = a.kind === 'dart' ? g.dartHitsPlayer(a) : g.arrowHitsPlayer(a);
        if (res !== 'dodged' && res !== 'ignored') {
          a.dead = true;
          if (res === 'blocked' || res === 'parried') {
            g.fx.burst(P.spark, a.x, a.y, a.z, 8, 3, 2);
          }
          continue;
        }
      }
      // World.
      const gy = grid.groundAt(a.x, a.z);
      let hit = a.y <= gy;
      if (!hit) {
        const cx = Math.floor(a.x), cz = Math.floor(a.z);
        if (!grid.inside(cx, cz) || grid.solid[grid.i(cx, cz)]) hit = true;
        else
          for (const c of grid.collidersNear(a.x, a.z)) {
            if (!c.on || a.y > c.y1 || a.y < c.y0) continue;
            if (c.kind === 'b' ? a.x > c.x0 && a.x < c.x1 && a.z > c.z0 && a.z < c.z1 : (a.x - c.x) ** 2 + (a.z - c.z) ** 2 < c.r * c.r) hit = true;
          }
      }
      if (hit || a.t > 3) {
        a.stuck = 2.5;
        g.audio.sfx('arrowThunk', a.x, a.z);
      }
    }
    this.arrows = this.arrows.filter((a) => {
      if (a.dead) g.scene.remove(a.mesh);
      return !a.dead;
    });

    for (const w of this.waves) {
      w.r += w.speed * dt;
      w.mesh.scale.set(w.r, w.r, 1);
      (w.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - w.r / w.max);
      if (!w.hit && p.alive && Math.abs(p.y - w.y) < 0.8) {
        const d = Math.hypot(p.x - w.x, p.z - w.z);
        if (Math.abs(d - w.r) < 0.45) {
          w.hit = true;
          g.waveHitsPlayer(w);
        }
      }
      if (Math.random() < 0.8) {
        const a = Math.random() * Math.PI * 2;
        g.fx.emit(P.ember, w.x + Math.cos(a) * w.r, w.y + 0.1, w.z + Math.sin(a) * w.r, 0, 1, 0, 0.3);
      }
    }
    this.waves = this.waves.filter((w) => {
      const done = w.r >= w.max;
      if (done) {
        g.scene.remove(w.mesh);
        w.mesh.geometry.dispose();
      }
      return !done;
    });

    for (const k of this.pickups) {
      k.t += dt;
      const dx = p.x - k.x, dz = p.z - k.z, dy = p.y + 0.5 - k.y;
      const d = Math.hypot(dx, dz);
      const wanted = k.kind === 'coin' || p.hp < p.maxHp;
      const magnet = wanted && k.t > 0.55 && p.alive && (k.home || d < (k.kind === 'coin' ? (p.powerOn('magnet') ? 10 : 3.2) : 2));
      if (magnet) {
        const s = 12 * Math.min(1, (k.t - 0.55) * 2);
        k.x += (dx / (d || 1)) * s * dt;
        k.z += (dz / (d || 1)) * s * dt;
        k.y += dy * Math.min(1, dt * 8);
        if (d < 0.35) {
          k.dead = true;
          g.collect(k);
        }
      } else {
        k.vy -= 18 * dt;
        k.x += k.vx * dt;
        k.z += k.vz * dt;
        k.y += k.vy * dt;
        const gy = grid.groundAt(k.x, k.z);
        if (k.y < gy) {
          k.y = gy;
          k.vy = Math.abs(k.vy) > 2 ? -k.vy * 0.4 : 0;
          k.vx *= 0.6;
          k.vz *= 0.6;
        }
      }
      const f = k.kind === 'coin' ? coinFrame(Math.floor(g.time * 10 + k.x * 3)) : HEART_FRAME;
      k.sprite.setFrame(f, false);
      k.sprite.place(g.cam, k.x, k.y + (k.vy === 0 ? Math.sin(g.time * 4 + k.x) * 0.06 : 0), k.z, grid.groundAt(k.x, k.z));
      if (k.kind === 'coin' && Math.random() < 0.02) g.fx.emit(P.coinGlint, k.x, k.y + 0.2, k.z, 0, 0.5, 0);
      if (k.t > 40) k.dead = true;
    }
    this.pickups = this.pickups.filter((k) => {
      if (k.dead) k.sprite.dispose(g.scene);
      return !k.dead;
    });
  }
}
