import { z } from 'zod'
import { byId, countLabel, type SettingsOption } from './option'
import type { StepDescriptor } from './step'

export const TIBIA_CLIENTS: readonly SettingsOption[] = [
  {
    id: 'tibia-oficial',
    name: 'Tibia (oficial)',
    hint: 'da CipSoft, pede aceitar o contrato antes de baixar',
    category: 'Oficial',
    url: 'https://www.tibia.com/support/?subtopic=downloads',
  },
  {
    id: 'medivia',
    name: 'Medivia Online',
    hint: 'nasceu de um servidor privado e virou jogo próprio',
    category: 'Old school',
    url: 'https://www.medivia.online/',
  },
]

export const TIBIA_BY_ID: ReadonlyMap<string, SettingsOption> = byId(TIBIA_CLIENTS)

export const tibiaPages: StepDescriptor<string[]> = {
  id: 'tibiaPages',
  title: 'QUAIS TIBIAS VOCÊ QUER',
  description:
    'Cada Tibia tem o seu próprio cliente, baixado do site de quem faz o servidor. O Pulse abre a página oficial dos que você marcar, uma de cada vez, e você baixa e instala de lá. Ele não baixa esses arquivos sozinho porque não há como conferir se veio o que devia.',
  schema: z.array(z.string()),
  options: TIBIA_CLIENTS,
  isEmpty: (value) => value.length === 0,
  summary: (value) => [countLabel(value.length, 'cliente', 'clientes')],
}
