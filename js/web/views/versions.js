import { h, fmtDate, clear } from '../dom.js';
import { toast, confirmDialog } from '../components/ui.js';
import { processBar } from '../components/processBar.js';
import { caseHint } from '../components/caseHint.js';
import { mountViewer } from '../components/bpmnCanvas.js';
import { downloadText, exportPdf } from '../components/exports.js';
import { slug } from '../../util/text.js';
import { links, navigate } from '../router.js';

const EVENT = {
  gerar: (r) => (r.resultado === 'valido' ? `Fluxo gerado${r.tentativas > 1 ? ` (${r.tentativas - 1} correção(ões) automática(s))` : ''}` : r.resultado === 'invalido' ? 'Fluxo gerado com problemas' : r.resultado === 'bloqueado' ? 'Geração bloqueada: dados pessoais nas respostas' : 'Geração falhou: servidor de LLM indisponível'),
  ajustar: (r) => `Ajuste por texto: ${r.detalhe?.pedido ?? ''}`,
  editar: () => 'Edição direta no diagrama',
  enviar: () => 'Enviado para validação',
  devolver: (r) => `Devolvido pelo validador: ${r.detalhe?.observacao ?? ''}`,
  aprovar: (r) => `Versão ${r.detalhe?.n} aprovada por ${r.detalhe?.validador}`,
  restaurar: (r) => `Versão ${r.detalhe?.n} restaurada como rascunho`,
};

function diffView(d) {
  const { diff } = d;
  if (diff.same) return h('p', { class: 'muted small' }, d.de ? `Sem diferenças em relação à versão ${d.de}.` : 'Primeira versão: não há versão anterior para comparar.');
  const list = (title, items, fmt) => items.length > 0 && h('div', {}, h('b', { class: 'small' }, title), h('ul', { class: 'diff-list' }, items.map((x) => h('li', {}, fmt(x)))));
  return h('div', { class: 'stack', style: { gap: '8px' } },
    h('p', { class: 'small muted' }, d.de ? `Comparação entre a versão ${d.de} e a ${d.para}.` : 'Primeira versão (tudo é novo).'),
    list('Elementos adicionados', diff.added, (x) => x.nome || x.id),
    list('Elementos removidos', diff.removed, (x) => x.nome || x.id),
    list('Elementos alterados', diff.changed, (x) => `${x.nome}: ${x.campos.join('; ')}`),
    (diff.flowsAdded || diff.flowsRemoved) > 0 && h('p', { class: 'small' }, `Ligações: +${diff.flowsAdded} / −${diff.flowsRemoved}`));
}

export async function versionsView(ctx, { id }) {
  const { api } = ctx;
  const [data, hist] = await Promise.all([api.getProcess(id), api.history(id)]);
  const bar = processBar({ processo: data.processo, active: 'versions', role: ctx.state.role, hasDraft: Boolean(data.rascunho) });
  const viewers = [];

  const card = (v) => {
    const detail = h('div', { class: 'stack', style: { marginTop: '10px' } });
    const canvas = h('div', { class: 'bpmn-host small', hidden: true });
    let shown = false;
    let viewerInstance = null;

    const downloadBpmn = () => {
      downloadText(`${slug(data.processo.nome)}-v${v.n}.bpmn`, v.xml);
      toast(`Versão ${v.n} baixada em .bpmn.`);
    };

    const downloadPdf = async () => {
      try {
        let svg;
        if (viewerInstance) {
          svg = await viewerInstance.saveSVG();
        } else {
          const tempDiv = document.createElement('div');
          tempDiv.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1200px;height:800px;visibility:hidden;';
          document.body.append(tempDiv);
          const tempViewer = await mountViewer(tempDiv, v.xml);
          svg = await tempViewer.saveSVG();
          tempViewer.destroy();
          tempDiv.remove();
        }
        await exportPdf({
          nome: `${data.processo.nome} (Versão ${v.n})`,
          status: 'aprovado',
          versao: v,
          model: v.modelo,
          svg,
        });
        toast(`PDF da versão ${v.n} baixado.`);
      } catch (e) {
        toast(`Erro ao gerar PDF: ${e.message}`, 'err');
      }
    };

    return h('div', { class: 'card', 'data-testid': 'version-card' },
      h('div', { class: 'row between' }, h('h3', { style: { margin: 0 } }, `Versão ${v.n}`), h('span', { class: 'pill ok' }, 'Aprovada')),
      h('div', { class: 'small muted' }, `Aprovada em ${fmtDate(v.aprovada_em)} por ${v.validador}`),
      h('p', { style: { marginTop: '6px' } }, v.motivo),
      v.norma && h('p', { class: 'small' }, h('b', {}, 'Norma: '), v.norma),
      v.checklist && h('p', { class: 'small' }, h('b', {}, 'Checklist: '), `${Object.values(v.checklist).filter(Boolean).length} de ${Object.values(v.checklist).length} itens conferidos`),
      h('div', { class: 'row', style: { marginTop: '10px', gap: '8px' } },
        h('button', { class: 'btn small', onClick: async (e) => {
          shown = !shown; canvas.hidden = !shown; e.target.textContent = shown ? 'Ocultar diagrama' : 'Ver diagrama';
          if (shown && !canvas.dataset.ready) {
            canvas.dataset.ready = '1';
            viewerInstance = await mountViewer(canvas, v.xml);
            viewers.push(viewerInstance);
          }
        } }, 'Ver diagrama'),
        h('button', { class: 'btn small primary', onClick: downloadBpmn }, 'Baixar .bpmn'),
        h('button', { class: 'btn small primary', onClick: downloadPdf }, 'Baixar PDF'),
        h('button', { class: 'btn small', onClick: async () => { try { clear(detail).append(diffView(await api.versionDiff(id, v.n))); } catch (e) { toast(e.message, 'err'); } } }, 'Comparar com a anterior'),
        h('button', { class: 'btn small', onClick: async () => {
          if (!(await confirmDialog({ title: `Restaurar a versão ${v.n}?`, description: 'O rascunho atual será substituído por esta versão e o processo volta para o status de rascunho.', submit: 'Restaurar', tone: 'primary' }))) return;
          try { await api.restoreVersion(id, v.n); toast(`Versão ${v.n} restaurada como rascunho.`); navigate(links.draft(id)); } catch (e) { toast(e.message, 'err'); }
        } }, 'Restaurar como rascunho')),
      canvas, detail);
  };

  const timeline = h('div', { class: 'card' }, h('h3', {}, 'Histórico do processo'),
    hist.length ? h('ol', { class: 'timeline', 'data-testid': 'timeline' }, hist.map((r) => h('li', { class: r.resultado === 'valido' ? '' : 'bad' }, h('span', { class: 'muted small' }, new Date(r.criado).toLocaleString('pt-BR')), h('span', {}, (EVENT[r.tipo] ?? (() => r.tipo))(r))))) : h('p', { class: 'muted small' }, 'Sem eventos ainda.'));

  const el = h('section', { class: 'page narrow' }, bar.el, caseHint(id),
    h('div', { class: 'stack', style: { marginTop: '16px' } },
      h('p', { class: 'small muted' }, 'Cada aprovação guarda o fluxo, quem aprovou, o motivo e a norma de referência. Assim é possível mostrar qual regra valia quando um processo tramitou.'),
      data.versoes.length ? data.versoes.slice().reverse().map(card) : h('div', { class: 'card' }, h('p', { class: 'muted' }, 'Nenhuma versão aprovada ainda.')),
      timeline));
  return { el, destroy() { viewers.forEach((v) => v.destroy()); } };
}
