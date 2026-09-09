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

/**
 * Guarda o que a fila decidiu, não como ela chegou lá. Sem log, sem detalhe de
 * andamento e com o erro cortado, porque o arquivo cresce a cada fila e ninguém
 * volta para ler texto de instalador de meses atrás.
 */
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
