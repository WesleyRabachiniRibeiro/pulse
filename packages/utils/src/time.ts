function millisBetween(startIso: string, endMs: number): number {
  return endMs - Date.parse(startIso)
}

export function secondsSince(startIso: string, endMs: number = Date.now()): number {
  return Math.max(0, Math.floor(millisBetween(startIso, endMs) / 1000))
}

export function secondsBetween(startIso: string, endIso: string): number {
  return Math.max(0, Math.round(millisBetween(startIso, Date.parse(endIso)) / 1000))
}
