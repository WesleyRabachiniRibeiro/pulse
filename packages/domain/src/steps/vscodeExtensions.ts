import { z } from 'zod'
import { VSCODE_EXTENSIONS } from '@pulse/catalog-data'
import { countLabel } from './label'
import type { StepDescriptor } from './step'

export const vscodeExtensions: StepDescriptor<string[]> = {
  id: 'vscodeExtensions',
  title: 'EXTENSÕES PARA INSTALAR JUNTO',
  description:
    'Marcadas aqui, elas entram sozinhas assim que o VS Code terminar de instalar. Dá para mudar de ideia depois, dentro do próprio editor.',
  schema: z.array(z.string()),
  options: VSCODE_EXTENSIONS,
  searchPlaceholder: 'Buscar extensão…',
  isEmpty: (value) => value.length === 0,
  summary: (value) => [countLabel(value.length, 'extensão', 'extensões')],
}
