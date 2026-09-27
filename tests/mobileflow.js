// Phone flow: tap Begin, tap through the story, push the stick, tap attack.
const g = window.__game;
const ev = (el, type, x, y, id = 1) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
const steps = [];
document.querySelector('#title .btn').click();
let taps = 0;
const tapper = setInterval(() => {
  if (g.state === 'story') { ev(window, 'pointerdown', 400, 200, 9); taps++; }
  else clearInterval(tapper);
}, 250);
setTimeout(() => {
  const zone = document.getElementById('stickZone');
  const r = zone.getBoundingClientRect();
  const x = r.left + 120, y = r.bottom - 100;
  ev(zone, 'pointerdown', x, y, 2);
  ev(zone, 'pointermove', x + 10, y - 45, 2);
  steps.push(['walk-from', g.player.x.toFixed(1), g.player.z.toFixed(1)]);
  setTimeout(() => {
    ev(zone, 'pointerup', x + 10, y - 45, 2);
    steps.push(['walk-to', g.player.x.toFixed(1), g.player.z.toFixed(1)]);
    const atk = document.querySelector('.tb.attack');
    ev(atk, 'pointerdown', 0, 0, 3);
    setTimeout(() => ev(atk, 'pointerup', 0, 0, 3), 60);
    setTimeout(() => steps.push(['after-attack', g.player.state]), 120);
  }, 1200);
}, 7000);
window.__report = () => ({ state: g.state, taps, steps, touch: g.input.usingTouch });
