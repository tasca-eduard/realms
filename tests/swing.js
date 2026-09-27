// Simulate a click toward the right of the screen, then another for the combo.
const c = document.querySelector('#view canvas');
const x = window.innerWidth * 0.7, y = window.innerHeight * 0.5;
c.dispatchEvent(new MouseEvent('mousemove', { clientX: x - 10, clientY: y, bubbles: true }));
c.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
setTimeout(() => {
  c.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: x, clientY: y, bubbles: true }));
  setTimeout(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })), 40);
}, 400);
