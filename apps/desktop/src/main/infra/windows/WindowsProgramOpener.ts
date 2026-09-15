import { shell } from 'electron'
import type { Program } from '@pulse/domain'
import type { PowerShellRunner } from '../../ports/powershell-runner'
import type { ProgramOpener } from '../../ports/program-opener'

const SCRIPT_TIMEOUT_MS = 25_000

interface Found {
  found: { id: string; path: string }[]
}

export class WindowsProgramOpener implements ProgramOpener {
  constructor(private readonly powershell: PowerShellRunner) {}

  async find(programs: readonly Program[]): Promise<Record<string, string>> {
    const wanted = programs
      .filter((one) => one.hints.length > 0)
      .map((one) => ({ id: one.id, hints: [...one.hints] }))

    if (wanted.length === 0) return {}

    try {
      const { found } = await this.powershell.runJson<Found>(
        'Find-ProgramShortcut.ps1',
        { wanted },
        SCRIPT_TIMEOUT_MS,
      )
      return Object.fromEntries((found ?? []).map((one) => [one.id, one.path]))
    } catch {
      return {}
    }
  }

  // openPath devolve uma mensagem de erro quando falha, e string vazia quando
  // deu certo. Um atalho apagado desde a varredura cai aqui.
  async open(path: string): Promise<boolean> {
    const problem = await shell.openPath(path)
    return problem === ''
  }
}
