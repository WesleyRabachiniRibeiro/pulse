import {
  ERROR_LIMIT,
  HISTORY_LIMIT,
  RUN_STATES,
  type Run,
  type RunRecord,
  type RunState,
} from '@pulse/domain'

// Fila que não terminou não vira registro: o histórico conta o que aconteceu,
// não o que está acontecendo.
export function recordOf(run: Run): RunRecord | null {
  if (!run.finishedAt) return null

  return {
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    drive: run.drive,
    items: run.items.map((item) => ({
      id: item.id,
      status: item.status,
      drive: item.drive,
      ...(item.error ? { error: item.error.slice(0, ERROR_LIMIT) } : {}),
    })),
  }
}

export function withRecord(history: readonly RunRecord[], record: RunRecord): RunRecord[] {
  return [record, ...history].slice(0, HISTORY_LIMIT)
}

export function installedCount(record: RunRecord): number {
  return record.items.filter((item) => item.status === 'done').length
}

export interface RunTally {
  state: RunState
  count: number
}

export function tallyOf(record: RunRecord): RunTally[] {
  return RUN_STATES.map((state) => ({
    state,
    count: record.items.filter((item) => item.status === state).length,
  })).filter((one) => one.count > 0)
}

export function runSeconds(record: RunRecord): number {
  const from = Date.parse(record.startedAt)
  const to = Date.parse(record.finishedAt)
  if (Number.isNaN(from) || Number.isNaN(to)) return 0
  return Math.max(0, Math.round((to - from) / 1000))
}
