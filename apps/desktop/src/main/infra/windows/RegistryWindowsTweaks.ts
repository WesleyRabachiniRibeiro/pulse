import {
  readTweakState,
  TWEAK_BY_ID,
  TWEAKS,
  tweaksTouchingExplorer,
  valueIdOf,
  type TweakState,
  type TweakValue,
} from '@pulse/domain'
import type { ProcessRunner } from '../../ports/process-runner'
import type { PowerShellRunner } from '../../ports/powershell-runner'
import type { WindowsTweaks } from '../../ports/windows-tweaks'

const DWORD = /REG_DWORD\s+0x([0-9a-f]+)/i

export class RegistryWindowsTweaks implements WindowsTweaks {
  constructor(
    private readonly processRunner: ProcessRunner,
    private readonly powershell: PowerShellRunner,
  ) {}

  async read(): Promise<readonly TweakState[]> {
    const wanted = new Map<string, TweakValue>()
    for (const tweak of TWEAKS) {
      for (const value of tweak.values) wanted.set(valueIdOf(value), value)
    }

    const found = new Map<string, number>()
    await Promise.all(
      [...wanted].map(async ([id, value]) => {
        const current = await this.readValue(value)
        if (current !== null) found.set(id, current)
      }),
    )

    return TWEAKS.map((tweak) => ({ id: tweak.id, on: readTweakState(tweak, found) }))
  }

  async write(id: string, on: boolean): Promise<readonly TweakState[]> {
    const tweak = TWEAK_BY_ID.get(id)
    if (!tweak) return this.read()

    for (const value of tweak.values) {
      await this.writeValue(value, on ? value.on : value.off)
    }

    if (tweaksTouchingExplorer([id])) {
      await this.powershell
        .runJson<{ refreshed: boolean }>('Update-ExplorerView.ps1')
        .catch(() => undefined)
    }

    return this.read()
  }

  private async readValue(value: TweakValue): Promise<number | null> {
    const { text } = await this.processRunner.runOnce('reg', [
      'query',
      value.key,
      '/v',
      value.name,
    ])

    const found = DWORD.exec(text)
    return found?.[1] ? Number.parseInt(found[1], 16) : null
  }

  private async writeValue(value: TweakValue, to: number): Promise<void> {
    await this.processRunner.runOnce('reg', [
      'add',
      value.key,
      '/v',
      value.name,
      '/t',
      'REG_DWORD',
      '/d',
      String(to),
      '/f',
    ])
  }
}
