const g = window.__game;
let frames = 0, t0 = performance.now();
const tick = () => { frames++; requestAnimationFrame(tick); };
requestAnimationFrame(tick);
window.__report = () => {
  const info = g.pipe.renderer.info;
  return { fps: Math.round(frames / ((performance.now() - t0) / 1000)), calls: info.render.calls, tris: info.render.triangles, geos: info.memory.geometries };
};
