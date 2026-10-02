import { Grid } from '../world/grid';
import type { Game } from './game';
import { SERPENT_LIP } from './serpent';

// Dev tool: flood the map from the start the way the knight moves (walk, jump up
// to CLIMB, drop down, jump gaps of up to JUMP_GAP cells, no deep water, no solid
// colliders) and report what he can't reach and anywhere he could slip out of the world.
// With `serpent`, on the Tide Serpent as well: it swims the sea, he gets on and off at its edges.

const CLIMB = 1.5;
/** Below the sea's surface a jump floats higher (1.3 m) and the step-up comes on top. */
const UNDER_CLIMB = 1.7;
/** On the Thornstag: its double leap (2.3 m) plus the step-up at the top (0.45 m). */
export const STAG_CLIMB = 2.75;
const JUMP_CLEAR = 1.1;
/** Cells of gap a running jump clears (PLAYER.jumpSpeed and runSpeed carry him about 3 m). */
const JUMP_GAP = 2;

export interface ReachReport {
  reachable: number;
  unreachable: { what: string; x: number; z: number }[];
  escapes: [number, number][];
  /** How the flood got to a cell, cell by cell from the start, for tracing a breach. */
  route: (x: number, z: number) => [number, number][];
  /** Did the flood reach this cell? */
  reached: (x: number, z: number) => boolean;
  /** Reachable cells the knight can't get back from (to the start): places to be stranded. A few, and how many. */
  traps: [number, number][];
  trapCount: number;
}

function blockedCell(grid: Grid, x: number, z: number, top: number, clearance = JUMP_CLEAR) {
  const cx = x + 0.5, cz = z + 0.5;
  for (const c of grid.collidersNear(cx, cz)) {
    if (!c.on || c.y1 <= top + clearance || c.y0 > top + 1.6) continue;
    // Posts this thin (bridge rails, lamp posts) never fill a cell: the knight walks past them.
    // (Off a bridge's side is deep water or a drop, which ok() already refuses.)
    if (c.kind === 'c' && c.r < 0.25) continue;
    if (c.kind === 'b' ? cx > c.x0 && cx < c.x1 && cz > c.z0 && cz < c.z1 : (cx - c.x) ** 2 + (cz - c.z) ** 2 < (c.r + 0.15) ** 2) return true;
  }
  return false;
}

export function reachability(g: Game, assumeProgress = true, climb = CLIMB, serpent = false): ReachReport {
  const grid = g.grid;
  // What a leap clears: the knight's jump about a metre; the stag's second leap (with its 2.75 m
  // climb) about 2.2 m, over a root, a fence, a table.
  const clearance = climb > 2 ? 2.2 : JUMP_CLEAR;
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

  // A diver (the Sunken Reef's, in the salvager's suit: assumed with the story done) walks into deep water,
  // and below the surface his jump floats higher.
  const sea = g.realm.sea;
  const dives = !!sea && (assumeProgress || g.player.dives);
  const deep = (x: number, z: number) => !dives && grid.isDeep(x, z);
  const climbAt = (h: number) => (dives && sea && h < sea.surface - 1.2 ? Math.max(climb, UNDER_CLIMB) : climb);
  const seen = new Uint8Array(grid.w * grid.d);
  const from = new Int32Array(grid.w * grid.d).fill(-1);
  const top = (x: number, z: number) => grid.cellTop(x, z, x + 0.5, z + 0.5);
  const ok = (x: number, z: number) => {
    if (!grid.inside(x, z)) return false;
    const i = grid.i(x, z);
    if (grid.solid[i] || deep(x, z)) return false;
    const t = top(x, z);
    if (t < g.player.phys.fallY) return false;
    return !blockedCell(grid, x, z, t, clearance);
  };
  // A diver's rides: a column of bubbles takes him from its foot to the ground round its top; a current from where
  // it starts (at its height) to where it ends. Each is a link from some cells to others.
  const links: { from: number[]; to: number[] }[] = [];
  const cellsNear = (x: number, z: number, r: number, want: (t: number) => boolean) => {
    const out: number[] = [];
    for (let cz = Math.floor(z - r); cz <= Math.ceil(z + r); cz++)
      for (let cx = Math.floor(x - r); cx <= Math.ceil(x + r); cx++)
        if (grid.inside(cx, cz) && Math.hypot(cx + 0.5 - x, cz + 0.5 - z) <= r && want(top(cx, cz))) out.push(grid.i(cx, cz));
    return out;
  };
  if (dives && sea) {
    for (const l of sea.lifts ?? []) links.push({ from: cellsNear(l.x, l.z, l.r, (t) => t < l.top), to: cellsNear(l.x, l.z, l.r + 3, (t) => t <= l.top + 0.3 && t > l.top - 3) });
    for (const c of sea.currents ?? []) {
      const [a, n] = [c.pts[0], c.pts[1]], e = c.pts[c.pts.length - 1];
      const sx = a[0] + (n[0] - a[0]) * 0.15, sz = a[1] + (n[1] - a[1]) * 0.15;
      links.push({ from: cellsNear(sx, sz, c.r, (t) => Math.abs(t + 0.9 - c.y) < c.r + 0.6), to: cellsNear(e[0], e[1], 2.5, (t) => t < c.y + 0.5) });
    }
  }
  const sx = Math.floor(g.realm.start.x), sz = Math.floor(g.realm.start.z);
  const q: [number, number][] = [[sx, sz]];
  seen[grid.i(sx, sz)] = 1;
  let count = 0;
  const escapes: [number, number][] = [];
  let cur = -1;
  const reach = (x: number, z: number) => {
    seen[grid.i(x, z)] = 1;
    from[grid.i(x, z)] = cur;
    q.push([x, z]);
  };
  // One cell of the flood: note an escape, walk to the neighbours, jump the gaps.
  const step = (x: number, z: number) => {
    count++;
    cur = grid.i(x, z);
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
        if (edgeH - Math.max(fromH, h) <= climbAt(h)) reach(nx, nz);
      }
      // A running jump carries the knight about three metres on the flat: over a gap of one or
      // two cells (a drop, nothing in the way) to ground no higher than here. Never over deep
      // water: a deep cell stops a body however high it is (Grid.blocks).
      for (let gap = 1; gap <= JUMP_GAP; gap++) {
        const tx = x + dx * (gap + 1), tz = z + dz * (gap + 1);
        if (!grid.inside(tx, tz)) break;
        let over = true;
        for (let k = 1; k <= gap && over; k++) {
          const mx = x + dx * k, mz = z + dz * k;
          over = !deep(mx, mz) && top(mx, mz) < h - 1.2 && !blockedCell(grid, mx, mz, h, clearance);
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
  // Vines: from the foot of a vined face the knight climbs to the ledge above; flood on from there. (And the
  // diver's rides.)
  for (let pass = 0; pass < 6; pass++) {
    let more = false;
    for (const l of links) {
      if (!l.from.some((i) => seen[i])) continue;
      const src = l.from.find((i) => seen[i])!;
      for (const i of l.to) {
        const x = (i % grid.w) + grid.ox, z = Math.floor(i / grid.w) + grid.oz;
        if (seen[i] || !ok(x, z)) continue;
        seen[i] = 1;
        from[i] = src;
        q.push([x, z]);
        more = true;
      }
    }
    for (const v of g.realm.vines ?? []) {
      for (let a = -v.w / 2; a <= v.w / 2; a += 0.5) {
        const fx = v.alongX ? v.x + a : v.x + v.nx * 0.5, fz = v.alongX ? v.z + v.nz * 0.5 : v.z + a;
        const tx = v.alongX ? v.x + a : v.x - v.nx * 0.5, tz = v.alongX ? v.z - v.nz * 0.5 : v.z + a;
        const f = [Math.floor(fx), Math.floor(fz)], t = [Math.floor(tx), Math.floor(tz)];
        if (!grid.inside(f[0], f[1]) || !grid.inside(t[0], t[1]) || !seen[grid.i(f[0], f[1])] || seen[grid.i(t[0], t[1])] || !ok(t[0], t[1])) continue;
        seen[grid.i(t[0], t[1])] = 1;
        from[grid.i(t[0], t[1])] = grid.i(f[0], f[1]);
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
  // On the Tide Serpent: from wherever the knight gets on it (the sea's edge, from ground no higher than
  // SERPENT_LIP above the surface; in the diving suit, anywhere in the sea), it swims through all of that sea
  // inside the map's edges, at any depth and up any reef wall (not past what breaks the surface), and he gets
  // off onto any such edge it touches, or in the suit anywhere in it. Round and round until nothing new.
  const swum = new Uint8Array(grid.w * grid.d);
  if (serpent && sea) {
    const lip = sea.surface + SERPENT_LIP;
    const swim = (x: number, z: number) => x >= 0 && z >= 0 && x < g.realm.w && z < g.realm.d && grid.isDeep(x, z) && !blockedCell(grid, x, z, sea.surface - 0.45, 0);
    const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let more = true; more; ) {
      more = false;
      const sq: [number, number][] = [];
      const enter = (x: number, z: number) => {
        swum[grid.i(x, z)] = 1;
        sq.push([x, z]);
      };
      for (let z = 0; z < g.realm.d; z++)
        for (let x = 0; x < g.realm.w; x++) {
          if (!seen[grid.i(x, z)]) continue;
          if (swim(x, z)) {
            if (!swum[grid.i(x, z)]) enter(x, z);
          } else if (top(x, z) <= lip) for (const [dx, dz] of D4) if (swim(x + dx, z + dz) && !swum[grid.i(x + dx, z + dz)]) enter(x + dx, z + dz);
        }
      while (sq.length) {
        const [x, z] = sq.pop()!;
        if (x - grid.ox < 3 || z - grid.oz < 3 || grid.ox + grid.w - x <= 3 || grid.oz + grid.d - z <= 3) escapes.push([x, z]);
        for (const [dx, dz] of D4) if (swim(x + dx, z + dz) && !swum[grid.i(x + dx, z + dz)]) enter(x + dx, z + dz);
      }
      const off = (x: number, z: number, by: number) => {
        seen[grid.i(x, z)] = 1;
        from[grid.i(x, z)] = by;
        q.push([x, z]);
        more = true;
      };
      for (let z = 0; z < g.realm.d; z++)
        for (let x = 0; x < g.realm.w; x++) {
          const i = grid.i(x, z);
          if (!swum[i]) continue;
          if (dives && !seen[i] && ok(x, z)) off(x, z, i);
          for (const [dx, dz] of D4) {
            const nx = x + dx, nz = z + dz;
            if (grid.inside(nx, nz) && !seen[grid.i(nx, nz)] && !swim(nx, nz) && ok(nx, nz) && top(nx, nz) <= lip) off(nx, nz, i);
          }
        }
      while (q.length) {
        const [x, z] = q.pop()!;
        step(x, z);
      }
    }
  }
  const reachAt = (x: number, z: number, r: number) => {
    for (let dz = -Math.ceil(r); dz <= Math.ceil(r); dz++)
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        const cx = Math.floor(x) + dx, cz = Math.floor(z) + dz;
        if (!grid.inside(cx, cz) || !(seen[grid.i(cx, cz)] || swum[grid.i(cx, cz)])) continue;
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
  // (A way only the Thornstag's leap crosses is looked for on the stag.)
  for (const b of g.realm.borders ?? []) if (!b.leap || climb >= STAG_CLIMB) check(`border:${b.id}`, b.x, b.z, b.r);
  for (const s of g.shards) check(`shard:${s.id}`, s.x, s.z, 0.9);
  // Back again: which reachable cells can return to the start? Flood backward, taking each move the
  // other way (a cell joins when it can move, jump or climb vines to one already in).
  const back = new Uint8Array(grid.w * grid.d);
  const bq: [number, number][] = [[sx, sz]];
  back[grid.i(sx, sz)] = 1;
  const canStep = (ax: number, az: number, dx: number, dz: number) => {
    const edgeH = grid.cellTop(ax + dx, az + dz, ax + 0.5 + dx * 0.5, az + 0.5 + dz * 0.5);
    const fromH = grid.cellTop(ax, az, ax + 0.5 + dx * 0.5, az + 0.5 + dz * 0.5);
    return edgeH - Math.max(fromH, top(ax, az)) <= climbAt(top(ax, az));
  };
  const canJump = (ax: number, az: number, dx: number, dz: number, gap: number) => {
    const h = top(ax, az);
    for (let k = 1; k <= gap; k++) {
      const mx = ax + dx * k, mz = az + dz * k;
      if (!grid.inside(mx, mz) || deep(mx, mz) || top(mx, mz) >= h - 1.2 || blockedCell(grid, mx, mz, h, clearance)) return false;
    }
    return top(ax + dx * (gap + 1), az + dz * (gap + 1)) <= h + 0.3;
  };
  const vineFoot = new Map<number, number[]>(); // top cell -> foot cells
  for (const v of g.realm.vines ?? [])
    for (let a = -v.w / 2; a <= v.w / 2; a += 0.5) {
      const fx = v.alongX ? v.x + a : v.x + v.nx * 0.5, fz = v.alongX ? v.z + v.nz * 0.5 : v.z + a;
      const tx = v.alongX ? v.x + a : v.x - v.nx * 0.5, tz = v.alongX ? v.z - v.nz * 0.5 : v.z + a;
      if (!grid.inside(Math.floor(fx), Math.floor(fz)) || !grid.inside(Math.floor(tx), Math.floor(tz))) continue;
      const t = grid.i(Math.floor(tx), Math.floor(tz));
      vineFoot.set(t, [...(vineFoot.get(t) ?? []), grid.i(Math.floor(fx), Math.floor(fz))]);
    }
  while (bq.length) {
    const [bx, bz] = bq.pop()!;
    const join = (ax: number, az: number) => {
      const j = grid.i(ax, az);
      if (back[j] || !seen[j]) return;
      back[j] = 1;
      bq.push([ax, az]);
    };
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      // A neighbour that can step here; a cell two or three away that can jump here.
      const ax = bx - dx, az = bz - dz;
      if (grid.inside(ax, az) && ok(ax, az) && canStep(ax, az, dx, dz)) join(ax, az);
      for (let gap = 1; gap <= JUMP_GAP; gap++) {
        const jx = bx - dx * (gap + 1), jz = bz - dz * (gap + 1);
        if (grid.inside(jx, jz) && ok(jx, jz) && canJump(jx, jz, dx, dz, gap)) join(jx, jz);
      }
    }
    for (const f of vineFoot.get(grid.i(bx, bz)) ?? []) join((f % grid.w) + grid.ox, Math.floor(f / grid.w) + grid.oz);
    // A ride whose end is on the way back takes its start back too.
    if (!bq.length)
      for (const l of links)
        if (l.to.some((i) => back[i])) for (const f of l.from) join((f % grid.w) + grid.ox, Math.floor(f / grid.w) + grid.oz);
  }
  const traps: [number, number][] = [];
  let trapCount = 0;
  for (let i = 0; i < seen.length; i++)
    if (seen[i] && !back[i]) {
      trapCount++;
      const x = (i % grid.w) + grid.ox, z = Math.floor(i / grid.w) + grid.oz;
      if (!traps.some(([tx, tz]) => Math.abs(tx - x) + Math.abs(tz - z) < 6)) traps.push([x, z]);
    }
  for (const f of restore) f();
  const route = (x: number, z: number) => {
    const out: [number, number][] = [];
    for (let i = grid.i(Math.floor(x), Math.floor(z)), n = 0; i >= 0 && n < 20000; i = from[i], n++) out.push([(i % grid.w) + grid.ox, Math.floor(i / grid.w) + grid.oz]);
    return out.reverse();
  };
  const reached = (x: number, z: number) => grid.inside(Math.floor(x), Math.floor(z)) && seen[grid.i(Math.floor(x), Math.floor(z))] === 1;
  return { reachable: count, unreachable, escapes: escapes.slice(0, 20), route, reached, traps: traps.slice(0, 20), trapCount };
}
