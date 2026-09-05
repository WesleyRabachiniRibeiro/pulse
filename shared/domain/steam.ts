import { z } from 'zod'

export const steamGameSchema = z.object({
  appid: z.string(),
  name: z.string(),
  bytes: z.number().optional(),
  drive: z.string().optional(),
})
export type SteamGame = z.infer<typeof steamGameSchema>

export const steamLibrarySchema = z.object({
  hasSteam: z.boolean(),
  installed: z.array(steamGameSchema),
  owned: z.array(steamGameSchema),
})
export type SteamLibrary = z.infer<typeof steamLibrarySchema>

export const steamSearchInputSchema = z.object({
  term: z.string().min(2),
})

export function formatBytes(bytes: number): string {
  const gb = bytes / 1024 ** 3
  if (gb >= 1) return `${gb.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`
}
