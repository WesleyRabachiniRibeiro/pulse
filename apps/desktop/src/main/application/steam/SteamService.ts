import type { SteamGame, SteamLibrary } from '@pulse/domain'
import type { SteamLibraryReader } from '../../ports/steam-library-reader'

export class SteamService {
  constructor(private readonly libraryReader: SteamLibraryReader) {}

  readLibrary(): Promise<SteamLibrary> {
    return this.libraryReader.readLibrary()
  }

  search(term: string): Promise<SteamGame[]> {
    return this.libraryReader.search(term)
  }
}
