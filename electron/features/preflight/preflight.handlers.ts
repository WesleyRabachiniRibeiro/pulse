import { register } from '../../ipc/register'
import { listDrives, runPreflight } from './preflight.service'

export function registerPreflight(): void {
  register('preflight:drives', () => listDrives())
  register('preflight:run', (input) => runPreflight(input))
}
