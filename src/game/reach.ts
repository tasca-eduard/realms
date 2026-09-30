import { Grid } from '../world/grid';
import type { Game } from './game';

// Dev tool: flood the map from the start the way the knight moves (walk, jump up
// to CLIMB, drop down, jump gaps of up to JUMP_GAP cells, no deep water, no solid
// colliders) and report what he can't reach and anywhere he could slip out of the world.

const CLIMB = 1.5;
const JUMP_CLEAR = 1.1;
/** Cells of gap a running jump clears (PLAYER.jumpSpeed and runSpeed carry him about 3 m). */
const JUMP_GAP = 2;

export interface ReachReport {
  reachable: number;
  unreachable: { what: string; x: number; z: number }[];
  escapes: [number, number][];
}

function blockedCell(grid: Grid, x: number, z: number, top: number) {
  const cx = x + 0.5, cz = z + 0.5;
  for (const c of grid.collidersNear(cx, cz)) {
    if (!c.on || c.y1 <= top + JUMP_CLEAR || c.y0 > top + 1.6) continue;
    // Posts this thin (bridge rails, lamp posts) never fill a cell: the knight walks past them.
    // (Off a bridge's side is deep water or a drop, which ok() already refuses.)
    if (c.kind === 'c' && c.r < 0.25) continue;
    if (c.kind === 'b' ? cx > c.x0 && cx < c.x1 && cz > c.z0 && cz < c.z1 : (cx - c.x) ** 2 + (cz - c.z) ** 2 < (c.r + 0.15) ** 2) return true;
  }
  return false;
}

export function reachability(g: Game, assumeProgress = true): ReachReport {
  const grid = g.grid;
  // Assume the story is done: drawbridge down, hall open, cage broken, walls smashed.
  const restore: (() => void)[] = [];
  const bridge = g.bridge;
  if (assumeProgress && bridge && !bridge.down) {
    const saved = new Map<number, number>();
    for (let z = bridge.z0; z < bridge.z1; z++)
      for (let x = bridge.x0; x < bridge.x1; x++) {
        const i = grid.i(x, z);
        saved.set(i, grid.deck[i]);
        grid.deck[i] = bridge.deck;
      }
    const col = bridge.collider.on;
    bridge.collider.on = false;
    restore.push(() => {
      for (const [i, v] of saved) grid.deck[i] = v;
      bridge.collider.on = col;
    });
  }
  for (const c of assumeProgress ? [g.hallDoor?.collider, g.thornWall?.collider, g.cage?.collider, ...g.crackedWalls.map((w) => w.collider), ...g.hedges.map((h) => h.collider)] : []) {
    if (!c) continue;
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
  const reach = (x: number, z: number) => {
    seen[grid.i(x, z)] = 1;
    q.push([x, z]);
  };
  // One cell of the flood: note an escape, walk to the neighbours, jump the gaps.
  const step = (x: number, z: number) => {
    count++;
    if (x - grid.ox < 3 || z - grid.oz < 3 || grid.ox + grid.w - x <= 3 || grid.oz + grid.d - z <= 3) escapes.push([x, z]);
    const h = top(x, z);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (!grid.inside(nx, nz)) continue;
      const j = grid.i(nx, nz);
      if (!seen[j] && ok(nx, nz)) {
        // Ramps and stairs: compare the heights where the two cells meet.
        const edgeH = grid.cellTop(nx, nz, x + 0.5 + dx * 0.5, z + 0.5 + dz * 0.5);
        const fromH = grid.cellTop(x, z, x + 0.5 + dx * 0.5, z + 0.5 + dz * 0.5);
        if (edgeH - Math.max(fromH, h) <= CLIMB) reach(nx, nz);
      }
      // A running jump carries the knight about three metres on the flat: over a gap of one or
      // two cells (a drop or deep water, nothing in the way) to ground no higher than here.
      for (let gap = 1; gap <= JUMP_GAP; gap++) {
        const tx = x + dx * (gap + 1), tz = z + dz * (gap + 1);
        if (!grid.inside(tx, tz)) break;
        let over = true;
        for (let k = 1; k <= gap && over; k++) {
          const mx = x + dx * k, mz = z + dz * k;
          over = (grid.isDeep(mx, mz) || top(mx, mz) < h - 1.2) && !blockedCell(grid, mx, mz, h);
        }
        if (!over) break;
        if (!seen[grid.i(tx, tz)] && ok(tx, tz) && top(tx, tz) <= h + 0.3) reach(tx, tz);
      }
    }
  };
  while (q.length) {
    const [x, z] = q.pop()!;
    step(x, z);
  }
  // Vines: from the foot of a vined face the knight climbs to the ledge above; flood on from there.
  for (let pass = 0; pass < 3; pass++) {
    let more = false;
    for (const v of g.realm.vines ?? []) {
      for (let a = -v.w / 2; a <= v.w / 2; a += 0.5) {
        const fx = v.alongX ? v.x + a : v.x + v.nx * 0.5, fz = v.alongX ? v.z + v.nz * 0.5 : v.z + a;
        const tx = v.alongX ? v.x + a : v.x - v.nx * 0.5, tz = v.alongX ? v.z - v.nz * 0.5 : v.z + a;
        const f = [Math.floor(fx), Math.floor(fz)], t = [Math.floor(tx), Math.floor(tz)];
        if (!grid.inside(f[0], f[1]) || !grid.inside(t[0], t[1]) || !seen[grid.i(f[0], f[1])] || seen[grid.i(t[0], t[1])] || !ok(t[0], t[1])) continue;
        seen[grid.i(t[0], t[1])] = 1;
        q.push([t[0], t[1]]);
        more = true;
      }
    }
    if (!more) break;
    while (q.length) {
      const [x, z] = q.pop()!;
      step(x, z);
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
  if (g.cage) check('cage', g.cage.x, g.cage.z, 1.8);
  for (const b of g.realm.borders ?? []) check(`border:${b.id}`, b.x, b.z, b.r);
  for (const s of g.shards) check(`shard:${s.id}`, s.x, s.z, 0.9);
  for (const f of restore) f();
  return { reachable: count, unreachable, escapes: escapes.slice(0, 20) };
}
