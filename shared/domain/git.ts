import { z } from 'zod'

export const lineEndingSchema = z.enum(['true', 'input', 'false'])
export type LineEnding = z.infer<typeof lineEndingSchema>

export interface LineEndingChoice {
  id: LineEnding
  name: string
  hint: string
}

export const LINE_ENDINGS: readonly LineEndingChoice[] = [
  {
    id: 'true',
    name: 'Do jeito do Windows',
    hint: 'converte na hora de baixar e de enviar, é o que o Git recomenda aqui',
  },
  {
    id: 'input',
    name: 'Do jeito do Linux',
    hint: 'converte só na hora de enviar, para quem trabalha com colegas em Mac e Linux',
  },
  {
    id: 'false',
    name: 'Não mexer',
    hint: 'grava o arquivo exatamente como ele veio',
  },
]

export const LINE_ENDING_BY_ID: ReadonlyMap<string, LineEndingChoice> = new Map(
  LINE_ENDINGS.map((choice) => [choice.id, choice]),
)

export const gitSchema = z.object({
  name: z.string(),
  email: z.string(),
  branch: z.string(),
  saveLogin: z.boolean().optional(),
  lineEnding: lineEndingSchema.optional(),
  pullRebase: z.boolean().optional(),
  sshKey: z.boolean().optional(),
})
export type GitConfig = z.infer<typeof gitSchema>

export const DEFAULT_GIT: GitConfig = { name: '', email: '', branch: 'main' }

export function gitConfigPairs(config: GitConfig): [string, string][] {
  const pairs: [string, string][] = []

  if (config.name.trim()) pairs.push(['user.name', config.name.trim()])
  if (config.email.trim()) pairs.push(['user.email', config.email.trim()])
  if (config.branch.trim()) pairs.push(['init.defaultBranch', config.branch.trim()])
  if (config.lineEnding) pairs.push(['core.autocrlf', config.lineEnding])
  if (config.pullRebase !== undefined) pairs.push(['pull.rebase', String(config.pullRebase)])
  if (config.saveLogin) pairs.push(['credential.helper', 'manager'])

  return pairs
}

export function gitIsEmpty(config: GitConfig | undefined): boolean {
  return !config || gitConfigPairs(config).length === 0
}

export function gitSummary(config: GitConfig | undefined): string[] {
  if (!config) return []

  const parts: string[] = []
  if (config.name.trim() || config.email.trim()) parts.push('Git configurado')
  if (config.lineEnding) {
    parts.push(`fim de linha ${LINE_ENDING_BY_ID.get(config.lineEnding)?.name.toLowerCase() ?? ''}`)
  }
  if (config.pullRebase === true) parts.push('pull com rebase')
  if (config.pullRebase === false) parts.push('pull com merge')
  if (config.sshKey) parts.push('chave SSH')
  if (config.saveLogin) parts.push('login do GitHub guardado')

  return parts
}
