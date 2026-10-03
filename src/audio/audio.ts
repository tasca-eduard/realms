// Web Audio: synthesized effects, layered ambience, and sample-based music.
import { Music } from './music';
import { LandSounds, type PlaceSound } from './lands';

export interface AmbState {
  x: number;
  z: number;
  /** 0..1 how much each bed is present. */
  wind: number;
  crickets: number;
  owls: number;
  /** Birdsong (Whisperwood's nights have it). */
  birds: number;
  /** Under the sea: bubbles rising and the low drone of deep water. */
  bubbles: number;
  water: number;
  fire: number;
  drums: number;
  indoor: boolean;
  /** A sea realm's (the Sunken Reef): the surf breaking by how near the waterline is, and where it is (its pan);
   *  the open sea lapping; boards and ropes creaking; an inn's voices (inside, or through its walls); drips and an
   *  echo (caves, the drowned temple); the temple's choir; a lit lamp's hum. */
  surf?: number;
  surfX?: number;
  surfZ?: number;
  lap?: number;
  creak?: number;
  chatter?: number;
  chatterIn?: boolean;
  drips?: number;
  echo?: number;
  choir?: number;
  hum?: number;
  /** The Moonlit Keep's and Whisperwood's places' own beds as heard where the knight is (src/audio/lands.ts); how
   *  far the dawn has come (0 night, 1 day); seconds of play (the chapel's bell tolls the hours). */
  places?: PlaceSound[];
  dawn?: number;
  clock?: number;
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
  private nextBird = 3;
  private nextBlub = 1;
  private drone: { gain: GainNode } | null = null;
  // The sea realm's beds (made the first time they're wanted) and one-shots.
  private surfBed: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  private chatterBus: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  private humBed: { gain: GainNode } | null = null;
  private nextWave = 0;
  private waveAt = -9;
  private nextLap = 0;
  private nextGust = 3;
  private nextCreak = 1;
  private nextSyl = 0;
  private nextLaugh = 6;
  private nextClink = 3;
  private nextDrip = 0;
  private nextChoir = 2;
  private nextTick = 0;
  /** The lands' own beds and beasts' voices (the Moonlit Keep's and Whisperwood's). */
  lands = new LandSounds(this);
  /** The realm being played (its own music). */
  realm = '';
  private muffle!: BiquadFilterNode;
  amb: AmbState = { x: 0, z: 0, wind: 0.5, crickets: 0.5, owls: 0.5, birds: 0, bubbles: 0, water: 0, fire: 0, drums: 0, indoor: false };

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
    this.music.realm = this.realm;
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

  loopNoise(buf: AudioBuffer, type: BiquadFilterType, freq: number, q: number) {
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
  spatial(x?: number, z?: number, range = 10) {
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

  noiseHit(dest: AudioNode, t: number, dur: number, type: BiquadFilterType, f0: number, f1: number, q: number, vol: number, attack = 0.002, brown = false) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = brown ? this.brown : this.noise;
    // (Looped: a long one started late in the buffer would otherwise fall silent at its end.)
    src.loop = true;
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

  tone(dest: AudioNode, t: number, type: OscillatorType, f0: number, f1: number, dur: number, vol: number, attack = 0.005) {
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

  bell(dest: AudioNode, t: number, f: number, dur: number, vol: number, ratios = [1, 2.76, 5.4, 8.93]) {
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
      // A gull's cry over the Sunken Reef's shore: a falling "kee-ow", once or a few times.
      case 'gull':
        for (let i = 0, n = 1 + Math.floor(R() * 3); i < n; i++) {
          const f = 1500 + R() * 300;
          this.tone(o(0.16, 0.4), t + i * 0.3, 'triangle', f, f * 0.62, 0.24, 0.09, 0.02);
          this.tone(o(0.08, 0.4), t + i * 0.3, 'square', f * 2, f * 1.2, 0.18, 0.02, 0.02);
        }
        break;
      // A seal on its skerry: a hoarse bark, once or a few times.
      case 'seal':
        for (let i = 0, n = 1 + Math.floor(R() * 3); i < n; i++) {
          const f = 300 + R() * 110, d = o(0.3, 0.3);
          this.tone(d, t + i * 0.27, 'sawtooth', f, f * 0.68, 0.17, 0.12, 0.015);
          this.noiseHit(d, t + i * 0.27, 0.15, 'bandpass', 950, 620, 3, 0.16, 0.01);
        }
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
      // The Tide Serpent: its call, a stroke, a bubble shot, the whirlpool, its shell going up and bursting, a
      // splash, the crew's net lines cut.
      case 'serpent': {
        const d = o(0.5, 0.6);
        this.tone(d, t, 'sine', 240, 520, 0.35, 0.18, 0.04);
        this.tone(d, t + 0.25, 'triangle', 520, 180, 0.6, 0.14, 0.05);
        this.noiseHit(d, t, 0.5, 'bandpass', 900, 400, 2, 0.15, 0.1);
        break;
      }
      case 'stroke':
        this.noiseHit(o(0.35, 0.2), t, 0.3, 'lowpass', 900, 300, 0.8, 0.4, 0.04, true);
        this.tone(o(0.2, 0.3), t + 0.05, 'sine', 300, 620, 0.12, 0.12);
        break;
      case 'bubbleShot':
        this.tone(o(0.4, 0.3), t, 'sine', 180, 760, 0.12, 0.25);
        this.noiseHit(o(0.25, 0.1), t, 0.08, 'bandpass', 1400, 2200, 2, 0.3, 0.005);
        break;
      case 'whirl':
        this.noiseHit(o(0.6, 0.5), t, 1.2, 'bandpass', 400, 1400, 1.5, 0.5, 0.3);
        this.tone(o(0.3, 0.4), t, 'sine', 90, 140, 1.0, 0.2, 0.2);
        break;
      case 'shell':
        for (let i = 0; i < 4; i++) this.tone(o(0.25, 0.4), t + i * 0.05, 'sine', 500 + i * 180, 900 + i * 200, 0.1, 0.1);
        break;
      case 'pop':
        this.noiseHit(o(0.4, 0.3), t, 0.08, 'highpass', 2500, 1500, 1, 0.5, 0.002);
        this.tone(o(0.35, 0.3), t, 'sine', 900, 200, 0.15, 0.2);
        break;
      case 'splash':
        this.noiseHit(o(0.6, 0.3), t, 0.55, 'lowpass', 2400, 500, 0.7, 0.6, 0.01);
        break;
      case 'lineSnap':
        this.noiseHit(o(0.4, 0.1), t, 0.06, 'highpass', 3000, 2000, 1, 0.6, 0.002);
        this.tone(o(0.3, 0.2), t, 'sawtooth', 220, 110, 0.18, 0.12);
        break;
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
      // The diving suit: a gulp of air, the low-air warning, out of air.
      case 'gulp':
        this.tone(o(0.35, 0.3), t, 'sine', 260, 640, 0.1, 0.22);
        this.tone(o(0.3, 0.3), t + 0.08, 'sine', 380, 900, 0.12, 0.18);
        break;
      case 'airLow':
        this.tone(o(0.3, 0.4), t, 'triangle', 700, 660, 0.14, 0.16);
        this.tone(o(0.3, 0.4), t + 0.17, 'triangle', 540, 500, 0.2, 0.16);
        break;
      case 'breathless':
        this.tone(o(0.4, 0.3), t, 'sine', 220, 90, 0.45, 0.3);
        this.noiseHit(o(0.2, 0.2), t, 0.3, 'lowpass', 600, 200, 1, 0.3, 0.05, true);
        break;
      // Brassbelly's suit: the valves hissing, the steam blowing off.
      case 'hiss':
        this.noiseHit(o(0.3, 0.2), t, 0.9, 'highpass', 5000, 3800, 0.8, 0.35, 0.3);
        break;
      case 'steam':
        this.noiseHit(o(0.7, 0.3), t, 0.7, 'bandpass', 3200, 1400, 0.6, 0.8, 0.01);
        this.tone(o(0.3, 0.2), t, 'sine', 140, 60, 0.3, 0.25);
        break;
      // The Sunken Reef's foes: a claw or a shell snapping shut, a clam's creak before it does, a jelly's
      // pulse, a pufferfish swelling, a harpoon's line running.
      case 'snap':
        this.noiseHit(o(0.6, 0.2), t, 0.07, 'bandpass', 2200, 1200, 2, 0.7, 0.002);
        this.tone(o(0.4, 0.2), t, 'square', 320, 120, 0.08, 0.2);
        break;
      case 'creak':
        for (let i = 0; i < 4; i++) this.tone(o(0.22, 0.3), t + i * 0.09, 'sawtooth', 150 + i * 12, 130 + i * 10, 0.08, 0.06, 0.01);
        break;
      case 'squelch':
        this.tone(o(0.35, 0.3), t, 'sine', 420, 160, 0.18, 0.22);
        this.noiseHit(o(0.25, 0.2), t, 0.15, 'lowpass', 900, 300, 1, 0.3, 0.02);
        break;
      case 'puff':
        this.tone(o(0.35, 0.3), t, 'triangle', 180, 520, 0.5, 0.16, 0.05);
        this.noiseHit(o(0.2, 0.2), t, 0.5, 'bandpass', 600, 1400, 1.2, 0.25, 0.1);
        break;
      case 'reel':
        for (let i = 0; i < 5; i++) this.noiseHit(o(0.2, 0.1), t + i * 0.06, 0.04, 'bandpass', 1400 + R() * 400, 900, 4, 0.35, 0.003);
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
      // The Sunken Reef's: the drowned kingdom's great bell tolling under the water; the Tidelord's tide surging.
      case 'toll':
        this.tone(o(0.9, 0.6), t, 'sine', 98, 96, 4.5, 0.55, 0.004);
        [1, 2.4, 3, 4.2, 5.4].forEach((m, i) => this.bell(o(0.5, 0.8), t + 0.01, 98 * m, 3.6 - i * 0.5, 0.2 - i * 0.025));
        this.noiseHit(o(0.4, 0.4), t, 0.25, 'bandpass', 900, 400, 3, 0.4);
        break;
      case 'surge':
        this.noiseHit(o(0.6, 0.5), t, 2.2, 'lowpass', 300, 900, 0.8, 0.55, 0.6, true);
        this.tone(o(0.3, 0.4), t, 'sine', 55, 80, 2, 0.3, 0.5);
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
        else this.lands.voice(name, o, t);
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
    if (!s.indoor && s.birds > 0.05 && t > this.nextBird) {
      // A small bird: two to four quick rising chirps somewhere in the trees.
      this.nextBird = t + 1.8 + Math.random() * (2.7 / s.birds);
      const g = this.ctx!.createGain();
      g.gain.value = 0.045 * s.birds;
      const p = this.ctx!.createStereoPanner();
      p.pan.value = Math.random() * 1.8 - 0.9;
      g.connect(p).connect(this.ambBus);
      const n = 2 + Math.floor(Math.random() * 3), f = 2400 + Math.random() * 1200;
      let at = t;
      for (let k = 0; k < n; k++) {
        const a = f * (0.9 + Math.random() * 0.3);
        this.tone(g, at, 'sine', a, a * (1.15 + Math.random() * 0.3), 0.07, 0.8, 0.01);
        at += 0.07 + Math.random() * 0.06;
      }
    }
    if (s.bubbles > 0.05) {
      // Under the sea: a low drone of deep water (two near notes beating slowly), and bubbles: a few
      // quick rising blips somewhere about.
      if (!this.drone) {
        const gain = this.ctx!.createGain();
        gain.gain.value = 0;
        gain.connect(this.ambBus);
        for (const f of [55, 55.6, 82.4]) {
          const o = this.ctx!.createOscillator();
          o.type = 'sine';
          o.frequency.value = f;
          o.connect(gain);
          o.start();
        }
        this.drone = { gain };
      }
      if (t > this.nextBlub) {
        this.nextBlub = t + 0.5 + Math.random() * (2.4 / s.bubbles);
        const g = this.ctx!.createGain();
        g.gain.value = 0.05 * s.bubbles;
        const p = this.ctx!.createStereoPanner();
        p.pan.value = Math.random() * 1.6 - 0.8;
        g.connect(p).connect(this.ambBus);
        const n = 1 + Math.floor(Math.random() * 4), f = 260 + Math.random() * 260;
        let at = t;
        for (let k = 0; k < n; k++) {
          const a = f * (0.85 + Math.random() * 0.4);
          this.tone(g, at, 'sine', a, a * (2 + Math.random()), 0.06, 0.9, 0.004);
          at += 0.05 + Math.random() * 0.12;
        }
      }
    }
    if (this.drone) this.drone.gain.gain.setTargetAtTime(s.indoor ? 0.004 : 0.022 * s.bubbles, t, 0.6);
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
    this.seaSounds(t, s);
    this.lands.update(t, s);
    this.music?.update(dt);
  }

  /** A gain (and pan) into the ambience for one sound, with some of it sent to the reverb. */
  ambOut(vol: number, pan: number, rev = 0, dest: AudioNode = this.ambBus) {
    const g = this.ctx!.createGain();
    g.gain.value = vol;
    const p = this.ctx!.createStereoPanner();
    p.pan.value = pan;
    g.connect(p).connect(dest);
    if (rev > 0) {
      const r = this.ctx!.createGain();
      r.gain.value = rev;
      p.connect(r).connect(this.revSend);
    }
    return g;
  }

  /** The Sunken Reef's ambience (each bed made the first time it's wanted, so other realms pay nothing): the surf,
   *  gusts off the sea, the open sea lapping, boards and ropes creaking, an inn's voices, drips and an echo, the
   *  drowned temple's choir, the lit lighthouse's hum. */
  private seaSounds(t: number, s: AmbState) {
    const ctx = this.ctx!, R = Math.random;
    const surf = s.surf ?? 0;
    // The sea's echo: the reverb swells in caves and the drowned temple (every sound there rings on).
    if (s.echo !== undefined) this.revSend.gain.setTargetAtTime(0.35 + 0.55 * s.echo, t, 0.6);
    // The surf: a steady wash, swelling as each wave comes in, and the waves breaking every few seconds, from
    // the nearest waterline's side: rising, crashing, hissing up the sand.
    if (surf > 0.02 && !this.surfBed) this.surfBed = this.loopNoise(this.brown, 'lowpass', 420, 0.6);
    if (this.surfBed) {
      const swell = Math.max(0, 1 - Math.abs(t - this.waveAt) / 1.8);
      this.surfBed.gain.gain.setTargetAtTime(surf * (0.06 + 0.07 * swell), t, 0.35);
    }
    if (surf > 0.04 && t > this.nextWave) {
      this.nextWave = t + 4.5 + R() * 4;
      this.waveAt = t + 1.1;
      const g = this.ambOut(0.75 * surf, this.spatial(s.surfX, s.surfZ).pan * 0.7, 0.1);
      this.noiseHit(g, t, 1.8, 'lowpass', 220, 760, 0.7, 0.5, 1.1, true);
      this.noiseHit(g, t + 1.0, 2.0, 'lowpass', 2600, 420, 0.6, 0.55, 0.05);
      this.noiseHit(g, t + 1.15, 2.8, 'highpass', 3600, 1700, 0.5, 0.18, 0.35);
    }
    // Out on the open sea: water slapping and plopping round him.
    const lap = s.lap ?? 0;
    if (lap > 0.05 && t > this.nextLap) {
      this.nextLap = t + 0.6 + R() * 2;
      const g = this.ambOut(0.3 * lap, R() * 1.4 - 0.7);
      this.noiseHit(g, t, 0.3 + R() * 0.3, 'lowpass', 700 + R() * 500, 260, 1.2, 0.5, 0.05, true);
      if (R() < 0.5) this.tone(g, t + 0.06, 'sine', 160 + R() * 140, 90, 0.12, 0.25, 0.004);
    }
    // Gusts off the sea (on the strand and the isles: a wind stronger than the land's), whistling in the marram.
    if (!s.indoor && s.wind > 1.05 && t > this.nextGust) {
      this.nextGust = t + 5 + R() * 9;
      const d = 2.5 + R() * 2, g = this.ambOut(Math.min(1, (s.wind - 1) * 2.5) * 0.16, R() * 1.6 - 0.8);
      this.noiseHit(g, t, d, 'bandpass', 360 + R() * 200, 900 + R() * 400, 1.3, 0.7, d * 0.45, true);
      this.noiseHit(g, t + d * 0.25, d * 0.6, 'bandpass', 1300 + R() * 500, 950, 7, 0.14, d * 0.3);
    }
    // Planks and ropes under strain: boardwalks, jetties, the wreck.
    const creak = s.creak ?? 0;
    if (creak > 0.05 && t > this.nextCreak) {
      this.nextCreak = t + 1 + R() * (3.5 / creak);
      this.creakAt(t, 0.07 * Math.min(1, creak * 1.4), R() < 0.3);
    }
    // An inn's voices: talkers murmuring (a run of syllables, each a voice through a vowel's formant), a laugh,
    // mugs knocked together; through the walls, muffled.
    const chat = s.chatter ?? 0;
    if (chat > 0.02 && !this.chatterBus) {
      const gain = ctx.createGain(), filter = ctx.createBiquadFilter();
      gain.gain.value = 0;
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      gain.connect(filter).connect(this.ambBus);
      this.chatterBus = { gain, filter };
    }
    if (this.chatterBus) {
      this.chatterBus.gain.gain.setTargetAtTime(chat, t, 0.4);
      this.chatterBus.filter.frequency.setTargetAtTime(s.chatterIn ? 5000 : 800, t, 0.3);
    }
    if (chat > 0.02 && this.chatterBus) {
      const bus = this.chatterBus.gain;
      if (t > this.nextSyl) {
        this.nextSyl = t + 0.05 + R() * 0.17;
        const who = Math.floor(R() * 5), f = [105, 125, 150, 195, 230][who] * (0.9 + R() * 0.25);
        this.syllable(this.ambOut(0.09, [-0.6, 0.4, -0.2, 0.7, 0.1][who], 0.15, bus), t, f, 0.06 + R() * 0.13);
      }
      if (t > this.nextLaugh) {
        this.nextLaugh = t + 6 + R() * 12;
        const g = this.ambOut(0.1, R() * 1.4 - 0.7, 0.2, bus), f = 190 + R() * 90;
        for (let k = 0, n = 4 + Math.floor(R() * 3); k < n; k++) this.syllable(g, t + k * 0.12, f * (1 - k * 0.05), 0.08, 800);
      }
      if (t > this.nextClink) {
        this.nextClink = t + 2.5 + R() * 6;
        const g = this.ambOut(0.05, R() * 1.4 - 0.7, 0.2, bus), f = 2100 + R() * 700;
        this.bell(g, t, f, 0.2, 0.5, [1, 2.4, 4.1]);
        if (R() < 0.6) this.bell(g, t + 0.09 + R() * 0.05, f * 1.07, 0.18, 0.4, [1, 2.4, 4.1]);
      }
    }
    // Drips in a cave (a plink ringing on), or under the sea a slow, deep bloop.
    const drips = s.drips ?? 0;
    if (drips > 0.05 && t > this.nextDrip) {
      this.nextDrip = t + 0.5 + R() * (2.6 / drips);
      const wet = s.bubbles > 0.05, g = this.ambOut((wet ? 0.08 : 0.06) * drips, R() * 1.6 - 0.8, 0.9);
      const f = wet ? 260 + R() * 220 : 1100 + R() * 900;
      this.tone(g, t, 'sine', f, f * (wet ? 2.4 : 1.7), wet ? 0.11 : 0.05, 0.9, 0.002);
      if (!wet && R() < 0.4) this.tone(g, t + 0.07, 'sine', f * 1.4, f * 2, 0.03, 0.35, 0.002);
    }
    // The drowned temple: the Lady of the Tides' choir, a chord swelling out of the stone and dying away.
    const choir = s.choir ?? 0;
    if (choir > 0.05 && t > this.nextChoir) {
      this.nextChoir = t + 8 + R() * 8;
      const g = this.ambOut(0.05 * choir, R() * 0.8 - 0.4, 1);
      const root = [146.8, 164.8, 196][Math.floor(R() * 3)];
      [1, 1.5, 2.52].forEach((m, i) => this.tone(g, t + i * 0.35, 'triangle', root * m, root * m * 1.004, 4.5, 0.5 / (1 + i * 0.4), 1.8));
    }
    // A lit lamp's hum (the lighthouse): two near notes beating, a soft overtone, the clockwork turning its lens.
    const hum = s.hum ?? 0;
    if (hum > 0.01 && !this.humBed) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.ambBus);
      for (const [f, v] of [[110, 1], [110.8, 1], [220.5, 0.4], [331, 0.15]]) {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.frequency.value = f;
        og.gain.value = v;
        o.connect(og).connect(gain);
        o.start();
      }
      this.humBed = { gain };
    }
    if (this.humBed) this.humBed.gain.gain.setTargetAtTime(0.05 * hum * (0.85 + 0.15 * Math.sin(t * 1.9)), t, 0.3);
    if (hum > 0.25 && t > this.nextTick) {
      this.nextTick = t + 0.5;
      this.noiseHit(this.ambOut(0.12 * hum, 0, 0.3), t, 0.03, 'bandpass', 3200, 2400, 4, 0.5, 0.002);
    }
  }

  /** A plank or a rope under strain: a low tone stuttering (stick and slip) through a wooden body. */
  private creakAt(t: number, vol: number, rope: boolean) {
    const ctx = this.ctx!, R = Math.random;
    const dur = rope ? 0.7 + R() * 0.6 : 0.25 + R() * 0.4, f = rope ? 85 + R() * 50 : 140 + R() * 120;
    const o = ctx.createOscillator(), lfo = ctx.createOscillator(), chop = ctx.createGain(), depth = ctx.createGain(), body = ctx.createBiquadFilter();
    o.type = rope ? 'triangle' : 'sawtooth';
    o.frequency.setValueAtTime(f, t);
    o.frequency.linearRampToValueAtTime(f * (rope ? 1.25 : 0.7 + R() * 0.6), t + dur);
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(rope ? 9 + R() * 6 : 20 + R() * 18, t);
    lfo.frequency.linearRampToValueAtTime(rope ? 15 : 12 + R() * 10, t + dur);
    chop.gain.value = 0.5;
    depth.gain.value = 0.5;
    lfo.connect(depth).connect(chop.gain);
    body.type = 'bandpass';
    body.frequency.value = rope ? 360 : 650 + R() * 650;
    body.Q.value = rope ? 2 : 3;
    const env = this.ambOut(1, R() * 1.4 - 0.7, 0.15);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(chop).connect(body).connect(env);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }

  /** One spoken syllable: a voice at pitch f through a vowel's formant, gliding a little. */
  syllable(dest: AudioNode, t: number, f: number, dur: number, formant = 350 + Math.random() * 700) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f, t);
    o.frequency.linearRampToValueAtTime(f * (0.85 + Math.random() * 0.3), t + dur);
    bp.type = 'bandpass';
    bp.frequency.value = formant;
    bp.Q.value = 4;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(bp).connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}
