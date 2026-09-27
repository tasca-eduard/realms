// Let the knight fall at the goblin camp, then tap to rise at the moonfire.
const g = window.__game;
const log = [];
g.player.hp = 1;
setTimeout(() => log.push(['after-hit', g.state, g.player.hp]), 4000);
setTimeout(() => { window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse' })); }, 6500);
setTimeout(() => log.push(['after-tap', g.state, g.player.hp, g.player.x.toFixed(1), g.player.z.toFixed(1)]), 8500);
window.__report = () => log;
