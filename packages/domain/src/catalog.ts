import { z } from 'zod'
import { BUNDLES, CATALOG, CATEGORIES } from '@pulse/catalog-data'
import type { Bundle, Category, Program } from '@pulse/catalog-data'

export type { CategoryId, Category, SettingsKind, Program, Bundle } from '@pulse/catalog-data'
export { CATEGORIES, CATALOG, PROGRAM_BY_ID, BUNDLES } from '@pulse/catalog-data'

// O catálogo passa a ser um valor que circula, em vez de constante que cada
// arquivo importa. Hoje só existe a semente; depois vem a versão remota e os
// programas que a pessoa adiciona, e nada disso muda quem consome.
export interface Catalog {
  categories: readonly Category[]
  programs: readonly Program[]
  bundles: readonly Bundle[]
  byId: ReadonlyMap<string, Program>
}

export function catalogOf(
  programs: readonly Program[],
  categories: readonly Category[],
  bundles: readonly Bundle[],
): Catalog {
  return {
    categories,
    programs,
    bundles,
    byId: new Map(programs.map((program) => [program.id, program])),
  }
}

export const SEED_CATALOG: Catalog = catalogOf(CATALOG, CATEGORIES, BUNDLES)

export const CATALOG_VERSION = 1

export const programSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  winget: z.string().optional(),
  source: z.enum(['msstore', 'pages']).optional(),
  version: z.string(),
  mb: z.number(),
  category: z.string(),
  hints: z.array(z.string()),
  notice: z.string().optional(),
  settingsKind: z.enum(['vscode', 'steam', 'git', 'tibia', 'riot', 'vs', 'browser']).optional(),
  steps: z.array(z.string()).optional(),
  family: z.object({ prefix: z.string(), pattern: z.string() }).optional(),
})

export const catalogPayloadSchema = z.object({
  pulse: z.number(),
  categories: z.array(z.object({ id: z.string(), name: z.string() })),
  programs: z.array(programSchema),
  bundles: z.array(z.object({ name: z.string(), ids: z.array(z.string()) })),
})
export type CatalogPayload = z.infer<typeof catalogPayloadSchema>

export const catalogSourceSchema = z.enum(['seed', 'cache', 'network'])
export type CatalogSource = z.infer<typeof catalogSourceSchema>

export const catalogStateSchema = z.object({
  source: catalogSourceSchema,
  checkedAt: z.string().nullable(),
  loading: z.boolean(),
})
export type CatalogState = z.infer<typeof catalogStateSchema>

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
