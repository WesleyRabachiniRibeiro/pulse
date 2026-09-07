import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  entryMatchesProgram,
  installedIds,
  nameMatchesProgram,
  PROGRAM_BY_ID,
  type PackageVersion,
} from '@shared/domain/catalog'
import type { FreshInput } from '@shared/ipc/contracts'

const exec = promisify(execFile)

const INSTALLED_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$keys = @(
  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
$names = @(Get-ItemProperty $keys | Where-Object { $_.DisplayName } | ForEach-Object { [string]$_.DisplayName })
$names += @(try { Get-StartApps | ForEach-Object { [string]$_.Name } } catch { @() })
@($names | Sort-Object -Unique) | ConvertTo-Json -Compress
`

export async function listVersions(id: string): Promise<PackageVersion[]> {
  const program = PROGRAM_BY_ID.get(id)
  if (!program?.family) return []

  const { prefix, pattern } = program.family
  const accepted = new RegExp(pattern)

  const { stdout } = await exec(
    'winget',
    ['search', prefix, '--disable-interactivity', '--source', 'winget'],
    { windowsHide: true, timeout: 30_000, maxBuffer: 4 * 1024 * 1024 },
  ).catch(() => ({ stdout: '' }))

  const versions: PackageVersion[] = []
  for (const line of stdout.split(/\r?\n/)) {
    const tokens = line.trim().split(/\s+/)
    const position = tokens.findIndex((t) => accepted.test(t))
    if (position <= 0) continue

    const winget = tokens[position]
    const version = tokens[position + 1]
    const name = tokens.slice(0, position).join(' ')
    if (!winget || !version || !name) continue

    versions.push({ winget, name, version, recommended: winget === program.winget })
  }

  return versions.sort((a, b) => compareVersions(b, a))
}

function compareVersions(a: PackageVersion, b: PackageVersion): number {
  const key = ({ winget, version }: PackageVersion): number[] => {
    if (winget.toUpperCase().endsWith('.LTS')) return [Number.MAX_SAFE_INTEGER]
    const fromId = winget.match(/\d+/g)
    return (fromId ?? version.match(/\d+/g) ?? ['0']).map(Number)
  }

  const na = key(a)
  const nb = key(b)

  for (let i = 0; i < Math.max(na.length, nb.length); i++) {
    const difference = (na[i] ?? 0) - (nb[i] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

const UNINSTALL_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$keys = @(
  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
@(Get-ItemProperty $keys | Where-Object { $_.DisplayName -and ($_.QuietUninstallString -or $_.UninstallString) } | ForEach-Object {
  [pscustomobject]@{
    name  = [string]$_.DisplayName
    quiet = [string]$_.QuietUninstallString
    plain = [string]$_.UninstallString
  }
}) | ConvertTo-Json -Compress
`

interface UninstallEntry {
  name: string
  quiet: string
  plain: string
}

const MSI_CODE = /\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}/

function silentCommand(entry: UninstallEntry): string | null {
  if (entry.quiet?.trim()) return entry.quiet.trim()

  const plain = entry.plain ?? ''
  if (!/msiexec/i.test(plain)) return null

  const code = MSI_CODE.exec(plain)?.[0]
  return code ? `msiexec.exe /x ${code} /quiet /norestart` : null
}

export async function quietUninstallCommands(id: string): Promise<string[]> {
  const program = PROGRAM_BY_ID.get(id)
  if (!program) return []

  const encoded = Buffer.from(UNINSTALL_SCRIPT, 'utf16le').toString('base64')
  const { stdout } = await exec(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
    { windowsHide: true, timeout: 25_000, maxBuffer: 8 * 1024 * 1024 },
  ).catch(() => ({ stdout: '' }))

  if (!stdout.trim()) return []

  let raw: unknown
  try {
    raw = JSON.parse(stdout)
  } catch {
    return []
  }

  const entries = (Array.isArray(raw) ? raw : [raw]) as UninstallEntry[]

  const commands: string[] = []
  for (const entry of entries) {
    if (!entry?.name || !nameMatchesProgram(entry.name, program)) continue
    const command = silentCommand(entry)
    if (command && !commands.includes(command)) commands.push(command)
  }
  return commands
}

const AUTOSTART_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$runKeys = @(
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
  'HKLM:\\SOFTWARE\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Run'
)
$approval = Get-Item 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run'
$approved = @()
if ($approval) { $approved = @($approval.GetValueNames()) }

$appModel = 'HKCU:\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppModel\\SystemAppData'

@(
foreach ($key in $runKeys) {
  $item = Get-Item $key
  if (-not $item) { continue }
  foreach ($name in $item.GetValueNames()) {
    $enabled = $true
    if ($approved -contains $name) {
      $bytes = $approval.GetValue($name)
      # Bit 0 of the first byte is the switch: even means approved, odd means
      # turned off by the person. It is the same byte the Startup tab writes.
      if ($bytes -and (($bytes[0] % 2) -eq 1)) { $enabled = $false }
    }
    [pscustomobject]@{
      name    = [string]$name
      value   = [string]$item.GetValue($name)
      enabled = [bool]$enabled
    }
  }
}

foreach ($package in @(Get-ChildItem $appModel)) {
  foreach ($task in @(Get-ChildItem $package.PSPath)) {
    $state = $task.GetValue('State')
    if ($null -eq $state) { continue }
    [pscustomobject]@{
      name    = [string]$package.PSChildName
      value   = ''
      enabled = ([int]$state -eq 2 -or [int]$state -eq 4)
    }
  }
}
) | ConvertTo-Json -Compress
`

export interface AutostartEntry {
  name: string
  value: string
  enabled: boolean
}

export type AutostartState = 'on' | 'off'

export async function listAutostartEntries(): Promise<AutostartEntry[]> {
  const encoded = Buffer.from(AUTOSTART_SCRIPT, 'utf16le').toString('base64')
  const { stdout } = await exec(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
    { windowsHide: true, timeout: 25_000, maxBuffer: 8 * 1024 * 1024 },
  ).catch(() => ({ stdout: '' }))

  if (!stdout.trim()) return []

  try {
    const raw: unknown = JSON.parse(stdout)
    return (Array.isArray(raw) ? raw : [raw]) as AutostartEntry[]
  } catch {
    return []
  }
}

async function readAutostart(): Promise<{ id: string; state: AutostartState }[]> {
  const entries = await listAutostartEntries()
  const found = new Map<string, AutostartState>()

  for (const program of PROGRAM_BY_ID.values()) {
    for (const entry of entries) {
      if (!entry?.name) continue
      if (!entryMatchesProgram(entry.name, entry.value ?? '', program)) continue
      if (entry.enabled || !found.has(program.id)) {
        found.set(program.id, entry.enabled ? 'on' : 'off')
      }
      if (entry.enabled) break
    }
  }

  return [...found.entries()].map(([id, state]) => ({ id, state }))
}

export async function isInstalled(id: string): Promise<boolean> {
  const ids = await readInstalled().catch((): string[] => [])
  return ids.includes(id)
}

async function readInstalledNames(): Promise<string[]> {
  const encoded = Buffer.from(INSTALLED_SCRIPT, 'utf16le').toString('base64')
  const { stdout } = await exec(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
    { windowsHide: true, timeout: 25_000, maxBuffer: 8 * 1024 * 1024 },
  )

  const raw: unknown = JSON.parse(stdout)
  const names = Array.isArray(raw) ? raw.filter((n): n is string => typeof n === 'string') : []
  return installedIds(names)
}

const REUSE_MS = 120_000

type Autostart = { id: string; state: AutostartState }

let lastInstalled: { at: number; ids: string[] } | null = null
let installedRead: { generation: number; reading: Promise<string[]> } | null = null

let lastAutostart: { at: number; list: Autostart[] } | null = null
let autostartRead: { generation: number; reading: Promise<Autostart[]> } | null = null

let generation = 0

function readInstalled(): Promise<string[]> {
  if (installedRead?.generation === generation) return installedRead.reading

  const mine = generation
  const reading = readInstalledNames()
    .then((ids) => {
      if (mine === generation) lastInstalled = { at: Date.now(), ids }
      return ids
    })
    .finally(() => {
      if (installedRead?.reading === reading) installedRead = null
    })

  installedRead = { generation: mine, reading }
  return reading
}

function readAutostartOnce(): Promise<Autostart[]> {
  if (autostartRead?.generation === generation) return autostartRead.reading

  const mine = generation
  const reading = readAutostart()
    .then((list) => {
      if (mine === generation) lastAutostart = { at: Date.now(), list }
      return list
    })
    .finally(() => {
      if (autostartRead?.reading === reading) autostartRead = null
    })

  autostartRead = { generation: mine, reading }
  return reading
}

export function listInstalled(input: FreshInput = {}): Promise<string[]> {
  if (!input.fresh && lastInstalled && Date.now() - lastInstalled.at < REUSE_MS) {
    return Promise.resolve(lastInstalled.ids)
  }
  return readInstalled()
}

export function listAutostart(): Promise<Autostart[]> {
  if (lastAutostart && Date.now() - lastAutostart.at < REUSE_MS) {
    return Promise.resolve(lastAutostart.list)
  }
  return readAutostartOnce()
}

export function forgetCatalog(): void {
  generation++
  lastInstalled = null
  lastAutostart = null
}

export function warmCatalog(): void {
  void listInstalled().catch(() => undefined)
  void listAutostart().catch(() => undefined)
}
