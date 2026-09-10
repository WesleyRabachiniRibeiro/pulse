import { z } from 'zod'
import { driveSchema, preflightInputSchema, preflightSchema } from '../../domain/preflight'
import { freshInputSchema } from '../shared'

export const preflightContracts = {
  'preflight:drives': {
    input: freshInputSchema,
    output: z.array(driveSchema),
  },
  'preflight:run': {
    input: preflightInputSchema,
    output: preflightSchema,
  },
} as const
