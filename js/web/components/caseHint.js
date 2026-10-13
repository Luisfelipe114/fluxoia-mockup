// Faixa com o que observar no caso de demonstração em andamento (some se você fechar).
import { h } from '../dom.js';
import { recallCase } from '../demoCases.js';

export function caseHint(processId) {
  const c = recallCase(processId);
  if (!c) return null;
  const el = h('div', { class: 'banner info case-hint', 'data-testid': 'case-hint' },
    h('div', { class: 'row between', style: { alignItems: 'flex-start' } },
      h('div', {}, h('b', {}, `Caso de demonstração: ${c.titulo}. `), h('span', {}, c.observe)),
      h('button', { class: 'link-btn small', style: { marginTop: 0 }, onClick: () => el.remove(), 'aria-label': 'Fechar dica' }, 'fechar')));
  return el;
}
