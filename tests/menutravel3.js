// Travel from the pause menu, part 3: back in the Moonlit Keep, at the moonfire lit before leaving.
const g = window.__game, p = g.player;
const log = JSON.parse(sessionStorage.getItem('test-log') || '{}');
const m = g.moonfires.find((x) => x.id === 'wayshrine');
log.back = { realm: g.def.id, state: g.state, atMoonfire: Math.hypot(p.x - m.x, p.z - m.z) < 2.5, bossAlive: !!g.boss?.alive };
window.__report = () => log;
