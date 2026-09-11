import { register } from './register'
import type { SteamService } from '../application/steam/SteamService'

export function registerSteam(steamService: SteamService): void {
  register('steam:library', () => steamService.readLibrary())
  register('steam:search', (input) => steamService.search(input.term))
}
