import { h, fmtDate } from '../dom.js';
import { stamp, toast } from '../components/ui.js';
import { links, navigate } from '../router.js';
import { CASES, startCase } from '../demoCases.js';

const TAGS = ['Geração', 'Erro e correção', 'Erro', 'Entrevista', 'Validação'];

export async function homeView(ctx) {
  const { api, state } = ctx;
  const list = await api.listProcesses();

  const open = (p) => {
    if (p.status === 'em_validacao' && state.role === 'validador') return navigate(links.approval(p.id));
    return navigate(p.temRascunho ? links.draft(p.id) : links.interview(p.id));
  };

  const createNew = async () => {
    const p = await api.createProcess();
    navigate(links.interview(p.id));
  };

  const openCase = async (c) => {
    try {
      const { path, role } = await startCase(ctx, c, { links, state });
      if (role !== state.role) state.setRole(role);
      navigate(path);
    } catch (e) { toast(e.message, 'err'); }
  };

  const waiting = list.filter((p) => p.status === 'em_validacao');
  const row = (p) => h('div', { class: 'proc-row', 'data-testid': 'proc-row' },
    h('div', {},
      h('button', { class: 'link-btn', onClick: () => open(p) }, p.nome),
      h('div', { class: 'muted small' }, `Atualizado em ${fmtDate(p.atualizado)}`, p.versoes ? ` · ${p.versoes} versão(ões) aprovada(s)` : '')),
    stamp(p.status));

  const card = (c) => h('article', { class: 'case-card', 'data-testid': 'case-card', 'data-case': c.id },
    h('span', { class: `pill tag-${c.tag.split(' ')[0].toLowerCase()}` }, c.tag),
    h('h3', {}, c.titulo),
    h('p', { class: 'small muted' }, c.descricao),
    h('button', { class: 'btn small', onClick: () => openCase(c) }, c.inicio === 'validacao' ? 'Abrir como chefe do setor' : 'Abrir caso'));

  const el = h('section', { class: 'page' },
    h('div', { class: 'stack', style: { gap: '32px' } },
      h('div', {},
        h('h1', { class: 'hero' }, 'Descreva como o processo funciona. O fluxo sai desenhado.'),
        h('p', { class: 'lede' }, 'Responda a uma entrevista curta sobre o processo do seu setor. A ferramenta monta o diagrama BPMN e a ficha do processo; você revisa, ajusta e envia para o chefe do setor aprovar.'),
        h('div', { class: 'row', style: { marginTop: '20px' } }, h('button', { class: 'btn primary', 'data-testid': 'new-process', onClick: createNew }, 'Mapear novo processo'))),
      state.role === 'validador' && h('div', { class: waiting.length ? 'banner info' : 'banner' },
        waiting.length ? `${waiting.length} processo(s) aguardando a sua validação.` : 'Nenhum processo aguardando a sua validação no momento.'),
      h('div', {},
        h('div', { class: 'list-head' }, h('h2', {}, 'Casos de demonstração'), h('p', { class: 'small muted' }, 'Selecione um cenário para ver a solução em ação. Cada caso destaca uma característica: geração assistida, governança humana ou privacidade.')),
        h('div', { class: 'cases' }, CASES.map(card))),
      h('div', {},
        h('div', { class: 'row between list-head' }, h('h2', {}, 'Meus processos'), h('span', { class: 'muted small' }, `${list.length} processo(s)`)),
        list.length ? list.map(row) : h('p', { class: 'muted', style: { padding: '20px 0' } }, 'Nenhum processo ainda. Abra um caso de demonstração ou mapeie um processo do seu setor.'))));
  return { el };
}
