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

const NOT_A_GAME = /redistributable|proton|steam linux runtime|steamworks common/i

export function isRealGame(name: string): boolean {
  return !NOT_A_GAME.test(name)
}
