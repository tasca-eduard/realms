---
id: 010
title: Fresh review (realm 1)
realm: 1
area: review
status: done
group: 10
created: 2026-09-28
done: 2026-09-28
owner: lead
depends: []
links: []
---

# 010 Fresh review (realm 1)

A fresh review of realm 1 (a screenshot tour, a random-play soak, reading the flow code) and its fixes.

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## Done 2026-09-28: what was built and checked

- 2026-09-28: Group 10, fresh review (a screenshot tour of every area, a 2-minute random-play soak, reading the flow code). Found and fixed:
  - **High:** pressing E through a conversation restarted it (the press that closed it opened it again), so a keyboard player couldn't leave a talk (or a lore stone) with E. The press that closes a dialog, a reading, the pause menu, the story or the death screen now goes no further; Enter and Space page through talks too, and a pad's A, X or Y confirm as the README says.
  - **Medium:** foes that started inside things: a bomber inside the river camp's tent (drawn as a red see-through outline), a goblin standing in its campfire, an archer in a Gnasher's Camp tent, a marsh darter in a tree, and five more touching posts and fences. Chickens started in the Warden's front step, and the random wildlife could start inside a tower or a rock (it now checks).
  - **Medium:** with a gamepad, every prompt and tip still named keyboard keys ("E Talk", "Tap Right click to roll", Q beside the flasks). They now follow the device in use (Y, B, LB...) and switch as soon as you pick up the other one; the pause menu gets a gamepad controls list (it showed the keyboard's, though the README said otherwise).
  - **Medium:** mashing E through the smith's lines bought a sharpening (80 coins) by accident, because the answers appear with the paid one selected. Keys and taps now only pick an answer after a short pause (each mashed press or tap restarts it). The lore card's "Press E or tap to close" now names the right key or button.
  - **Low:** the arrow keys move the knight too (and pick answers in talks).
  - Also checked, no change needed: load time (ready ~0.3 s after the scripts), draw calls at 25 stops (96 to 237 on desktop and phone), the coin economy (chests 720 + quests 200 + kills against 770 of upgrades), the production build.
  - Checks: `tests/spawns.js`, `tests/talk.js`, `tests/pad.js` (fakes a pad), `tests/monkey.js` (not in `npm test`: it takes two minutes). The tour (`tests/tour.js`) now counts a whole frame's draw calls.
