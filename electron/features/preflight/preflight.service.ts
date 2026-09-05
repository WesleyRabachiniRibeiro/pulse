import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  MINIMUM_BUILD,
  checkDrive,
  worstStatus,
  type Check,
  type Drive,
  type Preflight,
  type PreflightInput,
} from '@shared/domain/preflight'

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
$physical = @(Get-PhysicalDisk)
@(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object {
  $letter = [string]$_.DeviceID
  $media = 'Desconhecido'
  try {
    $p = Get-Partition -DriveLetter $letter.TrimEnd(':') -ErrorAction Stop
    $pd = $physical | Where-Object { $_.DeviceId -eq $p.DiskNumber }
    if ($pd -and $pd.MediaType) { $media = [string]$pd.MediaType }
  } catch { }
  [pscustomobject]@{
    letter     = $letter
    label      = [string]$_.VolumeName
    media      = $media
    freeBytes  = [int64]$_.FreeSpace
    totalBytes = [int64]$_.Size
    system     = ($letter -eq $env:SystemDrive)
  }
}) | ConvertTo-Json -Compress -Depth 3
`

export async function listDrives(): Promise<Drive[]> {
  const raw = await powershell(DRIVES_SCRIPT)
  const drives = asArray(raw as Drive | Drive[])
  return drives.sort((a, b) => {
    if (a.system !== b.system) return a.system ? -1 : 1
    return b.freeBytes - a.freeBytes
  })
}

const SYSTEM_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$k   = Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion'
$cs  = Get-CimInstance Win32_ComputerSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$wg  = try { (winget --version) -replace '^v','' } catch { $null }
$adm = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
[pscustomobject]@{
  product      = [string]$k.ProductName
  version      = [string]$k.DisplayVersion
  build        = [int]$k.CurrentBuild
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

function checkWindows(f: SystemFacts): Check {
  const name = `${f.product} ${f.version}`.trim()
  if (f.build >= MINIMUM_BUILD) {
    return { id: 'windows', status: 'ok', title: name, detail: `build ${f.build} · compatível` }
  }
  return {
    id: 'windows',
    status: 'blocker',
    title: name,
    detail: `build ${f.build} · precisa de ${MINIMUM_BUILD} ou maior`,
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

export async function runPreflight(input: PreflightInput = {}): Promise<Preflight> {
  const [facts, online, drives] = await Promise.all([
    powershell(SYSTEM_SCRIPT) as Promise<SystemFacts>,
    hasInternet(),
    listDrives(),
  ])

  const chosen =
    drives.find((d) => d.letter === input.drive) ?? drives.find((d) => d.system) ?? drives[0]

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
