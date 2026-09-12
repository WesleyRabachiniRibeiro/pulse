import type { TweakState } from '@pulse/domain'
import type { PowerController } from '../../ports/power-controller'
import type { WindowsTweaks } from '../../ports/windows-tweaks'

export class SystemService {
  constructor(
    private readonly powerController: PowerController,
    private readonly tweaks: WindowsTweaks,
  ) {}

  restart(): Promise<void> {
    return this.powerController.restart()
  }

  cancelRestart(): Promise<void> {
    return this.powerController.cancelRestart()
  }

  readTweaks(): Promise<readonly TweakState[]> {
    return this.tweaks.read()
  }

  // Um ajuste que o registro recusou não vira erro na tela: a resposta é o
  // estado relido, então a tela mostra o que o Windows realmente tem.
  setTweak(id: string, on: boolean): Promise<readonly TweakState[]> {
    return this.tweaks.write(id, on)
  }
}
