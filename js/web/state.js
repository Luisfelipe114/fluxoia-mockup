// Estado global mínimo da interface: o perfil em uso (servidor ou validador).
const KEY = 'fluxoia:role';

export const state = {
  role: (() => { try { return localStorage.getItem(KEY) || 'servidor'; } catch { return 'servidor'; } })(),
  listeners: new Set(),
  setRole(role) {
    this.role = role;
    try { localStorage.setItem(KEY, role); } catch { /* ignora */ }
    this.listeners.forEach((fn) => fn(role));
  },
  onRole(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
};

export const ROLE_LABEL = { servidor: 'Servidor', validador: 'Chefe do setor' };
