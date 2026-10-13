// Esquemas JSON enviados ao servidor de LLM (saída estruturada).

export const MODEL_SCHEMA = {
  type: 'object',
  required: ['processo', 'setores', 'elementos', 'fluxos'],
  properties: {
    processo: { type: 'string' },
    objetivo: { type: 'string' },
    setores: { type: 'array', items: { type: 'object', required: ['id', 'nome'], properties: { id: { type: 'string' }, nome: { type: 'string' } } } },
    elementos: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'tipo', 'nome', 'setor'],
        properties: {
          id: { type: 'string' },
          tipo: { enum: ['inicio', 'tarefa', 'decisao', 'fim'] },
          nome: { type: 'string' }, setor: { type: 'string' },
          documentos: { type: 'array', items: { type: 'string' } },
          sistemas: { type: 'array', items: { type: 'string' } },
          taxas: { type: 'array', items: { type: 'string' } },
          prazo: { type: 'string' }, origem: { type: 'string' },
        },
      },
    },
    fluxos: { type: 'array', items: { type: 'object', required: ['de', 'para'], properties: { de: { type: 'string' }, para: { type: 'string' }, condicao: { type: 'string' } } } },
  },
};

export const PATCH_SCHEMA = {
  type: 'object',
  required: ['ops'],
  properties: {
    mensagem: { type: 'string' },
    ops: {
      type: 'array',
      items: {
        type: 'object',
        required: ['op'],
        properties: {
          op: { enum: ['setSector', 'rename', 'addAfter', 'remove'] },
          id: { type: 'string' }, setor: { type: 'string' }, nome: { type: 'string' }, after: { type: 'string' },
          elemento: { type: 'object', properties: { nome: { type: 'string' }, tipo: { type: 'string' }, setor: { type: 'string' } } },
        },
      },
    },
  },
};
