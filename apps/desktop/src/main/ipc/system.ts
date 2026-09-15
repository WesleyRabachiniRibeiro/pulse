import { register } from './register'
import type { SystemService } from '../application/system/SystemService'

export function registerSystem(systemService: SystemService): void {
  register('system:restart', () => systemService.restart())
  register('system:cancelRestart', () => systemService.cancelRestart())
  register('system:copy', (input) => systemService.copy(input.text))
  register('system:icon', (input) => systemService.readIcon(input.path))
  register('system:openFamily', () => systemService.openFamilySettings())
  register('system:tweaks', async () => [...(await systemService.readTweaks())])
  register('system:setTweak', async (input) => [
    ...(await systemService.setTweak(input.id, input.on)),
  ])
}
