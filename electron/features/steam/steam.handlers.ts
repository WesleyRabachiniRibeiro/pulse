import { register } from '../../ipc/register'
import { readLibrary, searchSteam } from './steam.service'

export function registerSteam(): void {
  register('steam:library', () => readLibrary())
  register('steam:search', (input) => searchSteam(input.term))
}
