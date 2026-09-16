import { z } from 'zod'
import { settingsSchema } from './settings'

export const PORTABLE_VERSION = 1

export const portableSchema = z.object({
  pulse: z.number(),
  savedAt: z.string(),
  drive: z.string().optional(),
  programs: z.array(z.string()),
  drives: z.record(z.string(), z.string()),
  settings: z.record(z.string(), settingsSchema),
})
export type Portable = z.infer<typeof portableSchema>

export const IMPORT_MODES = ['merge', 'replace'] as const
export type ImportMode = (typeof IMPORT_MODES)[number]

export const EXPORT_FORMATS = ['pulse', 'winget', 'script', 'csv'] as const
export type ExportFormat = (typeof EXPORT_FORMATS)[number]

export const FORMAT_FILE: Record<ExportFormat, { name: string; extension: string }> = {
  pulse: { name: 'Perfil do Pulse', extension: 'json' },
  winget: { name: 'Lista do winget', extension: 'json' },
  script: { name: 'Script do PowerShell', extension: 'ps1' },
  csv: { name: 'Planilha', extension: 'csv' },
}

export function readPortable(raw: unknown): Portable | null {
  const read = portableSchema.safeParse(raw)
  if (!read.success) return null
  if (read.data.pulse !== PORTABLE_VERSION) return null
  return read.data
}
