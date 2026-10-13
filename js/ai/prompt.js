// Montagem do prompt. Ordem fixa, com o trecho estável primeiro (aproveita cache de prefixo do servidor de LLM).
import { MODEL_SCHEMA, PATCH_SCHEMA } from './schema.js';
import { estimateTokens } from '../util/text.js';

export const PROMPT_VERSION = 'prompt-v1';

const RULES_GERAR = `Você é analista de processos de uma secretaria pública brasileira. A partir da entrevista com um servidor, monte o modelo do processo para virar um diagrama BPMN com uma raia por setor.
Regras:
- Use somente o que está na entrevista. Não invente etapas, setores, documentos, sistemas, taxas ou prazos.
- Exatamente um elemento "inicio" e pelo menos um "fim".
- "tarefa": ação com verbo no infinitivo, no máximo 6 palavras.
- "decisao": pergunta curta terminada em "?", com pelo menos duas saídas em "fluxos", cada uma com "condicao" (ex.: "Sim", "Não").
- Todo elemento tem "setor" igual a um id de "setores". Setores são unidades, nunca nomes de pessoas.
- Todo elemento é alcançável a partir do início e leva a algum fim. Retornos (laços) são permitidos.
- "origem": trecho curto copiado da entrevista que justifica o elemento.
- Prefira os nomes do catálogo institucional quando aplicável.
- Responda apenas com JSON, no esquema fornecido.`;

const RULES_AJUSTAR = `Você ajusta o modelo de um processo a partir de um pedido do servidor.
Responda apenas com uma lista de operações ("ops") no esquema fornecido. Aplique somente o que foi pedido e não altere o resto.
Operações: setSector, rename, addAfter, remove.`;

function fmtCatalogo(c) {
  const lines = [];
  if (c.setores?.length) lines.push('Setores: ' + c.setores.map((x) => x.nome).join('; '));
  if (c.sistemas?.length) lines.push('Sistemas: ' + c.sistemas.map((x) => x.nome).join('; '));
  if (c.taxas?.length) lines.push('Taxas: ' + c.taxas.map((x) => `${x.nome} (${x.codigo ?? 's/ código'})`).join('; '));
  if (c.documentos?.length) lines.push('Documentos: ' + c.documentos.map((x) => x.nome).join('; '));
  return lines.join('\n') || '(nenhum trecho relevante)';
}

/**
 * @returns {{messages:{role:string,content:string}[], sections:{id:string,title:string,text:string,tokens:number}[], tokens:number, version:string}}
 */
export function buildPrompt({ mode, respostas, contexto, modeloAtual, pedido, roteiro }) {
  const sections = [
    { id: 'regras', title: 'Sistema: regras', text: mode === 'gerar' ? RULES_GERAR : RULES_AJUSTAR },
    { id: 'esquema', title: 'Sistema: esquema JSON', text: JSON.stringify(mode === 'gerar' ? MODEL_SCHEMA : PATCH_SCHEMA) },
    { id: 'catalogo', title: 'Catálogo relevante', text: fmtCatalogo(contexto?.catalogoRelevante ?? {}) },
    {
      id: 'exemplos', title: 'Exemplos de processos',
      text: (contexto?.exemplos ?? []).map((e, i) => `Exemplo ${i + 1} (${e.nome}):\n${JSON.stringify(e.modelo)}`).join('\n\n') || '(sem exemplos)',
    },
  ];
  if (mode === 'ajustar') sections.push({ id: 'modelo', title: 'Modelo atual', text: JSON.stringify(modeloAtual) });
  sections.push(mode === 'gerar'
    ? {
      id: 'entrada', title: 'Respostas da entrevista',
      text: (roteiro?.questions ?? []).map((q) => `P: ${q.q}\nR: ${respostas?.[q.id] ?? ''}`).join('\n\n'),
    }
    : { id: 'entrada', title: 'Pedido do servidor', text: String(pedido ?? '') });

  const withTokens = sections.map((s) => ({ ...s, tokens: estimateTokens(s.text) }));
  const stable = withTokens.slice(0, 2).map((s) => s.text).join('\n\n');
  const variable = withTokens.slice(2).map((s) => `## ${s.title}\n${s.text}`).join('\n\n');
  return {
    messages: [{ role: 'system', content: stable }, { role: 'user', content: variable }],
    sections: withTokens,
    tokens: withTokens.reduce((a, s) => a + s.tokens, 0),
    version: PROMPT_VERSION,
  };
}

export function buildCorrectionMessage(errors) {
  return `A resposta anterior tem problemas estruturais:\n${errors.map((e) => `- ${e}`).join('\n')}\nCorrija mudando o mínimo possível, sem inventar informação. Responda apenas com o JSON corrigido, no mesmo esquema.`;
}
