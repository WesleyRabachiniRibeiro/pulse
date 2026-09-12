import { z } from 'zod'
import { itemStatusSchema } from './installation'

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

// O histórico é para consulta, não para auditoria: cinquenta filas cobrem o
// uso real e o arquivo não cresce sem fim. A mensagem de erro é cortada porque
// algumas do winget vêm com um despejo inteiro dentro.
export const HISTORY_LIMIT = 50
export const ERROR_LIMIT = 300

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
