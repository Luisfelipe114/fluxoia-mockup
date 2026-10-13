// Montagem do contexto que a API entrega ao componente de IA a cada chamada.
// O componente de IA não acessa o banco: tudo o que ele precisa é lido aqui e enviado no pedido.

import { norm, stem, words, estimateTokens } from '../util/text.js';

const relevant = (item, textNorm, textStems) => {
  const n = norm(item.nome);
  if (n && textNorm.includes(n)) return true;
  return words(item.nome, 5).some((w) => textStems.has(stem(w)));
};

const stripParens = (s) => norm(s).replace(/\(.*?\)/g, '').trim();

export async function buildContext({ db, respostas, roteiro, maxExamples = 2 }) {
  const [setores, sistemas, taxas, documentos, exemplos] = await Promise.all([
    db.all('catalogo_setores'), db.all('catalogo_sistemas'), db.all('catalogo_taxas'), db.all('catalogo_documentos'), db.all('exemplos'),
  ]);
  const catalogo = { setores, sistemas, taxas, documentos };

  const text = Object.values(respostas ?? {}).join(' \n ');
  const textNorm = norm(text);
  const textStems = new Set(words(text, 5).map(stem));
  const cap = (list) => list.filter((x) => relevant(x, textNorm, textStems)).slice(0, 8);
  const catalogoRelevante = { setores: cap(setores), sistemas: cap(sistemas), taxas: cap(taxas), documentos: cap(documentos) };

  // Exemplos: nunca o próprio processo (evita "vazar o gabarito" para o prompt) e os mais parecidos primeiro.
  const self = stripParens(respostas?.nome ?? '');
  const candidatos = exemplos.filter((e) => stripParens(e.nome) !== self);
  const scored = candidatos.map((e) => {
    const ew = new Set(words(`${e.nome} ${e.modelo.elementos.map((x) => x.nome).join(' ')}`, 5).map(stem));
    const score = [...textStems].filter((s) => ew.has(s)).length;
    return { e, score };
  }).sort((a, b) => b.score - a.score);
  const selecionados = scored.slice(0, maxExamples).map(({ e }) => ({ id: e.id, nome: e.nome, modelo: e.modelo }));

  const tokens = estimateTokens(JSON.stringify(catalogoRelevante)) + estimateTokens(JSON.stringify(selecionados));
  return { catalogo, catalogoRelevante, exemplos: selecionados, roteiro, tokens };
}
