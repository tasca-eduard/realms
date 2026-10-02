// The Sunken Reef's groundwork (run with &realm=aqua&god): a drowned coast. On the strand the knight moves as
// on land; walked down onto the sea floor he's under the surface and everything floats (a jump goes higher and
// hangs longer, a fall sinks no faster than 5.5 m/s, he walks at 85% of his speed: not wading), shots loosed
// down there fly slower; a diver walks into
// deep water, a land-walker stops at its edge and a sea creature can't leave it; nothing burns, no Fire Blade,
// no land beasts; the realm plays its own music, and the sea's look is on below the surface.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const key = async (code, ms = 60) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
  await wait(ms);
  window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
};
const jump = async () => {
  const y0 = p.y, t0 = performance.now();
  let top = 0, landed = 0;
  const iv = setInterval(() => {
    top = Math.max(top, p.y - y0);
    if (!landed && performance.now() - t0 > 150 && p.onGround) landed = performance.now() - t0;
  }, 10);
  await key('Space');
  await wait(1600);
  clearInterval(iv);
  return { height: +top.toFixed(2), airTime: +(landed / 1000).toFixed(2) };
};
// His speed after half a second of running (along the camera's right).
const pace = async () => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', bubbles: true }));
  await wait(500);
  const v = Math.hypot(p.vx, p.vz);
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', bubbles: true }));
  await wait(400);
  return +v.toFixed(2);
};
window.__report = () => out;
(async () => {
  for (const e of g.enemies) if (e.alive) e.despawn(g);
  await wait(500);
  out.realm = g.def.id;
  // On the strand.
  out.land = { under: p.under, jump: await jump(), pace: await pace() };
  // Down on the sea floor (the drowned plaza).
  p.place(86, 88, g);
  await wait(600);
  out.sea = { under: p.under, floor: +g.grid.groundAt(86, 88).toFixed(1), jump: await jump() };
  p.place(86, 88, g);
  await wait(300);
  out.sea.pace = await pace();
  out.sea.paceShare = +(out.sea.pace / out.land.pace).toFixed(2);
  out.shots = { below: g.shotsAt(-4), above: g.shotsAt(1) };
  // A deep spot (the diver walks in; dropped from just under the surface, he sinks slowly to the bottom).
  let deep = null;
  for (let z = 60; z < 100 && !deep; z++) for (let x = 60; x < 120 && !deep; x++) if (g.grid.isDeep(x, z) && g.grid.groundAt(x + 0.5, z + 0.5) < -5) deep = [x, z];
  const y = g.grid.groundAt(deep[0] + 0.5, deep[1] + 0.5);
  p.place(deep[0] + 0.5, deep[1] + 0.5, g);
  await wait(300);
  p.y = -1.6;
  p.vy = 0;
  let fastest = 0;
  const iv = setInterval(() => (fastest = Math.min(fastest, p.vy)), 10);
  await wait(1800);
  clearInterval(iv);
  out.sea.drop = +(-1.6 - y).toFixed(1);
  out.sea.fastestFall = +fastest.toFixed(2);
  out.deep = {
    walker: g.grid.blocks(deep[0], deep[1], { x: deep[0] + 0.5, y, z: deep[1] + 0.5, r: 0.3 }, 0.45, false),
    diver: g.grid.blocks(deep[0], deep[1], { x: deep[0] + 0.5, y, z: deep[1] + 0.5, r: 0.3, dives: true }, 0.45, false),
    creatureOnLand: g.grid.blocks(12, 12, { x: 12.5, y: g.grid.groundAt(12.5, 12.5), z: 12.5, r: 0.3, aquatic: true }, 0.45, false),
  };
  // Nothing burns; no land beasts.
  g.godMode = false;
  out.burn = p.afflict('burn', g);
  g.godMode = true;
  out.beasts = { horse: g.horse, mounts: g.mounts.length };
  // Its own music; the sea's look.
  const m = g.audio.music;
  for (let i = 0; i < 30 && !(m && m.ready); i++) await wait(200);
  out.music = { realm: m?.realm, channel: m?.main?.name ?? null };
  const at = g.pipe.atmo;
  out.look = { sea: at.sea, caustics: +at.seaCaustics.toFixed(2), rays: +at.seaRays.toFixed(2), surface: at.seaSurface };
  // (A jump's top comes out lower the slower the frames come, 1.27 m below the surface at 60 a second, 1.2 at 30:
  // so it's held against the jump on land, measured the same moment.)
  out.ok = out.realm === 'aqua' && !out.land.under && out.land.jump.height < 1.25 && out.sea.under && out.sea.jump.height > Math.max(1.15, out.land.jump.height + 0.05) && out.sea.jump.airTime > out.land.jump.airTime && Math.abs(out.sea.paceShare - 0.85) < 0.05
    && out.sea.fastestFall > -5.7 && out.shots.below < 1 && out.shots.above === 1 && out.deep.walker && !out.deep.diver && out.deep.creatureOnLand
    && out.burn === false && out.beasts.horse === null && out.beasts.mounts === 0 && /^aqua:/.test(out.music.channel ?? '') && out.look.sea === 1;
})();
