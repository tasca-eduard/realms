import { Game } from './game/game';
import { loadAssets } from './game/assets';

async function main() {
  const view = document.getElementById('view')!;
  const ui = document.getElementById('ui')!;
  const assets = await loadAssets();
  const game = new Game(assets, view, ui);
  // Browsers only allow sound after a gesture.
  const unlock = () => game.audio.unlock();
  window.addEventListener('keydown', unlock);
  window.addEventListener('mousedown', unlock);
  window.addEventListener('touchstart', unlock);
  game.start();
  (window as unknown as { __ready: boolean }).__ready = true;
}

main().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f88;position:fixed;top:0;left:0;padding:12px">${String(e?.stack ?? e)}</pre>`);
});
