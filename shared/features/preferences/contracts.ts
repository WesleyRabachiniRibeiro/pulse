import { z } from 'zod'
import { preferencesSchema } from '../../domain/preferences'

export const preferencesContracts = {
  'prefs:read': {
    input: z.void(),
    output: preferencesSchema,
  },
  'prefs:write': {
    input: preferencesSchema,
    output: preferencesSchema,
  },
} as const
