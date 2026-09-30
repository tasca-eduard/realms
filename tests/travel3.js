// Crossing between realms, part 3: back in the Moonlit Keep with everything as it was.
const g = window.__game, p = g.player;
const log = JSON.parse(sessionStorage.getItem('test-log') || '{}');
const s = JSON.parse(localStorage.getItem('realms-save'));
log.back = {
  realm: g.def.id,
  state: g.state,
  coins: p.coins,
  cryptOpen: g.chests.find((c) => c.id === 'c_crypt').open,
  // Back over the thorn road: out at its mouth by the old lodge.
  at: [p.x.toFixed(1), p.z.toFixed(1)],
  savedRealm: s.realm,
  bothKept: !!s.realms.castle && !!s.realms.forest,
  forestExplored: (s.realms.forest?.fow ?? '').length > 0 && s.realms.forest.fow !== s.realms.castle.fow,
  forestHasNoCastleChests: (s.realms.forest?.chests ?? []).length === 0,
};
window.__report = () => log;
