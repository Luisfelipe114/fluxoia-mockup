// Ponto de entrada: monta o backend simulado (composition.js) e inicia a interface web.
import { createBackend, createSettingsStore } from './composition.js';
import { createLocalStorageAdapter } from './db/storage.js';
import { loadVendors } from './web/vendor.js';
import { startWeb } from './web/app.js';

const settingsAdapter = createLocalStorageAdapter('fluxoia:settings:v1');
const settingsStore = createSettingsStore({ initial: settingsAdapter.load() ?? {}, persist: (s) => settingsAdapter.save(s) });

try {
  const backend = await createBackend({ storage: createLocalStorageAdapter('fluxoia:db:v1'), settingsStore });
  await loadVendors();
  startWeb({ api: backend.api, trace: backend.trace });
  // Alça de depuração: no console, __fluxoia.trace.items mostra o rastro de chamadas.
  window.__fluxoia = { api: backend.api, trace: backend.trace, db: backend.db };
} catch (e) {
  console.error(e);
  document.getElementById('app').innerHTML = `<div style="padding:24px;font-family:sans-serif"><h1>Não foi possível iniciar</h1><p>${String(e.message).replace(/</g, '&lt;')}</p><p>Se você abriu o arquivo direto (file://), sirva a pasta por HTTP: <code>python3 -m http.server 8080</code>.</p></div>`;
}
