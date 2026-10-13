// Contrato do componente de IA: é a única fronteira entre a IA e o resto do sistema.
//
// A API chama a IA com:
//   { mode: 'gerar' | 'ajustar',
//     respostas,                       // respostas da entrevista (gerar)
//     contexto: { catalogo, catalogoRelevante, exemplos, roteiro },   // montado pela API
//     modeloAtual, pedido }            // somente em 'ajustar'
//
// e recebe de volta:
//   { ok, modelo, erros[], avisos[], mensagem?, meta: { modelo, promptVersion, tentativas, correcoes, duracaoMs, prompt } }
//
// A IA não guarda estado nem acessa o banco: tudo o que ela precisa vem no pedido.

export const CONTRACT_DOC = {
  entrada: 'respostas + catálogo + exemplos (e, nos ajustes, o modelo atual e o pedido)',
  saida: 'modelo do processo (JSON) verificado, com a origem de cada elemento',
};

export function assertRequest(req) {
  if (!req || typeof req !== 'object') throw new Error('Contrato da IA: pedido vazio.');
  if (!['gerar', 'ajustar'].includes(req.mode)) throw new Error(`Contrato da IA: modo inválido (${req.mode}).`);
  if (!req.contexto || typeof req.contexto !== 'object') throw new Error('Contrato da IA: falta o contexto.');
  if (req.mode === 'gerar' && (!req.respostas || typeof req.respostas !== 'object')) throw new Error('Contrato da IA: faltam as respostas da entrevista.');
  if (req.mode === 'ajustar' && (!req.modeloAtual || !String(req.pedido ?? '').trim())) throw new Error('Contrato da IA: faltam o modelo atual e o pedido de ajuste.');
}
