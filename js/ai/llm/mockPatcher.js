// "Interpretador" SIMULADO de pedidos de ajuste: reconhece alguns padrões em português e devolve
// operações de patch, como um modelo real faria seguindo o PATCH_SCHEMA.

import { norm, stem, words } from '../../util/text.js';

const AJUDA = 'Não entendi o pedido. Exemplos: “a conferência de documentos é feita pelo Protocolo”; “adicione a etapa Notificar o requerente depois de Analisar projeto”; “remova a etapa Emitir guia da taxa”; “renomeie Analisar projeto para Avaliar projeto”.';

function findElement(model, text, tipos = ['tarefa']) {
  const tw = words(text, 3).map(stem);
  let best = null, bestScore = 0;
  for (const e of model.elementos) {
    if (!tipos.includes(e.tipo)) continue;
    const ew = words(e.nome, 3).map(stem);
    const score = tw.filter((w) => ew.includes(w)).length;
    if (score > bestScore) { best = e; bestScore = score; }
  }
  return best;
}

function findSector(model, text) {
  const n = norm(text);
  return model.setores.find((s) => { const m = norm(s.nome); return n.includes(m) || m.includes(n.trim()) || n.includes(m.split(' ')[0]); }) ?? null;
}

const slice = (orig, m, g) => orig.slice(m.indices[g][0], m.indices[g][1]).trim().replace(/^["“]|["”.]+$/g, '');

export function interpretRequest(pedido, model) {
  const orig = String(pedido ?? '').trim();
  const n = norm(orig);
  let m;

  m = new RegExp(String.raw`^(.+?)\s+(?:e|sao)\s+(?:feit[oa]s?|realizad[oa]s?|executad[oa]s?|de responsabilidade)\s+(?:pel[oa]s?|d[oa]s?)\s+(.+?)\.?$`, 'di').exec(n);
  if (m) {
    const step = findElement(model, slice(orig, m, 1));
    const sec = findSector(model, slice(orig, m, 2));
    if (!step) return { ops: [], mensagem: `Não encontrei a etapa “${slice(orig, m, 1)}” no processo.` };
    if (!sec) return { ops: [], mensagem: `Não encontrei o setor “${slice(orig, m, 2)}” no processo.` };
    return { ops: [{ op: 'setSector', id: step.id, setor: sec.id }], mensagem: `Mover “${step.nome}” para ${sec.nome}.` };
  }

  m = new RegExp(String.raw`(?:adicione|inclua|acrescente|crie|insira)\s+(?:a\s+)?(?:etapa|tarefa)\s+(.+?)\s+(?:depois|apos)\s+(?:de|da|do|das|dos)\s+(.+?)\.?$`, 'di').exec(n);
  if (m) {
    const after = findElement(model, slice(orig, m, 2), ['tarefa', 'inicio']);
    if (!after) return { ops: [], mensagem: `Não encontrei a etapa “${slice(orig, m, 2)}” para inserir depois.` };
    const nome = slice(orig, m, 1);
    return { ops: [{ op: 'addAfter', after: after.id, elemento: { nome: nome[0].toUpperCase() + nome.slice(1) } }], mensagem: `Inserir “${nome}” depois de “${after.nome}”.` };
  }

  m = new RegExp(String.raw`(?:remova|exclua|apague|retire)\s+(?:a\s+)?(?:etapa|tarefa)\s+(.+?)\.?$`, 'di').exec(n);
  if (m) {
    const step = findElement(model, slice(orig, m, 1));
    if (!step) return { ops: [], mensagem: `Não encontrei a etapa “${slice(orig, m, 1)}”.` };
    return { ops: [{ op: 'remove', id: step.id }], mensagem: `Remover “${step.nome}”.` };
  }

  m = new RegExp(String.raw`renomeie\s+(.+?)\s+para\s+(.+?)\.?$`, 'di').exec(n);
  if (m) {
    const step = findElement(model, slice(orig, m, 1), ['tarefa', 'decisao']);
    if (!step) return { ops: [], mensagem: `Não encontrei a etapa “${slice(orig, m, 1)}”.` };
    const nome = slice(orig, m, 2);
    return { ops: [{ op: 'rename', id: step.id, nome: nome[0].toUpperCase() + nome.slice(1) }], mensagem: `Renomear “${step.nome}” para “${nome}”.` };
  }

  return { ops: [], mensagem: AJUDA };
}
