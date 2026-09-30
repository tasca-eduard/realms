// After tests/hold1.js and a reload: the heart stays torn out and its thorns withered, the arena's
// thorns drawn back (the lost fight reset), the garrison gone, the Warden asleep in its arena.
const g = window.__game;
const before = JSON.parse(sessionStorage.getItem('test-hold') ?? '{}');
const out = { ...before, reloaded: { heartTorn: g.lever.pulled, wallOpen: g.thornWall.open, arenaOpen: g.hallDoor.open, garrison: g.enemies.filter((e) => e.group === 'garrison' && e.alive).length, warden: g.boss?.alive ? g.boss.state : null } };
localStorage.removeItem('realms-save');
window.__report = () => out;
