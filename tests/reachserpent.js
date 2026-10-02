// On the Tide Serpent (run with &realm=aqua): it swims the sea inside the map's edges, at any depth, and the knight
// gets on and off it where the sea meets ground no higher than a metre above the surface (in the diving suit,
// anywhere in the sea). No way out of the world, with the suit or without; nothing left unreachable; and against
// the knight on foot without the suit, nothing the story keeps shut that the serpent reaches first. (Places only
// the serpent reaches before the suit are meant: the wreck's deck, a tower's top, foes it can shoot from the surface;
// what the story keeps shut is the tyrant, his hall, a captive's cage, the trial.)
const foot = window.__reach(false);
const bare = window.__reach(false, undefined, true);
const done = window.__reach(true, undefined, true);
const shut = (w) => /tidelord|king|warden|cage|trial|palace|bell|floodgate/i.test(w);
const early = foot.unreachable.map((u) => u.what).filter((w) => !bare.unreachable.some((u) => u.what === w)).filter((w, i, a) => a.indexOf(w) === i);
const skips = early.filter(shut);
const out = {
  foot: { reachable: foot.reachable, escapes: foot.escapes.length },
  serpent: { reachable: bare.reachable, escapes: bare.escapes.length, more: bare.reachable - foot.reachable },
  suit: { reachable: done.reachable, escapes: done.escapes.length, unreachable: done.unreachable, traps: done.trapCount },
  early,
  skips,
};
out.ok = out.serpent.escapes === 0 && out.suit.escapes === 0 && out.suit.unreachable.length === 0 && out.serpent.more > 0 && skips.length === 0;
window.__report = () => out;
