// The Sea Stair (run with &realm=forest): the rockfall across its head needs the Thornstag's second leap,
// both ways. With the story done, the knight on foot (1.5 m climb) gets to the head but not down past the
// rockfall to the border; come back up from the Reef (flooding from where he comes out), he gets nowhere
// near the heights. On the stag (2.75 m) he gets down to the border and back up to the heights and the
// realm's start, and still nowhere out of the world.
const g = window.__game;
const b = g.realm.borders.find((x) => x.id === 'seastair');
const head = [0.5, 33.5], landing = [-9.5, 33.5];
const out = { border: b ? { to: b.to, card: b.card, leap: !!b.leap } : null };
if (b) {
  const at = (r, [x, z]) => r.reached(x, z);
  const foot = window.__reach(true), stag = window.__reach(true, 2.75);
  out.down = {
    footAtHead: at(foot, head), footBelowRockfall: at(foot, landing), footAtBorder: at(foot, [b.x, b.z]),
    stagAtBorder: at(stag, [b.x, b.z]), stagEscapes: stag.escapes.length, footUnreachable: foot.unreachable.map((u) => u.what),
  };
  const start = g.realm.start;
  g.realm.start = { x: b.out.x, z: b.out.z };
  const foot2 = window.__reach(true), stag2 = window.__reach(true, 2.75);
  g.realm.start = start;
  out.up = { footAtHead: at(foot2, head), footCells: foot2.reachable, footTraps: foot2.trapCount, stagAtHead: at(stag2, head), stagAtStart: at(stag2, [start.x, start.z]), stagEscapes: stag2.escapes.length };
  out.ok = out.down.footAtHead && !out.down.footBelowRockfall && !out.down.footAtBorder && out.down.stagAtBorder && !out.down.stagEscapes
    && !out.up.footAtHead && out.up.stagAtHead && out.up.stagAtStart && !out.up.stagEscapes;
}
window.__report = () => out;
