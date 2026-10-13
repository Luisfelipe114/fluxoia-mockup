// Material de referência de EXEMPLO. Tudo aqui é FICTÍCIO.
// Na versão real, estes dados vêm da carga inicial do material da SECTI
// (arquivos .bpmn, PDFs e cartilhas da SDU Leste), após a assinatura do termo de confidencialidade.

export const CATALOG_SEED = {
  setores: [
    { id: 'SET-01', nome: 'Protocolo', descricao: 'Recebe, confere e registra pedidos' },
    { id: 'SET-02', nome: 'Análise técnica', descricao: 'Avalia projetos e documentos técnicos' },
    { id: 'SET-03', nome: 'Chefia do setor', descricao: 'Valida, decide e assina' },
    { id: 'SET-04', nome: 'Arrecadação', descricao: 'Emite e confere guias de pagamento' },
    { id: 'SET-05', nome: 'Fiscalização', descricao: 'Realiza vistorias e notificações' },
  ],
  sistemas: [
    { id: 'SIS-01', nome: 'SEI', descricao: 'Tramitação de processos (sem integração no MVP)' },
    { id: 'SIS-02', nome: 'Sistema de arrecadação', descricao: 'Emissão de guias de taxas' },
    { id: 'SIS-03', nome: 'Sistema de licenciamento', descricao: 'Registro de licenças e alvarás' },
  ],
  taxas: [
    { id: 'TX-01', nome: 'Taxa de licença para construção', codigo: '[código fictício 01]' },
    { id: 'TX-02', nome: 'Taxa de vistoria', codigo: '[código fictício 02]' },
    { id: 'TX-03', nome: 'Taxa de expediente', codigo: '[código fictício 03]' },
  ],
  documentos: [
    { id: 'DOC-01', nome: 'Requerimento' },
    { id: 'DOC-02', nome: 'Documento de identidade' },
    { id: 'DOC-03', nome: 'Escritura do imóvel' },
    { id: 'DOC-04', nome: 'Projeto arquitetônico' },
    { id: 'DOC-05', nome: 'Comprovante de pagamento' },
  ],
};

const el = (id, tipo, nome, setor, extra = {}) => ({
  id, tipo, nome, setor, documentos: [], sistemas: [], taxas: [], prazo: '', origem: '', ...extra,
});

export const EXAMPLE_ALVARA = {
  processo: 'Emissão de alvará de construção (exemplo fictício)',
  objetivo: 'Autorizar obras que atendem às normas urbanísticas do município.',
  setores: [{ id: 's1', nome: 'Protocolo' }, { id: 's2', nome: 'Análise técnica' }, { id: 's3', nome: 'Chefia do setor' }],
  elementos: [
    el('e1', 'inicio', 'Pedido recebido', 's1', { origem: 'o cidadão abre o pedido no protocolo' }),
    el('e2', 'tarefa', 'Conferir documentos', 's1', { documentos: ['Requerimento', 'Documento de identidade', 'Escritura do imóvel'], sistemas: ['SEI'], origem: 'o protocolo confere se veio toda a documentação' }),
    el('e3', 'decisao', 'Documentação completa?', 's1', { origem: 'se faltar documento, o pedido volta para complementação' }),
    el('e4', 'tarefa', 'Solicitar complementação', 's1', { prazo: '10 dias', origem: 'o requerente tem 10 dias para completar' }),
    el('e5', 'tarefa', 'Emitir guia da taxa', 's1', { sistemas: ['Sistema de arrecadação'], taxas: ['Taxa de licença para construção'], origem: 'o protocolo emite a guia da taxa de licença' }),
    el('e6', 'tarefa', 'Analisar projeto', 's2', { documentos: ['Projeto arquitetônico'], prazo: 'até 15 dias', origem: 'a análise técnica avalia o projeto em até 15 dias' }),
    el('e7', 'decisao', 'Projeto atende às normas?', 's2', { origem: 'se o projeto não atender às normas, é indeferido' }),
    el('e8', 'tarefa', 'Assinar alvará', 's3', { origem: 'a chefia assina o alvará' }),
    el('e9', 'fim', 'Alvará emitido', 's3', { origem: 'termina com o alvará assinado' }),
    el('e10', 'fim', 'Pedido indeferido', 's2', { origem: 'ou com o pedido indeferido' }),
  ],
  fluxos: [
    { de: 'e1', para: 'e2', condicao: '' }, { de: 'e2', para: 'e3', condicao: '' },
    { de: 'e3', para: 'e5', condicao: 'Sim' }, { de: 'e3', para: 'e4', condicao: 'Não' },
    { de: 'e4', para: 'e2', condicao: '' }, { de: 'e5', para: 'e6', condicao: '' },
    { de: 'e6', para: 'e7', condicao: '' }, { de: 'e7', para: 'e8', condicao: 'Sim' },
    { de: 'e7', para: 'e10', condicao: 'Não' }, { de: 'e8', para: 'e9', condicao: '' },
  ],
};

export const EXAMPLE_SANITARIA = {
  processo: 'Renovação de licença sanitária (exemplo fictício)',
  objetivo: 'Renovar a licença de funcionamento de estabelecimentos que cumprem as normas sanitárias.',
  setores: [{ id: 's1', nome: 'Protocolo' }, { id: 's2', nome: 'Fiscalização' }, { id: 's3', nome: 'Chefia do setor' }],
  elementos: [
    el('e1', 'inicio', 'Renovação solicitada', 's1', { origem: 'o responsável solicita a renovação no protocolo' }),
    el('e2', 'tarefa', 'Conferir documentos', 's1', { documentos: ['Requerimento', 'Comprovante de pagamento'], sistemas: ['SEI'], origem: 'o protocolo confere os documentos' }),
    el('e3', 'tarefa', 'Realizar vistoria', 's2', { prazo: 'até 5 dias', taxas: ['Taxa de vistoria'], origem: 'a fiscalização realiza a vistoria em até 5 dias' }),
    el('e4', 'decisao', 'Estabelecimento regular?', 's2', { origem: 'se o estabelecimento não estiver regular' }),
    el('e5', 'tarefa', 'Notificar pendências', 's2', { origem: 'a fiscalização notifica as pendências' }),
    el('e6', 'tarefa', 'Assinar licença', 's3', { origem: 'a chefia assina a licença' }),
    el('e7', 'fim', 'Licença renovada', 's3', { origem: 'termina com a licença renovada' }),
  ],
  fluxos: [
    { de: 'e1', para: 'e2', condicao: '' }, { de: 'e2', para: 'e3', condicao: '' }, { de: 'e3', para: 'e4', condicao: '' },
    { de: 'e4', para: 'e6', condicao: 'Sim' }, { de: 'e4', para: 'e5', condicao: 'Não' },
    { de: 'e5', para: 'e3', condicao: '' }, { de: 'e6', para: 'e7', condicao: '' },
  ],
};

export const EXAMPLES_SEED = [
  { id: 'EX-01', nome: EXAMPLE_ALVARA.processo, origem: 'exemplo fictício', modelo: EXAMPLE_ALVARA },
  { id: 'EX-02', nome: EXAMPLE_SANITARIA.processo, origem: 'exemplo fictício', modelo: EXAMPLE_SANITARIA },
];

/** Respostas de entrevista de exemplo (botão "Preencher com exemplo"). */
export const SAMPLE_ANSWERS = {
  nome: 'Emissão de alvará de construção',
  objetivo: 'Autorizar obras que atendem às normas urbanísticas do município.',
  inicio: 'O cidadão abre o pedido no protocolo.',
  setores: 'Protocolo, Análise técnica e Chefia do setor.',
  passos: 'O protocolo confere se veio toda a documentação e emite a guia da taxa de licença. A análise técnica avalia o projeto em até 15 dias. A chefia assina o alvará.',
  decisoes: 'Se faltar documento, o pedido volta para complementação; o requerente tem 10 dias para completar. Se o projeto não atender às normas, é indeferido.',
  documentos: 'Requerimento, documento de identidade e escritura do imóvel no protocolo; projeto arquitetônico na análise.',
  sistemas: 'SEI na tramitação; sistema de arrecadação para a guia da taxa de licença para construção.',
  fim: 'Análise em até 15 dias. Termina com o alvará assinado ou com o pedido indeferido.',
};

export const SAMPLE_ANSWERS_2 = {
  nome: 'Renovação de licença sanitária',
  objetivo: 'Renovar a licença de funcionamento de estabelecimentos que atendem às normas sanitárias.',
  inicio: 'O responsável solicita a renovação no protocolo.',
  setores: 'Protocolo, Fiscalização e Chefia do setor.',
  passos: 'O protocolo confere os documentos. A fiscalização realiza a vistoria em até 5 dias. A chefia assina a licença.',
  decisoes: 'Se o estabelecimento não estiver regular, a fiscalização notifica as pendências e a vistoria é refeita.',
  documentos: 'Requerimento e comprovante de pagamento no protocolo.',
  sistemas: 'SEI na tramitação; taxa de vistoria.',
  fim: 'Termina com a licença renovada.',
};

/** Perguntas da entrevista guiada (roteiro versionado). */
export const INTERVIEW_SCRIPT = {
  version: 'roteiro-v1',
  questions: [
    { id: 'nome', q: 'Qual é o nome do processo?', hint: 'Ex.: Emissão de alvará de construção' },
    { id: 'objetivo', q: 'Que demanda ou problema este processo resolve?', hint: 'Para quem ele existe e o que entrega no final.' },
    { id: 'inicio', q: 'O que dá início ao processo?', hint: 'Ex.: o cidadão abre um pedido no protocolo; chega um ofício de outra secretaria.' },
    { id: 'setores', q: 'Quais setores participam?', hint: 'Liste os setores, não os nomes das pessoas. Ex.: Protocolo, Análise técnica, Chefia.' },
    { id: 'passos', q: 'Descreva o passo a passo, do início ao fim: qual setor faz o quê, e em que ordem.', hint: 'Escreva como explicaria para um colega novo. Pode ser em tópicos.' },
    { id: 'decisoes', q: 'Em que momentos alguém precisa decidir algo? O que acontece em cada resposta?', hint: 'Ex.: se a documentação estiver incompleta, o processo volta para o requerente.' },
    { id: 'documentos', q: 'Quais documentos são exigidos, e em qual etapa?', hint: 'Se não houver, responda "nenhum".' },
    { id: 'sistemas', q: 'Quais sistemas são usados? Há taxas com código?', hint: 'Ex.: SEI na tramitação; guia da taxa no sistema de arrecadação.' },
    { id: 'fim', q: 'Há prazos? E como o processo termina?', hint: 'Ex.: análise em até 15 dias; termina com o alvará assinado ou o pedido indeferido.' },
  ],
};

/** Entrevista vaga: poucos detalhes, para mostrar o fluxo mínimo e os avisos. */
export const SAMPLE_VAGA = {
  nome: 'Atendimento ao cidadão',
  objetivo: 'Atender os pedidos que chegam ao setor.',
  inicio: 'Chega um pedido.',
  setores: 'Atendimento',
  passos: 'O atendimento resolve o pedido.',
  decisoes: 'nenhuma',
  documentos: 'nenhum',
  sistemas: '',
  fim: '',
};

/** Entrevista com dados pessoais (fictícios): o sistema deve barrar a geração. */
export const SAMPLE_PESSOAL = {
  ...SAMPLE_ANSWERS,
  nome: 'Emissão de alvará (com dados pessoais)',
  documentos: 'Requerimento, RG e CPF 123.456.789-09 do requerente João da Silva no protocolo; projeto arquitetônico na análise.',
  sistemas: 'SEI na tramitação; sistema de arrecadação para a guia da taxa de licença para construção. Dúvidas: maria.souza@exemplo.com ou (86) 99999-0000.',
};

export const SAMPLES = { alvara: SAMPLE_ANSWERS, sanitaria: SAMPLE_ANSWERS_2, vaga: SAMPLE_VAGA, pessoal: SAMPLE_PESSOAL };
