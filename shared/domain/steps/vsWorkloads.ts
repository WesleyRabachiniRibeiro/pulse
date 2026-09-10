import { z } from 'zod'
import { countLabel, type SettingsOption } from './option'
import type { StepDescriptor } from './step'

export const VS_WORKLOADS: readonly SettingsOption[] = [
  {
    id: 'Microsoft.VisualStudio.Workload.NativeDesktop',
    name: 'C e C++',
    hint: 'compilador, depurador e projetos de desktop',
    category: 'Linguagens',
  },
  {
    id: 'Microsoft.VisualStudio.Workload.ManagedDesktop',
    name: 'C#',
    hint: '.NET para desktop, WPF e Windows Forms',
    category: 'Linguagens',
  },
]

export const vsWorkloads: StepDescriptor<string[]> = {
  id: 'vsWorkloads',
  title: 'LINGUAGENS PARA INSTALAR',
  description:
    'O Visual Studio não instala linguagens soltas, instala cargas de trabalho. Marque as que você usa e elas entram junto, na mesma instalação. C e C++ vêm na mesma carga, porque compartilham o compilador.',
  schema: z.array(z.string()),
  options: VS_WORKLOADS,
  isEmpty: (value) => value.length === 0,
  summary: (value) => [countLabel(value.length, 'linguagem', 'linguagens')],
}
