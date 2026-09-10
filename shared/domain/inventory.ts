import { z } from 'zod'
import { nameMatchesProgram, type Program } from './catalog'
import { buildInstalled, installedNodeSchema, type RegistryEntry } from './installed'

export const upgradeSchema = z.object({
  wingetId: z.string(),
  name: z.string(),
  current: z.string(),
  available: z.string(),
  programId: z.string().optional(),
})
export type Upgrade = z.infer<typeof upgradeSchema>

export const installedAppSchema = z.object({
  name: z.string(),
  programId: z.string().optional(),
  wingetId: z.string().optional(),
})
export type InstalledApp = z.infer<typeof installedAppSchema>

export const inventorySchema = z.object({
  apps: z.array(installedAppSchema),
  installed: z.array(installedNodeSchema),
  hidden: z.number(),
  upgrades: z.array(upgradeSchema),
  readAt: z.string(),
})
export type Inventory = z.infer<typeof inventorySchema>

export const EMPTY_INVENTORY: Inventory = {
  apps: [],
  installed: [],
  hidden: 0,
  upgrades: [],
  readAt: '',
}

const ID_SHAPE = /^[A-Za-z0-9][\w+-]*(\.[\w+-]+)+$/

function looksLikeId(token: string): boolean {
  if (!ID_SHAPE.test(token)) return false
  const first = token.split('.')[0] ?? ''
  return /[A-Za-z]/.test(first)
}

function idPosition(tokens: readonly string[], known: ReadonlySet<string>): number {
  if (known.size > 0) {
    for (let i = tokens.length - 1; i >= 0; i--) {
      const token = tokens[i]
      if (token && known.has(token.toLowerCase())) return i
    }
  }

  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i]
    if (token && looksLikeId(token)) return i
  }

  return -1
}

function columnStarts(header: string): number[] {
  const starts = [0]

  for (let i = 2; i < header.length; i++) {
    if (header[i] !== ' ' && header[i - 1] === ' ' && header[i - 2] === ' ') starts.push(i)
  }

  return starts
}

function cells(line: string, starts: readonly number[]): string[] {
  return starts.map((from, i) => line.slice(from, starts[i + 1] ?? line.length).trim())
}

function idColumn(rows: readonly string[][], known: ReadonlySet<string>): number {
  const width = Math.max(0, ...rows.map((row) => row.length))
  let best = -1
  let bestScore = 0

  for (let column = 0; column < width; column++) {
    let score = 0
    for (const row of rows) {
      const value = row[column]
      if (!value) continue
      if (known.has(value.toLowerCase())) score += 2
      else if (looksLikeId(value)) score += 1
    }
    if (score > bestScore) {
      bestScore = score
      best = column
    }
  }

  return best
}

function fromTable(output: string, known: ReadonlySet<string>): Upgrade[] | null {
  const lines = output.split(/\r?\n/)
  const rule = lines.findIndex((line) => /^-{5,}$/.test(line.trim()))
  if (rule < 1) return null

  const starts = columnStarts(lines[rule - 1] ?? '')
  if (starts.length < 4) return null

  const rows = lines
    .slice(rule + 1)
    .filter((line) => line.trim())
    .map((line) => cells(line, starts))

  const column = idColumn(rows, known)
  if (column < 1) return null

  const found: Upgrade[] = []

  for (const row of rows) {
    const wingetId = row[column]
    const current = row[column + 1]
    const available = row[column + 2]
    const name = row.slice(0, column).join(' ').trim()

    if (!wingetId || !current || !available || !name) continue
    if (!known.has(wingetId.toLowerCase()) && !looksLikeId(wingetId)) continue
    if (found.some((u) => u.wingetId === wingetId)) continue

    found.push({ wingetId, name, current, available })
  }

  return found
}

function fromTokens(output: string, known: ReadonlySet<string>): Upgrade[] {
  const found: Upgrade[] = []

  for (const line of output.split(/\r?\n/)) {
    const tokens = line.trim().split(/\s+/).filter(Boolean)
    if (tokens.length < 4) continue

    const position = idPosition(tokens, known)
    if (position <= 0) continue

    const wingetId = tokens[position]
    const current = tokens[position + 1]
    const available = tokens[position + 2]
    const name = tokens.slice(0, position).join(' ')

    if (!wingetId || !current || !available || !name) continue
    if (found.some((u) => u.wingetId === wingetId)) continue

    found.push({ wingetId, name, current, available })
  }

  return found
}

export function readWingetId(output: string): string | null {
  const lines = output.split(/\r?\n/)
  const rule = lines.findIndex((line) => /^-{5,}$/.test(line.trim()))
  if (rule < 0) return null

  for (const line of lines.slice(rule + 1)) {
    const tokens = line.trim().split(/\s+/).filter(Boolean)
    const found = tokens.find((token) => looksLikeId(token))
    if (found) return found
  }

  return null
}

export function readUpgrades(output: string, knownIds: readonly string[] = []): Upgrade[] {
  const known = new Set(knownIds.map((id) => id.toLowerCase()))
  return fromTable(output, known) ?? fromTokens(output, known)
}

function bestProgramFor(name: string, programs: readonly Program[]): Program | null {
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

export interface InventoryInput {
  names: readonly string[]
  entries?: readonly RegistryEntry[]
  wingetIds: readonly string[]
  upgrades: readonly Upgrade[]
  programs: readonly Program[]
}

export function buildInventory(input: InventoryInput, readAt: string): Inventory {
  const managed = new Set(input.wingetIds.map((id) => id.toLowerCase()))

  const apps: InstalledApp[] = []
  const seen = new Set<string>()

  for (const raw of input.names) {
    const name = raw.trim()
    if (!name) continue

    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const program = bestProgramFor(name, input.programs)
    const winget = program?.winget

    apps.push({
      name,
      ...(program ? { programId: program.id } : {}),
      ...(winget && managed.has(winget.toLowerCase()) ? { wingetId: winget } : {}),
    })
  }

  apps.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))

  const byWinget = new Map<string, string>()
  for (const program of input.programs) {
    if (program.winget) byWinget.set(program.winget.toLowerCase(), program.id)
  }

  const upgrades = input.upgrades.map((upgrade) => {
    const programId = byWinget.get(upgrade.wingetId.toLowerCase())
    return programId ? { ...upgrade, programId } : upgrade
  })

  const tree = buildInstalled(input.entries ?? [], input.programs, input.wingetIds)

  return { apps, installed: tree.nodes, hidden: tree.hidden, upgrades, readAt }
}

export function catalogued(inventory: Inventory): InstalledApp[] {
  return inventory.apps.filter((app) => app.programId !== undefined)
}

export function strangers(inventory: Inventory): InstalledApp[] {
  return inventory.apps.filter((app) => app.programId === undefined)
}

export function upgradeFor(inventory: Inventory, wingetId: string): Upgrade | undefined {
  return inventory.upgrades.find((u) => u.wingetId.toLowerCase() === wingetId.toLowerCase())
}

export const SUGGESTED_CATEGORY = 'utilities'

function withoutAccents(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function hintOf(name: string): string {
  return withoutAccents(name).trim().replace(/\s+/g, ' ')
}

export function suggestedId(name: string, taken: readonly string[] = []): string {
  const base = withoutAccents(name).replace(/[^a-z0-9]/g, '') || 'programa'
  const used = new Set(taken)
  if (!used.has(base)) return base

  let next = 2
  while (used.has(`${base}${next}`)) next++
  return `${base}${next}`
}

export function suggestedEntry(app: InstalledApp, taken: readonly string[] = []): Program {
  const name = app.name.trim() || 'Sem nome'

  return {
    id: suggestedId(name, taken),
    name,
    ...(app.wingetId ? { winget: app.wingetId } : {}),
    version: '',
    mb: 0,
    category: SUGGESTED_CATEGORY,
    hints: [hintOf(name)],
  }
}

