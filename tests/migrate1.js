// Session 1: write a version-1 save (realm 1 only, from before several realms), then reload.
// tests/migrate2.js checks what the game made of it (runner: AFTER=tests/migrate2.js).
const g = window.__game;
g.fow.reveal(70, 20, 17);
const v1 = {
  v: 1,
  // The tavern hearth: no foe nearby (at Knight's Rest a thief bat can take coins before the check).
  checkpoint: 'hearth',
  coins: 321,
  flasksMax: 5,
  sword: 2,
  chests: ['c_crypt', 'c_camp'],
  lit: ['wayshrine', 'rest'],
  read: ['lore1'],
  rescued: true,
  bridge: true,
  courtyard: true,
  boss: false,
  deaths: 4,
  playTime: 1234,
  fow: g.fow.serialize(),
  walls: ['w_cave'],
  shards: ['s_lake', 's_cave'],
  relic: true,
  quests: { main: 4, tam: 2, stones: 1, shards: 0, farm: 2 },
  killed: [0, 1, 2, 3],
  kills: 57,
};
// Nothing from this session may be written over it on the way out.
g.leaving = true;
localStorage.setItem('realms-save', JSON.stringify(v1));
sessionStorage.setItem('test-v1', JSON.stringify(v1));
setTimeout(() => location.reload(), 300);
