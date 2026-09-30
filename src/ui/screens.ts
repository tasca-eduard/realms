import type { Audio } from '../audio/audio';
import { keyName } from '../engine/input';
import { WorldMap, type MapRealm } from './worldmap';

function div(id: string, cls: string, html: string) {
  const e = document.createElement('div');
  e.id = id;
  e.className = cls;
  e.innerHTML = html;
  return e;
}

export class Screens {
  title: HTMLElement;
  story: HTMLElement;
  pause: HTMLElement;
  victory: HTMLElement;
  loading: HTMLElement;
  private storyLines: string[] = [];
  private storyIdx = 0;
  private storyTyped = 0;
  private storyDone: (() => void) | null = null;
  storyOpen = false;
  pauseOpen = false;
  titleOpen = false;
  private titleSel = 0;
  private titleActions: (() => void)[] = [];

  constructor(root: HTMLElement, private audio: Audio, settings: { shake: boolean; hints: boolean }, private onSettings: () => void) {
    this.loading = div('loading', '', 'KINDLING THE MOON&hellip;');
    this.title = div(
      'title',
      'screen hidden',
      `<div class="logo"><div class="l1">EIGHT</div><div class="l2">Realms</div></div>
       <div class="sub">I &middot; THE MOONLIT KEEP</div>
       <div class="menu"></div>
       <div class="foot">Music samples: FluidR3_GM soundfont by Frank Wen, CC BY 3.0</div>`,
    );
    this.story = div('story', 'screen hidden', '<div class="line"></div><div class="hint">Press any key or tap</div>');
    this.pause = div(
      'pause',
      'screen hidden',
      `<div class="sheet">
        <h2>Paused</h2>
        <h3>The Eight Realms</h3>
        <div class="wslot"></div>
        <h3>Journal</h3>
        <div class="journal"></div>
        <div class="row"><span>Master</span><input type="range" min="0" max="100" data-k="master"><span class="val"></span></div>
        <div class="row"><span>Music</span><input type="range" min="0" max="100" data-k="music"><span class="val"></span></div>
        <div class="row"><span>Effects</span><input type="range" min="0" max="100" data-k="sfx"><span class="val"></span></div>
        <div class="row"><span>Ambience</span><input type="range" min="0" max="100" data-k="amb"><span class="val"></span></div>
        <div class="row"><span>Screen shake</span><button class="tog" data-s="shake"></button></div>
        <div class="row"><span>Tips</span><button class="tog" data-s="hints"></button></div>
        <h3>Controls</h3>
        <div class="keys tch">
          <b>Left thumb</b><span>Move (the stick stays where you first touch)</span>
          <b>Sword</b><span>Attack; tap again to combo. Hold to charge a spin. In the air: down-stab</span>
          <b>Shield</b><span>Tap to roll, hold to block, press just before a hit to parry. In the air: dodge</span>
          <b>Arrow</b><span>Jump</span>
          <b>Star</b><span>Special (half the blue bar): dash strike when moving, sword wave when still, plunge in the air</span>
          <b>Gold button</b><span>Talk, open, rest, read, ride</span>
          <b>Flask</b><span>Drink a Moon Flask</span>
          <b>Aim</b><span>Automatic: the nearest foe roughly where you push</span>
        </div>
        <div class="keys desk">
          <b data-keys="KeyW,KeyA,KeyS,KeyD">WASD</b><span>Move (or the arrow keys)</span>
          <b>Mouse</b><span>Aim: attacks, rolls and blocks go where you point</span>
          <b>Left click</b><span>Attack; click again to combo. Hold to charge a spin (release when it glows blue)</span>
          <b>Left click in the air</b><span>Down-stab; bounces off what it hits</span>
          <b>Right click</b><span>Guard: tap to roll, hold to block, press just before a hit to parry. In the air: dodge</span>
          <b>Space</b><span>Jump</span>
          <b data-keys="KeyF">F</b><span>Special (half the blue bar): dash strike when moving, sword wave when still, plunge in the air</span>
          <b data-keys="KeyE">E</b><span>Talk, open, rest, read, ride</span>
          <b data-keys="KeyQ">Q</b><span>Drink a Moon Flask</span>
          <b>Esc</b><span>Pause</span>
        </div>
        <div class="keys pad">
          <b>Left stick</b><span>Move</span>
          <b>Right stick</b><span>Aim (or aim where you move)</span>
          <b>X</b><span>Attack; press again to combo. Hold to charge a spin (release when it glows blue). In the air: down-stab</span>
          <b>B</b><span>Guard: tap to roll, hold to block, press just before a hit to parry. In the air: dodge</span>
          <b>A</b><span>Jump</span>
          <b>RB</b><span>Special (half the blue bar): dash strike when moving, sword wave when still, plunge in the air</span>
          <b>Y</b><span>Talk, open, rest, read, ride</span>
          <b>LB</b><span>Drink a Moon Flask</span>
          <b>Start</b><span>Pause (B resumes)</span>
        </div>
        <div class="btns"><button class="btn" data-a="resume">Resume</button><button class="btn" data-a="title">Quit to title</button></div>
      </div>`,
    );
    this.victory = div('victory', 'screen hidden', '<div class="t">The Keep Is Free</div><div class="s"></div><div class="stats"></div>');
    root.append(this.title, this.story, this.pause, this.victory, this.loading);
    // Clicking a visited realm on the map is the same as its Travel button.
    this.map = new WorldMap((id) => (this.pause.querySelector(`.btns [data-a="realm:${id}"]`) as HTMLElement | null)?.click());
    this.pause.querySelector('.wslot')!.replaceWith(this.map.el);

    for (const inp of this.pause.querySelectorAll<HTMLInputElement>('input[type=range]')) {
      const k = inp.dataset.k as keyof Audio['vol'];
      const val = inp.nextElementSibling as HTMLElement;
      const sync = () => (val.textContent = inp.value);
      inp.value = String(Math.round(this.audio.vol[k] * 100));
      sync();
      inp.addEventListener('input', () => {
        this.audio.vol[k] = Number(inp.value) / 100;
        sync();
        this.audio.saveVolumes();
      });
    }
    for (const b of this.pause.querySelectorAll<HTMLButtonElement>('.tog')) {
      const k = b.dataset.s as 'shake' | 'hints';
      const sync = () => {
        b.textContent = settings[k] ? 'On' : 'Off';
        b.classList.toggle('on', settings[k]);
      };
      sync();
      b.addEventListener('click', () => {
        settings[k] = !settings[k];
        sync();
        this.onSettings();
      });
    }
  }

  /** The realm's name under the logo and on the victory screen; a travel card on the loading screen after a border crossing. */
  setRealm(title: string, victory: string, card: [string, string] | null) {
    (this.title.querySelector('.sub') as HTMLElement).innerHTML = title;
    (this.victory.querySelector('.t') as HTMLElement).textContent = victory;
    if (card) this.loading.innerHTML = `<div class="travel"><span>${card[0]}</span><b>&rarr;</b><span>${card[1]}</span></div>`;
  }

  private map: WorldMap;
  setWorldMap(realms: MapRealm[]) {
    this.map.draw(realms);
  }

  setJournal(html: string) {
    (this.pause.querySelector('.journal') as HTMLElement).innerHTML = html;
  }

  onPauseAction(fn: (a: string) => void) {
    // Delegated: travel buttons are added after this is set up.
    this.pause.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
      if (b) fn(b.dataset.a!);
    });
  }

  /** A button per other realm in the pause menu, between Resume and Quit. */
  setTravel(realms: { id: string; name: string }[]) {
    const quit = this.pause.querySelector('.btns [data-a="title"]')!;
    for (const r of realms) {
      const b = document.createElement('button');
      b.className = 'btn';
      b.dataset.a = `realm:${r.id}`;
      b.textContent = `Travel to ${r.name}`;
      quit.before(b);
    }
  }

  hideLoading() {
    this.loading.style.opacity = '0';
    setTimeout(() => this.loading.remove(), 900);
  }

  showTitle(items: { label: string; act: () => void }[], note = '') {
    const menu = this.title.querySelector('.menu') as HTMLElement;
    menu.innerHTML = note ? `<div class="note">${note}</div>` : '';
    this.titleActions = items.map((i) => i.act);
    this.titleSel = 0;
    items.forEach((it, idx) => {
      const b = document.createElement('button');
      b.className = 'btn' + (idx === 0 ? ' sel' : '');
      b.textContent = it.label;
      b.addEventListener('click', () => {
        this.audio.unlock();
        this.audio.sfx('ui');
        it.act();
      });
      b.addEventListener('mouseenter', () => {
        this.titleSel = idx;
        this.syncTitle();
      });
      menu.appendChild(b);
    });
    this.title.classList.remove('hidden', 'fade');
    this.titleOpen = true;
  }

  private syncTitle() {
    this.title.querySelectorAll('.btn').forEach((b, i) => b.classList.toggle('sel', i === this.titleSel));
  }

  titleKey(k: 'up' | 'down' | 'ok') {
    const n = this.titleActions.length;
    if (k === 'ok') {
      this.audio.unlock();
      this.audio.sfx('ui');
      this.titleActions[this.titleSel]?.();
      return;
    }
    this.titleSel = (this.titleSel + (k === 'down' ? 1 : n - 1)) % n;
    this.syncTitle();
    this.audio.sfx('blip');
  }

  hideTitle() {
    this.titleOpen = false;
    this.title.classList.add('fade');
    setTimeout(() => this.title.classList.add('hidden'), 1200);
  }

  showStory(lines: string[], done: () => void) {
    this.storyLines = lines;
    this.storyIdx = 0;
    this.storyTyped = 0;
    this.storyDone = done;
    this.storyOpen = true;
    this.story.classList.remove('hidden');
    this.story.style.opacity = '1';
  }

  storyKey() {
    const line = this.storyLines[this.storyIdx];
    if (this.storyTyped < line.length) {
      this.storyTyped = line.length;
      return;
    }
    this.storyIdx++;
    this.storyTyped = 0;
    if (this.storyIdx >= this.storyLines.length) {
      this.storyOpen = false;
      this.story.style.opacity = '0';
      setTimeout(() => this.story.classList.add('hidden'), 1000);
      this.storyDone?.();
    }
  }

  setPause(on: boolean) {
    this.pauseOpen = on;
    this.pause.classList.toggle('hidden', !on);
    this.pauseSel = 0;
    this.syncPause();
  }

  private pauseSel = 0;
  private syncPause() {
    this.pause.querySelectorAll('.btns .btn').forEach((b, i) => b.classList.toggle('sel', i === this.pauseSel));
  }
  /** Up, down and OK from the keyboard or a pad. */
  pauseKey(k: 'up' | 'down' | 'ok') {
    const btns = [...this.pause.querySelectorAll<HTMLButtonElement>('.btns .btn')];
    if (k === 'ok') {
      btns[this.pauseSel]?.click();
      return;
    }
    this.pauseSel = (this.pauseSel + (k === 'down' ? 1 : btns.length - 1)) % btns.length;
    this.syncPause();
    this.audio.sfx('blip');
  }

  /** Print key names as this keyboard labels them. */
  refreshKeys() {
    for (const b of this.pause.querySelectorAll<HTMLElement>('[data-keys]')) b.textContent = b.dataset.keys!.split(',').map(keyName).join('');
  }

  showVictory(sub: string, stats: string) {
    (this.victory.querySelector('.s') as HTMLElement).innerHTML = sub;
    (this.victory.querySelector('.stats') as HTMLElement).innerHTML = stats;
    this.victory.classList.remove('hidden');
    requestAnimationFrame(() => this.victory.classList.add('on'));
  }
  hideVictory() {
    this.victory.classList.remove('on');
    setTimeout(() => this.victory.classList.add('hidden'), 2000);
  }

  update(dt: number) {
    if (!this.storyOpen) return;
    const line = this.storyLines[this.storyIdx] ?? '';
    const before = Math.floor(this.storyTyped);
    this.storyTyped = Math.min(line.length, this.storyTyped + dt * 38);
    if (Math.floor(this.storyTyped) !== before && before % 3 === 0) this.audio.sfx('blip');
    (this.story.querySelector('.line') as HTMLElement).textContent = line.slice(0, Math.floor(this.storyTyped));
  }
}
