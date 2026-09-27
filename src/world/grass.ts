import * as THREE from 'three';
import { grassMaterial } from '../engine/materials';
import { fbm, hexToLinear, mulberry32 } from '../engine/util';
import { Grid, T } from './grid';

function tuftGeometry() {
  const pos: number[] = [], col: number[] = [], nrm: number[] = [];
  const base = [0.72, 0.78, 0.68], tip = [1.2, 1.25, 1.05];
  const blades = 4;
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI + (i % 2) * 0.3;
    const c = Math.cos(a), s = Math.sin(a);
    const w = 0.05, h = 0.26 + (i % 3) * 0.08;
    const lean = (i - 1.5) * 0.06;
    const bx = (i - 1.5) * 0.07, bz = ((i * 7) % 3 - 1) * 0.06;
    pos.push(bx - c * w, 0, bz - s * w, bx + c * w, 0, bz + s * w, bx + lean * c, h, bz + lean * s);
    col.push(...base, ...base, ...tip);
    nrm.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return g;
}

/**
 * Scatter tufts over grassy cells. density(x, z) returns tufts per cell and
 * scale(x, z) their size, so meadows can be lush and lawns short.
 */
export function buildGrass(grid: Grid, density: (x: number, z: number) => number, scale: (x: number, z: number) => number) {
  const group = new THREE.Group();
  group.name = 'grass';
  const geo = tuftGeometry();
  const mat = grassMaterial();
  const rng = mulberry32(77);
  const green = hexToLinear('#4f7a3c'), dark = hexToLinear('#3d6334'), dry = hexToLinear('#7a7a44');
  const CH = 16;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const zEnd = grid.oz + grid.d, xEnd = grid.ox + grid.w;
  for (let cz0 = grid.oz; cz0 < zEnd; cz0 += CH)
    for (let cx0 = grid.ox; cx0 < xEnd; cx0 += CH) {
      const items: { x: number; y: number; z: number; sc: number; col: [number, number, number] }[] = [];
      for (let z = cz0; z < Math.min(zEnd, cz0 + CH); z++)
        for (let x = cx0; x < Math.min(xEnd, cx0 + CH); x++) {
          const i = grid.i(x, z);
          const t = grid.t[i];
          if (t !== T.Grass && t !== T.DarkGrass && t !== T.Moss) continue;
          if (grid.noGrass[i] || grid.dir[i] >= 0 || grid.water[i] > -100) continue;
          const n = density(x + 0.5, z + 0.5);
          const count = Math.floor(n) + (rng() < n - Math.floor(n) ? 1 : 0);
          for (let k = 0; k < count; k++) {
            const px = x + rng(), pz = z + rng();
            const sc = scale(px, pz) * (0.7 + rng() * 0.6);
            if (sc <= 0.05) continue;
            const d = fbm(px * 0.08, pz * 0.08, 2, 5);
            const drying = Math.max(0, fbm(px * 0.05 + 10, pz * 0.05 - 4, 2, 3) - 0.5) * 1.6;
            const b = t === T.DarkGrass ? dark : green;
            const k2 = 0.8 + d * 0.35;
            const col: [number, number, number] = [
              (b[0] + (dry[0] - b[0]) * drying) * k2,
              (b[1] + (dry[1] - b[1]) * drying) * k2,
              (b[2] + (dry[2] - b[2]) * drying) * k2,
            ];
            items.push({ x: px, y: grid.h[i], z: pz, sc, col });
          }
        }
      if (!items.length) continue;
      const mesh = new THREE.InstancedMesh(geo, mat, items.length);
      items.forEach((it, idx) => {
        q.setFromAxisAngle(up, rng() * Math.PI * 2);
        s.set(it.sc, it.sc * (0.8 + rng() * 0.5), it.sc);
        p.set(it.x, it.y - 0.02, it.z);
        m.compose(p, q, s);
        mesh.setMatrixAt(idx, m);
        mesh.setColorAt(idx, new THREE.Color(it.col[0], it.col[1], it.col[2]));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  return group;
}
