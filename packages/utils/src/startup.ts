import { PROGRAM_BY_ID, type StartupEntry } from '@pulse/domain'
import { entryMatchesProgram } from './catalog'

// O mesmo programa costuma aparecer em mais de uma chave do registro. Na tela
// isso vira linha repetida, então fica a primeira e a lista sai em ordem.
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

// Casar com o catálogo é o que deixa a tela mostrar o ícone do programa. O que
// não casa continua na lista: é justamente o que o Pulse não instalou.
export function withPrograms(entries: readonly StartupEntry[]): StartupEntry[] {
  return entries.map((entry) => {
    for (const program of PROGRAM_BY_ID.values()) {
      if (entryMatchesProgram(entry.name, entry.value, program)) {
        return { ...entry, programId: program.id }
      }
    }
    return entry
  })
}
