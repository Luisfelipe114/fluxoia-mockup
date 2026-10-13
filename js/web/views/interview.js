import { h, clear } from '../dom.js';
import { toast } from '../components/ui.js';
import { processBar } from '../components/processBar.js';
import { caseHint } from '../components/caseHint.js';
import { links, navigate } from '../router.js';

export async function interviewView(ctx, { id }) {
  const { api } = ctx;
  const [data, script] = await Promise.all([api.getProcess(id), api.script()]);
  const questions = script.roteiro.questions;
  const answers = { ...data.respostas };
  let alertas = data.alertas ?? [];
  let genError = null;
  let editing = null;
  const locked = data.processo.status !== 'rascunho';
  const bar = processBar({ processo: data.processo, active: 'interview', role: ctx.state.role, hasDraft: Boolean(data.rascunho) });

  const chat = h('div', { class: 'chat', 'aria-live': 'polite' });
  const alertHost = h('div', {});
  const composerHost = h('div', {});
  const progress = h('div', { class: 'row', style: { gap: '16px' } });

  const currentQuestion = () => (editing ? questions.find((q) => q.id === editing) : questions.find((q) => answers[q.id] === undefined) ?? null);
  const labelOf = (campo) => questions.find((q) => q.id === campo)?.q ?? campo;

  async function persist() {
    const res = await api.saveAnswers(id, answers);
    alertas = res.alertas ?? [];
  }

  async function submit(q, text, skip = false) {
    const value = skip ? '' : text.trim();
    if (!skip && !value) return;
    answers[q.id] = value;
    editing = null;
    genError = null;
    try { await persist(); } catch (e) { toast(e.message, 'err'); }
    render();
  }

  async function fillExample(key) {
    Object.assign(answers, script.exemplos[key]);
    genError = null;
    try { await persist(); } catch (e) { return toast(e.message, 'err'); }
    render();
    toast('Respostas de exemplo preenchidas. Revise e gere o fluxo.');
  }

  async function generate() {
    genError = null;
    try {
      const res = await ctx.busy.run('Gerando o fluxo', () => api.generate(id));
      const n = res.meta.correcoes;
      toast(res.ok ? `Fluxo gerado${n ? ` com ${n} correção${n > 1 ? 'ões' : ''} automática${n > 1 ? 's' : ''}` : ''}.` : 'O fluxo foi gerado com pontos a corrigir.', res.ok ? 'info' : 'err');
      navigate(links.draft(id));
    } catch (e) {
      if (e.status === 422 && e.extra?.alertas) alertas = e.extra.alertas;
      else genError = { message: e.message, status: e.status };
      render();
    }
  }

  function renderAlerts() {
    clear(alertHost);
    if (alertas.length) {
      alertHost.append(h('div', { class: 'banner err', 'data-testid': 'pii-alert' }, h('b', {}, 'Dados pessoais nas respostas. '), 'A geração fica bloqueada até você trocar por setores e cargos (use “Editar resposta”).',
        h('ul', {}, alertas.map((a) => h('li', {}, `${a.tipo} (${a.trecho}) em: “${labelOf(a.campo)}”`)))));
    }
    if (genError) {
      alertHost.append(h('div', { class: 'banner err', 'data-testid': 'gen-error' },
        h('b', {}, genError.status === 503 ? 'Não consegui falar com o servidor de LLM. ' : 'Não foi possível gerar o fluxo. '), genError.message,
        h('div', { class: 'small', style: { marginTop: '4px' } }, 'Suas respostas estão salvas. Em Simulação você pode mudar o cenário; depois, tente de novo.'),
        h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn small', 'data-testid': 'retry', onClick: generate }, 'Tentar de novo'))));
    }
  }

  function render() {
    const cur = currentQuestion();
    clear(progress).append(
      h('b', { class: 'small' }, cur ? `Pergunta ${questions.indexOf(cur) + 1} de ${questions.length}` : 'Entrevista respondida'),
      h('div', { class: 'segments', 'aria-hidden': 'true' }, questions.map((q) => h('div', { class: `seg ${answers[q.id] !== undefined ? 'done' : q === cur ? 'cur' : ''}` }))));

    clear(chat);
    for (const q of questions) {
      const a = answers[q.id];
      if (a === undefined && q !== cur) continue;
      chat.append(h('div', { class: 'q' }, h('div', { class: 'who' }, 'FluxoIA'), h('div', { class: `bubble${q === cur ? ' current' : ''}` }, q.q, h('span', { class: 'hint' }, q.hint))));
      if (a !== undefined && q !== cur) {
        chat.append(h('div', { class: 'a' }, a || h('em', {}, 'Sem resposta'),
          !locked && h('button', { class: 'link-btn small', onClick: () => { editing = q.id; render(); } }, 'Editar resposta')));
      }
    }

    renderAlerts();
    clear(composerHost);
    if (locked) {
      composerHost.append(h('div', { class: 'banner info' }, 'Este processo está em validação ou aprovado, então a entrevista fica bloqueada. Para alterar, ', h('a', { href: links.draft(id) }, 'abra o rascunho'), ' (qualquer edição inicia uma nova versão).'));
      return;
    }
    if (cur) {
      const ta = h('textarea', { class: 'textarea', id: 'answer', 'aria-label': 'Sua resposta', placeholder: 'Escreva sua resposta', value: answers[cur.id] ?? '' });
      ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(cur, ta.value); } });
      composerHost.append(h('div', { class: 'card' },
        h('label', { class: 'field', for: 'answer', style: { marginTop: 0 } }, 'Sua resposta'), ta,
        h('div', { class: 'row between', style: { marginTop: '12px' } },
          h('div', { class: 'row' },
            h('span', { class: 'muted small' }, 'Preencher tudo com exemplo:'),
            h('button', { class: 'btn small', type: 'button', onClick: () => fillExample('alvara') }, 'alvará'),
            h('button', { class: 'btn small', type: 'button', onClick: () => fillExample('sanitaria') }, 'licença sanitária')),
          h('div', { class: 'row' },
            h('button', { class: 'btn ghost', type: 'button', onClick: () => submit(cur, '', true) }, 'Pular'),
            h('button', { class: 'btn primary', type: 'button', onClick: () => submit(cur, ta.value) }, 'Responder')))));
      setTimeout(() => ta.focus(), 30);
    } else {
      composerHost.append(h('div', { class: 'card accent' },
        h('h3', {}, 'Tudo respondido'),
        h('p', { class: 'small muted', style: { marginBottom: '12px' } }, 'Ao gerar, o sistema monta o contexto, consulta o modelo, verifica a estrutura do fluxo (e pede correção se precisar) e converte para BPMN.'),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', 'data-testid': 'generate', disabled: alertas.length > 0, onClick: generate }, data.rascunho ? 'Gerar de novo a partir da entrevista' : 'Gerar fluxo'),
          data.rascunho && h('a', { class: 'btn', href: links.draft(id) }, 'Ver o rascunho atual'),
          alertas.length > 0 && h('span', { class: 'small', style: { color: 'var(--danger)' } }, 'Resolva o alerta de dados pessoais para gerar.'))));
    }
  }
  render();

  return { el: h('section', { class: 'page narrow' }, bar.el, caseHint(id), h('div', { class: 'stack', style: { marginTop: '16px' } }, progress, chat, alertHost, composerHost)) };
}
