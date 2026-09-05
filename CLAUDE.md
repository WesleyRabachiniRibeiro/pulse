# Pulse

App Electron que prepara um PC novo de uma vez só: a pessoa escolhe os programas e a fila instala tudo em sequência pelo winget.

## Convenções

- Código, identificadores, tipos e nomes de arquivo em inglês.
- Todo texto que aparece na tela em português do Brasil.
- Sem comentários no código.
- Os contratos de IPC em `shared/ipc/contracts.ts` são a fonte da verdade, validados com zod nas duas pontas.

## Terminal

Use o Bash para tudo que ele der conta: ler, buscar, editar arquivos, git, npm e node.

O PowerShell está liberado, mas só quando não houver caminho pelo Bash. Na prática isso quer dizer coisas presas ao Windows: WMI e CIM, APIs do Win32 via `Add-Type`, e cmdlets sem equivalente. Registro e processos costumam sair mais direto com `reg query` e `tasklist`, que rodam no Bash.

Cuidado conhecido: barras invertidas se perdem quando um script do PowerShell passa por heredoc do Bash. Para mexer em arquivo com barra invertida, use as ferramentas de edição em vez de `sed` ou heredoc.

## Build

`npm run dist` gera o instalador e o portátil em `D:/Pulse-build`. O portátil descompacta o app inteiro no TEMP a cada abertura e leva cerca de 40 segundos até a janela aparecer; o instalado abre em 4. Para distribuir, prefira o instalador.
