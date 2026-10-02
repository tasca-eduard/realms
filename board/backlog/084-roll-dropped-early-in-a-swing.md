---
id: 084
title: A roll pressed early in a swing is dropped
realm: aqua
area: controls
status: backlog
priority: medium
created: 2026-10-02
done:
owner:
depends: []
links: [../done/079-brassbelly-sometimes-six-hearts.md]
---

# 084 A roll pressed early in a swing is dropped

## What

In `src/game/player.ts`, the `attack` state reads guard only after the swing's hit window: a roll pressed in a swing's
first 0.2 s is silently dropped, and a queued three-swing combo lasts up to 1.16 s. Found by the balancer (079): the
bot, caught in its own combo, could not roll out of a blow it saw coming.

## Why

It is felt in every fight in every realm: a player who presses roll and nothing happens blames the game. Queueing
the roll (or letting it cancel the swing's recovery) is a design change to the moveset, so it waits for the user's
word or the next controls pass.

## Checks

controls, moves, fight, the boss bots (bossbot, tidebot, salvagerbot, inkbot) and the fair checks; a roll pressed
early in a swing comes out when the swing's hit lands.
