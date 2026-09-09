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
import type { Program } from '@shared/domain/catalog'
import { forgetVersions, knownVersions, refreshVersions } from './versions.service'
import { readExtras, saveExtras } from './extras.service'

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
let base: Catalog = BUILTIN_CATALOG
let versions: Record<string, string> = {}
let extras: Program[] = []

function publish(): Catalog {
  const known = new Set(base.programs.map((program) => program.id))
  const mine = extras.filter((program) => !known.has(program.id))

  const programs = [...base.programs, ...mine].map((program) => {
    const fresh = versions[program.id]
    return fresh && fresh !== program.version ? { ...program, version: fresh } : program
  })

  setCatalog({ ...base, programs })
  return getCatalog()
}

export function loadCatalog(): Promise<Catalog> {
  loading ??= start()
  return loading
}

async function start(): Promise<Catalog> {
  const cached = await readCached()
  if (cached) base = cached
  extras = await readExtras()
  versions = await knownVersions()
  return publish()
}

export async function refreshCatalog(): Promise<boolean> {
  await loadCatalog()

  const remote = await fetchRemote()
  if (!remote) return false

  base = remote
  await saveCached(remote)
  announce(publish())
  return true
}

export async function refreshVersionsFromWinget(): Promise<boolean> {
  await loadCatalog()

  const fresh = await refreshVersions(base.programs)
  if (!fresh) return false

  versions = fresh
  announce(publish())
  return true
}

/**
 * Programa que a pessoa achou no PC e mandou entrar no catálogo dela. Fica num
 * arquivo só dela, ao lado do catálogo baixado, e sobrevive à atualização do
 * catálogo publicado.
 */
export async function addToCatalog(program: Program): Promise<'added' | 'exists'> {
  await loadCatalog()

  const known = new Set([...base.programs, ...extras].map((one) => one.id))
  if (known.has(program.id)) return 'exists'

  extras = [...extras, program]
  await saveExtras(extras)
  announce(publish())
  return 'added'
}

export function myProgramIds(): string[] {
  return extras.map((program) => program.id)
}

/** Tira do catálogo o que a pessoa adotou. O programa segue instalado no PC. */
export async function removeFromCatalog(id: string): Promise<boolean> {
  await loadCatalog()

  const rest = extras.filter((program) => program.id !== id)
  if (rest.length === extras.length) return false

  extras = rest
  await saveExtras(extras)
  announce(publish())
  return true
}

export function forgetRemoteCatalog(): void {
  loading = null
  base = BUILTIN_CATALOG
  versions = {}
  forgetVersions()
  setCatalog(BUILTIN_CATALOG)
}
