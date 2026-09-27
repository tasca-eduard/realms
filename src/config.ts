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
