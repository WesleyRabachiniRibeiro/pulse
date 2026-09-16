import { register } from './register'
import type { PreferencesService } from '../application/preferences/PreferencesService'
import type { ReadGitConfig } from '../application/git/ReadGitConfig'

export function registerPreferences(
  preferencesService: PreferencesService,
  readGitConfig: ReadGitConfig,
): void {
  register('prefs:read', () => preferencesService.read())
  register('prefs:write', (input) => preferencesService.write(input))
  register('git:config', () => readGitConfig.run())
}
