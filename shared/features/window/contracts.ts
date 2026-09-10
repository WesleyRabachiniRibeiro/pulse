import { z } from 'zod'

export const windowContracts = {
  'window:minimize': {
    input: z.void(),
    output: z.void(),
  },
  'window:toggleMaximize': {
    input: z.void(),
    output: z.boolean(),
  },
  'window:close': {
    input: z.void(),
    output: z.void(),
  },
} as const
