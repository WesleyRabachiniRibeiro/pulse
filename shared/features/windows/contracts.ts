import { z } from 'zod'
import { tweakInputSchema, tweakStateSchema } from '../../domain/windows'

export const windowsContracts = {
  'windows:tweaks': {
    input: z.void(),
    output: z.array(tweakStateSchema),
  },
  'windows:setTweak': {
    input: tweakInputSchema,
    output: z.array(tweakStateSchema),
  },
} as const
