// Barra do processo: nome, carimbo de status e abas (Entrevista, Rascunho, Validação, Versões).
import { h } from '../dom.js';
import { stamp } from './ui.js';
import { links } from '../router.js';

export function processBar({ processo, active, role, hasDraft }) {
  const tab = (key, label, href, show = true) => show && h('a', { href, class: 'tab', 'aria-selected': String(active === key), role: 'tab', style: { textDecoration: 'none' } }, label);
  const stampHost = h('span', { 'data-stamp-host': '' }, stamp(processo.status));
  const bar = h('div', { class: 'process-bar' },
    h('div', { class: 'row between' },
      h('h1', { class: 'process-title' }, processo.nome),
      stampHost),
    h('div', { class: 'tabs', role: 'tablist' },
      tab('interview', 'Entrevista', links.interview(processo.id)),
      tab('draft', 'Rascunho e diagrama', links.draft(processo.id), hasDraft),
      tab('approval', 'Validação', links.approval(processo.id), hasDraft && (role === 'validador' || processo.status === 'em_validacao')),
      tab('versions', 'Versões', links.versions(processo.id))));
  return {
    el: bar,
    setStatus(status) { stampHost.replaceChildren(stamp(status, { pop: true })); },
  };
}
