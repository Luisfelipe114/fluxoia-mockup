// Esquema do banco simulado (equivalente às tabelas do PostgreSQL da arquitetura).
// Serve de documentação e alimenta a aba "Banco" da tela de Arquitetura.

export const SCHEMA = {
  processos: 'id PK, nome, status (rascunho | em_validacao | aprovado), devolucao, criado, atualizado',
  respostas: 'id PK (= processo_id), valores JSONB, roteiro',
  rascunhos: 'id PK (= processo_id), modelo JSONB, xml, meta JSONB, atualizado',
  versoes: 'id PK, processo_id, n, modelo JSONB, xml, validador, motivo, norma, aprovada_em',
  feedback: 'id PK, processo_id, nota, comentario, criado',
  auditoria: 'id PK, processo_id, tipo, resultado, modelo, prompt_versao, tentativas, duracao_ms, detalhe JSONB, criado',
  catalogo_setores: 'id PK, nome, descricao',
  catalogo_sistemas: 'id PK, nome, descricao',
  catalogo_taxas: 'id PK, nome, codigo',
  catalogo_documentos: 'id PK, nome',
  exemplos: 'id PK, nome, origem, modelo JSONB',
};

export const TABLE_NAMES = Object.keys(SCHEMA);
