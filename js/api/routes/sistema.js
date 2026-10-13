// Rotas de apoio da simulação: roteiro e entrevistas de exemplo, cenário do modelo e reinício da demonstração.
import { loadInitial } from '../../reference/loader.js';
import { SAMPLES } from '../../reference/seed.js';
import { SCENARIOS } from '../../ai/llm/scenarios.js';

export function registerSystemRoutes(router, { db, trace, roteiro, settingsStore }) {
  router.add('GET', '/roteiro', () => ({ roteiro, exemplos: SAMPLES }));
  router.add('GET', '/config', () => ({ ...settingsStore.get(), cenarios: SCENARIOS }));
  router.add('PUT', '/config', ({ body }) => ({ ...settingsStore.set(body ?? {}), cenarios: SCENARIOS }));
  router.add('POST', '/demo/reiniciar', async () => {
    db.reset();
    await loadInitial(db, trace);
    return { ok: true };
  });
}
