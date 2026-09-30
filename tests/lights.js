// Lamps don't blink as the camera moves (run with &realm=forest): run the knight across Hollowbough
// (the densest lights) and track, frame by frame, the light each source actually gives (none when it
// holds no pool light). It may
// change no faster than the pool's fade (3.5 a second, easing): they fade, never pop. (Per second,
// not per frame: a slow frame takes a bigger step of the same fade.)
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const down = (c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
const up = (c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
(async () => {
  g.godMode = true;
  for (const e of g.enemies) if (e.alive) e.despawn(g);
  p.place(70, 92, g);
  g.cam.focus.set(p.x, p.y, p.z);
  await wait(1500); // let the lights settle
  const prev = new Map();
  let worst = 0, worstRate = 0, frames = 0, changes = 0, lastT = performance.now(), slowest = 0, lastGame = g.time;
  let run = true;
  const tick = () => {
    if (!run) return;
    frames++;
    // (The game's own clock: it moves by exactly the steps the lights were eased by since last time.)
    const now = performance.now(), gdt = g.time - lastGame;
    slowest = Math.max(slowest, (now - lastT) / 1000);
    lastT = now;
    lastGame = g.time;
    for (const s of g.lights.sources) {
      const v = s.shown ?? 0, last = prev.get(s);
      if (last !== undefined) {
        const d = Math.abs(v - last);
        worst = Math.max(worst, d);
        if (gdt > 1e-4) worstRate = Math.max(worstRate, d / gdt);
        if (d > 0.001) changes++;
      }
      prev.set(s, v);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  // Up-left across the village (W + A), then back (S + D).
  down('KeyW'); down('KeyA');
  await wait(3000);
  up('KeyW'); up('KeyA');
  down('KeyS'); down('KeyD');
  await wait(3000);
  up('KeyS'); up('KeyD');
  run = false;
  out.frames = frames;
  out.slowestFrame = +slowest.toFixed(3);
  out.worstJumpPerFrame = +worst.toFixed(3);
  out.worstPerSecond = +worstRate.toFixed(2);
  // (The fade itself is 3.5 a second; one frame's step read against a neighbour's length can come out
  // a little above that. A pop, a lamp losing or getting its light at once, reads tens a second.)
  out.smooth = worstRate <= 5;
  out.changes = changes;
})();
window.__report = () => out;
