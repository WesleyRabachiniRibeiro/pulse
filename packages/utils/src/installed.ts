import type { Program } from '@pulse/catalog-data'
import {
  normalizeText,
  type HiddenReason,
  type InstalledFilter,
  type InstalledNode,
  type InstalledTree,
  type RegistryEntry,
} from '@pulse/domain'
import { nameMatchesProgram } from './catalog'

const SHARED_UNINSTALLERS = new Set([
  'msiexec.exe',
  'rundll32.exe',
  'cmd.exe',
  'powershell.exe',
  'pwsh.exe',
  'regsvr32.exe',
  'wscript.exe',
  'cscript.exe',
])

const KB_IN_NAME = /\(KB\d{6,}\)/i

export function hiddenReason(entry: RegistryEntry): HiddenReason | null {
  if (entry.system === true) return 'system'
  if (KB_IN_NAME.test(entry.name)) return 'update'
  if (!entry.uninstall?.trim()) return 'locked'
  return null
}

export function uninstallerPath(command: string): string | null {
  const text = command.trim()
  if (!text) return null

  if (text.startsWith('"')) {
    const end = text.indexOf('"', 1)
    return end > 1 ? text.slice(1, end) : null
  }

  const cut = text.search(/\s+[/-]/)
  const path = (cut === -1 ? text : text.slice(0, cut)).trim()
  return path || null
}

function normalizePath(path: string): string {
  return path.replace(/\//g, '\\').replace(/\\+/g, '\\').replace(/\\+$/, '').toLowerCase()
}

function fileName(path: string): string {
  return normalizePath(path).split('\\').at(-1) ?? ''
}

export function uninstallerFolder(entry: RegistryEntry): string | null {
  const path = entry.uninstall ? uninstallerPath(entry.uninstall) : null
  if (!path) return null

  const full = normalizePath(path)
  if (SHARED_UNINSTALLERS.has(fileName(full))) return null
  if (/\\windows\\/.test(full)) return null

  const folder = full.split('\\').slice(0, -1).join('\\')
  return folder || null
}

function simpleName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function stemOf(name: string): string {
  return name
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\bv?\d[\d.+_-]*\b/gi, ' ')
    .replace(/\b(x64|x86|amd64|arm64|64-bit|32-bit)\b/gi, ' ')
    .replace(/[-–—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function iconPath(value: string | undefined): string | null {
  const withoutIndex = (value ?? '').trim().replace(/,-?\d+$/, '')
  const path = withoutIndex.replace(/^"|"$/g, '').trim()
  return path || null
}

function programFor(name: string, programs: readonly Program[]): Program | null {
  let best: Program | null = null
  let longest = 0

  for (const program of programs) {
    if (!nameMatchesProgram(name, program)) continue
    const reach = Math.max(...program.hints.map((hint) => hint.length))
    if (reach > longest) {
      longest = reach
      best = program
    }
  }

  return best
}

function leafOf(
  entry: RegistryEntry,
  programs: readonly Program[],
  managed: ReadonlySet<string>,
): InstalledNode {
  const program = programFor(entry.name, programs)
  const winget = program?.winget
  const icon = iconPath(entry.icon)

  return {
    key: entry.key,
    name: entry.name.trim(),
    kind: 'app',
    ...(entry.publisher ? { publisher: entry.publisher } : {}),
    ...(entry.version ? { version: entry.version } : {}),
    ...(program ? { programId: program.id } : {}),
    ...(winget && managed.has(winget.toLowerCase()) ? { wingetId: winget } : {}),
    ...(icon ? { icon } : {}),
    children: [],
  }
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
}

function ownerOf(folder: string, members: readonly RegistryEntry[]): RegistryEntry | null {
  const base = folder.split('\\').at(-1) ?? ''
  if (!base) return null

  for (const member of members) {
    if (simpleName(member.name) === base) return member
  }

  for (const member of members) {
    const location = member.location ? normalizePath(member.location) : ''
    if (location && (location === folder || folder.startsWith(`${location}\\`))) return member
  }

  return null
}

export function buildInstalled(
  entries: readonly RegistryEntry[],
  programs: readonly Program[],
  wingetIds: readonly string[] = [],
): InstalledTree {
  const managed = new Set(wingetIds.map((id) => id.toLowerCase()))

  const visible: RegistryEntry[] = []
  const seen = new Set<string>()
  let hidden = 0

  for (const entry of entries) {
    if (!entry.name.trim()) continue
    if (hiddenReason(entry)) {
      hidden++
      continue
    }
    if (seen.has(entry.key)) continue
    seen.add(entry.key)
    visible.push(entry)
  }

  const byFolder = new Map<string, RegistryEntry[]>()
  for (const entry of visible) {
    const folder = uninstallerFolder(entry)
    if (!folder) continue
    const list = byFolder.get(folder)
    if (list) list.push(entry)
    else byFolder.set(folder, [entry])
  }

  const nodes: InstalledNode[] = []
  const taken = new Set<string>()

  for (const [folder, members] of byFolder) {
    if (members.length < 2) continue
    const owner = ownerOf(folder, members)
    if (!owner) continue

    const children = members
      .filter((member) => member.key !== owner.key)
      .map((member) => leafOf(member, programs, managed))
      .sort(byName)

    nodes.push({ ...leafOf(owner, programs, managed), kind: 'owner', children })
    for (const member of members) taken.add(member.key)
  }

  const byFamily = new Map<string, RegistryEntry[]>()
  for (const entry of visible) {
    if (taken.has(entry.key)) continue
    const stem = stemOf(entry.name)
    if (!stem) continue
    const label = `${entry.publisher ?? ''}::${stem.toLowerCase()}`
    const list = byFamily.get(label)
    if (list) list.push(entry)
    else byFamily.set(label, [entry])
  }

  for (const [label, members] of byFamily) {
    const first = members[0]
    if (!first) continue

    if (members.length < 2) {
      nodes.push(leafOf(first, programs, managed))
      continue
    }

    nodes.push({
      key: `family:${label}`,
      name: stemOf(first.name),
      kind: 'family',
      ...(first.publisher ? { publisher: first.publisher } : {}),
      children: members.map((member) => leafOf(member, programs, managed)).sort(byName),
    })
  }

  return { nodes: nodes.sort(byName), hidden }
}

export function countNodes(nodes: readonly InstalledNode[]): number {
  return nodes.reduce((total, node) => total + 1 + node.children.length, 0)
}

export function filterInstalled(
  nodes: readonly InstalledNode[],
  query: string,
  filter: InstalledFilter = 'all',
): InstalledNode[] {
  const needle = normalizeText(query.trim())

  return nodes.filter((node) => {
    if (filter === 'pulse' && !node.programId) return false
    if (filter === 'stranger' && node.programId) return false
    if (!needle) return true

    if (normalizeText(node.name).includes(needle)) return true
    return node.children.some((child) => normalizeText(child.name).includes(needle))
  })
}

export function selectable(nodes: readonly InstalledNode[]): InstalledNode[] {
  return nodes.filter((node) => node.programId !== undefined)
}
