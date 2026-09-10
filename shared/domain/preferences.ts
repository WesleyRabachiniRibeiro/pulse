import { z } from 'zod'
import { defaultsSchema, EMPTY_DEFAULTS } from './defaults'
import { parentalSchema } from './parental'

export const preferencesSchema = z.object({
  drive: z.string().optional(),
  tourSeen: z.boolean().optional(),
  defaults: defaultsSchema.optional(),
  profileFolder: z.string().optional(),
  parental: parentalSchema.optional(),
})
export type Preferences = z.infer<typeof preferencesSchema>

export const EMPTY_PREFERENCES: Preferences = {}

export function defaultsOf(preferences: Preferences): typeof EMPTY_DEFAULTS {
  return preferences.defaults ?? EMPTY_DEFAULTS
}
