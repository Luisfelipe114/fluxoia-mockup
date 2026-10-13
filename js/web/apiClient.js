// Cliente da API usado pela interface. É a ÚNICA porta de saída da interface web:
// nenhuma view importa banco, IA ou conversor. Cada chamada também registra a "ação do usuário" no rastro.

export class ApiError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}

const USER_ACTIONS = [
  [/^POST \/processos$/, 'cria um processo'],
  [/\/respostas$/, 'responde à entrevista'],
  [/\/gerar$/, 'clica em “Gerar fluxo”'],
  [/\/ajustar$/, 'pede um ajuste por texto'],
  [/\/xml$/, 'edita o diagrama'],
  [/\/enviar-validacao$/, 'envia para validação'],
  [/\/aprovar$/, 'aprova a versão'],
  [/\/devolver$/, 'devolve para ajustes'],
  [/\/restaurar$/, 'restaura uma versão'],
  [/\/feedback$/, 'avalia o rascunho'],
  [/\/exportar$/, 'exporta o .bpmn'],
];

export function createApiClient({ api, state, trace }) {
  async function call(method, path, body) {
    const hit = USER_ACTIONS.find(([re]) => re.test(`${method} ${path}`));
    if (hit && method !== 'GET') trace.call('user', 'web', hit[1], { role: state.role });
    const res = await api.request(method, path, { body, role: state.role });
    if (res.status >= 400) throw new ApiError(res.status, res.error, res.extra);
    return res.data;
  }
  const enc = encodeURIComponent;
  return {
    listProcesses: () => call('GET', '/processos'),
    createProcess: (nome) => call('POST', '/processos', { nome }),
    getProcess: (id) => call('GET', `/processos/${enc(id)}`),
    saveAnswers: (id, respostas) => call('PUT', `/processos/${enc(id)}/respostas`, { respostas }),
    generate: (id) => call('POST', `/processos/${enc(id)}/gerar`),
    adjust: (id, pedido) => call('POST', `/processos/${enc(id)}/ajustar`, { pedido }),
    saveXml: (id, xml) => call('PUT', `/processos/${enc(id)}/xml`, { xml }),
    submit: (id) => call('POST', `/processos/${enc(id)}/enviar-validacao`),
    approve: (id, dados) => call('POST', `/processos/${enc(id)}/aprovar`, dados),
    reject: (id, observacao) => call('POST', `/processos/${enc(id)}/devolver`, { observacao }),
    versionDiff: (id, n) => call('GET', `/processos/${enc(id)}/versoes/${n}/diff`),
    restoreVersion: (id, n) => call('POST', `/processos/${enc(id)}/versoes/${n}/restaurar`),
    feedback: (id, nota, comentario) => call('POST', `/processos/${enc(id)}/feedback`, { nota, comentario }),
    exportBpmn: (id) => call('GET', `/processos/${enc(id)}/exportar`),
    history: (id) => call('GET', `/processos/${enc(id)}/historico`),
    script: () => call('GET', '/roteiro'),
    getConfig: () => call('GET', '/config'),
    setConfig: (patch) => call('PUT', '/config', patch),
    resetDemo: () => call('POST', '/demo/reiniciar'),
  };
}
