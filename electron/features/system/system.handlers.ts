import { clipboard, shell } from 'electron'
import { register } from '../../ipc/register'
import { cancelRestart, restart } from './system.service'
import { readFileIcon } from './icon.service'
import { readTweaks, writeTweak } from './windows.service'

export function registerSystem(): void {
  register('system:icon', (input) => readFileIcon(input.path))
  register('system:copy', (input) => {
    clipboard.writeText(input.text)
  })
  register('system:openFamily', () => {
    void shell.openExternal('ms-settings:otherusers')
  })
  register('system:restart', () => restart())
  register('system:cancelRestart', () => cancelRestart())
  register('windows:tweaks', () => readTweaks())
  register('windows:setTweak', (input) => writeTweak(input.id, input.on))
}
