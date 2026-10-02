// The Whalebone Isle and the coral shrine (run with &realm=aqua&god): the coral shrine on the village green
// mends whatever carries the knight (a beast stands in for the Tide Serpent here); on the isle the giant clam
// wakes the trial, three waves of the crew wade ashore (they drop nothing), and the win gives the Tide Pearl
// (whatever carries the knight takes one more hit, whole at once; kept in the save) and 100 coins.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const kd = (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
const ku = (code) => window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
const t = g.trial, log = [], types = new Set();
window.__report = () => out;
(async () => {
  g.godMode = true;
  g.save.data.flags.costume = true;
  p.dives = true;
  // A beast that carries the knight, hurt.
  const beast = { kind: 'serpent', called: 'Tide Serpent', x: 40, z: 72, hp: 1, maxHp: 3, update() {} };
  g.mounts.push(beast);
  g.applyKit();
  // The shrine: walked up to, its prompt, touched.
  const shrine = g.interactables.find((it) => it.prompt(g) === 'Touch the coral shrine');
  p.place(shrine.x + 1.2, shrine.z + 0.8, g);
  await wait(400);
  out.shrine = { found: !!shrine, before: beast.hp };
  shrine.interact(g);
  out.shrine.after = beast.hp;
  out.shrine.toast = g.ui.toastEl.textContent;
  beast.hp = 2;
  // The isle: its region names the quest; the clam's prompt; the trial.
  p.place(t.x + 2.5, t.z + 2.5, g);
  await wait(1500);
  out.region = { quest: g.save.data.quests.pearl, prompt: t.prompt(g) };
  p.place(t.x + 1.2, t.z + 1, g);
  const before = { coins: p.coins, maxHp: beast.maxHp };
  await wait(300);
  kd('KeyE');
  await wait(50);
  ku('KeyE');
  for (let i = 0; i < 40 && t.state !== 'won'; i++) {
    await wait(700);
    log.push(`${t.state}:${t.wave}`);
    if (t.state === 'wave')
      for (const e of g.enemies)
        if (e.group === 'trial' && e.alive) {
          types.add(e.type);
          e.die(g);
        }
  }
  await wait(1500);
  out.states = [...new Set(log)];
  out.foes = [...types];
  out.relic = g.save.data.relics.includes('tidepearl');
  out.beast = { before: before.maxHp, after: beast.maxHp, whole: beast.hp === beast.maxHp };
  out.paid = p.coins - before.coins;
  out.quest = g.save.data.quests.pearl;
  out.prompt = t.prompt(g);
  out.ok = out.shrine.found && out.shrine.before === 1 && out.shrine.after === 3 && /whole again/.test(out.shrine.toast) && out.region.quest === 0 && out.region.prompt === 'Open the giant clam'
    && out.states.includes('wave:2') && out.foes.length >= 4 && !out.foes.some((f) => f === 'bomber') && out.relic && out.beast.before === 3 && out.beast.after === 4 && out.beast.whole
    && out.paid === 100 && out.quest === 1 && out.prompt === null;
})();
