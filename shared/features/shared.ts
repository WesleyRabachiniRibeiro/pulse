import { z } from 'zod'

export const freshInputSchema = z.object({
  fresh: z.boolean().optional(),
})
export type FreshInput = z.infer<typeof freshInputSchema>

export const copyInputSchema = z.object({
  text: z.string(),
})
export type CopyInput = z.infer<typeof copyInputSchema>
