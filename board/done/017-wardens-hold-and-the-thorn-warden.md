---
id: 017
title: The Warden's Hold and the Thorn Warden
realm: 2
area: boss
status: done
group: 17
plan: realm-2
created: 2026-09-28
done: 2026-09-28
owner: lead
depends: []
links: [../plans/realm-2.md]
---

# 017 The Warden's Hold and the Thorn Warden

The Warden's Hold and the Thorn Warden, realm 2's tyrant; victory and dawn.

_Moved from BOARD.md on 2026-10-02; the record below is the board's text, word for word._

## In the plan

- [x] **17 The Warden's Hold and the Thorn Warden.** Done 2026-09-28 (see Done). Wall of thorn trees, the gate lever on a
  tree-tower roof, the drawbridge over the thorn moat, the garrison, the arena inside the Great
  Tree; the boss (arrow volleys, arrow rain on marked spots, summons; enraged, roots burst from the
  floor), victory and dawn; the sea-cliff stair to realm 3 visible but closed. Checks: the boss
  fight, a playthrough.

## Done 2026-09-28: what was built and checked

- 2026-09-28: **Group 17, the Warden's Hold and the Thorn Warden.**
  - **The Thorn Warden** (the prototype's forest tyrant: volley, rain, summon): a giant bone archer grown
    over with bark and moss, a crown of thorn-antlers, a living-wood longbow with a glowing string. It
    keeps its distance (backs off inside 4.8 m, circles, closes in past 8.3 m) and shoots: volleys fanned
    at the knight (3 arrows, 5 enraged); arrow rain on 5 spots round him (7 enraged), each marked by a
    ring that brightens for 0.95 s before the arrows land (a raised shield stops them); goblins and a
    snarer called in (shields enraged). Too close, it swipes with the bow. At half health it's enraged:
    faster, and roots burst under the knight and where he's heading (0.8 s warning, unblockable, they
    prick foes too). 54 health. `isBoss` now stands for the King or the Warden wherever the code said
    'king' (no golden or elite rolls, the health bar, heavy knockback, no coin drops, reset to sleep).
  - **The Warden's Hold**: the hollow Great Tree (a wall of trunk staves round a floor, the half toward
    the camera vanishing while the knight is inside, its crown fading when it hides him); a ring of
    thorn-trees open only at the gate; a pit of thorn stakes before the gate with a drawbridge; a
    tree-tower beside it whose roof lever, reached up its vines, lowers the bridge (quest step 5, saved);
    the garrison (two shields, two archers, a snarer, a thornback), whose fall opens the tree's door;
    inside, the arena: the door shuts behind the knight and the Warden wakes. Falling in the fight resets
    it with the door open (once the garrison is gone). Victory, dawn, quest done.
  - **The Sea Stair**: past the Withered Wood the heights drop to the sea; a stair cut down the cliff
    toward the Sunken Reef (realm 3) is blocked by a rockfall, with a sign.
  - Screenshots: `shots/g17-*.png` (gate, roof, courtyard, the fight calm and enraged, the stair). Fixed
    from them: the tree's staves were a palisade (now thick enough to read as one trunk); the stair's
    rock wall hid the sea (removed: deep water either side already keeps the knight on the stair).
  - Checks (new): `hold` (the gate holds against a walk and a running jump; up the vines, the lever, over
    the bridge, the garrison, into the tree; after a reload it stays done, the Warden asleep inside) and
    `warden` (every move seen; 7.7 m kept on average; enraged roots; felled: victory, quest 6, summons
    gone). Reach and spawns clean in both realms.
  - Full suite: 45 reports, all read, no errors.
