import type { Audio } from '../audio/audio';

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
        <h3>Journal</h3>
        <div class="journal"></div>
        <div class="row"><span>Master</span><input type="range" min="0" max="100" data-k="master"><span class="val"></span></div>
        <div class="row"><span>Music</span><input type="range" min="0" max="100" data-k="music"><span class="val"></span></div>
        <div class="row"><span>Effects</span><input type="range" min="0" max="100" data-k="sfx"><span class="val"></span></div>
        <div class="row"><span>Ambience</span><input type="range" min="0" max="100" data-k="amb"><span class="val"></span></div>
        <div class="row"><span>Screen shake</span><button class="tog" data-s="shake"></button></div>
        <div class="row"><span>Tips</span><button class="tog" data-s="hints"></button></div>
        <h3>Controls</h3>
        <div class="keys">
          <b>WASD</b><span>Move</span>
          <b>Mouse</b><span>Aim: attacks, rolls and blocks go where you point</span>
          <b>Left click</b><span>Attack; click again to combo. Hold to charge a spin (release when it glows blue)</span>
          <b>Left click in the air</b><span>Down-stab; bounces off what it hits</span>
          <b>Right click</b><span>Guard: tap to roll, hold to block, press just before a hit to parry. In the air: dodge</span>
          <b>Space</b><span>Jump</span>
          <b>F</b><span>Special (half the blue bar): dash strike when moving, sword wave when still, plunge in the air</span>
          <b>E</b><span>Talk, open, rest, read</span>
          <b>Q</b><span>Drink a Moon Flask</span>
          <b>Esc</b><span>Pause</span>
        </div>
        <div class="btns"><button class="btn" data-a="resume">Resume</button><button class="btn" data-a="title">Quit to title</button></div>
      </div>`,
    );
    this.victory = div('victory', 'screen hidden', '<div class="t">The Keep Is Free</div><div class="s"></div><div class="stats"></div>');
    root.append(this.title, this.story, this.pause, this.victory, this.loading);

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

  setJournal(html: string) {
    (this.pause.querySelector('.journal') as HTMLElement).innerHTML = html;
  }

  onPauseAction(fn: (a: string) => void) {
    for (const b of this.pause.querySelectorAll<HTMLButtonElement>('[data-a]')) b.addEventListener('click', () => fn(b.dataset.a!));
  }

  hideLoading() {
    this.loading.style.opacity = '0';
    setTimeout(() => this.loading.remove(), 900);
  }

  showTitle(items: { label: string; act: () => void }[]) {
    const menu = this.title.querySelector('.menu') as HTMLElement;
    menu.innerHTML = '';
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
