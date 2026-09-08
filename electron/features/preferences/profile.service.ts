import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { hasProgram } from '@shared/domain/catalog'
import { cleanProfile, EMPTY_PROFILE, profileSchema, type Profile } from '@shared/domain/profile'

function file(): string {
  return join(app.getPath('userData'), 'profile.json')
}

function known(id: string): boolean {
  return hasProgram(id)
}

let cache: Profile | null = null

export function forgetProfile(): void {
  cache = null
}

export async function readProfile(): Promise<Profile> {
  if (cache) return cache

  try {
    const raw: unknown = JSON.parse(await readFile(file(), 'utf8'))
    const parsed = profileSchema.safeParse(raw)
    cache = parsed.success ? cleanProfile(parsed.data, known) : EMPTY_PROFILE
  } catch {
    cache = EMPTY_PROFILE
  }

  return cache
}

export async function writeProfile(profile: Profile): Promise<Profile> {
  const next = cleanProfile(profileSchema.parse(profile), known)
  cache = next

  try {
    const path = file()
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(next, null, 2), 'utf8')
  } catch {
    /* empty */
  }

  return next
}
