import { EMPTY_PARENTAL, type Parental } from '@pulse/domain'
import type { ParentalStore } from '../../ports/parental-store'
import type { PreferencesStore } from '../../ports/preferences-store'

// Mora junto das preferências porque é o mesmo ciclo de vida: um arquivo por
// usuário, lido na abertura e reescrito inteiro a cada mudança.
export class PreferencesParentalStore implements ParentalStore {
  constructor(private readonly preferences: PreferencesStore) {}

  async read(): Promise<Parental> {
    const prefs = await this.preferences.read()
    return prefs.parental ?? EMPTY_PARENTAL
  }

  async write(parental: Parental): Promise<void> {
    await this.preferences.write({ parental })
  }
}
