// Each place's own light, part 3: the Sunken Reef has none of its own (its light is as it was).
const out = { ...JSON.parse(sessionStorage.getItem('test-zone') ?? '{}'), aqua: { realm: window.__game.def.id, zones: !!window.__game.pipe.zone } };
sessionStorage.removeItem('test-zone');
window.__report = () => out;
