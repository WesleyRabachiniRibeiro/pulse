import { register } from '../../ipc/register'
import { cancelRestart, restart } from './system.service'
import { readTweaks, writeTweak } from './windows.service'

export function registerSystem(): void {
  register('system:restart', () => restart())
  register('system:cancelRestart', () => cancelRestart())
  register('windows:tweaks', () => readTweaks())
  register('windows:setTweak', (input) => writeTweak(input.id, input.on))
}
