import { PROGRAM_BY_ID, type Program } from '@pulse/catalog-data'
import {
  clock,
  formatGb,
  LOG_LIMIT,
  PARALLEL_LIMIT,
  runSchema,
  MINIMUM_SYSTEM_GB,
  type Item,
  type LogLevel,
  type Request,
  type Run,
  type Settings,
} from '@pulse/domain'
import { canEnqueue, isFinished } from '@pulse/utils'
import type { ProcessRunner } from '../../ports/process-runner'
import type { PackageRepository } from '../../ports/package-repository'
import type { DiskSpaceProbe } from '../../ports/disk-space-probe'
import type { SteamGameRequester } from '../../ports/steam-game-requester'
import type { BrowserDefaultSetter } from '../../ports/browser-default-setter'
import type { AutostartRegistry } from '../../ports/autostart-registry'
import type { QueueRepository } from '../../ports/queue-repository'
import type { ClipboardWriter } from '../../ports/clipboard-writer'
import type {
  InstallProgress,
  InstallSpec,
  PackageInstaller,
  UninstallOutcome,
} from '../../ports/package-installer'
import { runSteps, type StepContext } from './steps'

type Listener = (run: Run) => void

export interface UninstallResult {
  ok: boolean
  verified: boolean
  error?: string
}

const WAIT_LIMIT_MS = 15 * 60_000
const MSI_WAIT_MS = 6000
const MSI_ATTEMPTS = 3
const PERMISSION_ATTEMPTS = 3
const DISAPPEAR_WAIT_MS = 25_000
const LATE_CHECK_MS = 6_000

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function emptyResult(): NonNullable<Item['result']> {
  return {
    extensions: 0,
    extensionsRequested: 0,
    git: false,
    gitLogin: false,
    gamesAccepted: [],
    gamesRefused: [],
    gamesPending: [],
    pagesOpened: [],
    riotInstalled: [],
    riotFailed: [],
  }
}

export class QueueOrchestrator {
  private readonly listeners = new Set<Listener>()
  private running = false
  private canceled = false
  private readonly canceledItems = new Set<string>()
  private readonly permissionWaiters = new Map<string, (granted: boolean) => void>()
  private startTime = 0
  private lastStateAt = 0
  private readonly openedAfterRun = new Set<string>()
  private defaultBrowser: string | null = null
  private readonly uninstalling = new Map<string, Promise<UninstallResult>>()

  constructor(
    private readonly processRunner: ProcessRunner,
    private readonly packageInstaller: PackageInstaller,
    private readonly packageRepository: PackageRepository,
    private readonly diskSpaceProbe: DiskSpaceProbe,
    private readonly steamGameRequester: SteamGameRequester,
    private readonly browserDefaultSetter: BrowserDefaultSetter,
    private readonly autostartRegistry: AutostartRegistry,
    private readonly queueRepository: QueueRepository,
    private readonly clipboard: ClipboardWriter,
  ) {}

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  currentState(): Run | null {
    const run = this.queueRepository.get()
    return run ? structuredClone(run) : null
  }

  start(requests: readonly Request[], drive: string): Run {
    const existing = this.queueRepository.get()
    if (this.running && existing) return structuredClone(existing)

    this.canceled = false
    this.canceledItems.clear()
    this.openedAfterRun.clear()
    this.defaultBrowser = null
    this.startTime = Date.now()

    const run: Run = {
      drive,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      canceling: false,
      log: [],
      items: requests.map((r) => ({
        id: r.id,
        drive: r.drive,
        ...(r.settings ? { settings: r.settings } : {}),
        status: 'queued' as const,
        percent: 0,
        detail: 'Na fila',
      })),
    }
    this.queueRepository.set(run)

    this.emitState()
    this.note(
      `fila com ${requests.length} programas · até ${PARALLEL_LIMIT} ao mesmo tempo · geral ${drive}`,
      'step',
    )
    void this.processQueue()

    return structuredClone(run)
  }

  append(requests: readonly Request[]): Run | null {
    const run = this.queueRepository.get()
    if (!run) return null

    const accepted: string[] = []
    for (const request of requests) {
      const existing = this.findItem(request.id)
      if (!canEnqueue(existing, request)) continue

      if (existing) {
        existing.status = 'queued'
        existing.percent = 0
        existing.detail = 'Na fila'
        existing.drive = request.drive
        if (request.settings) existing.settings = request.settings
        else delete existing.settings
        delete existing.error
        delete existing.driveIgnored
      } else {
        run.items.push({
          id: request.id,
          drive: request.drive,
          ...(request.settings ? { settings: request.settings } : {}),
          status: 'queued',
          percent: 0,
          detail: 'Na fila',
        })
      }
      accepted.push(request.id)
    }

    if (accepted.length === 0) return structuredClone(run)

    this.canceled = false
    run.canceling = false
    run.finishedAt = null
    this.emitState()
    this.note(`+${accepted.length} na fila`, 'step')
    void this.processQueue()

    return structuredClone(run)
  }

  cancel(): void {
    const run = this.queueRepository.get()
    if (!run || !this.running) return
    this.canceled = true
    run.canceling = true
    this.emitState()
    this.note('cancelando: encerrando os instaladores em andamento', 'error')
    this.releasePermission()
    this.processRunner.killWinget()
  }

  cancelItem(id: string): void {
    const target = this.findItem(id)
    const run = this.queueRepository.get()
    if (!run || !target || isFinished(target)) return

    if (target.status === 'queued') {
      target.status = 'canceled'
      target.detail = 'Cancelado antes de começar'
      this.emitState()
      this.note(`${PROGRAM_BY_ID.get(id)?.name ?? id}: tirado da fila`, 'error')
      return
    }

    this.canceledItems.add(id)
    target.canceling = true
    target.detail = 'Cancelando…'
    this.emitState()
    this.releasePermission(id)
    this.processRunner.killWinget(id)
  }

  retry(id: string): void {
    const target = this.findItem(id)
    const run = this.queueRepository.get()
    if (!run || !target) return
    if (target.status !== 'failed' && target.status !== 'canceled') return

    this.canceled = false
    target.status = 'queued'
    target.percent = 0
    target.detail = 'Na fila'
    delete target.error
    delete target.needsPermission
    run.finishedAt = null
    this.emitState()
    void this.processQueue()
  }

  grantPermission(id: string): void {
    this.permissionWaiters.get(id)?.(true)
  }

  uninstall(id: string): Promise<UninstallResult> {
    const running = this.uninstalling.get(id)
    if (running) return running

    const task = this.runUninstall(id).finally(() => {
      this.uninstalling.delete(id)
    })
    this.uninstalling.set(id, task)
    return task
  }

  private findItem(id: string): Item | undefined {
    return this.queueRepository.get()?.items.find((i) => i.id === id)
  }

  private emitState(now = true): void {
    const run = this.queueRepository.get()
    if (!run) return
    const t = Date.now()
    if (!now && t - this.lastStateAt < 180) return
    this.lastStateAt = t

    const copy = runSchema.parse(structuredClone(run))
    for (const listener of this.listeners) listener(copy)
  }

  private note(text: string, level: LogLevel = 'info'): void {
    const run = this.queueRepository.get()
    if (!run) return
    const line = { time: clock((Date.now() - this.startTime) / 1000), text, level }
    run.log = [...run.log, line].slice(-LOG_LIMIT)
    this.emitState()
  }

  private releasePermission(id?: string): void {
    if (id) {
      this.permissionWaiters.get(id)?.(false)
      return
    }
    for (const settle of [...this.permissionWaiters.values()]) settle(false)
  }

  private waitForPermission(id: string): Promise<boolean> {
    return new Promise((resolve) => {
      const settle = (granted: boolean): void => {
        if (!this.permissionWaiters.has(id)) return
        this.permissionWaiters.delete(id)
        clearTimeout(timer)
        resolve(granted)
      }
      const timer = setTimeout(() => settle(false), WAIT_LIMIT_MS)
      this.permissionWaiters.set(id, settle)
    })
  }

  private async fullDiskWarning(destination: string): Promise<string | null> {
    const drives = await this.diskSpaceProbe.listDrives().catch((): [] => [])
    const system = (process.env['SystemDrive'] ?? 'C:').toUpperCase()

    const tight = drives.filter((d) => {
      const letter = d.letter.toUpperCase()
      if (letter !== system && letter !== destination.toUpperCase()) return false
      return d.freeBytes / 1024 ** 3 < MINIMUM_SYSTEM_GB
    })

    const found = tight[0]
    if (!found) return null

    const because =
      found.letter.toUpperCase() === system && destination.toUpperCase() !== system
        ? ` Mesmo instalando em ${destination}, o instalador descompacta arquivos temporários e guarda uma cópia do pacote em ${found.letter}.`
        : ''

    return `Faltou espaço: ${found.letter} está com apenas ${formatGb(found.freeBytes)} livres.${because} Libere espaço e tente de novo.`
  }

  private workloadOverride(settings: Settings | undefined, destination?: string): string | undefined {
    const workloads = settings?.steps?.vsWorkloads ?? []
    if (workloads.length === 0) return undefined

    const parts = ['--quiet', '--norestart', '--wait', '--includeRecommended']
    for (const workload of workloads) parts.push('--add', workload)
    if (destination) parts.push('--installPath', `"${destination}"`)
    return parts.join(' ')
  }

  private installSpec(target: Item, program: Program, packageId?: string): InstallSpec {
    const destination = target.driveIgnored
      ? undefined
      : this.destinationFor(program, target.drive)
    const override = this.workloadOverride(target.settings, destination)

    return {
      itemId: target.id,
      packageId: packageId ?? program.winget ?? '',
      name: program.name,
      drive: target.drive,
      fromStore: program.source === 'msstore',
      ...(destination ? { destination } : {}),
      ...(override ? { override } : {}),
    }
  }

  private destinationFor(program: Program, drive: string): string | undefined {
    if (program.source === 'msstore') return undefined
    const system = (process.env['SystemDrive'] ?? 'C:').toUpperCase()
    if (drive.toUpperCase() === system) return undefined
    return `${drive}\\Pulse\\${program.winget ?? program.id}`
  }

  private async applyExtras(target: Item, program: Program): Promise<void> {
    const settings = target.settings
    if (!settings) return

    target.result = emptyResult()
    target.status = 'configuring'
    target.detail = 'Aplicando os seus ajustes'
    this.emitState()

    const ctx: StepContext = {
      itemId: target.id,
      program,
      drive: target.drive,
      ports: {
        processRunner: this.processRunner,
        packageInstaller: this.packageInstaller,
        autostartRegistry: this.autostartRegistry,
        steamGameRequester: this.steamGameRequester,
      },
      say: (detail) => {
        target.status = 'configuring'
        target.detail = detail
        this.emitState()
      },
      waitFor: (detail) => {
        target.status = 'waiting'
        target.detail = detail
        this.emitState()
      },
      progress: (percent) => {
        target.percent = percent
        this.emitState(false)
      },
      note: (text, level) => this.note(text, level),
      canceled: () => this.canceled || this.canceledItems.has(target.id),
    }

    Object.assign(target.result, await runSteps(settings, ctx))
    this.emitState()
  }


  private async install(target: Item): Promise<void> {
    const program = PROGRAM_BY_ID.get(target.id)
    if (!program) {
      target.status = 'failed'
      target.error = 'Programa fora do catálogo.'
      this.emitState()
      return
    }

    const packageId = target.settings?.packageId

    if (program.source === 'pages') {
      target.status = 'configuring'
      target.percent = 0
      target.detail = 'Abrindo as páginas de download'
      target.startedAt = new Date().toISOString()
      delete target.finishedAt
      this.emitState()

      await this.applyExtras(target, program)

      const opened = target.result?.pagesOpened.length ?? 0
      target.status = 'done'
      target.percent = 100
      target.detail =
        opened > 0
          ? `${opened} ${opened === 1 ? 'página aberta' : 'páginas abertas'} para você baixar`
          : 'Nenhum cliente marcado'
      target.finishedAt = new Date().toISOString()
      delete target.error
      this.emitState()
      return
    }

    target.status = 'downloading'
    target.percent = 0
    target.detail = 'Começando o download'
    target.startedAt = new Date().toISOString()
    delete target.finishedAt
    this.emitState()
    this.note(`winget install ${packageId ?? program.winget ?? ''} · disco ${target.drive}`, 'step')

    const follow = (progress: InstallProgress): void => {
      const current = this.findItem(target.id)
      if (!current) return

      if (progress.phase && progress.phase !== current.status) {
        current.status = progress.phase
        current.percent = progress.phase === 'installing' ? 0 : (progress.percent ?? 0)
        current.detail =
          progress.phase === 'installing' ? 'Instalando no disco' : 'Baixando do servidor oficial'
        this.emitState()
        return
      }
      if (progress.percent !== undefined) {
        current.percent = progress.percent
        this.emitState(false)
      }
    }

    const gaveUp = (): boolean => this.canceled || this.canceledItems.has(target.id)
    const specFor = (): InstallSpec => this.installSpec(target, program, packageId)

    let outcome = await this.packageInstaller.install(specFor(), follow)
    let busyRetries = 0
    let permissionAsks = 0

    while (!gaveUp()) {
      if (outcome.kind === 'drive-refused' && !target.driveIgnored) {
        target.driveIgnored = true
        this.note(`${program.name}: o instalador ignora a escolha de disco`, 'info')
        target.status = 'downloading'
        target.percent = 0
        this.emitState()
        outcome = await this.packageInstaller.install(specFor(), follow)
        continue
      }

      if (outcome.kind === 'installer-busy' && busyRetries < MSI_ATTEMPTS - 1) {
        busyRetries++
        target.detail = 'Esperando outro instalador terminar'
        this.emitState()
        this.note(`${program.name}: Windows Installer ocupado, tentando de novo`, 'info')
        await wait(MSI_WAIT_MS)
        if (gaveUp()) break

        target.status = 'downloading'
        target.percent = 0
        target.detail = 'Começando o download'
        this.emitState()
        outcome = await this.packageInstaller.install(specFor(), follow)
        continue
      }

      const wantsPermission = outcome.kind === 'needs-admin' || outcome.kind === 'refused-by-user'
      if (wantsPermission && permissionAsks < PERMISSION_ATTEMPTS) {
        permissionAsks++
        target.status = 'waiting'
        target.needsPermission = true
        target.percent = 0
        target.detail =
          outcome.kind === 'refused-by-user'
            ? 'Permissão recusada. Conceda para continuar'
            : 'Precisa da sua permissão de administrador'
        this.emitState()
        this.note(`${program.name}: esperando você conceder permissão de administrador`, 'step')

        const granted = await this.waitForPermission(target.id)
        delete target.needsPermission

        if (!granted || gaveUp()) break

        target.status = 'installing'
        target.percent = 0
        target.detail = 'Instalando com permissão de administrador'
        this.emitState()
        this.note(`${program.name}: instalando com permissão de administrador`, 'step')

        outcome = await this.packageInstaller.installElevated(specFor())
        continue
      }

      break
    }

    if (gaveUp()) {
      const alone = this.canceledItems.delete(target.id)
      target.status = 'canceled'
      target.percent = 0
      delete target.canceling
      target.detail = 'Cancelado antes de terminar'
      target.finishedAt = new Date().toISOString()
      this.emitState()
      if (alone) this.note(`${program.name}: cancelado, a fila segue`, 'error')
      return
    }

    if (outcome.kind === 'ok' || outcome.kind === 'already-installed') {
      const wasThere = outcome.kind === 'already-installed'
      const reboot = outcome.kind === 'ok' && outcome.needsReboot

      this.processRunner.forgetPathCache()

      this.note(`${program.name}: ${wasThere ? 'já estava instalado' : 'instalado com sucesso'}`, 'ok')

      await this.applyExtras(target, program)

      target.status = 'done'
      target.percent = 100
      target.detail = wasThere
        ? 'Já estava instalado'
        : reboot
          ? 'Instalado, falta reiniciar o PC'
          : 'Pronto para usar'
      if (reboot) target.needsRestart = true
      target.finishedAt = new Date().toISOString()
      delete target.error
      this.emitState()
      if (reboot) this.note(`${program.name}: só termina depois de reiniciar o PC`, 'info')
      return
    }

    target.status = 'failed'
    target.percent = 100
    target.detail = 'Não instalado'
    const noSpace = await this.fullDiskWarning(target.drive)
    target.error = noSpace ?? outcome.message
    target.finishedAt = new Date().toISOString()
    this.emitState()
    this.note(`${program.name}: falhou com ${outcome.code}`, 'error')
  }

  private chooseDefaultBrowser(items: readonly Item[]): Item | null {
    const browsers = items
      .filter((i) => i.status === 'done' && PROGRAM_BY_ID.get(i.id)?.category === 'browsers')
      .sort((a, b) => Date.parse(a.finishedAt ?? '') - Date.parse(b.finishedAt ?? ''))

    if (browsers.length === 0) return null

    const marked = browsers.filter((i) => i.settings?.steps?.browserDefault?.makeDefault)
    return (marked.length > 0 ? marked : browsers).at(-1) ?? null
  }

  private async finishBrowsers(): Promise<void> {
    const run = this.queueRepository.get()
    if (!run) return

    // A importação vem antes de pedir o padrão de propósito. Pedir o padrão
    // lança o navegador, e o Firefox só abre o assistente de importação quando
    // não há instância rodando: com uma aberta, ele repassa o comando para ela
    // e ignora o -migration. Invertido, o Pulse acusava o usuário de ter
    // deixado uma janela aberta que ele mesmo tinha acabado de abrir.
    const addresses: string[] = []

    for (const item of run.items) {
      if (item.status !== 'done' || !item.settings?.steps?.browserDefault?.openAfter) continue
      if (this.openedAfterRun.has(item.id)) continue
      const program = PROGRAM_BY_ID.get(item.id)
      if (!program) continue
      this.openedAfterRun.add(item.id)
      const abriu = await this.browserDefaultSetter.openOnce(program)

      if (abriu.result === 'already-running') {
        this.note(
          `${program.name}: já estava aberto, então o assistente de importação não aparece. Feche-o e abra de novo para importar.`,
          'error',
        )
      } else if (abriu.result === 'opened' && abriu.address) {
        addresses.push(abriu.address)
        item.result = { ...emptyResult(), ...item.result, importAddress: abriu.address }
        this.note(
          `${program.name}: aberto. Para importar, abra ${abriu.address} na barra de endereço dele.`,
          'ok',
        )
      } else if (abriu.result === 'opened') {
        item.result = { ...emptyResult(), ...item.result, importWizard: true }
        this.note(`${program.name}: aberto direto no assistente de importação`, 'ok')
      } else {
        this.note(`${program.name}: não deu para abrir`, 'error')
      }
      this.emitState()
    }

    if (addresses.length === 1 && addresses[0]) {
      this.clipboard.writeText(addresses[0])
      this.note('o endereço da importação está na área de transferência, é só colar', 'info')
    }

    const winner = this.chooseDefaultBrowser(run.items)
    if (winner && winner.id !== this.defaultBrowser) {
      const program = PROGRAM_BY_ID.get(winner.id)
      if (program) {
        this.defaultBrowser = winner.id
        winner.detail = 'Pedindo para ser o navegador padrão'
        this.emitState()

        const outcome = await this.browserDefaultSetter.makeDefault(program)
        winner.result = { ...emptyResult(), ...winner.result, madeDefault: outcome }
        winner.detail = 'Pronto para usar'
        this.emitState()

        this.note(
          outcome === 'yes'
            ? `${program.name}: agora é o navegador padrão`
            : outcome === 'asked'
              ? `${program.name}: o Windows abriu a tela para você confirmar como padrão`
              : `${program.name}: não deu para pedir para ser o padrão`,
          outcome === 'failed' ? 'error' : 'ok',
        )
      }
    }
  }

  private async processQueue(): Promise<void> {
    if (this.running) return
    this.running = true

    const active = new Set<Promise<void>>()
    let more = false

    try {
      for (;;) {
        while (active.size < PARALLEL_LIMIT) {
          const run = this.queueRepository.get()
          const next = run?.items.find((i) => i.status === 'queued')
          if (!next) break

          if (this.canceled) {
            next.status = 'canceled'
            next.detail = 'Cancelado antes de começar'
            this.emitState()
            continue
          }

          const task: Promise<void> = this.install(next)
            .catch((e: unknown) => {
              next.status = 'failed'
              next.detail = 'Não instalado'
              next.error = e instanceof Error ? e.message : 'Falha inesperada na instalação.'
              this.emitState()
            })
            .finally(() => {
              active.delete(task)
            })
          active.add(task)
        }

        if (active.size === 0) break
        await Promise.race(active)
      }
    } finally {
      this.packageRepository.forgetCache()
      try {
        const run = this.queueRepository.get()
        if (run) {
          if (!this.canceled) await this.finishBrowsers()
          more = !this.canceled && run.items.some((i) => i.status === 'queued')
          if (!more) {
            run.finishedAt = new Date().toISOString()
            run.canceling = false
            this.emitState()
            this.note(this.canceled ? 'instalação cancelada' : 'fila encerrada', this.canceled ? 'error' : 'ok')
          }
        }
      } finally {
        this.running = false
      }
      if (more) void this.processQueue()
    }
  }

  private async disappeared(id: string, waitMs = DISAPPEAR_WAIT_MS): Promise<boolean> {
    const limit = Date.now() + waitMs
    while (Date.now() < limit) {
      if (!(await this.packageRepository.isInstalled(id))) return true
      await wait(2500)
    }
    return false
  }

  private async runUninstall(id: string): Promise<UninstallResult> {
    const program = PROGRAM_BY_ID.get(id)
    if (!program) return { ok: false, verified: false, error: 'Programa fora do catálogo.' }

    if (!program.winget) {
      return {
        ok: false,
        verified: false,
        error: `O Pulse não instalou o ${program.name}, então não tem como removê-lo. Desinstale por "Aplicativos instalados" do Windows.`,
      }
    }

    const outcome = await this.packageInstaller.uninstall(id, program.winget, program.name)

    if (outcome.kind === 'blocked') {
      this.note(`${program.name}: falhou ao desinstalar, ${outcome.reason}`, 'error')
      return {
        ok: false,
        verified: false,
        error: `O Pulse não conseguiu remover o ${program.name} pela sua sessão do Windows, porque ${outcome.reason}. Desinstale por "Aplicativos instalados" do Windows.`,
      }
    }

    if (outcome.kind === 'ok') {
      this.packageRepository.forgetCache()
      if (await this.disappeared(id)) {
        this.note(`${program.name}: desinstalado`, 'ok')
        return { ok: true, verified: true }
      }

      this.note(`${program.name}: winget terminou, mas ele ainda aparece instalado`, 'error')
      return {
        ok: true,
        verified: false,
        error: `O winget concluiu, mas o ${program.name} ainda aparece instalado. Alguns desinstaladores continuam trabalhando em segundo plano, e outros não terminam com o programa aberto. Feche-o e confira em instantes.`,
      }
    }

    this.packageRepository.forgetCache()
    if (await this.disappeared(id, LATE_CHECK_MS)) {
      this.note(
        `${program.name}: desinstalado, embora o winget tenha encerrado com ${failureCode(outcome)}`,
        'ok',
      )
      return { ok: true, verified: true }
    }

    const ownUninstallers = await this.packageRepository.quietUninstallCommands(id).catch((): string[] => [])
    if (ownUninstallers.length > 0) {
      this.note(`${program.name}: usando o desinstalador do próprio programa`, 'step')

      let ran = false
      for (const line of ownUninstallers) {
        if (await this.processRunner.runCommandLine(line)) ran = true
      }

      if (await this.disappeared(id)) {
        this.note(`${program.name}: desinstalado`, 'ok')
        return { ok: true, verified: true }
      }

      if (ran) {
        this.note(`${program.name}: o desinstalador rodou, mas ele ainda aparece instalado`, 'error')
        return {
          ok: true,
          verified: false,
          error: `O desinstalador do ${program.name} rodou, mas ele ainda aparece instalado. Alguns continuam trabalhando em segundo plano, e outros não terminam com o programa aberto. Feche-o e confira em instantes.`,
        }
      }
    }

    if (outcome.kind === 'not-managed') {
      return {
        ok: false,
        verified: false,
        error: `O ${program.name} não foi instalado pelo winget e não publica um desinstalador silencioso, então o Pulse não consegue removê-lo sozinho. Desinstale por "Aplicativos instalados" do Windows.`,
      }
    }

    this.note(`${program.name}: falhou ao desinstalar (${outcome.code})`, 'error')
    return { ok: false, verified: false, error: outcome.message }
  }
}

function failureCode(outcome: UninstallOutcome): string {
  return outcome.kind === 'failed' ? outcome.code : ''
}
