import { z } from 'zod'
import { settingsSchema } from './settings'

export const itemStatusSchema = z.enum([
  'queued',
  'downloading',
  'installing',
  'configuring',
  'waiting',
  'done',
  'failed',
  'canceled',
])
export type ItemStatus = z.infer<typeof itemStatusSchema>

export const itemSchema = z.object({
  id: z.string(),
  status: itemStatusSchema,
  percent: z.number(),
  detail: z.string(),
  drive: z.string(),
  error: z.string().optional(),
  driveIgnored: z.boolean().optional(),
  canceling: z.boolean().optional(),
  needsPermission: z.boolean().optional(),
  needsRestart: z.boolean().optional(),
  settings: settingsSchema.optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  result: z
    .object({
      extensions: z.number(),
      extensionsRequested: z.number(),
      git: z.boolean(),
      gamesAccepted: z.array(z.string()),
      gamesRefused: z.array(z.string()),
      gamesPending: z.array(z.string()),
      autostart: z.enum(['on', 'off', 'no-entry']).optional(),
      pagesOpened: z.array(z.string()),
      riotInstalled: z.array(z.string()),
      riotFailed: z.array(z.string()),
      gitLogin: z.boolean(),
      madeDefault: z.enum(['yes', 'asked', 'failed']).optional(),
      importAddress: z.string().optional(),
      importWizard: z.boolean().optional(),
    })
    .optional(),
})
export type Item = z.infer<typeof itemSchema>

export const logLevelSchema = z.enum(['info', 'step', 'ok', 'error'])
export type LogLevel = z.infer<typeof logLevelSchema>

export const logLineSchema = z.object({
  time: z.string(),
  text: z.string(),
  level: logLevelSchema,
})
export type LogLine = z.infer<typeof logLineSchema>

export const LOG_LIMIT = 200

export const runSchema = z.object({
  items: z.array(itemSchema),
  drive: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  canceling: z.boolean(),
  log: z.array(logLineSchema),
})
export type Run = z.infer<typeof runSchema>

export const requestSchema = z.object({
  id: z.string(),
  drive: z.string(),
  settings: settingsSchema.optional(),
})
export type Request = z.infer<typeof requestSchema>

export const PARALLEL_LIMIT = 3
export const SECONDS_UNTIL_RESTART = 30

export const ITEM_STAGES = [
  { id: 'download', name: 'Baixar' },
  { id: 'install', name: 'Instalar' },
  { id: 'settings', name: 'Ajustes' },
  { id: 'ready', name: 'Pronto' },
] as const

export type ItemStage = (typeof ITEM_STAGES)[number]['id']
