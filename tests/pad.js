// A gamepad from the title screen on (a fake pad; the page can't tell): A starts and
// pages the story, the stick walks, prompts and tips name pad buttons, Y talks and A pages
// through it without a jump at the end, Start pauses, the stick picks, B resumes.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = { connected: true, id: 'fake', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
const A = 0, B = 1, X = 2, Y = 3, START = 9;
const tap = async (i) => { pad.buttons[i].pressed = true; await wait(90); pad.buttons[i].pressed = false; await wait(260); };
const text = (sel) => document.querySelector(sel)?.textContent ?? '';
(async () => {
  await wait(600);
  // Title and story, by A only.
  let taps = 0;
  while (g.state !== 'play' && taps < 25) { await tap(A); taps++; }
  out.start = { state: g.state, taps };
  await wait(400);
  out.introTip = text('#hint');
  g.godMode = true;
  // The stick walks.
  const x0 = p.x, z0 = p.z;
  pad.axes[0] = -0.9;
  await wait(600);
  pad.axes[0] = 0;
  out.stickWalks = +Math.hypot(p.x - x0, p.z - z0).toFixed(2);
  out.flaskKey = text('#flaskKey');
  // Talk to the Warden with Y, page through with A.
  const w = g.npc('warden');
  p.place(w.x + 1.2, w.z + 0.4, g);
  await wait(500);
  out.prompt = text('#prompt');
  let talks = 0;
  const talkTo = g.talkTo.bind(g);
  g.talkTo = (n) => { talks++; return talkTo(n); };
  await tap(Y);
  const opened = g.ui.dialogOpen;
  let presses = 0;
  while (g.ui.dialogOpen && presses < 30) { await tap(A); presses++; }
  await wait(200);
  out.talk = { opened, presses, talks, openAfter: g.ui.dialogOpen, jumped: !p.onGround };
  // Pause with Start, move the selection with the stick, resume with B.
  await tap(START);
  const paused = g.paused;
  pad.axes[1] = 0.9;
  await wait(150);
  pad.axes[1] = 0;
  await wait(150);
  const sel = [...document.querySelectorAll('#pause .btns .btn')].findIndex((b) => b.classList.contains('sel'));
  const shown = [...document.querySelectorAll('#pause .keys')].filter((k) => getComputedStyle(k).display !== 'none').map((k) => k.className);
  await tap(B);
  out.pause = { paused, selAfterDown: sel, resumedByB: !g.paused, controlsListed: shown };
  // The fight tip names the pad's guard button.
  g.hintsShown?.delete?.('fight');
  const e = g.enemies.find((e) => e.alive);
  g.settings.hints = true;
  localStorage.removeItem?.('realms-tips');
  g.alert(e);
  await wait(100);
  out.fightTip = text('#hint');
})();
window.__report = () => out;
