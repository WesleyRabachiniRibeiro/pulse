import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { entryMatchesProgram, getPrograms } from '@shared/domain/catalog'
import { tidyStartup, type StartupEntry } from '@shared/domain/windows'
import { listAutostartEntries } from './catalog.service'

const exec = promisify(execFile)

const CALL_TIMEOUT_MS = 25_000

function programFor(name: string, value: string): string | undefined {
  for (const program of getPrograms()) {
    if (entryMatchesProgram(name, value, program)) return program.id
  }
  return undefined
}

export async function listStartup(): Promise<StartupEntry[]> {
  const raw = await listAutostartEntries().catch((): [] => [])

  return tidyStartup(
    raw
      .filter((entry) => entry?.name)
      .map((entry) => {
        const value = entry.value ?? ''
        const programId = programFor(entry.name, value)
        return {
          name: entry.name,
          value,
          enabled: entry.enabled,
          ...(programId ? { programId } : {}),
        }
      }),
  )
}

function script(name: string, on: boolean): string {
  const safe = name.replace(/'/g, "''")

  return `
$ErrorActionPreference = 'SilentlyContinue'
$name = '${safe}'
$turnOn = ${on ? '$true' : '$false'}

$approval = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run'
if (-not (Test-Path $approval)) { New-Item -Path $approval -Force | Out-Null }

$runKeys = @(
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
  'HKLM:\\SOFTWARE\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Run'
)

$isRun = $false
foreach ($key in $runKeys) {
  $item = Get-Item $key
  if (-not $item) { continue }
  if ($item.GetValueNames() -contains $name) { $isRun = $true }
}

if ($isRun) {
  $bytes = New-Object byte[] 12
  $bytes[0] = if ($turnOn) { 2 } else { 3 }
  New-ItemProperty -Path $approval -Name $name -Value $bytes -PropertyType Binary -Force | Out-Null
  Write-Output 'ok'
  exit
}

$appModel = 'HKCU:\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppModel\\SystemAppData'
$state = if ($turnOn) { 2 } else { 1 }
$touched = $false

foreach ($package in @(Get-ChildItem $appModel)) {
  if ([string]$package.PSChildName -ne $name) { continue }
  foreach ($task in @(Get-ChildItem $package.PSPath)) {
    if ($null -eq $task.GetValue('State')) { continue }
    Set-ItemProperty -Path $task.PSPath -Name 'State' -Value $state -Type DWord -Force
    $touched = $true
  }
}

if ($touched) { Write-Output 'ok' } else { Write-Output 'no-entry' }
`
}

export async function setStartup(name: string, on: boolean): Promise<StartupEntry[]> {
  const encoded = Buffer.from(script(name, on), 'utf16le').toString('base64')

  await exec(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
    { windowsHide: true, timeout: CALL_TIMEOUT_MS },
  ).catch(() => undefined)

  return listStartup()
}
