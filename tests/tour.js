// Visit every area: record errors, fps and draw calls at each stop.
const g = window.__game;
g.godMode = true;
const stops = [[105.5,105],[87.5,99],[80,63],[76,54],[40,78],[33,61],[16,50],[8,58],[3,99.5],[38,113],[80,115],[121,99],[111.5,88],[93,78],[86,40],[95,27],[108,14],[118,30.5],[70,20],[56,15],[44,25],[30,33],[25,18.5],[-5,100],[70,104]];
const out = [];
let i = 0, frames = 0, t0 = 0;
const tick = () => { frames++; requestAnimationFrame(tick); };
requestAnimationFrame(tick);
const next = () => {
  if (i > 0) {
    // The pipeline renders in several passes, each resetting the counters: count one whole frame.
    const r = g.pipe.renderer;
    r.info.autoReset = false;
    r.info.reset();
    g.pipe.render(g.scene, g.cam.cam);
    r.info.autoReset = true;
    out.push([stops[i-1].join(','), Math.round(frames / ((performance.now() - t0) / 1000)), r.info.render.calls, Math.round(r.info.render.triangles / 1000) + 'k']);
  }
  if (i >= stops.length) return;
  const [x, z] = stops[i++];
  g.player.place(x, z, g);
  g.cam.focus.set(x, g.player.y, z);
  setTimeout(() => { frames = 0; t0 = performance.now(); setTimeout(next, 1200); }, 400);
};
next();
window.__report = () => ({ stops: out, geos: g.pipe.renderer.info.memory.geometries, tex: g.pipe.renderer.info.memory.textures, lights: g.lights.sources.length, enemies: g.enemies.length });
