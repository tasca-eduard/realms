const g = window.__game;
const p = g.player;
const grid = g.grid;
const log = {};
// Find a wadeable cell near the bridge.
let spot = null;
for (let r = 0; r < 20 && !spot; r++)
  for (let dz = -r; dz <= r && !spot; dz++)
    for (let dx = -r; dx <= r && !spot; dx++) {
      const x = 92 + dx, z = 84 + dz;
      if (!grid.inside(x, z)) continue;
      const i = grid.i(x, z);
      if (grid.water[i] > -100 && grid.water[i] - grid.h[i] < 0.5 && grid.water[i] - grid.h[i] > 0.1) spot = [x + 0.5, z + 0.5];
    }
log.spot = spot;
const h = g.horse;
p.place(spot[0] + 3, spot[1], g);
h.arriveAt(p.x, p.z, g);
setTimeout(() => {
  p.mount(h, g);
  p.afflict('burn', g);
  log.burningOnHorse = p.effects.burn > 0;
  p.x = spot[0]; p.z = spot[1];
}, 300);
setTimeout(() => { log.putOutInWater = p.effects.burn === 0; log.riding = !!p.riding; }, 800);
window.__report = () => log;
