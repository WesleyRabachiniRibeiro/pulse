import { z } from 'zod'

export const checkStatusSchema = z.enum(['ok', 'warning', 'blocker'])
export type CheckStatus = z.infer<typeof checkStatusSchema>

export const checkIdSchema = z.enum([
  'windows',
  'admin',
  'winget',
  'internet',
  'drive',
  'virtualization',
])
export type CheckId = z.infer<typeof checkIdSchema>

export const checkSchema = z.object({
  id: checkIdSchema,
  status: checkStatusSchema,
  title: z.string(),
  detail: z.string(),
  fix: z.string().optional(),
})
export type Check = z.infer<typeof checkSchema>

export const mediaSchema = z.enum(['SSD', 'HDD', 'Desconhecido'])
export type Media = z.infer<typeof mediaSchema>

export const driveSchema = z.object({
  letter: z.string(),
  label: z.string(),
  media: mediaSchema,
  freeBytes: z.number(),
  totalBytes: z.number(),
  system: z.boolean(),
})
export type Drive = z.infer<typeof driveSchema>

export const preflightSchema = z.object({
  checks: z.array(checkSchema),
  overall: checkStatusSchema,
  drives: z.array(driveSchema),
  chosenDrive: z.string(),
  ranAt: z.string(),
})
export type Preflight = z.infer<typeof preflightSchema>

export const preflightInputSchema = z.object({
  drive: z.string().optional(),
})
export type PreflightInput = z.infer<typeof preflightInputSchema>

export const preflightPartialSchema = z.object({
  token: z.number(),
  checks: z.array(checkSchema).optional(),
  drives: z.array(driveSchema).optional(),
})
export type PreflightPartial = z.infer<typeof preflightPartialSchema>

export const CHECK_ORDER: readonly CheckId[] = [
  'windows',
  'admin',
  'winget',
  'internet',
  'drive',
  'virtualization',
]

export const RECOMMENDED_SPACE_GB = 20
export const MINIMUM_SPACE_GB = 5

export const RECOMMENDED_SYSTEM_GB = 15
export const MINIMUM_SYSTEM_GB = 5

export const MINIMUM_BUILD = 17763

export function worstStatus(checks: readonly Check[]): CheckStatus {
  if (checks.some((c) => c.status === 'blocker')) return 'blocker'
  if (checks.some((c) => c.status === 'warning')) return 'warning'
  return 'ok'
}

export function formatGb(bytes: number): string {
  const gb = bytes / 1024 ** 3
  if (gb >= 1000) {
    return `${(gb / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} TB`
  }
  return `${gb.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`
}

const SEVERITY: Record<CheckStatus, number> = { ok: 0, warning: 1, blocker: 2 }

function worse(a: Check, b: Check): Check {
  return SEVERITY[b.status] > SEVERITY[a.status] ? b : a
}

function checkSystemSpace(system: Drive, chosen: Drive): Check {
  const freeGb = system.freeBytes / 1024 ** 3
  const detail = `${formatGb(system.freeBytes)} livres em ${system.letter} · ${formatGb(chosen.freeBytes)} em ${chosen.letter}`

  if (freeGb >= RECOMMENDED_SYSTEM_GB) {
    return { id: 'drive', status: 'ok', title: 'Espaço livre', detail }
  }

  const why = `Você escolheu instalar em ${chosen.letter}, mas todo instalador do Windows descompacta arquivos temporários e guarda uma cópia do pacote em ${system.letter}.`

  if (freeGb >= MINIMUM_SYSTEM_GB) {
    return {
      id: 'drive',
      status: 'warning',
      title: `Pouco espaço em ${system.letter}`,
      detail,
      fix: `${why} Com menos de ${RECOMMENDED_SYSTEM_GB} GB ali, alguns programas podem falhar no meio.`,
    }
  }

  return {
    id: 'drive',
    status: 'blocker',
    title: `Sem espaço em ${system.letter}`,
    detail,
    fix: `${why} Libere pelo menos ${MINIMUM_SYSTEM_GB} GB em ${system.letter} antes de continuar, senão os instaladores param no meio mesmo com ${chosen.letter} vazio.`,
  }
}

export function checkDrive(drive: Drive, systemDrive?: Drive): Check {
  const chosen = checkChosenDrive(drive)
  if (!systemDrive || systemDrive.letter.toUpperCase() === drive.letter.toUpperCase()) {
    return chosen
  }
  return worse(chosen, checkSystemSpace(systemDrive, drive))
}

function checkChosenDrive(drive: Drive): Check {
  const freeGb = drive.freeBytes / 1024 ** 3
  const media = drive.media === 'Desconhecido' ? '' : ` · ${drive.media}`
  const detail = `${formatGb(drive.freeBytes)} livres de ${formatGb(drive.totalBytes)} em ${drive.letter}${media}`

  if (freeGb >= RECOMMENDED_SPACE_GB) {
    return { id: 'drive', status: 'ok', title: 'Espaço livre', detail }
  }
  if (freeGb >= MINIMUM_SPACE_GB) {
    return {
      id: 'drive',
      status: 'warning',
      title: 'Espaço livre apertado',
      detail,
      fix: `Dá para instalar alguns programas, mas o catálogo inteiro pede cerca de ${RECOMMENDED_SPACE_GB} GB.`,
    }
  }
  return {
    id: 'drive',
    status: 'blocker',
    title: 'Espaço livre insuficiente',
    detail,
    fix: `Escolha outro disco acima ou libere pelo menos ${MINIMUM_SPACE_GB} GB em ${drive.letter}.`,
  }
}

export function withOtherDrive(base: Preflight, drive: Drive): Preflight {
  const system = base.drives.find((d) => d.system)
  const checks = base.checks.map((c) => (c.id === 'drive' ? checkDrive(drive, system) : c))
  return { ...base, checks, overall: worstStatus(checks), chosenDrive: drive.letter }
}
