const c = document.querySelector('#view canvas');
setTimeout(() => c.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 800, clientY: 360, bubbles: true })), 100);
setTimeout(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })), 1300);
