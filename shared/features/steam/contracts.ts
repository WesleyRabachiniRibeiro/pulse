import { z } from 'zod'
import { steamGameSchema, steamLibrarySchema, steamSearchInputSchema } from '../../domain/steam'

export const steamContracts = {
  'steam:library': {
    input: z.void(),
    output: steamLibrarySchema,
  },
  'steam:search': {
    input: steamSearchInputSchema,
    output: z.array(steamGameSchema),
  },
} as const
