// Gerador SIMULADO do "Servidor de LLM": heurísticas em português que transformam as respostas da
// entrevista no modelo do processo. NÃO é um modelo de linguagem: serve para demonstrar o fluxo
// completo (contexto -> IA -> verificação -> conversão) sem backend.
// Um modelo real (vLLM/Ollama) substitui este arquivo pelo cliente HTTP (llm/httpClient.js).

import { norm, stem, capitalize, limitWords, sentences, splitList, words, uniq } from '../../util/text.js';

const VERB_MAP = {
  confere: 'Conferir', conferem: 'Conferir', verifica: 'Verificar', verificam: 'Verificar', emite: 'Emitir', emitem: 'Emitir',
  analisa: 'Analisar', analisam: 'Analisar', avalia: 'Avaliar', avaliam: 'Avaliar', assina: 'Assinar', assinam: 'Assinar',
  encaminha: 'Encaminhar', encaminham: 'Encaminhar', recebe: 'Receber', recebem: 'Receber', registra: 'Registrar', registram: 'Registrar',
  protocola: 'Protocolar', aprova: 'Aprovar', aprovam: 'Aprovar', solicita: 'Solicitar', solicitam: 'Solicitar', notifica: 'Notificar',
  notificam: 'Notificar', publica: 'Publicar', publicam: 'Publicar', arquiva: 'Arquivar', calcula: 'Calcular', realiza: 'Realizar',
  realizam: 'Realizar', despacha: 'Despachar', cadastra: 'Cadastrar', cadastram: 'Cadastrar', autoriza: 'Autorizar', elabora: 'Elaborar',
  revisa: 'Revisar', revisam: 'Revisar', confirma: 'Confirmar', comunica: 'Comunicar', entrega: 'Entregar', anexa: 'Anexar',
  fiscaliza: 'Fiscalizar', homologa: 'Homologar', libera: 'Liberar', paga: 'Pagar', emitiu: 'Emitir',
};
const START_VERBS = {
  abre: 'abert', abrem: 'abert', recebe: 'recebid', solicita: 'solicitad', solicitam: 'solicitad',
  protocola: 'protocolad', apresenta: 'apresentad', encaminha: 'encaminhad',
};

const key = (t) => norm(t).replace(/[^a-z]/g, '');
const stripArticle = (s) => s.replace(/^(?:o|a|os|as|um|uma|seu|sua)\s+/i, '').trim();
const clean = (s) => s.replace(/[,\s]+$/, '').replace(/\s+e$/i, '').replace(/^[,\s]+/, '').replace(/^e\s+/i, '').trim();

// ---------------------------------------------------------------- setores
function parseSectors(text, catalogo) {
  const out = [];
  const seen = new Set();
  for (const raw of splitList(text)) {
    const item = stripArticle(raw);
    if (!item) continue;
    const n = norm(item);
    const hit = (catalogo?.setores ?? []).find((c) => { const m = norm(c.nome); return m === n || m.includes(n) || n.includes(m); });
    const nome = hit ? hit.nome : capitalize(item);
    if (seen.has(norm(nome))) continue;
    seen.add(norm(nome));
    out.push({ id: `s${out.length + 1}`, nome });
  }
  return out.length ? out : [{ id: 's1', nome: 'Setor' }];
}

/** Primeiro setor mencionado em um trecho. */
function sectorAt(sentence, sectors) {
  const n = norm(sentence);
  let best = null;
  for (const s of sectors) {
    const full = norm(s.nome);
    const first = full.split(' ')[0];
    for (const k of uniq([full, first.length >= 5 ? first : null].filter(Boolean))) {
      const i = n.indexOf(k);
      if (i >= 0 && (!best || i < best.index || (i === best.index && k.length > best.len))) best = { sector: s.id, index: i, len: k.length };
    }
  }
  return best ?? { sector: null, index: -1, len: 0 };
}

// ---------------------------------------------------------------- etapas
function extractPrazo(text) {
  const m = text.match(/\b(?:em\s+|no\s+prazo\s+de\s+)?(?:até\s+)?(\d+\s+(?:dias úteis|dias|horas|meses|semanas))/i);
  if (!m) return { text, prazo: '' };
  const hasAte = /até/i.test(m[0]);
  return { text: text.replace(m[0], ' ').replace(/\s+/g, ' ').trim(), prazo: `${hasAte ? 'até ' : ''}${m[1]}` };
}

function clauseName(infinitive, objTokens) {
  let obj = clean(objTokens.join(' '));
  const p = extractPrazo(obj);
  obj = p.text;
  if (/^se\s+/i.test(obj)) {
    const ws = obj.replace(/[.,;]+$/, '').split(/\s+/);
    obj = ws[ws.length - 1];
  }
  obj = stripArticle(obj);
  obj = obj.split(/\s+(?:no|na|nos|nas|em|pelo|pela|junto)\s+/i)[0];
  return { nome: capitalize(limitWords(`${infinitive} ${obj}`.trim(), 6)), prazo: p.prazo };
}

function extractSteps(text, sectors) {
  const steps = [];
  let current = sectors[0]?.id;
  for (const sent of sentences(text)) {
    const at = sectorAt(sent, sectors);
    if (at.sector) current = at.sector;
    const tokens = sent.split(/\s+/);
    const verbIdx = tokens.map((t, i) => (VERB_MAP[key(t)] ? i : -1)).filter((i) => i >= 0);
    if (!verbIdx.length) {
      steps.push({ nome: capitalize(limitWords(stripArticle(sent), 6)), setor: current, origem: sent, prazo: '' });
      continue;
    }
    verbIdx.forEach((vi, k) => {
      const end = verbIdx[k + 1] ?? tokens.length;
      const { nome, prazo } = clauseName(VERB_MAP[key(tokens[vi])], tokens.slice(vi + 1, end));
      const origem = clean(tokens.slice(k === 0 ? 0 : vi, end).join(' '));
      steps.push({ nome, setor: current, origem, prazo });
    });
  }
  return steps;
}

// ---------------------------------------------------------------- início e fim
function buildStart(text, sectors, fallbackSector) {
  const sent = sentences(text)[0] ?? '';
  const at = sectorAt(sent, sectors);
  const m = sent.match(/\b(abrem?|recebem?|solicitam?|protocola|apresenta|encaminha)\s+(?:o|a|um|uma)?\s*([a-zçãõáéíóúâêô]+)/i);
  let nome = 'Início do processo';
  if (m) {
    const noun = m[2];
    const part = START_VERBS[key(m[1])] ?? 'iniciad';
    const fem = /(a|ção|são)$/i.test(noun);
    nome = `${capitalize(noun)} ${part}${fem ? 'a' : 'o'}`;
  }
  return { nome, setor: at.sector ?? fallbackSector, origem: sent };
}

function buildEnds(text) {
  const ends = [];
  const m1 = String(text).match(/termin\w*\s+(?:com|em)\s+(?:o|a|um|uma)?\s*([^.;,]+?)(?=\s+ou\b|[.;,]|$)/i);
  if (m1) ends.push({ nome: capitalize(limitWords(m1[1].trim(), 4)), origem: m1[0].trim() });
  const m2 = String(text).match(/\bou\s+(?:com\s+)?(?:o|a|um|uma)?\s*([^.;,]+)/i);
  if (m2) ends.push({ nome: capitalize(limitWords(m2[1].trim(), 4)), origem: m2[0].trim() });
  if (!ends.length) ends.push({ nome: 'Processo concluído', origem: '' });
  return ends;
}

function applyDeadlines(steps, text) {
  for (const sent of sentences(text)) {
    const m = sent.match(/^(.*?)\s+em\s+até\s+(\d+\s+\w+)/i);
    if (!m) continue;
    const label = stem(m[1].split(/\s+/)[0]);
    const step = steps.find((s) => !s.prazo && words(`${s.nome} ${s.origem}`, 5).some((w) => stem(w) === label));
    if (step) step.prazo = `até ${m[2]}`;
  }
}

// ---------------------------------------------------------------- decisões
const questionName = (s) => capitalize(limitWords(s.replace(/\s+/g, ' ').trim(), 7).replace(/\?*$/, '') + '?');

function decisionQuestion(cond) {
  const c = cond.replace(/^[\s,]+|[\s,.]+$/g, '');
  const n = norm(c);
  if (/\bfalt\w*\s+(documento|documentos|documentacao)/.test(n)) return { name: 'Documentação completa?', negative: true };

  // "o projeto não atender às normas" -> "Projeto atende às normas?"
  let m = n.match(/^(.+?)\s+nao\s+(atend|cumpr|estiv|for)\w*\b(.*)$/);
  if (m) {
    const verb = { atend: 'atende', cumpr: 'cumpre', estiv: 'está', for: 'é' }[m[2]];
    const subject = stripArticle(c.slice(0, m[1].length));
    const rest = c.slice(c.length - m[3].length).trim();
    return { name: questionName(`${subject} ${verb} ${rest}`), negative: true };
  }
  // "o cadastro estiver incompleto" -> "Cadastro completo?"
  m = n.match(/^(.+?)\s+(?:estiver|for|estiverem)\s+(incompleto|incompleta|incorreto|incorreta|irregular|pendente)/);
  if (m) {
    const adj = { incompleto: 'completo', incompleta: 'completa', incorreto: 'correto', incorreta: 'correta', irregular: 'regular', pendente: 'sem pendência' }[m[2]];
    return { name: questionName(`${stripArticle(c.slice(0, m[1].length))} ${adj}`), negative: true };
  }
  return { name: questionName(c), negative: false };
}

function parseConsequence(cons) {
  const c = norm(cons);
  const loop = /\b(volta|voltam|retorna|retornam|devolvid\w*|devolve|refeit\w*|refaz|novamente)\b/.test(c);
  const tokens = cons.split(/\s+/);
  const vi = tokens.findIndex((t) => VERB_MAP[key(t)]);
  if (vi >= 0) {
    const end = tokens.findIndex((t, i) => i > vi && /^e$/i.test(t));
    const { nome, prazo } = clauseName(VERB_MAP[key(tokens[vi])], tokens.slice(vi + 1, end > 0 ? end : tokens.length));
    return { kind: loop ? 'loop' : 'task', nome, prazo };
  }
  const endM = c.match(/indefer|arquiv|cancel|rejeit|neg(?:ad|a)/);
  if (endM) {
    const part = { indefer: 'indeferido', arquiv: 'arquivado', cancel: 'cancelado', rejeit: 'rejeitado' }[endM[0]] ?? 'negado';
    return { kind: 'end', nome: `Pedido ${part}` };
  }
  if (loop) {
    const m = cons.match(/\bpara\s+(?:a\s+|o\s+)?([a-zçãõáéíóúâêô]+)/i);
    return { kind: 'loop', nome: m ? `Solicitar ${m[1]}` : 'Corrigir pendências', prazo: '' };
  }
  return { kind: 'end', nome: capitalize(limitWords(cons, 4)) };
}

function parseDecisions(text, steps) {
  const list = [];
  for (const sent of sentences(text)) {
    const m = sent.match(/^(?:se|caso|quando)\s+(.+?),\s*(.+)$/i);
    if (!m) {
      const d = sent.match(/(\d+)\s+(dias|horas)/i);
      const prev = list[list.length - 1];
      if (prev && d && prev.consequence.kind !== 'end' && !prev.consequence.prazo) prev.consequence.prazo = `${d[1]} ${d[2]}`;
      continue;
    }
    const cond = m[1];
    const condWords = words(cond, 4).map(stem);
    const consWords = words(m[2], 5).map(stem);
    let best = -1, bestScore = 0;
    steps.forEach((s, i) => {
      const sw = words(`${s.nome} ${s.origem}`, 4).map(stem);
      const score = 2 * condWords.filter((w) => sw.includes(w)).length + consWords.filter((w) => sw.includes(w)).length;
      if (score >= bestScore && score > 0) { best = i; bestScore = score; }
    });
    const q = decisionQuestion(cond);
    list.push({ anchor: best >= 0 ? best : steps.length - 1, ...q, consequence: parseConsequence(m[2]), origem: sent });
  }
  return list;
}

// ---------------------------------------------------------------- documentos, sistemas e taxas
const addUnique = (arr, v) => { if (v && !arr.some((x) => norm(x) === norm(v))) arr.push(v); };

function applyDocuments(elems, sectors, text) {
  for (const part of String(text).split(/;|\n/).map((x) => x.trim()).filter(Boolean)) {
    if (/^(nenhum|nenhuma|não há|sem)\b/i.test(part)) continue;
    const at = sectorAt(part, sectors);
    let docsText = part;
    if (at.index >= 0) docsText = part.slice(0, at.index).replace(/\s+(?:no|na|em|junto)\s*$/i, '');
    const docs = splitList(docsText).map((d) => capitalize(d));
    const tasks = elems.filter((e) => e.tipo === 'tarefa');
    const target = (at.sector && tasks.find((e) => e.setor === at.sector)) || tasks[0];
    if (target) docs.forEach((d) => addUnique(target.documentos, d));
  }
}

function applySystems(elems, text, catalogo) {
  const tasks = elems.filter((e) => e.tipo === 'tarefa');
  for (const part of String(text).split(/;|\n/).map((x) => x.trim()).filter(Boolean)) {
    const n = norm(part);
    const sistemas = [], taxas = [];
    (catalogo?.sistemas ?? []).forEach((s) => { if (n.includes(norm(s.nome))) addUnique(sistemas, s.nome); });
    (part.match(/\b[A-Z]{2,6}\b/g) ?? []).forEach((a) => addUnique(sistemas, a));
    (catalogo?.taxas ?? []).forEach((t) => { if (n.includes(norm(t.nome))) addUnique(taxas, t.nome); });
    const typed = part.match(/\btaxa de [^.;,]+/i);
    if (typed && !taxas.length) addUnique(taxas, capitalize(typed[0].trim()));
    const pw = words(part, 4);
    let target = tasks[0], bestScore = 0;
    tasks.forEach((t) => {
      const tw = words(t.nome, 4);
      const score = pw.filter((w) => tw.some((x) => stem(x) === stem(w))).length;
      if (score > bestScore) { target = t; bestScore = score; }
    });
    if (target) { sistemas.forEach((s) => addUnique(target.sistemas, s)); taxas.forEach((t) => addUnique(target.taxas, t)); }
  }
}

// ---------------------------------------------------------------- montagem
/**
 * @param {Record<string,string>} respostas
 * @param {{setores:any[],sistemas:any[],taxas:any[],documentos:any[]}} catalogo
 */
export function generateModel(respostas = {}, catalogo = {}) {
  const sectors = parseSectors(respostas.setores, catalogo);
  let steps = extractSteps(respostas.passos, sectors);
  if (!steps.length) steps = [{ nome: 'Executar o processo', setor: sectors[0].id, origem: '', prazo: '' }];
  applyDeadlines(steps, respostas.fim ?? '');
  const start = buildStart(respostas.inicio ?? '', sectors, steps[0].setor);
  const ends = buildEnds(respostas.fim ?? '');

  let n = 0;
  const mk = (tipo, nome, setor, extra = {}) => ({ id: `e${++n}`, tipo, nome, setor, documentos: [], sistemas: [], taxas: [], prazo: '', origem: '', ...extra });
  const elementos = [];
  const eStart = mk('inicio', start.nome, start.setor, { origem: start.origem });
  const eSteps = steps.map((s) => mk('tarefa', s.nome, s.setor, { origem: s.origem, prazo: s.prazo }));
  const eEnd = mk('fim', ends[0].nome, eSteps[eSteps.length - 1].setor, { origem: ends[0].origem });
  elementos.push(eStart, ...eSteps, eEnd);

  const chain = [eStart, ...eSteps, eEnd];
  let fluxos = chain.slice(1).map((e, i) => ({ de: chain[i].id, para: e.id, condicao: '' }));

  const insertAfter = (ref, el) => elementos.splice(elementos.indexOf(ref) + 1, 0, el);
  const endByName = (nome) => elementos.find((e) => e.tipo === 'fim' && norm(e.nome) === norm(nome));

  for (const d of parseDecisions(respostas.decisoes ?? '', steps)) {
    const anchor = eSteps[d.anchor];
    const main = fluxos.find((f) => f.de === anchor.id && !f.condicao);
    if (!main) continue;
    const D = mk('decisao', d.name, anchor.setor, { origem: d.origem });
    insertAfter(anchor, D);
    const [mainLabel, excLabel] = d.negative ? ['Sim', 'Não'] : ['Não', 'Sim'];
    const target = main.para;
    main.para = D.id;
    fluxos.push({ de: D.id, para: target, condicao: mainLabel });
    const c = d.consequence;
    if (c.kind === 'end') {
      let E = endByName(c.nome);
      if (!E) {
        const extra = ends.find((x) => norm(x.nome) === norm(c.nome));
        E = mk('fim', c.nome, anchor.setor, { origem: extra?.origem ?? d.origem });
        elementos.push(E);
      }
      fluxos.push({ de: D.id, para: E.id, condicao: excLabel });
    } else {
      const T = mk('tarefa', c.nome, anchor.setor, { origem: d.origem, prazo: c.prazo ?? '' });
      insertAfter(D, T);
      fluxos.push({ de: D.id, para: T.id, condicao: excLabel });
      fluxos.push({ de: T.id, para: c.kind === 'loop' ? anchor.id : target, condicao: '' });
    }
  }

  applyDocuments(elementos, sectors, respostas.documentos ?? '');
  applySystems(elementos, respostas.sistemas ?? '', catalogo);

  // ids sequenciais na ordem em que os elementos aparecem
  const remap = Object.fromEntries(elementos.map((e, i) => [e.id, `e${i + 1}`]));
  elementos.forEach((e) => { e.id = remap[e.id]; });
  fluxos = fluxos.map((f) => ({ ...f, de: remap[f.de], para: remap[f.para] }));

  return {
    processo: String(respostas.nome || 'Processo sem nome').trim(),
    objetivo: String(respostas.objetivo || '').trim(),
    setores: sectors,
    elementos,
    fluxos,
  };
}
