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
}

/**
 * A fixed number of point lights (so shaders never recompile) assigned each
 * frame to the light sources closest to the camera focus.
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
    };
    this.sources.push(s);
    return s;
  }

  update(time: number, fx: number, fz: number) {
    const arr = this.scratch;
    arr.length = 0;
    for (const s of this.sources) {
      if (!s.on && s.level <= 0.001) continue;
      const dx = s.x - fx, dz = s.z - fz;
      const d = dx * dx + dz * dz;
      if (d > 60 * 60) continue;
      arr.push({ s, d: d - s.range * s.range * 0.5 });
    }
    arr.sort((a, b) => a.d - b.d);
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i];
      const e = arr[i];
      if (!e) {
        l.intensity = 0;
        continue;
      }
      const s = e.s;
      const f = s.flicker;
      const fl = 1 - f + f * (0.6 * Math.sin(time * 8.3 + s.seed) * 0.5 + 0.5 + 0.4 * (Math.sin(time * 21.7 + s.seed * 3) * 0.5 + 0.5));
      // Fade the furthest assigned lights so swapping is not visible.
      const edge = i >= this.lights.length - 3 ? 0.5 : 1;
      l.position.set(s.x + Math.sin(time * 5 + s.seed) * f * 0.06, s.y, s.z + Math.cos(time * 4.3 + s.seed) * f * 0.06);
      l.color.copy(s.color);
      l.intensity = s.intensity * fl * s.level * edge;
      l.distance = s.range;
    }
  }
}
