// Where the Tide Serpent waits is saved (run with &realm=aqua): freed, ridden off to open sea far from its pen and
// left there, it keeps that spot as its home, in the save. Part 2 (tests/serpentspot2.js) reloads and finds it there.
const g = window.__game, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
window.__report = () => out;
(async () => {
  localStorage.removeItem('realms-save');
  const pen = g.story.serpent;
  pen.struck(g, () => true);
  await wait(300);
  const s = pen.serpent;
  out.freed = !!s;
  // Open sea 30 to 40 m from the pen, deep enough to float in (the realm is 140 by 110).
  let spot = null;
  for (let x = 4; x < 136 && !spot; x += 3)
    for (let z = 4; z < 106 && !spot; z += 3)
      if (g.grid.groundAt(x, z) < -2.5 && Math.abs(Math.hypot(x - s.x, z - s.z) - 35) < 5) spot = { x: x + 0.5, z: z + 0.5 };
  out.spot = spot;
  // Ridden there and got off: the next frame takes the spot as its home.
  s.x = spot.x;
  s.z = spot.z;
  s.ridden = true;
  await wait(400);
  out.saved = g.save.data.spots.serpent;
  g.writeSave();
  sessionStorage.setItem('test-serpentspot', JSON.stringify(out));
  location.reload();
})();
