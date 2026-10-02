# Difficulty and how it scales

The knight's strength, the foes' toughness, bosses, hazards and coins in each built realm, the formulas behind them, and where today's rules run out.

| | Realm 1 | Realm 2 | Realm 3 (after group 36's balance) |
|---|---|---|---|
| The knight on arrival | Sword level 0 (x1.00), 5 hearts, 3 flasks | Level 3 (x1.75), 6 hearts, 6 flasks, the Crest | Level 5 (x2.25), 8 hearts, 6 flasks, the Crest and the Seed, the stag |
| The knight at the end | Level 2-3, 6 hearts, 6 flasks | Level 5 (x2.05 when measured; x2.25 since the tempers went to +25% a level), 8 hearts, the Crest and the Seed, the stag | Level 7 (x2.75), 9 hearts, flasks that heal 3 (glowing bait), the Tide Pearl and the storm lantern, the serpent |
| Foe toughness (`foeHp`) | x1.0 | x1.6 | x2.25 |
| Blows for a goblin on arrival | 3 | 3 | 3 |
| Placed foes, and their health | 55, 206 | 54, 277 (+34%) | 62, 682 (the two mini-bosses 194 of it, from 126: Brassbelly 42 and Old Inkarm 44 before the x2.25; a felled jelly's halves add 41 in all) |
| Opening blows to clear them all: entry sword, end sword | 206, 147 (-29%) | 173, 168 (-3%) | 303, 285 (-6%); without the mini-bosses 217, 214 (-1%) |
| Foes per 1,000 m² of walkable ground | 4.6 | 5.2 | 4.1 (land and sea floor) |
| Biggest group; placed elites | 8; 3 | 5; 0 | 5; 1, and 2 mini-bosses |
| Foes that cause an effect | 49% | 35% | 39% (a harpoon's reel counted) |
| Ranged foes; of them standing still | 36%; 5 of 20 | 41%; 14 of 22 | 13%; 7 of 8 |
| Hazards | 5 arrow slits, 2 chandeliers, the gorge, 6 firepot throwers | 7 snare traps, 3 thorn strips, the chasm, 1 thrower | 6 giant clams, the abyss, air (never a heart); nothing burns |
| Tyrant (a player-like bot at the expected sword) | 48 health: 29 s, 6 hearts lost | 54 health: 68-73 s, 6-8 hearts lost | 105 health: 52-61 s at level 6, 0-4 hearts lost (group 35's 95 health: 58 s, 2-3 hearts) |
| Mini-bosses (the same bot, with the sword a knight brings) | None (3 elites) | None | Brassbelly 42 health (94.5 at x2.25; 30 before group 36): 34-45 s at level 5, 0-4 hearts lost; Old Inkarm 44 (99; 26 before): 49-69 s, 0-2 hearts |
| Trial | 11 foes, 56 health | 11 foes, 86 health | 11 foes, 119 health |
| Coins: earned, to spend, left over | ~1,215; 630-770; 375-733 | ~1,445; 960; 850-1,370 with nothing left to buy | ~2,700 (chests 1,840, quests 290, the trial 100, foes ~400, pearls 72); 1,860; about 840 of its own on top of what the knight brings (chests, quests and the trial alone pay 20% over what it sells) |

How it works today:
- Foes take as many blows with the sword the knight brings as realm 1's took with a new one (`foeHp`).
- Every hit costs one heart, in every realm, from every source.
- Each tyrant and mini-boss is tuned by hand, so a player-like bot wins in about a minute at the expected
  sword, losing well under the hearts it has.
- Each realm's chests, quests and trial pay for what it sells, with a modest surplus.

So realm 2 is harder **in kind**, not in numbers: snares, lobbed seeds, hidden traps, timed thorns and a
tyrant that keeps away, while groups, elites and effect-causing foes went down. Upgrades mattered less:
they cut realm 1's work by 29% but realm 2's by 3% (the level-5 temper changed no placed foe's blows), so
the tempers now add +25% a level, as sharpening does.

Realm 3 is harder **in kind** again, and in amount: about half again as many opening blows as realm 1 on
arrival (303 against 206, of them 86 for its two mini-bosses, 56 before group 36), its threats mostly up close
(ranged foes 13%, from 36-41%), and air, floating and currents to fight in. Upgrades matter less than ever:
+25% of the base is +11% on what a level-5 sword does, and the two coral edges cut its work by 6% (by 1%
without the mini-bosses).

In formulas (`src/game/player.ts`, `enemies.ts`, `game.ts`):
```
sword damage   D(L) = 1 + 0.25·L   (the tempers past level 3 were +0.15 until 2026-10-01)
foe health     base · foeHp (x3 elite, x1.5 golden: never a boss or mini-boss); tyrants not scaled
the realm rule ceil(base·foeHp / D(L on arrival)) = ceil(base / D(0)), so foeHp ≈ D(L on arrival)
hearts         5 + one per set of 3 shards + relics; flasks at most 6, 2 hearts each (3 with glowing bait)
prices         sword [80, 150, 240, 400, 560, 640, 720] by level; flask 60 + 40·(max - 3)
```

Where today's rules run out:
1. Hearts rise every realm while every hit still costs one heart: 6, 8 and 9 by the ends of realms 1 to 3,
   and realm 3's glowing bait makes each flask heal 3. Later realms get easier unless something else rises
   ([realm 4's draft plan](../../board/plans/realm-4-draft.md): a boss's or a mini-boss's blow costs two hearts).
2. The sword's price list stops at level 7 (realm 3's coral-smith added 640 and 720); realm 4 needs more
   levels, or another kind of upgrade (its draft: a curved edge that adds reach, not damage).
3. A level adds +25% of the base (the tempers were +15%, which rarely changed a blow count), so less and
   less of what the sword already does: +11% at level 6, +10% at level 7.
4. Flasks reach their cap of 6 in realm 1 (realm 3 makes each heal more instead).
5. Coins: each village now sells wares of its own (src/game/wares.ts: barding in Keepsfoot, boots and a
   tonic in Hollowbough, an air bladder and a lodestone, the prototype's coin magnet, on the reef); the
   combo keeper is left (realm 4's draft sells it). Realm 3's content round paid about twice what its
   village sells; group 36 brought it to 20% over (chests 1,840, quests 290, the trial 100: 2,230 against
   1,860), the foes' coins (about 400) and the clams' pearls (72) on top (tests/economy3.js).
6. Tyrants and mini-bosses are set by hand, and the code names each one.
7. The realm order isn't enforced (menu travel), so the sword a realm assumes isn't guaranteed: Whisperwood
   at level 0 is 46% more work, the Sunken Reef at level 3 37% (416 opening blows against 303).

See also: [Foes and effects](../play/foes.md), [Realm scores](realm-scores.md), [For later realms](later-realms.md), [the board](../../board/README.md) (realm 4's draft plan).
