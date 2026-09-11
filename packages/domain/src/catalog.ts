import { z } from 'zod'
import { CATALOG, CATEGORIES, PROGRAM_BY_ID } from '@pulse/catalog-data'
import type { Bundle, Category, Program } from '@pulse/catalog-data'
import { normalizeText } from './text'

export type { CategoryId, Category, SettingsKind, Program, Bundle } from '@pulse/catalog-data'
export { CATEGORIES, CATALOG, PROGRAM_BY_ID, BUNDLES } from '@pulse/catalog-data'

export const packageVersionSchema = z.object({
  winget: z.string(),
  name: z.string(),
  version: z.string(),
  recommended: z.boolean(),
})
export type PackageVersion = z.infer<typeof packageVersionSchema>

export function totalSizeMb(ids: Iterable<string>): number {
  let total = 0
  for (const id of ids) total += PROGRAM_BY_ID.get(id)?.mb ?? 0
  return total
}

export function estimatedMinutes(mb: number): number {
  return Math.max(2, Math.round(mb / 90))
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

export function filterCatalog(term: string): readonly Program[] {
  const needle = normalizeText(term.trim())
  if (!needle) return CATALOG

  const categoryNames = new Map(CATEGORIES.map((c) => [c.id, normalizeText(c.name)]))
  return CATALOG.filter(
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
    const name = normalizeText(raw.trim())
    let longest = 0
    let owners: string[] = []

    for (const program of CATALOG) {
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

  return CATALOG.filter((p) => found.has(p.id)).map((p) => p.id)
}

export interface CategoryGroup {
  category: Category
  programs: readonly Program[]
}

export function groupByCategory(programs: readonly Program[]): readonly CategoryGroup[] {
  return CATEGORIES.map((category) => ({
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
