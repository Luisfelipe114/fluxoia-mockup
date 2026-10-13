// Roteador por hash (#/...), compatível com GitHub Pages (sem servidor de rotas).
const ROUTES = [
  { re: /^\/?$/, name: 'home', keys: [] },
  { re: /^\/processo\/([^/]+)\/entrevista$/, name: 'interview', keys: ['id'] },
  { re: /^\/processo\/([^/]+)\/rascunho$/, name: 'draft', keys: ['id'] },
  { re: /^\/processo\/([^/]+)\/validacao$/, name: 'approval', keys: ['id'] },
  { re: /^\/processo\/([^/]+)\/versoes$/, name: 'versions', keys: ['id'] },
];

export function parseHash(hash = location.hash) {
  const path = hash.replace(/^#/, '') || '/';
  for (const r of ROUTES) {
    const m = r.re.exec(path);
    if (m) return { name: r.name, params: Object.fromEntries(r.keys.map((k, i) => [k, m[i + 1] ? decodeURIComponent(m[i + 1]) : undefined])), path };
  }
  return { name: 'notfound', params: {}, path };
}

export const navigate = (path) => { location.hash = path; };
export const links = {
  home: () => '#/',
  interview: (id) => `#/processo/${id}/entrevista`,
  draft: (id) => `#/processo/${id}/rascunho`,
  approval: (id) => `#/processo/${id}/validacao`,
  versions: (id) => `#/processo/${id}/versoes`,
};
