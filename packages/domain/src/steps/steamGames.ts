import { z } from 'zod'
import { steamGameSchema, type SteamGame } from '../steam'
import type { StepDescriptor } from './step'

export const steamGames: StepDescriptor<SteamGame[]> = {
  id: 'steamGames',
  title: 'JOGOS PARA BAIXAR DEPOIS',
  description:
    'A Steam só baixa com a sua conta conectada. Na hora de instalar, o app espera você entrar e depois abre o pedido de cada jogo, que você confirma na janela dela.',
  schema: z.array(steamGameSchema),
  isEmpty: (value) => value.length === 0,
  summary: (value) => {
    if (value.length === 0) return []
    if (value.length <= 2) return [value.map((game) => game.name).join(' e ')]
    return [`${value.length} jogos`]
  },
}
