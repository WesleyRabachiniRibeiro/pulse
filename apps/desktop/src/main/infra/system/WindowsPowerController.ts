import { SECONDS_UNTIL_RESTART } from '@pulse/domain'
import type { ProcessRunner } from '../../ports/process-runner'
import type { PowerController } from '../../ports/power-controller'

export class WindowsPowerController implements PowerController {
  constructor(private readonly processRunner: ProcessRunner) {}

  async restart(): Promise<void> {
    await this.processRunner.runOnce('shutdown', [
      '/r',
      '/t',
      String(SECONDS_UNTIL_RESTART),
      '/c',
      'Pulse: reiniciando para terminar as instalações.',
    ])
  }

  async cancelRestart(): Promise<void> {
    await this.processRunner.runOnce('shutdown', ['/a'])
  }
}
