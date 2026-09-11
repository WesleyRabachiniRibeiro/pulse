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

- **Entidades/VOs**: `Program`, `Category`, `Catalog`, `Disk`, `DiskSpacePlan`, `QueueItem`, `SystemCheckResult`.
- **Regras**: `calcularEspacoNecessario(disco, itensSelecionados)` — é aqui, e só aqui, que mora a regra "todo instalador estoura temp no disco do sistema". `estimarTempoTotal(itens, velocidadeEstimada)`. `avaliarChecagem(...) -> ok|aviso|impedimento`.
- **Máquina de estados da fila** (também domínio puro, não em um `useState` de componente):

```
queued → downloading → installing → configuring → ready
                                  ↘ waiting(reason: uac | steam-login | ...) → installing
   ↘ canceled            (a partir de qualquer estado não-terminal)
   ↘ failed              (a partir de downloading/installing/configuring, retry → queued)
```

### application/ (casos de uso)
Um caso de uso = uma intenção do usuário ou do sistema. Cada um depende só de **ports**, nunca de um adapter concreto.

- `RunSystemVerification` (usa `SystemInspector`, `DiskSpaceProbe`)
- `LoadCatalog` (usa `CatalogRepository`)
- `EnqueuePrograms` (usa `QueueRepository`, aceita fila já rodando)
- `CancelQueueItem`, `RetryQueueItem` (cancelar um não afeta os outros — é o caso de uso que garante isso, não a UI)
- `GetSummary`

### ports/ (interfaces, declaradas pela application, moram perto do domínio)
`SystemInspector`, `DiskSpaceProbe`, `PackageInstaller`, `CatalogRepository`, `QueueRepository`.

### infra/ (adapters — aqui mora tudo que é Windows/winget de verdade)

Todo processo do Pulse fala com o Windows **via comandos PowerShell**. Isso não é um detalhe de implementação de um adapter isolado — é uma decisão que atravessa toda a infra, então ela ganha uma porta própria em vez de cada adapter dar `spawn` por conta.

#### PowerShellRunner (a única porta que fala com o SO)

Nenhum adapter chama `child_process.spawn` diretamente. Todos passam por um `PowerShellRunner`, que é quem sabe **como** rodar PowerShell — os adapters só sabem **o quê** rodar.

- **Um comando por chamada, sem runspace persistente (por enquanto)**: cada operação sobe um `pwsh -NoProfile -NonInteractive -ExecutionPolicy Bypass -File <script>`. É mais simples de implementar, cancelar e testar do que manter um processo PowerShell vivo trocando mensagens por stdin/stdout. Justificativa: o próprio `winget install` já domina o tempo (segundos a minutos); o custo de spawn (~150-300ms) é irrelevante perto disso, e a tela de Verificação dispara poucas checagens. **Só migrar para runspace persistente se profiling real mostrar que o spawn pesa** — não antecipar essa complexidade.
- **Scripts são arquivos `.ps1` versionados**, não strings montadas em TypeScript: `Get-DiskSpace.ps1`, `Test-Admin.ps1`, `Test-Virtualization.ps1`, `Test-InternetConnection.ps1`, `Get-SystemInfo.ps1`, `Install-Package.ps1`. Cada um é revisável, testável e diffável isoladamente.
- **Parâmetros nunca são interpolados numa string de comando.** Todo valor que vem de fora (id do pacote no catálogo, letra do disco escolhida pelo usuário) entra como parâmetro tipado do próprio script (`param($PackageId, $DiskLetter)`) passado via array de argumentos do `child_process`, ou serializado como um único JSON (`-ParamsJson '...'`) que o script decodifica com `ConvertFrom-Json`. Nunca `"winget install " + id` concatenado.
- **Saída sempre estruturada**: os scripts terminam emitindo JSON (`ConvertTo-Json -Depth`), nunca texto solto pra fazer regex em cima no Node. `PowerShellRunner` expõe algo como `runJson<T>(script, params): Promise<T>`.
- **Progresso de instalação é streaming, não um retorno único**: `Install-Package.ps1` emite uma linha NDJSON por evento (`{"type":"progress","phase":"downloading","percent":42}`, `{"type":"waiting","reason":"uac"}`, `{"type":"done"}`). O adapter lê stdout linha a linha e traduz cada evento numa transição da máquina de estados do `QueueItem` — é o mecanismo concreto por trás do `queue:update`.
- **Cancelamento por item, não por fila**: o adapter mantém um registro `Map<queueItemId, ChildProcess>`. Cancelar um item mata só o processo daquele item (`proc.kill()`/`taskkill /pid X /t /f`); os demais continuam. Isso é o que garante "cancelar um item não derruba o resto".

```
infra/
  powershell/
    PowerShellRunner.ts        # spawn, encoding, timeout, parse JSON/NDJSON — a única porta pro SO
    scripts/
      Get-SystemInfo.ps1
      Get-DiskSpace.ps1
      Test-Admin.ps1
      Test-Virtualization.ps1
      Test-InternetConnection.ps1
      Install-Package.ps1      # emite NDJSON de progresso, entende UAC/login como "waiting"
    adapters/
      WindowsSystemInspector.ts   # implementa o port SystemInspector, usa PowerShellRunner
      WindowsDiskSpaceProbe.ts    # implementa o port DiskSpaceProbe
      WingetPackageInstaller.ts   # implementa o port PackageInstaller, dono do registro de cancelamento
  JsonCatalogRepository.ts       # catálogo dos 46 programas (arquivo estático versionado)
  SqliteQueueRepository.ts       # (ou electron-store) persiste a fila p/ sobreviver a crash/reinício
```

**Regra de revisão**: se um `infra/*` aparece importado fora de `main/composition-root`, é violação de camada. Se um adapter dá `spawn`/`exec` sem passar pelo `PowerShellRunner`, também é.

### main/ipc/ (controllers finos)
Só traduzem canal IPC → caso de uso → resposta/evento. Nenhuma regra de negócio aqui. O orquestrador da fila (`QueueOrchestrator`) é o dono do estado vivo e é quem emite os eventos de atualização.

### Padrão de comunicação IPC
- **Comando** (renderer → main): `ipcRenderer.invoke` — pedir checagem, carregar catálogo, enfileirar, cancelar item, retentar item. Request/response.
- **Evento** (main → renderer): `webContents.send` num canal único de estado (`queue:update`, `checks:update`) — o main é a fonte única de verdade; o renderer só reflete. Isso evita renderer e main divergirem sobre "o que está instalando agora", inclusive depois de um reload da janela.
- Todo canal tem contrato tipado e validado (zod) num pacote compartilhado — nunca `any` cruzando o `contextBridge`.

## Renderer (as 4 telas)

Cada tela é um módulo vertical (`features/preflight`, `features/selection`, `features/installation`, `features/summary`), navegado pela trilha lateral na ordem fixa do domínio. Dentro de cada feature: componentes de UI + um store fino (Zustand/Redux) que só espelha o que vem de `queue:update`/`checks:update` — **o renderer não recalcula estado de negócio, só exibe**. Cálculo de "quanto falta baixar", "quanto espaço sobra", "quanto tempo falta" vêm prontos do domínio via IPC, não são recalculados na tela.

## Estrutura de pastas (monorepo, workspaces)

```
pulse/
├── apps/
│   └── desktop/
│       ├── src/
│       │   ├── main/
│       │   │   ├── application/        # casos de uso
│       │   │   ├── infra/
│       │   │   │   └── powershell/     # PowerShellRunner + scripts .ps1 + adapters
│       │   │   ├── ipc/                # controllers finos
│       │   │   └── composition-root.ts # onde tudo é instanciado e ligado
│       │   ├── preload/                # contextBridge, sem lógica
│       │   └── renderer/
│       │       └── features/
│       │           ├── preflight/
│       │           ├── selection/
│       │           ├── installation/
│       │           └── summary/
│       └── electron-builder.yml
├── packages/
│   ├── domain/          # entidades, VOs, regras puras, máquina de estados da fila
│   ├── ipc-contract/     # schemas zod + tipos dos canais e eventos IPC
│   └── catalog-data/     # os 46 programas (dados versionados, não código)
└── package.json          # workspaces (pnpm recomendado)
```

## Testes por camada

- `domain`: unitário puro, sem mock (é só função/estado).
- `application`: unitário com fakes dos ports (fake `PackageInstaller` que nunca chama winget de verdade).
- `PowerShellRunner`: unitário com um `child_process` fake (injeção de dependência), sem abrir PowerShell real — testa parsing de JSON/NDJSON, timeout, e a lógica de matar o processo certo no cancelamento.
- `infra` (adapters + scripts `.ps1` reais): teste de integração, marcado à parte, só roda em `windows-latest` no CI (depende de PowerShell/winget reais).
- `renderer`: Testing Library para componentes; Playwright dirigindo o Electron real para os fluxos ponta a ponta (ex.: selecionar 3 programas, ver fila andar, cancelar um, ver resumo).

## Anti-padrões a barrar em review

- Regra de negócio (cálculo de espaço, tempo, transição de estado da fila) escrita dentro de um handler de IPC ou de um componente React.
- `application/*` chamando `winget`/`child_process`/`PowerShellRunner` direto em vez de passar pelo port `PackageInstaller`/`SystemInspector`/`DiskSpaceProbe`.
- Qualquer adapter dando `spawn`/`exec` de PowerShell por fora do `PowerShellRunner`.
- Valor vindo de fora (id de pacote, letra de disco) interpolado numa string de comando PowerShell em vez de passado como parâmetro tipado do script ou JSON serializado.
- Parsing de saída de script com regex em texto livre em vez de JSON/NDJSON estruturado.
- Preload com `if`/lógica além de expor canal.
- Renderer importando algo de `node:*` ou de `infra/*`.
- Estado da fila guardado só no renderer (some se a janela recarrega) em vez de ter o main como fonte única de verdade.
