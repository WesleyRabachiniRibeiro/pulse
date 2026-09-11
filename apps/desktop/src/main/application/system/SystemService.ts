import type { PowerController } from '../../ports/power-controller'

export class SystemService {
  constructor(private readonly powerController: PowerController) {}

  restart(): Promise<void> {
    return this.powerController.restart()
  }

  cancelRestart(): Promise<void> {
    return this.powerController.cancelRestart()
  }
}
