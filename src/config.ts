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
  gravity: 26,
};

export const WORLD = {
  chunk: 32,
};

/** Phones and tablets get lighter settings. */
export const MOBILE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

/** Status effects on the knight. */
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
} as const;
