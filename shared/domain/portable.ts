import { z } from 'zod'
import { getProgram, programSchema, type Program } from './catalog'
import { settingsSchema } from './settings'
import { profileSchema, type Profile } from './profile'

export const PORTABLE_VERSION = 1

export const portableSchema = z.object({
  pulse: z.number(),
  savedAt: z.string(),
  drive: z.string().optional(),
  programs: z.array(z.string()),
  drives: z.record(z.string(), z.string()),
  settings: z.record(z.string(), settingsSchema),
  extras: z.array(programSchema).optional(),
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

export function portableOf(
  profile: Profile,
  drive?: string,
  at = new Date(),
  extras: readonly Program[] = [],
): Portable {
  const wanted = new Set(profile.selected)
  const mine = extras.filter((program) => wanted.has(program.id))

  return {
    pulse: PORTABLE_VERSION,
    savedAt: at.toISOString(),
    ...(drive ? { drive } : {}),
    programs: [...profile.selected],
    drives: { ...profile.drives },
    settings: { ...profile.settings },
    ...(mine.length > 0 ? { extras: mine.map((program) => ({ ...program })) } : {}),
  }
}

/** O que veio no arquivo e o catálogo de casa ainda não conhece. */
export function unknownOf(portable: Portable, known: (id: string) => boolean): Program[] {
  return (portable.extras ?? []).filter((program) => !known(program.id))
}

/**
 * Somar mantém o que já estava marcado e acrescenta o do arquivo; substituir
 * troca a lista inteira. Nos dois casos o ajuste do arquivo vence, porque foi
 * ele que a pessoa acabou de trazer.
 */
export function profileOf(portable: Portable, mode: ImportMode, current: Profile): Profile {
  const selected =
    mode === 'merge' ? [...new Set([...current.selected, ...portable.programs])] : portable.programs

  return profileSchema.parse({
    selected,
    drives: mode === 'merge' ? { ...current.drives, ...portable.drives } : { ...portable.drives },
    settings:
      mode === 'merge' ? { ...current.settings, ...portable.settings } : { ...portable.settings },
  })
}

export function readPortable(raw: unknown): Portable | null {
  const read = portableSchema.safeParse(raw)
  if (!read.success) return null
  if (read.data.pulse !== PORTABLE_VERSION) return null
  return read.data
}

function wingetIdsOf(ids: readonly string[]): string[] {
  const found: string[] = []

  for (const id of ids) {
    const winget = getProgram(id)?.winget
    if (winget && !found.includes(winget)) found.push(winget)
  }

  return found
}

/** O formato que o próprio `winget import` come. */
export function wingetImportOf(ids: readonly string[]): string {
  const packages = wingetIdsOf(ids).map((PackageIdentifier) => ({ PackageIdentifier }))

  return `${JSON.stringify(
    {
      $schema: 'https://aka.ms/winget-packages.schema.2.0.json',
      CreationDate: new Date().toISOString(),
      Sources: [
        {
          Packages: packages,
          SourceDetails: {
            Argument: 'https://cdn.winget.microsoft.com/cache',
            Identifier: 'Microsoft.Winget.Source_8wekyb3d8bbwe',
            Name: 'winget',
            Type: 'Microsoft.PreIndexed.Package',
          },
        },
      ],
      WinGetVersion: '1.0',
    },
    null,
    2,
  )}\n`
}

export function scriptOf(ids: readonly string[]): string {
  const lines = wingetIdsOf(ids).map(
    (winget) => `winget install --id ${winget} --exact --accept-package-agreements --accept-source-agreements`,
  )

  return [
    '# Gerado pelo Pulse. Rode num PowerShell comum.',
    '$ErrorActionPreference =' + " 'Continue'",
    '',
    ...lines,
    '',
  ].join('\r\n')
}

function csvCell(value: string): string {
  return /[",;\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function csvOf(ids: readonly string[]): string {
  const rows = [['nome', 'identificador', 'categoria', 'tamanho_mb']]

  for (const id of ids) {
    const program = getProgram(id)
    if (!program) continue
    rows.push([program.name, program.winget ?? '', program.category, String(program.mb)])
  }

  return `${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}\r\n`
}

export function fileFor(
  format: ExportFormat,
  profile: Profile,
  drive?: string,
  extras: readonly Program[] = [],
): string {
  const ids = [...profile.selected]

  if (format === 'winget') return wingetImportOf(ids)
  if (format === 'script') return scriptOf(ids)
  if (format === 'csv') return csvOf(ids)

  return `${JSON.stringify(portableOf(profile, drive, new Date(), extras), null, 2)}\n`
}
