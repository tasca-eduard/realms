const g = window.__game;
const kd = (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
const ku = (code) => window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
g.player.place(104.4, 106.4, g);
setTimeout(() => kd('KeyE'), 300);
setTimeout(() => ku('KeyE'), 360);
setTimeout(() => kd('KeyD'), 500);
setTimeout(() => ku('KeyD'), 1100);
