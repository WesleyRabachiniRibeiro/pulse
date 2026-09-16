import { z } from 'zod'

export const startupEntrySchema = z.object({
  name: z.string(),
  value: z.string(),
  enabled: z.boolean(),
  programId: z.string().optional(),
})
export type StartupEntry = z.infer<typeof startupEntrySchema>

export const startupInputSchema = z.object({
  name: z.string().min(1),
  on: z.boolean(),
})
export type StartupInput = z.infer<typeof startupInputSchema>
