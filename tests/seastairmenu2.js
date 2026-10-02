// The Sea Stair from the pause menu, part 2 (Whisperwood): the way from the Reef is the Sea Stair, but a knight
// without the stag isn't set down below its rockfall (he couldn't get up past it): he comes out at the realm's
// start, the warhorse by him.
const g = window.__game, p = g.player;
const log = JSON.parse(sessionStorage.getItem('test-log') || '{}');
const b = g.realm.borders.find((x) => x.id === 'seastair');
log.wood = {
  realm: g.def.id,
  at: [+p.x.toFixed(1), +p.z.toFixed(1)],
  atStart: Math.hypot(p.x - g.realm.start.x, p.z - g.realm.start.z) < 1,
  belowRockfall: Math.hypot(p.x - b.out.x, p.z - b.out.z) < 3,
};
localStorage.removeItem('realms-save');
window.__report = () => log;
