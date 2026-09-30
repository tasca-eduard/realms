// Nothing in the world can blacken the screen: no mesh has a face with no normal (a face with no
// area) or a corner that isn't a number. Lighting a missing normal makes a NaN, and the bloom
// smears one NaN pixel into a black square (it happened at the foot of Whisperwood's stair).
const g = window.__game, out = { meshes: 0, vertices: 0, bad: 0, at: [] };
g.scene.traverse((o) => {
  if (!o.isMesh || !o.geometry) return;
  out.meshes++;
  const pos = o.geometry.getAttribute('position'), nrm = o.geometry.getAttribute('normal');
  if (!pos) return;
  out.vertices += pos.count;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = nrm ? nrm.getX(i) : 1, ny = nrm ? nrm.getY(i) : 0, nz = nrm ? nrm.getZ(i) : 0;
    if (![x, y, z, nx, ny, nz].every(Number.isFinite) || nx * nx + ny * ny + nz * nz < 1e-6) {
      out.bad++;
      if (out.at.length < 6) out.at.push([+x.toFixed(1), +y.toFixed(1), +z.toFixed(1)]);
    }
  }
});
window.__report = () => out;
