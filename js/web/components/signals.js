// "Sobre este rascunho": sinais VERIFICÁVEIS de como o diagrama foi montado.
// Não existe "score de confiança" do modelo: a confiança declarada por um LLM sobre si mesmo não é confiável.
import { h } from '../dom.js';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const sig = (cls, icon, title, text) => h('div', { class: `signal ${cls}` }, h('span', { class: 'ic', 'aria-hidden': 'true' }, icon), h('div', {}, h('b', {}, title), h('div', { class: 'muted small' }, text)));

export function signalsPanel(s) {
  if (!s) return h('div', { class: 'card' }, h('h3', {}, 'Sobre este rascunho'), h('p', { class: 'muted small' }, 'Gere o fluxo para ver os sinais de como ele foi montado.'));
  const restaurada = /restaurada/.test(s.modelo);
  return h('div', { class: 'card', 'data-testid': 'signals' },
    h('h3', {}, 'Sobre este rascunho'),
    h('div', { class: 'stack', style: { gap: '12px' } },
      s.estruturaValida
        ? sig('ok', '✓', 'Estrutura válida', 'Início único, decisões com duas saídas, nenhuma etapa solta.')
        : sig('bad', '!', `${s.erros.length} ponto(s) a corrigir`, 'A verificação estrutural encontrou problemas (veja a lista acima do diagrama).'),
      !s.estruturaValida && s.correcoes > 0
        ? sig('bad', '↻', `${plural(s.correcoes, 'tentativa de correção sem sucesso', 'tentativas de correção sem sucesso')}`, 'O modelo não conseguiu corrigir sozinho: corrija no diagrama ou gere de novo.')
        : sig('', '↻', s.correcoes ? plural(s.correcoes, 'correção automática', 'correções automáticas') : 'Nenhuma correção automática', s.correcoes ? 'O verificador achou problemas e o modelo corrigiu antes de mostrar o desenho.' : 'A primeira resposta do modelo já passou na verificação.'),
      sig('', 'i', restaurada ? `Origem: ${s.modelo}` : `Modelo: ${s.modelo}`, restaurada ? 'Fica registrado para auditoria.' : `${s.promptVersion} · Auditável`),
      s.semOrigem > 0 && sig('bad', '?', plural(s.semOrigem, 'etapa sem origem na entrevista', 'etapas sem origem na entrevista'), `${(s.semOrigemNomes ?? []).join('; ')}. Marcada(s) com tracejado vermelho no diagrama: confirme se existem de verdade.`),
      s.editadoManualmente && sig('', '✎', 'Editado manualmente no diagrama', 'As edições foram convertidas de volta para o modelo do processo.'),
      s.avisos.length > 0 && sig('', '⚠', `${s.avisos.length} aviso(s) de catálogo`, s.avisos.slice(0, 3).join(' '))),
    h('p', { class: 'muted small', style: { marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--line-soft)' } },
      'Estes indicadores avaliam a conformidade formal do diagrama. A validação das regras do setor depende da revisão humana.'));
}
