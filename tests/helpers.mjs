import { createBackend, createSettingsStore } from '../js/composition.js';
import { createMemoryAdapter } from '../js/db/storage.js';
import { clock } from '../js/util/clock.js';
import { SAMPLE_ANSWERS } from '../js/reference/seed.js';

/** Backend completo em memória, sem latência artificial. */
export async function makeBackend(settings = {}) {
  clock.scale = 0;
  const settingsStore = createSettingsStore({ initial: { latencyScale: 0, ...settings } });
  const backend = await createBackend({ storage: createMemoryAdapter(), settingsStore });
  const call = async (method, path, opts) => backend.api.request(method, path, opts);
  return { ...backend, call };
}

export async function createProcessWithAnswers(call, answers = SAMPLE_ANSWERS) {
  const created = await call('POST', '/processos', { body: { nome: answers.nome } });
  const id = created.data.id;
  await call('PUT', `/processos/${id}/respostas`, { body: { respostas: answers } });
  return id;
}
