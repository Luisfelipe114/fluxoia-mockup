// Interface web: cabeçalho, roteamento e montagem das telas. Só recebe `api`, `trace` e o estado.
import { h, clear } from './dom.js';
import { createApiClient } from './apiClient.js';
import { state, ROLE_LABEL } from './state.js';
import { parseHash, links } from './router.js';
import { initToasts, toast } from './components/ui.js';
import { createBusy } from './components/busy.js';
import { homeView } from './views/home.js';
import { interviewView } from './views/interview.js';
import { draftView } from './views/draft.js';
import { approvalView } from './views/approval.js';
import { versionsView } from './views/versions.js';
import { openSimulation } from './components/simulationPanel.js';

const VIEWS = { home: homeView, interview: interviewView, draft: draftView, approval: approvalView, versions: versionsView };

export function startWeb({ api: rawApi, trace }) {
  const root = document.getElementById('app');
  const toastRoot = h('div', { class: 'toasts' });
  document.body.append(toastRoot);
  initToasts(toastRoot);

  const api = createApiClient({ api: rawApi, state, trace });
  const busy = createBusy({ root: document.body, trace });
  const ctx = { api, trace, state, busy };

  const simBtn = h('button', { class: 'link-btn small muted', 'data-testid': 'sim-btn', onClick: () => openSimulation({ api, onChange: drawSim }), title: 'Configurações de simulação do modelo e dados', style: { marginLeft: '12px', textDecoration: 'underline' } }, 'Simulação');
  const drawSim = (cfg) => { simBtn.replaceChildren('Simulação: ', h('b', {}, cfg.cenarios.find((s) => s.id === cfg.scenario)?.label ?? cfg.scenario)); };
  api.getConfig().then(drawSim).catch(() => {});
  const roleSwitch = h('div', { class: 'role', role: 'group', 'aria-label': 'Perfil em uso' });
  const header = h('header', { class: 'topbar' },
    h('a', { class: 'brand', href: links.home() }, h('strong', {}, 'FluxoIA'), h('span', {}, 'Mapeamento de processos da SECTI')),
    h('span', { class: 'spacer' }), h('span', { class: 'badge-mock', title: 'API, banco e modelo são simulados no navegador' }, 'Mockup · dados simulados'), roleSwitch);
  const main = h('main', { id: 'view', tabindex: '-1' });
  clear(root).append(header, main, h('footer', { class: 'footer' },
    h('span', {}, 'FluxoIA · mockup do projeto da Fábrica de IA do Piauí (UFPI e SECTI). Todos os dados são fictícios e ficam só neste navegador.'),
    h('span', { style: { marginLeft: '12px' } }, '·'),
    simBtn));

  const drawRole = () => {
    clear(roleSwitch);
    for (const r of ['servidor', 'validador']) roleSwitch.append(h('button', { type: 'button', 'aria-pressed': String(state.role === r), onClick: () => state.setRole(r) }, ROLE_LABEL[r]));
  };

  let current = null;
  let seq = 0;
  async function route() {
    const my = ++seq;
    const r = parseHash();
    current?.destroy?.();
    current = null;
    clear(main).append(h('div', { class: 'page' }, h('p', { class: 'muted' }, 'Carregando…')));
    const view = VIEWS[r.name];
    try {
      if (!view) throw new Error('Página não encontrada.');
      const result = await view(ctx, r.params);
      if (my !== seq) { result.destroy?.(); return; }
      current = result;
      clear(main).append(result.el);
      await result.mount?.();
      window.scrollTo(0, 0);
    } catch (e) {
      if (my !== seq) return;
      console.error(e);
      clear(main).append(h('div', { class: 'page' }, h('div', { class: 'banner err' }, `Não foi possível abrir esta página: ${e.message}`), h('p', { style: { marginTop: '12px' } }, h('a', { href: links.home() }, 'Voltar para o início'))));
      toast(e.message, 'err');
    }
  }

  state.onRole(() => { drawRole(); route(); });
  window.addEventListener('hashchange', route);
  drawRole();
  route();
  return { ctx };
}
