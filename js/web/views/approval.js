import { h, fmtDate } from '../dom.js';
import { toast, formDialog, confirmDialog } from '../components/ui.js';
import { processBar } from '../components/processBar.js';
import { caseHint } from '../components/caseHint.js';
import { mountViewer, modelIdOf, markNoOrigin } from '../components/bpmnCanvas.js';
import { fillStepDetail } from '../components/stepDetail.js';
import { fichaTable } from '../components/ficha.js';
import { downloadText, exportPdf } from '../components/exports.js';
import { slug } from '../../util/text.js';
import { links, navigate } from '../router.js';
import { ROLE_LABEL } from '../state.js';

const CHECKS = [
  ['etapas', 'Todas as etapas descritas na entrevista aparecem no diagrama, e nenhuma etapa estranha foi incluída.'],
  ['decisoes', 'As decisões têm as saídas certas, inclusive os caminhos de exceção (indeferimento, retorno).'],
  ['setores', 'Setores responsáveis, documentos, sistemas, taxas e prazos conferem.'],
];

export async function approvalView(ctx, { id }) {
  const { api, state } = ctx;
  const [data, script] = await Promise.all([api.getProcess(id), api.script()]);
  if (!data.rascunho) { navigate(links.interview(id)); return { el: h('div') }; }
  const { processo } = data;
  const bar = processBar({ processo, active: 'approval', role: state.role, hasDraft: true });
  const host = h('div', { class: 'bpmn-host', 'data-testid': 'canvas' });
  const stepBox = h('div', { class: 'card accent', hidden: true, 'data-testid': 'step-detail' });
  let viewer = null, selected = null;

  const isValidator = state.role === 'validador';
  const waiting = processo.status === 'em_validacao';
  const sinais = data.sinais;

  const onSelect = (element) => {
    const canvas = viewer.instance.get('canvas');
    if (selected) canvas.removeMarker(selected, 'sel');
    selected = null;
    if (fillStepDetail(stepBox, data.rascunho.modelo, modelIdOf(element))) { selected = element.id; canvas.addMarker(element.id, 'sel'); }
  };

  const name = h('input', { class: 'input', id: 'v-name', placeholder: 'Nome do validador' });
  const motivo = h('textarea', { class: 'textarea', id: 'v-motivo', style: { minHeight: '80px' }, placeholder: 'Ex.: primeira versão do processo; inclusão da etapa de vistoria' });
  const norma = h('input', { class: 'input', id: 'v-norma', placeholder: 'Ex.: Decreto municipal nº [número]' });
  if (data.versoes.length === 0) motivo.value = 'Primeira versão do processo.';
  const checks = Object.fromEntries(CHECKS.map(([k]) => [k, h('input', { type: 'checkbox', id: `chk-${k}`, 'data-testid': `chk-${k}` })]));

  async function approve() {
    const checklist = Object.fromEntries(CHECKS.map(([k]) => [k, checks[k].checked]));
    const missing = CHECKS.filter(([k]) => !checklist[k]);
    if (missing.length && !(await confirmDialog({ title: 'Aprovar sem concluir o checklist?', description: `Você não marcou: ${missing.map(([, t]) => `“${t}”`).join(' ')} Aprovar mesmo assim?`, submit: 'Aprovar assim mesmo', tone: 'ok' }))) return;
    try {
      const res = await api.approve(id, { validador: name.value, motivo: motivo.value, norma: norma.value, checklist });
      toast(`Versão ${res.n} aprovada.`);
      navigate(links.versions(id));
    } catch (e) { toast(e.message, 'err'); }
  }
  async function reject() {
    const v = await formDialog({ title: 'Devolver para ajustes', description: 'Diga o que precisa mudar. O processo volta para rascunho com a sua observação.', fields: [{ name: 'observacao', label: 'Observação', type: 'textarea', required: true, placeholder: 'Ex.: falta o caminho de indeferimento do projeto' }], submit: 'Devolver', tone: 'danger' });
    if (!v) return;
    try { await api.reject(id, v.observacao); toast('Processo devolvido ao servidor.'); navigate(links.home()); } catch (e) { toast(e.message, 'err'); }
  }

  const answersCard = h('div', { class: 'card' }, h('h3', {}, 'Respostas da entrevista'),
    h('p', { class: 'small muted' }, 'Compare com o diagrama: o que o servidor descreveu está todo no fluxo?'),
    h('div', { class: 'stack', style: { gap: '8px', marginTop: '8px' } }, script.roteiro.questions.map((q) => h('div', { class: 'qa' }, h('div', { class: 'small muted' }, q.q), h('div', {}, data.respostas[q.id] || h('em', { class: 'muted' }, 'sem resposta'))))));

  const checklistCard = h('div', { class: 'card' }, h('h3', {}, 'Checklist do validador'),
    h('div', { class: 'stack', style: { gap: '8px' } }, CHECKS.map(([k, text]) => h('label', { class: 'check', for: `chk-${k}` }, checks[k], h('span', {}, text)))),
    h('p', { class: 'hint' }, 'O checklist fica registrado na versão aprovada. A verificação estrutural não garante que o processo esteja completo ou correto: isso é com você.'));

  let formCard;
  if (!waiting) {
    const downloadBpmn = () => {
      downloadText(`${slug(processo.nome)}.bpmn`, data.rascunho.xml);
      toast('Diagrama baixado em .bpmn.');
    };
    const downloadPdf = async () => {
      try {
        const svg = await viewer?.saveSVG();
        await exportPdf({
          nome: processo.nome,
          status: processo.status,
          versao: data.versoes.at(-1),
          model: data.rascunho.modelo,
          svg,
        });
        toast('PDF baixado com sucesso.');
      } catch (e) {
        toast(`Erro ao gerar PDF: ${e.message}`, 'err');
      }
    };

    formCard = h('div', { class: 'card' }, h('h3', {}, 'Aprovação'),
      h('p', { class: 'small muted' }, processo.status === 'aprovado' ? 'Esta versão já foi aprovada oficialmente.' : 'Este processo ainda não foi enviado para validação. O servidor precisa enviá-lo pela tela do rascunho.'),
      h('div', { class: 'row', style: { marginTop: '12px', gap: '8px' } },
        h('a', { class: 'btn', href: links.draft(id) }, 'Abrir o rascunho'),
        h('a', { class: 'btn', href: links.versions(id) }, 'Ver versões'),
        processo.status === 'aprovado' && h('button', { class: 'btn primary', onClick: downloadBpmn }, 'Baixar .bpmn'),
        processo.status === 'aprovado' && h('button', { class: 'btn primary', onClick: downloadPdf }, 'Baixar PDF')));
  } else if (!isValidator) {
    formCard = h('div', { class: 'card' }, h('h3', {}, 'Aguardando o chefe do setor'),
      h('p', { class: 'small muted' }, 'Somente o perfil “Chefe do setor” pode aprovar ou devolver. A API recusa a ação para outros perfis (erro 403).'),
      h('button', { class: 'btn primary', style: { marginTop: '12px' }, 'data-testid': 'switch-role', onClick: () => state.setRole('validador') }, 'Trocar para o perfil Chefe do setor'));
  } else {
    formCard = h('div', { class: 'card success', 'data-testid': 'approve-card' }, h('h3', {}, 'Aprovar esta versão'),
      h('p', { class: 'small muted' }, 'A versão aprovada vira a referência oficial do processo e fica guardada no histórico, com validador, motivo, norma e checklist.'),
      h('label', { class: 'field', for: 'v-name' }, 'Nome do validador'), name,
      h('label', { class: 'field', for: 'v-motivo' }, 'O que esta versão registra ou muda'), motivo,
      h('label', { class: 'field', for: 'v-norma' }, 'Lei, decreto ou norma de referência (opcional)'), norma,
      h('div', { class: 'row', style: { marginTop: '16px' } },
        h('button', { class: 'btn danger', 'data-testid': 'reject', onClick: reject }, 'Devolver para ajustes'),
        h('button', { class: 'btn ok', style: { flex: 1 }, 'data-testid': 'approve', onClick: approve }, 'Aprovar versão')));
  }

  const semOrigem = sinais?.semOrigem > 0;
  const el = h('section', { class: 'page' }, bar.el, caseHint(id),
    h('div', { class: 'stack', style: { marginTop: '8px' } },
      waiting && h('div', { class: 'banner info' }, h('b', {}, 'Versão aguardando validação. '), `Perfil atual: ${ROLE_LABEL[state.role]}. Confira o fluxo contra as respostas da entrevista antes de decidir.`),
      sinais && !sinais.estruturaValida && h('div', { class: 'banner err' }, `A verificação estrutural encontrou ${sinais.erros.length} ponto(s) neste fluxo.`),
      semOrigem && h('div', { class: 'banner warn', 'data-testid': 'no-origin' }, h('b', {}, 'Etapa(s) sem origem na entrevista: '), `${sinais.semOrigemNomes.join('; ')}. Estão tracejadas em vermelho no diagrama.`),
      h('div', { class: 'grid-2' },
        h('div', { class: 'stack' },
          h('p', { class: 'small muted' }, 'Somente leitura. Clique numa etapa para ver de qual resposta da entrevista ela veio.'),
          h('div', { class: 'canvas-card' }, host),
          h('div', { class: 'card' }, h('h3', {}, 'Ficha do processo'), fichaTable(data.rascunho.modelo)),
          answersCard),
        h('div', { class: 'stack' }, formCard, isValidator && waiting && checklistCard, stepBox,
          data.versoes.length > 0 && h('div', { class: 'card' }, h('h3', {}, 'Versões anteriores'),
            data.versoes.slice().reverse().map((v) => h('div', { class: 'ver' }, h('b', {}, `Versão ${v.n}`), h('div', { class: 'muted small' }, `Aprovada em ${fmtDate(v.aprovada_em)} por ${v.validador}. ${v.motivo}`))))))));
  return {
    el,
    async mount() { viewer = await mountViewer(host, data.rascunho.xml, { onSelect }); markNoOrigin(viewer.instance, data.rascunho.modelo); },
    destroy() { viewer?.destroy(); },
  };
}
