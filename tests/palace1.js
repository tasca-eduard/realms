// The way into the Tidelord's palace (run with &realm=aqua; tests/palace2.js runs after the reload): his
// floodgate, across the trench, holds against a walk and a jump; the drowned kingdom's great bell in its plaza,
// struck with a blow, tolls, and the floodgate rises (quest, saved); his crew on the landing fall (saved);
// through the gate into the throne hall, he wakes and the gate drops shut behind; a lost fight lifts it again.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const down = (c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
const up = (c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
const hold = async (codes, ms) => {
  codes.forEach(down);
  await wait(ms);
  codes.forEach(up);
  await wait(300);
};
const at = async (x, z) => {
  p.place(x, z, g);
  g.cam.focus.set(p.x, p.y, p.z);
  await wait(400);
};
const c = document.querySelector('#view canvas');
const swingAt = (o) => {
  const s = { x: 0, y: 0 };
  g.cam.toScreen({ x: o.x, y: o.y, z: o.z, clone() { return new (g.cam.focus.constructor)(this.x, this.y, this.z); } }, s);
  c.dispatchEvent(new MouseEvent('mousemove', { clientX: s.x, clientY: s.y, bubbles: true }));
  c.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: s.x, clientY: s.y, bubbles: true }));
  setTimeout(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0 })), 30);
};
(async () => {
  localStorage.removeItem('realms-save');
  g.godMode = true;
  g.save.data.flags.costume = true;
  p.dives = true;
  const gate = g.hallDoor, story = g.story, hall = g.realm.arena;
  // ---------- the floodgate holds ----------
  const garrison = g.enemies.filter((e) => e.group === 'garrison');
  for (const e of garrison) e.despawn(g);
  await at(gate.x - 2.2, gate.z);
  out.prompt = document.querySelector('#prompt')?.textContent ?? null;
  // East (world +x is screen down-right: S + D), then a running jump at it.
  await hold(['KeyS', 'KeyD'], 1500);
  down('KeyS');
  down('KeyD');
  await wait(300);
  await hold(['Space'], 120);
  await wait(700);
  up('KeyS');
  up('KeyD');
  await wait(300);
  out.shut = { open: gate.open, x: +p.x.toFixed(2), held: p.x < gate.x + 0.2, fight: g.bossActive };
  // ---------- the bell ----------
  const bell = story.bell;
  out.bellPrompt = null;
  await at(bell.x + 1.6, bell.z + 0.3);
  out.bellPrompt = document.querySelector('#prompt')?.textContent ?? null;
  out.quest0 = g.quests.def('main').short[g.save.data.quests.main];
  for (let k = 0; k < 4 && !bell.rung; k++) {
    swingAt({ x: bell.x, y: p.y + 0.9, z: bell.z });
    await wait(450);
  }
  out.bell = { rung: bell.rung, flag: !!g.save.data.flags.bell, quest: g.quests.def('main').short[g.save.data.quests.main] };
  await wait(4500);
  out.bell.gateOpen = gate.open;
  // ---------- the crew ----------
  // (Back as they were: placed, alive, on the landing.)
  g.enemies = g.enemies.filter((e) => !garrison.includes(e));
  out.garrison = { before: 0 };
  for (const s of g.realm.enemies.filter((s) => s.group === 'garrison')) out.garrison.before++;
  const fresh = [];
  const E = g.boss.constructor;
  for (const s of g.realm.enemies.filter((s) => s.group === 'garrison')) {
    const e = new E(s.type, s.x, s.z, g, s.group, !!s.guard);
    e.spawnId = g.realm.enemies.indexOf(s);
    e.model.rig.addTo(g.scene);
    g.enemies.push(e);
    fresh.push(e);
  }
  out.garrison.dive = fresh.every((e) => e.dives);
  await at(118.5, 97);
  await wait(1500);
  out.garrison.chasing = fresh.filter((e) => e.state !== 'idle').length;
  out.garrison.moved = +Math.max(...fresh.map((e) => Math.hypot(e.x - e.home.x, e.z - e.home.z))).toFixed(2);
  for (const e of fresh) e.die(g);
  await wait(1500);
  out.garrison.flag = !!g.save.data.flags.garrison;
  // ---------- into the hall ----------
  await at(gate.x - 1.6, gate.z);
  await hold(['KeyS', 'KeyD'], 1400);
  await wait(800);
  out.hall = { x: +p.x.toFixed(1), fight: g.bossActive, shutBehind: !gate.open, region: g.region?.name ?? null, inside: p.x > hall.x0 };
  // ---------- a lost fight ----------
  g.godMode = false;
  p.hp = 1;
  const res = p.hurt(1, p.x + 1, p.z, g, { unblockable: true, force: true });
  g.afterHit(res, p.x + 1, p.z, null);
  out.fell = { res, hp: p.hp, state: g.state };
  await wait(3600);
  window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse' }));
  await wait(2600);
  out.lost = { fight: g.bossActive, gateOpen: gate.open, boss: g.boss.state, at: [+p.x.toFixed(1), +p.z.toFixed(1)] };
  g.writeSave();
  out.ok = out.shut.held && !out.shut.open && !out.shut.fight && out.bell.rung && out.bell.flag && out.bell.gateOpen && out.bell.quest === 'Face the Tidelord'
    && out.garrison.dive && out.garrison.moved > 0.5 && out.garrison.flag && out.hall.fight && out.hall.shutBehind && out.hall.inside && !out.lost.fight && out.lost.gateOpen && out.lost.boss === 'sleep';
  sessionStorage.setItem('test-palace', JSON.stringify(out));
  location.reload();
})();
window.__report = () => out;
