// Afflict the knight with each effect and check timings and cures.
const g = window.__game;
const p = g.player;
const log = {};
p.afflict('maim', g);
p.afflict('poison', g);
setTimeout(() => {
  log.maimSlow = p.effects.maim > 0;
  p.afflict('daze', g);
  log.dazed = p.state;
}, 300);
setTimeout(() => { log.afterDaze = p.state; log.reDaze = p.afflict('daze', g); }, 1400);
setTimeout(() => { const hp = p.hp; p.afflict('burn', g); log.burnStart = p.effects.burn.toFixed(1); setTimeout(() => { log.burnCost = hp - p.hp; }, 1800); }, 1700);
setTimeout(() => { p.afflict('burn', g); window.dispatchEvent(new MouseEvent('mouseup', { button: 2 })); }, 3800);
setTimeout(() => {
  const c = document.querySelector('#view canvas');
  c.dispatchEvent(new MouseEvent('mousedown', { button: 2, clientX: 800, clientY: 360, bubbles: true }));
  setTimeout(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 2 })), 60);
}, 4000);
setTimeout(() => { log.rollPutOut = p.effects.burn === 0; log.hud = [...document.querySelectorAll('#effects .fx span')].map((e) => e.textContent); }, 4300);
window.__report = () => log;
