import { z } from 'zod'
import { runtimeToolsFor } from '../runtime'
import { countLabel } from './label'
import type { StepDescriptor } from './step'

export const runtimePackages: StepDescriptor<string[]> = {
  id: 'runtimePackages',
  title: 'FERRAMENTAS PARA INSTALAR JUNTO',
  description:
    'Entram logo depois do runtime, numa chamada só. Se o gerenciador não estiver no PATH ainda, o Pulse avisa no resumo e deixa para depois.',
  schema: z.array(z.string()),
  optionsFor: (programId) => runtimeToolsFor(programId)?.packages ?? [],
  searchPlaceholder: 'Buscar uma ferramenta…',
  isEmpty: (value) => value.length === 0,
  summary: (value) => [countLabel(value.length, 'ferramenta', 'ferramentas')],
}
