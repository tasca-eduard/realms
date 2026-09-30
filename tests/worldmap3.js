// World map, part 3: the click on the Keep brought the knight there.
const g = window.__game;
const out = { ...JSON.parse(sessionStorage.getItem('test-map') ?? '{}'), travelled: g.def.id };
localStorage.removeItem('realms-save');
window.__report = () => out;
