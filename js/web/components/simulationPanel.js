// Painel "Simulação": escolhe como o modelo simulado vai se comportar na PRÓXIMA geração.
import { h } from '../dom.js';
import { toast, confirmDialog } from './ui.js';

export async function openSimulation({ api, onChange }) {
  const cfg = await api.getConfig();
  const dlg = h('dialog', { 'aria-labelledby': 'sim-title', class: 'wide' });
  const save = async (patch) => {
    try {
      Object.assign(cfg, await api.setConfig(patch));
      onChange?.(cfg);
    } catch (e) {
      toast(e.message, 'err');
    }
  };

  const scen = h('div', { class: 'stack', style: { gap: '4px' } }, cfg.cenarios.map((s) => h('label', { class: 'scenario' },
    h('input', { type: 'radio', name: 'scenario', value: s.id, checked: cfg.scenario === s.id, onChange: () => save({ scenario: s.id }) }),
    h('span', {}, h('b', {}, s.label), h('span', { class: 'muted small', style: { display: 'block' } }, s.descricao)))));

  dlg.append(h('div', { style: { padding: '20px' } },
    h('h3', { id: 'sim-title' }, 'Cenário do modelo simulado'),
    h('p', { class: 'muted small', style: { marginBottom: '12px' } }, 'Escolha como o modelo simulado vai responder na próxima geração. Os casos da tela inicial já configuram isso automaticamente.'),
    scen,
    h('div', { class: 'actions', style: { justifyContent: 'space-between', marginTop: '16px' } },
      h('button', { class: 'btn danger', type: 'button', onClick: async () => {
        if (!(await confirmDialog({ title: 'Reiniciar a demonstração?', description: 'Apaga todos os processos, versões e avaliações deste navegador.', submit: 'Reiniciar' }))) return;
        try {
          await api.resetDemo();
          toast('Demonstração reiniciada.');
          dlg.close();
          location.hash = '#/';
          location.reload();
        } catch (e) {
          toast(e.message, 'err');
        }
      } }, 'Reiniciar demonstração'),
      h('button', { class: 'btn primary', type: 'button', onClick: () => dlg.close() }, 'Fechar'))));

  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}
