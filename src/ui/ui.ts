import './style.css';
import { keyName } from '../engine/input';
import type { Action } from '../engine/input';

const HEART = `<svg viewBox="0 0 7 6" shape-rendering="crispEdges"><path class="f" fill="#e43b44" d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z"/><path class="s" fill="#ff9aa0" d="M1 1h1v1H1z"/></svg>`;
const FLASK = `<svg viewBox="0 0 7 10" shape-rendering="crispEdges"><path fill="#15132a" d="M2 0h3v1H5v2h1v1h1v5H6v1H1V9H0V4h1V3h1V1H2z"/><path fill="#8a8aa0" d="M2 1h3v2H2z"/><path class="liq" fill="#5ad1ff" d="M1 5h5v4H1zM2 4h3v1H2z"/><path class="glow" fill="#c8f4ff" d="M2 5h1v2H2z"/></svg>`;
const AIRB = `<svg viewBox="0 0 7 7" shape-rendering="crispEdges"><path class="o" fill="#bfefff" d="M2 0h3v1h1v1h1v3H6v1H5v1H2V6H1V5H0V2h1V1h1z"/><path class="i" fill="#3a9ec8" d="M2 1h3v1h1v3H5v1H2V5H1V2h1z"/><path class="s" fill="#ffffff" d="M2 2h1v1H2z"/></svg>`;
const COIN = `<svg viewBox="0 0 7 7" shape-rendering="crispEdges"><path fill="#b86f10" d="M2 0h3v1h1v1h1v3H6v1H5v1H2V6H1V5H0V2h1V1h1z"/><path fill="#feae34" d="M2 1h3v1h1v3H5v1H2V5H1V2h1z"/><path fill="#fff0a0" d="M3 2h1v3H3z"/></svg>`;

function el(tag: string, id?: string, cls?: string, html?: string) {
  const e = document.createElement(tag);
  if (id) e.id = id;
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export interface DialogOption {
  label: string;
  cost?: number;
  disabled?: boolean;
  act: () => void;
}

export interface Settings {
  shake: boolean;
  lines: number;
  hints: boolean;
}

export class UI {
  root: HTMLElement;
  private hearts = el('div', 'hearts');
  private stam = el('div', 'stam', '', '<div id="stamFill"></div>');
  private energyEl = el('div', 'energy', '', '<div id="energyFill"></div>');
  private airEl = el('div', 'air', 'off');
  private airKey = '';
  private powerEl = el('div', 'power', 'off', '<span class="pn"></span><div class="pbar"><div class="pfill"></div></div>');
  private comboEl = el('div', 'combo', '', '<span class="cn"></span><span class="cm"></span>');
  private horseEl = el('div', 'horseHp', 'off');
  private fxEl = el('div', 'effects');
  private fxKey = '';
  private objEl = el('div', 'objective', 'off');
  private questEl = el('div', 'questNote');
  private questT = 0;
  private comboT = 0;
  private flasks = el('div', 'flasks');
  private coinsEl = el('div', 'coins', '', `${COIN}<span>0</span>`);
  private hudEl = el('div', 'hud');
  private promptEl = el('div', 'prompt');
  private toastEl = el('div', 'toast');
  private areaEl = el('div', 'area', '', '<div class="name"></div><div class="rule"></div><div class="sub"></div>');
  private dialogEl = el('div', 'dialog', 'hidden', '<div class="who"></div><div class="text"></div><div class="opts"></div><div class="more">&#9660;</div>');
  private loreEl = el('div', 'lore', '', '<div class="card"><div class="glyph">&#10022; &#10022; &#10022;</div><div class="txt"></div><div class="hint">Press E or tap to close</div></div>');
  private bossEl = el('div', 'boss', '', '<div class="bname"></div><div class="bar"><div class="lag"></div><div class="fill"></div></div>');
  private bossIntroEl = el('div', 'bossIntro', '', '<div class="n"></div><div class="t"></div>');
  private deadEl = el('div', 'dead', 'screen hidden', '<div class="t">You have fallen</div><div class="h">Press any key or tap to rise at the last moonfire</div>');
  private fader = el('div', 'fader');
  private hurtEl = el('div', 'hurt');
  private hintEl = el('div', 'hint');
  private bubbleEl = el('div', 'bubble');
  private lastHud = '';
  private toastT = 0;
  private areaT = 0;
  private hintT = 0;
  private bubbleT = 0;
  // Dialog state.
  private lines: string[] = [];
  private lineIdx = 0;
  private typed = 0;
  private options: DialogOption[] | null = null;
  private optSel = 0;
  /**
   * Time since the answers appeared or since the last key press on them. Keys only pick
   * an answer after a short pause, so mashing through a shopkeeper's lines never buys
   * anything (each mashed press restarts the wait). The same goes for taps.
   */
  private optsT = 0;
  private onDone: (() => void) | null = null;
  dialogOpen = false;
  loreOpen = false;
  private loreT = 0;
  blip: () => void = () => {};

  constructor(root: HTMLElement) {
    this.root = root;
    this.hudEl.append(this.hearts, this.stam, this.energyEl, this.airEl, this.flasks, this.powerEl, this.horseEl, this.fxEl);
    root.append(this.hurtEl, this.hudEl, this.coinsEl, this.objEl, this.questEl, this.comboEl, this.promptEl, this.toastEl, this.areaEl, this.bubbleEl, this.bossEl, this.bossIntroEl, this.hintEl, this.dialogEl, this.loreEl, this.deadEl, this.fader);
    this.dialogEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (!this.options) this.advance();
      else this.optsT = 0; // still tapping through: the answers wait a moment
    });
    this.loreEl.addEventListener('pointerdown', () => this.closeLore());
  }

  hudVisible(on: boolean) {
    this.hudEl.classList.toggle('off', !on);
    this.objEl.style.visibility = on ? '' : 'hidden';
    this.coinsEl.classList.toggle('off', !on);
  }

  hud(s: { hp: number; maxHp: number; stamina: number; maxStamina: number; flasks: number; flasksMax: number; coins: number; energy: number; power: { kind: string; t: number } | null }, horse: { hp: number; max: number; name: string } | null = null) {
    if (horse) {
      const html = `<span>${horse.name}</span>${Array.from({ length: horse.max }, (_, i) => `<i class="${i < horse.hp ? 'on' : ''}"></i>`).join('')}`;
      if (this.horseEl.innerHTML !== html) this.horseEl.innerHTML = html;
      this.horseEl.classList.remove('off');
    } else this.horseEl.classList.add('off');
    (this.energyEl.firstChild as HTMLElement).style.width = `${s.energy}%`;
    this.energyEl.classList.toggle('ready', s.energy >= 50);
    if (s.power && s.power.t > 0) {
      this.powerEl.classList.remove('off');
      const names: Record<string, [string, string]> = {
        fire: ['Fire Blade', '#ff8a3c'], wind: ['Wind Boots', '#b8f0ff'], magnet: ['Magnet', '#feae34'], bubble: ['Bubble', '#5ad1ff'], giant: ['Giant Slash', '#e0b0ff'],
        ink: ["Kraken's Ink", '#c27ae8'],
      };
      const [n, c] = names[s.power.kind] ?? [s.power.kind, '#fff'];
      const pn = this.powerEl.querySelector('.pn') as HTMLElement;
      if (pn.textContent !== n) {
        pn.textContent = n;
        pn.style.color = c;
        (this.powerEl.querySelector('.pfill') as HTMLElement).style.background = c;
      }
      (this.powerEl.querySelector('.pfill') as HTMLElement).style.width = `${(s.power.t / 20) * 100}%`;
    } else this.powerEl.classList.add('off');
    const key = `${s.hp}/${s.maxHp}/${s.flasks}/${s.flasksMax}`;
    if (key !== this.lastHud) {
      this.lastHud = key;
      let h = '';
      for (let i = 0; i < s.maxHp; i++) h += i < s.hp ? HEART : HEART.replace('<svg', '<svg class="empty"');
      this.hearts.innerHTML = h;
      this.hearts.classList.toggle('low', s.hp <= 1);
      let f = '';
      for (let i = 0; i < s.flasksMax; i++) f += i < s.flasks ? FLASK : FLASK.replace('<svg', '<svg class="used"');
      this.flasks.innerHTML = f + `<span id="flaskKey">${this.keyLabel('heal')}</span>`;
      this.hurtEl.classList.toggle('low', s.hp <= 1 && s.hp > 0);
    }
    (this.stam.firstChild as HTMLElement).style.width = `${(s.stamina / s.maxStamina) * 100}%`;
    this.stam.classList.toggle('tired', s.stamina < 20);
    const c = this.coinsEl.querySelector('span')!;
    if (c.textContent !== String(s.coins)) {
      c.textContent = String(s.coins);
      this.coinsEl.classList.remove('bump');
      void this.coinsEl.offsetWidth;
      this.coinsEl.classList.add('bump');
    }
  }

  /** The diving suit's air, as bubbles (one for each ten seconds): hidden while it's full and the knight is
   *  above the water; the bubbles pulse when it runs low, and the row flashes when it's gone. */
  air(s: { left: number; max: number; show: boolean }) {
    this.airEl.classList.toggle('off', !s.show);
    if (!s.show) return;
    const n = Math.ceil(s.max / 10), full = Math.ceil(s.left / 10 - 1e-6);
    const key = `${n}/${full}`;
    if (key !== this.airKey) {
      this.airKey = key;
      let h = '';
      for (let i = 0; i < n; i++) h += i < full ? AIRB : AIRB.replace('<svg', '<svg class="gone"');
      this.airEl.innerHTML = h;
    }
    this.airEl.classList.toggle('low', s.left > 0 && s.left < s.max * 0.25);
    this.airEl.classList.toggle('empty', s.left <= 0);
  }

  /** Floating words that rise and fade (tired, x2 coins, power names). */
  pop(text: string, x: number, y: number, color: string) {
    const e = el('div', undefined, 'pop', text);
    e.style.left = `${x}px`;
    e.style.top = `${y}px`;
    e.style.color = color;
    this.root.appendChild(e);
    setTimeout(() => e.remove(), 1100);
  }

  /** Status effect icons with a bar for the time left. */
  effects(left: Record<string, number>, max: Record<string, number>) {
    const ICONS: Record<string, [string, string, string]> = {
      maim: ['Maimed', '#ff8a8a', '<path d="M2 0h2v4h2v2H1V5h1z"/><path fill="#c02020" d="M5 1h1v1H5zM6 2h1v1H6z"/>'],
      daze: ['Dazed', '#fff0a0', '<path d="M1 1h1v1H1zM5 0h1v1H5zM3 3h1v1H3zM0 5h1v1H0zM5 5h1v1H5zM2 6h1v1H2z"/>'],
      burn: ['Burning', '#ff9a50', '<path d="M3 0h1v1h1v2h1v3H5v1H2V6H1V3h1V1h1z"/><path fill="#ffe080" d="M3 4h1v2H3z"/>'],
      snare: ['Snared', '#d8c8a0', '<path d="M1 1h5v1H1zM0 2h1v3H0zM6 2h1v3H6zM1 5h5v1H1zM3 3h1v4H3z"/>'],
      poison: ['Poisoned', '#9ef07a', '<path d="M2 0h3v1h1v3H5v1H2V4H1V1h1z"/><path fill="#15132a" d="M2 2h1v1H2zM4 2h1v1H4z"/><path d="M2 6h1v1H2zM4 6h1v1H4z"/>'],
    };
    const on = Object.keys(ICONS).filter((k) => left[k] > 0);
    const key = on.join(',');
    if (key !== this.fxKey) {
      this.fxKey = key;
      this.fxEl.innerHTML = on
        .map((k) => `<div class="fx" data-k="${k}" style="color:${ICONS[k][1]}"><svg viewBox="0 0 7 7" shape-rendering="crispEdges" fill="currentColor">${ICONS[k][2]}</svg><span>${ICONS[k][0]}</span><i></i></div>`)
        .join('');
    }
    for (const k of on) {
      const bar = this.fxEl.querySelector(`[data-k="${k}"] i`) as HTMLElement | null;
      if (bar) bar.style.width = `${Math.max(0, Math.min(1, left[k] / (max[k] || 1))) * 100}%`;
    }
  }

  objective(text: string | null) {
    if (!text) {
      this.objEl.classList.add('off');
      return;
    }
    this.objEl.innerHTML = `<span>&#9670;</span> ${text}`;
    this.objEl.classList.remove('off');
  }

  questNote(kind: string, title: string) {
    this.questEl.innerHTML = `<small>${kind}</small>${title}`;
    this.questEl.classList.add('on');
    this.questT = 3.2;
  }

  combo(n: number, mult: number) {
    if (n < 2) {
      this.comboEl.classList.remove('on');
      return;
    }
    (this.comboEl.querySelector('.cn') as HTMLElement).textContent = `${n} hits`;
    (this.comboEl.querySelector('.cm') as HTMLElement).textContent = mult > 1 ? `x${mult} coins` : '';
    this.comboEl.classList.add('on');
    this.comboEl.classList.remove('bump');
    void this.comboEl.offsetWidth;
    this.comboEl.classList.add('bump');
    this.comboT = 2.5;
  }

  pulseHearts() {
    this.hearts.classList.remove('pulse');
    void this.hearts.offsetWidth;
    this.hearts.classList.add('pulse');
  }

  hurtFlash() {
    this.hurtEl.classList.add('on');
    setTimeout(() => this.hurtEl.classList.remove('on'), 60);
  }

  /** Key labels changed (the keyboard layout became known): redraw what shows them. */
  refreshKeys() {
    this.lastHud = '';
  }

  /** The key or button for an action on the device in use (the game hooks this up). */
  keyLabel: (a: Action) => string = (a) => keyName(a === 'heal' ? 'KeyQ' : 'KeyE');

  prompt(text: string | null, key = this.keyLabel('interact')) {
    if (!text) {
      this.promptEl.classList.remove('on');
      return;
    }
    const warn = text.startsWith('!');
    const html = warn ? text.slice(1) : `<kbd>${key}</kbd>${text}`;
    if (this.promptEl.innerHTML !== html) this.promptEl.innerHTML = html;
    this.promptEl.classList.toggle('warn', warn);
    this.promptEl.classList.add('on');
  }

  toast(title: string, sub = '', dur = 2.6) {
    this.toastEl.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
    this.toastEl.classList.add('on');
    this.toastT = dur;
  }

  /** Tips can be turned off in the pause menu. */
  tipsOn: () => boolean = () => true;

  hint(text: string, dur = 6) {
    if (!this.tipsOn()) return;
    this.hintEl.innerHTML = text;
    this.hintEl.classList.add('on');
    this.hintT = dur;
  }

  area(name: string, sub = '') {
    (this.areaEl.querySelector('.name') as HTMLElement).textContent = name;
    (this.areaEl.querySelector('.sub') as HTMLElement).textContent = sub;
    this.areaEl.classList.add('on');
    this.areaT = 3.4;
  }

  bubble(text: string, x: number, y: number, dur = 2.6) {
    this.bubbleEl.textContent = text;
    this.bubbleEl.style.left = `${x}px`;
    this.bubbleEl.style.top = `${y}px`;
    this.bubbleEl.classList.add('on');
    this.bubbleT = dur;
  }
  moveBubble(x: number, y: number) {
    this.bubbleEl.style.left = `${x}px`;
    this.bubbleEl.style.top = `${y}px`;
  }

  // ---------- dialog ----------

  say(name: string, lines: string[], onDone?: () => void, options?: DialogOption[]) {
    this.lines = lines;
    this.lineIdx = 0;
    this.typed = 0;
    this.onDone = onDone ?? null;
    this.pendingOptions = options ?? null;
    this.options = null;
    this.dialogOpen = true;
    (this.dialogEl.querySelector('.who') as HTMLElement).textContent = name;
    this.dialogEl.classList.remove('hidden');
    this.renderOpts();
  }
  private pendingOptions: DialogOption[] | null = null;

  private renderOpts() {
    const box = this.dialogEl.querySelector('.opts') as HTMLElement;
    box.innerHTML = '';
    const more = this.dialogEl.querySelector('.more') as HTMLElement;
    more.style.display = this.options ? 'none' : '';
    if (!this.options) return;
    this.options.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'opt' + (i === this.optSel ? ' sel' : '');
      b.innerHTML = `${o.label}${o.cost !== undefined ? `<span class="cost">${o.cost} coins</span>` : ''}`;
      if (o.disabled) b.setAttribute('disabled', '');
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        // A tap that lands on an answer the instant it appears was meant for the lines.
        if (this.optsT < 0.4) {
          this.optsT = 0;
          return;
        }
        this.optSel = i;
        this.choose();
      });
      box.appendChild(b);
    });
  }

  private choose() {
    const o = this.options?.[this.optSel];
    if (!o || o.disabled) return;
    this.close();
    o.act();
  }

  close() {
    this.dialogOpen = false;
    this.dialogEl.classList.add('hidden');
    this.options = null;
  }

  /** Advance: finish typing, next line, or end. */
  advance() {
    const line = this.lines[this.lineIdx] ?? '';
    if (this.typed < line.length) {
      this.typed = line.length;
      return;
    }
    if (this.lineIdx < this.lines.length - 1) {
      this.lineIdx++;
      this.typed = 0;
      return;
    }
    if (this.pendingOptions && !this.options) {
      this.options = this.pendingOptions;
      this.optSel = this.options.findIndex((o) => !o.disabled);
      if (this.optSel < 0) this.optSel = this.options.length - 1;
      this.optsT = 0;
      this.renderOpts();
      return;
    }
    if (this.options) return;
    this.close();
    const cb = this.onDone;
    this.onDone = null;
    cb?.();
  }

  dialogKey(k: 'up' | 'down' | 'ok') {
    if (!this.options) {
      if (k === 'ok') this.advance();
      return;
    }
    if (k === 'ok') {
      if (this.optsT > 0.4) this.choose();
      else this.optsT = 0;
      return;
    }
    const n = this.options.length;
    for (let i = 0; i < n; i++) {
      this.optSel = (this.optSel + (k === 'down' ? 1 : n - 1)) % n;
      if (!this.options[this.optSel].disabled) break;
    }
    this.renderOpts();
  }

  // ---------- lore ----------

  lore(text: string, plain = false) {
    (this.loreEl.querySelector('.txt') as HTMLElement).textContent = text;
    (this.loreEl.querySelector('.glyph') as HTMLElement).style.display = plain ? 'none' : '';
    (this.loreEl.querySelector('.hint') as HTMLElement).textContent = document.body.classList.contains('touch') ? 'Tap to close' : `Press ${this.keyLabel('interact')} to close`;
    this.loreEl.classList.add('on');
    this.loreOpen = true;
    this.loreT = 0;
  }
  closeLore() {
    if (this.loreT < 0.3) return false;
    this.loreEl.classList.remove('on');
    this.loreOpen = false;
    return true;
  }

  // ---------- boss ----------

  bossShow(name: string) {
    (this.bossEl.querySelector('.bname') as HTMLElement).textContent = name;
    this.bossHp(1);
    this.bossEl.classList.add('on');
  }
  bossHp(k: number) {
    const v = Math.max(0, k);
    (this.bossEl.querySelector('.fill') as HTMLElement).style.transform = `scaleX(${v})`;
    (this.bossEl.querySelector('.lag') as HTMLElement).style.transform = `scaleX(${v})`;
  }
  bossHide() {
    this.bossEl.classList.remove('on');
  }
  bossIntro(name: string, title: string, dur = 3) {
    // (Its name takes the place's: never the two at once.)
    this.areaEl.classList.remove('on');
    this.areaT = 0;
    (this.bossIntroEl.querySelector('.n') as HTMLElement).textContent = name;
    (this.bossIntroEl.querySelector('.t') as HTMLElement).textContent = title;
    this.bossIntroEl.classList.add('on');
    setTimeout(() => this.bossIntroEl.classList.remove('on'), dur * 1000);
  }

  // ---------- screens ----------

  fade(on: boolean) {
    this.fader.classList.toggle('on', on);
  }

  dead(on: boolean) {
    this.deadEl.classList.toggle('hidden', !on);
    const h = this.deadEl.querySelector('.h') as HTMLElement;
    if (on) {
      requestAnimationFrame(() => this.deadEl.classList.add('on'));
      h.classList.remove('on');
      setTimeout(() => h.classList.add('on'), 2200);
    } else this.deadEl.classList.remove('on');
  }

  update(dt: number) {
    this.optsT += dt;
    this.comboT -= dt;
    this.questT -= dt;
    if (this.questT <= 0) this.questEl.classList.remove('on');
    this.toastT -= dt;
    if (this.toastT <= 0) this.toastEl.classList.remove('on');
    this.areaT -= dt;
    if (this.areaT <= 0) this.areaEl.classList.remove('on');
    this.hintT -= dt;
    if (this.hintT <= 0) this.hintEl.classList.remove('on');
    this.bubbleT -= dt;
    if (this.bubbleT <= 0) this.bubbleEl.classList.remove('on');
    this.loreT += dt;
    if (this.dialogOpen && !this.options) {
      const line = this.lines[this.lineIdx] ?? '';
      if (this.typed < line.length) {
        const before = Math.floor(this.typed);
        this.typed = Math.min(line.length, this.typed + dt * 55);
        if (Math.floor(this.typed) !== before && before % 3 === 0 && line[before] !== ' ') this.blip();
      }
      (this.dialogEl.querySelector('.text') as HTMLElement).textContent = line.slice(0, Math.floor(this.typed));
      (this.dialogEl.querySelector('.more') as HTMLElement).style.visibility = this.typed >= line.length ? 'visible' : 'hidden';
    }
  }
}
