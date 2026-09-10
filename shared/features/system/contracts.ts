import { z } from 'zod'
import { copyInputSchema } from '../shared'

export const systemContracts = {
  'system:icon': {
    input: z.object({ path: z.string() }),
    output: z.string().nullable(),
  },
  'system:copy': {
    input: copyInputSchema,
    output: z.void(),
  },
  'system:openFamily': {
    input: z.void(),
    output: z.void(),
  },
  'system:restart': {
    input: z.void(),
    output: z.void(),
  },
  'system:cancelRestart': {
    input: z.void(),
    output: z.void(),
  },
} as const
