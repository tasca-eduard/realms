// The main quest start to finish, teleporting between steps and forcing kills.
const g = window.__game;
const p = g.player;
g.godMode = true;
const log = [];
const q = () => g.save.data.quests.main;
const at = (ms, fn) => setTimeout(() => { try { fn(); } catch (e) { log.push('ERROR ' + e.message); } }, ms);
const kd = (c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
const ku = (c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
const press = (c) => { kd(c); setTimeout(() => ku(c), 40); };
at(300, () => { p.place(78, 64, g); });
at(1500, () => { log.push(['village', q()]); g.talkTo(g.npc('elder')); for (let i = 0; i < 12; i++) setTimeout(() => press('KeyE'), i * 120); });
at(3500, () => { log.push(['elder', q()]); p.place(56.5, 11.4, g); });
at(4500, () => { g.lever.interact(g); });
at(10500, () => { log.push(['lever', q(), 'bridge', g.bridge.down, 'deck', g.grid.groundAt(49, 24.5)]); p.place(52, 24.5, g); });
at(11000, () => { // walk across the drawbridge into the keep
  kd('KeyW'); kd('KeyA');
});
at(13000, () => { ku('KeyW'); ku('KeyA'); log.push(['crossed', p.x.toFixed(1), p.z.toFixed(1), p.y.toFixed(1)]);
  for (const e of g.enemies) if (e.group === 'courtyard' && e.alive) e.die(g); });
at(18500, () => { log.push(['courtyard', q(), 'door open', g.hallDoor.open]); p.place(30, 18.5, g); });
at(23000, () => { log.push(['boss awake', g.bossActive, g.boss && g.boss.state]); g.boss.hp = 1; g.boss.takeHit(5, 1, 0, 2, false, g); });
at(29000, () => { log.push(['after boss', q(), 'state', g.state, 'victory', g.victory, 'saved boss', g.save.data.flags.boss]); press('KeyE'); });
at(35000, () => { log.push(['back to play', g.state, 'dawn', g.dawn.toFixed(2)]); g.talkTo(g.npc('elder')); log.push(['victory line', document.querySelector('#dialog .who').textContent]); });
window.__report = () => log;
