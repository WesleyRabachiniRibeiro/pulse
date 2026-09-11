import { register } from './register'
import type { SystemService } from '../application/system/SystemService'

export function registerSystem(systemService: SystemService): void {
  register('system:restart', () => systemService.restart())
  register('system:cancelRestart', () => systemService.cancelRestart())
}
