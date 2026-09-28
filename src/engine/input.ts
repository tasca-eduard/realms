// One binding per action. Desktop: WASD move, mouse aims, left click attack,
// right click guard (tap: roll, hold: block, timed: parry), Space jump,
// E interact, Q flask, Esc pause. Touch and gamepad feed the same actions.

export type Action = 'attack' | 'guard' | 'jump' | 'special' | 'interact' | 'pause' | 'heal';

let layout: Map<string, string> | null = null;
/** Ask the browser how this keyboard labels its keys (Chrome and Edge can tell). */
export function loadKeyLayout(onReady: () => void) {
  const kb = (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } }).keyboard;
  kb?.getLayoutMap?.()
    .then((m) => {
      layout = m;
      onReady();
    })
    .catch(() => {});
}
/** The label on the key at a physical position, e.g. keyName('KeyQ') is "A" on AZERTY. */
export function keyName(code: string) {
  const k = layout?.get(code);
  return k && k.trim() ? k.toUpperCase() : code.replace(/^Key|^Digit/, '');
}
/** The four movement keys, in W A S D order. */
export const moveKeys = () => ['KeyW', 'KeyA', 'KeyS', 'KeyD'].map(keyName).join('');

/** Gamepad buttons, named as on an Xbox pad (the README's names). */
const PAD_LABEL: Record<Action | 'move' | 'aim', string> = {
  move: 'Left stick',
  aim: 'Right stick',
  attack: 'X',
  guard: 'B',
  jump: 'A',
  special: 'RB',
  interact: 'Y',
  heal: 'LB',
  pause: 'Start',
};
const KEY_LABEL: Record<Action | 'move' | 'aim', () => string> = {
  move: moveKeys,
  aim: () => 'Mouse',
  attack: () => 'Left click',
  guard: () => 'Right click',
  jump: () => 'Space',
  special: () => keyName('KeyF'),
  interact: () => keyName('KeyE'),
  heal: () => keyName('KeyQ'),
  pause: () => 'Esc',
};

const KEYMAP: Record<string, Action> = {
  Space: 'jump',
  KeyE: 'interact',
  KeyQ: 'heal',
  KeyF: 'special',
  Escape: 'pause',
};

export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private actDown = new Set<Action>();
  private actPressed = new Set<Action>();
  private actReleased = new Set<Action>();
  mouseX = window.innerWidth / 2;
  mouseY = window.innerHeight / 2;
  /** Mouse aims on desktop; touch and gamepad aim with movement. */
  mouseAim = true;
  anyPressed = false;
  private padPrev: boolean[] = [];
  padMove = { x: 0, y: 0 };
  padAim = { x: 0, y: 0 };
  usingPad = false;
  usingTouch = false;
  touchMove = { x: 0, y: 0 };

  constructor(el: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
      this.down.add(e.code);
      this.pressed.add(e.code);
      this.anyPressed = true;
      this.usingPad = false;
      this.mouseAim = !this.usingTouch;
      const a = KEYMAP[e.code];
      if (a) this.press(a);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      const a = KEYMAP[e.code];
      if (a) this.release(a);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
      this.actDown.clear();
    });
    el.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      if (!this.usingTouch) {
        if (!(e.buttons & 1)) this.release('attack');
        if (!(e.buttons & 2)) this.release('guard');
      }
    });
    el.addEventListener('mousedown', (e) => {
      if (this.usingTouch) return;
      this.anyPressed = true;
      this.usingPad = false;
      this.mouseAim = true;
      if (e.button === 0) this.press('attack');
      if (e.button === 2) this.press('guard');
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.release('attack');
      if (e.button === 2) this.release('guard');
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // Any click or tap anywhere counts as "press any key" (story, death, victory).
    window.addEventListener('pointerdown', (e) => {
      this.anyPressed = true;
      if (e.pointerType === 'touch') {
        this.usingTouch = true;
        this.mouseAim = false;
      } else if (e.pointerType === 'mouse') {
        this.usingTouch = false;
        this.mouseAim = true;
      }
    });
  }

  press(a: Action) {
    this.actDown.add(a);
    this.actPressed.add(a);
    this.anyPressed = true;
  }
  release(a: Action) {
    if (!this.actDown.has(a)) return;
    this.actDown.delete(a);
    this.actReleased.add(a);
  }

  /** What to press for an action on the device in use: a key or mouse button, or a pad button. */
  label(a: Action | 'move' | 'aim') {
    return this.usingPad ? PAD_LABEL[a] : KEY_LABEL[a]();
  }

  /** Which device is in use, for text that names buttons. */
  get device() {
    return this.usingPad ? 'pad' : this.usingTouch ? 'touch' : 'keys';
  }

  /** A menu, dialog or reading used this frame's presses: gameplay mustn't act on them too. */
  swallow() {
    this.pressed.clear();
    this.actPressed.clear();
    this.anyPressed = false;
  }

  key(code: string) {
    return this.down.has(code);
  }
  keyPressed(code: string) {
    return this.pressed.has(code);
  }
  held(a: Action) {
    return this.actDown.has(a);
  }
  hit(a: Action) {
    return this.actPressed.has(a);
  }
  up(a: Action) {
    return this.actReleased.has(a);
  }

  /** Movement in screen space: x right, y up. Length 0..1. */
  move() {
    let x = 0, y = 0;
    if (this.key('KeyA') || this.key('ArrowLeft')) x -= 1;
    if (this.key('KeyD') || this.key('ArrowRight')) x += 1;
    if (this.key('KeyW') || this.key('ArrowUp')) y += 1;
    if (this.key('KeyS') || this.key('ArrowDown')) y -= 1;
    const l = Math.hypot(x, y);
    if (l > 0) return { x: x / l, y: y / l };
    const tl = Math.hypot(this.touchMove.x, this.touchMove.y);
    if (tl > 0.15) return { x: this.touchMove.x / Math.max(1, tl), y: this.touchMove.y / Math.max(1, tl) };
    const pl = Math.hypot(this.padMove.x, this.padMove.y);
    if (pl > 0.2) return { x: this.padMove.x / Math.max(1, pl), y: this.padMove.y / Math.max(1, pl) };
    return { x: 0, y: 0 };
  }

  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && Array.from(pads).find((g) => g && g.connected);
    if (!p) return;
    const dz = (v: number) => (Math.abs(v) < 0.18 ? 0 : v);
    this.padMove.x = dz(p.axes[0] ?? 0);
    this.padMove.y = -dz(p.axes[1] ?? 0);
    this.padAim.x = dz(p.axes[2] ?? 0);
    this.padAim.y = -dz(p.axes[3] ?? 0);
    const map: [number, Action][] = [
      [2, 'attack'], // X / Square
      [0, 'jump'], // A / Cross
      [1, 'guard'], // B / Circle: tap roll, hold block
      [3, 'interact'], // Y / Triangle
      [4, 'heal'], // LB
      [5, 'special'], // RB
      [9, 'pause'], // Start
    ];
    for (const [i, a] of map) {
      const now = !!p.buttons[i]?.pressed, was = !!this.padPrev[i];
      if (now && !was) {
        this.press(a);
        this.usingPad = true;
        this.mouseAim = false;
      }
      if (!now && was) this.release(a);
      this.padPrev[i] = now;
    }
    if (Math.hypot(this.padMove.x, this.padMove.y) > 0.3) {
      this.usingPad = true;
      this.mouseAim = false;
    }
  }

  /** Call at the end of every frame. */
  endFrame() {
    this.pressed.clear();
    this.actPressed.clear();
    this.actReleased.clear();
    this.anyPressed = false;
  }
}
