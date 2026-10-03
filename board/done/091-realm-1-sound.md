---
id: 091
title: Realm 1's sound
realm: castle
area: sound
status: done
priority: high
created: 2026-10-02
done: 2026-10-03
owner: an agent (its own copy)
depends: [089]
links: [../plans/realms-1-2-revisit.md]
---

# 091 Realm 1's sound

Group 91 of [the plan for realms 1 and 2](../plans/realms-1-2-revisit.md) (task [081](../in-progress/081-realms-1-2-as-beautiful-as-realm-3.md)).

## What

Beds of its own per place: the smithy's hammer and bellows, the tavern's voices through its walls, the chapel bell on the hour, the mill wheel's splash and creak, frogs and bitterns in the marsh, the ford's babble, wind in the pines, crows over the keep, banners and chains at the bailey; animal voices placed in space (sheep, a cow, swans, crows, frogs).

## Checks

A sound check for realm 1 like `seasound` (read from the audio graph: each place its beds); travel, border; tsc. Before/after shots from the game camera at the comparison's spots (the user's rule: changes plainly
visible from where the player looks).

Widened (2026-10-03): Whisperwood's sound from 095 too (the canopy's hush and creak, the falls, frogs, chimes, the inn's
voices and lute, cracking branches, a dawn chorus, a nightingale), both realms in one agent.

## Done 2026-10-03

A content-builder agent in its own copy, both realms' sound together (Whisperwood's moved here from 095); merged,
then wired to the groups merged meanwhile by the lead (the mill wheel's bed at the Old Mill, the Owl and Acorn's
voices and lute tied to its room, the animal calls moved to where group 87's flocks graze, the moat's call a duck).
A shared engine: `src/audio/lands.ts` (20 beds by place, 14 animal voices, all synthesised) and
`src/game/placesounds.ts` (how loud each place is where the knight stands: point, line, area, region; night and
dawn, flags, rooms and walls), and each realm's own `sounds` list on its map. Realm 1: the smithy's hammer, anvil
and bellows; the Crescent & Crown's crowd and chorus (clear inside, muffled through the walls); the chapel bell
tolling the hour; frogs, a natterjack and a bittern in the marsh; the stream's babble and the ford's white water;
the pines soughing in Blackpine; banners and chains at the bailey; the mill's wheel; larks and cocks at dawn; crows,
sheep, a cow, geese, ducks, swans and a heron calling from their places. Realm 2: the canopy's hush and groaning
trunks, branches cracking in the Deep Wood, the falls' roar, white water down Rookfall, the tree-frog chorus at the
Heartpool and the Mossfen, chimes, the inn's voices and a lute in D Dorian, a nightingale by the Heartpool at night,
the dawn chorus (blackbird, robin, wren, wood pigeon, a cuckoo, a woodpecker), rooks and a belling stag. Measured on
the ambience bus: +3 to +10 dB where the new beds play. Checked: keepsound and woodsound (new), seasound (realm 3
unchanged), travel, border, tsc. Left as known: the inn's sound inside its room not checked by a test yet.
