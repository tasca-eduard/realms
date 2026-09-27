const g = window.__game;
g.godMode = true;
g.player.place(86, 112.5, g);
const r = g.pipe.renderer.info;
let at10 = null;
setTimeout(() => { at10 = { lights: g.lights.sources.length, geos: r.memory.geometries, tex: r.memory.textures }; }, 10000);
window.__report = () => ({ at10, at60: { lights: g.lights.sources.length, geos: r.memory.geometries, tex: r.memory.textures, particles: g.fx.glow.life.filter((l) => l > 0).length } });
