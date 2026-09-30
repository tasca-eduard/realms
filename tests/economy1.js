// Blackpine's foes are as tough as their kind (the realms' toughness doesn't reach back into realm 1).
const g = window.__game, out = {};
const goblin = g.enemies.find((e) => e.type === 'goblin' && !e.elite && !e.golden);
out.goblin = goblin ? goblin.maxHp : null;
out.ok = goblin?.maxHp === goblin?.spec.hp;
window.__report = () => out;
