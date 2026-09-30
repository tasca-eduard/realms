import * as THREE from 'three';

export interface LightSource {
  x: number;
  y: number;
  z: number;
  color: THREE.Color;
  intensity: number;
  range: number;
  flicker: number;
  on: boolean;
  /** 0..1 fade used when lighting / extinguishing. */
  level: number;
  seed: number;
  /** 0..1: how much of a pool light it has (eases in and out as it joins or leaves the nearest few). */
  vis: number;
  /** What it actually shows this frame: its vis if it holds a pool light, else 0. */
  shown: number;
}

/**
 * A fixed number of point lights (so shaders never recompile) given each frame to the light
 * sources nearest the camera focus. A source joining or leaving that set fades in or out (never
 * pops), and one already lit keeps its place unless another is clearly nearer, so moving the
 * camera doesn't make lamps blink.
 */
export class LightPool {
  lights: THREE.PointLight[] = [];
  sources: LightSource[] = [];
  group = new THREE.Group();
  private scratch: { s: LightSource; d: number }[] = [];

  constructor(count = 14) {
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 8, 1.6);
      l.castShadow = false;
      this.lights.push(l);
      this.group.add(l);
    }
  }

  add(x: number, y: number, z: number, color: THREE.ColorRepresentation, intensity: number, range: number, flicker = 0.15) {
    const s: LightSource = {
      x, y, z,
      color: new THREE.Color(color),
      intensity,
      range,
      flicker,
      on: true,
      level: 1,
      seed: Math.random() * 100,
      vis: 0,
      shown: 0,
    };
    this.sources.push(s);
    return s;
  }

  /** Forget a light for good (fires burning out, pickups taken). */
  remove(s: LightSource) {
    const i = this.sources.indexOf(s);
    if (i >= 0) this.sources.splice(i, 1);
  }

  update(time: number, fx: number, fz: number, dt = 1 / 60) {
    const arr = this.scratch;
    arr.length = 0;
    for (const s of this.sources) {
      const dx = s.x - fx, dz = s.z - fz;
      const d = Math.sqrt(dx * dx + dz * dz) - s.range * 0.35;
      if ((!s.on && s.level <= 0.001) || d > 60) {
        s.vis = s.shown = 0;
        continue;
      }
      // One already lit keeps its place unless another is clearly (3 m) nearer.
      arr.push({ s, d: s.vis > 0.5 ? d - 3 : d });
    }
    arr.sort((a, b) => a.d - b.d);
    // The nearest few are wanted; the pool's last three slots are for those fading out. One still
    // dark only starts to light when a light is free: nothing already lit is ever cut off (a pop).
    const want = this.lights.length - 3, ease = Math.min(1, dt * 3.5);
    let lit = 0;
    for (const e of arr) if (e.s.vis >= 0.005) lit++;
    for (let i = 0; i < arr.length; i++) {
      const s = arr[i].s, target = i < want ? 1 : 0;
      if (target && s.vis < 0.005) {
        if (lit >= this.lights.length) continue;
        lit++;
      }
      s.vis += (target - s.vis) * ease;
      s.shown = 0;
    }
    arr.sort((a, b) => b.s.vis - a.s.vis);
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i];
      const e = arr[i];
      if (!e || e.s.vis < 0.005) {
        l.intensity = 0;
        continue;
      }
      const s = e.s;
      s.shown = s.vis;
      // A gentle, slow flicker (half what the source asks for): flames breathe, they don't strobe.
      const f = s.flicker * 0.5;
      const fl = 1 - f + f * (0.6 * (Math.sin(time * 5.1 + s.seed) * 0.5 + 0.5) + 0.4 * (Math.sin(time * 11.3 + s.seed * 3) * 0.5 + 0.5));
      l.position.set(s.x + Math.sin(time * 3.1 + s.seed) * f * 0.05, s.y, s.z + Math.cos(time * 2.7 + s.seed) * f * 0.05);
      l.color.copy(s.color);
      l.intensity = s.intensity * fl * s.level * s.vis;
      l.distance = s.range;
    }
  }
}
