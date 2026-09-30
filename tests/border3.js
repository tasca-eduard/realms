// The thorn road, part 3: back in Blackpine at the thorn road's mouth, the hedge still down.
const g = window.__game, p = g.player;
const log = JSON.parse(sessionStorage.getItem('test-log') || '{}');
const b = g.realm.borders.find((x) => x.to === 'forest');
log.back = {
  realm: g.def.id,
  at: [p.x.toFixed(1), p.z.toFixed(1)],
  atRoadMouth: Math.hypot(p.x - b.out.x, p.z - b.out.z) < 0.5,
  hedgeDown: g.hedges[0].broken,
  horseNear: Math.hypot(g.horse.home.x - p.x, g.horse.home.z - p.z) < 4, // where it was set down (it wanders off after a few seconds)
};
window.__report = () => log;
