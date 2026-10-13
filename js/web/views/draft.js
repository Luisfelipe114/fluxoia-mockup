import { h, clear } from '../dom.js';
import { toast, confirmDialog } from '../components/ui.js';
import { processBar } from '../components/processBar.js';
import { mountEditor, modelIdOf, markNoOrigin } from '../components/bpmnCanvas.js';
import { caseHint } from '../components/caseHint.js';
import { fichaTable } from '../components/ficha.js';
import { signalsPanel } from '../components/signals.js';
import { fillStepDetail } from '../components/stepDetail.js';
import { downloadText, exportPdf } from '../components/exports.js';
import { links, navigate } from '../router.js';
import { slug } from '../../util/text.js';

export async function draftView(ctx, { id }) {
  const { api } = ctx;
  let data = await api.getProcess(id);
  if (!data.rascunho) { navigate(links.interview(id)); return { el: h('div') }; }

  const bar = processBar({ processo: data.processo, active: 'draft', role: ctx.state.role, hasDraft: true });
  const banners = h('div', { class: 'stack', style: { gap: '8px' } });
  const host = h('div', { class: 'bpmn-host', 'data-testid': 'canvas' });
  const side = h('div', { class: 'stack' });
  const stepBox = h('div', { class: 'card accent', hidden: true, 'data-testid': 'step-detail' });
  const fichaHost = h('div', { class: 'card' });
  let editor = null, timer = null, stars = 0, marked = [], dirty = false;
  const applyMarkers = () => { if (editor) marked = markNoOrigin(editor.instance, data.rascunho.modelo, marked); };

  // ------------------------------------------------------------ painéis
  function renderBanners() {
    const { processo } = data;
    clear(banners);
    if (processo.devolucao && processo.status === 'rascunho') banners.append(h('div', { class: 'banner err' }, h('b', {}, 'Devolvido para ajustes: '), processo.devolucao));
    if (processo.status === 'em_validacao') banners.append(h('div', { class: 'banner info' }, 'Aguardando a validação do chefe do setor. Editar o fluxo agora devolve o processo para rascunho.'));
    if (processo.status === 'aprovado') banners.append(h('div', { class: 'banner ok' }, `Versão ${data.versoes.at(-1)?.n} aprovada por ${data.versoes.at(-1)?.validador}. Qualquer edição inicia uma nova versão.`));
    const erros = data.sinais?.erros ?? [];
    if (erros.length) banners.append(h('div', { class: 'banner err', 'data-testid': 'errors' }, h('b', {}, `${erros.length} ponto(s) a corrigir antes de enviar:`), h('ul', {}, erros.map((e) => h('li', {}, e))),
        h('div', { class: 'small', style: { marginTop: '6px' } }, 'Corrija no diagrama ou ', h('a', { href: links.interview(id) }, 'volte à entrevista e gere de novo'), '. O modelo simulado pode ser trocado em Simulação.')));
    else if (data.rascunho.meta?.erros?.length) banners.append(h('div', { class: 'banner ok' }, 'Pontos corrigidos. Pode enviar para validação.'));
  }

  function renderSide() {
    clear(side);
    side.append(signalsPanel(data.sinais), stepBox, feedbackCard(), inspectorCard());
    clear(fichaHost).append(h('h3', {}, 'Ficha do processo'), h('p', { class: 'muted small', style: { marginBottom: '10px' } }, data.rascunho.modelo.objetivo || 'Objetivo não informado.'), fichaTable(data.rascunho.modelo));
  }

  const showStep = (element) => fillStepDetail(stepBox, data.rascunho.modelo, modelIdOf(element));

  function feedbackCard() {
    const comment = h('input', { class: 'input', id: 'fb-comment', placeholder: 'O que faltou ou saiu diferente?' });
    const starsEl = h('div', { class: 'stars', role: 'group', 'aria-label': 'Nota de 1 a 5' });
    const draw = () => { clear(starsEl); [1, 2, 3, 4, 5].forEach((n) => starsEl.append(h('button', { type: 'button', 'aria-label': `Nota ${n} de 5`, 'aria-pressed': String(stars === n), onClick: () => { stars = n; draw(); } }, n))); };
    draw();
    return h('div', { class: 'card' },
      h('h3', {}, 'Este rascunho ficou próximo do processo real?'), starsEl,
      h('label', { class: 'field', for: 'fb-comment' }, 'Comentário (opcional)'), comment,
      h('button', { class: 'btn', style: { marginTop: '12px' }, onClick: async () => {
        if (!stars) return toast('Escolha uma nota de 1 a 5.', 'err');
        try { await api.feedback(id, stars, comment.value); toast('Avaliação registrada. Obrigado.'); stars = 0; comment.value = ''; draw(); } catch (e) { toast(e.message, 'err'); }
      } }, 'Enviar avaliação'));
  }

  function inspectorCard() {
    const meta = data.rascunho.meta ?? {};
    return h('div', { class: 'card' },
      h('h3', {}, 'Inspetor da geração'),
      h('p', { class: 'muted small' }, 'O que a API enviou ao componente de IA nesta geração (contrato: gerar ou ajustar).'),
      h('details', { class: 'disclosure' }, h('summary', {}, `Prompt montado (${meta.tokensPrompt ?? 0} tokens estimados)`),
        (meta.prompt ?? []).length ? (meta.prompt ?? []).map((s) => h('details', { class: 'disclosure' }, h('summary', {}, `${s.title} · ${s.tokens} tokens`), h('pre', { class: 'code' }, s.text))) : h('p', { class: 'muted small' }, 'Sem prompt registrado (rascunho restaurado ou editado).')),
      h('details', { class: 'disclosure' }, h('summary', {}, 'Contexto e tentativas'),
        h('dl', { class: 'kv' },
          h('dt', {}, 'Exemplos'), h('dd', {}, (meta.exemplos ?? []).join('; ') || '—'),
          h('dt', {}, 'Tentativas'), h('dd', {}, String(meta.tentativas ?? '—')),
          h('dt', {}, 'Correções'), h('dd', {}, String(meta.correcoes ?? '—')),
          h('dt', {}, 'Ajustes'), h('dd', {}, String((meta.ajustes ?? []).length)))),
      h('p', { class: 'small', style: { marginTop: '10px' } }, h('a', { href: links.versions(id) }, 'Ver o histórico do processo')));
  }

  async function refresh() {
    data = await api.getProcess(id);
    renderBanners(); renderSide();
    toolbarState();
    applyMarkers();
  }

  // ------------------------------------------------------------ edição no diagrama
  async function flushSave() {
    clearTimeout(timer); timer = null;
    if (!editor || !dirty) return;
    dirty = false;
    try {
      const xml = await editor.saveXML();
      const res = await api.saveXml(id, xml);
      if (res.voltouParaRascunho) { bar.setStatus('rascunho'); toast('O processo voltou para rascunho por causa da edição.'); }
      await refresh();
    } catch (e) { dirty = true; toast(e.message, 'err'); }
  }
  const scheduleSave = () => { dirty = true; clearTimeout(timer); timer = setTimeout(flushSave, 800); };

  // ------------------------------------------------------------ toolbar
  const btnSend = h('button', { class: 'btn primary', 'data-testid': 'send', onClick: send }, 'Enviar para validação');
  function toolbarState() {
    if (data.processo.status === 'aprovado') {
      btnSend.disabled = true;
      btnSend.textContent = 'Processo aprovado';
    } else if (data.processo.status === 'em_validacao') {
      btnSend.disabled = true;
      btnSend.textContent = 'Em validação';
    } else {
      btnSend.disabled = false;
      btnSend.textContent = 'Enviar para validação';
    }
  }

  async function send() {
    await flushSave();
    try { await api.submit(id); toast('Enviado para validação.'); navigate(links.approval(id)); }
    catch (e) { await refresh(); toast(e.message, 'err'); }
  }

  async function check() {
    await flushSave();
    await refresh();
    toast(data.sinais?.estruturaValida ? 'Fluxo verificado: estrutura válida.' : `Encontrei ${data.sinais.erros.length} ponto(s) a corrigir.`, data.sinais?.estruturaValida ? 'info' : 'err');
  }

  async function exportBpmn() {
    await flushSave();
    try { const { nome, xml } = await api.exportBpmn(id); downloadText(`${slug(nome)}.bpmn`, xml); } catch (e) { toast(e.message, 'err'); }
  }

  async function exportPdfClick() {
    await flushSave();
    try { await exportPdf({ nome: data.processo.nome, status: data.processo.status, versao: data.versoes.at(-1), model: data.rascunho.modelo, svg: await editor.saveSVG() }); }
    catch (e) { toast(e.message, 'err'); }
  }

  const refineInput = h('input', { class: 'input', id: 'refine', placeholder: 'Ex.: a conferência de documentos é feita pelo Protocolo' });
  async function refine() {
    const pedido = refineInput.value.trim();
    if (!pedido) return refineInput.focus();
    await flushSave();
    try {
      const res = await ctx.busy.run('Aplicando o ajuste', () => api.adjust(id, pedido));
      if (!res.mudou) return toast(res.mensagem || 'Nenhuma alteração.', 'err');
      await refresh();
      await editor.load(data.rascunho.xml);
      applyMarkers();
      refineInput.value = '';
      bar.setStatus('rascunho');
      toast(res.mensagem || 'Ajuste aplicado.');
    } catch (e) { toast(e.message, 'err'); }
  }
  refineInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); refine(); } });

  renderBanners(); renderSide(); toolbarState();

  const el = h('section', { class: 'page' }, bar.el, caseHint(id),
    h('div', { class: 'grid-2', style: { marginTop: '8px' } },
      h('div', { class: 'stack' },
        banners,
        h('div', { class: 'row' },
          h('button', { class: 'btn', onClick: check }, 'Verificar fluxo'), h('span', { style: { flex: 1 } }),
          h('button', { class: 'btn', onClick: exportBpmn }, 'Baixar .bpmn'),
          h('button', { class: 'btn', onClick: exportPdfClick }, 'Baixar PDF'), btnSend),
        h('div', { class: 'canvas-card' }, host,
          h('div', { class: 'zoom' },
            h('button', { 'aria-label': 'Aproximar', onClick: () => editor?.zoom(1) }, '+'),
            h('button', { 'aria-label': 'Afastar', onClick: () => editor?.zoom(-1) }, '−'),
            h('button', { 'aria-label': 'Ajustar à tela', onClick: () => editor?.fit() }, '⤢'))),
        h('div', { class: 'card row' }, h('label', { for: 'refine', class: 'small', style: { fontWeight: 600 } }, 'Peça um ajuste'), h('div', { style: { flex: 1, minWidth: '240px' } }, refineInput), h('button', { class: 'btn primary', onClick: refine }, 'Ajustar')),
        h('p', { class: 'hint' }, 'Ajustes entendidos neste mockup: “… é feita pelo <setor>”, “adicione a etapa <nome> depois de <etapa>”, “remova a etapa <nome>”, “renomeie <etapa> para <nome>”.'),
        fichaHost),
      side));

  return {
    el,
    async mount() {
      editor = await mountEditor(host, data.rascunho.xml, { onChange: scheduleSave, onSelect: showStep });
      applyMarkers();
    },
    destroy() { clearTimeout(timer); editor?.destroy(); },
  };
}
