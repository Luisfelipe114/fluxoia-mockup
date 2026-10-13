// Regras de negócio dos processos: entrevista, geração, ajustes, edição, aprovação e versões.
// É aqui que a API conversa com os demais componentes (IA, conversor BPMN e banco).

import { HttpError } from '../errors.js';
import { uid, nowIso } from '../../util/ids.js';
import { clock } from '../../util/clock.js';
import { diffModels } from '../../domain/diff.js';
import { buildContext } from '../context.js';
import { detectPersonalData } from '../guardrails.js';

const STATUS = { RASCUNHO: 'rascunho', VALIDACAO: 'em_validacao', APROVADO: 'aprovado' };

export function createProcessService({ db, ai, converter, trace, roteiro, settings }) {
  // ------------------------------------------------------------ chamadas ao conversor (com rastro)
  const convert = {
    async toXml(model) {
      trace.call('api', 'converter', 'JSON → BPMN XML');
      await clock.jitter(60, 140);
      const xml = converter.modelToXml(model);
      trace.reply('converter', 'api', `${xml.length} caracteres de XML`);
      return xml;
    },
    async toModel(xml, prev) {
      trace.call('api', 'converter', 'BPMN XML → JSON');
      await clock.jitter(60, 140);
      let m;
      try { m = converter.xmlToModel(xml, prev); } catch (e) { trace.error('converter', 'api', e.message); throw new HttpError(422, `XML inválido: ${e.message}`); }
      trace.reply('converter', 'api', `${m.elementos.length} elementos, ${m.fluxos.length} ligações`);
      return m;
    },
  };

  const need = async (id) => {
    const p = await db.get('processos', id);
    if (!p) throw new HttpError(404, 'Processo não encontrado.');
    return p;
  };

  const audit = (row) => db.insert('auditoria', { id: uid('aud'), criado: nowIso(), ...row });

  const catalog = async () => ({
    setores: await db.all('catalogo_setores'), sistemas: await db.all('catalogo_sistemas'),
    taxas: await db.all('catalogo_taxas'), documentos: await db.all('catalogo_documentos'),
  });

  /** Sinais verificáveis do rascunho (sempre recalculados, nunca confiança "declarada" pelo modelo). */
  async function signals(draft) {
    if (!draft) return null;
    const v = ai.verify(draft.modelo, await catalog());
    const semOrigemEls = draft.modelo.elementos.filter((e) => e.tipo !== 'inicio' && e.tipo !== 'fim' && !e.origem.trim());
    return {
      estruturaValida: v.errors.length === 0, erros: v.errors, avisos: v.warnings, semOrigem: semOrigemEls.length, semOrigemNomes: semOrigemEls.map((e) => e.nome),
      correcoes: draft.meta?.correcoes ?? 0, tentativas: draft.meta?.tentativas ?? 0, modelo: draft.meta?.modelo ?? '—',
      promptVersion: draft.meta?.promptVersion ?? '—', duracaoMs: draft.meta?.duracaoMs ?? 0, editadoManualmente: Boolean(draft.meta?.editadoManualmente),
      tokensPrompt: draft.meta?.tokensPrompt ?? 0,
    };
  }

  async function toDraftStatus(p) {
    if (p.status === STATUS.RASCUNHO) return p;
    return db.update('processos', p.id, { status: STATUS.RASCUNHO, atualizado: nowIso() });
  }

  async function saveDraft(id, modelo, xml, meta) {
    return db.upsert('rascunhos', { id, modelo, xml, meta, atualizado: nowIso() });
  }

  // ------------------------------------------------------------ API pública do serviço
  return {
    STATUS,

    async list() {
      const list = await db.all('processos');
      const versoes = await db.all('versoes');
      const rascunhos = new Set((await db.all('rascunhos')).map((r) => r.id));
      return list.map((p) => ({ ...p, versoes: versoes.filter((v) => v.processo_id === p.id).length, temRascunho: rascunhos.has(p.id) }))
        .sort((a, b) => b.atualizado.localeCompare(a.atualizado));
    },

    async create({ nome } = {}) {
      const id = uid('proc');
      const now = nowIso();
      const p = await db.insert('processos', { id, nome: nome?.trim() || 'Novo processo', status: STATUS.RASCUNHO, devolucao: null, criado: now, atualizado: now });
      await db.insert('respostas', { id, valores: {}, roteiro: roteiro.version });
      return p;
    },

    async get(id) {
      const p = await need(id);
      const [resp, draft, versoes] = await Promise.all([db.get('respostas', id), db.get('rascunhos', id), db.where('versoes', { processo_id: id })]);
      return {
        processo: p, respostas: resp?.valores ?? {}, alertas: detectPersonalData(resp?.valores ?? {}), rascunho: draft,
        sinais: await signals(draft), versoes: versoes.sort((a, b) => a.n - b.n),
      };
    },

    async saveAnswers(id, valores) {
      const p = await need(id);
      if (p.status !== STATUS.RASCUNHO) throw new HttpError(409, 'O processo não está em rascunho; edite o rascunho para alterar as respostas.');
      await db.upsert('respostas', { id, valores: valores ?? {}, roteiro: roteiro.version });
      const nome = valores?.nome?.trim();
      if (nome && nome !== p.nome) await db.update('processos', id, { nome, atualizado: nowIso() });
      return { ok: true, alertas: detectPersonalData(valores ?? {}) };
    },

    /** Gera o rascunho: contexto -> componente de IA -> conversor -> banco. */
    async generate(id) {
      let p = await need(id);
      const resp = await db.get('respostas', id);
      const valores = resp?.valores ?? {};
      if (!roteiro.questions.slice(0, 5).every((q) => String(valores[q.id] ?? '').trim())) {
        throw new HttpError(422, 'Responda ao menos as cinco primeiras perguntas antes de gerar o fluxo.');
      }
      const alertas = detectPersonalData(valores);
      if (alertas.length) {
        await audit({ processo_id: id, tipo: 'gerar', resultado: 'bloqueado', modelo: '—', prompt_versao: '—', tentativas: 0, duracao_ms: 0, detalhe: { motivo: 'dados pessoais nas respostas', alertas } });
        throw new HttpError(422, 'Há dados pessoais nas respostas (CPF, e-mail ou telefone). Troque por setores e cargos antes de gerar.', { alertas });
      }
      trace.info('api', 'monta o contexto da IA (catálogo relevante + exemplos)');
      const contexto = await buildContext({ db, respostas: valores, roteiro });
      trace.info('api', `contexto: ${contexto.exemplos.length} exemplo(s), ${contexto.tokens} tokens estimados`);

      trace.call('api', 'ai', 'contrato da IA: gerar');
      let res;
      try {
        res = await ai.run({ mode: 'gerar', respostas: valores, contexto });
      } catch (e) {
        await audit({ processo_id: id, tipo: 'gerar', resultado: 'erro', modelo: '—', prompt_versao: '—', tentativas: 0, duracao_ms: 0, detalhe: { mensagem: e.message } });
        throw new HttpError(503, e.message, { respostasSalvas: true });
      }
      trace.reply('ai', 'api', res.ok ? `JSON validado (${res.meta.correcoes} correção(ões))` : `falhou após ${res.meta.correcoes} correção(ões)`);

      const xml = await convert.toXml(res.modelo);
      const meta = { ...res.meta, avisos: res.avisos, erros: res.erros, geradoEm: nowIso(), editadoManualmente: false, contextoTokens: contexto.tokens, exemplos: contexto.exemplos.map((e) => e.nome) };
      p = await toDraftStatus(p);
      await saveDraft(id, res.modelo, xml, meta);
      await db.update('processos', id, { devolucao: null, atualizado: nowIso() });
      await audit({ processo_id: id, tipo: 'gerar', resultado: res.ok ? 'valido' : 'invalido', modelo: res.meta.modelo, prompt_versao: res.meta.promptVersion, tentativas: res.meta.tentativas, duracao_ms: res.meta.duracaoMs, detalhe: { erros: res.erros, avisos: res.avisos, prompt: res.meta.prompt, exemplos: meta.exemplos } });
      return { ok: res.ok, erros: res.erros, meta: { correcoes: res.meta.correcoes, tentativas: res.meta.tentativas } };
    },

    /** Ajuste por pedido em linguagem natural (o modelo devolve patch; o código aplica). */
    async adjust(id, pedido) {
      let p = await need(id);
      const draft = await db.get('rascunhos', id);
      if (!draft) throw new HttpError(409, 'Gere o fluxo antes de pedir ajustes.');
      if (!String(pedido ?? '').trim()) throw new HttpError(422, 'Escreva o ajuste desejado.');
      const resp = await db.get('respostas', id);
      const contexto = await buildContext({ db, respostas: resp?.valores ?? {}, roteiro });

      trace.call('api', 'ai', 'contrato da IA: ajustar');
      let res;
      try {
        res = await ai.run({ mode: 'ajustar', respostas: resp?.valores ?? {}, contexto, modeloAtual: draft.modelo, pedido });
      } catch (e) { throw new HttpError(503, e.message); }
      trace.reply('ai', 'api', res.mudou ? `${res.ops.length} operação(ões)` : 'nenhuma alteração');

      if (!res.mudou) return { ok: true, mudou: false, mensagem: res.mensagem };
      if (!res.ok) throw new HttpError(422, `O ajuste não pôde ser aplicado: ${res.erros.join(' ')}`);
      const xml = await convert.toXml(res.modelo);
      const prevStatus = p.status;
      p = await toDraftStatus(p);
      await saveDraft(id, res.modelo, xml, { ...draft.meta, ...res.meta, avisos: res.avisos, erros: [], ajustes: [...(draft.meta?.ajustes ?? []), { pedido, em: nowIso(), ops: res.ops }], editadoManualmente: draft.meta?.editadoManualmente ?? false });
      await audit({ processo_id: id, tipo: 'ajustar', resultado: 'valido', modelo: res.meta.modelo, prompt_versao: res.meta.promptVersion, tentativas: res.meta.tentativas, duracao_ms: res.meta.duracaoMs, detalhe: { pedido, ops: res.ops } });
      return { ok: true, mudou: true, mensagem: res.mensagem, voltouParaRascunho: prevStatus !== STATUS.RASCUNHO };
    },

    /** Edição direta no diagrama: o front envia o XML e a API pede ao conversor o JSON de volta. */
    async saveXml(id, xml) {
      let p = await need(id);
      const draft = await db.get('rascunhos', id);
      const modelo = await convert.toModel(xml, draft?.modelo ?? null);
      const prevStatus = p.status;
      p = await toDraftStatus(p);
      const objetivo = modelo.objetivo || draft?.modelo?.objetivo || '';
      await saveDraft(id, { ...modelo, objetivo }, xml, { ...(draft?.meta ?? {}), editadoManualmente: true, atualizadoEm: nowIso() });
      await audit({ processo_id: id, tipo: 'editar', resultado: 'valido', modelo: 'edição manual', prompt_versao: '—', tentativas: 0, duracao_ms: 0, detalhe: { elementos: modelo.elementos.length } });
      const saved = await db.get('rascunhos', id);
      return { ok: true, voltouParaRascunho: prevStatus !== STATUS.RASCUNHO, sinais: await signals(saved) };
    },

    async submit(id) {
      const p = await need(id);
      const draft = await db.get('rascunhos', id);
      if (!draft) throw new HttpError(409, 'Não há rascunho para enviar.');
      if (p.status === STATUS.VALIDACAO) throw new HttpError(409, 'O processo já está em validação.');
      const v = ai.verify(draft.modelo, await catalog());
      if (v.errors.length) throw new HttpError(422, 'Corrija os pontos da verificação antes de enviar.', { erros: v.errors });
      await db.update('processos', id, { status: STATUS.VALIDACAO, devolucao: null, atualizado: nowIso() });
      await audit({ processo_id: id, tipo: 'enviar', resultado: 'valido', modelo: '—', prompt_versao: '—', tentativas: 0, duracao_ms: 0, detalhe: { avisos: v.warnings } });
      return { ok: true };
    },

    async approve(id, role, { validador, motivo, norma, checklist } = {}) {
      if (role !== 'validador') throw new HttpError(403, 'Somente o chefe do setor (validador) pode aprovar.');
      const p = await need(id);
      if (p.status !== STATUS.VALIDACAO) throw new HttpError(409, 'O processo não está aguardando validação.');
      if (!String(validador ?? '').trim() || !String(motivo ?? '').trim()) throw new HttpError(422, 'Informe o nome do validador e o motivo da versão.');
      const draft = await db.get('rascunhos', id);
      const versoes = await db.where('versoes', { processo_id: id });
      const n = versoes.length + 1;
      await db.insert('versoes', { id: uid('ver'), processo_id: id, n, modelo: draft.modelo, xml: draft.xml, validador: validador.trim(), motivo: motivo.trim(), norma: String(norma ?? '').trim(), checklist: checklist ?? null, aprovada_em: nowIso() });
      await db.update('processos', id, { status: STATUS.APROVADO, atualizado: nowIso() });
      await audit({ processo_id: id, tipo: 'aprovar', resultado: 'valido', modelo: '—', prompt_versao: '—', tentativas: 0, duracao_ms: 0, detalhe: { n, validador: validador.trim(), norma: String(norma ?? '').trim(), checklist: checklist ?? null } });
      return { ok: true, n };
    },

    async reject(id, role, { observacao } = {}) {
      if (role !== 'validador') throw new HttpError(403, 'Somente o chefe do setor (validador) pode devolver.');
      const p = await need(id);
      if (p.status !== STATUS.VALIDACAO) throw new HttpError(409, 'O processo não está aguardando validação.');
      if (!String(observacao ?? '').trim()) throw new HttpError(422, 'Escreva a observação para o servidor.');
      await db.update('processos', id, { status: STATUS.RASCUNHO, devolucao: observacao.trim(), atualizado: nowIso() });
      await audit({ processo_id: id, tipo: 'devolver', resultado: 'valido', modelo: '—', prompt_versao: '—', tentativas: 0, duracao_ms: 0, detalhe: { observacao: observacao.trim() } });
      return { ok: true };
    },

    async versions(id) {
      await need(id);
      return (await db.where('versoes', { processo_id: id })).sort((a, b) => a.n - b.n);
    },

    async versionDiff(id, n) {
      const list = await this.versions(id);
      const cur = list.find((v) => v.n === Number(n));
      if (!cur) throw new HttpError(404, 'Versão não encontrada.');
      const prev = list.find((v) => v.n === cur.n - 1) ?? null;
      return { de: prev?.n ?? null, para: cur.n, diff: diffModels(prev?.modelo ?? null, cur.modelo) };
    },

    async restore(id, n) {
      const p = await need(id);
      const v = (await db.where('versoes', { processo_id: id })).find((x) => x.n === Number(n));
      if (!v) throw new HttpError(404, 'Versão não encontrada.');
      await toDraftStatus(p);
      await saveDraft(id, v.modelo, v.xml, { modelo: `restaurada da versão ${v.n}`, promptVersion: '—', tentativas: 0, correcoes: 0, editadoManualmente: false, geradoEm: nowIso() });
      await audit({ processo_id: id, tipo: 'restaurar', resultado: 'valido', modelo: '—', prompt_versao: '—', tentativas: 0, duracao_ms: 0, detalhe: { n: v.n } });
      return { ok: true };
    },

    async feedback(id, { nota, comentario } = {}) {
      await need(id);
      const n = Number(nota);
      if (!(n >= 1 && n <= 5)) throw new HttpError(422, 'A nota deve ser de 1 a 5.');
      await db.insert('feedback', { id: uid('fb'), processo_id: id, nota: n, comentario: String(comentario ?? '').trim(), criado: nowIso() });
      return { ok: true };
    },

    /** Linha do tempo do processo (geração, ajustes, envio, devolução, aprovação). */
    async history(id) {
      await need(id);
      return (await db.where('auditoria', { processo_id: id })).sort((a, b) => a.criado.localeCompare(b.criado));
    },

    async exportBpmn(id) {
      const p = await need(id);
      const draft = await db.get('rascunhos', id);
      if (!draft) throw new HttpError(409, 'Não há diagrama para exportar.');
      return { nome: p.nome, xml: draft.xml };
    },
  };
}
