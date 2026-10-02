// After tests/kip1.js and a reload: the cage stays broken, Kip stays home with his mother, the quest stays done.
const g = window.__game;
const before = JSON.parse(sessionStorage.getItem('test-kip') ?? '{}');
const out = { ...before, reloaded: { cageOpen: g.cage.open, kipCaged: g.npc('kip').visible, kipHome: g.npc('kiphome').visible, quest: g.save.data.quests.kip } };
out.ok = out.maren?.quest === 0 && out.guards?.length === 4 && out.cage?.open && out.kipTalks && out.freed?.coins === 40 && out.freed.rescued && out.freed.quest === 1 && out.freed.swimming
  && out.home?.kipGone && out.home.kipHome && out.home.swamWest && out.thanks?.coins === 30 && out.thanks.quest === 2
  && out.reloaded.cageOpen && !out.reloaded.kipCaged && out.reloaded.kipHome && out.reloaded.quest === 2;
localStorage.removeItem('realms-save');
window.__report = () => out;
