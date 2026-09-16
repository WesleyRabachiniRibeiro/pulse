import type { Program } from '@pulse/domain'
import type { PowerShellRunner } from '../../ports/powershell-runner'
import type { AutostartRegistry, AutostartResult } from '../../ports/autostart-registry'

const SCRIPT_TIMEOUT_MS = 25_000

export class WindowsAutostartRegistry implements AutostartRegistry {
  constructor(private readonly powershell: PowerShellRunner) {}

  async setAutostart(program: Program, on: boolean): Promise<AutostartResult> {
    try {
      const { result } = await this.powershell.runJson<{ result: AutostartResult }>(
        'Set-Autostart.ps1',
        { hints: [...program.hints], turnOn: on },
        SCRIPT_TIMEOUT_MS,
      )
      return result
    } catch {
      return 'no-entry'
    }
  }
}
