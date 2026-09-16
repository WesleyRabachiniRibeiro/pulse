import type { Preferences } from '@pulse/domain'
import type { PreferencesStore } from '../../ports/preferences-store'

export class PreferencesService {
  constructor(private readonly store: PreferencesStore) {}

  read(): Promise<Preferences> {
    return this.store.read()
  }

  write(patch: Preferences): Promise<Preferences> {
    return this.store.write(patch)
  }
}
