import { z } from 'zod'
import { settingsAreEmpty, settingsSchema, type Settings } from './settings'

export const profileSchema = z.object({
  selected: z.array(z.string()),
  drives: z.record(z.string(), z.string()),
  settings: z.record(z.string(), settingsSchema),
})
export type Profile = z.infer<typeof profileSchema>

export const EMPTY_PROFILE: Profile = { selected: [], drives: {}, settings: {} }

export function profileIsEmpty(profile: Profile): boolean {
  return (
    profile.selected.length === 0 &&
    Object.keys(profile.drives).length === 0 &&
    Object.keys(profile.settings).length === 0
  )
}

export function cleanProfile(profile: Profile, known: (id: string) => boolean): Profile {
  const settings: Record<string, Settings> = {}
  for (const [id, value] of Object.entries(profile.settings)) {
    if (known(id) && !settingsAreEmpty(value)) settings[id] = value
  }

  const drives: Record<string, string> = {}
  for (const [id, letter] of Object.entries(profile.drives)) {
    if (known(id) && letter.trim()) drives[id] = letter
  }

  return {
    selected: [...new Set(profile.selected.filter(known))],
    drives,
    settings,
  }
}
