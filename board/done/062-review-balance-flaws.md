---
id: 062
title: Review, balance, flaws (realms 1 and 2)
realm: 1, 2
area: review
status: done
created: 2026-09-30
done: 2026-09-30
owner: lead
depends: []
links: []
---

# 062 Review, balance, flaws (realms 1 and 2)

Review, balance and find flaws: the economy, toughness (`foeHp`), the Warden's fight, a code review of everything uncommitted.

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## Done 2026-09-30: what was built and checked

- 2026-09-30: **Review, balance, flaws** (full suite: 58 reports, all read; the lights check's limit then set above frame-time jitter, 5 a second (a pop reads tens), and rerun) (asked: "review, balance, find flaws"). Measured first:
  - **Economy.** Blackpine pays ~1,145 coins (chests 720, foes ~225, quests and trial ~200) for 770 of
    things to buy (the sword to level 3, flasks to six). Whisperwood paid ~1,930 (chests 1,550!, foes
    ~210, quests and trial 170) for 960 (the two tempers): with Blackpine's leftovers some 1,500 coins
    unspent by its end. Now its chests pay by how hard they are to reach, 35 to 60 (1,055 in all):
    the tempers take most of the realm (tests/economy2.js).
  - **Toughness.** A knight comes into Whisperwood with a level-3 sword (1.75 times the damage), so its
    foes (as tough as Blackpine's) fell in fewer blows than Blackpine's had: the curve went down. Now a
    realm sets how much tougher its foes are than their kind (`foeHp`): Whisperwood 1.6, so a goblin
    takes three blows at level 3, as it did at level 0 (thornbacks two stun-combos, like Blackpine's
    boars at levels 0 to 1); the tyrants are tuned alone (tests/economy1.js, economy2.js).
  - **The Warden** (a bot that plays like a person: real keys, aimed clicks, dodges what it sees coming a
    quarter second late, keeps back from a blow winding up, otherwise closes in and swings): with a
    level-3 sword it won in 40 s losing 7 hearts, every one to the bow's swipe: the knight (5.2 m/s)
    ran the keep-away archer (2.7 m/s) down and cut it apart. Now it leaps back to open ground after its
    swipe and after three blows in quick succession (a crouch first; the landing and the path checked
    clear of roots and thorns), never volleys from close by (its arrows would be on him before he could
    step aside: it rains instead), 54 health (was 46). The bot: 68 to 73 s, 6 to 8 hearts, all to the
    swipe, which winds up for 0.65 s (tests/bossbot.js). (The Goblin King, for comparison: 29 s, 6
    hearts at level 2; left as it is.)
  - **Flaws found** (a code review of everything uncommitted, then checked): any toggle in the pause menu
    "landed" the knight (paused in mid-air over Rookfall, a screen-shake toggle put him on the rim);
    explore mode's "can't be hurt" wasn't true (a foe already after him, marks and arrows still hurt, and
    chests, the Thorn Heart and quest folk could be used while flying); the Thornstag's second leap
    (2.23 m) cleared the hollow's 2 m roots, so it could jump in before the garrison fell (the stag reach
    check couldn't see it: it treated every root over 1.1 m as a wall); the volley's arrows flew 3 to 4 m
    past its lines; a Warden felled mid-leap hung in the air; an arrow marked dead could still hit in the
    frame its Warden died; lamps could still pop when many faded at once (and the lights check measured
    the wrong thing); the bridges' search could loop for ever; landing never greeted the knight with the
    place's story, and could put him on ground that counts as a fall; small ones (an open bough end,
    children running through the log seats, a lax check). All fixed; new or extended checks: fly,
    arenastag, wardenfair (the volley's end), lights (what a lamp actually shows), corners2.
  - Also: the Goblin King left as it is (29 s, 6 hearts for the bot at level 2: short for a tyrant, but realm 1 was
    called done); Hollowbough is the heaviest place to draw (60 frames a second headless, 120 to 144 elsewhere).
