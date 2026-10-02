---
id: 036
title: Review and balance (realm 3)
realm: 3
area: review
status: done
group: 36
plan: realm-3
created: 2026-10-01
done: 2026-10-02
owner: seven agents' copies, then a second round (merged by the lead)
depends: []
links: [../plans/realm-3.md, ../done/064-suite-on-the-merged-whole.md, ../backlog/067-ash-door-under-inn-tree-crown.md, ../backlog/068-ring-of-oaks-partly-hidden.md, ../../docs/design/realm-scores.md]
---

# 036 Review and balance (realm 3)

Realm 3's review and balance: the economy, toughness, the bosses' bots, how much is common with realms 1 and 2, performance and phones, its own light, a playthrough, README and REALMS.md.

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## In the plan

- [ ] **36 Review and balance.** The economy (chests, quests and the trial pay for the coral-smith and the wares
  with a modest surplus), toughness, the Tidelord's bot, how much is common with realms 1 and 2 (aim about 40%),
  performance (particles, lights) and phones, README, REALMS.md.

## Done 2026-10-02: what was built and checked (BOARD.md's "In progress" as it stood)

**36 Review and balance** for realm 3 (2026-10-02), most of it merged:
- Done: the economy (+20% over what it sells, was +90%); the docs (README; REALMS.md: about 48% common before the
  crew's new look); the suite brought up to date (90 checks; ten spawns moved out of posts and raised ground;
  timing-fragile serpent, sea and Tidelord checks steadied); the boss fights (Brassbelly 42 health and a 1.2 s steam
  ring, never while the knight is dazed: a level-5 bot 34-45 s, 0-3 hearts; Old Inkarm 44 health, a new bot: 53-69 s,
  0-2 hearts; the Tidelord 105 health, his lane and sweep fixed 0.8 s before, the tide at 1.25 m/s: 56-61 s, 0-3
  hearts, tidefair 3 of 3); a code review's fixes (the bell step, hooks, duplicate ids, the serpent); a playthrough
  from a fresh save to the victory (all 11 quests finish and stay done after reloads and travel; five flow-breakers
  fixed); the crew's own look (oilskins, crab-shell and barnacle helms, net shields, harpoons, a conch shaman); the
  story's spine (the village and Gannet first, the landing's crew hold the floodgate, no golden mini-bosses, realm 3
  off `wip`); its sound (surf, the inn, the temple and caves, the lighthouse, a mini-boss track; tests/seasound.js);
  phones and touch (HUD and prompts, the serpent's stroke, breaking Inkarm's grab).
- Not done (the agents stopped at the usage limit): **performance** on desktop and phones, and **realm 3's own light**
  (its night as blue as realm 1's) with first screens that show the sea.
- Decided (2026-10-02, the user: "do what is logic and makes sense for the story... gameplay wise you should be able
  to decide"): the serpent may carry the knight to islands (Gull Rock, the Whalebone Isle) before the diving suit,
  never under the water without it; the fishers' boats wait out past the reef until old Wick's lamp is lit, and only
  then fish by night; the harmless crabs small and their own colours (sand on the beaches, blue-violet in the
  shallows), the crab foe the big red-orange one.
- Done and merged (2026-10-02, the second round): performance (foes far from the knight were drawn at the map's
  origin in every realm, hidden in the cliff: now placed where they stand; sea life culled out of view; chests' and
  lore stones' shadows only near the view; on phones no kelp shadows and fewer shaft samples; the strand 323 -> 95
  draw calls, the other zones 8-20% fewer; basking seals cast no moon shadow); realm 3's own light (a turquoise night,
  hues 172-196 against realm 1's 205-253, a teal sea, sea-glass glints; its dawn in the same family) and Stairfoot
  Cove at the Sea Stair's foot, so the first screens show the sea; the world fixes (three flights of steps up to
  Brassbelly's yard; the second trench column on solid floor; a shelving shore round the lighthouse isle; the grottos'
  names only down in them; Jetsam's "south-east"); the gameplay fixes (the boats dark until Wick's lamp is lit; the
  harmless crabs small, sand-tan and blue-violet; the current race 7 breaths, about 5 for a clean ride; no combo
  bonus on mini-bosses or tyrants; Cockle's victory line; the daze tip names what dazed him); the phone HUD (combo,
  toasts, titles and prompts no longer overlap); the pad on a phone switches the touch controls off (and touch back);
  the reach check gives a diver his full climb only on floors deep enough (2.5 m); the bell step fires from all the
  kingdom's named places; Whisperwood: Old Nettle's herb spot moved into view, Ash standing at the front of his
  garden in view (0 of 17 hidden, was 17), the Mushroom Dell clear (one oak off the camera's line, its biggest
  mushroom moved); the docs (README; REALMS.md: realm 3 about 46% common, its foes 37%); the realm 4 draft plan
  (below). Left as known: Ash's door under the inn tree's crown; the Ring of Oaks partly hidden by Ash's home tree.
- In hand: the full suite (90 checks) on the merged whole, with an agent.

## Found in the first round's review (the committed board, 3a4b28d), all settled in the second round above

- To decide: the serpent can set the knight down at Kip's cage and the Whalebone Isle's trial before the diving suit
  (allowed for now); the fishing boats row out all night while old Wick says they wait out past the reef for his
  lamp; four kinds of crab look alike (two harmless, the crab foe, the giant clam's).
- Small things: Brassbelly's yard has no step up from the beach (0.9 m); the second trench column stands over the
  abyss; the lighthouse isle's east and south shores are a 2.8 m wall from the sea floor; the current race's time is
  far too generous (16 s for a 4.3 s route); a long combo on Brassbelly pays up to four times; the Glowing Grotto's
  name shows on the reef above it; Jetsam says "south" for south-east; Cockle has no victory line; the daze tip names
  the brute's maul when Brassbelly's anchor dazes; on phones the combo counter, toasts and prompts can overlap other
  HUD text; README and REALMS.md figures from before the balance; a full suite run on the merged whole.

## Left over

- The full suite on the merged whole: [064](../done/064-suite-on-the-merged-whole.md).
- Left as known: [067 Ash's door under the inn tree's crown](../backlog/067-ash-door-under-inn-tree-crown.md), [068 the Ring of Oaks partly hidden by Ash's home tree](../backlog/068-ring-of-oaks-partly-hidden.md).
- Committing it all is the user's: [065](../done/065-commit-the-merged-work.md).
