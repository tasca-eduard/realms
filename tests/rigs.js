// Merged (skinned) characters: every rig is built, the knight's see-through silhouette
// is on, a broken shield disappears, and removed foes free their bone textures.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  g.godMode = true;
  await wait(800);
  const rigs = [p.model.rig, g.horse.model.rig, ...g.enemies.map((e) => e.model.rig), ...g.npcs.map((n) => n.model?.rig), ...g.critters.map((c) => c.model.rig)].filter(Boolean);
  out.rigs = { count: rigs.length, unbuilt: rigs.filter((r) => !r.skeleton || !r.meshes.length).length };
  out.knightSilhouette = p.model.rig.silMeshes.map((s) => s.visible);
  // A shield goblin facing the knight takes a finisher: the shield (its hand joint) vanishes.
  const sh = g.enemies.find((e) => e.alive && e.type === 'shield');
  sh.x = p.x + 1.2; sh.z = p.z; sh.fx = -1; sh.fz = 0; sh.state = 'chase';
  const res = sh.takeHit(1, 1, 0, 0, true, g);
  out.shield = { result: res, up: sh.shieldUp, handScale: +sh.model.rig.j('handL').scale.x.toFixed(4) };
  // Foes near the camera have bone textures; removing them frees those.
  await wait(400);
  const info = g.pipe.renderer.info.memory;
  const near = g.enemies.filter((e) => e.alive && e !== sh && e.model.rig.skeleton.boneTexture).slice(0, 5);
  const tex0 = info.textures;
  for (const e of near) e.despawn(g);
  await wait(1500);
  out.boneTextures = { removedFoes: near.length, freed: tex0 - info.textures };
})();
window.__report = () => out;
