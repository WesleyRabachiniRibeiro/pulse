import type { Catalog, StartupEntry } from '@pulse/domain'
import { entryMatchesProgram } from './catalog'

export function tidyStartup(entries: readonly StartupEntry[]): StartupEntry[] {
  const seen = new Set<string>()
  const kept: StartupEntry[] = []

  for (const entry of entries) {
    const name = entry.name.trim()
    if (!name) continue

    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    kept.push({ ...entry, name })
  }

  return kept.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
}

export function withPrograms(catalog: Catalog, entries: readonly StartupEntry[]): StartupEntry[] {
  return entries.map((entry) => {
    for (const program of catalog.programs) {
      if (entryMatchesProgram(entry.name, entry.value, program)) {
        return { ...entry, programId: program.id }
      }
    }
    return entry
  })
}
