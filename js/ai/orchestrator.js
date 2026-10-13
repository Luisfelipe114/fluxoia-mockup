// Orquestração de IA: monta o prompt, chama o servidor de LLM com o esquema JSON,
// faz a verificação estrutural e, se houver problemas, pede correção (até `maxCorrections` vezes).

import { buildPrompt, buildCorrectionMessage, PROMPT_VERSION } from './prompt.js';
import { MODEL_SCHEMA, PATCH_SCHEMA } from './schema.js';
import { normalizeModel } from '../domain/model.js';
import { verifyModel } from './verifier.js';
import { applyPatch } from './patch.js';

const parseJson = (raw) => JSON.parse(String(raw).trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));

/**
 * @param {{llmProvider:()=>any, settings:()=>any, trace:import('../util/trace.js').Trace}} deps
 */
export function createOrchestrator({ llmProvider, settings, trace }) {
  async function run(req) {
    const t0 = Date.now();
    const llm = llmProvider();
    const { maxCorrections, scenario } = settings();
    const catalogo = req.contexto.catalogo ?? null;

    trace.call('ai', 'orchestrator', `monta o prompt (${req.mode})`);
    const prompt = buildPrompt({ ...req, roteiro: req.contexto.roteiro });
    trace.info('orchestrator', `${PROMPT_VERSION}: ${prompt.tokens} tokens estimados`, { sections: prompt.sections.map((s) => ({ id: s.id, tokens: s.tokens })) });

    const schema = req.mode === 'gerar' ? MODEL_SCHEMA : PATCH_SCHEMA;
    let messages = prompt.messages;
    let attempt = 0, errors = [], warnings = [], candidate = null, mensagem = '', changed = true, ops = [];

    for (;;) {
      trace.call('orchestrator', 'llm', attempt === 0 ? 'completar com esquema JSON' : `corrigir (tentativa ${attempt + 1})`, { modelo: llm.name });
      let raw;
      try {
        raw = await llm.complete({
          messages, schema,
          input: { mode: req.mode, respostas: req.respostas, catalogo, attempt, errors, scenario, modeloAtual: req.modeloAtual, pedido: req.pedido },
        });
      } catch (e) {
        trace.error('llm', 'orchestrator', e.message);
        throw new Error(`Servidor de LLM indisponível: ${e.message}`);
      }
      trace.reply('llm', 'orchestrator', `${String(raw).length} caracteres de JSON`);

      let parsed = null;
      try { parsed = parseJson(raw); } catch { parsed = null; }

      if (!parsed) {
        errors = ['A resposta do modelo não é um JSON válido.'];
      } else if (req.mode === 'gerar') {
        candidate = normalizeModel(parsed, req.respostas?.nome);
        ({ errors, warnings } = verifyModel(candidate, catalogo));
      } else {
        ops = Array.isArray(parsed.ops) ? parsed.ops : [];
        mensagem = String(parsed.mensagem ?? '');
        if (!ops.length) { candidate = req.modeloAtual; errors = []; changed = false; break; }
        const res = applyPatch(req.modeloAtual, ops);
        candidate = res.model;
        const v = verifyModel(candidate, catalogo);
        errors = [...res.errors, ...v.errors];
        warnings = v.warnings;
      }
      trace.info('orchestrator', `verificação estrutural: ${errors.length} problema(s)`, { errors });
      if (!errors.length || attempt >= maxCorrections) break;
      messages = [...messages, { role: 'assistant', content: String(raw) }, { role: 'user', content: buildCorrectionMessage(errors) }];
      attempt++;
    }

    return {
      ok: errors.length === 0,
      modelo: candidate,
      erros: errors,
      avisos: warnings,
      mensagem,
      mudou: changed,
      ops,
      meta: {
        modelo: llm.name, promptVersion: prompt.version, tentativas: attempt + 1, correcoes: attempt,
        duracaoMs: Date.now() - t0, tokensPrompt: prompt.tokens, prompt: prompt.sections,
      },
    };
  }
  return { run };
}
