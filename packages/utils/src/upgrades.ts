import type { Upgrade } from '@pulse/domain'

const ID_SHAPE = /^[A-Za-z0-9][\w+-]*(\.[\w+-]+)+$/

function looksLikeId(token: string): boolean {
  if (!ID_SHAPE.test(token)) return false
  const first = token.split('.')[0] ?? ''
  return /[A-Za-z]/.test(first)
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

function idPosition(tokens: readonly string[], known: ReadonlySet<string>): number {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i]
    if (token && known.has(token.toLowerCase())) return i
  }

  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i]
    if (token && looksLikeId(token)) return i
  }

  return -1
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
    if (found.some((one) => one.wingetId === wingetId)) continue

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
    if (found.some((one) => one.wingetId === wingetId)) continue

    found.push({ wingetId, name, current, available })
  }

  return found
}

export function readUpgrades(output: string, knownIds: readonly string[] = []): Upgrade[] {
  const known = new Set(knownIds.map((id) => id.toLowerCase()))
  return fromTable(output, known) ?? fromTokens(output, known)
}
