// After tests/palace2.js (the Tidelord felled) and a reload: he's gone, the dawn stays (its light in his hall),
// the floodgate up, the quest done. The screenshot is the hall in the morning.
const g = window.__game, p = g.player;
const before = JSON.parse(sessionStorage.getItem('test-palace') ?? '{}');
const out = { ...before };
g.save.data.flags.costume = true;
p.dives = true;
p.place(129, 99, g);
g.cam.focus.set(p.x, p.y, p.z);
out.after = {
  boss: g.boss?.alive ?? false,
  dawn: +g.dawn.toFixed(2),
  shafts: !!g.story.dawn,
  gateOpen: !!g.hallDoor?.open,
  quest: g.quests.def('main').short[g.save.data.quests.main],
};
out.ok = !!before.ok && out.reloaded?.bellRung && out.reloaded.gateOpen && out.reloaded.garrison === 0 && out.reloaded.boss === 'sleep' && out.reloaded.quest === 'Face the Tidelord'
  && out.reloaded.fight && out.reloaded.won && !out.after.boss && out.after.dawn === 1 && out.after.shafts && out.after.gateOpen && out.after.quest === 'The sea is free';
localStorage.removeItem('realms-save');
sessionStorage.removeItem('test-palace');
window.__report = () => out;
