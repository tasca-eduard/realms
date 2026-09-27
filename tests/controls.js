// Guard tap -> roll, guard hold -> block, Space -> jump.
const g = window.__game;
const c = document.querySelector('#view canvas');
const log = [];
const rd = () => c.dispatchEvent(new MouseEvent('mousedown', { button: 2, clientX: 800, clientY: 360, bubbles: true }));
const ru = () => window.dispatchEvent(new MouseEvent('mouseup', { button: 2 }));
setTimeout(() => { rd(); setTimeout(ru, 70); }, 300);
setTimeout(() => log.push(['tap', g.player.state]), 430);
setTimeout(() => { rd(); }, 1200);
setTimeout(() => log.push(['hold', g.player.state]), 1600);
setTimeout(() => { ru(); }, 1700);
setTimeout(() => log.push(['released', g.player.state]), 1800);
setTimeout(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })), 2200);
setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true })), 2260);
setTimeout(() => log.push(['jump', (g.player.y - g.grid.groundAt(g.player.x, g.player.z)).toFixed(2), g.player.onGround]), 2420);
window.__report = () => log;
