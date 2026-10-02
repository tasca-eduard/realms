// The Sea Stair from the pause menu, part 1 (the Sunken Reef, a knight without the Thornstag): travel to
// Whisperwood from the menu. Part 2 (AFTER=tests/seastairmenu2.js) follows the reload.
const g = window.__game;
sessionStorage.removeItem('test-log');
localStorage.removeItem('realms-save');
setTimeout(() => {
  sessionStorage.setItem('test-log', JSON.stringify({ reef: { realm: g.def.id, stag: g.save.data.mounts.includes('stag') } }));
  g.setPaused(true);
  [...document.querySelectorAll('#pause .btns .btn')].find((b) => b.textContent.includes('Whisperwood')).click();
}, 800);
