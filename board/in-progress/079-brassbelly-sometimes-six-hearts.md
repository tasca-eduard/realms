---
id: 079
title: Brassbelly sometimes costs the bot six hearts
realm: aqua
area: balance
status: in-progress
priority: low
created: 2026-10-02
done:
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
