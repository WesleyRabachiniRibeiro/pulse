import { app } from 'electron'
import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { z } from 'zod'
import { readVersionFromSearch, type Program } from '@shared/domain/catalog'

const exec = promisify(execFile)

const CALL_TIMEOUT_MS = 20_000
const AT_ONCE = 3
const REUSE_MS = 12 * 60 * 60 * 1000

const cachedVersionsSchema = z.object({
  at: z.string(),
  versions: z.record(z.string(), z.string()),
})
type CachedVersions = z.infer<typeof cachedVersionsSchema>

function file(): string {
  return join(app.getPath('userData'), 'versions.json')
}

let cache: CachedVersions | null = null

export function forgetVersions(): void {
  cache = null
}

async function readCached(): Promise<CachedVersions | null> {
  if (cache) return cache

  try {
    const parsed = cachedVersionsSchema.safeParse(JSON.parse(await readFile(file(), 'utf8')))
    cache = parsed.success ? parsed.data : null
  } catch {
    cache = null
  }

  return cache
}

async function saveCached(next: CachedVersions): Promise<void> {
  cache = next
  try {
    const path = file()
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(next, null, 2), 'utf8')
  } catch {}
}

function stale(cached: CachedVersions | null): boolean {
  if (!cached) return true
  const at = Date.parse(cached.at)
  return Number.isNaN(at) || Date.now() - at > REUSE_MS
}

export function asksWinget(program: Program): boolean {
  return Boolean(program.winget) && program.source !== 'msstore' && program.source !== 'pages'
}

async function readVersion(program: Program): Promise<string | null> {
  const id = program.winget
  if (!id) return null

  const { stdout } = await exec(
    'winget',
    ['search', '--id', id, '--exact', '--disable-interactivity', '--source', 'winget'],
    { windowsHide: true, timeout: CALL_TIMEOUT_MS, maxBuffer: 1024 * 1024 },
  ).catch(() => ({ stdout: '' }))

  return readVersionFromSearch(stdout, id)
}

async function sweep(programs: readonly Program[]): Promise<Record<string, string>> {
  const found: Record<string, string> = {}
  const queue = programs.filter(asksWinget)
  let next = 0

  const worker = async (): Promise<void> => {
    while (next < queue.length) {
      const program = queue[next++]
      if (!program) return
      const version = await readVersion(program).catch(() => null)
      if (version) found[program.id] = version
    }
  }

  await Promise.all(Array.from({ length: Math.min(AT_ONCE, queue.length) }, worker))
  return found
}

export async function knownVersions(): Promise<Record<string, string>> {
  return (await readCached())?.versions ?? {}
}

export async function refreshVersions(
  programs: readonly Program[],
): Promise<Record<string, string> | null> {
  const cached = await readCached()
  if (!stale(cached)) return null

  const versions = await sweep(programs)
  if (Object.keys(versions).length === 0) return null

  await saveCached({ at: new Date().toISOString(), versions })
  return versions
}
