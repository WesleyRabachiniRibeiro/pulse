import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  entryMatchesProgram,
  installedIds,
  nameMatchesProgram,
  getProgram,
  getPrograms,
  sortVersions,
  type PackageVersion,
} from '@shared/domain/catalog'
import type { FreshInput } from '@shared/ipc/contracts'
import {
  readAutostartEntries,
  readInstalledDisplayNames,
  readUninstallEntries,
  type AutostartEntry,
  type UninstallEntry,
} from './infrastructure/windowsRegistry'

const exec = promisify(execFile)

export async function listVersions(id: string): Promise<PackageVersion[]> {
  const program = getProgram(id)
  if (!program?.family) return []

  const { prefix, pattern } = program.family
  const accepted = new RegExp(pattern)

  const { stdout } = await exec(
    'winget',
    ['search', prefix, '--disable-interactivity', '--source', 'winget'],
    { windowsHide: true, timeout: 30_000, maxBuffer: 4 * 1024 * 1024 },
  ).catch(() => ({ stdout: '' }))

  const versions: PackageVersion[] = []
  for (const line of stdout.split(/\r?\n/)) {
    const tokens = line.trim().split(/\s+/)
    const position = tokens.findIndex((t) => accepted.test(t))
    if (position <= 0) continue

    const winget = tokens[position]
    const version = tokens[position + 1]
    const name = tokens.slice(0, position).join(' ')
    if (!winget || !version || !name) continue

    versions.push({ winget, name, version, recommended: winget === program.winget })
  }

  return sortVersions(versions)
}

const MSI_CODE = /\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}/

function silentCommand(entry: UninstallEntry): string | null {
  if (entry.quiet?.trim()) return entry.quiet.trim()

  const plain = entry.plain ?? ''
  if (!/msiexec/i.test(plain)) return null

  const code = MSI_CODE.exec(plain)?.[0]
  return code ? `msiexec.exe /x ${code} /quiet /norestart` : null
}

export async function quietUninstallCommands(id: string): Promise<string[]> {
  const program = getProgram(id)
  if (!program) return []

  const entries = await readUninstallEntries()

  const commands: string[] = []
  for (const entry of entries) {
    if (!entry?.name || !nameMatchesProgram(entry.name, program)) continue
    const command = silentCommand(entry)
    if (command && !commands.includes(command)) commands.push(command)
  }
  return commands
}

export type { AutostartEntry }

export type AutostartState = 'on' | 'off'

export function listAutostartEntries(): Promise<AutostartEntry[]> {
  return readAutostartEntries()
}

async function readAutostart(): Promise<{ id: string; state: AutostartState }[]> {
  const entries = await listAutostartEntries()
  const found = new Map<string, AutostartState>()

  for (const program of getPrograms()) {
    for (const entry of entries) {
      if (!entry?.name) continue
      if (!entryMatchesProgram(entry.name, entry.value ?? '', program)) continue
      if (entry.enabled || !found.has(program.id)) {
        found.set(program.id, entry.enabled ? 'on' : 'off')
      }
      if (entry.enabled) break
    }
  }

  return [...found.entries()].map(([id, state]) => ({ id, state }))
}

export async function isInstalled(id: string): Promise<boolean> {
  const ids = await readInstalled().catch((): string[] => [])
  return ids.includes(id)
}

export function listInstalledNames(): Promise<string[]> {
  return readInstalledDisplayNames()
}

async function readInstalledNames(): Promise<string[]> {
  return installedIds(await listInstalledNames())
}

const REUSE_MS = 120_000

type Autostart = { id: string; state: AutostartState }

let lastInstalled: { at: number; ids: string[] } | null = null
let installedRead: { generation: number; reading: Promise<string[]> } | null = null

let lastAutostart: { at: number; list: Autostart[] } | null = null
let autostartRead: { generation: number; reading: Promise<Autostart[]> } | null = null

let generation = 0

function readInstalled(): Promise<string[]> {
  if (installedRead?.generation === generation) return installedRead.reading

  const mine = generation
  const reading = readInstalledNames()
    .then((ids) => {
      if (mine === generation) lastInstalled = { at: Date.now(), ids }
      return ids
    })
    .finally(() => {
      if (installedRead?.reading === reading) installedRead = null
    })

  installedRead = { generation: mine, reading }
  return reading
}

function readAutostartOnce(): Promise<Autostart[]> {
  if (autostartRead?.generation === generation) return autostartRead.reading

  const mine = generation
  const reading = readAutostart()
    .then((list) => {
      if (mine === generation) lastAutostart = { at: Date.now(), list }
      return list
    })
    .finally(() => {
      if (autostartRead?.reading === reading) autostartRead = null
    })

  autostartRead = { generation: mine, reading }
  return reading
}

export function listInstalled(input: FreshInput = {}): Promise<string[]> {
  if (!input.fresh && lastInstalled && Date.now() - lastInstalled.at < REUSE_MS) {
    return Promise.resolve(lastInstalled.ids)
  }
  return readInstalled()
}

export function listAutostart(): Promise<Autostart[]> {
  if (lastAutostart && Date.now() - lastAutostart.at < REUSE_MS) {
    return Promise.resolve(lastAutostart.list)
  }
  return readAutostartOnce()
}

export function forgetCatalog(): void {
  generation++
  lastInstalled = null
  lastAutostart = null
}

export function warmCatalog(): void {
  void listInstalled().catch(() => undefined)
  void listAutostart().catch(() => undefined)
}
