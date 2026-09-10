import { app, clipboard } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { getProgram, type Program } from '@shared/domain/catalog'
import type { Settings } from '@shared/domain/settings'
import { forgetCatalog, isInstalled, quietUninstallCommands } from '../catalog'
import { makeDefault, openOnce } from '../browsers'
import { listDrives } from '../preflight'
import { formatGb, MINIMUM_SYSTEM_GB } from '@shared/domain/preflight'
import {
  alreadyInstalled,
  errorMessage,
  hex,
  installArgs,
  installerBusy,
  needsAdmin,
  needsReboot,
  noApplicableInstaller,
  refusedDrive,
  scopeLabel,
} from '@shared/domain/winget'
import { forgetPath, runCommandLine } from '../toolchain'
import { runSteps } from './steps'
import { isElevated, runAsInteractiveUser, runnerFailure } from './infrastructure/asUser'
import { adminFailure, REFUSED_BY_USER, runAsAdmin } from './infrastructure/asAdmin'
import { rememberRun } from './history.service'
import { isGranted, readParental } from '../parental'
import { blockedAmong } from '@shared/domain/parental'
import {
  canEnqueue,
  clock,
  foldText,
  isFinished,
  LOG_LIMIT,
  PARALLEL_LIMIT,
  readProgress,
  runSchema,
  type Item,
  type LogLevel,
  type Request,
  type Run,
} from '@shared/domain/installation'

type Listener = (run: Run) => void

const listeners = new Set<Listener>()

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

let run: Run | null = null
const processes = new Map<string, ChildProcess>()
let running = false
let canceled = false
const canceledItems = new Set<string>()
const permissionWaiters = new Map<string, (granted: boolean) => void>()
let startTime = 0
let lastStateAt = 0
const openedAfterRun = new Set<string>()
let defaultBrowser: string | null = null

function emitState(now = true): void {
  if (!run) return
  const t = Date.now()
  if (!now && t - lastStateAt < 180) return
  lastStateAt = t

  const copy = runSchema.parse(structuredClone(run))
  for (const listener of listeners) listener(copy)
}

function note(text: string, level: LogLevel = 'info'): void {
  if (!run) return
  const line = { time: clock((Date.now() - startTime) / 1000), text, level }
  run.log = [...run.log, line].slice(-LOG_LIMIT)
  emitState()
}

interface Output {
  code: number
  text: string
}

async function fullDiskWarning(destination: string): Promise<string | null> {
  const drives = await listDrives().catch((): [] => [])
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

async function wingetEnv(drive?: string): Promise<NodeJS.ProcessEnv | undefined> {
  if (!drive) return undefined

  const system = (process.env['SystemDrive'] ?? 'C:').toUpperCase()
  if (drive.toUpperCase() === system) return undefined

  const folder = `${drive}\\Pulse\\temp`
  try {
    await mkdir(folder, { recursive: true })
  } catch {
    return undefined
  }

  const env: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (!/^(temp|tmp)$/i.test(key)) env[key] = value
  }
  env['TEMP'] = folder
  env['TMP'] = folder
  return env
}

async function runWinget(
  id: string,
  args: readonly string[],
  onLine: (line: string) => void,
  drive?: string,
): Promise<Output> {
  const env = await wingetEnv(drive)

  return new Promise((resolve) => {
    const child = spawn('winget', [...args], { windowsHide: true, ...(env ? { env } : {}) })
    processes.set(id, child)

    let text = ''
    const consume = (raw: Buffer) => {
      const chunk = raw.toString('utf8')
      text += chunk
      for (const line of chunk.split(/[\r\n]+/)) {
        if (line.trim()) onLine(line.trim())
      }
    }

    child.stdout?.on('data', consume)
    child.stderr?.on('data', consume)

    child.on('error', (e) => {
      processes.delete(id)
      resolve({ code: -1, text: `${text}\n${e.message}` })
    })
    child.on('close', (code) => {
      processes.delete(id)
      resolve({ code: code ?? -1, text })
    })
  })
}

const PERMISSION_WAIT_MS = 15 * 60_000

async function applyExtras(target: Item, program: Program): Promise<void> {
  const settings = target.settings
  if (!settings) return

  const result: NonNullable<Item['result']> = {
    extensions: 0,
    extensionsRequested: (settings.steps?.vscodeExtensions ?? []).length,
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
  emitState()

  await runSteps({
    program,
    drive: target.drive,
    settings,
    say: (detail, percent) => {
      target.status = 'configuring'
      target.detail = detail
      if (percent !== undefined) target.percent = percent
      emitState()
    },
    waitFor: (detail) => {
      target.status = 'waiting'
      target.detail = detail
      emitState()
    },
    note,
    progress: (percent) => {
      target.percent = percent
      emitState()
    },
    merge: (partial) => {
      Object.assign(result, partial)
      emitState()
    },
    runWinget: (packageId, destination) =>
      runWinget(
        target.id,
        packageArgs(packageId, destination),
        (line) => {
          const current = findItem(target.id)
          const read = readProgress(line)
          if (current && read.percent !== undefined) {
            current.percent = read.percent
            emitState(false)
          }
        },
        target.drive,
      ),
  })
}

function findItem(id: string): Item | undefined {
  return run?.items.find((i) => i.id === id)
}

function workloadOverride(settings: Settings | undefined, destination?: string): string | undefined {
  const workloads = settings?.steps?.vsWorkloads ?? []
  if (workloads.length === 0) return undefined

  const parts = ['--quiet', '--norestart', '--wait', '--includeRecommended']
  for (const workload of workloads) parts.push('--add', workload)
  if (destination) parts.push('--installPath', `"${destination}"`)
  return parts.join(' ')
}

function packageArgs(packageId: string, destination?: string): string[] {
  return installArgs({ packageId, ...(destination ? { destination } : {}) })
}

function logPathFor(id: string): string {
  return join(app.getPath('userData'), 'logs', `${id}.log`)
}

function args(target: Item, program: Program, destination?: string, override?: string): string[] {
  const settings = target.settings

  return installArgs({
    packageId: settings?.packageId ?? program.winget ?? '',
    ...(program.source ? { source: program.source } : {}),
    ...(destination ? { destination } : {}),
    ...(override ? { override } : {}),
    ...(settings?.scope && !target.scopeIgnored ? { scope: settings.scope } : {}),
    ...(settings?.locale && !target.localeIgnored ? { locale: settings.locale } : {}),
    ...(settings?.interactive ? { interactive: true } : {}),
    logPath: logPathFor(target.id),
  })
}

function destinationFor(program: Program, drive: string): string | undefined {
  if (program.source === 'msstore') return undefined
  const system = (process.env['SystemDrive'] ?? 'C:').toUpperCase()
  if (drive.toUpperCase() === system) return undefined
  return `${drive}\\Pulse\\${program.winget ?? program.id}`
}

const MSI_WAIT_MS = 6000
const MSI_ATTEMPTS = 3

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

const PERMISSION_ATTEMPTS = 3

function waitForPermission(id: string): Promise<boolean> {
  return new Promise((resolve) => {
    const settle = (granted: boolean): void => {
      if (!permissionWaiters.has(id)) return
      permissionWaiters.delete(id)
      clearTimeout(timer)
      resolve(granted)
    }
    const timer = setTimeout(() => settle(false), PERMISSION_WAIT_MS)
    permissionWaiters.set(id, settle)
  })
}

export function grantPermission(id: string): void {
  permissionWaiters.get(id)?.(true)
}

function releasePermission(id?: string): void {
  if (id) {
    permissionWaiters.get(id)?.(false)
    return
  }
  for (const settle of [...permissionWaiters.values()]) settle(false)
}

async function install(target: Item): Promise<void> {
  const program = getProgram(target.id)
  if (!program) {
    target.status = 'failed'
    target.detail = 'Não instalado'
    target.error = 'Programa fora do catálogo.'
    emitState()
    return
  }

  const packageId = target.settings?.packageId

  if (program.source === 'pages') {
    target.status = 'configuring'
    target.percent = 0
    target.detail = 'Abrindo as páginas de download'
    target.startedAt = new Date().toISOString()
    delete target.finishedAt
    emitState()

    await applyExtras(target, program)

    const opened = target.result?.pagesOpened.length ?? 0
    target.status = 'done'
    target.percent = 100
    target.detail =
      opened > 0
        ? `${opened} ${opened === 1 ? 'página aberta' : 'páginas abertas'} para você baixar`
        : 'Nenhum cliente marcado'
    target.finishedAt = new Date().toISOString()
    delete target.error
    emitState()
    return
  }

  target.status = 'downloading'
  target.percent = 0
  target.detail = 'Começando o download'
  target.startedAt = new Date().toISOString()
  delete target.finishedAt
  emitState()
  note(`winget install ${packageId ?? program.winget ?? ''} · disco ${target.drive}`, 'step')

  const follow = (line: string) => {
    const current = findItem(target.id)
    if (!current) return
    const p = readProgress(line)

    if (p.phase && p.phase !== current.status) {
      current.status = p.phase
      current.percent = p.phase === 'installing' ? 0 : (p.percent ?? 0)
      current.detail =
        p.phase === 'installing' ? 'Instalando no disco' : 'Baixando do servidor oficial'
      emitState()
      return
    }
    if (p.percent !== undefined) {
      current.percent = p.percent
      emitState(false)
    }
  }

  const gaveUp = () => canceled || canceledItems.has(target.id)

  const destination = destinationFor(program, target.drive)
  const wingetArgs = (): string[] => {
    const where = target.driveIgnored ? undefined : destination
    return args(target, program, where, workloadOverride(target.settings, where))
  }

  const again = async (why: string): Promise<void> => {
    note(`${program.name}: ${why}`, 'info')
    target.status = 'downloading'
    target.percent = 0
    emitState()
    output = await runWinget(target.id, wingetArgs(), follow, target.drive)
  }

  target.logPath = logPathFor(target.id)
  await mkdir(dirname(target.logPath), { recursive: true }).catch(() => undefined)

  let output = await runWinget(target.id, wingetArgs(), follow, target.drive)

  if (output.code !== 0 && destination && refusedDrive(output.text) && !gaveUp()) {
    target.driveIgnored = true
    await again('o instalador ignora a escolha de disco')
  }

  if (
    output.code !== 0 &&
    target.settings?.scope &&
    !target.scopeIgnored &&
    noApplicableInstaller(output.text) &&
    !gaveUp()
  ) {
    target.scopeIgnored = true
    await again(`não existe pacote ${scopeLabel(target.settings.scope)}, instalando do jeito padrão`)
  }

  if (
    output.code !== 0 &&
    target.settings?.locale &&
    !target.localeIgnored &&
    noApplicableInstaller(output.text) &&
    !gaveUp()
  ) {
    target.localeIgnored = true
    await again('esse programa não vem no idioma pedido, instalando no idioma dele')
  }

  for (let attempt = 1; attempt < MSI_ATTEMPTS; attempt++) {
    if (output.code === 0 || gaveUp() || !installerBusy(output.code, output.text)) break

    target.detail = 'Esperando outro instalador terminar'
    emitState()
    note(`${program.name}: Windows Installer ocupado, tentando de novo`, 'info')
    await wait(MSI_WAIT_MS)
    if (gaveUp()) break

    target.status = 'downloading'
    target.percent = 0
    target.detail = 'Começando o download'
    emitState()
    output = await runWinget(target.id, wingetArgs(), follow, target.drive)
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
    emitState()
    note(`${program.name}: esperando você conceder permissão de administrador`, 'step')

    const granted = await waitForPermission(target.id)
    delete target.needsPermission

    if (!granted || gaveUp()) break

    target.status = 'installing'
    target.percent = 0
    target.detail = 'Instalando com permissão de administrador'
    emitState()
    note(`${program.name}: instalando com permissão de administrador`, 'step')

    output = await runAsAdmin('winget', wingetArgs())
  }

  if (gaveUp()) {
    const alone = canceledItems.delete(target.id)
    target.status = 'canceled'
    target.percent = 0
    delete target.canceling
    target.detail = 'Cancelado antes de terminar'
    target.finishedAt = new Date().toISOString()
    emitState()
    if (alone) note(`${program.name}: cancelado, a fila segue`, 'error')
    return
  }

  const wasThere = alreadyInstalled(output.code, output.text)
  if (output.code === 0 || wasThere) {
    const reboot = !wasThere && needsReboot(output.code, output.text)

    forgetPath()

    note(`${program.name}: ${wasThere ? 'já estava instalado' : 'instalado com sucesso'}`, 'ok')

    await applyExtras(target, program)

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
    emitState()
    if (reboot) note(`${program.name}: só termina depois de reiniciar o PC`, 'info')
    return
  }

  target.status = 'failed'
  target.percent = 100
  target.detail = 'Não instalado'
  const noSpace = await fullDiskWarning(target.drive)
  target.error =
    noSpace ??
    adminFailure(output.code, program.name) ??
    errorMessage(output.code, output.text, program.name)
  target.finishedAt = new Date().toISOString()
  emitState()
  note(`${program.name}: falhou com ${hex(output.code)}`, 'error')
  if (target.logPath) note(`${program.name}: log do instalador em ${target.logPath}`, 'info')
}

function chooseDefaultBrowser(items: readonly Item[]): Item | null {
  const browsers = items
    .filter((i) => i.status === 'done' && getProgram(i.id)?.category === 'browsers')
    .sort((a, b) => Date.parse(a.finishedAt ?? '') - Date.parse(b.finishedAt ?? ''))

  if (browsers.length === 0) return null

  const marked = browsers.filter((i) => i.settings?.steps?.browserDefault?.makeDefault)
  return (marked.length > 0 ? marked : browsers).at(-1) ?? null
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

async function finishBrowsers(): Promise<void> {
  if (!run) return

  const addresses: string[] = []

  for (const item of run.items) {
    if (item.status !== 'done' || !item.settings?.steps?.browserDefault?.openAfter) continue
    if (openedAfterRun.has(item.id)) continue
    const program = getProgram(item.id)
    if (!program) continue
    openedAfterRun.add(item.id)
    const abriu = await openOnce(program)

    if (abriu.result === 'already-running') {
      note(
        `${program.name}: já estava aberto, então o assistente de importação não aparece. Feche-o e abra de novo para importar.`,
        'error',
      )
    } else if (abriu.result === 'opened' && abriu.address) {
      addresses.push(abriu.address)
      item.result = { ...emptyResult(), ...item.result, importAddress: abriu.address }
      note(
        `${program.name}: aberto. Para importar, abra ${abriu.address} na barra de endereço dele.`,
        'ok',
      )
    } else if (abriu.result === 'opened') {
      item.result = { ...emptyResult(), ...item.result, importWizard: true }
      note(`${program.name}: aberto direto no assistente de importação`, 'ok')
    } else {
      note(`${program.name}: não deu para abrir`, 'error')
    }
    emitState()
  }

  if (addresses.length === 1 && addresses[0]) {
    clipboard.writeText(addresses[0])
    note('o endereço da importação está na área de transferência, é só colar', 'info')
  }

  const winner = chooseDefaultBrowser(run.items)
  if (winner && winner.id !== defaultBrowser) {
    const program = getProgram(winner.id)
    if (program) {
      defaultBrowser = winner.id
      winner.detail = 'Pedindo para ser o navegador padrão'
      emitState()

      const outcome = await makeDefault(program)
      winner.result = { ...emptyResult(), ...winner.result, madeDefault: outcome }
      winner.detail = 'Pronto para usar'
      emitState()

      note(
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

async function processQueue(): Promise<void> {
  if (running) return
  running = true

  const active = new Set<Promise<void>>()
  let more = false

  try {
    for (;;) {
      while (active.size < PARALLEL_LIMIT) {
        const next = run?.items.find((i) => i.status === 'queued')
        if (!next) break

        if (canceled) {
          next.status = 'canceled'
          next.detail = 'Cancelado antes de começar'
          emitState()
          continue
        }

        const task: Promise<void> = install(next)
          .catch((e: unknown) => {
            next.status = 'failed'
            next.detail = 'Não instalado'
            next.error = e instanceof Error ? e.message : 'Falha inesperada na instalação.'
            emitState()
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
    forgetCatalog()
    try {
      if (run) {
        if (!canceled) await finishBrowsers()
        more = !canceled && run.items.some((i) => i.status === 'queued')
        if (!more) {
          run.finishedAt = new Date().toISOString()
          run.canceling = false
          emitState()
          note(canceled ? 'instalação cancelada' : 'fila encerrada', canceled ? 'error' : 'ok')
          void rememberRun(run)
        }
      }
    } finally {
      running = false
    }
    if (more) void processQueue()
  }
}

export function currentState(): Run | null {
  return run ? structuredClone(run) : null
}

export async function allowed(requests: readonly Request[]): Promise<Request[]> {
  const parental = await readParental().catch(() => null)
  if (!parental) return [...requests]

  const wall = new Set(
    blockedAmong(parental, requests.map((one) => one.id)).filter((id) => !isGranted(id)),
  )
  if (wall.size === 0) return [...requests]

  for (const id of wall) {
    note(`${getProgram(id)?.name ?? id}: bloqueado pelo controle dos pais`, 'error')
  }

  return requests.filter((one) => !wall.has(one.id))
}

export function start(requests: readonly Request[], drive: string): Run {
  if (running && run) return structuredClone(run)

  canceled = false
  canceledItems.clear()
  openedAfterRun.clear()
  defaultBrowser = null
  startTime = Date.now()
  run = {
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

  emitState()
  note(
    `fila com ${requests.length} programas · até ${PARALLEL_LIMIT} ao mesmo tempo · geral ${drive}`,
    'step',
  )
  void processQueue()

  return structuredClone(run)
}

export function append(requests: readonly Request[]): Run | null {
  if (!run) return null

  const accepted: string[] = []
  for (const request of requests) {
    const existing = findItem(request.id)
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

  canceled = false
  run.canceling = false
  run.finishedAt = null
  emitState()
  note(`+${accepted.length} na fila`, 'step')
  void processQueue()

  return structuredClone(run)
}

function killProcess(id?: string): void {
  const targets = id ? [processes.get(id)] : [...processes.values()]
  for (const child of targets) {
    if (child?.pid) {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
    }
  }
}

export function cancel(): void {
  if (!run || !running) return
  canceled = true
  run.canceling = true
  emitState()
  note('cancelando: encerrando os instaladores em andamento', 'error')
  releasePermission()
  killProcess()
}

export function cancelItem(id: string): void {
  const target = findItem(id)
  if (!run || !target || isFinished(target)) return

  if (target.status === 'queued') {
    target.status = 'canceled'
    target.detail = 'Cancelado antes de começar'
    emitState()
    note(`${getProgram(id)?.name ?? id}: tirado da fila`, 'error')
    return
  }

  canceledItems.add(id)
  target.canceling = true
  target.detail = 'Cancelando…'
  emitState()
  releasePermission(id)
  killProcess(id)
}

export interface UninstallResult {
  ok: boolean
  verified: boolean
  error?: string
}

const DISAPPEAR_WAIT_MS = 25_000
const LATE_CHECK_MS = 6_000

async function disappeared(id: string, waitMs = DISAPPEAR_WAIT_MS): Promise<boolean> {
  const limit = Date.now() + waitMs
  while (Date.now() < limit) {
    if (!(await isInstalled(id))) return true
    await wait(2500)
  }
  return false
}

const uninstalling = new Map<string, Promise<UninstallResult>>()

export function uninstall(id: string): Promise<UninstallResult> {
  const running = uninstalling.get(id)
  if (running) return running

  const task = runUninstall(id).finally(() => {
    uninstalling.delete(id)
  })
  uninstalling.set(id, task)
  return task
}

async function runUninstall(id: string): Promise<UninstallResult> {
  const program = getProgram(id)
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

  const output = (await isElevated())
    ? await runAsInteractiveUser(['winget', ...args].join(' '))
    : await runWinget(`uninstall:${id}`, args, () => {})

  const failure = runnerFailure(output.code)
  if (failure) {
    note(`${program.name}: falhou ao desinstalar, ${failure}`, 'error')
    return {
      ok: false,
      verified: false,
      error: `O Pulse não conseguiu remover o ${program.name} pela sua sessão do Windows, porque ${failure}. Desinstale por "Aplicativos instalados" do Windows.`,
    }
  }

  if (output.code === 0) {
    forgetCatalog()
    if (await disappeared(id)) {
      note(`${program.name}: desinstalado`, 'ok')
      return { ok: true, verified: true }
    }

    note(`${program.name}: winget terminou, mas ele ainda aparece instalado`, 'error')
    return {
      ok: true,
      verified: false,
      error: `O winget concluiu, mas o ${program.name} ainda aparece instalado. Alguns desinstaladores continuam trabalhando em segundo plano, e outros não terminam com o programa aberto. Feche-o e confira em instantes.`,
    }
  }

  forgetCatalog()
  if (await disappeared(id, LATE_CHECK_MS)) {
    note(
      `${program.name}: desinstalado, embora o winget tenha encerrado com ${hex(output.code)}`,
      'ok',
    )
    return { ok: true, verified: true }
  }

  const ownUninstallers = await quietUninstallCommands(id).catch((): string[] => [])
  if (ownUninstallers.length > 0) {
    note(`${program.name}: usando o desinstalador do próprio programa`, 'step')

    let ran = false
    for (const line of ownUninstallers) {
      if (await runCommandLine(line)) ran = true
    }

    if (await disappeared(id)) {
      note(`${program.name}: desinstalado`, 'ok')
      return { ok: true, verified: true }
    }

    if (ran) {
      note(`${program.name}: o desinstalador rodou, mas ele ainda aparece instalado`, 'error')
      return {
        ok: true,
        verified: false,
        error: `O desinstalador do ${program.name} rodou, mas ele ainda aparece instalado. Alguns continuam trabalhando em segundo plano, e outros não terminam com o programa aberto. Feche-o e confira em instantes.`,
      }
    }
  }

  const text = foldText(output.text)
  if (text.includes('nenhum pacote instalado') || text.includes('no installed package')) {
    return {
      ok: false,
      verified: false,
      error: `O ${program.name} não foi instalado pelo winget e não publica um desinstalador silencioso, então o Pulse não consegue removê-lo sozinho. Desinstale por "Aplicativos instalados" do Windows.`,
    }
  }

  const error = errorMessage(output.code, output.text, program.name)
  note(`${program.name}: falhou ao desinstalar (${hex(output.code)})`, 'error')
  return { ok: false, verified: false, error }
}

export function retry(id: string): void {
  const target = findItem(id)
  if (!run || !target) return
  if (target.status !== 'failed' && target.status !== 'canceled') return

  canceled = false
  target.status = 'queued'
  target.percent = 0
  target.detail = 'Na fila'
  delete target.error
  delete target.needsPermission
  run.finishedAt = null
  emitState()
  void processQueue()
}
