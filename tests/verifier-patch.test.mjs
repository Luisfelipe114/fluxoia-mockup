import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyModel } from '../js/ai/verifier.js';
import { applyPatch } from '../js/ai/patch.js';
import { EXAMPLE_ALVARA, CATALOG_SEED } from '../js/reference/seed.js';
import { cloneModel } from '../js/domain/model.js';
import { diffModels } from '../js/domain/diff.js';

test('verificação: o exemplo é válido e sem avisos de catálogo', () => {
  const v = verifyModel(EXAMPLE_ALVARA, CATALOG_SEED);
  assert.deepEqual(v.errors, []);
  assert.deepEqual(v.warnings, []);
});

test('verificação: decisão com uma saída, etapa solta e rótulo faltando', () => {
  const m = cloneModel(EXAMPLE_ALVARA);
  m.fluxos = m.fluxos.filter((f) => !(f.de === 'e7' && f.para === 'e10'));
  let v = verifyModel(m);
  assert.ok(v.errors.some((e) => /precisa de pelo menos duas saídas/.test(e)));
  assert.ok(v.errors.some((e) => /Nenhuma etapa leva a “Pedido indeferido”/.test(e)));

  const n = cloneModel(EXAMPLE_ALVARA);
  n.fluxos.find((f) => f.de === 'e3' && f.para === 'e5').condicao = '';
  v = verifyModel(n);
  assert.ok(v.errors.some((e) => /precisa de um rótulo/.test(e)));
});

test('verificação: início duplicado, sem fim, setor inexistente', () => {
  const m = cloneModel(EXAMPLE_ALVARA);
  m.elementos.push({ ...m.elementos[0], id: 'x1' });
  m.elementos = m.elementos.filter((e) => e.tipo !== 'fim');
  m.elementos.find((e) => e.id === 'e6').setor = 'zzz';
  const { errors } = verifyModel(m);
  assert.ok(errors.some((e) => /2 eventos de início/.test(e)));
  assert.ok(errors.some((e) => /não tem evento de fim/.test(e)));
  assert.ok(errors.some((e) => /não está em nenhum setor/.test(e)));
});

test('verificação: nomes fora do catálogo viram avisos, não erros', () => {
  const m = cloneModel(EXAMPLE_ALVARA);
  m.setores[0].nome = 'Setor de Guias';
  m.elementos[1].sistemas = ['Sistema Inventado'];
  const v = verifyModel(m, CATALOG_SEED);
  assert.deepEqual(v.errors, []);
  assert.equal(v.warnings.length, 2);
});

test('patch: mover de setor, renomear, inserir e remover religam o fluxo', () => {
  let r = applyPatch(EXAMPLE_ALVARA, [{ op: 'setSector', id: 'e2', setor: 's2' }, { op: 'rename', id: 'e6', nome: 'Avaliar projeto' }]);
  assert.deepEqual(r.errors, []);
  assert.equal(r.model.elementos.find((e) => e.id === 'e2').setor, 's2');
  assert.equal(r.model.elementos.find((e) => e.id === 'e6').nome, 'Avaliar projeto');

  r = applyPatch(EXAMPLE_ALVARA, [{ op: 'addAfter', after: 'e6', elemento: { nome: 'Notificar requerente' } }]);
  assert.deepEqual(r.errors, []);
  const novo = r.model.elementos.find((e) => e.nome === 'Notificar requerente');
  assert.ok(novo);
  assert.deepEqual(verifyModel(r.model).errors, []);
  assert.ok(r.model.fluxos.some((f) => f.de === 'e6' && f.para === novo.id));
  assert.ok(r.model.fluxos.some((f) => f.de === novo.id && f.para === 'e7'));

  r = applyPatch(EXAMPLE_ALVARA, [{ op: 'remove', id: 'e5' }]);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(verifyModel(r.model).errors, []);
  assert.ok(r.model.fluxos.some((f) => f.de === 'e3' && f.para === 'e6' && f.condicao === 'Sim'));
});

test('patch: operações inválidas viram erros e não alteram o original', () => {
  const copia = JSON.stringify(EXAMPLE_ALVARA);
  const r = applyPatch(EXAMPLE_ALVARA, [{ op: 'remove', id: 'e1' }, { op: 'remove', id: 'e7' }, { op: 'addAfter', after: 'e3', elemento: { nome: 'x' } }, { op: 'setSector', id: 'e2', setor: 'nada' }, { op: 'zzz' }]);
  assert.equal(r.errors.length, 5);
  assert.equal(JSON.stringify(EXAMPLE_ALVARA), copia);
});

test('diff entre versões lista o que mudou', () => {
  const b = applyPatch(EXAMPLE_ALVARA, [{ op: 'rename', id: 'e6', nome: 'Avaliar projeto' }, { op: 'addAfter', after: 'e6', elemento: { nome: 'Notificar requerente' } }]).model;
  const d = diffModels(EXAMPLE_ALVARA, b);
  assert.equal(d.added.length, 1);
  assert.equal(d.changed[0].campos[0], 'nome: “Analisar projeto” → “Avaliar projeto”');
  assert.equal(d.same, false);
  assert.equal(diffModels(EXAMPLE_ALVARA, EXAMPLE_ALVARA).same, true);
});
