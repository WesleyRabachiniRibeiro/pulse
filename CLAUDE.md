# Pulse

App Electron que prepara um PC novo de uma vez só: a pessoa escolhe os programas e a fila instala tudo em sequência pelo winget.

Arquitetura de referência: `.claude/skills/pulse-architecture/SKILL.md`. Qualquer dúvida de "onde esse código vai" se resolve por ela.

## Convenções

- Código, identificadores, tipos e nomes de arquivo em inglês.
- Todo texto que aparece na tela em português do Brasil.
- Sem comentários no código, exceto para documentar uma limitação externa não-óbvia (ex.: por que o parsing de saída do winget precisa de heurística de texto).
- Os contratos de IPC em `packages/ipc-contract` são a fonte da verdade, validados com zod nas duas pontas.
- `packages/domain` não importa `electron`, `node:*` nem nada de `infra`.
- Renderer nunca importa `node:*` ou `apps/desktop/src/main/infra/*`.

## Monorepo

pnpm workspaces: `apps/desktop` (o app Electron) + quatro pacotes, que só podem se importar nesta ordem, sem volta:

```
catalog-data → domain → utils → ipc-contract, apps/desktop
```

- `catalog-data` — os programas do catálogo e as opções de configuração. Dados, sem dependência nenhuma.
- `domain` — regras puras, schemas zod das entidades, e as primitivas de texto e formatação (`normalizeText`, `formatMb`, `clock`) que as regras usam para montar mensagem.
- `utils` — lógica derivada sobre os tipos do domínio, compartilhada entre main e renderer: predicados da fila, progresso, agrupamento do resumo.
- `ipc-contract` — schemas e tipos dos canais de IPC.

Uma aresta na direção contrária quebra o `pnpm -r` com `ERR_PNPM_TASK_CYCLE`, não só o bom gosto. Se o domínio precisar de algo que está em `utils`, essa coisa desce para o domínio.

- `pnpm dev` — sobe o app em desenvolvimento.
- `pnpm build` / `pnpm dist` — build de produção / instalador.
- `pnpm typecheck` — `tsc --noEmit` em cada workspace.
- `pnpm test` — o teste de arquitetura da raiz, depois os de `vitest` de cada workspace.

`architecture.test.ts`, na raiz, percorre os imports e reprova quem cruza camada. Ele é o que faz as regras acima valerem de verdade, então regra nova aqui é regra nova lá.

A versão do pnpm está fixada em `packageManager`. Os shims do corepack estão desligados nesta máquina, porque o corepack que vem com o Node 24 procura `bin/pnpm.cjs`, arquivo que o pnpm 12 não publica mais. Se `pnpm` voltar a falhar com `Cannot find module ... pnpm.cjs`, rode `corepack disable pnpm`.

## Terminal

Use o Bash para tudo que ele der conta: ler, buscar, editar arquivos, git, npm e node.

O PowerShell está liberado, mas só quando não houver caminho pelo Bash. Na prática isso quer dizer coisas presas ao Windows: WMI e CIM, APIs do Win32 via `Add-Type`, e cmdlets sem equivalente. Registro e processos costumam sair mais direto com `reg query` e `tasklist`, que rodam no Bash.

Cuidado conhecido: barras invertidas se perdem quando um script do PowerShell passa por heredoc do Bash. Para mexer em arquivo com barra invertida, use as ferramentas de edição em vez de `sed` ou heredoc.

## Build

`pnpm --filter desktop dist` gera o instalador e o portátil em `D:/Pulse-build`. O portátil descompacta o app inteiro no TEMP a cada abertura e leva cerca de 40 segundos até a janela aparecer; o instalado abre em 4. Para distribuir, prefira o instalador.
