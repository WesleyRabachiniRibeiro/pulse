import type { SystemFacts } from '@pulse/domain'
import type { PowerShellRunner } from '../../ports/powershell-runner'
import type { SystemInspector } from '../../ports/system-inspector'

const SCRIPT_TIMEOUT_MS = 25_000
const INTERNET_TIMEOUT_MS = 8_000

const NETWORK_ENDPOINTS = [
  'https://www.gstatic.com/generate_204',
  'https://cdn.winget.microsoft.com/cache',
] as const

export class WindowsSystemInspector implements SystemInspector {
  constructor(private readonly powershell: PowerShellRunner) {}

  getSystemFacts(): Promise<SystemFacts> {
    return this.powershell.runJson<SystemFacts>('Get-SystemInfo.ps1', undefined, SCRIPT_TIMEOUT_MS)
  }

  async hasInternet(): Promise<boolean> {
    const control = new AbortController()
    const giveUp = setTimeout(() => control.abort(), INTERNET_TIMEOUT_MS)
    try {
      await Promise.any(
        NETWORK_ENDPOINTS.map((url) =>
          fetch(url, { method: 'GET', signal: control.signal, cache: 'no-store' }),
        ),
      )
      return true
    } catch {
      return false
    } finally {
      clearTimeout(giveUp)
    }
  }
}
