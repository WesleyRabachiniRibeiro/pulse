import { EMPTY_PARENTAL, type Parental } from '@pulse/domain'
import type { ParentalStore } from '../../ports/parental-store'
import type { PreferencesStore } from '../../ports/preferences-store'

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
