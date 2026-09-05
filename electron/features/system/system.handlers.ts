import { register } from '../../ipc/register'
import { cancelRestart, restart } from './system.service'

export function registerSystem(): void {
  register('system:restart', () => restart())
  register('system:cancelRestart', () => cancelRestart())
}
