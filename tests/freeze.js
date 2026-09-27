const g = window.__game;
const p = g.player;
const log = {};
p.place(80, 63, g);
p.afflict('burn', g);
g.ui.lore('A test lore text.');
const hp0 = p.hp;
setTimeout(() => { log.loreOpen = g.ui.loreOpen; log.heartsLostWhileReading = hp0 - p.hp; }, 2500);
// Daze, then get hit during it: is the knight protected from a second daze right after?
setTimeout(() => { g.ui.closeLore(); p.hp = 5; p.iframes = 0; p.afflict('daze', g); }, 2700);
setTimeout(() => { p.iframes = 0; p.hurt(1, p.x + 1, p.z, g); log.stateAfterHitWhileDazed = p.state; }, 2900);
setTimeout(() => { p.iframes = 0; log.canBeDazedAgainAt = p.afflict('daze', g) ? 'yes, immediately' : 'no'; }, 3900);
window.__report = () => log;
