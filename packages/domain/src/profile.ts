import { z } from 'zod'
import { settingsSchema } from './settings'

export const profileSchema = z.object({
  selected: z.array(z.string()),
  drives: z.record(z.string(), z.string()),
  settings: z.record(z.string(), settingsSchema),
})
export type Profile = z.infer<typeof profileSchema>

export const EMPTY_PROFILE: Profile = { selected: [], drives: {}, settings: {} }
