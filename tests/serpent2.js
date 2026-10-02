// After tests/serpent1.js and a reload: the serpent stays free (no nets, no thrashing beast), waiting in its pool
// to be ridden; the quest stays done; barding counts for it as for every mount (one more hit a piece).
const g = window.__game, p = g.player;
const before = JSON.parse(sessionStorage.getItem('test-serpent') ?? '{}');
const pen = g.story.serpent, s = g.mounts.find((m) => m.kind === 'serpent');
const out = { ...before, reloaded: { freed: pen.freed, lines: pen.left, mount: !!s, inPool: !!s && Math.hypot(s.x - 79, s.z - 37.6) < 6, prompt: s?.prompt(g) ?? null, quest: g.save.data.quests.serpent ?? null, maxHp: s?.maxHp ?? null } };
p.kit.barding = 2;
g.applyKit();
out.reloaded.barded = s?.maxHp ?? null;
out.ok = !!before.ok && out.reloaded.freed && out.reloaded.lines === 0 && out.reloaded.mount && out.reloaded.inPool && out.reloaded.quest === 1 && out.reloaded.maxHp === 3 && out.reloaded.barded === 5;
localStorage.removeItem('realms-save');
window.__report = () => out;
