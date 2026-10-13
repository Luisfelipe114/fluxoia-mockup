// Modelo do processo (representação intermediária, "JSON do processo").
// É a fonte de verdade do sistema: o BPMN em XML é sempre derivado dele.
//
// {
//   processo, objetivo,
//   setores:   [{ id, nome }],
//   elementos: [{ id, tipo: 'inicio'|'tarefa'|'decisao'|'fim', nome, setor, documentos[], sistemas[], taxas[], prazo, origem }],
//   fluxos:    [{ de, para, condicao }]
// }

export const TIPOS = ['inicio', 'tarefa', 'decisao', 'fim'];

const asList = (v) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : v ? [String(v)] : []);

/** Aceita qualquer JSON "quase certo" (vindo de um LLM) e devolve um modelo bem formado. */
export function normalizeModel(raw, fallbackName = 'Processo sem nome') {
  const j = raw && typeof raw === 'object' ? raw : {};
  const out = { processo: String(j.processo || fallbackName), objetivo: String(j.objetivo || ''), setores: [], elementos: [], fluxos: [] };

  (Array.isArray(j.setores) ? j.setores : []).forEach((s, i) => {
    if (s && (s.nome || s.id)) out.setores.push({ id: String(s.id || `s${i + 1}`), nome: String(s.nome || s.id) });
  });
  if (!out.setores.length) out.setores.push({ id: 's1', nome: 'Setor' });

  (Array.isArray(j.elementos) ? j.elementos : []).forEach((e, i) => {
    if (!e) return;
    let tipo = String(e.tipo || 'tarefa').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!TIPOS.includes(tipo)) {
      tipo = /decis|gateway/.test(tipo) ? 'decisao' : /inic|start/.test(tipo) ? 'inicio' : /fim|end/.test(tipo) ? 'fim' : 'tarefa';
    }
    out.elementos.push({
      id: String(e.id || `e${i + 1}`), tipo, nome: String(e.nome || ''), setor: String(e.setor || ''),
      documentos: asList(e.documentos), sistemas: asList(e.sistemas), taxas: asList(e.taxas),
      prazo: String(e.prazo || ''), origem: String(e.origem || ''),
    });
  });

  (Array.isArray(j.fluxos) ? j.fluxos : []).forEach((f) => {
    if (f && f.de && f.para) out.fluxos.push({ de: String(f.de), para: String(f.para), condicao: String(f.condicao || '') });
  });
  return out;
}

export const cloneModel = (m) => JSON.parse(JSON.stringify(m));
export const byId = (m) => Object.fromEntries(m.elementos.map((e) => [e.id, e]));
export const outgoing = (m, id) => m.fluxos.filter((f) => f.de === id);
export const incoming = (m, id) => m.fluxos.filter((f) => f.para === id);
export const sectorName = (m, id) => m.setores.find((s) => s.id === id)?.nome ?? '';

/** Próximo id livre no padrão e1, e2, ... */
export function nextElementId(m) {
  const used = new Set(m.elementos.map((e) => e.id));
  let n = m.elementos.length + 1;
  while (used.has(`e${n}`)) n++;
  return `e${n}`;
}
