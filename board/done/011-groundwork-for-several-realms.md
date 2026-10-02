---
id: 011
title: Groundwork for several realms
realm: all
area: systems
status: done
group: 11
plan: realm-2
created: 2026-09-28
done: 2026-09-28
owner: lead
depends: []
links: [../plans/realm-2.md]
---

# 011 Groundwork for several realms

The realm registry, save version 2 and the code split that let the game hold several realms; nothing in realm 1 changes. The plan's design notes for it ("How the game picks and switches realms", "How the save holds several realms", "What moves out of realm1.ts and game.ts") are in [the realm 2 plan](../plans/realm-2.md).

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## In the plan

- [x] **11 Groundwork.** Done 2026-09-28 (see Done).

## Done 2026-09-28: what was built and checked

- 2026-09-28: **Group 11, groundwork for several realms.** Nothing in realm 1 looks or plays differently.
  - Realm registry (`src/game/realms.ts`): each realm's map, outskirts, story module, quests and light.
    One realm is built per page load; `?realm=forest` picks one (tests, and a way in before the borders
    exist); with `?debug`, N and B cross to the next or previous realm. A border crossing saves, fades,
    reloads with a travel card ("Blackpine → The Old Wood") and comes out at the other end.
  - Save version 2: what the knight carries at the top, each realm under `realms.<id>`. Version-1 saves
    migrate with every field kept (the Crest becomes `relics: ['crest']`).
  - Moved out of `realm1.ts` into `src/world/realm.ts`: the realm types, the ground tests, tree scatter,
    lantern rows, the detail pass (scatter, lily pads, wildlife, owls). Out of `game.ts` into
    `src/game/story/castle.ts`: levers, the cage, cleared groups, special talks, region triggers, the
    King's lines, victory text. Realm data instead of hard-coded numbers: arrow slits, chandeliers, the
    boss arena, camp drums, the inn's tune, title camera, debug spots, the trial (waves, relic, purse).
    Quests are per realm. Whisperwood is a bare stub for now (group 13 builds it).
  - Review: all 30 checks ran; every realm-1 report matches an untouched baseline run (same reachable
    cells, spawns, rigs, light counts). Found and fixed in my own work: loading a save could stash a blank
    realm over the loaded one (split `view` from `select`); a crossing could let a late timer or the
    page-hide save write this realm's data into the next (all writes stop once a crossing starts); the new
    migration check stood the knight where a thief bat could take coins (moved to the hearth).
  - Checks: new `migrate` (a real version-1 save, every field compared) and `travel` (to Whisperwood and
    back: card, arrival, horse, coins, both realms kept). `tools/shot.mjs` takes `AFTER=` scripts to follow
    a reload. `review.js`, `trial.js` and `playthrough.js` read the new save layout.
