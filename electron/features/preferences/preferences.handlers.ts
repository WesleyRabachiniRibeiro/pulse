import { register } from '../../ipc/register'
import { readPreferences, writePreferences } from './preferences.service'
import { readProfile, writeProfile } from './profile.service'
import { readGitConfig } from '../git/git.service'
import {
  exportProfile,
  importFromLink,
  importProfile,
  listFolders,
  pickFolder,
} from './portable.service'

export function registerPreferences(): void {
  register('prefs:read', () => readPreferences())
  register('prefs:write', (input) => writePreferences(input))
  register('profile:read', () => readProfile())
  register('profile:write', (input) => writeProfile(input))
  register('profile:export', (input) => exportProfile(input.format, input.ids))
  register('profile:import', (input) => importProfile(input.mode))
  register('profile:importLink', (input) => importFromLink(input.url, input.mode))
  register('profile:folders', () => listFolders())
  register('profile:pickFolder', () => pickFolder())
  register('git:config', () => readGitConfig())
}
