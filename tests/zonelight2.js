// Each place's own light, part 2 (Whisperwood): the mist by place: thin over the village and the water, thick
// only in the Deep Wood, the Mossfen and Rookfall; then on to the Sunken Reef.
(() => {
  const g = window.__game, z = g.pipe.zone;
  const out = JSON.parse(sessionStorage.getItem('test-zone') ?? '{}');
  out.forest = { realm: g.def.id, zones: !!z };
  if (z) {
    const at = (tex, x, zz) => {
      const n = tex.image.width, d = tex.image.data;
      const i = (Math.floor(((zz - z.z) / z.size) * n) * n + Math.floor(((x - z.x) / z.size) * n)) * 4;
      return +(d[i + 3] / 64).toFixed(2);
    };
    const region = (x, zz) => g.realm.regions.find((r) => r.test(x, zz, g.grid.groundAt(x, zz) + 0.1))?.name;
    const P = { hollowbough: [59, 81], blackwater: [60, 43], deepWood: [20, 80], mossfen: [18, 105], rookfall: [97, 32] };
    for (const [k, [x, zz]] of Object.entries(P)) out.forest[k] = { place: region(x, zz), mist: at(z.night, x, zz), dawnMist: at(z.dawn, x, zz) };
  }
  sessionStorage.setItem('test-zone', JSON.stringify(out));
  window.__game.leaving = true;
  location.search = '?shot&play&realm=aqua';
  window.__report = () => out;
})();
