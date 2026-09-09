import { app } from 'electron'
import { copyFile, readdir, rm, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { nameMatchesProgram, type Program } from '@shared/domain/catalog'

export type ShortcutResult = 'created' | 'removed' | 'kept' | 'not-found' | 'failed'

const MAX_DEPTH = 4

function startMenuFolders(): string[] {
  const all = process.env['ProgramData']
  const mine = process.env['APPDATA']
  const tail = join('Microsoft', 'Windows', 'Start Menu', 'Programs')

  return [all ? join(all, tail) : null, mine ? join(mine, tail) : null].filter(
    (path): path is string => path !== null,
  )
}

async function shortcutsIn(folder: string, depth = 0): Promise<string[]> {
  if (depth > MAX_DEPTH) return []

  const entries = await readdir(folder, { withFileTypes: true }).catch(() => [])
  const found: string[] = []

  for (const entry of entries) {
    const path = join(folder, entry.name)
    if (entry.isDirectory()) found.push(...(await shortcutsIn(path, depth + 1)))
    else if (entry.name.toLowerCase().endsWith('.lnk')) found.push(path)
  }

  return found
}

function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function closeness(name: string, program: Program): number {
  const folded = fold(name)
  const exact = program.hints.some((hint) => fold(hint) === folded)
  return (exact ? 0 : 1_000_000) + folded.length
}

export async function allStartMenuShortcuts(): Promise<string[]> {
  const found: string[] = []
  for (const folder of startMenuFolders()) found.push(...(await shortcutsIn(folder)))
  return found
}

export function bestShortcutFor(links: readonly string[], program: Program): string | null {
  const matches = links.filter((path) => nameMatchesProgram(basename(path, '.lnk'), program))
  if (matches.length === 0) return null

  return matches.sort(
    (a, b) => closeness(basename(a, '.lnk'), program) - closeness(basename(b, '.lnk'), program),
  )[0] as string
}

export async function findStartMenuShortcut(program: Program): Promise<string | null> {
  return bestShortcutFor(await allStartMenuShortcuts(), program)
}

function desktopFolder(): string {
  return app.getPath('desktop')
}

async function exists(path: string): Promise<boolean> {
  return stat(path)
    .then(() => true)
    .catch(() => false)
}

async function onDesktop(program: Program): Promise<string | null> {
  const desktop = desktopFolder()
  const entries = await readdir(desktop).catch(() => [])

  const match = entries.find(
    (name) => name.toLowerCase().endsWith('.lnk') && nameMatchesProgram(name.slice(0, -4), program),
  )

  return match ? join(desktop, match) : null
}

export async function applyDesktopShortcut(
  program: Program,
  wanted: boolean,
): Promise<ShortcutResult> {
  const already = await onDesktop(program)

  if (!wanted) {
    if (!already) return 'kept'
    return rm(already)
      .then((): ShortcutResult => 'removed')
      .catch((): ShortcutResult => 'failed')
  }

  if (already) return 'kept'

  const source = await findStartMenuShortcut(program)
  if (!source) return 'not-found'

  const target = join(desktopFolder(), basename(source))
  if (await exists(target)) return 'kept'

  return copyFile(source, target)
    .then((): ShortcutResult => 'created')
    .catch((): ShortcutResult => 'failed')
}
