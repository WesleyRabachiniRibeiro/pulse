import { z } from 'zod'

export const updateStatusSchema = z.enum([
  'idle',
  'checking',
  'downloading',
  'ready',
  'error',
])
export type UpdateStatus = z.infer<typeof updateStatusSchema>

export const updateStateSchema = z.object({
  status: updateStatusSchema,
  version: z.string().nullable(),
  percent: z.number(),
  message: z.string().nullable(),
  blocked: z.boolean(),
})
export type UpdateState = z.infer<typeof updateStateSchema>

export const EMPTY_UPDATE: UpdateState = {
  status: 'idle',
  version: null,
  percent: 0,
  message: null,
  blocked: false,
}
