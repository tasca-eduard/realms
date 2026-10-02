// The Tide Serpent's moves (run with &realm=aqua): on its back in the pool south of the sandbar, foes brought
// over onto the bar. Bubble shot (attack): a bubble spat where the knight aims hurts the foe it reaches, and a
// second can't follow at once; Whirlpool (special, 50 energy): a vortex drifts out in front, drags a foe in
// toward its middle and wears it down; Bubble shell (guard, 30 stamina): an arrow that would have hit bursts
// the shell instead (no harm to the serpent or the knight), and the next arrow, shell gone, costs the serpent a hit.
// Its last hit gone, the knight is thrown: without the diving suit the sea washes him back to where he last stood
// (a heart, as a fall), and the serpent dives away, to come back to where he left it.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const c = document.querySelector('#view canvas');
const clickAt = async (x, y, z, button = 0) => {
  const v = p.rig.root.position.clone().set(x, y, z), s = { x: 0, y: 0 };
  g.cam.toScreen(v, s);
  c.dispatchEvent(new MouseEvent('mousemove', { clientX: s.x, clientY: s.y, bubbles: true }));
  await wait(60);
  c.dispatchEvent(new MouseEvent('mousedown', { button, clientX: s.x, clientY: s.y, bubbles: true }));
  await wait(80);
  window.dispatchEvent(new MouseEvent('mouseup', { button }));
};
const key = async (code, ms = 60) => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
  await wait(ms);
  window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
};
const r2 = (v) => +v.toFixed(2);
window.__report = () => out;
(async () => {
  g.godMode = true;
  const pen = g.story.serpent;
  pen.struck(g, () => true);
  const s = pen.serpent;
  // The keepers are the foes: one held for the shots, one for the whirlpool; the rest away.
  const foes = g.enemies.filter((e) => e.alive && e.group === 'serpent' && e.type === 'goblin');
  for (const e of g.enemies) if (e.alive && !foes.includes(e)) e.despawn(g);
  const put = (e, x, z) => {
    e.x = e.home.x = x;
    e.z = e.home.z = z;
    e.y = g.grid.groundAt(x, z);
    e.state = 'idle';
    e.hp = e.maxHp = 50;
    e.vx = e.vz = 0;
  };
  // In the pool at (78.5, 36.5), facing north toward the bar.
  s.arriveAt(78.5, 36.5, g);
  p.place(s.x, s.z, g);
  await wait(300);
  p.mount(s, g);
  p.fx = 0;
  p.fz = -1;
  await wait(400);
  out.riding = p.riding === s;
  // (The mouse where the foe will stand, and the view let settle first: the camera leans toward the mouse and
  // follows the serpent's depth slowly, and a click made while it still moves aims somewhere else.)
  {
    const v = p.rig.root.position.clone().set(p.x, p.y + 0.9, p.z - 3.2), sc = { x: 0, y: 0 };
    g.cam.toScreen(v, sc);
    c.dispatchEvent(new MouseEvent('mousemove', { clientX: sc.x, clientY: sc.y, bubbles: true }));
    await wait(1800);
  }

  // Bubble shot at a foe standing on the bar ahead.
  put(foes[0], p.x, p.z - 3.2);
  put(foes[1], p.x + 14, p.z - 4);
  await wait(200);
  // (The mouse on the foe first and the view let settle: just carried across the map, the camera is still
  // catching up, more so on a slow frame rate, and the click would land somewhere else.)
  {
    const v = p.rig.root.position.clone().set(foes[0].x, foes[0].y + 0.8, foes[0].z), sc = { x: 0, y: 0 };
    g.cam.toScreen(v, sc);
    c.dispatchEvent(new MouseEvent('mousemove', { clientX: sc.x, clientY: sc.y, bubbles: true }));
    await wait(700);
  }
  const hp0 = foes[0].hp, spat = new Set();
  const iv = setInterval(() => s.bubbles.forEach((b) => spat.add(b)), 5);
  await clickAt(foes[0].x, foes[0].y + 0.8, foes[0].z);
  await wait(60);
  // (A second click right after: too soon for another bubble.)
  await clickAt(foes[0].x, foes[0].y + 0.8, foes[0].z);
  await wait(700);
  clearInterval(iv);
  out.shot = { spat: spat.size, hurt: r2(hp0 - foes[0].hp), each: r2(0.8 * p.damage) };

  // Whirlpool: a foe off to the side of its path gets dragged in and hurt.
  foes[0].despawn(g);
  put(foes[1], p.x + 1.6, p.z - 3.6);
  await wait(200);
  p.energy = 100;
  p.fx = 0;
  p.fz = -1;
  const hp1 = foes[1].hp, x1 = foes[1].x;
  // (50 spent; a first tick on the foe gives 2 back. The lowest it goes: on a slow frame the whirlpool can
  // start just after the key is let go.)
  let low = p.energy;
  const ivE = setInterval(() => (low = Math.min(low, p.energy)), 5);
  await key('KeyF', 30);
  await wait(1500);
  clearInterval(ivE);
  const energy = Math.round(low);
  const w = s.whirls[0];
  out.whirl = { up: !!w, energy, dragged: r2(x1 - foes[1].x), hurt: r2(hp1 - foes[1].hp) };
  await wait(1500);
  out.whirl.gone = s.whirls.length === 0;
  foes[1].despawn(g);

  // Bubble shell against an arrow; then an arrow with no shell.
  g.godMode = false;
  p.iframes = 0;
  const st0 = p.stamina, mhp0 = s.hp, khp0 = p.hp;
  await clickAt(p.x, p.y + 1, p.z - 2, 2);
  await wait(100);
  out.shell = { up: s.shell > 0, stamina: Math.round(st0 - p.stamina) };
  g.combat.shootFrom(p.x + 6, p.y + 1.4, p.z, p.x, p.y + 1.4, p.z);
  await wait(900);
  out.shell.after = { shell: s.shell > 0, serpentHp: mhp0 - s.hp, knightHp: khp0 - p.hp };
  p.iframes = 0;
  g.combat.shootFrom(p.x + 6, p.y + 1.4, p.z, p.x, p.y + 1.4, p.z);
  await wait(900);
  out.shell.bare = { serpentHp: mhp0 - s.hp, knightHp: khp0 - p.hp };

  // Thrown (he came out from the sand at the bar's west end).
  p.lastSafe = { x: 70.5, z: 30.5 };
  p.iframes = 0;
  s.hp = 1;
  const hearts = p.hp;
  g.combat.shootFrom(p.x + 6, p.y + 1.4, p.z, p.x, p.y + 1.4, p.z);
  await wait(500);
  out.thrown = { riding: !!p.riding, serpent: s.state };
  await wait(1500);
  Object.assign(out.thrown, { back: Math.hypot(p.x - 70.5, p.z - 30.5) < 1, hearts: hearts - p.hp });
  for (let i = 0; i < 30 && s.state === 'flee'; i++) await wait(100);
  out.thrown.serpentAfter = s.state;
  s.away = 0.05;
  await wait(500);
  out.thrown.returned = { state: s.state, shown: s.model.rig.root.visible, home: Math.hypot(s.x - 78.5, s.z - 36.5) < 1.5, hp: s.hp };
  g.godMode = true;

  out.ok = out.riding && out.shot.spat === 1 && out.shot.hurt > 0 && Math.abs(out.shot.hurt - out.shot.each) < 0.01
    && out.whirl.up && out.whirl.energy <= 56 && out.whirl.dragged > 0.4 && out.whirl.hurt > 0 && out.whirl.gone
    && out.shell.up && out.shell.stamina >= 25 && !out.shell.after.shell && out.shell.after.serpentHp === 0 && out.shell.after.knightHp === 0
    && out.shell.bare.serpentHp === 1 && out.shell.bare.knightHp === 0
    && !out.thrown.riding && out.thrown.serpent === 'flee' && out.thrown.back && out.thrown.hearts === 1 && out.thrown.serpentAfter === 'gone'
    && out.thrown.returned.state === 'idle' && out.thrown.returned.shown && out.thrown.returned.home && out.thrown.returned.hp === s.maxHp;
})();
