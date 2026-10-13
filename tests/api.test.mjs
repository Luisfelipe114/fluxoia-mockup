import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBackend, createProcessWithAnswers } from './helpers.mjs';
import { SAMPLE_ANSWERS } from '../js/reference/seed.js';
import { SAMPLE_PESSOAL } from '../js/reference/seed.js';

test('API: fluxo completo servidor -> validador, com papéis e versões', async () => {
  const { call } = await makeBackend();
  const id = await createProcessWithAnswers(call);

  let r = await call('POST', `/processos/${id}/enviar-validacao`);
  assert.equal(r.status, 409, 'sem rascunho não envia');

  r = await call('POST', `/processos/${id}/gerar`);
  assert.equal(r.status, 200); assert.equal(r.data.ok, true);

  r = await call('GET', `/processos/${id}`);
  assert.equal(r.data.processo.status, 'rascunho');
  assert.equal(r.data.sinais.estruturaValida, true);
  assert.equal(r.data.sinais.semOrigem, 0);
  assert.match(r.data.rascunho.xml, /<bpmn:definitions/);

  r = await call('POST', `/processos/${id}/enviar-validacao`);
  assert.equal(r.status, 200);
  r = await call('POST', `/processos/${id}/aprovar`, { body: { validador: 'A', motivo: 'm' }, role: 'servidor' });
  assert.equal(r.status, 403);
  r = await call('POST', `/processos/${id}/aprovar`, { body: { validador: '', motivo: '' }, role: 'validador' });
  assert.equal(r.status, 422);
  r = await call('POST', `/processos/${id}/devolver`, { body: { observacao: 'ajustar a etapa X' }, role: 'validador' });
  assert.equal(r.status, 200);
  r = await call('GET', `/processos/${id}`);
  assert.equal(r.data.processo.status, 'rascunho'); assert.equal(r.data.processo.devolucao, 'ajustar a etapa X');

  await call('POST', `/processos/${id}/enviar-validacao`);
  r = await call('POST', `/processos/${id}/aprovar`, { body: { validador: 'Chefe', motivo: 'Primeira versão', norma: 'Decreto 1' }, role: 'validador' });
  assert.deepEqual(r.data, { ok: true, n: 1 });

  r = await call('PUT', `/processos/${id}/respostas`, { body: { respostas: SAMPLE_ANSWERS } });
  assert.equal(r.status, 409, 'aprovado não aceita novas respostas');

  r = await call('POST', `/processos/${id}/ajustar`, { body: { pedido: 'renomeie Avaliar projeto para Analisar projeto' } });
  assert.equal(r.data.mudou, true); assert.equal(r.data.voltouParaRascunho, true);
  await call('POST', `/processos/${id}/enviar-validacao`);
  r = await call('POST', `/processos/${id}/aprovar`, { body: { validador: 'Chefe', motivo: 'Renomeia etapa' }, role: 'validador' });
  assert.equal(r.data.n, 2);

  r = await call('GET', `/processos/${id}/versoes/2/diff`);
  assert.equal(r.data.de, 1);
  assert.equal(r.data.diff.changed.length, 1);
  r = await call('POST', `/processos/${id}/versoes/1/restaurar`);
  assert.equal(r.status, 200);
  r = await call('GET', `/processos/${id}`);
  assert.equal(r.data.processo.status, 'rascunho');
  assert.equal(r.data.versoes.length, 2);
  assert.ok(r.data.rascunho.modelo.elementos.some((e) => e.nome === 'Avaliar projeto'));
});

test('API: edição no diagrama (XML) volta pelo conversor e mantém os metadados', async () => {
  const { call } = await makeBackend();
  const id = await createProcessWithAnswers(call);
  await call('POST', `/processos/${id}/gerar`);
  let r = await call('GET', `/processos/${id}`);
  const xml = r.data.rascunho.xml.replace('name="Assinar alvará"', 'name="Assinar o alvará"');
  r = await call('PUT', `/processos/${id}/xml`, { body: { xml } });
  assert.equal(r.status, 200); assert.equal(r.data.sinais.editadoManualmente, true);
  r = await call('GET', `/processos/${id}`);
  const e = r.data.rascunho.modelo.elementos.find((x) => x.nome === 'Assinar o alvará');
  assert.ok(e && e.origem, 'a origem é preservada');
  r = await call('PUT', `/processos/${id}/xml`, { body: { xml: '<x/>' } });
  assert.equal(r.status, 422);
});

test('API: envio bloqueado quando a verificação falha; geração com falha salva o rascunho com erros', async () => {
  const { call, settingsStore } = await makeBackend({ scenario: 'erra_sempre', maxCorrections: 1 });
  const id = await createProcessWithAnswers(call);
  let r = await call('POST', `/processos/${id}/gerar`);
  assert.equal(r.data.ok, false); assert.ok(r.data.erros.length);
  r = await call('GET', `/processos/${id}`);
  assert.equal(r.data.sinais.estruturaValida, false);
  r = await call('POST', `/processos/${id}/enviar-validacao`);
  assert.equal(r.status, 422); assert.ok(r.extra.erros.length);
  settingsStore.set({ scenario: 'ok' });
  r = await call('POST', `/processos/${id}/gerar`);
  assert.equal(r.data.ok, true);
});

test('API: validações de entrada e rotas', async () => {
  const { call } = await makeBackend();
  const created = await call('POST', '/processos', { body: {} });
  const id = created.data.id;
  assert.equal((await call('POST', `/processos/${id}/gerar`)).status, 422, 'sem respostas não gera');
  assert.equal((await call('GET', '/processos/nao-existe')).status, 404);
  assert.equal((await call('GET', '/rota-inexistente')).status, 404);
  assert.equal((await call('POST', `/processos/${id}/feedback`, { body: { nota: 9 } })).status, 422);
  assert.equal((await call('POST', `/processos/${id}/feedback`, { body: { nota: 4, comentario: 'ok' } })).status, 200);
  assert.equal((await call('POST', `/processos/${id}/ajustar`, { body: { pedido: 'x' } })).status, 409);
});

test('API: auditoria registra cada geração com prompt e tentativas', async () => {
  const { call } = await makeBackend({ scenario: 'erra_e_corrige' });
  const id = await createProcessWithAnswers(call);
  await call('POST', `/processos/${id}/gerar`);
  const aud = (await call('GET', `/processos/${id}/historico`)).data;
  assert.equal(aud.length, 1);
  assert.equal(aud[0].tipo, 'gerar'); assert.equal(aud[0].tentativas, 2); assert.equal(aud[0].prompt_versao, 'prompt-v1');
  assert.ok(aud[0].detalhe.prompt.length >= 5);
});

test('rastro: uma geração passa por web -> api -> ai -> orchestrator -> llm -> converter -> db', async () => {
  const { call, trace } = await makeBackend();
  const id = await createProcessWithAnswers(call);
  trace.clear();
  await call('POST', `/processos/${id}/gerar`);
  const pairs = new Set(trace.items.map((t) => `${t.from}>${t.to}`));
  for (const p of ['web>api', 'api>ai', 'ai>orchestrator', 'orchestrator>llm', 'llm>orchestrator', 'api>converter', 'api>db']) assert.ok(pairs.has(p), `faltou ${p}`);
});

test('demonstração: reiniciar apaga processos e recarrega o catálogo de exemplo', async () => {
  const { call, db } = await makeBackend();
  await createProcessWithAnswers(call);
  assert.equal((await call('GET', '/processos')).data.length, 1);
  await call('POST', '/demo/reiniciar');
  assert.equal((await call('GET', '/processos')).data.length, 0);
  assert.equal(await db.count('catalogo_setores'), 5);
  assert.equal(await db.count('exemplos'), 2);
});

test('guardrail: dados pessoais nas respostas geram alerta e bloqueiam a geração', async () => {
  const { call } = await makeBackend();
  const id = await createProcessWithAnswers(call, SAMPLE_PESSOAL);
  let r = await call('GET', `/processos/${id}`);
  assert.deepEqual(r.data.alertas.map((a) => a.tipo).sort(), ['CPF', 'e-mail', 'telefone']);
  r = await call('POST', `/processos/${id}/gerar`);
  assert.equal(r.status, 422); assert.match(r.error, /dados pessoais/); assert.equal(r.extra.alertas.length, 3);
  assert.ok(!JSON.stringify(r.extra.alertas).includes('123.456'), 'o trecho vem mascarado');
  // sem alertas em respostas normais
  const ok = await createProcessWithAnswers(call);
  assert.deepEqual((await call('GET', `/processos/${ok}`)).data.alertas, []);
  // corrigindo as respostas, a geração libera
  const limpas = { ...SAMPLE_PESSOAL, documentos: 'Requerimento, documento de identidade e escritura do imóvel no protocolo; projeto arquitetônico na análise.', sistemas: 'SEI na tramitação; sistema de arrecadação para a guia da taxa de licença para construção.' };
  await call('PUT', `/processos/${id}/respostas`, { body: { respostas: limpas } });
  assert.equal((await call('POST', `/processos/${id}/gerar`)).status, 200);
});

test('cenário indisponível: erro 503, respostas preservadas, e tentar de novo funciona', async () => {
  const { call, settingsStore } = await makeBackend({ scenario: 'indisponivel' });
  const id = await createProcessWithAnswers(call);
  let r = await call('POST', `/processos/${id}/gerar`);
  assert.equal(r.status, 503); assert.match(r.error, /indisponível/); assert.equal(r.extra.respostasSalvas, true);
  assert.equal((await call('GET', `/processos/${id}`)).data.respostas.nome, SAMPLE_ANSWERS.nome);
  assert.equal((await call('GET', `/processos/${id}`)).data.rascunho, null);
  settingsStore.set({ scenario: 'ok' });
  r = await call('POST', `/processos/${id}/gerar`);
  assert.equal(r.status, 200);
  const hist = (await call('GET', `/processos/${id}/historico`)).data;
  assert.deepEqual(hist.map((h) => h.resultado), ['erro', 'valido']);
});

test('validação: omissão silenciosa chega ao validador, que devolve; o servidor refaz e a versão é aprovada com checklist', async () => {
  const { call, settingsStore } = await makeBackend({ scenario: 'omissao' });
  const id = await createProcessWithAnswers(call);
  await call('POST', `/processos/${id}/gerar`);
  let r = await call('GET', `/processos/${id}`);
  assert.equal(r.data.sinais.estruturaValida, true, 'a verificação não vê o problema');
  assert.ok(!r.data.rascunho.modelo.elementos.some((e) => e.nome === 'Pedido indeferido'));
  await call('POST', `/processos/${id}/enviar-validacao`);
  r = await call('POST', `/processos/${id}/devolver`, { body: { observacao: 'Falta o indeferimento do projeto.' }, role: 'validador' });
  assert.equal(r.status, 200);
  settingsStore.set({ scenario: 'ok' });
  await call('POST', `/processos/${id}/gerar`);
  r = await call('GET', `/processos/${id}`);
  assert.equal(r.data.processo.devolucao, null);
  assert.ok(r.data.rascunho.modelo.elementos.some((e) => e.nome === 'Pedido indeferido'));
  await call('POST', `/processos/${id}/enviar-validacao`);
  const checklist = { etapas: true, decisoes: true, setores: false };
  r = await call('POST', `/processos/${id}/aprovar`, { body: { validador: 'Chefe', motivo: 'Inclui o indeferimento', checklist }, role: 'validador' });
  assert.equal(r.status, 200);
  r = await call('GET', `/processos/${id}`);
  assert.deepEqual(r.data.versoes[0].checklist, checklist);
  const hist = (await call('GET', `/processos/${id}/historico`)).data.map((h) => h.tipo);
  assert.deepEqual(hist, ['gerar', 'enviar', 'devolver', 'gerar', 'enviar', 'aprovar']);
});

test('sinais: etapa inventada aparece com o nome em "sem origem"', async () => {
  const { call } = await makeBackend({ scenario: 'invencao' });
  const id = await createProcessWithAnswers(call);
  await call('POST', `/processos/${id}/gerar`);
  const { sinais } = (await call('GET', `/processos/${id}`)).data;
  assert.equal(sinais.estruturaValida, true);
  assert.deepEqual(sinais.semOrigemNomes, ['Consultar órgão de controle']);
});

test('config: cenário inválido é ignorado e a lista de cenários é exposta', async () => {
  const { call } = await makeBackend();
  let r = await call('PUT', '/config', { body: { scenario: 'inexistente', maxCorrections: 9 } });
  assert.equal(r.data.scenario, 'ok'); assert.equal(r.data.maxCorrections, 5);
  r = await call('PUT', '/config', { body: { scenario: 'omissao' } });
  assert.equal(r.data.scenario, 'omissao'); assert.equal(r.data.cenarios.length, 7);
});
