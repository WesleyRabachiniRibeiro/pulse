import { execFile } from 'node:child_process'
import { SECONDS_UNTIL_RESTART } from '@shared/domain/system'

export function restart(): void {
  execFile(
    'shutdown',
    [
      '/r',
      '/t',
      String(SECONDS_UNTIL_RESTART),
      '/c',
      'Pulse: reiniciando para terminar as instalações.',
    ],
    { windowsHide: true },
    () => {
    },
  )
}

export function cancelRestart(): void {
  execFile('shutdown', ['/a'], { windowsHide: true }, () => {})
}
