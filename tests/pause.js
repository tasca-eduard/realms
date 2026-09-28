// Pause really pauses (timers, cutscenes), leaving the window pauses, the victory
// screen freezes the world, and the music skips missed beats instead of bursting.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await wait(300);
  // A timer set while paused waits for the resume.
  let fired = false;
  g.setPaused(true);
  g.after(0.3, () => (fired = true));
  await wait(700);
  out.timerWhilePaused = fired;
  g.setPaused(false);
  await wait(500);
  out.timerAfterResume = fired;
  // A cutscene holds while paused.
  let ended = false;
  g.focus(p.x + 3, p.y, p.z, 0.8, () => (ended = true));
  await wait(100);
  g.setPaused(true);
  await wait(1200);
  out.cutsceneWhilePaused = ended;
  g.setPaused(false);
  await wait(1200);
  out.cutsceneAfterResume = ended;
  // Leaving the window pauses.
  window.dispatchEvent(new Event('blur'));
  await wait(100);
  out.pausedOnBlur = g.paused;
  g.setPaused(false);
  // The victory screen: a goblin right beside the knight can't hurt him.
  g.godMode = false;
  p.hp = p.maxHp;
  const e = g.enemies.find((x) => x.alive && x.type === 'goblin');
  e.x = p.x + 0.8; e.z = p.z; e.home = { x: e.x, z: e.z }; e.state = 'chase'; e.cooldown = 0;
  g.state = 'victory';
  const ex = e.x;
  await wait(2500);
  out.victory = { hp: p.hp, maxHp: p.maxHp, foeMoved: +Math.abs(e.x - ex).toFixed(2) };
  g.state = 'play';
  // Music: a channel that fell 8 s behind schedules a handful of notes, not 8 s worth.
  const m = g.audio.music;
  if (m && m.ready && m.main) {
    let n = 0;
    const play = m.play.bind(m);
    m.play = (...a) => { n++; return play(...a); };
    m.main.nextT = m.ctx.currentTime - 8;
    m.update(0);
    m.play = play;
    out.musicNotesAfterStall = n;
  } else out.musicNotesAfterStall = 'music not loaded here';
})();
window.__report = () => out;
