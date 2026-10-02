// All tuning values in one place. World units: 1 unit = 1 tile, about 1 metre.

export const VIEW = {
  /** Render pixels per world unit. Sets how big the world looks. */
  ppu: 18,
  /** Target height of the low-res render in pixels; the pixel scale is picked to land near it. */
  targetLines: 360,
  /** Camera elevation in degrees. 30 gives the classic 2:1 isometric diamond. */
  elevation: 30,
  yaw: 45,
  distance: 90,
};

export const PLAYER = {
  radius: 0.32,
  runSpeed: 5.2,
  accel: 38,
  friction: 30,
  hearts: 5,
  stamina: 100,
  staminaRegen: 45,
  staminaDelay: 0.55,
  rollCost: 28,
  /** Guard pressed and released faster than this is a roll; held longer, a block. */
  tapTime: 0.2,
  jumpSpeed: 7.8,
  rollSpeed: 11,
  rollTime: 0.36,
  rollIFrames: 0.3,
  blockCost: 22,
  blockSpeed: 0.35,
  parryWindow: 0.18,
  hurtIFrames: 0.9,
  comboWindow: 0.45,
  attackReach: 1.75,
  attackArc: 0.62, // cos of half-angle
  stepUp: 0.45,
  /** Below this height the knight has fallen into a chasm or pit: a heart lost, back on safe ground.
   * (The lowest ground anyone walks on is about -1; chasms' floors lie below this.) */
  fallY: -3.5,
  gravity: 26,
};

/** How things move in a realm: on land as PLAYER says; a realm can change it (under the sea, everything floats). */
export interface Physics {
  gravity: number;
  jumpSpeed: number;
  /** Below this height the knight has fallen into a chasm or pit. */
  fallY: number;
  /** The fastest anything falls (m/s). */
  maxFall: number;
  /** The knight's speed on foot, times this. */
  speed: number;
  /** Arrows, darts, seeds and bolas fly this much slower or faster. */
  shots: number;
}
export const LAND: Physics = { gravity: PLAYER.gravity, jumpSpeed: PLAYER.jumpSpeed, fallY: PLAYER.fallY, maxFall: 60, speed: 1, shots: 1 };

export const WORLD = {
  chunk: 32,
};

/** Phones and tablets get lighter settings. */
export const MOBILE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

/** Status effects on the knight. */
/** The diving suit's air (the Sunken Reef). */
export const AIR = {
  /** Seconds of air below the surface. */
  max: 90,
  /** Seconds of air back for each second above the surface, and in an air pocket (a vent's stream of bubbles). */
  surface: 45,
  pocket: 30,
  /** Breathless (out of air): his speed. */
  slow: 0.7,
  /** When the warnings start (the share of his air left). */
  low: 0.25,
  /** Seconds more for each air bladder sewn to the suit's hose (a ware of the reef's old diver). */
  bladder: 30,
};

export const EFFECTS = {
  /** Maimed: move speed multiplier and duration. */
  maimSlow: 0.6,
  maimTime: 3,
  /** Dazed: can't act. Knocked down is a longer daze spent on the ground. */
  dazeTime: 0.9,
  downTime: 0.85,
  /** After a daze ends, no new daze for this long (no stun-locks). */
  dazeImmune: 3,
  /** Burning: seconds until the flames cost a heart (roll or water puts them out). */
  burnFuse: 1.5,
  /** Poisoned: stamina refills at this rate, for this long. */
  poisonRegen: 0.5,
  poisonTime: 6,
  /** Snared (a bola, a snare trap): can't walk, roll or jump for this long; can still swing and block. */
  snareTime: 1.3,
  /** A snare trap also bites: this many hearts. */
  trapBite: 1,
};

/** Hazards of the realms. */
export const HAZARDS = {
  /** The Thorn Ravine: each strip's cycle, the rustle before, and how long the thorns stand. */
  thornCycle: 3.2,
  thornWarn: 0.6,
  thornUp: 0.7,
  /** The Sunken Reef's giant clams: open, then a ring fills round one for `clamWarn` s (sooner if the knight
   *  steps in) and it snaps shut on whoever stands within `clamR` m; shut a while. Struck open, its pearl:
   *  `clamPearl` coins. */
  clamOpen: 2.6,
  clamWarn: 1.2,
  clamShut: 1.6,
  clamR: 0.95,
  clamPearl: 12,
};

/** Foes: health, size, speed, sight, reach, wind-up before a blow, coins, and what their hits do. */
export const FOES = {
  goblin: { hp: 3, r: 0.34, speed: 2.9, aggro: 8.5, reach: 1.35, windup: 0.5, coins: [2, 4] },
  shield: { hp: 4, r: 0.36, speed: 2.4, aggro: 8, reach: 1.35, windup: 0.62, coins: [3, 6] },
  archer: { hp: 2, r: 0.32, speed: 2.4, aggro: 11, reach: 9, windup: 0.95, coins: [2, 5], maimChance: 0.3 },
  bat: { hp: 1, r: 0.3, speed: 4, aggro: 8, reach: 0.9, windup: 0.5, coins: [1, 2], stamina: 15, thiefChance: 0.5, steal: [5, 12] },
  boar: { hp: 7, r: 0.5, speed: 2.2, aggro: 9, reach: 1.2, windup: 0.9, coins: [6, 10] },
  brute: { hp: 8, r: 0.48, speed: 2.1, aggro: 8.5, reach: 1.9, windup: 1.0, coins: [6, 9], dazeChance: 0.35, guardCost: 2.2 },
  bomber: { hp: 2, r: 0.34, speed: 2.5, aggro: 11, reach: 9, windup: 0.9, coins: [3, 6], fireTime: 4, fireRadius: 1.3 },
  darter: { hp: 2, r: 0.32, speed: 2.7, aggro: 11, reach: 9, windup: 0.7, coins: [2, 4] },
  shaman: { hp: 3, r: 0.34, speed: 2.6, aggro: 10, reach: 8, windup: 1.1, coins: [5, 8], heal: 2, hasteTime: 6, chantRange: 7 },
  king: { hp: 48, r: 0.85, speed: 3.1, aggro: 30, reach: 2.3, windup: 0.6, coins: [0, 0] },
  // The Old Wood's own.
  spitter: { hp: 4, r: 0.42, speed: 0, aggro: 10, reach: 1.7, windup: 0.55, coins: [3, 6], cooldown: [1.8, 2.5] },
  snarer: { hp: 3, r: 0.34, speed: 2.7, aggro: 10.5, reach: 8, windup: 0.85, coins: [3, 5] },
  thornback: { hp: 8, r: 0.52, speed: 2.3, aggro: 9, reach: 1.2, windup: 0.9, coins: [7, 11], prickStamina: 25 },
  // The Sunken Reef's: Brassbelly the salvager (the lighthouse isle's mini-boss): a brute's anchor blows, and
  // when he's struck three times in quick succession (or the knight hangs about close for `ventClose` s) his
  // suit hisses for `ventWind` s (a ring on the ground), then blows off steam all round (`ventR` m).
  salvager: { hp: 30, r: 0.56, speed: 2.0, aggro: 10, reach: 2.1, windup: 1.0, coins: [30, 40], dazeChance: 0.4, guardCost: 2.6, ventR: 2.8, ventWind: 0.95, ventEvery: 6, ventClose: 6 },
  // The crew's divers: goblins in a bucket, a kettle or a fishbowl, a hose up to a cork float on the surface;
  // they walk into deep water and fight as goblins do, with a boathook.
  diver: { hp: 3, r: 0.34, speed: 2.7, aggro: 8.5, reach: 1.45, windup: 0.55, coins: [3, 5] },
  // The harpooner: takes aim (the line on the ground fixed `lock` s before it throws), and a harpoon that
  // strikes home (a heart) hooks the knight and reels him in at `pull` m/s for up to `pullTime` s, to
  // `pullStop` m off; a roll or a swing of the sword frees him.
  harpooner: { hp: 3, r: 0.34, speed: 2.4, aggro: 11, reach: 8.5, windup: 1.15, coins: [3, 6], lock: 0.45, speedShot: 12, pull: 6, pullTime: 1.1, pullStop: 1.9, cooldown: [2.4, 3.2] },
  // The sea's own. The Jelly drifts at chest height and lunges, stinging (its line fixed `lock` s before);
  // felled, it splits in two little ones (`smallHp`) whose stings poison instead.
  jelly: { hp: 4, r: 0.45, speed: 1.5, aggro: 8, reach: 2.4, windup: 0.75, coins: [2, 4], smallHp: 1.5, lunge: 7.5, lock: 0.35, hover: 0.95 },
  // The crab guards with its armoured claw (blows from in front glance off, until a heavy one flips it onto
  // its back for `flipTime` s), turns slowly (`turn` rad/s) and scuttles sideways; its pinch may maim.
  crab: { hp: 5, r: 0.5, speed: 2.4, aggro: 8, reach: 1.45, windup: 0.65, coins: [4, 7], turn: 2.6, flipTime: 2.2, maimChance: 0.35 },
  // The eel waits in its den; it lunges up to `reach` m along a line fixed `lock` s before, bites, stays
  // out `out` s (the time to strike it; struck, it flinches a moment and pulls back). In its den nothing
  // reaches it.
  eel: { hp: 4, r: 0.38, speed: 0, aggro: 4.4, reach: 3.4, windup: 0.75, coins: [4, 6], lock: 0.45, out: 1.25, cooldown: 1.1 },
  // The pufferfish: within `reach` m it swells (`windup` s, a ring filling round it), its spikes bursting out
  // `spikeR` m round it; half swollen and more, blows do a quarter (and prick); `puffed` s later it goes down
  // and is winded `winded` s: strike it small (a blow early in the swell stops it).
  puffer: { hp: 2, r: 0.4, speed: 1.3, aggro: 8, reach: 1.6, windup: 1.2, coins: [2, 4], spikeR: 1.35, puffed: 2.4, winded: 1.5, spiked: 0.25 },
  // Old Inkarm, the Ink Grotto's octopus (realm 3's second mini-boss under the sea; src/game/inkarm.ts): never
  // leaves its den. An arm rises from the floor and slams along a line `slamW` m wide, shown filling for `windup`
  // s; a ring fills under the knight `windup` s, then an arm grabs him and holds `hold` s (`mash` presses of attack
  // tear free); it swells `swell` s and inks the water (the screen dark for `ink` s). Its arms shield its body
  // except while they're down (`down` s after a slam or a grab torn free; `downEnraged` below half), `gap` s
  // between attacks (`gapEnraged`). One attack at a time.
  inkarm: { hp: 26, r: 1.45, speed: 0, aggro: 0, reach: 8, windup: 1.2, coins: [40, 60], slamW: 1.5, ring: 1.3, hold: 2.4, mash: 5, swell: 1.0, ink: 3.2, down: 2.6, downEnraged: 2.1, gap: 1.1, gapEnraged: 0.7 },
  // The Thorn Warden (the Old Wood's tyrant): keeps its distance and shoots. Volleys fan 3 arrows
  // (5 enraged) along lines it shows, fixed `volleyLock` s before they fly; rain marks the knight's
  // spot and 2 more to one side of him (4 enraged) that arrows hit after `rainDelay`; enraged, roots
  // burst under the knight after `rootDelay`. Close in and it swipes, then leaps back out of reach
  // (as it does after three blows in quick succession). One attack at a time.
  warden: { hp: 54, r: 0.8, speed: 2.7, aggro: 30, reach: 2.4, windup: 0.65, coins: [0, 0], keepAway: 6, rainDelay: 1.5, rootDelay: 1.25, volleyLock: 0.45 },
  // The Tidelord (the Sunken Reef's tyrant), fought on his throne hall's floor 6 m down: charges along a lane he
  // shows on the floor (following the knight for `laneFollow` s, then fixed `laneLock` s before he goes); casts
  // drowning orbs that drift after the knight (`orbSpeed` m/s, `orbLife` s; a blow cuts one down); leaps and
  // lands on a spot marked under the knight (filling for `slamDelay` s, `slamR` m round), a wave running out over
  // the floor to `waveR` (jump it). Close in and he sweeps his trident (its reach shown, filling for `windup` s).
  // Enraged at half health, the tide turns: a current sweeps the floor (`tide` m/s), turning every `tideEvery` s,
  // its new way shown `tideWarn` s before. One attack at a time.
  tidelord: { hp: 95, r: 0.85, speed: 2.5, aggro: 30, reach: 2.6, windup: 1.2, coins: [0, 0], laneFollow: 0.8, laneLock: 0.65, chargeSpeed: 10, orbs: 3, orbSpeed: 2.3, orbLife: 5, slamDelay: 1.5, slamR: 2, waveR: 7.5, waveSpeed: 6.5, tide: 1.6, tideEvery: 7, tideWarn: 1.4 },
} as const;
