// After tests/keepsights1.js and a reload: the farm stays mended (no smoulder, the scaffolding up, the Harrows at
// work), the wheel still turns.
const g = window.__game, s = g.story.sights;
const before = JSON.parse(sessionStorage.getItem('test-sights') ?? '{}');
const out = { ...before, reloaded: { quest: g.save.data.quests.farm ?? null, smoulder: s.smoulder.group.visible, mended: s.mended.visible, wat: g.npc('wat').visible, edda: g.npc('edda').visible, wheelOn: s.wheelOn } };
localStorage.removeItem('realms-save');
window.__report = () => out;
