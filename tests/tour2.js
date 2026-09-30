// Whisperwood's tour (run with &realm=forest): fps, draw calls and triangles at each area.
const g = window.__game;
g.godMode = true;
const stops = [[111.5, 109.5], [80, 102], [66, 86], [56, 68], [48, 82], [98, 64], [108, 78], [106, 45], [93, 30], [80, 44], [46, 43], [70, 14], [41.5, 15.8], [26, 18.5], [22, 66], [22, 86], [18, 104], [8, 50]];
const out = [];
let i = 0, frames = 0, t0 = 0;
const tick = () => { frames++; requestAnimationFrame(tick); };
requestAnimationFrame(tick);
const next = () => {
  if (i > 0) {
    const r = g.pipe.renderer;
    r.info.autoReset = false;
    r.info.reset();
    g.pipe.render(g.scene, g.cam.cam);
    r.info.autoReset = true;
    out.push([stops[i - 1].join(','), Math.round(frames / ((performance.now() - t0) / 1000)), r.info.render.calls, Math.round(r.info.render.triangles / 1000) + 'k']);
  }
  if (i >= stops.length) return;
  const [x, z] = stops[i++];
  g.player.place(x, z, g);
  g.cam.focus.set(x, g.player.y, z);
  setTimeout(() => { frames = 0; t0 = performance.now(); setTimeout(next, 1200); }, 400);
};
next();
window.__report = () => ({ stops: out, geos: g.pipe.renderer.info.memory.geometries, tex: g.pipe.renderer.info.memory.textures, lights: g.lights.sources.length });
