// Each place's own light, part 1 (the Moonlit Keep): the light map exists, and its places each cast their own
// shade (Keepsfoot warm amber, the keep indigo, Blackpine green-black, the barrows violet, the hall ember-red),
// blended over a few metres at their edges; at dawn the keep's stone turns rose-gold. Then on to Whisperwood
// (tests/zonelight2.js and 3 follow).
(() => {
  const g = window.__game, z = g.pipe.zone;
  const at = (tex, x, zz) => {
    const n = tex.image.width, d = tex.image.data;
    const tx = Math.floor(((x - z.x) / z.size) * n), tz = Math.floor(((zz - z.z) / z.size) * n);
    const i = (tz * n + tx) * 4;
    return { r: +(d[i] / 128).toFixed(2), g: +(d[i + 1] / 128).toFixed(2), b: +(d[i + 2] / 128).toFixed(2), mist: +(d[i + 3] / 64).toFixed(2) };
  };
  const out = { castle: { zones: !!z } };
  if (z) {
    const P = { keepsfoot: [80, 62], keep: [30, 32], blackpine: [96, 28], barrows: [26, 80], hall: [25, 18], fields: [96, 82], mirrormere: [6, 96] };
    for (const [k, [x, zz]] of Object.entries(P)) out.castle[k] = at(z.night, x, zz);
    out.castle.keepDawn = at(z.dawn, 30, 32);
    const c = out.castle;
    out.castle.reads = {
      keepsfootAmber: c.keepsfoot.r > c.keepsfoot.b, keepIndigo: c.keep.b > c.keep.r, blackpineGreen: c.blackpine.g > c.blackpine.r && c.blackpine.g > 0.9 && c.blackpine.r < 0.9,
      barrowsViolet: c.barrows.b > c.barrows.g && c.barrows.r > c.barrows.g, hallEmber: c.hall.r > c.hall.b, keepRoseGoldAtDawn: c.keepDawn.r > c.keepDawn.b,
    };
    // Across Keepsfoot's southern edge into the fields, a metre at a time: the light changes in small steps.
    const line = [];
    for (let k = 0; k <= 14; k++) line.push(at(z.night, 80, 72 + k));
    let step = 0;
    for (let k = 1; k < line.length; k++) step = Math.max(step, Math.abs(line[k].b - line[k - 1].b));
    out.castle.edge = { from: line[0], to: line[line.length - 1], biggestStep: +step.toFixed(3) };
  }
  sessionStorage.setItem('test-zone', JSON.stringify(out));
  window.__game.leaving = true;
  location.search = '?shot&play&realm=forest';
  window.__report = () => out;
})();
