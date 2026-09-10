import { register } from '@main/core/ipc/register'
import { readPreferences, writePreferences } from './preferences.service'

export function registerPreferences(): void {
  register('prefs:read', () => readPreferences())
  register('prefs:write', (input) => writePreferences(input))
}
