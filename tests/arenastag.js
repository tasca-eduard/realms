// The Warden's hollow holds until its garrison falls (run with &realm=forest): with the Thorn Heart
// torn out but the thorns still across the hollow's mouth, neither the knight (1.5 m climb) nor the
// Thornstag (its 2.75 m climb and second leap) can get in over the roots round it.
const g = window.__game, out = {};
g.thornWall.setOpen(true, g, true);
g.hallDoor.setOpen(false, g, true);
for (const [who, climb] of [['knight', 1.5], ['stag', 2.75]]) {
  const r = window.__reach(false, climb);
  out[who] = { wardenShut: r.unreachable.some((u) => u.what === 'enemy:warden'), reachable: r.reachable };
}
out.ok = out.knight.wardenShut && out.stag.wardenShut;
window.__report = () => out;
