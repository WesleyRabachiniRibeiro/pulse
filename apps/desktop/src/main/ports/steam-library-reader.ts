import type { SteamGame, SteamLibrary } from '@pulse/domain'

export interface SteamLibraryReader {
  readLibrary(): Promise<SteamLibrary>
  search(term: string): Promise<SteamGame[]>
}
