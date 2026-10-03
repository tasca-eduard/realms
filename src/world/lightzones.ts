import type { ZoneLight } from './realm';

// The places' own light in realms 1 and 2 (a region's `light`): a colour cast over the moonlit ground, how bright,
// how thick the mist lies, and the same at dawn. Lamps, fires and glowing things keep their own colour, so the
// warm and moon-blue accents pop against each place's cast.

/** The Moonlit Keep: blue-violet nights, each place its own shade of them; at dawn rose-gold on stone, green
 *  meadows and silver water. */
export const KEEP_ZONES = {
  /** Keepsfoot and its tavern: warm amber, lamplight spilling over the cobbles. */
  village: { tint: [1.1, 1.06, 0.86], bright: 1.08, mist: 0.55, dawn: { tint: [1.14, 0.99, 0.86], bright: 1.04, mist: 0.4 } },
  /** The Warden's homestead by the Wayshrine: a lived-in home, a little of the village's warmth. */
  home: { tint: [1.08, 0.92, 1.02], bright: 1.04, mist: 0.8, dawn: { tint: [1.08, 1.02, 0.9] } },
  /** Blackpine Wood and the woods round the gorge: green-black under the pines. */
  pines: { tint: [0.78, 1.04, 0.86], bright: 0.94, mist: 1.15, dawn: { tint: [0.86, 1.06, 0.84], bright: 0.94 } },
  /** The Barrow Fields: a cold violet, the dead's ghost-cyan lights pop against it. */
  barrows: { tint: [1.04, 0.86, 1.24], bright: 1.02, mist: 1.3, dawn: { tint: [1.08, 1.06, 0.84], mist: 0.9 } },
  /** The Seven Stones: silver with a cyan edge. */
  stones: { tint: [1.0, 0.9, 1.26], bright: 1.08, mist: 1.2, dawn: { tint: [0.96, 1.08, 0.98] } },
  /** The Sallow Marsh: sickly yellow-green, thick mist on the pools. */
  marsh: { tint: [1.1, 1.0, 0.94], bright: 0.98, mist: 1.9, dawn: { tint: [1.0, 1.1, 0.86], mist: 1.3 } },
  /** The fields, the road and the Overlook: silver-blue moonlight. */
  fields: { tint: [1.04, 0.9, 1.16], bright: 1.06, mist: 0.9, dawn: { tint: [1.08, 1.06, 0.84], bright: 1.02 } },
  /** Mirrormere and the river: silver water, a pale mist on it. */
  water: { tint: [1.04, 0.9, 1.2], bright: 1.1, mist: 1.1, dawn: { tint: [1.0, 1.0, 1.08], bright: 1.06, mist: 0.8 } },
  /** The keep and its bailey: indigo stone, the torches orange against it. */
  keep: { tint: [0.86, 0.8, 1.26], bright: 0.98, mist: 0.6, dawn: { tint: [1.16, 0.96, 0.9], bright: 1.02, mist: 0.4 } },
  /** The Kings' Orchard on the plateau: moon-silver, its moonpetals glowing under the trees. */
  orchard: { tint: [0.9, 1.0, 1.24], bright: 1.04, mist: 0.9, dawn: { tint: [1.04, 1.1, 0.9] } },
  /** The hall of the Moon Throne: ember-red from the braziers. */
  hall: { tint: [1.1, 0.92, 0.9], bright: 1.0, mist: 0.3, dawn: { tint: [1.24, 0.92, 0.8] } },
  /** The Hollow: a cold blue-cyan cave. */
  hollow: { tint: [0.96, 0.88, 1.26], bright: 1.0, mist: 0.6 },
} satisfies Record<string, ZoneLight>;

/** Whisperwood: green-teal nights; the mist thin and low over open ground, water and the village, thick only in
 *  the Deep Wood, the Mossfen and Rookfall's floor; at dawn gold through the trunks, the mist burning off. */
export const WOOD_ZONES = {
  /** Hollowbough round the Heartpool: lantern-gold on the green, the mist thin. */
  village: { tint: [0.94, 1.0, 1.06], bright: 1.08, mist: 0.35, dawn: { tint: [1.12, 1.02, 0.84], mist: 0.2 } },
  /** Open meadows, glades and rings: thin mist, a silver-green. */
  open: { tint: [0.94, 1.04, 1.06], bright: 1.06, mist: 0.4, dawn: { tint: [1.16, 1.02, 0.8], mist: 0.25 } },
  /** Pools and the river: thin mist, silver-teal water. */
  water: { tint: [0.98, 1.04, 1.02], bright: 1.08, mist: 0.45, dawn: { tint: [1.0, 1.04, 1.06], mist: 0.25 } },
  /** The woods: the wood's own green-teal. */
  woods: { tint: [0.96, 1.02, 0.98], mist: 0.75, dawn: { tint: [1.16, 1.02, 0.8], mist: 0.45 } },
  /** The Old Grove: old gold under the oaks. */
  grove: { tint: [1.08, 1.06, 0.86], bright: 1.04, mist: 0.6, dawn: { tint: [1.18, 1.02, 0.78], mist: 0.35 } },
  /** The Deep Wood: dark, thick mist between the trunks. */
  deep: { tint: [0.84, 1.0, 0.96], bright: 0.96, mist: 2.3, dawn: { tint: [1.18, 1.0, 0.8], mist: 0.9 } },
  /** The Mossfen: a sallow green fen under thick mist. */
  fen: { tint: [1.02, 1.1, 0.8], bright: 0.98, mist: 2.2, dawn: { tint: [1.06, 1.08, 0.82], mist: 1.2 } },
  /** Rookfall: a cold blue-green gorge, the mist down on its floor. */
  gorge: { tint: [0.88, 1.0, 1.14], mist: 2.0, dawn: { tint: [1.06, 1.02, 0.92], mist: 1.0 } },
  /** The Warden's withered wood and the thorn ravine: his sickness, a violet-green. */
  withered: { tint: [1.04, 0.96, 0.94], bright: 0.98, mist: 1.0, dawn: { tint: [1.1, 0.96, 0.92], mist: 0.6 } },
  /** The Warden's hold on its heights: his sickness, violet over the green. */
  hold: { tint: [0.98, 0.92, 1.08], bright: 0.98, mist: 0.9, dawn: { tint: [1.1, 0.96, 0.92], mist: 0.5 } },
  /** Under the Great Tree: violet-green, the sickness at its root. */
  roots: { tint: [1.02, 0.92, 1.12], mist: 0.8, dawn: { tint: [1.14, 1.04, 0.84], mist: 0.4 } },
  /** Halls and hollows: lamplit, no mist. */
  indoor: { tint: [1.08, 1.0, 0.9], mist: 0.2 },
} satisfies Record<string, ZoneLight>;
