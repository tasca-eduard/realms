---
id: 007
title: Controls and menus
realm: 1
area: ui
status: done
group: 7
created: 2026-09-28
done: 2026-09-28
owner: lead
depends: []
links: []
---

# 007 Controls and menus

Key names follow the keyboard layout, no stuck buttons, the title and pause menus from keyboard and pad.

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## Done 2026-09-28: what was built and checked

- 2026-09-28: Group 7, controls and menus: key names in tips, prompts, the HUD and the pause menu follow the keyboard's layout (AZERTY shows ZQSD, A for the flask); a mouse button released outside the window can't leave an attack or block stuck; the title menu works from the keyboard (arrows or W/S, Enter, Space or E) and the pause menu from the keyboard and a pad (up/down, A or Y to choose, B to resume). Checks: `tests/menus.js`, `node tools/shot.mjs "shot"` + Enter.
