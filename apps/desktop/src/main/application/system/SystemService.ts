import type { TweakState } from '@pulse/domain'
import type { PowerController } from '../../ports/power-controller'
import type { ClipboardWriter } from '../../ports/clipboard-writer'
import type { IconReader } from '../../ports/icon-reader'
import type { WindowsSettings } from '../../ports/windows-settings'
import type { WindowsTweaks } from '../../ports/windows-tweaks'

export class SystemService {
  constructor(
    private readonly powerController: PowerController,
    private readonly tweaks: WindowsTweaks,
    private readonly settings: WindowsSettings,
    private readonly icons: IconReader,
    private readonly clipboard: ClipboardWriter,
  ) {}

  restart(): Promise<void> {
    return this.powerController.restart()
  }

  cancelRestart(): Promise<void> {
    return this.powerController.cancelRestart()
  }

  openFamilySettings(): Promise<void> {
    return this.settings.openFamily()
  }

  copy(text: string): void {
    this.clipboard.writeText(text)
  }

  readIcon(path: string): Promise<string | null> {
    return this.icons.read(path)
  }

  readTweaks(): Promise<readonly TweakState[]> {
    return this.tweaks.read()
  }

  setTweak(id: string, on: boolean): Promise<readonly TweakState[]> {
    return this.tweaks.write(id, on)
  }
}
