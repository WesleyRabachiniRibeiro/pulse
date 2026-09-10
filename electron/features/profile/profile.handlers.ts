import { register } from '../../ipc/register'
import { readProfile, writeProfile } from './profile.service'
import {
  exportProfile,
  importFromLink,
  importProfile,
  listFolders,
  pickFolder,
} from './portable.service'

export function registerProfile(): void {
  register('profile:read', () => readProfile())
  register('profile:write', (input) => writeProfile(input))
  register('profile:export', (input) => exportProfile(input.format, input.ids))
  register('profile:import', (input) => importProfile(input.mode))
  register('profile:importLink', (input) => importFromLink(input.url, input.mode))
  register('profile:folders', () => listFolders())
  register('profile:pickFolder', () => pickFolder())
}
