import { register } from '../../ipc/register'
import { readTweaks, writeTweak } from './windows.service'

export function registerWindows(): void {
  register('windows:tweaks', () => readTweaks())
  register('windows:setTweak', (input) => writeTweak(input.id, input.on))
}
