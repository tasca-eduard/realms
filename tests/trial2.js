const g = window.__game;
g.player.place(110.2, 88.8, g);
setTimeout(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true })), 200);
setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', bubbles: true })), 250);
