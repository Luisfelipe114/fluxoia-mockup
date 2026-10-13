// Componente de IA: fachada pública. É o único módulo que o resto do sistema importa de `ai/`.
import { assertRequest } from './contract.js';
import { createOrchestrator } from './orchestrator.js';
import { verifyModel } from './verifier.js';

/**
 * @param {{llmProvider:()=>any, settings:()=>any, trace:import('../util/trace.js').Trace}} deps
 */
export function createAIComponent(deps) {
  const orchestrator = createOrchestrator(deps);
  return {
    /** Contrato: gerar ou ajustar. */
    async run(req) {
      assertRequest(req);
      return orchestrator.run(req);
    },
    /** Verificação estrutural, exposta para a API checar o rascunho antes do envio à validação. */
    verify(model, catalogo = null) {
      return verifyModel(model, catalogo);
    },
  };
}

export { CONTRACT_DOC } from './contract.js';
