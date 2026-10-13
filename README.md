# FluxoIA · Mockup Funcional

Mockup funcional e interativo do **FluxoIA** (projeto da Fábrica de IA do Piauí, UFPI, para a SECTI): gera diagramas BPMN 2.0 a partir de uma **entrevista guiada**, com **ajustes em linguagem natural** e **validação humana**.

É uma aplicação web estática (HTML, CSS e JavaScript modular nativo, sem build), pronta para ser executada localmente ou acessada diretamente pelo **GitHub Pages**.

> **Acesso online:** [https://luisfelipe114.github.io/fluxoia-mockup/](https://luisfelipe114.github.io/fluxoia-mockup/)  
> *(Tudo roda no navegador do cliente: a IA, a persistência e as regras de negócio são simuladas localmente com dados fictícios).*

---

## Como rodar localmente

Como o projeto utiliza módulos ES nativos (`import`/`export`), ele requer um servidor HTTP simples para evitar bloqueios de CORS por protocolo `file://`:

```bash
# Servidor HTTP local (Python)
python3 -m http.server 8080

# Ou, se preferir via Node:
npm run serve
```
Abra [http://localhost:8080](http://localhost:8080) no seu navegador.

### Publicação no GitHub Pages
O repositório já conta com o workflow do GitHub Actions ([.github/workflows/pages.yml](file:///.github/workflows/pages.yml)):
1. No repositório, acesse **Settings › Pages**.
2. Em **Source**, selecione **GitHub Actions**.
3. A cada `git push` na branch `main`, a suíte de testes é executada e o deploy é feito de forma automática.

---

## Casos de Demonstração (Tela Inicial)

A tela inicial foi simplificada para apresentar os **três pilares essenciais** da solução:

| Caso | Pilar | O que observar |
|---|---|---|
| **Sucesso (Mapeamento com IA)** | Geração assistida | Responda à entrevista ou use o exemplo. A IA gera o diagrama BPMN organizado por raias (*lanes*). Você pode clicar nas etapas para rastrear a origem na entrevista e pedir ajustes por texto (ex.: *"adicione a etapa X depois de Y"*). |
| **Governança humana (Chefe do Setor)** | Validação e Governança | O modelo omite o caminho de indeferimento. Você atua como chefe do setor, confere o diagrama lado a lado com as respostas originais e devolve com observações para correção antes da aprovação. |
| **Proteção de Privacidade (LGPD)** | Segurança institucional | Respostas contendo dados pessoais (CPF, e-mail, telefone) são detectadas preventivamente, bloqueando a geração até que sejam substituídas por cargos e setores institucionais. |

> **Ajustes de simulação:** No rodapé da página, há o link **Simulação**, que permite reiniciar os dados salvos no navegador ou testar cenários específicos de modelo.

---

## Recursos e Funcionalidades

- **Entrevista Guiada:** Perguntas em linguagem natural, sem exigir conhecimento técnico de BPMN do servidor.
- **Diagrama Interativo (bpmn-js):** Visualização em raias por setor, zoom, movimentação de nós e edição visual direta.
- **Rastreabilidade e Origem:** Clique em qualquer etapa para saber de qual resposta da entrevista ela surgiu. Etapas sem origem clara são destacadas.
- **Validação com Papéis:** Seletor de perfil no topo (`Servidor` e `Chefe do setor`). Apenas o validador pode aprovar ou devolver processos.
- **Histórico e Versões:** Linha do tempo de todas as ações (gerações, edições, devoluções e aprovações), histórico de versões oficiais e comparação estrutural (*diff*).
- **Exportação Completa:** 
  - **Download em `.bpmn` (XML):** Arquivo padronizado BPMN 2.0 compatível com Camunda Modeler, bpmn.io e engines de processo.
  - **Download em `PDF`:** Relatório técnico contendo o diagrama desenhado e a ficha técnica detalhada do processo (etapas, setores, documentos, taxas e prazos).

---

## Arquitetura do Mockup

O mockup foi estruturado para espelhar a arquitetura de produção prevista (separação de responsabilidades entre front-end, serviços de API, conversor BPMN e orquestração de IA):

```
index.html                  Ponto de entrada da aplicação
css/                        Design system: tokens, base, layout, componentes e telas
js/
  main.js                   Inicialização e composição dos serviços
  composition.js            Montagem do banco, orquestrador de IA e API
  domain/                   Modelo de domínio do processo e cálculo de diff
  web/                      Interface: telas (views), componentes e cliente de API
  api/                      Serviços de negócio, regras de aprovação e guardrails LGPD
  ai/                       Orquestração de prompt, verificação estrutural e autocorreção
  bpmn/                     Conversor determinístico JSON ⇄ BPMN 2.0 e motor de layout
  db/                       Armazenamento estruturado no navegador (localStorage)
  reference/                Catálogo e exemplos institucionais fictícios (SDU Leste)
vendor/                     Bibliotecas empacotadas (bpmn-js e jsPDF)
tests/                      Suíte de testes automatizados em Node.js
.github/workflows/          Automação de testes e deploy no GitHub Pages
```

---

## Testes Automatizados

O projeto inclui suíte de testes unitários sem dependências externas (usando o `node:test` nativo do Node 20+):

```bash
npm test
```

São **42 testes automatizados** cobrindo o conversor BPMN, integridade de regras, guardrails de dados pessoais, orquestração de IA, histórico de versões e rotas de serviços.
