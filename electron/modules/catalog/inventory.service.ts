import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { getPrograms } from '@shared/domain/catalog'
import {
  buildInventory,
  EMPTY_INVENTORY,
  readUpgrades,
  type Inventory,
} from '@shared/domain/inventory'
import { listInstalledNames } from './catalog.service'
import { readRegistryEntries } from './infrastructure/windowsRegistry'

const exec = promisify(execFile)

const CALL_TIMEOUT_MS = 90_000
const REUSE_MS = 120_000
const RETRY_WAIT_MS = 1_500

async function readWingetIds(): Promise<string[]> {
  const folder = await mkdtemp(join(tmpdir(), 'pulse-export-')).catch(() => null)
  if (!folder) return []

  const file = join(folder, 'installed.json')

  try {
    await exec(
      'winget',
      ['export', '-o', file, '--accept-source-agreements', '--disable-interactivity'],
      { windowsHide: true, timeout: CALL_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
    ).catch(() => undefined)

    const raw: unknown = JSON.parse(await readFile(file, 'utf8'))
    const sources = (raw as { Sources?: unknown }).Sources
    if (!Array.isArray(sources)) return []

    const ids: string[] = []
    for (const source of sources) {
      const packages = (source as { Packages?: unknown }).Packages
      if (!Array.isArray(packages)) continue
      for (const one of packages) {
        const id = (one as { PackageIdentifier?: unknown }).PackageIdentifier
        if (typeof id === 'string' && id) ids.push(id)
      }
    }
    return ids
  } catch {
    return []
  } finally {
    await rm(folder, { recursive: true, force: true }).catch(() => undefined)
  }
}

function answered(output: string): boolean {
  return output.split(/\r?\n/).some((line) => /^-{5,}$/.test(line.trim()))
}

async function askWinget(): Promise<string> {
  const { stdout } = await exec(
    'winget',
    ['list', '--upgrade-available', '--disable-interactivity', '--accept-source-agreements'],
    { windowsHide: true, timeout: CALL_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
  ).catch(() => ({ stdout: '' }))

  return stdout
}

async function readUpgradeTable(): Promise<string | null> {
  const first = await askWinget()
  if (answered(first)) return first

  await new Promise((done) => setTimeout(done, RETRY_WAIT_MS))

  const second = await askWinget()
  return answered(second) ? second : null
}

let last: { at: number; inventory: Inventory } | null = null
let reading: Promise<Inventory> | null = null

export function forgetInventory(): void {
  last = null
  reading = null
}

async function read(): Promise<Inventory> {
  const [names, entries, wingetIds, table] = await Promise.all([
    listInstalledNames().catch((): string[] => []),
    readRegistryEntries().catch(() => []),
    readWingetIds(),
    readUpgradeTable(),
  ])

  const upgrades = table === null ? [] : readUpgrades(table, wingetIds)

  const inventory = buildInventory(
    { names, entries, wingetIds, upgrades, programs: getPrograms() },
    new Date().toISOString(),
  )

  if (table !== null) last = { at: Date.now(), inventory }
  return inventory
}

export async function installedIdsNow(): Promise<string[]> {
  const inventory = await readInventory(true)
  return inventory.apps.flatMap((app) => (app.programId ? [app.programId] : []))
}

export function readInventory(fresh = false): Promise<Inventory> {
  if (!fresh && last && Date.now() - last.at < REUSE_MS) return Promise.resolve(last.inventory)

  reading ??= read()
    .catch(() => EMPTY_INVENTORY)
    .finally(() => {
      reading = null
    })

  return reading
}
