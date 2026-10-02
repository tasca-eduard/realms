// After tests/serpentspot1.js and a reload: the serpent waits where the knight left it, not by its old pen.
const g = window.__game;
const before = JSON.parse(sessionStorage.getItem('test-serpentspot') ?? '{}');
const s = g.story.serpent.serpent;
const out = { ...before, reloaded: s ? { x: +s.x.toFixed(1), z: +s.z.toFixed(1) } : null };
out.off = s && before.spot ? +Math.hypot(s.x - before.spot.x, s.z - before.spot.z).toFixed(2) : null;
out.ok = !!(out.freed && before.spot && out.saved && Math.hypot(out.saved[0] - before.spot.x, out.saved[1] - before.spot.z) < 0.2 && out.off !== null && out.off < 1.5);
localStorage.removeItem('realms-save');
window.__report = () => out;
