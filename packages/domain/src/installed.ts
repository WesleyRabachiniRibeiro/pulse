import { z } from 'zod'

export const registryEntrySchema = z.object({
  key: z.string(),
  name: z.string(),
  publisher: z.string().optional(),
  version: z.string().optional(),
  system: z.boolean().optional(),
  location: z.string().optional(),
  icon: z.string().optional(),
  uninstall: z.string().optional(),
})
export type RegistryEntry = z.infer<typeof registryEntrySchema>

export const hiddenReasonSchema = z.enum(['system', 'update', 'locked'])
export type HiddenReason = z.infer<typeof hiddenReasonSchema>

// 'owner' é o programa que hospeda outros na mesma pasta; 'family' agrupa
// versões diferentes do mesmo produto.
export const nodeKindSchema = z.enum(['app', 'owner', 'family'])
export type NodeKind = z.infer<typeof nodeKindSchema>

export interface InstalledNode {
  key: string
  name: string
  kind: NodeKind
  publisher?: string
  version?: string
  programId?: string
  wingetId?: string
  icon?: string
  children: InstalledNode[]
}

const nodeBase = z.object({
  key: z.string(),
  name: z.string(),
  kind: nodeKindSchema,
  publisher: z.string().optional(),
  version: z.string().optional(),
  programId: z.string().optional(),
  wingetId: z.string().optional(),
  icon: z.string().optional(),
})

export const installedNodeSchema: z.ZodType<InstalledNode> = nodeBase.extend({
  children: z.lazy(() => z.array(installedNodeSchema)),
})

export const installedTreeSchema = z.object({
  nodes: z.array(installedNodeSchema),
  hidden: z.number(),
})
export type InstalledTree = z.infer<typeof installedTreeSchema>

export const INSTALLED_FILTERS = ['all', 'pulse', 'stranger'] as const
export type InstalledFilter = (typeof INSTALLED_FILTERS)[number]
