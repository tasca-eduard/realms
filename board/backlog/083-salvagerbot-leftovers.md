---
id: 083
title: The salvagerbot check: one stall in 30, steam crossings
realm: aqua
area: tests
status: backlog
priority: low
created: 2026-10-02
done:
owner:
depends: []
links: [../done/079-brassbelly-sometimes-six-hearts.md, ../done/077-salvagerbot-stalls-in-full-runs.md]
---

# 083 The salvagerbot check: one stall in 30, steam crossings

## What

After 079, one run in 30 still stalled (no win in 150 s, 18 steam rings, Brassbelly up on the yard's steps: 077's
signature), and ten more runs with position snapshots didn't catch it. Most hearts the bot loses now are the steam
(it rolls out of the ring, turns back at about 4.2 m and crosses the scald's edge, 3.1 m, as it blows) and the
shield goblin's quick jab on a knight mid-swing.

## Why

A check that fails 1 run in 30 for the bot's own faults wastes a suite run; a player would not walk into the steam.

## Checks

The logging bot (`shots-b079/slog4.js` in the agent's copy, or a copy of it) catches the stall's positions; salvagerbot
30 runs alone with no stall and the steam's share of hearts down.
