import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { makeBackend } from './helpers.mjs';
import { generateModel } from '../js/ai/llm/mockGenerator.js';
import { interpretRequest } from '../js/ai/llm/mockPatcher.js';
import { normalizeModel } from '../js/domain/model.js';
import { verifyModel } from '../js/ai/verifier.js';
import { SAMPLE_ANSWERS, SAMPLE_ANSWERS_2, SAMPLE_VAGA, CATALOG_SEED, EXAMPLE_ALVARA } from '../js/reference/seed.js';
import { OpenAICompatibleClient } from '../js/ai/llm/httpClient.js';
import { buildContext } from '../js/api/context.js';
import { assertRequest } from '../js/ai/contract.js';

const names = (m) => m.elementos.map((e) => e.nome);

test('gerador simulado: entrevista do alvará', () => {
  const m = normalizeModel(generateModel(SAMPLE_ANSWERS, CATALOG_SEED));
  assert.deepEqual(verifyModel(m, CATALOG_SEED), { errors: [], warnings: [] });
  assert.deepEqual(names(m), ['Pedido aberto', 'Conferir documentação', 'Documentação completa?', 'Solicitar complementação', 'Emitir guia da taxa de licença', 'Avaliar projeto', 'Projeto atende às normas?', 'Assinar alvará', 'Alvará assinado', 'Pedido indeferido']);
  const avaliar = m.elementos.find((e) => e.nome === 'Avaliar projeto');
  assert.equal(avaliar.prazo, 'até 15 dias');
  assert.deepEqual(avaliar.documentos, ['Projeto arquitetônico']);
  const guia = m.elementos.find((e) => /guia/.test(e.nome));
  assert.deepEqual(guia.taxas, ['Taxa de licença para construção']);
  assert.ok(m.elementos.every((e) => e.tipo === 'inicio' || e.tipo === 'fim' || e.origem), 'toda etapa deve ter origem na entrevista');
});

test('gerador simulado: entrevista da licença sanitária (laço de retorno)', () => {
  const m = normalizeModel(generateModel(SAMPLE_ANSWERS_2, CATALOG_SEED));
  assert.deepEqual(verifyModel(m, CATALOG_SEED).errors, []);
  assert.ok(names(m).includes('Notificar pendências'));
  const notif = m.elementos.find((e) => e.nome === 'Notificar pendências');
  const vist = m.elementos.find((e) => e.nome === 'Realizar vistoria');
  assert.ok(m.fluxos.some((f) => f.de === notif.id && f.para === vist.id), 'deve voltar à vistoria');
});

test('gerador simulado: entradas vazias ou estranhas ainda produzem um fluxo válido', () => {
  for (const r of [{}, { nome: 'X' }, { setores: 'A', passos: 'faz alguma coisa' }, { passos: 'Primeiro. Segundo. Terceiro.', decisoes: 'se der errado, volta', fim: '' }, { setores: 'Protocolo e Protocolo', passos: '- confere\n- emite\n- assina' }]) {
    const m = normalizeModel(generateModel(r, CATALOG_SEED));
    assert.deepEqual(verifyModel(m).errors, [], JSON.stringify(r));
  }
});

test('interpretador de pedidos de ajuste', () => {
  const m = EXAMPLE_ALVARA;
  assert.deepEqual(interpretRequest('a conferência de documentos é feita pelo Protocolo', m).ops, [{ op: 'setSector', id: 'e2', setor: 's1' }]);
  assert.deepEqual(interpretRequest('Analisar projeto é feito pela Chefia do setor.', m).ops, [{ op: 'setSector', id: 'e6', setor: 's3' }]);
  const add = interpretRequest('adicione a etapa Notificar o requerente depois de Analisar projeto', m).ops[0];
  assert.equal(add.op, 'addAfter'); assert.equal(add.after, 'e6'); assert.equal(add.elemento.nome, 'Notificar o requerente');
  assert.deepEqual(interpretRequest('remova a etapa Emitir guia da taxa', m).ops, [{ op: 'remove', id: 'e5' }]);
  assert.deepEqual(interpretRequest('renomeie Analisar projeto para Avaliar projeto', m).ops, [{ op: 'rename', id: 'e6', nome: 'Avaliar projeto' }]);
  const nada = interpretRequest('faça algo mágico', m);
  assert.deepEqual(nada.ops, []);
  assert.match(nada.mensagem, /Não entendi/);
});

test('contrato da IA recusa pedidos malformados', () => {
  assert.throws(() => assertRequest({}), /modo inválido/);
  assert.throws(() => assertRequest({ mode: 'gerar', contexto: {} }), /respostas/);
  assert.throws(() => assertRequest({ mode: 'ajustar', contexto: {}, modeloAtual: {} }), /pedido/);
});

test('contexto: não usa o próprio processo como exemplo e filtra o catálogo', async () => {
  const { db } = await makeBackend();
  const ctx = await buildContext({ db, respostas: SAMPLE_ANSWERS, roteiro: {} });
  assert.deepEqual(ctx.exemplos.map((e) => e.id), ['EX-02']);
  assert.ok(ctx.catalogoRelevante.setores.some((s) => s.nome === 'Protocolo'));
  assert.ok(!ctx.catalogoRelevante.setores.some((s) => s.nome === 'Fiscalização'));
  assert.ok(ctx.catalogo.setores.length >= 5);
});

test('orquestração: sem falha simulada gera na primeira tentativa', async () => {
  const b = await makeBackend({ scenario: 'ok' });
  const ctx = await buildContext({ db: b.db, respostas: SAMPLE_ANSWERS, roteiro: { questions: [] } });
  const r = await b.ai.run({ mode: 'gerar', respostas: SAMPLE_ANSWERS, contexto: ctx });
  assert.equal(r.ok, true); assert.equal(r.meta.tentativas, 1); assert.equal(r.meta.correcoes, 0);
  assert.ok(r.meta.prompt.length >= 5);
});

test('orquestração: falha só na 1ª tentativa é corrigida', async () => {
  const b = await makeBackend({ scenario: 'erra_e_corrige' });
  const ctx = await buildContext({ db: b.db, respostas: SAMPLE_ANSWERS, roteiro: { questions: [] } });
  const r = await b.ai.run({ mode: 'gerar', respostas: SAMPLE_ANSWERS, contexto: ctx });
  assert.equal(r.ok, true); assert.equal(r.meta.correcoes, 1); assert.equal(r.meta.tentativas, 2);
  assert.ok(b.trace.items.some((t) => /corrigir \(tentativa 2\)/.test(t.label)));
});

test('orquestração: falha sempre esgota as correções e devolve os erros', async () => {
  for (const max of [0, 2, 3]) {
    const b = await makeBackend({ scenario: 'erra_sempre', maxCorrections: max });
    const ctx = await buildContext({ db: b.db, respostas: SAMPLE_ANSWERS, roteiro: { questions: [] } });
    const r = await b.ai.run({ mode: 'gerar', respostas: SAMPLE_ANSWERS, contexto: ctx });
    assert.equal(r.ok, false); assert.equal(r.meta.correcoes, max); assert.ok(r.erros.length > 0);
  }
});

test('cliente HTTP compatível com OpenAI (contra um servidor falso)', async () => {
  const bodies = [];
  const server = http.createServer((req, res) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      bodies.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(data) });
      res.setHeader('Content-Type', 'application/json');
      if (JSON.parse(data).response_format?.type === 'json_schema' && bodies.length === 1) { res.statusCode = 400; return res.end('{}'); }
      res.end(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }));
    });
  });
  await new Promise((r) => server.listen(0, r));
  const { port } = server.address();
  const c = new OpenAICompatibleClient({ baseUrl: `http://127.0.0.1:${port}/v1/`, model: 'm', apiKey: 'k' });
  const out = await c.complete({ messages: [{ role: 'user', content: 'oi' }], schema: { type: 'object' } });
  server.close();
  assert.equal(out, '{"ok":true}');
  assert.equal(bodies[0].url, '/v1/chat/completions');
  assert.equal(bodies[0].auth, 'Bearer k');
  assert.equal(bodies[1].body.response_format.type, 'json_object', 'cai para json_object se o servidor recusa o esquema');
});

test('orquestração com cliente HTTP: usa o servidor configurado e trata erro', async () => {
  const server = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content: '```json\n' + JSON.stringify(EXAMPLE_ALVARA) + '\n```' } }] }));
    });
  });
  await new Promise((r) => server.listen(0, r));
  const { port } = server.address();
  const b = await makeBackend({ llm: { mode: 'http', baseUrl: `http://127.0.0.1:${port}/v1`, model: 'm' } });
  const ctx = await buildContext({ db: b.db, respostas: SAMPLE_ANSWERS, roteiro: { questions: [] } });
  const r = await b.ai.run({ mode: 'gerar', respostas: SAMPLE_ANSWERS, contexto: ctx });
  assert.equal(r.ok, true);
  assert.match(r.meta.modelo, /@ http/);
  server.close();

  const bad = await makeBackend({ llm: { mode: 'http', baseUrl: 'http://127.0.0.1:1/v1', model: 'm' } });
  await assert.rejects(() => bad.ai.run({ mode: 'gerar', respostas: SAMPLE_ANSWERS, contexto: ctx }), /Servidor de LLM indisponível/);
});

async function runScenario(scenario, answers = SAMPLE_ANSWERS, extra = {}) {
  const b = await makeBackend({ scenario, ...extra });
  const ctx = await buildContext({ db: b.db, respostas: answers, roteiro: { questions: [] } });
  return b.ai.run({ mode: 'gerar', respostas: answers, contexto: ctx });
}

test('cenário: resposta fora do formato é corrigida na 2ª tentativa', async () => {
  const r = await runScenario('json_invalido');
  assert.equal(r.ok, true); assert.equal(r.meta.correcoes, 1);
});

test('cenário: sem correções permitidas, a resposta fora do formato falha', async () => {
  const r = await runScenario('json_invalido', SAMPLE_ANSWERS, { maxCorrections: 0 });
  assert.equal(r.ok, false); assert.match(r.erros[0], /não é um JSON válido/);
});

test('cenário: omissão passa na verificação, mas perde o caminho de indeferimento', async () => {
  const ok = await runScenario('ok');
  const r = await runScenario('omissao');
  assert.equal(r.ok, true, 'a verificação estrutural não pega a omissão');
  assert.equal(r.meta.correcoes, 0);
  assert.ok(ok.modelo.elementos.some((e) => e.nome === 'Pedido indeferido'));
  assert.ok(!r.modelo.elementos.some((e) => e.nome === 'Pedido indeferido'));
  assert.ok(!r.modelo.elementos.some((e) => e.nome === 'Projeto atende às normas?'));
  assert.ok(r.modelo.elementos.length < ok.modelo.elementos.length);
});

test('cenário: omissão também funciona em processo com laço (licença sanitária)', async () => {
  const r = await runScenario('omissao', SAMPLE_ANSWERS_2);
  assert.equal(r.ok, true);
  assert.ok(!r.modelo.elementos.some((e) => e.nome === 'Notificar pendências'));
});

test('cenário: invenção é válida, mas a etapa inventada fica sem origem', async () => {
  const r = await runScenario('invencao');
  assert.equal(r.ok, true);
  const inv = r.modelo.elementos.filter((e) => e.tipo === 'tarefa' && !e.origem);
  assert.deepEqual(inv.map((e) => e.nome), ['Consultar órgão de controle']);
});

test('cenário: servidor de LLM indisponível lança erro claro', async () => {
  await assert.rejects(() => runScenario('indisponivel'), /Servidor de LLM indisponível/);
});

test('entrevista vaga gera fluxo mínimo com aviso', async () => {
  const r = await runScenario('ok', SAMPLE_VAGA);
  assert.equal(r.ok, true);
  assert.ok(r.avisos.some((a) => /só uma etapa/.test(a)));
});
