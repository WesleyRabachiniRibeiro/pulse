import { z } from 'zod'

export type { CategoryId, Category, SettingsKind, Program, Bundle } from '@pulse/catalog-data'
export { CATEGORIES, CATALOG, PROGRAM_BY_ID, BUNDLES } from '@pulse/catalog-data'

export const packageVersionSchema = z.object({
  winget: z.string(),
  name: z.string(),
  version: z.string(),
  recommended: z.boolean(),
})
export type PackageVersion = z.infer<typeof packageVersionSchema>

export const upgradeSchema = z.object({
  wingetId: z.string(),
  name: z.string(),
  current: z.string(),
  available: z.string(),
  programId: z.string().optional(),
})
export type Upgrade = z.infer<typeof upgradeSchema>
