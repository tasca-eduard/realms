---
id: 079
title: Brassbelly sometimes costs the bot six hearts
realm: aqua
area: balance
status: done
priority: low
created: 2026-10-02
done: 2026-10-02
owner: an agent (balancer, its own copy)
depends: []
links: [../done/077-salvagerbot-stalls-in-full-runs.md]
---

# 079 Brassbelly sometimes costs the bot six hearts

## What

The salvagerbot check (a level-5 player-like bot against Brassbelly and his crew) allows at most 5 hearts lost. About
1 run in 8 the bot wins in good time but loses 6 (3 of 25 alone runs on 2026-10-02: sd4, sd27 and one after 077's
fix). Most runs lose 0-4.

## Why

Group 36 aimed at 0-3 (later 0-4) hearts for a level-5 knight. The user, during realm 3: "we will balance later", so
it waits for the next balance pass. Look first at what costs the sixth heart (his crew's blows while the knight
rolls out of the steam ring, or the anchor), not at the limit.

## Checks

salvagerbot alone 20 times: none over 5 hearts, the win still in 25-90 s.

## Done 2026-10-02

A balancer agent in its own copy; merged. **What cost the sixth heart: his anchor.** Before (7 runs at a 1.0 s
wind-up): 18 hearts lost, 13 of them the anchor. Its blow landed 1.1 s after the wind-up began, under the 1.2 s every
attack gives (B3 in the design rules), and the bot got one dodge at it: a roll pressed early in a swing is dropped,
and the yard's heaps, rowboat and steps stop a roll short, so a knight caught in his own combo was hit.
**Changes:** `FOES.salvager.windup` 1.0 -> 1.2 s (`src/config.ts`: his anchor drawn back as long as his ring shows);
the bot keeps back to 4.2 m while the anchor is drawn back (it walked back in under it), still rolling only within
3.2 m: what the check's description already says it does. **After:** 30 runs, 29 won in 35-52 s (median 45), hearts
0-5 (average 2.07), none over 5; then 3 of 3 through the suite. Left as known: one run in 30 stalled (no win in 150 s,
18 steam rings: 077's signature); the bot's remaining hearts are steam (it turns back across the ring's edge) and
the shield goblin's jab: [083](../backlog/083-salvagerbot-leftovers.md). A roll pressed early in a swing is dropped:
[084](../backlog/084-roll-dropped-early-in-a-swing.md).
