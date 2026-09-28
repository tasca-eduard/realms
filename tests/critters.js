// New critters: owls sit on their perch, watch, fly off when the knight comes close
// and come back once he has gone; deer, foxes and squirrels flee.
const g = window.__game, p = g.player, out = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  g.godMode = true;
  const kinds = {};
  for (const c of g.critters) kinds[c.def.kind] = (kinds[c.def.kind] ?? 0) + 1;
  out.kinds = kinds;
  const owl = g.critters.find((c) => c.def.kind === 'owl');
  p.place(owl.def.x + 7, owl.def.z + 4, g);
  g.cam.focus.set(p.x, p.y, p.z);
  await wait(600);
  out.owlPerched = { state: owl.state, onPerch: Math.abs(owl.y - owl.def.perch) < 0.01, visible: owl.model.rig.root.visible };
  p.place(owl.def.x + 1.5, owl.def.z + 1.5, g);
  await wait(400);
  out.owlStartled = owl.state;
  await wait(3500);
  out.owlGone = { state: owl.state, visible: owl.model.rig.root.visible };
  p.place(owl.def.x + 30, owl.def.z + 5, g);
  g.cam.focus.set(owl.def.x, 1, owl.def.z);
  owl.t = 30;
  await wait(300);
  out.owlBack = { state: owl.state, visible: owl.model.rig.root.visible };
  // A deer bolts when the knight walks up.
  const deer = g.critters.find((c) => c.def.kind === 'deer');
  p.place(deer.x + 3, deer.z, g);
  g.cam.focus.set(p.x, p.y, p.z);
  const d0 = Math.hypot(deer.x - p.x, deer.z - p.z);
  await wait(900);
  out.deer = { state: deer.state, movedAway: Math.hypot(deer.x - p.x, deer.z - p.z) > d0 + 0.5 };
})();
window.__report = () => out;
