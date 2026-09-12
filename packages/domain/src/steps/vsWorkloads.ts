import { z } from 'zod'
import { VS_WORKLOADS } from '@pulse/catalog-data'
import { countLabel } from './label'
import type { StepDescriptor } from './step'

export const vsWorkloads: StepDescriptor<string[]> = {
  id: 'vsWorkloads',
  title: 'LINGUAGENS PARA INSTALAR',
  description:
    'O Visual Studio não instala linguagens soltas, instala cargas de trabalho. Marque as que você usa e elas entram junto, na mesma instalação. C e C++ vêm na mesma carga, porque compartilham o compilador.',
  schema: z.array(z.string()),
  options: VS_WORKLOADS,
  searchPlaceholder: 'Buscar uma linguagem…',
  isEmpty: (value) => value.length === 0,
  summary: (value) => [countLabel(value.length, 'linguagem', 'linguagens')],
}
