// On the Tide Serpent (run with &realm=aqua): it swims the sea inside the map's edges, at any depth, and the knight
// gets on and off it where the sea meets ground no higher than a metre above the surface (in the diving suit,
// anywhere in the sea). No way out of the world, with the suit or without; nothing left unreachable; and against
// the knight on foot without the suit, nothing the story keeps shut that the serpent reaches first. (Places only
// the serpent reaches before the suit are meant: the wreck's deck, a tower's top, foes it can shoot from the surface,
// the islands out in the sea (the Whalebone Isle's trial, Gull Rock where Kip is caged: the sea is all that keeps
// them, and the serpent is the sea's way); what the story keeps shut is the tyrant, his hall, a captive's cage, the
// trial.) Without the suit the serpent keeps to the surface, so what lies on the sea floor under it (the bell, the
// palace's landing and gate, a lore stone in the kingdom) isn't reached by swimming over it: only where it puts
// him ashore near it.
const g = window.__game;
const foot = window.__reach(false);
const bare = window.__reach(false, undefined, true);
const done = window.__reach(true, undefined, true);
const shut = (w) => /tidelord|king|warden|cage|trial|palace|bell|floodgate/i.test(w);
const early = foot.unreachable.map((u) => u.what).filter((w) => !bare.unreachable.some((u) => u.what === w)).filter((w, i, a) => a.indexOf(w) === i);
// Ashore near it (ground the flood stood on, not only the water the serpent swam over).
const ashore = (u) => {
  for (let dz = -3; dz <= 3; dz++)
    for (let dx = -3; dx <= 3; dx++) {
      const x = Math.floor(u.x) + dx, z = Math.floor(u.z) + dz;
      if (bare.reached(x, z) && Math.hypot(x + 0.5 - u.x, z + 0.5 - u.z) <= 2.7) return true;
    }
  return false;
};
const at = (w) => foot.unreachable.find((u) => u.what === w);
const underSea = early.filter((w) => !ashore(at(w)));
// The islands out in the sea, nothing but deep water round them.
const ISLANDS = ['Trial', 'cage'];
const islands = early.filter((w) => ISLANDS.includes(w) && ashore(at(w)));
const skips = early.filter((w) => shut(w) && ashore(at(w)) && !ISLANDS.includes(w));
const out = {
  foot: { reachable: foot.reachable, escapes: foot.escapes.length },
  serpent: { reachable: bare.reachable, escapes: bare.escapes.length, more: bare.reachable - foot.reachable },
  suit: { reachable: done.reachable, escapes: done.escapes.length, unreachable: done.unreachable, traps: done.trapCount },
  early,
  underSea: underSea.filter(shut),
  islands,
  skips,
};
out.ok = out.serpent.escapes === 0 && out.suit.escapes === 0 && out.suit.unreachable.length === 0 && out.serpent.more > 0 && skips.length === 0;
window.__report = () => out;
