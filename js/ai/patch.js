// Ajustes por "patch": o modelo devolve operações pequenas e o código as aplica.
// Vantagens: preserva as edições manuais do servidor, gera diff entre versões e deixa a auditoria por operação.
//
// Operações:
//   { op: 'setSector', id, setor }                 move uma etapa para outro setor
//   { op: 'rename',    id, nome }                  renomeia
//   { op: 'addAfter',  after, elemento: {nome, tipo?, setor?} }   insere uma etapa depois de outra
//   { op: 'remove',    id }                        remove uma etapa e religa o fluxo

import { byId, cloneModel, incoming, nextElementId, outgoing } from '../domain/model.js';

export function applyPatch(model, ops) {
  const m = cloneModel(model);
  const applied = [], errors = [];

  for (const op of ops ?? []) {
    const idx = byId(m);
    try {
      if (op.op === 'setSector') {
        if (!idx[op.id]) throw new Error(`Etapa ${op.id} não existe.`);
        if (!m.setores.some((s) => s.id === op.setor)) throw new Error(`Setor ${op.setor} não existe.`);
        idx[op.id].setor = op.setor;
        applied.push(op);
      } else if (op.op === 'rename') {
        if (!idx[op.id]) throw new Error(`Etapa ${op.id} não existe.`);
        if (!String(op.nome ?? '').trim()) throw new Error('Nome vazio.');
        idx[op.id].nome = String(op.nome).trim();
        applied.push(op);
      } else if (op.op === 'addAfter') {
        const a = idx[op.after];
        if (!a) throw new Error(`Etapa ${op.after} não existe.`);
        if (a.tipo === 'fim') throw new Error('Não dá para inserir uma etapa depois de um fim.');
        const out = outgoing(m, a.id);
        if (out.length !== 1) throw new Error(`“${a.nome}” tem ${out.length} saídas; o ponto de inserção é ambíguo.`);
        const id = nextElementId(m);
        const novo = {
          id, tipo: op.elemento?.tipo ?? 'tarefa', nome: String(op.elemento?.nome ?? '').trim(),
          setor: op.elemento?.setor ?? a.setor, documentos: [], sistemas: [], taxas: [], prazo: '', origem: op.elemento?.origem ?? 'inserida por pedido de ajuste',
        };
        if (!novo.nome) throw new Error('Nome vazio.');
        const f = out[0];
        m.elementos.splice(m.elementos.findIndex((e) => e.id === a.id) + 1, 0, novo);
        const target = f.para;
        f.para = id;
        m.fluxos.push({ de: id, para: target, condicao: '' });
        applied.push({ ...op, novoId: id });
      } else if (op.op === 'remove') {
        const e = idx[op.id];
        if (!e) throw new Error(`Etapa ${op.id} não existe.`);
        if (e.tipo === 'inicio') throw new Error('O evento de início não pode ser removido.');
        if (e.tipo === 'decisao') throw new Error('Decisões não podem ser removidas por ajuste; edite no diagrama.');
        const out = outgoing(m, e.id), inc = incoming(m, e.id);
        if (e.tipo === 'fim') {
          if (m.elementos.filter((x) => x.tipo === 'fim').length < 2) throw new Error('O único evento de fim não pode ser removido.');
          m.fluxos = m.fluxos.filter((f) => f.para !== e.id && f.de !== e.id);
        } else {
          if (out.length !== 1) throw new Error(`“${e.nome}” não tem uma única etapa seguinte; não dá para religar o fluxo.`);
          const target = out[0].para;
          inc.forEach((f) => { f.para = target; });
          m.fluxos = m.fluxos.filter((f) => f.de !== e.id);
        }
        m.elementos = m.elementos.filter((x) => x.id !== e.id);
        applied.push(op);
      } else {
        throw new Error(`Operação desconhecida: ${op.op}`);
      }
    } catch (err) {
      errors.push(err.message);
    }
  }
  return { model: m, applied, errors };
}
