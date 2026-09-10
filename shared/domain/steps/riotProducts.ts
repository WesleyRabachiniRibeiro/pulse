import { z } from 'zod'
import { byId, countLabel, type SettingsOption } from './option'
import type { StepDescriptor } from './step'

export const RIOT_GAMES: readonly SettingsOption[] = [
  {
    id: 'RiotGames.Valorant.BR',
    name: 'VALORANT',
    hint: 'servidor Brasil',
    category: 'Jogos',
  },
  {
    id: 'RiotGames.LegendsOfRuneterra.Americas',
    name: 'Legends of Runeterra',
    hint: 'servidor Américas',
    category: 'Jogos',
  },
]

export const RIOT_BY_ID: ReadonlyMap<string, SettingsOption> = byId(RIOT_GAMES)

export const riotProducts: StepDescriptor<string[]> = {
  id: 'riotProducts',
  title: 'JOGOS PARA INSTALAR JUNTO',
  description:
    'Entram logo depois do cliente da Riot, um de cada vez, no mesmo disco que você escolheu. O League of Legends já vem com o cliente, e o Teamfight Tactics vem dentro dele.',
  schema: z.array(z.string()),
  options: RIOT_GAMES,
  isEmpty: (value) => value.length === 0,
  summary: (value) => [countLabel(value.length, 'jogo da Riot', 'jogos da Riot')],
}
