import { z } from 'zod'

export const gitSchema = z.object({
  name: z.string(),
  email: z.string(),
  branch: z.string(),
  saveLogin: z.boolean().optional(),
})
export type GitConfig = z.infer<typeof gitSchema>

export const DEFAULT_GIT: GitConfig = { name: '', email: '', branch: 'main' }

export function gitConfigPairs(config: GitConfig): [string, string][] {
  const pairs: [string, string][] = []

  if (config.name.trim()) pairs.push(['user.name', config.name.trim()])
  if (config.email.trim()) pairs.push(['user.email', config.email.trim()])
  if (config.branch.trim()) pairs.push(['init.defaultBranch', config.branch.trim()])
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
