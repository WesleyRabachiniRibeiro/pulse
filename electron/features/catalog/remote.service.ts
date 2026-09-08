import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  BUILTIN_CATALOG,
  catalogSchema,
  getCatalog,
  setCatalog,
  type Catalog,
} from '@shared/domain/catalog'

const SOURCE_URL =
  'https://raw.githubusercontent.com/WesleyRabachiniRibeiro/pulse/main/catalog.json'

const FETCH_TIMEOUT_MS = 8_000

function file(): string {
  return join(app.getPath('userData'), 'catalog.json')
}

function validate(raw: unknown): Catalog | null {
  const parsed = catalogSchema.safeParse(raw)
  if (!parsed.success) return null

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

async function readCached(): Promise<Catalog | null> {
  try {
    return validate(JSON.parse(await readFile(file(), 'utf8')))
  } catch {
    return null
  }
}

async function saveCached(catalog: Catalog): Promise<void> {
  try {
    const path = file()
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(catalog, null, 2), 'utf8')
  } catch {
    /* empty */
  }
}

async function fetchRemote(): Promise<Catalog | null> {
  const control = new AbortController()
  const giveUp = setTimeout(() => control.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(SOURCE_URL, { signal: control.signal, cache: 'no-store' })
    if (!response.ok) return null
    return validate(await response.json())
  } catch {
    return null
  } finally {
    clearTimeout(giveUp)
  }
}

type Listener = (catalog: Catalog) => void

const listeners = new Set<Listener>()

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function announce(catalog: Catalog): void {
  for (const listener of listeners) listener(catalog)
}

let loading: Promise<Catalog> | null = null

export function loadCatalog(): Promise<Catalog> {
  loading ??= start()
  return loading
}

async function start(): Promise<Catalog> {
  const cached = await readCached()
  if (cached) setCatalog(cached)
  return getCatalog()
}

export async function refreshCatalog(): Promise<boolean> {
  await loadCatalog()

  const remote = await fetchRemote()
  if (!remote) return false

  setCatalog(remote)
  await saveCached(remote)
  announce(getCatalog())
  return true
}

export function forgetRemoteCatalog(): void {
  loading = null
  setCatalog(BUILTIN_CATALOG)
}
