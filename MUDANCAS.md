# Mudanças desta versão (em relação à anterior)

Foco: geração (entrevista guiada) e validação, com casos simulados de acerto, erro, correção e falha.

## Removido
- Telas **Arquitetura** e **Material de referência** (importação de CSV e .bpmn, catálogo e exemplos na interface).
  - `js/web/views/architecture.js`, `js/web/views/library.js`
  - `js/web/components/architectureDiagram.js`, `js/web/components/traceList.js`
  - `js/api/routes/referencia.js` (rotas `/catalogo`, `/exemplos`, `/referencia/*`) e rotas `/auditoria`, `/banco`
- O catálogo e os exemplos continuam existindo por dentro (alimentam o prompt e os avisos), só não têm tela.

## Adicionado
- **Casos de demonstração** na tela inicial: `js/web/demoCases.js`, `js/web/components/caseHint.js` (faixa “o que observar”).
- **Cenários do modelo simulado**: `js/ai/llm/scenarios.js` e novos comportamentos em `js/ai/llm/mockLLM.js`
  (acerta, erra e se corrige, resposta fora do formato, erra sempre, omite um caminho, inventa uma etapa, fora do ar).
- **Painel Simulação** (botão no topo): `js/web/components/simulationPanel.js`.
- **Guardrail de dados pessoais** (CPF, e-mail, telefone): `js/api/guardrails.js`; a geração é bloqueada até corrigir.
- **Validação reforçada** (`js/web/views/approval.js`): respostas da entrevista junto do diagrama, checklist do validador
  (registrado na versão), etapas sem origem tracejadas em vermelho, confirmação ao aprovar com checklist incompleto.
- **Histórico do processo** (linha do tempo) na tela de Versões; rota `GET /processos/:id/historico`.
- **Erro do servidor de LLM** tratado (HTTP 503, respostas preservadas, botão “Tentar de novo”).
- Novas entrevistas de exemplo (`vaga`, `pessoal`) em `js/reference/seed.js`; aviso quando o fluxo tem uma etapa só.

## Corrigido
- O botão **Enviar para validação** (e exportações) salvava o diagrama mesmo sem alterações, registrando uma “edição direta” inexistente.
  Agora só salva quando há mudança de fato (`draft.js`).
- Diálogos de confirmação devolviam o valor errado em alguns navegadores (`ui.js`).
- Configuração: `failureSim` foi substituído por `scenario` (`composition.js`). Configurações antigas salvas no navegador são ignoradas.

## Para atualizar o seu repositório
Substitua a pasta pelo conteúdo do novo zip e apague os arquivos listados em “Removido”. Se você já tinha dados no navegador, use
*Simulação › Reiniciar demonstração* uma vez.
