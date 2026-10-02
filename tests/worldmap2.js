// World map, part 2 (in Whisperwood): pause; the Keep is visited and freed (its stats listed),
// Whisperwood is where the knight is, the Sunken Reef visited (its stats listed), the Scorched Dunes a
// rumour, the rest unknown; clicking the
// Keep on the map travels there.
const g = window.__game;
g.setPaused(true);
const nodes = [...document.querySelectorAll('#pause .wnode')].map((b) => [b.dataset.realm, b.className.replace('wnode ', ''), b.textContent]);
const rows = [...document.querySelectorAll('#pause .wrow')].map((r) => r.textContent);
const canvas = document.querySelector('#pause .warea canvas');
sessionStorage.setItem('test-map', JSON.stringify({ realm: g.def.id, nodes, rows, canvas: !!canvas && canvas.width === 160 }));
setTimeout(() => document.querySelector('#pause .wnode[data-realm="castle"]').click(), 400);
window.__report = () => JSON.parse(sessionStorage.getItem('test-map'));
