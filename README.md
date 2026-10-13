# FluxoIA · mockup funcional

Mockup **somente front-end** do FluxoIA (projeto da Fábrica de IA do Piauí, UFPI, para a SECTI): gera diagramas BPMN a partir de uma **entrevista guiada**, com **revisão e validação humana**. O foco é a experiência de gerar e validar um fluxo, incluindo os casos de erro, de correção e de falha. É um site estático (HTML, CSS e módulos ES, sem build).

> **Tudo aqui é simulação.** A API, o banco e o modelo de linguagem rodam dentro do navegador e os dados são **fictícios**. Nada é enviado a servidor algum.

## Como rodar

```bash
# precisa de HTTP: módulos ES não funcionam abrindo o index.html por file://
python3 -m http.server 8080      # ou: npm run serve
# abra http://localhost:8080
```

**GitHub Pages:** suba a pasta para o repositório (`main`) e, em *Settings › Pages*, escolha *Source: GitHub Actions*. O workflow `.github/workflows/pages.yml` roda os testes e publica. (Sem Actions: *Deploy from a branch*, `main`, pasta `/ (root)`.) O site usa só caminhos relativos e rota por hash.

## Casos de demonstração (tela inicial)

Cada caso escolhe o cenário do modelo simulado, cria um processo com uma entrevista de exemplo e leva você ao ponto certo. Uma faixa azul no topo diz o que observar.

| Caso | O que simula | O que observar |
|---|---|---|
| Caminho feliz | Modelo acerta de primeira (alvará) | Sinais verificáveis, explicação por etapa, ajuste por texto |
| Decisão com retorno | Licença sanitária com laço de retorno | O laço no diagrama |
| Erra e se corrige | 1ª resposta com decisão sem saída | Verificação acusa o problema, correção resolve (“1 correção automática”) |
| Resposta fora do formato | 1ª resposta com texto antes do JSON | “Não é um JSON válido” e correção |
| Erro que não se corrige | Erro em todas as tentativas | Pontos a corrigir em vermelho, envio bloqueado |
| Servidor de LLM fora do ar | Chamada ao modelo falha | Erro claro, respostas salvas, “Tentar de novo” |
| Dados pessoais nas respostas | CPF, e-mail e telefone (fictícios) | Alerta e geração bloqueada até trocar por setores e cargos |
| Entrevista vaga | Pouca informação | Fluxo mínimo e aviso de uma etapa só |
| Etapa inventada | Etapa que não está na entrevista | Etapa tracejada em vermelho (“sem origem”) e nos sinais |
| Omissão que só a revisão humana pega | Falta o caminho de indeferimento, mas a estrutura é válida | Você entra como chefe do setor, compara com as respostas e devolve |

O botão **Simulação** (topo) troca o cenário à mão, o número máximo de autocorreções e a velocidade. O cenário vale para a **próxima** geração.

## O que há de validação

- **Verificação estrutural** (`js/ai/verifier.js`): código comum que confere se o desenho é um BPMN bem formado (um início, ao menos um fim, decisões com 2+ saídas rotuladas, setores válidos, tudo alcançável). **Não sabe se o processo está certo.**
- **Validação humana** (tela *Validação*): o chefe do setor vê o diagrama somente leitura, **as respostas da entrevista ao lado**, as etapas **sem origem** marcadas, e um **checklist**. Aprova com motivo e norma (o checklist fica registrado na versão) ou **devolve** com observação. A API recusa a ação para outro perfil (403).
- **Versões**: histórico, comparação com a versão anterior, restauração como rascunho e a **linha do tempo** do processo (gerado, ajustado, enviado, devolvido, aprovado).

## Arquitetura do código (cada caixa do M2 é uma pasta)

| Caixa | Pasta | Neste mockup |
|---|---|---|
| Interface web | `js/web/`, `css/` | Real (JavaScript puro) |
| API backend | `js/api/` | Simulada: roteador, serviços, papéis, versões, guardrail de dados pessoais |
| Componente de IA | `js/ai/` | Fachada + contrato; orquestração real (prompt, verificação, correção, patch) |
| Servidor de LLM | `js/ai/llm/` | **Simulado** (`mockGenerator.js`, `mockLLM.js` com os cenários) ou endpoint compatível com OpenAI (experimental, em Simulação › Avançado) |
| Conversor BPMN | `js/bpmn/` | Real: JSON ⇄ BPMN 2.0 com layout por raias |
| PostgreSQL | `js/db/` | Simulado em `localStorage` |
| Catálogo e exemplos | `js/reference/` | Dados fictícios que alimentam o prompt e os avisos |

Regra de dependência: a interface só importa o cliente da API; a API só fala com a IA por `ai.run(...)`; a IA só recebe o que vem no pedido.

## Testes

```bash
npm test    # Node 20+, sem dependências: 42 testes (conversor, verificação, patch, IA, cenários, guardrail, API, validação)
```

A interface foi testada manualmente em navegador real (todos os casos acima, aprovação, versões, exportação, celular). Não há suíte automática de interface no repositório.

## Limites conhecidos

- O modelo simulado entende o português por **heurísticas**: funciona bem com respostas parecidas com os exemplos (verbos como *confere, emite, avalia, assina*; decisões no formato “se …, …”). Textos muito diferentes geram fluxos mais pobres.
- Ajustes por texto reconhecem quatro padrões (mover de setor, adicionar, remover, renomear).
- O **perfil** (servidor ou chefe do setor) é só um seletor: **não há autenticação**.
- O bloqueio por dados pessoais usa padrões simples (CPF, e-mail, telefone); não detecta nomes de pessoas. No M2 está como “alerta”; aqui bloqueia a geração, por ser mais seguro.
- O PDF é gerado no navegador (jsPDF); no sistema real seria pela API.
- O layout automático é simples: laços e várias saídas podem ficar apertados (o editor permite ajustar à mão).
- Dados em `localStorage` (alguns MB, por navegador). *Simulação › Reiniciar demonstração* apaga tudo.
- **Máximo de autocorreções** (padrão 3) é um parâmetro a calibrar na PoC, não uma regra.

## Estrutura

```
index.html
css/                tokens, base, layout, componentes e telas
js/
  main.js           ponto de entrada
  composition.js    monta banco + IA + conversor + API
  domain/           modelo do processo e diff entre versões
  web/              interface (views/, components/, demoCases.js, apiClient, router)
  api/              roteador, serviços, rotas e guardrail
  ai/               componente de IA (contrato, orquestração, prompt, verificação, patch, llm/)
  bpmn/             layout e conversor JSON ⇄ BPMN 2.0
  db/               banco simulado
  reference/        catálogo e exemplos fictícios
  util/             rastro interno, texto, XML, relógio
vendor/             bpmn-js e jsPDF (copiados, sem CDN)
tests/              testes de Node (node:test)
.github/workflows/  publicação no GitHub Pages
```

## Licenças de terceiros

`vendor/README.md` lista bpmn-js e jsPDF. A licença do bpmn-js exige manter a marca “bpmn.io” visível no canvas. Defina a licença do seu próprio código antes de tornar o repositório público.
