// Travel from the pause menu, part 1: light the wayshrine, open the menu, pick Whisperwood.
// Parts 2 and 3 (AFTER=tests/menutravel2.js,tests/menutravel3.js) follow the reloads.
const g = window.__game;
sessionStorage.removeItem('test-log');
const m = g.moonfires.find((x) => x.id === 'wayshrine');
g.player.place(m.x + 1.3, m.z + 1.3, g);
setTimeout(() => {
  g.rest(m);
  g.setPaused(true);
  const btns = [...document.querySelectorAll('#pause .btns .btn')].map((b) => b.textContent);
  sessionStorage.setItem('test-log', JSON.stringify({ castle: { buttons: btns } }));
  [...document.querySelectorAll('#pause .btns .btn')].find((b) => b.textContent.includes('Whisperwood')).click();
}, 2000);
