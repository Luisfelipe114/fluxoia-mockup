// Detalhe da etapa selecionada: setor, atributos e a resposta da entrevista de onde ela veio (explicação).
import { h, clear } from '../dom.js';

const KIND = { inicio: 'Início do processo', fim: 'Fim do processo', tarefa: 'Etapa', decisao: 'Decisão' };

/** Preenche `host` com o detalhe do elemento `elementId`. Devolve false se o elemento não existe no modelo. */
export function fillStepDetail(host, model, elementId) {
  const e = model.elementos.find((x) => x.id === elementId);
  if (!e) { host.hidden = true; return false; }
  const setor = model.setores.find((s) => s.id === e.setor)?.nome;
  const rows = [['Setor', setor], ['Documentos', e.documentos.join(', ')], ['Sistemas', e.sistemas.join(', ')], ['Taxas', e.taxas.join(', ')], ['Prazo', e.prazo]].filter(([, v]) => v);
  clear(host).append(
    h('div', { class: 'muted small' }, 'Etapa selecionada'),
    h('h3', { style: { marginBottom: '8px' } }, e.nome || KIND[e.tipo]),
    h('div', { class: 'muted small', style: { marginBottom: '8px' } }, KIND[e.tipo]),
    rows.length > 0 && h('dl', { class: 'kv' }, rows.map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])),
    e.origem
      ? h('div', { class: 'quote' }, h('div', { class: 'muted small' }, 'Veio desta resposta da entrevista'), h('i', {}, `“${e.origem}”`))
      : h('div', { class: 'quote' }, h('i', {}, 'Elemento incluído por edição ou ajuste: não vem das respostas da entrevista.')));
  host.hidden = false;
  return true;
}
