// Diferença entre duas versões do modelo do processo (usada no histórico de versões).

export function diffModels(a, b) {
  const A = Object.fromEntries((a?.elementos ?? []).map((e) => [e.id, e]));
  const B = Object.fromEntries((b?.elementos ?? []).map((e) => [e.id, e]));
  const sec = (m, id) => m?.setores.find((s) => s.id === id)?.nome ?? '';

  const added = Object.values(B).filter((e) => !A[e.id]).map((e) => ({ id: e.id, nome: e.nome, tipo: e.tipo }));
  const removed = Object.values(A).filter((e) => !B[e.id]).map((e) => ({ id: e.id, nome: e.nome, tipo: e.tipo }));
  const changed = [];
  for (const id of Object.keys(B)) {
    if (!A[id]) continue;
    const campos = [];
    if (A[id].nome !== B[id].nome) campos.push(`nome: “${A[id].nome}” → “${B[id].nome}”`);
    if (sec(a, A[id].setor) !== sec(b, B[id].setor)) campos.push(`setor: ${sec(a, A[id].setor)} → ${sec(b, B[id].setor)}`);
    for (const f of ['documentos', 'sistemas', 'taxas']) {
      if (A[id][f].join('|') !== B[id][f].join('|')) campos.push(`${f} alterados`);
    }
    if (A[id].prazo !== B[id].prazo) campos.push(`prazo: ${A[id].prazo || '—'} → ${B[id].prazo || '—'}`);
    if (campos.length) changed.push({ id, nome: B[id].nome, campos });
  }
  const key = (f) => `${f.de}>${f.para}:${f.condicao}`;
  const FA = new Set((a?.fluxos ?? []).map(key));
  const FB = new Set((b?.fluxos ?? []).map(key));
  const flowsAdded = [...FB].filter((k) => !FA.has(k)).length;
  const flowsRemoved = [...FA].filter((k) => !FB.has(k)).length;
  return { added, removed, changed, flowsAdded, flowsRemoved, same: !added.length && !removed.length && !changed.length && !flowsAdded && !flowsRemoved };
}
