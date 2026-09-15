import { z } from 'zod'
import { parentalSchema } from './parental'
import { defaultsSchema } from './defaults'

export const preferencesSchema = z.object({
  drive: z.string().optional(),
  tourSeen: z.boolean().optional(),
  parental: parentalSchema.optional(),
  defaults: defaultsSchema.optional(),
  profileFolder: z.string().optional(),
})
export type Preferences = z.infer<typeof preferencesSchema>

export const EMPTY_PREFERENCES: Preferences = {}
