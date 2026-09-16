import type { Bundle, Category, Program } from '@pulse/catalog-data'
import {
  CATALOG_VERSION,
  catalogPayloadSchema,
  MINE_CATEGORY,
  normalizeText,
  type Catalog,
  catalogOf,
  type CatalogPayload,
  type PackageVersion,
} from '@pulse/domain'

export const MB_PER_MINUTE = 90

export function sizeOf(catalog: Catalog, id: string, fallbackMb = 0): number {
  return catalog.byId.get(id)?.mb ?? fallbackMb
}

export function totalSizeMb(catalog: Catalog, ids: Iterable<string>): number {
  let total = 0
  for (const id of ids) total += sizeOf(catalog, id)
  return total
}

export function minutesFor(mb: number, floor = 2): number {
  return Math.max(floor, Math.round(mb / MB_PER_MINUTE))
}

export function estimatedMinutes(mb: number): number {
  return minutesFor(mb)
}

function versionKey({ winget, version }: PackageVersion): number[] {
  if (winget.toUpperCase().endsWith('.LTS')) return [Number.MAX_SAFE_INTEGER]
  const fromId = winget.match(/\d+/g)
  return (fromId ?? version.match(/\d+/g) ?? ['0']).map(Number)
}

export function compareVersions(a: PackageVersion, b: PackageVersion): number {
  const na = versionKey(a)
  const nb = versionKey(b)

  for (let i = 0; i < Math.max(na.length, nb.length); i++) {
    const difference = (na[i] ?? 0) - (nb[i] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

export function filterCatalog(catalog: Catalog, term: string): readonly Program[] {
  const needle = normalizeText(term.trim())
  if (!needle) return catalog.programs

  const categoryNames = new Map(catalog.categories.map((c) => [c.id, normalizeText(c.name)]))
  return catalog.programs.filter(
    (p) =>
      normalizeText(p.name).includes(needle) ||
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
  const name = normalizeText(installedName.trim())
  return program.hints.some((hint) => hintMatches(name, hint))
}

export function entryMatchesProgram(
  entryName: string,
  entryValue: string,
  program: Program,
): boolean {
  const target = `${entryName} ${entryValue}`.toLowerCase()
  const tight = target.replace(/[^a-z0-9]/g, '')

  return program.hints.some((raw) => {
    const hint = raw.toLowerCase()
    if (target.includes(hint)) return true
    if (!hint.trim().includes(' ')) return false
    return tight.includes(hint.replace(/[^a-z0-9]/g, ''))
  })
}

export function installedIds(catalog: Catalog, installedNames: readonly string[]): string[] {
  const found = new Set<string>()

  for (const raw of installedNames) {
    const name = normalizeText(raw.trim())
    let longest = 0
    let owners: string[] = []

    for (const program of catalog.programs) {
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

  return catalog.programs.filter((p) => found.has(p.id)).map((p) => p.id)
}

export interface CategoryGroup {
  category: Category
  programs: readonly Program[]
}

export function groupByCategory(
  catalog: Catalog,
  programs: readonly Program[],
): readonly CategoryGroup[] {
  return catalog.categories.map((category) => ({
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

export function readCatalogPayload(raw: unknown): CatalogPayload | null {
  const parsed = catalogPayloadSchema.safeParse(raw)
  if (!parsed.success) return null
  if (parsed.data.pulse !== CATALOG_VERSION) return null

  const ids = new Set<string>()
  for (const program of parsed.data.programs) {
    if (ids.has(program.id)) return null
    ids.add(program.id)

    if (!program.family) continue
    try {
      new RegExp(program.family.pattern)
    } catch {
      return null
    }
  }

  return parsed.data
}

export function withExtras(base: Catalog, extras: readonly Program[]): Catalog {
  const known = new Set(base.programs.map((program) => program.id))
  const mine = extras.filter((program) => !known.has(program.id))
  if (mine.length === 0) return base

  const categories = mine.some((program) => program.category === MINE_CATEGORY.id)
    ? [...base.categories, MINE_CATEGORY]
    : base.categories

  return catalogOf([...base.programs, ...mine], categories, base.bundles)
}
