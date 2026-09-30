// After tests/sister1.js and a reload: the cage stays broken, Wren stays home, the quest stays done.
const g = window.__game;
const before = JSON.parse(sessionStorage.getItem('test-sister') ?? '{}');
const out = { ...before, reloaded: { cageOpen: g.cage.open, wrenCaged: g.npc('wren').visible, wrenHome: g.npc('wrenhome').visible, quest: g.save.data.quests.sister } };
localStorage.removeItem('realms-save');
window.__report = () => out;
