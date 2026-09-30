// Web Audio: synthesized effects, layered ambience, and sample-based music.
import { Music } from './music';

export interface AmbState {
  x: number;
  z: number;
  /** 0..1 how much each bed is present. */
  wind: number;
  crickets: number;
  owls: number;
  water: number;
  fire: number;
  drums: number;
  indoor: boolean;
}

export class Audio {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfxBus!: GainNode;
  ambBus!: GainNode;
  musicBus!: GainNode;
  reverb!: ConvolverNode;
  revSend!: GainNode;
  noise!: AudioBuffer;
  brown!: AudioBuffer;
  music: Music | null = null;
  lx = 0;
  lz = 0;
  /** Screen-right direction on the ground, for panning. */
  rx = 0.707;
  rz = -0.707;
  vol = { master: 0.8, music: 0.55, sfx: 0.8, amb: 0.7 };
  private windSrc: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  private waterSrc: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  private fireSrc: { gain: GainNode } | null = null;
  private nextCricket = 0;
  private nextOwl = 8;
  private nextCrackle = 0;
  private nextDrum = 0;
  private drumStep = 0;
  private nextFrog = 5;
  private muffle!: BiquadFilterNode;
  amb: AmbState = { x: 0, z: 0, wind: 0.5, crickets: 0.5, owls: 0.5, water: 0, fire: 0, drums: 0, indoor: false };

  constructor() {
    try {
      const s = JSON.parse(localStorage.getItem('realms-audio') || 'null');
      if (s) Object.assign(this.vol, s);
    } catch {
      /* ignore */
    }
  }

  saveVolumes() {
    try {
      localStorage.setItem('realms-audio', JSON.stringify(this.vol));
    } catch {
      /* ignore */
    }
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.vol.amb, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vol.music, t, 0.05);
  }

  /** Must be called from a user gesture. */
  /** Stop the audio clock while the page is hidden (nothing piles up for the return). */
  sleep(on: boolean) {
    if (!this.ctx) return;
    if (on && this.ctx.state === 'running') this.ctx.suspend();
    else if (!on && this.ctx.state === 'suspended') this.ctx.resume();
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 20000;
    this.muffle.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.ambBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.sfxBus.connect(this.muffle);
    this.ambBus.connect(this.muffle);
    this.musicBus.connect(this.master);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.8, 2.2);
    this.revSend = ctx.createGain();
    this.revSend.gain.value = 0.35;
    this.revSend.connect(this.reverb).connect(this.master);
    this.noise = this.makeNoise(false);
    this.brown = this.makeNoise(true);
    this.applyVolumes();
    this.startBeds();
    this.music = new Music(ctx, this.musicBus, this.reverb);
    this.music.load();
  }

  private impulse(sec: number, decay: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * sec);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  private makeNoise(brown: boolean) {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 3;
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return b;
  }

  private loopNoise(buf: AudioBuffer, type: BiquadFilterType, freq: number, q: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.ambBus);
    src.start();
    return { gain, filter };
  }

  private startBeds() {
    this.windSrc = this.loopNoise(this.brown, 'bandpass', 420, 0.6);
    this.waterSrc = this.loopNoise(this.noise, 'bandpass', 1400, 0.8);
    const f = this.loopNoise(this.brown, 'lowpass', 260, 0.7);
    this.fireSrc = { gain: f.gain };
  }

  setListener(x: number, z: number) {
    this.lx = x;
    this.lz = z;
  }

  setMuffle(hz: number) {
    if (!this.ctx) return;
    this.muffle.frequency.setTargetAtTime(hz, this.ctx.currentTime, 0.2);
  }

  /** Stereo pan and distance gain for a world position. */
  private spatial(x?: number, z?: number, range = 10) {
    if (x === undefined || z === undefined) return { pan: 0, gain: 1 };
    const dx = x - this.lx, dz = z - this.lz;
    const d = Math.hypot(dx, dz);
    const side = dx * this.rx + dz * this.rz;
    return { pan: Math.max(-1, Math.min(1, side / 10)), gain: 1 / (1 + (d / range) ** 2) };
  }

  private out(gain: number, pan: number, reverb = 0.2) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = gain;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p).connect(this.sfxBus);
    if (reverb > 0) {
      const r = ctx.createGain();
      r.gain.value = reverb;
      p.connect(r).connect(this.revSend);
    }
    return g;
  }

  private noiseHit(dest: AudioNode, t: number, dur: number, type: BiquadFilterType, f0: number, f1: number, q: number, vol: number, attack = 0.002, brown = false) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = brown ? this.brown : this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 2);
    src.stop(t + dur + 0.05);
  }

  private tone(dest: AudioNode, t: number, type: OscillatorType, f0: number, f1: number, dur: number, vol: number, attack = 0.005) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private bell(dest: AudioNode, t: number, f: number, dur: number, vol: number, ratios = [1, 2.76, 5.4, 8.93]) {
    ratios.forEach((r, i) => this.tone(dest, t, 'sine', f * r, f * r * 0.998, dur / (1 + i * 0.7), vol / (1 + i * 1.3), 0.002));
  }

  sfx(name: string, x?: number, z?: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    const sp = this.spatial(x, z);
    if (sp.gain < 0.02) return;
    const o = (v: number, rev = 0.2) => this.out(v * sp.gain, sp.pan, rev);
    const R = Math.random;
    switch (name) {
      case 'swing':
        this.noiseHit(o(0.5, 0.1), t, 0.16, 'bandpass', 900 + R() * 300, 3200, 1.2, 0.6, 0.03);
        break;
      case 'swingHeavy':
        this.noiseHit(o(0.6, 0.15), t + 0.08, 0.26, 'bandpass', 500, 2600, 1.1, 0.7, 0.06);
        this.tone(o(0.25, 0), t, 'sine', 180, 90, 0.2, 0.3);
        break;
      case 'enemySwing':
        this.noiseHit(o(0.35, 0.1), t, 0.15, 'bandpass', 700, 2000, 1.3, 0.5, 0.03);
        break;
      case 'hit': {
        const d = o(0.8, 0.15);
        this.noiseHit(d, t, 0.12, 'lowpass', 2400, 400, 0.8, 0.8);
        this.tone(d, t, 'sine', 160, 60, 0.14, 0.7);
        this.tone(d, t, 'square', 90 + R() * 30, 40, 0.07, 0.15);
        break;
      }
      case 'boneHit': {
        const d = o(0.8, 0.15);
        this.noiseHit(d, t, 0.08, 'bandpass', 2600, 1200, 3, 0.8);
        this.tone(d, t, 'triangle', 700, 300, 0.07, 0.25);
        break;
      }
      case 'clang':
      case 'parry': {
        const d = o(name === 'parry' ? 0.9 : 0.6, 0.5);
        this.noiseHit(d, t, 0.06, 'highpass', 3000, 3000, 0.7, 0.6);
        this.bell(d, t, name === 'parry' ? 1150 : 880 + R() * 120, name === 'parry' ? 1.2 : 0.6, 0.35);
        break;
      }
      case 'guard':
        this.noiseHit(o(0.25, 0), t, 0.08, 'bandpass', 1800, 900, 2, 0.4);
        break;
      case 'guardBreak':
        this.bell(o(0.6, 0.4), t, 520, 0.5, 0.4);
        this.noiseHit(o(0.6), t, 0.3, 'lowpass', 1800, 200, 1, 0.6);
        break;
      case 'shieldBreak':
        this.noiseHit(o(0.8, 0.3), t, 0.35, 'bandpass', 900, 300, 1, 0.9);
        for (let i = 0; i < 5; i++) this.noiseHit(o(0.3), t + 0.03 + i * 0.05, 0.05, 'bandpass', 1500 + R() * 1500, 800, 4, 0.5);
        break;
      case 'roll':
        this.noiseHit(o(0.35, 0.05), t, 0.28, 'lowpass', 900, 200, 0.7, 0.5, 0.05, true);
        break;
      case 'cluck':
        for (let i = 0; i < 3; i++) this.tone(o(0.25, 0.1), t + i * 0.09, 'square', 700 + Math.random() * 200, 450, 0.06, 0.05);
        break;
      case 'rustle':
        this.noiseHit(o(0.25, 0.05), t, 0.2, 'highpass', 2500, 1800, 0.7, 0.3, 0.02);
        break;
      case 'thorns':
        this.noiseHit(o(0.7, 0.2), t, 0.18, 'bandpass', 1800, 700, 1.4, 0.8, 0.005);
        for (let i = 0; i < 4; i++) this.noiseHit(o(0.3, 0.1), t + i * 0.03, 0.06, 'highpass', 3000 + R() * 1500, 2000, 2, 0.4);
        break;
      case 'spit':
        this.tone(o(0.4, 0.1), t, 'sine', 240, 520, 0.08, 0.3);
        this.noiseHit(o(0.3, 0.1), t, 0.06, 'bandpass', 1200, 1800, 2, 0.4, 0.005);
        break;
      case 'bellow': {
        const d = o(0.5, 0.5);
        this.tone(d, t, 'sawtooth', 150, 110, 0.7, 0.18, 0.05);
        this.tone(d, t + 0.05, 'sine', 300, 220, 0.6, 0.15, 0.05);
        break;
      }
      case 'bola':
        this.noiseHit(o(0.18, 0.05), t, 0.12, 'bandpass', 700 + R() * 300, 900, 3, 0.3, 0.02);
        break;
      case 'daze':
        this.bell(o(0.5, 0.5), t, 1560, 0.5, 0.18);
        this.bell(o(0.4, 0.5), t + 0.12, 1320, 0.5, 0.12);
        this.tone(o(0.4, 0.2), t, 'sine', 120, 60, 0.3, 0.4);
        break;
      case 'ignite':
        this.noiseHit(o(0.6, 0.2), t, 0.5, 'bandpass', 400, 2400, 0.8, 0.6, 0.04);
        break;
      case 'extinguish':
        this.noiseHit(o(0.5, 0.2), t, 0.6, 'highpass', 4000, 2000, 0.7, 0.4, 0.02);
        break;
      case 'maim':
        this.tone(o(0.5, 0.2), t, 'sine', 180, 70, 0.2, 0.4);
        this.noiseHit(o(0.3, 0.1), t, 0.12, 'lowpass', 900, 200, 0.8, 0.5);
        break;
      case 'poison':
        for (let i = 0; i < 3; i++) this.tone(o(0.25, 0.2), t + i * 0.08, 'sine', 300 + i * 90, 200 + i * 60, 0.1, 0.12);
        break;
      case 'steal':
        [0, 3, 7].forEach((s0, i) => this.tone(o(0.3, 0.3), t + i * 0.05, 'square', 1760 * Math.pow(2, -s0 / 12), 1760 * Math.pow(2, -s0 / 12), 0.06, 0.06));
        break;
      case 'throw':
        this.noiseHit(o(0.4, 0.1), t, 0.2, 'bandpass', 600, 1600, 1, 0.4, 0.03);
        break;
      case 'potBreak':
        this.noiseHit(o(0.7, 0.3), t, 0.2, 'bandpass', 2400, 900, 1.2, 0.7);
        this.noiseHit(o(0.6, 0.3), t + 0.05, 0.7, 'lowpass', 1400, 300, 0.7, 0.7, 0.05, true);
        break;
      case 'blowpipe':
        this.noiseHit(o(0.4, 0.1), t, 0.08, 'bandpass', 1800, 900, 3, 0.5, 0.005);
        break;
      case 'chant': {
        const d = o(0.4, 0.8);
        for (const f of [110, 165, 220]) this.tone(d, t, 'sawtooth', f, f * 1.02, 1.1, 0.05, 0.3);
        break;
      }
      case 'blink':
        this.tone(o(0.3, 0.5), t, 'sine', 1400, 300, 0.25, 0.12);
        break;
      case 'glint':
        this.tone(o(0.3, 0.3), t, 'sine', 2400, 3200, 0.12, 0.1);
        this.tone(o(0.3, 0.3), t + 0.08, 'sine', 3200, 3000, 0.2, 0.06);
        break;
      case 'neigh': {
        const d = o(0.5, 0.4);
        const f = 520 + Math.random() * 60;
        for (let i = 0; i < 5; i++) this.tone(d, t + i * 0.07, 'sawtooth', f * (1 - i * 0.07), f * (0.9 - i * 0.07), 0.09, 0.08, 0.01);
        this.noiseHit(d, t, 0.5, 'bandpass', 1400, 700, 3, 0.25, 0.05);
        break;
      }
      case 'charge':
        this.noiseHit(o(0.7, 0.3), t, 0.8, 'lowpass', 600, 150, 0.8, 0.7, 0.05, true);
        this.tone(o(0.4, 0.3), t, 'sawtooth', 130, 260, 0.5, 0.12, 0.05);
        break;
      case 'charged':
        [0, 7, 12].forEach((s, i) => this.tone(o(0.3, 0.4), t + i * 0.04, 'triangle', 660 * Math.pow(2, s / 12), 660 * Math.pow(2, s / 12), 0.25, 0.14));
        break;
      case 'spin':
        this.noiseHit(o(0.6, 0.2), t, 0.45, 'bandpass', 500, 2600, 1.2, 0.7, 0.05);
        this.noiseHit(o(0.5, 0.2), t + 0.2, 0.35, 'bandpass', 700, 2400, 1.2, 0.5, 0.05);
        break;
      case 'pogo':
        this.tone(o(0.5, 0.2), t, 'square', 420, 900, 0.1, 0.15);
        this.noiseHit(o(0.4, 0.1), t, 0.08, 'bandpass', 2000, 1200, 2, 0.5);
        break;
      case 'dash':
        this.noiseHit(o(0.5, 0.2), t, 0.26, 'bandpass', 700, 3200, 1.2, 0.6, 0.02);
        this.tone(o(0.3, 0.2), t, 'triangle', 300, 900, 0.15, 0.12);
        break;
      case 'wave':
        this.tone(o(0.4, 0.4), t, 'triangle', 600, 1300, 0.3, 0.16);
        this.tone(o(0.3, 0.4), t, 'sine', 1300, 2600, 0.25, 0.08);
        this.noiseHit(o(0.3, 0.2), t, 0.2, 'highpass', 3000, 3000, 0.7, 0.2);
        break;
      case 'plunge':
        this.tone(o(0.4, 0.3), t, 'sine', 700, 200, 0.4, 0.1);
        this.noiseHit(o(0.5, 0.3), t, 0.4, 'bandpass', 2500, 500, 1, 0.4);
        break;
      case 'boom':
        this.tone(o(1, 0.5), t, 'sine', 90, 35, 0.6, 0.9);
        this.noiseHit(o(0.8, 0.4), t, 0.5, 'lowpass', 1200, 80, 0.7, 0.9, 0.003, true);
        this.bell(o(0.3, 0.6), t, 520, 0.8, 0.12);
        break;
      case 'power':
        [0, 4, 7, 12, 16].forEach((s, i) => this.tone(o(0.35, 0.5), t + i * 0.05, 'square', 523 * Math.pow(2, s / 12), 523 * Math.pow(2, s / 12), 0.12, 0.07));
        break;
      case 'jump':
        this.noiseHit(o(0.3, 0.05), t, 0.12, 'bandpass', 500, 1400, 1, 0.4, 0.02);
        break;
      case 'land':
        this.noiseHit(o(0.3, 0.05), t, 0.1, 'lowpass', 600, 150, 0.7, 0.5, 0.005, true);
        break;
      case 'landHard':
        this.noiseHit(o(0.6, 0.1), t, 0.25, 'lowpass', 500, 80, 0.7, 0.9, 0.005, true);
        this.tone(o(0.5), t, 'sine', 90, 40, 0.25, 0.6);
        break;
      case 'hurt': {
        const d = o(0.9, 0.2);
        this.tone(d, t, 'sawtooth', 220, 90, 0.25, 0.25);
        this.noiseHit(d, t, 0.2, 'lowpass', 1800, 200, 0.8, 0.8);
        this.tone(d, t, 'sine', 110, 50, 0.3, 0.6);
        break;
      }
      case 'death':
        this.tone(o(0.8, 0.6), t, 'sawtooth', 180, 45, 1.4, 0.25, 0.02);
        this.tone(o(0.8, 0.6), t, 'sine', 90, 30, 1.6, 0.5, 0.02);
        break;
      case 'enemyDie':
        this.noiseHit(o(0.5, 0.2), t, 0.35, 'bandpass', 900, 200, 1.5, 0.5, 0.01);
        this.tone(o(0.4, 0.2), t, 'square', 300 + R() * 60, 70, 0.25, 0.12);
        break;
      case 'drink':
        for (let i = 0; i < 4; i++) this.tone(o(0.3, 0.1), t + i * 0.1, 'sine', 300 + R() * 200, 500, 0.06, 0.15);
        break;
      case 'heal':
        [0, 4, 7, 12].forEach((s, i) => this.tone(o(0.4, 0.5), t + i * 0.06, 'triangle', 523 * Math.pow(2, s / 12), 523 * Math.pow(2, s / 12), 0.5, 0.18));
        break;
      case 'coin':
        this.tone(o(0.3, 0.2), t, 'square', 1320, 1320, 0.05, 0.08);
        this.tone(o(0.3, 0.3), t + 0.05, 'square', 1760, 1760, 0.12, 0.08);
        break;
      case 'heart':
        this.tone(o(0.4, 0.3), t, 'triangle', 660, 880, 0.2, 0.3);
        break;
      case 'chestOpen':
        this.noiseHit(o(0.5, 0.2), t, 0.4, 'bandpass', 400, 900, 3, 0.4, 0.05);
        [0, 4, 7, 11, 14].forEach((s, i) => this.bell(o(0.4, 0.5), t + 0.25 + i * 0.07, 880 * Math.pow(2, s / 12), 0.9, 0.2));
        break;
      case 'break':
        this.noiseHit(o(0.6, 0.15), t, 0.25, 'bandpass', 1200, 400, 1.2, 0.8);
        for (let i = 0; i < 4; i++) this.noiseHit(o(0.3), t + 0.02 + i * 0.04, 0.05, 'bandpass', 800 + R() * 1200, 600, 5, 0.4);
        break;
      case 'bow':
        this.tone(o(0.5, 0.1), t, 'triangle', 190, 130, 0.18, 0.4);
        this.noiseHit(o(0.3, 0.05), t, 0.12, 'highpass', 3000, 1500, 0.7, 0.3);
        break;
      case 'arrowThunk':
        this.noiseHit(o(0.4, 0.1), t, 0.06, 'lowpass', 1200, 300, 1, 0.5);
        this.tone(o(0.3), t, 'sine', 240, 180, 0.08, 0.3);
        break;
      case 'alert':
        this.tone(o(0.35, 0.1), t, 'square', 520, 780, 0.08, 0.08);
        break;
      case 'bat':
        for (let i = 0; i < 3; i++) this.tone(o(0.25, 0.1), t + i * 0.05, 'sine', 3200 + R() * 800, 2400, 0.03, 0.12);
        break;
      case 'boar':
        this.noiseHit(o(0.6, 0.2), t, 0.5, 'bandpass', 300, 180, 2, 0.8, 0.05, true);
        this.tone(o(0.4, 0.2), t, 'sawtooth', 110, 70, 0.45, 0.2, 0.05);
        break;
      case 'thud':
        this.tone(o(0.8, 0.3), t, 'sine', 80, 35, 0.4, 0.9);
        this.noiseHit(o(0.6, 0.2), t, 0.3, 'lowpass', 400, 60, 0.7, 0.8, 0.003, true);
        break;
      case 'roar':
        this.noiseHit(o(0.9, 0.4), t, 1.0, 'bandpass', 250, 140, 1.5, 1.0, 0.08, true);
        this.tone(o(0.6, 0.4), t, 'sawtooth', 95, 60, 1.0, 0.3, 0.08);
        this.tone(o(0.6, 0.4), t, 'sawtooth', 97, 62, 1.0, 0.3, 0.08);
        break;
      case 'bossJump':
        this.noiseHit(o(0.5, 0.2), t, 0.4, 'bandpass', 300, 1200, 1, 0.5, 0.1, true);
        break;
      case 'slam':
        this.tone(o(1, 0.5), t, 'sine', 70, 28, 0.8, 1);
        this.noiseHit(o(0.9, 0.4), t, 0.6, 'lowpass', 900, 60, 0.7, 1, 0.003, true);
        break;
      case 'rune':
        [0, 7, 12, 19].forEach((s, i) => this.bell(o(0.35, 0.8), t + i * 0.12, 392 * Math.pow(2, s / 12), 1.6, 0.14));
        break;
      case 'moonfire':
        this.noiseHit(o(0.7, 0.5), t, 1.0, 'bandpass', 300, 2200, 0.8, 0.6, 0.2);
        [0, 5, 12, 17, 24].forEach((s, i) => this.bell(o(0.4, 0.9), t + 0.2 + i * 0.1, 330 * Math.pow(2, s / 12), 2.4, 0.13));
        break;
      case 'rest':
        [0, 7, 12].forEach((s, i) => this.bell(o(0.35, 0.9), t + i * 0.25, 262 * Math.pow(2, s / 12), 2.5, 0.12));
        break;
      case 'lever':
        this.noiseHit(o(0.6, 0.3), t, 0.3, 'bandpass', 700, 300, 2, 0.6);
        this.bell(o(0.3, 0.3), t + 0.25, 300, 0.4, 0.2);
        break;
      case 'chains':
        for (let i = 0; i < 26; i++) {
          this.noiseHit(o(0.35, 0.3), t + i * 0.085 + R() * 0.02, 0.06, 'bandpass', 2500 + R() * 2500, 1800, 6, 0.35);
          if (i % 3 === 0) this.bell(o(0.15, 0.3), t + i * 0.085, 1400 + R() * 600, 0.15, 0.1);
        }
        break;
      case 'bridgeSlam':
        this.tone(o(1, 0.6), t, 'sine', 60, 25, 1.2, 1);
        this.noiseHit(o(0.9, 0.5), t, 0.9, 'lowpass', 700, 50, 0.7, 1, 0.003, true);
        this.noiseHit(o(0.4, 0.3), t + 0.1, 0.8, 'bandpass', 1200, 500, 0.8, 0.4, 0.02);
        break;
      case 'doorOpen':
        this.noiseHit(o(0.5, 0.4), t, 1.6, 'bandpass', 180, 420, 8, 0.5, 0.2, true);
        this.tone(o(0.2, 0.4), t, 'sawtooth', 140, 190, 1.4, 0.06, 0.3);
        break;
      case 'doorSlam':
        this.tone(o(1, 0.7), t, 'sine', 70, 30, 0.9, 1);
        this.noiseHit(o(0.8, 0.6), t, 0.5, 'lowpass', 900, 80, 0.7, 1, 0.003, true);
        break;
      case 'area':
        [0, 7, 14].forEach((s, i) => this.bell(o(0.3, 0.9), t + i * 0.18, 196 * Math.pow(2, s / 12), 3, 0.1));
        break;
      case 'blip':
        this.tone(o(0.12, 0), t, 'square', 380 + R() * 60, 380, 0.025, 0.05);
        break;
      case 'ui':
        this.tone(o(0.25, 0.1), t, 'triangle', 880, 880, 0.08, 0.15);
        break;
      case 'buy':
        [0, 4, 7].forEach((s, i) => this.tone(o(0.3, 0.3), t + i * 0.05, 'square', 880 * Math.pow(2, s / 12), 880 * Math.pow(2, s / 12), 0.1, 0.07));
        break;
      case 'victory':
        [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.bell(o(0.5, 0.9), t + i * 0.14, 262 * Math.pow(2, s / 12), 3, 0.15));
        break;
      default:
        if (name.startsWith('step')) this.step(name.slice(5), o);
    }
  }

  private step(surf: string, o: (v: number, rev?: number) => GainNode) {
    const t = this.ctx!.currentTime;
    const R = Math.random;
    switch (surf) {
      case 'stone':
        this.noiseHit(o(0.22, 0.15), t, 0.05, 'bandpass', 2400 + R() * 800, 1500, 2, 0.5);
        this.tone(o(0.12, 0.1), t, 'sine', 170 + R() * 30, 110, 0.05, 0.3);
        break;
      case 'wood':
        this.noiseHit(o(0.25, 0.1), t, 0.07, 'bandpass', 600 + R() * 200, 300, 3, 0.5);
        this.tone(o(0.18, 0.1), t, 'sine', 140 + R() * 20, 90, 0.08, 0.5);
        break;
      case 'water':
        this.noiseHit(o(0.3, 0.1), t, 0.18, 'bandpass', 1600 + R() * 600, 700, 1.5, 0.5, 0.01);
        break;
      default:
        this.noiseHit(o(0.2, 0.05), t, 0.08, 'lowpass', 1100 + R() * 500, 300, 0.7, 0.45, 0.004);
    }
  }

  /** Ambience: continuous beds plus scheduled one-shots. */
  update(dt: number, s: AmbState) {
    this.amb = s;
    const ctx = this.ctx;
    if (!ctx || !this.windSrc) return;
    const t = ctx.currentTime;
    const wv = 0.05 + s.wind * 0.12 * (0.7 + 0.3 * Math.sin(t * 0.13) * Math.sin(t * 0.31));
    this.windSrc.gain.gain.setTargetAtTime(s.indoor ? 0.012 : wv, t, 0.5);
    this.windSrc.filter.frequency.setTargetAtTime(300 + 250 * (0.5 + 0.5 * Math.sin(t * 0.21)), t, 0.8);
    this.waterSrc!.gain.gain.setTargetAtTime(s.water * 0.09 * (0.85 + 0.15 * Math.sin(t * 3.1)), t, 0.3);
    this.waterSrc!.filter.frequency.setTargetAtTime(1100 + Math.random() * 700, t, 0.08);
    this.fireSrc!.gain.gain.setTargetAtTime(s.fire * 0.08, t, 0.3);

    if (s.fire > 0.05 && t > this.nextCrackle) {
      this.nextCrackle = t + 0.03 + Math.random() * (0.25 / (0.2 + s.fire));
      const g = this.ctx!.createGain();
      g.gain.value = s.fire * (0.1 + Math.random() * 0.25);
      g.connect(this.ambBus);
      this.noiseHit(g, t, 0.015 + Math.random() * 0.03, 'highpass', 1500 + Math.random() * 3000, 1200, 0.7, 0.8, 0.001);
    }
    if (!s.indoor && s.crickets > 0.05 && t > this.nextCricket) {
      this.nextCricket = t + 0.2 + Math.random() * (1.4 / s.crickets);
      const pan = Math.random() * 1.6 - 0.8;
      const f = 4300 + Math.random() * 900;
      const g = this.ctx!.createGain();
      g.gain.value = 0.018 * s.crickets * (0.4 + Math.random() * 0.6);
      const p = this.ctx!.createStereoPanner();
      p.pan.value = pan;
      g.connect(p).connect(this.ambBus);
      const n = 2 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++)
        for (let j = 0; j < 4; j++) this.tone(g, t + k * 0.13 + j * 0.022, 'sine', f, f * 0.99, 0.018, 0.8, 0.002);
    }
    if (!s.indoor && s.owls > 0.05 && t > this.nextOwl) {
      this.nextOwl = t + 14 + Math.random() * 26 / s.owls;
      const g = this.ctx!.createGain();
      g.gain.value = 0.06 * s.owls;
      const p = this.ctx!.createStereoPanner();
      p.pan.value = Math.random() * 1.4 - 0.7;
      g.connect(p).connect(this.ambBus);
      const r = this.ctx!.createGain();
      r.gain.value = 0.7;
      p.connect(r).connect(this.revSend);
      const f = 360 + Math.random() * 40;
      this.tone(g, t, 'sine', f, f * 0.93, 0.35, 1, 0.06);
      this.tone(g, t + 0.55, 'sine', f * 1.02, f * 0.9, 0.22, 0.8, 0.04);
      this.tone(g, t + 0.85, 'sine', f, f * 0.88, 0.5, 1, 0.05);
    }
    if (s.water > 0.3 && !s.indoor && t > this.nextFrog) {
      this.nextFrog = t + 2 + Math.random() * 6;
      const g = this.ctx!.createGain();
      g.gain.value = 0.05 * s.water;
      g.connect(this.ambBus);
      for (let k = 0; k < 3; k++) this.noiseHit(g, t + k * 0.05, 0.04, 'bandpass', 420, 380, 8, 1, 0.005);
    }
    if (s.drums > 0.02 && t > this.nextDrum) {
      // Goblin drums: a lopsided pattern.
      const pattern = [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0];
      const beat = 0.19;
      this.nextDrum = t + beat;
      const hit = pattern[this.drumStep++ % pattern.length];
      if (hit) {
        const g = this.ctx!.createGain();
        g.gain.value = 0.35 * s.drums * (this.drumStep % 8 === 1 ? 1.3 : 0.9);
        g.connect(this.ambBus);
        const rv = this.ctx!.createGain();
        rv.gain.value = 0.5;
        g.connect(rv).connect(this.revSend);
        this.tone(g, t, 'sine', 95, 50, 0.3, 1, 0.003);
        this.noiseHit(g, t, 0.12, 'lowpass', 500, 120, 0.7, 0.6, 0.002, true);
      }
    }
    this.music?.update(dt);
  }
}
