const g = window.__game;
g.input.usingTouch = true;
setTimeout(() => g.setPaused(true), 600);
setTimeout(() => { document.querySelector('#pause .sheet').scrollTop = 9999; }, 900);
