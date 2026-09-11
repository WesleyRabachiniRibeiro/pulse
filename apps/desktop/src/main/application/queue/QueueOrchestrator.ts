import {
  PROGRAM_BY_ID,
  RIOT_BY_ID,
  TIBIA_BY_ID,
  type Program,
} from '@pulse/catalog-data'
import {
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
import { canEnqueue, clock, formatGb, isFinished, normalizeText } from '@pulse/utils'
import type { ProcessRunner, SpawnResult } from '../../ports/process-runner'
import type { PackageRepository } from '../../ports/package-repository'
import type { DiskSpaceProbe } from '../../ports/disk-space-probe'
import type { SteamGameRequester } from '../../ports/steam-game-requester'
import type { BrowserDefaultSetter } from '../../ports/browser-default-setter'
import type { AutostartRegistry, AutostartResult } from '../../ports/autostart-registry'
import type { QueueRepository } from '../../ports/queue-repository'
import type { ClipboardWriter } from '../../ports/clipboard-writer'
import { readWingetProgress } from '../../infra/winget/WingetOutputParser'
import {
  alreadyInstalled,
  hex,
  installerBusy,
  needsAdmin,
  needsReboot,
  refusedDrive,
  wingetErrorMessage,
} from '../../infra/winget/WingetErrorClassifier'
import { adminFailure, REFUSED_BY_USER } from '../../infra/process/adminOutcome'
import { runnerFailure } from '../../infra/process/interactiveUserOutcome'

type Listener = (run: Run) => void
type SteamAnswer = 'confirmed' | 'refused' | 'timeout'

export interface UninstallResult {
  ok: boolean
  verified: boolean
  error?: string
}

const WAIT_LIMIT_MS = 15 * 60_000
const READS_UNTIL_GIVING_UP = 3
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
    const workloads = settings?.workloads ?? []
    if (workloads.length === 0) return undefined

    const parts = ['--quiet', '--norestart', '--wait', '--includeRecommended']
    for (const workload of workloads) parts.push('--add', workload)
    if (destination) parts.push('--installPath', `"${destination}"`)
    return parts.join(' ')
  }

  private packageArgs(packageId: string, destination?: string): string[] {
    const base = [
      'install',
      '--id',
      packageId,
      '--exact',
      '--accept-package-agreements',
      '--accept-source-agreements',
      '--disable-interactivity',
      '--silent',
    ]
    return destination ? [...base, '--location', destination] : base
  }

  private wingetArgs(
    program: Program,
    destination?: string,
    packageId?: string,
    override?: string,
  ): string[] {
    const common = [
      'install',
      '--id',
      packageId ?? program.winget ?? '',
      '--exact',
      '--accept-package-agreements',
      '--accept-source-agreements',
      '--disable-interactivity',
    ]

    if (program.source === 'msstore') return [...common, '--source', 'msstore']
    if (override) return [...common, '--override', override]

    const base = [...common, '--silent']
    return destination ? [...base, '--location', destination] : base
  }

  private destinationFor(program: Program, drive: string): string | undefined {
    if (program.source === 'msstore') return undefined
    const system = (process.env['SystemDrive'] ?? 'C:').toUpperCase()
    if (drive.toUpperCase() === system) return undefined
    return `${drive}\\Pulse\\${program.winget ?? program.id}`
  }

  private async requestSteamGame(appid: string): Promise<SteamAnswer> {
    if (await this.steamGameRequester.hasManifest(appid)) return 'confirmed'

    await this.processRunner.openUri(`steam://install/${appid}`)

    const limit = Date.now() + WAIT_LIMIT_MS
    let withoutDialog = 0
    let grace = 6

    while (Date.now() < limit) {
      await wait(2000)

      if (await this.steamGameRequester.hasManifest(appid)) return 'confirmed'

      if (await this.steamGameRequester.isInstallDialogOpen()) {
        withoutDialog = 0
        grace = 0
        continue
      }

      if (grace > 0) {
        grace--
        continue
      }

      withoutDialog++
      if (withoutDialog >= READS_UNTIL_GIVING_UP) {
        return (await this.steamGameRequester.hasManifest(appid)) ? 'confirmed' : 'refused'
      }
    }

    return (await this.steamGameRequester.hasManifest(appid)) ? 'confirmed' : 'timeout'
  }

  private async waitForSteamSignIn(): Promise<boolean> {
    await this.processRunner.openUri('steam://open/main')

    const limit = Date.now() + WAIT_LIMIT_MS
    while (Date.now() < limit) {
      await wait(3000)
      if (await this.steamGameRequester.isSignedIn()) return true
    }
    return false
  }

  private async applyExtras(target: Item, program: Program): Promise<void> {
    const settings = target.settings
    if (!settings) return

    const extensions = settings.extensions ?? []
    const result: NonNullable<Item['result']> = {
      extensions: 0,
      extensionsRequested: extensions.length,
      git: false,
      gamesAccepted: [],
      gamesRefused: [],
      gamesPending: [],
      pagesOpened: [],
      riotInstalled: [],
      riotFailed: [],
      gitLogin: false,
    }
    target.result = result
    target.status = 'configuring'
    target.detail = 'Aplicando os seus ajustes'
    this.emitState()

    if (extensions.length > 0) {
      const code = await this.processRunner.locateVsCode()

      if (!code) {
        this.note(
          `${program.name}: não encontrei o comando do VS Code, as extensões ficaram de fora`,
          'error',
        )
      } else {
        let done = 0
        for (const extension of extensions) {
          target.detail = `Instalando extensões (${done + 1}/${extensions.length})`
          this.emitState()
          const ok = await this.processRunner.run(code, ['--install-extension', extension, '--force'])
          if (ok) {
            done++
            result.extensions = done
          } else {
            this.note(`${program.name}: não deu para instalar a extensão ${extension}`, 'error')
          }
        }
        this.note(`${program.name}: ${done} de ${extensions.length} extensões instaladas`, 'ok')
      }
    }

    const git = settings.git
    if (git && (git.name || git.email || git.branch || git.saveLogin)) {
      target.detail = 'Configurando o Git'
      this.emitState()

      const gitExe = await this.processRunner.locateGit()
      if (!gitExe) {
        this.note(`${program.name}: não encontrei o git, a configuração ficou para depois`, 'error')
      } else {
        const pairs: [string, string][] = [
          ['user.name', git.name],
          ['user.email', git.email],
          ['init.defaultBranch', git.branch],
        ]
        for (const [key, value] of pairs) {
          if (!value.trim()) continue
          const ok = await this.processRunner.run(gitExe, ['config', '--global', key, value])
          if (ok) result.git = true
          else this.note(`${program.name}: falhou ao gravar ${key}`, 'error')
        }

        if (git.saveLogin) {
          const ok = await this.processRunner.run(gitExe, [
            'config',
            '--global',
            'credential.helper',
            'manager',
          ])
          result.gitLogin = ok
          this.note(
            ok
              ? `${program.name}: o Windows vai guardar o login do GitHub`
              : `${program.name}: falhou ao ligar o gerenciador de credenciais`,
            ok ? 'ok' : 'error',
          )
        }

        this.emitState()
        this.note(`${program.name}: Git configurado`, 'ok')
      }
    }

    if (settings.autostart !== undefined) {
      target.detail = settings.autostart
        ? 'Deixando abrir com o Windows'
        : 'Tirando da inicialização do Windows'
      this.emitState()

      const effect: AutostartResult = await this.autostartRegistry.setAutostart(
        program,
        settings.autostart,
      )
      result.autostart = effect
      this.emitState()
      this.note(
        effect === 'no-entry'
          ? `${program.name}: não se cadastra para abrir sozinho, nada a mudar`
          : effect === 'on'
            ? `${program.name}: passa a abrir com o Windows`
            : `${program.name}: não abre mais sozinho`,
        effect === 'no-entry' ? 'info' : 'ok',
      )
    }

    const games = settings.games ?? []
    if (games.length > 0) {
      let signedIn = await this.steamGameRequester.isSignedIn()

      if (!signedIn) {
        target.status = 'waiting'
        target.detail = 'Entre na sua conta Steam para baixar os jogos'
        this.emitState()
        this.note('Steam: esperando você entrar na conta', 'step')
        signedIn = await this.waitForSteamSignIn()
      }

      if (!signedIn) {
        for (const game of games) result.gamesPending.push(game.name)
        this.note('Steam: ninguém entrou na conta, os jogos ficaram para depois', 'error')
      } else {
        for (const [index, game] of games.entries()) {
          const position = games.length > 1 ? ` (${index + 1}/${games.length})` : ''
          target.status = 'waiting'
          target.detail = `Confirme "${game.name}" na janela da Steam${position}`
          this.emitState()
          this.note(`Steam: esperando você decidir sobre ${game.name}`, 'step')

          const answer = await this.requestSteamGame(game.appid)

          if (answer === 'confirmed') {
            result.gamesAccepted.push(game.name)
            this.note(`Steam: ${game.name} confirmado, download na fila da Steam`, 'ok')
          } else if (answer === 'refused') {
            result.gamesRefused.push(game.name)
            this.note(`Steam: ${game.name} recusado por você`, 'info')
          } else {
            result.gamesPending.push(game.name)
            this.note(`Steam: ${game.name} ficou sem resposta e foi deixado para depois`, 'error')
          }
        }
      }

      target.status = 'configuring'
      target.detail = 'Terminando'
      this.emitState()
      this.note(`${program.name}: ${result.gamesAccepted.length} de ${games.length} jogos aceitos`, 'ok')
    }

    const pages = settings.tibia ?? []
    if (pages.length > 0) {
      target.status = 'configuring'
      this.emitState()

      for (const [index, id] of pages.entries()) {
        const client = TIBIA_BY_ID.get(id)
        if (!client?.url) continue

        target.detail = `Abrindo a página do ${client.name} (${index + 1}/${pages.length})`
        this.emitState()

        if (await this.processRunner.openUri(client.url)) {
          result.pagesOpened.push(client.name)
          this.note(`${client.name}: página oficial aberta no navegador`, 'ok')
        } else {
          this.note(`${client.name}: não deu para abrir a página`, 'error')
        }

        await wait(1200)
      }
    }

    const riot = settings.riot ?? []
    if (riot.length > 0) {
      const system = (process.env['SystemDrive'] ?? 'C:').toUpperCase()

      for (const [index, packageId] of riot.entries()) {
        const name = RIOT_BY_ID.get(packageId)?.name ?? packageId
        const position = riot.length > 1 ? ` (${index + 1}/${riot.length})` : ''

        target.status = 'configuring'
        target.percent = 0
        target.detail = `Instalando ${name}${position}`
        this.emitState()
        this.note(`${program.name}: instalando ${name}`, 'step')

        const destination =
          target.drive.toUpperCase() === system ? undefined : `${target.drive}\\Pulse\\${packageId}`

        const output = await this.processRunner.runWinget(
          target.id,
          this.packageArgs(packageId, destination),
          (line) => {
            const current = this.findItem(target.id)
            const p = readWingetProgress(line)
            if (current && p.percent !== undefined) {
              current.percent = p.percent
              this.emitState(false)
            }
          },
          target.drive,
        )

        if (output.code === 0 || alreadyInstalled(output.code, output.text)) {
          result.riotInstalled.push(name)
          this.note(`${name}: instalado`, 'ok')
        } else {
          result.riotFailed.push(name)
          this.note(`${name}: falhou com ${hex(output.code)}`, 'error')
        }
      }

      target.percent = 100
      this.emitState()
    }
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

    const follow = (line: string): void => {
      const current = this.findItem(target.id)
      if (!current) return
      const p = readWingetProgress(line)

      if (p.phase && p.phase !== current.status) {
        current.status = p.phase
        current.percent = p.phase === 'installing' ? 0 : (p.percent ?? 0)
        current.detail =
          p.phase === 'installing' ? 'Instalando no disco' : 'Baixando do servidor oficial'
        this.emitState()
        return
      }
      if (p.percent !== undefined) {
        current.percent = p.percent
        this.emitState(false)
      }
    }

    const gaveUp = (): boolean => this.canceled || this.canceledItems.has(target.id)

    const destination = this.destinationFor(program, target.drive)
    const wingetArgs = (): string[] => {
      const where = target.driveIgnored ? undefined : destination
      return this.wingetArgs(program, where, packageId, this.workloadOverride(target.settings, where))
    }

    let output = await this.processRunner.runWinget(target.id, wingetArgs(), follow, target.drive)

    if (output.code !== 0 && destination && refusedDrive(output.text) && !gaveUp()) {
      target.driveIgnored = true
      this.note(`${program.name}: o instalador ignora a escolha de disco`, 'info')
      target.status = 'downloading'
      target.percent = 0
      this.emitState()
      output = await this.processRunner.runWinget(target.id, wingetArgs(), follow, target.drive)
    }

    for (let attempt = 1; attempt < MSI_ATTEMPTS; attempt++) {
      if (output.code === 0 || gaveUp() || !installerBusy(output.code, output.text)) break

      target.detail = 'Esperando outro instalador terminar'
      this.emitState()
      this.note(`${program.name}: Windows Installer ocupado, tentando de novo`, 'info')
      await wait(MSI_WAIT_MS)
      if (gaveUp()) break

      target.status = 'downloading'
      target.percent = 0
      target.detail = 'Começando o download'
      this.emitState()
      output = await this.processRunner.runWinget(target.id, wingetArgs(), follow, target.drive)
    }

    let asked = 0
    while (
      !gaveUp() &&
      output.code !== 0 &&
      asked < PERMISSION_ATTEMPTS &&
      (needsAdmin(output.code, output.text) || output.code === REFUSED_BY_USER)
    ) {
      asked++
      target.status = 'waiting'
      target.needsPermission = true
      target.percent = 0
      target.detail =
        output.code === REFUSED_BY_USER
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

      output = await this.processRunner.runElevated('winget', wingetArgs())
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

    const wasThere = alreadyInstalled(output.code, output.text)
    if (output.code === 0 || wasThere) {
      const reboot = !wasThere && needsReboot(output.code, output.text)

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
    target.error =
      noSpace ?? adminFailure(output.code, program.name) ?? wingetErrorMessage(output.code, output.text, program.name)
    target.finishedAt = new Date().toISOString()
    this.emitState()
    this.note(`${program.name}: falhou com ${hex(output.code)}`, 'error')
  }

  private chooseDefaultBrowser(items: readonly Item[]): Item | null {
    const browsers = items
      .filter((i) => i.status === 'done' && PROGRAM_BY_ID.get(i.id)?.category === 'browsers')
      .sort((a, b) => Date.parse(a.finishedAt ?? '') - Date.parse(b.finishedAt ?? ''))

    if (browsers.length === 0) return null

    const marked = browsers.filter((i) => i.settings?.makeDefault)
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
      if (item.status !== 'done' || !item.settings?.openAfter) continue
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

    const args = [
      'uninstall',
      '--id',
      program.winget,
      '--exact',
      '--silent',
      '--accept-source-agreements',
      '--disable-interactivity',
    ]

    // Elevado, o winget recusa desinstalar pacote de escopo de usuário. Como o
    // Pulse roda como administrador, a remoção sai pela sessão da pessoa.
    const output: SpawnResult = (await this.processRunner.isElevated())
      ? await this.processRunner.runAsInteractiveUser('winget', args)
      : await this.processRunner.runWinget(`uninstall:${id}`, args, () => {})

    const failure = runnerFailure(output.code)
    if (failure) {
      this.note(`${program.name}: falhou ao desinstalar, ${failure}`, 'error')
      return {
        ok: false,
        verified: false,
        error: `O Pulse não conseguiu remover o ${program.name} pela sua sessão do Windows, porque ${failure}. Desinstale por "Aplicativos instalados" do Windows.`,
      }
    }

    if (output.code === 0) {
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
        `${program.name}: desinstalado, embora o winget tenha encerrado com ${hex(output.code)}`,
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

    const text = normalizeText(output.text)
    if (text.includes('nenhum pacote instalado') || text.includes('no installed package')) {
      return {
        ok: false,
        verified: false,
        error: `O ${program.name} não foi instalado pelo winget e não publica um desinstalador silencioso, então o Pulse não consegue removê-lo sozinho. Desinstale por "Aplicativos instalados" do Windows.`,
      }
    }

    const error = wingetErrorMessage(output.code, output.text, program.name)
    this.note(`${program.name}: falhou ao desinstalar (${hex(output.code)})`, 'error')
    return { ok: false, verified: false, error }
  }
}
