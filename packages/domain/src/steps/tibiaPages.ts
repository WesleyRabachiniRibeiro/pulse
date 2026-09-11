import { z } from 'zod'
import { TIBIA_CLIENTS } from '@pulse/catalog-data'
import { countLabel } from './label'
import type { StepDescriptor } from './step'

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
