// Top-down debug map: ground types, heights, water, roads, and zone labels.
const g = window.__game;
const grid = g.grid;
const S = 6;
const c = document.createElement('canvas');
c.width = grid.w * S; c.height = grid.d * S;
c.style.cssText = 'position:fixed;left:0;top:0;z-index:99;width:' + grid.w * S + 'px;height:' + grid.d * S + 'px;image-rendering:pixelated;background:#000';
const x2 = c.getContext('2d');
const T = { 0: [70, 110, 60], 12: [55, 95, 50], 1: [120, 95, 60], 2: [200, 170, 110], 3: [160, 150, 160], 4: [150, 145, 165], 5: [180, 170, 130], 6: [140, 100, 60], 7: [60, 60, 60], 8: [70, 100, 60], 9: [120, 115, 110], 10: [120, 115, 130], 11: [150, 40, 50], 13: [80, 60, 40], 14: [120, 115, 125], 15: [230, 235, 245], 16: [100, 80, 50], 17: [90, 110, 60] };
for (let z = grid.oz; z < grid.oz + grid.d; z++)
  for (let x = grid.ox; x < grid.ox + grid.w; x++) {
    const i = grid.i(x, z);
    let col = T[grid.t[i]] || [255, 0, 255];
    const h = grid.h[i];
    const k = Math.max(0.35, Math.min(1.4, 0.75 + h * 0.08));
    col = col.map((v) => v * k);
    if (grid.water[i] > -100) col = grid.isDeep(x, z) ? [30, 50, 110] : [70, 110, 160];
    if (grid.deck[i] > -100) col = [170, 120, 70];
    if (grid.t[i] === 2) col = [230, 200, 120];
    x2.fillStyle = `rgb(${col.map(Math.round).join(',')})`;
    x2.fillRect((x - grid.ox) * S, (z - grid.oz) * S, S, S);
    // Cliff edges: darker where height steps by more than half a unit.
    const hr = grid.inside(x + 1, z) ? grid.h[grid.i(x + 1, z)] : h, hd = grid.inside(x, z + 1) ? grid.h[grid.i(x, z + 1)] : h;
    if (Math.abs(hr - h) > 0.6 && grid.dir[i] < 0) { x2.fillStyle = '#000'; x2.fillRect((x - grid.ox + 1) * S - 1, (z - grid.oz) * S, 2, S); }
    if (Math.abs(hd - h) > 0.6 && grid.dir[i] < 0) { x2.fillStyle = '#000'; x2.fillRect((x - grid.ox) * S, (z - grid.oz + 1) * S - 1, S, 2); }
  }
// The playable edge and labels.
x2.strokeStyle = '#fff'; x2.lineWidth = 1; x2.strokeRect(-grid.ox * S, -grid.oz * S, 120 * S, 120 * S);
x2.font = 'bold 11px sans-serif';
const label = (t, x, z, col = '#fff') => { x2.fillStyle = '#000'; x2.fillText(t, (x - grid.ox) * S + 1, (z - grid.oz) * S + 1); x2.fillStyle = col; x2.fillText(t, (x - grid.ox) * S, (z - grid.oz) * S); };
for (const r of [[10,10]]) void r;
const places = { START: [105, 106], WAYSHRINE: [105.5, 99.5], HOMESTEAD: [87.5, 95], STONES: [111.5, 88], 'RIVER CAMP': [121, 99], VILLAGE: [80, 64], TAVERN: [77, 53], 'WOODS STAIR': [86, 44], CAMP: [95, 27], LODGE: [108.5, 11.5], LOOKOUT: [122, 30.5], 'KNIGHT REST': [70, 20], BAILEY: [56, 20], WINCH: [56.5, 7.5], KEEP: [30, 25], GRAVEYARD: [35, 76], OVERLOOK: [14, 49], 'STAIR FOOT': [6, 58], HOLLOW: [33, 57], WINDMILL: [40.5, 95], FARMHOUSE: [47.5, 97], FORD: [69, 104], PIER: [5, 99.5], ISLAND: [-5, 100], MARSH: [38, 114], 'RAIDED FARM': [82, 116], 'BROKEN BRIDGE': [118, 127] };
for (const [n, [x, z]] of Object.entries(places)) { x2.fillStyle = '#ff3'; x2.fillRect((x - grid.ox) * S - 3, (z - grid.oz) * S - 3, 6, 6); label(n, x + 1, z - 1); }
document.body.appendChild(c);
window.__report = () => 'ok';
