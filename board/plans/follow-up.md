# Follow-up plan (agreed 2026-10-01: "note all of this, and start doing everything")

> Moved from BOARD.md on 2026-10-02, word for word, with a link added to each group's task file (and group 36
> ticked). Where the text says "(see Done)" or "checks recorded under Done", the record is now in that task file.
> REALMS.md and README's realm sections have since been split into docs/; where the text sends a reader there, it
> now links to the new file. How the board works: [board/README.md](../README.md).

From the realm comparison ([REALMS.md](../../docs/design/realm-scores.md)): realm 2 is about two thirds the same as realm 1 against an aim of
about 40% common, and the extra sameness sits in its foes, its music, its words and the map's frame. Each
group is reviewed afterwards; checks are recorded under Done. Realm 2's frame (its size, its direction,
its counts) stays as it is: how later realms vary theirs is a note in [REALMS.md](../../docs/design/later-realms.md) for when realm 3 is
planned, and the way on to realm 3 waits for that too.

- [x] **20 Notes.** ([task 020](../done/020-notes-realms-comparison.md)) Done 2026-10-01: [REALMS.md](../../docs/design/common-and-unique.md) (the comparison, the 40/60 aim, difficulty and how it
  scales); the aim added to the design rules; this plan.
- [x] **21 Fixes from the comparison.** ([task 021](../done/021-fixes-from-the-comparison.md)) Done 2026-10-01 (each checked in the game; reach, spawns and the new
  ambush check pass in both realms):
  - Realm 2's ground mist: each realm's light now sets the mist's height (`mistLevel`, `src/game/realms.ts`);
    Whisperwood's lies 1.2 m over its 2 m floor, as the Keep's does over its fields (it showed only in Rookfall).
  - Things on the camera's line: the lodge home tree moved off the Gatherers' Clearing (to the Whisper's bank,
    without its treehouse), the inn tree off the Ring of Oaks (to the bay's south shore by the kilns lane; Bram's
    round shortened to match), a grove giant oak off the Old Owl's snag, the border pines off the brook below
    the goblins' camp. (Checked by casting rays from the camera: the clearing went from 16 of 17 points hidden
    to 1, the ring 16 to 5, the owl 17 to 2.)
  - Garrison archer #46 out of the Blackwater onto the plateau's lip (29, 24.8); spitter #23 off the cliff top
    onto the ravine's shelf (60.5, 11.8), where it fights.
  - The shortcut round the east loop: real (the Blackwater's shallows ran along the foot of the Warden's cliff,
    64 m from the village to his stair against 139 m round). The quest never stuck (a later step completes the
    earlier ones), but the realm's route and half its content were skippable: the mere is now deep right up to
    the cliff, and the quickest way passes the Thorn Ravine (128 m). The Fallen Giant stays a pathless find.
  - The Rookfall bridge can be walked round at the gorge's north end (28 m against 13): left as it is, it's
    how you find the Rookery's chest and lore.
  - Region names: Bryony's forge and the fisher's tree read Hollowbough (the Deer Meadow's name covered them);
    realm 1's drawbridge deck reads the Outer Bailey (it fell through to "The King's Road").
  - Realm 1's empty ground behind the keep's west wall (about 330 m², reachable north from the Overlook) is
    now the Kings' Orchard: old oaks gone wild, moonflowers, a lore stone, no path and no coins.
  - Signs: the Old Lodge's sign has its post; Whisperwood's two signs, which had no model at all, are standing
    stones with a pale blaze cut in them (the arrival's moved 2 m off the warhorse's spot).
  - Realm 1's stream runs on into the Mirrow (it stopped a metre short, leaving a dry way round it); the dead
    `arenaGate` object is gone; a smith never sells past the price list (a level without a price would have
    cost nothing); stale notes about the Sea Stair and the east gorge corrected in the code.
  - Left open: the Ash family's home tree's crown still covers Old Nettle's glade (12 of 17 points). Crowns fade
    when the knight walks under them; moving the tree or the glade reshuffles the village's crown shapes.
- [x] **22 Realm 2's own words.** ([task 022](../done/022-realm-2-own-words.md)) Done 2026-10-01: Wren's three lines, Moss's welcome, the trial's prompt and
  toasts, the cage's line, the victory card, the innkeeper's and the thorn wall's lines, the quest steps that
  copied realm 1's, all written for the Old Wood; the child called Pip at the fire is now Sprig. (The Reeve's,
  Bryony's and Ash's first lines are the prototype's own and stay.)
- [x] **23 Realm 2's own music and sounds.** ([task 023](../done/023-realm-2-own-music-and-sounds.md)) Done 2026-10-01: Whisperwood plays its own versions of the moods
  (`REALM_TRACKS` in `src/audio/music.ts`), grown from the prototype's forest track: the road 88 bpm in D Dorian
  with a flute over harp and cello and soft hand drums, the village a 92 bpm waltz, the woods slower and
  sparser, an oboe in the Warden's hold, its own fight and dawn; its nights have birdsong (more at dawn). The
  Keep's music is unchanged. Checked in the game: each place picks the realm's track, no errors (still never
  heard: the test browser is muted).
- [x] **24 Realm 2's own foes.** ([task 024](../done/024-realm-2-own-foes.md)) Done 2026-10-01: goblins with bark masks, crowns of leaves and twigs and
  thorned clubs, shield goblins with bark shields set with thorns, moss-grown archers with crowns of branches
  and branch bows (`woodGoblin`, `FOE_LOOK` in `src/game/models.ts`); the thieves outside the Bat Roost are
  rooks (the Roost keeps bats: `plain` on a spawn); the Mossfen's darter is a spitter in the reeds, the Kilns'
  firepot thrower a snarer; the prototype's ambush: three goblins hidden in bushes by the Old Grove's road (a
  'lurk' state: unseen, can't be struck, don't block, don't stop a rest) burst out as the knight passes
  (tests/ambush.js); an elite shield goblin at the end of the Thorn Ravine. Rechecked: foes2, oaks, the Hold,
  sister, folk, corners, hidden places, both economies, explore mode, spawns, reach. Foes went from about 75%
  common to about 41% ([REALMS.md](../../docs/design/realm-scores.md)).
- [x] **25 Coins and tempers.** ([task 025](../done/025-coins-and-tempers.md)) Done 2026-10-01: the tempers add +25% a level, as sharpening does (level 5:
  x2.25, was x2.05). Wares (`src/game/wares.ts`, carried from realm to realm in the save): Keepsfoot's smith
  sells barding (each piece one more hit for every mount, 90 and 210); Hollowbough's weaver silk-wrapped boots
  (+8% on foot a level, 80 and 200), Old Nettle a nettle tonic (the blue bar fills 40% faster a level, 90, 200,
  340), so she has a part to play. With the tempers that is about 1,870 to spend in Whisperwood against about
  1,520 earned there plus what Blackpine leaves over: a modest surplus for a knight who buys everything. The
  prototype's coin magnet and combo keeper are left for later realms' villages. (tests/wares.js, wares1.js.)
- [x] **26 The Thornstag's purpose.** ([task 026](../done/026-the-thornstags-purpose.md)) Done 2026-10-01: north of the Stag's Thicket a cleft runs through the
  wood's western wall into the heights, choked with living thorns a sword only scratches and the warhorse's
  charge can't break; the freed stag's thorn burst tears them away (saved), and beyond lies the stag's old bed,
  a mossy dell with a chest (55 coins, Wind Boots) and a lore stone. The owl has a hint for it. On the stag
  nothing climbs round it (reachstag2), and nothing is unreachable (reach2). (tests/stagbed.js.)
- [x] **27 Review.** ([task 027](../done/027-follow-up-review.md)) Done 2026-10-01: the full suite, 62 checks (4 new: ambush, stagbed, wares, wares1), every
  report read, none failing. The Warden's bot still wins at level 3 in 67 s losing 5 hearts; the dodger isn't hit;
  nothing unreachable and no way out in either realm, on foot or on the stag. Found in review and fixed: the
  mount's health bar said "Warhorse" on the Thornstag too. Familiarity measured again: realm 2 is about 58% realm
  1 (was 67%), foes about 41% (was 75%), sound about 60% (was 85%); what's left over is the shared frame and
  structure, kept on purpose ([REALMS.md](../../docs/design/common-and-unique.md)). README and REALMS.md brought up to date.

From the old board's Backlog (2026-10-01), under "High":

_The follow-up groups above (the 2026-10-01 comparison's findings are in groups 21 to 26)._
