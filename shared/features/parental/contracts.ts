import { z } from 'zod'

export const parentalViewSchema = z.object({
  on: z.boolean(),
  hasPin: z.boolean(),
  blocked: z.array(z.string()),
})

export const pinResultSchema = z.object({
  ok: z.boolean(),
  view: parentalViewSchema.optional(),
})

export const parentalContracts = {
  'parental:read': {
    input: z.void(),
    output: parentalViewSchema,
  },
  'parental:turnOn': {
    input: z.object({ pin: z.string() }),
    output: pinResultSchema,
  },
  'parental:turnOff': {
    input: z.object({ pin: z.string() }),
    output: pinResultSchema,
  },
  'parental:change': {
    input: z.object({ current: z.string(), next: z.string() }),
    output: pinResultSchema,
  },
  'parental:check': {
    input: z.object({ pin: z.string() }),
    output: z.boolean(),
  },
  'parental:allowOnce': {
    input: z.object({ pin: z.string(), id: z.string() }),
    output: z.boolean(),
  },
  'parental:setBlocked': {
    input: z.object({ ids: z.array(z.string()) }),
    output: parentalViewSchema,
  },
} as const
