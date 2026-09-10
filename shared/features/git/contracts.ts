import { z } from 'zod'
import { gitSchema } from '../../domain/git'

export const gitContracts = {
  'git:config': {
    input: z.void(),
    output: gitSchema,
  },
} as const
