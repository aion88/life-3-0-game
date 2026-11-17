import { boot, handlePreloadError, handleStorageEvent } from './main';

const root = document.getElementById('app');
if (!root) throw new Error('#app introuvable');
window.addEventListener('vite:preloadError', handlePreloadError);
window.addEventListener('storage', handleStorageEvent);
boot(root).catch((e: unknown) => { console.error(e); });
