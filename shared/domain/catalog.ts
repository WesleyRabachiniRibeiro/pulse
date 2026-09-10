import { z } from 'zod'
import { settingsKindSchema } from './settings'

export type CategoryId = string

export const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
})
export type Category = z.infer<typeof categorySchema>

export const programSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  winget: z.string().min(1).optional(),
  source: z.enum(['msstore', 'pages']).optional(),
  version: z.string(),
  mb: z.number().min(0),
  category: z.string().min(1),
  hints: z.array(z.string()),
  notice: z.string().optional(),
  icon: z.string().optional(),
  settingsKind: settingsKindSchema.optional(),
  family: z
    .object({
      prefix: z.string().min(1),
      pattern: z.string().min(1),
    })
    .optional(),
})
export type Program = z.infer<typeof programSchema>

export const bundleSchema = z.object({
  name: z.string().min(1),
  ids: z.array(z.string()),
})
export type Bundle = z.infer<typeof bundleSchema>

export const CATALOG_VERSION = 1

export const catalogSchema = z.object({
  version: z.literal(CATALOG_VERSION),
  categories: z.array(categorySchema).min(1),
  programs: z.array(programSchema).min(1),
  bundles: z.array(bundleSchema).optional(),
})
export type Catalog = z.infer<typeof catalogSchema>

export const runtimeCatalogSchema = z.object({
  version: z.literal(CATALOG_VERSION),
  categories: z.array(categorySchema),
  programs: z.array(programSchema),
  bundles: z.array(bundleSchema).optional(),
})

export const catalogSourceSchema = z.enum(['none', 'cache', 'network'])
export type CatalogSource = z.infer<typeof catalogSourceSchema>

export const catalogStateSchema = z.object({
  source: catalogSourceSchema,
  checkedAt: z.string().nullable(),
  programs: z.number(),
})
export type CatalogState = z.infer<typeof catalogStateSchema>

export const packageVersionSchema = z.object({
  winget: z.string(),
  name: z.string(),
  version: z.string(),
  recommended: z.boolean(),
})
export type PackageVersion = z.infer<typeof packageVersionSchema>

export function compareVersions(a: PackageVersion, b: PackageVersion): number {
  const key = ({ winget, version }: PackageVersion): number[] => {
    if (winget.toUpperCase().endsWith('.LTS')) return [Number.MAX_SAFE_INTEGER]
    const fromId = winget.match(/\d+/g)
    return (fromId ?? version.match(/\d+/g) ?? ['0']).map(Number)
  }

  const na = key(a)
  const nb = key(b)

  for (let i = 0; i < Math.max(na.length, nb.length); i++) {
    const difference = (na[i] ?? 0) - (nb[i] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

export function sortVersions(versions: readonly PackageVersion[]): PackageVersion[] {
  return [...versions].sort((a, b) => compareVersions(b, a))
}

const UNKNOWN_VERSIONS = ['unknown', 'desconhecido', 'desconhecida']

export function readVersionFromSearch(output: string, wingetId: string): string | null {
  const wanted = wingetId.toLowerCase()

  for (const line of output.split(/\r?\n/)) {
    const tokens = line.trim().split(/\s+/)
    const position = tokens.findIndex((t) => t.toLowerCase() === wanted)
    if (position <= 0) continue

    const version = tokens[position + 1]
    if (!version || UNKNOWN_VERSIONS.includes(version.toLowerCase())) return null
    return version
  }

  return null
}

export const EMPTY_CATALOG: Catalog = {
  version: CATALOG_VERSION,
  categories: [],
  programs: [],
  bundles: [],
}

export const EVERYTHING_BUNDLE = 'Tudo'

interface Registry {
  catalog: Catalog
  byId: Map<string, Program>
  bundles: readonly Bundle[]
}

function build(catalog: Catalog): Registry {
  const programs = catalog.programs.filter((p) =>
    catalog.categories.some((c) => c.id === p.category),
  )
  const byId = new Map(programs.map((p) => [p.id, p]))

  const known = (id: string): boolean => byId.has(id)
  const listed = (catalog.bundles ?? [])
    .filter((b) => b.name !== EVERYTHING_BUNDLE)
    .map((b) => ({ name: b.name, ids: b.ids.filter(known) }))
    .filter((b) => b.ids.length > 0)

  return {
    catalog: { ...catalog, programs },
    byId,
    bundles: [...listed, { name: EVERYTHING_BUNDLE, ids: programs.map((p) => p.id) }],
  }
}

let registry = build(EMPTY_CATALOG)

export function setCatalog(catalog: Catalog): void {
  registry = build(catalog)
}

export function resetCatalog(): void {
  registry = build(EMPTY_CATALOG)
}

export function catalogIsEmpty(): boolean {
  return registry.catalog.programs.length === 0
}

export function getCatalog(): Catalog {
  return registry.catalog
}

export function getPrograms(): readonly Program[] {
  return registry.catalog.programs
}

export function getCategories(): readonly Category[] {
  return registry.catalog.categories
}

export function getBundles(): readonly Bundle[] {
  return registry.bundles
}

export function getProgram(id: string): Program | undefined {
  return registry.byId.get(id)
}

export function hasProgram(id: string): boolean {
  return registry.byId.has(id)
}

export function formatMb(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`
  }
  return `${mb.toLocaleString('pt-BR')} MB`
}

export function totalSizeMb(ids: Iterable<string>): number {
  let total = 0
  for (const id of ids) total += getProgram(id)?.mb ?? 0
  return total
}

export function estimatedMinutes(mb: number): number {
  return Math.max(2, Math.round(mb / 90))
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function filterCatalog(term: string): readonly Program[] {
  const needle = normalize(term.trim())
  const programs = getPrograms()
  if (!needle) return programs

  const categoryNames = new Map(getCategories().map((c) => [c.id, normalize(c.name)]))
  return programs.filter(
    (p) =>
      normalize(p.name).includes(needle) ||
      (categoryNames.get(p.category) ?? '').includes(needle),
  )
}

const SEPARATORS = [' ', '(', '-', '.', ',']

function hintMatches(name: string, hint: string): boolean {
  if (!name.startsWith(hint)) return false
  const next = name[hint.length]
  return next === undefined || SEPARATORS.includes(next)
}

export function nameMatchesProgram(installedName: string, program: Program): boolean {
  const name = normalize(installedName.trim())
  return program.hints.some((hint) => hintMatches(name, hint))
}

export function entryMatchesProgram(entryName: string, entryValue: string, program: Program): boolean {
  const target = `${entryName} ${entryValue}`.toLowerCase()
  const tight = target.replace(/[^a-z0-9]/g, '')

  return program.hints.some((raw) => {
    const hint = raw.toLowerCase()
    if (target.includes(hint)) return true
    if (!hint.trim().includes(' ')) return false
    return tight.includes(hint.replace(/[^a-z0-9]/g, ''))
  })
}

export function installedIds(installedNames: readonly string[]): string[] {
  const found = new Set<string>()

  for (const raw of installedNames) {
    const name = normalize(raw.trim())
    let longest = 0
    let owners: string[] = []

    for (const program of getPrograms()) {
      for (const hint of program.hints) {
        if (!hintMatches(name, hint)) continue
        if (hint.length > longest) {
          longest = hint.length
          owners = [program.id]
        } else if (hint.length === longest) {
          owners.push(program.id)
        }
      }
    }

    for (const owner of owners) found.add(owner)
  }

  return getPrograms().filter((p) => found.has(p.id)).map((p) => p.id)
}

export interface CategoryGroup {
  category: Category
  programs: readonly Program[]
}

export function groupByCategory(programs: readonly Program[]): readonly CategoryGroup[] {
  return getCategories().map((category) => ({
    category,
    programs: programs
      .filter((p) => p.category === category.id)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })),
  })).filter((g) => g.programs.length > 0)
}

export function bundleIsActive(
  bundle: Bundle,
  selected: ReadonlySet<string>,
  ignore: ReadonlySet<string> = new Set(),
): boolean {
  const ids = bundle.ids.filter((id) => !ignore.has(id))
  if (ids.length === 0) return false
  return ids.length === selected.size && ids.every((id) => selected.has(id))
}
