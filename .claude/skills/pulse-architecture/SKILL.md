---
name: pulse-architecture
description: Arquitetura de referência do Pulse (app Electron para preparar PCs Windows recém-formatados via winget). Use sempre que for decidir onde um código deve morar, criar uma feature nova, revisar um PR quanto a limites de camada, ou discutir estrutura de pastas/processos do projeto.
---

# Arquitetura do Pulse

Pulse é um app desktop Electron/Windows que instala em fila, via `winget`, os programas que o usuário escolher, atravessando quatro telas em sequência: **Verificação → Seleção → Instalação → Resumo**.

Esta skill é a referência canônica de arquitetura. Qualquer decisão de "onde esse código vai" deve ser resolvida por ela antes de ser resolvida por conveniência.

## Domínio (o que não muda)

- **Verificação**: antes de liberar a Seleção, checa versão do Windows, se roda como admin, presença do `winget`, internet, virtualização ligada, espaço livre por disco. Cada checagem retorna `ok | aviso | impedimento`. A conta de disco é a parte não-óbvia: **todo instalador estoura temp no disco do sistema**, mesmo quando o destino final é outro disco — a regra de espaço precisa somar esse custo temporário ao disco do sistema independentemente de onde o programa será instalado.
- **Seleção**: catálogo de 46 programas em 4 categorias (navegadores, games, comunicação e mídia, desenvolvimento), cada um com tamanho de download; rodapé soma total a baixar e estima tempo; usuário escolhe disco de instalação por item.
- **Instalação**: fila sequencial, cada item percorre `baixando → instalando → configurando → pronto` ou desvia para `falhou`/`cancelado`. Um item pode entrar em `esperando` quando depende do usuário (UAC, login da Steam). Cancelar um item não derruba a fila. Falhou pode ser retentado. Dá para adicionar itens com a fila já rodando.
- **Resumo**: agrupa pronto / pede reinício / precisa de atenção / não entrou.

Essas regras (especialmente o cálculo de disco e a máquina de estados da fila) são **regras de negócio**, não detalhes de UI nem de IPC. Elas vivem na camada de domínio, ponto.

## Modelo de processos (limite não-negociável do Electron)

```
┌─────────────────────────┐        IPC        ┌──────────────────────────┐
│         MAIN            │ ◄────invoke/send──►│        RENDERER          │
│  (Node, Windows, winget) │                    │  (Chromium, zero Node)   │
└─────────────────────────┘                    └──────────────────────────┘
              ▲                                             ▲
              └───────────────── PRELOAD ──────────────────┘
                       (contextBridge, sem lógica)
```

Regras fixas:
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` no renderer. Sempre.
- **Renderer nunca importa `child_process`, `fs`, `registry`, nem chama `winget` direta ou indiretamente.** Se uma tela "precisa" fazer isso, a modelagem está errada — falta um caso de uso no main.
- **Preload não tem lógica.** É só a lista de canais permitidos, tipados, expostos via `contextBridge`. Se tem `if` de negócio no preload, ele está no lugar errado.
- **Main não guarda estado de UI.** Ele guarda o estado real (fila, checagens, catálogo) e o renderer é só espectador desse estado.

## Camadas (Hexagonal / Ports & Adapters)

Dentro do processo main, mais uma fronteira, ortogonal à do Electron: **domínio não conhece Electron nem Windows**.

```
domain          → entidades, value objects, regras puras. Zero import de electron/node/winget.
application     → casos de uso, orquestra ports. Não sabe COMO winget roda, só QUE existe um PackageInstaller.
ports           → interfaces que a application declara e a infra implementa.
infra (adapters)→ implementação real: winget, PowerShell/registro, disco, persistência.
main/ipc        → controllers finos: recebem invoke, chamam um caso de uso, devolvem/emitem.
```

### domain/
Sem dependência de `electron`, `child_process`, `fs`. Testável com `vitest` puro, sem mocks.

- **Entidades/VOs**: `Program`, `Category`, `Catalog`, `Drive`, `Item`, `Run`, `Check`. As formas são schemas zod, e o tipo sai do schema com `z.infer`.
- **Regras**: o cálculo de espaço em `preflight.ts` é onde mora, e só ali, a regra "todo instalador estoura temp no disco do sistema". Junto dele vêm `estimatedMinutes`, `totalSizeMb` e a avaliação de cada checagem em `ok | warning | blocker`.
- **Primitivas**: `text.ts` e `formatting.ts` moram aqui, não em `utils`. São o fundo da pilha, e as regras do domínio precisam delas para montar mensagem. Se `domain` importasse de `utils`, o grafo de pacotes fecharia um ciclo.
- **Máquina de estados da fila** (também domínio puro, não em um `useState` de componente):

```
queued → downloading → installing → configuring → ready
                                  ↘ waiting(reason: uac | steam-login | ...) → installing
   ↘ canceled            (a partir de qualquer estado não-terminal)
   ↘ failed              (a partir de downloading/installing/configuring, retry → queued)
```

### application/ (casos de uso)
Um caso de uso = uma intenção do usuário ou do sistema. Cada um depende só de **ports**, nunca de um adapter concreto.

O que existe hoje, um por pasta em `main/application/`:

- `RunSystemVerification` (usa `SystemInspector`, `DiskSpaceProbe`), com `DriveCache` ao lado
- `CatalogService` (usa `PackageRepository`, `AutostartReader`, `ProcessRunner`)
- `QueueOrchestrator` — dono do estado vivo da fila, de todas as transições e da emissão dos eventos
- `PreferencesService`, `SteamService`, `SystemService`, `UpdateService`, `ReadGitConfig`

### ports/ (interfaces, declaradas pela application, moram perto do domínio)
Uma interface por arquivo em `main/ports/`, em kebab-case: `system-inspector`, `disk-space-probe`, `package-repository`, `queue-repository`, `powershell-runner`, `process-runner`, `autostart-reader`, `autostart-registry`, `browser-default-setter`, `clipboard-writer`, `drive-lister`, `notification-presenter`, `power-controller`, `preferences-store`, `steam-game-requester`, `steam-library-reader`, `update-checker`.

### infra/ (adapters — aqui mora tudo que é Windows/winget de verdade)

Falar com o Windows não é detalhe de um adapter isolado, é uma decisão que atravessa toda a infra. Por isso ela tem portas próprias, e nenhum adapter dá `spawn` por conta.

#### As duas portas que falam com o SO

São duas, com recortes diferentes, e é erro comum tratar como se fosse uma:

- **`PowerShellRunner`** roda os scripts `.ps1` versionados do projeto. É o caminho para consultar o Windows: registro, WMI, discos, navegadores registrados, autostart, Steam.
- **`ProcessRunner`** sobe executáveis de verdade por array de argumentos: `winget`, `git`, `shutdown`, o navegador. Também é ele que faz as duas variantes especiais, elevado e na sessão interativa do usuário, cada uma por um `.ps1` que embrulha a chamada.

Esses dois adapters, `NodePowerShellRunner` e `WindowsProcessRunner`, são os únicos lugares do projeto que chamam `child_process.spawn`. Um adapter que precise de processo pede ao `ProcessRunner`; um que precise de informação do Windows pede ao `PowerShellRunner`. Nenhum outro dá `spawn` por conta.

- **Um comando por chamada, sem runspace persistente (por enquanto)**: cada operação sobe um `pwsh -NoProfile -NonInteractive -ExecutionPolicy Bypass -File <script>`. É mais simples de implementar, cancelar e testar do que manter um processo PowerShell vivo trocando mensagens por stdin/stdout. Justificativa: o próprio `winget install` já domina o tempo (segundos a minutos); o custo de spawn (~150-300ms) é irrelevante perto disso, e a tela de Verificação dispara poucas checagens. **Só migrar para runspace persistente se profiling real mostrar que o spawn pesa** — não antecipar essa complexidade.
- **Scripts são arquivos `.ps1` versionados**, não strings montadas em TypeScript. Eles moram em `apps/desktop/resources/powershell/scripts/`, fora de `src/`, porque o electron-builder os copia como recurso para dentro do app empacotado. Cada um é revisável, testável e diffável isoladamente.
- **Parâmetros nunca são interpolados numa string de comando.** Todo valor que vem de fora (id do pacote no catálogo, letra do disco escolhida pelo usuário) entra como parâmetro tipado do próprio script (`param($PackageId, $DiskLetter)`) passado via array de argumentos do `child_process`, ou serializado como um único JSON (`-ParamsJson '...'`) que o script decodifica com `ConvertFrom-Json`. Nunca `"winget install " + id` concatenado.
- **Saída dos scripts é sempre estruturada**: eles terminam emitindo JSON (`ConvertTo-Json -Depth`), nunca texto solto pra fazer regex em cima no Node.
- **O winget é a exceção, e é só ele**: não existe saída estruturada para o progresso de `winget install`, só para consultas de catálogo. Então a fase e o percentual saem de casar texto da barra de progresso, em português ou inglês, e a classificação de erro combina código de saída com a última linha impressa. Esse conhecimento fica confinado em `infra/winget/`, nos dois arquivos que têm teste próprio. Nenhuma outra parte da infra tem licença para fazer regex em texto de console.
- **Progresso de instalação é streaming, não um retorno único**: o `ProcessRunner` entrega o stdout do winget linha a linha por callback, e o `QueueOrchestrator` traduz cada linha numa transição da máquina de estados do item. É o mecanismo concreto por trás do `installation:event`.
- **Cancelamento por item, não por fila**: o adapter mantém um registro `Map<queueItemId, ChildProcess>`. Cancelar um item mata só o processo daquele item (`proc.kill()`/`taskkill /pid X /t /f`); os demais continuam. Isso é o que garante "cancelar um item não derruba o resto".

Os adapters se agrupam por assunto, não por mecanismo. O nome do arquivo diz qual port ele implementa.

```
main/infra/
  powershell/NodePowerShellRunner.ts   # acha o script, spawn, encoding, timeout, parse do JSON
  process/WindowsProcessRunner.ts      # o único spawn do projeto; elevação e sessão interativa
  process/adminOutcome.ts              # traduz os códigos sentinela do Run-AsAdmin.ps1
  process/interactiveUserOutcome.ts    # idem para Run-AsInteractiveUser.ps1
  winget/WingetOutputParser.ts         # progresso, lido do console
  winget/WingetErrorClassifier.ts      # código de saída + última linha → causa
  system/     WindowsSystemInspector, WindowsDiskSpaceProbe, WindowsPowerController
  catalog/    WingetPackageRepository, WindowsAutostartReader
  autostart/  WindowsAutostartRegistry
  browsers/   BrowserDefaultSetterAdapter
  steam/      SteamAdapter, vdf, textVdf
  preferences/JsonPreferencesStore
  updates/    ElectronUpdateChecker
  electron/   ElectronClipboardWriter, ElectronNotificationPresenter
  queue/      InMemoryQueueRepository
```

**Regra de revisão**: se um `infra/*` aparece importado fora de `main/composition-root`, é violação de camada. Se um adapter dá `spawn` ou `exec` sem passar pelo `ProcessRunner`, também é.

#### PackageInstaller (a porta que esconde o winget)

O `QueueOrchestrator` não lê código de saída nem texto de console. Ele pede uma instalação e recebe um desfecho já classificado: `ok`, `already-installed`, `drive-refused`, `installer-busy`, `needs-admin`, `refused-by-user` ou `failed`. Toda falha vem com `message` pronta em português e `code` já em hexadecimal, porque quando as tentativas se esgotam é essa mensagem que a pessoa lê.

Com isso a política de repetição fica legível como política, e não como interpretação de console: disco recusado tenta de novo sem `--location`, instalador ocupado espera e repete, falta de permissão pede o UAC e repete elevado. O `WingetPackageInstaller` é o único dono das regex, dos códigos hexadecimais e da montagem dos argumentos.

> Dívida conhecida, a pagar: `QueueOrchestrator` ainda tem cerca de mil linhas, porque acumula a máquina de estados da fila e toda a configuração pós-instalação (Steam, navegador padrão, autostart, git, extensões). O caminho é extrair essa configuração em casos de uso próprios.

### main/ipc/ (controllers finos)
Só traduzem canal IPC → caso de uso → resposta/evento. Nenhuma regra de negócio aqui. O orquestrador da fila (`QueueOrchestrator`) é o dono do estado vivo e é quem emite os eventos de atualização.

### Padrão de comunicação IPC
- **Comando** (renderer → main): `ipcRenderer.invoke` — pedir checagem, carregar catálogo, enfileirar, cancelar item, retentar item. Request/response.
- **Evento** (main → renderer): `webContents.send` num canal único de estado (`installation:event`) — o main é a fonte única de verdade; o renderer só reflete. Isso evita renderer e main divergirem sobre "o que está instalando agora", inclusive depois de um reload da janela.
- Todo canal tem contrato tipado e validado (zod) em `packages/ipc-contract` — nunca `any` cruzando o `contextBridge`. O `register` de `main/ipc/` valida entrada e saída nos dois sentidos.

## Renderer (as telas)

Cada tela é um módulo vertical em `features/`, navegado pela trilha lateral na ordem fixa do domínio: `preflight`, `selection`, `installation`, `summary`. Ao lado delas vivem as features de apoio, que não são etapas: `home`, `splash`, `tour`, `updates`, `preferences`. Dentro de cada uma, componentes de UI e um store fino de Zustand que só espelha o que chega por `installation:event`.

**O renderer não decide estado de negócio, só exibe.** O `Run` inteiro vem pronto do main. O que a tela pode fazer é derivar visual a partir dele chamando as mesmas funções puras de `@pulse/domain` e `@pulse/utils` que o main chama, como `overallPercent` ou `groupSummary`. Isso não é recalcular regra: é a mesma função, compartilhada, em vez de uma segunda implementação que diverge com o tempo. O que não pode é a tela inventar uma conta que o domínio não tem.

## Estrutura de pastas (monorepo, workspaces)

```
pulse/
├── apps/
│   └── desktop/
│       ├── src/
│       │   ├── main/
│       │   │   ├── application/        # casos de uso
│       │   │   ├── ports/              # interfaces, uma por arquivo, kebab-case
│       │   │   ├── infra/              # adapters, agrupados por assunto
│       │   │   ├── ipc/                # controllers finos
│       │   │   └── composition-root.ts # onde tudo é instanciado e ligado
│       │   ├── preload/                # contextBridge, sem lógica
│       │   └── renderer/
│       │       ├── app/                # App.tsx, a casca e a navegação
│       │       ├── features/           # um módulo vertical por tela
│       │       └── shared/             # ui/, lib/, styles/, assets/
│       ├── resources/                  # empacotado com o app
│       │   ├── powershell/scripts/     # os .ps1 versionados
│       │   └── icons/                  # badges da barra de tarefas
│       ├── build/icon.ico              # ícone do instalador (versionado, apesar do build/)
│       └── electron-builder.yml
├── packages/
│   ├── catalog-data/     # os programas e as opções (dados, sem dependência)
│   ├── domain/           # regras puras, schemas zod, primitivas de texto e formatação
│   ├── utils/            # lógica derivada sobre os tipos do domínio
│   └── ipc-contract/     # schemas zod + tipos dos canais e eventos IPC
└── package.json          # workspaces pnpm, versão fixada em packageManager
```

**A ordem das dependências entre pacotes é uma linha reta, sem volta:**

```
catalog-data → domain → utils → ipc-contract, apps/desktop
```

Uma aresta na contramão não é só feia: o pnpm recusa `-r` com `ERR_PNPM_TASK_CYCLE`. Na prática isso decide uma dúvida recorrente. Se o domínio precisa de uma função que está em `utils`, ela desce para o domínio, e não o contrário. Foi assim que `text.ts` e `formatting.ts` foram parar lá.

## Testes por camada

- **Arquitetura**: `architecture.test.ts`, na raiz do workspace, percorre o grafo de imports e reprova quem cruza camada. Ele trava a direção entre pacotes, a declaração das dependências no `package.json`, `application` sem importar `infra`, `domain` sem `electron` nem `node:*`, o renderer sem alcançar o main, e o `spawn` restrito aos dois runners. **É esse teste, e não a boa vontade de quem revisa, que faz as regras deste documento valerem.** Quando uma regra nova entrar aqui, ela entra lá também.
- `domain` e `utils`: unitário puro, sem mock (é só função/estado). Rodam no `vitest` do próprio pacote.
- `application`: unitário com fakes dos ports (fake `ProcessRunner` que nunca chama winget de verdade).
- `infra` que é função pura: testável direto, sem Windows nenhum. É o caso de `WingetOutputParser`, `WingetErrorClassifier` e `textVdf`, que têm teste hoje.
- `infra` que toca o SO (adapters + scripts `.ps1` reais): teste de integração, marcado à parte, só roda em `windows-latest` no CI (depende de PowerShell/winget reais).
- `renderer`: Testing Library para componentes; Playwright dirigindo o Electron real para os fluxos ponta a ponta (ex.: selecionar 3 programas, ver fila andar, cancelar um, ver resumo).

## Anti-padrões a barrar em review

- Regra de negócio (cálculo de espaço, tempo, transição de estado da fila) escrita dentro de um handler de IPC ou de um componente React.
- `application/*` importando de `infra/*` em vez de depender de um port.
- Qualquer `spawn` ou `exec` fora do `WindowsProcessRunner` e do `NodePowerShellRunner`.
- Valor vindo de fora (id de pacote, letra de disco) interpolado numa string de comando em vez de passado como parâmetro tipado do script ou item de array de argumentos.
- Regex em texto de console em qualquer lugar que não seja `infra/winget/`, onde é inevitável e está documentado.
- Preload com `if`/lógica além de expor canal.
- Renderer importando algo de `node:*` ou de `infra/*`.
- Aresta de dependência na contramão entre os pacotes, como `domain` importando `utils`.
- Estado da fila guardado só no renderer (some se a janela recarrega) em vez de ter o main como fonte única de verdade.
