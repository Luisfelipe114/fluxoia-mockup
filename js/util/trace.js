// Rastro de chamadas entre os componentes da arquitetura.
// Cada chamada entre componentes (ex.: web -> api, orchestrator -> llm) vira um evento.
// A tela "Arquitetura" assina este rastro para acender as setas do diagrama em tempo real.

/** Identificadores dos componentes, iguais aos boxes do diagrama de arquitetura. */
export const COMPONENTS = {
  user: 'Usuário',
  web: 'Interface web',
  api: 'API backend',
  ai: 'Componente de IA',
  orchestrator: 'Orquestração de IA',
  llm: 'Servidor de LLM',
  converter: 'Conversor BPMN',
  db: 'PostgreSQL (simulado)',
  reference: 'Material de referência',
};

export class Trace {
  constructor(limit = 500) {
    this.limit = limit;
    this.items = [];
    this.listeners = new Set();
    this.seq = 0;
  }

  add({ from, to, label, kind = 'call', detail = null }) {
    const item = { id: ++this.seq, t: Date.now(), from, to, label, kind, detail };
    this.items.push(item);
    if (this.items.length > this.limit) this.items.shift();
    for (const fn of this.listeners) fn(item);
    return item;
  }

  call(from, to, label, detail) { return this.add({ from, to, label, kind: 'call', detail }); }
  reply(from, to, label, detail) { return this.add({ from, to, label, kind: 'return', detail }); }
  info(at, label, detail) { return this.add({ from: at, to: at, label, kind: 'info', detail }); }
  error(from, to, label, detail) { return this.add({ from, to, label, kind: 'error', detail }); }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  clear() { this.items = []; for (const fn of this.listeners) fn(null); }
}
