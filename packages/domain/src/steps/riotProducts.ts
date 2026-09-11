import { z } from 'zod'
import { RIOT_GAMES } from '@pulse/catalog-data'
import { countLabel } from './label'
import type { StepDescriptor } from './step'

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
