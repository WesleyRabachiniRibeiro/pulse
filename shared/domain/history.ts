import { z } from 'zod'
import { itemStatusSchema, type Run } from './installation'

export const historyItemSchema = z.object({
  id: z.string(),
  status: itemStatusSchema,
  drive: z.string(),
  error: z.string().optional(),
})
export type HistoryItem = z.infer<typeof historyItemSchema>

export const runRecordSchema = z.object({
  startedAt: z.string(),
  finishedAt: z.string(),
  drive: z.string(),
  items: z.array(historyItemSchema),
})
export type RunRecord = z.infer<typeof runRecordSchema>

export const historySchema = z.array(runRecordSchema)

export const HISTORY_LIMIT = 50
export const ERROR_LIMIT = 300

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

export function withRecord(
  history: readonly RunRecord[],
  record: RunRecord,
): RunRecord[] {
  return [record, ...history].slice(0, HISTORY_LIMIT)
}

export function installedCount(record: RunRecord): number {
  return record.items.filter((item) => item.status === 'done').length
}

export const RUN_STATES = ['done', 'failed', 'waiting', 'canceled'] as const
export type RunState = (typeof RUN_STATES)[number]

export const RUN_STATE_LABEL: Record<RunState, string> = {
  done: 'prontos',
  failed: 'falharam',
  waiting: 'pararam esperando você',
  canceled: 'cancelados',
}

export const RUN_STATE_ONE: Record<RunState, string> = {
  done: 'pronto',
  failed: 'falhou',
  waiting: 'parou esperando você',
  canceled: 'cancelado',
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
