// platforms/platform.js
// Chooses the active provider (perchance | local) and exports it.
// Providers return plain JS data; storage lives elsewhere (Dexie).

import perchance from './perchance.js';
import local from './local.js';

function detectEnv() {
  const qsEnv = new URLSearchParams(location.search).get('env'); // 'perchance' | 'local' | future
  const metaEnv = document.querySelector('meta[name="pw-env"]')?.content;
  const hostIsPerchance = /perchance\.org/i.test(location.host);
  const globalFlag = globalThis.PERCHANCE || globalThis.__PERCHANCE__;
  return (qsEnv || metaEnv || (hostIsPerchance || globalFlag ? 'perchance' : 'local')).toLowerCase();
}

export function createPlatform() {
  switch (detectEnv()) {
    case 'perchance': return perchance;
    case 'local':     return local;
    default:          return local; // safe fallback
  }
}

export const platform = createPlatform();
export default platform;
