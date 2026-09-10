import { z } from 'zod'
import { updateStateSchema } from '../../domain/update'

export const updateContracts = {
  'update:state': {
    input: z.void(),
    output: updateStateSchema,
  },
  'update:install': {
    input: z.void(),
    output: z.void(),
  },
} as const

export const updateEvents = {
  'update:event': updateStateSchema,
} as const
