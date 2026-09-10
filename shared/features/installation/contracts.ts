import { z } from 'zod'
import { idInputSchema, requestsInputSchema, runSchema, startInputSchema } from '../../domain/installation'
import { historySchema } from '../../domain/history'

export const REFUSALS = ['one-blocked', 'all-blocked', 'needs-pin'] as const
export const refusalSchema = z.enum(REFUSALS)
export type Refusal = z.infer<typeof refusalSchema>

const queueResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), run: runSchema.nullable() }),
  z.object({ ok: z.literal(false), refused: refusalSchema }),
])

export const installationContracts = {
  'installation:start': {
    input: startInputSchema,
    output: queueResultSchema,
  },
  'installation:append': {
    input: requestsInputSchema,
    output: queueResultSchema,
  },
  'installation:state': {
    input: z.void(),
    output: runSchema.nullable(),
  },
  'installation:cancel': {
    input: z.void(),
    output: z.void(),
  },
  'installation:cancelItem': {
    input: idInputSchema,
    output: z.void(),
  },
  'installation:retry': {
    input: idInputSchema,
    output: z.void(),
  },
  'installation:grant': {
    input: idInputSchema,
    output: z.void(),
  },
  'installation:open': {
    input: idInputSchema,
    output: z.enum(['opened', 'not-found', 'failed']),
  },
  'installation:openable': {
    input: z.void(),
    output: z.array(z.string()),
  },
  'installation:mayInstall': {
    input: idInputSchema,
    output: z.boolean(),
  },
  'installation:uninstall': {
    input: idInputSchema,
    output: z.object({
      ok: z.boolean(),
      verified: z.boolean(),
      error: z.string().optional(),
      refused: refusalSchema.optional(),
    }),
  },
  'history:read': {
    input: z.void(),
    output: historySchema,
  },
} as const

export const installationEvents = {
  'installation:event': runSchema,
} as const
