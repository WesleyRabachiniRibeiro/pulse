import { z } from 'zod'
import { profileSchema } from '../../domain/profile'
import { EXPORT_FORMATS, IMPORT_MODES } from '../../domain/portable'

export const importResultSchema = z.object({
  status: z.enum(['imported', 'canceled', 'failed', 'invalid']),
  count: z.number().optional(),
  adopted: z.number().optional(),
  missing: z.array(z.string()).optional(),
})

export const profileContracts = {
  'profile:export': {
    input: z.object({
      format: z.enum(EXPORT_FORMATS),
      ids: z.array(z.string()).optional(),
    }),
    output: z.object({
      status: z.enum(['saved', 'canceled', 'failed']),
      path: z.string().optional(),
    }),
  },
  'profile:import': {
    input: z.object({ mode: z.enum(IMPORT_MODES) }),
    output: importResultSchema,
  },
  'profile:importLink': {
    input: z.object({ url: z.string(), mode: z.enum(IMPORT_MODES) }),
    output: importResultSchema,
  },
  'profile:folders': {
    input: z.void(),
    output: z.array(z.object({ path: z.string(), label: z.string() })),
  },
  'profile:pickFolder': {
    input: z.void(),
    output: z.string().nullable(),
  },
  'profile:read': {
    input: z.void(),
    output: profileSchema,
  },
  'profile:write': {
    input: profileSchema,
    output: profileSchema,
  },
} as const
