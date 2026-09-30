// Travel from the pause menu, part 2: in Whisperwood. Back to the Moonlit Keep from the menu.
const g = window.__game, p = g.player;
const log = JSON.parse(sessionStorage.getItem('test-log') || '{}');
log.forest = { realm: g.def.id, state: g.state, paused: g.paused, at: [p.x.toFixed(1), p.z.toFixed(1)], buttons: [...document.querySelectorAll('#pause .btns .btn')].map((b) => b.textContent) };
sessionStorage.setItem('test-log', JSON.stringify(log));
setTimeout(() => {
  g.setPaused(true);
  [...document.querySelectorAll('#pause .btns .btn')].find((b) => b.textContent.includes('Moonlit Keep')).click();
}, 800);
