// Progress saved on this device. Versioned so later changes can migrate old saves.

export interface SaveData {
  v: 1;
  checkpoint: string;
  coins: number;
  flasksMax: number;
  sword: number;
  chests: string[];
  lit: string[];
  read: string[];
  rescued: boolean;
  bridge: boolean;
  courtyard: boolean;
  boss: boolean;
  deaths: number;
  playTime: number;
  /** Explored ground (fog of war), packed bits. */
  fow: string;
  walls: string[];
  shards: string[];
  relic: boolean;
  quests: Record<string, number>;
  /** Placed foes that have been defeated (indexes into the realm's enemy list). */
  killed: number[];
}

const KEY = 'realms-save';

const fresh = (): SaveData => ({
  v: 1,
  checkpoint: 'wayshrine',
  coins: 0,
  flasksMax: 3,
  sword: 0,
  chests: [],
  lit: [],
  read: [],
  rescued: false,
  bridge: false,
  courtyard: false,
  boss: false,
  deaths: 0,
  playTime: 0,
  fow: '',
  walls: [],
  shards: [],
  relic: false,
  quests: {},
  killed: [],
});

export class Save {
  data: SaveData = fresh();
  exists = false;

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d && d.v === 1) {
        this.data = { ...fresh(), ...d };
        this.exists = true;
      }
    } catch {
      /* corrupt or blocked storage: start fresh */
    }
  }

  write() {
    this.exists = true;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* storage blocked: progress lives for this session only */
    }
  }

  reset() {
    this.data = fresh();
    this.exists = false;
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
