import type { Input, Action } from '../engine/input';

// On-screen controls for phones and tablets: a floating stick under the left
// thumb and a cluster of buttons under the right.

const ICON = {
  attack: `<svg viewBox="0 0 9 9" shape-rendering="crispEdges"><path fill="currentColor" d="M8 0h1v1h-1zM7 1h2v1h-2zM6 2h2v1h-2zM1 3h1v1h-1zM5 3h2v1h-2zM2 4h1v1h-1zM4 4h2v1h-2zM3 5h2v1h-2zM2 6h1v1h-1zM4 6h1v1h-1zM1 7h1v1h-1zM5 7h1v1h-1zM0 8h1v1h-1z"/></svg>`,
  block: `<svg viewBox="0 0 9 9" shape-rendering="crispEdges"><path fill="currentColor" d="M0 0h9v1h-9zM0 1h4v1h-4zM5 1h4v1h-4zM0 2h4v1h-4zM5 2h4v1h-4zM0 3h1v1h-1zM8 3h1v1h-1zM0 4h4v1h-4zM5 4h4v1h-4zM1 5h3v1h-3zM5 5h3v1h-3zM1 6h3v1h-3zM5 6h3v1h-3zM2 7h2v1h-2zM5 7h2v1h-2zM3 8h3v1h-3z"/></svg>`,
  jump: `<svg viewBox="0 0 9 9" shape-rendering="crispEdges"><path fill="currentColor" d="M4 0h1v1h-1zM3 1h3v1h-3zM2 2h5v1h-5zM1 3h7v1h-7zM3 4h3v5h-3z"/></svg>`,
  special: `<svg viewBox="0 0 9 7" shape-rendering="crispEdges"><path fill="currentColor" d="M4 0h1v1h-1zM3 1h3v1h-3zM0 2h9v1h-9zM1 3h7v1h-7zM2 4h5v1h-5zM2 5h2v1h-2zM5 5h2v1h-2zM1 6h2v1h-2zM6 6h2v1h-2z"/></svg>`,
  roll: `<svg viewBox="0 0 9 9" shape-rendering="crispEdges"><path fill="currentColor" d="M3 0h3v1h-3zM1 1h2v1h-2zM6 1h2v1h-2zM0 2h1v2h-1zM8 2h1v3h-1zM0 5h1v2h-1zM6 4h3v1h-3zM7 5h1v1h-1zM1 7h2v1h-2zM6 7h2v1h-2zM3 8h3v1h-3z"/></svg>`,
  heal: `<svg viewBox="0 0 7 10" shape-rendering="crispEdges"><path fill="currentColor" d="M2 0h3v1H5v2h1v1h1v5H6v1H1V9H0V4h1V3h1V1H2z"/><path fill="#5ad1ff" d="M1 5h5v4H1zM2 4h3v1H2z"/></svg>`,
  pause: `<svg viewBox="0 0 9 9" shape-rendering="crispEdges"><path fill="currentColor" d="M1 1h3v7h-3zM5 1h3v7h-3z"/></svg>`,
};

export class TouchControls {
  root = document.createElement('div');
  private stickZone = document.createElement('div');
  private base = document.createElement('div');
  private knob = document.createElement('div');
  private act = document.createElement('button');
  private stickId: number | null = null;
  private ox = 0;
  private oy = 0;
  onPause: () => void = () => {};
  private shown = false;

  constructor(parent: HTMLElement, private input: Input) {
    this.root.id = 'touch';
    this.root.className = 'hidden';
    this.stickZone.id = 'stickZone';
    this.base.id = 'stickBase';
    this.knob.id = 'stickKnob';
    this.base.appendChild(this.knob);
    this.stickZone.appendChild(this.base);
    const btns = document.createElement('div');
    btns.id = 'tbtns';
    const mk = (cls: string, action: Action, label: string) => {
      const b = document.createElement('button');
      b.className = `tb ${cls}`;
      b.innerHTML = label;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          b.setPointerCapture(e.pointerId);
        } catch {
          /* synthetic pointers */
        }
        b.classList.add('down');
        this.input.press(action);
        if (navigator.vibrate) navigator.vibrate(8);
      });
      const up = () => {
        b.classList.remove('down');
        this.input.release(action);
      };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      return b;
    };
    btns.append(mk('heal', 'heal', ICON.heal), mk('special', 'special', ICON.special), mk('guard', 'guard', ICON.block), mk('jump', 'jump', ICON.jump), mk('attack', 'attack', ICON.attack));
    this.act = mk('act hidden', 'interact', '');
    const pause = document.createElement('button');
    pause.className = 'tb pause';
    pause.innerHTML = ICON.pause;
    pause.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.onPause();
    });
    this.root.append(this.stickZone, btns, this.act, pause);
    parent.appendChild(this.root);

    this.stickZone.addEventListener('pointerdown', (e) => {
      if (this.stickId !== null) return;
      this.stickId = e.pointerId;
      try {
        this.stickZone.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic pointers */
      }
      const r = this.stickZone.getBoundingClientRect();
      this.ox = e.clientX;
      this.oy = e.clientY;
      this.base.style.left = `${e.clientX - r.left}px`;
      this.base.style.top = `${e.clientY - r.top}px`;
      this.base.classList.add('on');
      this.moveKnob(e.clientX, e.clientY);
    });
    this.stickZone.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stickId) this.moveKnob(e.clientX, e.clientY);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      this.stickId = null;
      this.base.classList.remove('on');
      this.knob.style.transform = '';
      this.input.touchMove.x = this.input.touchMove.y = 0;
    };
    this.stickZone.addEventListener('pointerup', end);
    this.stickZone.addEventListener('pointercancel', end);
  }

  private moveKnob(x: number, y: number) {
    // The base stays where the thumb first landed; the knob stops at the rim.
    const R = 48;
    let dx = x - this.ox, dy = y - this.oy;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.input.touchMove.x = dx / R;
    this.input.touchMove.y = -dy / R;
  }

  /** Show the controls (touch devices, during play). */
  show(on: boolean) {
    if (on === this.shown) return;
    this.shown = on;
    this.root.classList.toggle('hidden', !on);
    if (!on) {
      this.input.touchMove.x = this.input.touchMove.y = 0;
      this.stickId = null;
      this.base.classList.remove('on');
    }
  }

  /** The context button appears when there is something to talk to or use. */
  setInteract(label: string | null) {
    if (!label) {
      this.act.classList.add('hidden');
      return;
    }
    this.act.classList.remove('hidden');
    if (this.act.textContent !== label) this.act.textContent = label;
  }
}
