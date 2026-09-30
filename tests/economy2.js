// The Old Wood's economy and toughness (run with &realm=forest): its chests pay 900 to 1200 coins in
// all, enough with the trial and the quests for the thorn-smith's two tempers (960) and a little
// more, not twice over; its foes are 1.6 times as tough as their kind (the knight comes with a better
// sword), the Thorn Warden tuned alone (not scaled).
const g = window.__game, out = {};
const chests = g.chests.reduce((s, c) => s + c.coins, 0);
const trialAndQuests = 100 + 40 + 30; // the Ring of Oaks, the traveller's purse, Ash's savings
const goblin = g.enemies.find((e) => e.type === 'goblin' && !e.elite && !e.golden);
out.chests = { count: g.chests.length, coins: chests, withTrialAndQuests: chests + trialAndQuests, tempers: 400 + 560 };
out.tough = { goblin: goblin ? +goblin.maxHp.toFixed(2) : null, goblinBase: goblin?.spec.hp ?? null, warden: g.boss?.maxHp ?? null };
out.ok = chests >= 900 && chests <= 1200 && chests + trialAndQuests > 960 && Math.abs((goblin?.maxHp ?? 0) - 4.8) < 0.01 && g.boss?.maxHp === g.boss?.spec.hp;
window.__report = () => out;
