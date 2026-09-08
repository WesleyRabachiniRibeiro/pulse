import { z } from 'zod'

export const installScopeSchema = z.enum(['user', 'machine'])
export type InstallScope = z.infer<typeof installScopeSchema>

export interface LocaleChoice {
  id: string
  name: string
  hint: string
}

export const LOCALES: readonly LocaleChoice[] = [
  { id: 'pt-BR', name: 'Português do Brasil', hint: 'quando o programa tiver' },
  { id: 'en-US', name: 'Inglês', hint: 'costuma ser o que sempre existe' },
  { id: 'es-ES', name: 'Espanhol', hint: 'quando o programa tiver' },
]

export const LOCALE_BY_ID: ReadonlyMap<string, LocaleChoice> = new Map(
  LOCALES.map((locale) => [locale.id, locale]),
)

export interface InstallArgsInput {
  packageId: string
  source?: 'msstore' | 'pages'
  destination?: string
  override?: string
  scope?: InstallScope
  locale?: string
  interactive?: boolean
  logPath?: string
}

export function installArgs(input: InstallArgsInput): string[] {
  const args = [
    'install',
    '--id',
    input.packageId,
    '--exact',
    '--accept-package-agreements',
    '--accept-source-agreements',
  ]

  if (input.interactive) args.push('--interactive')
  else args.push('--disable-interactivity')

  if (input.scope) args.push('--scope', input.scope)
  if (input.locale) args.push('--locale', input.locale)
  if (input.logPath) args.push('--log', input.logPath)

  if (input.source === 'msstore') {
    args.push('--source', 'msstore')
    return args
  }

  if (input.override) {
    args.push('--override', input.override)
    return args
  }

  if (!input.interactive) args.push('--silent')
  if (input.destination) args.push('--location', input.destination)

  return args
}

export function scopeLabel(scope: InstallScope): string {
  return scope === 'machine' ? 'para todos os usuários' : 'só para você'
}

const NO_INSTALLER = [
  'nenhum instalador aplicavel',
  'no applicable installer',
  'nao foi encontrado um instalador',
  'no installer found',
]

export function noApplicableInstaller(output: string): boolean {
  const text = output
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
  return NO_INSTALLER.some((phrase) => text.includes(phrase))
}
