// The pause menu's map of the eight realms (the prototype's world map, filled in as you
// travel): a pixel sea with the realms as islands along a dotted route. Realms you have been
// to show their land and name; the next one is a rumour (its name, greyed); the rest are dark
// with a "?". A visited realm's island can be clicked to travel there.

/** The prototype's order, names, colours and island icons. */
const ALL = [
  { id: 'castle', name: 'The Moonlit Keep', top: '#9b93b8', body: '#3b3656', accent: '#5ad1ff', icon: ['#.#.#', '#####', '##.##', '#####', '##.##', '#####'] },
  { id: 'forest', name: 'Whisperwood', top: '#6aa83a', body: '#4a3526', accent: '#b8f060', icon: ['..#..', '.###.', '#####', '.###.', '#####', '..#..'] },
  { id: 'aqua', name: 'The Sunken Reef', top: '#e0cf96', body: '#6e5f48', accent: '#8ff0ff', icon: ['#.#.#', '#.#.#', '.###.', '..#..', '.###.', '#####'] },
  { id: 'desert', name: 'The Scorched Dunes', top: '#f2d091', body: '#b8864a', accent: '#ffd24a', icon: ['.....', '..#..', '.###.', '.###.', '#####', '#####'] },
  { id: 'ice', name: 'Frostpeak', top: '#eaf4ff', body: '#6a8cb0', accent: '#bfe8ff', icon: ['..#..', '.###.', '.###.', '#####', '#####', '#####'] },
  { id: 'lava', name: 'The Molten Core', top: '#6a463c', body: '#2a1a16', accent: '#ff9a3c', icon: ['.#.#.', '..#..', '.###.', '#####', '#####', '#####'] },
  { id: 'storm', name: 'Stormspire', top: '#8a93a8', body: '#3a4052', accent: '#ffe45a', icon: ['..#..', '..#..', '.###.', '.###.', '.###.', '#####'] },
  { id: 'void', name: 'The Void', top: '#a070e0', body: '#24143e', accent: '#e040ff', icon: ['..#..', '.###.', '.###.', '#####', '.###.', '..#..'] },
];
/** Island centres in percent of the map (the prototype's). */
const NODES = [[12, 74], [27, 54], [16, 30], [36, 18], [52, 38], [66, 20], [82, 36], [87, 70]];
const W = 160, H = 100;

export interface MapRealm {
  id: string;
  /** here: the knight is in it; visited; rumour: the next one, not yet reached; unknown. */
  state: 'here' | 'visited' | 'rumour' | 'unknown';
  freed: boolean;
  shards: number;
  chests: number;
}

const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

export class WorldMap {
  el: HTMLElement;
  private cv: HTMLCanvasElement;
  private labels: HTMLElement;
  private info: HTMLElement;
  constructor(private onTravel: (id: string) => void) {
    this.el = document.createElement('div');
    this.el.className = 'wmap';
    this.el.innerHTML = '<div class="warea"><canvas width="160" height="100"></canvas><div class="wlabels"></div></div><div class="winfo"></div>';
    this.cv = this.el.querySelector('canvas')!;
    this.labels = this.el.querySelector('.wlabels')!;
    this.info = this.el.querySelector('.winfo')!;
    this.labels.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-realm]');
      if (b && b.dataset.go === '1') this.onTravel(b.dataset.realm!);
    });
  }

  draw(realms: MapRealm[]) {
    const by = new Map(realms.map((r) => [r.id, r]));
    const state = (id: string) => by.get(id)?.state ?? 'unknown';
    const g = this.cv.getContext('2d')!;
    g.fillStyle = '#16294a';
    g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const h = hash(x, y) % 41;
        if (h === 0) (g.fillStyle = '#23406a'), g.fillRect(x, y, 3, 1);
        else if (h === 1) (g.fillStyle = '#1d3558'), g.fillRect(x, y, 2, 1);
      }
    const pts = NODES.map(([x, y]) => [(x / 100) * W, (y / 100) * H]);
    // The route: lit between realms both reached.
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.hypot(x1 - x0, y1 - y0) / 3;
      const lit = state(ALL[i].id) !== 'unknown' && state(ALL[i].id) !== 'rumour' && state(ALL[i + 1].id) !== 'unknown' && state(ALL[i + 1].id) !== 'rumour';
      g.fillStyle = lit ? '#e8d8a8' : '#56607a';
      for (let k = 1; k < n; k++) g.fillRect(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), 1, 1);
    }
    ALL.forEach((t, i) => {
      const [cx, cy] = pts[i], r = 11, st = state(t.id), known = st === 'here' || st === 'visited';
      for (let dy = -r - 1; dy <= r + 1; dy++)
        for (let dx = -r - 2; dx <= r + 2; dx++) {
          const d = Math.hypot(dx / 1.15, dy), edge = r - 1 + (hash(Math.round(cx + dx), Math.round(cy + dy)) % 3) * 0.6;
          if (d > edge + 1.2) continue;
          g.fillStyle = d > edge ? '#e0cf96' : known ? (dy < -3 ? t.top : t.body) : st === 'rumour' ? '#3a4458' : '#1e2638';
          g.fillRect(Math.round(cx + dx), Math.round(cy + dy), 1, 1);
        }
      if (known)
        t.icon.forEach((row, ry) => [...row].forEach((ch, rx) => {
          if (ch !== '#') return;
          g.fillStyle = ry === 0 ? t.accent : '#140c14';
          g.fillRect(Math.round(cx - 2 + rx), Math.round(cy - 9 + ry), 1, 1);
        }));
    });
    // Names, marks and what's been done, as text over the map (crisp at any size).
    this.labels.innerHTML = ALL.map((t, i) => {
      const r = by.get(t.id), st = state(t.id), [x, y] = NODES[i];
      const name = st === 'unknown' ? '?' : t.name;
      const go = st === 'visited' ? '1' : '0';
      const cls = `wnode ${st}${r?.freed ? ' freed' : ''}`;
      return `<button class="${cls}" data-realm="${t.id}" data-go="${go}" style="left:${x}%;top:${st === 'unknown' ? y - 5 : y + 9}%"${go === '1' ? ` title="Travel to ${t.name}"` : ''}>${st === 'here' ? '<i class="you">&#9660;</i>' : ''}${name}</button>`;
    }).join('');
    const rows = ALL.filter((t) => ['here', 'visited'].includes(state(t.id))).map((t) => {
      const r = by.get(t.id)!;
      return `<div class="wrow${r.state === 'here' ? ' here' : ''}"><b>${t.name}</b><span>${r.freed ? 'Freed' : 'The tyrant stands'} &middot; Moon Shards ${r.shards}/3 &middot; ${r.chests} chest${r.chests === 1 ? '' : 's'} found</span></div>`;
    });
    this.info.innerHTML = rows.join('');
  }
}

/** Realm ids in the prototype's order (the route). */
export const ROUTE = ALL.map((t) => t.id);
