// Crossing between realms, part 2: arrived in Whisperwood. Check, then walk into its border back.
const g = window.__game, p = g.player;
const log = JSON.parse(sessionStorage.getItem('test-log') || '{}');
const s = JSON.parse(localStorage.getItem('realms-save'));
log.forest = {
  realm: g.def.id,
  state: g.state,
  card: document.querySelector('#loading .travel')?.textContent ?? null,
  titleHidden: !g.screens.titleOpen,
  at: [p.x.toFixed(1), p.z.toFixed(1)],
  horseNear: Math.hypot(g.horse.home.x - p.x, g.horse.home.z - p.z) < 4, // where it was set down (it wanders off after a few seconds)
  coins: p.coins,
  savedRealm: s.realm,
  castleKept: (s.realms.castle?.chests ?? []).includes('c_crypt'),
  // None of realm 1's chests (ids c_...) are built here (Whisperwood's own are wc_...).
  noCastleHere: g.chests.length > 0 && !g.chests.some((c) => c.id.startsWith('c_')),
};
sessionStorage.setItem('test-log', JSON.stringify(log));
// Walk into the border back to Blackpine.
setTimeout(() => {
  const b = g.realm.borders[0];
  p.place(b.x, b.z, g);
}, 800);
