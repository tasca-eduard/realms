# Realms: what they share, what each brings

A comparison of the two built realms, The Moonlit Keep (`castle`) and Whisperwood (`forest`), made on
2026-10-01 to see whether the game is on the right track before later realms are planned. The numbers
come from the code (both maps built with the game's own code and measured), the tests and BOARD.md's
measured runs, and 28 screenshots. The work that came out of it is in BOARD.md.

## The aim: about 40% common, 60% unique

Asked for on 2026-10-01: each realm about **40% common**, so the player knows where to go and what to
expect, and about **60% its own**: terrain, foes, mechanics and the rest.

Read that way, the common part is a realm's *grammar*: the shape of the quest (village, leader, the way,
the lever, the garrison, the tyrant), the village's services, the resting places and the rewards. The
unique part is its *vocabulary*: the land, the foes, the realm's own rules, its look and its music.

How it is scored: each part of a realm counts 1 if a player who finished the realm before would call it
the same thing (a recolour counts as the same), ½ if it has the same role in a clearly new form, 0 if
it is new. An estimate: read the shares as ±10.

## Realm 2 against realm 1 (2026-10-01)

| Area | Common | Reading |
|---|---|---|
| Quest steps | ~80% | The "where to go" part, so high is fine. But the captive and trial text was reused almost word for word, and a Pip lives in both villages |
| Rewards: chests, shards, the trial, moonfires | ~85% | Fine, the same reason |
| Village services | ~60% | Fine: the same services in a new kind of village |
| Stronghold and tyrant | ~60% | Fine: the same steps (lever, garrison, arena), a new fight |
| Map and route | ~75% | Too same: the same size, the same direction (south-east to north-west), the same counts |
| Kinds of place | ~40% | Near the aim; the marsh, the pine wood and the goblin camp are near twins |
| Terrain and look | ~55% | Near: new shapes and colour on the same trees and ground tiles |
| Mechanics | ~55% | On the aim: the knight's moveset is shared (as it should be), the realm's own rules are new |
| Foes | ~75% | Off: two thirds of what you fight are realm-1 foes in new colours |
| Music and sound | ~85% | Off: not one track of its own |
| **All** | **~67%** | **Aim: ~40%** |

Other measures of the same thing:
- 36 of realm 2's 54 placed foes are realm-1 types (67%); 46 stand on realm-1 bodies (85%). Only the
  spitter and the Warden run new AI.
- The ground-type mix overlaps 57%; realm 2 has no ground type of its own. 15 of its 29 regions have a
  realm-1 counterpart.
- In screenshots about 45% of the picture looks familiar; the colour of the light does most of the
  separating (realm 1's shots sit at hue 209-253°, realm 2's at 150-168°).
- Realm 2 plays 8 of realm 1's 9 music tracks and adds none; 69 of its 73 sound effects are realm 1's.
- The user's feedback on realm 2 never said it was too similar: every complaint asked for realm 1's
  quality (real zones, a purpose everywhere, nothing man-made in the wild). The land is where that work
  went, and it is the most original part. Foes and music got no such pass.

## After the follow-up (2026-10-01, same scoring)

The follow-up (BOARD.md, groups 20 to 27) went after the excess in realm 2 itself; the map's frame (its
size, direction and counts) was kept on purpose and is a note for later realms.

| Area | Before | After | What changed |
|---|---|---|---|
| Foes | ~75% | ~41% | Goblins, shield goblins and archers in the Old Wood's own gear; rooks for the thieves; the Mossfen's darter and the Kilns' firepot thrower replaced by the wood's own foes; the prototype's ambush in the Old Grove; an elite at the end of the Thorn Ravine. Of 57 placed foes, 2 are realm 1's as they were (the Bat Roost's bats), 43 the same kinds in a new form, 12 new |
| Music and sound | ~85% | ~60% | Its own version of every mood, grown from the prototype's forest track; birdsong |
| Quest steps | ~80% | ~70% | Its own words: no line copied from realm 1, no second Pip |
| Village services | ~60% | ~55% | Wares of its own (the weaver's boots, the herbwife's tonic); Keepsfoot's smith sells barding |
| Mechanics | ~55% | ~50% | The stag opens a way only it can (thorns that answer thorns); goblins that ambush |
| Rewards | ~85% | ~80% | The stag's bed and its chest |
| Kinds of place | ~40% | ~38% | The stag's bed (a dell in the heights) |
| **All** | **~67%** | **~58%** | Aim ~40%: what's left is the shared frame and structure, and the shared ground tiles and base trees |

## Common to both

| Area | Both realms |
|---|---|
| Map | 120 x 120 m; arrival in the south-east, stronghold in the north-west; a village with no foes in the middle; tall ground along the far (north and west) edges, water along the near ones; one border, the thorn road |
| Rhythm | 4 moonfires (arrival, village, mid-route, stronghold gate); 3 moon shards; 1 cracked wall; 1 cage; 1 lever that opens the stronghold; 1 garrison whose fall opens the arena; 53 objects each |
| Quests | The main quest's steps (village, leader, the way, the lever, the garrison, the tyrant, dawn); a captive whose sibling waits in the village; a relic trial of 3 waves (3/4/4 foes); 3 shards for a heart |
| Village | A leader who gives the main quest; an innkeeper (flasks); a smith (the sword); the captive's sibling; a hint-giver |
| Foes | Goblin, shield goblin, archer, bat, firepot thrower, bog darter: the same AI, speed and wind-ups; only colour and health change |
| The knight and the systems | The whole moveset; the status effects; the warhorse; falls cost a heart; moonfire rest; power-ups; saves per realm; the tyrant's flow (door shuts, two summon points, enrage at half health, dawn) |
| Look and sound | The same ground tiles, base trees (pine, oak, birch, dead tree), object models, camera and pixel look; the same music tracks and ambience |

## Unique to each

| | Realm 1: The Moonlit Keep | Realm 2: Whisperwood |
|---|---|---|
| Land | A stone keep with bailey, moat, drawbridge and towers; walk-in tavern, throne hall and cave; farmland, windmill, raided farm; graveyard and barrows; a cobbled village | A village of home trees round a lake (the Heart Oak's island, rope bridges); the High Canopy and its rope walk; Rookfall, a chasm inside the map; the Thorn Ravine; water on 18% of the map (realm 1: 7%); a green-teal night |
| Foes | Boars, brutes and shamans in the field; 3 elites | Spitter (rooted, lobs where you're heading: the only new AI), snarer (a bola that snares), thornback (pricks when struck before it's stunned) |
| Hazards and moves | Arrow slits; chandeliers; a war drum | Snare traps; thorn-burst strips; vines to climb; the Thornstag (double leap, thorn shield, thorn burst), freed from a guarded thicket |
| Tyrant | The Goblin King: a melee brawler (slams, charges, a jump-slam) | The Thorn Warden: keeps its distance; volleys along lines it shows, rain on marked spots, roots when enraged, a swipe then a leap back |
| Side content | The Old Warden's jobs: the raided farm, the lodge beast, the thorn road onward | Freeing the bound stag; villagers going about their day |
| Rewards | The Knight's Crest (cheaper blocks); 11 big chests | The Heartwood Seed (a heart); 22 smaller chests; 8 lore stones |

## Difficulty and how it scales

| | Realm 1 | Realm 2 |
|---|---|---|
| The knight on arrival | Sword level 0 (x1.00), 5 hearts, 3 flasks | Level 3 (x1.75), 6 hearts, 6 flasks, the Crest |
| The knight at the end | Level 2-3, 6 hearts, 6 flasks | Level 5 (x2.05 when measured; x2.25 since the tempers went to +25% a level), 8 hearts, the Crest and the Seed, the stag |
| Foe toughness (`foeHp`) | x1.0 | x1.6 |
| Blows for a goblin on arrival | 3 | 3 |
| Placed foes, and their health | 55, 206 | 54, 277 (+34%) |
| Opening blows to clear them all: entry sword, end sword | 206, 147 (-29%) | 173, 168 (-3%) |
| Foes per 1,000 m² of walkable ground | 4.6 | 5.2 |
| Biggest group; placed elites | 8; 3 | 5; 0 |
| Foes that cause an effect | 49% | 35% |
| Ranged foes; of them standing still | 36%; 5 of 20 | 41%; 14 of 22 |
| Hazards | 5 arrow slits, 2 chandeliers, the gorge, 6 firepot throwers | 7 snare traps, 3 thorn strips, the chasm, 1 thrower |
| Tyrant (a player-like bot at the expected sword) | 48 health: 29 s, 6 hearts lost | 54 health: 68-73 s, 6-8 hearts lost |
| Trial | 11 foes, 56 health | 11 foes, 86 health |
| Coins: earned, to spend, left over | ~1,215; 630-770; 375-733 | ~1,445; 960; 850-1,370 with nothing left to buy |

How it works today:
- Foes take as many blows with the sword the knight brings as realm 1's took with a new one (`foeHp`).
- Every hit costs one heart, in every realm, from every source.
- Each tyrant is tuned by hand, so a player-like bot wins in about a minute at the expected sword.
- Each realm's chests, quests and trial pay for what it sells, with a modest surplus.

So realm 2 is harder **in kind**, not in numbers: snares, lobbed seeds, hidden traps, timed thorns and a
tyrant that keeps away, while groups, elites and effect-causing foes went down. Upgrades mattered less:
they cut realm 1's work by 29% but realm 2's by 3% (the level-5 temper changed no placed foe's blows), so
the tempers now add +25% a level, as sharpening does.

In formulas (`src/game/player.ts`, `enemies.ts`, `game.ts`):
```
sword damage   D(L) = 1 + 0.25·L   (the tempers past level 3 were +0.15 until 2026-10-01)
foe health     base · foeHp (x3 elite, x1.5 golden); tyrants not scaled
the realm rule ceil(base·foeHp / D(L on arrival)) = ceil(base / D(0)), so foeHp ≈ D(L on arrival)
hearts         5 + one per set of 3 shards + relics; flasks at most 6, 2 hearts each
prices         sword [80, 150, 240, 400, 560] by level; flask 60 + 40·(max - 3)
```

Where today's rules run out:
1. Hearts rise every realm while every hit still costs one heart: later realms get easier unless
   something else rises.
2. The sword's price list stops at level 5 (a smith never sells past it now; a later realm needs more
   levels, or another kind of upgrade).
3. A level adds +25% (the tempers were +15%, which rarely changed a blow count).
4. Flasks reach their cap of 6 in realm 1.
5. Coins: each village now sells wares of its own (src/game/wares.ts: barding in Keepsfoot, boots and a
   tonic in Hollowbough); later realms can carry the prototype's other upgrades (coin magnet, combo keeper).
6. Tyrants are set by hand, and the code names each one.
7. The realm order isn't enforced (menu travel), so the sword a realm assumes isn't guaranteed: Whisperwood
   at level 0 is 46% more work.

## For later realms (notes, not a plan)

- The common part today is "whatever realm 1 had", copied whole: the same map size and direction, the
  same counts of moonfires, shards, cages and waves, even the same lines. Decide the common 40% on
  purpose (likely the quest's shape, the village's services, rest and rewards) and let the rest change.
- A realm's foes should be mostly its own: most of what the player fights, not one creature in a
  crowd of recoloured goblins.
- Each realm should sound like itself. The prototype had a track and an ambience per realm
  (`o40.js` TRACKS, `r22.js` THEMES_AMB).
- Each border opens with the beast freed in the realm before; give that beast something to open.
- Difficulty: revisit hit damage, the sword list, flasks and what coins buy before realm 3.
