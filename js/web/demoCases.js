// Casos de demonstração principais para apresentação executiva.
// Cada caso prepara uma entrevista de exemplo e o comportamento do modelo,
// ilustrando um pilar fundamental da solução (geração assistida, governança humana e privacidade).

export const CASES = [
  {
    id: 'feliz',
    tag: 'Geração guiada',
    titulo: 'Caminho feliz (Mapeamento com IA)',
    amostra: 'alvara',
    cenario: 'ok',
    inicio: 'entrevista',
    descricao: 'Entrevista de alvará de construção. A IA gera o diagrama BPMN em raias por setor e permite ajustes em português.',
    observe: 'Clique em "Gerar fluxo". No rascunho, veja os setores organizados em raias, clique nas etapas para ver a origem na entrevista e experimente pedir um ajuste por texto.'
  },
  {
    id: 'omissao',
    tag: 'Validação',
    titulo: 'Governança humana (Chefe do Setor)',
    amostra: 'alvara',
    cenario: 'omissao',
    inicio: 'validacao',
    descricao: 'O modelo omite o caminho de indeferimento. O chefe do setor compara o desenho com as respostas ao lado e devolve com observações.',
    observe: 'Você entra como Chefe do Setor. Compare o diagrama com as respostas abaixo, preencha o checklist e use "Devolver para ajustes". Depois veja a devolução no perfil do servidor.'
  },
  {
    id: 'pessoal',
    tag: 'Segurança',
    titulo: 'Proteção de Privacidade (LGPD)',
    amostra: 'pessoal',
    cenario: 'ok',
    inicio: 'entrevista',
    descricao: 'Respostas com CPF, e-mail ou telefone são bloqueadas preventivamente antes do envio para a IA, protegendo dados pessoais.',
    observe: 'Veja os alertas em vermelho nas respostas com CPF/contato. O botão "Gerar fluxo" fica travado até que dados pessoais sejam trocados por setores ou cargos institucionais.'
  },
];

export const caseById = (id) => CASES.find((c) => c.id === id) ?? null;

const KEY = (processId) => `fluxoia:case:${processId}`;
export const rememberCase = (processId, caseId) => {
  try { localStorage.setItem(KEY(processId), caseId); } catch { /* ignora */ }
};
export const recallCase = (processId) => {
  try { return caseById(localStorage.getItem(KEY(processId))); } catch { return null; }
};

/** Prepara o caso e devolve o caminho (hash) para onde ir. */
export async function startCase(ctx, c, { links, state }) {
  const { api } = ctx;
  await api.setConfig({ scenario: c.cenario });
  const { exemplos } = await api.script();
  const respostas = exemplos[c.amostra];
  const p = await api.createProcess(respostas.nome);
  rememberCase(p.id, c.id);
  await api.saveAnswers(p.id, respostas);
  if (c.inicio === 'entrevista') return { path: links.interview(p.id), role: 'servidor' };
  await ctx.busy.run('Gerando o fluxo', () => api.generate(p.id));
  if (c.inicio === 'rascunho') return { path: links.draft(p.id), role: 'servidor' };
  await api.submit(p.id);
  return { path: links.approval(p.id), role: 'validador' };
}
