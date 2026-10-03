// The places' own sounds (a realm's `sounds`, src/world/realm.ts): how loud each place's bed is where the knight
// stands, worked out four times a second and handed to the audio (src/audio/lands.ts plays them), and the
// animals calling from their patches now and then, each from where it is.
import type { PlaceSound } from '../audio/lands';
import { insidePoly, type Pt } from '../world/paint';
import type { SoundSpot } from '../world/realm';
import type { Game } from './game';

/** The nearest point on a line to (x, z), and how far it is. */
function nearest(pts: Pt[], x: number, z: number): [number, number, number] {
  let best: [number, number, number] = [pts[0][0], pts[0][1], Infinity];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    const k = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
    const px = ax + dx * k, pz = az + dz * k, d = Math.hypot(x - px, z - pz);
    if (d < best[2]) best = [px, pz, d];
  }
  return best;
}

export class PlaceSounds {
  /** The beds as heard now. */
  heard: PlaceSound[] = [];
  private wait: number[];

  constructor(readonly spots: SoundSpot[]) {
    this.wait = spots.map(() => 1 + Math.random() * 3);
  }

  /** How loud a place is where the knight stands (0 when it isn't heard), where it comes from, and whether he's
   *  inside its room. */
  private hearOne(s: SoundSpot, g: Game): PlaceSound | null {
    const p = g.player, flags = g.save.data.flags, amb = g.region?.amb ?? 'road';
    if ((s.flag && !flags[s.flag]) || (s.unless && flags[s.unless]) || (s.amb && !s.amb.includes(amb))) return null;
    let v = s.v ?? 1;
    if (s.when === 'night') v *= 1 - g.dawn;
    else if (s.when === 'dawn') v *= g.dawn;
    let x = p.x, z = p.z, d = 0;
    if (s.pts) [x, z, d] = nearest(s.pts, p.x, p.z);
    else if (s.poly) {
      if (!insidePoly(s.poly, p.x, p.z)) [x, z, d] = nearest([...s.poly, s.poly[0]], p.x, p.z);
    } else if (s.x !== undefined && s.z !== undefined) {
      x = s.x;
      z = s.z;
      d = Math.hypot(p.x - x, p.z - z);
    }
    const indoor = amb === 'indoor' || amb === 'cave';
    const inside = s.region ? g.region?.name === s.region : s.room !== undefined && indoor && d < s.room;
    const r = s.r ?? 20, near = r * 0.25;
    let f = inside || d <= near ? 1 : Math.max(0, 1 - (d - near) / (r - near)) ** 2;
    // (A room heard from outside comes through its walls; from inside a room the land outside is faint.)
    if (!inside && (s.region || s.room !== undefined)) f *= 0.8;
    else if (!inside && indoor) f *= 0.3;
    v *= f;
    if (v < 0.01) return null;
    return { kind: s.kind as PlaceSound['kind'], v, x: inside ? p.x : x, z: inside ? p.z : z, inside, pitch: s.pitch };
  }

  /** Every quarter second: the beds' levels. */
  hear(g: Game) {
    this.heard = [];
    for (const s of this.spots) {
      if (s.kind === 'call') continue;
      const h = this.hearOne(s, g);
      if (h) this.heard.push(h);
    }
  }

  /** Every frame: the animals' calls, each from somewhere in its patch (out of earshot, or indoors, none). */
  update(dt: number, g: Game) {
    const amb = g.region?.amb;
    for (let i = 0; i < this.spots.length; i++) {
      const s = this.spots[i];
      if (s.kind !== 'call' || (this.wait[i] -= dt) > 0) continue;
      this.wait[i] = (s.every ?? 10) * (0.5 + Math.random());
      if (amb === 'indoor' || amb === 'cave' || !s.voice || !this.hearOne(s, g)) continue;
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * (s.area ?? 3);
      g.audio.sfx(s.voice, (s.x ?? g.player.x) + Math.cos(a) * rr, (s.z ?? g.player.z) + Math.sin(a) * rr);
    }
  }
}
