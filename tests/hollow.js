const g = window.__game;
const c = document.querySelector('#view canvas');
const log = [];
g.player.place(33, 61, g);
const w = g.crackedWalls[0];
const click = () => {
  const s = { x: 0, y: 0 };
  g.cam.toScreen({ clone: () => new g.cam.focus.constructor(w.x, w.y + 0.9, w.z) }, s);
  c.dispatchEvent(new MouseEvent('mousemove', { clientX: s.x, clientY: s.y, bubbles: true }));
  c.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: s.x, clientY: s.y, bubbles: true }));
  setTimeout(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })), 40);
};
setTimeout(click, 400);
setTimeout(() => log.push(['after one hit', w.broken ? 'broken' : 'intact', document.querySelector('#prompt').textContent]), 900);
// A full combo: the third hit is heavy.
setTimeout(click, 1500);
setTimeout(click, 1750);
setTimeout(click, 2050);
setTimeout(() => log.push(['after combo', w.broken ? 'broken' : 'intact']), 2900);
setTimeout(() => g.player.place(33.5, 56.8, g), 3100);
window.__report = () => log;
