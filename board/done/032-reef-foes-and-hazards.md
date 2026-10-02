---
id: 032
title: Foes and hazards (realm 3)
realm: 3
area: foes
status: done
group: 32
plan: realm-3
created: 2026-10-01
done: 2026-10-01
owner: agent copy (merged by the lead)
depends: []
links: [../plans/realm-3.md]
---

# 032 Foes and hazards (realm 3)

The Sunken Reef's own foes (the crew, divers, harpooners; the Jelly, crabs, eels, pufferfish) and giant clams.

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## Done 2026-10-01: what was built and checked

- [x] **32 Foes and hazards.** Done 2026-10-01 (an agent's copy, merged; placed here): the Sunken Reef's own foes
  (`src/game/seafoes.ts`, `src/game/seamodels.ts`, numbers in `FOES`), each as tough as the level-5 sword they're met
  with. The crew: goblin divers (a goblin's blows; they walk into deep water; a tin bucket, a copper kettle or a
  fishbowl on the head, a hose up to a red-topped cork float bobbing on the surface over them) and harpooners in
  yellow sou'westers (a line on the ground follows the knight, then holds still 0.45 s before the throw; struck, a
  heart and he's reeled in; a roll or a swing frees him, a shield stops it). Below, the sea's own, which can't leave
  deep water: the prototype's Jelly (squeezes, flashing, and lunges; felled, it splits into two little ones whose
  stings poison), the crab (blows from the front glance off its claw; it turns slowly and scuttles sideways; a heavy
  blow flips it onto its back), the eel (in a den where nothing reaches it; lunges along a held line, then pulls
  back), the pufferfish (a ring fills as it swells; its spikes burst; strike it small or winded). Giant clams (`clams`):
  a ring fills and they snap shut; struck open, a pearl (12 coins, once). Placed: harpooners and divers by the
  strand and the sandbar, divers in pairs, crabs and pufferfish in the gardens, jellies, eels and divers in the kelp,
  crabs, eels, divers and a jelly in the kingdom, an elite crab at its edge by the current, crew and a crab on the
  wreck, jellies in the trench, six clams (44 foes and the clams checked by spawns3). Checks: tests/seafoes.js (new);
  spawns3 lets divers and sea creatures start in deep water and flags a sea creature out of it. Left for 36: the
  pearls in the economy, the eel's two baits, the crab's maim chance.
