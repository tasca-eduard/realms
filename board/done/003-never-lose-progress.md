---
id: 003
title: Never lose progress
realm: 1
area: systems
status: done
group: 3
created: 2026-09-28
done: 2026-09-28
owner: lead
depends: []
links: []
---

# 003 Never lose progress

Nothing a player earns can be lost: "New journey" asks first, chest coins and the kill count are saved at once.

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## Done 2026-09-28: what was built and checked

- 2026-09-28: Group 3, never lose progress: "New journey" asks first ("No, keep my journey" is the default); a chest's coins count the moment it opens and are saved with it (the coins that spill out fly to the knight as the show); the kill count is saved for the victory screen (older saves start from the foes already felled). Checks: `tests/progress1.js` then `tests/progress2.js` with the same `PROFILE`.
