// Ficha do processo: tabela de etapas com setor, documentos, sistemas, taxas e prazo.
import { h } from '../dom.js';
import { computeOrder } from '../../bpmn/layout.js';

export function orderedSteps(model) {
  const { rank } = computeOrder(model);
  return model.elementos.filter((e) => e.tipo === 'tarefa' || e.tipo === 'decisao').sort((a, b) => rank[a.id] - rank[b.id]);
}

export function fichaTable(model) {
  const setor = (id) => model.setores.find((s) => s.id === id)?.nome ?? '';
  return h('div', { class: 'table-wrap' },
    h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, ['Etapa', 'Setor', 'Documentos', 'Sistemas e taxas', 'Prazo'].map((t) => h('th', {}, t)))),
      h('tbody', {}, orderedSteps(model).map((e) => h('tr', {},
        h('td', { style: { fontWeight: 600 } }, e.nome, e.tipo === 'decisao' && h('span', { class: 'muted small' }, ' (decisão)')),
        h('td', {}, setor(e.setor)),
        h('td', {}, e.documentos.join(', ')),
        h('td', {}, [...e.sistemas, ...e.taxas].join(', ')),
        h('td', {}, e.prazo))))));
}
