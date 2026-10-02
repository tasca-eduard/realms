---
id: 001
title: Flasks, hearts and effects
realm: 1
area: systems
status: done
group: 1
created: 2026-09-28
done: 2026-09-28
owner: lead
depends: []
links: []
---

# 001 Flasks, hearts and effects

Flasks, hearts and status effects behave as a player expects: cures, messages, hearts left on the ground, tips on phones.

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## Done 2026-09-28: what was built and checked

- 2026-09-28: Group 1, flasks, hearts and effects: a flask cures maim, poison and burn even at full health, and on horseback too; pressing it with nothing to fix says "not hurt" (or "no flasks left") instead of silently doing nothing; hearts stay on the ground until you're hurt; the effect tips read right on phones ("Drink a flask (the flask button)"). Check: `tests/flask.js`.
