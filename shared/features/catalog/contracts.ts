import { z } from 'zod'
import {
  catalogStateSchema,
  packageVersionSchema,
  runtimeCatalogSchema,
} from '../../domain/catalog'
import { idInputSchema } from '../../domain/installation'
import { inventorySchema } from '../../domain/inventory'
import { startupEntrySchema, startupInputSchema } from '../../domain/windows'
import { freshInputSchema } from '../shared'

export const catalogContracts = {
  'catalog:list': {
    input: z.void(),
    output: runtimeCatalogSchema,
  },
  'catalog:state': {
    input: z.void(),
    output: catalogStateSchema,
  },
  'catalog:retry': {
    input: z.void(),
    output: catalogStateSchema,
  },
  'catalog:installed': {
    input: freshInputSchema,
    output: z.array(z.string()),
  },
  'catalog:inventory': {
    input: freshInputSchema,
    output: inventorySchema,
  },
  'catalog:add': {
    input: z.object({
      name: z.string().min(1),
      version: z.string().optional(),
      icon: z.string().optional(),
    }),
    output: z.object({
      status: z.enum(['added', 'exists', 'not-found', 'failed']),
      id: z.string().optional(),
    }),
  },
  'catalog:mine': {
    input: z.void(),
    output: z.array(z.string()),
  },
  'catalog:remove': {
    input: z.object({ id: z.string().min(1) }),
    output: z.boolean(),
  },
  'catalog:startup': {
    input: z.void(),
    output: z.array(startupEntrySchema),
  },
  'catalog:setStartup': {
    input: startupInputSchema,
    output: z.array(startupEntrySchema),
  },
  'catalog:autostart': {
    input: z.void(),
    output: z.array(z.object({ id: z.string(), state: z.enum(['on', 'off']) })),
  },
  'catalog:versions': {
    input: idInputSchema,
    output: z.array(packageVersionSchema),
  },
} as const

export const catalogEvents = {
  'catalog:event': runtimeCatalogSchema,
} as const
