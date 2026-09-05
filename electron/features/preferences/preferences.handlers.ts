import { register } from '../../ipc/register'
import { readPreferences, writePreferences } from './preferences.service'
import { readGitConfig } from '../git/git.service'

export function registerPreferences(): void {
  register('prefs:read', () => readPreferences())
  register('prefs:write', (input) => writePreferences(input))
  register('git:config', () => readGitConfig())
}
