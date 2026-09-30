// The thorn road, part 2: came out in Whisperwood at the road's end, the warhorse along. Walk back.
const g = window.__game, p = g.player;
const log = JSON.parse(sessionStorage.getItem('test-log') || '{}');
log.forest = {
  realm: g.def.id,
  card: document.querySelector('#loading .travel')?.textContent ?? null,
  at: [p.x.toFixed(1), p.z.toFixed(1)],
  horseNear: Math.hypot(g.horse.home.x - p.x, g.horse.home.z - p.z) < 4, // where it was set down (it wanders off after a few seconds)
};
sessionStorage.setItem('test-log', JSON.stringify(log));
setTimeout(() => {
  const b = g.realm.borders.find((x) => x.to === 'castle');
  p.place(b.x, b.z, g);
}, 800);
