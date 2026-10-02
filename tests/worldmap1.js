// The pause menu's world map, part 1: write a save where the Keep was freed (two chests, one shard), the
// Sunken Reef visited (one chest) and the knight is now in Whisperwood, and reload into it. (tests/worldmap2.js and 3 follow.)
// Nothing from this session may be written over it on the way out.
window.__game.leaving = true;
localStorage.setItem('realms-save', JSON.stringify({
  v: 2, realm: 'forest', coins: 50, flasks: 3, flasksMax: 3, sword: 0, relics: [], mounts: [], deaths: 0, playTime: 0, kills: 0,
  realms: { castle: { checkpoint: '', chests: ['c_crypt', 'c_camp'], lit: [], read: [], walls: [], shards: ['s_lake'], quests: {}, killed: [], fow: '', flags: { boss: true } },
    aqua: { checkpoint: '', chests: ['r3_neboat'], lit: [], read: [], walls: [], shards: [], quests: {}, killed: [], fow: '', flags: {} } },
}));
sessionStorage.removeItem('test-map');
location.reload();
window.__report = () => ({});
