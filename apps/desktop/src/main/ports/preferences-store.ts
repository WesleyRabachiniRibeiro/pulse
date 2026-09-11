import type { Preferences } from '@pulse/domain'

export interface PreferencesStore {
  read(): Promise<Preferences>
  write(patch: Preferences): Promise<Preferences>
}
