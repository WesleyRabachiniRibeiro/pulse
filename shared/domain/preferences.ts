import { z } from 'zod'

export const preferencesSchema = z.object({
  drive: z.string().optional(),
  tourSeen: z.boolean().optional(),
})
export type Preferences = z.infer<typeof preferencesSchema>

export const EMPTY_PREFERENCES: Preferences = {}
