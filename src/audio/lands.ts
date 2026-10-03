// The lands' own sounds: beds by place for the Moonlit Keep and Whisperwood (the Sunken Reef has its sea's in
// audio.ts), and animals' voices placed in space. Made in code like every other sound: noise through filters,
// oscillators, bells of partials. A realm's map says where each place is heard (`sounds` in src/world/realm.ts);
// the game works out how loud each is where the knight stands (src/game/placesounds.ts) and hands it here.
import type { AmbState, Audio } from './audio';

export type LandBed =
  // The Moonlit Keep's: the smith at his anvil, the tavern's crowd, the chapel's bell, the marsh's frogs and its
  // bittern, a stream's babble and white water (the ford), wind in the pines, banners flapping, chains, a mill's
  // wheel, skylarks over the fields at dawn.
  | 'forge' | 'tavern' | 'chapel' | 'marsh' | 'bittern' | 'brook' | 'rush' | 'pines' | 'banners' | 'chains' | 'mill' | 'larks'
  // Whisperwood's: the canopy's hush and its great trunks groaning, falls roaring, the frogs' chorus, the
  // village's chimes, the inn's voices and lute, branches cracking in the Deep Wood, the dawn chorus, a nightingale.
  | 'canopy' | 'falls' | 'peepers' | 'chimes' | 'inn' | 'snaps' | 'dawnsong' | 'nightingale';

/** One place's bed as heard where the knight is: how loud (0..1), where it comes from, whether he's inside its
 *  room (an inn: heard clear, not through the walls), and its pitch (a broad river babbles lower). */
export interface PlaceSound {
  kind: LandBed;
  v: number;
  x: number;
  z: number;
  inside?: boolean;
  pitch?: number;
}

/** How long the chapel's hour lasts, in seconds of play (the bell tolls it). */
export const HOUR = 150;

// D Dorian, Whisperwood's key: the chimes' tubes and the inn's lute.
const D_PENT = [587.3, 659.3, 784, 880, 987.8, 1174.7];
const D_DOR = [0, 2, 3, 5, 7, 9, 10];

export class LandSounds {
  /** How loud each bed is now (the loudest place of its kind), for the checks. */
  heard: Partial<Record<LandBed, number>> = {};
  /** The one-shots made, by name (the checks read them: the test browser is muted). */
  played: Record<string, number> = {};
  private next: Record<string, number> = {};
  private loops: Record<string, { gain: GainNode; filter: BiquadFilterNode }> = {};
  private crowd: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  private hour = -1;
  private beats = 6;
  private lute = { t: 0, step: 0, bar: 0, deg: 4 };

  constructor(private a: Audio) {}

  /** Plays every bed at the level the places give it. */
  update(t: number, s: AmbState) {
    const by: Partial<Record<LandBed, PlaceSound>> = {};
    for (const p of s.places ?? []) if (p.v > (by[p.kind]?.v ?? 0)) by[p.kind] = p;
    this.heard = {};
    for (const k in by) this.heard[k as LandBed] = +by[k as LandBed]!.v.toFixed(2);
    this.forge(t, by.forge);
    this.crowdBed(t, by.tavern, by.inn);
    this.chapel(t, by.chapel, s.clock ?? 0);
    this.marsh(t, by.marsh);
    this.bittern(t, by.bittern);
    this.water(t, by.brook, by.rush);
    this.pines(t, by.pines);
    this.banners(t, by.banners);
    this.chains(t, by.chains);
    this.mill(t, by.mill);
    this.larks(t, by.larks);
    this.canopy(t, by.canopy);
    this.falls(t, by.falls);
    this.peepers(t, by.peepers);
    this.chimes(t, by.chimes);
    this.snaps(t, by.snaps);
    this.dawnsong(t, by.dawnsong);
    this.nightingale(t, by.nightingale);
  }

  // ---------- helpers ----------

  private count(k: string, n = 1) {
    this.played[k] = (this.played[k] ?? 0) + n;
  }

  /** Whether a timed sound is due (the first comes at once), and when the next is. */
  private due(k: string, t: number, wait: number) {
    if (t < (this.next[k] ?? 0)) return false;
    this.next[k] = t + wait;
    return true;
  }

  private pan(p: PlaceSound, spread = 0) {
    const pan = p.inside ? 0 : this.a.spatial(p.x, p.z).pan * 0.75;
    return Math.max(-1, Math.min(1, pan + (Math.random() * 2 - 1) * spread));
  }

  /** A looping noise bed, made the first time it's wanted (so a realm without it pays nothing). */
  private loop(k: string, brown: boolean, type: BiquadFilterType, f: number, q: number, want: boolean) {
    if (!this.loops[k] && want) this.loops[k] = this.a.loopNoise(brown ? this.a.brown : this.a.noise, type, f, q);
    return this.loops[k];
  }

  /** A tone chopped by a square wave (a frog's croak, a groan's stick and slip), through a body. */
  private purr(dest: AudioNode, t: number, f: number, rate: number, dur: number, vol: number, type: OscillatorType, band: number, q = 3, bend = 0.92) {
    const ctx = this.a.ctx!;
    const o = ctx.createOscillator(), lfo = ctx.createOscillator(), chop = ctx.createGain(), depth = ctx.createGain();
    const bp = ctx.createBiquadFilter(), env = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.frequency.linearRampToValueAtTime(f * bend, t + dur);
    lfo.type = 'square';
    lfo.frequency.value = rate;
    chop.gain.value = 0.5;
    depth.gain.value = 0.5;
    lfo.connect(depth).connect(chop.gain);
    bp.type = 'bandpass';
    bp.frequency.value = band;
    bp.Q.value = q;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.05, dur * 0.2));
    env.gain.setValueAtTime(vol, t + dur * 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(chop).connect(bp).connect(env).connect(dest);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }

  /** A voice held on a vowel (a sung note, a beast's call): a sawtooth with a little vibrato through a formant. */
  private sing(dest: AudioNode, t: number, f0: number, f1: number, dur: number, vol: number, formant: number, q = 3, vib = 0.012, attack = 0.04) {
    const ctx = this.a.ctx!;
    const o = ctx.createOscillator(), lfo = ctx.createOscillator(), depth = ctx.createGain(), bp = ctx.createBiquadFilter(), env = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f1, t + dur);
    lfo.frequency.value = 5 + Math.random() * 1.5;
    depth.gain.value = f0 * vib;
    lfo.connect(depth).connect(o.frequency);
    bp.type = 'bandpass';
    bp.frequency.value = formant;
    bp.Q.value = q;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vol, t + attack);
    env.gain.setValueAtTime(vol, t + Math.max(attack, dur - 0.12));
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(bp).connect(env).connect(dest);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }

  /** A plucked string (the inn's lute): two courses a hair apart, bright at the pluck and mellowing. */
  private pluck(dest: AudioNode, t: number, f: number, vol: number) {
    const ctx = this.a.ctx!;
    const lp = ctx.createBiquadFilter(), env = ctx.createGain();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3200, t);
    lp.frequency.exponentialRampToValueAtTime(420, t + 0.45);
    lp.Q.value = 1.5;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    env.gain.exponentialRampToValueAtTime(vol * 0.3, t + 0.25);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    lp.connect(env).connect(dest);
    for (const d of [1, 1.004]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f * d;
      o.connect(lp);
      o.start(t);
      o.stop(t + 1.45);
    }
    this.a.noiseHit(dest, t, 0.02, 'bandpass', 2600, 1800, 2, vol * 0.4, 0.001);
  }

  /** A bird's or a frog's whistle: a pure tone gliding, held for its length (not a struck note dying away). */
  private whistle(dest: AudioNode, t: number, f0: number, f1: number, dur: number, vol: number, attack = 0.012) {
    const ctx = this.a.ctx!;
    const o = ctx.createOscillator(), env = ctx.createGain();
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vol, t + attack);
    env.gain.setValueAtTime(vol, t + Math.max(attack, dur - 0.025));
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(env).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // ---------- the Moonlit Keep ----------

  /** The smithy: a heavy blow on the hot iron and two light taps on the bare anvil, round and round; then the
   *  bellows breathing on the fire, now and then the iron quenched with a hiss. */
  private forge(t: number, p?: PlaceSound) {
    if (!p || p.v < 0.02 || !this.due('forge', t, 0.72 + Math.random() * 0.06)) return;
    const R = Math.random, g = this.a.ambOut(0.55 * p.v, this.pan(p), 0.3);
    if (this.beats-- > 0) {
      this.a.tone(g, t, 'sine', 170, 90, 0.12, 0.5);
      this.a.noiseHit(g, t, 0.07, 'bandpass', 2600, 1500, 1.5, 0.45);
      this.a.bell(g, t, 1150 + R() * 40, 0.45, 0.16, [1, 2.71, 4.2, 6.6]);
      for (const dt of [0.27, 0.42]) {
        this.a.bell(g, t + dt, 1620 + R() * 30, 0.9, 0.2, [1, 2.71, 4.2]);
        this.a.noiseHit(g, t + dt, 0.025, 'highpass', 4000, 3000, 0.7, 0.25);
      }
      this.count('hammer');
      return;
    }
    // A pause: the iron back in the fire and the bellows worked, then another heat.
    this.beats = 5 + Math.floor(R() * 5);
    this.next.forge = t + 3.5 + R() * 2.5;
    const n = 2 + Math.floor(R() * 2);
    for (let k = 0; k < n; k++) {
      this.a.noiseHit(g, t + 0.4 + k * 1.15, 0.9, 'bandpass', 260, 620, 1.1, 0.7, 0.4, true);
      this.a.noiseHit(g, t + 0.4 + k * 1.15, 0.6, 'bandpass', 900, 1600, 1.5, 0.12, 0.35);
    }
    if (R() < 0.35) {
      this.a.noiseHit(g, t + 0.2, 1.8, 'highpass', 5200, 2600, 0.7, 0.35, 0.01);
      this.a.noiseHit(g, t + 0.25, 1.2, 'bandpass', 1800, 900, 3, 0.2, 0.02);
    }
    this.count('bellows');
  }

  /** An inn's crowd, through its walls or inside: the Crescent & Crown's drinkers (deep voices, guffaws,
   *  tankards banged on the boards, a chorus now and then), or Hollowbough's inn (softer voices, wooden cups,
   *  a lute). */
  private crowdBed(t: number, tavern?: PlaceSound, inn?: PlaceSound) {
    const p = (tavern?.v ?? 0) >= (inn?.v ?? 0) ? tavern : inn;
    const v = p?.v ?? 0;
    const ctx = this.a.ctx!;
    if (v > 0.02 && !this.crowd) {
      const gain = ctx.createGain(), filter = ctx.createBiquadFilter();
      gain.gain.value = 0;
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      gain.connect(filter).connect(this.a.ambBus);
      this.crowd = { gain, filter };
    }
    if (!this.crowd) return;
    this.crowd.gain.gain.setTargetAtTime(v, t, 0.4);
    this.crowd.filter.frequency.setTargetAtTime(p?.inside ? 5000 : 900, t, 0.3);
    if (!p || v < 0.02) return;
    const R = Math.random, bus = this.crowd.gain, wood = p === inn;
    if (this.due('voice', t, wood ? 0.1 + R() * 0.28 : 0.05 + R() * 0.16)) {
      const pitches = wood ? [150, 180, 205, 235, 265] : [92, 105, 118, 135, 160, 210];
      const who = Math.floor(R() * pitches.length), f = pitches[who] * (0.92 + R() * 0.2);
      this.a.syllable(this.a.ambOut(wood ? 0.09 : 0.1, (who / (pitches.length - 1)) * 1.4 - 0.7, 0.15, bus), t, f, 0.07 + R() * 0.14);
      this.count('voice');
    }
    if (this.due('laugh', t, wood ? 9 + R() * 14 : 5 + R() * 9)) {
      const g = this.a.ambOut(wood ? 0.07 : 0.12, R() * 1.4 - 0.7, 0.2, bus), f = (wood ? 210 : 130) + R() * 50;
      for (let k = 0, n = 4 + Math.floor(R() * 4); k < n; k++) this.a.syllable(g, t + k * 0.13, f * (1 - k * 0.05), 0.09, wood ? 900 : 650);
      this.count('laugh');
    }
    if (this.due('cup', t, 2 + R() * 5)) {
      const g = this.a.ambOut(0.12, R() * 1.4 - 0.7, 0.15, bus);
      if (wood) {
        // Wooden cups knocked together.
        this.a.tone(g, t, 'triangle', 880 + R() * 300, 760, 0.07, 0.4);
        this.a.noiseHit(g, t, 0.03, 'bandpass', 1500, 1200, 3, 0.4);
      } else {
        // A pewter tankard banged down on the boards.
        this.a.noiseHit(g, t, 0.14, 'lowpass', 900, 200, 0.8, 0.7, 0.002, true);
        this.a.tone(g, t, 'sine', 150, 95, 0.12, 0.5);
        this.a.bell(g, t, 1900 + R() * 400, 0.15, 0.08, [1, 2.3]);
      }
      this.count('cup');
    }
    if (!wood && this.due('scrape', t, 8 + R() * 12)) this.a.noiseHit(this.a.ambOut(0.08, R() * 1.4 - 0.7, 0.1, bus), t, 0.35, 'bandpass', 500, 1500, 4, 0.5, 0.05);
    // The Crescent & Crown's drinkers take up a song: four voices on a line in G, the old ones an octave down.
    if (!wood && this.due('song', t, this.played.song ? 26 + R() * 22 : 6)) {
      const tune = [[0, 0.4], [4, 0.4], [7, 0.6], [7, 0.3], [9, 0.3], [7, 0.4], [4, 0.4], [2, 0.6], [0, 0.9]];
      const g = this.a.ambOut(0.09, 0, 0.35, bus);
      for (const [m, oct] of [[1, 1], [1.003, 1], [0.997, 0.5], [1.006, 0.5]]) {
        let at = t;
        for (const [s, d] of tune) {
          const f = 196 * Math.pow(2, s / 12) * oct * m;
          this.sing(g, at, f, f, d * 0.95, 0.25, oct < 1 ? 520 : 750);
          at += d;
        }
      }
      this.count('song');
    }
    // Hollowbough's inn: a lute in D Dorian over its chords (Dm, G, Dm, C), a tune that wanders and comes home.
    if (wood) this.luteNotes(t, bus);
  }

  private luteNotes(t: number, bus: AudioNode) {
    const L = this.lute, beat = 60 / 84 / 2, chords = [[0, 3, 7], [5, 9, 12], [0, 3, 7], [-2, 2, 5]];
    if (L.t < t - 0.5) L.t = t + 0.05;
    if (L.t >= t + 0.3) return;
    const g = this.a.ambOut(0.22, -0.2, 0.3, bus);
    while (L.t < t + 0.3) {
      const ch = chords[L.bar % 4], k = L.step % 8;
      const root = 146.8; // D3
      // The thumb on the bass and the fingers through the chord, a melody note over each half bar.
      const arp = [ch[0] - 12, ch[1], ch[2], ch[1] + 12, ch[0], ch[2], ch[1], ch[2]][k];
      this.pluck(g, L.t, root * Math.pow(2, arp / 12), k === 0 ? 0.32 : 0.2);
      if (k === 0 || k === 4 || (k === 6 && Math.random() < 0.5)) {
        L.deg = Math.max(0, Math.min(9, L.deg + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]));
        if (k === 0 && L.bar % 4 === 0) L.deg = [4, 7, 2][Math.floor(Math.random() * 3)];
        const s = D_DOR[L.deg % 7] + 12 * Math.floor(L.deg / 7) + 12;
        this.pluck(g, L.t + 0.01, root * Math.pow(2, s / 12), 0.3);
      }
      this.count('lute');
      L.t += beat;
      if (++L.step % 8 === 0) L.bar++;
    }
  }

  /** The chapel's bell tolls the hour (an hour is HOUR seconds of play): a bronze bell's partials (the hum an
   *  octave down, the minor third that makes a bell a bell, the fifth, the nominal), ringing on. */
  private chapel(t: number, p: PlaceSound | undefined, clock: number) {
    const h = Math.floor(clock / HOUR);
    if (this.hour < 0) this.hour = h;
    if (h === this.hour) return;
    this.hour = h;
    if (p && p.v > 0.02) this.toll(t, 1 + ((h + 9) % 12), p.v, this.pan(p));
  }

  /** n strokes of the chapel's bell. */
  toll(t: number, n: number, v = 1, pan = 0) {
    if (!this.a.ctx) return;
    const g = this.a.ambOut(0.7 * v, pan, 0.8), f = 262;
    for (let k = 0; k < n; k++) {
      const at = t + k * 2.6;
      ([[0.5, 7, 0.22], [1, 5, 0.2], [1.2, 4, 0.15], [1.5, 2.5, 0.06], [2, 3.5, 0.18], [3, 2, 0.07], [4, 1.4, 0.04]] as const)
        .forEach(([m, d, vol]) => this.a.tone(g, at, 'sine', f * m, f * m * 0.999, d, vol, 0.003));
      this.a.noiseHit(g, at, 0.05, 'bandpass', 1800, 1200, 3, 0.25, 0.001);
    }
    this.count('bell', n);
  }

  /** The Sallow Marsh's frogs: common frogs purring their low croaks all round, a toad's long trill now and then. */
  private marsh(t: number, p?: PlaceSound) {
    if (!p || p.v < 0.02) return;
    const R = Math.random;
    if (this.due('croak', t, (0.3 + R() * 0.9) / Math.max(0.3, p.v))) {
      const g = this.a.ambOut(0.3 * p.v, R() * 1.6 - 0.8, 0.1), f = 170 + R() * 90;
      for (let k = 0, n = 1 + Math.floor(R() * 3); k < n; k++) this.purr(g, t + k * 0.42, f, 24 + R() * 10, 0.22 + R() * 0.25, 0.8, 'sawtooth', 520 + R() * 200);
      this.count('croak');
    }
    if (this.due('toad', t, 7 + R() * 9)) {
      this.purr(this.a.ambOut(0.12 * p.v, R() * 1.4 - 0.7, 0.2), t, 1150 + R() * 200, 42 + R() * 8, 1.2 + R() * 0.8, 0.7, 'triangle', 1250, 2, 0.97);
      this.count('toad');
    }
  }

  /** A bittern booming in the reeds: three or four deep "oo-WOOMP"s, a breath drawn before each. */
  private bittern(t: number, p?: PlaceSound) {
    if (!p || p.v < 0.02 || !this.due('bittern', t, 16 + Math.random() * 18)) return;
    const g = this.a.ambOut(0.45 * p.v, this.pan(p), 0.5);
    for (let k = 0, n = 3 + Math.floor(Math.random() * 2); k < n; k++) {
      const at = t + k * 1.7;
      this.a.noiseHit(g, at, 0.2, 'lowpass', 320, 200, 0.7, 0.25, 0.06, true);
      this.a.tone(g, at + 0.22, 'sine', 152, 138, 0.75, 0.9, 0.14);
      this.a.tone(g, at + 0.22, 'triangle', 304, 280, 0.6, 0.1, 0.14);
    }
    this.count('bittern');
  }

  /** Running water: a stream's babble (bubbles plinking in its riffles over a soft hiss), louder and lower with
   *  white water at a ford, over a fall's lip or down a gorge's floor. */
  private water(t: number, brook?: PlaceSound, rush?: PlaceSound) {
    const bv = brook?.v ?? 0, rv = rush?.v ?? 0;
    const bed = this.loop('brook', false, 'bandpass', 1900, 0.6, bv + rv > 0.02);
    if (bed) {
      bed.gain.gain.setTargetAtTime(0.04 * bv + 0.08 * rv, t, 0.4);
      bed.filter.frequency.setTargetAtTime(rv > bv ? 1100 + Math.random() * 300 : 1700 + Math.random() * 500, t, 0.1);
    }
    const p = rv * 1.5 > bv ? rush : brook;
    if (!p || bv + rv < 0.02) return;
    const R = Math.random, rate = 6 * bv + 18 * rv, pitch = p.pitch ?? 1;
    if (!this.due('plip', t, (0.4 + R() * 1.2) / rate)) return;
    const g = this.a.ambOut(0.1 * Math.min(1, bv + rv), this.pan(p, 0.35), 0.05);
    const f = (320 + R() * 1000) * pitch;
    this.a.tone(g, t, 'sine', f, f * (1.6 + R() * 0.9), 0.03 + R() * 0.05, 0.6, 0.003);
    if (rv > 0.2 && R() < 0.3) this.a.noiseHit(g, t, 0.1 + R() * 0.1, 'bandpass', 1400 + R() * 1800, 900, 1.5, 0.35, 0.01);
    this.count('plip');
  }

  /** Blackpine's pines: the wind soughing through the needles, swelling in gusts and dying back. */
  private pines(t: number, p?: PlaceSound) {
    const v = p?.v ?? 0;
    const bed = this.loop('pines', false, 'bandpass', 2400, 0.5, v > 0.02);
    if (!bed) return;
    const gust = 0.5 + 0.5 * Math.sin(t * 0.23) * Math.sin(t * 0.11 + 1);
    bed.gain.gain.setTargetAtTime(v * (0.03 + 0.11 * gust * gust), t, 0.6);
    bed.filter.frequency.setTargetAtTime(1700 + 1500 * gust, t, 0.8);
    if (!p || v < 0.02 || !this.due('sough', t, 5 + Math.random() * 7)) return;
    const d = 3 + Math.random() * 2.5;
    this.a.noiseHit(this.a.ambOut(0.35 * v, Math.random() * 1.6 - 0.8, 0.2), t, d, 'bandpass', 1300, 3300, 0.8, 0.5, d * 0.45);
    this.count('sough');
  }

  /** The keep's banners: a gust takes the cloth and it cracks and flutters, then hangs again. */
  private banners(t: number, p?: PlaceSound) {
    if (!p || p.v < 0.02 || !this.due('flap', t, 1.6 + Math.random() * 3)) return;
    const R = Math.random, g = this.a.ambOut(0.8 * p.v, this.pan(p, 0.3), 0.15);
    const n = 8 + Math.floor(R() * 9), rate = 8 + R() * 5;
    for (let k = 0; k < n; k++) {
      const env = Math.sin(((k + 0.5) / n) * Math.PI);
      this.a.noiseHit(g, t + k / rate + R() * 0.015, 0.07, 'lowpass', 1900 + R() * 700, 450, 0.8, 0.2 + 0.6 * env, 0.004);
    }
    this.count('flap');
  }

  /** Chains at the drawbridge and the winch: links clinking as they sway, and a groan as one takes the strain. */
  private chains(t: number, p?: PlaceSound) {
    if (!p || p.v < 0.02 || !this.due('clink', t, 1 + Math.random() * 2.2)) return;
    const R = Math.random, g = this.a.ambOut(0.5 * p.v, this.pan(p, 0.2), 0.3);
    for (let k = 0, n = 2 + Math.floor(R() * 4); k < n; k++) this.a.bell(g, t + k * (0.07 + R() * 0.09), 2200 + R() * 1400, 0.14, 0.25, [1, 2.4, 3.9]);
    if (R() < 0.3) this.purr(g, t + 0.3, 75 + R() * 20, 13 + R() * 4, 0.9, 0.45, 'sawtooth', 420, 4, 1.06);
    this.count('clink');
  }

  /** A mill's wheel: its paddles slapping into the race, the axle's groan once a turn, the gears knocking. */
  private mill(t: number, p?: PlaceSound) {
    if (!p || p.v < 0.02 || !this.due('mill', t, 0.55)) return;
    const R = Math.random, g = this.a.ambOut(0.3 * p.v, this.pan(p), 0.15), k = (this.played.mill ?? 0) % 8;
    this.a.noiseHit(g, t, 0.35, 'lowpass', 1800, 400, 0.7, 0.45, 0.01);
    if (k % 2 === 0) {
      this.a.tone(g, t + 0.2, 'triangle', 220, 160, 0.06, 0.3);
      this.a.noiseHit(g, t + 0.2, 0.04, 'bandpass', 900, 700, 3, 0.3);
    }
    if (k === 0) this.purr(g, t + 0.1, 92 + R() * 10, 17, 0.8, 0.3, 'sawtooth', 560, 3, 1.1);
    this.count('mill');
  }

  /** Skylarks going up over the fields at dawn: a high warbling that never stops for breath. */
  private larks(t: number, p?: PlaceSound) {
    if (!p || p.v < 0.02 || !this.due('lark', t, 0.6 + Math.random() * 1.4)) return;
    const R = Math.random, g = this.a.ambOut(0.07 * p.v, R() * 1.4 - 0.7, 0.2);
    let at = t;
    for (let k = 0, n = 8 + Math.floor(R() * 10); k < n; k++) {
      const f = 2800 + R() * 1800, d = 0.04 + R() * 0.05;
      this.a.tone(g, at, 'sine', f, f * (0.85 + R() * 0.35), d, 0.8, 0.005);
      at += d + 0.01 + R() * 0.03;
    }
    this.count('lark');
  }

  // ---------- Whisperwood ----------

  /** The canopy: leaves hushing high up, swelling as the air moves, and the great old trunks groaning. */
  private canopy(t: number, p?: PlaceSound) {
    const v = p?.v ?? 0;
    const bed = this.loop('leaves', false, 'highpass', 3400, 0.5, v > 0.02);
    if (bed) {
      const breath = 0.5 + 0.5 * Math.sin(t * 0.17 + 2) * Math.sin(t * 0.07);
      bed.gain.gain.setTargetAtTime(v * (0.02 + 0.045 * breath), t, 0.8);
    }
    if (!p || v < 0.02) return;
    const R = Math.random;
    if (this.due('hush', t, 4 + R() * 6)) {
      const d = 2 + R() * 1.5;
      this.a.noiseHit(this.a.ambOut(0.2 * v, R() * 1.6 - 0.8, 0.15), t, d, 'bandpass', 3000, 5200, 0.6, 0.35, d * 0.5);
      this.count('hush');
    }
    if (this.due('groan', t, (6 + R() * 8) / Math.max(0.4, v))) {
      this.groan(this.a.ambOut(0.35 * v, R() * 1.4 - 0.7, 0.4), t);
      this.count('groan');
    }
  }

  /** A great trunk groaning as the crown sways: a low slow tone sticking and slipping through the wood. */
  private groan(dest: AudioNode, t: number) {
    const ctx = this.a.ctx!, R = Math.random;
    const dur = 1.2 + R() * 1.5, f = 48 + R() * 40;
    const o = ctx.createOscillator(), lfo = ctx.createOscillator(), chop = ctx.createGain(), depth = ctx.createGain();
    const body = ctx.createBiquadFilter(), env = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f, t);
    o.frequency.linearRampToValueAtTime(f * (1.15 + R() * 0.3), t + dur * 0.6);
    o.frequency.linearRampToValueAtTime(f * 0.95, t + dur);
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(7 + R() * 6, t);
    lfo.frequency.linearRampToValueAtTime(4 + R() * 3, t + dur);
    chop.gain.value = 0.5;
    depth.gain.value = 0.5;
    lfo.connect(depth).connect(chop.gain);
    body.type = 'bandpass';
    body.frequency.value = 260 + R() * 160;
    body.Q.value = 3.5;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1, t + dur * 0.35);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(chop).connect(body).connect(env).connect(dest);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }

  /** A waterfall: the roar of the fall, spray hissing, the deep thump of water landing in its pool. */
  private falls(t: number, p?: PlaceSound) {
    const v = p?.v ?? 0;
    const roar = this.loop('roar', true, 'lowpass', 520, 0.5, v > 0.02);
    const spray = this.loop('spray', false, 'bandpass', 3800, 0.4, v > 0.02);
    if (roar) roar.gain.gain.setTargetAtTime(v * 0.24 * (0.92 + 0.08 * Math.sin(t * 1.7)), t, 0.4);
    if (spray) spray.gain.gain.setTargetAtTime(v * 0.035, t, 0.4);
    if (!p || v < 0.02 || !this.due('falls', t, 0.4 + Math.random() * 0.8)) return;
    this.a.noiseHit(this.a.ambOut(0.4 * v, this.pan(p, 0.2), 0.4), t, 0.5, 'lowpass', 300, 80, 0.7, 0.5, 0.02, true);
    this.count('falls');
  }

  /** Whisperwood's frogs: tree frogs peeping all round the water, each its own note, and a bullfrog's
   *  "jug-o-rum" under them. */
  private peepers(t: number, p?: PlaceSound) {
    if (!p || p.v < 0.02) return;
    const R = Math.random;
    if (this.due('peep', t, (0.03 + R() * 0.14) / Math.max(0.25, p.v))) {
      const who = Math.floor(R() * 7), f = 2450 + who * 110, g = this.a.ambOut(0.12 * p.v, (who / 6) * 1.6 - 0.8, 0.1);
      this.whistle(g, t, f, f * 1.12, 0.1, 0.8);
      if (R() < 0.3) this.whistle(g, t + 0.16, f, f * 1.12, 0.1, 0.6);
      this.count('peep');
    }
    if (this.due('bullfrog', t, 9 + R() * 12)) {
      const g = this.a.ambOut(0.45 * p.v, R() * 1.2 - 0.6, 0.2);
      [96, 82, 108].forEach((f, k) => this.purr(g, t + k * 0.36, f, 60 + R() * 10, 0.3, 0.8, 'sawtooth', 320, 2, 0.95));
      this.count('bullfrog');
    }
  }

  /** Hollowbough's chimes: hollow tubes in the home trees, rung by a breath of wind in D, and wooden ones
   *  knocking. */
  private chimes(t: number, p?: PlaceSound) {
    if (!p || p.v < 0.02 || !this.due('chime', t, 3 + Math.random() * 6)) return;
    const R = Math.random, g = this.a.ambOut(0.3 * p.v, this.pan(p, 0.4), 0.6);
    const n = 2 + Math.floor(R() * 5);
    if (R() < 0.7) for (let k = 0; k < n; k++) this.a.bell(g, t + k * (0.12 + R() * 0.3), D_PENT[Math.floor(R() * D_PENT.length)], 2.6, 0.12, [1, 2.76, 5.4]);
    else
      for (let k = 0; k < n; k++) {
        const at = t + k * (0.1 + R() * 0.2);
        this.a.tone(g, at, 'triangle', 620 + R() * 380, 560, 0.15, 0.35);
        this.a.noiseHit(g, at, 0.03, 'bandpass', 1200, 900, 3, 0.25);
      }
    this.count('chime');
  }

  /** The Deep Wood: a branch cracking somewhere near, twigs after it, sometimes a bough coming down. */
  private snaps(t: number, p?: PlaceSound) {
    if (!p || p.v < 0.02 || !this.due('snap', t, 3 + Math.random() * 6)) return;
    const R = Math.random, near = 0.4 + R() * 0.6, g = this.a.ambOut(0.7 * p.v * near, R() * 1.8 - 0.9, 0.5);
    this.a.noiseHit(g, t, 0.035, 'highpass', 2600, 1800, 1, 0.9, 0.001);
    this.a.tone(g, t, 'triangle', 420, 200, 0.05, 0.3);
    for (let k = 0, n = 2 + Math.floor(R() * 4); k < n; k++) this.a.noiseHit(g, t + 0.03 + R() * 0.2, 0.02, 'bandpass', 1500 + R() * 2500, 1200, 3, 0.5, 0.001);
    if (R() < 0.3) {
      this.a.noiseHit(g, t + 0.2, 0.7, 'highpass', 2200, 1600, 0.7, 0.3, 0.25);
      this.a.tone(g, t + 0.95, 'sine', 95, 45, 0.3, 0.6);
      this.a.noiseHit(g, t + 0.95, 0.25, 'lowpass', 600, 120, 0.7, 0.5, 0.004, true);
    }
    this.count('snap');
  }

  /** The dawn chorus when the Warden's night lifts: blackbirds fluting, robins, a wren's loud trill, a cuckoo far
   *  off, a wood pigeon cooing. */
  private dawnsong(t: number, p?: PlaceSound) {
    if (!p || p.v < 0.02 || !this.due('dawnbird', t, (0.3 + Math.random() * 0.9) / Math.max(0.3, p.v))) return;
    const R = Math.random, k = R();
    if (k >= 0.8) {
      // A cuckoo far off, or a wood pigeon.
      this.voice(k < 0.9 ? 'cuckoo' : 'pigeon', (v) => this.a.ambOut(v * (k < 0.9 ? 0.4 : 0.6) * p.v, R() * 1.4 - 0.7, 0.4), t);
      this.count('dawnbird');
      return;
    }
    const g = this.a.ambOut(0.09 * p.v, R() * 1.8 - 0.9, 0.3);
    let at = t;
    if (k < 0.4) {
      // A blackbird: a few fluting notes gliding, a twitter to end.
      for (let i = 0, n = 4 + Math.floor(R() * 4); i < n; i++) {
        const f = 1600 + R() * 1200, d = 0.08 + R() * 0.14;
        this.whistle(g, at, f, f * (0.8 + R() * 0.45), d, 0.9, 0.02);
        at += d + 0.03;
      }
      for (let i = 0; i < 3; i++) this.a.tone(g, at + i * 0.04, 'sine', 4200 + R() * 1500, 5200, 0.03, 0.4, 0.004);
    } else if (k < 0.65) {
      // A robin: thin notes high and low, quick glides.
      for (let i = 0, n = 5 + Math.floor(R() * 5); i < n; i++) {
        const f = i % 2 ? 3000 + R() * 1200 : 4800 + R() * 2000, d = 0.05 + R() * 0.1;
        this.whistle(g, at, f, f * (0.75 + R() * 0.5), d, 0.6, 0.008);
        at += d + 0.02;
      }
    } else {
      // A wren: a loud fast trill.
      for (let i = 0; i < 24; i++) this.a.tone(g, t + i * 0.055, 'sine', i % 2 ? 4600 : 5300, i % 2 ? 4300 : 5000, 0.035, 0.7, 0.004);
    }
    this.count('dawnbird');
  }

  /** A nightingale by the Heartpool: its phrases one after another, each different (the "jug jug" notes, pure
   *  whistles swelling, a rattle, a liquid run). */
  private nightingale(t: number, p?: PlaceSound) {
    if (!p || p.v < 0.02 || !this.due('nightingale', t, 2 + Math.random() * 2.2)) return;
    const R = Math.random, g = this.a.ambOut(0.2 * p.v, this.pan(p), 0.45), k = Math.floor(R() * 4);
    if (k === 0) {
      let at = t;
      for (let i = 0, n = 6 + Math.floor(R() * 5); i < n; i++) {
        this.whistle(g, at, 1900, 1500, 0.05, 0.8, 0.004);
        at += 0.16 - i * 0.008;
      }
    } else if (k === 1) {
      for (let i = 0, n = 4 + Math.floor(R() * 3); i < n; i++) this.whistle(g, t + i * 0.5, 2700, 3100, 0.34, 0.25 + i * 0.15, 0.08);
    } else if (k === 2) this.purr(g, t, 3800 + R() * 600, 38 + R() * 8, 0.6 + R() * 0.4, 0.6, 'sine', 4000, 1.5, 0.95);
    else for (let i = 0; i < 8; i++) this.whistle(g, t + i * 0.07, 1200 + R() * 300, 2400 + R() * 600, 0.05, 0.6, 0.004);
    this.count('nightingale');
  }

  // ---------- animals' voices ----------

  /** An animal's voice by its kind, played through o (a gain at its place: `o(vol, reverb)`). False if it isn't
   *  one of the lands' beasts. Group 87's creatures (or a place's `call`) call them by name through audio.sfx. */
  voice(name: string, o: (v: number, rev?: number) => GainNode, t: number) {
    const R = Math.random, a = this.a;
    switch (name) {
      // A sheep's bleat: "meh-eh-eh", the voice wavering; a lamb's higher.
      case 'sheep': {
        const f = R() < 0.25 ? 560 + R() * 80 : 330 + R() * 90, d = 0.6 + R() * 0.45;
        this.purr(o(0.35, 0.2), t, f, 8 + R() * 3, d, 0.6, 'sawtooth', 1000 + R() * 300, 1.6, 0.9);
        break;
      }
      // A cow lowing: "mmm-ooo", a low voice opening up and closing again.
      case 'cow': {
        const ctx = a.ctx!, d = 1.3 + R() * 0.6, f = 105 + R() * 25;
        const s = ctx.createOscillator(), lp = ctx.createBiquadFilter(), env = ctx.createGain(), dest = o(0.5, 0.3);
        s.type = 'sawtooth';
        s.frequency.setValueAtTime(f, t);
        s.frequency.linearRampToValueAtTime(f * 1.25, t + d * 0.4);
        s.frequency.linearRampToValueAtTime(f * 0.85, t + d);
        lp.type = 'lowpass';
        lp.Q.value = 4;
        lp.frequency.setValueAtTime(280, t);
        lp.frequency.linearRampToValueAtTime(1100, t + d * 0.45);
        lp.frequency.linearRampToValueAtTime(420, t + d);
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(0.5, t + 0.18);
        env.gain.setValueAtTime(0.5, t + d * 0.75);
        env.gain.exponentialRampToValueAtTime(0.0001, t + d);
        s.connect(lp).connect(env).connect(dest);
        s.start(t);
        s.stop(t + d + 0.05);
        break;
      }
      // A mute swan: a soft snorting call or two, and its wings throbbing as it flies ("vaou, vaou").
      case 'swan': {
        const g = o(0.3, 0.4);
        for (let k = 0, n = 1 + Math.floor(R() * 2); k < n; k++) this.sing(g, t + k * 0.35, 330 + R() * 40, 300, 0.18, 0.5, 950, 3, 0, 0.02);
        if (R() < 0.45) for (let k = 0; k < 7; k++) a.noiseHit(g, t + 0.5 + k * 0.32, 0.26, 'bandpass', 700, 1100, 2.5, 0.35, 0.1, true);
        break;
      }
      case 'goose': {
        const g = o(0.35, 0.3);
        for (let k = 0, n = 2 + Math.floor(R() * 3); k < n; k++) this.sing(g, t + k * 0.24, 360 + R() * 40, 310, 0.17, 0.5, 1150, 4, 0, 0.015);
        break;
      }
      // A mallard: quacks falling away.
      case 'duck': {
        const g = o(0.3, 0.2);
        for (let k = 0, n = 2 + Math.floor(R() * 4); k < n; k++) {
          this.sing(g, t + k * 0.2, 280 - k * 12, 230 - k * 10, 0.12, 0.5 * (1 - k * 0.12), 1250, 5, 0, 0.01);
          a.noiseHit(g, t + k * 0.2, 0.08, 'bandpass', 1300, 900, 3, 0.12);
        }
        break;
      }
      // A heron disturbed: one harsh "fraank".
      case 'heron': {
        const g = o(0.4, 0.4);
        this.purr(g, t, 300, 32, 0.38, 0.7, 'sawtooth', 950, 1.8, 0.7);
        a.noiseHit(g, t, 0.35, 'bandpass', 1200, 700, 2, 0.25, 0.02);
        break;
      }
      // A carrion crow's "kraa", two to four, each a little lower.
      case 'crow': {
        const g = o(0.35, 0.35);
        for (let k = 0, n = 2 + Math.floor(R() * 3); k < n; k++) {
          const f = 620 - k * 25 + R() * 40;
          this.sing(g, t + k * 0.42, f, f * 0.85, 0.22, 0.6, 1300, 2, 0, 0.012);
          a.noiseHit(g, t + k * 0.42, 0.2, 'bandpass', 1500, 1100, 2, 0.3, 0.012);
        }
        break;
      }
      // A rook's "kaah": higher and more nasal than a crow's, quick, one answering another.
      case 'rook': {
        const g = o(0.3, 0.4);
        for (let k = 0, n = 1 + Math.floor(R() * 3); k < n; k++) {
          const f = 760 + R() * 120;
          this.sing(g, t + k * (0.25 + R() * 0.2), f, f * 0.82, 0.18, 0.55, 1750, 3, 0, 0.01);
          a.noiseHit(g, t + k * 0.3, 0.15, 'bandpass', 1900, 1400, 2, 0.22, 0.01);
        }
        break;
      }
      case 'frog': {
        const g = o(0.3, 0.1), f = 260 + R() * 80;
        this.purr(g, t, f, 38, 0.12, 0.8, 'sawtooth', 700, 2.5);
        this.purr(g, t + 0.17, f * 1.1, 38, 0.14, 0.8, 'sawtooth', 700, 2.5);
        break;
      }
      // A cock crowing at first light.
      case 'rooster': {
        const g = o(0.4, 0.3);
        let at = t;
        for (const [f0, f1, d] of [[560, 620, 0.14], [760, 780, 0.17], [780, 740, 0.2], [700, 520, 0.75]]) {
          this.sing(g, at, f0, f1, d, 0.6, 1500, 2, 0.02, 0.015);
          at += d + 0.02;
        }
        break;
      }
      case 'cuckoo': {
        const g = o(0.3, 0.4);
        this.whistle(g, t, 720, 700, 0.26, 0.7, 0.03);
        this.whistle(g, t + 0.32, 590, 575, 0.36, 0.7, 0.03);
        break;
      }
      // A wood pigeon: "coo-COO-coo, coo-coo".
      case 'pigeon': {
        const g = o(0.3, 0.3);
        [[0, 0.3, 0.6], [0.36, 0.42, 1], [0.84, 0.25, 0.6], [1.25, 0.25, 0.6], [1.56, 0.3, 0.5]].forEach(([at, d, v]) => this.whistle(g, t + at, 450, 420, d, v, 0.05));
        break;
      }
      // A woodpecker drumming on a dead bough.
      case 'woodpecker': {
        const g = o(0.35, 0.4), n = 14 + Math.floor(R() * 8);
        for (let k = 0; k < n; k++) {
          const v = 1 - k / (n + 4);
          a.noiseHit(g, t + k * 0.058, 0.014, 'bandpass', 1000 + R() * 150, 900, 4, 0.7 * v, 0.001);
          a.tone(g, t + k * 0.058, 'triangle', 620, 520, 0.025, 0.3 * v, 0.001);
        }
        break;
      }
      // A stag belling in the dark: a long hoarse roar rising and sinking.
      case 'stag': {
        const g = o(0.45, 0.5);
        this.sing(g, t, 120, 85, 1.3, 0.6, 520, 1.4, 0.03, 0.2);
        a.noiseHit(g, t, 1.2, 'bandpass', 600, 400, 1.5, 0.35, 0.2, true);
        break;
      }
      default:
        return false;
    }
    this.count('v:' + name);
    return true;
  }
}
