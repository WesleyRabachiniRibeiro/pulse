import { entryMatchesProgram, getPrograms } from '@shared/domain/catalog'
import { tidyStartup, type StartupEntry } from '@shared/domain/windows'
import { listAutostartEntries } from './catalog.service'
import { writeStartupState } from './infrastructure/windowsRegistry'

function programFor(name: string, value: string): string | undefined {
  for (const program of getPrograms()) {
    if (entryMatchesProgram(name, value, program)) return program.id
  }
  return undefined
}

export async function listStartup(): Promise<StartupEntry[]> {
  const raw = await listAutostartEntries().catch((): [] => [])

  return tidyStartup(
    raw
      .filter((entry) => entry?.name)
      .map((entry) => {
        const value = entry.value ?? ''
        const programId = programFor(entry.name, value)
        return {
          name: entry.name,
          value,
          enabled: entry.enabled,
          ...(programId ? { programId } : {}),
        }
      }),
  )
}

export async function setStartup(name: string, on: boolean): Promise<StartupEntry[]> {
  await writeStartupState(name, on)
  return listStartup()
}
