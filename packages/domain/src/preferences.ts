import { z } from 'zod'
import { parentalSchema } from './parental'

export const preferencesSchema = z.object({
  drive: z.string().optional(),
  tourSeen: z.boolean().optional(),
  parental: parentalSchema.optional(),
})
export type Preferences = z.infer<typeof preferencesSchema>

export const EMPTY_PREFERENCES: Preferences = {}
