import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import {
  CHECK_ORDER,
  MINIMUM_BUILD,
  checkDrive,
  worstStatus,
  type Check,
  type Drive,
  type Preflight,
  type PreflightInput,
  type PreflightPartial,
} from '@shared/domain/preflight'
import type { FreshInput } from '@shared/ipc/contracts'

const exec = promisify(execFile)

async function powershell(script: string): Promise<unknown> {
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  const { stdout } = await exec(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
    { windowsHide: true, timeout: 25_000, maxBuffer: 4 * 1024 * 1024 },
  )
  return JSON.parse(stdout)
}

function asArray<T>(v: T | T[]): T[] {
  return Array.isArray(v) ? v : [v]
}

const DRIVES_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'

$vols = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
  [pscustomobject]@{
    letter     = [string]$_.DeviceID
    label      = [string]$_.VolumeName
    media      = 'Desconhecido'
    freeBytes  = [int64]$_.FreeSpace
    totalBytes = [int64]$_.Size
    system     = ([string]$_.DeviceID -eq $env:SystemDrive)
  }
})

$vols | ConvertTo-Json -Compress -Depth 3

$ns = 'root/Microsoft/Windows/Storage'

$media = @{}
foreach ($d in @(Get-CimInstance -Namespace $ns -ClassName MSFT_PhysicalDisk)) {
  $media[[int]$d.DeviceId] = switch ([int]$d.MediaType) { 3 { 'HDD' } 4 { 'SSD' } default { 'Desconhecido' } }
}

$disk = @{}
foreach ($p in @(Get-CimInstance -Namespace $ns -ClassName MSFT_Partition)) {
  if ($p.DriveLetter) { $disk[[string]$p.DriveLetter] = [int]$p.DiskNumber }
}

foreach ($v in $vols) {
  $short = $v.letter.TrimEnd(':')
  if ($disk.ContainsKey($short)) {
    $n = $disk[$short]
    if ($media.ContainsKey($n)) { $v.media = $media[$n] }
  }
}

$vols | ConvertTo-Json -Compress -Depth 3
`

function sortDrives(drives: Drive[]): Drive[] {
  return [...drives].sort((a, b) => {
    if (a.system !== b.system) return a.system ? -1 : 1
    return b.freeBytes - a.freeBytes
  })
}

function readDrives(onEnriched?: (drives: Drive[]) => void): Promise<Drive[]> {
  return new Promise((resolve, reject) => {
    const encoded = Buffer.from(DRIVES_SCRIPT, 'utf16le').toString('base64')
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { windowsHide: true },
    )

    const kill = setTimeout(() => child.kill(), 25_000)

    let buffer = ''
    let first = true

    const take = (line: string): void => {
      const clean = line.trim()
      if (!clean) return
      let parsed: unknown
      try {
        parsed = JSON.parse(clean)
      } catch {
        return
      }
      const drives = sortDrives(asArray(parsed as Drive | Drive[]))
      if (first) {
        first = false
        resolve(drives)
        return
      }
      onEnriched?.(drives)
    }

    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      buffer += chunk
      for (;;) {
        const cut = buffer.indexOf('\n')
        if (cut < 0) break
        take(buffer.slice(0, cut))
        buffer = buffer.slice(cut + 1)
      }
    })

    child.on('error', () => {
      clearTimeout(kill)
      if (first) reject(new Error('Nao foi possivel listar os discos deste computador.'))
    })

    child.on('close', () => {
      clearTimeout(kill)
      take(buffer)
      if (first) reject(new Error('Nao foi possivel listar os discos deste computador.'))
    })
  })
}

export function listDrives(): Promise<Drive[]> {
  return readDrives()
}

const REUSE_MS = 20_000

let lastDrives: { at: number; drives: Drive[] } | null = null

function peekDrives(): Drive[] | null {
  if (lastDrives && Date.now() - lastDrives.at < REUSE_MS) return lastDrives.drives
  return null
}

export function warmDrives(): void {
  void drivesForScreen().catch(() => undefined)
}

export async function drivesForScreen(input: FreshInput = {}): Promise<Drive[]> {
  if (!input.fresh && lastDrives && Date.now() - lastDrives.at < REUSE_MS) return lastDrives.drives

  const drives = await readDrives((enriched) => {
    lastDrives = { at: Date.now(), drives: enriched }
    publishPartial({ drives: enriched })
  })

  lastDrives = { at: Date.now(), drives }
  return drives
}

const SYSTEM_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$k   = Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion'
$cs  = Get-CimInstance Win32_ComputerSystem
$cpu = Get-CimInstance Win32_Processor -Property VirtualizationFirmwareEnabled | Select-Object -First 1
$wg  = try { (winget --version) -replace '^v','' } catch { $null }
$adm = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
[pscustomobject]@{
  product      = [string]$k.ProductName
  version      = if ($k.DisplayVersion) { [string]$k.DisplayVersion } else { [string]$k.ReleaseId }
  build        = [int]$k.CurrentBuild
  revision     = [int]$k.UBR
  admin        = [bool]$adm
  winget       = if ($wg) { [string]$wg } else { $null }
  hypervisor   = [bool]$cs.HypervisorPresent
  virtFirmware = [bool]$cpu.VirtualizationFirmwareEnabled
} | ConvertTo-Json -Compress
`

interface SystemFacts {
  product: string
  version: string
  build: number
  revision: number
  admin: boolean
  winget: string | null
  hypervisor: boolean
  virtFirmware: boolean
}

const NETWORK_ENDPOINTS = [
  'https://www.gstatic.com/generate_204',
  'https://cdn.winget.microsoft.com/cache',
] as const

async function hasInternet(): Promise<boolean> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 8000)
  try {
    await Promise.any(
      NETWORK_ENDPOINTS.map((u) =>
        fetch(u, { method: 'GET', signal: ctrl.signal, cache: 'no-store' }),
      ),
    )
    return true
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}

function windowsName(f: SystemFacts): string {
  const product = f.product.replace(/^Microsoft\s+/i, '').trim()
  const family = f.build >= 22000 ? 'Windows 11' : f.build >= 10240 ? 'Windows 10' : ''
  const edition = product.replace(/^Windows\s+\d+\s*/i, '').trim()
  const base = family && !/server/i.test(product) ? `${family} ${edition}`.trim() : product
  return `${base} ${f.version}`.trim() || 'Windows'
}

function checkWindows(f: SystemFacts): Check {
  const name = windowsName(f)
  const build = f.revision ? `${f.build}.${f.revision}` : `${f.build}`
  if (f.build >= MINIMUM_BUILD) {
    return { id: 'windows', status: 'ok', title: name, detail: `build ${build} · compatível` }
  }
  return {
    id: 'windows',
    status: 'blocker',
    title: name,
    detail: `build ${build} · precisa de ${MINIMUM_BUILD} ou maior`,
    fix: 'Atualize o Windows pelo Windows Update e abra o Pulse de novo.',
  }
}

function checkAdmin(f: SystemFacts): Check {
  if (f.admin) {
    return { id: 'admin', status: 'ok', title: 'Permissão de administrador', detail: 'concedida' }
  }
  return {
    id: 'admin',
    status: 'warning',
    title: 'Sem permissão de administrador',
    detail: 'rodando como usuário comum',
    fix: 'O instalador final pede elevação sozinho. Em desenvolvimento, abra o terminal como administrador.',
  }
}

function checkWinget(f: SystemFacts): Check {
  if (f.winget) {
    return {
      id: 'winget',
      status: 'ok',
      title: 'Instalador do Windows disponível',
      detail: `winget ${f.winget} pronto`,
    }
  }
  return {
    id: 'winget',
    status: 'blocker',
    title: 'Instalador do Windows ausente',
    detail: 'winget não encontrado',
    fix: 'Instale o App Installer pela Microsoft Store e tente de novo.',
  }
}

function checkInternet(online: boolean): Check {
  if (online) {
    return { id: 'internet', status: 'ok', title: 'Conexão com a internet', detail: 'ativa' }
  }
  return {
    id: 'internet',
    status: 'blocker',
    title: 'Sem conexão com a internet',
    detail: 'não foi possível alcançar a rede',
    fix: 'Conecte-se ao Wi-Fi ou ao cabo e tente de novo.',
  }
}

function checkVirtualization(f: SystemFacts): Check {
  if (f.hypervisor || f.virtFirmware) {
    return {
      id: 'virtualization',
      status: 'ok',
      title: 'Virtualização ativada',
      detail: 'o Docker pode ser instalado',
    }
  }
  return {
    id: 'virtualization',
    status: 'warning',
    title: 'Virtualização desativada',
    detail: 'só o Docker precisa dela',
    fix: 'Ative a virtualização na BIOS. Todo o resto instala normalmente sem ela.',
  }
}

type PartialListener = (partial: PreflightPartial) => void

const partialListeners = new Set<PartialListener>()

export function subscribePartial(listener: PartialListener): () => void {
  partialListeners.add(listener)
  return () => {
    partialListeners.delete(listener)
  }
}

let token = 0

function publishPartial(payload: Omit<PreflightPartial, 'token'>): void {
  for (const listener of partialListeners) listener({ token, ...payload })
}

function pickDrive(drives: readonly Drive[], wanted?: string): Drive | undefined {
  return drives.find((d) => d.letter === wanted) ?? drives.find((d) => d.system) ?? drives[0]
}

export async function runPreflight(input: PreflightInput = {}): Promise<Preflight> {
  const mine = ++token
  const arrived = new Map<Check['id'], Check>()

  const publish = (...found: Check[]): void => {
    if (mine !== token) return
    for (const c of found) arrived.set(c.id, c)
    const checks = CHECK_ORDER.map((id) => arrived.get(id)).filter((c): c is Check => Boolean(c))
    publishPartial({ checks })
  }

  const ready = peekDrives()
  if (ready) {
    const early = pickDrive(ready, input.drive)
    if (early) publish(checkDrive(early, ready.find((x) => x.system)))
  }

  const systemStep = (powershell(SYSTEM_SCRIPT) as Promise<SystemFacts>).then((f) => {
    publish(checkWindows(f), checkAdmin(f), checkWinget(f), checkVirtualization(f))
    return f
  })

  const internetStep = hasInternet().then((o) => {
    publish(checkInternet(o))
    return o
  })

  const drivesStep = drivesForScreen().then((d) => {
    const early = pickDrive(d, input.drive)
    if (early) publish(checkDrive(early, d.find((x) => x.system)))
    return d
  })

  const [facts, online, drives] = await Promise.all([systemStep, internetStep, drivesStep])

  const chosen = pickDrive(drives, input.drive)

  if (!chosen) {
    throw new Error('Nenhum disco fixo encontrado neste computador.')
  }

  const checks: Check[] = [
    checkWindows(facts),
    checkAdmin(facts),
    checkWinget(facts),
    checkInternet(online),
    checkDrive(chosen, drives.find((d) => d.system)),
    checkVirtualization(facts),
  ]

  return {
    checks,
    overall: worstStatus(checks),
    drives,
    chosenDrive: chosen.letter,
    ranAt: new Date().toISOString(),
  }
}
