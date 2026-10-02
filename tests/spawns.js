// Every foe, villager and animal starts somewhere sensible: not inside a tent, wall or
// rock, not in deep water (divers walk in it and the sea's creatures live in it: not out of
// it), not standing in a campfire. Bats fly and owls perch, so only
// fires count for them; captives start in their cages, the owl on its snag and the smith at
// his forge on purpose.
const g = window.__game, grid = g.grid;
// Fires on the ground (campfires, cooking fires), not torches or braziers up on stands.
const fires = g.fx.emitters.filter((e) => e.spec?.color?.[0] === 4.5 && e.spec.gravity === -2.2 && e.y - grid.groundAt(e.x, e.z) < 0.5 && e.spread >= 0.3).map((e) => [e.x, e.z]);
const bad = [];
const what = (c) => (c.kind === 'c' ? `post r${c.r.toFixed(2)} at ${c.x.toFixed(1)},${c.z.toFixed(1)}` : `box ${c.x0.toFixed(1)}..${c.x1.toFixed(1)} x ${c.z0.toFixed(1)}..${c.z1.toFixed(1)}`);
const check = (label, x, z, r = 0.35, { air = false, fireOk = false, dives = false, aquatic = false } = {}) => {
  const y = grid.groundAt(x, z);
  const why = [];
  if (!air) {
    const b = { x, y, z, r, dives, aquatic };
    grid.resolve(b, 0.45, false);
    const pushed = Math.hypot(b.x - x, b.z - z);
    if (pushed > 0.05) {
      const hit = [];
      for (let cz = Math.floor(z - r); cz <= Math.floor(z + r); cz++)
        for (let cx = Math.floor(x - r); cx <= Math.floor(x + r); cx++)
          for (const c of grid.collidersNear(cx + 0.5, cz + 0.5)) {
            if (!c.on || y >= c.y1 - 0.05 || y + 1.6 <= c.y0) continue;
            const inside = c.kind === 'c' ? Math.hypot(x - c.x, z - c.z) < c.r + r : x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r;
            if (inside && !hit.includes(what(c))) hit.push(what(c));
          }
      why.push(`inside ${hit.join(' + ') || 'raised ground'} (pushed ${pushed.toFixed(2)})`);
    }
    const deep = grid.isDeep(Math.floor(x), Math.floor(z));
    if (deep && !dives && !aquatic) why.push('deep water');
    if (!deep && aquatic) why.push('out of the water');
  }
  const near = fires.map(([fx, fz]) => [Math.hypot(fx - x, fz - z), fx, fz]).sort((a, b) => a[0] - b[0])[0];
  if (!fireOk && near && near[0] < 1.2) why.push(`in the fire at ${near[1].toFixed(1)},${near[2].toFixed(1)} (${near[0].toFixed(2)})`);
  if (why.length) bad.push(`${label} @${x.toFixed(1)},${z.toFixed(1)}: ${why.join(', ')}`);
};
for (const e of g.enemies) check(`${e.type}${e.group ? '/' + e.group : ''}`, e.home.x, e.home.z, 0.35, { air: e.type === 'bat', dives: e.dives, aquatic: e.aquatic });
for (const n of g.npcs) check(`npc ${n.name}`, n.x, n.z, 0.35, { air: !!n.def.caged || n.def.perch !== undefined, fireOk: n.name === 'Garrow the Smith' });
for (const c of g.critters) check(`${c.def.kind}`, c.x, c.z, 0.2, { air: c.def.perch !== undefined });
if (g.horse) check('horse', g.horse.x, g.horse.z, 0.55);
window.__report = () => ({ fires: fires.length, checked: g.enemies.length + g.npcs.length + g.critters.length + 1, bad });
