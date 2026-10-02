// Generative music played on real instrument samples (FluidR3 GM, CC BY 3.0).
// Each area has a track: a key, a chord loop and a few layers. Melodies are
// generated per phrase from a seed so they repeat and feel composed.
import { mulberry32 } from '../engine/util';

type Chord = [number, 'M' | 'm'];

interface Track {
  bpm: number;
  key: number;
  scale: number[];
  prog: Chord[];
  steps?: number;
  pad?: string;
  padVol?: number;
  arp?: string;
  arpVol?: number;
  arpStyle?: 'up' | 'broken' | 'waltz' | 'oompah';
  lead?: string;
  leadVol?: number;
  leadOct?: number;
  density?: number;
  bass?: string;
  bassVol?: number;
  bassStyle?: 'whole' | 'half' | 'pulse' | 'eighths';
  ost?: string;
  ostVol?: number;
  perc?: 'boss' | 'march' | 'light' | 'none';
  percVol?: number;
  /** Notes repeat back, fading (under the sea). */
  echo?: boolean;
}

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const HARM = [0, 2, 3, 5, 7, 8, 11];
const PHRYG = [0, 1, 3, 5, 7, 8, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];

export const TRACKS: Record<string, Track> = {
  road: {
    bpm: 66, key: 50, scale: DORIAN, prog: [[0, 'm'], [-2, 'M'], [-4, 'M'], [-2, 'M']],
    pad: 'string_ensemble_1', padVol: 0.16, arp: 'orchestral_harp', arpVol: 0.32, arpStyle: 'broken',
    lead: 'flute', leadVol: 0.22, leadOct: 1, density: 0.25, bass: 'cello', bassVol: 0.22, bassStyle: 'whole',
  },
  village: {
    bpm: 84, key: 53, scale: MAJOR, prog: [[0, 'M'], [-5, 'M'], [-3, 'm'], [5, 'M']],
    pad: 'string_ensemble_1', padVol: 0.12, arp: 'orchestral_harp', arpVol: 0.3, arpStyle: 'waltz',
    lead: 'flute', leadVol: 0.24, leadOct: 1, density: 0.45, bass: 'pizzicato_strings', bassVol: 0.3, bassStyle: 'half',
  },
  fields: {
    bpm: 58, key: 45, scale: MINOR, prog: [[0, 'm'], [-4, 'M'], [-7, 'M'], [-2, 'M']],
    pad: 'choir_aahs', padVol: 0.12, arp: 'orchestral_harp', arpVol: 0.28, arpStyle: 'up',
    lead: 'celesta', leadVol: 0.18, leadOct: 1, density: 0.2, bass: 'cello', bassVol: 0.2, bassStyle: 'whole',
  },
  wilds: {
    bpm: 60, key: 52, scale: PHRYG, prog: [[0, 'm'], [1, 'M'], [0, 'm'], [-2, 'M']],
    pad: 'choir_aahs', padVol: 0.1, lead: 'celesta', leadVol: 0.2, leadOct: 1, density: 0.18,
    bass: 'cello', bassVol: 0.24, bassStyle: 'whole', ost: 'pizzicato_strings', ostVol: 0.12,
  },
  keep: {
    bpm: 88, key: 48, scale: HARM, prog: [[0, 'm'], [-4, 'M'], [-5, 'M'], [0, 'm']],
    pad: 'string_ensemble_1', padVol: 0.14, lead: 'french_horn', leadVol: 0.24, leadOct: 0, density: 0.3,
    bass: 'cello', bassVol: 0.26, bassStyle: 'half', ost: 'pizzicato_strings', ostVol: 0.16, perc: 'march', percVol: 0.3,
  },
  hall: {
    bpm: 50, key: 48, scale: MINOR, prog: [[0, 'm'], [1, 'M'], [-4, 'M'], [-5, 'M']],
    pad: 'choir_aahs', padVol: 0.16, lead: 'celesta', leadVol: 0.12, leadOct: 1, density: 0.1, bass: 'cello', bassVol: 0.22, bassStyle: 'whole',
  },
  boss: {
    bpm: 138, key: 50, scale: HARM, prog: [[0, 'm'], [-4, 'M'], [-2, 'M'], [-5, 'M']],
    pad: 'choir_aahs', padVol: 0.14, lead: 'french_horn', leadVol: 0.3, leadOct: 0, density: 0.55,
    bass: 'cello', bassVol: 0.3, bassStyle: 'eighths', ost: 'string_ensemble_1', ostVol: 0.14, perc: 'boss', percVol: 0.5,
  },
  dawn: {
    bpm: 74, key: 55, scale: MAJOR, prog: [[0, 'M'], [-5, 'M'], [-3, 'm'], [5, 'M']],
    pad: 'string_ensemble_1', padVol: 0.16, arp: 'orchestral_harp', arpVol: 0.32, arpStyle: 'up',
    lead: 'flute', leadVol: 0.26, leadOct: 1, density: 0.4, bass: 'cello', bassVol: 0.22, bassStyle: 'half',
  },
  tavern: {
    bpm: 128, key: 55, scale: MAJOR, prog: [[0, 'M'], [5, 'M'], [-5, 'M'], [0, 'M']], steps: 12,
    arp: 'orchestral_harp', arpVol: 0.3, arpStyle: 'oompah', lead: 'flute', leadVol: 0.3, leadOct: 1, density: 0.7,
    bass: 'pizzicato_strings', bassVol: 0.36, bassStyle: 'pulse',
  },
};

/**
 * A realm's own versions of the moods (any it leaves out play as above). Whisperwood's grow from the
 * prototype's forest track: 88 bpm, D Dorian, a flute over cello and harp, light hand drums.
 */
export const REALM_TRACKS: Record<string, Record<string, Track>> = {
  // The Sunken Reef: the prototype's sea track (70 bpm, Lydian, a celesta over a choir, no drums, echo) for
  // the shallows; slower, lower and sparser as it gets deep.
  aqua: {
    road: {
      bpm: 70, key: 60, scale: LYDIAN, prog: [[0, 'M'], [2, 'M'], [-3, 'm'], [5, 'M']],
      pad: 'choir_aahs', padVol: 0.12, arp: 'orchestral_harp', arpVol: 0.18, arpStyle: 'broken',
      lead: 'celesta', leadVol: 0.2, leadOct: 1, density: 0.25, bass: 'cello', bassVol: 0.18, bassStyle: 'whole', echo: true,
    },
    wilds: {
      bpm: 64, key: 57, scale: LYDIAN, prog: [[0, 'M'], [2, 'M'], [0, 'M'], [-5, 'M']],
      pad: 'choir_aahs', padVol: 0.14, lead: 'celesta', leadVol: 0.16, leadOct: 1, density: 0.18,
      bass: 'cello', bassVol: 0.18, bassStyle: 'whole', echo: true,
    },
    fields: {
      bpm: 56, key: 50, scale: DORIAN, prog: [[0, 'm'], [-2, 'M'], [0, 'm'], [3, 'M']],
      pad: 'choir_aahs', padVol: 0.16, lead: 'celesta', leadVol: 0.12, leadOct: 1, density: 0.12,
      bass: 'cello', bassVol: 0.24, bassStyle: 'whole', echo: true,
    },
    keep: {
      bpm: 62, key: 50, scale: HARM, prog: [[0, 'm'], [1, 'M'], [-4, 'M'], [0, 'm']],
      pad: 'string_ensemble_1', padVol: 0.12, lead: 'oboe', leadVol: 0.16, leadOct: 1, density: 0.2,
      bass: 'cello', bassVol: 0.22, bassStyle: 'half', ost: 'pizzicato_strings', ostVol: 0.1, echo: true,
    },
    hall: {
      bpm: 48, key: 48, scale: MINOR, prog: [[0, 'm'], [1, 'M'], [-4, 'M'], [-5, 'M']],
      pad: 'choir_aahs', padVol: 0.18, lead: 'celesta', leadVol: 0.1, leadOct: 1, density: 0.08,
      bass: 'cello', bassVol: 0.22, bassStyle: 'whole', echo: true,
    },
    village: {
      bpm: 76, key: 60, scale: LYDIAN, prog: [[0, 'M'], [2, 'M'], [-3, 'm'], [5, 'M']],
      pad: 'choir_aahs', padVol: 0.1, arp: 'orchestral_harp', arpVol: 0.26, arpStyle: 'waltz',
      lead: 'celesta', leadVol: 0.22, leadOct: 1, density: 0.4, bass: 'pizzicato_strings', bassVol: 0.24, bassStyle: 'half', echo: true,
    },
    boss: {
      bpm: 128, key: 60, scale: HARM, prog: [[0, 'm'], [-4, 'M'], [-2, 'M'], [-5, 'M']],
      pad: 'choir_aahs', padVol: 0.16, lead: 'french_horn', leadVol: 0.3, leadOct: 0, density: 0.55,
      bass: 'cello', bassVol: 0.3, bassStyle: 'eighths', ost: 'orchestral_harp', ostVol: 0.14, perc: 'boss', percVol: 0.45, echo: true,
    },
    dawn: {
      bpm: 72, key: 60, scale: MAJOR, prog: [[0, 'M'], [5, 'M'], [-3, 'm'], [-5, 'M']],
      pad: 'string_ensemble_1', padVol: 0.14, arp: 'orchestral_harp', arpVol: 0.3, arpStyle: 'up',
      lead: 'celesta', leadVol: 0.26, leadOct: 1, density: 0.42, bass: 'cello', bassVol: 0.2, bassStyle: 'half', echo: true,
    },
  },
  forest: {
    wilds: {
      bpm: 76, key: 62, scale: DORIAN, prog: [[0, 'm'], [5, 'M'], [0, 'm'], [-2, 'M']],
      arp: 'orchestral_harp', arpVol: 0.24, arpStyle: 'broken', lead: 'flute', leadVol: 0.18, leadOct: 1, density: 0.22,
      bass: 'cello', bassVol: 0.2, bassStyle: 'whole', perc: 'light', percVol: 0.14,
    },
    road: {
      bpm: 88, key: 62, scale: DORIAN, prog: [[0, 'm'], [5, 'M'], [0, 'm'], [-2, 'M']],
      arp: 'orchestral_harp', arpVol: 0.28, arpStyle: 'up', lead: 'flute', leadVol: 0.24, leadOct: 1, density: 0.4,
      bass: 'cello', bassVol: 0.22, bassStyle: 'half', perc: 'light', percVol: 0.2,
    },
    village: {
      bpm: 92, key: 62, scale: DORIAN, prog: [[0, 'm'], [5, 'M'], [3, 'M'], [-2, 'M']],
      pad: 'string_ensemble_1', padVol: 0.1, arp: 'orchestral_harp', arpVol: 0.3, arpStyle: 'waltz',
      lead: 'flute', leadVol: 0.26, leadOct: 1, density: 0.5, bass: 'pizzicato_strings', bassVol: 0.28, bassStyle: 'half', perc: 'light', percVol: 0.16,
    },
    fields: {
      bpm: 62, key: 57, scale: DORIAN, prog: [[0, 'm'], [-2, 'M'], [5, 'M'], [0, 'm']],
      pad: 'string_ensemble_1', padVol: 0.12, arp: 'orchestral_harp', arpVol: 0.24, arpStyle: 'up',
      lead: 'flute', leadVol: 0.16, leadOct: 1, density: 0.2, bass: 'cello', bassVol: 0.2, bassStyle: 'whole',
    },
    keep: {
      bpm: 80, key: 50, scale: MINOR, prog: [[0, 'm'], [1, 'M'], [-2, 'M'], [0, 'm']],
      pad: 'choir_aahs', padVol: 0.12, lead: 'oboe', leadVol: 0.2, leadOct: 1, density: 0.3,
      bass: 'cello', bassVol: 0.26, bassStyle: 'half', ost: 'pizzicato_strings', ostVol: 0.14, perc: 'light', percVol: 0.3,
    },
    hall: {
      bpm: 52, key: 62, scale: DORIAN, prog: [[0, 'm'], [-2, 'M'], [5, 'M'], [0, 'm']],
      pad: 'choir_aahs', padVol: 0.16, lead: 'celesta', leadVol: 0.12, leadOct: 1, density: 0.12, bass: 'cello', bassVol: 0.2, bassStyle: 'whole',
    },
    boss: {
      bpm: 132, key: 55, scale: HARM, prog: [[0, 'm'], [-4, 'M'], [-2, 'M'], [-5, 'M']],
      pad: 'choir_aahs', padVol: 0.14, lead: 'french_horn', leadVol: 0.3, leadOct: 0, density: 0.55,
      bass: 'cello', bassVol: 0.3, bassStyle: 'eighths', ost: 'orchestral_harp', ostVol: 0.16, perc: 'boss', percVol: 0.5,
    },
    dawn: {
      bpm: 80, key: 62, scale: MAJOR, prog: [[0, 'M'], [5, 'M'], [-3, 'm'], [-5, 'M']],
      pad: 'string_ensemble_1', padVol: 0.14, arp: 'orchestral_harp', arpVol: 0.32, arpStyle: 'up',
      lead: 'flute', leadVol: 0.28, leadOct: 1, density: 0.45, bass: 'cello', bassVol: 0.22, bassStyle: 'half',
    },
  },
};

const SUSTAIN = new Set(['string_ensemble_1', 'choir_aahs', 'flute', 'oboe', 'french_horn', 'cello']);

interface Note {
  s: number;
  l: number;
  deg: number;
}

class Channel {
  out: GainNode;
  step = 0;
  nextT = 0;
  phrase: Note[][] = [];
  phraseIdx = -1;
  dying = false;
  constructor(public name: string, public track: Track, public m: Music, dest: AudioNode) {
    this.out = m.ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(dest);
    if (track.echo) this.out.connect(m.echoIn);
  }
  get sd() {
    return 60 / this.track.bpm / 4;
  }
  get steps() {
    return this.track.steps ?? 16;
  }

  private compose(idx: number) {
    const T = this.track;
    const r = mulberry32(idx % 2 === 0 ? 11 + this.name.length * 7 : 23 + this.name.length * 3);
    const n = this.steps;
    const dens = T.density ?? 0.3;
    const bar = (k: number): Note[] => {
      const notes: Note[] = [];
      let s = 0;
      let deg = k === 0 ? 0 : Math.floor(r() * 5) - 1;
      while (s < n) {
        const lens = dens > 0.5 ? [2, 2, 4, 1, 3] : dens > 0.3 ? [4, 2, 4, 6, 8] : [8, 4, 6, 12, 16];
        let l = lens[Math.floor(r() * lens.length)];
        if (s + l > n) l = n - s;
        if (r() < 0.2 + (1 - dens) * 0.35) {
          s += l;
          continue;
        }
        deg += Math.floor(r() * 5) - 2;
        deg = Math.max(-3, Math.min(9, deg));
        notes.push({ s, l, deg });
        s += l;
      }
      return notes;
    };
    const a = bar(0), b = bar(1);
    const c = a.map((x) => ({ ...x, deg: x.deg + (r() < 0.5 ? 2 : -1) }));
    const end: Note[] = [{ s: 0, l: n / 2, deg: 2 }, { s: n / 2, l: n / 2, deg: 0 }];
    this.phrase = [a, b, c, end];
  }

  schedule(until: number) {
    const T = this.track, m = this.m;
    const now = m.ctx.currentTime;
    if (this.nextT < now - 0.1) {
      const missed = Math.ceil((now - this.nextT) / this.sd);
      this.nextT += missed * this.sd;
      this.step += missed;
    }
    while (this.nextT < until) {
      const t = this.nextT;
      const n = this.steps;
      const barIdx = Math.floor(this.step / n);
      const s = this.step % n;
      const phraseNo = Math.floor(barIdx / 4);
      if (phraseNo !== this.phraseIdx) {
        this.phraseIdx = phraseNo;
        this.compose(phraseNo);
      }
      const chord = T.prog[barIdx % T.prog.length];
      const rootOff = ((chord[0] + 6 + 1200) % 12) - 6;
      const root = T.key + rootOff;
      const third = chord[1] === 'm' ? 3 : 4;
      const tri = [0, third, 7];
      const sd = this.sd;
      const barLen = sd * n;
      const hum = () => (Math.random() - 0.5) * 0.012;
      const dest = this.out;

      if (s === 0 && T.pad) for (const iv of tri) m.play(T.pad, root + 12 + iv, t, barLen * 0.98, (T.padVol ?? 0.15) * 0.6, dest, 0.5);
      if (T.bass) {
        const bv = T.bassVol ?? 0.2;
        const st = T.bassStyle;
        if (st === 'whole' && s === 0) m.play(T.bass, root - 12, t, barLen * 0.95, bv, dest, 0.1);
        if (st === 'half' && s % (n / 2) === 0) m.play(T.bass, root - 12 + (s ? 7 : 0), t + hum(), barLen * 0.48, bv, dest, 0.05);
        if (st === 'pulse' && s % 6 === 0) m.play(T.bass, root - 12 + (s ? 7 : 0), t + hum(), sd * 4, bv, dest, 0.01);
        if (st === 'eighths' && s % 2 === 0) m.play(T.bass, root - 12 + (s % 8 === 6 ? 12 : 0), t, sd * 1.8, bv * (s % 4 ? 0.7 : 1), dest, 0.01);
      }
      if (T.arp) {
        const av = T.arpVol ?? 0.3;
        const st = T.arpStyle;
        if (st === 'up' && s % 2 === 0) {
          const k = (s / 2) % 6;
          const iv = [0, third, 7, 12, 7, third][k];
          m.play(T.arp, root + 12 + iv, t + hum(), sd * 4, av * (k === 0 ? 1 : 0.75), dest, 0.005);
        }
        if (st === 'broken' && s % 4 === 0) {
          const iv = [0, 7, third + 12, 7][(s / 4) % 4];
          m.play(T.arp, root + 12 + iv, t + hum(), sd * 6, av, dest, 0.005);
        }
        if (st === 'waltz' && s % 4 === 0) {
          if (s === 0) m.play(T.arp, root, t, sd * 6, av, dest, 0.005);
          else for (const iv of tri) m.play(T.arp, root + 12 + iv, t + hum(), sd * 3, av * 0.55, dest, 0.005);
        }
        if (st === 'oompah' && s % 2 === 0 && s % 6 !== 0) for (const iv of [third, 7]) m.play(T.arp, root + 12 + iv, t + hum(), sd * 2, av * 0.6, dest, 0.005);
      }
      if (T.ost && s % 2 === 0) {
        const iv = [0, 7, 12, 7, third, 7, 12, 7][(s / 2) % 8];
        m.play(T.ost, root + iv, t + hum(), sd * 1.6, (T.ostVol ?? 0.15) * (s % 8 === 0 ? 1 : 0.7), dest, 0.005);
      }
      if (T.lead) {
        const bar = this.phrase[barIdx % 4];
        for (const note of bar)
          if (note.s === s) {
            const sc = T.scale;
            const oct = Math.floor(note.deg / sc.length);
            const semi = sc[((note.deg % sc.length) + sc.length) % sc.length] + oct * 12;
            m.play(T.lead, T.key + 12 * (T.leadOct ?? 1) + semi, t + hum(), note.l * sd * 0.95, T.leadVol ?? 0.25, dest, 0.03);
          }
      }
      if (T.perc && T.perc !== 'none') {
        const pv = T.percVol ?? 0.3;
        if (T.perc === 'march') {
          if (s === 0 || s === 8) m.play('timpani', root - 12 + (s ? 7 : 0), t, sd * 6, pv, dest, 0.005);
        } else if (T.perc === 'light') {
          // Soft hand drums: a low beat on one, a lighter one off the beat.
          if (s === 0 || s === 10) m.play('taiko_drum', 48, t + hum(), sd * 3, pv * (s ? 0.55 : 1), dest, 0.002);
        } else {
          const k = 'x..x..x.x..x..x.'[s] === 'x';
          if (k) m.play('taiko_drum', 48, t, sd * 4, pv * (s === 0 ? 1.2 : 0.8), dest, 0.002);
          if (s === 0 || s === 8) m.play('timpani', root - 12, t, sd * 8, pv * 0.8, dest, 0.005);
        }
      }
      this.nextT += this.sd;
      this.step++;
    }
  }
}

export class Music {
  buffers = new Map<string, { midi: number; buf: AudioBuffer }[]>();
  private channels: Channel[] = [];
  private main: Channel | null = null;
  private tavern: Channel | null = null;
  private tavernGain: GainNode;
  private tavernFilter: BiquadFilterNode;
  private rev: GainNode;
  ready = false;
  want = '';
  rate = 1;
  /** The realm being played: its own versions of the moods replace the shared ones. */
  realm = '';
  /** Where echoing tracks send their notes. */
  echoIn: GainNode;

  constructor(public ctx: AudioContext, private dest: AudioNode, reverb: ConvolverNode) {
    // An echo for the tracks that want one: a delay feeding back on itself, quieter each time round.
    this.echoIn = ctx.createGain();
    this.echoIn.gain.value = 0.32;
    const delay = ctx.createDelay(1.5), back = ctx.createGain();
    delay.delayTime.value = 0.43;
    back.gain.value = 0.38;
    this.echoIn.connect(delay);
    delay.connect(back).connect(delay);
    delay.connect(dest);
    this.rev = ctx.createGain();
    this.rev.gain.value = 0.45;
    this.rev.connect(reverb);
    this.tavernFilter = ctx.createBiquadFilter();
    this.tavernFilter.type = 'lowpass';
    this.tavernFilter.frequency.value = 900;
    this.tavernGain = ctx.createGain();
    this.tavernGain.gain.value = 0;
    this.tavernFilter.connect(this.tavernGain).connect(dest);
  }

  async load() {
    try {
      const man: Record<string, number[]> = await (await fetch('/audio/samples/manifest.json')).json();
      const jobs: Promise<void>[] = [];
      for (const [inst, notes] of Object.entries(man))
        for (const midi of notes)
          jobs.push(
            fetch(`/audio/samples/${inst}/${midi}.mp3`)
              .then((r) => r.arrayBuffer())
              .then((ab) => this.ctx.decodeAudioData(ab))
              .then((buf) => {
                if (!this.buffers.has(inst)) this.buffers.set(inst, []);
                this.buffers.get(inst)!.push({ midi, buf });
              }),
          );
      await Promise.all(jobs);
      this.ready = true;
    } catch (e) {
      console.warn('music samples failed to load', e);
    }
  }

  play(inst: string, midi: number, t: number, dur: number, vol: number, dest: AudioNode, attack = 0.01) {
    const list = this.buffers.get(inst);
    if (!list || !list.length) return;
    let best = list[0];
    for (const s of list) if (Math.abs(s.midi - midi) < Math.abs(best.midi - midi)) best = s;
    const src = this.ctx.createBufferSource();
    src.buffer = best.buf;
    src.playbackRate.value = Math.pow(2, (midi - best.midi) / 12);
    const sustain = SUSTAIN.has(inst);
    if (sustain && dur > best.buf.duration * 0.7) {
      src.loop = true;
      src.loopStart = best.buf.duration * 0.35;
      src.loopEnd = best.buf.duration * 0.85;
    }
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.max(0.005, attack));
    const rel = sustain ? 0.35 : 1.2;
    const end = t + Math.max(dur, attack + 0.02);
    if (sustain) {
      g.gain.setValueAtTime(vol, end);
      g.gain.exponentialRampToValueAtTime(0.0001, end + rel);
    } else g.gain.exponentialRampToValueAtTime(0.0001, end + rel);
    src.connect(g);
    g.connect(dest);
    g.connect(this.rev);
    src.start(t);
    src.stop(end + rel + 0.05);
  }

  setTrack(name: string) {
    if (name === this.want) return;
    this.want = name;
    if (this.main) {
      this.main.dying = true;
      this.main.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.9);
    }
    this.main = null;
    const own = REALM_TRACKS[this.realm]?.[name];
    const track = own ?? TRACKS[name];
    if (!name || !track) return;
    // (A realm's own track gets its own name, so its melodies differ too.)
    const ch = new Channel(own ? `${this.realm}:${name}` : name, track, this, this.dest);
    ch.nextT = this.ctx.currentTime + 0.6;
    ch.out.gain.setTargetAtTime(1, this.ctx.currentTime + 0.5, 1.2);
    this.channels.push(ch);
    this.main = ch;
  }

  /** The tavern tune, heard through the walls. gain 0..1, open: inside. */
  setTavern(gain: number, inside: boolean) {
    if (!this.tavern) {
      this.tavern = new Channel('tavern', TRACKS.tavern, this, this.tavernFilter);
      this.tavern.out.gain.value = 1;
      this.tavern.nextT = this.ctx.currentTime + 0.2;
    }
    const t = this.ctx.currentTime;
    this.tavernGain.gain.setTargetAtTime(gain, t, 0.4);
    this.tavernFilter.frequency.setTargetAtTime(inside ? 12000 : 700, t, 0.3);
  }

  update(_dt: number) {
    if (!this.ready) return;
    const until = this.ctx.currentTime + 0.25;
    for (const c of this.channels) if (!c.dying || c.out.gain.value > 0.002) c.schedule(until);
    this.channels = this.channels.filter((c) => !(c.dying && c.out.gain.value < 0.002));
    if (this.tavern && this.tavernGain.gain.value > 0.003) this.tavern.schedule(until);
    else if (this.tavern) this.tavern.nextT = this.ctx.currentTime + 0.1;
  }
}
