import { Grid } from '../world/grid';
import type { Game } from './game';

// Dev tool: flood the map from the start the way the knight moves (walk,
// jump up to CLIMB, drop down, no deep water, no solid colliders) and report
// what he can't reach and anywhere he could slip out of the world.

const CLIMB = 1.5;
const JUMP_CLEAR = 1.1;

export interface ReachReport {
  reachable: number;
  unreachable: { what: string; x: number; z: number }[];
  escapes: [number, number][];
}

function blockedCell(grid: Grid, x: number, z: number, top: number) {
  const cx = x + 0.5, cz = z + 0.5;
  for (const c of grid.collidersNear(cx, cz)) {
    if (!c.on || c.y1 <= top + JUMP_CLEAR || c.y0 > top + 1.6) continue;
    if (c.kind === 'b' ? cx > c.x0 && cx < c.x1 && cz > c.z0 && cz < c.z1 : (cx - c.x) ** 2 + (cz - c.z) ** 2 < (c.r + 0.15) ** 2) return true;
  }
  return false;
}

export function reachability(g: Game, assumeProgress = true): ReachReport {
  const grid = g.grid;
  // Assume the story is done: drawbridge down, hall open, cage broken.
  const restore: (() => void)[] = [];
  if (assumeProgress && !g.bridge.down) {
    const saved = new Map<number, number>();
    for (let z = g.bridge.z0; z < g.bridge.z1; z++)
      for (let x = g.bridge.x0; x < g.bridge.x1; x++) {
        const i = grid.i(x, z);
        saved.set(i, grid.deck[i]);
        grid.deck[i] = g.bridge.deck;
      }
    const col = g.bridge.collider.on;
    g.bridge.collider.on = false;
    restore.push(() => {
      for (const [i, v] of saved) grid.deck[i] = v;
      g.bridge.collider.on = col;
    });
  }
  for (const c of assumeProgress ? [g.hallDoor.collider, g.cage.collider, ...g.crackedWalls.map((w) => w.collider)] : []) {
    const was = c.on;
    c.on = false;
    restore.push(() => (c.on = was));
  }

  const seen = new Uint8Array(grid.w * grid.d);
  const top = (x: number, z: number) => grid.cellTop(x, z, x + 0.5, z + 0.5);
  const ok = (x: number, z: number) => {
    if (!grid.inside(x, z)) return false;
    const i = grid.i(x, z);
    if (grid.solid[i] || grid.isDeep(x, z)) return false;
    const t = top(x, z);
    if (t < -7) return false;
    return !blockedCell(grid, x, z, t);
  };
  const sx = Math.floor(g.realm.start.x), sz = Math.floor(g.realm.start.z);
  const q: [number, number][] = [[sx, sz]];
  seen[grid.i(sx, sz)] = 1;
  let count = 0;
  const escapes: [number, number][] = [];
  while (q.length) {
    const [x, z] = q.pop()!;
    count++;
    if (x - grid.ox < 3 || z - grid.oz < 3 || grid.ox + grid.w - x <= 3 || grid.oz + grid.d - z <= 3) escapes.push([x, z]);
    const h = top(x, z);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (!grid.inside(nx, nz)) continue;
      const j = grid.i(nx, nz);
      if (seen[j] || !ok(nx, nz)) continue;
      // Ramps and stairs: compare the heights where the two cells meet.
      const edgeH = grid.cellTop(nx, nz, x + 0.5 + dx * 0.5, z + 0.5 + dz * 0.5);
      const fromH = grid.cellTop(x, z, x + 0.5 + dx * 0.5, z + 0.5 + dz * 0.5);
      if (edgeH - Math.max(fromH, h) > CLIMB) continue;
      seen[j] = 1;
      q.push([nx, nz]);
    }
  }
  const reachAt = (x: number, z: number, r: number) => {
    for (let dz = -Math.ceil(r); dz <= Math.ceil(r); dz++)
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        const cx = Math.floor(x) + dx, cz = Math.floor(z) + dz;
        if (!grid.inside(cx, cz) || !seen[grid.i(cx, cz)]) continue;
        if (Math.hypot(cx + 0.5 - x, cz + 0.5 - z) <= r + 0.7) return true;
      }
    return false;
  };
  const unreachable: ReachReport['unreachable'] = [];
  const check = (what: string, x: number, z: number, r: number) => {
    if (!reachAt(x, z, r)) unreachable.push({ what, x: +x.toFixed(1), z: +z.toFixed(1) });
  };
  for (const it of g.interactables) check((it as { id?: string; def?: { id: string } }).id ?? (it as { def?: { id: string } }).def?.id ?? it.constructor.name, it.x, it.z, it.radius);
  for (const e of g.enemies) if (!e.flying) check(`enemy:${e.type}`, e.home.x, e.home.z, 2);
  for (const b of g.breakables) check(`breakable:${b.what}`, b.x, b.z, 1.4);
  check('cage', g.cage.x, g.cage.z, 1.8);
  for (const s of g.shards) check(`shard:${s.id}`, s.x, s.z, 0.9);
  for (const f of restore) f();
  return { reachable: count, unreachable, escapes: escapes.slice(0, 20) };
}
