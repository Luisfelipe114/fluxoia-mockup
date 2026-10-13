// API backend (simulada): roteia as chamadas da interface web para os serviços.
// Em produção seria um servidor FastAPI; aqui é um objeto com `request(...)`, e a interface web
// só conversa com ele por este método (nunca importa banco, IA ou conversor diretamente).

import { Router } from './router.js';
import { HttpError } from './errors.js';
import { clock } from '../util/clock.js';
import { createProcessService } from './services/process.service.js';
import { registerProcessRoutes } from './routes/processos.js';
import { registerSystemRoutes } from './routes/sistema.js';

/**
 * @param {{db:any, ai:any, converter:{modelToXml:Function, xmlToModel:Function}, trace:any, roteiro:any, settingsStore:{get:Function,set:Function}}} deps
 */
export function createApiServer(deps) {
  const { trace } = deps;
  const router = new Router();
  const processService = createProcessService({ ...deps, settings: deps.settingsStore.get });
  registerProcessRoutes(router, processService);
  registerSystemRoutes(router, deps);

  /**
   * @returns {Promise<{status:number, data?:any, error?:string, extra?:any}>}
   */
  async function request(method, path, { body, role = 'servidor' } = {}) {
    trace.call('web', 'api', `${method} ${path}`, { role });
    await clock.jitter(30, 90);
    const route = router.match(method, path.split('?')[0]);
    if (!route) {
      trace.error('api', 'web', `404 ${path}`);
      return { status: 404, error: `Rota inexistente: ${method} ${path}` };
    }
    try {
      const data = await route.handler({ params: route.params, body, role });
      trace.reply('api', 'web', '200 OK');
      return { status: 200, data };
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      trace.error('api', 'web', `${status} ${e.message}`);
      return { status, error: e.message, extra: e.extra };
    }
  }

  return { request };
}
