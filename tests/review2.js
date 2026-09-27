// Review checks (2026-09-28): confirm suspected flaws in a live game.
const g = window.__game;
const p = g.player;
const out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  g.godMode = false;
  // 1. Poisoned at full health: can the flask cure it?
  p.place(80, 64, g);
  p.hp = p.maxHp;
  p.afflict('poison', g);
  const flasksBefore = p.flasks;
  g.input.press('heal');
  await wait(100);
  g.input.release('heal');
  await wait(900);
  out.poisonFullHp = { state: p.state, poisonLeft: +p.effects.poison.toFixed(1), flasksUsed: flasksBefore - p.flasks };
  p.cureAll();

  // 2. Drinking on horseback: does it cure?
  const h = g.horse;
  h.arriveAt(p.x + 1.5, p.z, g);
  await wait(100);
  p.mount(h, g);
  await wait(200);
  p.hp = p.maxHp - 2;
  p.afflict('maim', g);
  g.input.press('heal');
  await wait(100);
  g.input.release('heal');
  await wait(600);
  out.rideDrink = { riding: !!p.riding, hp: p.hp, maimLeft: +p.effects.maim.toFixed(1) };
  p.dismount(g);
  p.cureAll();
  await wait(600);

  // 3. Timers while paused: does a timer fire during the pause?
  let fired = false;
  g.setPaused(true);
  g.after(0.3, () => (fired = true));
  await wait(700);
  out.timerFiredWhilePaused = fired;
  g.setPaused(false);

  // 4. Hearts at full health: absorbed?
  p.hp = p.maxHp;
  g.combat.spawnPickup('heart', p.x + 0.5, p.y + 0.5, p.z);
  await wait(1800);
  out.heartAtFullHp = { left: g.combat.pickups.filter((k) => k.kind === 'heart').length };

  // 5. Touch: a moonfire with foes about. What does a phone player see?
  g.input.usingTouch = true;
  const hearth = g.moonfires.find((m) => m.id === 'wayshrine');
  p.place(hearth.x + 1.2, hearth.z + 1.2, g);
  const e = g.enemies.find((x) => x.alive && x.type === 'goblin');
  const ex = e.x, ez = e.z, es = e.state;
  e.x = hearth.x + 5; e.z = hearth.z; e.state = 'chase';
  await wait(150);
  const prompt = document.querySelector('#prompt');
  const act = document.querySelector('#touch .act');
  out.touchMoonfire = {
    promptText: prompt.textContent,
    promptVisible: getComputedStyle(prompt).display !== 'none' && prompt.classList.contains('on'),
    actButtonHidden: act.classList.contains('hidden'),
  };
  e.x = ex; e.z = ez; e.state = es;
  g.input.usingTouch = false;
})();
window.__report = () => out;
