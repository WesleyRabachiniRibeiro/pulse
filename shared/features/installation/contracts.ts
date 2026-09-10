import { z } from 'zod'
import { idInputSchema, requestsInputSchema, runSchema, startInputSchema } from '../../domain/installation'
import { historySchema } from '../../domain/history'

export const installationContracts = {
  'installation:start': {
    input: startInputSchema,
    output: runSchema,
  },
  'installation:append': {
    input: requestsInputSchema,
    output: runSchema.nullable(),
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
