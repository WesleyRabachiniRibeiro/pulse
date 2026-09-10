# Pulse

App Electron que prepara um PC novo de uma vez só: a pessoa escolhe os programas e a fila instala tudo em sequência pelo winget.

## Convenções

- Código, identificadores, tipos e nomes de arquivo em inglês.
- Todo texto que aparece na tela em português do Brasil.
- Sem comentários no código.
- Os contratos de IPC em `shared/ipc/contracts.ts` são a fonte da verdade, validados com zod nas duas pontas.

## Arquitetura

Três raízes: `electron/` é o processo principal, `src/` é o renderer, `shared/` é o que os dois usam de verdade.

```
electron/
├── core/            não conhece domínio: ipc/ e powershell/
├── modules/<nome>/  um contexto por pasta
│   ├── infrastructure/  fala com o Windows, inclusive os .ps1
│   └── steps/           no installation, um arquivo por ajuste
├── bootstrap/       sobe o app e registra os módulos
└── preload/         a ponte, só canais declarados

src/
├── features/<nome>/ components/, store/, hooks/, lib/
└── shared/          ui/, styles/, lib/
```

Aliases: `@main` para `electron/`, `@shared` para `shared/`, `@` para `src/`.

Regras que o `shared/architecture.test.ts` cobra, além de não haver ciclo de import:

- Só arquivo dentro de `infrastructure/` importa `@main/core/powershell`. Serviço pede o dado, não sabe de onde veio.
- O renderer não importa nada de `electron/`. A conversa é pelo preload.

O `eslint-plugin-boundaries` cuida do resto: módulo não entra em módulo vizinho a não ser pelo `index.ts`.

Componente é pasta: `Component/` com `Component.tsx`, o CSS que só ele usa e `index.ts`. CSS usado por mais de um componente sobe para o nível da feature com nome de compartilhado, como `tabs.module.css`.

Para ensinar um ajuste novo de programa: descreva o dado em `shared/domain/steps/`, escreva o runner em `electron/modules/installation/steps/` e ponha o id no `ORDER` do índice de lá.

## Terminal

Use o Bash para tudo que ele der conta: ler, buscar, editar arquivos, git, npm e node.

O PowerShell está liberado, mas só quando não houver caminho pelo Bash. Na prática isso quer dizer coisas presas ao Windows: WMI e CIM, APIs do Win32 via `Add-Type`, e cmdlets sem equivalente. Registro e processos costumam sair mais direto com `reg query` e `tasklist`, que rodam no Bash.

Cuidado conhecido: barras invertidas se perdem quando um script do PowerShell passa por heredoc do Bash. Para mexer em arquivo com barra invertida, use as ferramentas de edição em vez de `sed` ou heredoc.

## Build

`npm run dist` gera o instalador e o portátil em `D:/Pulse-build`. O portátil descompacta o app inteiro no TEMP a cada abertura e leva cerca de 40 segundos até a janela aparecer; o instalado abre em 4. Para distribuir, prefira o instalador.
