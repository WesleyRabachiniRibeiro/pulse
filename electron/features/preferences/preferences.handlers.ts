import { register } from '../../ipc/register'
import { readPreferences, writePreferences } from './preferences.service'
import { readProfile, writeProfile } from './profile.service'
import { readGitConfig } from '../git/git.service'
import {
  allowOnce,
  changePin,
  checkPin,
  setBlocked,
  turnOff,
  turnOn,
  viewParental,
} from './parental.service'
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
  register('parental:read', () => viewParental())
  register('parental:turnOn', (input) => turnOn(input.pin))
  register('parental:turnOff', (input) => turnOff(input.pin))
  register('parental:change', (input) => changePin(input.current, input.next))
  register('parental:check', (input) => checkPin(input.pin))
  register('parental:allowOnce', (input) => allowOnce(input.pin, input.id))
  register('parental:setBlocked', (input) => setBlocked(input.ids))
  register('git:config', () => readGitConfig())
}
