---
id: 002
title: Pause, focus and time
realm: 1
area: systems
status: done
group: 2
created: 2026-09-28
done: 2026-09-28
owner: lead
depends: []
links: []
---

# 002 Pause, focus and time

Timers, cutscenes, sound and music respect the pause menu and a hidden page.

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## Done 2026-09-28: what was built and checked

- 2026-09-28: Group 2, pause, focus and time: timers (Tam's dialog, the hall-door cutscene, the victory screen, respawns) and cutscenes wait while paused; switching to another window, tab or app pauses the game, and the sound sleeps while the page is hidden; the music skips beats it missed instead of playing them all at once; the world holds still behind the victory screen. Check: `tests/pause.js`.
