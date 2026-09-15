import type { Program } from '@pulse/domain'
import type { PowerShellRunner } from '../../ports/powershell-runner'
import type { DesktopShortcut, ShortcutResult } from '../../ports/desktop-shortcut'

const SCRIPT_TIMEOUT_MS = 25_000

export class WindowsDesktopShortcut implements DesktopShortcut {
  constructor(private readonly powershell: PowerShellRunner) {}

  async setShortcut(program: Program, on: boolean): Promise<ShortcutResult> {
    try {
      const { result } = await this.powershell.runJson<{ result: ShortcutResult }>(
        'Set-DesktopShortcut.ps1',
        { hints: [...program.hints], turnOn: on },
        SCRIPT_TIMEOUT_MS,
      )
      return result
    } catch {
      return 'not-found'
    }
  }
}
