// Cenários de simulação do Servidor de LLM: como o "modelo" vai se comportar na próxima geração.
export const SCENARIOS = [
  { id: 'ok', label: 'Acerta de primeira', descricao: 'O modelo devolve um fluxo válido na primeira tentativa.' },
  { id: 'erra_e_corrige', label: 'Erra e se corrige', descricao: 'A 1ª resposta tem uma decisão sem saída. A verificação estrutural pega e a autocorreção resolve.' },
  { id: 'json_invalido', label: 'Resposta fora do formato', descricao: 'A 1ª resposta vem com texto antes do JSON. A correção pede só o JSON.' },
  { id: 'erra_sempre', label: 'Erra sempre', descricao: 'O modelo repete o erro em todas as tentativas: o rascunho sai com problemas e o envio fica bloqueado.' },
  { id: 'omissao', label: 'Omite um caminho (válido, mas incompleto)', descricao: 'O fluxo passa na verificação, mas falta um caminho (por exemplo, o indeferimento). Só a revisão humana percebe.' },
  { id: 'invencao', label: 'Inventa uma etapa', descricao: 'O fluxo é válido, mas traz uma etapa que não está na entrevista (fica marcada como “sem origem”).' },
  { id: 'indisponivel', label: 'Servidor de LLM fora do ar', descricao: 'A chamada ao modelo falha. As respostas ficam salvas e dá para tentar de novo.' },
];
export const SCENARIO_IDS = SCENARIOS.map((s) => s.id);
