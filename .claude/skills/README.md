# Skills do projeto

Skills carregadas pelo Claude Code em qualquer sessão deste repositório (inclusive na nuvem). Use `/nome` para chamar; as que não têm `disable-model-invocation: true` também são usadas automaticamente quando o pedido combina com a descrição.

| Skill | Para quê | Origem |
|---|---|---|
| `ponytail` | Menor mudança que resolve a tarefa; sem over-engineering | enviada pelo dono do repo |
| `find-docs` | Docs atualizadas de bibliotecas (Firebase, Leaflet, Chart.js…) via `npx ctx7@latest` | [upstash/context7](https://github.com/upstash/context7) |
| `diagnosing-bugs` | Loop de diagnóstico para bugs difíceis | [mattpocock/skills](https://github.com/mattpocock/skills) |
| `codebase-design` | Vocabulário de módulos profundos (base das duas abaixo) | mattpocock/skills |
| `improve-codebase-architecture` | Relatório HTML de oportunidades de refatoração (`/improve-codebase-architecture`) | mattpocock/skills |
| `domain-modeling` | Mantém `GLOSSARY.md` e ADRs em `docs/adr/` | mattpocock/skills |
| `grilling`, `grill-me`, `grill-with-docs` | Entrevista para afiar um plano antes de construir | mattpocock/skills |
| `prototype` | Protótipo descartável para testar lógica ou layout | mattpocock/skills |
| `research` | Pesquisa em fontes primárias, salva em Markdown | mattpocock/skills |
| `handoff` | Resumo da conversa para outra sessão continuar (`/handoff`) | mattpocock/skills |
| `writing-for-agents` | Como escrever skills e o CLAUDE.md | mattpocock/skills |

Copiadas sem alteração (só a pasta `agents/`, específica do Codex, ficou de fora). Para atualizar, substitua a pasta pela versão nova do repositório de origem.

## Licenças

`mattpocock/skills`: MIT License, Copyright (c) 2026 Matt Pocock.
`upstash/context7`: MIT License, Copyright (c) 2021 Upstash, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
