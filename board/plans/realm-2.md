# Realm 2 plan (agreed 2026-09-28)

> Moved from BOARD.md on 2026-10-02, word for word, with a link added to each group's task file (and group 36
> ticked). Where the text says "(see Done)" or "checks recorded under Done", the record is now in that task file.
> REALMS.md and README's realm sections have since been split into docs/; where the text sends a reader there, it
> now links to the new file. How the board works: [board/README.md](../README.md).

Realm 2 is **Whisperwood**, the prototype's second realm (source: `C:\Users\Ed\Downloads\eight-realms-source`),
rebuilt the way realm 1 was: the prototype's tyrant, creature, mount, village, captive, hazard,
set piece, relic, fortress and arena become places and systems on an open 120 x 120 map, plus
side content. The realms are neighbouring lands, crossed on foot or by mount; each border opens
with the beast freed in the realm before (the Warhorse's charge opens the way to Whisperwood).
**A border needs the right beast, never a beaten tyrant**: you can go back and forth between realms
whether or not they are finished (asked for on 2026-09-28). For testing: `?realm=forest` in the URL,
and with `?debug` the keys N and B cross to the next or previous realm from anywhere.

**How the game picks and switches realms**
- Realm ids follow the prototype: `castle` (the Moonlit Keep), `forest` (Whisperwood), then aqua,
  desert, ice, lava, storm, void. A registry (`src/game/realms.ts`) lists each realm's map
  builder, outskirts, story module, quests, palette and borders.
- One realm is built per page load. Crossing a border saves (current realm + where you arrive)
  and reloads; the loading screen shows a travel card ("Blackpine → the Old Wood") and the knight
  comes out at the other end of the same path, without the title screen. A realm build takes
  about a third of a second, so this stays quick. Tests pick a realm with `?realm=forest`.

**How the save holds several realms (version 2)**
- Top level: what the knight carries (coins, flasks, sword, relics, freed mounts, deaths, play
  time, foes felled). Under `realms.<id>`: everything about a place (last moonfire, chests,
  moonfires lit, lore read, walls broken, shards, felled foes, explored land, quests, story flags).
- A version-1 save becomes `realms.castle` plus the carried part, keeping every field; the
  Knight's Crest becomes `relics: ['crest']`. A check writes a real version-1 save and compares
  every field after loading.

**What moves out of `realm1.ts` and `game.ts`**
- `src/world/realm.ts` (new): the realm types, and map helpers realm 1 wrote inline: the
  flat-ground / near-road / clear-of-colliders tests, tree scatter, lantern rows along a road,
  the detail pass (scatter, lily pads on still water, wildlife, owls on dead trees), water points.
- `outskirts.ts`: the painter takes each realm's biomes, river, lake and roads instead of
  realm 1's (realm 1's move into its own spec).
- `game.ts` keeps the generic flow and hands realm moments to a story module
  (`src/game/story/castle.ts` now, `forest.ts` later): what levers, cages, doors and cleared
  groups do, special talks, region triggers, hints, boss intro and death, victory text, what
  `__reach` opens. Realm data instead of hard-coded realm 1 numbers: the boss arena, arrow slits,
  chandeliers, camp drums and tavern music, title camera, debug spots, the night palette.
  Quests become per realm. Goblins and archers get a palette so each realm can recolour them.

**Groups** (each reviewed afterwards; checks recorded under Done)
- [x] **11 Groundwork.** ([task 011](../done/011-groundwork-for-several-realms.md)) Done 2026-09-28 (see Done).
- [x] **12 The way to Whisperwood.** ([task 012](../done/012-the-way-to-whisperwood.md)) Done 2026-09-28 (see Done).
- [x] **13 Whisperwood's land.** ([task 013](../done/013-whisperwood-land.md)) Done 2026-09-28 (see Done).
- [x] **14 Whisperwood's foes and hazards.** ([task 014](../done/014-whisperwood-foes-and-hazards.md)) Done 2026-09-28 (see Done).
- [x] **15 Climbing and the Thornstag.** ([task 015](../done/015-climbing-and-the-thornstag.md)) Done 2026-09-28 (see Done).
- [x] **16 People, quests and secrets.** ([task 016](../done/016-whisperwood-people-quests-secrets.md)) Done 2026-09-28 (see Done).
- [x] **16b Whisperwood relaid.** ([task 047](../done/047-whisperwood-relaid.md)) Done 2026-09-28 (see Done): woods by zone, a roomier village, a place with
  a purpose in every part of the map.
- [x] **17 The Warden's Hold and the Thorn Warden.** ([task 017](../done/017-wardens-hold-and-the-thorn-warden.md)) Done 2026-09-28 (see Done). Wall of thorn trees, the gate lever on a
  tree-tower roof, the drawbridge over the thorn moat, the garrison, the arena inside the Great
  Tree; the boss (arrow volleys, arrow rain on marked spots, summons; enraged, roots burst from the
  floor), victory and dawn; the sea-cliff stair to realm 3 visible but closed. Checks: the boss
  fight, a playthrough.
- [x] **18 Review and balance.** ([task 018](../done/018-review-and-balance-realm-2.md)) Done 2026-09-28 (see Done). Prices, difficulty (hearts can reach 8 by the end of realm 2),
  performance and phones in the new realm, the pause-menu world map (the prototype's, filled in as
  you travel), README. Checks: the full suite in both realms.
