# Style

How the code is written, and how the board, the docs and the game's own words are written. The rule under all of
it: **match what is already there.** Read the file you are about to change and write the way it does. Where things
are: [architecture.md](architecture.md) and [layout.md](layout.md).

## Code

### Shape

- TypeScript, strict (`tsconfig.json`: `strict`, `noUnusedLocals`), ES modules, no framework: Three.js, Web Audio
  and the DOM directly. Type-check with `npx tsc --noEmit -p .` before you finish.
- Two-space indent, single quotes, semicolons, trailing commas in multi-line literals. There is no formatter config:
  the code's own layout is the standard. Lines run long where the content is a row of data (a spawn list, an NPC, a
  light, a check in `tools/test-all.mjs`); most stay under 120 characters, comments wrap near 115.
- **Never reformat, reorder or rename code you aren't changing.** Work from parallel copies is merged back 3-way,
  and edits that stay local merge cleanly; a reflowed block conflicts with everyone.
- **Keep each file's line endings** (CRLF or LF: see [CLAUDE.md](../../CLAUDE.md)). A scripted edit writes back the ending it read.
- Small functions with one job, named for what they do in the game (`openChest`, `dropSuit`, `takeSuit`,
  `garrisonFalls`). Big things are classes that keep their state between frames (`TideSerpent`, `SerpentPen`,
  `SunkenBell`) with `update(dt, g)` or `tick(g, dt)`.
- **Data over branches.** Places, people, foes, objects and quests are tables (`ObjDef[]`, `NpcDef[]`,
  `EnemySpawn[]`, `QUESTS`, `WARES`, `TRACKS`). A realm's differences are optional fields on its `RealmDef` or
  `RealmData` (`sea`, `physics`, `noFire`, `foeHp`, `bubbles`, `muffle`, `wip`), not `if (realm === 'aqua')`: the
  code tests a realm's id in one place only (`setFoePalette` in `src/game/models.ts`).
- **Tuning numbers in `src/config.ts`** (`PLAYER`, `FOES`, `EFFECTS`, `HAZARDS`, `AIR`, `VIEW`), so balance is
  changed in one place. A realm's own numbers sit in its `RealmDef`/`RealmData`; a place's coordinates as named
  constants at the top of its module (`VILLAGE`, `HALL`, `BELL`, `GULL_ROCK`, `KIP_SWIM`).
- Saves never break: spawns are only appended (retire one with `off: true`), ids are never renamed, new save fields
  get a default for old saves.
- Randomness that shapes the world is seeded (`mulberry32(3033)`, `diceAt(x, z)`), so a realm builds the same
  every time; `Math.random()` only for things that come and go (particles, idle animation, golden foes).

### Names

- Classes in PascalCase, named for the thing in the world: `TideSerpent`, `DarkLamp`, `ReefFolk`, `GiantClam`.
- Functions and methods in camelCase, verbs: `build<Part>` (a world module's entry: draws its props, returns its
  data), `make<Model>` (a character), `paint<Place>` (the ground) then `dress<Place>` (the props on it),
  `<kind>Update` (a foe's behaviour).
- Constants and tables in UPPER_CASE: `FOES`, `REALMS`, `QUESTS`, `WARES`, `PAL`, `HALL`, `FLOODGATE`.
- Short names for what is everywhere: `g` the game, `b` the builder, `p` the player (or a `Painter`), `r` a random
  stream, `e` an enemy, `s` a spawn or a structure, `x, z` the ground plane, `y` up, `dt` seconds this frame.
- Ids are lower-case words: realms `castle`, `forest`, `aqua`; moonfires `reefstair`, `coralvillage`; people
  `gannet`, `kiphome`; flags `costume`, `garrison`, `lampLit`, `boss`.

### Comments

Comments are **plain English sentences, with full stops, about the game world and the reason**, in the same voice
as the docs: the knight, the crew, the tide, not "the player entity" or "obj". They say what something is for and
why it is so; they don't restate the code. Asides go in brackets. Numbers come with their source.

From the code:

```ts
// Browsers only allow sound after a gesture.

/** Reading, talking or watching a cutscene: foes, arrows and effects all wait. */

/** Water deeper than this cannot be walked (or jumped) into. */
export const DEEP = 0.55;

/** Retired from the realm (kept in the list so later save ids don't shift). */
off?: boolean;

// (Only when explore mode itself was switched: another toggle mustn't lift or land the knight.)

// Under the surface everything floats (the prototype's: gravity x0.53, jump x0.77, falling x0.4, the knight x0.85).

// (Set where it stands once, even far off: else its model waits at the world's origin, drawn whenever the
// view takes in that corner.)
```

- `/** ... */` on fields, types and functions: what it is (`/** Head under the surface. */`).
- `//` inside code: why, or what a block does (`// Keep off each other.`).
- A banner at the top of a module says in words what it holds and how it plays, as `src/game/tidelord.ts`,
  `src/game/serpent.ts` and `src/world/realm3.ts` do, with the `// ----` rule above and below.
- Section markers inside long functions: `// ---------- world ----------`.
- Point to where the rest lives: `(src/game/serpent.ts)`, `(tests/lights.js)`.
- No TODOs, no commented-out code, no "we". When a comment goes stale with your change, change it too.

### Tests and tools

Checks in `tests/` are plain scripts that `tools/shot.mjs` runs in the page: they open with a comment saying what
they check, take the game as `const g = window.__game`, drive it, and give `window.__report = () => out`, an object
of named results a person can read. [Testing](../testing/testing.md) has the rest.

## Writing: the board, the docs, the game

### Everywhere

- British spelling: colour, armour, metre, grey, centre, travelled, harbour. (Names in code that touch Three.js or
  the DOM keep theirs, `color`; a few older names are American, `ARMORED_BOAR`, `armored`: leave them, but write
  new comments and words the British way.)
- Plain English, short sentences, concrete: paths, commands, numbers, names of places. No marketing words
  ("seamless", "robust", "immersive"), no hedging filler.
- Name things as the game does: the knight, the Keep, Whisperwood, the Sunken Reef, Brassbelly the Salvager, Old
  Inkarm, the Tidelord, moonfires, Moon Shards, the diving suit, the Thornstag, the Tide Serpent.

### The board and the docs

The board's entries say what was asked (in the user's words when there are some), what was done, the numbers before
and after, and how it was checked. How an item is filed is in [the board's README](../../board/README.md). From
[063](../../board/done/063-realm-1-vs-realm-2-compared.md) and [036](../../board/done/036-reef-review-and-balance.md):

> - 2026-10-01: **Realm 1 vs realm 2 compared** (asked: what is common, what is unique, difficulty per realm and how
>   it scales ...). The code was read by 9 agents (3 inventories checked by a second agent), plus 28 screenshots.
>   Nothing in `src/` changed. Found: ...

> the boss fights (Brassbelly 42 health and a 1.2 s steam ring, never while the knight is dazed: a level-5 bot
> 34-45 s, 0-3 hearts; ...)

- A date and a bold title; the ask in brackets; colons and semicolons to chain facts; `before -> after`.
- Say what was not done and why ("Not done (the agents stopped at the usage limit): ...").
- Decisions are written as decided, with who decided ("Decided (2026-10-02, the user: ...)").
- Docs follow the tone of [the README](../../README.md) and [the play pages](../play/controls.md): second person for players ("hold jump against them to climb"), plain statements
  for agents. Give the command to run, not a description of it.

### In-game words

Every realm speaks in **its own voice**, and that voice is part of the 60% that is the realm's own. Lines are short,
spoken, and mostly without contractions; they tell the player where to go through the speaker's own life.

- **The Moonlit Keep**: old courtesy and plain country talk. *"A knight? On this road, at this hour? Then the moon
  has not given up on us."* *"Mind the archers on the towers, sir knight."* Lore: *"Seven stones for seven kings
  who kept the road. The eighth stone was never raised."*
- **Whisperwood**: the wood as a living thing, quiet and grave. *"He kept this wood once. Now the wood keeps him,
  and it keeps nobody else."* (Alder the Reeve)
- **The Sunken Reef**: salt, practical, a little dry. *"The tide took our harbour. We built on the coral instead."*
  (Gannet) *"I fill the Moon Flasks at the shrine on the green. Same moon, saltier water."* (Dulse) *"No forge here,
  and no fire. Coral is filed, not forged."* (Shale) Old Tally's hints all begin *"The tide says: ..."*.

Toasts are a short title and a lower-key line, no full stop: `'The coral shrine', 'Whatever carries you is whole
already'`; rewards name their sum: `'40 coins', 'the pearls Kip hid from the crew'`. A tyrant's card is a name and a
title in capitals (`'The Tidelord', 'LORD OF THE DEEP'`); its lines are one breath each (`'The deep... claims
me...'`). Keep the prototype's words where it had them (village lines, boss lines, lore in `s49.js`), and never copy
one realm's lines into another: a repeated line is a common part the player notices.
