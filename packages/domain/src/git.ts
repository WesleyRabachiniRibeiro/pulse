import { z } from 'zod'

export const lineEndingSchema = z.enum(['crlf', 'lf', 'keep'])
export type LineEnding = z.infer<typeof lineEndingSchema>

export const gitSchema = z.object({
  name: z.string(),
  email: z.string(),
  branch: z.string(),
  lineEnding: lineEndingSchema.optional(),
  pullRebase: z.boolean().optional(),
  sshKey: z.boolean().optional(),
  saveLogin: z.boolean().optional(),
})
export type GitConfig = z.infer<typeof gitSchema>

export const DEFAULT_GIT: GitConfig = { name: '', email: '', branch: 'main' }

export const AUTOCRLF: Record<LineEnding, string> = {
  crlf: 'true',
  lf: 'input',
  keep: 'false',
}

export const LINE_ENDINGS: readonly { id: LineEnding; name: string; hint: string }[] = [
  { id: 'crlf', name: 'CRLF aqui, LF no repositório', hint: 'o costume em máquina Windows' },
  { id: 'lf', name: 'LF sempre', hint: 'grava LF e não converte ao baixar' },
  { id: 'keep', name: 'Não mexer', hint: 'deixa o arquivo exatamente como veio' },
]

export function gitConfigPairs(config: GitConfig): [string, string][] {
  const pairs: [string, string][] = []

  if (config.name.trim()) pairs.push(['user.name', config.name.trim()])
  if (config.email.trim()) pairs.push(['user.email', config.email.trim()])
  if (config.branch.trim()) pairs.push(['init.defaultBranch', config.branch.trim()])
  if (config.lineEnding) pairs.push(['core.autocrlf', AUTOCRLF[config.lineEnding]])
  if (config.pullRebase !== undefined) pairs.push(['pull.rebase', String(config.pullRebase)])
  if (config.saveLogin) pairs.push(['credential.helper', 'manager'])

  return pairs
}

export function gitIsEmpty(config: GitConfig | undefined): boolean {
  return !config || (!config.name.trim() && !config.email.trim() && !config.saveLogin)
}

export function gitSummary(config: GitConfig | undefined): string[] {
  if (!config) return []

  const parts: string[] = []
  if (config.name.trim() || config.email.trim()) parts.push('Git configurado')
  if (config.saveLogin) parts.push('login do GitHub guardado')

  return parts
}
