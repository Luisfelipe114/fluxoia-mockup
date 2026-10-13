// Raiz de composição: monta o "backend simulado" (banco, IA, conversor e API) e entrega só a API à interface.
// É o único lugar que conhece todos os componentes; a interface web recebe apenas `api`, `trace` e `settingsStore`.

import { Database } from './db/database.js';
import { Trace } from './util/trace.js';
import { clock } from './util/clock.js';
import { createAIComponent } from './ai/index.js';
import { createLLM } from './ai/llm/index.js';
import { modelToXml, xmlToModel } from './bpmn/converter.js';
import { createApiServer } from './api/server.js';
import { INTERVIEW_SCRIPT } from './reference/seed.js';
import { loadInitial } from './reference/loader.js';
import { SCENARIO_IDS } from './ai/llm/scenarios.js';

export const DEFAULT_SETTINGS = {
  llm: { mode: 'mock', baseUrl: 'http://localhost:11434/v1', model: '', apiKey: '' },
  scenario: 'ok', // como o modelo simulado vai se comportar (ai/llm/scenarios.js)
  maxCorrections: 3, // parâmetro a calibrar na PoC
  latencyScale: 1,
};

export function createSettingsStore({ initial = {}, persist = () => {} } = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...initial, llm: { ...DEFAULT_SETTINGS.llm, ...(initial.llm ?? {}) } };
  clock.scale = settings.latencyScale;
  return {
    get: () => settings,
    set(patch) {
      if (patch.llm) Object.assign(settings.llm, patch.llm);
      if (patch.scenario && SCENARIO_IDS.includes(patch.scenario)) settings.scenario = patch.scenario;
      if (patch.maxCorrections != null) settings.maxCorrections = Math.max(0, Math.min(5, Number(patch.maxCorrections) || 0));
      if (patch.latencyScale != null) { settings.latencyScale = Math.max(0, Number(patch.latencyScale) || 0); clock.scale = settings.latencyScale; }
      persist(settings);
      return settings;
    },
  };
}

/**
 * @param {{storage:any, settingsStore?:any}} opts
 */
export async function createBackend({ storage, settingsStore = createSettingsStore() }) {
  const trace = new Trace();
  const db = new Database(storage, { onStatement: (sql, source) => trace.call(source ?? 'api', 'db', sql) });
  const ai = createAIComponent({ llmProvider: () => createLLM(settingsStore.get()), settings: settingsStore.get, trace });
  const api = createApiServer({ db, ai, converter: { modelToXml, xmlToModel }, trace, roteiro: INTERVIEW_SCRIPT, settingsStore });
  if (!(await db.count('catalogo_setores'))) await loadInitial(db, trace);
  return { db, ai, api, trace, settingsStore };
}
