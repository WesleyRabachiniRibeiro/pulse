import { clipboard } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { PROGRAM_BY_ID, type Program } from '@shared/domain/catalog'
import { RIOT_BY_ID, TIBIA_BY_ID, type Settings } from '@shared/domain/settings'
import { forgetCatalog, isInstalled, quietUninstallCommands } from '../catalog/catalog.service'
import { hasManifest, isSignedIn } from '../steam/steam.service'
import { makeDefault, openOnce } from '../browsers'
import { listDrives } from '../preflight/preflight.service'
import { formatGb, MINIMUM_SYSTEM_GB } from '@shared/domain/preflight'
import { forgetPath, locateGit, locateVsCode, runCommandLine, runTool } from './tools'
import {
  canEnqueue,
  clock,
  isFinished,
  LOG_LIMIT,
  PARALLEL_LIMIT,
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
let startTime = 0
let lastStateAt = 0

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

const UNITS: Record<string, number> = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }

const BYTES_RE = /(\d+(?:[.,]\d+)?)\s*(B|KB|MB|GB)?\s*\/\s*(\d+(?:[.,]\d+)?)\s*(B|KB|MB|GB)/i

function bytes(value: string, unit: string | undefined, fallback: string): number {
  return Number(value.replace(',', '.')) * (UNITS[(unit ?? fallback).toLowerCase()] ?? 1)
}

function normalize(line: string): string {
  return line
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

interface Progress {
  percent?: number
  phase?: 'downloading' | 'installing'
}

export function readProgress(line: string): Progress {
  const text = normalize(line)
  const p: Progress = {}

  const m = BYTES_RE.exec(line)
  if (m?.[1] && m[3] && m[4]) {
    const done = bytes(m[1], m[2], m[4])
    const total = bytes(m[3], m[4], m[4])
    if (total > 0) p.percent = Math.min(100, Math.round((done / total) * 100))
  }

  if (text.includes('baixand') || text.includes('download')) p.phase = 'downloading'
  if (text.includes('nstalando') || text.includes('nstalacao') || text.includes('nstalling')) {
    p.phase = 'installing'
  }

  return p
}

function alreadyInstalled(code: number, output: string): boolean {
  if (hex(code) === '0x8A15002B') return true

  const t = normalize(output)
  return (
    t.includes('nenhuma atualizacao') ||
    t.includes('nenhuma versao de pacote mais recente') ||
    t.includes('no available upgrade') ||
    t.includes('no applicable upgrade') ||
    t.includes('no newer package version')
  )
}

function hex(code: number): string {
  return `0x${(code >>> 0).toString(16).toUpperCase()}`
}

function is(code: number, ...codes: readonly number[]): boolean {
  return codes.includes(code >>> 0)
}

function needsAdmin(code: number, output: string): boolean {
  if (is(code, 5, 740, 0x80070005, 0x800702e4)) return true
  const t = normalize(output)
  return t.includes('acesso negado') || t.includes('access is denied') || t.includes('0x80070005')
}

function refusedElevation(code: number): boolean {
  return is(code, 1223, 0x800704c7)
}

function needsReboot(code: number, output: string): boolean {
  if (is(code, 3010, 1641, 0x80070bc2, 0x80070669)) return true
  const t = normalize(output)
  return (
    t.includes('reinicializacao necessaria') ||
    t.includes('reinicie o computador') ||
    t.includes('reinicializacao do sistema') ||
    t.includes('restart required') ||
    t.includes('reboot required') ||
    t.includes('restart your computer')
  )
}

function installerBusy(code: number, output: string): boolean {
  if (is(code, 1618, 0x80070652)) return true
  const t = normalize(output)
  return (
    t.includes('outra instalacao') ||
    t.includes('another installation') ||
    t.includes('1618') ||
    t.includes('0x80070652')
  )
}

function refusedDrive(output: string): boolean {
  const t = normalize(output)
  return t.includes('location') || t.includes('local de instalacao')
}

function refusesElevation(output: string): boolean {
  const t = normalize(output)
  return t.includes('contexto de administrador') || t.includes('administrator context')
}

function errorMessage(code: number, output: string, name: string): string {
  if (refusesElevation(output)) {
    return `O instalador do ${name} não roda com o Pulse aberto como administrador. Feche o app e abra de novo sem "Executar como administrador".`
  }
  if (refusedElevation(code)) {
    return `A permissão do Windows para instalar o ${name} foi recusada. Tente de novo e responda Sim na janela do Windows.`
  }
  if (needsAdmin(code, output)) {
    return 'O instalador precisou de permissão de administrador e não conseguiu. Abra o Pulse como administrador e tente de novo.'
  }
  const last = output
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .at(-1)
  return `O winget encerrou com ${hex(code)}.${last ? ` Última mensagem: ${last}` : ''}`
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

function runCommand(command: string, args: readonly string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, [...args], { windowsHide: true })
    child.on('error', () => resolve(false))
    child.on('close', (code) => resolve(code === 0))
  })
}

export type SteamAnswer = 'confirmed' | 'refused' | 'timeout'

const WAIT_LIMIT_MS = 15 * 60_000

async function waitForSteamSignIn(): Promise<boolean> {
  await runCommand('cmd', ['/c', 'start', '', 'steam://open/main'])

  const limit = Date.now() + WAIT_LIMIT_MS
  while (Date.now() < limit) {
    await wait(3000)
    if (await isSignedIn()) return true
  }
  return false
}
const READS_UNTIL_GIVING_UP = 3

async function requestSteamGame(appid: string): Promise<SteamAnswer> {
  if (await hasManifest(appid)) return 'confirmed'

  await runCommand('cmd', ['/c', 'start', '', `steam://install/${appid}`])

  const limit = Date.now() + WAIT_LIMIT_MS
  let withoutDialog = 0
  let grace = 6

  while (Date.now() < limit) {
    await wait(2000)

    if (await hasManifest(appid)) return 'confirmed'

    if (await steamDialogOpen()) {
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
      return (await hasManifest(appid)) ? 'confirmed' : 'refused'
    }
  }

  return (await hasManifest(appid)) ? 'confirmed' : 'timeout'
}

function steamDialogOpen(): Promise<boolean> {
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class SteamEye {
  public delegate bool Callback(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(Callback cb, IntPtr p);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
}
"@

$pids = @(Get-Process | Where-Object { $_.ProcessName -like 'steam*' } | ForEach-Object { $_.Id })
if (-not $pids) { Write-Output 'closed'; exit }

$found = $false
$cb = [SteamEye+Callback]{
  param($h, $p)
  if (-not [SteamEye]::IsWindowVisible($h)) { return $true }
  $owner = 0
  [void][SteamEye]::GetWindowThreadProcessId($h, [ref]$owner)
  if ($pids -notcontains $owner) { return $true }
  $sb = New-Object Text.StringBuilder 512
  [void][SteamEye]::GetWindowTextW($h, $sb, 512)
  $t = $sb.ToString()
  if ($t -like 'Instalar*' -or $t -like 'Install*') { $script:found = $true; return $false }
  return $true
}
[void][SteamEye]::EnumWindows($cb, [IntPtr]::Zero)

if ($found) { Write-Output 'open' } else { Write-Output 'closed' }
`

  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  return new Promise((resolve) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { windowsHide: true },
    )
    let output = ''
    child.stdout?.on('data', (b: Buffer) => (output += b.toString('utf8')))
    child.on('error', () => resolve(false))
    child.on('close', () => resolve(output.includes('open')))
  })
}

export type AutostartResult = 'on' | 'off' | 'no-entry'

async function setAutostart(program: Program, on: boolean): Promise<AutostartResult> {
  const hints = program.hints.map((h) => `'${h.replace(/'/g, "''").toLowerCase()}'`).join(',')

  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$hints = @(${hints})
$turnOn = ${on ? '$true' : '$false'}

$runKeys = @(
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
  'HKLM:\\SOFTWARE\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Run'
)

$found = @()
foreach ($key in $runKeys) {
  $item = Get-Item $key
  if (-not $item) { continue }
  foreach ($name in $item.GetValueNames()) {
    $value = [string]$item.GetValue($name)
    $target = ($name + ' ' + $value).ToLower()
    foreach ($hint in $hints) {
      if ($target -like "*$hint*") { $found += $name; break }
    }
  }
}

$appModel = 'HKCU:\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppModel\\SystemAppData'

$tasks = @()
foreach ($package in @(Get-ChildItem $appModel)) {
  $target = ([string]$package.PSChildName).ToLower()
  $matched = $false
  foreach ($hint in $hints) {
    if ($target -like "*$hint*") { $matched = $true; break }
  }
  if (-not $matched) { continue }
  foreach ($task in @(Get-ChildItem $package.PSPath)) {
    if ($null -ne $task.GetValue('State')) { $tasks += $task.PSPath }
  }
}

if ($found.Count -eq 0 -and $tasks.Count -eq 0) { Write-Output 'no-entry'; exit }

# 2 in the first byte means "approved"; 3 means "disabled by the user".
$approval = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run'
if (-not (Test-Path $approval)) { New-Item -Path $approval -Force | Out-Null }

$bytes = New-Object byte[] 12
$bytes[0] = if ($turnOn) { 2 } else { 3 }

foreach ($name in ($found | Sort-Object -Unique)) {
  New-ItemProperty -Path $approval -Name $name -Value $bytes -PropertyType Binary -Force | Out-Null
}

# 2 is enabled and 1 is turned off by the person, the same values the
# Startup tab writes for apps that came from the Store.
$state = if ($turnOn) { 2 } else { 1 }

foreach ($path in ($tasks | Sort-Object -Unique)) {
  Set-ItemProperty -Path $path -Name 'State' -Value $state -Type DWord -Force
}

if ($turnOn) { Write-Output 'on' } else { Write-Output 'off' }
`

  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  return new Promise((resolve) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { windowsHide: true },
    )
    let output = ''
    child.stdout?.on('data', (b: Buffer) => (output += b.toString('utf8')))
    child.on('error', () => resolve('no-entry'))
    child.on('close', () => {
      if (output.includes('no-entry')) resolve('no-entry')
      else if (output.includes('on')) resolve('on')
      else if (output.includes('off')) resolve('off')
      else resolve('no-entry')
    })
  })
}

async function applyExtras(target: Item, program: Program): Promise<void> {
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
  emitState()

  if (extensions.length > 0) {
    const code = await locateVsCode()

    if (!code) {
      note(
        `${program.name}: não encontrei o comando do VS Code, as extensões ficaram de fora`,
        'error',
      )
    } else {
      let done = 0
      for (const extension of extensions) {
        target.detail = `Instalando extensões (${done + 1}/${extensions.length})`
        emitState()
        const ok = await runTool(code, ['--install-extension', extension, '--force'])
        if (ok) {
          done++
          result.extensions = done
        } else {
          note(`${program.name}: não deu para instalar a extensão ${extension}`, 'error')
        }
      }
      note(`${program.name}: ${done} de ${extensions.length} extensões instaladas`, 'ok')
    }
  }

  const git = settings.git
  if (git && (git.name || git.email || git.branch || git.saveLogin)) {
    target.detail = 'Configurando o Git'
    emitState()

    const gitExe = await locateGit()
    if (!gitExe) {
      note(`${program.name}: não encontrei o git, a configuração ficou para depois`, 'error')
    } else {
      const pairs: [string, string][] = [
        ['user.name', git.name],
        ['user.email', git.email],
        ['init.defaultBranch', git.branch],
      ]
      for (const [key, value] of pairs) {
        if (!value.trim()) continue
        const ok = await runTool(gitExe, ['config', '--global', key, value])
        if (ok) result.git = true
        else note(`${program.name}: falhou ao gravar ${key}`, 'error')
      }

      if (git.saveLogin) {
        const ok = await runTool(gitExe, ['config', '--global', 'credential.helper', 'manager'])
        result.gitLogin = ok
        note(
          ok
            ? `${program.name}: o Windows vai guardar o login do GitHub`
            : `${program.name}: falhou ao ligar o gerenciador de credenciais`,
          ok ? 'ok' : 'error',
        )
      }

      emitState()
      note(`${program.name}: Git configurado`, 'ok')
    }
  }

  if (settings.autostart !== undefined) {
    target.detail = settings.autostart
      ? 'Deixando abrir com o Windows'
      : 'Tirando da inicialização do Windows'
    emitState()

    const effect = await setAutostart(program, settings.autostart)
    result.autostart = effect
    emitState()
    note(
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
    let signedIn = await isSignedIn()

    if (!signedIn) {
      target.status = 'waiting'
      target.detail = 'Entre na sua conta Steam para baixar os jogos'
      emitState()
      note('Steam: esperando você entrar na conta', 'step')
      signedIn = await waitForSteamSignIn()
    }

    if (!signedIn) {
      for (const game of games) result.gamesPending.push(game.name)
      note('Steam: ninguém entrou na conta, os jogos ficaram para depois', 'error')
    } else {
      for (const [index, game] of games.entries()) {
        const position = games.length > 1 ? ` (${index + 1}/${games.length})` : ''
        target.status = 'waiting'
        target.detail = `Confirme "${game.name}" na janela da Steam${position}`
        emitState()
        note(`Steam: esperando você decidir sobre ${game.name}`, 'step')

        const answer = await requestSteamGame(game.appid)

        if (answer === 'confirmed') {
          result.gamesAccepted.push(game.name)
          note(`Steam: ${game.name} confirmado, download na fila da Steam`, 'ok')
        } else if (answer === 'refused') {
          result.gamesRefused.push(game.name)
          note(`Steam: ${game.name} recusado por você`, 'info')
        } else {
          result.gamesPending.push(game.name)
          note(`Steam: ${game.name} ficou sem resposta e foi deixado para depois`, 'error')
        }
      }
    }

    target.status = 'configuring'
    target.detail = 'Terminando'
    emitState()
    note(`${program.name}: ${result.gamesAccepted.length} de ${games.length} jogos aceitos`, 'ok')
  }

  const pages = settings.tibia ?? []
  if (pages.length > 0) {
    target.status = 'configuring'
    emitState()

    for (const [index, id] of pages.entries()) {
      const client = TIBIA_BY_ID.get(id)
      if (!client?.url) continue

      target.detail = `Abrindo a página do ${client.name} (${index + 1}/${pages.length})`
      emitState()

      if (await runCommand('cmd', ['/c', 'start', '', client.url])) {
        result.pagesOpened.push(client.name)
        note(`${client.name}: página oficial aberta no navegador`, 'ok')
      } else {
        note(`${client.name}: não deu para abrir a página`, 'error')
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
      emitState()
      note(`${program.name}: instalando ${name}`, 'step')

      const destination =
        target.drive.toUpperCase() === system
          ? undefined
          : `${target.drive}\\Pulse\\${packageId}`

      const output = await runWinget(
        target.id,
        packageArgs(packageId, destination),
        (line) => {
          const current = findItem(target.id)
          const p = readProgress(line)
          if (current && p.percent !== undefined) {
            current.percent = p.percent
            emitState(false)
          }
        },
        target.drive,
      )

      if (output.code === 0 || alreadyInstalled(output.code, output.text)) {
        result.riotInstalled.push(name)
        note(`${name}: instalado`, 'ok')
      } else {
        result.riotFailed.push(name)
        note(`${name}: falhou com ${hex(output.code)}`, 'error')
      }
    }

    target.percent = 100
    emitState()
  }
}

function findItem(id: string): Item | undefined {
  return run?.items.find((i) => i.id === id)
}

function workloadOverride(settings: Settings | undefined, destination?: string): string | undefined {
  const workloads = settings?.workloads ?? []
  if (workloads.length === 0) return undefined

  const parts = ['--quiet', '--norestart', '--wait', '--includeRecommended']
  for (const workload of workloads) parts.push('--add', workload)
  if (destination) parts.push('--installPath', `"${destination}"`)
  return parts.join(' ')
}

function packageArgs(packageId: string, destination?: string): string[] {
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

function args(
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

async function install(target: Item): Promise<void> {
  const program = PROGRAM_BY_ID.get(target.id)
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
  let output = await runWinget(
    target.id,
    args(program, destination, packageId, workloadOverride(target.settings, destination)),
    follow,
    target.drive,
  )

  if (output.code !== 0 && destination && refusedDrive(output.text) && !gaveUp()) {
    target.driveIgnored = true
    note(`${program.name}: o instalador ignora a escolha de disco`, 'info')
    target.status = 'downloading'
    target.percent = 0
    emitState()
    output = await runWinget(
      target.id,
      args(program, undefined, packageId, workloadOverride(target.settings)),
      follow,
      target.drive,
    )
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
    output = await runWinget(
      target.id,
      args(program, target.driveIgnored ? undefined : destination, packageId, workloadOverride(target.settings, target.driveIgnored ? undefined : destination)),
      follow,
      target.drive,
    )
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
  target.error = noSpace ?? errorMessage(output.code, output.text, program.name)
  target.finishedAt = new Date().toISOString()
  emitState()
  note(`${program.name}: falhou com ${hex(output.code)}`, 'error')
}

function chooseDefaultBrowser(items: readonly Item[]): Item | null {
  const browsers = items
    .filter((i) => i.status === 'done' && PROGRAM_BY_ID.get(i.id)?.category === 'browsers')
    .sort((a, b) => Date.parse(a.finishedAt ?? '') - Date.parse(b.finishedAt ?? ''))

  if (browsers.length === 0) return null

  const marked = browsers.filter((i) => i.settings?.makeDefault)
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

  const winner = chooseDefaultBrowser(run.items)
  if (winner) {
    const program = PROGRAM_BY_ID.get(winner.id)
    if (program) {
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

  const addresses: string[] = []

  for (const item of run.items) {
    if (item.status !== 'done' || !item.settings?.openAfter) continue
    const program = PROGRAM_BY_ID.get(item.id)
    if (!program) continue
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
}

async function processQueue(): Promise<void> {
  if (running) return
  running = true

  const active = new Set<Promise<void>>()

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
    running = false
    forgetCatalog()
    if (run) {
      if (!canceled) await finishBrowsers()
      run.finishedAt = new Date().toISOString()
      run.canceling = false
      emitState()
      note(canceled ? 'instalação cancelada' : 'fila encerrada', canceled ? 'error' : 'ok')
    }
  }
}

export function currentState(): Run | null {
  return run ? structuredClone(run) : null
}

export function start(requests: readonly Request[], drive: string): Run {
  if (running && run) return structuredClone(run)

  canceled = false
  canceledItems.clear()
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
  killProcess()
}

export function cancelItem(id: string): void {
  const target = findItem(id)
  if (!run || !target || isFinished(target)) return

  if (target.status === 'queued') {
    target.status = 'canceled'
    target.detail = 'Cancelado antes de começar'
    emitState()
    note(`${PROGRAM_BY_ID.get(id)?.name ?? id}: tirado da fila`, 'error')
    return
  }

  canceledItems.add(id)
  target.canceling = true
  target.detail = 'Cancelando…'
  emitState()
  killProcess(id)
}

export interface UninstallResult {
  ok: boolean
  verified: boolean
  error?: string
}

const DISAPPEAR_WAIT_MS = 25_000

async function disappeared(id: string): Promise<boolean> {
  const limit = Date.now() + DISAPPEAR_WAIT_MS
  while (Date.now() < limit) {
    if (!(await isInstalled(id))) return true
    await wait(2500)
  }
  return false
}

export async function uninstall(id: string): Promise<UninstallResult> {
  const program = PROGRAM_BY_ID.get(id)
  if (!program) return { ok: false, verified: false, error: 'Programa fora do catálogo.' }

  if (!program.winget) {
    return {
      ok: false,
      verified: false,
      error: `O Pulse não instalou o ${program.name}, então não tem como removê-lo. Desinstale por "Aplicativos instalados" do Windows.`,
    }
  }

  const output = await runWinget(
    `uninstall:${id}`,
    [
      'uninstall',
      '--id',
      program.winget,
      '--exact',
      '--silent',
      '--accept-source-agreements',
      '--disable-interactivity',
    ],
    () => {},
  )

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

  const text = normalize(output.text)
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
  run.finishedAt = null
  emitState()
  void processQueue()
}
