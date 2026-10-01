// Progress saved on this device. Versioned so later changes can migrate old saves.
// Version 2 holds several realms: what the knight carries is kept once, and each
// realm keeps its own moonfires, chests, felled foes, quests and story flags.
import type { RealmId } from '../world/realm';

/** What the knight carries from realm to realm. */
export interface Carried {
  coins: number;
  flasksMax: number;
  sword: number;
  /** Relics won ('crest': the Knight's Crest). */
  relics: string[];
  /** Beasts freed besides the warhorse. */
  mounts: string[];
  deaths: number;
  playTime: number;
  /** Every foe felled on this journey (the victory screen's count). */
  kills: number;
  /** Wares bought, by level (see src/game/wares.ts). */
  kit: Record<string, number>;
}

/** Everything about one realm. */
export interface Place {
  /** The moonfire to rise at ('' or unlit: the realm's start). */
  checkpoint: string;
  chests: string[];
  lit: string[];
  read: string[];
  walls: string[];
  shards: string[];
  quests: Record<string, number>;
  /** Placed foes that have been defeated (indexes into the realm's enemy list). */
  killed: number[];
  /** Explored ground (fog of war), packed bits. */
  fow: string;
  /** Story moments: the drawbridge is down, the captive is free, the tyrant fell... */
  flags: Record<string, boolean>;
}

/** The working view the game reads and changes: the carried part plus the current realm. */
export type SaveData = Carried & Place;

interface Stored extends Carried {
  v: 2;
  /** The realm the knight is in. */
  realm: RealmId;
  /** Set by a border crossing: where to come out in `realm` (the border's id). */
  arrive?: string;
  realms: Partial<Record<RealmId, Place>>;
}

const KEY = 'realms-save';
const CARRIED: (keyof Carried)[] = ['coins', 'flasksMax', 'sword', 'relics', 'mounts', 'deaths', 'playTime', 'kills', 'kit'];
const PLACE: (keyof Place)[] = ['checkpoint', 'chests', 'lit', 'read', 'walls', 'shards', 'quests', 'killed', 'fow', 'flags'];

const freshCarried = (): Carried => ({ coins: 0, flasksMax: 3, sword: 0, relics: [], mounts: [], deaths: 0, playTime: 0, kills: 0, kit: {} });
const freshPlace = (): Place => ({ checkpoint: '', chests: [], lit: [], read: [], walls: [], shards: [], quests: {}, killed: [], fow: '', flags: {} });

/** A version-1 save (realm 1 only, everything at the top) as version 2. Nothing is dropped. */
export function migrateV1(d: Record<string, unknown>): Stored {
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const num = (v: unknown, dflt: number) => (typeof v === 'number' && isFinite(v) ? v : dflt);
  const killed = arr<number>(d.killed);
  const flags: Record<string, boolean> = {};
  for (const k of ['rescued', 'bridge', 'courtyard', 'boss']) if (d[k] === true) flags[k] = true;
  return {
    v: 2,
    realm: 'castle',
    coins: num(d.coins, 0),
    flasksMax: num(d.flasksMax, 3),
    sword: num(d.sword, 0),
    relics: d.relic === true ? ['crest'] : [],
    mounts: [],
    deaths: num(d.deaths, 0),
    playTime: num(d.playTime, 0),
    // Saves from before the count was kept: at least the placed foes are known.
    kills: num(d.kills, killed.length),
    kit: {},
    realms: {
      castle: {
        checkpoint: typeof d.checkpoint === 'string' ? d.checkpoint : '',
        chests: arr(d.chests),
        lit: arr(d.lit),
        read: arr(d.read),
        walls: arr(d.walls),
        shards: arr(d.shards),
        quests: d.quests && typeof d.quests === 'object' ? (d.quests as Record<string, number>) : {},
        killed,
        fow: typeof d.fow === 'string' ? d.fow : '',
        flags,
      },
    },
  };
}

export class Save {
  private stored: Stored = { v: 2, realm: 'castle', ...freshCarried(), realms: {} };
  /** The working view for the realm the knight is in. */
  data: SaveData = { ...freshCarried(), ...freshPlace() };
  exists = false;
  /** Where to come out, when the page was loaded by a border crossing. */
  arrival: string | null = null;

  get realm() {
    return this.stored.realm;
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d && d.v === 1) this.stored = migrateV1(d);
      else if (d && d.v === 2 && d.realms) this.stored = { ...this.stored, ...freshCarried(), ...d };
      else return;
      this.exists = true;
      this.arrival = this.stored.arrive ?? null;
      delete this.stored.arrive;
      this.view(this.stored.realm);
    } catch {
      /* corrupt or blocked storage: start fresh */
    }
  }

  /** Work in another realm's part of the save (the carried part comes along). */
  select(id: RealmId) {
    this.stash();
    this.view(id);
  }

  /** Build the working view for a realm from the stored save. */
  private view(id: RealmId) {
    this.stored.realm = id;
    const carried = freshCarried(), place = freshPlace();
    for (const k of CARRIED) if (this.stored[k] !== undefined) (carried as unknown as Record<string, unknown>)[k] = this.stored[k];
    const saved = this.stored.realms[id];
    if (saved) for (const k of PLACE) if (saved[k] !== undefined) (place as unknown as Record<string, unknown>)[k] = saved[k];
    this.data = { ...carried, ...place };
  }

  /** Copy the working view back into the stored save. */
  private stash() {
    if (!this.data) return;
    const place = {} as Record<string, unknown>;
    for (const k of CARRIED) (this.stored as unknown as Record<string, unknown>)[k] = this.data[k];
    for (const k of PLACE) place[k] = this.data[k];
    this.stored.realms[this.stored.realm] = place as unknown as Place;
  }

  /** A realm's saved part (the working view for the current one). */
  place(id: RealmId): Place | null {
    if (id === this.stored.realm) return this.data;
    return this.stored.realms[id] ?? null;
  }

  /** Realms where all three Moon Shards were found (each is a heart). */
  get shardSets() {
    let n = 0;
    for (const id of Object.keys({ ...this.stored.realms, [this.stored.realm]: 1 }) as RealmId[]) if ((this.place(id)?.shards.length ?? 0) >= 3) n++;
    return n;
  }

  write() {
    this.exists = true;
    this.stash();
    try {
      localStorage.setItem(KEY, JSON.stringify(this.stored));
    } catch {
      /* storage blocked: progress lives for this session only */
    }
  }

  /** Leave for another realm: saved so the next load comes out at `arrive` there. */
  travel(to: RealmId, arrive: string) {
    this.stash();
    this.stored.arrive = arrive;
    this.select(to);
    this.write();
  }

  reset() {
    this.stored = { v: 2, realm: 'castle', ...freshCarried(), realms: {} };
    this.data = { ...freshCarried(), ...freshPlace() };
    this.exists = false;
    this.arrival = null;
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }

  read(id: string) {
    if (!this.data.read.includes(id)) this.data.read.push(id);
  }
}
