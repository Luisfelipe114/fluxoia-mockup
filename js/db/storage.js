// Adaptadores de armazenamento do banco simulado.
// No navegador usamos localStorage; nos testes, memória.

export function createLocalStorageAdapter(key = 'fluxoia:db:v1') {
  return {
    load() {
      try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
    },
    save(data) {
      try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* cota cheia: ignora no mockup */ }
    },
    clear() { try { localStorage.removeItem(key); } catch { /* ignora */ } },
  };
}

export function createMemoryAdapter(initial = null) {
  let data = initial;
  return {
    load() { return data ? JSON.parse(JSON.stringify(data)) : null; },
    save(d) { data = JSON.parse(JSON.stringify(d)); },
    clear() { data = null; },
  };
}
