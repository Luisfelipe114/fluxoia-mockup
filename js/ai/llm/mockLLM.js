// "Servidor de LLM" simulado. Implementa a mesma interface do cliente HTTP (complete),
// mas gera a resposta com heurísticas locais e pode se comportar mal de propósito (cenários).
//
// O parâmetro `input` só existe para a simulação: um modelo real lê tudo de `messages`.

import { clock } from '../../util/clock.js';
import { generateModel } from './mockGenerator.js';
import { interpretRequest } from './mockPatcher.js';
import { byId, cloneModel, incoming, nextElementId, outgoing } from '../../domain/model.js';

function prune(m) {
  const start = m.elementos.find((e) => e.tipo === 'inicio');
  const seen = new Set(start ? [start.id] : []);
  const queue = [...seen];
  while (queue.length) {
    const v = queue.shift();
    outgoing(m, v).forEach((f) => { if (!seen.has(f.para)) { seen.add(f.para); queue.push(f.para); } });
  }
  m.elementos = m.elementos.filter((e) => seen.has(e.id));
  m.fluxos = m.fluxos.filter((f) => seen.has(f.de) && seen.has(f.para));
}

/** Erro estrutural típico: uma decisão fica sem uma das saídas. */
export function applyFlaw(model) {
  const m = cloneModel(model);
  const d = m.elementos.find((e) => e.tipo === 'decisao' && outgoing(m, e.id).length >= 2);
  if (d) {
    const last = outgoing(m, d.id).at(-1);
    m.fluxos = m.fluxos.filter((f) => f !== last);
  } else {
    const ref = m.elementos.find((e) => e.tipo === 'tarefa') ?? m.elementos[0];
    m.elementos.push({ id: nextElementId(m), tipo: 'tarefa', nome: 'Etapa solta', setor: ref.setor, documentos: [], sistemas: [], taxas: [], prazo: '', origem: '' });
  }
  return m;
}

/** Omissão silenciosa: remove um caminho inteiro e mantém o fluxo estruturalmente válido. */
export function dropDecision(model) {
  const m = cloneModel(model);
  const decs = m.elementos.filter((e) => e.tipo === 'decisao' && outgoing(m, e.id).length >= 2);
  if (!decs.length) return m;
  const idx = byId(m);
  const pick = [...decs].reverse().find((d) => outgoing(m, d.id).some((f) => idx[f.para].tipo === 'fim')) ?? decs.at(-1);
  const outs = outgoing(m, pick.id);
  const keep = outs.find((f) => f.condicao === 'Sim') ?? outs[0];
  m.fluxos = m.fluxos.filter((f) => f.de !== pick.id || f === keep);
  incoming(m, pick.id).forEach((f) => { f.para = keep.para; });
  m.fluxos = m.fluxos.filter((f) => f !== keep);
  m.elementos = m.elementos.filter((e) => e.id !== pick.id);
  prune(m);
  return m;
}

/** Invenção: uma etapa plausível, estruturalmente válida, que não existe na entrevista. */
export function addInvented(model) {
  const m = cloneModel(model);
  const t = m.elementos.find((e) => e.tipo === 'tarefa' && outgoing(m, e.id).length === 1);
  if (!t) return m;
  const f = outgoing(m, t.id)[0];
  const id = nextElementId(m);
  m.elementos.splice(m.elementos.indexOf(t) + 1, 0, { id, tipo: 'tarefa', nome: 'Consultar órgão de controle', setor: t.setor, documentos: [], sistemas: [], taxas: [], prazo: '', origem: '' });
  const target = f.para;
  f.para = id;
  m.fluxos.push({ de: id, para: target, condicao: '' });
  return m;
}

export class MockLLM {
  constructor() { this.name = 'simulado (sem modelo real)'; this.kind = 'mock'; }

  async complete({ input }) {
    await clock.jitter(600, 1200);
    const { mode, respostas, catalogo, attempt = 0, scenario = 'ok', modeloAtual, pedido } = input;
    if (scenario === 'indisponivel') throw new Error('conexão recusada (simulado)');

    if (mode === 'gerar') {
      let model = generateModel(respostas, catalogo);
      if (scenario === 'json_invalido' && attempt === 0) return `Claro! Segue o processo solicitado:\n\n${JSON.stringify(model).slice(0, 220)}...`;
      if (scenario === 'erra_e_corrige' && attempt === 0) model = applyFlaw(model);
      else if (scenario === 'erra_sempre') model = applyFlaw(model);
      else if (scenario === 'omissao') model = dropDecision(model);
      else if (scenario === 'invencao') model = addInvented(model);
      return JSON.stringify(model);
    }
    const { ops, mensagem } = interpretRequest(pedido, modeloAtual);
    return JSON.stringify({ ops, mensagem });
  }
}
