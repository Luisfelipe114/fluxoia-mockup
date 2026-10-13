// Sobreposição de "processando": mostra, em linguagem simples, o que o sistema está fazendo.
import { h, clear } from '../dom.js';

/** Traduz um evento do rastro para uma frase para o usuário (ou null para ignorar). */
function friendly(item) {
  const { from, to, label, kind } = item;
  if (kind === 'error' && from === 'llm') return { text: `Servidor de LLM indisponível: ${label}`, bad: true };
  if (from === 'api' && to === 'api' && /monta o contexto da IA/.test(label)) return { text: 'Montando o contexto (catálogo e exemplos)' };
  if (from === 'api' && to === 'ai') return { text: 'Enviando o pedido ao componente de IA' };
  if (from === 'orchestrator' && to === 'orchestrator' && /tokens/.test(label)) return { text: `Prompt montado (${label.replace(/^.*?: /, '')})` };
  if (from === 'orchestrator' && to === 'llm') return { text: /corrigir/.test(label) ? `Pedindo correção ao modelo (${label.replace(/^.*\(|\)$/g, '')})` : 'Consultando o modelo' };
  if (from === 'orchestrator' && to === 'orchestrator' && /verificação/.test(label)) {
    const n = Number((label.match(/(\d+) problema/) ?? [])[1] ?? 0);
    return n ? { text: `Verificação estrutural: ${n} problema(s) encontrado(s)`, bad: true } : { text: 'Verificação estrutural: tudo certo', ok: true };
  }
  if (from === 'api' && to === 'converter') return { text: 'Convertendo para BPMN' };
  return null;
}

export function createBusy({ root, trace }) {
  return {
    async run(title, fn) {
      const list = h('ul', { class: 'steps', 'aria-live': 'polite' });
      const overlay = h('div', { class: 'overlay', role: 'alertdialog', 'aria-label': title },
        h('div', { class: 'box' }, h('div', {}, h('span', { class: 'spinner' }), h('span', { class: 'step' }, title)), list));
      root.append(overlay);
      const steps = [];
      const unsub = trace.subscribe((item) => {
        if (!item) return;
        const f = friendly(item);
        if (!f) return;
        steps.push(f);
        clear(list);
        steps.slice(-8).forEach((s, i, arr) => list.append(h('li', { class: `${i === arr.length - 1 ? 'now' : ''} ${s.bad ? 'bad' : ''} ${s.ok ? 'good' : ''}` }, s.text)));
      });
      try { return await fn(); } finally { unsub(); overlay.remove(); }
    },
  };
}
