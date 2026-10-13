// Verificação estrutural do modelo do processo (código comum, sem IA).
// Garante que o desenho é um fluxo BPMN bem formado. NÃO decide se o processo descrito está certo:
// isso é a validação humana (chefe do setor).

import { byId, incoming, outgoing } from '../domain/model.js';
import { norm, uniq } from '../util/text.js';

const inCatalog = (list, nome) => {
  const n = norm(nome);
  return (list ?? []).some((c) => { const m = norm(c.nome); return m === n || m.includes(n) || n.includes(m); });
};

/**
 * @returns {{errors:string[], warnings:string[]}}
 *   errors   -> impedem o envio para validação e disparam autocorreção
 *   warnings -> avisos (ex.: nome fora do catálogo institucional)
 */
export function verifyModel(model, catalogo = null) {
  const errors = [], warnings = [];
  const idx = byId(model);
  const setorIds = new Set(model.setores.map((s) => s.id));

  const seen = new Set();
  model.elementos.forEach((e) => {
    if (seen.has(e.id)) errors.push(`O identificador ${e.id} aparece mais de uma vez.`);
    seen.add(e.id);
  });

  const starts = model.elementos.filter((e) => e.tipo === 'inicio');
  const ends = model.elementos.filter((e) => e.tipo === 'fim');
  if (starts.length !== 1) errors.push(starts.length ? `O fluxo tem ${starts.length} eventos de início; deve ter um só.` : 'O fluxo não tem evento de início.');
  if (!ends.length) errors.push('O fluxo não tem evento de fim.');
  if (!model.elementos.some((e) => e.tipo === 'tarefa')) errors.push('O fluxo não tem nenhuma etapa.');

  model.elementos.forEach((e) => {
    const nm = e.nome || e.id;
    if (!setorIds.has(e.setor)) errors.push(`“${nm}” não está em nenhum setor listado.`);
    if (!e.nome.trim() && (e.tipo === 'tarefa' || e.tipo === 'decisao')) errors.push(`Há um elemento sem nome (${e.id}).`);
  });

  model.fluxos.forEach((f) => {
    if (!idx[f.de] || !idx[f.para]) errors.push(`Uma ligação aponta para uma etapa que não existe (${f.de} → ${f.para}).`);
  });
  const valid = model.fluxos.filter((f) => idx[f.de] && idx[f.para]);
  const vm = { ...model, fluxos: valid };

  model.elementos.forEach((e) => {
    const out = outgoing(vm, e.id), inc = incoming(vm, e.id), nm = e.nome || e.id;
    if (e.tipo !== 'fim' && !out.length) errors.push(`“${nm}” não leva a nenhuma etapa seguinte.`);
    if (e.tipo !== 'inicio' && !inc.length) errors.push(`Nenhuma etapa leva a “${nm}”.`);
    if (e.tipo === 'fim' && out.length) errors.push(`O fim “${nm}” não pode ter etapa seguinte.`);
    if (e.tipo === 'decisao') {
      if (out.length < 2) errors.push(`A decisão “${nm}” precisa de pelo menos duas saídas.`);
      else if (out.some((f) => !f.condicao.trim())) errors.push(`Cada saída da decisão “${nm}” precisa de um rótulo (ex.: Sim, Não).`);
    }
  });

  if (starts.length) {
    const seenIds = new Set([starts[0].id]);
    const queue = [starts[0].id];
    while (queue.length) {
      const v = queue.shift();
      outgoing(vm, v).forEach((f) => { if (!seenIds.has(f.para)) { seenIds.add(f.para); queue.push(f.para); } });
    }
    model.elementos.forEach((e) => {
      if (!seenIds.has(e.id) && e.tipo !== 'inicio') errors.push(`“${e.nome || e.id}” não é alcançável a partir do início.`);
    });
  }

  if (model.elementos.filter((e) => e.tipo === 'tarefa').length === 1) warnings.push('O fluxo tem só uma etapa: confira se a entrevista descreveu o passo a passo completo.');

  if (catalogo) {
    model.setores.forEach((s) => { if (!inCatalog(catalogo.setores, s.nome)) warnings.push(`Setor “${s.nome}” não está no catálogo institucional.`); });
    model.elementos.forEach((e) => {
      e.sistemas.forEach((s) => { if (!inCatalog(catalogo.sistemas, s)) warnings.push(`Sistema “${s}” (em “${e.nome}”) não está no catálogo.`); });
      e.taxas.forEach((t) => { if (!inCatalog(catalogo.taxas, t)) warnings.push(`Taxa “${t}” (em “${e.nome}”) não está no catálogo.`); });
    });
  }
  return { errors: uniq(errors), warnings: uniq(warnings) };
}
