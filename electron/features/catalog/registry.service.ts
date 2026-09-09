import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { registryEntrySchema, type RegistryEntry } from '@shared/domain/installed'

const exec = promisify(execFile)

const CALL_TIMEOUT_MS = 30_000

const ENTRIES_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$keys = @(
  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
@(Get-ItemProperty $keys | Where-Object { $_.DisplayName } | ForEach-Object {
  [pscustomobject]@{
    key       = [string]$_.PSChildName
    name      = [string]$_.DisplayName
    publisher = [string]$_.Publisher
    version   = [string]$_.DisplayVersion
    system    = [bool]$_.SystemComponent
    location  = [string]$_.InstallLocation
    uninstall = [string]$(if ($_.QuietUninstallString) { $_.QuietUninstallString } else { $_.UninstallString })
  }
}) | ConvertTo-Json -Compress -Depth 3
`

function trimmed(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/**
 * Lê o que o Windows chama de programas instalados, com os campos que dizem
 * quem é acessório de quem. É a mesma fonte de "Aplicativos instalados".
 */
export async function readRegistryEntries(): Promise<RegistryEntry[]> {
  const encoded = Buffer.from(ENTRIES_SCRIPT, 'utf16le').toString('base64')

  const { stdout } = await exec(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
    { windowsHide: true, timeout: CALL_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
  ).catch(() => ({ stdout: '' }))

  if (!stdout.trim()) return []

  let raw: unknown
  try {
    raw = JSON.parse(stdout)
  } catch {
    return []
  }

  const rows = Array.isArray(raw) ? raw : [raw]
  const entries: RegistryEntry[] = []

  for (const row of rows) {
    const one = row as Record<string, unknown>
    const name = trimmed(one['name'])
    const key = trimmed(one['key'])
    if (!name || !key) continue

    const read = registryEntrySchema.safeParse({
      key,
      name,
      ...(trimmed(one['publisher']) ? { publisher: trimmed(one['publisher']) } : {}),
      ...(trimmed(one['version']) ? { version: trimmed(one['version']) } : {}),
      ...(one['system'] === true ? { system: true } : {}),
      ...(trimmed(one['location']) ? { location: trimmed(one['location']) } : {}),
      ...(trimmed(one['uninstall']) ? { uninstall: trimmed(one['uninstall']) } : {}),
    })

    if (read.success) entries.push(read.data)
  }

  return entries
}
